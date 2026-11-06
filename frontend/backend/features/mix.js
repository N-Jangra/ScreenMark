// Experimental "Mix fetch": search every enabled source as one plain list, then fetch and merge details from all of them.
(() => {
  const metadata = window.SplitAppMetadata;
  const discovery = window.SplitAppDiscovery;
  const controller = window.SplitAppDetailController;
  const merge = window.SplitAppMixMerge.merge;
  const norm = title => String(title || "").toLowerCase().replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();
  const yearOf = value => String(value || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
  const withTimeout = (promise, ms = 15000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out")), ms))]);
  const LIMITS = { tmdb: 4, tvdb: 3, omdb: 4, tvmaze: 3, anilist: 2, imdb: 3 };
  const lanes = new Map();
  const inLane = (key, run) => {
    const lane = lanes.get(key) || { active: 0, queue: [] }; lanes.set(key, lane);
    return new Promise((resolve, reject) => {
      const start = () => { lane.active += 1; Promise.resolve().then(run).then(resolve, reject).finally(() => { lane.active -= 1; lane.queue.shift()?.(); }); };
      lane.active < (LIMITS[key] || 4) ? start() : lane.queue.push(start);
    });
  };
  const transient = error => error?.transient !== false && error?.message !== "No match";
  async function retrying(run, settings = {}) {
    const tries = (settings.background ? Math.max(0, Math.min(5, Number(settings.syncRetries ?? 1))) : 1) + 1;
    const pause = settings.background ? Math.max(0, Number(settings.syncRetryDelay ?? 2)) * 1000 : 700;
    let last;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      try { return await run(); }
      catch (error) { last = error; if (!transient(error) || attempt === tries - 1) break; await new Promise(resolve => setTimeout(resolve, pause * (attempt + 1))); }
    }
    throw last;
  }
  const waitFor = settings => settings.background ? Math.max(5, Number(settings.syncTimeout) || 25) * 1000 : 15000;
  const NO_MATCH_TTL = 14 * 86400000;
  const sameTitle = (a, b) => {
    const strip = value => norm(value).replace(/\b(?:19|20)\d{2}\b/g, " ").replace(/\b(definitive|complete|ultimate|deluxe|enhanced|special|director s cut|directors cut|anniversary|remastered|remake|edition|extended|collection)\b/g, " ").replace(/\s+/g, " ").trim();
    return !strip(a) || !strip(b) || strip(a) === strip(b);
  };

  // Share in-flight and recent source calls; several background actions can request the same metadata.
  const memo = new Map();
  const memoized = (key, run, bypass = false, ttl = 10 * 60 * 1000) => {
    const hit = memo.get(key);
    if (!bypass && hit && Date.now() - hit.at < ttl) return hit.promise;
    const promise = run();
    memo.set(key, { at: Date.now(), promise });
    promise.catch(() => { if (memo.get(key)?.promise === promise) memo.delete(key); });
    if (memo.size > 600) memo.delete(memo.keys().next().value);
    return promise;
  };
  const searchSource = (title, category, settings, key) => memoized(`s|${category}|${key}|${norm(title)}`, () => inLane(key, () => withTimeout(discovery.searchSource(title, category, settings, key), waitFor(settings))), Boolean(settings.forceRefresh));
  const loadDetails = (key, providerId, item, settings) => memoized(`d|${item.category}|${key}|${providerId}|${item.title}`, () => inLane(key, () => withTimeout(controller.load(item, settings), waitFor(settings))), Boolean(settings.forceRefresh));

  // One plain list: the same title from several sources becomes one row with a chip per source.
  async function search(query, category, settings = {}) {
    const results = await discovery.search(query, category, settings);
    const groups = new Map();
    for (const row of results) {
      const titleKey = norm(row.title); if (!titleKey) continue;
      const categoryKey = row.category || category, year = yearOf(row.year), key = `${categoryKey}:${titleKey}|${year}`;
      if (!groups.has(key)) groups.set(key, { key: titleKey, title: row.title, year: row.year || "", image: row.image || "", category: categoryKey, sources: [] });
      const group = groups.get(key);
      if (!group.year && row.year) group.year = row.year;
      if (!group.image && row.image) group.image = row.image;
      if (!group.sources.includes(row.source)) group.sources.push(row.source);
    }
    const ordered = [...groups.values()];
    // Join a yearless provider result to a dated result only when they come from different sources.
    for (const group of ordered) {
      if (yearOf(group.year)) continue;
      const home = ordered.find(other => other !== group && other.category === group.category && yearOf(other.year) && norm(other.title) === norm(group.title) && !group.sources.some(source => other.sources.includes(source)));
      if (!home) continue;
      home.sources.push(...group.sources);
      if (!home.image && group.image) home.image = group.image;
      group.merged = true;
    }
    return ordered.filter(group => !group.merged).slice(0, 40);
  }

  const bestMatch = (rows, title, year = "") => {
    const target = norm(title), targetYear = yearOf(year);
    const exact = rows.filter(row => norm(row.title) === target);
    if (targetYear && exact.length) {
      const near = exact.find(row => yearOf(row.year) === targetYear) || exact.find(row => !yearOf(row.year));
      if (near) return near;
      const close = exact.filter(row => Math.abs(Number(yearOf(row.year)) - Number(targetYear)) <= 2);
      return close.length === 1 ? close[0] : null;
    }
    if (exact.length) return exact.length === 1 ? exact[0] : null;
    // Permit edition subtitles while avoiding unrelated titles that merely contain the query.
    const subtitled = (long, short) => long.startsWith(short + " ") && /^(definitive|remastered|remake|complete|ultimate|deluxe|enhanced|special|director|anniversary|gold|standard|edition|extended|season)\b/.test(long.slice(short.length + 1));
    return rows.find(row => { const name = norm(row.title); return subtitled(name, target) || subtitled(target, name); }) || null;
  };

  // Fetch details from every enabled source that knows this title, then merge.
  async function load(item, settings = {}, onPartial = null) {
    const title = item.title, category = item.category;
    if (!title) throw new Error("This title has no name to look up.");
    let sources = metadata.available(category, settings).filter(source => !item.mixSkip?.[source.key]);
    if (!sources.length) throw new Error("Enable at least one metadata source first.");
    const completedEntries = [];
    const mixed = item.metadataSource === "mix";
    const primaryKey = (mixed ? item.mixPrimary?.key : item.metadataSource) || "";
    const primaryId = (mixed ? item.mixPrimary?.providerId : item.providerId) || "";
    const hasPrimary = Boolean(primaryKey && primaryId && sources.some(source => source.key === primaryKey));
    const pins = { ...(item.sourceIds || {}), ...(item.mixPins || {}) };
    if (hasPrimary) pins[primaryKey] = primaryId;
    // Only expect links to sources that are enabled for this refresh. Disabled linked providers
    // stay saved, but must not make an otherwise successful refresh fail.
    const enabledKeys = new Set(sources.map(source => source.key));
    const expected = new Set(Object.keys(pins).filter(key => enabledKeys.has(key)));
    const answered = new Set(), noMatch = new Set(), failures = [];
    const capped = new Set(), maxSources = settings.background ? Math.max(0, Number(settings.syncMaxSources) || 0) : 0;
    if (maxSources > 0) {
      const linked = sources.filter(source => pins[source.key]);
      const allowed = new Set([...linked, ...sources.filter(source => !pins[source.key])].slice(0, Math.max(maxSources, linked.length)).map(source => source.key));
      sources.forEach(source => { if (!allowed.has(source.key)) capped.add(source.key); });
      sources = sources.filter(source => allowed.has(source.key));
    }
    const tasks = sources.map(async (source, rank) => {
      const isPrimary = hasPrimary && source.key === primaryKey, order = isPrimary ? -1 : rank;
      let match;
      if (pins[source.key]) match = { providerId: pins[source.key], title: item.title, image: item.image, url: item.url, year: item.year, description: item.description };
      else {
        if (settings.background && Array.isArray(settings.syncOnly) && !settings.syncOnly.includes(source.key)) { answered.add(source.key); throw new Error("No match"); }
        const knownMissing = Number(item.mixNoMatch?.[source.key]) > Date.now() - NO_MATCH_TTL && !settings.recheckNoMatch;
        if (knownMissing) { answered.add(source.key); noMatch.add(source.key); throw new Error("No match"); }
        const rows = await retrying(() => searchSource(title, category, settings, source.key), settings);
        match = bestMatch(rows, title, item.year);
        answered.add(source.key);
        if (!match) { if (rows.length) noMatch.add(source.key); throw new Error("No match"); }
      }
      const data = await retrying(() => loadDetails(source.key, match.providerId, { ...item, category, metadataSource: source.key, providerId: match.providerId, title: match.title, image: match.image || item.image, url: match.url || item.url, year: match.year || item.year, description: match.description || item.description }, settings), settings);
      const entry = { key: source.key, name: source.name, data, order, providerId: match.providerId };
      completedEntries.push(entry);
      if (typeof onPartial === "function" && [...expected].every(key => completedEntries.some(done => done.key === key))) {
        try { onPartial(merge([...completedEntries].sort((a, b) => a.order - b.order), title, item), entry); } catch (_) {}
      }
      return entry;
    });
    const settled = await Promise.allSettled(tasks);
    const entries = settled.flatMap((outcome, index) => {
      if (outcome.status === "fulfilled") return [outcome.value];
      const error = outcome.reason;
      if (error?.message !== "No match") failures.push(`${sources[index].name}: ${error?.message || "failed"}`);
      return [];
    }).sort((a, b) => a.order - b.order);
    const fail = (message, isTransient) => Object.assign(new Error(message), { transient: isTransient });
    if (!entries.length) throw fail(`No enabled source had details for “${title}”${failures.length ? ` (${failures[0]})` : ""}.`, failures.length > 0);
    const missing = [...expected].filter(key => !entries.some(entry => entry.key === key));
    if (missing.length) throw fail(`Known source${missing.length > 1 ? "s" : ""} (${missing.join(", ")}) did not answer, keeping the existing data.`, true);
    const result = await (settings.background && window.SplitAppIDB?.merge ? window.SplitAppIDB.merge(entries, title, item) : merge(entries, title, item));
    result.checkedSources = [...new Set([...answered, ...capped, ...entries.map(entry => entry.key)])].sort();
    result.sourceMeta = Object.fromEntries(entries.map(entry => [entry.key, { title: entry.data?.title || "", year: entry.data?.year || "", url: entry.data?.url || "", image: entry.data?.portraitImage || entry.data?.image || "" }]));
    result.noMatchSources = [...noMatch].filter(key => !entries.some(entry => entry.key === key));
    result.reviewFlags = entries.filter(entry => !sameTitle(entry.data?.title, title) && String((item.matchOk || {})[entry.key] ?? "") !== String(entry.providerId ?? "")).map(entry => ({ key: entry.key, title: entry.data?.title || "", providerId: String(entry.providerId ?? "") }));
    return result;
  }

  // Watch-time only lookup for titles whose saved source has no runtime: OMDb, AniList, then TVmaze.
  async function runtime(item, settings = {}) {
    const category = item.category, enabled = new Set(metadata.available(category, settings).map(source => source.key));
    for (const key of ["omdb", "tvmaze", "anilist"]) {
      if (!enabled.has(key)) continue;
      try {
        const match = bestMatch(await withTimeout(searchSource(item.title, category, settings, key)), item.title, item.year);
        if (!match) continue;
        const data = await withTimeout(loadDetails(key, match.providerId, { ...item, category, metadataSource: key, providerId: match.providerId, title: match.title, image: match.image, url: match.url, year: match.year }, settings));
        const facts = data.facts || {};
        if (facts.runtimeMinutes) return { runtimeMinutes: facts.runtimeMinutes, episodeCount: facts.episodeCount || 0, seasonCount: facts.seasonCount || 0, totalMinutes: facts.totalMinutes || facts.runtimeMinutes, runtimeSource: key };
      } catch (_) { /* try the next source */ }
    }
    return null;
  }

  window.SplitAppMix = Object.freeze({ search, load, merge, norm, runtime });
})();
