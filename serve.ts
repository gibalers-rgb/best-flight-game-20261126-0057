// serve.ts — server statis kecil untuk memainkan game secara lokal.
// Jalankan: node serve.ts [port]   lalu buka http://localhost:PORT/
// Hanya melayani file di bawah game/ (dan index di /), tanpa dependensi.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, extname, normalize } from "node:path";

const PORT = Number(process.argv[2] || 8123);
const GAME = resolve(import.meta.dirname, "game");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = normalize(join(GAME, rel));
  if (!file.startsWith(GAME) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("tidak ditemukan: " + url.pathname);
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

server.listen(PORT, () => {
  console.log(`Kurir Langit dimainkan di http://localhost:${PORT}/`);
  console.log(`Mode demo: ?demo=takeoff | ?demo=rings | ?demo=drop | ?demo=landing`);
});
