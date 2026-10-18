# Glass nav bar: design and motion reference

A spec plus drop-in code for the "liquid glass" navigation bar used on matchplaygroup.com (October 2026). It covers the pill-shaped bar, its dropdown panels and the phone menu panel: the tint, the rim lights, the drifting sheen, the darker tint over light sections, and, in Chromium browsers, a real refraction ("bend") at the edges built from SVG displacement maps.

For the hover bubble that slides between links, the dropdown grow/shrink and the CTA wobble, see the companion file `glass-motion.html` (same folder). Both can be used together.

Class names below are generic (`glass-nav`, `glass-panel`, `glass-on-light`). Rename freely.

---

## 1. Spec at a glance

| Property | Value |
|---|---|
| Tint (dark overlay) | `rgba(24, 24, 28, 0.69)`, so **69%** |
| Tint over light/white sections | **80%** (`0.8`), so white text stays readable |
| Tint change | `background-color 0.4s ease` |
| Backdrop | `blur(10px) saturate(1.7) brightness(1.05)` |
| Shape | pill: `border-radius: 999px`; panels: about `16-22px` |
| Rim light, top | `inset 0 1px 0 rgba(255,255,255,0.15)` |
| Rim light, bottom | `inset 0 -1px 0 rgba(255,255,255,0.06)` |
| Rim light, sides | `inset ±1px 0 0 rgba(255,255,255,0.07)` |
| Inner top glow | `inset 0 12px 22px -16px rgba(255,255,255,0.18)` |
| Outer shadow, pill | `0 10px 34px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.12)` |
| Outer shadow, panels | `0 18px 44px rgba(0,0,0,0.36)` |
| Sheen | 110° linear gradient, white 14% at 0%, clear 22% to 70%, white 6% at 86%, clear at 100%; `background-size: 220% 100%` |
| Sheen motion | `background-position-x = 50% + sin(scrollY / 420) × 45%`, so it drifts back and forth as the page scrolls |
| Bend (Chromium only) | displacement map per element size; pill `rim 28px, pull 24px, mag 0.04`; dropdown `rim 24, pull 18, mag 0.03`; phone panel `rim 26, pull 20, mag 0.02` |
| Bend softening | `feGaussianBlur stdDeviation 0.6` on the backdrop before displacing |
| Text on the glass | white at 92% opacity, pure white on hover; current page in the accent colour |

What it should feel like: a dark, slightly smoky glass that still shows colour from behind, with a bright hairline catching light along the top edge, the content behind it visibly *bending* in toward the middle near the rim (Chromium), and a faint reflection that slides as you scroll.

---

## 2. How it is built (and why)

1. **The glass lives on `::before`, not on the bar itself.** An element with `backdrop-filter` becomes a "backdrop root": its descendants' backdrop filters can then only see the bar, not the page. Dropdown panels are children of the bar and need to see the page, so the bar has no backdrop filter; its `::before` (behind the content, `z-index: -1`, with `isolation: isolate` on the bar) carries the tint, blur, bend and rim. `::after` carries the sheen.

2. **Cover the border.** If the bar has a border (even a transparent 1px one), the pseudo-elements must use `inset: -1px` (minus the border width), not `inset: 0`. Otherwise a 1px ring of the page shows between the glass and the outer shadow, which reads as a white border over light backgrounds.

3. **Tint switches over light sections.** A scroll listener (throttled to one check per frame) checks whether the bar's vertical middle is over any element marked as a light section, and toggles `glass-on-light` on `<body>`. CSS raises `--glass-tint` from 0.69 to 0.8 and the background-colour transition fades it.

4. **The bend (Chromium only).** For each glass element, JS draws a displacement map on a canvas at the element's exact pixel size and corner radius:
   - Red = horizontal offset, green = vertical offset, 128 = none.
   - Within `rim` px of the edge, the backdrop is sampled from further inward along the edge's normal, up to `pull` px at the very edge, easing in quadratically (`k = t²`, where `t` is 1 at the edge and 0 at the rim's inner limit). This makes the "lens edge" refraction.
   - `mag` adds a slight pull toward the centre everywhere (a gentle magnification).
   - The map becomes an SVG `<filter>`: `feImage` (the map), `feGaussianBlur` on `SourceGraphic` (0.6), then `feDisplacementMap` with scale `2 × (pull + mag × max(w, h)/2)`.
   - It is applied as `backdrop-filter: url(#id) saturate(1.7) brightness(1.05)` through a CSS variable (`--lg-filter`). A `ResizeObserver` rebuilds it when the element changes size; filters are cached by size.
   - Only Chromium supports SVG filters in `backdrop-filter`. Detect it with `navigator.userAgentData.brands` (a Chromium brand); everyone else keeps the plain `blur(10px) saturate(1.7) brightness(1.05)` via the variable's fallback.
   - Nested glass shapes must reset the variable (`--lg-filter: initial`) so they don't inherit the bar's map, which is sized to the bar.
   - Do not bend anything that sits on top of text (such as a hover highlight over link labels): the displacement blurs the text.

