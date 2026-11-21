// Fetches the latest Instagram posts (Instagram Graph API, via the linked Facebook Page)
// and saves them for the site: photos to img/instagram/, the list to data/instagram.json.
//
// Usage: IG_USER_ID=... IG_ACCESS_TOKEN=... node scripts/fetch-instagram.mjs
//
// IG_USER_ID is the Instagram business account ID; IG_ACCESS_TOKEN is the Facebook
// Page access token. Get both once with scripts/get-ig-token.mjs.
// Photos are downloaded because Instagram's image URLs expire after a few days.
// Requires Node 18+ (built-in fetch). No dependencies.

import { writeFile, mkdir, readdir, unlink, access } from "node:fs/promises";

const GRAPH = "https://graph.facebook.com/v23.0";
const POST_COUNT = 6;
const IMG_DIR = "img/instagram";

const { IG_USER_ID, IG_ACCESS_TOKEN } = process.env;
if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
  console.error("Set IG_USER_ID and IG_ACCESS_TOKEN.");
  process.exit(1);
}

const q = new URLSearchParams({
  fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
  limit: "20",
  access_token: IG_ACCESS_TOKEN
});
const res = await fetch(`${GRAPH}/${encodeURIComponent(IG_USER_ID)}/media?${q}`);
if (!res.ok) {
  console.error(`Instagram API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { data = [] } = await res.json();

// Videos/reels use their thumbnail; photos and carousels use media_url (first image)
const posts = data
  .map((m) => ({ ...m, src: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url }))
  .filter((m) => m.src && /^\d+$/.test(m.id) && /^https:\/\/www\.instagram\.com\//.test(m.permalink || ""))
  .slice(0, POST_COUNT);

if (!posts.length) {
  console.error("No posts returned; leaving the feed unchanged.");
  process.exit(1);
}

await mkdir(IMG_DIR, { recursive: true });
const exists = (p) => access(p).then(() => true, () => false);

const out = [];
for (const p of posts) {
  const file = `${IMG_DIR}/${p.id}.jpg`;
  if (!(await exists(file))) {
    const img = await fetch(p.src);
    if (!img.ok) {
      console.error(`Skipping ${p.id}: image download failed (${img.status})`);
      continue;
    }
    await writeFile(file, Buffer.from(await img.arrayBuffer()));
  }
  const caption = (p.caption || "").replace(/\s+/g, " ").trim();
  out.push({
    id: p.id,
    url: p.permalink,
    image: file,
    alt: caption ? (caption.length > 140 ? caption.slice(0, 137) + "…" : caption) : "Instagram post",
    video: p.media_type === "VIDEO",
    date: p.timestamp
  });
}

// Remove photos for posts that dropped out of the feed
const keep = new Set(out.map((p) => `${p.id}.jpg`));
for (const f of await readdir(IMG_DIR)) {
  if (!keep.has(f)) await unlink(`${IMG_DIR}/${f}`);
}

await mkdir("data", { recursive: true });
await writeFile("data/instagram.json", JSON.stringify({ posts: out }, null, 2) + "\n");
console.log(`Saved ${out.length} posts.`);
