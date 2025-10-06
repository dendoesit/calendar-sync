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

// Utility: create a stable signature for an event to help deduplication
export const eventSignature = (e: CalendarEvent) => {
  const rawId = (e.id && String(e.id)) || '';
  // IDs that we generate during import (prefix 'imported-') are not stable across
  // repeated fetches, so treat them as missing UID and fall back to composite signature.
  const uid = rawId && !rawId.startsWith('imported-') ? rawId : '';
  const title = (e.title || '').toString().trim().toLowerCase();
  const start = e.startDate ? new Date(e.startDate).toISOString() : '';
  const end = e.endDate ? new Date(e.endDate).toISOString() : '';
  // Normalize apartment/key so signatures are stable whether the apartment was stored
  // as a display label (e.g. 'Ap. 7 - Green') or as a canonical key (e.g. 'unit-green').
  const rawApt = (e.apartment || '').toString().toLowerCase();
  const normalizeApartmentKey = (a: string) => {
    if (!a) return '';
    if (a.includes('green')) return 'unit-green';
    if (a.includes('red')) return 'unit-red';
    if (a.includes('grey') || a.includes('gray')) return 'unit-grey';
    // If it already looks like a unit key, keep it as-is (e.g., 'unit-green')
    if (a.startsWith('unit-')) return a;
    // Fallback: strip spaces and punctuation to create a stable-ish key
    return a.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };
  const apt = normalizeApartmentKey(rawApt);
  // Prefer UID when available, otherwise fallback to composite signature
  return uid && uid !== '' ? `uid:${uid}` : `sig:${title}|${start}|${end}|${apt}`;
};

// Remove duplicates from incoming array when compared against existing events.
// Returns the incoming events filtered so none have a signature present in existing
export const dedupeIncoming = (existing: CalendarEvent[], incoming: CalendarEvent[]) => {
  const seen = new Set<string>(existing.map(eventSignature));
  const out: CalendarEvent[] = [];
  for (const ev of incoming) {
    const sig = eventSignature(ev);
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(ev);
    }
  }
  return out;
};

// Merge overlapping or contiguous events that share the same normalized title and apartment.
// Useful for "CLOSED - Not available" blocks that appear multiple times or overlap.
export const mergeOverlappingByTitleAndApartment = (events: CalendarEvent[]) => {
  // normalize title and apartment keys similarly to eventSignature
  const normalizeTitle = (t: string | undefined) => (String(t || '').trim().toLowerCase());
  const normalizeApt = (a: string | undefined) => {
    const raw = String(a || '').toLowerCase();
    if (!raw) return '';
    if (raw.includes('green')) return 'unit-green';
    if (raw.includes('red')) return 'unit-red';
    if (raw.includes('grey') || raw.includes('gray')) return 'unit-grey';
    if (raw.startsWith('unit-')) return raw;
    return raw.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  // Group events by (apt, title)
  const groups: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const key = `${normalizeApt(ev.apartment)}|${normalizeTitle(ev.title)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  }

  const merged: CalendarEvent[] = [];
  for (const key of Object.keys(groups)) {
    const list = groups[key].sort((a, b) => +a.startDate - +b.startDate);
    if (list.length === 0) continue;

    // Merge overlapping/contiguous intervals
    let current = { ...list[0] };
    for (let i = 1; i < list.length; i++) {
      const next = list[i];
      // if next starts on or before current.end (overlap or contiguous), merge
      if (next.startDate <= current.endDate) {
        // extend the end if next ends later
        if (next.endDate > current.endDate) current.endDate = next.endDate;
        // pick the earliest start (already true by sorting)
      } else {
        // push current and start a new one
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }

  // Now add back events that didn't belong to any group? groups contained all events.
  // merged currently contains one entry per merged group; but merged may lose events whose
  // title/apt grouping intentionally separates irrelevant events. This function is intended
  // to be applied to the whole events array, and groups covers all of them, so return merged.
  return merged;
};

// Return true if `ev` is fully covered by the union of existing events that match
// the same apartment and provider (if provider available), otherwise fall back to
// matching by normalized title. This helps discard large imported intervals that
// are redundant because smaller/per-day bookings already exist for the same source.
export const isSubsumedByExisting = (ev: CalendarEvent, existing: CalendarEvent[]) => {
  const normalizeTitle = (t: string | undefined) => (String(t || '').trim().toLowerCase());
  const normalizeApt = (a: string | undefined) => {
    const raw = String(a || '').toLowerCase();
    if (!raw) return '';
    if (raw.includes('green')) return 'unit-green';
    if (raw.includes('red')) return 'unit-red';
    if (raw.includes('grey') || raw.includes('gray')) return 'unit-grey';
    if (raw.startsWith('unit-')) return raw;
    return raw.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const aptKey = normalizeApt(ev.apartment);
  const titleKey = normalizeTitle(ev.title);
  // Prefer provider matching when available
  const candidates = existing.filter(ex => {
    const exApt = normalizeApt(ex.apartment);
    if (exApt !== aptKey) return false;
    if (ev.provider && ex.provider) {
      return ex.provider === ev.provider;
    }
    // fallback to matching by normalized title
    return normalizeTitle(ex.title) === titleKey;
  });

  if (candidates.length === 0) return false;

  // Merge candidate intervals
  const intervals = candidates
    .map(c => ({ start: c.startDate.getTime(), end: c.endDate.getTime() }))
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  let cur = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= cur.end) {
      // overlap/contiguous
      cur.end = Math.max(cur.end, next.end);
    } else {
      merged.push(cur);
      cur = next;
    }
  }
  if (cur) merged.push(cur);

  const evStart = ev.startDate.getTime();
  const evEnd = ev.endDate.getTime();

  // Check if any merged interval fully covers ev
  for (const m of merged) {
    if (m.start <= evStart && m.end >= evEnd) return true;
  }

  return false;
};