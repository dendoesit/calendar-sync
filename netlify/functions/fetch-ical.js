import fetch from "node-fetch";

// Configuration: per-unit, per-provider iCal URLs
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
    const path = event.path.replace("/.netlify/functions/fetch-ical", "");
    const segments = path.split("/").filter(Boolean);

    let url;

    if (segments.length === 0) {
      // Default: unit-green Airbnb
      url = ICAL_SOURCES["unit-green"]?.airbnb;
      if (!url) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Default iCal not configured" }),
        };
      }
    } else if (segments.length === 2) {
      const [unit, provider] = segments;
      const unitCfg = ICAL_SOURCES[unit];

      if (!unitCfg) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `Unknown unit: ${unit}` }),
        };
      }
      url = unitCfg[provider];
      if (!url) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `Unknown provider for unit: ${provider}` }),
        };
      }
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request format" }),
      };
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
