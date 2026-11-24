// Cart page: lists the cart, refreshes prices from the latest product list,
// collects pickup details, and sends the order to the checkout worker
// (SHOP.checkoutUrl), which returns a Square checkout page to redirect to.
(function () {
  var s = window.SHOP || {};
  var fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  $("year").textContent = new Date().getFullYear();
  if (!Cart.enabled) {
    if (Cart.paused) $("cart-off").textContent = s.orderingPausedMessage || "Online ordering is paused right now.";
    $("cart-off").hidden = false;
    return;
  }

  $("pickup-where").textContent = "Pick up at " + (s.address || []).join(", ") + ".";
  $("pickup-note").textContent = s.pickupNote || "";

  // Remember contact details on this device for next time
  var CONTACT_KEY = "ndc-contact-v1";
  try {
    var saved = JSON.parse(localStorage.getItem(CONTACT_KEY) || "{}");
    $("c-name").value = saved.name || "";
    $("c-phone").value = saved.phone || "";
    $("c-email").value = saved.email || "";
  } catch (e) { /* ignore */ }

  var unavailable = {}; // variation id -> message, from the latest product list or a stock check

  function showAlert(text) {
    $("cart-alert").textContent = text || "";
    $("cart-alert").hidden = !text;
  }

  function render() {
    var lines = Cart.lines();
    $("cart-empty").hidden = lines.length > 0;
    $("cart-full").hidden = lines.length === 0;
    var ul = $("cart-lines");
    ul.textContent = "";
    lines.forEach(function (l) {
      var li = el("li", "", "cart-line");
      var media = el("div", "", "cart-media");
      if (l.image && /^https:\/\//.test(l.image)) {
        var img = document.createElement("img");
        img.src = l.image;
        img.alt = "";
        img.width = 80;
        img.height = 80;
        media.appendChild(img);
      }
      li.appendChild(media);

      var info = el("div", "", "cart-info");
      info.appendChild(el("span", l.category, "product-cat"));
      info.appendChild(el("strong", l.name, "cart-name"));
      if (l.option) info.appendChild(el("span", l.option, "cart-option"));
      if (unavailable[l.id]) info.appendChild(el("span", unavailable[l.id], "cart-warn"));
      li.appendChild(info);

      var controls = el("div", "", "cart-controls");
      var qty = document.createElement("select");
      qty.setAttribute("aria-label", "Quantity of " + l.name);
      for (var i = 1; i <= Cart.MAX_QTY; i++) {
        var o = el("option", String(i));
        o.value = String(i);
        if (i === l.qty) o.selected = true;
        qty.appendChild(o);
      }
      qty.addEventListener("change", function () { Cart.setQty(l.id, Number(qty.value)); });
      controls.appendChild(qty);
      controls.appendChild(el("span", fmt.format((l.price || 0) * l.qty), "cart-price"));
      var rm = el("button", "Remove", "link-btn");
      rm.type = "button";
      rm.addEventListener("click", function () { delete unavailable[l.id]; Cart.remove(l.id); });
      controls.appendChild(rm);
      li.appendChild(controls);
      ul.appendChild(li);
    });
    $("subtotal").textContent = fmt.format(Cart.subtotal());
  }

  Cart.onChange(render);
  render();

  // Refresh names and prices from the latest product list, and flag items that
  // are no longer listed (sold out since they were added).
  fetch("data/products.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.products) return;
      var current = {};
      data.products.forEach(function (p) {
        if (p.variationId) current[p.variationId] = { name: p.name, option: "", price: p.priceMin, image: p.image, category: p.category };
        (p.options || []).forEach(function (o) {
          current[o.id] = { name: p.name, option: o.name, price: o.price, image: p.image, category: p.category };
        });
      });
      var changed = false;
      Cart.lines().forEach(function (l) {
        var c = current[l.id];
        var line = Cart.find(l.id);
        if (!c || c.price === null) {
          unavailable[l.id] = "May be sold out. We'll check when you go to checkout.";
          return;
        }
        if (line.price !== c.price || line.name !== c.name) {
          line.price = c.price;
          line.name = c.name;
          line.option = c.option;
          line.image = c.image;
          line.category = c.category;
          changed = true;
        }
      });
      if (changed) Cart.save(); // re-renders through onChange
      else render();
    })
    .catch(function () { /* keep cart as is */ });

  // ---- Checkout ----
  var form = $("checkout-form");
  var btn = $("checkout-btn");

  function formError(text, field) {
    $("form-error").textContent = text || "";
    $("form-error").hidden = !text;
    if (field && $("c-" + field)) $("c-" + field).focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError("");
    showAlert("");
    var contact = {
      name: $("c-name").value.trim(),
      phone: $("c-phone").value.trim(),
      email: $("c-email").value.trim()
    };
    if (contact.name.length < 2) return formError("Please enter the name for pickup.", "name");
    if (contact.phone.replace(/\D/g, "").length < 10) return formError("Please enter your phone number.", "phone");
    try { localStorage.setItem(CONTACT_KEY, JSON.stringify(contact)); } catch (err) { /* ignore */ }

    btn.disabled = true;
    btn.textContent = "Checking stock…";
    fetch(s.checkoutUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: Cart.lines().map(function (l) { return { id: l.id, qty: l.qty }; }),
        contact: contact
      })
    })
      .then(function (r) { return r.json().then(function (body) { return { status: r.status, body: body }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body.url) {
          btn.textContent = "Opening checkout…";
          location.href = res.body.url;
          return;
        }
        btn.disabled = false;
        btn.textContent = "Checkout";
        var b = res.body || {};
        if (b.error === "stock") {
          // Lower quantities to what's available; remove what's gone
          var removed = [];
          (b.items || []).forEach(function (it) {
            if (it.available > 0) {
              Cart.setQty(it.id, it.available);
              unavailable[it.id] = "Only " + it.available + " left. Quantity updated.";
            } else {
              removed.push(it.name);
              delete unavailable[it.id];
              Cart.remove(it.id);
            }
          });
          render();
          showAlert(
            "Some items changed since you added them." +
            (removed.length ? " Removed (sold out): " + removed.join(", ") + "." : "") +
            " Please review your cart, then check out again."
          );
          return;
        }
        if (b.error === "contact") return formError(b.message, b.field);
        if (b.error === "paused") {
          btn.disabled = true;
          return formError(s.orderingPausedMessage || b.message);
        }
        formError(b.message || "Something went wrong. Please try again.");
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Checkout";
        formError("Couldn't reach checkout. Check your connection and try again.");
      });
  });
})();
