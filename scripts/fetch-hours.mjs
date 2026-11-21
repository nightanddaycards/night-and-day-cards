// Fetches the shop's hours from its Google Business Profile (Business Information API v1)
// and writes them to data/hours.json for the site to read.
//
// Usage:
//   GBP_CLIENT_ID=... GBP_CLIENT_SECRET=... GBP_REFRESH_TOKEN=... GBP_LOCATION_ID=... \
//     node scripts/fetch-hours.mjs
//
// GBP_LOCATION_ID is the numeric location ID (or "locations/<id>").
// Get the refresh token and location ID once with scripts/get-gbp-token.mjs.
// Requires Node 18+ (built-in fetch). No dependencies.

import { writeFile, mkdir } from "node:fs/promises";

const { GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN, GBP_LOCATION_ID } = process.env;
if (!GBP_CLIENT_ID || !GBP_CLIENT_SECRET || !GBP_REFRESH_TOKEN || !GBP_LOCATION_ID) {
  console.error("Set GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN and GBP_LOCATION_ID.");
  process.exit(1);
}

const SPECIAL_DAYS_AHEAD = 30; // how far ahead to show holiday hours

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// 1. Trade the long-lived refresh token for a short-lived access token
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GBP_CLIENT_ID,
    client_secret: GBP_CLIENT_SECRET,
    refresh_token: GBP_REFRESH_TOKEN,
    grant_type: "refresh_token"
  })
});
if (!tokenRes.ok) fail(`OAuth token error ${tokenRes.status}: ${await tokenRes.text()}`);
const { access_token } = await tokenRes.json();

// 2. Read the location's hours
const locationName = GBP_LOCATION_ID.startsWith("locations/") ? GBP_LOCATION_ID : `locations/${GBP_LOCATION_ID}`;
const res = await fetch(
  `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=regularHours,specialHours`,
  { headers: { Authorization: `Bearer ${access_token}` } }
);
if (!res.ok) fail(`Business Profile API error ${res.status}: ${await res.text()}`);
const loc = await res.json();
if (!loc.regularHours || !loc.regularHours.periods || !loc.regularHours.periods.length) {
  fail("Profile has no regular hours; leaving data/hours.json unchanged.");
}

const DISPLAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const label = (d) => d[0] + d.slice(1).toLowerCase();

// TimeOfDay omits fields that are 0; close of 24:00 means midnight
const mins = (t = {}) => (t.hours || 0) * 60 + (t.minutes || 0);

// "11 am", "11:30 am", "12 pm"
function fmtTime(t = {}, withMeridiem = true) {
  const hr = (t.hours || 0) % 24;
  const h = hr % 12 === 0 ? 12 : hr % 12;
  const m = t.minutes ? ":" + String(t.minutes).padStart(2, "0") : "";
  return withMeridiem ? `${h}${m} ${hr < 12 ? "am" : "pm"}` : `${h}${m}`;
}

// "11 am – 7 pm", or "12 – 6 pm" when both ends share am/pm
function fmtRange(open = {}, close = {}) {
  if (mins(open) === 0 && mins(close) >= 24 * 60) return "Open 24 hours";
  const oh = open.hours || 0;
  const ch = close.hours || 0;
  const sameHalf = (oh < 12) === (ch < 12) && ch % 24 !== 0 && mins(close) > mins(open);
  return `${fmtTime(open, !sameHalf)} – ${fmtTime(close)}`;
}

// Regular weekly hours
const byDay = {};
for (const p of loc.regularHours.periods) (byDay[p.openDay] ||= []).push(p);
const hours = DISPLAY_ORDER.map((d) => {
  const ps = (byDay[d] || []).sort((a, b) => mins(a.openTime) - mins(b.openTime));
  return [label(d), ps.length ? ps.map((p) => fmtRange(p.openTime, p.closeTime)).join(", ") : "Closed"];
});

// Holiday / special hours from today through the next SPECIAL_DAYS_AHEAD days
const iso = ({ year, month, day }) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const today = new Date().toISOString().slice(0, 10);
const horizon = new Date(Date.now() + SPECIAL_DAYS_AHEAD * 864e5).toISOString().slice(0, 10);
const specialByDate = {};
for (const sp of (loc.specialHours && loc.specialHours.specialHourPeriods) || []) {
  if (!sp.startDate) continue;
  const date = iso(sp.startDate);
  if (date < today || date > horizon) continue;
  const entry = (specialByDate[date] ||= { closed: false, ranges: [] });
  if (sp.closed) entry.closed = true;
  else entry.ranges.push(sp);
}
const special = Object.keys(specialByDate)
  .sort()
  .map((date) => {
    const { closed, ranges } = specialByDate[date];
    ranges.sort((a, b) => mins(a.openTime) - mins(b.openTime));
    return {
      date,
      hours: closed || !ranges.length ? "Closed" : ranges.map((r) => fmtRange(r.openTime, r.closeTime)).join(", ")
    };
  });

const out = { source: "Google Business Profile", updated: new Date().toISOString(), hours, special };
await mkdir("data", { recursive: true });
await writeFile("data/hours.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
