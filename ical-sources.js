// Centralized iCal sources configuration
// Each unit maps to providers (airbnb, booking). Replace with your real .ics URLs.
export const ICAL_SOURCES = {
  'unit-green': {
    airbnb: "https://www.airbnb.com/calendar/ical/18836033.ics?s=d716e5374d61fee09c58b73dbed25609",
    booking: "https://ical.booking.com/v1/export?t=8ab9b50f-fbfd-491e-aa49-842d09a6551f"
  },
  'unit-red': {
    airbnb: "https://www.airbnb.com/calendar/ical/17733314.ics?s=90ad569dc892a4ccfa5bb09fb7c2e30f",
    booking: "https://ical.booking.com/v1/export?t=8ab9b50f-fbfd-491e-aa49-842d09a6551f"
  },
  'unit-grey': {
    airbnb: "https://www.airbnb.com/calendar/ical/955475043333974952.ics?s=406ff7d12c56c12b6558712cc32b9c88",
    booking: "https://example.com/booking/unit-grey.ics"
  }
};
