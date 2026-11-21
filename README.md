# Night & Day Cards website

Static site: plain HTML, CSS, and JavaScript. No build step.

## Edit content
All shop details (hours, events, address, links) live in `js/shop.js`.
Empty values are hidden on the page.

## Hours sync from Google
A GitHub Action (`.github/workflows/update-hours.yml`) pulls the hours from the
Google Business Profile API once a day and saves them to `data/hours.json`. The site
shows those hours, plus any holiday hours in the next 30 days. If the file is
missing, the site falls back to the `hours` in `js/shop.js`.

The location ID and OAuth credentials live only in GitHub Secrets, never in this repo.

One-time setup:
1. In Google Cloud Console, create a project. Request Business Profile API access
   for it (search "Business Profile APIs prerequisites" in Google's docs). Until
   Google approves the request, the API's quota is 0 and calls will fail.
2. After approval, enable "My Business Business Information API" and
   "My Business Account Management API".
3. Set up the OAuth consent screen (External), add yourself as a user, and set its
   publishing status to "In production". In "Testing" mode, refresh tokens expire after 7 days.
4. Create an OAuth client ID of type "Desktop app". Note the client ID and secret.
5. On your own computer, run:
       GBP_CLIENT_ID=... GBP_CLIENT_SECRET=... node scripts/get-gbp-token.mjs
   Sign in with an account that manages the Business Profile. The script prints a
   refresh token and your location IDs.
6. In the GitHub repo, go to Settings > Secrets and variables > Actions and add four secrets:
   `GBP_CLIENT_ID`, `GBP_CLIENT_SECRET`, `GBP_REFRESH_TOKEN`, `GBP_LOCATION_ID`.
7. Open the Actions tab, pick "Update hours from Google", and click "Run workflow" to test it.

Change the hours in Google Business Profile, not here. The site picks them up within a day.

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
