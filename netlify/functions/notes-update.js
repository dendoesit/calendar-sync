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
  if (!res.ok) throw new Error(`jsonbin write failed ${res.status}`);
  return true;
};

export async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
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
        console.error('notes-update jsonbin failed, falling back to file:', err);
        // fall through to file fallback
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
    return { statusCode: 500, body: JSON.stringify({ error: 'failed to write notes' }) };
  }
}
