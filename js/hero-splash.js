/* ============================================================
   MatchPlay splash intro
   SVG/CSS/JS recreation of MP_0000_SplashAnimation_Final.mp4,
   using the official link + logo mark geometry.

   Animation only: the black dot grid, the colored links and rings,
   and the MatchPlay mark. No headline, subhead, CTAs or wordmark.

   SCALE
     One knob controls the size of the whole system: the SCALE constant
     below. Grid step, ring radius, stroke weights, ball and dimples all
     derive from it, so changing that one number rescales everything
     together and keeps the brand proportions intact.

   LOAD SEQUENCE
     1. black dot grid fades in (random cells left empty)
     2. colored links + rings draw themselves in around the field
     3. MatchPlay mark draws in at center (ball -> links -> dimples)
     4. field dims, mark stays bright
     5. mark shifts up into its resting position
     ... then colored shapes keep drawing in and out forever.

   RE-ADDING PAGE CONTENT LATER
     Give any element  data-reveal  and it stays hidden until the intro
     finishes, then fades in. Add show() calls in STEP 6 to control order.

   ACCESSIBILITY / SAFETY
     - prefers-reduced-motion: renders the finished state instantly.
     - JS disabled: nothing is ever hidden.
     - Click or keypress skips the intro; a 9s watchdog guarantees completion.

   GEOMETRY NOTE
     The link shape is not an approximation. It was fitted against the brand
     asset (Vector_6.png) by skeletonizing the reference and grid-searching
     parameters to 91% pixel IoU:
       ring radius   R   = 0.50 x grid step
       corner radius rho = 0.50 x R
       stroke width      = 0.10 x grid step
     These are ratios, so they hold at any SCALE.
   ============================================================ */
