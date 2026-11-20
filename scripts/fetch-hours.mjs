// Fetches the shop's hours from its Google Business listing (Places API, New)
// and writes them to data/hours.json for the site to read.
//
// Usage: GOOGLE_PLACES_API_KEY=... GOOGLE_PLACE_ID=... node scripts/fetch-hours.mjs
// Requires Node 18+ (built-in fetch). No dependencies.

import { writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACE_ID = process.env.GOOGLE_PLACE_ID;
if (!KEY || !PLACE_ID) {
  console.error("Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID.");
  process.exit(1);
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, matching shop.js

const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(PLACE_ID)}`, {
  headers: {
    "X-Goog-Api-Key": KEY,
    "X-Goog-FieldMask": "regularOpeningHours,currentOpeningHours"
  }
});
if (!res.ok) {
  console.error(`Places API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const place = await res.json();
if (!place.regularOpeningHours || !place.regularOpeningHours.periods) {
  console.error("Listing has no regular opening hours; leaving data/hours.json unchanged.");
  process.exit(1);
}

// "11 am", "11:30 am", "12 pm"
function fmtTime(t, withMeridiem = true) {
  const h = t.hour % 12 === 0 ? 12 : t.hour % 12;
  const m = t.minute ? ":" + String(t.minute).padStart(2, "0") : "";
  return withMeridiem ? `${h}${m} ${t.hour < 12 ? "am" : "pm"}` : `${h}${m}`;
}

// "11 am – 7 pm", or "12 – 6 pm" when both ends share am/pm
function fmtRange(p) {
  if (!p.close) return "Open 24 hours";
  const sameHalf = (p.open.hour < 12) === (p.close.hour < 12) && p.close.hour !== 0;
  return `${fmtTime(p.open, !sameHalf)} – ${fmtTime(p.close)}`;
}

function byDay(periods) {
  const days = {};
  for (const p of periods) {
    (days[p.open.day] ||= []).push(p);
  }
  for (const d in days) {
    days[d].sort((a, b) => a.open.hour * 60 + a.open.minute - (b.open.hour * 60 + b.open.minute));
  }
  return days;
}

const periods = place.regularOpeningHours.periods;
// Google represents "open 24/7" as a single period with no close time
const alwaysOpen = periods.length === 1 && !periods[0].close;
const regular = byDay(periods);
const hours = DISPLAY_ORDER.map((d) => [
  DAY_NAMES[d],
  alwaysOpen ? "Open 24 hours" : regular[d] ? regular[d].map(fmtRange).join(", ") : "Closed"
]);

// Holiday / special hours in the coming week (Google only reports ~7 days ahead)
const special = [];
const cur = place.currentOpeningHours;
if (cur && cur.specialDays) {
  for (const sd of cur.specialDays) {
    const { year, month, day } = sd.date;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const periods = (cur.periods || []).filter(
      (p) => p.open.date && p.open.date.year === year && p.open.date.month === month && p.open.date.day === day
    );
    special.push({ date: iso, hours: periods.length ? periods.map(fmtRange).join(", ") : "Closed" });
  }
}

const out = { source: "Google Business Profile", updated: new Date().toISOString(), hours, special };
await mkdir("data", { recursive: true });
await writeFile("data/hours.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
