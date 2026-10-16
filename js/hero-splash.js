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
     2. MatchPlay mark draws in at centre (ball -> links -> dimples)
     3. colored links + rings then draw themselves in around the field
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
  const svg   = document.getElementById('splash-svg');
  const hero  = document.getElementById('hero');
  /* The field spans the stage (hero + ecosystem); the hero is still what the
     mark's placement is measured against, and its layout is untouched. */
  const stage = document.getElementById('stage') || hero;
  if (!svg || !hero) return;

  const NS = 'http://www.w3.org/2000/svg';
  const SPLASH = document.documentElement.classList.contains('splash');
  /* Here in the last 24h: skip the load sequence, keep the moving field. */
  const RETURNING = document.documentElement.classList.contains('splash--returning');

  /* ---- tunables ---------------------------------------------------------
     SCALE is the master size control. 1 = original, 0.75 = three quarters.
     Everything below derives from the grid step, which SCALE multiplies,
     so the grid, links, rings and mark all resize together. */
  const SCALE = 0.675;                  /* 0.75 x the site-wide 90% (see html in styles.css) */

  const COLORS = ['#2BD9C0', '#FF7A45', '#E94F8A', '#C6F25E', '#B558F6', '#35C5F0', '#E9B949'];
  const MARGIN = 0.18;        /* off-screen bleed on every side (resize safety) */
  const DOT_SKIP = 0.26;      /* fraction of grid cells left empty */
  const DOT_RADIUS = 0.5;     /* dot radius as a fraction of the grid step.
                                 0.5 = neighbouring dots exactly touch */
  const LINK_RATIO = 0.62;    /* chance a new shape is a link vs a ring */

  /* Concurrent shapes per grid cell. Every field derives its own cap from this,
     so the hero and the ecosystem section hold the same density whatever their
     heights, and one number tunes both. */
  const AMBIENT_DENSITY = 0.06;

  /* dimple wedge of the golf ball: exact positions measured from the brand
     mark, as fractions of the ball radius */
  const DIMPLES = [
    [ 0.77, -0.32],
    [ 0.43,  0.03], [0.77, 0.03],
    [ 0.08,  0.37], [0.43, 0.37], [0.77, 0.37],
    [-0.26,  0.72], [0.08, 0.71], [0.43, 0.71]
  ];

  const rand = (a, b) => a + Math.random() * (b - a);

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
  let usedCells, excluded, dotCells;
  let logoShift = 0, splashDone = false;

  const cellXY = (c, r) => [x0 + c * S, y0 + r * S];

  /* Dots stop at the hero: the dark sections below are plain. Two rows run
     past its bottom edge so the grid doesn't end on a half-empty row and a
     link on the last visible row can still reach down; the ecosystem band
     paints over the overhang. */
  let dotRows = 0;                                        /* rows that have dots */
  function dotRowLimit() {
    const heroBottom = OY + hero.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
    return Math.min(rows, Math.ceil((heroBottom - y0) / S) + 2);
  }
  const key = (c, r) => c + ',' + r;

  /* ---------- fields -------------------------------------------------------
     A field is one dot grid plus the coloured shapes that come and go on it.
     There is exactly one, spanning the stage, so the hero and the ecosystem
     section share the same dots, links, density and timings by definition. */
  function createField() {
    return {
      layer: null,                 /* <g> the shapes are drawn into */
      S: 0, R: 0, cols: 0, rows: 0, x0: 0, y0: 0,
      dots: null, used: null, excluded: null,
      population: [], timer: null, cap: 0
    };
  }
  const cellOf = (f, c, r) => [f.x0 + c * f.S, f.y0 + r * f.S];

  const heroField = createField();

  /* ---- line-drawing via stroke-dash ---- */
  function preparePath(p) {
    const L = p.getTotalLength();
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = L;
    return L;
  }
  function drawPath(p, dur, delay) {
    delay = delay || 0;
    p.getBoundingClientRect();                    /* flush before transition */
    p.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.45,0,.25,1) ' + delay + 'ms';
    p.style.strokeDashoffset = 0;
    /* drop the dash once drawn so no seam artifact remains at the join */
    setTimeout(() => {
      if (parseFloat(p.style.strokeDashoffset) === 0) p.style.strokeDasharray = 'none';
    }, delay + dur + 80);
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
       - shapes reserve every neighbouring cell, so they never touch, cross,
         or chain into each other
     ---------------------------------------------------------------------- */
  /* The field now spans the whole page, so working across every row would mean
     hundreds of concurrent shapes with nearly all of them off screen. Confine
     spawning to the rows around the viewport, and size the cap to that band —
     which keeps the on-screen density identical to before, at a fraction of
     the work. */
  function bandOf(f) {
    if (!f.rows || !f.S) return [1, 1];
    const stageTop = stage.getBoundingClientRect().top;
    const top = OY - stageTop;
    const r0 = Math.max(1, Math.floor((top - f.y0) / f.S) - 2);
    const r1 = Math.min(f.rows - 3, Math.ceil((top + window.innerHeight - f.y0) / f.S) + 2);
    /* Shapes live in the hero only, but right down to its last row of dots:
       any row whose shapes would still show above the bottom edge (a ring
       reaches half a row up from its centre) is fair game, and what hangs
       below the edge is cut off by the band that follows, so the field runs
       off the bottom rather than stopping short of it. */
    const heroBottom = OY + hero.getBoundingClientRect().bottom - stageTop;
    const rEnd = Math.floor((heroBottom - f.y0) / f.S + 0.5) + 1;   /* exclusive */
    return [r0, Math.max(r0, Math.min(r1, rEnd))];         /* empty once past the hero */
  }
  function capOf(f) {
    const b = bandOf(f);
    return Math.round(f.cols * (b[1] - b[0]) * AMBIENT_DENSITY);
  }
  /* Only shapes in the current band count toward the cap. Counting the whole
     population let shapes stranded above the fold use up the allowance, so a
     newly scrolled-to section sat empty until they expired. */
  function aliveInBand(f) {
    const b = bandOf(f);
    return f.population.filter(i => !i.dead && i.spot.r >= b[0] - 1 && i.spot.r <= b[1] + 1).length;
  }

  /* A shape's middle, in grid cells: a ring's centre, or halfway along a link. */
  const centreOf = spot => spot.dir === undefined
    ? [spot.c, spot.r]
    : [spot.c + 0.5, spot.r + spot.dir * 0.5];
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /* The 3 x 3 block around each cell a shape sits on, so neighbours keep at
     least a clear cell between them on every side, diagonals included. */
  function blockAround(centres) {
    const cells = new Set();
    centres.forEach(([a, b]) => {
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) cells.add(key(a + dc, b + dr));
    });
    return [...cells];
  }

  /* Even spread: gather several free spots and take the one furthest from
     every shape already showing (best-candidate sampling), rather than the
     first free one, which let shapes bunch up and leave holes. */
  const CANDIDATES = 14;
  function claimSpot(f, kind) {
    const band = bandOf(f);
    const span = band[1] - band[0];
    if (span <= 0) return null;
    const live = f.population.filter(i => !i.dead).map(i => i.centre);
    let best = null, bestScore = -1, found = 0;
    for (let i = 0; i < 120 && found < CANDIDATES; i++) {
      const c = 1 + Math.floor(Math.random() * (f.cols - 3));
      const r = band[0] + Math.floor(Math.random() * span);
      let spot;
      if (kind === 'link') {
        const dir = Math.random() < 0.5 ? 1 : -1;         /* down-right or up-right */
        if (!f.dots.has(key(c, r)) || !f.dots.has(key(c + 1, r + dir))) continue;
        spot = { c, r, dir, cells: blockAround([[c, r], [c + 1, r + dir]]) };
      } else {
        if (!f.dots.has(key(c, r))) continue;
        spot = { c, r, cells: blockAround([[c, r]]) };
      }
      if (spot.cells.some(k2 => f.used.has(k2) || f.excluded.has(k2))) continue;
      found++;
      const centre = centreOf(spot);
      const score = live.reduce((m, o) => Math.min(m, distance(centre, o)), Infinity);
      if (score > bestScore) { best = spot; bestScore = score; }
    }
    if (!best) return null;                               /* field is full */
    best.cells.forEach(k2 => f.used.add(k2));
    return best;
  }

  /* Colour by neighbourhood: each colour is penalised for every shape of that
     colour nearby (closer counts more) and, lightly, for how many are showing
     overall. The cheapest wins, ties broken at random, so two shapes of one
     colour rarely sit side by side and the palette stays balanced. */
  const NEAR = 6;                                         /* cells */
  function pickColor(f, centre) {
    const live = f.population.filter(i => !i.dead);
    let best = null, bestCost = Infinity;
    COLORS.forEach(col => {
      let cost = Math.random() * 0.01;
      live.forEach(i => {
        if (i.color !== col) return;
        cost += 0.05 + Math.max(0, NEAR - distance(centre, i.centre));
      });
      if (cost < bestCost) { best = col; bestCost = cost; }
    });
    return best;
  }

  function makeShape(f, kind, spot, color) {
    const d = kind === 'link'
      ? linkPath(cellOf(f, spot.c, spot.r), cellOf(f, spot.c + 1, spot.r + spot.dir), f.R)
      : ringPath(cellOf(f, spot.c, spot.r), f.R);
    return el('path', {
      d, fill: 'none', stroke: color,
      'stroke-width': f.S * 0.1, 'stroke-linecap': 'round'
    }, f.layer);
  }

  function spawnAmbient(f, opts) {
    opts = opts || {};
    if (!f.layer || !f.dots) return null;
    const kind = opts.kind || (Math.random() < LINK_RATIO ? 'link' : 'ring');
    const spot = claimSpot(f, kind);
    if (!spot) return null;
    const centre = centreOf(spot);
    const color = pickColor(f, centre);
    const p = makeShape(f, kind, spot, color);
    const item = { p, spot, centre, color, dead: false };
    f.population.push(item);
    if (!opts.instant) {
      preparePath(p);
      drawPath(p, opts.drawDur || rand(750, 1100), opts.delay);
    }
    item.timer = setTimeout(() => retireAmbient(f, item), (opts.life || rand(3800, 8200)) + (opts.delay || 0));
    return item;
  }

  function retireAmbient(f, item) {
    if (item.dead) return;
    item.dead = true;
    clearTimeout(item.timer);
    const dur = 700;
    /* Hold on to this shape's own grid: a rebuild in the meantime swaps in a
       new one, and releasing these cells there would free another shape's. */
    const used = f.used;
    undrawPath(item.p, dur);
    setTimeout(() => {
      item.p.remove();
      item.spot.cells.forEach(k2 => used.delete(k2));
      const i = f.population.indexOf(item);
      if (i > -1) f.population.splice(i, 1);
    }, dur + 60);
  }

  function startAmbient(f) {
    if (f.timer || !SPLASH) return;                       /* respect reduced motion */
    f.timer = setInterval(() => {
      if (document.hidden) return;                        /* don't churn in a background tab */
      const alive = aliveInBand(f);
      const cap = capOf(f);
      if (alive < cap) spawnAmbient(f);
      if (alive < cap - 3) spawnAmbient(f);
      if (alive < cap - 8) spawnAmbient(f);
    }, 550);
  }

  function stopAmbient(f) {
    clearInterval(f.timer);
    f.timer = null;
    f.population.forEach(i => clearTimeout(i.timer));
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
      centre = (r.top - stage.getBoundingClientRect().top) + r.height / 2;
    } else {
      centre = Math.max(H * 0.26, 150 * SCALE);     /* fallback: fixed position */
    }
    logoShift = (y0 + (rowTop + 0.5) * S) - (OY + centre);
  }

  /* The mark only ever moves vertically: the grid is aligned to true centre in
     build(), so it is already horizontally centred where it is drawn. */
  function markTransform() {
    return 'translateY(' + (-logoShift) + 'px)';
  }

  /* Re-resolve against the settled layout and move the mark if it has already
     travelled. Needed because webfonts (and the reveal) change the text height
     after build(), which shifts where the slot lands. */
  function realignMark() {
    if (!logoG || rowTop === undefined) return;
    resolveShift();
    if (splashDone || logoG.style.transform) {
      logoG.style.transform = markTransform();
    }
  }

  /* ---------- build the scene --------------------------------------------- */
  /* instant: lay out the resting state, no intro. bare: and leave the field
     without coloured shapes, for the caller to draw them in. */
  function build(instant, bare) {
    svg.innerHTML = '';
    stopAmbient(heroField);
    heroField.population = [];
    usedCells = new Set();
    excluded = new Set();

    /* The SVG's box and its viewBox are set from the same numbers, so the
       scale is 1:1 and one viewBox unit is one px — the mark's placement maths
       depends on that. The box used to be sized in CSS (vh and %), but on
       phones 100vh is not innerHeight, which left the two disagreeing. The
       field runs the full length of the stage plus an 18% bleed on each side;
       the stage clips whatever hangs over. */
    W = stage.clientWidth; H = Math.max(window.innerHeight, 560);
    OX = W * MARGIN; OY = window.innerHeight * MARGIN;
    TW = W * (1 + 2 * MARGIN);
    TH = stage.clientHeight + 2 * MARGIN * window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + TW + ' ' + TH);
    svg.style.left = -OX + 'px';
    svg.style.top = -OY + 'px';
    svg.style.width = TW + 'px';
    svg.style.height = TH + 'px';

    S = Math.max(48, Math.min(78, W / 19)) * SCALE;       /* grid step */
    R = S * 0.5;                                          /* ring radius */
    cols = Math.ceil(TW / S) + 2;
    x0 = (TW - (cols - 1) * S) / 2;
    /* The mark hangs off a whole-numbered centre column, so unless the column
       count happens to fall right, that column sits up to half a cell off true
       centre. Slide the whole field over by the remainder before anything is
       laid out: the dots are a uniform repeating field, so moving them is
       invisible, and the mark then draws dead centre from its first frame
       rather than correcting itself when it shifts up. */
    const midC = Math.round((OX + W / 2 - x0) / S);
    x0 += (OX + W / 2) - (x0 + midC * S);
    /* Anchor the grid to the top instead of centring it vertically. The stage
       grows when the ecosystem copy reflows, and a y0 derived from TH would
       move every dot, link and the mark's row with it — which is what forced a
       full rebuild before. Fixed y0 means growth only ever appends rows. */
    y0 = -S;
    rows = Math.ceil((TH - y0) / S) + 2;

    gridG  = el('g', { id: 'splash-grid' }, svg);
    linksG = el('g', { id: 'splash-links' }, svg);
    logoG  = el('g', { id: 'splash-logo' }, svg);

    /* Hand the freshly-computed grid to the shared field driver. dotCells is
       assigned below and filled in place, so the reference stays valid. */
    heroField.layer = linksG;
    heroField.S = S; heroField.R = R;
    heroField.cols = cols; heroField.rows = rows;
    heroField.x0 = x0; heroField.y0 = y0;
    heroField.used = usedCells;
    heroField.excluded = excluded;

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
    heroField.dots = dotCells;
    dotRows = dotRowLimit();
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < dotRows; r++) {
        if (Math.random() < DOT_SKIP && !forced.has(key(c, r))) continue;
        dotCells.add(key(c, r));
        const [x, y] = cellXY(c, r);
        const dot = el('circle', { cx: x, cy: y, r: S * DOT_RADIUS, fill: '#0B0B0B' }, gridG);
        if (!instant && y < OY + window.innerHeight) {
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
      logoG.style.transform = markTransform();
      stage.classList.add('is-dim');
      for (let i = 0; !bare && i < Math.round(capOf(heroField) * 0.75); i++) {
        spawnAmbient(heroField, { instant: true, life: SPLASH ? rand(2000, 9000) : 86400000 });
      }
    }
  }

  /* ---------- reveal everything (end of intro, skip, or watchdog) --------- */
  function finish() {
    if (splashDone) return;
    splashDone = true;
    document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('shown'));
    stage.classList.add('is-dim');
    if (logoG) {
      resolveShift();                                     /* against the settled layout */
      logoG.style.transform = markTransform();
    }
    if (logoPaths) logoPaths.forEach(p => {               /* finish a skipped draw */
      p.style.transition = 'stroke-dashoffset .5s ease';
      p.style.strokeDashoffset = 0;
    });
    if (ballEl) { ballEl.style.opacity = 1; ballEl.style.transform = 'scale(1)'; }
    if (dimpleG) dimpleG.querySelectorAll('circle').forEach(d => d.style.opacity = 1);
    startAmbient(heroField);
  }

  /* ---------- run ---------------------------------------------------------- */
  const t = (ms, fn) => setTimeout(fn, ms);
  const show = sel => { const n = document.querySelector(sel); if (n) n.classList.add('shown'); };

  if (!SPLASH) {
    build(true);                                          /* reduced motion: done */
    splashDone = true;
  } else if (RETURNING) {
    /* Field starts at rest — dots up, mark placed — but empty of colour, and
       the links and rings draw themselves in quickly as the page arrives, so
       a repeat visit opens on movement rather than a finished picture. The
       ambient loop takes over from there. */
    build(true, true);
    /* One batch, staggered by CSS delay (chained timers get throttled). */
    t(120, () => {
      const seed = Math.round(capOf(heroField) * 0.9);
      for (let k = 0; k < seed; k++) {
        if (!spawnAmbient(heroField, { drawDur: rand(650, 950), life: rand(4000, 9500), delay: k * 75 })) break;
      }
    });
    /* Timers rather than rAF: a tab opened in the background gets no animation
       frames at all, and the cascade would sit unstarted until the watchdog.
       The first delay only has to outlast the initial style pass so the
       transition has a hidden state to move from. */
    t(60, () => show('.site-header'));
    t(150, () => show('.hero__lockup'));
    t(250, () => show('.hero__copy'));
    t(380, finish);                                       /* reveals the rest, starts ambient */
    setTimeout(finish, 2000);                             /* watchdog */
  } else {
    build(false);

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

    /* STEP 2 — the mark draws in at centre, first thing after the dots */
    t(800, () => {
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

    /* STEP 3 — the coloured links and rings follow the mark in */
    t(2200, () => {
      let i = 0;
      const seed = Math.round(capOf(heroField) * 0.95);
      (function spawnNext() {
        if (splashDone || i++ >= seed) return;
        spawnAmbient(heroField, { drawDur: rand(600, 850), life: rand(3000, 9000) });
        setTimeout(spawnNext, 65);
      })();
    });
    t(4000, () => startAmbient(heroField));               /* hand off to the loop */

    /* STEP 4 — everything dims except the mark */
    t(3400, () => stage.classList.add('is-dim'));

    /* STEP 5 — mark shifts up into its resting position */
    t(3700, () => {
      resolveShift();                                     /* against the settled layout */
      logoG.style.transform = markTransform();
    });

    /* STEP 6 — page content cascades in behind the settled mark. */
    t(3950, () => show('.site-header'));
    t(4100, () => show('.hero__lockup'));
    t(4300, () => show('.hero__copy'));
    t(4700, finish);

    setTimeout(finish, 9000);                             /* watchdog */
    /* Skip on any interaction, scrolling included — otherwise someone who
       scrolls straight past the hero browses the page with the nav still
       hidden. 'scroll' also covers a reload that restores a mid-page position. */
    ['pointerdown', 'keydown', 'wheel', 'touchmove', 'scroll'].forEach(ev =>
      window.addEventListener(ev, finish, { once: true, passive: true }));
  }

  /* The stage grows when text reflows (webfonts landing, mostly). Because y0
     is anchored, the field grows in place: stretch the box and viewBox
     together, and add rows of dots if the hero itself got taller. Nothing
     already on screen moves. A shrinking stage needs nothing — the stage
     clips the overhang. */
  let stageT;
  function extendField() {
    if (!gridG) return;
    const newTH = stage.clientHeight + 2 * MARGIN * window.innerHeight;
    if (newTH <= TH + 1) return;                          /* only ever grow */
    TH = newTH;
    svg.setAttribute('viewBox', '0 0 ' + TW + ' ' + TH);
    svg.style.height = TH + 'px';

    rows = Math.ceil((TH - y0) / S) + 2;
    heroField.rows = rows;
    /* the hero itself grew: carry the dots down to its new bottom */
    const limit = dotRowLimit();
    for (let r = dotRows; r < limit; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < DOT_SKIP) continue;
        dotCells.add(key(c, r));
        const [x, y] = cellXY(c, r);
        el('circle', { cx: x, cy: y, r: S * DOT_RADIUS, fill: '#0B0B0B' }, gridG);
      }
    }
    dotRows = Math.max(dotRows, limit);
  }
  if (window.ResizeObserver) {
    let lastH = 0;
    new ResizeObserver(() => {
      const h = stage.clientHeight;
      if (Math.abs(h - lastH) < 4) return;
      lastH = h;
      clearTimeout(stageT);
      stageT = setTimeout(extendField, 200);
    }).observe(stage);
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


  /* A hidden tab stops spawning (see startAmbient) while the shapes already on
     screen keep expiring, so a page left in the background comes back to an
     empty field that refills a couple of shapes per second. Top it up on
     return instead — drawn in place, since nobody watched it happen. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !splashDone) return;
    const target = Math.round(capOf(heroField) * 0.75);
    let alive = aliveInBand(heroField);
    while (alive++ < target) {
      spawnAmbient(heroField, { instant: true, life: rand(2000, 9000) });
    }
  });

  /* The loop adds a few shapes per tick, which keeps a band topped up but
     takes ten seconds or more to fill one from empty. When scrolling settles
     somewhere new, draw the band up to strength straight away. The whole batch
     is created at once and the drawing staggered in CSS, rather than one shape
     per timer: browsers throttle chained timers, which stretched the fill out
     again. */
  let topUpT;
  function topUp(f) {
    if (!f.timer || document.hidden) return;              /* loop not running yet */
    const need = Math.round(capOf(f) * 0.9) - aliveInBand(f);
    for (let k = 0; k < need; k++) {
      const item = spawnAmbient(f, { drawDur: rand(600, 850), life: rand(3000, 9000), delay: k * 35 });
      if (!item) break;                                   /* no free spot left */
    }
  }
  window.addEventListener('scroll', () => {
    clearTimeout(topUpT);
    topUpT = setTimeout(() => topUp(heroField), 120);
  }, { passive: true });

  /* Rebuild on resize, final state only, and only when the width changes.
     Phones resize the window whenever the URL bar shows or hides — so on
     every change of scroll direction — and rebuilding then reshuffled the
     whole field mid-scroll. The box is sized in px, so a height change alone
     needs nothing. The 18% bleed keeps the field full while a drag is in
     progress. */
  let rT;
  window.addEventListener('resize', () => {
    if (!splashDone || stage.clientWidth === W) return;
    clearTimeout(rT);
    rT = setTimeout(() => {
      build(true);                                        /* stops the field itself */
      startAmbient(heroField);
    }, 250);
  });
})();
