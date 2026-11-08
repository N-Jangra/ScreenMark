"use strict";

const { afterEach, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createServer, allowedPreviewOrigin, safeJoin } = require("../dev-server");

let root, server, origin;
const quiet = { warn() {} };

async function start(fetchImpl = async () => new Response("upstream", { status: 200 }), options = {}) {
  server = createServer({ root, startPort: 0, fetchImpl, logger: quiet, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
  return origin;
}

async function close() {
  if (server?.listening) {
    server.closeAllConnections?.();
    server.close();
    await once(server, "close");
  }
  server = null;
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = null;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "screenmark-http-"));
  await fs.mkdir(path.join(root, "nested"));
  await fs.writeFile(path.join(root, "index.html"), "<!doctype html><title>fixture</title>");
  await fs.writeFile(path.join(root, "nested", "app.js"), "globalThis.fixture = true;");
  await fs.writeFile(path.join(root, "data.json"), JSON.stringify({ ok: true }));
});
afterEach(close);

test("serves the root app shell and static files with correct MIME/cache headers", async () => {
  await start();
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /^text\/html/);
  assert.equal(home.headers.get("cache-control"), "no-cache");
  assert.match(await home.text(), /fixture/);

  const script = await fetch(`${origin}/nested/app.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /^application\/javascript/);
  assert.match(await script.text(), /fixture = true/);

  const json = await fetch(`${origin}/data.json`);
  assert.match(json.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await json.json(), { ok: true });
});

test("returns JSON 404 for missing files and directories", async () => {
  await start();
  for (const route of ["/missing.js", "/nested"]) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 404, route);
    assert.deepEqual(await response.json(), { error: "Not found" });
  }
});

test("rejects traversal paths and symlinks that escape the frontend root", async () => {
  await start();
  assert.equal(safeJoin(root, "/../secret"), null);
  const secret = path.join(path.dirname(root), `${path.basename(root)}-secret.txt`);
  await fs.writeFile(secret, "private");
  try {
    await fs.symlink(secret, path.join(root, "escape.txt"));
    const response = await fetch(`${origin}/escape.txt`);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Forbidden" });
  } finally { await fs.rm(secret, { force: true }); }
});

test("allows only the exact localhost preview origin for CORS preflight", async () => {
  await start();
  const allowed = await fetch(`${origin}/data.json`, { method: "OPTIONS", headers: { Origin: origin } });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
  assert.match(allowed.headers.get("access-control-allow-methods"), /GET, POST, OPTIONS/);
  assert.equal(allowed.headers.get("vary"), "Origin");

  const denied = await fetch(`${origin}/data.json`, { method: "OPTIONS", headers: { Origin: "https://attacker.example" } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
  assert.equal(allowedPreviewOrigin("http://localhost:1"), "");
});

test("proxy validates missing, malformed, non-HTTPS and unapproved targets", async () => {
  await start();
  const cases = [
    ["/proxy", 400, "Missing url parameter"],
    ["/proxy?url=not-a-url", 400, "Invalid source URL"],
    ["/proxy?url=http%3A%2F%2Fapi.tvmaze.com%2Fshows", 403, "This app cannot proxy that metadata source"],
    ["/proxy?url=https%3A%2F%2Fattacker.example%2F", 403, "This app cannot proxy that metadata source"],
    ["/proxy?url=https%3A%2F%2Fapi.tvmaze.com%3A8443%2Fshows", 403, "This app cannot proxy that metadata source"],
    ["/proxy?url=https%3A%2F%2Fuser%3Asecret%40api.tvmaze.com%2Fshows", 403, "This app cannot proxy that metadata source"]
  ];
  for (const [route, status, error] of cases) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, status, route);
    assert.deepEqual(await response.json(), { error });
  }
});

test("proxy restricts methods by source and forwards an allowed JSON GET", async () => {
  const calls = [];
  await start(async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ show: 42 }), { status: 201, headers: { "content-type": "application/json" } });
  });
  const tvmaze = encodeURIComponent("https://api.tvmaze.com/shows/1");
  const denied = await fetch(`${origin}/proxy?url=${tvmaze}`, { method: "POST", body: "{}" });
  assert.equal(denied.status, 405);
  assert.deepEqual(await denied.json(), { error: "Unsupported metadata proxy method" });

  const response = await fetch(`${origin}/proxy?url=${tvmaze}`, { headers: { Accept: "application/json", Origin: origin } });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { show: 42 });
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.tvmaze.com/shows/1");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers["User-Agent"], "ScreenMark/1.0 metadata client");
});

test("proxy permits AniList and TheTVDB login POSTs plus Tenrai episode GETs", async () => {
  const calls = [];
  await start(async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ data: { ok: true } });
  });
  const body = JSON.stringify({ query: "query { Viewer { id } }" });
  const anilist = await fetch(`${origin}/proxy?url=${encodeURIComponent("https://graphql.anilist.co/")}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body
  });
  assert.equal(anilist.status, 200);
  assert.deepEqual(await anilist.json(), { data: { ok: true } });
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body.toString(), body);
  assert.equal(calls[0].options.headers["content-type"], "application/json");

  const tenraiUrl = "https://api.tenrai.org/v1/anime/5114/episodes?page=1";
  const tenrai = await fetch(`${origin}/proxy?url=${encodeURIComponent(tenraiUrl)}`);
  assert.equal(tenrai.status, 200);
  assert.deepEqual(await tenrai.json(), { data: { ok: true } });
  assert.equal(calls[1].url, tenraiUrl);
  assert.equal(calls[1].options.method, "GET");

  const tvdbBody = JSON.stringify({ apikey: "test-key" });
  const tvdb = await fetch(`${origin}/proxy?url=${encodeURIComponent("https://api4.thetvdb.com/v4/login")}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: tvdbBody
  });
  assert.equal(tvdb.status, 200);
  assert.equal(calls[2].options.body.toString(), tvdbBody);
  assert.equal(calls[2].options.method, "POST");
});

test("proxy caps request and response payload sizes", async () => {
  await start(async () => new Response(null, { status: 200, headers: { "content-length": String(12 * 1024 * 1024 + 1) } }));
  const largeBody = "x".repeat(1024 * 1024 + 1);
  const tooLargeRequest = await fetch(`${origin}/proxy?url=${encodeURIComponent("https://graphql.anilist.co/")}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: largeBody
  });
  assert.equal(tooLargeRequest.status, 413);
  assert.deepEqual(await tooLargeRequest.json(), { error: "Metadata request body too large" });

  const tooLargeResponse = await fetch(`${origin}/proxy?url=${encodeURIComponent("https://api.tvmaze.com/shows")}`);
  assert.equal(tooLargeResponse.status, 413);
  assert.deepEqual(await tooLargeResponse.json(), { error: "Metadata response too large" });
});

test("proxy maps upstream network and redirect failures to a bounded 502 response", async () => {
  await start(async () => { throw new TypeError("network failed"); });
  const response = await fetch(`${origin}/proxy?url=${encodeURIComponent("https://api.tvmaze.com/shows")}`);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Proxy request failed" });
});

test("proxy enforces the response cap while streaming chunked bodies without Content-Length", async () => {
  await start(async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(8 * 1024 * 1024));
      controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
      controller.close();
    }
  }), { status: 200, headers: { "content-type": "application/octet-stream" } }));
  const response = await fetch(`${origin}/proxy?url=${encodeURIComponent("https://api.tvmaze.com/shows")}`);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "Metadata response too large" });
});
