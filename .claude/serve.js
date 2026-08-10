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
  const fp = path.join(root, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(4599, () => console.log("serving on http://localhost:4599"));
