"""Assemble the public site for hosting, and its host config.

Copies only what visitors should get into dist/ (the pages, blog, css, js,
assets, animations and the two editors), leaving out the repo's working
files (tools/ with the post and founder data, .github, CLAUDE.md, README).
Then writes the host config from one neutral list, tools/hosting/redirects.json:

    dist/.htaccess     Hostinger (Apache/LiteSpeed): www to the bare
                       domain, the redirects, clean URLs (/founders serves
                       founders.html, /blog serves blog.html), caching,
                       compression, no directory listings, no dotfiles
    dist/_redirects    Cloudflare Pages: the same redirects
    dist/_headers      Cloudflare Pages: the same caching
    vercel.json        Vercel (repo root, committed: Vercel reads it before
                       building): build command, output, clean URLs, the
                       redirects, headers

and, for search engines and AI assistants:

    dist/sitemap.xml   every public page and visible blog post, with the
                       date each last changed (git, or the post's dateModified)
    dist/robots.txt    everyone welcome, AI crawlers included; editors and
                       the animation pages left out; points to the sitemap
    dist/llms.txt      a plain summary of MatchPlay and its pages for AI tools

In the published copy, internal links lose ".html" (founders.html ->
founders, index.html -> ./), so no click on the live site goes through a
redirect; the source keeps .html, which works everywhere. The build stops if
a public page lacks a title, description, canonical URL or share image.

Each host ignores the other's files, so moving hosts is a change to the
deploy step only. Standard library only:

    python3 tools/hosting/build.py            # into dist/
"""
import html
import io
import json
import os
import re
import shutil
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DIST = os.path.join(ROOT, "dist")
SITE = "https://matchplaygroup.com"
PRIVATE_PAGES = {"blog-editor.html", "stories-editor.html"}    # published, but not for search

PUBLISH_DIRS = ["assets", "blog", "css", "js", "animations"]
SKIP_FILES = {".DS_Store"}


def assemble():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)
    for name in sorted(os.listdir(ROOT)):        # every page at the top level
        if name.endswith(".html"):
            shutil.copy2(os.path.join(ROOT, name), os.path.join(DIST, name))
    for d in PUBLISH_DIRS:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(DIST, d),
                        ignore=shutil.ignore_patterns(*SKIP_FILES))


# ---- clean internal links in the published copy ----------------------------
LINK = re.compile(r'((?:href|src)=")([^"#?]*?)\.html((?:[#?][^"]*)?)"')

def clean_links(text):
    def fix(m):
        attr, path, tail = m.groups()
        if re.match(r"[a-z][a-z0-9+.-]*:|//", path, re.I):      # another site, mailto: etc.
            return m.group(0)
        if path == "index" or path.endswith("/index"):
            path = path[:-5] or "./"
        return '%s%s%s"' % (attr, path, tail)
    return LINK.sub(fix, text)


def rewrite_links():
    n = 0
    for base, _, files in os.walk(DIST):
        for name in files:
            if name.endswith(".html"):
                p = os.path.join(base, name)
                t = io.open(p, encoding="utf-8").read()
                c = clean_links(t)
                if c != t:
                    io.open(p, "w", encoding="utf-8").write(c); n += 1
    return n


# ---- pages, for the sitemap, llms.txt and the SEO check --------------------
def meta(text, pattern):
    m = re.search(pattern, text, re.S)
    return html.unescape(re.sub(r"\s+", " ", m.group(1))).strip() if m else ""


def git_date(rel):
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT,
                             capture_output=True, text=True, timeout=20).stdout.strip()
        return out or None
    except Exception:
        return None


def public_pages():
    """(url, file relative to the repo, title, description, lastmod) for every
    page that should be found: top-level pages and visible blog posts."""
    pages = []
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".html") or name in PRIVATE_PAGES:
            continue
        path = "/" if name == "index.html" else "/" + name[:-5]
        pages.append((SITE + path, name))
    for f in sorted(os.listdir(os.path.join(ROOT, "blog"))):
        if f.endswith(".html"):
            pages.append((SITE + "/blog/" + f[:-5], "blog/" + f))
    posts = {}
    for f in os.listdir(os.path.join(ROOT, "tools/blog/posts")):
        if f.endswith(".json"):
            d = json.load(io.open(os.path.join(ROOT, "tools/blog/posts", f), encoding="utf-8"))
            posts["blog/%s.html" % d["slug"]] = (d.get("dateModified") or d.get("datePublished") or "")[:10] or None
    out = []
    for url, rel in pages:
        t = io.open(os.path.join(ROOT, rel), encoding="utf-8").read()
        out.append({
            "url": url, "file": rel, "text": t,
            "title": meta(t, r"<title>(.*?)</title>"),
            "desc": meta(t, r'<meta name="description" content="([^"]*)"'),
            "lastmod": posts.get(rel) or git_date(rel),
        })
    return out


