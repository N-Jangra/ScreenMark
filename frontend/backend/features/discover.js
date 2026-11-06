// App-specific metadata search service.
(() => {
  const metadata = window.SplitAppMetadata;
  const appKey = metadata.appKey;
  const cacheName = `splitapp_${appKey}_metadata`;
  const capacitor = window.Capacitor;
  const nativeApp = Boolean(capacitor?.isNativePlatform?.() || ["android", "ios"].includes(capacitor?.getPlatform?.()));
  const nativeHttp = window.CapacitorHttp || capacitor?.Plugins?.CapacitorHttp || capacitor?.Plugins?.Http || null;
  const localPreview = !nativeApp && location.protocol.startsWith("http") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const encode = value => encodeURIComponent(String(value || "").trim());
  async function wireRequest(url, options = {}, responseType = "json") {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { Accept: responseType === "text" ? "text/html,application/xhtml+xml,*/*" : "application/json", ...(options.headers || {}) };
    // Browsers refuse to set Cookie / User-Agent. The Android app sends them as-is; the local preview passes them to its proxy; a plain website drops them.
    if (!nativeApp) {
      for (const [name, key] of [["Cookie", "x-source-cookie"], ["User-Agent", "x-source-user-agent"]]) {
        if (headers[name] && localPreview) headers[key] = headers[name];
        delete headers[name];
      }
    }
    if (nativeApp && nativeHttp?.request) {
      const response = await nativeHttp.request({
        url, method, headers, data: options.body || null,
        responseType: responseType === "text" ? "text" : "json", connectTimeout: 15000, readTimeout: 20000
      });
      const status = Number(response?.status || 0);
      if (status >= 400) throw Object.assign(new Error(`${status} ${response.statusText || "Metadata request failed"}`), { status });
      const data = response?.data;
      if (responseType === "text") return typeof data === "string" ? data : String(data ?? "");
      if (typeof data === "string") {
        try { return JSON.parse(data); }
        catch { throw new Error("Metadata provider returned invalid JSON."); }
      }
      return data;
    }
    const requestUrl = localPreview ? `/proxy?url=${encodeURIComponent(url)}` : url;
    const response = await fetch(requestUrl, { method, headers, body: options.body });
    if (!response.ok) throw Object.assign(new Error(`${response.status} ${response.statusText}`), { status: response.status });
    return responseType === "text" ? await response.text() : await response.json();
  }
  // Cache Storage can stall on some devices/profiles; never let it block a request.
  const cacheStep = (promise, ms = 2500) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("cache timeout")), ms))]);
  // Every request to a known source picks up that source's domain / user agent / cookies from Settings.
  function applySource(url, options = {}) {
    let host = ""; try { host = new URL(url).hostname; } catch (_) { return { url, options }; }
    const provider = metadata.providers.find(source => source.domain === host); if (!provider) return { url, options };
    const resolved = metadata.resolve(provider.key, url, options);
    return { url: resolved.url, options: { ...options, headers: { ...(options.headers || {}), ...resolved.headers } } };
  }
  async function requestJson(url, options = {}) {
    ({ url, options } = applySource(url, options));
    const method = String(options.method || "GET").toUpperCase();
    const canCache = method === "GET" && !options.noCache && !options.forceRefresh && window.caches && !/[?&](?:key|apikey)=/i.test(url);
    let cache = null, stale = null;
    if (canCache) {
      try {
        cache = await cacheStep(window.caches.open(cacheName)); stale = await cacheStep(cache.match(url));
        const fetchedAt = Number(stale?.headers.get("x-splitapp-cached-at")) || 0;
        if (stale && fetchedAt && Date.now() - fetchedAt < 6 * 60 * 60 * 1000) return stale.json();
      } catch { cache = null; stale = null; }
    }
    try {
      const data = await wireRequest(url, options, "json");
      if (cache) {
        const headers = new Headers({ "Content-Type": "application/json", "x-splitapp-cached-at": String(Date.now()) });
        try { await cacheStep(cache.put(url, new Response(JSON.stringify(data), { status: 200, headers }))); } catch { /* caching is best-effort */ }
      }
      return data;
    } catch (error) {
      if (stale && options.offlineFallback !== "none") return stale.json();
      throw error;
    }
  }
  const requestText = (url, options = {}) => { ({ url, options } = applySource(url, options)); return wireRequest(url, options, "text"); };
  // One request through a source's own options (domain / user agent / cookies from its settings page).
  const sourceJson = (sourceKey, url, settings = {}, extra = {}) => requestJson(url, { ...settings, ...extra });
  const sourceText = (sourceKey, url, settings = {}, extra = {}) => requestText(url, { ...settings, ...extra });
  const tmdbAuth = key => key.length > 40 ? { headers: { Authorization: `Bearer ${key}` } } : { query: `api_key=${encodeURIComponent(key)}` };
  const tmdbGet = (path, settings) => {
    const key = settings.apiKeys?.tmdb?.trim(); if (!key) throw new Error("Add a TMDB API key in Settings → Metadata Sources.");
    const auth = tmdbAuth(key), full = auth.query ? `${path}${path.includes("?") ? "&" : "?"}${auth.query}` : path;
    return sourceJson("tmdb", `https://api.themoviedb.org/3${full}`, settings, { headers: auth.headers, noCache: Boolean(auth.query) })
      .catch(error => { throw error?.status === 401 ? new Error("TMDB rejected your API key. Check it in Metadata Sources.") : error; });
  };
  const tvdbTokens = new Map();
  const tvdbGet = async (path, settings) => {
    const key = settings.apiKeys?.tvdb?.trim(); if (!key) throw new Error("Add a TheTVDB API key in Settings → Metadata Sources.");
    let token = tvdbTokens.get(key);
    if (!token) {
      const login = await sourceJson("tvdb", "https://api4.thetvdb.com/v4/login", settings, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apikey: key }), noCache: true }).catch(error => { throw error?.status === 401 ? new Error("TheTVDB rejected your API key. Check it in Metadata Sources.") : error; });
      token = login?.data?.token; if (!token) throw new Error("TheTVDB did not return a login token.");
      tvdbTokens.set(key, token);
    }
    return sourceJson("tvdb", `https://api4.thetvdb.com/v4${path}`, settings, { headers: { Authorization: `Bearer ${token}` }, noCache: true });
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
  const tvmazeResult = (show, category) => result("tvmaze", category, show.id, show.name, { year: show.premiered?.slice(0, 4), image: show.image?.medium || show.image?.original, description: textFromHtml(show.summary), rating: show.rating?.average, goal: 0, url: show.url, subtitle: [show.premiered?.slice(0, 4), show.type, show.network?.name || show.webChannel?.name].filter(Boolean).join(" · ") });
  const anilistFormats = category => category === "movie" ? "[MOVIE]" : "[TV, TV_SHORT, ONA, OVA, SPECIAL]";
  const anilistRows = (rows, category) => (rows || []).map(row => result("anilist", category, row.id, row.title?.english || row.title?.romaji, { year: row.startDate?.year, image: row.coverImage?.large || row.coverImage?.medium, description: textFromHtml(row.description), rating: row.averageScore ? row.averageScore / 10 : 0, goal: category === "movie" ? 0 : (row.episodes || 0), url: row.siteUrl, subtitle: [row.startDate?.year, row.format, row.averageScore ? `★ ${(row.averageScore / 10).toFixed(1)}` : ""].filter(Boolean).join(" · ") }));
  const ANILIST_FIELDS = "id title{romaji english} coverImage{large medium} description startDate{year} averageScore episodes format genres siteUrl";
  const searchers = {
    tvmaze: async (query, category, settings) => {
      const data = await requestJson(`https://api.tvmaze.com/search/shows?q=${encode(query)}`, settings);
      return (Array.isArray(data) ? data : []).map(row => row.show || {}).filter(show => tvmazeMatches(show, category)).map(show => tvmazeResult(show, category));
    },
    anilist: async (query, category, settings) => {
      const gql = `query($q:String){Page(perPage:15){media(search:$q,type:ANIME,format_in:${anilistFormats(category)},sort:SEARCH_MATCH){${ANILIST_FIELDS}}}}`;
      const data = await requestJson("https://graphql.anilist.co", { ...settings, method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: gql, variables: { q: query } }) });
      return anilistRows(data.data?.Page?.media, category);
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
  const safeHttp = url => { try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : ""; } catch { return ""; } };
  function customRequest(config, url, settings) {
    const safe = safeHttp(url);
    if (!safe) throw new Error("The custom source URL must start with http:// or https://.");
    const headers = {};
    if (config.apiKey && config.apiKeyHeader) headers[config.apiKeyHeader] = config.apiKey;
    return requestJson(safe, { ...settings, headers });
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
      const showsFrom = (rows, limit = 14) => { const seen = new Map(); (Array.isArray(rows) ? rows : []).forEach(row => { const show = row.show || row._embedded?.show; if (show?.id && !seen.has(show.id) && tvmazeMatches(show, category) && (show.image?.medium || show.image?.original)) seen.set(show.id, show); }); return [...seen.values()].slice(0, limit).map(show => tvmazeResult(show, category)); };
      jobs.push(async () => {
        const [stream, tv, soon] = await Promise.all([
          requestJson(`https://api.tvmaze.com/schedule/web?date=${day(0)}`, settings).catch(() => []),
          requestJson(`https://api.tvmaze.com/schedule?country=US&date=${day(0)}`, settings).catch(() => []),
          requestJson(`https://api.tvmaze.com/schedule/web?date=${day(1)}`, settings).catch(() => [])
        ]);
        return [{ source: "tvmaze", title: "Streaming today", items: showsFrom(stream) }, { source: "tvmaze", title: "On TV today", items: showsFrom(tv) }, { source: "tvmaze", title: "Streaming tomorrow", items: showsFrom(soon) }];
      });
    }
    // Public iTunes top-movies chart (no key). Titles are resolved through Mix fetch, so details come from your enabled sources.
    if (category === "movie" && !sourceKey) jobs.push(async () => {
      const data = await requestJson("https://itunes.apple.com/us/rss/topmovies/limit=24/json", settings);
      const entries = Array.isArray(data?.feed?.entry) ? data.feed.entry : [];
      const poster = list => String((list || []).slice(-1)[0]?.label || "").replace(/\/\d+x\d+bb\.(png|jpg)$/, "/300x450bb.$1");
      const items = entries.map(row => { const title = row["im:name"]?.label; return result("mix", category, window.SplitAppMix?.norm ? window.SplitAppMix.norm(title) : String(title).toLowerCase(), title, { year: String(row["im:releaseDate"]?.label || "").slice(0, 4), image: poster(row["im:image"]), description: row.summary?.label || "", subtitle: [String(row["im:releaseDate"]?.label || "").slice(0, 4), row.category?.attributes?.label].filter(Boolean).join(" · "), mixLookup: true }); }).filter(row => row.title);
      return [{ source: "mix", title: "Top movies right now", items: items.slice(0, 14) }, { source: "mix", title: "More popular movies", items: items.slice(14) }];
    });
    if (want("anilist")) jobs.push(async () => {
      const list = async sort => { const gql = `query{Page(perPage:14){media(type:ANIME,format_in:${anilistFormats(category)},sort:${sort},isAdult:false){${ANILIST_FIELDS}}}}`; const data = await requestJson("https://graphql.anilist.co", { ...settings, method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: gql }) }); return anilistRows(data.data?.Page?.media, category); };
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
  window.SplitAppDiscovery = Object.freeze({ appKey, search, searchSource, trending, testCustomSource, loadCustomDetails, requestJson, requestText, sourceJson, sourceText, tmdbGet, tvdbGet, encode, result, textFromHtml });
})();
