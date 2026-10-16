const http = require("http");
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || ".";
const types = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp",
  ".svg":"image/svg+xml", ".ico":"image/x-icon", ".mp4":"video/mp4", ".webm":"video/webm" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  // Behave like a clean-URL host: /blog/<slug> serves blog/<slug>.html and
  // /blog serves blog/index.html, so old URLs can be tested as-is.
  let fp = path.join(root, p);
  if (!path.extname(fp)) {
    const p1 = fp.replace(/\/$/, "") + ".html", p2 = path.join(fp, "index.html");
    fp = fs.existsSync(p1) ? p1 : p2;
  }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(4599, () => console.log("serving on http://localhost:4599"));
