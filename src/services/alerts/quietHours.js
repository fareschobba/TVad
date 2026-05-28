// src/services/alerts/quietHours.js

// Return "HH:MM" for `date` in the given IANA timezone (24h). Uses Node's ICU (Intl).
function hhmmInTz(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit'
  }).formatToParts(date);
  const hh = parts.find(p => p.type === 'hour').value;
  const mm = parts.find(p => p.type === 'minute').value;
  return `${hh}:${mm}`;
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Is `date` within [start, end) in tz, where the window may wrap past midnight
// (e.g. 23:59 -> 08:00). Start inclusive, end exclusive.
function isQuietHours(date, quiet) {
  if (!quiet || !quiet.start || !quiet.end) return false;
  const now = toMinutes(hhmmInTz(date, quiet.tz));
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === end) return false;          // empty / full-day guard: treat as no quiet
  if (start < end) return now >= start && now < end;      // same-day window
  return now >= start || now < end;          // wraps midnight
}

module.exports = { isQuietHours, hhmmInTz };
