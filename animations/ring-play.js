/* Ring play: floating MatchPlay rings that merge into links and split
   again. Shared by two pages, which pick a version before loading this:
     window.RING_PLAY = { mode: "a" }   rings ignore the mouse; drag one
                                        onto another to merge them
     window.RING_PLAY = { mode: "b" }   rings and links keep away from the
                                        mouse, which is the MatchPlay golf
                                        ball and knocks them off when it hits;
                                        on a touch screen a tap sends them
                                        all shooting away; rings that drift
                                        close merge by themselves
     window.RING_PLAY = { mode: "c" }   as a, and rings that drift close also
                                        merge by themselves
   Every way, rings only merge within a colour family (see FAMILY), and
   links split back into their two rings, each its own colour again, after
   2-3 seconds.

   The merge is the one in link-merge.html and the hero: a stretch, a
   touch and a bounce, worked out in its own frame (ring radius 100) and
   placed with a transform. Same proportions as the hero: ring radius R,
   corner radius R/2, stroke R/5, a link's centres 2 sqrt 2 R apart.

   Options in the URL, e.g. ring-play-a.html?rings=10
     rings    how many rings to start with (default: fits the window)
     density  more or fewer rings than fit by default, e.g. 1.5
     r        ring radius in px
     bg       ground: dark (default) or grey (the hero before its dim)
     embed    1 when shown inside another page (the homepage): its dark
              ground, hero-sized rings, denser, no Reset button, and the
              page can still be scrolled by touch over it */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var EMBED = q.get("embed") === "1";
  if (EMBED) document.documentElement.classList.add("embed");
  var MODE = ({ a: "a", b: "b", c: "c" })[window.RING_PLAY && window.RING_PLAY.mode] || "a";
  var DRAG = MODE !== "b";             /* rings can be picked up and merged by hand */
  var AVOID = MODE === "b";            /* rings and links keep away from the mouse */
  var AUTO = MODE !== "a";             /* rings that drift close merge by themselves */
  if (q.get("bg") === "grey") document.documentElement.style.setProperty("--ground", "#26262A");
  /* the six MatchPlay brand colours, and only these:
     open, ventures, masters, studios, invitational, challenge */
  var COLORS = ["#1ED2F4", "#F97D4A", "#DDF01A", "#9590FF", "#8DEBD1", "#D25AFF"];
  /* Rings merge within a colour family: the blues (open, invitational), the
     warms (ventures, masters) and the violets (studios, challenge). Twice the
     partners a single colour would have, so links form more often. */
  var FAMILY = { "#1ED2F4": 0, "#8DEBD1": 0, "#F97D4A": 1, "#DDF01A": 1, "#9590FF": 2, "#D25AFF": 2 };
  var kin = function (A, B) { return FAMILY[A.color] === FAMILY[B.color]; };
  var STILL = window.matchMedia("(prefers-reduced-motion: reduce)").matches;   /* no drifting */
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.getElementById("stage");
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---- geometry ------------------------------------------------------
     The merge, worked out in its own frame (ring A's centre at the origin,
     ring B's at (200, 200), ring radius 100) exactly as in link-merge.html
     and the hero, then scaled by K and placed with a transform. Paths are
     lists of cubic Beziers, p0 c c p1 c c p2 ..., so two with the same
     pieces can be blended point by point. */
  var R0 = 100, D0 = 200, RHO = 50;
  var add = function (p, q) { return [p[0] + q[0], p[1] + q[1]]; };
  var lerp = function (p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
  var on = function (c, r, deg) { var a = deg * Math.PI / 180; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; };
  var join = function (a, b) { return a.concat(b.slice(1)); };
  var mix = function (P, Q, t) { return P.map(function (p, i) { return lerp(p, Q[i], t); }); };
  function arcCubics(c, r, a0, a1, n) {
    var pts = [on(c, r, a0)], step = (a1 - a0) / n;
    var h = 4 / 3 * Math.tan(Math.abs(step) * Math.PI / 720) * r * Math.sign(step);
    for (var i = 0; i < n; i++) {
      var s0 = (a0 + i * step) * Math.PI / 180, s1 = (a0 + (i + 1) * step) * Math.PI / 180;
      var p0 = on(c, r, a0 + i * step), p1 = on(c, r, a0 + (i + 1) * step);
      pts.push(add(p0, [-Math.sin(s0) * h, Math.cos(s0) * h]), add(p1, [Math.sin(s1) * h, -Math.cos(s1) * h]), p1);
    }
    return pts;
  }
  var lineCubic = function (p, q) { return [p, lerp(p, q, 1 / 3), lerp(p, q, 2 / 3), q]; };
  var line2 = function (p, q) { var m = lerp(p, q, 0.5); return join(lineCubic(p, m), lineCubic(m, q)); };
  function sample(fn, n) {                 /* a curve as n cubics whose handles follow its tangent */
    var pts = [fn(0)], e = 1e-4;
    var tan = function (u) {
      var a = Math.max(0, u - e), b = Math.min(1, u + e), p = fn(a), q = fn(b);
      return [(q[0] - p[0]) / (b - a), (q[1] - p[1]) / (b - a)];
    };
    for (var i = 0; i < n; i++) {
      var u0 = i / n, u1 = (i + 1) / n, p0 = fn(u0), p1 = fn(u1), t0 = tan(u0), t1 = tan(u1), k = (u1 - u0) / 3;
      pts.push([p0[0] + t0[0] * k, p0[1] + t0[1] * k], [p1[0] - t1[0] * k, p1[1] - t1[1] * k], p1);
    }
    return pts;
  }
  /* a ring stretched by s toward the ring it faces (s = 1: its front reaches
     the midpoint, where the two touch). Below 0 it squashes the other way. */
  var LEAN = 12, PULL = 8, NARROW = 0.08;
  var REACH = Math.hypot(D0 / 2, D0 / 2) - R0 - LEAN;
  function loop(c, T, dir, s) {
    var ctr = add(c, [dir[0] * LEAN * s, dir[1] * LEAN * s]);
    var at = function (deg) {
      var phi = (deg - T) * Math.PI / 180, sn = Math.sin(phi);
      return on(ctr, R0 + s * (REACH * Math.pow((1 + Math.cos(phi)) / 2, PULL) - NARROW * R0 * sn * sn), deg);
    };
    var piece = function (a0, a1, n) { return sample(function (u) { return at(a0 + (a1 - a0) * u); }, n); };
    return join(join(piece(T, T - 45, 4), piece(T - 45, T - 315, 6)), piece(T - 315, T - 360, 4));
  }
  /* the link as each ring's side of it, waist set by rho, loops bent by e */
  function back(c, a0, a1, rear, e) {
    if (!e) return arcCubics(c, R0, a0, a1, 6);
    return sample(function (u) {
      var deg = a0 + (a1 - a0) * u, k = Math.cos((deg - rear) * Math.PI / 270);
      return on(c, R0 * (1 + e * k * k), deg);
    }, 6);
  }
  function sides(rho, e) {
    var k1 = [D0 - R0 - rho, R0 + rho], k2 = [R0 + rho, D0 - R0 - rho];
    return [
      join(join(join(arcCubics(k2, rho, 135, 180, 2), line2([R0, D0 - R0 - rho], [R0, 0])),
                back([0, 0], 0, -270, -135, e)),
           join(line2([0, R0], [D0 - R0 - rho, R0]), arcCubics(k1, rho, -90, -45, 2))),
      join(join(join(arcCubics(k1, rho, -45, 0, 2), line2([D0 - R0, R0 + rho], [D0 - R0, D0])),
                back([D0, D0], -180, -450, -315, e)),
           join(line2([D0, D0 - R0], [R0 + rho, D0 - R0]), arcCubics(k2, rho, 90, 135, 2)))
    ];
  }
  var D2 = [Math.SQRT1_2, Math.SQRT1_2];
  var A0 = loop([0, 0], 45, D2, 0), A1 = loop([0, 0], 45, D2, 1);     /* a loop moves in step with s */
  var B1 = loop([D0, D0], -135, [-D2[0], -D2[1]], 1);
  var LINK = sides(RHO, 0);
  var LINK_LOOP = join(LINK[0], LINK[1]);

  /* timing, as the merges: a loose spring, its first rise, a dying swing */
  var SZ = 0.22, SW = 20, SWD = SW * Math.sqrt(1 - SZ * SZ);
  var spring = function (t) {
    return t >= 1 ? 1 : 1 - Math.exp(-SZ * SW * t) * (Math.cos(SWD * t) + SZ * SW / SWD * Math.sin(SWD * t));
  };
  var RISE = (Math.PI - Math.atan(SWD / (SZ * SW))) / SWD;
  var springRise = function (t) { return t >= 1 ? 1 : spring(t * RISE); };
  var wobble = function (t) { return Math.sin(12 * t) * Math.exp(-2.3 * t) * (1 - Math.pow(t, 4)); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeIn = function (t) { return t * t * t; };

  /* ---- scale --------------------------------------------------------- */
  var W, H, R, LW, K, CAN, HALF;
  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  }
  measure();
  /* fixed once: shapes are built at it. Embedded, about the hero's size. */
  R = EMBED ? Math.max(16, Math.min(26, Math.min(W, H) * 0.05)) : Math.max(22, Math.min(40, Math.min(W, H) * 0.045));
  if (parseFloat(q.get("r")) > 0) R = parseFloat(q.get("r"));
  var DENSITY = parseFloat(q.get("density")) || (EMBED ? 1.9 : 1);
  LW = R * 0.2; K = R / R0;
  CAN = 2 * Math.SQRT2 * R;            /* centre to centre in a link */
  HALF = CAN / 2;
  var GAP = R * 0.3;                   /* clear space kept between shapes */
  var MIN = 2 * R + LW + GAP;          /* closest two ring centres get */
  var ATTRACT = CAN + R * 2.6;         /* a dragged ring starts to reach within this */
  var CRUISE = R * 0.35, WANDER = R * 0.6;
  var AVOID_R = R * 6;                 /* how near the mouse can come before shapes move off */
  var BALL_R = R * 1.1;                /* (b) the mouse's golf ball, the size it is in the logo */
  var SPLIT_AFTER = [2000, 3000];      /* ms a link holds before it splits on its own */
  var MEET = CAN + R * 0.4;            /* (b, c) rings of a family this close (touching) merge */
  var DRAW = R * 9;                    /* (b, c) and within this they drift toward each other */
  var COOL = 2500;                     /* (b, c) ms after a split before a ring merges again */

  var f2 = function (n) { return n.toFixed(2); };
  /* points (in the merge frame, less an origin) to a path, scaled */
  function d(pts, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    var P = function (p) { return f2((p[0] - ox) * K) + " " + f2((p[1] - oy) * K); };
    var out = "M " + P(pts[0]);
    for (var i = 1; i < pts.length; i += 3) out += " C " + P(pts[i]) + " " + P(pts[i + 1]) + " " + P(pts[i + 2]);
    return out;
  }
  /* a plain ring at the origin: four quarter arcs (half circles let the
     browser put the centre off by rounding) */
  var RING = (function () {
    var r = f2(R), a = " A " + r + " " + r + " 0 0 0 ";
    return "M " + r + " 0" + a + "0 -" + r + a + "-" + r + " 0" + a + "0 " + r + a + r + " 0 Z";
  })();
  var LINK_D = d(LINK_LOOP, D0 / 2, D0 / 2);            /* a link about its own middle */
  var place = function (n, x, y, deg) {
    n.setAttribute("transform", "translate(" + f2(x) + " " + f2(y) + ")" + (deg ? " rotate(" + f2(deg) + ")" : ""));
  };
  var DEG = 180 / Math.PI;

  /* ---- bodies -------------------------------------------------------- */
  var layer, bodies = [], merges = [], splits = [];
  function shapeEl(color) {
    return el("path", { fill: "none", stroke: color, "stroke-width": f2(LW), "stroke-linecap": "round", "stroke-linejoin": "round" }, layer);
  }
  function makeRing(x, y, color, el0) {
    var b = {
      kind: "ring", x: x, y: y, vx: rand(-1, 1) * CRUISE, vy: rand(-1, 1) * CRUISE,
      color: color, el: el0 || shapeEl(color), phase: rand(0, 6.283),
      s: 0, sv: 0, goal: 0, face: rand(0, 6.283), plain: false
    };
    bodies.push(b);
    return b;
  }
  function makeLink(x, y, ang, color, el0) {
    var b = { kind: "link", x: x, y: y, vx: 0, vy: 0, ang: ang, va: rand(-0.15, 0.15), color: color, el: el0, phase: rand(0, 6.283),
              splitAt: performance.now() + rand(SPLIT_AFTER[0], SPLIT_AFTER[1]) };
    b.el.setAttribute("d", LINK_D);
    bodies.push(b);
    return b;
  }
  var circlesOf = function (b) {
    if (b.kind === "ring") return [[b.x, b.y]];
    var c = Math.cos(b.ang) * HALF, s = Math.sin(b.ang) * HALF;
    return [[b.x - c, b.y - s], [b.x + c, b.y + s]];
  };
  var remove = function (b) { var i = bodies.indexOf(b); if (i > -1) bodies.splice(i, 1); };

  function populate() {
    svg.innerHTML = "";
    layer = el("g", {}, svg);
    /* (b) the mouse is the MatchPlay golf ball: white, with the mark's
       wedge of dimples (as the hero's mark, js/hero-splash.js) */
    ball = null;
    if (AVOID) {
      ball = el("g", { visibility: "hidden", "pointer-events": "none" }, svg);
      ball.spin = el("g", {}, ball);
      el("circle", { r: f2(BALL_R), fill: "#fff" }, ball.spin);
      [[0.77, -0.32], [0.43, 0.03], [0.77, 0.03], [0.08, 0.37], [0.43, 0.37], [0.77, 0.37], [-0.26, 0.72], [0.08, 0.71], [0.43, 0.71]]
        .forEach(function (q) { el("circle", { cx: f2(BALL_R * q[0]), cy: f2(BALL_R * q[1]), r: f2(BALL_R * 0.118), fill: "#0B0B0B" }, ball.spin); });
      svg.style.cursor = "none";
    }
    bodies = []; merges = []; splits = []; drag = null; preview = null;
    var n = parseInt(q.get("rings"), 10);
    if (!(n > 0)) n = Math.round(W * H / (R * R * 55) * DENSITY);
    n = Math.max(4, Math.min(90, n));
    var pad = R + LW + 8;
    var drawIn = function (pe, delay) {     /* draw in, measured as length 1, the hidden dash clear of the ends */
      pe.setAttribute("pathLength", 1);
      pe.style.strokeDasharray = "1 2";
      var a = pe.animate([{ strokeDashoffset: 1.02 }, { strokeDashoffset: 0 }],
        { duration: 800, delay: delay, easing: "cubic-bezier(.45,0,.25,1)", fill: "backwards" });
      a.onfinish = function () { pe.removeAttribute("pathLength"); pe.style.strokeDasharray = "none"; };
    };
    var clearOf = function (c0, c1) {       /* room for a shape with this spine */
      return bodies.every(function (o) {
        var cs = circlesOf(o), p = closest(c0, c1, cs[0], cs[cs.length - 1]);
        return Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) >= MIN + R * 0.6;
      });
    };
    /* A few links already formed (4 to 7), drawn in with the rings; they
       split like any other a little after. Each remembers a ring of its own
       colour family to give back when it does. */
    var links = 4 + Math.floor(Math.random() * 4), k = 0, first = Math.floor(Math.random() * COLORS.length);
    for (var lt = 0; k < links && lt < 3000; lt++) {
      var ang = rand(0, 2 * Math.PI), hx = Math.cos(ang) * HALF, hy = Math.sin(ang) * HALF;
      var lx = rand(pad + HALF, W - pad - HALF), ly = rand(pad + HALF, H - pad - HALF - 40);
      if (!clearOf([lx - hx, ly - hy], [lx + hx, ly + hy])) continue;
      var col = COLORS[(first + k) % COLORS.length];        /* a spread of colours */
      var mate = COLORS.filter(function (c2) { return c2 !== col && FAMILY[c2] === FAMILY[col]; })[0];
      var Lk = makeLink(lx, ly, ang, col, shapeEl(col));
      Lk.colorB = Math.random() < 0.5 ? mate : col;
      Lk.vx = rand(-1, 1) * CRUISE; Lk.vy = rand(-1, 1) * CRUISE;
      Lk.splitAt = performance.now() + 120 + k * 110 + 800 + rand(2000, 3000);
      place(Lk.el, lx, ly, ang * DEG - 45);
      drawIn(Lk.el, 120 + k * 110);
      k++;
    }
    n = Math.max(4, n - 2 * k);             /* the links' rings count toward the total */
    for (var i = 0, tries = 0; i < n && tries < 4000; tries++) {
      var x = rand(pad, W - pad), y = rand(pad, H - pad - 40);
      if (!clearOf([x, y], [x, y])) continue;
      var b = makeRing(x, y, COLORS[i % COLORS.length]);
      /* not straight away: each draws in first, then waits a moment, so
         links appear one by one instead of all at once */
      b.cool = performance.now() + 120 + i * 55 + 800 + rand(300, 2500);
      b.el.setAttribute("d", RING); b.plain = true;
      place(b.el, x, y);
      drawIn(b.el, 120 + i * 55);
      i++;
    }
  }

  /* ---- merging ------------------------------------------------------- */
  /* b (the ring being dragged) goes to a: it slides to a link's distance
     from a while both finish reaching, they touch, and the pair bounces
     into a link, in a's colour. */
  function startMerge(a, b, A, B) {
    if (!b) b = a === A ? B : A;           /* (b) a random one of a meeting pair stays put */
    if (a.busy || b.busy) return;
    a.busy = b.busy = true;
    var phi = Math.atan2(b.y - a.y, b.x - a.x);
    /* the pair keeps travelling as one at their shared speed while they
       merge, and the link carries it on: no stop, merge, start again */
    merges.push({ a: a, b: b, phi: phi, phase: "reach", t0: performance.now(), last: performance.now(),
      from: [b.x - a.x, b.y - a.y], vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2,
      s0: Math.max(0, Math.min(1, Math.max(a.s, b.s))) });
  }
  function stepMerge(m, now) {
    var a = m.a, b = m.b, deg = m.phi * DEG - 45;
    var dt = Math.min(1 / 30, Math.max(0, now - m.last) / 1000);
    m.last = now;
    var sp = Math.hypot(m.vx, m.vy), damp = Math.exp((sp > CRUISE ? -1.4 : -0.2) * dt);   /* as a free shape */
    m.vx *= damp; m.vy *= damp;
    a.x += m.vx * dt; a.y += m.vy * dt;
    /* the walls turn it, its far ring included */
    var lo = R + LW, ex = a.x + Math.cos(m.phi) * CAN, ey = a.y + Math.sin(m.phi) * CAN;
    if (Math.min(a.x, ex) < lo && m.vx < 0 || Math.max(a.x, ex) > W - lo && m.vx > 0) m.vx = -m.vx * 0.7;
    if (Math.min(a.y, ey) < lo && m.vy < 0 || Math.max(a.y, ey) > H - lo && m.vy > 0) m.vy = -m.vy * 0.7;
    if (m.phase === "reach") {
      /* the reach: b slides in on the same rising curve as the stretch, so
         the two arrive at the touch together and on the move */
      var dur = 220 + 420 * (1 - m.s0), t = Math.min(1, Math.max(0, now - m.t0) / dur);
      var to = [Math.cos(m.phi) * CAN, Math.sin(m.phi) * CAN], k = springRise(t);   /* relative to a */
      b.x = a.x + m.from[0] + (to[0] - m.from[0]) * k;
      b.y = a.y + m.from[1] + (to[1] - m.from[1]) * k;
      var s = m.s0 + (1 - m.s0) * k;
      a.el.setAttribute("d", d(mix(A0, A1, s))); place(a.el, a.x, a.y, deg);
      b.el.setAttribute("d", d(mix(A0, A1, s))); place(b.el, b.x, b.y, deg + 180);
      if (t >= 1) {
        m.phase = "settle"; m.t0 = now;
        b.el.setAttribute("stroke", a.color);
        place(b.el, a.x, a.y, deg);                      /* both now drawn in a's frame */
      }
    } else {
      var u = Math.min(1, Math.max(0, now - m.t0) / 1150);
      var mm = easeOut(Math.min(1, u / 0.14)), e = u < 1 ? 0.15 * wobble(u) : 0;
      var link = sides(12 + (RHO - 12) * spring(u), e > 0 ? e * 0.4 : e);
      a.el.setAttribute("d", d(mix(A1, link[0], mm)));
      b.el.setAttribute("d", d(mix(B1, link[1], mm)));
      place(a.el, a.x, a.y, deg); place(b.el, a.x, a.y, deg);
      if (u >= 1) {
        b.el.remove(); remove(a); remove(b);
        var mx = a.x + Math.cos(m.phi) * HALF, my = a.y + Math.sin(m.phi) * HALF;
        var L = makeLink(mx, my, m.phi, a.color, a.el);
        L.colorB = b.color;                                 /* b's own colour, back when it splits */
        L.vx = m.vx; L.vy = m.vy;
        return true;
      }
    }
    return false;
  }

  function placeMerge(m) {
    var deg = m.phi * DEG - 45;
    if (m.phase === "reach") { place(m.a.el, m.a.x, m.a.y, deg); place(m.b.el, m.b.x, m.b.y, deg + 180); }
    else { place(m.a.el, m.a.x, m.a.y, deg); place(m.b.el, m.a.x, m.a.y, deg); }
  }
  function placeSplit(sp) {
    var L = sp.L, deg = L.ang * DEG - 45;
    var ca = [L.x - Math.cos(L.ang) * HALF, L.y - Math.sin(L.ang) * HALF];
    place(L.el, ca[0], ca[1], deg); place(sp.elB, ca[0], ca[1], deg);
  }

  /* A link pinches back into two touching rings, which spring apart and
     wobble round again, each its own colour. */
  function startSplit(L) {
    if (L.busy) return;
    L.busy = true;
    var elB = shapeEl(L.color);
    layer.insertBefore(elB, L.el.nextSibling);
    splits.push({ L: L, elB: elB, t0: performance.now(), last: performance.now() });
  }
  function stepSplit(sp, now) {
    var L = sp.L, t = Math.min(1, Math.max(0, now - sp.t0) / 260), k = easeIn(t);
    /* it keeps travelling and turning while it pinches */
    var dt = Math.min(1 / 30, Math.max(0, now - sp.last) / 1000);
    sp.last = now;
    L.x += L.vx * dt; L.y += L.vy * dt; L.ang += L.va * dt;
    var ux = Math.cos(L.ang), uy = Math.sin(L.ang), deg = L.ang * DEG - 45;
    var ca = [L.x - ux * HALF, L.y - uy * HALF], cb = [L.x + ux * HALF, L.y + uy * HALF];
    L.el.setAttribute("d", d(mix(LINK[0], A1, k)));
    sp.elB.setAttribute("d", d(mix(LINK[1], B1, k)));
    place(L.el, ca[0], ca[1], deg); place(sp.elB, ca[0], ca[1], deg);
    if (t < 1) return false;
    remove(L);
    var push = R * 6;
    var a = makeRing(ca[0], ca[1], L.color, L.el);
    var b = makeRing(cb[0], cb[1], L.colorB || L.color, sp.elB);   /* back to its own colour */
    sp.elB.setAttribute("stroke", b.color);
    [[a, -1, L.ang], [b, 1, L.ang + Math.PI]].forEach(function (r) {
      var ring = r[0], ox = ux * HALF * r[1], oy = uy * HALF * r[1];
      ring.s = 1; ring.sv = 0; ring.goal = 0; ring.face = r[2];   /* released from the touch */
      ring.cool = performance.now() + COOL;
      /* each keeps the link's momentum: its travel, plus its own end's speed
         from the spin, plus the push apart */
      ring.vx = L.vx - L.va * oy + ux * push * r[1];
      ring.vy = L.vy + L.va * ox + uy * push * r[1];
    });
    return true;
  }

  /* ---- dragging ------------------------------------------------------ */
  var drag = null, preview = null, lastTap = null, down = null, mouse = null, pairs = [], ball = null;
  svg.addEventListener("pointerleave", function () { mouse = null; });
  function point(e) {
    var r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  }
  /* the point on a shape's spine nearest p: a ring's spine is its centre,
     a link's the segment between its centres, so its waist counts too */
  function nearest(b, p) {
    var cs = circlesOf(b), c0 = cs[0], c1 = cs[cs.length - 1];
    var sx = c1[0] - c0[0], sy = c1[1] - c0[1], len2 = sx * sx + sy * sy;
    var u = len2 ? Math.max(0, Math.min(1, ((p[0] - c0[0]) * sx + (p[1] - c0[1]) * sy) / len2)) : 0;
    return [c0[0] + sx * u, c0[1] + sy * u];
  }
  /* the closest points of two segments (a point is a segment of length 0) */
  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  function closest(p0, p1, q0, q1) {
    var d1x = p1[0] - p0[0], d1y = p1[1] - p0[1], d2x = q1[0] - q0[0], d2y = q1[1] - q0[1];
    var rx = p0[0] - q0[0], ry = p0[1] - q0[1];
    var a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry, s = 0, t = 0;
    if (a < 1e-9 && e < 1e-9) { s = t = 0; }
    else if (a < 1e-9) { t = clamp01(f / e); }
    else {
      var c = d1x * rx + d1y * ry;
      if (e < 1e-9) { s = clamp01(-c / a); }
      else {
        var bb = d1x * d2x + d1y * d2y, den = a * e - bb * bb;
        s = den > 1e-9 ? clamp01((bb * f - c * e) / den) : 0;
        t = (bb * s + f) / e;
        if (t < 0) { t = 0; s = clamp01(-c / a); }
        else if (t > 1) { t = 1; s = clamp01((bb - c) / a); }
      }
    }
    return [[p0[0] + d1x * s, p0[1] + d1y * s], [q0[0] + d2x * t, q0[1] + d2y * t]];
  }
  function hit(p) {
    for (var i = bodies.length - 1; i >= 0; i--) {
      var b = bodies[i];
      if (b.busy) continue;
      var n = nearest(b, p);
      if (Math.hypot(p[0] - n[0], p[1] - n[1]) < R + LW * 1.5) return b;
    }
    return null;
  }
  svg.addEventListener("pointerdown", function (e) {
    var p = point(e), b = DRAG ? hit(p) : null;
    down = { p: p, t: performance.now(), b: b };
    if (AVOID) mouse = { x: p[0], y: p[1], vx: 0, vy: 0, t: performance.now(), roll: 0, isMouse: e.pointerType === "mouse" };   /* a touch counts too */
    if (!b) return;
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* keeps working without it */ }
    drag = { b: b, off: [b.x - p[0], b.y - p[1]], last: p, lastT: performance.now(), vx: 0, vy: 0, id: e.pointerId };
    b.dragged = true;
    layer.appendChild(b.el);                             /* on top */
    svg.classList.add("grabbing");
    e.preventDefault();
  });
  svg.addEventListener("pointermove", function (e) {
    var p = point(e);
    if (!drag) {
      if (e.pointerType === "mouse" || e.buttons) {                 /* (b) shapes keep away */
        var tm = performance.now();
        if (mouse && mouse.t) {
          var mdt = Math.max(4, tm - mouse.t) / 1000;
          mouse.vx = mouse.vx * 0.5 + (p[0] - mouse.x) / mdt * 0.5;
          mouse.vy = mouse.vy * 0.5 + (p[1] - mouse.y) / mdt * 0.5;
          mouse.roll += (p[0] - mouse.x) / BALL_R * DEG;            /* the ball rolls as it goes */
          mouse.x = p[0]; mouse.y = p[1]; mouse.t = tm;
        } else mouse = { x: p[0], y: p[1], vx: 0, vy: 0, t: tm, roll: 0 };
        mouse.isMouse = e.pointerType === "mouse";
      }
      svg.classList.toggle("can-grab", DRAG && !!hit(p));
      return;
    }
    if (e.pointerId !== drag.id) return;
    var now = performance.now(), dt = Math.max(1, now - drag.lastT) / 1000;
    drag.vx = drag.vx * 0.6 + (p[0] - drag.last[0]) / dt * 0.4;
    drag.vy = drag.vy * 0.6 + (p[1] - drag.last[1]) / dt * 0.4;
    drag.last = p; drag.lastT = now;
    drag.b.x = p[0] + drag.off[0]; drag.b.y = p[1] + drag.off[1];
  });
  /* (b) a tap on a touch screen sends everything shooting away from it:
     hardest close by, felt right across, links spun off when struck off
     centre. Shapes mid-merge finish merging. */
  function blast(p) {
    var reach = Math.hypot(W, H) * 0.7;
    bodies.forEach(function (b) {
      if (b.busy || b.dragged) return;
      var n = nearest(b, p), ax = n[0] - p[0], ay = n[1] - p[1], dd = Math.hypot(ax, ay) || 1;
      var ux = ax / dd, uy = ay / dd, v = R * 60 * Math.max(0.3, 1 - dd / reach);
      b.vx += ux * v; b.vy += uy * v;
      if (b.kind === "link") b.va += ((n[0] - b.x) * uy - (n[1] - b.y) * ux) / (HALF * HALF) * v * 0.15;
    });
  }
  function release(e) {
    var p = point(e), now = performance.now();
    if (e.pointerType !== "mouse") mouse = null;           /* a lifted finger stops repelling */
    if (AVOID && down && e.pointerType !== "mouse" && e.type === "pointerup" &&
        Math.hypot(p[0] - down.p[0], p[1] - down.p[1]) < 12 && now - down.t < 450) blast(p);   /* a tap, not a scroll */
    if (down && down.b && down.b.kind === "link" && Math.hypot(p[0] - down.p[0], p[1] - down.p[1]) < 8 && now - down.t < 350) {
      if (lastTap && lastTap.b === down.b && now - lastTap.t < 400) { startSplit(down.b); lastTap = null; }
      else lastTap = { b: down.b, t: now };
    }
    down = null;
    if (!drag || e.pointerId !== drag.id) return;
    var b = drag.b, idle = now - drag.lastT > 80;      /* held still before letting go: no throw */
    b.dragged = false;
    if (preview && preview.b === b && preview.p > 0.15) startMerge(preview.a, b);
    else if (!b.busy) {
      var cap = R * 40, v = Math.hypot(drag.vx, drag.vy), f = idle ? 0 : Math.min(1, cap / (v || 1));
      b.vx = drag.vx * f; b.vy = drag.vy * f;
    }
    drag = null;
    svg.classList.remove("grabbing");
  }
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  /* ---- the loop ------------------------------------------------------ */
  function step(dt, now) {
    var t = now / 1000;
    /* what a dragged ring is reaching for: the nearest free ring in range */
    preview = null;
    if (drag && drag.b.kind === "ring" && !drag.b.busy) {
      var b = drag.b, best = null, bestD = ATTRACT;
      bodies.forEach(function (o) {
        if (o === b || o.kind !== "ring" || o.busy || !kin(o, b)) return;   /* only its colour family */
        var dd = Math.hypot(o.x - b.x, o.y - b.y);
        if (dd < bestD) { best = o; bestD = dd; }
      });
      if (best) {
        /* held, it never commits: it stops where the two would touch, and
           pulling away lets them go again */
        var phi = Math.atan2(b.y - best.y, b.x - best.x);
        if (bestD < CAN) { b.x = best.x + Math.cos(phi) * CAN; b.y = best.y + Math.sin(phi) * CAN; bestD = CAN; }
        var pr = Math.min(1, (ATTRACT - bestD) / (ATTRACT - CAN));
        preview = { a: best, b: b, p: pr };
        best.goal = b.goal = Math.pow(pr, 1.6);          /* fully touching at the closest */
        best.face = phi; b.face = phi + Math.PI;
        best.vx *= 0.9; best.vy *= 0.9;                   /* it waits for you */
      }
    }

    /* (b, c) rings of one colour family that touch merge: closest pairs first, one partner
       each, and not straight after a split. The merge starts the moment they
       meet (its reach draws them the rest of the way), so a pair never hangs
       half-stretched waiting to touch. */
    pairs = [];
    if (AUTO) {
      var free = bodies.filter(function (b) {               /* not one in your hand, nor what it reaches for */
        return b.kind === "ring" && !b.busy && !b.dragged && !(now < b.cool) && !(preview && b === preview.a);
      });
      var cands = [];
      for (var i0 = 0; i0 < free.length; i0++) for (var j0 = i0 + 1; j0 < free.length; j0++) {
        var dd0 = Math.hypot(free[j0].x - free[i0].x, free[j0].y - free[i0].y);
        if (!kin(free[i0], free[j0])) continue;
        if (dd0 < MEET) { cands.push([dd0, free[i0], free[j0]]); continue; }
        if (dd0 < DRAW) {                                    /* nearby kin drift together a little */
          var pull = R * 2.4 * (1 - dd0 / DRAW) * dt, ux0 = (free[j0].x - free[i0].x) / dd0, uy0 = (free[j0].y - free[i0].y) / dd0;
          free[i0].vx += ux0 * pull; free[i0].vy += uy0 * pull;
          free[j0].vx -= ux0 * pull; free[j0].vy -= uy0 * pull;
        }
      }
      cands.sort(function (x, y) { return x[0] - y[0]; });
      cands.forEach(function (c) {
        var A = c[1], B = c[2];
        if (A.busy || B.busy) return;
        startMerge(Math.random() < 0.5 ? A : B, null, A, B);
      });
    }
    var paired = function (A, B) {
      return (preview && ((A === preview.a && B === preview.b) || (A === preview.b && B === preview.a))) ||
        pairs.some(function (p) { return (p[0] === A && p[1] === B) || (p[0] === B && p[1] === A); });
    };
    var inPair = function (b) {
      return (preview && (b === preview.a || b === preview.b)) || pairs.some(function (p) { return p[0] === b || p[1] === b; });
    };

    /* links let go of each other after a while (not while held) */
    bodies.slice().forEach(function (b) {
      if (b.kind === "link" && !b.busy && !b.dragged && now >= b.splitAt) startSplit(b);
    });

    /* free shapes drift and coast */
    bodies.forEach(function (b) {
      if (b.kind === "ring" && !inPair(b)) b.goal = 0;
      if (b.busy || b.dragged) return;
      if (!STILL) {
        b.vx += Math.cos(t * 0.31 + b.phase) * WANDER * dt;
        b.vy += Math.sin(t * 0.27 + b.phase * 1.7) * WANDER * dt;
      }
      var sp = Math.hypot(b.vx, b.vy), damp = Math.exp((sp > CRUISE ? -1.4 : -0.2) * dt);
      b.vx *= damp; b.vy *= damp;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.kind === "link") {
        if (!STILL) b.va += Math.sin(t * 0.2 + b.phase) * 0.05 * dt;
        b.va *= Math.exp(-0.3 * dt);
        b.ang += b.va * dt;
      }
    });

    /* each ring's stretch rides a spring, so letting go wobbles back */
    bodies.forEach(function (b) {
      if (b.kind !== "ring" || b.busy) return;
      var acc = 260 * (b.goal - b.s) - 13 * b.sv;
      b.sv += acc * dt; b.s += b.sv * dt;
    });

    /* merges and splits move on (they carry their own momentum) */
    merges = merges.filter(function (mg) { return !stepMerge(mg, now); });
    splits = splits.filter(function (sp) { return !stepSplit(sp, now); });

    /* Every shape as a capsule round its spine (a ring's centre, a link's
       centre-to-centre line, which covers its waist too). A merging pair or
       a splitting link counts as one shape and is pushed like any other;
       only a ring in your hand stands firm. */
    var solids = [], held = new Set();
    merges.forEach(function (mg) {
      held.add(mg.a); held.add(mg.b);
      var far = mg.phase === "reach" ? [mg.b.x, mg.b.y]
        : [mg.a.x + Math.cos(mg.phi) * CAN, mg.a.y + Math.sin(mg.phi) * CAN];
      solids.push({ p0: [mg.a.x, mg.a.y], p1: far, v: mg,
        move: function (dx, dy) { mg.a.x += dx; mg.a.y += dy; mg.b.x += dx; mg.b.y += dy; } });
    });
    splits.forEach(function (sp) {
      var L = sp.L, cs = circlesOf(L);
      held.add(L);
      solids.push({ p0: cs[0], p1: cs[1], v: L, spin: L, move: function (dx, dy) { L.x += dx; L.y += dy; } });
    });
    bodies.forEach(function (b) {
      if (held.has(b)) return;
      var cs = circlesOf(b);
      solids.push({ p0: cs[0], p1: cs[cs.length - 1], v: b, body: b, fixed: !!b.dragged, spin: b.kind === "link" ? b : null,
        move: function (dx, dy) { b.x += dx; b.y += dy; } });
    });

    /* (b) everything keeps away from the mouse, mid-merge too: the nearer
       it is, the harder they move off, and a link turns away as well */
    if (AVOID && mouse) {
      solids.forEach(function (S) {
        if (S.fixed) return;
        var c = closest(S.p0, S.p1, [mouse.x, mouse.y], [mouse.x, mouse.y]);
        var n = c[0], ax = n[0] - mouse.x, ay = n[1] - mouse.y, dd = Math.hypot(ax, ay);
        if (dd >= AVOID_R) return;
        var acc = (1 - dd / AVOID_R) * R * 240, ux = dd ? ax / dd : 1, uy = dd ? ay / dd : 0;
        S.v.vx += ux * acc * dt; S.v.vy += uy * acc * dt;
        if (S.spin) {
          var ox = n[0] - S.spin.x, oy = n[1] - S.spin.y;
          S.spin.va += (ox * uy - oy * ux) / (HALF * HALF) * acc * dt * 0.5;
        }
      });
    }
    /* (b) the mouse's golf ball is solid too: nothing overlaps it, and what
       it runs into is knocked off at its speed */
    var ballS = null;
    if (AVOID && mouse && mouse.isMouse) {
      ballS = { p0: [mouse.x, mouse.y], p1: [mouse.x, mouse.y], fixed: true, ball: true,
                v: { vx: mouse.vx || 0, vy: mouse.vy || 0 }, move: function () {} };
      solids.push(ballS);
    }

    /* No overlaps: spines stay MIN apart (shape to ball: the ball's radius
       plus a ring's), and every capsule stays on screen. Four passes a
       frame, so a crowd, or a shove from the ball, settles without leaving
       any. */
    var shift = function (S, dx, dy) {
      S.move(dx, dy);
      S.p0 = [S.p0[0] + dx, S.p0[1] + dy]; S.p1 = [S.p1[0] + dx, S.p1[1] + dy];
    };
    var lo = R + LW, BALL_MIN = BALL_R + R + LW;
    for (var it = 0; it < 4; it++) {
      for (var i = 0; i < solids.length; i++) for (var j = i + 1; j < solids.length; j++) {
        var A = solids[i], B = solids[j];
        if (A.fixed && B.fixed) continue;
        if (A.body && B.body && paired(A.body, B.body)) continue;
        var need = A.ball || B.ball ? BALL_MIN : MIN;
        var cp = closest(A.p0, A.p1, B.p0, B.p1), dx = cp[1][0] - cp[0][0], dy = cp[1][1] - cp[0][1], dist = Math.hypot(dx, dy);
        if (dist >= need) continue;
        var nx, ny;
        if (dist > 0.01) { nx = dx / dist; ny = dy / dist; }
        else {                                   /* spines crossing: part them midpoint to midpoint */
          var mx0 = (B.p0[0] + B.p1[0] - A.p0[0] - A.p1[0]) / 2, my0 = (B.p0[1] + B.p1[1] - A.p0[1] - A.p1[1]) / 2, ml = Math.hypot(mx0, my0) || 1;
          nx = mx0 / ml || 1; ny = my0 / ml;
        }
        var wa = A.fixed ? 0 : 1, wb = B.fixed ? 0 : 1, w = wa + wb, over = need - dist;
        shift(A, -nx * over * wa / w, -ny * over * wa / w);
        shift(B, nx * over * wb / w, ny * over * wb / w);
        if (it === 0) {                          /* and they bounce (off the ball, at its speed) */
          var rv = (B.v.vx - A.v.vx) * nx + (B.v.vy - A.v.vy) * ny;
          if (rv < 0) {
            var jj = -rv * (A.ball || B.ball ? 1.8 : 1.5) / w;
            A.v.vx -= nx * jj * wa; A.v.vy -= ny * jj * wa;
            B.v.vx += nx * jj * wb; B.v.vy += ny * jj * wb;
          }
        }
      }
      solids.forEach(function (S) {             /* walls */
        if (S.ball) return;
        var x0 = Math.min(S.p0[0], S.p1[0]), x1 = Math.max(S.p0[0], S.p1[0]);
        var y0 = Math.min(S.p0[1], S.p1[1]), y1 = Math.max(S.p0[1], S.p1[1]);
        var dx = x0 < lo ? lo - x0 : x1 > W - lo ? W - lo - x1 : 0;
        var dy = y0 < lo ? lo - y0 : y1 > H - lo ? H - lo - y1 : 0;
        if (!dx && !dy) return;
        shift(S, dx, dy);
        if (S.fixed) return;
        if (dx) S.v.vx = Math.abs(S.v.vx) * Math.sign(dx) * 0.7;
        if (dy) S.v.vy = Math.abs(S.v.vy) * Math.sign(dy) * 0.7;
      });
    }

    /* merges and splits are drawn where the pushing left them */
    merges.forEach(placeMerge);
    splits.forEach(placeSplit);
  }

  function render() {
    if (ball) {
      var showBall = !!(mouse && mouse.isMouse);
      ball.setAttribute("visibility", showBall ? "visible" : "hidden");
      if (showBall) { place(ball, mouse.x, mouse.y); ball.spin.setAttribute("transform", "rotate(" + f2(mouse.roll % 360) + ")"); }
    }
    bodies.forEach(function (b) {
      if (b.busy) return;
      if (b.kind === "link") { place(b.el, b.x, b.y, b.ang * DEG - 45); return; }
      if (Math.abs(b.s) < 0.002 && Math.abs(b.sv) < 0.02) {
        if (!b.plain) { b.el.setAttribute("d", RING); b.plain = true; }
        place(b.el, b.x, b.y);
      } else {
        b.plain = false;
        b.el.setAttribute("d", d(mix(A0, A1, b.s)));
        place(b.el, b.x, b.y, b.face * DEG - 45);
      }
    });
  }

  /* Runs only while on screen: in a box further down a page it starts
     (rings drawing in) when scrolled to, and pauses when scrolled past. */
  var last = performance.now(), visible = true, running = false, populated = false;
  function frame(now) {
    if (!visible) { running = false; return; }
    var dt = Math.min(1 / 30, Math.max(0, now - last) / 1000);
    last = now;
    step(dt, now);
    render();
    requestAnimationFrame(frame);
  }
  function show() {
    if (!populated) { populated = true; populate(); }
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }

  /* ?debug=1: the live state, for checking from the console */
  if (q.get("debug") === "1") window.ringPlay = {
    bodies: function () { return bodies; }, merges: function () { return merges; }, splits: function () { return splits; },
    R: R, MIN: MIN, CAN: CAN, closest: closest, circlesOf: circlesOf,
    step: function (dt) { step(dt, performance.now()); render(); }
  };

  window.addEventListener("resize", measure);
  document.getElementById("reset").addEventListener("click", populate);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[es.length - 1].isIntersecting;
      if (visible) show();
    }).observe(svg);
  } else {
    show();
  }
})();
