// Products page: shows data/products.json (built from Square on every deploy,
// see scripts/fetch-square.mjs) with search, category filter, and sort.
(function () {
  var PAGE_SIZE = 48;

  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  // Lowercase and strip accents so "pokemon" matches "Pokémon"
  function norm(str) {
    return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  var fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  function priceText(min, max) {
    if (min === null || min === undefined) return "";
    return min === max ? fmt.format(min) : fmt.format(min) + " – " + fmt.format(max);
  }

  $("year").textContent = new Date().getFullYear();

  var grid = $("product-grid");
  var countEl = $("count");
  var moreBtn = $("more");
  var q = $("q"), cat = $("cat"), sort = $("sort");
  var all = [];
  var filtered = [];
  var shown = 0;

  function card(p) {
    var li = el("li", "", "product");
    var media = el("div", "", "product-media");
    if (p.image && /^https:\/\//.test(p.image)) {
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 300;
      img.height = 300;
      media.appendChild(img);
    } else {
      media.appendChild(el("span", p.name.charAt(0), "product-placeholder"));
    }
    li.appendChild(media);

    var body = el("div", "", "product-body");
    body.appendChild(el("span", p.category, "product-cat"));
    body.appendChild(el("h2", p.name, "product-name"));
    if (p.description) body.appendChild(el("p", p.description, "product-desc"));
    if (p.options) {
      var opts = el("ul", "", "product-options");
      p.options.forEach(function (o) {
        var row = el("li");
        row.appendChild(el("span", o.name));
        var right = o.price !== null ? fmt.format(o.price) : "";
        if (o.stock === "low") right += (right ? " · " : "") + "Low";
        row.appendChild(el("span", right));
        opts.appendChild(row);
      });
      body.appendChild(opts);
    }
    var foot = el("div", "", "product-foot");
    foot.appendChild(el("span", priceText(p.priceMin, p.priceMax), "product-price"));
    foot.appendChild(el("span", p.stock === "low" ? "Low stock" : "In stock", "stock stock-" + p.stock));
    body.appendChild(foot);
    li.appendChild(body);
    return li;
  }

  function renderMore() {
    var next = filtered.slice(shown, shown + PAGE_SIZE);
    var frag = document.createDocumentFragment();
    next.forEach(function (p) { frag.appendChild(card(p)); });
    grid.appendChild(frag);
    shown += next.length;
    moreBtn.hidden = shown >= filtered.length;
    if (!moreBtn.hidden) moreBtn.textContent = "Show more (" + (filtered.length - shown) + " left)";
  }

  function apply() {
    var terms = norm(q.value).split(/\s+/).filter(Boolean);
    var c = cat.value;
    filtered = all.filter(function (p) {
      if (c && p.category !== c) return false;
      return terms.every(function (t) { return p._search.indexOf(t) !== -1; });
    });
    var s = sort.value;
    if (s !== "name") {
      var dir = s === "price-asc" ? 1 : -1;
      filtered = filtered.slice().sort(function (a, b) {
        // Items without a price go last either way
        if (a.priceMin === null) return 1;
        if (b.priceMin === null) return -1;
        return (a.priceMin - b.priceMin) * dir;
      });
    }
    grid.textContent = "";
    shown = 0;
    countEl.textContent = filtered.length
      ? filtered.length + (filtered.length === 1 ? " product" : " products")
      : "No products match. Try a different search or category.";
    renderMore();

    // Keep the search in the URL so it can be shared or bookmarked
    var params = new URLSearchParams();
    if (q.value.trim()) params.set("q", q.value.trim());
    if (c) params.set("cat", c);
    if (s !== "name") params.set("sort", s);
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
      Object.keys(cats).sort().forEach(function (name) {
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
      if (params.get("sort")) sort.value = params.get("sort");
      if (!sort.value) sort.value = "name";

      $("filters").hidden = false;
      apply();
    })
    .catch(unavailable);

  var timer;
  q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(apply, 150); });
  cat.addEventListener("change", apply);
  sort.addEventListener("change", apply);
  $("filters").addEventListener("submit", function (e) { e.preventDefault(); apply(); });
  moreBtn.addEventListener("click", renderMore);
})();
