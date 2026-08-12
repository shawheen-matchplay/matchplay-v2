/* ============================================================================
   MatchPlay hero splash
   ----------------------------------------------------------------------------
   Generates the dot field, the coloured link/ring shapes and the MatchPlay
   mark as SVG, then runs the intro timeline with CSS transitions. No libraries,
   no video file. Styling lives in css/styles.css (section 7).

   Timeline
     1. black dot grid fades in (random cells left empty)
     2. coloured links + rings draw themselves in around the field
     3. MatchPlay mark draws in at centre (ball -> links -> dimples)
     4. field dims, mark stays bright
     5. mark shifts up, "MatchPlay" wordmark fades in beneath it
     6. anything [data-reveal] cascades in (nav, headline, sub, CTA)
     ... then coloured shapes keep drawing in and out forever.

   Safety
     - prefers-reduced-motion: renders the finished state instantly, no motion.
     - JS disabled: nothing is ever hidden (gating is scoped to html.splash).
     - Click or keypress skips the intro; a 9s watchdog guarantees reveal.

   Geometry note
     The link shape is fitted to the brand asset, not approximated:
       ring radius R = 0.50 x grid step, corner radius = 0.50 x R,
       stroke width = 0.10 x grid step. Changing these breaks the match.
   ========================================================================== */
