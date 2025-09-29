import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = 4000;

app.use(cors());

// Configuration: add your iCal URLs here. Key is the source name used in the route.
const ICAL_SOURCES = {
  airbnb: "https://www.airbnb.com/calendar/ical/18836033.ics?s=d716e5374d61fee09c58b73dbed25609",
  // Add booking.com or other providers below. Replace with your real booking iCal URL.
  booking: "https://ical.booking.com/v1/export?t=8ab9b50f-fbfd-491e-aa49-842d09a6551f"
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

// Default route keeps backward compatibility and returns the 'airbnb' source.
app.get("/api/ical", async (req, res) => {
  try {
    const text = await fetchIcal(ICAL_SOURCES.airbnb);
    res.setHeader("Content-Type", "text/calendar");
    res.send(text);
  } catch (err) {
    console.error("Error fetching iCal:", err);
    res.status(500).json({ error: "Failed to fetch iCal" });
  }
});

// Named source route: /api/ical/:source  e.g. /api/ical/booking
app.get('/api/ical/:source', async (req, res) => {
  const { source } = req.params;
  const url = ICAL_SOURCES[source];

  if (!url) {
    return res.status(404).json({ error: `Unknown iCal source: ${source}` });
  }

  try {
    const text = await fetchIcal(url);
    res.setHeader("Content-Type", "text/calendar");
    res.send(text);
  } catch (err) {
    console.error(`Error fetching iCal (${source}):`, err);
    res.status(500).json({ error: `Failed to fetch iCal for ${source}` });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
