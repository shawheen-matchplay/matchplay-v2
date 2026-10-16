/* MatchPlay homepage — behaviour.
   Replaces the Webflow/jQuery runtime with ~1KB of vanilla JS:
   mobile menu, nav dropdowns, testimonial marquee, scroll-reveal, form. */
(function () {
  "use strict";

  /* ---- Mobile menu -------------------------------------------------- */
  // Desktop dropdowns are pure CSS (:hover / :focus-within); only the
  // mobile panel needs JS.
  var hamburger = document.querySelector(".nav__hamburger");
  var mobileMenu = document.getElementById("nav-mobile");
  if (hamburger && mobileMenu) {
    // Index each row so CSS can stagger their entrance.
    Array.prototype.forEach.call(mobileMenu.children, function (child, i) {
      child.style.setProperty("--i", i);
    });

    function setMenu(open) {
      // Always reveal the list from the top, even if it was scrolled before.
      if (open) mobileMenu.scrollTop = 0;
      mobileMenu.classList.toggle("is-open", open);
      hamburger.classList.toggle("is-active", open);
      hamburger.setAttribute("aria-expanded", String(open));
    }
    hamburger.addEventListener("click", function () {
      setMenu(!mobileMenu.classList.contains("is-open"));
    });
    // Close when a link is chosen or on Escape
    mobileMenu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileMenu.classList.contains("is-open")) setMenu(false);
    });
  }

  /* ---- Hero lockup -------------------------------------------------- */
  // Track the tagline out until it spans the wordmark exactly, the way the
  // brand lockup sets it. letter-spacing also adds a trailing gap after the
  // last glyph, so pull that back off with a negative margin.
  var wordmark = document.getElementById("hero-wordmark");
  var tagline = document.getElementById("hero-tagline");
  if (wordmark && tagline) {
    var taglineChars = tagline.textContent.trim().length;

    function fitTagline() {
      tagline.style.letterSpacing = "0px";
      tagline.style.marginRight = "0px";
      var target = wordmark.getBoundingClientRect().width;
      var natural = tagline.getBoundingClientRect().width;
      if (!target || !natural || taglineChars < 2) return;
      // n glyphs give n-1 gaps between them, so size the gap off that. The
      // trailing gap after the last glyph is then cancelled by the margin,
      // which leaves the visible run spanning the wordmark exactly.
      // Never go negative: if a fallback face measures wider than the wordmark,
      // leave the tagline untracked rather than overlapping its own glyphs.
      var ls = Math.max(0, (target - natural) / (taglineChars - 1));
      tagline.style.letterSpacing = ls + "px";
      tagline.style.marginRight = -ls + "px";
    }

    fitTagline();
    // Re-fit once the webfonts land, otherwise the measurement is of the fallback.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTagline);

    var fitTimer;
    window.addEventListener("resize", function () {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitTagline, 150);
    });
  }

  /* ---- Nav clearance ----------------------------------------------- */
  // Full-screen sections are one screen tall less the fixed nav and a little
  // room under it (styles.css, "Every section fills one screen"). offsetTop
  // and offsetHeight, because the header can carry a reveal transform.
  var siteHeader = document.querySelector(".site-header");
  function setNavClear() {
    if (!siteHeader) return;
    document.documentElement.style.setProperty("--nav-clear",
      (siteHeader.offsetTop + siteHeader.offsetHeight + 16) + "px");
  }
  setNavClear();
  window.addEventListener("resize", setNavClear);

  /* ---- Marquees (testimonials, homepage ticker) --------------------- */
  // Duplicate the items so the -50% keyframe loops seamlessly.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-marquee]"), function (track) {
      Array.prototype.slice.call(track.children).forEach(function (node) {
        var clone = node.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
    });
  }

  /* ---- Scroll reveal ------------------------------------------------ */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    // Index each element among its revealed siblings. CSS turns that into a
    // transition-delay, so a row of cards cascades rather than popping in at
    // once. Capped so a long grid never ends up waiting on a visible delay.
    var counts = [];
    var parents = [];
    Array.prototype.forEach.call(reveals, function (el) {
      var p = el.parentElement;
      var k = parents.indexOf(p);
      if (k === -1) { k = parents.push(p) - 1; counts[k] = 0; }
      el.style.setProperty("--i", Math.min(counts[k]++, 6));
    });

    var observed = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          observed = true;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
      // A percentage threshold never fires for an element taller than the
      // viewport, so trigger on first contact and pull the line up instead.
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });

    // The CSS hides every .reveal, so if the observer never reports anything —
    // a tab loaded in the background is the common case — the page would sit
    // blank. Show it all rather than let that happen.
    setTimeout(function () {
      if (observed) return;
      reveals.forEach(function (el) { el.classList.add("is-visible"); });
    }, 1500);
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---- Pipeline: a golf ball rolls the stages ----------------------- */
  // The ball travels node to node, rotating by the distance it covers, and
  // lights each stage on arrival; at the last it drops into the cup. It runs
  // only while the track is on screen, and restarts from the top each time
  // it comes back. Timers rather than rAF, so a background tab cannot leave
  // it stranded part-way.
  var DIMPLES = [[0.77, -0.32], [0.43, 0.03], [0.77, 0.03], [0.08, 0.37], [0.43, 0.37],
                 [0.77, 0.37], [-0.26, 0.72], [0.08, 0.71], [0.43, 0.71]];  // the brand mark's wedge
  // The ball is drawn on a radius of 1. A dark rim (about 1.5px on the 1.6rem
  // ball) keeps the white ball clear of a white band, and the wedge is drawn
  // at 78% so its outer dimples sit 1-2px inside the rim instead of on it.
  var RIM = 0.12, WEDGE = 0.78;
  var SEG = 560, PAUSE = 200, HOLD = 2200;
  var EASE = "cubic-bezier(0.45, 0.05, 0.3, 1)";
  var stillMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  Array.prototype.forEach.call(document.querySelectorAll(".pipeline-run[data-ball]"), function (wrap) {
    var list = wrap.querySelector(".pipeline");
    var stages = list ? list.querySelectorAll("li") : [];
    if (stillMotion || stages.length < 2 || !("IntersectionObserver" in window)) return;

    var NS = "http://www.w3.org/2000/svg";
    var ball = document.createElement("span");
    ball.className = "pipeline__ball";
    ball.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "-1 -1 2 2");
    var body = document.createElementNS(NS, "circle");
    body.setAttribute("r", String(1 - RIM / 2));          // the rim's outer edge lands on the box
    body.setAttribute("stroke-width", String(RIM));
    body.setAttribute("class", "pipeline__ball-body");
    svg.appendChild(body);
    DIMPLES.forEach(function (d) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", d[0] * WEDGE);
      c.setAttribute("cy", d[1] * WEDGE);
      c.setAttribute("r", String(0.118 * WEDGE));
      c.setAttribute("class", "pipeline__ball-dimple");
      svg.appendChild(c);
    });
    ball.appendChild(svg);
    var fill = document.createElement("span");
    fill.className = "pipeline__fill";
    fill.setAttribute("aria-hidden", "true");
    wrap.appendChild(fill);
    wrap.appendChild(ball);
    ball.style.opacity = "0";

    var pts, vertical, x, y, roll, scale, run = 0, timers = [], onScreen = false;

    // Node centres, read off the rendered track so the ball follows whichever
    // layout is showing: across on desktop, down the side on a phone.
    function measure() {
      vertical = stages[1].offsetTop > stages[0].offsetTop + 2;
      pts = Array.prototype.map.call(stages, function (li) {
        var node = getComputedStyle(li, "::after");
        var r = parseFloat(node.width) / 2 || 9;
        var top = parseFloat(node.top) || 0;
        return [li.offsetLeft + (vertical ? r : li.offsetWidth / 2), li.offsetTop + top + r];
      });
      // the filled track starts at the first node and grows along one axis
      fill.style.left = (pts[0][0] - (vertical ? 1 : 0)) + "px";
      fill.style.top = (pts[0][1] - (vertical ? 0 : 1)) + "px";
      fill.style.width = vertical ? "2px" : "0px";
      fill.style.height = vertical ? "0px" : "2px";
    }

    function paint(ms) {
      var r = ball.offsetWidth / 2;
      ball.style.transition = ms
        ? "transform " + ms + "ms " + EASE + ", opacity 0.35s ease"
        : "opacity 0.35s ease";
      ball.style.transform = "translate(" + (x - r) + "px," + (y - r) + "px) rotate(" + roll + "deg) scale(" + scale + ")";
    }
    function grow(i, ms) {
      var len = vertical ? pts[i][1] - pts[0][1] : pts[i][0] - pts[0][0];
      fill.style.transition = ms ? (vertical ? "height " : "width ") + ms + "ms " + EASE + ", opacity 0.5s ease" : "opacity 0.5s ease";
      fill.style[vertical ? "height" : "width"] = len + "px";
    }
    function later(ms, fn) {
      var me = run;
      timers.push(setTimeout(function () { if (me === run) fn(); }, ms));
    }
    function stop() {
      run++;
      timers.forEach(clearTimeout);
      timers = [];
    }
    function reach(i, on) { stages[i].classList.toggle("is-reached", on); }

    function cycle() {
      stop();
      measure();
      list.classList.add("is-live");
      for (var k = 0; k < stages.length; k++) { reach(k, false); stages[k].classList.remove("is-cup"); }
      fill.style.opacity = "1";
      x = pts[0][0]; y = pts[0][1]; roll = 0; scale = 0.6;
      ball.style.opacity = "0";
      paint(0);
      grow(0, 0);
      ball.getBoundingClientRect();                  // commit the start before moving

      later(60, function () { scale = 1; ball.style.opacity = "1"; paint(350); reach(0, true); });

      var t = 600, last = stages.length - 1;
      var circumference = Math.PI * ball.offsetWidth;
      for (var i = 1; i <= last; i++) {
        (function (i, at) {
          later(at, function () {
            var d = Math.hypot(pts[i][0] - x, pts[i][1] - y);
            x = pts[i][0]; y = pts[i][1];
            roll += d / circumference * 360;         // rotate by distance: it rolls
            paint(SEG);
            grow(i, SEG);
          });
          later(at + SEG, function () {
            reach(i, true);
            if (i !== last) return;
            scale = 0.3;                             // into the cup
            ball.style.opacity = "0";
            paint(350);
            stages[i].classList.add("is-cup");
            later(420, function () { stages[i].classList.remove("is-cup"); });
          });
        })(i, t);
        t += SEG + PAUSE;
      }
      later(t + HOLD, function () {                  // clear the board and go again
        for (var k = 0; k < stages.length; k++) reach(k, false);
        fill.style.opacity = "0";
      });
      later(t + HOLD + 700, cycle);
    }

    new IntersectionObserver(function (entries) {
      var now = entries[entries.length - 1].isIntersecting;
      if (now === onScreen) return;
      onScreen = now;
      if (onScreen) cycle();
      else stop();
    }, { threshold: 0.4 }).observe(wrap);

    // Width only: phones fire resize whenever the URL bar shows or hides,
    // which would otherwise restart the run on every scroll.
    var resizeT, lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(resizeT);
      resizeT = setTimeout(function () { if (onScreen) cycle(); }, 200);
    });
  });

  /* ---- Pointer cards (data-tilt) ------------------------------------ */
  // Every data-tilt box gets a decorative .fx layer: the accent rule along its
  // top and the glow (styles.css, "Pointer cards"). For a mouse or pen the box
  // also tilts toward the pointer, drifts a little with it, and the glow
  // follows it. Touch and reduced motion keep the plain hover. The transform
  // and its transition are set on the element itself: most of these boxes are
  // also .reveal, whose rule gives transform a 0.6s transition plus a stagger
  // delay, which would make the tilt trail behind the pointer.
  var tiltCards = document.querySelectorAll("[data-tilt]");
  Array.prototype.forEach.call(tiltCards, function (card) {
    if (card.querySelector(":scope > .fx")) return;
    var fx = document.createElement("span");
    fx.className = "fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = '<span class="fx__orb"></span>';
    card.insertBefore(fx, card.firstChild);
  });
  var canTilt = window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (tiltCards.length && canTilt) {
    var DRIFT = 4;    // total drift in px
    var LIFT = 4;     // px the card rises while tracked
    Array.prototype.forEach.call(tiltCards, function (card) {
      var settle;
      // data-tilt="2" allows 2 degrees either way; bare data-tilt means 1
      var TILT = 2 * (parseFloat(card.getAttribute("data-tilt")) || 1);
      card.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        clearTimeout(settle);
        card.classList.add("is-tracking");
        card.style.transition = "transform 0.15s ease-out, background-color 0.4s, border-color 0.4s, box-shadow 0.4s";
      });
      card.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        var r = card.getBoundingClientRect();
        var x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);   // 0 at left, 1 at right
        var y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);   // 0 at top, 1 at bottom
        card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        // the edge under the pointer comes toward the viewer
        card.style.transform = "perspective(900px)" +
          " rotateX(" + ((y - 0.5) * TILT).toFixed(2) + "deg)" +
          " rotateY(" + ((0.5 - x) * TILT).toFixed(2) + "deg)" +
          " translate3d(" + ((x - 0.5) * DRIFT).toFixed(1) + "px," + (-LIFT + (y - 0.5) * DRIFT).toFixed(1) + "px,0)";
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tracking");
        card.style.transition = "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.4s, border-color 0.4s, box-shadow 0.4s";
        card.style.transform = "";
        card.style.removeProperty("--mx");
        card.style.removeProperty("--my");
        // once it has eased back, hand the transition back to the stylesheet
        settle = setTimeout(function () { card.style.transition = ""; }, 650);
      });
    });
  }

  /* ---- Paginated list (blog index) --------------------------------- */
  // Every item is already in the HTML, so the full list is there without
  // JavaScript and for search engines; this only shows one page at a time.
  // The page lives in the URL (?page=2), so back, forward and shared links work.
  var pageList = document.querySelector("[data-paginate]");
  var pager = document.querySelector("[data-pager]");
  if (pageList && pager) {
    var perPage = parseInt(pageList.getAttribute("data-paginate"), 10) || 10;
    var entries = Array.prototype.slice.call(pageList.children);
    var pageCount = Math.ceil(entries.length / perPage);

    var pageFromUrl = function () {
      var q = new URLSearchParams(location.search), n = q.get("page");
      // Webflow's pagination used ?<id>_page=N; honour old links to it
      if (!n) q.forEach(function (v, k) { if (/_page$/.test(k)) n = v; });
      return Math.min(Math.max(parseInt(n, 10) || 1, 1), pageCount);
    };
    var pageLink = function (n, label, current, disabled) {
      var el = document.createElement(disabled ? "span" : "a");
      el.textContent = label;
      if (disabled) { el.className = "is-disabled"; el.setAttribute("aria-disabled", "true"); }
      else { el.href = n === 1 ? location.pathname : "?page=" + n; el.setAttribute("data-page", n); }
      if (current) el.setAttribute("aria-current", "page");
      return el;
    };
    var showPage = function (n) {
      entries.forEach(function (el, i) { el.hidden = Math.floor(i / perPage) !== n - 1; });
      pager.textContent = "";
      pager.hidden = pageCount < 2;
      if (pageCount < 2) return;
      pager.appendChild(pageLink(n - 1, "← Prev", false, n === 1));
      for (var i = 1; i <= pageCount; i++) pager.appendChild(pageLink(i, String(i), i === n, false));
      pager.appendChild(pageLink(n + 1, "Next →", false, n === pageCount));
    };

    pager.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-page]");
      if (!a) return;
      e.preventDefault();
      var n = parseInt(a.getAttribute("data-page"), 10);
      history.pushState({ page: n }, "", a.getAttribute("href"));
      showPage(n);
      (pageList.closest("section") || pageList).scrollIntoView();   // honours the CSS scroll-behavior
    });
    window.addEventListener("popstate", function () { showPage(pageFromUrl()); });
    showPage(pageFromUrl());
  }

  /* ---- Subscribe form ---------------------------------------------- */
  // No backend yet — show the success state locally. Wire up a real
  // endpoint (fetch POST) where indicated when a backend exists.
  var form = document.querySelector("[data-subscribe]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      form.classList.add("is-done");
      form.reset();
    });
  }
})();
