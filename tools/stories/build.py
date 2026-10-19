"""Build the founder quotes and story cards from tools/stories/founders.json.

One list of founders, edited with stories-editor.html (or by hand). Each has
a long quote (the scrolling testimonial strips on the homepage and at the top
of Founders) and/or a story card (a YouTube video with a short quote and a
company link, in the Founders page's story grid). A card shows the video's
thumbnail with a play button, a link to it on YouTube; main.js swaps in the
player when it is clicked (a live embed swallowed the pointer, which froze
the card's tilt and glow, and six of them were heavy to load):

    "show": "quote" | "video" | "both"     where they appear
    "visible": true | false                false hides them everywhere

The list's order is the order on the site. The generated markup goes between
marker comments in the pages, so nothing else in them is touched:

    <!-- stories:quotes:start --> ... <!-- stories:quotes:end -->   index.html, founders.html
    <!-- stories:cards:start -->  ... <!-- stories:cards:end -->    founders.html

A strip or grid with nobody in it hides the element marked data-stories-hide
around it (the homepage's whole section; on Founders the strip alone, since
it sits in the page hero, and the stories section). Standard library only:

    python3 tools/stories/build.py
"""
import html
import io
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "tools/stories/founders.json")

esc = lambda s: html.escape(s or "", quote=True)


def load():
    founders = json.load(io.open(DATA, encoding="utf-8"))["founders"]
    shown = [f for f in founders if f.get("visible", True)]
    quotes = [f for f in shown if f.get("show") in ("quote", "both") and f.get("quote")]
    cards = [f for f in shown if f.get("show") in ("video", "both") and f.get("video")]
    return quotes, cards


def role(f):
    return ", ".join(x for x in (f.get("title"), f.get("company")) if x)


def quote_item(f, pad):
    photo = '\n%s    <img class="testimonial__avatar" src="%s" alt="" loading="lazy">' % (pad, esc(f["photo"])) if f.get("photo") else ""
    return (
        '%(p)s<li class="testimonial" data-tilt>\n'
        '%(p)s  <p class="testimonial__quote">&ldquo;%(q)s&rdquo;</p>\n'
        '%(p)s  <div class="testimonial__person">%(photo)s\n'
        '%(p)s    <div><div class="testimonial__name">%(n)s</div><div class="testimonial__role">%(r)s</div></div>\n'
        '%(p)s  </div>\n'
        '%(p)s</li>'
    ) % {"p": pad, "q": esc(f["quote"]), "photo": photo, "n": esc(f["name"]), "r": esc(role(f))}


def card(f, pad):
    site = ""
    if f.get("companyUrl"):
        site = ('\n%s    <a class="text-link story__site" href="%s" target="_blank" rel="noopener">%s <span aria-hidden="true">&#8599;</span></a>'
                % (pad, esc(f["companyUrl"]), esc(f.get("company") or f["companyUrl"])))
    cq = f.get("cardQuote") or f.get("quote") or ""
    return (
        '%(p)s<figure class="story-card reveal" data-tilt>\n'
        '%(p)s  <div class="story__video">\n'
        '%(p)s    <a class="story__poster" href="https://www.youtube.com/watch?v=%(v)s" target="_blank" rel="noopener" data-yt="%(v)s"\n'
        '%(p)s       aria-label="Play: %(n)s, %(r)s &mdash; MatchPlay founder story">\n'
        '%(p)s      <img src="https://i.ytimg.com/vi/%(v)s/hqdefault.jpg" alt="" loading="lazy" decoding="async">\n'
        '%(p)s      <span class="story__play" aria-hidden="true">&#9654;</span>\n'
        '%(p)s    </a>\n'
        '%(p)s  </div>\n'
        '%(p)s  <div class="story-card__text">\n'
        '%(p)s    <blockquote><p>&ldquo;%(q)s&rdquo;</p></blockquote>\n'
        '%(p)s    <p class="story__by"><span class="story__name">%(n)s</span>%(r)s</p>%(site)s\n'
        '%(p)s  </div>\n'
        '%(p)s</figure>'
    ) % {"p": pad, "v": esc(f["video"]), "n": esc(f["name"]), "r": esc(role(f)), "q": esc(cq), "site": site}


def fill(page, name, items, render):
    """Replace what is between the markers, indented like the start marker,
    and hide the enclosing section when there is nothing to show."""
    pat = re.compile(r"([ \t]*)<!-- stories:%s:start -->.*?<!-- stories:%s:end -->" % (name, name), re.S)
    m = pat.search(page)
    if not m:
        raise SystemExit("markers for %s not found" % name)
    pad = m.group(1)
    body = "\n".join(render(f, pad) for f in items)
    block = "%s<!-- stories:%s:start -->\n%s%s%s<!-- stories:%s:end -->" % (
        pad, name, body, "\n" if body else "", pad, name)
    page = page[:m.start()] + block + page[m.end():]
    # the wrapper marked data-stories-hide around the markers: hidden when empty
    at = page.index("<!-- stories:%s:start -->" % name)
    start = page.rfind("data-stories-hide", 0, at)
    start = page.rfind("<", 0, start)
    tag_end = page.index(">", start)
    tag = re.sub(r"\s+hidden(?=\s|$)", "", page[start:tag_end])
    if not items:
        tag += " hidden"
    return page[:start] + tag + page[tag_end:]


def build():
    quotes, cards = load()
    for name in ("index.html", "founders.html"):
        path = os.path.join(ROOT, name)
        page = io.open(path, encoding="utf-8").read()
        page = fill(page, "quotes", quotes, quote_item)
        if "<!-- stories:cards:start -->" in page:
            page = fill(page, "cards", cards, card)
        io.open(path, "w", encoding="utf-8").write(page)
    print("built %d quotes and %d story cards" % (len(quotes), len(cards)))


if __name__ == "__main__":
    build()
