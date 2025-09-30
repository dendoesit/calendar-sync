import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = 4000;

app.use(cors());

import { ICAL_SOURCES } from './ical-sources.js';

const fetchIcal = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
      "Accept": "text/calendar, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return response.text();
};

// Default route: return unit-green airbnb for backward compatibility
app.get('/api/ical', async (req, res) => {
  try {
    const url = ICAL_SOURCES['unit-green']?.airbnb;
    if (!url) return res.status(404).json({ error: 'Default iCal not configured' });
    const text = await fetchIcal(url);
    res.setHeader('Content-Type', 'text/calendar');
    res.send(text);
  } catch (err) {
    console.error('Error fetching default iCal:', err);
    res.status(500).json({ error: 'Failed to fetch default iCal' });
  }
});

// Per-unit per-provider route: /api/ical/:unit/:provider  e.g. /api/ical/unit-green/airbnb
app.get('/api/ical/:unit/:provider', async (req, res) => {
  const { unit, provider } = req.params;
  const unitCfg = ICAL_SOURCES[unit];

  if (!unitCfg) return res.status(404).json({ error: `Unknown unit: ${unit}` });
  const url = unitCfg[provider];
  if (!url) return res.status(404).json({ error: `Unknown provider for unit: ${provider}` });

  try {
    console.log(`Proxying request for ${unit}/${provider} -> ${url}`);
    const text = await fetchIcal(url);
    res.setHeader('Content-Type', 'text/calendar');
    res.send(text);
  } catch (err) {
    console.error(`Error fetching iCal (${unit}/${provider}):`, err);
    res.status(500).json({ error: `Failed to fetch iCal for ${unit}/${provider}` });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
