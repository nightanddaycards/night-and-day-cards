// Reads the catalog and stock levels from Square and writes data/products.json
// for the Products page. Only items with stock are included, and exact counts are
// left out: each item is marked "in" (in stock) or "low" (low stock).
//
// Usage: SQUARE_ACCESS_TOKEN=... [SQUARE_LOCATION_ID=...] node scripts/fetch-square.mjs
//
// Runs during every deploy (.github/workflows/deploy.yml), which sets REQUIRE_SQUARE
// so a missing token fails the deploy instead of publishing without products.
// Run locally without a token, it exits quietly.
// SQUARE_LOCATION_ID is optional; without it the first active location is used.
// Requires Node 18+ (built-in fetch). No dependencies.

import { writeFile, mkdir } from "node:fs/promises";

const API = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2025-01-23";
const DEFAULT_LOW_STOCK = 3; // used when a variation has no low-stock alert set in Square
const MAX_DESCRIPTION = 200;
// Names of the Square custom attribute that marks featured items (any capitalization)
const FEATURED_ATTRIBUTES = ["featured product", "featured"];
const MAX_FEATURED = 12;

const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
if (!TOKEN && process.env.REQUIRE_SQUARE === "true") {
  console.error("SQUARE_ACCESS_TOKEN is not available to this job. Check the repository secret.");
  process.exit(1);
}
if (!TOKEN) {
  console.warn("SQUARE_ACCESS_TOKEN not set; skipping products. The Products page will show a notice.");
  process.exit(0);
}