def check(pages):
    problems = []
    for p in pages:
        t = p["text"]
        for label, ok in (("title", p["title"]), ("description", p["desc"]),
                          ("canonical", 'rel="canonical"' in t), ("og:image", 'property="og:image"' in t)):
            if not ok:
                problems.append("%s: no %s" % (p["file"], label))
        canon = meta(t, r'<link rel="canonical" href="([^"]*)"')
        if canon and canon != p["url"]:
            problems.append("%s: canonical %s should be %s" % (p["file"], canon, p["url"]))
    if problems:
        raise SystemExit("SEO check failed:\n  " + "\n  ".join(problems))


def sitemap(pages):
    rows = []
    for p in pages:
        lm = "<lastmod>%s</lastmod>" % p["lastmod"] if p["lastmod"] else ""
        rows.append("  <url><loc>%s</loc>%s</url>" % (p["url"], lm))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % "\n".join(rows))


def robots():
    return "\n".join([
        "# Everyone is welcome to read the site, AI assistants' crawlers included.",
        "User-agent: *",
        "Allow: /",
        "Disallow: /blog-editor",
        "Disallow: /stories-editor",
        "Disallow: /animations/",
        "",
        "Sitemap: %s/sitemap.xml" % SITE,
        "",
    ])


def llms(pages):
    by = lambda prefix: [p for p in pages if p["file"].startswith(prefix)]
    def line(p):
        name = re.sub(r"\s+[—|-]\s+MatchPlay.*$", "", p["title"]) or p["url"]
        return "- [%s](%s): %s" % (name, p["url"], p["desc"])
    main = [p for p in pages if "/" not in p["file"] and not re.match(r"(terms|privacy|acceptable-use|copyright-trademark|blog)\.html$", p["file"])]
    legal = [p for p in pages if re.match(r"(terms|privacy|acceptable-use|copyright-trademark)\.html$", p["file"])]
    blog = [p for p in pages if p["file"] == "blog.html"] + by("blog/")
    return "\n".join([
        "# MatchPlay Group",
        "",
        "> The Venture Standard: one platform connecting companies and investors to manage diligence, fundraising, and syndication. MatchPlay helps a company become fundable and administratively ready: pitch review, institutional-quality diligence, data room, fundraising preparation, investor matching through Capital Partners (a network of 200+ funds), and SPV coordination and administration. MatchPlay Ventures (matchplayventures.com) is a separate firm that independently decides which companies to invest in.",
        "",
        "Apply for Diligence: https://app.matchplaygroup.com/#/auth/signup",
        "Investors join Capital Partners: https://app.matchplaygroup.com/#/auth/investor-signup",
        "Contact: info@matchplaygroup.com",
        "",
        "## Pages",
        "",
    ] + [line(p) for p in main] + ["", "## Blog: The Warm Intro", ""] + [line(p) for p in blog]
      + ["", "## Legal", ""] + [line(p) for p in legal] + [""])


def load_redirects():
    data = json.load(io.open(os.path.join(ROOT, "tools/hosting/redirects.json"), encoding="utf-8"))
    out = []
    for r in data["redirects"]:
        src, to = r["from"].strip(), r["to"].strip()
        if not src.startswith("/"):
            raise SystemExit("redirect 'from' must start with /: %s" % src)
        out.append((src, to))
    return out


