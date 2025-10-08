import fs from 'fs';
import path from 'path';

const NOTES_PATH = path.join(process.cwd(), 'netlify', 'data', 'notes.json');

const JSONBIN_ID = process.env.JSONBIN_ID;
const JSONBIN_KEY = process.env.JSONBIN_KEY;

const writeToJsonBin = async (content) => {
  const url = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_KEY,
    },
    body: JSON.stringify(content),
  });
  if (!res.ok) {
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (e) {
      bodyText = '<failed to read body>';
    }
    throw new Error(`jsonbin write failed ${res.status} ${bodyText}`);
  }
  return true;
};

export async function handler(event) {
  try {
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (parseErr) {
      console.error('notes-update: invalid JSON body', parseErr, event.body);
      return { statusCode: 400, body: JSON.stringify({ error: 'invalid json body' }) };
    }
    const content = body.content || {};

    // If JSONBIN is configured, try to write there first
    if (JSONBIN_ID && JSONBIN_KEY) {
      try {
        await writeToJsonBin(content);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ ok: true, backend: 'jsonbin' }),
        };
      } catch (err) {
        console.error('notes-update jsonbin failed:', err);
        // Do not attempt to write to the function package filesystem on Netlify
        // (it's read-only). Return a 502 so the client knows JSONBin rejected
        // the write (e.g. invalid key / 401). If you want a local fallback,
        // set LOCAL_FILE_FALLBACK=true in the environment (only for dev).
        if (!process.env.LOCAL_FILE_FALLBACK) {
          const message = err && err.message ? err.message : String(err);
          return {
            statusCode: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'jsonbin write failed', detail: message }),
          };
        }
        console.warn('LOCAL_FILE_FALLBACK enabled; falling back to file write (ephemeral)');
        // else fall through to file write (useful for local dev only)
      }
    }

    // Ensure directory exists
    const dir = path.dirname(NOTES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Write atomically
    const tmp = NOTES_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(content, null, 2), 'utf-8');
    fs.renameSync(tmp, NOTES_PATH);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, backend: 'file' }),
    };
  } catch (err) {
    console.error('notes-update error', err);
    const message = err && err.message ? err.message : String(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'failed to write notes', detail: message }) };
  }
}
