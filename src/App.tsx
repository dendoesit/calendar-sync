import { useState, useEffect } from 'react';
import { addMonths, subMonths } from 'date-fns';
import { CalendarHeader } from './components/CalendarHeader';
import TimelineCalendar from './components/TimelineCalendar';
import { AddEventModal } from './components/AddEventModal';
import { EventDetailsModal } from './components/EventDetailsModal';
import { CalendarEvent } from './types/calendar';
import {  parseICalFromUrl } from './utils/icalParser';


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
          return {
            ...(base as Record<string, unknown>),
            startDate,
            endDate,
          } as CalendarEvent;
        });
        setEvents(parsedEvents);
      } catch (error) {
        console.error('Failed to load saved events:', error);
      }
    }
  }, []);

  // Save events to localStorage whenever events change
  useEffect(() => {
    localStorage.setItem('calendar-events', JSON.stringify(events));
  }, [events]);

  // Fetch iCal data from the backend on startup and merge into events
  useEffect(() => {
    const sources = ['airbnb', 'booking'];

    const loadRemoteICal = async () => {
      try {
        for (const src of sources) {
          try {
            const imported = await parseICalFromUrl(src);
            if (imported && imported.length > 0) {
              setEvents(prev => {
                const existingIds = new Set(prev.map(e => e.id));
                const newOnes = imported.filter(i => !existingIds.has(i.id));
                return newOnes.length ? [...prev, ...newOnes] : prev;
              });
            }
          } catch (err) {
            console.warn(`Failed to import ${src}:`, err);
          }
        }
      } catch (error) {
        console.error('Failed to fetch iCal data on startup:', error);
      }
    };

    loadRemoteICal();
  }, []);

  // Manual refresh handler (wired to the header import button) - refresh all known sources
  const handleRefreshImport = async () => {
    const sources = ['airbnb', 'booking'];
    for (const src of sources) {
      try {
        const imported = await parseICalFromUrl(src);
        if (imported && imported.length > 0) {
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const newOnes = imported.filter(i => !existingIds.has(i.id));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }
      } catch (err) {
        console.warn(`Failed to refresh import ${src}:`, err);
      }
    }
  };

  // (grid-based days are no longer used; timeline view is used instead)

  // Timeline window: start 14 days before current, end 60 days after
  const timelineStart = new Date(currentDate);
  timelineStart.setDate(timelineStart.getDate() - 14);
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
            Calendar Booking System
          </h1>
          <p className="text-gray-600">
            Manage your bookings and import calendar events
          </p>
        </div>

        {/* Calendar Header */}
        <CalendarHeader
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onImportClick={handleRefreshImport}
          onAddEventClick={() => setIsAddEventModalOpen(true)}
        />

        {/* Timeline view (horizontal scroll) */}
        <TimelineCalendar
          startDate={timelineStart}
          endDate={timelineEnd}
          events={events}
          onEventClick={(ev) => {
            setSelectedEvent(ev);
            setIsEventDetailsModalOpen(true);
          }}
        />

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