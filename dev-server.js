const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "frontend");
const START_PORT = Number(process.env.PORT) || 3000;
let currentPort = START_PORT;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Cache-Control": "no-store"
  };
}

function staticHeaders(contentType) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Cache-Control": process.env.NODE_ENV === "production"
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "Content-Type": contentType
  };
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" }, JSON.stringify(payload));
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, `.${target}`);
  return resolved.startsWith(base) ? resolved : null;
}

const ALLOWED_SOURCE_HOSTS = new Set(['api.tvmaze.com', 'graphql.anilist.co', 'www.omdbapi.com', 'itunes.apple.com', 'api.themoviedb.org', 'image.tmdb.org', 'api4.thetvdb.com', 'v3.sg.media-imdb.com', 'www.imdb.com', 'www.rottentomatoes.com']);

async function proxyRequest(targetUrl, req, res) {
  let target;
  try { target = new URL(targetUrl); } catch { sendJson(res, 400, { error: "Invalid source URL" }); return; }
  if (target.protocol !== "https:" || target.username || target.password || !ALLOWED_SOURCE_HOSTS.has(target.hostname)) {
    sendJson(res, 403, { error: "This app cannot proxy that metadata source" }); return;
  }
  const isAniListQuery = target.hostname === "graphql.anilist.co" && target.pathname === "/";
  const isTvdbLogin = target.hostname === "api4.thetvdb.com" && target.pathname === "/v4/login";
  if (req.method !== "GET" && !(req.method === "POST" && (isAniListQuery || isTvdbLogin))) {
    sendJson(res, 405, { error: "Unsupported metadata proxy method" }); return;
  }
  let body;
  if (req.method === "POST") {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) { sendJson(res, 413, { error: "Metadata request body too large" }); return; } chunks.push(chunk); }
    body = Buffer.concat(chunks);
  }
  const headers = { Accept: req.headers.accept || "application/json,text/plain,*/*", "User-Agent": "ScreenMark/1.0 metadata client" };
  for (const name of ["content-type", "origin", "referer", "authorization"]) if (req.headers[name]) headers[name] = req.headers[name];
  // Per-source user agent and cookies chosen in Settings → Metadata Sources (browsers cannot set these themselves).
  if (req.headers["x-source-user-agent"]) headers["User-Agent"] = String(req.headers["x-source-user-agent"]).slice(0, 400);
  if (req.headers["x-source-cookie"]) headers.Cookie = String(req.headers["x-source-cookie"]).slice(0, 4000);
  const upstream = await fetch(target, { method: req.method, headers, body, redirect: "error" });
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  send(res, upstream.status, { ...corsHeaders(), "Content-Type": contentType }, Buffer.from(await upstream.arrayBuffer()));
}
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, corsHeaders(), "");
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) {
      sendJson(res, 400, { error: "Missing url parameter" });
      return;
    }
    try {
      await proxyRequest(target, req, res);
    } catch (err) {
      sendJson(res, 502, { error: "Proxy request failed", details: err.message });
    }
    return;
  }

  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";
  

  const filePath = safeJoin(ROOT, pathname);
  if (!filePath) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (stat.isDirectory()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = staticHeaders(MIME_TYPES[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res.writeHead(200, headers));
});

function startServer(port) {
  server.listen(port, "127.0.0.1");
}

server.on("listening", () => {
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : currentPort;
  console.log(`ScreenMark server listening on http://127.0.0.1:${port}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && currentPort < START_PORT + 20) {
    currentPort += 1;
    startServer(currentPort);
    return;
  }
  throw err;
});

startServer(currentPort);
