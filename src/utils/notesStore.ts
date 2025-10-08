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

// Server interactions: the client will read from and push to a shared JSON
// exposed via Netlify functions. We still keep localStorage as the immediate
// source for UI, but the server is the authoritative source when available.

const fetchServerNotes = async (): Promise<Record<string, NoteEntry> | null> => {
  try {
    const res = await fetch('/.netlify/functions/notes-get');
    if (!res.ok) return null;
    const json = await res.json();
    // Support two shapes coming from the server:
    // 1) a map/object { <id>: { content, savedAt, ttlDays }, ... }
    // 2) an envelope { notes: [ { id, content, savedAt, ttlDays }, ... ] }
    if (json && Array.isArray(json.notes)) {
      const map: Record<string, NoteEntry> = {};
      for (const item of json.notes) {
        if (!item || !item.id) continue;
        map[item.id] = { content: item.content, savedAt: item.savedAt, ttlDays: item.ttlDays };
      }
      return map;
    }
    return (json as Record<string, NoteEntry>) || null;
  } catch (err) {
    console.debug('notesStore fetchServerNotes failed', err);
    return null;
  }
};

const pushServerNotes = async (map: Record<string, NoteEntry>) => {
  try {
    // Convert internal map to envelope { notes: [ { id, ... }, ... ] }
    const notesArray = Object.keys(map).map((id) => ({ id, ...map[id] }));
    const payload = { content: { notes: notesArray }, message: 'Update notes' };
    const res = await fetch('/.netlify/functions/notes-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.debug('notesStore pushServerNotes failed', err);
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

// On module load, try to load authoritative notes from server (best-effort).
// If server returns a map, replace local store with server contents so UI
// reflects the centrally stored notes. If server is unreachable, keep local.
(async () => {
  try {
    const server = await fetchServerNotes();
    if (server) {
      localSaveAll(server);
      try {
        window.dispatchEvent(new CustomEvent('notes:loaded', { detail: { fromServer: true } }));
      } catch (err) {
        // ignore non-fatal dispatch errors
        console.debug('notesStore dispatch notes:loaded failed', err);
      }
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

  // Dispatch an event so other parts of the app (or external listeners)
  // can react immediately to the note being saved.
  try {
    window.dispatchEvent(new CustomEvent('notes:updated', { detail: { id, entry } }));
  } catch (err) {
    console.debug('notesStore dispatch notes:updated failed', err);
  }

  // push to server in background (best-effort). We don't block the UI.
  (async () => {
    try {
      await pushServerNotes(localLoadAll());
    } catch (err) {
      console.debug('notesStore background push failed', err);
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

  try {
    window.dispatchEvent(new CustomEvent('notes:deleted', { detail: { id } }));
  } catch (err) {
    console.debug('notesStore dispatch notes:deleted failed', err);
  }

  (async () => {
    try {
      await pushServerNotes(localLoadAll());
    } catch (err) {
      console.debug('notesStore background delete push failed', err);
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
