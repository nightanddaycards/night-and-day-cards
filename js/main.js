(function () {
  var s = window.SHOP || {};
  var DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function setLink(id, href, text) {
    var a = $(id);
    if (!a) return;
    if (!href) { a.hidden = true; return; }
    a.href = href;
    if (text) (a.querySelector(".label") || a).textContent = text;
    a.hidden = false;
  }

  document.querySelectorAll("[data-bind]").forEach(function (n) {
    var v = s[n.getAttribute("data-bind")];
    if (v) { n.textContent = v; } else { n.hidden = true; }
  });

  var games = s.games || [];
  if (games.length) {
    var gl = $("games-list");
    // Each game links to the Products page filtered to that game
    games.forEach(function (g) {
      var li = el("li");
      var a = el("a", g);
      a.href = "/products?game=" + encodeURIComponent(g);
      li.appendChild(a);
      gl.appendChild(li);
    });
    $("games").hidden = false;
  }

  // Featured products: data/featured.json is built from Square on every deploy
  // (items with the "Featured" custom attribute turned on, see scripts/fetch-square.mjs).
  // The section stays hidden if nothing is featured or in stock.
  var fgrid = $("featured-grid");
  if (fgrid && window.fetch && window.ProductCard) {
    fetch("data/featured.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = (data && data.products) || [];
        list.forEach(function (p) { fgrid.appendChild(ProductCard.render(p, "h3")); });
        if (list.length) $("featured").hidden = false;
      })
      .catch(function () { /* leave the section hidden */ });
  }

  var now = new Date();
  var today = DAYS[now.getDay()];
  var hours = $("hours-list");

  function addRow(label, value, isToday) {
    var wrap = el("div", "", isToday ? "row today" : "row");
    var dt = el("dt", label);
    if (isToday) dt.appendChild(el("span", "Today", "badge"));
    wrap.appendChild(dt);
    wrap.appendChild(el("dd", value));
    hours.appendChild(wrap);
  }

  (s.hours || []).forEach(function (row) {
    addRow(row[0], row[1], String(row[0]).toLowerCase() === today);
  });

  var events = $("events-list");
  var list = s.events || [];
  list.forEach(function (ev) {
    var li = el("li");
    li.appendChild(el("strong", ev.name));
    li.appendChild(el("span", ev.when, "when"));
    if (ev.note) li.appendChild(el("span", ev.note, "note"));
    events.appendChild(li);
  });
  if (!list.length && !s.facebookUrl) events.appendChild(el("li", "Event schedule coming soon."));
  if (!list.length) events.hidden = true;

  // Facebook events: Facebook's Page Plugin (events tab), sized to fit the card.
  // The plugin only renders at widths between 180 and 500 px.
  // 340 px tall shows ~3 events; the plugin scrolls internally for more.
  var FB_HEIGHT = 340;
  var fb = $("fb-events");
  if (s.facebookUrl && fb) {
    fb.hidden = false;
    var w = Math.max(180, Math.min(500, Math.floor(fb.clientWidth)));
    var frame = document.createElement("iframe");
    frame.src = "https://www.facebook.com/plugins/page.php?" + new URLSearchParams({
      href: s.facebookUrl,
      tabs: "events",
      width: w,
      height: FB_HEIGHT,
      small_header: "true",
      hide_cover: "true",
      show_facepile: "false",
      adapt_container_width: "true"
    });
    frame.width = w;
    frame.height = FB_HEIGHT;
    frame.title = "Upcoming events on Facebook";
    frame.loading = "lazy";
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("frameborder", "0");
    fb.appendChild(frame);
  }

  var addr = $("address");
  (s.address || []).forEach(function (line) { addr.appendChild(el("div", line)); });

  setLink("map-link", s.mapUrl);
  setLink("cta-shop", s.shopUrl);
  setLink("cta-discord", s.discordUrl);
  setLink("discord-link", s.discordUrl);
  setLink("facebook-link", s.facebookUrl);
  setLink("fb-events-link", s.facebookUrl);
  setLink("instagram-link", s.instagramUrl);
  setLink("insta-head-link", s.instagramUrl);

  // Instagram feed: data/instagram.json is written daily by
  // .github/workflows/update-instagram.yml. The section stays hidden without it.
  var grid = $("insta-grid");
  if (grid && window.fetch) {
    fetch("data/instagram.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var posts = (data && data.posts) || [];
        posts.forEach(function (p) {
          if (!/^https:\/\/www\.instagram\.com\//.test(p.url)) return;
          var li = el("li", "", p.video ? "is-video" : "");
          var a = document.createElement("a");
          a.href = p.url;
          a.target = "_blank";
          a.rel = "noopener";
          var img = document.createElement("img");
          img.src = p.image;
          img.alt = p.alt || "Instagram post";
          img.loading = "lazy";
          img.width = 320;
          img.height = 320;
          a.appendChild(img);
          li.appendChild(a);
          grid.appendChild(li);
        });
        if (grid.children.length) $("instagram").hidden = false;
      })
      .catch(function () { /* leave the section hidden */ });
  }
  setLink("phone-link", s.phone ? "tel:" + s.phone.replace(/[^\d+]/g, "") : "", s.phone);
  setLink("email-link", s.email ? "mailto:" + s.email : "", s.email);

  if (!s.phone && !s.email && !s.discordUrl && !s.facebookUrl && !s.instagramUrl) $("contact-block").hidden = true;

  $("year").textContent = new Date().getFullYear();

  // Structured data for Google (schema.org LocalBusiness), built from shop.js so
  // hours, address and links stay in one place. Google reads JSON-LD added by script.
  // Check it at https://search.google.com/test/rich-results
  function to24(t, fallbackMeridiem) {
    var m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(t.trim());
    if (!m) return null;
    var h = parseInt(m[1], 10) % 12;
    var mer = (m[3] || fallbackMeridiem || "").toLowerCase();
    if (!mer) return null;
    if (mer === "pm") h += 12;
    return String(h).padStart(2, "0") + ":" + (m[2] || "00");
  }
  var specs = {};
  (s.hours || []).forEach(function (row) {
    var parts = String(row[1]).split(/\s*[–-]\s*/);
    if (parts.length !== 2) return; // "Closed" or anything unusual is skipped
    var closeMer = (/(am|pm)\s*$/i.exec(parts[1]) || [])[1];
    var opens = to24(parts[0], closeMer);
    var closes = to24(parts[1]);
    if (!opens || !closes) return;
    var key = opens + "-" + closes;
    if (!specs[key]) specs[key] = { "@type": "OpeningHoursSpecification", dayOfWeek: [], opens: opens, closes: closes };
    specs[key].dayOfWeek.push(row[0]);
  });
  var addrLines = s.address || [];
  var cityLine = /^(.+?),\s*([A-Z]{2})\s+(\d{5})/.exec(addrLines[addrLines.length - 1] || "");
  var ld = {
    "@context": "https://schema.org",
    "@type": "HobbyShop",
    name: "Night & Day Cards",
    description: s.tagline,
    url: "https://www.nightanddaycards.com/",
    logo: "https://www.nightanddaycards.com/img/logo.png",
    image: "https://www.nightanddaycards.com/img/og-image.png",
    telephone: s.phone || undefined,
    email: s.email || undefined,
    hasMap: s.mapUrl || undefined,
    address: cityLine ? {
      "@type": "PostalAddress",
      streetAddress: addrLines.slice(0, -1).join(", "),
      addressLocality: cityLine[1],
      addressRegion: cityLine[2],
      postalCode: cityLine[3],
      addressCountry: "US"
    } : undefined,
    openingHoursSpecification: Object.keys(specs).map(function (k) { return specs[k]; }),
    sameAs: [s.facebookUrl, s.instagramUrl, s.discordUrl].filter(Boolean),
    knowsAbout: s.games && s.games.length ? s.games : undefined
  };
  var ldScript = document.createElement("script");
  ldScript.type = "application/ld+json";
  ldScript.textContent = JSON.stringify(ld);
  document.head.appendChild(ldScript);
})();
