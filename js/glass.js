/* Liquid glass, a trial (glass-demo.html only; styles in css/glass.css).

   In Chromium browsers each glass shape bends what is behind it: an SVG
   displacement map, drawn here to the shape's own size, pulls the backdrop
   in toward the middle round the rim, used as the shape's backdrop-filter.
   Not the lens: it sits over the link text, and any bend there blurs it. Other browsers cannot use
   an SVG filter there, so they keep the glass without the bend.

   Also: the lens that slides between the nav links, the tint deepening over
   white sections, and the sheen drifting as the page scrolls. */
(function () {
  "use strict";
  var body = document.body;
  var nav = document.querySelector(".nav");
  if (!body.classList.contains("glass") || !nav) return;

  var ua = navigator.userAgentData;
  var BEND = !!(ua && ua.brands && ua.brands.some(function (b) { return /Chromium/i.test(b.brand); }));
  var NS = "http://www.w3.org/2000/svg";
  var defs = null;
  if (BEND) {
    var holder = document.createElementNS(NS, "svg");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    defs = document.createElementNS(NS, "defs");
    holder.appendChild(defs);
    body.appendChild(holder);
  }
  function svgEl(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* A displacement map for a w x h box with corner radius r. Red is the
     sideways pull, green the vertical, 128 none. Within `rim` px of the edge
     the backdrop is sampled from further in (up to `pull` px), most at the
     very edge; `mag` also samples toward the middle, which magnifies. */
  function bendMap(w, h, r, rim, pull, mag) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d"), img = g.createImageData(w, h), px = img.data;
    var hx = w / 2 - r, hy = h / 2 - r;
    var scale = 2 * (pull + mag * Math.max(w, h) / 2) || 1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ux = x + 0.5 - w / 2, uy = y + 0.5 - h / 2;
      var qx = Math.abs(ux) - hx, qy = Math.abs(uy) - hy;
      var ox = Math.max(qx, 0), oy = Math.max(qy, 0), ol = Math.hypot(ox, oy);
      var depth = -(ol + Math.min(Math.max(qx, qy), 0) - r);           // px in from the edge
      var nx, ny;                                                       // outward normal
      if (ol > 0) { nx = ox / ol * Math.sign(ux); ny = oy / ol * Math.sign(uy); }
      else if (qx > qy) { nx = Math.sign(ux); ny = 0; }
      else { nx = 0; ny = Math.sign(uy); }
      var t = depth < rim ? 1 - Math.max(0, depth) / rim : 0, k = t * t;
      var dx = -nx * k * pull - ux * mag, dy = -ny * k * pull - uy * mag;
      var i = (y * w + x) * 4;
      px[i] = Math.max(0, Math.min(255, 128 + dx / scale * 255));
      px[i + 1] = Math.max(0, Math.min(255, 128 + dy / scale * 255));
      px[i + 2] = 128;
      px[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { url: c.toDataURL(), scale: scale };
  }

  /* A filter for one size of shape, made once and reused. */
  var made = {};
  function bendFilter(w, h, r, rim, pull, mag) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    var id = "lg-" + [w, h, Math.round(r), rim, pull, Math.round(mag * 100)].join("-");
    if (made[id]) return id;
    var m = bendMap(w, h, Math.min(r, w / 2, h / 2), rim, pull, mag);
    var f = svgEl("filter", { id: id, x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse",
      "color-interpolation-filters": "sRGB" }, defs);
    svgEl("feImage", { href: m.url, x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "map" }, f);
    svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: 0.6, result: "soft" }, f);
    svgEl("feDisplacementMap", { in: "soft", in2: "map", scale: m.scale.toFixed(1),
      xChannelSelector: "R", yChannelSelector: "G" }, f);
    made[id] = true;
    return id;
  }
  /* Give an element bent glass at its current size, and again when it
     changes size. */
  function bend(el, rim, pull, mag, extra) {
    if (!BEND) return;
    function fit() {
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      var r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      el.style.setProperty("--lg-filter", "url(#" + bendFilter(w, h, r, rim, pull, mag) + ") " + extra);
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(el);
  }
  bend(nav, 28, 24, 0.04, "saturate(1.7) brightness(1.05)");
  Array.prototype.forEach.call(document.querySelectorAll(".nav__dropdown-menu"), function (m) {
    bend(m, 24, 18, 0.03, "saturate(1.7) brightness(1.05)");
  });
  var mobile = document.querySelector(".nav__mobile");
  if (mobile) bend(mobile, 26, 20, 0.02, "saturate(1.7) brightness(1.05)");

  /* ---- the lens ------------------------------------------------------- */
  // One glass drop under the pointer's link. It appears where you first
  // point, then slides to each link you move to on a spring, stretching
  // along the way and squashing a little as it settles; it fades when the
  // pointer leaves the pill.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var lens = document.createElement("span");
    lens.className = "nav__lens";
    lens.setAttribute("aria-hidden", "true");
    nav.appendChild(lens);
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var x = 0, w = 0, vx = 0, vw = 0, tx = 0, tw = 0, ty = 0, th = 0, on = false, raf = 0, last = 0, cta = false;
    var draw = function (sx, sy) {
      // Over Apply the drop sits inside the button's border: it never runs
      // past its right edge (the spring overshoots a little as it settles)
      // and does not stretch sideways there.
      var dw = w;
      if (cta) { dw = Math.min(w, tx + tw - x); sx = 1; }
      lens.style.width = Math.max(0, dw).toFixed(1) + "px";
      lens.style.height = th + "px";
      lens.style.transform = "translate(" + x.toFixed(1) + "px," + ty + "px) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
    };
    var tick = function (now) {
      var dt = Math.min(1 / 30, Math.max(0, now - last) / 1000);
      last = now;
      var ax = 420 * (tx - x) - 30 * vx, aw = 420 * (tw - w) - 30 * vw;
      vx += ax * dt; vw += aw * dt; x += vx * dt; w += vw * dt;
      var s = Math.min(0.14, Math.abs(vx) / 3500);                  // stretch with speed
      draw(1 + s, 1 - s * 0.8);
      if (Math.abs(tx - x) > 0.3 || Math.abs(vx) > 2 || Math.abs(tw - w) > 0.3 || Math.abs(vw) > 2) raf = requestAnimationFrame(tick);
      else { x = tx; w = tw; vx = vw = 0; draw(1, 1); raf = 0; }
    };
    var target = function (link) {
      var a = link.getBoundingClientRect(), b = nav.getBoundingClientRect();
      // the lens is placed from inside the pill's border (clientLeft/Top)
      tx = a.left - b.left - nav.clientLeft; tw = a.width;
      ty = Math.round(a.top - b.top - nav.clientTop); th = Math.round(a.height);
      cta = link.classList.contains("btn--nav");
      if (cta) {                                     // inside the blue border, not on it
        var bw = parseFloat(getComputedStyle(link).borderTopWidth) || 0;
        tx += bw; tw -= 2 * bw; ty += Math.round(bw); th -= 2 * Math.round(bw);
      }
      lens.classList.toggle("is-cta", cta);
      if (!on || still) { x = tx; w = tw; vx = vw = 0; draw(1, 1); }
      on = true;
      lens.classList.add("is-on");
      if (!still && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    Array.prototype.forEach.call(nav.querySelectorAll(".nav__menu > li > .nav__link, .nav__actions .nav__link, .nav__actions .btn--nav"), function (link) {
      link.addEventListener("pointerenter", function () { target(link); });
      link.addEventListener("focus", function () { target(link); });
    });
    nav.addEventListener("pointerleave", function () { on = false; lens.classList.remove("is-on"); });
    nav.addEventListener("focusout", function (e) { if (!nav.contains(e.relatedTarget)) { on = false; lens.classList.remove("is-on"); } });
  }

  /* ---- tint and sheen ------------------------------------------------- */
  // Over a white section the tint deepens so the white type holds; the sheen
  // slides back and forth as the page scrolls.
  var lights = document.querySelectorAll(".section--light");
  var pending = 0;
  function onScroll() {
    pending = 0;
    var r = nav.getBoundingClientRect(), mid = (r.top + r.bottom) / 2;
    var light = Array.prototype.some.call(lights, function (s) {
      var q = s.getBoundingClientRect();
      return q.top < mid && q.bottom > mid;
    });
    body.classList.toggle("glass-on-light", light);
    nav.style.setProperty("--sheen", (50 + Math.sin(window.scrollY / 420) * 45).toFixed(1) + "%");
  }
  window.addEventListener("scroll", function () { if (!pending) pending = requestAnimationFrame(onScroll); }, { passive: true });
  onScroll();
})();
