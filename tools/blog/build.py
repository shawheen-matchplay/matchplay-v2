"""Build the blog: blog.html (the index) and one blog/<slug>.html per post.

Posts live in tools/blog/posts/<slug>.json (metadata plus the article body
as HTML). The nav and footer are taken from team.html, so the blog always
matches the rest of the site. Standard library only:

    python3 tools/blog/build.py

URLs: a host with clean URLs (Netlify, Cloudflare Pages, GitHub Pages; Vercel
with "cleanUrls": true) serves blog.html at /blog and blog/<slug>.html at
/blog/<slug>, the old site's URLs. The index is a file rather than
blog/index.html on purpose: served at /blog with no trailing slash, a
directory index would resolve its relative links against the site root.
Canonicals, og:url and the structured data all use the clean URLs on SITE.
"""
import datetime as dt
import glob
import html
import io
import json
import os
import re

SITE = "https://matchplaygroup.com"          # the host the old sitemap and canonicals used
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
APP = "https://app.matchplaygroup.com/#/auth/signup"
BLOG_NAME = "Warm Intro"

esc = lambda s: html.escape(s or "", quote=True)


def load_posts():
    posts = [json.load(io.open(f, encoding="utf-8"))
             for f in glob.glob(os.path.join(ROOT, "tools/blog/posts/*.json"))]
    return sorted(posts, key=lambda p: (p["datePublished"], p["slug"]), reverse=True)


def nice_date(iso):
    d = dt.date.fromisoformat(iso[:10])
    return d.strftime("%B ") + str(d.day) + d.strftime(", %Y")


# ---- shared chrome, lifted from team.html and re-pointed one level down -----
def chrome(prefix):
    team = io.open(os.path.join(ROOT, "team.html"), encoding="utf-8").read()
    header = team[team.index('<header class="site-header">'):team.index("</header>") + 9]
    footer = team[team.index('<footer class="site-footer">'):team.index("</footer>") + 9]
    fonts = re.search(r'<link href="(https://fonts\.googleapis\.com/css2[^"]+)"', team).group(1)

    def down(fragment):
        # relative links and assets gain the prefix; absolute, mailto and anchors stay
        if not prefix: return fragment
        return re.sub(r'(href|src)="(?!https?:|mailto:|tel:|#|/|data:|\.\./)([^"]*)"', r'\1="%s\2"' % prefix, fragment)

    header = down(header).replace(' aria-current="page"', "")
    header = header.replace('<a href="%sblog.html" class="nav__link">' % prefix,
                            '<a href="%sblog.html" class="nav__link" aria-current="page">' % prefix)
    return header, down(footer), fonts


def head(title, desc, canonical, fonts, prefix, extra="", og_type="website", image=None, image_alt=None, jsonld=None):
    tags = [
        '<script>document.documentElement.classList.add("js");</script>',
        '<meta charset="utf-8">',
        "<title>%s</title>" % esc(title),
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="description" content="%s">' % esc(desc),
        '<link rel="canonical" href="%s">' % canonical,
        '<meta property="og:type" content="%s">' % og_type,
        '<meta property="og:site_name" content="MatchPlay">',
        '<meta property="og:title" content="%s">' % esc(title),
        '<meta property="og:description" content="%s">' % esc(desc),
        '<meta property="og:url" content="%s">' % canonical,
    ]
    if image:
        tags += ['<meta property="og:image" content="%s">' % image,
                 '<meta property="og:image:width" content="1200">',
                 '<meta property="og:image:height" content="630">',
                 '<meta property="og:image:alt" content="%s">' % esc(image_alt)]
    tags += ['<meta name="twitter:card" content="summary_large_image">',
             '<meta name="twitter:title" content="%s">' % esc(title),
             '<meta name="twitter:description" content="%s">' % esc(desc)]
    if image:
        tags.append('<meta name="twitter:image" content="%s">' % image)
    tags.append(extra)
    tags += ['<link rel="icon" href="%sassets/favicon.png" type="image/png" sizes="512x512">' % prefix,
             '<link rel="apple-touch-icon" href="%sassets/apple-touch-icon.png">' % prefix,
             '<link rel="preconnect" href="https://fonts.googleapis.com">',
             '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
             '<link rel="preconnect" href="https://cdn.prod.website-files.com" crossorigin>',
             '<link href="%s" rel="stylesheet">' % fonts,
             '<link rel="stylesheet" href="%scss/styles.css">' % prefix]
    if jsonld:
        # "</" must not appear inside a script element
        tags.append('<script type="application/ld+json">%s</script>'
                    % json.dumps(jsonld, ensure_ascii=False, indent=1).replace("</", "<\\/"))
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  " + "\n  ".join(t for t in tags if t) + "\n</head>\n<body>\n"


