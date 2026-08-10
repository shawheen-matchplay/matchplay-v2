/* MatchPlay homepage — behaviour.
   Replaces the Webflow/jQuery runtime with ~1KB of vanilla JS:
   mobile menu, nav dropdowns, testimonial marquee, scroll-reveal, form. */
(function () {
  "use strict";

  /* ---- Mobile menu -------------------------------------------------- */
  var hamburger = document.querySelector(".nav__hamburger");
  var collapse = document.getElementById("nav-collapse");
  if (hamburger && collapse) {
    hamburger.addEventListener("click", function () {
      var open = collapse.classList.toggle("is-open");
      hamburger.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---- Nav dropdowns ------------------------------------------------ */
  var dropdowns = Array.prototype.slice.call(document.querySelectorAll("[data-dropdown]"));

  function closeAll(except) {
    dropdowns.forEach(function (d) {
      if (d === except) return;
      d.setAttribute("data-open", "false");
      var t = d.querySelector(".nav__dropdown-toggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }

  dropdowns.forEach(function (d) {
    var toggle = d.querySelector(".nav__dropdown-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = d.getAttribute("data-open") === "true";
      closeAll(d);
      d.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
    });

    // Hover to open on pointer devices (desktop)
    if (window.matchMedia("(hover: hover) and (min-width: 992px)").matches) {
      d.addEventListener("mouseenter", function () { closeAll(d); d.setAttribute("data-open", "true"); toggle.setAttribute("aria-expanded", "true"); });
      d.addEventListener("mouseleave", function () { d.setAttribute("data-open", "false"); toggle.setAttribute("aria-expanded", "false"); });
    }
  });

  document.addEventListener("click", function () { closeAll(null); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(null); });

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
