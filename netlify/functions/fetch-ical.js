// Use the global fetch provided by the Netlify runtime (Node 18+). Do not import node-fetch here
// to avoid pulling in fetch-blob/formdata-polyfill which can cause runtime errors in Netlify.
import { ICAL_SOURCES } from '../../ical-sources.js';

const fetchIcal = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
      "Accept": "text/calendar, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return response.text();
};

// Netlify serverless handler
export async function handler(event) {
  try {
    // Determine path segments. Accept multiple shapes and normalize to [unit, provider]
    // Examples handled:
    //  - /.netlify/functions/fetch-ical/<unit>/<provider>
    //  - /api/ical/<unit>/<provider>
    //  - /<unit>/<provider>
    let path = event.path || '';
    // strip known function prefix
    if (path.startsWith('/.netlify/functions/fetch-ical')) {
      path = path.replace('/.netlify/functions/fetch-ical', '');
    }
    // strip api/ical prefix if present
    if (path.startsWith('/api/ical')) {
      path = path.replace('/api/ical', '');
    }

    const segments = path.split('/').filter(Boolean);
    console.log('fetch-ical called with path=', event.path, 'normalized segments=', segments);

    let url;

    if (segments.length === 0) {
      // Default: unit-green Airbnb
      url = ICAL_SOURCES['unit-green']?.airbnb;
      if (!url) return { statusCode: 404, body: JSON.stringify({ error: 'Default iCal not configured' }) };
    } else if (segments.length >= 2) {
      const unit = segments[0];
      const provider = segments[1];
      const unitCfg = ICAL_SOURCES[unit];
      if (!unitCfg) return { statusCode: 404, body: JSON.stringify({ error: `Unknown unit: ${unit}` }) };
      url = unitCfg[provider];
      if (!url) return { statusCode: 404, body: JSON.stringify({ error: `Unknown provider for unit: ${provider}` }) };
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request format' }) };
    }

    const text = await fetchIcal(url);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/calendar",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    console.error("Error fetching iCal:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch iCal" }),
    };
  }
}
