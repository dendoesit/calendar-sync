import { CalendarEvent } from '../types/calendar';
// Use event.id as the key (per user request). Simple JSON backed by server; localStorage used for immediate UI.

type NoteEntry = {
  content: string;
  savedAt: number; // epoch ms
  ttlDays: number; // days to keep
};

const STORAGE_KEY = 'reservation-notes-v1';

const localLoadAll = (): Record<string, NoteEntry> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, NoteEntry>;
  } catch {
    return {};
  }
};

const localSaveAll = (map: Record<string, NoteEntry>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
};

const fetchServerNotes = async (): Promise<Record<string, NoteEntry> | null> => {
  try {
    const res = await fetch('/.netlify/functions/notes-get');
    if (!res.ok) return null;
    const json = await res.json();
    return json as Record<string, NoteEntry>;
  } catch {
    return null;
  }
};

const pushServerNotes = async (map: Record<string, NoteEntry>) => {
  try {
    const res = await fetch('/.netlify/functions/notes-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: map, message: 'Update notes' }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const cleanupExpired = () => {
  const map = localLoadAll();
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
  if (changed) localSaveAll(map);
};

// Populate local store from server once on load (best-effort merge)
(async () => {
  try {
    const server = await fetchServerNotes();
    if (server) {
      // merge into local (server wins)
      localSaveAll({ ...(localLoadAll() || {}), ...server });
    }
  } catch (err) {
    console.debug('notesStore server preload failed', err);
  }
})();

// Synchronous getters so UI can render immediately (reads localStorage)
export const getNoteForEvent = (event: CalendarEvent) => {
  const map = localLoadAll();
  const id = event.id || '';
  const entry = map[id];
  if (!entry) return null;
  const now = Date.now();
  const expireAt = entry.savedAt + entry.ttlDays * 24 * 60 * 60 * 1000;
  if (now > expireAt) {
    delete map[id];
    localSaveAll(map);
    return null;
  }
  return entry;
};

// Save locally synchronously, then attempt to push to server asynchronously
export const saveNoteForEvent = (event: CalendarEvent, content: string, ttlDays = 3) => {
  const id = event.id || `manual-${Date.now()}`;
  const entry: NoteEntry = { content, savedAt: Date.now(), ttlDays };
  const map = localLoadAll();
  map[id] = entry;
  localSaveAll(map);

  // push in background
  (async () => {
    try {
      const server = (await fetchServerNotes()) || {};
      server[id] = entry;
      await pushServerNotes(server);
    } catch (err) {
      console.debug('notesStore push failed', err);
    }
  })();
};

export const deleteNoteForEvent = (event: CalendarEvent) => {
  const id = event.id || '';
  const map = localLoadAll();
  if (map[id]) {
    delete map[id];
    localSaveAll(map);
  }

  (async () => {
    try {
      const server = (await fetchServerNotes()) || {};
      if (server[id]) {
        delete server[id];
        await pushServerNotes(server);
      }
    } catch (err) {
      console.debug('notesStore delete push failed', err);
    }
  })();
};

// run a cleanup pass on module load (local only)
try {
  cleanupExpired();
} catch (err) {
  console.debug('notesStore cleanup failed', err);
}

export default {
  getNoteForEvent,
  saveNoteForEvent,
  deleteNoteForEvent,
  cleanupExpired,
};
