# MatchPlay Group website: notes for Claude

This is the rebuild of **matchplaygroup.com**, a plain static site (HTML, CSS and
vanilla JS, no framework, no bundler). It is owned and directed by **Shawheen
Attar** (co-founder; GitHub `shawheen-matchplay`). Read this file first: it
holds the decisions, preferences and gotchas from the sessions that built the
site (Aug to Oct 2026), so you don't repeat old mistakes or undo deliberate
choices.

`README.md` is out of date: it describes the original Webflow extraction this
repo started from (August 2026), not the current site. Trust this file and the
code over it.

---

## 1. How Shawheen works (follow these)

- **Commit and push to `main` after every change**, without asking. He
  iterates fast in small steps and checks the live site. One commit per
  request, a clear message, ending with the attribution trailer the system
  gives you. Git identity is `shawheen-matchplay <shawheen@matchplaygroup.com>`
  (global config). Never commit as the old `shawheen-wc` Workcore identity.
- **Live site**: GitHub Pages serves `main` at
  https://shawheen-matchplay.github.io/matchplay-v2/ (about a minute after a push;
  a hard refresh may be needed). Vercel is the likely host later.
- **He sends follow-up messages mid-task.** Treat each as a new request: finish
  or fold it in, and report both.
- **Short replies, outcome first.** He reads on desktop and phone. Say what
  changed, give exact numbers when tuning (e.g. "tint 75% → 69%"), and say
  plainly what you did not verify.
- **When he asks "thoughts?" or "what's better?"**, give a recommendation (and
  a quick outline) and offer to build it; don't build unasked. When he asks to
  "draft" or "compare", build a separate variant page (e.g. `founders-v2.html`,
  `glass-demo.html`), commit it, and only replace the main page when he says
  so ("swap to main", "put v2 on the main site"), then delete the variant.
- **Verify in the browser before reporting** (see §9 for the preview quirks).
  Screenshot or measure; don't claim visuals you didn't see.
- **Ask before** downloading or installing anything, before anything
  irreversible, and before publishing anywhere new. ffmpeg (brew) and Upscayl
  (cask) were approved and are installed.
- **Never handle secrets**: the blog editor's GitHub token is created and set
  by Shawheen himself (§7). Never type passwords or tokens.
- **Don't kill his processes** (he once had his own server on port 4599).
- Tuning requests are often iterative ("too much", "less", "try 75%",
  "take it back to how it was"). Keep the previous value in your head so you
  can revert exactly, and say what the old and new values are.

## 2. What MatchPlay is (positioning, from the strategy brief)

- **MatchPlay Group** = "The Venture Standard": *one platform connecting
  companies and investors to manage diligence, fundraising, and syndication.*
  It helps a company become **fundable and administratively ready**: pitch
  review, institutional-quality diligence, data room, fundraising preparation,
  investor matching (Capital Partners), and SPV coordination/administration.
- **MatchPlay Ventures** (separate, orange brand, matchplayventures.com)
  **independently** decides which companies are investable and may sponsor
  investments. The Group site must **not look like a venture fund**.
- **Capital Partners** = the investor network (200+ funds) matched to
  companies by stage, sector, check size, geography, thesis, etc. Investors
  sign up at `https://app.matchplaygroup.com/#/auth/investor-signup`.
- Lifecycle: Diligence → Fundraising Readiness → Investor Engagement →
  Syndication → Investment → Portfolio → Follow-on → Liquidity.
- Audience: founders, CEOs/CFOs, startup teams, accelerators, angel groups,
  universities, funds referring companies, syndicate organizers.
