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
    if (text) a.textContent = text;
    a.hidden = false;
  }

  document.querySelectorAll("[data-bind]").forEach(function (n) {
    var v = s[n.getAttribute("data-bind")];
    if (v) { n.textContent = v; } else { n.hidden = true; }
  });

  var games = s.games || [];
  if (games.length) {
    var gl = $("games-list");
    games.forEach(function (g) { gl.appendChild(el("li", g)); });
    $("games").hidden = false;
  }

  var today = DAYS[new Date().getDay()];
  var hours = $("hours-list");
  (s.hours || []).forEach(function (row) {
    var wrap = el("div", "", "row");
    var dt = el("dt", row[0]);
    var dd = el("dd", row[1]);
    if (String(row[0]).toLowerCase() === today) {
      wrap.className = "row today";
      dt.appendChild(el("span", "Today", "badge"));
    }
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    hours.appendChild(wrap);
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
  if (!list.length) events.appendChild(el("li", "Event schedule coming soon."));

  var addr = $("address");
  (s.address || []).forEach(function (line) { addr.appendChild(el("div", line)); });

  setLink("map-link", s.mapUrl);
  setLink("cta-shop", s.shopUrl);
  setLink("cta-discord", s.discordUrl);
  setLink("discord-link", s.discordUrl);
  setLink("phone-link", s.phone ? "tel:" + s.phone.replace(/[^\d+]/g, "") : "", s.phone);
  setLink("email-link", s.email ? "mailto:" + s.email : "", s.email);

  if (!s.phone && !s.email && !s.discordUrl) $("contact-block").hidden = true;

  $("year").textContent = new Date().getFullYear();
})();
