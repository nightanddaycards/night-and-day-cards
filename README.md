# Night & Day Cards website

Static site: plain HTML, CSS, and JavaScript. No build step.

## Edit content
All shop details (hours, events, address, links) live in `js/shop.js`.
Empty values are hidden on the page.

## Hours sync from Google
A GitHub Action (`.github/workflows/update-hours.yml`) pulls the hours from the
Google Business Profile once a day and saves them to `data/hours.json`. The site
shows those hours, plus any holiday hours in the coming week. If the file is
missing, the site falls back to the `hours` in `js/shop.js`.

One-time setup:
1. In Google Cloud Console, create a project, turn on billing, and enable "Places API (New)".
2. Create an API key, restricted to "Places API (New)".
3. Find the shop's Place ID with Google's Place ID Finder
   (developers.google.com/maps/documentation/places/web-service/place-id).
4. In the GitHub repo, go to Settings > Secrets and variables > Actions and add two secrets:
   `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACE_ID`.
5. Open the Actions tab, pick "Update hours from Google", and click "Run workflow" to test it.

Change the hours in Google Business Profile, not here. The site picks them up within a day.

## Preview locally
    python3 -m http.server 8000
Then open http://localhost:8000

## Deploy on GitHub Pages
1. Create a GitHub repo and push this folder to the `main` branch.
2. Repo Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The `CNAME` file already sets the custom domain to nightanddaycards.com.

## Point the domain at GitHub (at your registrar's DNS settings)
- Apex domain (`nightanddaycards.com`): four A records to
  185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- `www`: a CNAME record pointing to `<your-github-username>.github.io`
- Remove any other A/AAAA/CNAME records for those names (e.g. registrar parking pages).
- Confirm the IPs against GitHub's current "Managing a custom domain for your GitHub Pages site" docs.

## After DNS propagates
Repo Settings > Pages: confirm the domain check passes, then enable "Enforce HTTPS".
