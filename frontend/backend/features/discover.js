// App-specific metadata search service.
(() => {
  const metadata = window.SplitAppMetadata;
  const appKey = metadata.appKey;
  const cacheName = `splitapp_${appKey}_metadata`;
  let cachePrunePromise = null, cachePrunedAt = 0;
  const capacitor = window.Capacitor;
  const nativeApp = Boolean(capacitor?.isNativePlatform?.() || ["android", "ios"].includes(capacitor?.getPlatform?.()));
  const nativeHttp = window.CapacitorHttp || capacitor?.Plugins?.CapacitorHttp || null;
  const filePreview = !nativeApp && location.protocol === "file:";
  const localPreview = !nativeApp && location.protocol.startsWith("http") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const fileProxy = "http://127.0.0.1:3000/proxy?url=";
  const maxMetadataResponseBytes = 12 * 1024 * 1024;
  const encode = value => encodeURIComponent(String(value || "").trim());
  function secureEndpoint(value) {
    let endpoint;
    try { endpoint = new URL(String(value || ""), location.href); } catch { throw new Error("Metadata endpoint URL is invalid."); }
    if (endpoint.username || endpoint.password) throw new Error("Metadata endpoint URLs cannot contain embedded credentials.");
    if (endpoint.protocol === "https:") return endpoint.href;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
    if (!nativeApp && endpoint.protocol === "http:" && loopback) return endpoint.href;
    throw new Error("Metadata endpoints must use HTTPS (HTTP is allowed only for localhost during web preview).");
  }
  async function readBoundedText(response, label) {
    const limitMessage = `${label} exceeds the 12 MB limit.`;
    const declaredLength = Number(response.headers.get("content-length")) || 0;
    if (declaredLength > maxMetadataResponseBytes) {
      try { await response.body?.cancel(); } catch (_) {}
      throw new Error(limitMessage);
    }
    if (!response.body?.getReader) {
      const body = await response.text();
      if (new Blob([body]).size > maxMetadataResponseBytes) throw new Error(limitMessage);
      return body;
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxMetadataResponseBytes) {
          try { await reader.cancel(); } catch (_) {}
          throw new Error(limitMessage);
        }
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    } finally { reader.releaseLock(); }
  }
  async function fetchWithTimeout(url, options = {}, responseType = "json") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Metadata request timed out.")), 25000);
    const externalSignal = options.signal;
    const abort = () => controller.abort(externalSignal.reason);
    externalSignal?.addEventListener("abort", abort, { once: true });
    if (externalSignal?.aborted) abort();
    try {
      const response = await fetch(url, { ...options, redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal });
      let data = null;
      if (response.ok) {
        const body = await readBoundedText(response, "Metadata provider response");
        data = responseType === "text" ? body : (() => {
          try { return JSON.parse(body.replace(/^\uFEFF/, "")); }
          catch { throw new Error("Metadata provider returned invalid JSON."); }
        })();
      }
      return { response, data };
    }
    finally { clearTimeout(timer); externalSignal?.removeEventListener("abort", abort); }
  }
  async function cachedJson(response) {
    const body = await readBoundedText(response, "Cached metadata");
    try { return JSON.parse(body.replace(/^\uFEFF/, "")); }
    catch { throw new Error("Cached metadata is invalid."); }
  }
  async function wireRequest(url, options = {}, responseType = "json") {
    url = secureEndpoint(url);
    const directPreview = options.directPreview === true;
    if (directPreview) { options = { ...options }; delete options.directPreview; }
    const method = String(options.method || "GET").toUpperCase();
    const headers = { Accept: responseType === "text" ? "text/html,application/xhtml+xml,*/*" : "application/json", ...(options.headers || {}) };
    // Browsers refuse to set Cookie / User-Agent. The Android app sends them as-is; the local preview passes them to its proxy; a plain website drops them.
    if (!nativeApp) {
      for (const [name, key] of [["Cookie", "x-source-cookie"], ["User-Agent", "x-source-user-agent"]]) {
        if (headers[name] && (localPreview || filePreview)) headers[key] = headers[name];
        delete headers[name];
      }
    }
    if (nativeApp && nativeHttp?.request) {
      const response = await nativeHttp.request({
        url, method, headers, data: options.body || null,
        // Read as text so the payload can be size-checked before JSON parsing.
        responseType: "text", connectTimeout: 15000, readTimeout: 20000, disableRedirects: true
      });
      const status = Number(response?.status || 0);
      if (status >= 400) throw Object.assign(new Error(`${status} ${response.statusText || "Metadata request failed"}`), { status });
      const data = response?.data;
      if (typeof data === "string") {
        if (new Blob([data]).size > maxMetadataResponseBytes) throw new Error("Metadata provider response exceeds the 12 MB limit.");
        if (responseType === "text") return data;
        try { return JSON.parse(data.replace(/^\uFEFF/, "")); }
        catch { throw new Error("Metadata provider returned invalid JSON."); }
      }
      if (responseType === "text") return String(data ?? "");
      if (data != null && new Blob([JSON.stringify(data)]).size > maxMetadataResponseBytes) throw new Error("Metadata provider response exceeds the 12 MB limit.");
      return data;
    }
    let response;
    if (localPreview) {
      const endpoint = new URL(url);
      const localHttp = endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
      response = await fetchWithTimeout(localHttp || directPreview ? endpoint.href : `/proxy?url=${encodeURIComponent(url)}`, { method, headers, body: options.body, signal: options.signal }, responseType);
    } else if (filePreview) {
      try {
        response = await fetchWithTimeout(`${fileProxy}${encodeURIComponent(url)}`, { method, headers, body: options.body, signal: options.signal }, responseType);
        if (!response.response.ok) throw Object.assign(new Error(`${response.response.status} ${response.response.statusText}`), { status: response.response.status });
      } catch (proxyError) {
        if (options.signal?.aborted) throw proxyError;
        try { response = await fetchWithTimeout(url, { method, headers, body: options.body, signal: options.signal }, responseType); }
        catch (_) { throw new Error("Firefox blocks metadata requests from file://. Start the local preview with npm run serve, then open http://127.0.0.1:3000."); }
      }
    } else {
      response = await fetchWithTimeout(url, { method, headers, body: options.body, signal: options.signal }, responseType);
    }
    if (!response.response.ok) throw Object.assign(new Error(`${response.response.status} ${response.response.statusText}`), { status: response.response.status });
    return response.data;
  }
  // Cache Storage can stall on some devices/profiles; never let it block a request.
  const cacheStep = (promise, ms = 2500) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cache timeout")), ms);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
  function pruneMetadataCache(cache) {
    if (cachePrunePromise || Date.now() - cachePrunedAt < 10 * 60 * 1000) return cachePrunePromise || Promise.resolve();
    cachePrunedAt = Date.now();
    cachePrunePromise = (async () => {
      const keys = await cacheStep(cache.keys());
      const rows = [];
      for (let offset = 0; offset < keys.length; offset += 32) {
        const batch = await Promise.all(keys.slice(offset, offset + 32).map(async request => {
          const response = await cacheStep(cache.match(request));
          return { request, at: Number(response?.headers.get("x-splitapp-cached-at")) || 0 };
        }));
        rows.push(...batch);
      }
      const cutoff = Date.now() - 14 * 86400000;
      const expired = rows.filter(row => !row.at || row.at < cutoff);
      const current = rows.filter(row => row.at >= cutoff).sort((a, b) => b.at - a.at);
      const remove = new Set(expired.map(row => row.request.url));
      current.slice(400).forEach(row => remove.add(row.request.url));
      await Promise.all([...remove].map(url => cacheStep(cache.delete(url))));
    })().catch(() => {}).finally(() => { cachePrunePromise = null; });
    return cachePrunePromise;
  }
  // Every request to a known source picks up that source's domain / user agent / cookies from Settings.
  function applySource(url, options = {}) {
    let host = ""; try { host = new URL(url).hostname; } catch (_) { return { url, options }; }
    const provider = metadata.providers.find(source => source.domain === host); if (!provider) return { url, options };
    const resolved = metadata.resolve(provider.key, url, options);
    return { url: resolved.url, options: { ...options, headers: { ...(options.headers || {}), ...resolved.headers } } };
  }
  async function requestJson(url, options = {}) {
    ({ url, options } = applySource(url, options));
    url = secureEndpoint(url);
    const method = String(options.method || "GET").toUpperCase();
    const canCache = method === "GET" && !options.noCache && !options.forceRefresh && window.caches && !/[?&](?:key|apikey)=/i.test(url);
    let cache = null, stale = null;
    if (canCache) {
      try {
        cache = await cacheStep(window.caches.open(cacheName)); stale = await cacheStep(cache.match(url));
        pruneMetadataCache(cache);
        const fetchedAt = Number(stale?.headers.get("x-splitapp-cached-at")) || 0;
        if (stale && fetchedAt && Date.now() - fetchedAt < 6 * 60 * 60 * 1000) return cachedJson(stale);
      } catch { cache = null; stale = null; }
    }
    try {
      const data = await wireRequest(url, options, "json");
      if (cache) {
        try {
          const serialized = JSON.stringify(data);
          if (new Blob([serialized]).size <= maxMetadataResponseBytes) {
            const headers = new Headers({ "Content-Type": "application/json", "x-splitapp-cached-at": String(Date.now()) });
            await cacheStep(cache.put(url, new Response(serialized, { status: 200, headers })));
          }
        } catch { /* caching is best-effort */ }
      }
      return data;
    } catch (error) {
      if (stale && options.offlineFallback !== "none") return cachedJson(stale);
      throw error;
    }
  }
  const requestText = (url, options = {}) => { ({ url, options } = applySource(url, options)); return wireRequest(secureEndpoint(url), options, "text"); };
  const imageHosts = new Set(["static.tvmaze.com", "s4.anilist.co", "m.media-amazon.com", "image.tmdb.org", "is1-ssl.mzstatic.com", "img.youtube.com"]);
  const imageUrl = value => {
    const url = String(value || "");
    if (!/^https?:\/\//i.test(url)) return url;
    if (!/^https:\/\//i.test(url)) return "";
    if (nativeApp) return url;
    try { if (!imageHosts.has(new URL(url).hostname)) return url; } catch (_) { return url; }
    if (filePreview) return `${fileProxy}${encodeURIComponent(url)}`;
    if (localPreview) return `/proxy?url=${encodeURIComponent(url)}`;
    return url;
  };
  // One request through a source's own options (domain / user agent / cookies from its settings page).
  async function providerSessionHeaders(sourceKey) {
    if (!nativeApp || !["imdb", "rottentomatoes"].includes(sourceKey)) return {};
    try {
      const session = await capacitor?.Plugins?.ProviderSession?.getSession?.({ provider: sourceKey });
      return { ...(session?.cookie ? { Cookie: session.cookie } : {}), ...(session?.userAgent ? { "User-Agent": session.userAgent } : {}) };
    } catch (_) { return {}; }
  }
  const sourceJson = async (sourceKey, url, settings = {}, extra = {}) => requestJson(url, { ...settings, ...extra, headers: { ...(await providerSessionHeaders(sourceKey)), ...(extra.headers || {}) } });
  const sourceText = async (sourceKey, url, settings = {}, extra = {}) => requestText(url, { ...settings, ...extra, headers: { ...(await providerSessionHeaders(sourceKey)), ...(extra.headers || {}) } });
  const tmdbAuth = key => key.length > 40 ? { headers: { Authorization: `Bearer ${key}` } } : { query: `api_key=${encodeURIComponent(key)}` };
  const tmdbGet = (path, settings) => {
    const key = settings.apiKeys?.tmdb?.trim(); if (!key) throw new Error("Add a TMDB API key in Settings → Metadata Sources.");
    const auth = tmdbAuth(key), full = auth.query ? `${path}${path.includes("?") ? "&" : "?"}${auth.query}` : path;
    return sourceJson("tmdb", `https://api.themoviedb.org/3${full}`, settings, { headers: auth.headers, noCache: Boolean(auth.query) })
      .catch(error => { throw error?.status === 401 ? new Error("TMDB rejected your API key. Check it in Metadata Sources.") : error; });
  };
  const tvdbTokens = new Map();
  const tvdbTokenLifetime = 28 * 24 * 60 * 60 * 1000;
  const trimTvdbTokens = () => {
    const now = Date.now();
    for (const [key, value] of tvdbTokens) if (!value.pending && value.expiresAt <= now) tvdbTokens.delete(key);
    while (tvdbTokens.size > 8) tvdbTokens.delete(tvdbTokens.keys().next().value);
  };
  const getTvdbToken = async (key, settings) => {
    trimTvdbTokens();
    const cached = tvdbTokens.get(key);
    if (cached?.token && cached.expiresAt > Date.now()) return cached.token;
    if (cached?.pending) return cached.pending;
    const pending = sourceJson("tvdb", "https://api4.thetvdb.com/v4/login", settings, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apikey: key }), noCache: true })
      .then(login => {
        const token = login?.data?.token;
        if (!token) throw new Error("TheTVDB did not return a login token.");
        tvdbTokens.set(key, { token, expiresAt: Date.now() + tvdbTokenLifetime });
        trimTvdbTokens();
        return token;
      })
      .catch(error => {
        tvdbTokens.delete(key);
        throw error?.status === 401 ? new Error("TheTVDB rejected your API key. Check it in Metadata Sources.") : error;
      });
    tvdbTokens.set(key, { pending });
    trimTvdbTokens();
    return pending;
  };
  const tvdbGet = async (path, settings) => {
    const key = settings.apiKeys?.tvdb?.trim(); if (!key) throw new Error("Add a TheTVDB API key in Settings → Metadata Sources.");
    const request = token => sourceJson("tvdb", `https://api4.thetvdb.com/v4${path}`, settings, { headers: { Authorization: `Bearer ${token}` }, noCache: true });
    let token = await getTvdbToken(key, settings);
    try { return await request(token); }
    catch (error) {
      if (error?.status !== 401) throw error;
      const current = tvdbTokens.get(key);
      if (current?.token && current.token !== token && current.expiresAt > Date.now()) token = current.token;
      else {
        if (current?.token === token) tvdbTokens.delete(key);
        token = await getTvdbToken(key, settings);
      }
      return request(token);
    }
  };
  const result = (source, category, providerId, title, fields = {}) => ({
    source, category, providerId: String(providerId || ""), title: String(title || "").trim(),
    year: fields.year || "", image: fields.image || "", description: fields.description || "",
    rating: fields.rating || 0, goal: Number(fields.goal) || 0, url: fields.url || "", subtitle: fields.subtitle || "", ...fields
  });
  const textFromHtml = html => String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

  const tvmazeMatches = (show, category) => {
    const genres = (show.genres || []).map(value => String(value).toLowerCase());
    const language = String(show.language || "").toLowerCase();
    const anime = genres.includes("anime") || (language === "japanese" && show.type === "Animation");
    return category === "series" && !anime;
  };
  const tvmazeResult = (show, category) => result("tvmaze", category, show.id, show.name, { year: show.premiered?.slice(0, 4), image: show.image?.medium || show.image?.original, description: textFromHtml(show.summary), rating: show.rating?.average, genres: show.genres || [], goal: 0, url: show.url, subtitle: [show.premiered?.slice(0, 4), show.type, show.network?.name || show.webChannel?.name].filter(Boolean).join(" · ") });
  const anilistFormats = category => category === "movie" ? "[MOVIE]" : "[TV, TV_SHORT, ONA, OVA, SPECIAL]";
  const anilistData = response => {
    if (!response?.data && response?.errors?.length) throw new Error(`AniList: ${response.errors.map(error => error.message).filter(Boolean).join("; ") || "request failed"}`);
    return response?.data || {};
  };
  const anilistRows = (rows, category) => (rows || []).map(row => result("anilist", category, row.id, row.title?.english || row.title?.romaji, { year: row.startDate?.year, image: row.coverImage?.large || row.coverImage?.medium, description: textFromHtml(row.description), rating: row.averageScore ? row.averageScore / 10 : 0, genres: row.genres || [], goal: category === "movie" ? 0 : (row.episodes || 0), url: row.siteUrl, subtitle: [row.startDate?.year, row.format, row.averageScore ? `★ ${(row.averageScore / 10).toFixed(1)}` : ""].filter(Boolean).join(" · ") }));
  const ANILIST_FIELDS = "id title{romaji english} coverImage{large medium} description startDate{year} averageScore episodes format genres siteUrl";
  const searchers = {
    tvmaze: async (query, category, settings) => {
      const data = await requestJson(`https://api.tvmaze.com/search/shows?q=${encode(query)}`, settings);
      return (Array.isArray(data) ? data : []).map(row => row.show || {}).filter(show => tvmazeMatches(show, category)).map(show => tvmazeResult(show, category));
    },
    anilist: async (query, category, settings) => {
      const gql = `query($q:String){Page(perPage:15){media(search:$q,type:ANIME,format_in:${anilistFormats(category)},sort:SEARCH_MATCH){${ANILIST_FIELDS}}}}`;
      const data = await requestJson("https://graphql.anilist.co", { ...settings, method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: gql, variables: { q: query } }) });
      return anilistRows(anilistData(data).Page?.media, category);
    },
    omdb: async (query, category, settings) => {
      const key = settings.apiKeys?.omdb?.trim(); if (!key) throw new Error("Add an OMDb API key in Settings → Metadata Sources.");
      const type = category === "movie" ? "movie" : "series";
      const data = await requestJson(`https://www.omdbapi.com/?apikey=${encode(key)}&s=${encode(query)}&type=${type}`, settings).catch(error => { throw error?.status === 401 ? new Error("OMDb rejected your API key. Check it in Metadata Sources.") : error; });
      if (data.Response === "False") return [];
      return (data.Search || []).map(row => result("omdb", category, row.imdbID, row.Title, { year: row.Year, image: row.Poster !== "N/A" ? row.Poster : "", url: `https://www.imdb.com/title/${row.imdbID}/`, subtitle: row.Year }));
    },
    tmdb: async (query, category, settings) => {
      const data = await tmdbGet(`/search/${category === "movie" ? "movie" : "tv"}?query=${encode(query)}&include_adult=false`, settings);
      return (data.results || []).map(row => result("tmdb", category, row.id, row.title || row.name, { year: String(row.release_date || row.first_air_date || "").slice(0, 4), image: row.poster_path ? `https://image.tmdb.org/t/p/w342${row.poster_path}` : "", description: row.overview, rating: row.vote_average ? Math.round(row.vote_average * 10) / 10 : 0, url: `https://www.themoviedb.org/${category === "movie" ? "movie" : "tv"}/${row.id}`, subtitle: String(row.release_date || row.first_air_date || "").slice(0, 4) }));
    },
    tvdb: async (query, category, settings) => {
      const data = await tvdbGet(`/search?query=${encode(query)}&type=${category === "movie" ? "movie" : "series"}`, settings);
      return (data.data || []).map(row => result("tvdb", category, row.tvdb_id || String(row.id || "").replace(/^\D+/, ""), row.name, { year: row.year, image: row.image_url || row.thumbnail || "", description: row.overview, url: row.url || "", subtitle: row.year || "" }));
    },
    imdb: async (query, category, settings) => {
      const text = query.trim().toLowerCase(); if (!text) return [];
      const data = await sourceJson("imdb", `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(text[0])}/${encodeURIComponent(text)}.json`, settings);
      const wanted = category === "movie" ? ["movie", "tvMovie"] : ["tvSeries", "tvMiniSeries"];
      return (data.d || []).filter(row => /^tt\d+/.test(row.id || "") && wanted.includes(row.qid)).map(row => result("imdb", category, row.id, row.l, { year: row.y || "", image: row.i?.imageUrl || "", description: row.s || "", url: `https://www.imdb.com/title/${row.id}/`, subtitle: row.s || row.y || "" }));
    },
    rottentomatoes: async (query, category, settings) => {
      // No JSON API exists: read the public search page's result rows.
      const html = await sourceText("rottentomatoes", `https://www.rottentomatoes.com/search?search=${encode(query)}`, settings);
      const group = html.split(/<search-page-result\b/i).find(part => new RegExp(`type="${category === "movie" ? "movie" : "tvSeries"}"`).test(part.slice(0, 300))) || "";
      return [...group.matchAll(/<search-page-media-row\b([^>]*)>([\s\S]*?)<\/search-page-media-row>/gi)].slice(0, 15).map(([, attrs, inner]) => {
        const attr = name => attrs.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] || "";
        const href = inner.match(/href="(https:\/\/www\.rottentomatoes\.com\/(?:m|tv)\/[^"]+)"/i)?.[1] || "", title = textFromHtml(inner.match(/data-qa="info-name"[^>]*>([\s\S]*?)<\/a>/i)?.[1] || inner.match(/alt="([^"]*)"/i)?.[1] || "");
        const score = Number(attr("tomatometer-score")) || 0;
        return href && title ? result("rottentomatoes", category, new URL(href).pathname, title, { year: attr("release-year") || attr("start-year"), image: inner.match(/<img[^>]*\bsrc="([^"]+)"/i)?.[1] || "", description: attr("cast"), rating: score ? score / 10 : 0, url: href, subtitle: score ? `🍅 ${score}%` : attr("cast") }) : null;
      }).filter(Boolean);
    },
  };
  // ---- Custom JSON API sources ----
  const pickPath = (object, path) => {
    if (!path) return undefined;
    return String(path).replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], object);
  };
  const pickText = (object, path) => {
    const value = pickPath(object, path);
    if (Array.isArray(value)) return value.map(entry => typeof entry === "object" ? entry?.name || entry?.title || entry?.label || "" : entry).filter(Boolean).join(", ");
    if (value && typeof value === "object") return value.name || value.title || value.url || "";
    return value == null ? "" : String(value);
  };
  const pickList = (object, path) => {
    const value = pickPath(object, path);
    if (Array.isArray(value)) return value.map(entry => typeof entry === "object" ? entry?.name || entry?.title || entry?.label || "" : String(entry)).filter(Boolean);
    return value ? String(value).split(/,\s*/).filter(Boolean) : [];
  };
  const fillTemplate = (template, values) => String(template || "").replace(/\{(query|id|apikey)\}/g, (_, key) => key === "apikey" ? encodeURIComponent(values.apikey || "") : encodeURIComponent(values[key] ?? ""));
  function customRequest(config, url, settings) {
    const safe = secureEndpoint(url);
    const headers = {};
    if (config.apiKey && config.apiKeyHeader) {
      const name = String(config.apiKeyHeader).trim();
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,80}$/.test(name) || /^(host|cookie|origin|referer|content-length|connection|transfer-encoding|proxy-.*|sec-.*)$/i.test(name)) throw new Error("Choose a valid, non-restricted API-key header name.");
      headers[name] = String(config.apiKey).slice(0, 2048);
    }
    // Custom hosts are intentionally outside the dev proxy allowlist. In local
    // preview, call them directly and rely on their CORS policy instead of
    // routing a user-configured endpoint through a fixed-provider proxy.
    return requestJson(safe, { ...settings, headers, directPreview: true });
  }
  const mapCustomResult = (config, row, category, index) => {
    const map = config.map || {};
    const id = pickText(row, map.id) || pickText(row, map.title) || String(index);
    const image = pickText(row, map.image) || (config.imageTemplate ? config.imageTemplate.replace(/\{id\}/g, encodeURIComponent(id)) : "");
    return result(`custom:${config.id}`, category, id, pickText(row, map.title), { year: pickText(row, map.year).slice(0, 4), image, description: pickText(row, map.description), rating: Number(pickText(row, map.rating)) || 0, url: pickText(row, map.url), subtitle: pickText(row, map.subtitle) || pickText(row, map.year).slice(0, 4) });
  };
  async function searchCustom(config, query, category, settings) {
    const url = fillTemplate(config.searchUrl, { query, apikey: config.apiKey });
    const data = await customRequest(config, url, settings);
    const rows = config.resultsPath ? pickPath(data, config.resultsPath) : data;
    return (Array.isArray(rows) ? rows : []).slice(0, 25).map((row, index) => mapCustomResult(config, row, category, index)).filter(row => row.title);
  }
  // Used by the "Test" button in the custom source editor.
  async function testCustomSource(config, query = "inception", settings = {}) {
    const results = await searchCustom(config, query, config.categories?.[0] || "movie", settings);
    return results.slice(0, 5);
  }
  async function loadCustomDetails(config, item, settings) {
    if (!config.detailUrl) return null;
    const data = await customRequest(config, fillTemplate(config.detailUrl, { id: item.providerId, query: item.title, apikey: config.apiKey }), settings);
    const root = config.detailRoot ? pickPath(data, config.detailRoot) : data;
    return { root, pickText, pickList };
  }
  const searcherFor = source => searchers[source.key] || (source.custom ? (query, category, settings) => searchCustom(source.config, query, category, settings) : null);
  async function runSourceSearch(source, query, category, settings) {
    return await searcherFor(source)(query, category, settings);
  }
  async function searchOne(query, category, settings = {}) {
    if (!String(query || "").trim()) return [];
    const sources = metadata.available(category, settings).filter(source => typeof searcherFor(source) === "function" && !(source.keyRequired && !settings.apiKeys?.[source.key]?.trim()));
    if (!sources.length) throw new Error(`No enabled metadata sources are available for ${category}.`);
    const settled = await Promise.allSettled(sources.map(source => runSourceSearch(source, query.trim(), category, settings)));
    const results = settled.flatMap(entry => entry.status === "fulfilled" ? entry.value : []);
    const errors = settled.filter(entry => entry.status === "rejected").map(entry => entry.reason?.message || String(entry.reason));
    const unique = new Map();
    for (const item of results) if (item?.title) unique.set(`${item.source}:${item.providerId || item.title.toLowerCase()}`, item);
    if (!unique.size && errors.length) throw new Error(errors.join("; "));
    const output = [...unique.values()].slice(0, 36);
    output.warnings = errors;
    return output;
  }
  async function searchSourceOne(query, category, settings = {}, sourceKey) {
    if (!String(query || "").trim()) return [];
    const source = metadata.available(category, settings).find(entry => entry.key === sourceKey);
    if (!source) throw new Error("Enable this metadata source in Settings → Metadata Sources first.");
    const searcher = searcherFor(source);
    if (typeof searcher !== "function") throw new Error("This metadata source does not support search.");
    const results = await runSourceSearch(source, query.trim(), category, settings);
    const unique = new Map();
    for (const item of results) if (item?.title) unique.set(`${item.source}:${item.providerId || item.title.toLowerCase()}`, item);
    return [...unique.values()].slice(0, 36);
  }
  // Suggestions for the empty Discover page: what is on TV / streaming now and trending anime, from the enabled sources.
  async function trendingOne(category, settings = {}, sourceKey = "") {
    const enabled = new Set(metadata.available(category, settings).map(source => source.key));
    const want = key => enabled.has(key) && (!sourceKey || sourceKey === key);
    const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const jobs = [];
    if (want("tvmaze") && category === "series") {
      const showsFrom = (rows, limit = 24) => { const seen = new Map(); (Array.isArray(rows) ? rows : []).forEach(row => { const show = row.show || row._embedded?.show; if (show?.id && !seen.has(show.id) && tvmazeMatches(show, category) && (show.image?.medium || show.image?.original)) seen.set(show.id, show); }); return [...seen.values()].slice(0, limit).map(show => tvmazeResult(show, category)); };
      jobs.push(async () => {
        const [stream, tv, soon] = await Promise.all([
          requestJson(`https://api.tvmaze.com/schedule/web?date=${day(0)}`, settings).catch(() => []),
          requestJson(`https://api.tvmaze.com/schedule?country=US&date=${day(0)}`, settings).catch(() => []),
          requestJson(`https://api.tvmaze.com/schedule/web?date=${day(1)}`, settings).catch(() => [])
        ]);
        return [{ source: "tvmaze", title: "Streaming today", items: showsFrom(stream) }, { source: "tvmaze", title: "On TV today", items: showsFrom(tv) }, { source: "tvmaze", title: "Streaming tomorrow", items: showsFrom(soon) }];
      });
    }
    if (want("tmdb") && settings.apiKeys?.tmdb?.trim()) jobs.push(async () => {
      const kind = category === "movie" ? "movie" : "tv";
      const latestSort = kind === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
      const releaseParam = kind === "movie" ? "release_date.lte" : "first_air_date.lte";
      const [trending, latest, genreData] = await Promise.all([
        tmdbGet(`/trending/${kind}/week`, settings).catch(() => ({ results: [] })),
        tmdbGet(`/discover/${kind}?sort_by=${latestSort}&${releaseParam}=${day(0)}&include_adult=false&page=1`, settings).catch(() => ({ results: [] })),
        tmdbGet(`/genre/${kind}/list`, settings).catch(() => ({ genres: [] }))
      ]);
      const genreNames = new Map((genreData.genres || []).map(row => [row.id, row.name]));
      const tmdbRows = (rows, title) => ({ source: "tmdb", title, items: (rows || []).slice(0, 24).map(row => {
        const release = row.release_date || row.first_air_date || "";
        return result("tmdb", category, row.id, row.title || row.name, {
          year: release.slice(0, 4), image: row.poster_path ? `https://image.tmdb.org/t/p/w342${row.poster_path}` : "",
          description: row.overview || "", rating: Number(row.vote_average) || 0,
          genres: (row.genre_ids || []).map(id => genreNames.get(id)).filter(Boolean),
          url: `https://www.themoviedb.org/${kind === "movie" ? "movie" : "tv"}/${row.id}`, subtitle: release.slice(0, 4)
        }); }).filter(row => row.title && row.image) });
      return [tmdbRows(trending.results, "Trending"), tmdbRows(latest.results, "Latest")];
    });
    if (want("anilist")) jobs.push(async () => {
      const list = async sort => { const gql = `query{Page(perPage:24){media(type:ANIME,format_in:${anilistFormats(category)},sort:${sort},isAdult:false){${ANILIST_FIELDS}}}}`; const data = await requestJson("https://graphql.anilist.co", { ...settings, method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: gql }) }); return anilistRows(anilistData(data).Page?.media, category); };
      const [trendingNow, popular] = await Promise.all([list("TRENDING_DESC"), list("POPULARITY_DESC")]);
      const noun = category === "movie" ? "anime movies" : "anime";
      return [{ source: "anilist", title: `Trending ${noun}`, items: trendingNow }, { source: "anilist", title: `Popular ${noun}`, items: popular }];
    });
    metadata.available(category, settings).filter(source => source.custom && source.config.suggestionsUrl && (!sourceKey || sourceKey === source.key)).forEach(source => jobs.push(async () => {
      const config = source.config;
      const data = await customRequest(config, fillTemplate(config.suggestionsUrl, { apikey: config.apiKey }), settings);
      const rows = config.suggestionsPath || config.resultsPath ? pickPath(data, config.suggestionsPath || config.resultsPath) : data;
      return [{ source: source.key, title: `${source.name}`, items: (Array.isArray(rows) ? rows : []).slice(0, 12).map((row, index) => mapCustomResult(config, row, category, index)).filter(row => row.title) }];
    }));
    const settled = await Promise.allSettled(jobs.map(job => job()));
    const sections = settled.flatMap(entry => entry.status === "fulfilled" ? entry.value : []).filter(section => section.items.length);
    if (!sections.length && settled.some(entry => entry.status === "rejected")) throw settled.find(entry => entry.status === "rejected").reason;
    return sections;
  }
  // "all" runs the search for every type (movies and series) and merges the results.
  const allCategories = () => (window.APP_CONFIG?.categories || []).map(row => row.key);
  const dedupe = rows => { const unique = new Map(); for (const row of rows) if (row?.title) unique.set(`${row.source}:${row.category}:${row.providerId || row.title.toLowerCase()}`, row); return [...unique.values()]; };
  async function search(query, category, settings = {}) {
    if (category !== "all") return searchOne(query, category, settings);
    const settled = await Promise.allSettled(allCategories().map(key => searchOne(query, key, settings)));
    const rows = settled.flatMap(entry => entry.status === "fulfilled" ? entry.value : []);
    const warnings = settled.flatMap(entry => entry.status === "fulfilled" ? entry.value.warnings || [] : [entry.reason?.message || String(entry.reason)]);
    if (!rows.length && settled.some(entry => entry.status === "rejected") && settled.every(entry => entry.status === "rejected")) throw settled[0].reason;
    const output = dedupe(rows).slice(0, 48); output.warnings = [...new Set(warnings)]; return output;
  }
  async function searchSource(query, category, settings = {}, sourceKey) {
    if (category !== "all") return searchSourceOne(query, category, settings, sourceKey);
    const source = metadata.list().find(row => row.key === sourceKey);
    const keys = (source?.categories || allCategories());
    const settled = await Promise.allSettled(keys.map(key => searchSourceOne(query, key, settings, sourceKey)));
    const rows = settled.flatMap(entry => entry.status === "fulfilled" ? entry.value : []);
    if (!rows.length && settled.every(entry => entry.status === "rejected")) throw settled[0].reason;
    return dedupe(rows).slice(0, 48);
  }
  async function trending(category, settings = {}, sourceKey = "") {
    if (category !== "all") return trendingOne(category, settings, sourceKey);
    const source = sourceKey ? metadata.list().find(row => row.key === sourceKey) : null;
    const keys = [...(source?.categories || allCategories())].sort((a, b) => (a === "series" ? -1 : 0) - (b === "series" ? -1 : 0));
    const settled = await Promise.allSettled(keys.map(key => trendingOne(key, settings, sourceKey)));
    const sections = settled.flatMap(entry => entry.status === "fulfilled" ? entry.value : []);
    // Series rows first (TV schedules), then movies; keep the first of any duplicated heading.
    const seen = new Set(); const merged = sections.filter(section => !seen.has(section.title) && seen.add(section.title));
    if (!merged.length && settled.every(entry => entry.status === "rejected")) throw settled[0].reason;
    return merged;
  }
  // Keep only entry points consumed by the app and detail controller. Provider
  // helpers such as result/textFromHtml remain private implementation details.
  window.SplitAppDiscovery = Object.freeze({ search, searchSource, trending, testCustomSource, loadCustomDetails, requestJson, sourceText, tmdbGet, tvdbGet, encode, imageUrl });
})();
