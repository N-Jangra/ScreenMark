/*
 * Reproducible, TEST-INSTALL-ONLY seed for the Android 10k performance library.
 * Run in the WebView DevTools console for com.cuemark.screenmark.test, then
 * reload the test app. It preserves the existing 10,000 rows and full episode
 * details while adding recognizable titles, real poster URLs, mixed categories,
 * providers, statuses, episode art and detail-page media.
 */
(() => {
  const series = [
    ["Cobra Kai", 30960, "https://static.tvmaze.com/uploads/images/original_untouched/536/1340290.jpg"],
    ["Breaking Bad", 169, "https://static.tvmaze.com/uploads/images/original_untouched/501/1253519.jpg"],
    ["The Office", 526, "https://static.tvmaze.com/uploads/images/original_untouched/481/1204342.jpg"],
    ["Dark", 17861, "https://static.tvmaze.com/uploads/images/original_untouched/504/1262352.jpg"],
    ["The Last of Us", 46562, "https://static.tvmaze.com/uploads/images/original_untouched/563/1409008.jpg"],
    ["Stranger Things", 2993, "https://static.tvmaze.com/uploads/images/original_untouched/595/1489169.jpg"],
    ["Game of Thrones", 82, "https://static.tvmaze.com/uploads/images/original_untouched/498/1245274.jpg"],
    ["Friends", 431, "https://static.tvmaze.com/uploads/images/original_untouched/41/104565.jpg"]
  ];
  const movies = [
    ["Oppenheimer", "8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg"],
    ["Dune: Part Two", "1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg"],
    ["Avatar: The Way of Water", "q719jXXEzOoYaps6babgKnONONX.jpg"],
    ["Guardians of the Galaxy Vol. 3", "rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg"],
    ["Dune", "d5NXSklXo0qyIYkgV94XAgMIckC.jpg"],
    ["The Marvels", "kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg"],
    ["The Batman", "xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg"],
    ["Fast X", "8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg"]
  ].map(([title, path]) => [title, `https://image.tmdb.org/t/p/w500/${path}`]);
  const sources = ["tvmaze", "imdb", "omdb", "tvdb", "tmdb", "rottentomatoes", "anilist", "kitsu", "jikan"];
  const genres = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Drama", "Fantasy", "Mystery", "Romance", "Sci-Fi", "Thriller"];
  const statuses = ["Watchlist", "In Progress", "Completed", "On Hold"];
  const posters = [...series.map(row => row[2]), ...movies.map(row => row[1])];
  const now = Date.now();
  const rng = index => { let x = (index + 0x9e3779b9) | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };

  window.seedScreenMarkPerfLibrary = async ({ force = false } = {}) => {
    const marker = "screenmark_perf_seed_v1";
    if (!force && localStorage.getItem(marker) === "done") return { skipped: true, reason: "already seeded" };
    const db = await SplitAppIDBCore.open();
    const metaTx = db.transaction("meta", "readonly");
    const meta = await new Promise((resolve, reject) => { const request = metaTx.objectStore("meta").get("state"); request.onsuccess = () => resolve(request.result || {}); request.onerror = () => reject(request.error); });
    const readRows = async after => {
      const tx = db.transaction("items", "readonly"), rows = [];
      await new Promise((resolve, reject) => {
        const range = after == null ? null : IDBKeyRange.lowerBound(after, true);
        const request = tx.objectStore("items").openCursor(range);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { const cursor = request.result; if (!cursor || rows.length >= 200) { resolve(); return; } rows.push(cursor.value); cursor.continue(); };
      });
      return rows;
    };
    let after = null, index = 0, seriesCount = 0, movieCount = 0;
    const featured = [];
    for (;;) {
      const records = await readRows(after);
      if (!records.length) break;
      const changed = records.map(record => {
        after = String(record.id);
        const item = { ...record, cachedDetails: record.listDetails || record.cachedDetails || null };
        delete item.listDetails; delete item.detailsStore;
        const current = index++;
        const isSeries = current < 40 ? true : current < 80 ? false : current % 100 < 62;
        const kindIndex = current < 40 ? current % series.length : current < 80 ? (current - 40) % movies.length : current % posters.length;
        const source = sources[Math.floor(rng(current * 19 + 7) * sources.length)];
        const featuredTitle = current < 40 || (current >= 40 && current < 80);
        const art = current < 40 ? series[kindIndex][2] : current < 80 ? movies[kindIndex][1] : posters[kindIndex];
        item.title = current < 40 ? `[TEST] ${series[kindIndex][0]} · ${String(current + 1).padStart(2, "0")}`
          : current < 80 ? `[TEST] ${movies[kindIndex][0]} · ${String(current - 39).padStart(2, "0")}`
            : `[TEST] ${isSeries ? "Series" : "Movie"} ${String(current + 1).padStart(5, "0")}`;
        item.category = isSeries ? "series" : "movie";
        item.status = featuredTitle ? (current % 4 === 0 ? "In Progress" : "Watchlist") : statuses[Math.floor(rng(current * 31 + 11) * statuses.length)];
        item.metadataSource = source; item.providerId = String(100000 + current);
        item.image = art; item.backdrop = art; item.year = String(1990 + current % 37);
        item.genres = [genres[current % genres.length], genres[(current * 3 + 4) % genres.length]];
        item.goal = isSeries ? 60 : 105 + current % 75;
        item.progress = featuredTitle && isSeries && current % 4 === 0 ? 8 + current % 24 : 0;
        item.createdAt = now - current * 1000; item.updatedAt = now + 100000 - current;
        item.metadataFetchedAt = now; item.favorite = featuredTitle && current % 5 === 0;
        if (isSeries) seriesCount++; else movieCount++;
        if (current < 80) featured.push(item);
        return item;
      });
      await SplitAppIDB.saveSome({ changed, history: meta.history || [], preferences: meta.preferences || {} });
      window.__screenmarkPerfSeedProgress = { phase: "titles", processed: index, total: 10000, series: seriesCount, movies: movieCount };
    }
    if (index < 10000) throw new Error(`Expected the 10,000-title test library; found ${index}.`);

    // Enrich a small set of showcase titles with full, realistic details. This
    // intentionally leaves the 10k background rows' heavy guides untouched.
    let detailedCount = 0, detailBatch = [];
    for (let index = 0; index < featured.length; index++) {
      const item = featured[index];
      const details = await SplitAppIDB.getDetails(item.id);
      if (!details) continue;
      const isSeries = index < 40;
      const art = item.image;
      const episodes = (details.sections || []).find(section => section.kind === "episodes");
      if (isSeries && episodes) {
        episodes.title = `Episode guide (${episodes.items.length})`;
        episodes.items.forEach((episode, position) => {
          episode.image = art;
          episode.summary = `${episode.title || `Episode ${position + 1}`} — cached load-test synopsis with a poster still for image and detail rendering.`;
          if (index % 8 === 0 && position >= (item.progress || 0) && position < (item.progress || 0) + 4) {
            const airdate = new Date(now + (3 + position - (item.progress || 0)) * 86400000).toISOString().slice(0, 10);
            episode.airdate = airdate; episode.airstamp = `${airdate}T20:00:00Z`;
          }
        });
      } else if (!isSeries) {
        details.sections = (details.sections || []).filter(section => section.kind !== "episodes");
      }
      const palette = posters.filter(url => url !== art).slice(0, 6);
      details.fetchedAt = now; details.image = art; details.portraitImage = art; details.landscapeImage = art; details.backgroundImage = art;
      details.description = `[TEST DATA] Cached ${isSeries ? "series" : "movie"} details for checking poster loading, thumbnail caching, detail hydration and media layout without a network metadata fetch.`;
      details.genres = item.genres;
      details.facts = { year: item.year, rating: 7 + (index % 20) / 10, genres: item.genres, runtimeMinutes: isSeries ? 42 : item.goal, episodeCount: isSeries ? 60 : undefined };
      details.fields = [{ label: "Performance fixture", value: "10,000-title Android load test" }, { label: "Category", value: isSeries ? "Series" : "Movie" }, { label: "Metadata source", value: item.metadataSource }];
      details.raw = undefined;
      details.sections = (details.sections || []).filter(section => !["gallery", "people"].includes(section.kind) || !/^(Load test screenshots|Test cast)$/i.test(section.title || ""));
      details.sections.push({ title: "Test cast", kind: "people", items: Array.from({ length: 12 }, (_, n) => ({ id: `test-person-${index}-${n}`, title: ["Alex Morgan", "Riley Chen", "Jordan Patel", "Casey Rivera"][n % 4] + ` ${n + 1}`, meta: isSeries ? "Series cast" : "Cast", image: posters[(index + n + 1) % posters.length] })) });
      details.sections.push({ title: "Load test screenshots", kind: "gallery", items: palette.map((url, n) => ({ id: `test-image-${index}-${n}`, title: `Screenshot ${n + 1}`, image: url, url })) });
      details.sections.push({ title: "You might also like", kind: "shows", items: Array.from({ length: 8 }, (_, n) => ({ id: `test-related-${index}-${n}`, title: `[TEST] Related title ${n + 1}`, meta: `${1998 + n} · ${genres[(index + n) % genres.length]}`, image: posters[(index + n + 2) % posters.length], ref: { type: "show", id: `test-related-${index}-${n}`, title: `[TEST] Related title ${n + 1}`, extra: { source: "tmdb", category: isSeries ? "series" : "movie" } } })) });
      if (isSeries && !episodes) details.sections.unshift({ title: "Episode guide (60)", kind: "episodes", items: Array.from({ length: 60 }, (_, n) => ({ id: `${item.id}-episode-${n + 1}`, title: `Episode ${n + 1}`, season: Math.floor(n / 10) + 1, number: n % 10 + 1, airdate: new Date(now - (60 - n) * 7 * 86400000).toISOString().slice(0, 10), runtime: 42, image: art, summary: `Cached episode detail for [TEST] ${item.title}.` })) });
      detailBatch.push({ ...item, cachedDetails: details }); detailedCount++;
      if (detailBatch.length === 8 || index === featured.length - 1) {
        await SplitAppIDB.saveSome({ changed: detailBatch, history: meta.history || [], preferences: meta.preferences || {} });
        detailBatch = [];
        window.__screenmarkPerfSeedProgress = { phase: "details", processed: index + 1, total: featured.length, detailedTitles: detailedCount };
      }
    }

    localStorage.setItem(marker, "done");
    return { seeded: true, totalTitles: index, series: seriesCount, movies: movieCount, featuredSeries: 40, featuredMovies: 40, detailedTitles: detailedCount, metadataSources: sources };
  };

  window.__screenmarkPerfSeedPromise = window.seedScreenMarkPerfLibrary().then(result => { window.__screenmarkPerfSeedResult = result; console.log("ScreenMark test library seed complete", result); return result; }).catch(error => { window.__screenmarkPerfSeedResult = { error: String(error?.stack || error) }; console.error(error); throw error; });
})();
