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

  /* ---- the wobble ----------------------------------------------------- */
  // One soft wobble like a drop of glass: 102% wide, then 102% tall, a
  // faint echo, back to its own size; even steps, eased as a whole. Used
  // by the hero button and by the lens when it first appears.
  var WOBBLE = [[0, 0], [0.02, -0.015], [-0.015, 0.02], [0.005, -0.004], [0, 0]];
  var WOBBLE_MS = 450;
  var CTA_WOBBLE = 0.01;                     // pill buttons peak at 101% (the nav lens at 103%)
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  function wobbleAt(ms, a) {                 // [sx, sy] at ms into the wobble; a: peak, 0.02 = 102%
    var p = easeInOut(Math.min(1, Math.max(0, ms / WOBBLE_MS))) * (WOBBLE.length - 1);
    var i = Math.min(WOBBLE.length - 2, Math.floor(p)), f = p - i, k = (a || 0.02) / 0.02;
    return [1 + k * (WOBBLE[i][0] + (WOBBLE[i + 1][0] - WOBBLE[i][0]) * f),
            1 + k * (WOBBLE[i][1] + (WOBBLE[i + 1][1] - WOBBLE[i][1]) * f)];
  }

  /* ---- the lens ------------------------------------------------------- */
  // One glass drop under the pointer's link. It appears where you first
  // point, then travels to each link you move to on a spring (across the
  // pill, and down from Events or About into their dropdowns and back up),
  // stretching along the way and squashing a little as it settles, always
  // a pill (in the dropdowns too); it fades when the pointer
  // leaves the nav. The target is measured every frame while it travels,
  // because a dropdown is still sliding open when you reach it.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var lens = document.createElement("span");
    lens.className = "nav__lens";
    lens.setAttribute("aria-hidden", "true");
    nav.appendChild(lens);
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var x = 0, y = 0, w = 0, h = 0, vx = 0, vy = 0, vw = 0, vh = 0;
    var tx = 0, ty = 0, tw = 0, th = 0, on = false, raf = 0, last = 0, cta = false, el = null, popAt = -1, popAmp = 0.03;
    var draw = function (sx, sy) {
      // Over Apply the drop sits inside the button's border: it never runs
      // past its right edge (the spring overshoots a little as it settles)
      // and does not stretch sideways there.
      var dw = w;
      if (cta) dw = Math.min(w, tx + tw - x);
      lens.style.width = Math.max(0, dw).toFixed(1) + "px";
      lens.style.height = Math.max(0, h).toFixed(1) + "px";
      lens.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
    };
    // where the drop goes for a link, in the pill's own coordinates (from
    // inside its border, clientLeft/Top)
    var measure = function () {
      var a = el.getBoundingClientRect(), b = nav.getBoundingClientRect();
      // the link's own size, without a wobble it may be playing (the lens
      // plays the same wobble itself; measuring it in would scale it twice)
      var m = window.DOMMatrix ? new DOMMatrix(getComputedStyle(el).transform) : { a: 1, d: 1 };
      var sw = m.a || 1, shh = m.d || 1;
      tw = a.width / sw; th = a.height / shh;
      tx = a.left + a.width / 2 - tw / 2 - b.left - nav.clientLeft;
      ty = a.top + a.height / 2 - th / 2 - b.top - nav.clientTop;
      if (cta) {                                     // inside the blue border, not on it
        var bw = parseFloat(getComputedStyle(el).borderTopWidth) || 0;
        tx += bw; tw -= 2 * bw; ty += bw; th -= 2 * bw;
      }
    };
    var spring = function (to, at, v, dt) { return v + (420 * (to - at) - 30 * v) * dt; };
    var tick = function (now) {
      var dt = Math.min(1 / 30, Math.max(0, now - last) / 1000);
      last = now;
      measure();
      vx = spring(tx, x, vx, dt); vy = spring(ty, y, vy, dt); vw = spring(tw, w, vw, dt); vh = spring(th, h, vh, dt);
      x += vx * dt; y += vy * dt; w += vw * dt; h += vh * dt;
      // stretch along the way it is going, narrower across it
      var ax = Math.min(0.14, Math.abs(vx) / 3500), ay = Math.min(0.14, Math.abs(vy) / 2500);
      // the wobble as it first appears (103%); none over Apply, where it
      // does not stretch with speed either, so it stays inside the border.
      var popping = popAt >= 0 && now - popAt < WOBBLE_MS;
      var wb = popping ? wobbleAt(now - popAt, popAmp) : [1, 1];
      if (cta) draw(wb[0], wb[1]);
      else draw((1 + ax - ay * 0.8) * wb[0], (1 + ay - ax * 0.8) * wb[1]);
      var moving = [tx - x, ty - y, tw - w, th - h].some(function (d) { return Math.abs(d) > 0.3; }) ||
                   [vx, vy, vw, vh].some(function (v) { return Math.abs(v) > 2; });
      if (moving || popping) raf = requestAnimationFrame(tick);
      else { x = tx; y = ty; w = tw; h = th; vx = vy = vw = vh = 0; popAt = -1; draw(1, 1); raf = 0; }
    };
    var target = function (link) {
      el = link;
      cta = link.classList.contains("btn--nav");
      lens.classList.toggle("is-cta", cta);
      measure();
      if (!on || still) { x = tx; y = ty; w = tw; h = th; vx = vy = vw = vh = 0; draw(1, 1); }
      if (cta) popAt = -1;                                                   // Apply: no wobble at all
      else if (!on && !still) { popAt = performance.now(); popAmp = 0.03; }  // first link of a visit: 103%
      on = true;
      lens.classList.add("is-on");
      if (!still && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    Array.prototype.forEach.call(nav.querySelectorAll(".nav__menu > li > .nav__link, .nav__actions .nav__link, .nav__actions .btn--nav"), function (link) {
      link.addEventListener("pointerenter", function () { target(link); });
      link.addEventListener("focus", function () { target(link); });
    });
    // Dropdown items only when the mouse actually moves onto them: a
    // dropdown grows out from under the pointer as it opens, and its first
    // item passing beneath a still pointer must not pull the lens down.
    Array.prototype.forEach.call(nav.querySelectorAll(".nav__dropdown-menu a"), function (link) {
      link.addEventListener("pointermove", function (e) {
        if (!e.movementX && !e.movementY) return;          // synthetic: the page moved, not the mouse
        if (el !== link || !on) target(link);
      });
      link.addEventListener("focus", function () { target(link); });
    });
    nav.addEventListener("pointerleave", function () { on = false; lens.classList.remove("is-on"); });
    nav.addEventListener("focusout", function (e) { if (!nav.contains(e.relatedTarget)) { on = false; lens.classList.remove("is-on"); } });
  }

  /* ---- dropdowns grow out of their nav item ---------------------------- */
  // As Events or About opens, its panel starts as the button you pointed at
  // (its size and place) and grows down into the full menu, with a little
  // spring at the end; as it closes it shrinks back into the button while
  // it fades. Coming back mid-way picks up from wherever it is. Played on
  // the separate scale and translate properties, so it rides on the
  // panel's own centring and slide-in (transform). The panel is translated
  // left by half its width, so a transform-origin at its own 0 0 is its
  // top centre on screen.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    Array.prototype.forEach.call(document.querySelectorAll(".nav__dropdown"), function (dd) {
      var menu = dd.querySelector(".nav__dropdown-menu"), btn = dd.querySelector(".nav__link");
      if (!menu || !btn || !menu.animate) return;
      var open = false, run = null, fade = null;
      menu.style.transformOrigin = "0 0";
      // the panel squeezed into the button, as scale and translate values
      function asButton() {
        var li = dd.getBoundingClientRect(), b = btn.getBoundingClientRect();
        var top = li.top + (parseFloat(getComputedStyle(menu).top) || 0);
        var w = menu.offsetWidth, h = menu.offsetHeight;
        if (!w || !h) return null;
        return { scale: (b.width / w).toFixed(4) + " " + (b.height / h).toFixed(4), translate: "0 " + (b.top - top).toFixed(1) + "px" };
      }
      // where it is right now (mid-way through a grow or shrink, or at rest)
      function current() {
        var cs = getComputedStyle(menu);
        return { scale: cs.scale === "none" ? "1 1" : cs.scale, translate: cs.translate === "none" ? "0 0" : cs.translate };
      }
      var FULL = function () { return { scale: "1 1", translate: "0 0" }; };
      // The stylesheet also slides the panel 6px as it opens and closes; the
      // grow replaces that, so the panel is held at its resting centring.
      var HOLD = "translate(-50%, 0)";
      function play(from, to, ms, easing) {
        if (run) run.cancel();
        from.transform = to.transform = HOLD;
        run = menu.animate([from, to], { duration: ms, easing: easing, fill: "forwards" });
      }
      function opened() {
        if (open) return;
        open = true;
        if (fade) { fade.cancel(); fade = null; }
        var shrinking = run && run.playState !== "finished";   // caught mid-way
        var from = shrinking ? current() : asButton();
        if (from) play(from, FULL(), 380, "cubic-bezier(0.34, 1.25, 0.64, 1)");
      }
      function closed(e) {
        if (e.type === "focusout" && dd.contains(e.relatedTarget)) return;
        if (e.type === "pointerleave" && dd.contains(document.activeElement)) return;
        if (!open) return;
        open = false;
        var to = asButton();
        if (!to) return;
        play(current(), to, 260, "cubic-bezier(0.45, 0, 0.55, 1)");
        // The stylesheet's fade (ease-out) left it nearly see-through before
        // it had shrunk, so the close fades on its own: it stays solid
        // while it shrinks and goes at the end, visible until it is done.
        fade = menu.animate([
          { opacity: 1, visibility: "visible" },
          { opacity: 0.85, visibility: "visible", offset: 0.6 },
          { opacity: 0, visibility: "visible" }
        ], { duration: 260, easing: "ease-in" });
      }
      dd.addEventListener("pointerenter", opened);
      dd.addEventListener("focusin", opened);
      dd.addEventListener("pointerleave", closed);
      dd.addEventListener("focusout", closed);
    });
  }

  /* ---- bubbly CTAs ------------------------------------------------------ */
  // Every pill call to action (the hero's, the solid pills across the
  // pages; not Apply in the nav) gives the wobble when pointed at, and half of
  // it when left. Played from wobbleAt() itself, sampled finely, so it
  // matches the nav lens exactly when the lens wobbles with Apply.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var wobbleFrames = function (a) {
      var out = [];
      for (var i = 0; i <= 90; i++) {
        var k = wobbleAt(WOBBLE_MS * i / 90, a);
        out.push({ transform: "scale(" + k[0].toFixed(4) + "," + k[1].toFixed(4) + ")" });
      }
      return out;
    };
    var ENTER = wobbleFrames(CTA_WOBBLE), LEAVE = wobbleFrames(CTA_WOBBLE / 2);
    Array.prototype.forEach.call(document.querySelectorAll(".hero__cta, .btn--primary.btn--pill"), function (btn) {
      var run = null;
      function play(frames, ms) {
        if (!btn.animate) return;
        if (run) run.cancel();
        run = btn.animate(frames, { duration: ms });
      }
      btn.addEventListener("pointerenter", function () { play(ENTER, WOBBLE_MS); });
      btn.addEventListener("pointerleave", function () { play(LEAVE, WOBBLE_MS * 0.85); });
    });
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
