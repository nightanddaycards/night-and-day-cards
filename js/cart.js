// Shopping cart, kept in the visitor's browser (localStorage).
// Active only when SHOP.checkoutUrl is set and SHOP.onlineOrdering isn't false
// (js/shop.js). Otherwise Cart.enabled is false and cart links and buttons stay
// hidden; saved carts are kept until ordering is turned back on.
window.Cart = (function () {
  var KEY = "ndc-cart-v1";
  var MAX_QTY = 10;
  var shop = window.SHOP || {};
  var configured = !!shop.checkoutUrl;
  var paused = configured && shop.onlineOrdering === false;
  var enabled = configured && !paused;
  var listeners = [];

  function read() {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list.filter(function (l) { return l && l.id && l.qty > 0; }) : [];
    } catch (e) {
      return [];
    }
  }
  var lines = read();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) { /* private mode: cart lasts this page only */ }
    updateBadge();
    listeners.forEach(function (fn) { fn(lines); });
  }

  function find(id) {
    for (var i = 0; i < lines.length; i++) if (lines[i].id === id) return lines[i];
    return null;
  }

  // item: { id, name, option, price, image, category }
  function add(item, qty) {
    var line = find(item.id);
    if (line) {
      line.qty = Math.min(MAX_QTY, line.qty + (qty || 1));
    } else {
      lines.push({
        id: item.id, qty: Math.min(MAX_QTY, qty || 1), name: item.name, option: item.option || "",
        price: item.price, image: item.image || "", category: item.category || ""
      });
    }
    save();
  }

  function setQty(id, qty) {
    var line = find(id);
    if (!line) return;
    if (qty <= 0) return remove(id);
    line.qty = Math.min(MAX_QTY, qty);
    save();
  }

  function remove(id) {
    lines = lines.filter(function (l) { return l.id !== id; });
    save();
  }

  function clear() {
    lines = [];
    save();
  }

  function count() {
    return lines.reduce(function (n, l) { return n + l.qty; }, 0);
  }

  function subtotal() {
    return lines.reduce(function (sum, l) { return sum + (l.price || 0) * l.qty; }, 0);
  }

  // Header link: "Cart (3)"
  function updateBadge() {
    var link = document.getElementById("cart-link");
    var badge = document.getElementById("cart-count");
    if (!link) return;
    link.hidden = !enabled;
    if (badge) {
      var n = count();
      badge.textContent = n;
      badge.hidden = n === 0;
    }
  }

  // Other tabs: keep the count in sync
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) { lines = read(); updateBadge(); listeners.forEach(function (fn) { fn(lines); }); }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateBadge);
  else updateBadge();

  return {
    enabled: enabled,
    paused: paused, // set up, but switched off in shop.js
    MAX_QTY: MAX_QTY,
    lines: function () { return lines.slice(); },
    find: find,
    add: add,
    setQty: setQty,
    remove: remove,
    clear: clear,
    count: count,
    subtotal: subtotal,
    save: save, // call after editing lines returned by find()
    onChange: function (fn) { listeners.push(fn); }
  };
})();
