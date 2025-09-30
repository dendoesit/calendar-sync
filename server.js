import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = 4000;

app.use(cors());

// Configuration: per-unit, per-provider iCal URLs. Keys are unit IDs; each unit lists providers.
// Replace the example URLs with your real .ics export URLs for each unit/provider.
const ICAL_SOURCES = {
  'unit-green': {
    airbnb: "https://www.airbnb.com/calendar/ical/18836033.ics?s=d716e5374d61fee09c58b73dbed25609",
    booking: "https://ical.booking.com/v1/export?t=8ab9b50f-fbfd-491e-aa49-842d09a6551f"
  },
  'unit-red': {
    airbnb: "https://example.com/airbnb/unit-red.ics",
    booking: "https://ical.booking.com/v1/export?t=8ab9b50f-fbfd-491e-aa49-842d09a6551f"
  },
  'unit-grey': {
    airbnb: "https://example.com/airbnb/unit-grey.ics",
    booking: "https://example.com/booking/unit-grey.ics"
  }
};

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
