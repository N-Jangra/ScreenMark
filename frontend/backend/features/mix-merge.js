// Pure merge of movie and series metadata from several sources. Safe to run in a data worker.
(root => {
  "use strict";
  const isEmpty = value => value == null || value === "" || value === 0 || (Array.isArray(value) && !value.length);
  const LIST_LABELS = /^(genres?|director|directors|writers?|cast|tags|also known as|languages?|countr(y|ies)|network|studio)$/i;
  const toList = value => Array.isArray(value) ? value.map(String).filter(Boolean) : String(value ?? "").split(/,\s*/).map(part => part.trim()).filter(Boolean);
  const unique = (list, keyOf) => { const seen = new Set(); return list.filter(entry => { const key = keyOf(entry); if (!key || seen.has(key)) return false; seen.add(key); return true; }); };

  function merge(entries, title, trackedItem = {}) {
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
      const key = `${section.kind}:${String(section.title || "").replace(/\s*\(\d+\)$/, "")}`;
      if (!sections.has(key)) sections.set(key, { ...section, items: [] });
      sections.get(key).items.push(...(section.items || []));
    }
    // Keep every provider's cover and wide art available in the detail gallery, alongside screenshots.
    const art = [];
    for (const entry of entries) for (const [label, url] of [["cover", entry.data?.portraitImage], ["image", entry.data?.image], ["wide art", entry.data?.landscapeImage], ["background", entry.data?.backgroundImage]]) {
      if (/^https?:/i.test(url || "")) art.push({ title: `${entry.name} ${label}`, image: url, url });
    }
    if (art.length) {
      const key = "gallery:Screenshots";
      if (!sections.has(key)) sections.set(key, { kind: "gallery", title: "Screenshots", items: [] });
      sections.get(key).items.unshift(...art);
    }
    const facts = {};
    for (const part of parts) for (const [key, value] of Object.entries(part.facts || {})) if (isEmpty(facts[key]) && !isEmpty(value)) facts[key] = value;
    const description = parts.map(part => part.description || "").sort((a, b) => b.length - a.length)[0] || "";
    return {
      source: "mix", mixSources: entries.map(entry => entry.name), title: first(part => part.title) || title, description,
      image: first(part => part.image), portraitImage: first(part => part.portraitImage), landscapeImage: first(part => part.landscapeImage),
      year: first(part => part.year), rating: Number(first(part => part.rating)) || 0,
      goal: Number(trackedItem.goal) || Number(first(part => part.goal)) || 0, progress: Number(trackedItem.progress) || 0,
      url: first(part => part.url), fields: [...fields.values()],
      links: unique(parts.flatMap(part => part.links || []), link => link.url),
      sections: [...sections.values()].map(section => ({ ...section, items: unique(section.items, item => item.id || item.image || item.url || item.title).slice(0, 240) })).filter(section => section.items.length),
      tags: unique(parts.flatMap(part => part.tags || []), tag => String(tag).toLowerCase()).slice(0, 24),
      badge: first(part => part.badge), ratingBreakdown: first(part => part.ratingBreakdown) || [], ratingCount: Number(first(part => part.ratingCount)) || 0,
      stores: unique(parts.flatMap(part => part.stores || []), store => store.name),
      watch: { runtimeMinutes: facts.runtimeMinutes || 0, episodeCount: facts.episodeCount || 0, seasonCount: facts.seasonCount || 0 },
      facts: { ...facts, source: "mix", sources: entries.map(entry => entry.key), fetchedAt: Date.now() },
      sourceIds: Object.fromEntries(entries.filter(entry => entry.providerId != null && entry.providerId !== "").map(entry => [entry.key, String(entry.providerId)])),
      schemaVersion: 2, fetchedAt: Date.now()
    };
  }

  root.SplitAppMixMerge = Object.freeze({ merge });
})(typeof self !== "undefined" ? self : globalThis);
