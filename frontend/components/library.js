// Shared episode progress calculations used by tracking, profile and details pages.
(() => {
  // Episode progress for a series whose episode guide is saved with it (next unwatched, last watched, counts).
  const episodeInfoCache = new WeakMap();
  const episodeAirTime = episode => {
    const raw = String(episode?.airdate || "").trim();
    if (!raw) return 0;
    // A date without a time is not proof that the episode has aired yet. Keep it
    // upcoming for that local calendar day; providers often omit broadcast time.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (dateOnly) {
      const [, year, month, day] = dateOnly.map(Number);
      const date = new Date(year, month - 1, day, 23, 59, 59, 999);
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date.getTime();
      return 0;
    }
    const timestamp = Date.parse(raw);
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const isUpcoming = episode => episodeAirTime(episode) > Date.now();
  const episodeInfo = item => {
    const section = (item?.cachedDetails?.sections || []).find(entry => entry.kind === "episodes");
    const savedIds = item?.watchedEpisodeIds || [];
    const cached = item && episodeInfoCache.get(item);
    if (cached && cached.section === section && cached.savedIds === savedIds) return cached.value;
    const eps = (section?.items || []).filter(entry => entry.number).sort((a, b) => a.season - b.season || a.number - b.number);
    if (!eps.length) return null;
    const watched = new Set(savedIds.map(String));
    const mark = entry => `S${entry.season} · E${entry.number}`;
    let done = 0, next = null, last = null;
    for (const entry of eps) {
      if (watched.has(String(entry.id))) { done++; last = entry; }
      else if (!next) next = entry;
    }
    const value = { eps, watched, total: eps.length, done, next, last, mark };
    if (item) episodeInfoCache.set(item, { section, savedIds, value });
    return value;
  };
  window.SplitAppLibrary = Object.freeze({
    episodeInfo,
    episodeAirTime,
    isUpcoming
  });
})();
