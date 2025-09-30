export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  color: string;
  type: 'imported' | 'manual';
  apartment?: string;
  provider?: string;
}

export interface Day {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export interface ICalConfig {
  name: string;
  url: string;
  color?: string;
  enabled: boolean;
}