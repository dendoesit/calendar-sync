import ICAL from 'ical.js';
import { CalendarEvent } from '../types/calendar';

// const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const parseICalFromUrl = async (source = ''): Promise<CalendarEvent[]> => {
  try {
    // Fetch iCal from our backend (bypasses CORS). If source is provided, hit /api/ical/:source
    const endpoint = source ? `http://localhost:4000/api/ical/${encodeURIComponent(source)}` : `http://localhost:4000/api/ical`;
    const response = await fetch(endpoint);

    if (!response.ok) {
      // Try to get error message if JSON, otherwise fallback
      let errorMsg = `Failed to fetch iCal data: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch {
        // ignore JSON parse errors and keep default error message
      }
      throw new Error(errorMsg);
    }

    // The response is plain text (iCal), not JSON
    const text = await response.text();
    console.log("iCal data:", text);

  // Call the parser to convert text to CalendarEvent[]
    const parsedData = parseICalData(text);
    console.log("Parsed bookings:", parsedData);

    return parsedData;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to import from URL: ${error.message}`);
    }
    throw new Error('Failed to import from URL: Unknown error');
  }
}

export const parseICalFile = async (file: File): Promise<CalendarEvent[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const icalData = event.target?.result as string;
        const events = parseICalData(icalData);
        resolve(events);
      } catch (error) {
        reject(new Error('Failed to parse iCal file: ' + error));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

const parseICalData = (icalData: string): CalendarEvent[] => {
  const jcalData = ICAL.parse(icalData);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents('vevent');
  
  const events: CalendarEvent[] = vevents.map((vevent, index) => {
    const event = new ICAL.Event(vevent);
    const uid = (event.uid && String(event.uid)) || '';
    return {
      // Prefer the UID from the iCal if available to make imports idempotent.
      id: uid || `imported-${event.startDate.toJSDate().toISOString()}-${event.endDate.toJSDate().toISOString()}-${index}`,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      startDate: event.startDate.toJSDate(),
      endDate: event.endDate.toJSDate(),
      color: '#8B5CF6',
      type: 'imported' as const
    };
  });
  
  return events;
};