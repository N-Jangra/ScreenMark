// Experimental "Mix fetch": search every enabled source as one plain list, then fetch and merge details from all of them.
(() => {
  const metadata = window.SplitAppMetadata;
  const discovery = window.SplitAppDiscovery;
  const controller = window.SplitAppDetailController;
  const norm = title => String(title || "").toLowerCase().replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/^(the|a|an) /, "").trim();
  const isEmpty = value => value == null || value === "" || value === 0 || (Array.isArray(value) && !value.length);
  const withTimeout = (promise, ms = 25000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out")), ms))]);

  // One plain list: the same title from several sources becomes one row with a chip per source.
  async function search(query, category, settings = {}) {
    const results = await discovery.search(query, category, settings);
    const groups = new Map();
    for (const row of results) {
      const key = `${row.category || category}:${norm(row.title)}|${String(row.year || "").slice(0, 4)}`; if (!norm(row.title)) continue;
      const loose = [...groups.keys()].find(existing => existing.split("|")[0] === `${row.category || category}:${norm(row.title)}` && (!existing.split("|")[1] || !String(row.year || "").slice(0, 4)));
      const groupKey = groups.has(key) ? key : loose || key;
      if (!groups.has(groupKey)) groups.set(groupKey, { key: norm(row.title), title: row.title, year: row.year || "", image: row.image || "", category: row.category || category, sources: [] });
      const group = groups.get(groupKey);
      if (!group.year && row.year) group.year = row.year;
      if (!group.image && row.image) group.image = row.image;
      if (!group.sources.includes(row.source)) group.sources.push(row.source);
    }
    return [...groups.values()].slice(0, 40);
  }

  const bestMatch = (rows, title, year) => {
    const target = norm(title), wantYear = String(year || "").slice(0, 4);
    const exact = rows.filter(row => norm(row.title) === target);
    return exact.find(row => wantYear && String(row.year || "").slice(0, 4) === wantYear) || exact[0] || rows.find(row => { const name = norm(row.title); return name.includes(target) || target.includes(name); }) || null;
  };

  const LIST_LABELS = /^(genres?|director|directors|writers?|cast|tags|also known as|languages?|countr(y|ies)|network|studio)$/i;
  const toList = value => Array.isArray(value) ? value.map(String).filter(Boolean) : String(value ?? "").split(/,\s*/).map(part => part.trim()).filter(Boolean);
  const unique = (list, keyOf) => { const seen = new Set(); return list.filter(entry => { const key = keyOf(entry); if (!key || seen.has(key)) return false; seen.add(key); return true; }); };

  function merge(entries, title) {
    const parts = entries.map(entry => entry.data);
    const first = pick => parts.map(pick).find(value => !isEmpty(value)) ?? "";
    const fields = new Map();
    for (const part of parts) for (const row of part.fields || []) {
      if (isEmpty(row.value)) continue;
      const label = String(row.label).trim(), key = label.toLowerCase();
      if (!fields.has(key)) fields.set(key, { label, value: row.value });
      else if (LIST_LABELS.test(label)) fields.get(key).value = unique([...toList(fields.get(key).value), ...toList(row.value)], item => item.toLowerCase());
    }
    fields.set("sources", { label: "Merged from", value: entries.map(entry => entry.name) });
    const sections = new Map();
    for (const part of parts) for (const section of part.sections || []) {
      const key = `${section.kind}:${section.title.replace(/\s*\(\d+\)$/, "")}`;
      if (!sections.has(key)) sections.set(key, { ...section, items: [] });
      sections.get(key).items.push(...section.items);
    }
    const facts = {};
    for (const part of parts) for (const [key, value] of Object.entries(part.facts || {})) if (isEmpty(facts[key]) && !isEmpty(value)) facts[key] = value;
    const description = parts.map(part => part.description || "").sort((a, b) => b.length - a.length)[0] || "";
    return {
      source: "mix", mixSources: entries.map(entry => entry.name), title: first(part => part.title) || title, description,
      image: first(part => part.image), portraitImage: first(part => part.portraitImage), landscapeImage: first(part => part.landscapeImage),
      year: first(part => part.year), rating: Number(first(part => part.rating)) || 0, goal: Number(first(part => part.goal)) || 0, progress: 0,
      url: first(part => part.url),
      fields: [...fields.values()],
      links: unique(parts.flatMap(part => part.links || []), link => link.url),
      sections: [...sections.values()].map(section => ({ ...section, items: unique(section.items, item => item.id || item.url || item.title).slice(0, 240) })).filter(section => section.items.length),
      tags: unique(parts.flatMap(part => part.tags || []), tag => tag.toLowerCase()).slice(0, 24),
      badge: first(part => part.badge), ratingBreakdown: first(part => part.ratingBreakdown) || [], ratingCount: Number(first(part => part.ratingCount)) || 0,
      stores: unique(parts.flatMap(part => part.stores || []), store => store.name),
      watch: { runtimeMinutes: facts.runtimeMinutes || 0, episodeCount: facts.episodeCount || 0, seasonCount: facts.seasonCount || 0 },
      facts: { ...facts, source: "mix", sources: entries.map(entry => entry.key), fetchedAt: Date.now() },
      schemaVersion: 2, fetchedAt: Date.now()
    };
  }

  // Fetch details from every enabled source that knows this title, then merge.
  async function load(item, settings = {}) {
    const title = item.title, category = item.category;
    if (!title) throw new Error("This title has no name to look up.");
    const sources = metadata.available(category, settings);
    if (!sources.length) throw new Error("Enable at least one metadata source first.");
    const settled = await Promise.allSettled(sources.map(async source => {
      const rows = await withTimeout(discovery.searchSource(title, category, settings, source.key));
      const match = bestMatch(rows, title, item.year);
      if (!match) throw new Error("No match");
      const data = await withTimeout(controller.load({ category, metadataSource: source.key, providerId: match.providerId, title: match.title, image: match.image, url: match.url, year: match.year, description: match.description }, settings));
      return { key: source.key, name: source.name, data };
    }));
    const entries = settled.filter(result => result.status === "fulfilled").map(result => result.value);
    if (!entries.length) throw new Error(`No enabled source had details for “${title}”.`);
    return merge(entries, title);
  }

  // Watch-time only lookup for titles whose saved source has no runtime: OMDb, AniList, then TVmaze.
  async function runtime(item, settings = {}) {
    const category = item.category, enabled = new Set(metadata.available(category, settings).map(source => source.key));
    for (const key of ["omdb", "tvmaze", "anilist"]) {
      if (!enabled.has(key)) continue;
      try {
        const match = bestMatch(await withTimeout(discovery.searchSource(item.title, category, settings, key)), item.title, item.year);
        if (!match) continue;
        const data = await withTimeout(controller.load({ category, metadataSource: key, providerId: match.providerId, title: match.title, image: match.image, url: match.url, year: match.year }, settings));
        const facts = data.facts || {};
        if (facts.runtimeMinutes) return { runtimeMinutes: facts.runtimeMinutes, episodeCount: facts.episodeCount || 0, seasonCount: facts.seasonCount || 0, totalMinutes: facts.totalMinutes || facts.runtimeMinutes, runtimeSource: key };
      } catch (_) { /* try the next source */ }
    }
    return null;
  }

  window.SplitAppMix = Object.freeze({ search, load, merge, norm, runtime });
})();