- Copy that has been corrected (don't regress):
  - Capital Partners "Curated, not a marketplace": *We only share qualified
    startups that have passed multiple filters, and we highlight those we've
    conducted diligence on.* (NOT "only opportunities MatchPlay Ventures has
    chosen to back"; a co-founder flagged that as untrue. The neighbouring
    "Diligence-backed" card may need the same softening; ask.)
  - Homepage line: "Better investor matching. Not just investor names."
  - "200+ funds" / "200 funds", not other numbers.
  - The CTA is **"Apply for Diligence"** everywhere (never "Start Diligence").
  - "Talk to MatchPlay" → `mailto:info@matchplaygroup.com`.
  - Press "Media inquiries" → reach out to the MatchPlay team (info@ email); no named person.

## 3. Site map and files

| Page | File | Notes |
|---|---|---|
| Home | `index.html` | `body.page--screens.page--home`; hero animation, ticker, ecosystem, process, diligence, Capital Partners, syndication, founder voices, closing CTA + newsletter, ring toy |
| Founders | `founders.html` | testimonial marquee hero, story cards with company links (none for Amar), Anthony Dann feature quote |
| Capital Partners | `capital-partners.html` | `page--ventures` (orange accent); anchors `#why #how #what-you-see #spv #after #join` |
| Match House | `match-house.html` | one screen over `assets/match-house/recap.mp4`; title Lexend Zetta Black, subtitle Lexend Mega Black; links out to matchhouse.events |
| Partners | `partners.html` | 26 transparent logos in `assets/partners/` (HubSpot, Deel, Shopline, Leader Bank, Patterns, Gildre, CoffeeSpace first) |
| Team | `team.html` | fully dark; opens on "Our team" (the page's h1; the mission hero was removed Oct 2026), then the join box; 1200×1200 headshots in `assets/team/` (head ~60% of frame, eyes ~39% down, upscaled 4×), LinkedIn links bottom-right |
| Press | `press.html`, `press-*.html` | "All press" link at top and bottom |
| Summits | `summit-2024.html` (`page--purple`), `summit-2025.html` | |
| Blog | `blog.html`, `blog/<slug>.html` | **generated**, see §7. Title "The Warm Intro" / "A MatchPlay Blog" |
| Legal | `terms.html`, `privacy.html`, `acceptable-use.html`, `copyright-trademark.html` | text carried over verbatim from the old site's `/legal/*` (Oct 2026); release column with a tab row between the four. Wording is legal text: don't edit it without Shawheen's say-so |
| Blog editor | `blog-editor.html` | password-protected publishing UI for the marketing contractor |
| Stories editor | `stories-editor.html` | founder quotes and video cards (see §7) |
| Animations (standalone) | `animations/link-merge.html`, `animations/ring-play-{a,b,c}.html` + `ring-play.js` | |

- `css/styles.css`: everything. Numbered sections (header/nav, hero, cards,
  pointer cards, page--screens, pipeline, footer, motion, responsive at the end).
- `css/glass.css` + `js/glass.js`: the liquid-glass nav and CTA buttons (§5),
  included on every page (and by the blog generator).
- `js/main.js`: nav (current page, dropdown focus release, mobile menu),
  lockup fitter, nav clearance (`--nav-clear`), background videos, marquees
  (`[data-marquee]`, duplicated for a seamless loop), pipeline golf ball
  (`.pipeline-run[data-ball]`), matched heights (`[data-match]`), pointer
  cards (`[data-tilt]`, desktop and touch), pagination (`[data-paginate]`),
  subscribe forms (`[data-subscribe]`; signups go to a Google Sheet, see §10).
- `js/hero-splash.js`: the homepage hero field (§6).
- `.claude/launch.json` + `.claude/serve.js`: the preview server ("static",
  port 4599, clean URLs like the real host: `/founders` serves `founders.html`).
- Nav dropdowns: Events (Match House, 2025 NYC Summit, 2024 ATX Summit, in
  that order) and About (Press, Partners, Team). The current page's link is
  blue (main.js sets `aria-current`).
- App links: apply `https://app.matchplaygroup.com/#/auth/signup`, log in
  `https://app.matchplaygroup.com/#/home`, investors
  `https://app.matchplaygroup.com/#/auth/investor-signup`.

## 4. Design system

**Colours.** The six brand colours are the only colours allowed in any
animation (hero shapes, ticker dots, ring toy, link merge):

| Brand | Hex | Notes |
|---|---|---|
| open | `#1ED2F4` | the site blue (`--cyan`); **one blue everywhere**, never a darker blue on white |
| ventures | `#F97D4A` | `--orange`; accent on Ventures/Capital Partners pages |
| masters | `#DDF01A` | |
| studios | `#9590FF` | |
| invitational | `#8DEBD1` | `--accent-testimonial` |
| challenge | `#D25AFF` | `--purple` |

Grounds: hero/dark sections `--splash-bg-dim #0E0E11` (footer and ring section
match it), cards `--surface-glass`, white bands `.section--light`. Themed pages
(`page--ventures` orange, `page--purple`) change `--accent`, but the header and
footer pin `--accent` to blue.

**Type.** Display BW Gradual (self-hosted), wordmark Sora, UI Geist, body
Inter, serif accents Libre Baskerville, mono **Share Tech Mono, always
uppercase** with letter-spacing. Titles have **no trailing periods** unless
two sentences share a line. **No eyebrow labels** over section titles (removed
site-wide; the homepage newsletter "Newsletter" label is the exception).
Titles are usually two lines: plain line, then italic accent line (`<em>`).

**Scale.** The whole site was scaled to 90% (html font-size 90%; vw/px values
×0.9). Keep new sizes consistent with that.

**Full-screen pages** (`body.page--screens`: home, Founders, Capital Partners,
Match House): each section is at least 100svh, top padding clears the fixed
nav (`--nav-clear` + a little), content spread with `justify-content:
space-evenly`, box sets have equal heights (`grid-auto-rows: 1fr`), every CTA
row is centred. The homepage's closing section (`#start`) holds the
"Be ready before the investor asks" box and the newsletter box, stacked, the
same size and identical type and spacing; the ring section starts exactly at
the newsletter box's bottom edge.

**Pointer cards** (`[data-tilt]`): main.js injects `.fx` (top accent rule +
two glows). Desktop: tilt 1° (`2 × data-tilt`), drift and lift 4px, glow
appears under the pointer while the resting glow fades. Touch: the card
crossing a line at 45% of the screen height takes the hover look (`.is-active`
+ `.is-tracking`), glow travelling down it, ~1° rock; marquee cards only when
centred. The glow is a radial gradient fitted to the old `blur(80px)` disc (a
blur redrew on every move and lagged; Safari also drew hard lines through big
blurs on tilted boxes), moved by `transform` via `--gx/--gy` in px. Per-type rules: no top
rule on story cards, team cards and testimonials; blog cards tilt only (no
glow). Chips turn blue with white text on hover.

**Liquid glass** (`css/glass.css`, `js/glass.js`, `body.glass` on every page):
- Nav pill glass is on `.nav::before` (so the pill is not a backdrop root and
  the dropdowns can see the page). Tint `--glass-tint` **0.69** (0.8 over white
  sections, switched by `glass-on-light` from scroll position). Rim: top 15%,
  sides 7%, bottom 6%, inner glow 18%. A sheen drifts with scroll.
- **Chromium only**: real refraction via SVG displacement maps generated per
  shape size and used as `backdrop-filter: url(#…)`. Safari/Firefox get the
  same glass without the bend (they can't use `url()` there).
- Dropdowns and the phone menu use the same glass as the pill.
- Hover **lens**: one glass drop slides on a spring between nav links
  (including Log In and Apply) and travels down into the Events/About
  dropdown items and back up (2D spring, always a pill, target
  re-measured each frame while the menu slides open). Over Apply it sits
  inside the blue border. No displacement on the lens: it blurred the link
  text.
- **CTA buttons** (`.btn--primary`, `.hero__cta`, `.btn--nav`,
  `.nav__mobile-cta`): solid accent at 100% with a soft inner glow; **no
  outer glow, no white rim line**. Hover: fill drains to clear glass inside an
  accent outline, text turns accent. Paired CTAs: same font size, the quiet
  (underlined) one a little whiter.
- Rejected along the way: see-through tinted Apply button, angled rim
  highlights, magnifying lens.

**Other components.** Ticker under the hero (7 words, dots cycle the brand
colours on a 7-step pattern so the doubled loop is seamless; 2px bigger than
default; "Deep Tech" not "Energy"). Pipeline track with a rolling golf ball
(white ball, dark rim); on phones the track is centred with labels
alternating left/right. Footer (rebuilt Oct 2026): brand column (logo, "The
Venture Standard.", newsletter field hidden on the homepage), columns
Founders / Investors / Events / Company that all point to real pages or
anchors, bottom bar with copyright left, Terms and Privacy right (no Log In or Apply). No email in
the footer. Company LinkedIn not added yet (URL unknown; ask Shawheen).

## 5. The homepage hero (`js/hero-splash.js`)

A field of black dots with coloured rings and links drawing in and out
around the MatchPlay mark (white ball + two white links).

- First visit: full intro (dots, mark draws, shapes, dim, mark moves up,
  content cascades). Visits within 24h (`localStorage mp:introSeen`) get
  `html.splash--returning`: no long intro, the field starts empty and ramps
  straight into the ambient loop. Reduced motion: final state only.
- Shapes only in the hero rows; kept off the wordmark, tagline, copy and
  buttons (`keepContentClear`); on screens < 768px only the shape itself must
  stay off the copy (one cell tighter each side). Links at 75% opacity
  (`stage--bright`).
- Tunables near the top of the file:
  - `MIX = { ring: 0.35, link: 0.15, merge: 0.5 }`: merges are two rings that
    stretch together and bounce into a link (same motion as `link-merge.html`).
  - `UNIFORMITY` 0.35 (0 = random clumps, 1 = very even; try `?uniformity=0.2`).
  - `RING_FILL` 0.4: extra lone rings filling gaps (try `?fill=0.6`).
  - Lifetimes: rings/links 3–5 s; merge rings sit 0.05–0.25 s before
    stretching, then stay as a link 2.5–4 s.
  - Rings and links draw in 8% squashed and spring into shape (`POP_MS` 1400).
- Shapes never touch: each claims its 3×3 block of cells.

## 6. Animations and motion preferences

- `animations/link-merge.html`: two circles appear diagonally, stretch toward
  each other (whole circle deforms into eggs), touch, and spring into a link;
  the waist and loop ends wobble as it settles (outward swing capped so the
  link barely grows). URL options: `color a b bg dots loop speed capture`.
- `animations/ring-play.js` (pages a/b/c): floating rings that merge into
  links and split after **2–3 s** (each ring keeps its own colour). Only rings
  in the same colour family merge: blues (open+invitational), warms
  (ventures+masters), violets (studios+challenge).
  - A: drag a ring onto a matching one (held rings stretch up to touching,
    pull away to separate; merge on release).
  - **B (on the homepage, `#play`, embedded via iframe `?embed=1`)**: rings
    and links avoid the mouse, which is drawn as the MatchPlay golf ball and
    knocks shapes away; a tap on touch screens blasts everything away;
    touching same-family rings merge; 4–7 links pre-formed at start (2–4 on
    phones), 10% denser on phones; no instructions shown.
  - C: A plus automatic merges.
  - Capsule collisions (nothing ever overlaps, mid-merge included); merges and
    splits keep momentum.
  - After a split, only the two halves are kept from re-merging with each other
    (6 s, no pull between them); each may join any other ring at once. A
    blanket cooldown left rings frozen against a neighbour before merging.
    Links stay joined 2.3–4.6 s (asked: never more than 5 s). `?debug=1` exposes `window.ringPlay`.
- Motion preferences learned: fluid, never pause or stop mid-motion; ramps
  like a spring (ease in, slow, ease out); bounce at the join, not the whole
  shape; no exterior glows; nothing should grow noticeably during a bounce.

## 7. Blog

- Posts live in `tools/blog/posts/<slug>.json` (16 migrated from the old
  site with original slugs and SEO metadata). `python3 tools/blog/build.py`
  regenerates `blog.html` and `blog/*.html`. **Never hand-edit generated
  pages**: change `build.py` (or the post JSON) and rebuild. The generator
  copies the nav and footer from `team.html`, so edit those there first.
- 9 posts per page; "All blog posts"; the newest post sits with the rest.
- `blog-editor.html`: the marketing contractor writes and publishes posts with
  a shared password (no accounts). The GitHub token is AES-GCM encrypted in
  the page; Shawheen sets it with `node tools/blog/editor-setup.mjs` (needs a
  fine-grained token with Contents read/write on this repo). Publishing
  commits the post JSON; `.github/workflows/build-blog.yml` rebuilds and
  republishes Pages.
- After unlocking, the editor opens on a list of every article (read live from
  GitHub) with Edit and Delete. Edit converts the stored HTML back to the
  editor's Markdown (HTML it can't express stays as raw `<…>` lines); the web
  address is fixed once published. Save and Delete are single commits that
  also remove images no other post uses; `build.py` deletes pages of removed
  posts. Hide/Publish toggles `"hidden": true` in the post JSON; `build.py`
  skips hidden posts (no page, not in the index or related). `?debug=1` exposes `blogEditor.toHtml/toMarkdown/unlockWith(cfg)` for
  testing (stub `fetch` for api.github.com; never test against the real repo).

### Founder stories (quotes and video cards)

- One list, `tools/stories/founders.json`: name, title, company, companyUrl,
  photo, quote (the scrolling strips on the homepage and Founders hero),
  cardQuote and video (YouTube id) for the story cards on Founders, `show`
  (`quote` | `video` | `both`) and `visible`. List order = site order.
- `python3 tools/stories/build.py` writes the strips and cards between
  `<!-- stories:quotes|cards:start/end -->` markers in `index.html` and
  `founders.html`; never hand-edit between them. An empty strip or grid
  hides the element marked `data-stories-hide` around it.
- `stories-editor.html`: same lock as the blog editor (one vault;
  `editor-setup.mjs` writes both pages). Saves commit the JSON and new
  photos (`assets/founders/`); the build-blog workflow also runs the stories
  build. `?debug=1` exposes `storiesEditor.unlockWith(cfg)` for testing.
- Story cards show the video's thumbnail (`i.ytimg.com/.../hqdefault.jpg`) and a
  play button, a link to YouTube; `main.js` swaps in the player (autoplay) on
  click. A live embed swallowed the pointer and froze the card's tilt/glow.
- Anthony Dann's featured quote on Founders is not part of this (hand-written).

## 8. Media and tools

- Video: ffmpeg, e.g. 720p H.264, CRF 30, no audio, faststart, plus a poster
  frame (Match House recap ended up about 12.6 MB).
- Headshots: square 1200×1200, head sizes matched across the team, upscaled
  4× with Upscayl:
  `/Applications/Upscayl.app/Contents/Resources/bin/upscayl-bin -i in.png -o out.png -s 4 -m /Applications/Upscayl.app/Contents/Resources/models -n high-fidelity-4x -f png`
- Logos: transparent PNGs. Image work in Python: make a venv in your scratch
  dir and install Pillow there.
- macOS has BSD sed (use `sed -E`); prefer small Python scripts for multi-line edits.

## 9. Verifying in the preview (gotchas)

- Start the preview with the "static" config. It is the only server.
- **A hidden or background preview tab is throttled** (rAF ~1–2 fps, timers
  slowed), so animation tests read wrong. Bring your tab to the front, or test
  inside an offscreen `<iframe>` in the visible tab, or step the simulation
  manually (ring play `?debug=1` has `ringPlay.step(dt)`).
- **Caching**: after editing CSS/JS, `fetch(url, {cache: 'reload'})` then
  `location.reload()`, or the page keeps the old file.
- Pages restore scroll position and use smooth scrolling; set
  `document.documentElement.style.scrollBehavior = 'auto'` before jumping.
  `.reveal` elements fade in when scrolled to, so screenshots right after a
  jump look washed out.
- Desktop nav needs ≥ 1081px (below that it is the hamburger); use
  `resize_window` with a custom size, then reset to desktop afterwards.
  Mobile preset (375×812) emulates touch, so `(hover: none)` code runs.
- Shawheen sometimes browses in the same pane: don't navigate away from what
  he's looking at; use a background tab for checks where possible.

## 10. Open items

- Company LinkedIn URL for the footer (ask).
- Newsletter signups (temporary): both forms POST to a Google Apps Script web
  app that appends rows to the "MatchPlay newsletter signups" sheet in
  shawheen@matchplaygroup.com's Drive (`tools/newsletter/signup-sheet.gs`,
  set-up steps inside; deployed Oct 2026, URL in `NEWSLETTER_ENDPOINT` in
  `js/main.js`). After editing the script, redeploy as a new version of the
  same deployment so the URL stays. Replace with a real email tool later.
- Analytics (the old gtag) and the cookie banner were not carried over.
- README.md still describes the Webflow extraction; rewrite when convenient.
- Possible: soften the Capital Partners "Diligence-backed" card copy to match
  the corrected "Curated" card (§2).
