// Hidden hours page (/update-hours). Loads the hours currently on the site, lets the
// owner edit each day, and sends them to the worker's /hours endpoint with the admin
// password. The password is checked by the worker; nothing secret lives in this file.
(function () {
  var s = window.SHOP || {};
  var WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var url = s.hoursUrl;

  function $(id) { return document.getElementById(id); }
  var status = $("hours-status");
  var msg = $("hours-msg");
  var rowsBox = $("day-rows");
  var inputs = {};

  // "5:30 pm" or "10 am" -> "17:30" / "10:00" (for the time pickers)
  function to24(t, fallbackMer) {
    var m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(String(t).trim());
    if (!m) return "";
    var mer = (m[3] || fallbackMer || "").toLowerCase();
    if (!mer) return "";
    var h = parseInt(m[1], 10) % 12 + (mer === "pm" ? 12 : 0);
    return String(h).padStart(2, "0") + ":" + (m[2] || "00");
  }
  // "17:30" -> "5:30 pm", "10:00" -> "10 am" (same style as shop.js)
  function to12(v) {
    var p = v.split(":");
    var h = parseInt(p[0], 10);
    var mer = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + (p[1] !== "00" ? ":" + p[1] : "") + " " + mer;
  }
  function parseRange(text) {
    var parts = String(text).split(/\s*[–-]\s*/);
    if (parts.length !== 2) return null;
    var closeMer = (/(am|pm)\s*$/i.exec(parts[1]) || [])[1];
    var open = to24(parts[0], closeMer);
    var close = to24(parts[1]);
    return open && close ? { open: open, close: close } : null;
  }

  // One row per day: Open checkbox, opening time, closing time
  WEEK.forEach(function (day) {
    var row = document.createElement("div");
    row.className = "day-row";
    var id = day.toLowerCase();
    row.innerHTML =
      '<span class="day-name">' + day + '</span>' +
      '<label class="day-open"><input type="checkbox" id="' + id + '-open"> Open</label>' +
      '<label class="field"><span>Opens</span><input type="time" id="' + id + '-from" step="900"></label>' +
      '<label class="field"><span>Closes</span><input type="time" id="' + id + '-to" step="900"></label>';
    rowsBox.appendChild(row);
    var open = row.querySelector("#" + id + "-open");
    var from = row.querySelector("#" + id + "-from");
    var to = row.querySelector("#" + id + "-to");
    inputs[day] = { open: open, from: from, to: to };
    open.addEventListener("change", function () {
      from.disabled = to.disabled = !open.checked;
      row.classList.toggle("is-closed", !open.checked);
    });
  });

  function fill(rows, note) {
    var byDay = {};
    (rows || []).forEach(function (r) { byDay[r[0]] = r[1]; });
    WEEK.forEach(function (day) {
      var range = parseRange(byDay[day] || "");
      var f = inputs[day];
      f.open.checked = !!range;
      f.from.value = range ? range.open : "10:00";
      f.to.value = range ? range.close : "17:00";
      f.open.dispatchEvent(new Event("change"));
    });
    $("hours-note-input").value = note || "";
  }

  function describe(data) {
    if (data && data.hours) {
      var when = data.updatedAt ? new Date(data.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
      return "The website is showing hours posted here" + (when ? " on " + when : "") + ".";
    }
    return "The website is showing the regular hours from shop.js.";
  }

  function showMsg(text, ok) {
    msg.textContent = text;
    msg.className = ok ? "form-ok" : "form-error";
    msg.hidden = !text;
  }

  if (!url) {
    status.textContent = "hoursUrl isn't set in js/shop.js, so hours can't be updated here.";
    $("hours-form").hidden = true;
    return;
  }

  fetch(url, { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      status.textContent = describe(data);
      if (data && data.hours) fill(data.hours, data.note); else fill(s.hours);
    })
    .catch(function () {
      status.textContent = "Couldn't load the posted hours, so the regular hours are filled in below.";
      fill(s.hours);
    });

  function send(payload, button) {
    var password = $("admin-password").value;
    if (!password) { showMsg("Enter the password."); $("admin-password").focus(); return; }
    payload.password = password;
    button.disabled = true;
    showMsg("");
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) { showMsg((res.data && res.data.message) || "That didn't work."); return; }
        status.textContent = describe(res.data);
        if (!res.data.hours) fill(s.hours);
        showMsg(res.data.hours ? "Saved. The new hours are on the website now." : "Done. The website is back to the regular hours.", true);
      })
      .catch(function () { showMsg("Couldn't reach the server. Check your connection and try again."); })
      .then(function () { button.disabled = false; });
  }

  $("hours-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var hours = [];
    for (var i = 0; i < WEEK.length; i++) {
      var day = WEEK[i];
      var f = inputs[day];
      if (!f.open.checked) { hours.push([day, "Closed"]); continue; }
      // A closing time of 12:00 am means midnight, which counts as later than any opening time
      var lateEnough = f.to.value === "00:00" || f.to.value > f.from.value;
      if (!f.from.value || !f.to.value || !lateEnough) {
        showMsg(day + ": the closing time needs to be after the opening time.");
        f.to.focus();
        return;
      }
      hours.push([day, to12(f.from.value) + " – " + to12(f.to.value)]);
    }
    send({ hours: hours, note: $("hours-note-input").value.trim() }, $("save-btn"));
  });

  $("reset-btn").addEventListener("click", function () {
    if (!confirm("Remove the posted hours and show the regular hours from shop.js?")) return;
    send({ action: "reset" }, $("reset-btn"));
  });
})();
