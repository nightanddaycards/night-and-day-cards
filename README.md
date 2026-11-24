# Night & Day Cards website

Static site: plain HTML, CSS, and JavaScript. No build step.

## Edit content
All shop details (hours, events, address, links) live in `js/shop.js`.
Empty values are hidden on the page.

## Products page (from Square)
`products.html` lists what's in stock, from your Square catalog and inventory. The
deploy workflow (`.github/workflows/deploy.yml`) builds `data/products.json` and
publishes the site every hour and on every push to `main`. The product list is
never committed, so stock updates don't clutter the repo.

What shows up:
- Items with stock at your location, marked "In stock" or "Low stock" (no exact counts).
- "Low stock" uses each item's low-stock alert from Square, or 3 or fewer if none is set.
- Items with inventory tracking turned off in Square count as in stock.
- Archived items, items marked sold out, and services/events are left out.
- Square categories become the Category filter, so name categories the way customers
  should see them (e.g. "Pokémon", "Magic: The Gathering", "Supplies").

One-time setup:
1. At developer.squareup.com, sign in with your Square account and create an app.
2. In the app, open Credentials, switch to **Production**, and copy the access token.
   This token has full access to your Square account, so only paste it into GitHub Secrets.
3. In the GitHub repo, go to Settings > Secrets and variables > Actions and add
   `SQUARE_ACCESS_TOKEN`. If you have more than one Square location, also add
   `SQUARE_LOCATION_ID` (otherwise the first active location is used).
4. Repo Settings > Pages > Build and deployment > Source: choose **GitHub Actions**.
   The custom domain stays as it is.
5. Open the Actions tab, pick "Deploy site", and click "Run workflow".

The Instagram workflow's commits are picked up by the next hourly deploy.

### Featured products (home page)
The home page's "Featured" section shows items that have a custom attribute named
**Featured Product** turned on in Square. It updates with the hourly deploy and shows up to
12 in-stock items. The section is hidden when nothing featured is in stock.

1. In Square Dashboard, create an item custom attribute named `Featured Product` (Items >
   Item library > Settings > Custom attributes; Square may move this). Use the
   Yes/No type, or Number if you want to control the order.
2. Turn it on for the items to feature. With Number: 1 shows first, then 2, and so on.
   Items set to Yes (or with no number) come after the numbered ones, A–Z. Set a
   number to 0 or clear it to stop featuring the item.
3. Wait for the next hourly deploy, or run "Deploy site" from the Actions tab.

If nothing appears, open the latest "Deploy site" run. The "Fetch products from
Square" step lists the custom attribute names it found.

## Instagram feed
A GitHub Action (`.github/workflows/update-instagram.yml`) pulls the 6 latest posts
from Instagram once a day. It saves the photos to `img/instagram/` and the list to
`data/instagram.json`. The "On Instagram" section stays hidden until that file exists.
The Instagram account ID and access token live only in GitHub Secrets.

One-time setup:
1. Make sure the Instagram account is a Business or Creator account, and link it to
   the shop's Facebook Page (Instagram app: Settings > Account type and tools, or
   Facebook Page settings > Linked accounts).
2. At developers.facebook.com, create an app (type "Business"). Add the
   "Instagram Graph API" product (it may be listed as "Instagram API with Facebook Login").
   The app can stay in Development mode, since only your own accounts use it.
   Note the App ID and App Secret (App settings > Basic).
3. Open the Graph API Explorer, pick your app, and generate a User token with these
   permissions: `pages_show_list`, `pages_read_engagement`, `instagram_basic`.
   Sign in with your account that manages the Page.
4. On your own computer (needs Node 18+), run:
       META_APP_ID=... META_APP_SECRET=... SHORT_TOKEN=... node scripts/get-ig-token.mjs
   It prints `IG_USER_ID` and a Page token (`IG_ACCESS_TOKEN`) that doesn't expire.
5. In the GitHub repo, go to Settings > Secrets and variables > Actions and add
   `IG_USER_ID` and `IG_ACCESS_TOKEN`.
6. Open the Actions tab, pick "Update Instagram feed", and click "Run workflow" to test it.

The token stops working if you change your Facebook password, lose your role on the
Page, or remove the app. If that happens, repeat steps 3–5.
The scripts use Graph API v23.0. Meta retires each version about two years after
release. Before that, update `GRAPH` in both scripts to a current version.

## Preview locally
    python3 -m http.server 8000
Then open http://localhost:8000

## Deploy on GitHub Pages
1. Create a GitHub repo and push this folder to the `main` branch.
2. Repo Settings > Pages > Source: "GitHub Actions". The "Deploy site" workflow publishes
   the site on every push to `main` and hourly (see "Products page" above).
3. Set the custom domain (nightanddaycards.com) in Repo Settings > Pages.

## Point the domain at GitHub (at your registrar's DNS settings)
- `www`: a CNAME record pointing to `<your-github-username>.github.io`
- Remove any other A/AAAA/CNAME records for those names (e.g. registrar parking pages).
- Confirm the IPs against GitHub's current "Managing a custom domain for your GitHub Pages site" docs.

## After DNS propagates
Repo Settings > Pages: confirm the domain check passes, then enable "Enforce HTTPS".
