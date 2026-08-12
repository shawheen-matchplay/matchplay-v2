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
    function setMenu(open) {
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

  /* ---- Testimonial marquee ----------------------------------------- */
  // Duplicate the items so the -50% keyframe loops seamlessly.
  var track = document.querySelector("[data-marquee]");
  if (track && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
  }

  /* ---- Scroll reveal ------------------------------------------------ */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
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
