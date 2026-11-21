# Night & Day Cards website

Static site: plain HTML, CSS, and JavaScript. No build step.

## Edit content
All shop details (hours, events, address, links) live in `js/shop.js`.
Empty values are hidden on the page.

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
2. Repo Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The `CNAME` file already sets the custom domain to nightanddaycards.com.

## Point the domain at GitHub (at your registrar's DNS settings)
- `www`: a CNAME record pointing to `<your-github-username>.github.io`
- Remove any other A/AAAA/CNAME records for those names (e.g. registrar parking pages).
- Confirm the IPs against GitHub's current "Managing a custom domain for your GitHub Pages site" docs.

## After DNS propagates
Repo Settings > Pages: confirm the domain check passes, then enable "Enforce HTTPS".