(function () {
  "use strict";

  var svg = document.getElementById("splash-svg");
  var hero = document.getElementById("hero");
  if (!svg || !hero) return;

  var NS = "http://www.w3.org/2000/svg";
  var SPLASH = document.documentElement.classList.contains("splash");

  /* ---- tunables ---- */
  // MatchPlay accent palette (matches the brand tokens in styles.css)
  var COLORS = ["#1ED2F4", "#F97D4A", "#D25AFF", "#79E8C9", "#BED015", "#807DE5", "#63D6B6"];
  var MARGIN = 0.18;      /* off-screen bleed on every side (resize safety) */
  var DOT_SKIP = 0.14;    /* fraction of grid cells left empty */
  var MAX_AMBIENT = 32;   /* concurrent coloured shapes */
  var LINK_RATIO = 0.62;  /* chance a new shape is a link vs a ring */
  var WORDMARK = "MatchPlay";

  /* Dimple wedge of the golf ball, as fractions of the ball radius. */
  var DIMPLES = [
    [0.77, -0.32],
    [0.43, 0.03], [0.77, 0.03],
    [0.08, 0.37], [0.43, 0.37], [0.77, 0.37],
    [-0.26, 0.72], [0.08, 0.71], [0.43, 0.71]
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------- geometry ------------------------------------------------------
     The MatchPlay link: two 270-degree arcs joined by tangent lines with
     quarter-circle corners. c2 sits diagonally from c1 (|dx| === |dy|); the
     figure is rotated into place from a canonical down-right frame.
     ------------------------------------------------------------------------ */
  function linkPath(c1, c2, R) {
    var D = Math.abs(c2[0] - c1[0]);
    var rho = R * 0.5;                                     /* corner radius */
    var rot = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]) - Math.PI / 4;
    var cos = Math.cos(rot), sin = Math.sin(rot);
    function tp(p) {
      return (c1[0] + p[0] * cos - p[1] * sin).toFixed(2) + " " +
             (c1[1] + p[0] * sin + p[1] * cos).toFixed(2);
    }
    function A(r, la, sw, p) {
      return "A " + r.toFixed(2) + " " + r.toFixed(2) + " 0 " + la + " " + sw + " " + tp(p) + " ";
    }
    return "M " + tp([R, 0]) + " "
      + A(R, 1, 0, [0, R])                  /* circle 1 */
      + "L " + tp([D - R - rho, R]) + " "
      + A(rho, 0, 1, [D - R, R + rho])      /* corner */
      + "L " + tp([D - R, D]) + " "
      + A(R, 1, 0, [D, D - R])              /* circle 2 */
      + "L " + tp([R + rho, D - R]) + " "
      + A(rho, 0, 1, [R, D - R - rho])      /* corner */
      + "L " + tp([R, 0]) + " Z";
  }

  /* A full circle as a path, so it can be dash-drawn like the links. */
  function ringPath(c, r) {
    return "M " + (c[0] + r).toFixed(2) + " " + c[1].toFixed(2) +
      " A " + r + " " + r + " 0 1 0 " + (c[0] - r).toFixed(2) + " " + c[1].toFixed(2) +
      " A " + r + " " + r + " 0 1 0 " + (c[0] + r).toFixed(2) + " " + c[1].toFixed(2) + " Z";
  }

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---- state ---- */
  var W, H, TW, TH, OX, OY, S, R;
  var cols, rows, x0, y0;
  var gridG, linksG, logoG, wordEl, logoPaths, ballEl, dimpleG;
  var usedCells, excluded, dotCells, population = [];
  var logoShift = 0, splashDone = false, ambientTimer = null;

  function cellXY(c, r) { return [x0 + c * S, y0 + r * S]; }
  function key(c, r) { return c + "," + r; }

  /* ---- line drawing via stroke-dash ---- */
  function preparePath(p) {
    var L = p.getTotalLength();
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = L;
    return L;
  }
  function drawPath(p, dur) {
    p.getBoundingClientRect();                    /* flush before transition */
    p.style.transition = "stroke-dashoffset " + dur + "ms cubic-bezier(.45,0,.25,1)";
    p.style.strokeDashoffset = 0;
    /* drop the dash once drawn so no seam artifact remains at the join */
    setTimeout(function () {
      if (parseFloat(p.style.strokeDashoffset) === 0) p.style.strokeDasharray = "none";
    }, dur + 80);
  }
  function undrawPath(p, dur) {
    var L = p.getTotalLength();
    p.style.transition = "none";
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = 0;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset " + dur + "ms cubic-bezier(.6,0,.8,1)";
    p.style.strokeDashoffset = L;
  }

  /* ---------- ambient shapes ------------------------------------------------
     Cell bookkeeping guarantees a shape only wraps cells that actually have a
     dot, and that shapes reserve their orthogonal neighbours so they never
     touch, cross or chain into each other.
     ------------------------------------------------------------------------ */
  function claimSpot(kind) {
    for (var i = 0; i < 70; i++) {
      var c = 1 + Math.floor(Math.random() * (cols - 3));
      var r = 1 + Math.floor(Math.random() * (rows - 3));
      var cells;

      if (kind === "link") {
        var dir = Math.random() < 0.5 ? 1 : -1;      /* down-right or up-right */
        if (!dotCells.has(key(c, r)) || !dotCells.has(key(c + 1, r + dir))) continue;
        cells = [];
        [[c, r], [c + 1, r + dir]].forEach(function (pair) {
          var a = pair[0], b = pair[1];
          cells.push(key(a, b), key(a + 1, b), key(a - 1, b), key(a, b + 1), key(a, b - 1));
        });
        cells = cells.filter(function (v, j, self) { return self.indexOf(v) === j; });
        if (cells.some(function (k2) { return usedCells.has(k2) || excluded.has(k2); })) continue;
        cells.forEach(function (k2) { usedCells.add(k2); });
        return { c: c, r: r, dir: dir, cells: cells };
      }

      if (!dotCells.has(key(c, r))) continue;
      cells = [key(c, r), key(c + 1, r), key(c - 1, r), key(c, r + 1), key(c, r - 1)];
      if (cells.some(function (k2) { return usedCells.has(k2) || excluded.has(k2); })) continue;
      cells.forEach(function (k2) { usedCells.add(k2); });
      return { c: c, r: r, cells: cells };
    }
    return null;                                        /* field is full */
  }

  function makeShape(kind, spot, color) {
    var d = kind === "link"
      ? linkPath(cellXY(spot.c, spot.r), cellXY(spot.c + 1, spot.r + spot.dir), R)
      : ringPath(cellXY(spot.c, spot.r), R);
    return el("path", {
      d: d, fill: "none", stroke: color,
      "stroke-width": S * 0.1, "stroke-linecap": "round"
    }, linksG);
  }

  function spawnAmbient(opts) {
    opts = opts || {};
    var kind = opts.kind || (Math.random() < LINK_RATIO ? "link" : "ring");
    var spot = claimSpot(kind);
    if (!spot) return null;
    var p = makeShape(kind, spot, pick(COLORS));
    var item = { p: p, spot: spot, dead: false };
    population.push(item);
    if (!opts.instant) {
      preparePath(p);
      drawPath(p, opts.drawDur || rand(750, 1100));
    }
    item.timer = setTimeout(function () { retireAmbient(item); }, opts.life || rand(3800, 8200));
    return item;
  }

  function retireAmbient(item) {
    if (item.dead) return;
    item.dead = true;
    clearTimeout(item.timer);
    var dur = 700;
    undrawPath(item.p, dur);
    setTimeout(function () {
      item.p.remove();
      item.spot.cells.forEach(function (k2) { usedCells.delete(k2); });
      var i = population.indexOf(item);
      if (i > -1) population.splice(i, 1);
    }, dur + 60);
  }

  function startAmbient() {
    if (ambientTimer || !SPLASH) return;                /* respect reduced motion */
    ambientTimer = setInterval(function () {
      if (document.hidden) return;                      /* don't churn in a background tab */
      var alive = population.filter(function (i) { return !i.dead; }).length;
      if (alive < MAX_AMBIENT) spawnAmbient();
      if (alive < MAX_AMBIENT - 3) spawnAmbient();
      if (alive < MAX_AMBIENT - 8) spawnAmbient();
    }, 550);
  }

  /* ---------- build the scene ---------------------------------------------- */
  function build(instant) {
    svg.innerHTML = "";
    population = [];
    usedCells = new Set();
    excluded = new Set();

    /* viewBox is the hero plus MARGIN bleed on all four sides */
    W = hero.clientWidth; H = Math.max(hero.clientHeight, 560);
    OX = W * MARGIN; OY = H * MARGIN;
    TW = W * (1 + 2 * MARGIN); TH = H * (1 + 2 * MARGIN);
    svg.setAttribute("viewBox", "0 0 " + TW + " " + TH);

    S = Math.max(48, Math.min(78, W / 19));             /* grid step */
    R = S * 0.5;                                        /* ring radius */
    cols = Math.ceil(TW / S) + 2;
    rows = Math.ceil(TH / S) + 2;
    x0 = (TW - (cols - 1) * S) / 2;
    y0 = (TH - (rows - 1) * S) / 2;

    gridG = el("g", { id: "splash-grid" }, svg);
    linksG = el("g", { id: "splash-links" }, svg);
    logoG = el("g", { id: "splash-logo" }, svg);

    /* logo placement is resolved first, so its cells are guaranteed dots */
    var logoY0 = OY + H * 0.46;                         /* start: optical centre */
    var logoY1 = OY + Math.max(H * 0.26, 150);          /* end: after the shift */
    var midC = Math.round((OX + W / 2 - x0) / S);
    var rowTop = Math.round((logoY0 - y0) / S - 0.5);
    var rowBot = rowTop + 1;
    logoShift = (y0 + (rowTop + 0.5) * S) - logoY1;     /* grid-snapped travel */

    var forced = new Set([
      key(midC - 2, rowBot),                            /* ball */
      key(midC - 1, rowTop), key(midC, rowBot),         /* link 1 */
      key(midC + 1, rowTop), key(midC + 2, rowBot)      /* link 2 */
    ]);

    /* dot field: uniform black dots, random cells left empty */
    dotCells = new Set();
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        if (Math.random() < DOT_SKIP && !forced.has(key(c, r))) continue;
        dotCells.add(key(c, r));
        var xy = cellXY(c, r);
        var dot = el("circle", { cx: xy[0], cy: xy[1], r: S * 0.43, fill: "#0B0B0B" }, gridG);
        if (!instant) {
          dot.style.opacity = 0;
          dot.style.transform = "scale(.45)";
          dot.style.transitionDelay = Math.floor(rand(0, 750)) + "ms";
        }
      }
    }

    /* keep ambient shapes clear of the logo, before AND after it shifts up */
    var rowsUp = Math.ceil(logoShift / S) + 1;
    for (var c2 = midC - 4; c2 <= midC + 4; c2++) {
      for (var r2 = rowTop - rowsUp; r2 <= rowBot + 2; r2++) excluded.add(key(c2, r2));
    }

    /* ---- the mark ---- */
    var lw = S * 0.1;
    var ballC = cellXY(midC - 2, rowBot);
    var ballR = R * 1.10;

    ballEl = el("circle", {
      id: "splash-ball", cx: ballC[0], cy: ballC[1], r: ballR, fill: "#fff"
    }, logoG);

    dimpleG = el("g", { id: "splash-dimples" }, logoG);
    DIMPLES.forEach(function (f) {
      el("circle", {
        cx: ballC[0] + ballR * f[0],
        cy: ballC[1] + ballR * f[1],
        r: ballR * 0.118, fill: "#0B0B0B"
      }, dimpleG);
    });

    logoPaths = [
      el("path", {
        d: linkPath(cellXY(midC - 1, rowTop), cellXY(midC, rowBot), R),
        fill: "none", stroke: "#fff", "stroke-width": lw, "stroke-linecap": "round"
      }, logoG),
      el("path", {
        d: linkPath(cellXY(midC + 1, rowTop), cellXY(midC + 2, rowBot), R),
        fill: "none", stroke: "#fff", "stroke-width": lw, "stroke-linecap": "round"
      }, logoG)
    ];

    /* wordmark sits at its FINAL position; the mark travels up to meet it */
    wordEl = el("text", {
      id: "splash-word",
      x: OX + W / 2, y: logoY1 + S * 1.9,
      "text-anchor": "middle", fill: "#fff",
      "font-family": '"BW Gradual", sans-serif', "font-weight": 400,
      "font-size": Math.min(46, S * 0.7), "letter-spacing": "-0.02em"
    }, svg);
    wordEl.textContent = WORDMARK;

    if (instant) {                                      /* resting state, no intro */
      logoG.style.transition = "none";
      logoG.style.transform = "translateY(" + (-logoShift) + "px)";
      wordEl.style.transition = "none";
      wordEl.classList.add("shown");
      hero.classList.add("is-dim");
      for (var i = 0; i < 24; i++) {
        spawnAmbient({ instant: true, life: SPLASH ? rand(2000, 9000) : 86400000 });
      }
    }
  }

  /* ---------- reveal everything (end of intro, skip, or watchdog) ---------- */
  function finish() {
    if (splashDone) return;
    splashDone = true;
    document.querySelectorAll("[data-reveal]").forEach(function (e) { e.classList.add("shown"); });
    if (wordEl) wordEl.classList.add("shown");
    hero.classList.add("is-dim");
    if (logoG) logoG.style.transform = "translateY(" + (-logoShift) + "px)";
    if (logoPaths) logoPaths.forEach(function (p) {     /* finish a skipped draw */
      p.style.transition = "stroke-dashoffset .5s ease";
      p.style.strokeDashoffset = 0;
    });
    if (ballEl) { ballEl.style.opacity = 1; ballEl.style.transform = "scale(1)"; }
    if (dimpleG) dimpleG.querySelectorAll("circle").forEach(function (d) { d.style.opacity = 1; });
    startAmbient();
  }

  /* ---------- run ----------------------------------------------------------- */
  if (!SPLASH) {
    build(true);                                        /* reduced motion: done */
    splashDone = true;
  } else {
    build(false);
    var t = function (ms, fn) { return setTimeout(fn, ms); };
    var show = function (sel) {
      var n = document.querySelector(sel);
      if (n) n.classList.add("shown");
    };

    /* mark starts hidden, revealed in step 3 */
    ballEl.style.opacity = 0;
    ballEl.style.transform = "scale(0)";
    dimpleG.querySelectorAll("circle").forEach(function (d) { d.style.opacity = 0; });
    logoPaths.forEach(preparePath);

    /* STEP 1 — dots appear (staggered by the per-dot transitionDelay) */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        gridG.querySelectorAll("circle").forEach(function (d) {
          d.style.opacity = 1;
          d.style.transform = "scale(1)";
        });
      });
    });

    /* STEP 2 — links and rings draw in */
    t(600, function () {
      var i = 0;
      (function spawnNext() {
        if (splashDone || i++ >= 30) return;
        spawnAmbient({ drawDur: rand(600, 850), life: rand(3000, 9000) });
        setTimeout(spawnNext, 65);
      })();
    });
    t(2400, startAmbient);                              /* hand off to the loop */

    /* STEP 3 — the mark draws in at centre */
    t(1500, function () {
      ballEl.getBoundingClientRect();
      ballEl.style.opacity = 1;
      ballEl.style.transform = "scale(1)";
      t(280, function () { drawPath(logoPaths[0], 700); });
      t(620, function () { drawPath(logoPaths[1], 700); });
      t(1000, function () {
        dimpleG.querySelectorAll("circle").forEach(function (d, j) {
          d.style.transitionDelay = (j * 35) + "ms";
          d.style.opacity = 1;
        });
      });
    });

    /* STEP 4 — everything dims except the mark */
    t(3100, function () { hero.classList.add("is-dim"); });

    /* STEP 5 — mark shifts up, wordmark fades in beneath it */
    t(3450, function () {
      logoG.style.transform = "translateY(" + (-logoShift) + "px)";
      t(350, function () { wordEl.classList.add("shown"); });
    });

    /* STEP 6 — page content cascades in */
    t(4000, function () { show(".hero__title"); });
    t(4150, function () { show(".hero__sub"); });
    t(4300, function () { show(".hero__ctas"); });
    t(4450, function () { show(".site-header"); });
    t(5100, finish);

    setTimeout(finish, 9000);                                       /* watchdog */
    window.addEventListener("pointerdown", finish, { once: true }); /* skip */
    window.addEventListener("keydown", finish, { once: true });
  }

  /* Rebuild on resize, final state only. The 18% bleed plus slice scaling
     keeps the field full while the drag is in progress. */
  var rT;
  window.addEventListener("resize", function () {
    if (!splashDone) return;
    clearTimeout(rT);
    rT = setTimeout(function () {
      clearInterval(ambientTimer); ambientTimer = null;
      population.forEach(function (i) { clearTimeout(i.timer); });
      build(true);
      startAmbient();
    }, 250);
  });
})();
