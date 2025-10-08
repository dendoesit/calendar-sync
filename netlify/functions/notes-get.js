import fs from 'fs';
import path from 'path';

const NOTES_PATH = path.join(process.cwd(), 'netlify', 'data', 'notes.json');

const JSONBIN_ID = process.env.JSONBIN_ID;
const JSONBIN_KEY = process.env.JSONBIN_KEY;

const fetchFromJsonBin = async () => {
  const url = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`;
  const res = await fetch(url, { headers: { 'X-Master-Key': JSONBIN_KEY } });
  if (!res.ok) throw new Error(`jsonbin fetch failed ${res.status}`);
  const data = await res.json();
  // JSONBin returns { record: <your-json> }
  return data && data.record ? data.record : data;
};

export async function handler() {
  try {
    // If JSONBIN env is configured, prefer it (external JSON storage)
    if (JSONBIN_ID && JSONBIN_KEY) {
      try {
        const record = await fetchFromJsonBin();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(record || {}),
        };
      } catch (err) {
        console.error('notes-get jsonbin failed, falling back to file:', err);
        // fall through to file fallback
      }
    }

    if (!fs.existsSync(NOTES_PATH)) {
      return { statusCode: 200, body: JSON.stringify({}) };
    }
    const raw = fs.readFileSync(NOTES_PATH, 'utf-8');
    const json = JSON.parse(raw || '{}');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(json),
    };
  } catch (err) {
    console.error('notes-get error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'failed to read notes' }) };
  }
}