async function square(path, body) {
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Square API error ${res.status} on ${path}:`, JSON.stringify(data.errors || data));
    process.exit(1);
  }
  return data;
}

// 1. Location
let locationId = process.env.SQUARE_LOCATION_ID;
if (!locationId) {
  const { locations = [] } = await square("/locations");
  const active = locations.find((l) => l.status === "ACTIVE");
  if (!active) {
    console.error("No active Square location found.");
    process.exit(1);
  }
  locationId = active.id;
  console.log(`Using location: ${active.name}`);
}

// 2. Catalog: items, images, categories
const items = [];
const images = {};
const categories = {};
let cursor;
do {
  const q = new URLSearchParams({ types: "ITEM,IMAGE,CATEGORY" });
  if (cursor) q.set("cursor", cursor);
  const page = await square(`/catalog/list?${q}`);
  for (const o of page.objects || []) {
    if (o.is_deleted) continue;
    if (o.type === "ITEM") items.push(o);
    else if (o.type === "IMAGE" && o.image_data) images[o.id] = o.image_data.url;
    else if (o.type === "CATEGORY" && o.category_data) categories[o.id] = o.category_data.name;
  }
  cursor = page.cursor;
} while (cursor);

// 3. In-stock counts at this location
const counts = {};
cursor = undefined;
do {
  const page = await square("/inventory/counts/batch-retrieve", {
    location_ids: [locationId],
    states: ["IN_STOCK"],
    limit: 1000,
    ...(cursor ? { cursor } : {})
  });
  for (const c of page.counts || []) {
    counts[c.catalog_object_id] = (counts[c.catalog_object_id] || 0) + Number(c.quantity || 0);
  }
  cursor = page.cursor;
} while (cursor);

// Is a catalog object sold at this location?
function atLocation(o) {
  if (o.present_at_all_locations === false) return (o.present_at_location_ids || []).includes(locationId);
  return !(o.absent_at_location_ids || []).includes(locationId);
}

function money(m) {
  if (!m || typeof m.amount !== "number") return null;
  return m.amount / 100;
}

// Returns "in", "low", or null (not available)
function variationStock(v) {
  const d = v.item_variation_data || {};
  const override = (d.location_overrides || []).find((o) => o.location_id === locationId) || {};
  if (override.sold_out) return null;
  const tracked = override.track_inventory ?? d.track_inventory;
  if (!tracked) return "in"; // Square isn't counting this item; treat it as available
  const qty = counts[v.id] || 0;
  if (qty <= 0) return null;
  const threshold =
    (override.inventory_alert_type === "LOW_QUANTITY" && override.inventory_alert_threshold) ||
    (d.inventory_alert_type === "LOW_QUANTITY" && d.inventory_alert_threshold) ||
    DEFAULT_LOW_STOCK;
  return qty <= threshold ? "low" : "in";
}

// Featured items: a custom attribute named "Featured Product" (or "Featured") on the item (or one of its
// variations). A Yes/No attribute set to Yes features the item; a Number attribute
// features it in that order (1 first; 0 or blank turns it off); a Text attribute
// counts when it says yes/true/y/x/1. Returns a sort rank, or null if not featured.
const attributeNamesSeen = new Set();
function featuredRank(obj) {
  for (const v of Object.values(obj.custom_attribute_values || {})) {
    if (v.name) attributeNamesSeen.add(v.name);
    if (!FEATURED_ATTRIBUTES.includes((v.name || "").trim().toLowerCase().replace(/\s+/g, " "))) continue;
    if (v.boolean_value === true) return Number.MAX_SAFE_INTEGER;
    if (v.number_value !== undefined && Number(v.number_value) > 0) return Number(v.number_value);
    if (/^(yes|true|y|x|1)$/i.test(String(v.string_value || "").trim())) return Number.MAX_SAFE_INTEGER;
    if ((v.selection_uid_values || []).length) return Number.MAX_SAFE_INTEGER;
  }
  return null;
}

const products = [];
const featured = [];
for (const item of items) {
  const d = item.item_data || {};
  if (d.is_archived || !atLocation(item)) continue;
  if (d.product_type && d.product_type !== "REGULAR") continue; // skip services, events, etc.

  const variations = (d.variations || [])
    .filter((v) => !v.is_deleted && atLocation(v) && (v.item_variation_data || {}).sellable !== false)
    .map((v) => ({
      name: (v.item_variation_data || {}).name || "",
      price: money((v.item_variation_data || {}).price_money),
      stock: variationStock(v)
    }))
    .filter((v) => v.stock);
  if (!variations.length) continue;

  const catId = (d.categories && d.categories[0] && d.categories[0].id) || d.category_id ||
    (d.reporting_category && d.reporting_category.id);
  const prices = variations.map((v) => v.price).filter((p) => p !== null);
  const desc = (d.description_plaintext || "").replace(/\s+/g, " ").trim();

  const ranks = [featuredRank(item), ...(d.variations || []).map(featuredRank)].filter((r) => r !== null);

  const product = {
    id: item.id,
    name: d.name || "Untitled item",
    category: categories[catId] || "Other",
    description: desc.length > MAX_DESCRIPTION ? desc.slice(0, MAX_DESCRIPTION - 1) + "…" : desc || undefined,
    image: (d.image_ids || []).map((id) => images[id]).find(Boolean),
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    stock: variations.some((v) => v.stock === "in") ? "in" : "low",
    // Only list options when there's a real choice (e.g. sizes, conditions)
    options: variations.length > 1 ? variations.map((v) => ({ name: v.name, price: v.price, stock: v.stock })) : undefined
  };
  products.push(product);
  if (ranks.length) featured.push({ rank: Math.min(...ranks), product });
}

products.sort((a, b) => a.name.localeCompare(b.name));

await mkdir("data", { recursive: true });
await writeFile(
  "data/products.json",
  JSON.stringify({ updated: new Date().toISOString(), products })
);
console.log(`Saved ${products.length} in-stock products (of ${items.length} catalog items).`);

// Featured: numbered items first (1, 2, 3...), then the rest by name
featured.sort((a, b) => a.rank - b.rank || a.product.name.localeCompare(b.product.name));
await writeFile(
  "data/featured.json",
  JSON.stringify({ updated: new Date().toISOString(), products: featured.slice(0, MAX_FEATURED).map((f) => f.product) })
);
console.log(`Featured: ${featured.length} in-stock item(s)${featured.length > MAX_FEATURED ? `, showing the first ${MAX_FEATURED}` : ""}.`);
if (!featured.length) {
  console.log(
    `No in-stock items have a "Featured Product" custom attribute turned on. Custom attributes seen: ${
      [...attributeNamesSeen].join(", ") || "(none)"
    }`
  );
}
