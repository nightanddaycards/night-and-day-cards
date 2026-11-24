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
    li.appendChild(body);
    return li;
  }

  return { render: render, priceText: priceText };
})();
