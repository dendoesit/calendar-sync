import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface CalendarHeaderProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onAddEventClick: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  onAddEventClick
  , onSync
  , isSyncing
}) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        <button
          onClick={onPreviousMonth}
          className="p-2 hover:bg-blue-50 rounded-lg transition-colors duration-200"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {format(currentDate, 'MMMM yyyy', { locale: ro })}
        </h1>
        <button
          onClick={onNextMonth}
          className="p-2 hover:bg-blue-50 rounded-lg transition-colors duration-200"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={onSync}
          disabled={!!isSyncing}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${isSyncing ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
        <button
          onClick={onAddEventClick}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>Add Booking</span>
        </button>
      </div>
    </div>
  );
};