5. **Panels share the glass.** Dropdown panels and the phone menu panel use the same tint, backdrop and rim lights directly on themselves (they have no children needing to see the page), plus a stronger outer shadow to lift them off the page. The phone panel gets its own `--glass-tint` values because it is not inside the bar.

---

## 3. CSS

```css
/* ---- the bar --------------------------------------------------------- */
.glass-nav {
  position: relative;
  isolation: isolate;                 /* keeps the ::before/::after behind the content */
  border-radius: 999px;
  border: 1px solid transparent;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.12);
  --glass-tint: 0.69;
}
.glass-on-light .glass-nav { --glass-tint: 0.8; }

/* nested glass gets its own bend (or none), never the bar's */
.glass-nav .glass-panel,
.glass-nav .glass-lens { --lg-filter: initial; }

.glass-nav::before,
.glass-nav::after {
  content: "";
  position: absolute;
  inset: -1px;                        /* minus the border width: no ring of page showing */
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
}

/* the glass: on the bar's ::before, and directly on panels */
.glass-nav::before,
.glass-panel {
  background: rgba(24, 24, 28, var(--glass-tint, 0.69));
  -webkit-backdrop-filter: blur(10px) saturate(1.7) brightness(1.05);
          backdrop-filter: var(--lg-filter, blur(10px) saturate(1.7) brightness(1.05));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),     /* top rim catches the light */
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    inset 1px 0 0 rgba(255, 255, 255, 0.07),
    inset -1px 0 0 rgba(255, 255, 255, 0.07),
    inset 0 12px 22px -16px rgba(255, 255, 255, 0.18);
  transition: background-color 0.4s ease;
}

/* the sheen: a soft reflection that slides as the page scrolls (JS sets --sheen) */
.glass-nav::after {
  background: linear-gradient(110deg,
    rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0) 22%,
    rgba(255, 255, 255, 0) 70%, rgba(255, 255, 255, 0.06) 86%, rgba(255, 255, 255, 0) 100%);
  background-size: 220% 100%;
  background-position: var(--sheen, 40%) 0;
}

/* ---- panels (dropdowns, phone menu): same glass, lifted off the page --- */
.glass-panel {
  border: 0;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    inset 1px 0 0 rgba(255, 255, 255, 0.07),
    inset -1px 0 0 rgba(255, 255, 255, 0.07),
    inset 0 12px 22px -16px rgba(255, 255, 255, 0.18),
    0 18px 44px rgba(0, 0, 0, 0.36);
}
/* a panel outside the bar (e.g. the phone menu) needs its own tint values */
.glass-panel--detached { --glass-tint: 0.69; }
.glass-on-light .glass-panel--detached { --glass-tint: 0.8; }

/* ---- type on the glass -------------------------------------------------- */
.glass-nav a, .glass-panel a { color: rgba(255, 255, 255, 0.92); }
.glass-nav a:hover, .glass-panel a:hover { color: #fff; }
```

Markup assumed:

```html
<body>
  <header>
    <nav class="glass-nav">
      … links …
      <div class="dropdown"> <button>Events</button>
        <div class="glass-panel"> … </div>            <!-- a dropdown inside the bar -->
      </div>
    </nav>
    <div class="glass-panel glass-panel--detached"> … </div>   <!-- phone menu, outside the bar -->
  </header>
  <main>
    <section class="light-section"> … </section>      <!-- white sections: the tint deepens over these -->
  </main>
</body>
```

---

## 4. JS

