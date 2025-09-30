import ICAL from 'ical.js';
import { CalendarEvent } from '../types/calendar';

// const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// now accepts unit and provider to hit /api/ical/:unit/:provider
export const parseICalFromUrl = async (unit = '', provider = 'airbnb'): Promise<CalendarEvent[]> => {
  try {
    // Fetch iCal from our backend (bypasses CORS). Use per-unit per-provider endpoint
    const endpoint = unit
    ? `/api/ical/${encodeURIComponent(unit)}/${encodeURIComponent(provider)}`
    : `/api/ical`;

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

  // Call the parser to convert text to CalendarEvent[] and tag with apartment/color (unit as source)
  const parsedData = parseICalData(text, unit);

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

const parseICalData = (icalData: string, source = ''): CalendarEvent[] => {
  const jcalData = ICAL.parse(icalData);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents('vevent');
  
  const events: CalendarEvent[] = vevents.map((vevent, index) => {
    const event = new ICAL.Event(vevent);
    const uid = (event.uid && String(event.uid)) || '';
    // Determine apartment friendly name and default color by source
    const sourceLower = String(source || '').toLowerCase();
    let apartment = source ? source : 'Unit 1';
    let defaultColor = '#10B981'; // default green

    if (sourceLower.includes('red')) {
      apartment = 'Ap. 9 - Red';
      defaultColor = '#EF4444';
    } else if (sourceLower.includes('grey') || sourceLower.includes('gray')) {
      apartment = 'Ap. 6 - Grey';
      defaultColor = '#9CA3AF';
    } else if (sourceLower.includes('green')) {
      apartment = 'Ap. 7 - Green';
      defaultColor = '#10B981';
    }

    return {
      // Prefer the UID from the iCal if available to make imports idempotent.
      id: uid || `imported-${event.startDate.toJSDate().toISOString()}-${event.endDate.toJSDate().toISOString()}-${index}`,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      startDate: event.startDate.toJSDate(),
      endDate: event.endDate.toJSDate(),
      color: defaultColor,
      type: 'imported' as const,
      apartment,
      // provider will be set by caller when parsing per-unit/provider
      provider: source || undefined,
    };
  });
  
  return events;
};