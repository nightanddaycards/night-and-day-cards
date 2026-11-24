// Night & Day Cards checkout server (Cloudflare Worker).
//
// The website's cart POSTs { items: [{ id, qty }], contact: { name, phone, email } }.
// This worker checks each item against Square (exists, sold at our location,
// fixed price, enough stock right now), then creates a Square-hosted checkout
// page for an in-store pickup order and returns its URL. Prices, tax and the
// order itself all come from Square, never from the browser.
//
// Settings (Cloudflare dashboard > the worker > Settings > Variables and Secrets):
//   SQUARE_ACCESS_TOKEN  (secret)  Square production access token
//   SQUARE_LOCATION_ID   (text)    Square location ID
//   SITE_URL             (text)    https://www.nightanddaycards.com
//   ORDERING_ENABLED     (text)    optional; set to "false" to refuse all checkouts
//                                  immediately (instant off switch), "true" or unset = on
//
// Paste this whole file into the worker's code editor. No build step needed.

const SQUARE_API = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2025-01-23";
const MAX_LINES = 25;
const MAX_QTY = 10;

export default {
  async fetch(request, env) {
    const site = (env.SITE_URL || "https://www.nightanddaycards.com").replace(/\/+$/, "");
    const origin = request.headers.get("Origin") || "";
    // Allow the live site, plus local previews while testing
    const allowed = origin === site || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : site,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin"
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    // Opening the worker URL in a browser shows a setup check (no secrets revealed)
    if (request.method === "GET") {
      const configured = !!(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID);
      const paused = String(env.ORDERING_ENABLED || "").trim().toLowerCase() === "false";
      return reply(200, {
        status: configured ? (paused ? "paused" : "ready") : "not configured",
        message: !configured
          ? "Add SQUARE_ACCESS_TOKEN (secret) and SQUARE_LOCATION_ID in Settings > Variables and Secrets."
          : paused
            ? "Running, but ORDERING_ENABLED is false, so checkouts are refused."
            : "Running. The website's cart sends orders here.",
        squareToken: env.SQUARE_ACCESS_TOKEN ? "set" : "missing",
        locationId: env.SQUARE_LOCATION_ID ? "set" : "missing",
        siteUrl: site
      });
    }
    if (request.method !== "POST") return reply(405, { error: "method", message: "Use POST." });
    if (!allowed) return reply(403, { error: "origin", message: "Not allowed." });
    if (String(env.ORDERING_ENABLED || "").trim().toLowerCase() === "false") {
      return reply(503, { error: "paused", message: "Online ordering is paused right now." });
    }
    if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
      return reply(500, { error: "config", message: "Checkout isn't set up yet." });
    }

    // ---- Parse and validate the request ----
    let body;
    try {
      const text = await request.text();
      if (text.length > 20000) throw new Error("too large");
      body = JSON.parse(text);
    } catch {
      return reply(400, { error: "bad_request", message: "Invalid request." });
    }

    const lines = new Map(); // variation id -> qty (duplicates merged)
    for (const it of Array.isArray(body.items) ? body.items : []) {
      const id = String((it && it.id) || "");
      const qty = Number(it && it.qty);
      if (!/^[A-Z0-9]{8,64}$/.test(id) || !Number.isInteger(qty) || qty < 1) {
        return reply(400, { error: "bad_request", message: "Invalid cart item." });
      }
      lines.set(id, Math.min(MAX_QTY, (lines.get(id) || 0) + qty));
    }
    if (!lines.size) return reply(400, { error: "empty", message: "Your cart is empty." });
    if (lines.size > MAX_LINES) {
      return reply(400, { error: "too_many", message: `Please order at most ${MAX_LINES} different items at a time.` });
    }

    const contact = body.contact || {};
    const name = String(contact.name || "").trim().replace(/\s+/g, " ");
    const email = String(contact.email || "").trim();
    const phone = usPhone(contact.phone);
    if (name.length < 2 || name.length > 80) {
      return reply(400, { error: "contact", field: "name", message: "Please enter the name for pickup." });
    }
    if (!phone) {
      return reply(400, { error: "contact", field: "phone", message: "Please enter a 10-digit US phone number." });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply(400, { error: "contact", field: "email", message: "Please check your email address." });
    }

    const square = async (path, payload) => {
      const res = await fetch(SQUARE_API + path, {
        method: payload ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          "Square-Version": SQUARE_VERSION,
          "Content-Type": "application/json"
        },
        body: payload ? JSON.stringify(payload) : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.log("Square error", path, res.status, JSON.stringify(data.errors || data));
        // Short, non-secret summary (e.g. "INVALID_VALUE order.fulfillments[0]") so problems
        // can be diagnosed from the cart page without opening the Cloudflare logs
        const first = (data.errors || [])[0] || {};
        const err = new Error("square");
        err.code = [path.split("/")[1], res.status, first.code, first.field].filter(Boolean).join(" ");
        throw err;
      }
      return data;
    };

    try {
      const loc = env.SQUARE_LOCATION_ID;
      const ids = [...lines.keys()];

      // ---- Look up the variations and their parent items ----
      const catalog = await square("/catalog/batch-retrieve", { object_ids: ids, include_related_objects: true });
      const byId = new Map((catalog.objects || []).map((o) => [o.id, o]));
      const related = new Map((catalog.related_objects || []).map((o) => [o.id, o]));
      const atLocation = (o) =>
        o.present_at_all_locations === false
          ? (o.present_at_location_ids || []).includes(loc)
          : !(o.absent_at_location_ids || []).includes(loc);

      const problems = [];
      const tracked = [];
      const info = new Map(); // id -> { label, tracked }
      for (const id of ids) {
        const v = byId.get(id);
        const vd = (v && v.item_variation_data) || {};
        const item = related.get(vd.item_id) || byId.get(vd.item_id);
        const d = (item && item.item_data) || {};
        const label = [d.name, (d.variations || []).length > 1 ? vd.name : ""].filter(Boolean).join(" – ") || "An item";
        const override = (vd.location_overrides || []).find((x) => x.location_id === loc) || {};
        const ok =
          v && v.type === "ITEM_VARIATION" && !v.is_deleted && item && !item.is_deleted &&
          atLocation(v) && atLocation(item) && !d.is_archived &&
          (!d.product_type || d.product_type === "REGULAR") &&
          vd.sellable !== false && vd.pricing_type !== "VARIABLE_PRICING" && vd.price_money &&
          !override.sold_out;
        if (!ok) {
          problems.push({ id, name: label, available: 0 });
          continue;
        }
        const isTracked = override.track_inventory ?? vd.track_inventory;
        info.set(id, { label, tracked: !!isTracked });
        if (isTracked) tracked.push(id);
      }

      // ---- Check live stock for tracked items ----
      if (tracked.length) {
        const counts = {};
        let cursor;
        do {
          const page = await square("/inventory/counts/batch-retrieve", {
            catalog_object_ids: tracked,
            location_ids: [loc],
            states: ["IN_STOCK"],
            ...(cursor ? { cursor } : {})
          });
          for (const c of page.counts || []) {
            counts[c.catalog_object_id] = (counts[c.catalog_object_id] || 0) + Number(c.quantity || 0);
          }
          cursor = page.cursor;
        } while (cursor);
        for (const id of tracked) {
          const available = Math.max(0, Math.floor(counts[id] || 0));
          if (available < lines.get(id)) problems.push({ id, name: info.get(id).label, available });
        }
      }

      if (problems.length) {
        return reply(409, {
          error: "stock",
          message: "Some items in your cart aren't available in that quantity anymore.",
          items: problems
        });
      }

      // ---- Create the Square checkout ----
      const link = await square("/online-checkout/payment-links", {
        idempotency_key: crypto.randomUUID(),
        description: "Website pickup order",
        order: {
          location_id: loc,
          line_items: ids.map((id) => ({ catalog_object_id: id, quantity: String(lines.get(id)) })),
          // Applies the shop's sales tax rules (WV tax is a rule, not set per item)
          pricing_options: { auto_apply_taxes: true, auto_apply_discounts: true },
          fulfillments: [
            {
              type: "PICKUP",
              state: "PROPOSED",
              pickup_details: {
                schedule_type: "ASAP",
                recipient: { display_name: name, phone_number: phone, ...(email ? { email_address: email } : {}) },
                note: "Online order from the website"
              }
            }
          ]
        },
        checkout_options: {
          allow_tipping: false,
          ask_for_shipping_address: false,
          redirect_url: `${site}/order-complete.html`
        },
        pre_populated_data: { buyer_phone_number: phone, ...(email ? { buyer_email: email } : {}) }
      });

      const url = link.payment_link && (link.payment_link.url || link.payment_link.long_url);
      if (!url) throw new Error("no url");
      return reply(200, { url });
    } catch (e) {
      console.log("Checkout failed:", e && e.message, e && e.code);
      return reply(502, {
        error: "unavailable",
        message: "Checkout isn't working right now. Please try again in a few minutes, or call the shop.",
        code: (e && e.code) || (e && e.message) || "unknown"
      });
    }
  }
};

// Accepts 10-digit US numbers in any format (optionally with a leading 1);
// returns E.164 ("+13045551234") or null.
function usPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? "+1" + ten : null;
}
