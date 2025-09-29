import React from 'react';
import { eachDayOfInterval, differenceInCalendarDays, format } from 'date-fns';
import { CalendarEvent } from '../types/calendar';

interface TimelineCalendarProps {
  startDate: Date;
  endDate: Date;
  events: CalendarEvent[];
  dayWidth?: number; // px
  leftLabelWidth?: number; // px
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
}

export const TimelineCalendar: React.FC<TimelineCalendarProps> = ({
  startDate,
  endDate,
  events,
  dayWidth = 120,
  leftLabelWidth = 200,
  onEventClick,
}) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const totalWidth = days.length * dayWidth;

  // Derive apartments from events (optional field 'apartment'), fallback to single row 'Unit 1'
  const apartments = Array.from(new Set(events.map(e => e.apartment ?? 'Unit 1')));

  const getDayIndex = (d: Date) => differenceInCalendarDays(d, startDate);

  return (
    <div className="w-full border rounded-lg overflow-hidden">
      {/* header */}
      <div className="flex items-stretch bg-white border-b">
        <div style={{ width: leftLabelWidth }} className="p-3 text-sm font-medium">
          Apartments
        </div>
        <div className="overflow-x-auto w-full">
          <div style={{ width: totalWidth }} className="flex">
            {days.map((d) => (
              <div key={d.toISOString()} style={{ width: dayWidth }} className="p-2 text-center text-xs text-gray-600 border-r">
                <div>{format(d, 'dd')}</div>
                <div className="text-[10px] text-gray-400">{format(d, 'MMM')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* rows */}
      <div className="max-h-[60vh] overflow-auto">
        {apartments.map((apt) => (
          <div key={apt} className="flex items-start border-b bg-white">
            <div style={{ width: leftLabelWidth }} className="p-2 text-sm font-medium bg-gray-50">
              {apt}
            </div>
            <div className="overflow-x-auto w-full relative">
              <div style={{ width: totalWidth, minHeight: 72 }} className="relative">
                {/* vertical day separators (optional) */}
                <div className="absolute inset-0">
                  <div style={{ display: 'flex', height: '100%' }}>
                    {days.map((d) => (
                      <div key={d.toISOString()} style={{ width: dayWidth }} className="border-r h-full"></div>
                    ))}
                  </div>
                </div>

                {/* events for this apartment */}
                {events.filter(e => (e.apartment ?? 'Unit 1') === apt).map(ev => {
                  const startIdx = Math.max(0, getDayIndex(ev.startDate));
                  const endIdx = Math.min(days.length - 1, getDayIndex(ev.endDate));
                  const span = Math.max(1, endIdx - startIdx + 1);
                  const left = startIdx * dayWidth;
                  const width = span * dayWidth - 8; // small gutter

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => onEventClick?.(ev, e)}
                      className="absolute top-3 left-0 rounded-md shadow-sm text-sm text-white px-2 py-1 cursor-pointer"
                      style={{ left, width, backgroundColor: ev.color || '#4F46E5' }}
                      title={ev.title}
                    >
                      <div className="truncate font-medium">{ev.title}</div>
                      <div className="text-xs opacity-80">{format(ev.startDate, 'MMM d')} - {format(ev.endDate, 'MMM d')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineCalendar;
