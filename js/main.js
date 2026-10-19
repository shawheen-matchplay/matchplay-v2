/* MatchPlay homepage — behaviour.
   Replaces the Webflow/jQuery runtime with ~1KB of vanilla JS:
   mobile menu, nav dropdowns, testimonial marquee, scroll-reveal, form. */
(function () {
  "use strict";

  /* ---- Current page in the nav ------------------------------------- */
  // Marks the nav link for the page being viewed, and for a page inside a
  // dropdown the dropdown's own button too. Done here rather than in each
  // file, so the generated blog pages and draft pages pick it up as well.
  function pageKey(href) {
    if (/^[a-z]+:/i.test(href)) return null;              // other sites, mailto
    var key = href.split(/[?#]/)[0].split("/").pop().replace(/\.html$/, "");
    return key || "index";
  }
  var here = pageKey(location.pathname);
  if (/\/blog\//.test(location.pathname)) here = "blog";   // a post counts as Blog
  if (/^press-/.test(here)) here = "press";                 // a release counts as Press
  here = here.replace(/-v\d+$/, "");                       // a draft, page-v2, counts as its page
  Array.prototype.forEach.call(document.querySelectorAll(".nav__menu a, .nav__mobile a"), function (a) {
    if (pageKey(a.getAttribute("href")) !== here) { a.removeAttribute("aria-current"); return; }
    a.setAttribute("aria-current", "page");
    var dropdown = a.closest(".nav__dropdown");
    if (dropdown) dropdown.classList.add("is-current");
  });

  /* ---- Desktop dropdowns -------------------------------------------- */
  // They open on :hover and stay open on :focus-within, for keyboard users.
  // A mouse click also focuses the button, which kept that dropdown open
  // after the pointer moved on (even while another one was open). When a
  // mouse leaves a dropdown, let go of the focus the click left behind.
  Array.prototype.forEach.call(document.querySelectorAll(".nav__dropdown"), function (dd) {
    dd.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse") return;
      var focused = document.activeElement;
      if (focused && dd.contains(focused)) focused.blur();
    });
  });

  /* ---- Mobile menu -------------------------------------------------- */
  // The mobile panel opens and closes from the hamburger.
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

  /* ---- Lockups ------------------------------------------------------ */
  // Track a line of small caps out until it spans the name above it exactly,
  // the way the brand lockup sets it: the homepage tagline under the
  // wordmark, and any element with data-fit-to="<id of the name>" (the blog's
  // title). letter-spacing also adds a trailing gap after the last glyph, so
  // pull that back off with a negative margin.
  var lockups = [];
  var heroWordmark = document.getElementById("hero-wordmark");
  var heroTagline = document.getElementById("hero-tagline");
  if (heroWordmark && heroTagline) lockups.push([heroWordmark, heroTagline]);
  Array.prototype.forEach.call(document.querySelectorAll("[data-fit-to]"), function (el) {
    var name = document.getElementById(el.getAttribute("data-fit-to"));
    if (name) lockups.push([name, el]);
  });

  function fitLockup(name, line) {
    var chars = line.textContent.trim().length;
    line.style.letterSpacing = "0px";
    line.style.marginRight = "0px";
    var target = name.getBoundingClientRect().width;
    var natural = line.getBoundingClientRect().width;
    if (!target || !natural || chars < 2) return;
    // n glyphs give n-1 gaps between them, so size the gap off that. The
    // trailing gap after the last glyph is then cancelled by the margin,
    // which leaves the visible run spanning the name exactly.
    // Never go negative: if a fallback face measures wider than the name,
    // leave the line untracked rather than overlapping its own glyphs.
    var ls = Math.max(0, (target - natural) / (chars - 1));
    line.style.letterSpacing = ls + "px";
    line.style.marginRight = -ls + "px";
  }
  function fitLockups() { lockups.forEach(function (l) { fitLockup(l[0], l[1]); }); }

  if (lockups.length) {
    fitLockups();
    // Re-fit once the webfonts land, otherwise the measurement is of the fallback.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLockups);
    // Every frame while the window is dragged, so the line keeps up live.
    var fitFrame = 0;
    window.addEventListener("resize", function () {
      if (!fitFrame) fitFrame = requestAnimationFrame(function () { fitFrame = 0; fitLockups(); });
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
      (siteHeader.offsetTop + siteHeader.offsetHeight + 8) + "px");
  }
  setNavClear();
  window.addEventListener("resize", setNavClear);

  /* ---- Background videos -------------------------------------------- */
  // Reduced motion: stop on the poster frame instead of playing.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    Array.prototype.forEach.call(document.querySelectorAll("video[data-bg-video]"), function (v) {
      v.removeAttribute("autoplay");
      v.pause();
    });
  }

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

  /* ---- Founder story videos ----------------------------------------- */
  // Each story card shows its video's thumbnail with a play button (a link
  // to it on YouTube). Clicking swaps in the player, already playing. A live
  // embed from the start swallowed the pointer, so the card's tilt and glow
  // froze while the mouse was over the video; this way they follow it
  // everywhere until a video is actually playing.
  Array.prototype.forEach.call(document.querySelectorAll(".story__poster[data-yt]"), function (poster) {
    poster.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;   // a new tab: leave it to the link
      e.preventDefault();
      var frame = document.createElement("iframe");
      frame.src = "https://www.youtube-nocookie.com/embed/" + poster.getAttribute("data-yt") + "?autoplay=1&rel=0";
      frame.title = (poster.getAttribute("aria-label") || "Video").replace(/^Play: /, "");
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      poster.replaceWith(frame);
      frame.focus();
    });
  });

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
        // where the node actually sits across its stage (centred, either way)
        var left = parseFloat(node.left) + (parseFloat(node.marginLeft) || 0);
        return [li.offsetLeft + (isNaN(left) ? li.offsetWidth / 2 - r : left) + r, li.offsetTop + top + r];
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

  /* ---- Matched heights ---------------------------------------------- */
  // Boxes that share a data-match name are kept at one height, the tallest
  // one's. For boxes in different sections, which a grid can't line up: the
  // homepage's closing call to action and newsletter.
  var matchGroups = {};
  Array.prototype.forEach.call(document.querySelectorAll("[data-match]"), function (el) {
    var name = el.getAttribute("data-match");
    (matchGroups[name] = matchGroups[name] || []).push(el);
  });
  function matchHeights() {
    Object.keys(matchGroups).forEach(function (name) {
      var els = matchGroups[name];
      els.forEach(function (el) { el.style.minHeight = ""; });
      var tallest = Math.max.apply(null, els.map(function (el) { return el.offsetHeight; }));
      els.forEach(function (el) { el.style.minHeight = tallest + "px"; });
    });
  }
  if (Object.keys(matchGroups).length) {
    matchHeights();
    window.addEventListener("resize", matchHeights);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(matchHeights);
  }

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
    fx.innerHTML = '<span class="fx__orb fx__orb--rest"></span><span class="fx__orb fx__orb--pointer"></span>';
    card.insertBefore(fx, card.firstChild);
  });
  var canTilt = window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (tiltCards.length && canTilt) {
    var DRIFT = 4;    // total drift in px
    var LIFT = 4;     // px the card rises while tracked
    // The card is measured once when the pointer comes in (again only if the
    // page scrolls meanwhile), not on every move: reading its box after each
    // tilt forced the browser to lay the page out again mid-frame. Moves are
    // gathered into one update per frame.
    var scrolled = 0;
    window.addEventListener("scroll", function () { scrolled++; }, { passive: true });
    Array.prototype.forEach.call(tiltCards, function (card) {
      var settle, box = null, boxAt = -1, last = null, frame = 0;
      // data-tilt="2" allows 2 degrees either way; bare data-tilt means 1
      var TILT = 2 * (parseFloat(card.getAttribute("data-tilt")) || 1);
      function measure() {
        var r = card.getBoundingClientRect();
        box = { left: r.left, top: r.top, w: card.offsetWidth, h: card.offsetHeight };
        boxAt = scrolled;
      }
      function place(e) {
        if (!box || boxAt !== scrolled) measure();
        var x = Math.min(Math.max((e.clientX - box.left) / box.w, 0), 1);   // 0 at left, 1 at right
        var y = Math.min(Math.max((e.clientY - box.top) / box.h, 0), 1);    // 0 at top, 1 at bottom
        card.style.setProperty("--gx", (x * box.w).toFixed(1) + "px");
        card.style.setProperty("--gy", (y * box.h).toFixed(1) + "px");
        return [x, y];
      }
      function update() {
        frame = 0;
        if (!last) return;
        var xy = place(last), x = xy[0], y = xy[1];
        // the edge under the pointer comes toward the viewer
        card.style.transform = "perspective(900px)" +
          " rotateX(" + ((y - 0.5) * TILT).toFixed(2) + "deg)" +
          " rotateY(" + ((0.5 - x) * TILT).toFixed(2) + "deg)" +
          " translate3d(" + ((x - 0.5) * DRIFT).toFixed(1) + "px," + (-LIFT + (y - 0.5) * DRIFT).toFixed(1) + "px,0)";
      }
      card.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        clearTimeout(settle);
        // Put the pointer's glow under the pointer before it starts showing,
        // so it appears there rather than travelling from its last spot.
        measure();
        place(e);
        card.getBoundingClientRect();
        card.classList.add("is-tracking");
        card.style.transition = "transform 0.15s ease-out, background-color 0.4s, border-color 0.4s, box-shadow 0.4s";
      });
      card.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        last = { clientX: e.clientX, clientY: e.clientY };
        if (!frame) frame = requestAnimationFrame(update);
      });
      card.addEventListener("pointerleave", function () {
        cancelAnimationFrame(frame); frame = 0; last = null; box = null;
        card.classList.remove("is-tracking");
        card.style.transition = "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.4s, border-color 0.4s, box-shadow 0.4s";
        card.style.transform = "";
        // --gx/--gy stay put, so the pointer's glow fades out where it was
        // once it has eased back, hand the transition back to the stylesheet
        settle = setTimeout(function () { card.style.transition = ""; }, 650);
      });
    });
  }

  // Touch screens have no hover, so a box takes the hover look as it scrolls
  // across a line just above the middle of the screen: its top rule draws
  // across, the glow comes up and travels down through it as it passes, and
  // it rocks a degree on the way through (not with reduced motion). In a
  // moving strip (data-marquee) only the box in the middle of the screen
  // lights. Only boxes on screen are looked at, and only while they are.
  var touchCards = tiltCards.length && !canTilt && window.matchMedia("(hover: none)").matches;
  if (touchCards && "IntersectionObserver" in window) {
    var stillCards = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var FOCUS = 0.45;                        // the line, as a share of the screen's height
    var onScreen = new Set(), cardRaf = 0;
    var EASE_IN = "transform 0.3s ease-out, background-color 0.4s, border-color 0.4s, box-shadow 0.4s";
    var EASE_OUT = "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.4s, border-color 0.4s, box-shadow 0.4s";
    var setActive = function (card, on) {
      if (on === card.classList.contains("is-active")) return;
      card.classList.toggle("is-active", on);
      card.classList.toggle("is-tracking", on);
      card.style.transition = on ? EASE_IN : EASE_OUT;
      if (!on) { card.style.transform = ""; card._q = null; }
    };
    var updateCards = function () {
      cardRaf = 0;
      var vh = window.innerHeight, mid = window.innerWidth / 2, line = vh * FOCUS;
      onScreen.forEach(function (card) {
        var r = card.getBoundingClientRect();
        var q = (line - r.top) / r.height;   // 0: top edge on the line .. 1: bottom edge on it
        var on = q >= 0 && q <= 1 && (!card.closest("[data-marquee]") || (r.left <= mid && r.right >= mid));
        setActive(card, on);
        if (!on || (card._q != null && Math.abs(q - card._q) < 0.002)) return;
        card._q = q;
        card.style.setProperty("--gx", (r.width * (0.3 + 0.4 * q)).toFixed(1) + "px");
        card.style.setProperty("--gy", (r.height * q).toFixed(1) + "px");
        if (!stillCards) {
          var TILT = 2 * (parseFloat(card.getAttribute("data-tilt")) || 1);
          card.style.transform = "perspective(900px) rotateX(" + ((0.5 - q) * TILT).toFixed(2) + "deg) translate3d(0,-4px,0)";
        }
      });
      if (onScreen.size) cardRaf = requestAnimationFrame(updateCards);
    };
    var cardWatch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) onScreen.add(e.target);
        else { onScreen.delete(e.target); setActive(e.target, false); }
      });
      if (onScreen.size && !cardRaf) cardRaf = requestAnimationFrame(updateCards);
    });
    Array.prototype.forEach.call(tiltCards, function (card) { cardWatch.observe(card); });
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
  // (The homepage's box, and the footer's field on every other page.)
  // Signups go to a Google Sheet through a small Apps Script web app
  // (tools/newsletter/signup-sheet.gs, which has the set-up steps). The
  // thank-you only shows once the sheet has the address. Form-encoded, so the
  // request needs no CORS preflight; Apps Script answers with JSON.
  var NEWSLETTER_ENDPOINT = "https://script.google.com/macros/s/AKfycbw9x8rDHD_0OK2axofUHNZnKUg2ARovkFNwwZKnFfhyj9WPHH5vv49EfPQgBD3_SNld/exec";
  Array.prototype.forEach.call(document.querySelectorAll("[data-subscribe]"), function (form) {
    var note = form.parentElement.querySelector(".subscribe__success, .footer__news-done");
    var thanks = note ? note.innerHTML : "";
    var button = form.querySelector('[type="submit"]');
    function show(ok, msg) {
      form.classList.add("is-done");
      form.classList.toggle("is-error", !ok);
      if (note) note.innerHTML = msg;
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (!NEWSLETTER_ENDPOINT) {                       // not set up yet: thank them, save nothing
        console.warn("Newsletter: no endpoint set; nothing was saved.");
        show(true, thanks);
        form.reset();
        return;
      }
      var data = new URLSearchParams({
        email: form.elements.email.value.trim(),
        page: location.pathname,
        form: form.classList.contains("footer__news") ? "footer" : form.classList.contains("blog-subscribe") ? "blog" : "homepage"
      });
      button.disabled = true;
      fetch(NEWSLETTER_ENDPOINT, { method: "POST", body: data })
        .then(function (res) { return res.json(); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.error);
          show(true, thanks);
          form.reset();
        })
        .catch(function () {
          show(false, "That didn&rsquo;t go through &mdash; please try again.");
        })
        .then(function () { button.disabled = false; });
    });
  });
})();
