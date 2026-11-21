// ONE-TIME SETUP HELPER. Run this on your own computer, not in GitHub Actions.
//
// Turns a short-lived user token from Meta's Graph API Explorer into a Facebook Page
// access token that doesn't expire, and finds the Instagram account linked to the Page.
// Prints the two values to save as GitHub secrets: IG_USER_ID and IG_ACCESS_TOKEN.
//
// Usage:
//   META_APP_ID=... META_APP_SECRET=... SHORT_TOKEN=... node scripts/get-ig-token.mjs
//
// Nothing is written to disk. Copy the values straight into GitHub Secrets.

const GRAPH = "https://graph.facebook.com/v23.0";
const { META_APP_ID, META_APP_SECRET, SHORT_TOKEN } = process.env;
if (!META_APP_ID || !META_APP_SECRET || !SHORT_TOKEN) {
  console.error("Set META_APP_ID, META_APP_SECRET and SHORT_TOKEN.");
  process.exit(1);
}

async function get(path, params) {
  const r = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`);
  const body = await r.json();
  if (!r.ok) {
    console.error(`Graph API error on ${path}:`, body.error || body);
    process.exit(1);
  }
  return body;
}

// 1. Short-lived user token (~1 hour) -> long-lived user token (~60 days)
const { access_token: longUserToken } = await get("oauth/access_token", {
  grant_type: "fb_exchange_token",
  client_id: META_APP_ID,
  client_secret: META_APP_SECRET,
  fb_exchange_token: SHORT_TOKEN
});

// 2. Page tokens obtained with a long-lived user token don't expire
const { data: pages = [] } = await get("me/accounts", {
  fields: "id,name,access_token,instagram_business_account{id,username}",
  access_token: longUserToken
});

const linked = pages.filter((p) => p.instagram_business_account);
if (!linked.length) {
  console.error("No Facebook Page with a linked Instagram business/creator account was found.");
  console.error("Pages you manage:", pages.map((p) => p.name).join(", ") || "(none)");
  process.exit(1);
}

for (const p of linked) {
  console.log(`\nPage: ${p.name}  ->  Instagram: @${p.instagram_business_account.username}`);
  console.log(`IG_USER_ID:      ${p.instagram_business_account.id}`);
  console.log(`IG_ACCESS_TOKEN: ${p.access_token}`);
}
console.log("\nSave the pair for your shop as GitHub secrets.");
