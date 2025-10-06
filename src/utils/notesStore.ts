import { CalendarEvent } from '../types/calendar';
import { eventSignature } from './icalParser';

type NoteEntry = {
  content: string;
  savedAt: number; // epoch ms
  ttlDays: number; // days to keep
};

const STORAGE_KEY = 'reservation-notes-v1';

const loadAll = (): Record<string, NoteEntry> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, NoteEntry>;
  } catch {
    return {};
  }
};

const saveAll = (map: Record<string, NoteEntry>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
};

export const cleanupExpired = () => {
  const map = loadAll();
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(map)) {
    const entry = map[k];
    const expireAt = entry.savedAt + entry.ttlDays * 24 * 60 * 60 * 1000;
    if (now > expireAt) {
      delete map[k];
      changed = true;
    }
  }
  if (changed) saveAll(map);
};

export const getNoteForEvent = (event: CalendarEvent) => {
  const map = loadAll();
  const sig = eventSignature(event);
  const entry = map[sig];
  if (!entry) return null;
  const now = Date.now();
  const expireAt = entry.savedAt + entry.ttlDays * 24 * 60 * 60 * 1000;
  if (now > expireAt) {
    // expired
    delete map[sig];
    saveAll(map);
    return null;
  }
  return entry;
};

export const saveNoteForEvent = (event: CalendarEvent, content: string, ttlDays = 3) => {
  const map = loadAll();
  const sig = eventSignature(event);
  map[sig] = { content, savedAt: Date.now(), ttlDays };
  saveAll(map);
};

export const deleteNoteForEvent = (event: CalendarEvent) => {
  const map = loadAll();
  const sig = eventSignature(event);
  if (map[sig]) {
    delete map[sig];
    saveAll(map);
  }
};

// run a cleanup pass on module load
try {
  cleanupExpired();
} catch {
  // ignore
}

export default {
  getNoteForEvent,
  saveNoteForEvent,
  deleteNoteForEvent,
  cleanupExpired,
};