def card(p, prefix, cls="post-card", heading="h3"):
    # prefix is the path from the current page to the blog/ folder
    return """<article class="%(cls)s reveal">
          <a class="%(cls)s__link" href="%(to_post)s%(slug)s.html">
            <img class="%(cls)s__img" src="%(to_root)sassets/blog/%(webp)s" alt="" width="1200" height="630" loading="lazy" decoding="async">
            <div class="%(cls)s__body">
              <p class="post-meta"><time datetime="%(iso)s">%(date)s</time><span>%(mins)d min read</span></p>
              <%(h)s class="%(cls)s__title">%(title)s</%(h)s>
              <p class="%(cls)s__text">%(desc)s</p>
              <p class="post-author">%(author)s</p>
            </div>
          </a>
        </article>""" % {"cls": cls, "slug": p["slug"], "to_post": prefix, "to_root": "" if prefix else "../", "webp": p["cover"]["webp"], "iso": p["datePublished"],
                         "date": nice_date(p["datePublished"]), "mins": p["readingMinutes"], "h": heading,
                         "title": esc(p["title"]), "desc": esc(p["description"]), "author": esc(p["author"])}


def related(post, posts, n=3):
    """Posts sharing the most keywords and title words; newest breaks ties."""
    stop = {"a", "an", "and", "the", "to", "for", "of", "in", "your", "you", "how", "what", "with", "it", "is", "my", "vs", "do"}
    def bag(p):
        words = re.findall(r"[a-z0-9-]+", (p["title"] + " " + (p.get("keywords") or "")).lower())
        return {w for w in words if w not in stop and len(w) > 2}
    mine = bag(post)
    others = [p for p in posts if p["slug"] != post["slug"]]
    return sorted(others, key=lambda p: (len(mine & bag(p)), p["datePublished"]), reverse=True)[:n]


CTA = lambda root: """    <section class="section">
      <div class="container">
        <div class="cta-band reveal">
          <h2 class="cta-band__title">Be ready before<br><em>the investor asks.</em></h2>
          <p class="cta-band__text">Start with diligence and build the financing process from there.</p>
          <div class="cta-band__actions">
            <a href="%s" target="_blank" rel="noopener" class="btn btn--primary btn--pill">
              Start Diligence <span class="btn__arrow" aria-hidden="true">&#8599;</span>
            </a>
            <a href="%sindex.html#how" class="btn btn--quiet">See how it works</a>
          </div>
        </div>
      </div>
    </section>
""" % (APP, root)


def build_post(p, posts, header, footer, fonts):
    canonical = "%s/blog/%s" % (SITE, p["slug"])
    image = "%s/assets/blog/%s" % (SITE, p["cover"]["jpg"])
    published, modified = p["datePublished"], p["dateModified"]
    jsonld = {"@context": "https://schema.org", "@graph": [
        {"@type": "BlogPosting", "@id": canonical + "#article",
         "headline": p["title"], "description": p["description"],
         "image": {"@type": "ImageObject", "url": image, "width": 1200, "height": 630},
         "datePublished": published, "dateModified": modified,
         "author": {"@type": "Person", "name": p["author"]},
         "publisher": {"@type": "Organization", "name": "MatchPlay",
                       "logo": {"@type": "ImageObject", "url": SITE + "/assets/brand/matchplay-logo.png"}},
         "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
         "url": canonical, "inLanguage": "en", "wordCount": p["wordCount"],
         **({"keywords": p["keywords"]} if p.get("keywords") else {})},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": SITE + "/blog"},
            {"@type": "ListItem", "position": 3, "name": p["title"], "item": canonical}]}]}
    extra = "\n  ".join(filter(None, [
        '<meta name="author" content="%s">' % esc(p["author"]),
        '<meta name="keywords" content="%s">' % esc(p["keywords"]) if p.get("keywords") else "",
        '<meta property="article:published_time" content="%s">' % published,
        '<meta property="article:modified_time" content="%s">' % modified,
        '<meta property="article:author" content="%s">' % esc(p["author"]),
    ]))
    # og:title keeps the title the post had on Webflow; the <title> is its SEO title
    page = head(p["seoTitle"], p["description"], canonical, fonts, "../", extra, "article", image, p["cover"]["alt"], jsonld)
    page = page.replace('<meta property="og:title" content="%s">' % esc(p["seoTitle"]),
                        '<meta property="og:title" content="%s">' % esc(p["ogTitle"]), 1)

    updated = ""
    if modified[:10] > published[:10]:
        updated = ' Updated <time datetime="%s">%s</time>.' % (modified[:10], nice_date(modified))
    rel = "\n        ".join(card(r, "") for r in related(p, posts))
    page += """
  %(header)s

  <main class="dotfield">

    <!-- ===== Article header ===== -->
    <section class="section section--top article-head">
      <div class="container">
        <a class="article-head__back" href="../blog.html"><span aria-hidden="true">&larr;</span> %(blog)s</a>
        <h1 class="article-head__title">%(title)s</h1>
        <p class="post-meta article-head__meta">
          <span>%(author)s</span>
          <time datetime="%(iso)s">%(date)s</time>
          <span>%(mins)d min read</span>
        </p>
        <figure class="article-cover">
          <img src="../assets/blog/%(webp)s" alt="%(alt)s" width="1200" height="630" fetchpriority="high" decoding="async">
        </figure>
      </div>
    </section>

    <!-- ===== Article ===== -->
    <section class="section section--light">
      <div class="container">
        <article class="article">
%(body)s
        </article>
        <p class="article__byline">Written by %(author)s. Published <time datetime="%(iso)s">%(date)s</time>.%(updated)s</p>

        <aside class="related" aria-labelledby="related-title">
          <h2 class="sec-head__title related__title" id="related-title">Keep <em>reading.</em></h2>
          <div class="post-grid">
        %(related)s
          </div>
        </aside>
      </div>
    </section>

%(cta)s  </main>

  %(footer)s

  <script src="../js/main.js"></script>
</body>
</html>
""" % {"header": header, "footer": footer, "blog": BLOG_NAME, "title": esc(p["title"]),
       "author": esc(p["author"]), "iso": published, "date": nice_date(published),
       "mins": p["readingMinutes"], "webp": p["cover"]["webp"], "alt": esc(p["cover"]["alt"]),
       "body": p["body"], "updated": updated, "related": rel, "cta": CTA("../")}
    io.open(os.path.join(ROOT, "blog", p["slug"] + ".html"), "w", encoding="utf-8").write(page)