```js
/* Glass nav: the bend (Chromium), the light-section tint switch, the sheen. */
(function () {
  "use strict";
  var nav = document.querySelector(".glass-nav");
  if (!nav) return;

  /* ---- the bend: SVG displacement maps, Chromium only ---------------- */
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
    document.body.appendChild(holder);
  }
  function svgEl(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* A displacement map for a w x h box with corner radius r. Red is the
     sideways pull, green the vertical, 128 none. Within `rim` px of the
     edge the backdrop is sampled from further in (up to `pull` px), most at
     the very edge; `mag` also samples toward the middle, which magnifies. */
  function bendMap(w, h, r, rim, pull, mag) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d"), img = g.createImageData(w, h), px = img.data;
    var hx = w / 2 - r, hy = h / 2 - r;
    var scale = 2 * (pull + mag * Math.max(w, h) / 2) || 1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ux = x + 0.5 - w / 2, uy = y + 0.5 - h / 2;
      // signed distance to a rounded rectangle, and the outward normal
      var qx = Math.abs(ux) - hx, qy = Math.abs(uy) - hy;
      var ox = Math.max(qx, 0), oy = Math.max(qy, 0), ol = Math.hypot(ox, oy);
      var depth = -(ol + Math.min(Math.max(qx, qy), 0) - r);           // px in from the edge
      var nx, ny;
      if (ol > 0) { nx = ox / ol * Math.sign(ux); ny = oy / ol * Math.sign(uy); }
      else if (qx > qy) { nx = Math.sign(ux); ny = 0; }
      else { nx = 0; ny = Math.sign(uy); }
      var t = depth < rim ? 1 - Math.max(0, depth) / rim : 0, k = t * t;  // strongest at the edge
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

  /* One SVG filter per size of shape, made once and reused. */
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

  /* Give an element bent glass at its current size, and again whenever its
     size changes. The CSS reads it through --lg-filter. */
  function bend(el, rim, pull, mag) {
    if (!BEND || !el) return;
    function fit() {
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      var r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      el.style.setProperty("--lg-filter", "url(#" + bendFilter(w, h, r, rim, pull, mag) + ") saturate(1.7) brightness(1.05)");
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(el);
  }
  bend(nav, 28, 24, 0.04);                                                  // the bar
  document.querySelectorAll(".glass-nav .glass-panel").forEach(function (p) { bend(p, 24, 18, 0.03); });  // dropdowns
  document.querySelectorAll(".glass-panel--detached").forEach(function (p) { bend(p, 26, 20, 0.02); });   // phone menu

  /* ---- tint over light sections, and the sheen ------------------------ */
  var lights = document.querySelectorAll(".light-section");
  var pending = 0;
  function onScroll() {
    pending = 0;
    var r = nav.getBoundingClientRect(), mid = (r.top + r.bottom) / 2;
    var light = Array.prototype.some.call(lights, function (s) {
      var q = s.getBoundingClientRect();
      return q.top < mid && q.bottom > mid;
    });
    document.body.classList.toggle("glass-on-light", light);
    nav.style.setProperty("--sheen", (50 + Math.sin(window.scrollY / 420) * 45).toFixed(1) + "%");
  }
  window.addEventListener("scroll", function () { if (!pending) pending = requestAnimationFrame(onScroll); }, { passive: true });
  onScroll();
})();
```

---

## 5. Tuning and gotchas

- **Stronger or weaker bend:** raise or lower `pull` (how far the edge samples inward, in px); `rim` is how deep from the edge the bend reaches. Keep `rim` at least as large as the corner radius region you want curved. `mag` above about 0.05 starts to look like a magnifier.
- **Tint:** `--glass-tint` is just the alpha of the dark overlay. Lower = clearer glass (needs strong text contrast behind); 0.69 dark / 0.8 over white worked for white UI text.
- **Never put `backdrop-filter` on the bar element itself** if anything inside it (dropdowns) also uses `backdrop-filter`: they would only see the bar. Use the `::before` layer.
- **Border ring:** with any border on the bar, the glass pseudo-element must extend over it (`inset: -<border-width>`).
- **No bend over text:** displacement softens anything under it. Hover highlights over labels should use the plain blur only.
- **Non-Chromium (Safari, Firefox):** they get the same glass without the bend, automatically, through the variable's fallback. Safari needs the `-webkit-backdrop-filter` line.
- **Performance:** maps are drawn once per size and cached; the ResizeObserver only redraws when a size actually changes. The scroll handler does one layout read per frame.
- **Reduced motion:** the sheen drift is subtle and scroll-driven; to be strict, skip the `--sheen` update under `prefers-reduced-motion: reduce`.
