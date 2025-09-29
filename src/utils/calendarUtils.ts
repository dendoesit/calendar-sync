import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { CalendarEvent, Day } from '../types/calendar';

export const generateCalendarDays = (currentDate: Date, events: CalendarEvent[]): Day[] => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return days.map(date => ({
    date,
    isCurrentMonth: isSameMonth(date, currentDate),
    isToday: isToday(date),
    // Include events that start on this day OR cover this day within their start/end interval
    events: events.filter(event => {
      try {
        // treat event as covering whole days: compare date against startOfDay(start) and endOfDay(end)
        const start = startOfDay(event.startDate);
        const end = endOfDay(event.endDate);
        return isSameDay(event.startDate, date) || isWithinInterval(date, { start, end });
      } catch {
        // If dates are invalid for some reason, fall back to strict same-day match
        return isSameDay(event.startDate, date);
      }
    })
  }));
};

export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const formatTime = (date: Date): string => {
  return format(date, 'HH:mm');
};

export const formatDateTime = (date: Date): string => {
  return format(date, "yyyy-MM-dd'T'HH:mm");
};