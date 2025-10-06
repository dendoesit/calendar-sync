import React from 'react';
import { Lock } from 'lucide-react';
import { Day } from '../types/calendar';
import { format } from 'date-fns';

interface CalendarGridProps {
  days: Day[];
  onDayClick: (day: Day) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarGrid: React.FC<CalendarGridProps> = ({ days, onDayClick }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        {WEEKDAYS.map(day => (
          <div key={day} className="p-4 text-center font-semibold text-gray-700 text-sm md:text-base">
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{day.slice(0, 1)}</span>
          </div>
        ))}
      </div>
      
      {/* Calendar days */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => (
          <div
            key={index}
            onClick={() => onDayClick(day)}
            className={`
              min-h-[100px] md:min-h-[120px] p-2 border-r border-b border-gray-100 cursor-pointer 
              hover:bg-blue-50 transition-all duration-200 hover:shadow-inner group
              ${!day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-blue-50'}
              ${day.isToday ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset' : ''}
            `}
          >
            <div className={`
              text-sm md:text-base font-medium mb-2 transition-colors duration-200
              ${day.isToday ? 'text-blue-700 font-bold' : day.isCurrentMonth ? 'text-gray-900 group-hover:text-blue-700' : 'text-gray-400'}
            `}>
              <div className="flex items-center space-x-2">
                <span>{day.date.getDate()}</span>
                {day.events.some(ev => ev.endDate > ev.startDate) && (
                  <Lock className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              {day.events.slice(0, 2).map(event => (
                <div
                  key={event.id}
                  className="text-xs px-2 py-1 rounded-md truncate shadow-sm transition-transform duration-200 hover:scale-105 cursor-pointer"
                  style={{ 
                    backgroundColor: event.color + '20', 
                    color: event.color,
                    borderLeft: `3px solid ${event.color}`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Could trigger event details here
                  }}
                  title={`${format(event.startDate, 'MMM d, yyyy, HH:mm')} — ${format(event.endDate, 'MMM d, yyyy, HH:mm')}`}
                >
                  <div className="flex items-center justify-between space-x-2">
                    <span className="truncate">
                      {`${format(event.startDate, 'MMM d, HH:mm')} — ${format(event.endDate, 'MMM d, HH:mm')}`}
                    </span>
                    {/* show a small blocked/lock icon if the event spans multiple days */}
                    {event.endDate > event.startDate && (
                      <Lock className="w-3 h-3 text-gray-500 ml-2" />
                    )}
                  </div>
                </div>
              ))}
              {day.events.length > 2 && (
                <div className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-md">
                  +{day.events.length - 2} more
                </div>
              )}
              {day.events.length === 0 && day.isCurrentMonth && (
                <div className="text-xs text-gray-400 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Click to add event
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};