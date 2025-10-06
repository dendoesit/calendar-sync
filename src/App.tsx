import { useState, useEffect } from 'react';
import { addMonths, subMonths, format, startOfDay, subDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { CalendarHeader } from './components/CalendarHeader';
import TimelineCalendar from './components/TimelineCalendar';
import { AddEventModal } from './components/AddEventModal';
import { EventDetailsModal } from './components/EventDetailsModal';
import { CalendarEvent } from './types/calendar';
import { parseICalFromUrl, dedupeIncoming, isSubsumedByExisting } from './utils/icalParser';

function normalizeTitle(title?: string): string {
  if (!title) return 'Imported Booking';
  return /closed\s*[-]?\s*not\s*available/i.test(title)
    ? 'booking reservations'
    : title.trim();
}

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Load events from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('calendar-events');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CalendarEvent[];
        const fixed = parsed.map(ev => ({
          ...ev,
          startDate: new Date(ev.startDate),
          endDate: new Date(ev.endDate),
          title: normalizeTitle(ev.title),
        }));
        setEvents(fixed);
      } catch (err) {
        console.error('Failed to load saved events', err);
      }
    }
  }, []);

  // Save events to localStorage
  useEffect(() => {
    localStorage.setItem('calendar-events', JSON.stringify(events));
  }, [events]);

  const ICAL_SOURCES = [
    { key: 'unit-green', label: 'Ap. 7 - Green', color: '#10B981', enabled: true },
    { key: 'unit-red', label: 'Ap. 9 - Red', color: '#EF4444', enabled: true },
    { key: 'unit-grey', label: 'Ap. 6 - Grey', color: '#9CA3AF', enabled: true },
  ];

  const getLabelForUnit = (unitKey?: string) =>
    ICAL_SOURCES.find(s => s.key === unitKey)?.label || unitKey || 'Unit';

  // Fetch iCal and merge
  const handleSync = async () => {
    const providers = ['airbnb', 'booking'];
    const fetched: CalendarEvent[] = [];

    for (const src of ICAL_SOURCES) {
      if (!src.enabled) continue;
      for (const provider of providers) {
        try {
          const imported = await parseICalFromUrl(src.key, provider);
          if (!imported?.length) continue;

          const normalized = imported.map(ev => ({
            ...ev,
            title: normalizeTitle(ev.title),
            apartment: src.key,
            color: ev.color ?? src.color,
            provider,
            type: ev.type ?? 'imported',
            startDate: new Date(ev.startDate),
            endDate: new Date(ev.endDate),
          }));

          const verified = normalized.filter(e => e.startDate <= e.endDate);

          // Remove events fully subsumed by existing events
          const filtered = verified.filter(ev => !isSubsumedByExisting(ev, events));

          fetched.push(...filtered);
        } catch (err) {
          console.warn(`Sync failed for ${src.key}/${provider}:`, err);
        }
      }
    }

    // Deduplicate exact duplicates
    setEvents(prev => [...prev, ...dedupeIncoming(prev, fetched)]);
  };

  useEffect(() => {
    handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreviousMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const handleAddEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: normalizeTitle(eventData.title),
    };
    setEvents(prev => [...prev, ...dedupeIncoming(prev, [newEvent])]);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const PAST_DAYS_TO_SHOW = 3;
  const timelineStart = startOfDay(subDays(new Date(), PAST_DAYS_TO_SHOW));
  const timelineEnd = new Date(currentDate);
  timelineEnd.setDate(timelineEnd.getDate() + 60);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Calendar Airbnb + Booking
          </h1>
          <div className="flex items-center justify-left gap-2">
            <h3 className="text-2xl">Bună, Cami!</h3>
            <p className="text-5xl">&#9995;</p>
          </div>
        </div>

        <CalendarHeader
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onAddEventClick={() => setIsAddEventModalOpen(true)}
          onSync={handleSync}
        />

        <TimelineCalendar
          startDate={timelineStart}
          endDate={timelineEnd}
          events={events.filter(e => e.endDate >= timelineStart)}
          units={ICAL_SOURCES.map(s => ({ key: s.key, label: s.label, color: s.color }))}
          scrollToDate={currentDate}
          onEventClick={ev => {
            setSelectedEvent(ev);
            setIsEventDetailsModalOpen(true);
          }}
        />

        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Rezervări</h2>
          <div className="space-y-4">
            {(() => {
              const upcoming = events
                .filter(e => e.endDate >= timelineStart)
                .sort((a, b) => +a.startDate - +b.startDate);

              if (!upcoming.length)
                return <div className="text-sm text-gray-500">No upcoming events</div>;

              const aptOrder = ICAL_SOURCES.map(s => s.key);
              const aptMap: Record<string, CalendarEvent[]> = {};
              upcoming.forEach(ev => {
                const aptKey = ev.apartment || 'other';
                if (!aptMap[aptKey]) aptMap[aptKey] = [];
                aptMap[aptKey].push(ev);
              });

              const renderApartment = (key: string, label?: string) => {
                const list = (aptMap[key] || []).sort(
                  (a, b) => +a.startDate - +b.startDate
                );
                if (!list.length) return null;

                return (
                  <div key={key}>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      {label || getLabelForUnit(key)}
                    </h3>
                    <div className="space-y-2">
                      {list.map(e => (
                        <div
                          key={e.id}
                          className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-medium">{`• ${format(
                              e.startDate,
                              'MMM d',
                              { locale: ro }
                            )} — ${format(e.endDate, 'MMM d', { locale: ro })}`}</div>
                            <div className="text-xs text-gray-500">{e.title}</div>
                          </div>
                          <div
                            className="text-sm font-medium text-gray-700"
                            style={{ color: e.color }}
                          >
                            <span
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: e.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-3">
                  {aptOrder.map(k => renderApartment(k, getLabelForUnit(k)))}
                  {Object.keys(aptMap)
                    .filter(k => !aptOrder.includes(k))
                    .map(k =>
                      renderApartment(k, k === 'other' ? 'Other / Unassigned' : k)
                    )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Modals */}
        <AddEventModal
          isOpen={isAddEventModalOpen}
          onClose={() => setIsAddEventModalOpen(false)}
          onAdd={handleAddEvent}
          selectedDate={undefined}
        />
        <EventDetailsModal
          isOpen={isEventDetailsModalOpen}
          onClose={() => setIsEventDetailsModalOpen(false)}
          event={selectedEvent}
          onDelete={handleDeleteEvent}
        />
      </div>
    </div>
  );
}

export default App;
