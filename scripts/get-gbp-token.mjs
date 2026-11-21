// ONE-TIME SETUP HELPER. Run this on your own computer, not in GitHub Actions.
//
// It signs you in to Google (as an account that manages the Business Profile),
// then prints:
//   - a refresh token, which goes in the GBP_REFRESH_TOKEN secret
//   - your business locations and their IDs (one goes in GBP_LOCATION_ID)
//
// Usage:
//   GBP_CLIENT_ID=... GBP_CLIENT_SECRET=... node scripts/get-gbp-token.mjs
//
// The OAuth client must be a "Desktop app" client. Nothing is written to disk.
// Copy the values straight into GitHub Secrets and don't paste them anywhere else.

import http from "node:http";
import { randomBytes } from "node:crypto";

const { GBP_CLIENT_ID, GBP_CLIENT_SECRET } = process.env;
if (!GBP_CLIENT_ID || !GBP_CLIENT_SECRET) {
  console.error("Set GBP_CLIENT_ID and GBP_CLIENT_SECRET.");
  process.exit(1);
}

const SCOPE = "https://www.googleapis.com/auth/business.manage";
const state = randomBytes(16).toString("hex");

const server = http.createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const redirectUri = `http://127.0.0.1:${server.address().port}`;

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: GBP_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state
  });

console.log("\nOpen this URL in your browser and sign in with the account that manages the profile:\n");
console.log(authUrl + "\n");

const code = await new Promise((resolve, reject) => {
  server.on("request", (req, res) => {
    const url = new URL(req.url, redirectUri);
    if (!url.searchParams.has("code") && !url.searchParams.has("error")) {
      res.writeHead(404).end();
      return;
    }
    if (url.searchParams.get("state") !== state) {
      res.end("State mismatch. Close this tab and try again.");
      return reject(new Error("OAuth state mismatch"));
    }
    if (url.searchParams.get("error")) {
      res.end("Sign-in was cancelled. You can close this tab.");
      return reject(new Error(url.searchParams.get("error")));
    }
    res.end("Signed in. You can close this tab and go back to the terminal.");
    resolve(url.searchParams.get("code"));
  });
});
server.close();

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: GBP_CLIENT_ID,
    client_secret: GBP_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  })
});
const tokens = await tokenRes.json();
if (!tokenRes.ok || !tokens.refresh_token) {
  console.error("Token exchange failed:", tokens);
  process.exit(1);
}

console.log("GBP_REFRESH_TOKEN (save as a GitHub secret):\n");
console.log(tokens.refresh_token + "\n");

// List the accounts and locations so you can find the location ID
const auth = { headers: { Authorization: `Bearer ${tokens.access_token}` } };
const accRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", auth);
if (!accRes.ok) {
  console.error(`Couldn't list accounts (${accRes.status}): ${await accRes.text()}`);
  console.error("If this is a quota or permission error, your project may not have Business Profile API access yet.");
  process.exit(1);
}
const { accounts = [] } = await accRes.json();
console.log("Locations (put the numeric ID in GBP_LOCATION_ID):\n");
for (const acc of accounts) {
  let pageToken = "";
  do {
    const q = new URLSearchParams({ readMask: "name,title,storefrontAddress", pageSize: "100" });
    if (pageToken) q.set("pageToken", pageToken);
    const r = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?${q}`, auth);
    if (!r.ok) {
      console.error(`  ${acc.accountName || acc.name}: error ${r.status}: ${await r.text()}`);
      break;
    }
    const data = await r.json();
    for (const l of data.locations || []) {
      const addr = (l.storefrontAddress && l.storefrontAddress.addressLines || []).join(", ");
      console.log(`  ${l.name.replace("locations/", "")}  ${l.title}${addr ? "  (" + addr + ")" : ""}`);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
}
