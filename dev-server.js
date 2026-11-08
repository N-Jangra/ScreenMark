const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "frontend");
const START_PORT = Number(process.env.PORT) || 3000;

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

function allowedPreviewOrigin(origin, port = START_PORT) {
  if (!origin) return "";
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
      && Number(parsed.port || 80) === port ? parsed.origin : "";
  } catch { return ""; }
}

function corsHeaders(origin, port = START_PORT) {
  const allowedOrigin = allowedPreviewOrigin(origin, port);
  const headers = { "Cache-Control": "no-store", "Vary": "Origin" };
  if (allowedOrigin) Object.assign(headers, {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, X-Source-Cookie, X-Source-User-Agent, Authorization",
    "Access-Control-Allow-Private-Network": "true"
  });
  return headers;
}

function staticHeaders(contentType) {
  return {
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

function sendJson(res, statusCode, payload, origin, port = START_PORT) {
  send(res, statusCode, { ...corsHeaders(origin, port), "Content-Type": "application/json; charset=utf-8" }, JSON.stringify(payload));
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, `.${target}`);
  const relative = path.relative(path.resolve(base), resolved);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ? null : resolved;
}

const ALLOWED_SOURCE_HOSTS = new Set(['api.tvmaze.com', 'static.tvmaze.com', 'graphql.anilist.co', 'api.tenrai.org', 'api.jikan.moe', 'kitsu.io', 'cdn.myanimelist.net', 'media.kitsu.io', 'media.kitsu.app', 's4.anilist.co', 'www.omdbapi.com', 'm.media-amazon.com', 'itunes.apple.com', 'is1-ssl.mzstatic.com', 'api.themoviedb.org', 'image.tmdb.org', 'img.youtube.com', 'api4.thetvdb.com', 'v3.sg.media-imdb.com', 'www.imdb.com', 'www.rottentomatoes.com']);

function createServer({ root = ROOT, startPort = START_PORT, fetchImpl = globalThis.fetch, logger = console } = {}) {
const initialPort = Number(startPort) || 3000;
let currentPort = initialPort;

async function proxyRequest(targetUrl, req, res) {
  let target;
  const origin = req.headers.origin;
  try { target = new URL(targetUrl); } catch { sendJson(res, 400, { error: "Invalid source URL" }, origin, currentPort); return; }
  if (target.protocol !== "https:" || (target.port && target.port !== "443") || target.username || target.password || target.hash || !ALLOWED_SOURCE_HOSTS.has(target.hostname)) {
    sendJson(res, 403, { error: "This app cannot proxy that metadata source" }, origin, currentPort); return;
  }
  const isAniListQuery = target.hostname === "graphql.anilist.co" && target.pathname === "/";
  const isTvdbLogin = target.hostname === "api4.thetvdb.com" && target.pathname === "/v4/login";
  if (req.method !== "GET" && !(req.method === "POST" && (isAniListQuery || isTvdbLogin))) {
    sendJson(res, 405, { error: "Unsupported metadata proxy method" }, origin, currentPort); return;
  }
  let body;
  if (req.method === "POST") {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) { sendJson(res, 413, { error: "Metadata request body too large" }, origin, currentPort); return; } chunks.push(chunk); }
    body = Buffer.concat(chunks);
  }
  const headers = { Accept: req.headers.accept || "application/json,text/plain,*/*", "User-Agent": "ScreenMark/1.0 metadata client" };
  if (req.headers["content-type"] && req.method === "POST") headers["content-type"] = req.headers["content-type"];
  if (req.headers.authorization && ["api4.thetvdb.com", "api.themoviedb.org"].includes(target.hostname)) headers.authorization = req.headers.authorization;
  // Per-source user agent and cookies chosen in Settings → Metadata Sources (browsers cannot set these themselves).
  if (req.headers["x-source-user-agent"]) headers["User-Agent"] = String(req.headers["x-source-user-agent"]).slice(0, 400);
  if (req.headers["x-source-cookie"] && ["www.imdb.com", "www.rottentomatoes.com"].includes(target.hostname)) headers.Cookie = String(req.headers["x-source-cookie"]).slice(0, 4000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Metadata request timed out")), 25000);
  try {
    const upstream = await fetchImpl(target, { method: req.method, headers, body, redirect: "error", signal: controller.signal });
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const declaredSize = Number(upstream.headers.get("content-length")) || 0;
    if (declaredSize > 12 * 1024 * 1024) { controller.abort(); sendJson(res, 413, { error: "Metadata response too large" }, origin, currentPort); return; }
    const chunks = []; let total = 0;
    for await (const chunk of upstream.body || []) {
      total += chunk.length;
      if (total > 12 * 1024 * 1024) { controller.abort(); sendJson(res, 413, { error: "Metadata response too large" }, origin, currentPort); return; }
      chunks.push(chunk);
    }
    send(res, upstream.status, { ...corsHeaders(origin, currentPort), "Content-Type": contentType }, Buffer.concat(chunks, total));
  } finally { clearTimeout(timer); }
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    const allowedOrigin = allowedPreviewOrigin(origin, currentPort);
    send(res, allowedOrigin ? 204 : 403, corsHeaders(origin, currentPort), "");
    return;
  }

  let url;
  try { url = new URL(req.url || "/", `http://127.0.0.1:${currentPort}`); }
  catch { sendJson(res, 400, { error: "Invalid request URL" }, origin, currentPort); return; }

  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) {
      sendJson(res, 400, { error: "Missing url parameter" }, origin, currentPort);
      return;
    }
    try {
      await proxyRequest(target, req, res);
    } catch (err) {
      sendJson(res, 502, { error: "Proxy request failed" }, origin, currentPort);
    }
    return;
  }

  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";

  const filePath = safeJoin(root, pathname);
  if (!filePath) {
    sendJson(res, 403, { error: "Forbidden" }, origin, currentPort);
    return;
  }

  let stat, realPath;
  try {
    stat = fs.statSync(filePath);
    realPath = fs.realpathSync(filePath);
  } catch {
    sendJson(res, 404, { error: "Not found" }, origin, currentPort);
    return;
  }

  const relative = path.relative(fs.realpathSync(root), realPath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    sendJson(res, 403, { error: "Forbidden" }, origin, currentPort);
    return;
  }

  if (stat.isDirectory()) {
    sendJson(res, 404, { error: "Not found" }, origin, currentPort);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = staticHeaders(MIME_TYPES[ext] || "application/octet-stream");
  const stream = fs.createReadStream(realPath);
  stream.on("error", error => {
    logger.warn(`Static file read failed: ${relative}`, error.message);
    if (!res.headersSent) sendJson(res, 500, { error: "Unable to read requested file" }, origin, currentPort);
    else res.destroy(error);
  });
  res.on("close", () => { if (!stream.destroyed) stream.destroy(); });
  res.writeHead(200, headers);
  stream.pipe(res);
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;

function startServer(port) {
  server.listen(port, "127.0.0.1");
}

server.on("listening", () => {
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : currentPort;
  currentPort = port;
  logger.log?.(`ScreenMark server listening on http://127.0.0.1:${port}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && currentPort < initialPort + 20) {
    currentPort += 1;
    startServer(currentPort);
    return;
  }
  throw err;
});

if (require.main === module) startServer(currentPort);
return server;
}

module.exports = { createServer, allowedPreviewOrigin, safeJoin };
