# Night & Day Cards website

Static site: plain HTML, CSS, and JavaScript. No build step.

## Edit content
All shop details (hours, events, address, links) live in `js/shop.js`.
Empty values are hidden on the page.

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