def htaccess(redirects):
    lines = [
        "# Generated by tools/hosting/build.py from tools/hosting/redirects.json. Do not edit here.",
        "",
        "Options -Indexes -MultiViews",
        "DirectorySlash Off",
        "DirectoryIndex index.html",
        "",
        "<IfModule mod_rewrite.c>",
        "RewriteEngine On",
        "RewriteBase /",
        "",
        "# www. folds into the bare domain, on whatever host this is served from",
        "# (so a temporary test address works too). http -> https is left to the",
        "# host's own Force HTTPS switch: done here it can loop behind a proxy.",
        "RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]",
        "RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301,NE]",
        "",
        "# Nothing starting with a dot (except .well-known, for certificates)",
        "RewriteRule (^|/)\\.(?!well-known/) - [F,L]",
        "",
        "# Redirects (first match wins, so specific ones come before /* ones)",
    ]
    for src, to in redirects:
        path = src.lstrip("/")
        if path.endswith("/*"):
            pattern = "^%s(/.*)?$" % re.escape(path[:-2])
        else:
            pattern = "^%s/?$" % re.escape(path)
        lines.append("RewriteRule %s %s [L,R=301,NE]" % (pattern, to))
    lines += [
        "",
        "# Clean URLs: /founders serves founders.html, /blog serves blog.html,",
        "# /blog/<post> serves blog/<post>.html; a trailing slash is dropped.",
        "RewriteCond %{REQUEST_FILENAME} !-f",
        "RewriteRule ^(.+)/$ /$1 [L,R=301]",
        "RewriteCond %{REQUEST_FILENAME}.html -f",
        "RewriteRule ^(.+)$ $1.html [L]",
        "</IfModule>",
        "",
        "# Caching. Pages, CSS and JS are not versioned, so the browser checks",
        "# for a newer copy each time (cheap, with ETags); images, video and",
        "# fonts keep for a month.",
        "<IfModule mod_headers.c>",
        "  <FilesMatch \"\\.(html|css|js|json|xml|txt)$\">",
        "    Header set Cache-Control \"no-cache\"",
        "  </FilesMatch>",
        "  <FilesMatch \"\\.(png|jpe?g|webp|avif|gif|svg|ico|mp4|webm|woff2?|ttf|otf|pdf|xlsx)$\">",
        "    Header set Cache-Control \"public, max-age=2592000\"",
        "  </FilesMatch>",
        "  Header always set X-Content-Type-Options \"nosniff\"",
        "  Header always set Referrer-Policy \"strict-origin-when-cross-origin\"",
        "</IfModule>",
        "",
        "<IfModule mod_deflate.c>",
        "  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml text/plain text/xml application/xml",
        "</IfModule>",
        "",
    ]
    return "\n".join(lines)


def cf_redirects(redirects):
    lines = ["# Generated by tools/hosting/build.py from tools/hosting/redirects.json. Do not edit here."]
    for src, to in redirects:
        lines.append("%s %s 301" % (src, to))
        if not src.endswith("/*"):
            lines.append("%s/ %s 301" % (src, to))
    return "\n".join(lines) + "\n"


def cf_headers():
    return "\n".join([
        "# Generated by tools/hosting/build.py. Do not edit here.",
        "/*",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "/*.html",
        "  Cache-Control: no-cache",
        "/css/*",
        "  Cache-Control: no-cache",
        "/js/*",
        "  Cache-Control: no-cache",
        "/assets/*",
        "  Cache-Control: public, max-age=2592000",
        "",
    ])


def vercel_json(redirects):
    """Vercel reads vercel.json from the repo root before it builds, so this
    one is written there and committed (the build keeps it in step with
    redirects.json). The build command and output folder live here rather
    than in the dashboard."""
    rules = []
    for src, to in redirects:
        if src.endswith("/*"):
            src = src[:-2] + "/:rest*"
        rules.append({"source": src, "destination": to, "statusCode": 301})
    return json.dumps({
        "$schema": "https://openapi.vercel.sh/vercel.json",
        "framework": None,
        "buildCommand": "python3 tools/hosting/build.py",
        "outputDirectory": "dist",
        "cleanUrls": True,
        "trailingSlash": False,
        "redirects": rules,
        "headers": [
            {"source": "/(.*)", "headers": [
                {"key": "X-Content-Type-Options", "value": "nosniff"},
                {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"}]},
            {"source": "/assets/(.*)", "headers": [
                {"key": "Cache-Control", "value": "public, max-age=2592000"}]},
        ],
    }, indent=2) + "\n"


def build():
    redirects = load_redirects()
    pages = public_pages()
    check(pages)
    assemble()
    cleaned = rewrite_links()
    io.open(os.path.join(DIST, "sitemap.xml"), "w", encoding="utf-8").write(sitemap(pages))
    io.open(os.path.join(DIST, "robots.txt"), "w", encoding="utf-8").write(robots())
    io.open(os.path.join(DIST, "llms.txt"), "w", encoding="utf-8").write(llms(pages))
    # Each host's own files only: Vercel (it sets VERCEL=1 in its builds)
    # would otherwise serve the Apache and Cloudflare files as plain files.
    if not os.environ.get("VERCEL"):
        io.open(os.path.join(DIST, ".htaccess"), "w", encoding="utf-8").write(htaccess(redirects))
        io.open(os.path.join(DIST, "_redirects"), "w", encoding="utf-8").write(cf_redirects(redirects))
        io.open(os.path.join(DIST, "_headers"), "w", encoding="utf-8").write(cf_headers())
    io.open(os.path.join(ROOT, "vercel.json"), "w", encoding="utf-8").write(vercel_json(redirects))
    files = sum(len(f) for _, _, f in os.walk(DIST))
    print("dist/: %d files, %d redirects, %d pages in the sitemap, links cleaned in %d pages"
          % (files, len(redirects), len(pages), cleaned))


if __name__ == "__main__":
    build()
