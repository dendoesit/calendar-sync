import React from 'react';
import { X, Calendar, Clock, FileText, Trash2 } from 'lucide-react';
import { CalendarEvent } from '../types/calendar';
import { format } from 'date-fns';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onDelete: (eventId: string) => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  isOpen,
  onClose,
  event,
  onDelete
}) => {
  if (!isOpen || !event) return null;

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      onDelete(event.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Event Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Event Title */}
          <div className="flex items-start space-x-3">
            <div
              className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: event.color }}
            />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
              <span className="text-sm text-gray-500 capitalize">
                {event.type} event
              </span>
            </div>
          </div>

          {/* Date and Time */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {format(event.startDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                {format(event.startDate, 'h:mm a')} - {format(event.endDate, 'h:mm a')}
              </span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="flex items-start space-x-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {event.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            Close
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};