def build_index(posts, header, footer, fonts):
    canonical = SITE + "/blog"
    desc = ("Explore MatchPlay’s latest blogs on venture capital, startup fundraising, founder stories, "
            "investor insights, and the networks shaping high-growth companies.")
    PER_PAGE = 10
    jsonld = {"@context": "https://schema.org", "@type": "Blog", "@id": canonical + "#blog",
              "name": BLOG_NAME + " | MatchPlay Blog", "url": canonical, "description": desc,
              "publisher": {"@type": "Organization", "name": "MatchPlay",
                            "logo": {"@type": "ImageObject", "url": SITE + "/assets/brand/matchplay-logo.png"}},
              "blogPost": [{"@type": "BlogPosting", "headline": p["title"],
                            "url": "%s/blog/%s" % (SITE, p["slug"]), "datePublished": p["datePublished"],
                            "author": {"@type": "Person", "name": p["author"]}} for p in posts]}
    page = head("Blog", desc, canonical, fonts, "", image="%s/assets/blog/%s" % (SITE, posts[0]["cover"]["jpg"]),
                image_alt=posts[0]["cover"]["alt"], jsonld=jsonld)
    grid = "\n        ".join(card(p, "blog/") for p in posts)
    page += """
  %(header)s

  <main class="dotfield">

    <!-- ===== Hero ===== -->
    <section class="page-hero">
      <div class="container page-hero__inner">
        <h1 class="page-hero__title reveal">%(blog)s,<br><em>the MatchPlay blog.</em></h1>
        <p class="page-hero__sub reveal">%(desc)s</p>
        <form class="subscribe__form blog-subscribe reveal" data-subscribe>
          <label class="subscribe__field">
            <span class="visually-hidden">Email address</span>
            <input class="subscribe__input" type="email" name="email" placeholder="you@company.com" autocomplete="email" required>
          </label>
          <button type="submit" class="btn btn--primary btn--pill">Subscribe</button>
        </form>
        <p class="subscribe__success blog-subscribe__done" role="status">Thank you &mdash; you&rsquo;re on the list.</p>
      </div>
    </section>

    <!-- ===== All posts ===== -->
    <section class="section section--light" id="posts">
      <div class="container container--wide">
        <header class="sec-head reveal">
          <h2 class="sec-head__title">All <em>posts.</em></h2>
        </header>
        <!-- every post is in the HTML; main.js shows %(per)d at a time -->
        <div class="post-grid" data-paginate="%(per)d">
        %(grid)s
        </div>
        <nav class="pager" aria-label="Blog pages" data-pager hidden></nav>
      </div>
    </section>

%(cta)s  </main>

  %(footer)s

  <script src="js/main.js"></script>
</body>
</html>
""" % {"header": header, "footer": footer, "blog": BLOG_NAME, "desc": esc(desc),
       "per": PER_PAGE, "grid": grid, "cta": CTA("")}
    io.open(os.path.join(ROOT, "blog.html"), "w", encoding="utf-8").write(page)


if __name__ == "__main__":
    posts = load_posts()
    os.makedirs(os.path.join(ROOT, "blog"), exist_ok=True)
    for p in posts:
        build_post(p, posts, *chrome("../"))
    build_index(posts, *chrome(""))
    print("built blog.html and %d posts in blog/" % len(posts))
