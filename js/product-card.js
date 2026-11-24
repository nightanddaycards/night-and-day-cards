// Shared product card, used by the Products page and the home page's Featured section.
// Expects a product from data/products.json or data/featured.json.
window.ProductCard = (function () {
  var fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function priceText(min, max) {
    if (min === null || min === undefined) return "";
    return min === max ? fmt.format(min) : fmt.format(min) + " – " + fmt.format(max);
  }

  // headingTag: "h2" on the Products page, "h3" inside a home page section
  function render(p, headingTag) {
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
    body.appendChild(el(headingTag || "h2", p.name, "product-name"));
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
    var buy = buyControls(p);
    if (buy) body.appendChild(buy);
    li.appendChild(body);
    return li;
  }

  // "Add to cart" (with an option picker when the item has options). Only shown when
  // online ordering is on (SHOP.checkoutUrl) and the item has a fixed price.
  function buyControls(p) {
    if (!window.Cart || !Cart.enabled) return null;
    var choices = p.options
      ? p.options.filter(function (o) { return o.id && o.price !== null; })
      : (p.variationId && p.priceMin !== null ? [{ id: p.variationId, name: "", price: p.priceMin }] : []);
    if (!choices.length) return el("p", "Available in store", "buy-note");

    var wrap = el("div", "", "buy");
    var select = null;
    if (p.options) {
      select = document.createElement("select");
      select.className = "buy-option";
      select.setAttribute("aria-label", "Option for " + p.name);
      choices.forEach(function (o, i) {
        var opt = el("option", o.name + " – " + fmt.format(o.price));
        opt.value = String(i);
        select.appendChild(opt);
      });
      wrap.appendChild(select);
    }
    var btn = el("button", "Add to cart", "btn btn-gold buy-btn");
    btn.type = "button";
    btn.addEventListener("click", function () {
      var o = choices[select ? Number(select.value) : 0];
      Cart.add({ id: o.id, name: p.name, option: o.name, price: o.price, image: p.image, category: p.category }, 1);
      btn.textContent = "Added ✓";
      btn.disabled = true;
      setTimeout(function () { btn.textContent = "Add to cart"; btn.disabled = false; }, 1200);
    });
    wrap.appendChild(btn);
    return wrap;
  }

  return { render: render, priceText: priceText };
})();
