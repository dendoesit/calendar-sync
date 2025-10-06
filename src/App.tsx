import { useState, useEffect } from 'react';
import { addMonths, subMonths, format, startOfDay, subDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { CalendarHeader } from './components/CalendarHeader';
import TimelineCalendar from './components/TimelineCalendar';
import { AddEventModal } from './components/AddEventModal';
import { EventDetailsModal } from './components/EventDetailsModal';
import { CalendarEvent } from './types/calendar';
import {  parseICalFromUrl, dedupeIncoming, eventSignature, mergeOverlappingByTitleAndApartment, isSubsumedByExisting } from './utils/icalParser';


function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  // selectedDay removed — timeline doesn't set a day selection
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Load events from localStorage on component mount
  useEffect(() => {
    const savedEvents = localStorage.getItem('calendar-events');
    if (savedEvents) {
      try {
        const parsed = JSON.parse(savedEvents) as Array<Record<string, unknown>>;
        const parsedEvents = parsed.map((event) => {
          const startRaw = event['startDate'];
          const endRaw = event['endDate'];
          const startDate = startRaw ? new Date(String(startRaw)) : new Date();
          const endDate = endRaw ? new Date(String(endRaw)) : new Date();
          const base = event as Record<string, unknown>;
          // migrate title variants to canonical 'booking reservations'
          const rawTitle = (base['title'] || '') as unknown;
          const titleStr = String(rawTitle || '').trim();
          const titleKey = titleStr.toLowerCase().replace(/[\s-]/g, '');
          const normalizedTitle = titleKey === 'closednotavailable' ? 'booking reservations' : titleStr;

          return {
            ...(base as Record<string, unknown>),
            title: normalizedTitle,
            startDate,
            endDate,
          } as CalendarEvent;
        });
        // Deduplicate saved events by signature in case duplicates were stored previously.
        const seen: Record<string, boolean> = {};
        const deduped = parsedEvents.filter(ev => {
          const sig = eventSignature(ev as CalendarEvent);
          if (seen[sig]) return false;
          seen[sig] = true;
          return true;
        });
        if (deduped.length !== parsedEvents.length) {
          console.log(`Startup dedupe: removed ${parsedEvents.length - deduped.length} duplicate events from saved store`);
        }
        // Merge overlapping CLOSED/not-available blocks after dedupe so long contiguous closed ranges are a single event
        const merged = mergeOverlappingByTitleAndApartment(deduped);
        setEvents(merged);
      } catch (error) {
        console.error('Failed to load saved events:', error);
      }
    }
  }, []);

  // Save events to localStorage whenever events change
  useEffect(() => {
    localStorage.setItem('calendar-events', JSON.stringify(events));
  }, [events]);

  // Define the iCal sources (keys correspond to server routes /api/ical/:source)
  const ICAL_SOURCES = [
  { key: 'unit-green', label: 'Ap. 7 - Green', color: '#10B981', enabled: true },
  { key: 'unit-red', label: 'Ap. 9 - Red', color: '#EF4444', enabled: true },
  { key: 'unit-grey', label: 'Ap. 6 - Grey', color: '#9CA3AF', enabled: true },
  ];

  const getLabelForUnit = (unitKey?: string) => {
    if (!unitKey) return 'Unit';
    const found = ICAL_SOURCES.find(s => s.key === unitKey);
    return found ? found.label : unitKey;
  };

  // Manual sync: fetch all iCal sources, verify events, dedupe and merge
  const handleSync = async () => {
    const providers = ['airbnb', 'booking'];
    const fetched: CalendarEvent[] = [];

    for (const src of ICAL_SOURCES) {
      if (!src.enabled) continue;
      for (const provider of providers) {
        try {
          const imported = await parseICalFromUrl(src.key, provider);
          if (!imported || imported.length === 0) continue;

          const normalized = imported.map(ev => {
            const title = (ev.title || '').toString().trim();
            const normalizedTitle = title.toLowerCase() === 'closed not available' ? 'booking reservations' : title || 'Imported Booking';
            return ({
              ...ev,
              title: normalizedTitle,
              apartment: src.key,
              color: ev.color ?? src.color,
              provider,
              type: ev.type ?? 'imported',
            } as CalendarEvent);
          });

          // basic verification: ensure startDate <= endDate
          const verified = normalized.filter(e => {
            if (!e.startDate || !e.endDate) return false;
            return e.startDate <= e.endDate;
          });

          // Filter out incoming events that are fully subsumed by existing ones (avoid big overlapping imports)
          const filtered = verified.filter(iv => !isSubsumedByExisting(iv, events));
          fetched.push(...filtered);
        } catch (err) {
          console.warn(`Sync failed for ${src.key}/${provider}:`, err);
        }
      }
    }

    // Deduplicate incoming against existing events using signature (uid or composite)
    setEvents(prev => {
      const newOnes = dedupeIncoming(prev, fetched);
      if (newOnes.length) {
        // Merge overlapping CLOSED/Not available events among existing + new ones to avoid duplicates/overlaps
        const combined = [...prev, ...newOnes];
        const merged = mergeOverlappingByTitleAndApartment(combined);
        console.log(`Sync: added ${newOnes.length} new events (post-merge count ${merged.length})`);
        return merged;
      }
      console.log('Sync: no new events found');
      return prev;
    });
  };

  // Fetch iCal data from the backend on startup and merge into events
  useEffect(() => {
    const providers = ['airbnb', 'booking'];

    const loadRemoteICal = async () => {
      try {
        for (const src of ICAL_SOURCES) {
          if (!src.enabled) continue;
          for (const provider of providers) {
            try {
              const imported = await parseICalFromUrl(src.key, provider);
              if (imported && imported.length > 0) {
                // Normalize imported events: set apartment to the unit key so timeline matching is consistent
                const normalized = imported.map(ev => {
                  const title = (ev.title || '').toString().trim();
                  const normalizedTitle = title.toLowerCase() === 'closed not available' ? 'booking reservations' : title || 'Imported Booking';
                  return {
                    ...ev,
                    title: normalizedTitle,
                    apartment: src.key, // use unit key (e.g., 'unit-green')
                    color: ev.color ?? src.color,
                    provider: provider,
                  } as CalendarEvent;
                });

                setEvents(prev => {
                  // Filter normalized events that are fully subsumed by existing events (avoid adding a broad import
                  // that is already covered by smaller existing reservations)
                  const filtered = normalized.filter(nv => !isSubsumedByExisting(nv, prev));
                  // Use signature-based deduplication (uid or composite) so we don't add duplicates when imported events lack stable IDs.
                  const newOnes = dedupeIncoming(prev, filtered);
                  return newOnes.length ? [...prev, ...newOnes] : prev;
                });
              }
            } catch (err) {
              console.warn(`Failed to import ${src.key}/${provider}:`, err);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch iCal data on startup:', error);
      }
    };

    loadRemoteICal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  

  // (grid-based days are no longer used; timeline view is used instead)

  // Timeline window: start a few days in the past so user can scroll left slightly and see recent past reservations
  const PAST_DAYS_TO_SHOW = 3; // number of days to allow scrolling into the past
  const timelineStart = startOfDay(subDays(new Date(), PAST_DAYS_TO_SHOW));
  const timelineEnd = new Date(currentDate);
  timelineEnd.setDate(timelineEnd.getDate() + 60);

  const handlePreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // (Import handled on startup / refresh) - kept for compatibility if needed later

  const handleAddEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(event => event.id !== eventId));
  };

  // click-to-add handled via timeline or add button

  // Event click handled inline in CalendarGrid for now

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Calendar Airbnb + Booking
          </h1>
          <div className="flex items-center justify-left  gap-2">
          <h3 className='text-2xl'>Buna Cami !</h3>
          <p className="text-5xl">&#9995;</p>
        </div>


        </div>

        {/* Calendar Header */}
        <CalendarHeader
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onAddEventClick={() => setIsAddEventModalOpen(true)}
          onSync={handleSync}
        />

        {/* Timeline view (horizontal scroll) */}
        <TimelineCalendar
          startDate={timelineStart}
          endDate={timelineEnd}
          // Only show events that haven't already ended before the timeline start
          events={events.filter(e => e.endDate >= timelineStart)}
          units={ICAL_SOURCES.map(s => ({ key: s.key, label: s.label, color: s.color }))}
          scrollToDate={currentDate}
          onEventClick={(ev) => {
            setSelectedEvent(ev);
            setIsEventDetailsModalOpen(true);
          }}
        />

        {/* Upcoming events list grouped by apartment and sorted by date (primary sort = date) */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Rezervari</h2>
          <div className="space-y-4">
            {(() => {
              const upcoming = events.filter(e => e.endDate >= timelineStart).sort((a, b) => +a.startDate - +b.startDate);
              if (upcoming.length === 0) return <div className="text-sm text-gray-500">No upcoming events</div>;

              // Order apartments by ICAL_SOURCES (the three apartments defined above)
              const aptOrder = ICAL_SOURCES.map(s => s.key);

              // Map events to apartments (use 'other' for unknown)
              const aptMap: Record<string, CalendarEvent[]> = {};
              upcoming.forEach(ev => {
                const aptKey = (ev.apartment as string) || 'other';
                if (!aptMap[aptKey]) aptMap[aptKey] = [];
                aptMap[aptKey].push(ev);
              });

              // Helper to render a single apartment section
              const renderApartment = (key: string, label?: string) => {
                const list = (aptMap[key] || []).sort((a, b) => +a.startDate - +b.startDate);
                if (list.length === 0) return null;
                return (
                  <div key={key}>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">{label || getLabelForUnit(key)}</h3>
                    <div className="space-y-2">
                      {list.map(e => (
                        <div key={e.id} className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{`• ${format(e.startDate, 'MMM d', { locale: ro })} — ${format(e.endDate, 'MMM d', { locale: ro })}`}</div>
                            <div className="text-xs text-gray-500"> {e.title}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-700" style={{ color: e.color }}>
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-3">
                  {/* Render the three known apartments in order */}
                  {aptOrder.map(k => renderApartment(k, getLabelForUnit(k)))}

                  {/* Render any other apartments/events that didn't match the known keys */}
                  {Object.keys(aptMap)
                    .filter(k => !aptOrder.includes(k))
                    .map(k => renderApartment(k, k === 'other' ? 'Other / Unassigned' : k))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{events.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">{events.length}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Manual Bookings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.filter(e => e.type === 'manual').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-semibold">
                  {events.filter(e => e.type === 'manual').length}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Imported Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.filter(e => e.type === 'imported').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-semibold">
                  {events.filter(e => e.type === 'imported').length}
                </span>
              </div>
            </div>
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