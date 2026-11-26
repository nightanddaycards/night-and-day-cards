// Products page: shows data/products.json (built from Square on every deploy,
// see scripts/fetch-square.mjs) with search and category filter. Products arrive sorted by name.
(function () {
  var PAGE_SIZE = 48;

  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  // Lowercase, strip accents and punctuation so "pokemon" matches "Pokémon"
  // and "yu gi oh" matches "Yu-Gi-Oh!"
  function norm(str) {
    return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  $("year").textContent = new Date().getFullYear();

  var grid = $("product-grid");
  var countEl = $("count");
  var moreBtn = $("more");
  var q = $("q"), cat = $("cat");
  var all = [];
  var gameCats = {}; // game name (from shop.js) -> Square categories that belong to it
  // Set when arriving from a home page game tag (?game=...). It isn't in the dropdown;
  // choosing any category, or "Show all", clears it.
  var activeGame = "";
  var filtered = [];
  var shown = 0;



  function renderMore() {
    var next = filtered.slice(shown, shown + PAGE_SIZE);
    var frag = document.createDocumentFragment();
    next.forEach(function (p) { frag.appendChild(ProductCard.render(p, "h2")); });
    grid.appendChild(frag);
    shown += next.length;
    moreBtn.hidden = shown >= filtered.length;
    if (!moreBtn.hidden) moreBtn.textContent = "Show more (" + (filtered.length - shown) + " left)";
  }

  function apply() {
    var terms = norm(q.value).split(/\s+/).filter(Boolean);
    var c = cat.value;
    if (c) activeGame = "";
    filtered = all.filter(function (p) {
      if (activeGame) {
        if (gameCats[activeGame].indexOf(p.category) === -1) return false;
      } else if (c && p.category !== c) return false;
      return terms.every(function (t) { return p._search.indexOf(t) !== -1; });
    });
    grid.textContent = "";
    shown = 0;
    countEl.textContent = filtered.length
      ? filtered.length + (activeGame ? " " + activeGame : "") + (filtered.length === 1 ? " product" : " products")
      : "No products match. Try a different search or category.";
    if (activeGame) {
      var all_ = el("button", "Show all products", "link-btn");
      all_.type = "button";
      all_.addEventListener("click", function () { activeGame = ""; apply(); });
      countEl.appendChild(document.createTextNode(" · "));
      countEl.appendChild(all_);
    }
    renderMore();

    // Keep the search in the URL so it can be shared or bookmarked
    var params = new URLSearchParams();
    if (q.value.trim()) params.set("q", q.value.trim());
    if (activeGame) params.set("game", activeGame);
    else if (c) params.set("cat", c);
    var qs = params.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  function unavailable() {
    countEl.textContent = "The product list isn't available right now. Give us a call or stop by to ask what's in stock.";
  }

  fetch("data/products.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.products || !data.products.length) return unavailable();
      all = data.products.map(function (p) {
        p._search = norm([p.name, p.category, p.description].concat((p.options || []).map(function (o) { return o.name; })).join(" "));
        return p;
      });

      var cats = {};
      all.forEach(function (p) { cats[p.category] = (cats[p.category] || 0) + 1; });
      var catNames = Object.keys(cats).sort();

      // Group Square categories under the games listed in shop.js. A category
      // belongs to a game when either name contains the other as whole words,
      // ignoring case, accents and punctuation: "Japanese Pokemon" -> "Pokémon",
      // "Lorcana" -> "Disney Lorcana", "Magic the Gathering" -> "Magic: The Gathering",
      // or when they're identical with spaces removed: "Yugioh" -> "Yu-Gi-Oh!".
      function wordsIn(haystack, needle) {
        return (" " + haystack + " ").indexOf(" " + needle + " ") !== -1;
      }
      ((window.SHOP && window.SHOP.games) || []).forEach(function (game) {
        var g = norm(game);
        var list = catNames.filter(function (n) {
          var a = norm(n);
          // the last check matches "Yugioh" to "Yu-Gi-Oh!"
          return wordsIn(a, g) || wordsIn(g, a) || a.replace(/ /g, "") === g.replace(/ /g, "");
        });
        if (list.length) gameCats[game] = list;
      });
      // The dropdown lists Square's categories as they are
      catNames.forEach(function (name) {
        var o = el("option", name + " (" + cats[name] + ")");
        o.value = name;
        cat.appendChild(o);
      });

      if (data.updated) {
        var d = new Date(data.updated);
        $("updated").textContent = "Stock updated " + d.toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
        });
        $("updated").hidden = false;
      }

      var params = new URLSearchParams(location.search);
      q.value = params.get("q") || "";
      if (params.get("cat") && cats[params.get("cat")]) cat.value = params.get("cat");

      // ?game=... comes from the "TCGs we carry" tags on the home page. Select that
      // game's categories; if none of its categories have stock, search its name instead.
      var game = params.get("game");
      if (game) {
        var known = Object.keys(gameCats).filter(function (n) { return norm(n) === norm(game); })[0];
        if (known) activeGame = known;
        else q.value = game;
      }

      $("filters").hidden = false;
      apply();
    })
    .catch(unavailable);

  var timer;
  q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(apply, 150); });
  cat.addEventListener("change", apply);
  $("filters").addEventListener("submit", function (e) { e.preventDefault(); apply(); });
  moreBtn.addEventListener("click", renderMore);
})();
