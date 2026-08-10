# MatchPlay Homepage — Extracted Code

Extracted from the live homepage of `matchplaygroup.com` (a Webflow site) on 2026-08-10, packaged so it can be rebuilt or restyled with Claude Code. Use this only for a site you own or have permission to reproduce — the copy, images, and fonts belong to the site owner.

## What's in here

- `index.html` — the full homepage markup (rendered DOM, cleaned up), ready to open in a browser.
- `css/matchplay.css` — the site-wide Webflow stylesheet filtered down to only the rules actually used on the homepage (~64 KB, down from 276 KB). Includes the Webflow base/reset (`w-*` classes), all `@font-face` declarations, the site's custom classes, and all responsive breakpoints (991px / 767px / 479px).
- All images, the hero background video, and self-hosted fonts still point at the original Webflow CDN (`cdn.prod.website-files.com`), so the page renders identically without downloading assets. For a permanent rebuild, download those assets locally and rewrite the URLs.

## Page structure (top to bottom)

1. **Navbar** (`.navbar-no-shadow`) — dark bar (#2E2E31), logo, dropdown menus (Matches, Events, About), Log In / APPLY buttons. Uses Webflow's `w-nav` component; mobile hamburger behavior comes from the Webflow JS.
2. **Hero banner** (`.section_home_banner`) — 1400×634 container, autoplaying background video (right side), gradient overlay image, headline paragraph + "Get Matched today" CTA.
3. **Partners** (`.section_partners`) — "Match with our partners:" + 5-logo grid (CSS grid via `w-layout-layout`).
4. **Testimonials marquee** (`.section_testimonials_scroll`) — horizontally scrolling cards; the card list is duplicated twice for a seamless loop (animation driven by Webflow interactions).
5. **"We help founders get funded."** (`.section_about_us` + `.section_header_funded`) — large italic serif headline (Libre Baskerville spans).
6. **Why MatchPlay** (`.section_testimonials_scroll-copy`) — intro copy + embedded YouTube video (cP8NvaIw2B4).
7. **What We Offer** — two alternating cards: Investment (orange #F97D4A, with 4 fund logos) and Navigator (cyan #1ED2F4, with product screenshot), then "ApplY HERE" CTA.
8. **Match types** (`.section_match_types`) — "Skip the queue. Secure the connection." + color-coded categories (Investors, Mentors, Cofounders, Accelerators, Corporate Partners, DIY Tools).
9. **How To Get Started** (`.section_how_to_start`) — Step 1 Apply → Step 2 Investment Committee → Step 3 Due Diligence cards with arrow images, then Refine/Ready loop to Navigator + Investment cards.
10. **Triple feature** (`.section_triple_feature`) — three cyan cards: DUE DILIGENCE / COMMUNITY / THE "MATCH".
11. **Subscribe** (`.section_subscribe`) — email form (Webflow form, posts via Webflow's form handler — wire up your own backend when rebuilding).
12. **Footer** (`.footer-subscribe`) — logo, TEAM/PRESS links, copyright, Terms/Privacy.

Note: several sections exist in the markup but are hidden by CSS (`display:none`): `.section_investor_ready`, `.section_how_to_start-copy`, `.section_tee_off`, `.container_match_types`, plus nav items `.list-item`, `.tiers`, `.portfolio`. They're kept for fidelity.

## Design tokens

- Colors: dark bg `#2E2E31` / `#28282B` / `#2B2B2B`, card bg `#3B3B3F`, cyan `#1ED2F4` (hover `#2FBEDB`), orange `#F97D4A`, mint `#79E8C9`, purple `#D25AFF`, accent greens/blues for match titles (`#63D6B6`, `#25BEDB`, `#E86129`, `#BED015`, `#807DE5`).
- Fonts: headings **BW Gradual DEMO** (self-hosted OTF via @font-face, CDN URLs in the CSS); UI/mono accents **Share Tech Mono**; body **Inter**; italic serif accents **Libre Baskerville**; plus Avenir (self-hosted), Varela Round & Jost loaded but barely used.
- Buttons: `border-radius: 10–15px`, uppercase, letter-spacing 1.5px, Share Tech Mono.
- Cards: `border-radius: 30px`, soft shadows (`rgba(0,0,0,.2) 0 4px 15px`, light shadow on dark sections).

## What was changed vs. the live page

- Inline `<script>` bodies were dropped during extraction: Google Analytics (gtag), the Webflow tracking beacon, and the Finsweet cookie-consent loader are **not** included; the cookie-consent modal markup was also removed. The gtag ID and any custom inline JS must be re-added from the live site if needed.
- Webflow's runtime JS is still linked at the bottom of `index.html` (jQuery + webflow.js chunks from the CDN) — this powers dropdowns, the mobile menu, background video handling, form submission, and scroll interactions. `style="opacity:0"` initial states set by Webflow interactions were removed so all content is visible even if the interactions runtime doesn't run.
- The Google Fonts stylesheet URL lost its query string during extraction; it was replaced with the equivalent `WebFont.load` call using the exact family list from the live page.
- The Embedly wrapper around the YouTube embed was replaced with a direct YouTube iframe (same video).
- Query strings elsewhere (mostly cache-busting/analytics params) were stripped; asset URLs are unaffected.

## Rebuilding with Claude Code

Point Claude Code at this folder and ask it to, e.g.:
- "Recreate this page as a React/Next.js (or plain HTML/Tailwind) site using index.html and css/matchplay.css as the source of truth."
- Keep `css/matchplay.css` as the styling reference (selectors map 1:1 to class names in the HTML).
- Replace the Webflow runtime: the only JS behaviors needed are the nav dropdowns/mobile menu, the testimonial auto-scroll marquee, scroll-reveal fades (elements with `data-w-id`), and the newsletter form submit.
- Download CDN assets into `/assets` and rewrite URLs for a fully self-hosted build.