(function () {
  const svg  = document.getElementById('splash-svg');
  const hero = document.getElementById('hero');
  if (!svg || !hero) return;

  const NS = 'http://www.w3.org/2000/svg';
  const SPLASH = document.documentElement.classList.contains('splash');

  /* ---- tunables ---------------------------------------------------------
     SCALE is the master size control. 1 = original, 0.75 = three quarters.
     Everything below derives from the grid step, which SCALE multiplies,
     so the grid, links, rings and mark all resize together. */
  const SCALE = 0.75;

  const COLORS = ['#2BD9C0', '#FF7A45', '#E94F8A', '#C6F25E', '#B558F6', '#35C5F0', '#E9B949'];
  const MARGIN = 0.18;        /* off-screen bleed on every side (resize safety) */
  const DOT_SKIP = 0.26;      /* fraction of grid cells left empty */
  const DOT_RADIUS = 0.5;     /* dot radius as a fraction of the grid step.
                                 0.5 = neighbouring dots exactly touch */
  const LINK_RATIO = 0.62;    /* chance a new shape is a link vs a ring */

  /* Concurrent colored shapes. Scaled by area so a smaller grid (which fits
     more cells on screen) keeps a similar visual density. */
  const MAX_AMBIENT = Math.round(32 / (SCALE * SCALE));

  /* dimple wedge of the golf ball: exact positions measured from the brand
     mark, as fractions of the ball radius */
  const DIMPLES = [
    [ 0.77, -0.32],
    [ 0.43,  0.03], [0.77, 0.03],
    [ 0.08,  0.37], [0.43, 0.37], [0.77, 0.37],
    [-0.26,  0.72], [0.08, 0.71], [0.43, 0.71]
  ];

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- geometry ----------------------------------------------------
     The MatchPlay link: two 270-degree arcs joined by tangent lines with
     quarter-circle corners. c2 must sit diagonally from c1 (|dx| === |dy|);
     the whole figure is rotated into place from a canonical down-right frame.
     ---------------------------------------------------------------------- */
  function linkPath(c1, c2, R) {
    const D = Math.abs(c2[0] - c1[0]);
    const rho = R * 0.5;                                  /* corner radius */
    const rot = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]) - Math.PI / 4;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const tp = p => (c1[0] + p[0] * cos - p[1] * sin).toFixed(2) + ' ' +
                    (c1[1] + p[0] * sin + p[1] * cos).toFixed(2);
    const A = (r, la, sw, p) =>
      'A ' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + la + ' ' + sw + ' ' + tp(p) + ' ';
    return 'M ' + tp([R, 0]) + ' '
      + A(R, 1, 0, [0, R])                 /* circle 1: right -> top -> left -> bottom */
      + 'L ' + tp([D - R - rho, R]) + ' '
      + A(rho, 0, 1, [D - R, R + rho])     /* corner */
      + 'L ' + tp([D - R, D]) + ' '
      + A(R, 1, 0, [D, D - R])             /* circle 2: left -> bottom -> right -> top */
      + 'L ' + tp([R + rho, D - R]) + ' '
      + A(rho, 0, 1, [R, D - R - rho])     /* corner */
      + 'L ' + tp([R, 0]) + ' Z';
  }

  /* a full circle as a path, so it can be dash-drawn like the links */
  function ringPath(c, r) {
    return 'M ' + (c[0] + r).toFixed(2) + ' ' + c[1].toFixed(2) +
      ' A ' + r + ' ' + r + ' 0 1 0 ' + (c[0] - r).toFixed(2) + ' ' + c[1].toFixed(2) +
      ' A ' + r + ' ' + r + ' 0 1 0 ' + (c[0] + r).toFixed(2) + ' ' + c[1].toFixed(2) + ' Z';
  }

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---- state ---- */
  let W, H, TW, TH, OX, OY, S, R;
  let cols, rows, x0, y0, rowTop;
  let gridG, linksG, logoG, logoPaths, ballEl, dimpleG;
  let usedCells, excluded, dotCells, population = [];
  let logoShift = 0, splashDone = false, ambientTimer = null;

  const cellXY = (c, r) => [x0 + c * S, y0 + r * S];
  const key = (c, r) => c + ',' + r;

  /* ---- line-drawing via stroke-dash ---- */
  function preparePath(p) {
    const L = p.getTotalLength();
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = L;
    return L;
  }
  function drawPath(p, dur) {
    p.getBoundingClientRect();                    /* flush before transition */
    p.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.45,0,.25,1)';
    p.style.strokeDashoffset = 0;
    /* drop the dash once drawn so no seam artifact remains at the join */
    setTimeout(() => {
      if (parseFloat(p.style.strokeDashoffset) === 0) p.style.strokeDasharray = 'none';
    }, dur + 80);
  }
  function undrawPath(p, dur) {
    const L = p.getTotalLength();
    p.style.transition = 'none';
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = 0;
    p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.6,0,.8,1)';
    p.style.strokeDashoffset = L;
  }

  /* ---------- ambient shapes ----------------------------------------------
     Cell bookkeeping guarantees two things the design depends on:
       - a shape only ever wraps cells that actually have a dot
       - shapes reserve their orthogonal neighbours, so they never touch,
         cross, or chain into each other
     ---------------------------------------------------------------------- */
  function claimSpot(kind) {
    for (let i = 0; i < 70; i++) {
      const c = 1 + Math.floor(Math.random() * (cols - 3));
      const r = 1 + Math.floor(Math.random() * (rows - 3));
      let cells;

      if (kind === 'link') {
        const dir = Math.random() < 0.5 ? 1 : -1;         /* down-right or up-right */
        if (!dotCells.has(key(c, r)) || !dotCells.has(key(c + 1, r + dir))) continue;
        cells = [];
        [[c, r], [c + 1, r + dir]].forEach(([a, b]) => {
          cells.push(key(a, b), key(a + 1, b), key(a - 1, b), key(a, b + 1), key(a, b - 1));
        });
        cells = [...new Set(cells)];
        if (cells.some(k2 => usedCells.has(k2) || excluded.has(k2))) continue;
        cells.forEach(k2 => usedCells.add(k2));
        return { c, r, dir, cells };
      }

      if (!dotCells.has(key(c, r))) continue;
      cells = [key(c, r), key(c + 1, r), key(c - 1, r), key(c, r + 1), key(c, r - 1)];
      if (cells.some(k2 => usedCells.has(k2) || excluded.has(k2))) continue;
      cells.forEach(k2 => usedCells.add(k2));
      return { c, r, cells };
    }
    return null;                                          /* field is full */
  }

  function makeShape(kind, spot, color) {
    const d = kind === 'link'
      ? linkPath(cellXY(spot.c, spot.r), cellXY(spot.c + 1, spot.r + spot.dir), R)
      : ringPath(cellXY(spot.c, spot.r), R);
    return el('path', {
      d, fill: 'none', stroke: color,
      'stroke-width': S * 0.1, 'stroke-linecap': 'round'
    }, linksG);
  }

  function spawnAmbient(opts) {
    opts = opts || {};
    const kind = opts.kind || (Math.random() < LINK_RATIO ? 'link' : 'ring');
    const spot = claimSpot(kind);
    if (!spot) return null;
    const p = makeShape(kind, spot, pick(COLORS));
    const item = { p, spot, dead: false };
    population.push(item);
    if (!opts.instant) {
      preparePath(p);
      drawPath(p, opts.drawDur || rand(750, 1100));
    }
    item.timer = setTimeout(() => retireAmbient(item), opts.life || rand(3800, 8200));
    return item;
  }

  function retireAmbient(item) {
    if (item.dead) return;
    item.dead = true;
    clearTimeout(item.timer);
    const dur = 700;
    undrawPath(item.p, dur);
    setTimeout(() => {
      item.p.remove();
      item.spot.cells.forEach(k2 => usedCells.delete(k2));
      const i = population.indexOf(item);
      if (i > -1) population.splice(i, 1);
    }, dur + 60);
  }

  function startAmbient() {
    if (ambientTimer || !SPLASH) return;                  /* respect reduced motion */
    ambientTimer = setInterval(() => {
      if (document.hidden) return;                        /* don't churn in a background tab */
      const alive = population.filter(i => !i.dead).length;
      if (alive < MAX_AMBIENT) spawnAmbient();
      if (alive < MAX_AMBIENT - 3) spawnAmbient();
      if (alive < MAX_AMBIENT - 8) spawnAmbient();
    }, 550);
  }

  /* ---------- align the mark to the slot CSS reserved for it ---------------
     The viewBox is the hero scaled by (1 + 2*MARGIN) on both axes, so aspect
     is preserved and one viewBox unit === one px, with viewBox y = 0 sitting
     OY above the hero's top edge. That lets the reserved spacer's position be
     read straight off the layout and the mark translated onto it, so CSS owns
     the centring and the animation follows it. */
  function resolveShift() {
    const spacer = document.querySelector('.hero__mark-space');
    /* The shift targets the mark's midpoint — it sits centred between rowTop
       and rowBot — so aim at the middle of the reserved slot, not its top. */
    let centre;                                     /* hero-relative y */
    if (spacer) {
      const r = spacer.getBoundingClientRect();
      centre = (r.top - hero.getBoundingClientRect().top) + r.height / 2;
    } else {
      centre = Math.max(H * 0.26, 150 * SCALE);     /* fallback: fixed position */
    }
    logoShift = (y0 + (rowTop + 0.5) * S) - (OY + centre);
  }

  /* Re-resolve against the settled layout and move the mark if it has already
     travelled. Needed because webfonts (and the reveal) change the text height
     after build(), which shifts where the slot lands. */
  function realignMark() {
    if (!logoG || rowTop === undefined) return;
    resolveShift();
    if (splashDone || logoG.style.transform) {
      logoG.style.transform = 'translateY(' + (-logoShift) + 'px)';
    }
  }

  /* ---------- build the scene --------------------------------------------- */
  function build(instant) {
    svg.innerHTML = '';
    population = [];
    usedCells = new Set();
    excluded = new Set();

    /* viewBox is the hero plus MARGIN bleed on all four sides. H tracks the
       viewport (matching the CSS 136vh) rather than the hero's own height, so
       copy reflow can never desync the viewBox from the element box. */
    W = hero.clientWidth; H = Math.max(window.innerHeight, 560);
    OX = W * MARGIN; OY = H * MARGIN;
    TW = W * (1 + 2 * MARGIN); TH = H * (1 + 2 * MARGIN);
    svg.setAttribute('viewBox', '0 0 ' + TW + ' ' + TH);

    S = Math.max(48, Math.min(78, W / 19)) * SCALE;       /* grid step */
    R = S * 0.5;                                          /* ring radius */
    cols = Math.ceil(TW / S) + 2;
    rows = Math.ceil(TH / S) + 2;
    x0 = (TW - (cols - 1) * S) / 2;
    y0 = (TH - (rows - 1) * S) / 2;

    gridG  = el('g', { id: 'splash-grid' }, svg);
    linksG = el('g', { id: 'splash-links' }, svg);
    logoG  = el('g', { id: 'splash-logo' }, svg);

    /* Publish the nav height and the mark's own height so CSS can reserve the
       mark's slot and centre the whole group in the area below the nav.
       offsetHeight is used because the header carries a reveal transform. */
    const header = document.querySelector('.site-header');
    hero.style.setProperty('--nav-h',
      ((header ? header.offsetTop + header.offsetHeight : 0)) + 'px');
    /* The mark spans its row plus the next, and the ball radius is R * 1.10
       (= S * 0.55), so its full height is S * 2.1. */
    hero.style.setProperty('--mark-h', (S * 2.1) + 'px');

    /* logo placement is resolved first, so its cells are guaranteed dots */
    const logoY0 = OY + H * 0.46;                         /* start: optical center */
    const midC   = Math.round((OX + W / 2 - x0) / S);
    rowTop = Math.round((logoY0 - y0) / S - 0.5);
    const rowBot = rowTop + 1;
    resolveShift();                                       /* sets logoShift */

    const forced = new Set([
      key(midC - 2, rowBot),                              /* ball */
      key(midC - 1, rowTop), key(midC, rowBot),           /* link 1 */
      key(midC + 1, rowTop), key(midC + 2, rowBot)        /* link 2 */
    ]);

    /* dot field: uniform black dots, random cells left empty */
    dotCells = new Set();
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() < DOT_SKIP && !forced.has(key(c, r))) continue;
        dotCells.add(key(c, r));
        const [x, y] = cellXY(c, r);
        const dot = el('circle', { cx: x, cy: y, r: S * DOT_RADIUS, fill: '#0B0B0B' }, gridG);
        if (!instant) {
          dot.style.opacity = 0;
          dot.style.transform = 'scale(.45)';
          dot.style.transitionDelay = Math.floor(rand(0, 750)) + 'ms';
        }
      }
    }

    /* keep ambient shapes clear of the logo, before AND after it shifts up */
    const rowsUp = Math.ceil(logoShift / S) + 1;
    for (let c = midC - 4; c <= midC + 4; c++)
      for (let r = rowTop - rowsUp; r <= rowBot + 2; r++)
        excluded.add(key(c, r));

    /* ---- the mark ---- */
    const lw = S * 0.1;
    const ballC = cellXY(midC - 2, rowBot);
    const ballR = R * 1.10;

    ballEl = el('circle', {
      id: 'splash-ball', cx: ballC[0], cy: ballC[1], r: ballR, fill: '#fff'
    }, logoG);

    dimpleG = el('g', { id: 'splash-dimples' }, logoG);
    DIMPLES.forEach(([fx, fy]) => {
      el('circle', {
        cx: ballC[0] + ballR * fx,
        cy: ballC[1] + ballR * fy,
        r: ballR * 0.118, fill: '#0B0B0B'
      }, dimpleG);
    });

    logoPaths = [
      el('path', {
        d: linkPath(cellXY(midC - 1, rowTop), cellXY(midC, rowBot), R),
        fill: 'none', stroke: '#fff', 'stroke-width': lw, 'stroke-linecap': 'round'
      }, logoG),
      el('path', {
        d: linkPath(cellXY(midC + 1, rowTop), cellXY(midC + 2, rowBot), R),
        fill: 'none', stroke: '#fff', 'stroke-width': lw, 'stroke-linecap': 'round'
      }, logoG)
    ];

    if (instant) {                                        /* resting state, no intro */
      logoG.style.transition = 'none';
      logoG.style.transform = 'translateY(' + (-logoShift) + 'px)';
      hero.classList.add('is-dim');
      for (let i = 0; i < Math.round(24 / (SCALE * SCALE)); i++) {
        spawnAmbient({ instant: true, life: SPLASH ? rand(2000, 9000) : 86400000 });
      }
    }
  }

  /* ---------- reveal everything (end of intro, skip, or watchdog) --------- */
  function finish() {
    if (splashDone) return;
    splashDone = true;
    document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('shown'));
    hero.classList.add('is-dim');
    if (logoG) {
      resolveShift();                                     /* against the settled layout */
      logoG.style.transform = 'translateY(' + (-logoShift) + 'px)';
    }
    if (logoPaths) logoPaths.forEach(p => {               /* finish a skipped draw */
      p.style.transition = 'stroke-dashoffset .5s ease';
      p.style.strokeDashoffset = 0;
    });
    if (ballEl) { ballEl.style.opacity = 1; ballEl.style.transform = 'scale(1)'; }
    if (dimpleG) dimpleG.querySelectorAll('circle').forEach(d => d.style.opacity = 1);
    startAmbient();
  }

  /* ---------- run ---------------------------------------------------------- */
  if (!SPLASH) {
    build(true);                                          /* reduced motion: done */
    splashDone = true;
  } else {
    build(false);
    const t = (ms, fn) => setTimeout(fn, ms);
    const show = sel => { const n = document.querySelector(sel); if (n) n.classList.add('shown'); };

    /* mark starts hidden, revealed in step 3 */
    ballEl.style.opacity = 0;
    ballEl.style.transform = 'scale(0)';
    dimpleG.querySelectorAll('circle').forEach(d => d.style.opacity = 0);
    logoPaths.forEach(preparePath);

    /* STEP 1 — dots appear (staggered by the per-dot transitionDelay) */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      gridG.querySelectorAll('circle').forEach(d => {
        d.style.opacity = 1;
        d.style.transform = 'scale(1)';
      });
    }));

    /* STEP 2 — links and rings draw in */
    t(600, () => {
      let i = 0;
      const seed = Math.round(30 / (SCALE * SCALE));
      (function spawnNext() {
        if (splashDone || i++ >= seed) return;
        spawnAmbient({ drawDur: rand(600, 850), life: rand(3000, 9000) });
        setTimeout(spawnNext, 65);
      })();
    });
    t(2400, startAmbient);                                /* hand off to the loop */

    /* STEP 3 — the mark draws in at center */
    t(1500, () => {
      ballEl.getBoundingClientRect();
      ballEl.style.opacity = 1;
      ballEl.style.transform = 'scale(1)';
      t(280, () => drawPath(logoPaths[0], 700));
      t(620, () => drawPath(logoPaths[1], 700));
      t(1000, () => {
        dimpleG.querySelectorAll('circle').forEach((d, j) => {
          d.style.transitionDelay = (j * 35) + 'ms';
          d.style.opacity = 1;
        });
      });
    });

    /* STEP 4 — everything dims except the mark */
    t(3100, () => hero.classList.add('is-dim'));

    /* STEP 5 — mark shifts up into its resting position */
    t(3450, () => {
      resolveShift();                                     /* against the settled layout */
      logoG.style.transform = 'translateY(' + (-logoShift) + 'px)';
    });

    /* STEP 6 — page content cascades in behind the settled mark. */
    t(3700, () => show('.site-header'));
    t(3850, () => show('.hero__lockup'));
    t(4050, () => show('.hero__copy'));
    t(4400, finish);

    setTimeout(finish, 9000);                             /* watchdog */
    window.addEventListener('pointerdown', finish, { once: true });   /* skip */
    window.addEventListener('keydown', finish, { once: true });
  }

  /* ---------- ecosystem field ----------------------------------------------
     The dot grid and links carry on below the hero. State is entirely local so
     it can never disturb the hero's intro, and it reuses the geometry helpers
     and the same grid step, so the pattern reads as one continuous field. */
  function startEcosystemField() {
    const surface = document.getElementById('eco-field');
    const host = surface && surface.parentElement;
    if (!surface || !host) return;

    let s, rr, cols, rows, fx0, fy0, dots, used, linkG;
    let pop = [], timer = null;

    const cell = (c, r) => [fx0 + c * s, fy0 + r * s];
    const k = (c, r) => c + ',' + r;
    const cap = () => Math.round(
      (host.clientWidth * host.clientHeight) / (260 * 260) / (SCALE * SCALE));

    function build() {
      pop.forEach(i => clearTimeout(i.timer));
      pop = []; used = new Set(); dots = new Set();
      surface.innerHTML = '';

      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      surface.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

      s = Math.max(48, Math.min(78, w / 19)) * SCALE;      /* same step as the hero */
      rr = s * 0.5;
      cols = Math.ceil(w / s) + 2;
      rows = Math.ceil(h / s) + 2;
      fx0 = (w - (cols - 1) * s) / 2;
      fy0 = (h - (rows - 1) * s) / 2;

      const gridG = el('g', { class: 'eco-grid' }, surface);
      linkG = el('g', { class: 'eco-links' }, surface);

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (Math.random() < DOT_SKIP) continue;
          dots.add(k(c, r));
          const [x, y] = cell(c, r);
          el('circle', { cx: x, cy: y, r: s * DOT_RADIUS, fill: '#0B0B0B' }, gridG);
        }
      }
    }

    /* Same no-touching rule as the hero: a shape reserves its orthogonal
       neighbours so shapes never collide or chain. */
    function claim(kind) {
      for (let i = 0; i < 60; i++) {
        const c = 1 + Math.floor(Math.random() * (cols - 3));
        const r = 1 + Math.floor(Math.random() * (rows - 3));
        let cells;
        if (kind === 'link') {
          const dir = Math.random() < 0.5 ? 1 : -1;
          if (!dots.has(k(c, r)) || !dots.has(k(c + 1, r + dir))) continue;
          cells = [];
          [[c, r], [c + 1, r + dir]].forEach(([a, b]) => {
            cells.push(k(a, b), k(a + 1, b), k(a - 1, b), k(a, b + 1), k(a, b - 1));
          });
          cells = [...new Set(cells)];
          if (cells.some(x => used.has(x))) continue;
          cells.forEach(x => used.add(x));
          return { c, r, dir, cells };
        }
        if (!dots.has(k(c, r))) continue;
        cells = [k(c, r), k(c + 1, r), k(c - 1, r), k(c, r + 1), k(c, r - 1)];
        if (cells.some(x => used.has(x))) continue;
        cells.forEach(x => used.add(x));
        return { c, r, cells };
      }
      return null;
    }

    function spawn(instant) {
      if (!linkG) return;
      const kind = Math.random() < LINK_RATIO ? 'link' : 'ring';
      const spot = claim(kind);
      if (!spot) return;
      const d = kind === 'link'
        ? linkPath(cell(spot.c, spot.r), cell(spot.c + 1, spot.r + spot.dir), rr)
        : ringPath(cell(spot.c, spot.r), rr);
      const p = el('path', {
        d, fill: 'none', stroke: pick(COLORS),
        'stroke-width': s * 0.1, 'stroke-linecap': 'round'
      }, linkG);
      const item = { p, spot, dead: false };
      pop.push(item);
      if (!instant) { preparePath(p); drawPath(p, rand(750, 1100)); }
      item.timer = setTimeout(() => retire(item), rand(4000, 9000));
    }

    function retire(item) {
      if (item.dead) return;
      item.dead = true;
      clearTimeout(item.timer);
      undrawPath(item.p, 700);
      setTimeout(() => {
        item.p.remove();
        item.spot.cells.forEach(x => used.delete(x));
        const i = pop.indexOf(item);
        if (i > -1) pop.splice(i, 1);
      }, 760);
    }

    function loop() {
      clearInterval(timer);
      if (!SPLASH) return;                              /* respect reduced motion */
      timer = setInterval(() => {
        if (document.hidden) return;
        const alive = pop.filter(i => !i.dead).length;
        const max = cap();
        if (alive < max) spawn();
        if (alive < max - 4) spawn();
      }, 600);
    }

    function reset() {
      clearInterval(timer);
      build();
      const seed = Math.round(cap() * 0.6);
      for (let i = 0; i < seed; i++) spawn(true);
      loop();
    }

    reset();

    /* The section's height changes when its copy reflows, so rebuild the grid
       to fit rather than leaving a bare strip. */
    let ecoT;
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        clearTimeout(ecoT);
        ecoT = setTimeout(reset, 250);
      }).observe(host);
    }
  }

  /* The slot moves whenever the hero copy reflows — most notably when the
     webfonts land and the paragraph re-wraps. Watch the content box and
     re-align, rather than trying to guess when the layout has settled.
     Re-aligning only moves the SVG transform, so this cannot feed back. */
  if (window.ResizeObserver) {
    const contentEl = document.querySelector('.hero__content');
    if (contentEl) new ResizeObserver(realignMark).observe(contentEl);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(realignMark);

  startEcosystemField();

  /* Rebuild on resize, final state only. The 18% bleed plus slice scaling
     keeps the field full while the drag is in progress. */
  let rT;
  window.addEventListener('resize', () => {
    if (!splashDone) return;
    clearTimeout(rT);
    rT = setTimeout(() => {
      clearInterval(ambientTimer); ambientTimer = null;
      population.forEach(i => clearTimeout(i.timer));
      build(true);
      startAmbient();
    }, 250);
  });
})();
