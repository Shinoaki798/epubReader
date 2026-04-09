const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const STORED_DIR = path.join(__dirname, "Stored");

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".epub": "application/epub+zip",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  // Add CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true"); // Chrome blocks file:// to http://localhost

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Remove query params
  let reqUrl = decodeURIComponent(req.url.split("?")[0]);

  // API Route
  if (reqUrl === "/api/files" && req.method === "GET") {
    try {
      const result = readDirRecursive(STORED_DIR, "");
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: true,
          rootNode: { name: "Stored", isDir: true, children: result },
        }),
      );
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      if (e.code === "ENOENT") {
        res.end(
          JSON.stringify({
            success: true,
            rootNode: { name: "Stored", isDir: true, children: [] },
          }),
        );
      } else {
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    }
    return;
  }

  // Static Server Logic
  if (reqUrl === "/") reqUrl = "/index.html";

  // Prevent directory traversal
  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

function readDirRecursive(dirPath, relPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      children.push({
        name: entry.name,
        isDir: true,
        children: readDirRecursive(
          path.join(dirPath, entry.name),
          entryRelPath,
        ),
      });
    } else if (
      entry.isFile() &&
      (entry.name.toLowerCase().endsWith(".epub") ||
        entry.name.toLowerCase().endsWith(".txt"))
    ) {
      children.push({
        name: entry.name,
        isDir: false,
        path: `/Stored/${entryRelPath}`,
      });
    }
  }

  return children.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`Server started! To share to mobile, visit:`);
  console.log(`📱 http://<YOUR_LOCAL_IP>:${PORT}`);
  console.log(`Now, your 'Stored' folder will load for anyone seamlessly!`);
  console.log(`======================================================\n`);
});
