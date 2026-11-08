// ScreenMark metadata detail loader: movies and TV series from TVmaze, AniList and OMDb.
(() => {
  const metadata = window.SplitAppMetadata;
  const appKey = metadata.appKey;
  const clean = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const numberFrom = input => { const match = String(input ?? "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/); return match ? Number(match[1]) : 0; };
  const toList = input => Array.isArray(input) ? input.map(String).filter(Boolean) : String(input ?? "").split(/,\s*/).map(part => part.trim()).filter(Boolean);

  // Every loader returns this shape (schemaVersion 2). `watch` carries the numbers Statistics needs.
  const baseDetails = (source, item, data = {}) => ({
    source, title: data.title || item.title || "Untitled", description: clean(data.description || data.summary || item.description || ""),
    image: data.image || data.portraitImage || data.thumbnail || item.image || "",
    portraitImage: data.portraitImage || data.image || data.thumbnail || item.image || "",
    landscapeImage: data.landscapeImage || data.backgroundImage || "",
    year: data.year || item.year || "", rating: data.rating || 0,
    goal: data.goal || item.goal || 0, progress: Number(item.progress) || 0,
    url: data.url || item.url || "", fields: (data.fields || []).filter(row => row && row.value !== undefined && row.value !== null && row.value !== "" && !(Array.isArray(row.value) && !row.value.length)),
    links: (data.links || []).filter(row => row?.url),
    sections: (data.sections || []).filter(section => section && Array.isArray(section.items) && section.items.length),
    tags: (data.tags || []).map(String).filter(Boolean),
    badge: data.badge ? String(data.badge) : "",
    trailer: data.trailer?.url ? { url: String(data.trailer.url), title: String(data.trailer.title || ""), image: String(data.trailer.image || "") } : null,
    ratingBreakdown: (data.ratingBreakdown || []).filter(row => row && Number(row.percent) > 0),
    ratingCount: Number(data.ratingCount) || 0,
    stores: (data.stores || []).filter(row => row?.url && row?.name),
    raw: data.raw ?? null,
    watch: data.watch || {},
    schemaVersion: 2, fetchedAt: Date.now()
  });

  // Provider-independent facts saved with the title (runtime, episodes, cast, creators, ratings) for Statistics and future features.
  const deriveFacts = (out, source) => {
    const field = pattern => out.fields.find(row => pattern.test(row.label))?.value;
    const watch = out.watch || {};
    const runtimeMinutes = Number(watch.runtimeMinutes) || numberFrom(field(/^Runtime$/));
    const episodeCount = Number(watch.episodeCount) || 0, seasonCount = Number(watch.seasonCount) || 0;
    const cast = (out.sections.find(section => /^(cast|characters)/i.test(section.title))?.items || []).map(row => ({ name: row.title, role: row.meta || "" }));
    return {
      source, fetchedAt: Date.now(),
      runtimeMinutes, episodeCount, seasonCount, totalMinutes: episodeCount ? Math.round(episodeCount * runtimeMinutes) : runtimeMinutes,
      genres: toList(field(/^Genres?$/)), released: field(/^(Released|Premiered|Published|Release date)$/) || "",
      directors: toList(field(/^(Director|Directors|Created by)$/)), writers: toList(field(/^(Writer|Writers)$/)), cast,
      networks: toList(field(/^(Network|Streaming|Broadcaster)$/)), languages: toList(field(/^Languages?$/)), countries: toList(field(/^Countr(y|ies)$/)),
      status: field(/^Status$/) || "", ageRating: out.badge || "", rating: Number(out.rating) || 0, ratingCount: out.ratingCount || 0,
      awards: field(/^Awards$/) || "", boxOffice: field(/^Box office$/) || "", tags: out.tags, alternativeNames: toList(field(/^Also known as$/))
    };
  };
  const details = (source, item, data = {}) => { const out = baseDetails(source, item, data); out.facts = deriveFacts(out, source); return out; };

  const controller = window.SplitAppDiscovery;
  const encode = controller.encode || (value => encodeURIComponent(String(value ?? "")));
  const get = (url, settings = {}) => controller.requestJson(url, settings);
  const POST_JSON = { "Content-Type": "application/json", Accept: "application/json" };
  // Keep the shared anime-episode API below its public rate limit even when
  // multiple library refresh workers reach it at once.
  let episodeApiTail = Promise.resolve(), episodeApiLastRequestAt = 0;
  const animeEpisodeGet = (url, settings = {}) => {
    const request = episodeApiTail.then(async () => {
      const wait = Math.max(0, 300 - (Date.now() - episodeApiLastRequestAt));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      episodeApiLastRequestAt = Date.now();
      try { return await get(url, settings); }
      catch (error) {
        const status = Number(error?.status) || 0;
        if (status && ![429, 500, 502, 503, 504].includes(status)) throw error;
        await new Promise(resolve => setTimeout(resolve, status === 429 ? 1100 : 500));
        episodeApiLastRequestAt = Date.now();
        return get(url, settings);
      }
    });
    episodeApiTail = request.catch(() => {});
    return request;
  };
  const animeEpisodeGuide = async (media, title, settings) => {
    const malId = Number(media?.idMal);
    if (!Number.isSafeInteger(malId) || malId <= 0) return [];
    const cap = 1200, maxPages = 12;
    const rows = [];
    for (let page = 1; page <= maxPages && rows.length < cap; page++) {
      let response;
      try { response = await animeEpisodeGet(`https://api.tenrai.org/v1/anime/${malId}/episodes?page=${page}`, settings); }
      catch (error) { if (rows.length) break; throw error; }
      const episodes = Array.isArray(response?.data) ? response.data : [];
      rows.push(...episodes);
      if (!response?.pagination?.has_next_page || !episodes.length) break;
    }
    return rows.slice(0, cap).map((episode, index) => {
      const number = index + 1, episodeId = Number(episode?.mal_id) || number;
      const episodeTitle = clean(episode?.title || episode?.title_romanji || episode?.title_japanese || `Episode ${number}`);
      const aired = episode?.aired?.from || episode?.aired || "";
      const url = episode?.url || `https://myanimelist.net/anime/${malId}`;
      return {
        id: `anilist-mal-${malId}-ep-${episodeId}`, season: 1, number, title: episodeTitle,
        airdate: String(aired).slice(0, 10), runtime: Math.round((Number(episode?.duration) || 0) / 60), rating: Number(episode?.score) || 0,
        image: episode?.images?.jpg?.image_url || episode?.images?.webp?.image_url || "", description: clean(episode?.synopsis || ""), url,
        ref: { type: "episode", id: episodeId, title: episodeTitle, extra: { source: "tenrai", malId, anilistId: Number(media.id), series: title, number, url } }
      };
    }).filter(episode => episode.number > 0);
  };
  const anilistResponse = response => {
    if (!response?.data && response?.errors?.length) throw new Error(`AniList: ${response.errors.map(error => error.message).filter(Boolean).join("; ") || "request failed"}`);
    return response?.data || {};
  };
  const mapLimit = async (rows, limit, callback) => {
    const output = new Array(rows.length); let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, rows.length) }, async () => {
      while (cursor < rows.length) { const index = cursor++; output[index] = await callback(rows[index], index); }
    });
    await Promise.all(workers); return output;
  };

  const isoMinutes = value => { const match = String(value || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?/); return match ? (Number(match[1]) || 0) * 60 + (Number(match[2]) || 0) : 0; };
  const ldJson = html => {
    for (const block of String(html || "").matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      try { const parsed = JSON.parse(block[1]); const hit = [].concat(parsed, parsed?.["@graph"] || []).find(row => row && /Movie|TVSeries|TVEpisode|TVSeason/i.test([].concat(row["@type"] || []).join(" "))); if (hit) return hit; } catch (_) {}
    }
    return null;
  };
  const ldJsonType = (html, wantedType) => {
    for (const block of String(html || "").matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const parsed = JSON.parse(block[1]), rows = [...[].concat(parsed), ...[].concat(parsed?.["@graph"] || [])];
        const match = rows.find(row => [].concat(row?.["@type"] || []).map(String).includes(wantedType));
        if (match) return match;
      } catch (_) {}
    }
    return null;
  };
  const structuredEpisodes = (value, inheritedSeason = 0) => {
    const rows = [];
    const visit = (node, parentSeason = inheritedSeason) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(row => visit(row, parentSeason)); return; }
      const types = [].concat(node["@type"] || []).map(String);
      const season = Number(node.seasonNumber || node.partOfSeason?.seasonNumber || String(node.url || node.sameAs || "").match(/\/s(\d{1,3})(?:\/|$)/i)?.[1] || String(node.name || node.partOfSeason?.name || "").match(/season\s+(\d+)/i)?.[1]) || parentSeason;
      if (types.includes("TVEpisode")) rows.push({ ...node, __seasonNumber: season });
      visit(node["@graph"], season); visit(node.containsSeason, season); visit(node.episode, season); visit(node.episodes, season); visit(node.hasPart, season);
    };
    visit(value);
    return unique(rows, row => row.url || `${row.episodeNumber}:${row.name}`);
  };
  const structuredSeasons = value => {
    const rows = [];
    const visit = node => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if ([].concat(node["@type"] || []).map(String).includes("TVSeason")) rows.push(node);
      visit(node["@graph"]); visit(node.containsSeason);
    };
    visit(value);
    return unique(rows, row => row.url || row.seasonNumber || row.name);
  };
  const rtImage = value => typeof value === "string" ? value : value?.url || value?.contentUrl || "";
  const imdbNameUrl = person => {
    const candidates = [person?.url, person?.sameAs, person?.identifier, ...(Array.isArray(person?.sameAs) ? person.sameAs : [])];
    for (const candidate of candidates) {
      const value = typeof candidate === "object" ? candidate.value || candidate.url || "" : String(candidate || "");
      const id = value.match(/(?:^|\/)name\/(nm\d+)(?:[/?#]|$)/i)?.[1] || value.match(/^nm\d+$/i)?.[0];
      if (id) return `https://www.imdb.com/name/${id}/`;
    }
    return person?.name ? `https://www.imdb.com/find/?q=${encode(person.name)}` : "";
  };
  const rtScore = (html, kind) => Number(html.match(new RegExp(`${kind}[-_]?score\\s*=\\s*["'](\\d+)`, "i"))?.[1]) || 0;
  const rtEpisodeLinks = (html, seasonPath, seasonNumber) => {
    if (typeof DOMParser === "undefined") return [];
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      const prefix = seasonPath.replace(/\/$/, "");
      return unique([...doc.querySelectorAll("a[href]")].flatMap(anchor => {
        let pathname = "";
        try { pathname = new URL(anchor.getAttribute("href"), "https://www.rottentomatoes.com").pathname; } catch (_) {}
        if (!pathname.startsWith(`${prefix}/e`)) return [];
        const number = Number(pathname.match(/\/e(\d+)/i)?.[1]);
        if (!number) return [];
        let card = anchor, title = "", copy = "";
        for (let depth = 0; card && depth < 7; depth++, card = card.parentElement) {
          const heading = card.querySelector("h2,h3,h4,h5,[data-qa*='episode-title'],[data-qa*='title']");
          const candidate = String(heading?.textContent || anchor.getAttribute("aria-label") || anchor.getAttribute("title") || "").trim();
          if (candidate && !/^details?$/i.test(candidate) && !/^episode\s*\d+$/i.test(candidate)) {
            title = candidate;
            copy = String(card.textContent || "").replace(/\s+/g, " ").trim();
            break;
          }
        }
        const score = Number(anchor.getAttribute("tomatometer-score") || anchor.closest("[tomatometer-score]")?.getAttribute("tomatometer-score")) || 0;
        const airdate = copy.match(/(?:aired|air date)\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1] || "";
        const name = title || `Episode ${number}`;
        return [{ id: pathname, season: seasonNumber, number, title: name, airdate, rating: score ? score / 10 : 0, description: "", image: anchor.querySelector("img")?.src || "", ref: { type: "episode", id: pathname, title: name, extra: { source: "rottentomatoes" } } }];
      }), row => row.id);
    } catch (_) { return []; }
  };
  const loaders = {
    // ---- TVmaze: series ----
    tvmaze: async (item, s) => {
      const embeds = s.background ? "episodes&seasons&akas" : "episodes&cast&seasons&crew&akas&images";
      const show = await get(`https://api.tvmaze.com/shows/${encode(item.providerId)}?embed[]=${embeds.replace(/&/g, "&embed[]=")}`, s);
      const eps = show._embedded?.episodes || [], cast = show._embedded?.cast || [], seasons = show._embedded?.seasons || [], crew = show._embedded?.crew || [], akas = show._embedded?.akas || [], images = show._embedded?.images || [];
      const schedule = [(show.schedule?.days || []).join(", "), show.schedule?.time].filter(Boolean).join(" at ");
      const network = show.network?.name || show.webChannel?.name;
      const country = show.network?.country?.name || show.webChannel?.country?.name;
      const externals = show.externals || {};
      const links = [];
      if (show.officialSite) links.push({ label: "Official site", url: show.officialSite });
      links.push({ label: "TVmaze", url: show.url });
      if (externals.imdb) links.push({ label: "IMDb", url: `https://www.imdb.com/title/${externals.imdb}/` });
      if (externals.thetvdb) links.push({ label: "TheTVDB", url: `https://thetvdb.com/?tab=series&id=${externals.thetvdb}` });
      const seasonInfo = Object.fromEntries(seasons.map(row => [row.number, { image: row.image?.medium || row.image?.original || "", name: row.name || "", premiere: row.premiereDate, end: row.endDate }]));
      const episodeItems = eps.slice(0, 1200).map(ep => ({
        id: ep.id, season: ep.season || 1, number: ep.number, title: ep.name || "Episode", airdate: ep.airdate, runtime: ep.runtime, rating: ep.rating?.average || 0,
        image: ep.image?.medium || ep.image?.original || "", description: clean(ep.summary), url: ep.url, ref: { type: "episode", id: ep.id, title: ep.name }
      }));
      const personCard = (person, meta) => ({ title: person?.name, meta, image: person?.image?.medium || person?.image?.original || "", url: person?.url, ref: person?.id ? { type: "person", id: person.id, title: person.name } : null });
      const castItems = unique(cast, row => `${row.person?.id}:${row.character?.id}`).slice(0, 40).map(row => personCard(row.person, row.character?.name ? `as ${row.character.name}` : ""));
      const characterItems = unique(cast, row => row.character?.id).slice(0, 40).map(row => ({ title: row.character?.name, meta: row.person?.name ? `played by ${row.person.name}` : "", image: row.character?.image?.medium || row.character?.image?.original || "", url: row.character?.url, ref: { type: "character", id: row.character.id, title: row.character.name, extra: { person: row.person ? { id: row.person.id, name: row.person.name, image: row.person.image?.medium } : null, show: { id: show.id, name: show.name, image: show.image?.medium } } } }));
      const staffItems = unique(crew, row => `${row.person?.id}:${row.type}`).slice(0, 40).map(row => personCard(row.person, row.type));
      const shots = images.filter(row => row.type === "background" || row.type === "banner" || row.type === "typography").slice(0, 24).map((row, index) => ({ title: row.type === "background" ? `Background ${index + 1}` : row.type, image: row.resolutions?.original?.url || row.resolutions?.medium?.url }));
      const posters = images.filter(row => row.type === "poster").slice(0, 12).map((row, index) => ({ title: `Poster ${index + 1}`, image: row.resolutions?.original?.url || row.resolutions?.medium?.url }));
      // TVmaze has no recommendations endpoint: rank recently listed shows that share genres with this one.
      const alsoLike = async () => {
        const genres = new Set(show.genres || []); if (!genres.size) return [];
        const pages = await Promise.all([0, 1, 2, 3].map(page => get(`https://api.tvmaze.com/shows?page=${page}`, s).catch(() => [])));
        return pages.flat().filter(row => row?.id && row.id !== show.id && row.image && (row.genres || []).some(genre => genres.has(genre)))
          .map(row => ({ row, score: (row.genres || []).filter(genre => genres.has(genre)).length * 10 + (row.rating?.average || 0) + (row.weight || 0) / 100 }))
          .sort((a, b) => b.score - a.score).slice(0, 14).map(({ row }) => ({ title: row.name, meta: [row.premiered?.slice(0, 4), row.rating?.average ? `★ ${row.rating.average}` : ""].filter(Boolean).join(" · "), image: row.image?.medium || row.image?.original, url: row.url, ref: { type: "show", id: row.id, title: row.name } }));
      };
      const similar = s.background ? [] : await alsoLike().catch(() => []);
      return details("tvmaze", item, {
        title: show.name, description: show.summary, image: show.image?.original || show.image?.medium, landscapeImage: images.find(row => row.type === "background")?.resolutions?.original?.url, year: show.premiered?.slice(0, 4), rating: show.rating?.average, url: show.url, goal: eps.length,
        links, tags: show.genres, watch: { runtimeMinutes: show.runtime || show.averageRuntime || 0, episodeCount: eps.length, seasonCount: seasons.length },
        sections: [
          { title: "Screenshots", kind: "gallery", items: shots },
          { title: "Episode ratings", kind: "ratings", items: episodeItems.filter(ep => ep.number).map(ep => ({ id: ep.id, season: ep.season, number: ep.number, title: ep.title, rating: ep.rating, ref: ep.ref })) },
          { title: "Cast", kind: "carousel", items: castItems },
          { title: "Characters", kind: "carousel", items: characterItems },
          { title: "Staff", kind: "carousel", items: staffItems },
          { title: `Episode guide (${eps.length})`, kind: "episodes", seasons: seasonInfo, items: episodeItems },
          { title: "Posters", kind: "gallery", items: posters },
          { title: "You might also like", kind: "carousel", items: similar }
        ],
        fields: [["Type", show.type], ["Genres", show.genres], ["Status", show.status], ["Network", network], ["Country", country], ["Premiered", show.premiered], ["Ended", show.ended], ["Schedule", schedule], ["Runtime", show.runtime || show.averageRuntime ? `${show.runtime || show.averageRuntime} min` : ""], ["Language", show.language], ["Also known as", unique(akas, row => row.name).map(row => row.name).slice(0, 8)], ["Seasons", seasons.length || ""], ["Episodes", eps.length || ""], ["TVmaze rating", show.rating?.average]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- AniList: anime series and movies ----
    anilist: async (item, s) => {
      const detailSections = s.background ? "" : "staff(perPage:6){edges{role node{id name{full} image{medium} siteUrl}}} characters(perPage:10,sort:ROLE){edges{role voiceActors(language:JAPANESE){id name{full} image{medium} siteUrl} node{id name{full} image{medium} siteUrl}}} relations{edges{relationType node{id title{english romaji}format startDate{year}coverImage{medium}siteUrl}}} recommendations(perPage:10,sort:RATING_DESC){nodes{mediaRecommendation{id title{english romaji}format startDate{year}coverImage{medium}siteUrl}}} trailer{site id}";
      const query = `query($id:Int){Media(id:$id,type:ANIME){id idMal title{romaji english native} synonyms description coverImage{extraLarge large} bannerImage startDate{year month day} endDate{year month day} format status episodes duration source season seasonYear averageScore popularity favourites genres tags{name rank isMediaSpoiler} siteUrl studios(isMain:true){nodes{name}} ${detailSections} externalLinks{site url} isAdult}}`;
      const response = await get("https://graphql.anilist.co", { ...s, method: "POST", headers: POST_JSON, body: JSON.stringify({ query, variables: { id: Number(item.providerId) } }) });
      const m = anilistResponse(response).Media; if (!m) throw new Error("AniList could not load this title.");
      const title = m.title?.english || m.title?.romaji || item.title;
      const date = d => d?.year ? [d.year, String(d.month || 1).padStart(2, "0"), String(d.day || 1).padStart(2, "0")].join("-") : "";
      const studio = (m.studios?.nodes || []).map(node => node.name);
      const card = node => { const category = node?.format === "MOVIE" ? "movie" : "series", title = node?.title?.english || node?.title?.romaji; return { id: node?.id, title, meta: [node?.format, node?.startDate?.year].filter(Boolean).join(" · "), image: node?.coverImage?.medium || "", url: node?.siteUrl, ref: node?.id ? { type: "show", id: node.id, title, extra: { source: "anilist", category } } : null }; };
      const people = (edges, entity) => (edges || []).map(edge => ({ title: edge.node?.name?.full, meta: edge.role ? String(edge.role).toLowerCase().replace(/_/g, " ") : "", image: edge.node?.image?.medium || "", url: edge.node?.siteUrl, ref: edge.node?.id ? { type: "person", id: `anilist-${entity}:${edge.node.id}`, title: edge.node.name?.full, extra: { source: "anilist", entity, role: edge.role || "" } } : null }));
      const voiceActors = unique((m.characters?.edges || []).flatMap(edge => (edge.voiceActors || []).map(person => ({ person, role: "Voice actor" }))), row => row.person?.id).map(({ person, role }) => ({ title: person?.name?.full, meta: role, image: person?.image?.medium || "", url: person?.siteUrl, ref: person?.id ? { type: "person", id: `anilist-staff:${person.id}`, title: person.name?.full, extra: { source: "anilist", entity: "staff", role } } : null }));
      const links = [{ label: "AniList", url: m.siteUrl }, ...(m.externalLinks || []).slice(0, 5).map(link => ({ label: link.site, url: link.url }))];
      if (m.trailer?.site === "youtube" && m.trailer.id) links.push({ label: "Trailer", url: `https://www.youtube.com/watch?v=${m.trailer.id}` });
      const isMovie = m.format === "MOVIE";
      let episodeItems = [], seasonInfo = {};
      if (!isMovie) {
        try {
          episodeItems = await animeEpisodeGuide(m, title, s);
          if (episodeItems.length) seasonInfo = { 1: { name: "Episodes" } };
        } catch (_) { /* Fall back to a matching TVmaze guide below. */ }
        if (!episodeItems.length) try {
          const normalizeTitle = value => String(value || "").normalize("NFKD").toLocaleLowerCase().replace(/[\p{M}\p{P}\p{S}\p{Z}]+/gu, "");
          const aliases = [...new Set([m.title?.english, m.title?.romaji, m.title?.native, item.title, ...(m.synonyms || [])]
            .map(value => String(value || "").trim()).filter(value => value && normalizeTitle(value)))].slice(0, 6);
          const candidates = new Map();
          for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex++) {
            const alias = aliases[aliasIndex];
            let results;
            try { results = await get(`https://api.tvmaze.com/search/shows?q=${encode(alias)}`, s); }
            catch (error) {
              if (Number(error?.status) && Number(error.status) < 500 && Number(error.status) !== 429) break;
              await new Promise(resolve => setTimeout(resolve, 350));
              try { results = await get(`https://api.tvmaze.com/search/shows?q=${encode(alias)}`, s); }
              catch (_) { break; }
            }
            for (const row of Array.isArray(results) ? results : []) {
              const show = row?.show, showName = normalizeTitle(show?.name);
              if (!show?.id || !showName || showName !== normalizeTitle(alias)) continue;
              const year = String(show.premiered || "").slice(0, 4), expectedYear = String(m.startDate?.year || "");
              const candidate = { show, aliasIndex, yearMatch: Boolean(expectedYear && year === expectedYear), hasYearConflict: Boolean(expectedYear && year && year !== expectedYear) };
              const previous = candidates.get(String(show.id));
              if (!previous || candidate.yearMatch && !previous.yearMatch || candidate.aliasIndex < previous.aliasIndex) candidates.set(String(show.id), candidate);
            }
            const matchedYear = [...candidates.values()].filter(candidate => candidate.yearMatch);
            if (m.startDate?.year ? matchedYear.length === 1 : candidates.size === 1) break;
          }
          const exact = [...candidates.values()];
          const yearMatches = exact.filter(candidate => candidate.yearMatch);
          const pool = yearMatches.length ? yearMatches : exact.filter(candidate => !candidate.hasYearConflict);
          pool.sort((left, right) => left.aliasIndex - right.aliasIndex);
          const match = pool.length === 1 || (pool.length > 1 && pool[0].aliasIndex < pool[1].aliasIndex) ? pool[0]?.show : null;
          if (match?.id) {
            const show = await get(`https://api.tvmaze.com/shows/${encode(match.id)}?embed[]=episodes&embed[]=seasons`, s);
            const episodes = show._embedded?.episodes || [], seasonRows = show._embedded?.seasons || [];
            if (!episodeItems.length) {
              episodeItems = episodes.slice(0, 1200).map(ep => ({ id: ep.id, season: Number(ep.season) || 1, number: Number(ep.number) || 0, title: ep.name || `Episode ${ep.number}`, airdate: ep.airdate || "", runtime: Number(ep.runtime) || 0, rating: Number(ep.rating?.average) || 0, image: ep.image?.original || ep.image?.medium || "", description: clean(ep.summary || ""), ref: { type: "episode", id: ep.id, title: ep.name || `Episode ${ep.number}` } })).filter(ep => ep.number > 0);
              seasonInfo = Object.fromEntries(seasonRows.map(row => [Number(row.number) || 1, { name: row.name || `Season ${row.number}`, premiere: row.premiereDate || "", end: row.endDate || "" }]));
              if (!Object.keys(seasonInfo).length) seasonInfo = Object.fromEntries([...new Set(episodeItems.map(ep => ep.season))].map(number => [number, { name: `Season ${number}` }]));
            }
          }
        } catch (_) {}
      }
      return details("anilist", item, {
        title, description: m.description, image: m.coverImage?.extraLarge || m.coverImage?.large, landscapeImage: m.bannerImage, year: m.startDate?.year, rating: m.averageScore ? m.averageScore / 10 : 0, url: m.siteUrl, goal: isMovie ? 0 : (episodeItems.length || m.episodes || 0),
        trailer: m.trailer?.site === "youtube" && m.trailer.id ? { url: `https://www.youtube.com/watch?v=${m.trailer.id}`, title: "Official trailer", image: `https://img.youtube.com/vi/${m.trailer.id}/hqdefault.jpg` } : null,
        links, tags: [...(m.genres || []), ...(m.tags || []).filter(tag => !tag.isMediaSpoiler && tag.rank >= 60).map(tag => tag.name)].slice(0, 16), badge: m.isAdult ? "Adult" : "",
        watch: { runtimeMinutes: m.duration || 0, episodeCount: isMovie ? 0 : (episodeItems.length || m.episodes || 0), seasonCount: Object.keys(seasonInfo).length },
        sections: [
          ...(voiceActors.length ? [{ title: "Cast", kind: "carousel", items: voiceActors }] : []),
          { title: "Characters", kind: "carousel", items: people(m.characters?.edges, "character") },
          { title: "Staff", kind: "carousel", items: people(m.staff?.edges, "staff") },
          { title: "Related", kind: "carousel", items: (m.relations?.edges || []).map(edge => ({ ...card(edge.node), meta: [String(edge.relationType).toLowerCase().replace(/_/g, " "), edge.node?.startDate?.year].filter(Boolean).join(" · ") })) },
          { title: "You might also like", kind: "carousel", items: (m.recommendations?.nodes || []).map(node => card(node.mediaRecommendation)).filter(row => row.title) },
          ...(episodeItems.length ? [{ title: `Episode guide (${episodeItems.length})`, kind: "episodes", seasons: seasonInfo, items: episodeItems }, { title: "Episode ratings", kind: "ratings", items: episodeItems.map(ep => ({ id: ep.id, season: ep.season, number: ep.number, title: ep.title, rating: ep.rating, ref: ep.ref })) }] : [])
        ],
        fields: [["Format", m.format], ["Status", m.status ? String(m.status).toLowerCase().replace(/_/g, " ") : ""], ["Genres", m.genres], ["Released", date(m.startDate)], ["Ended", date(m.endDate)], ["Season", m.season ? `${String(m.season).toLowerCase()} ${m.seasonYear || ""}`.trim() : ""], ["Studio", studio], ["Source", m.source ? String(m.source).toLowerCase().replace(/_/g, " ") : ""], ["Episodes", isMovie ? "" : m.episodes], ["Runtime", m.duration ? `${m.duration} min${isMovie ? "" : " per episode"}` : ""], ["Score", m.averageScore ? `${m.averageScore}/100` : ""], ["Popularity", m.popularity ? m.popularity.toLocaleString() : ""], ["Favourites", m.favourites ? m.favourites.toLocaleString() : ""], ["Also known as", unique([m.title?.native, m.title?.romaji, ...(m.synonyms || [])].filter(name => name && name !== title), name => name.toLowerCase()).slice(0, 6)]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- TMDB: movies and series (needs a key) ----
    tmdb: async (item, s) => {
      const kind = item.category === "movie" ? "movie" : "tv";
      const append = s.background
        ? kind === "movie" ? "external_ids,release_dates" : "external_ids,content_ratings"
        : kind === "movie" ? "credits,images,recommendations,external_ids,videos,keywords,release_dates" : "credits,images,recommendations,external_ids,videos,keywords,content_ratings";
      const d = await controller.tmdbGet(`/${kind}/${encode(item.providerId)}?append_to_response=${append}`, s);
      const img = (path, size = "w500") => path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
      const people = (d.credits?.cast || []).map(row => ({ title: row.name, meta: row.character ? `as ${row.character}` : "", image: img(row.profile_path, "w185"), url: `https://www.themoviedb.org/person/${row.id}`, ref: { type: "person", id: `tmdb:${row.id}`, title: row.name } }));
      const crew = unique(d.credits?.crew || [], row => `${row.id}:${row.job}`).map(row => ({ title: row.name, meta: row.job, image: img(row.profile_path, "w185"), url: `https://www.themoviedb.org/person/${row.id}`, ref: { type: "person", id: `tmdb:${row.id}`, title: row.name } }));
      const imageRows = rows => rows.map((row, index) => ({ title: `Image ${index + 1}`, image: img(row.file_path, "w780"), imageType: row.iso_639_1 ? "localized" : "original", language: row.iso_639_1 || "" }));
      const shots = imageRows(d.images?.backdrops || []), posters = imageRows(d.images?.posters || []), logos = imageRows(d.images?.logos || []);
      const characters = unique((d.credits?.cast || []).filter(row => row.character), row => `${row.character}:${row.id}`).map(row => ({ title: row.character, meta: row.name ? `played by ${row.name}` : "", image: img(row.profile_path, "w185"), ref: { type: "person", id: `tmdb:${row.id}`, title: row.name } }));
      const seasonRows = (d.seasons || []).filter(row => Number.isFinite(Number(row.season_number)));
      const seasonData = kind === "tv" ? await mapLimit(seasonRows, 4, async row => {
        try { return [row.season_number, await controller.tmdbGet(`/tv/${encode(item.providerId)}/season/${encode(row.season_number)}`, s)]; }
        catch (error) { return [row.season_number, { _fetchError: String(error?.message || error) }]; }
      }) : [];
      const failedSeason = seasonData.find(([, season]) => season?._fetchError);
      if (failedSeason) throw new Error(`TMDB could not load season ${failedSeason[0]}: ${failedSeason[1]._fetchError}`);
      const seasonDetails = Object.fromEntries(seasonData);
      const recommendationPages = s.background ? 0 : Number(d.recommendations?.total_pages) || 1;
      // The detail UI only needs a short suggestions shelf. Fetching every page can fan out
      // hundreds of requests and block a title refresh without adding useful detail data.
      const additionalRecommendationPages = recommendationPages > 1 ? await mapLimit(Array.from({ length: Math.min(recommendationPages, 3) - 1 }, (_, index) => index + 2), 3, async page => {
        try { return await controller.tmdbGet(`/${kind}/${encode(item.providerId)}/recommendations?page=${page}`, s); }
        catch (error) { return { page, error: String(error?.message || error) }; }
      }) : [];
      const recommendationData = s.background ? [] : [d.recommendations, ...additionalRecommendationPages];
      const recommendationRows = recommendationData.flatMap(page => page?.results || []);
      const similar = unique(recommendationRows, row => row.id).slice(0, 40).map(row => { const title = row.title || row.name, category = kind === "movie" ? "movie" : "series"; return { id: row.id, title, meta: String(row.release_date || row.first_air_date || "").slice(0, 4), image: img(row.poster_path, "w342"), url: `https://www.themoviedb.org/${kind}/${row.id}`, ref: { type: "show", id: row.id, title, extra: { source: "tmdb", category } } }; });
      const episodeRows = seasonRows.flatMap(season => (seasonDetails[season.season_number]?.episodes || []).map(ep => ({
        id: `tmdb-${d.id}-s${ep.season_number ?? season.season_number}-e${ep.episode_number}`,
        season: Number(ep.season_number ?? season.season_number), number: Number(ep.episode_number) || 0,
        title: ep.name || `Episode ${ep.episode_number}`, airdate: ep.air_date || "", runtime: Number(ep.runtime) || 0,
        rating: Number(ep.vote_average) || 0, image: img(ep.still_path, "w500"), description: ep.overview || "",
        ref: { type: "episode", id: `tmdb-episode:${d.id}:${Number(ep.season_number ?? season.season_number)}:${Number(ep.episode_number)}`, title: ep.name || `Episode ${ep.episode_number}`, extra: { source: "tmdb", showId: d.id, season: Number(ep.season_number ?? season.season_number), episode: Number(ep.episode_number) } }
      })).filter(ep => ep.number > 0)).sort((a, b) => a.season - b.season || a.number - b.number);
      const episodeRaw = Object.values(seasonDetails).flatMap(season => season?.episodes || []);
      const seasons = seasonRows.map(row => ({ title: row.name, meta: [row.episode_count ? `${row.episode_count} episodes` : "", String(row.air_date || "").slice(0, 4)].filter(Boolean).join(" · "), image: img(row.poster_path, "w342"), ref: { type: "season", id: `tmdb-season:${d.id}:${row.season_number}`, title: row.name, extra: { previewOnly: true, source: "TMDB", image: img(row.poster_path, "w342"), role: [row.episode_count ? `${row.episode_count} episodes` : "", String(row.air_date || "").slice(0, 4)].filter(Boolean).join(" · ") } } }));
      const trailer = (d.videos?.results || []).find(row => row.site === "YouTube" && /trailer/i.test(row.type));
      const links = [{ label: "TMDB", url: `https://www.themoviedb.org/${kind}/${d.id}` }];
      if (d.external_ids?.imdb_id) links.push({ label: "IMDb", url: `https://www.imdb.com/title/${d.external_ids.imdb_id}/` });
      if (d.homepage) links.push({ label: "Official site", url: d.homepage });
      if (trailer) links.push({ label: "Trailer", url: `https://www.youtube.com/watch?v=${trailer.key}` });
      const runtime = d.runtime || d.episode_run_time?.[0] || 0;
      const tmdbKeywords = (d.keywords?.keywords || d.keywords?.results || []).map(row => row.name).filter(Boolean);
      const releaseCertifications = (d.release_dates?.results || []).flatMap(country => (country.release_dates || []).map(entry => entry.certification).filter(Boolean));
      const contentCertifications = (d.content_ratings?.results || []).map(row => row.rating).filter(Boolean);
      return details("tmdb", item, {
        title: d.title || d.name, description: d.overview, trailer: trailer ? { url: `https://www.youtube.com/watch?v=${trailer.key}`, title: trailer.name, image: `https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg` } : null, image: img(d.poster_path), landscapeImage: img(d.backdrop_path, "w1280"), year: String(d.release_date || d.first_air_date || "").slice(0, 4), rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0, ratingCount: d.vote_count, url: links[0].url, links, goal: kind === "tv" ? (episodeRows.length || d.number_of_episodes || 0) : 0,
        watch: { runtimeMinutes: runtime, episodeCount: kind === "tv" ? (episodeRows.length || d.number_of_episodes || 0) : 0, seasonCount: d.number_of_seasons || seasons.length },
        sections: [{ title: "Screenshots", kind: "gallery", items: shots }, { title: "Episode ratings", kind: "ratings", items: kind === "tv" ? episodeRows.map(({ id, season, number, title, rating, ref }) => ({ id, season, number, title, rating, ref })) : [] }, { title: "Cast", kind: "carousel", items: people }, ...(kind === "tv" ? [{ title: "Characters", kind: "carousel", items: characters }] : []), { title: "Staff", kind: "carousel", items: crew }, ...(kind === "tv" ? [{ title: `Episode guide (${episodeRows.length || d.number_of_episodes || 0})`, kind: "episodes", seasons: Object.fromEntries(seasonRows.map(row => [row.season_number, { premiere: row.air_date, name: row.name }])), items: episodeRows }] : []), { title: "Posters", kind: "gallery", items: posters }, ...(logos.length ? [{ title: "Logos", kind: "gallery", items: logos }] : []), { title: "You might also like", kind: "carousel", items: similar }],
        badge: [...releaseCertifications, ...contentCertifications][0] || "", tags: [...(d.genres || []).map(row => row.name), ...tmdbKeywords],
        raw: { title: d, seasons: seasonDetails, episodes: episodeRaw, recommendations: recommendationData },
        fields: [["Tagline", d.tagline], ["Status", d.status], ["Released", d.release_date || d.first_air_date], ["Last aired", d.last_air_date], ["Runtime", runtime ? `${runtime}${kind === "tv" ? " min per episode" : " min"}` : ""], ["Genres", (d.genres || []).map(row => row.name)], ["Network", (d.networks || []).map(row => row.name)], ["Studio", (d.production_companies || []).map(row => row.name)], ["Country", (d.production_countries || []).map(row => row.name)], ["Language", d.original_language], ["Original title", d.original_title || d.original_name], ["Seasons", kind === "tv" ? (d.number_of_seasons || seasons.length) : ""], ["Episodes", kind === "tv" ? (episodeRows.length || d.number_of_episodes) : ""], ["Budget", d.budget ? `$${Number(d.budget).toLocaleString()}` : ""], ["Box office", d.revenue ? `$${Number(d.revenue).toLocaleString()}` : ""], ["Keywords", tmdbKeywords], ["Certification", [...releaseCertifications, ...contentCertifications]]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- TheTVDB: series and movies (needs a key) ----
    tvdb: async (item, s) => {
      const kind = item.category === "movie" ? "movies" : "series";
      const seriesId = encode(item.providerId);
      // `short=true` omits artwork, cast and trailers. Ask for the full record and its
      // episode records so TVDB series can use the same checklist as other providers.
      const d = (await controller.tvdbGet(`/${kind}/${seriesId}/extended${kind === "series" ? "?meta=episodes" : ""}`, s)).data || {};
      let rawEpisodes = kind === "series" && Array.isArray(d.episodes) ? d.episodes : [];
      if (kind === "series" && !rawEpisodes.length) {
        const pages = [];
        for (let page = 0; page < 100; page += 1) {
          const response = await controller.tvdbGet(`/series/${seriesId}/episodes/default?page=${page}`, s);
          const rows = response.data?.episodes || [];
          if (!rows.length) break;
          pages.push(...rows);
          if (!response.links?.next) break;
          if (page === 99) throw new Error("TheTVDB episode list exceeded the page limit; refresh again to avoid saving an incomplete guide.");
        }
        rawEpisodes = pages;
      }
      const remote = Object.fromEntries((d.remoteIds || []).map(row => [row.sourceName, row.id]));
      const people = unique(d.characters || [], row => `${row.peopleId}:${row.name}`).filter(row => row.personName).slice(0, 60).map(row => ({ title: row.personName, meta: row.name ? `as ${row.name}` : row.peopleType, image: row.personImgURL || row.image || "", url: row.peopleId ? `https://thetvdb.com/people/${row.peopleId}` : "", ref: row.peopleId ? { type: "person", id: `tvdb:${row.peopleId}`, title: row.personName } : null }));
      const shots = (d.artworks || []).filter(row => [3, 15, 16, 7, 8].includes(row.type) || /background|fanart/i.test(String(row.type))).slice(0, 20).map((row, index) => ({ title: `Image ${index + 1}`, image: row.image }));
      const officialSeasons = (d.seasons || []).filter(row => String(row.type?.type || row.type || "").toLowerCase() === "official");
      const seasonRows = officialSeasons.length ? officialSeasons : (d.seasons || []);
      const seasonInfo = Object.fromEntries(seasonRows.map(row => [Number(row.number), { name: row.name || `Season ${row.number}`, premiere: row.year || "", image: row.image || "" }]));
      const seasons = seasonRows.map(row => ({ title: row.name || `Season ${row.number}`, meta: row.year || "", image: row.image || "", ref: { type: "season", id: `tvdb-season:${seriesId}:${row.number}`, title: row.name || `Season ${row.number}`, extra: { previewOnly: true, source: "TheTVDB", image: row.image || "", role: row.year || `Season ${row.number}` } } }));
      const episodeItems = unique(rawEpisodes.map(ep => {
        const season = Number(ep.seasonNumber ?? ep.seasons?.[0]?.number) || 0, number = Number(ep.number) || 0;
        if (!ep.id || !number) return null;
        const id = String(ep.id), title = ep.name || `Episode ${number}`;
        return { id: `tvdb-episode:${id}`, season, number, title, airdate: ep.aired || "", runtime: Number(ep.runtime) || 0, rating: Number(ep.score) || 0, image: ep.image || "", description: clean(ep.overview || ""), ref: { type: "episode", id, title, extra: { source: "tvdb", series: d.name || item.title, season, number } } };
      }).filter(Boolean), row => row.id).sort((a, b) => a.season - b.season || a.number - b.number);
      const links = [{ label: "TheTVDB", url: `https://thetvdb.com/${kind === "movies" ? "movies" : "series"}/${d.slug || d.id}` }];
      if (remote.IMDB) links.push({ label: "IMDb", url: `https://www.imdb.com/title/${remote.IMDB}/` });
      const runtime = d.averageRuntime || d.runtime || 0;
      if (!Object.keys(seasonInfo).length && episodeItems.length) episodeItems.forEach(ep => { seasonInfo[ep.season] ||= { name: `Season ${ep.season}` }; });
      return details("tvdb", item, {
        trailer: (() => { const list = d.trailers || [], pick = list.find(row => /^eng/i.test(row.language || "")) || list[0]; if (!pick?.url) return null; const yt = String(pick.url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/); return { url: pick.url, title: pick.name || "Official trailer", image: yt ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : "" }; })(),
        title: d.name, description: (d.translations?.overviewTranslations || []).find(row => row.language === "eng")?.overview || d.overview, image: d.image, year: String(d.year || d.first_release?.date || d.firstAired || "").slice(0, 4), rating: d.score ? Math.round(Number(d.score) / 1000) / 10 : 0, url: links[0].url, links, tags: (d.genres || []).map(row => row.name),
        goal: kind === "series" ? episodeItems.length : 0,
        watch: { runtimeMinutes: runtime, episodeCount: episodeItems.length, seasonCount: Object.keys(seasonInfo).length || seasons.length },
        sections: [{ title: "Images", kind: "gallery", items: shots }, { title: "Cast", kind: "carousel", items: people }, ...(seasons.length ? [{ title: "Seasons", kind: "carousel", items: seasons }] : []), ...(episodeItems.length ? [{ title: `Episode guide (${episodeItems.length})`, kind: "episodes", seasons: seasonInfo, items: episodeItems }, { title: "Episode ratings", kind: "ratings", items: episodeItems.map(({ id, season, number, title, rating, ref }) => ({ id, season, number, title, rating, ref })) }] : [])],
        raw: { title: d, episodes: rawEpisodes },
        fields: [["Status", d.status?.name], ["First aired", d.firstAired], ["Last aired", d.lastAired], ["Runtime", runtime ? `${runtime} min` : ""], ["Genres", (d.genres || []).map(row => row.name)], ["Network", d.originalNetwork?.name], ["Country", d.originalCountry], ["Language", d.originalLanguage], ["Seasons", Object.keys(seasonInfo).length || seasons.length], ["Episodes", episodeItems.length], ["Also known as", (d.aliases || []).map(row => row.name).slice(0, 8)]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- IMDb and Rotten Tomatoes: unofficial, read from the public page's structured data ----
    imdb: async (item, s) => {
      const id = String(item.providerId), page = await controller.sourceText("imdb", `https://www.imdb.com/title/${encode(id)}/`, s, { noCache: true }).catch(error => { throw new Error(error?.status === 403 || error?.status === 202 ? "IMDb blocked this request. Open IMDb below, complete any prompt, then ScreenMark will retry." : error?.message || "IMDb could not be reached."); });
      const ld = ldJsonType(page, item.category === "series" ? "TVSeries" : "Movie") || ldJson(page), person = (row, role = "Actor") => (Array.isArray(row) ? row : row ? [row] : []).map(entry => { const url = imdbNameUrl(entry), personId = url.match(/\/name\/(nm\d+)/i)?.[1]; return { title: entry.name, meta: entry.characterName || entry.character ? `as ${entry.characterName || entry.character}` : entry.job || role, url, ref: personId ? { type: "person", id: `imdb:${personId}`, title: entry.name } : null }; }).filter(entry => entry.title);
      if (!ld) throw new Error("IMDb returned a bot check instead of title details. Open IMDb below, complete any prompt, then ScreenMark will retry.");
      const isSeries = item.category === "series" || [].concat(ld["@type"] || []).some(type => /TVSeries|TVMiniSeries/i.test(String(type)));
      let guideEpisodes = structuredEpisodes(ld).map(ep => {
        const episodeId = String(ep.url || ep.sameAs || ep.identifier || "").match(/tt\d+/i)?.[0] || "";
        const season = Number(ep.__seasonNumber || ep.partOfSeason?.seasonNumber) || 1, number = Number(ep.episodeNumber || ep.position) || 0;
        if (!number) return null;
        const id = episodeId ? `imdb-episode:${episodeId}` : `imdb-${season}-${number}`;
        const rating = Number(ep.aggregateRating?.ratingValue) || 0, image = rtImage(ep.image), description = clean(ep.description || ep.abstract || "");
        return { id, season, number, title: ep.name || `Episode ${number}`, airdate: ep.datePublished || ep.dateCreated || "", runtime: isoMinutes(ep.duration), rating, image, description, ref: { type: "episode", id, title: ep.name || `Episode ${number}`, extra: { source: "imdb", series: ld.name || item.title, imdbId: episodeId, episode: { airdate: ep.datePublished || ep.dateCreated || "", runtime: isoMinutes(ep.duration), rating, image, description } } } };
      }).filter(Boolean);
      let seasonInfo = Object.fromEntries(structuredSeasons(ld).map(row => {
        const season = Number(row.seasonNumber || String(row.name || "").match(/season\s+(\d+)/i)?.[1]) || 0;
        return season ? [season, { name: row.name || `Season ${season}`, premiere: row.datePublished || "" }] : null;
      }).filter(Boolean));
      if (isSeries) {
        try {
          const normalizeTitle = value => String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
          const search = await get(`https://api.tvmaze.com/search/shows?q=${encode(ld.name || item.title)}`, s);
          const matches = (search || []).map(row => row.show).filter(show => normalizeTitle(show?.name) === normalizeTitle(ld.name || item.title));
          const year = String(ld.datePublished || ld.startDate || item.year || "").slice(0, 4);
          const match = matches.find(show => String(show.premiered || "").slice(0, 4) === year) || (matches.length === 1 ? matches[0] : null);
          if (match?.id) {
            const show = await get(`https://api.tvmaze.com/shows/${encode(match.id)}?embed[]=episodes&embed[]=seasons`, s);
            const episodes = show._embedded?.episodes || [], seasons = show._embedded?.seasons || [];
            if (episodes.length > guideEpisodes.length) {
              guideEpisodes = episodes.map(ep => {
                const season = Number(ep.season) || 1, number = Number(ep.number) || 0, imdbId = ep.externals?.imdb || "";
                const id = imdbId ? `imdb-episode:${imdbId}` : `tvmaze-episode:${ep.id}`;
                const image = ep.image?.original || ep.image?.medium || "", description = clean(ep.summary), rating = Number(ep.rating?.average) || 0;
                return { id, season, number, title: ep.name || `Episode ${number}`, airdate: ep.airdate || "", runtime: Number(ep.runtime) || 0, rating, image, description, ref: { type: "episode", id: imdbId ? id : ep.id, title: ep.name || `Episode ${number}`, extra: imdbId ? { source: "imdb", series: ld.name || item.title, imdbId, episode: { airdate: ep.airdate || "", runtime: Number(ep.runtime) || 0, rating, ratingSource: "TVmaze", image, description } } : { source: "tvmaze" } } };
              }).filter(ep => ep.number > 0);
            }
            if (seasons.length) seasonInfo = Object.fromEntries(seasons.map(row => [Number(row.number) || 1, { name: row.name || `Season ${row.number}`, premiere: row.premiereDate || "" }]));
          }
        } catch (_) {}
        if (!Object.keys(seasonInfo).length) seasonInfo = Object.fromEntries([...new Set(guideEpisodes.map(ep => ep.season))].map(season => [season, { name: `Season ${season}` }]));
      }
      return details("imdb", item, {
        trailer: ld.trailer?.url ? { url: String(ld.trailer.url).startsWith("/") ? `https://www.imdb.com${ld.trailer.url}` : ld.trailer.url, title: ld.trailer.name || "Official trailer", image: ld.trailer.thumbnailUrl || "" } : null,
        title: ld.name, description: ld.description, image: rtImage(ld.image), year: String(ld.datePublished || ld.startDate || "").slice(0, 4), rating: ld.aggregateRating?.ratingValue, ratingCount: ld.aggregateRating?.ratingCount, url: `https://www.imdb.com/title/${id}/`, links: [{ label: "IMDb", url: `https://www.imdb.com/title/${id}/` }], tags: toList(ld.genre), badge: ld.contentRating,
        goal: isSeries ? guideEpisodes.length : 0, watch: { runtimeMinutes: isoMinutes(ld.duration), episodeCount: guideEpisodes.length, seasonCount: Object.keys(seasonInfo).length },
        sections: [{ title: "Cast", kind: "carousel", items: person(ld.actor, "Actor") }, { title: "Staff", kind: "carousel", items: unique([...person(ld.director, "Director"), ...person(ld.creator, "Creator"), ...person(ld.writer, "Writer"), ...person(ld.producer, "Producer")], row => row.title.toLowerCase()) }, ...(isSeries && guideEpisodes.length ? [{ title: `Episode guide (${guideEpisodes.length})`, kind: "episodes", seasons: seasonInfo, items: guideEpisodes }, { title: "Episode ratings", kind: "ratings", items: guideEpisodes.map(row => ({ id: row.ref.id, season: row.season, number: row.number, title: row.title, rating: row.rating, ref: row.ref })) }] : [])],
        fields: [["Released", ld.datePublished || ld.startDate], ["Runtime", isoMinutes(ld.duration) ? `${isoMinutes(ld.duration)} min` : ""], ["Genres", toList(ld.genre)], ["Keywords", toList(ld.keywords).slice(0, 10)], ["Seasons", isSeries ? Object.keys(seasonInfo).length : ""], ["Episodes", isSeries ? guideEpisodes.length : ""]].map(([label, value]) => ({ label, value }))
      });
    },
    rottentomatoes: async (item, s) => {
      const path = String(item.providerId).startsWith("/") ? String(item.providerId) : `/${item.providerId}`;
      const page = await controller.sourceText("rottentomatoes", `https://www.rottentomatoes.com${path}`, s, { noCache: true }).catch(error => { throw new Error(error?.status === 403 ? "Rotten Tomatoes blocked this request. Open Rotten Tomatoes below, complete any prompt, then ScreenMark will retry." : error?.message || "Rotten Tomatoes could not be reached."); });
      const ld = ldJson(page); if (!ld) throw new Error("Rotten Tomatoes did not return readable title details. Open the source below, complete any prompt, then ScreenMark will retry.");
      const score = name => rtScore(page, name) || "";
      const critics = score("tomatometer") || ld.aggregateRating?.ratingValue || "", audience = score("audience");
      const person = rows => (Array.isArray(rows) ? rows : rows ? [rows] : []).map(entry => { const url = String(entry.sameAs || ""), personId = url.match(/\/name\/(nm\d+)/i)?.[1]; return { title: entry.name, url, ref: personId ? { type: "person", id: `imdb:${personId}`, title: entry.name } : null }; }).filter(entry => entry.title);
      const isSeries = item.category === "series" || /TVSeries/i.test([].concat(ld["@type"] || []).join(" ")) || path.startsWith("/tv/");
      const seriesName = ld.name || item.title;
      const declaredSeasons = [].concat(ld.containsSeason || []).filter(Boolean);
      const seasonPaths = [...page.matchAll(/href=["']([^"']*\/tv\/[^"']+\/s\d{1,3}(?:[?#][^"']*)?)["']/gi)]
        .map(([, href]) => { try { return new URL(href, "https://www.rottentomatoes.com").pathname; } catch (_) { return ""; } })
        .filter(href => href && !/\/e\d+(?:\/|$)/i.test(href));
      const seasonRefs = unique([
        ...declaredSeasons.map(row => ({ row, path: (() => { const raw = row.url || row.sameAs || ""; if (raw) { try { return new URL(raw, "https://www.rottentomatoes.com").pathname; } catch (_) {} } const number = Number(row.seasonNumber || String(row.name || "").match(/season\s+(\d+)/i)?.[1]); return number ? `${path}/s${String(number).padStart(2, "0")}` : ""; })() })),
        ...seasonPaths.map(seasonPath => ({ row: {}, path: seasonPath })),
        ...(isSeries ? Array.from({ length: Math.min(120, Number(ld.numberOfSeasons) || 0) }, (_, index) => { const number = index + 1; return { row: { seasonNumber: number }, path: `${path}/s${String(number).padStart(2, "0")}` }; }) : [])
      ].filter(entry => entry.path || entry.row.seasonNumber || entry.row.name), entry => entry.path || entry.row.seasonNumber || entry.row.name);
      const seasonPayloads = isSeries ? await mapLimit(seasonRefs, 3, async entry => {
        if (!entry.path) return { ...entry, html: "", ld: entry.row };
        const html = await controller.sourceText("rottentomatoes", `https://www.rottentomatoes.com${entry.path}`, s, { noCache: true }).catch(() => "");
        return { ...entry, html, ld: ldJson(html) || entry.row };
      }) : [];
      const episodeItems = unique(seasonPayloads.flatMap(({ row, path: seasonPath, html, ld: seasonLd }) => {
        const seasonMatch = seasonPath.match(/\/s(\d{1,3})(?:\/|$)/i);
        const season = Number(seasonLd.seasonNumber || row.seasonNumber || seasonMatch?.[1] || String(row.name || "").match(/season\s+(\d+)/i)?.[1]) || 1;
        const structured = structuredEpisodes(seasonLd, season).map(ep => {
          const number = Number(ep.episodeNumber || ep.position || String(ep.url || "").match(/\/e(\d+)/i)?.[1]) || 0;
          if (!number) return null;
          const epPath = (() => { try { return new URL(ep.url || ep.sameAs || "", "https://www.rottentomatoes.com").pathname; } catch (_) { return ""; } })() || (seasonPath ? `${seasonPath}/e${String(number).padStart(2, "0")}` : `${path}/s${String(season).padStart(2, "0")}/e${String(number).padStart(2, "0")}`);
          const episodeRating = Number(ep.aggregateRating?.ratingValue || ep.review?.reviewRating?.ratingValue) || 0;
          const episodeSeason = Number(ep.__seasonNumber) || season;
          return { id: epPath, season: episodeSeason, number, title: ep.name || `Episode ${number}`, airdate: ep.datePublished || ep.dateCreated || "", runtime: isoMinutes(ep.duration), rating: episodeRating > 10 ? Math.round(episodeRating) / 10 : episodeRating, image: rtImage(ep.image), description: clean(ep.description || ep.abstract || ""), ref: { type: "episode", id: epPath, title: ep.name || `Episode ${number}`, extra: { source: "rottentomatoes", series: seriesName } } };
        }).filter(Boolean);
        return structured.length ? structured : rtEpisodeLinks(html, seasonPath, season).map(ep => ({ ...ep, ref: { ...ep.ref, extra: { ...ep.ref.extra, series: seriesName } } }));
      }), ep => ep.id);
      const seasons = Object.fromEntries(seasonPayloads.map(({ row, path: seasonPath, ld: seasonLd }) => {
        const season = Number(seasonLd.seasonNumber || row.seasonNumber || seasonPath.match(/\/s(\d{1,3})(?:\/|$)/i)?.[1] || String(row.name || "").match(/season\s+(\d+)/i)?.[1]) || 1;
        return [season, { name: row.name || seasonLd.name || `Season ${season}`, premiere: row.datePublished || seasonLd.datePublished || "", rating: Number(seasonLd.aggregateRating?.ratingValue || row.aggregateRating?.ratingValue) || 0 }];
      }));
      let guideEpisodes = episodeItems, guideSeasons = seasons;
      if (isSeries) {
        try {
          // RT's series schema can flatten every episode into one season. Use the keyless TVmaze episode catalog only after an exact title/year match; episode links still open the matching RT episode page.
          const normalizeTitle = value => String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
          const tvSearch = await get(`https://api.tvmaze.com/search/shows?q=${encode(ld.name || item.title)}`, s);
          const exact = (tvSearch || []).map(row => row.show).filter(show => normalizeTitle(show?.name) === normalizeTitle(ld.name || item.title));
          const titleYear = String(ld.dateCreated || ld.datePublished || item.year || "").slice(0, 4);
          const tvMatch = exact.find(show => String(show.premiered || "").slice(0, 4) === titleYear) || (exact.length === 1 ? exact[0] : null);
          if (tvMatch?.id) {
            const tvShow = await get(`https://api.tvmaze.com/shows/${encode(tvMatch.id)}?embed[]=episodes&embed[]=seasons`, s);
            const tvEpisodes = tvShow._embedded?.episodes || [], tvSeasonRows = tvShow._embedded?.seasons || [];
            if (tvEpisodes.length) {
              const rtByEpisode = new Map(episodeItems.filter(ep => ep.rating > 0).map(ep => [`${ep.season}:${ep.number}`, ep.rating]));
              guideEpisodes = tvEpisodes.map(ep => {
                const season = Number(ep.season) || 1, number = Number(ep.number) || 0;
                const rtPath = `${path}/s${String(season).padStart(2, "0")}/e${String(number).padStart(2, "0")}`;
                const rtRating = rtByEpisode.get(`${season}:${number}`) || 0, rating = rtRating || Number(ep.rating?.average) || 0, ratingSource = rtRating ? "Rotten Tomatoes" : "TVmaze", image = ep.image?.original || ep.image?.medium || "", description = clean(ep.summary);
                return { id: rtPath, season, number, title: ep.name || `Episode ${number}`, airdate: ep.airdate || ep.airstamp || "", runtime: Number(ep.runtime) || 0, rating, ratingSource, image, description, ref: { type: "episode", id: rtPath, title: ep.name || `Episode ${number}`, extra: { source: "rottentomatoes", series: seriesName, episode: { airdate: ep.airdate || "", runtime: Number(ep.runtime) || 0, rating, ratingSource, image, description } } } };
              }).filter(ep => ep.number > 0);
              guideSeasons = Object.fromEntries(tvSeasonRows.map(season => [Number(season.number) || 1, { name: season.name || `Season ${season.number}`, premiere: season.premiereDate || "", end: season.endDate || "" }]));
              if (!Object.keys(guideSeasons).length) guideSeasons = Object.fromEntries([...new Set(guideEpisodes.map(ep => ep.season))].map(number => [number, { name: `Season ${number}` }]));
            }
          }
        } catch (_) {}
      }
      return details("rottentomatoes", item, {
        trailer: (ld.trailer?.url || ld.video?.contentUrl || ld.video?.url) ? { url: ld.trailer?.url || ld.video?.contentUrl || ld.video?.url, title: ld.trailer?.name || ld.video?.name || "Official trailer", image: ld.trailer?.thumbnailUrl || ld.video?.thumbnailUrl || "" } : null,
        title: ld.name, description: ld.description, image: rtImage(ld.image), year: String(ld.dateCreated || ld.datePublished || "").slice(0, 4), rating: critics ? Math.round(Number(critics)) / 10 : 0, url: `https://www.rottentomatoes.com${path}`, links: [{ label: "Rotten Tomatoes", url: `https://www.rottentomatoes.com${path}` }], tags: toList(ld.genre), badge: ld.contentRating,
        goal: isSeries ? (guideEpisodes.length || Number(ld.numberOfEpisodes) || item.goal || 0) : 0,
        watch: { episodeCount: guideEpisodes.length || Number(ld.numberOfEpisodes) || 0, seasonCount: Object.keys(guideSeasons).length || Number(ld.numberOfSeasons) || declaredSeasons.length },
        sections: [{ title: "Cast", kind: "carousel", items: person(ld.actor || ld.actors) }, { title: "Staff", kind: "carousel", items: [...person(ld.director || ld.directors).map(row => ({ ...row, meta: "Director" })), ...person(ld.producer).map(row => ({ ...row, meta: "Producer" }))] }, ...(guideEpisodes.length ? [{ title: `Episode guide (${guideEpisodes.length})`, kind: "episodes", seasons: guideSeasons, items: guideEpisodes }, { title: "Episode ratings", kind: "ratings", items: guideEpisodes.map(({ id, season, number, title, rating, ref }) => ({ id, season, number, title, rating, ref })) }] : [])],
        fields: [["Tomatometer", critics ? `${critics}%` : ""], ["Audience score", audience ? `${audience}%` : ""], ["Released", ld.dateCreated], ["Genres", toList(ld.genre)], ["Rated", ld.contentRating]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- OMDb: movies and series (needs a key) ----
    omdb: async (item, s) => {
      const key = s.apiKeys?.omdb?.trim(); if (!key) throw new Error("Add an OMDb API key in Settings → Metadata Sources.");
      const d = await get(`https://www.omdbapi.com/?apikey=${encode(key)}&i=${encode(item.providerId)}&plot=full`, s).catch(error => { throw error?.status === 401 ? new Error("OMDb rejected your API key. Check it in Metadata Sources.") : error; });
      if (d.Response === "False") throw new Error(d.Error || "OMDb details not found.");
      const na = value => value && value !== "N/A" ? value : "";
      const ratings = (d.Ratings || []).filter(row => row.Source && row.Value);
      const rotten = ratings.find(row => /rotten/i.test(row.Source))?.Value;
      const runtime = numberFrom(na(d.Runtime));
      const seasons = numberFrom(na(d.totalSeasons));
      const isSeries = na(d.Type).toLowerCase() === "series" || item.category === "series";
      const seasonResults = isSeries && seasons ? await mapLimit(Array.from({ length: seasons }, (_, index) => index + 1), 4, async season => {
        try {
          const response = await get(`https://www.omdbapi.com/?apikey=${encode(key)}&i=${encode(item.providerId)}&Season=${season}`, s);
          if (response.Response === "False") throw new Error(response.Error || `Season ${season} was not returned.`);
          return response;
        } catch (error) { return { Season: String(season), _fetchError: String(error?.message || error) }; }
      }) : [];
      const failedSeason = seasonResults.find(row => row?._fetchError);
      if (failedSeason) throw new Error(`OMDb could not load season ${failedSeason.Season}: ${failedSeason._fetchError}`);
      const episodeRows = seasonResults.flatMap((seasonData, index) => (seasonData?.Episodes || []).map(ep => ({
        id: `omdb-${ep.imdbID || `${item.providerId}-s${index + 1}-e${ep.Episode}`}`,
        season: index + 1, number: numberFrom(ep.Episode), title: na(ep.Title) || `Episode ${ep.Episode}`,
        airdate: na(ep.Released), runtime: 0, rating: numberFrom(na(ep.imdbRating)), image: "", description: "",
        ref: { type: "episode", id: ep.imdbID || `${item.providerId}-s${index + 1}-e${ep.Episode}`, title: na(ep.Title) }
      })).filter(ep => ep.number > 0)).sort((a, b) => a.season - b.season || a.number - b.number);
      const episodeDetails = await mapLimit(episodeRows, 3, async episode => {
        const episodeImdbId = episode.ref.id;
        if (!/^tt\d+$/i.test(String(episodeImdbId))) return { _fetchError: "OMDb did not provide an IMDb episode ID." };
        try { return await get(`https://www.omdbapi.com/?apikey=${encode(key)}&i=${encode(episodeImdbId)}&plot=full`, s); }
        catch (error) { return { _fetchError: String(error?.message || error) }; }
      });
      episodeRows.forEach((episode, index) => {
        const raw = episodeDetails[index];
        if (!raw || raw.Response === "False" || raw._fetchError) return;
        episode.raw = raw;
        episode.airdate = na(raw.Released) || episode.airdate;
        episode.runtime = numberFrom(na(raw.Runtime)) || episode.runtime;
        episode.rating = numberFrom(na(raw.imdbRating)) || episode.rating;
        episode.image = na(raw.Poster) || episode.image;
        episode.description = na(raw.Plot) || episode.description;
      });
      const episodeCounts = seasonResults.map((seasonData, index) => [index + 1, { premiere: seasonData?.Episodes?.find(ep => na(ep.Released))?.Released || "" }]);
      const breakdown = ratings.map(row => ({ label: row.Source.replace("Internet Movie Database", "IMDb"), percent: /%/.test(row.Value) ? numberFrom(row.Value) : /\/10$/.test(row.Value) ? numberFrom(row.Value) * 10 : /\/100$/.test(row.Value) ? numberFrom(row.Value) : 0 }));
      const cast = toList(na(d.Actors)).map(name => ({ title: name, meta: "Actor", image: "" }));
      const staff = [
        ...toList(na(d.Director)).map(name => ({ title: name, meta: "Director", image: "" })),
        ...toList(na(d.Writer)).map(name => ({ title: name, meta: "Writer", image: "" }))
      ].filter((row, index, rows) => rows.findIndex(candidate => candidate.title.toLowerCase() === row.title.toLowerCase()) === index);
      return details("omdb", item, {
        title: d.Title, description: na(d.Plot), image: na(d.Poster), year: na(d.Year).slice(0, 4), rating: na(d.imdbRating) ? Number(d.imdbRating) : 0, url: `https://www.imdb.com/title/${d.imdbID}/`,
        links: [{ label: "IMDb", url: `https://www.imdb.com/title/${d.imdbID}/` }, ...(na(d.Website) ? [{ label: "Website", url: d.Website }] : [])],
        tags: toList(na(d.Genre)), badge: na(d.Rated) ? `Rated ${d.Rated}` : "", ratingBreakdown: breakdown, ratingCount: numberFrom(na(d.imdbVotes)),
        raw: { title: d, seasons: seasonResults, episodes: episodeDetails },
        watch: { runtimeMinutes: runtime, episodeCount: isSeries ? (episodeRows.length || numberFrom(na(d.totalEpisodes))) : 0, seasonCount: isSeries ? seasons : 0 }, sections: [{ title: "Cast", kind: "carousel", items: cast }, { title: "Staff", kind: "carousel", items: staff }, ...(isSeries && episodeRows.length ? [{ title: `Episode guide (${episodeRows.length})`, kind: "episodes", seasons: Object.fromEntries(episodeCounts), items: episodeRows }, { title: "Episode ratings", kind: "ratings", items: episodeRows.map(({ id, season, number, title, rating, ref }) => ({ id, season, number, title, rating, ref })) }] : [])],
        goal: isSeries ? episodeRows.length : 0,
        fields: [["Type", na(d.Type)], ["Released", na(d.Released)], ["Runtime", runtime ? `${runtime}${isSeries ? " min per episode" : " min"}` : ""], ["Genres", na(d.Genre)], ["Director", na(d.Director)], ["Writer", na(d.Writer)], ["Language", na(d.Language)], ["Country", na(d.Country)], ["Awards", na(d.Awards)], ["Metascore", na(d.Metascore)], ["Rotten Tomatoes", rotten || ""], ["IMDb votes", na(d.imdbVotes)], ["Seasons", isSeries ? seasons : ""], ["Episodes", isSeries ? (episodeRows.length || numberFrom(na(d.totalEpisodes))) : ""], ["Box office", na(d.BoxOffice)], ["Production", na(d.Production)]].map(([label, value]) => ({ label, value }))
      });
    }
  };
  function unique(list, keyOf) { const seen = new Set(); return list.filter(entry => { const key = keyOf(entry); if (key == null || key === "" || seen.has(key)) return false; seen.add(key); return true; }); }


  // In-app TVmaze pages opened from cast, characters, staff, episodes and suggestions.
  const idFromHref = href => String(href || "").match(/\/(\d+)(?:\?|$)/)?.[1] || "";
  const showCard = show => ({ id: show.id, title: show.name, meta: [show.premiered?.slice(0, 4), show.rating?.average ? `★ ${show.rating.average}` : ""].filter(Boolean).join(" · "), image: show.image?.medium || show.image?.original || "", year: show.premiered?.slice(0, 4) || "", description: clean(show.summary), url: show.url });
  const loadRef = async (ref, settings = {}) => {
    const base = "https://api.tvmaze.com", id = encode(ref.id);
    if (ref.extra?.previewOnly) {
      const preview = ref.extra;
      return { type: ref.type || "person", source: preview.source || "ScreenMark", title: ref.title || preview.name || "Details", image: preview.image || "", subtitle: preview.role || "", url: preview.url || "", facts: preview.role ? [[ref.type === "season" ? "Season details" : "Role", preview.role]] : [], sections: [] };
    }
    if (ref.type === "person") {
      const anilistPerson = String(ref.id).match(/^anilist-(staff|character):(\d+)$/);
      if (anilistPerson) {
        const [, entity, personId] = anilistPerson;
        const query = entity === "staff"
          ? `query($id:Int){Staff(id:$id){id name{full native} language image{large medium} description yearsActive homeTown primaryOccupations siteUrl}}`
          : `query($id:Int){Character(id:$id){id name{full native} image{large medium} description siteUrl media(sort:POPULARITY_DESC,perPage:15){nodes{id title{english romaji}format startDate{year}coverImage{medium}}}}}`;
        const result = anilistResponse(await get("https://graphql.anilist.co", { ...settings, method: "POST", headers: POST_JSON, body: JSON.stringify({ query, variables: { id: Number(personId) } }) }));
        const person = result[entity === "staff" ? "Staff" : "Character"];
        if (!person) throw new Error("AniList could not load this profile.");
        const name = person.name?.full || ref.title || "Unknown";
        const media = (person.media?.nodes || []).map(row => {
          const category = row.format === "MOVIE" ? "movie" : "series", title = row.title?.english || row.title?.romaji || "Untitled";
          return { id: row.id, title, image: row.coverImage?.medium || "", meta: [row.format, row.startDate?.year].filter(Boolean).join(" · "), ref: { type: "show", id: row.id, title, extra: { source: "anilist", category } } };
        });
        const facts = entity === "staff"
          ? [["Occupations", person.primaryOccupations], ["Language", person.language], ["Years active", (person.yearsActive || []).join("–")], ["Hometown", person.homeTown]]
          : [["Also known as", person.name?.native]];
        return { type: entity === "character" ? "character" : "person", source: "AniList", title: name, image: person.image?.large || person.image?.medium || "", url: person.siteUrl || `https://anilist.co/${entity}/${personId}`, description: clean(person.description || ""), facts: facts.filter(([, value]) => value), sections: media.length ? [{ title: "Appears in", kind: "shows", items: media }] : [] };
      }
      if (/^tvdb:\d+$/i.test(String(ref.id))) {
        const personId = String(ref.id).split(":")[1];
        const person = (await controller.tvdbGet(`/people/${encode(personId)}/extended`, settings)).data || {};
        const biography = (person.biographies || []).find(row => /^eng/i.test(row.language || "")) || (person.biographies || [])[0];
        const bio = biography?.biography || biography?.overview || biography?.text || "";
        const remote = Object.fromEntries((person.remoteIds || []).map(row => [String(row.sourceName || "").toLowerCase(), row.id]));
        const links = remote.imdb ? [{ label: "IMDb", url: `https://www.imdb.com/name/${remote.imdb}/` }] : [];
        const facts = [["Born", person.birth], ["Died", person.death], ["Birthplace", person.birthPlace], ["Also known as", (person.aliases || []).map(row => row.name).filter(Boolean)]]
          .filter(([, value]) => Array.isArray(value) ? value.length : value);
        return { type: "person", source: "TheTVDB", title: person.name || ref.title, image: person.image || "", url: `https://thetvdb.com/people/${personId}`, description: clean(bio || person.overview || ""), facts, links, sections: [], raw: person };
      }
      if (/^imdb:nm\d+$/i.test(String(ref.id))) {
        const personId = String(ref.id).split(":")[1];
        const html = await controller.sourceText("imdb", `https://www.imdb.com/name/${encode(personId)}/`, settings, { noCache: true });
        const person = ldJsonType(html, "Person") || ldJson(html);
        if (!person) throw new Error("IMDb did not return readable profile details.");
        const facts = [["Job", person.jobTitle], ["Known for", person.knowsAbout], ["Born", person.birthDate], ["Birthplace", person.birthPlace?.name || person.birthPlace], ["Also known as", person.alternateName]].filter(([, value]) => value);
        return { type: "person", source: "IMDb", title: person.name || ref.title, image: rtImage(person.image), url: `https://www.imdb.com/name/${personId}/`, description: clean(person.description || ""), facts, sections: [] };
      }
      if (/^tmdb:\d+$/i.test(String(ref.id))) {
        const personId = String(ref.id).split(":")[1];
        const person = await controller.tmdbGet(`/person/${encode(personId)}?append_to_response=combined_credits,images,external_ids`, settings);
        const image = path => path ? `https://image.tmdb.org/t/p/w342${path}` : "";
        const card = row => {
          const mediaType = row.media_type || (row.title ? "movie" : "tv"), category = mediaType === "movie" ? "movie" : "series";
          const title = row.title || row.name || "Untitled", year = String(row.release_date || row.first_air_date || "").slice(0, 4);
          return { id: row.id, title, meta: [row.character ? `as ${row.character}` : "", year, row.vote_average ? `★ ${Number(row.vote_average).toFixed(1)}` : ""].filter(Boolean).join(" · "), image: image(row.poster_path), url: `https://www.themoviedb.org/${mediaType}/${row.id}`, ref: { type: "show", id: row.id, title, extra: { source: "tmdb", category } } };
        };
        const cast = person.combined_credits?.cast || [], crew = person.combined_credits?.crew || [];
        const movieCredits = unique(cast.filter(row => row.media_type === "movie"), row => row.id).map(card);
        const seriesCredits = unique(cast.filter(row => row.media_type === "tv"), row => row.id).map(card);
        const crewCredits = unique(crew, row => `${row.id}:${row.job}:${row.media_type}`).map(row => ({ ...card(row), meta: [row.job, String(row.release_date || row.first_air_date || "").slice(0, 4)].filter(Boolean).join(" · ") }));
        const facts = [["Known for", person.known_for_department], ["Born", person.birthday], ["Died", person.deathday], ["Birthplace", person.place_of_birth], ["Gender", person.gender === 1 ? "Female" : person.gender === 2 ? "Male" : person.gender ? "Non-binary" : ""], ["Also known as", person.also_known_as], ["Popularity", person.popularity]].filter(([, value]) => value);
        return { type: "person", source: "TMDB", title: person.name || ref.title, image: image(person.profile_path), url: person.homepage || `https://www.themoviedb.org/person/${personId}`, description: clean(person.biography), facts, sections: [{ title: `Series (${seriesCredits.length})`, kind: "shows", items: seriesCredits }, { title: `Movies (${movieCredits.length})`, kind: "shows", items: movieCredits }, { title: `Crew credits (${crewCredits.length})`, kind: "shows", items: crewCredits }].filter(section => section.items.length), raw: person };
      }
      const [person, cast, crew, guest] = await Promise.all([
        get(`${base}/people/${id}`, settings),
        get(`${base}/people/${id}/castcredits?embed[]=show&embed[]=character`, settings).catch(() => []),
        get(`${base}/people/${id}/crewcredits?embed=show`, settings).catch(() => []),
        get(`${base}/people/${id}/guestcastcredits?embed[]=episode&embed[]=character`, settings).catch(() => [])
      ]);
      const roleOf = row => row._embedded?.character?.name ? `as ${row._embedded.character.name}` : "";
      const castShows = unique(cast, row => row._embedded?.show?.id).map(row => ({ ...showCard(row._embedded.show), meta: [roleOf(row), row._embedded.show.premiered?.slice(0, 4)].filter(Boolean).join(" · ") }));
      const crewShows = unique(crew, row => `${row._embedded?.show?.id}:${row.type}`).map(row => ({ ...showCard(row._embedded.show), meta: [row.type, row._embedded.show.premiered?.slice(0, 4)].filter(Boolean).join(" · ") }));
      const guestRows = unique(guest, row => row._embedded?.episode?.id).slice(0, 60);
      const showIds = [...new Set(guestRows.map(row => idFromHref(row._embedded.episode._links?.show?.href)).filter(Boolean))].slice(0, 24);
      const names = Object.fromEntries(await Promise.all(showIds.map(showId => get(`${base}/shows/${showId}`, settings).then(row => [showId, row]).catch(() => [showId, null]))));
      const guestEpisodes = guestRows.map(row => {
        const ep = row._embedded.episode, parent = names[idFromHref(ep._links?.show?.href)];
        return { id: ep.id, title: `${parent?.name ? `${parent.name} · ` : ""}S${ep.season}E${ep.number} · ${ep.name}`, meta: [roleOf(row), ep.airdate].filter(Boolean).join(" · "), image: ep.image?.medium || parent?.image?.medium || "", ref: { type: "episode", id: ep.id, title: ep.name } };
      });
      const facts = [["Born", person.birthday], ["Died", person.deathday], ["Country", person.country?.name], ["Gender", person.gender]].filter(([, value]) => value);
      return { type: "person", title: person.name, image: person.image?.original || person.image?.medium || "", url: person.url, facts, sections: [
        { title: `Series (${castShows.length})`, kind: "shows", items: castShows },
        { title: `Crew credits (${crewShows.length})`, kind: "shows", items: crewShows },
        { title: `Guest appearances (${guestEpisodes.length})`, kind: "episodes-list", items: guestEpisodes }
      ].filter(section => section.items.length) };
    }
    if (ref.type === "character") {
      const character = await get(`${base}/characters/${id}`, settings), extra = ref.extra || {};
      const actors = extra.person ? [{ title: extra.person.name, image: extra.person.image || "", ref: { type: "person", id: extra.person.id, title: extra.person.name } }] : [];
      const shows = extra.show ? [{ id: extra.show.id, title: extra.show.name, image: extra.show.image || "", meta: "Series" }] : [];
      return { type: "character", title: character.name, image: character.image?.original || character.image?.medium || "", url: character.url, facts: [], sections: [{ title: "Played by", kind: "people", items: actors }, { title: "Appears in", kind: "shows", items: shows }].filter(section => section.items.length) };
    }
    if (ref.type === "episode") {
      if (ref.extra?.source === "tenrai") {
        const malId = Number(ref.extra.malId), episodeId = Number(ref.id);
        if (!Number.isSafeInteger(malId) || malId <= 0 || !Number.isSafeInteger(episodeId) || episodeId <= 0) throw new Error("AniList did not provide a valid episode reference.");
        const episode = (await animeEpisodeGet(`https://api.tenrai.org/v1/anime/${malId}/episodes/${episodeId}`, settings)).data;
        if (!episode) throw new Error("MyAnimeList could not load this episode.");
        const series = ref.extra.anilistId ? [{ id: ref.extra.anilistId, title: ref.extra.series || "Series", meta: "Series", ref: { type: "show", id: ref.extra.anilistId, title: ref.extra.series || "Series", extra: { source: "anilist", category: "series" } } }] : [];
        const url = episode.url || ref.extra.url || `https://myanimelist.net/anime/${malId}`;
        const runtime = Math.round((Number(episode.duration) || 0) / 60), image = episode.images?.jpg?.image_url || episode.images?.webp?.image_url || "";
        return { type: "episode", source: "MyAnimeList", title: episode.title || ref.title || `Episode ${ref.extra.number || episodeId}`, subtitle: `${ref.extra.series || "Series"} · Episode ${ref.extra.number || episodeId}`, image, url, description: clean(episode.synopsis || ref.extra.episode?.description || ""), facts: [["Aired", episode.aired?.from || episode.aired], ["Runtime", runtime ? `${runtime} min` : ""], ["Rating", episode.score ? `★ ${episode.score}` : ""], ["Episode", ref.extra.number || episodeId]].filter(([, value]) => value), sections: [{ title: "Series", kind: "shows", items: series }].filter(section => section.items.length), raw: episode };
      }
      if (ref.extra?.source === "tvdb") {
        const row = (await controller.tvdbGet(`/episodes/${encode(ref.id)}/extended`, settings)).data || {};
        const people = unique(row.characters || [], person => `${person.peopleId}:${person.name}`).filter(person => person.personName).map(person => ({ title: person.personName, meta: person.name ? `as ${person.name}` : person.peopleType || "Actor", image: person.personImgURL || person.image || "", url: person.peopleId ? `https://thetvdb.com/people/${person.peopleId}` : "", ref: person.peopleId ? { type: "person", id: `tvdb:${person.peopleId}`, title: person.personName } : null }));
        const seriesId = row.seriesId || ref.extra?.seriesId;
        const series = seriesId ? [{ id: seriesId, title: ref.extra?.series || "Series", meta: "Series", ref: { type: "show", id: seriesId, title: ref.extra?.series || "Series", extra: { source: "tvdb", category: "series" } } }] : [];
        const image = row.image || "";
        const facts = [["Aired", row.aired], ["Runtime", row.runtime ? `${row.runtime} min` : ""], ["Season", row.seasonNumber ?? ref.extra?.season], ["Episode", row.number ?? ref.extra?.number], ["Production code", row.productionCode], ["Content rating", row.contentRatings?.[0]?.name]].filter(([, value]) => value !== undefined && value !== null && value !== "");
        return { type: "episode", source: "TheTVDB", title: row.name || ref.title || "Episode", subtitle: `${ref.extra?.series || "Series"} · S${row.seasonNumber ?? ref.extra?.season}E${row.number ?? ref.extra?.number}`, image, description: clean(row.overview || ""), url: `https://thetvdb.com/episodes/${ref.id}`, facts, sections: [{ title: "Series", kind: "shows", items: series }, { title: "Cast", kind: "people", items: people }].filter(section => section.items.length), raw: row };
      }
      if (ref.extra?.source === "imdb" || /^imdb-episode:tt\d+$/i.test(String(ref.id))) {
        const imdbId = ref.extra?.imdbId || String(ref.id).match(/tt\d+/i)?.[0] || "";
        if (!imdbId) throw new Error("IMDb did not provide an episode ID for this entry.");
        const html = await controller.sourceText("imdb", `https://www.imdb.com/title/${encode(imdbId)}/`, settings, { noCache: true }).catch(error => { throw new Error(error?.status === 403 || error?.status === 202 ? "IMDb blocked this episode request. Open IMDb below, complete any prompt, then ScreenMark will retry." : error?.message || "IMDb episode details could not be loaded."); });
        const ep = ldJsonType(html, "TVEpisode") || ldJson(html);
        if (!ep) throw new Error("IMDb did not return readable episode details. Open IMDb below, complete any prompt, then retry.");
        const fallback = ref.extra?.episode || {}, episodeNumber = Number(ep.episodeNumber || ref.extra?.number) || 0;
        const season = Number(ep.partOfSeason?.seasonNumber || ref.extra?.season) || 0;
        const rating = Number(ep.aggregateRating?.ratingValue) || Number(fallback.rating) || 0;
        const image = rtImage(ep.image) || fallback.image || "";
        const actors = row => (Array.isArray(row) ? row : row ? [row] : []).map(person => ({ title: person.name, meta: person.characterName || person.character ? `as ${person.characterName || person.character}` : "Actor", url: imdbNameUrl(person) })).filter(person => person.title);
        const description = clean(ep.description || ep.abstract || "") || fallback.description || "";
        const seriesName = ep.partOfSeries?.name || ref.extra?.series || "Series";
        return { type: "episode", source: "IMDb", title: ep.name || ref.title || `Episode ${episodeNumber}`, subtitle: `${seriesName}${season ? ` · S${season}` : ""}${episodeNumber ? `E${episodeNumber}` : ""}`, image, description, url: `https://www.imdb.com/title/${encode(imdbId)}/`, facts: [["Aired", ep.datePublished || ep.dateCreated || fallback.airdate], ["Runtime", isoMinutes(ep.duration) ? `${isoMinutes(ep.duration)} min` : Number(fallback.runtime) ? `${fallback.runtime} min` : ""], ["IMDb rating", rating ? `★ ${rating.toFixed(1)}` : ""], ["Votes", ep.aggregateRating?.ratingCount], ["Season", season], ["Episode", episodeNumber], ["Rated", ep.contentRating]].filter(([, value]) => value), sections: [{ title: "Cast", kind: "people", items: actors(ep.actor) }, { title: "Staff", kind: "people", items: [...actors(ep.director).map(row => ({ ...row, meta: "Director" })), ...actors(ep.creator).map(row => ({ ...row, meta: "Creator" }))] }].filter(section => section.items.length), raw: ep };
      }
      if (ref.extra?.source === "rottentomatoes" || /^\/tv\/[^/]+\/s\d{1,3}\/e\d{1,3}/i.test(String(ref.id))) {
        const path = String(ref.id).startsWith("/") ? String(ref.id) : `/${ref.id}`;
        const html = await controller.sourceText("rottentomatoes", `https://www.rottentomatoes.com${path}`, settings, { noCache: true });
        const ep = ldJson(html);
        if (!ep) throw new Error("Rotten Tomatoes did not return readable episode details.");
        const critics = rtScore(html, "tomatometer") || Number(ep.aggregateRating?.ratingValue) || 0;
        const rating = critics > 10 ? Math.round(critics) / 10 : critics;
        const score = rtScore(html, "audience");
        const epNumber = Number(ep.episodeNumber || path.match(/\/e(\d+)/i)?.[1]) || 0;
        const season = Number(ep.partOfSeason?.seasonNumber || path.match(/\/s(\d+)/i)?.[1]) || 0;
        const episodeFallback = ref.extra?.episode || {};
        const parentTitle = ep.partOfSeries?.name || ref.extra?.series || "Series";
        const image = rtImage(ep.image) || episodeFallback.image || "";
        const people = value => (Array.isArray(value) ? value : value ? [value] : []).map(row => ({ title: row.name || row.title, url: row.sameAs || "" })).filter(row => row.title);
        const rawDescription = clean(ep.description || ep.abstract || ""), description = /discover reviews, ratings, and trailers/i.test(rawDescription) ? episodeFallback.description || "" : rawDescription || episodeFallback.description || "";
        const fallbackRuntime = Number(episodeFallback.runtime) || 0, fallbackRating = Number(episodeFallback.rating) || 0;
        return { type: "episode", source: "Rotten Tomatoes", title: ep.name || ref.title || `Episode ${epNumber}`, subtitle: `${parentTitle}${season ? ` · S${season}` : ""}${epNumber ? `E${epNumber}` : ""}`, image, description, url: `https://www.rottentomatoes.com${path}`, facts: [["Aired", ep.datePublished || ep.dateCreated || episodeFallback.airdate], ["Runtime", isoMinutes(ep.duration) ? `${isoMinutes(ep.duration)} min` : fallbackRuntime ? `${fallbackRuntime} min` : ""], ["Tomatometer", critics ? `${critics}%` : ""], [episodeFallback.ratingSource === "TVmaze" ? "TVmaze rating" : "Rating", rating ? `★ ${rating.toFixed(1)}` : fallbackRating ? `★ ${fallbackRating.toFixed(1)}` : ""], ["Audience score", score ? `${score}%` : ""], ["Season", season], ["Episode", epNumber], ["Rated", ep.contentRating]].filter(([, value]) => value), sections: [{ title: "Cast", kind: "people", items: people(ep.actor) }, { title: "Staff", kind: "people", items: [...people(ep.director).map(row => ({ ...row, meta: "Director" })), ...people(ep.producer).map(row => ({ ...row, meta: "Producer" }))] }].filter(section => section.items.length), raw: ep };
      }
      if (/^tt\d+$/i.test(String(ref.id))) {
        const key = settings.apiKeys?.omdb?.trim();
        if (!key) throw new Error("Add an OMDb API key in Settings → Metadata Sources to load this episode.");
        const row = await get(`https://www.omdbapi.com/?apikey=${encode(key)}&i=${encode(ref.id)}&plot=full`, settings);
        if (row.Response === "False") throw new Error(row.Error || "OMDb could not find this episode.");
        const na = value => value && value !== "N/A" ? value : "";
        const asPeople = (value, meta) => toList(na(value)).map(name => ({ title: name, meta, image: "" }));
        const season = na(row.Season), episode = na(row.Episode);
        return { type: "episode", source: "OMDb", title: na(row.Title) || ref.title, subtitle: [na(row.Series), season && episode ? `S${season}E${episode}` : ""].filter(Boolean).join(" · "), image: na(row.Poster), description: na(row.Plot), url: row.imdbID ? `https://www.imdb.com/title/${row.imdbID}/` : "", facts: [["Aired", na(row.Released)], ["Runtime", na(row.Runtime)], ["Rating", na(row.imdbRating) ? `★ ${row.imdbRating}` : ""], ["Votes", na(row.imdbVotes)], ["Rated", na(row.Rated)], ["Season", season], ["Episode", episode]].filter(([, value]) => value), sections: [{ title: "Cast", kind: "people", items: asPeople(row.Actors, "Actor") }, { title: "Staff", kind: "people", items: [...asPeople(row.Director, "Director"), ...asPeople(row.Writer, "Writer")] }].filter(section => section.items.length), raw: row };
      }
      const tmdbEpisodeRef = String(ref.id).match(/^tmdb-episode:(\d+):(\d+):(\d+)$/);
      if (ref.extra?.source === "tmdb" || tmdbEpisodeRef) {
        const { showId, season, episode } = ref.extra?.source === "tmdb" ? ref.extra : { showId: tmdbEpisodeRef[1], season: tmdbEpisodeRef[2], episode: tmdbEpisodeRef[3] };
        const row = await controller.tmdbGet(`/tv/${encode(showId)}/season/${encode(season)}/episode/${encode(episode)}?append_to_response=credits,images`, settings);
        const tmdbImage = path => path ? `https://image.tmdb.org/t/p/w500${path}` : "";
        const episodeCast = (row.credits?.cast || row.guest_stars || []).map(person => ({ title: person.name, meta: person.character ? `as ${person.character}` : "", image: tmdbImage(person.profile_path), url: `https://www.themoviedb.org/person/${person.id}`, ref: { type: "person", id: `tmdb:${person.id}`, title: person.name } }));
        const episodeCrew = (row.credits?.crew || []).map(person => ({ title: person.name, meta: person.job || person.department || "Crew", image: tmdbImage(person.profile_path), url: `https://www.themoviedb.org/person/${person.id}`, ref: { type: "person", id: `tmdb:${person.id}`, title: person.name } }));
        const stills = (row.images?.stills || []).map((still, index) => ({ title: `Still ${index + 1}`, image: tmdbImage(still.file_path) }));
        return { type: "episode", source: "TMDB", title: row.name || ref.title, subtitle: `${row.show_name || "Series"} · S${season}E${episode}`, image: tmdbImage(row.still_path), landscape: Boolean(row.still_path), url: `https://www.themoviedb.org/tv/${showId}/season/${season}/episode/${episode}`, description: clean(row.overview), facts: [["Aired", row.air_date], ["Runtime", row.runtime ? `${row.runtime} min` : ""], ["Rating", row.vote_average ? `★ ${row.vote_average}` : ""], ["Votes", row.vote_count], ["Production code", row.production_code]].filter(([, value]) => value), sections: [{ title: "Cast", kind: "people", items: episodeCast }, { title: "Crew", kind: "people", items: episodeCrew }, { title: "Screenshots", kind: "gallery", items: stills }].filter(section => section.items.length), raw: row };
      }
      const [ep, guestCast, guestCrew] = await Promise.all([get(`${base}/episodes/${id}?embed=show`, settings), get(`${base}/episodes/${id}/guestcast?embed[]=person&embed[]=character`, settings).catch(() => []), get(`${base}/episodes/${id}/guestcrew?embed=person`, settings).catch(() => [])]);
      const parent = ep._embedded?.show;
      const asRef = person => person?.id ? { type: "person", id: person.id, title: person.name } : null;
      const guests = unique(guestCast, row => `${row.person?.id}:${row.character?.id}`).map(row => ({ title: row.person?.name, meta: row.character?.name ? `as ${row.character.name}` : "", image: row.person?.image?.medium || "", url: row.person?.url, ref: asRef(row.person) }));
      const crewRows = unique(guestCrew, row => `${row.person?.id}:${row.type}`).map(row => ({ title: row.person?.name, meta: row.type, image: row.person?.image?.medium || "", url: row.person?.url, ref: asRef(row.person) }));
      return { type: "episode", source: "TVmaze", title: ep.name, subtitle: `${parent?.name ? `${parent.name} · ` : ""}S${ep.season}E${ep.number}`, image: ep.image?.original || ep.image?.medium || parent?.image?.original || "", landscape: !!ep.image, url: ep.url, description: clean(ep.summary),
        facts: [["Aired", ep.airdate], ["Runtime", ep.runtime ? `${ep.runtime} min` : ""], ["Rating", ep.rating?.average ? `★ ${ep.rating.average}` : ""], ["Type", ep.type !== "regular" ? ep.type : ""]].filter(([, value]) => value),
        sections: [{ title: "Show", kind: "shows", items: parent ? [showCard(parent)] : [] }, { title: "Guest cast", kind: "people", items: guests }, { title: "Guest crew", kind: "people", items: crewRows }].filter(section => section.items.length) };
    }
    throw new Error("This link type cannot be opened in the app.");
  };

  const load = async (item, settings = {}) => {
    if (!item?.metadataSource || !item?.providerId) throw new Error("This entry has no source ID to load details from.");
    const source = metadata.providers.find(row => row.key === item.metadataSource && row.categories.includes(item.category));
    if (source?.custom) {
      if (!metadata.isEnabled(source.key, settings)) throw new Error(`${source.name} is disabled in Metadata Sources.`);
      const config = source.config, loaded = await controller.loadCustomDetails(config, item, settings);
      const map = config.detailMap || {}, root = loaded?.root || {}, text = path => loaded?.pickText(root, path) || "", list = path => loaded?.pickList(root, path) || [];
      const shots = list(map.screenshots).map((image, index) => ({ title: `Image ${index + 1}`, image, url: image })).filter(row => /^https?:/i.test(row.image));
      const runtime = numberFrom(text(map.runtime)), episodes = numberFrom(text(map.episodes));
      return details(source.key, item, { title: text(map.title) || item.title, description: text(map.description) || item.description, image: text(map.image) || item.image, year: text(map.released).slice(0, 4) || item.year, rating: Number(text(map.rating)) || 0, url: text(map.url) || item.url, goal: episodes || item.goal, sections: shots.length ? [{ title: "Images", kind: "gallery", items: shots }] : [], tags: list(map.tags), links: item.url ? [{ label: `Open on ${source.name}`, url: item.url }] : [], watch: { runtimeMinutes: runtime, episodeCount: episodes, seasonCount: numberFrom(text(map.seasons)) }, fields: [["Released", text(map.released)], ["Genres", list(map.genres)], ["Director", list(map.directors)], ["Cast", list(map.cast)], ["Network", text(map.network)], ["Runtime", runtime ? `${runtime} min` : ""], ["Episodes", episodes || ""], ["Seasons", text(map.seasons)], ["Language", text(map.language)], ["Country", text(map.country)], ["Awards", text(map.awards)]].map(([label, value]) => ({ label, value })) });
    }
    if (!source || typeof loaders[source.key] !== "function") throw new Error(`This ${appKey} app does not support ${item.metadataSource} details for ${item.category}.`);
    if (!metadata.isEnabled(source.key, settings)) throw new Error(`${source.name} is disabled in Metadata Sources.`);
    const id = String(item.providerId);
    const normalizedItem = id.startsWith(`${source.key}:`) ? { ...item, providerId: id.slice(source.key.length + 1) } : item;
    return loaders[source.key](normalizedItem, settings);
  };
  window.SplitAppDetailController = Object.freeze({ appKey, load, loadRef });
})();
