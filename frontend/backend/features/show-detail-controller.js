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
    year: data.year || item.year || "", rating: data.rating || item.rating || 0,
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

  const isoMinutes = value => { const match = String(value || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?/); return match ? (Number(match[1]) || 0) * 60 + (Number(match[2]) || 0) : 0; };
  const ldJson = html => {
    for (const block of String(html || "").matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      try { const parsed = JSON.parse(block[1]); const hit = [].concat(parsed, parsed?.["@graph"] || []).find(row => row && /Movie|TVSeries|TVEpisode|TVSeason/i.test([].concat(row["@type"] || []).join(" "))); if (hit) return hit; } catch (_) {}
    }
    return null;
  };
  const loaders = {
    // ---- TVmaze: series ----
    tvmaze: async (item, s) => {
      const show = await get(`https://api.tvmaze.com/shows/${encode(item.providerId)}?embed[]=episodes&embed[]=cast&embed[]=seasons&embed[]=crew&embed[]=akas&embed[]=images`, s);
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
      const similar = await alsoLike().catch(() => []);
      return details("tvmaze", item, {
        title: show.name, description: show.summary, image: show.image?.original || show.image?.medium, landscapeImage: images.find(row => row.type === "background")?.resolutions?.original?.url, year: show.premiered?.slice(0, 4), rating: show.rating?.average, url: show.url, goal: eps.length,
        links, tags: show.genres, watch: { runtimeMinutes: show.runtime || show.averageRuntime || 0, episodeCount: eps.length, seasonCount: seasons.length },
        sections: [
          { title: "Screenshots", kind: "gallery", items: shots },
          { title: "Episode ratings", kind: "ratings", items: episodeItems.filter(ep => ep.number).map(ep => ({ id: ep.id, season: ep.season, number: ep.number, title: ep.title, rating: ep.rating })) },
          { title: "Cast", kind: "carousel", items: castItems },
          { title: "Characters", kind: "carousel", items: characterItems },
          { title: "Staff", kind: "carousel", items: staffItems },
          { title: `Episode guide (${eps.length})`, kind: "episodes", seasons: seasonInfo, items: episodeItems },
          { title: "Posters", kind: "gallery", collapsed: true, items: posters },
          { title: "You might also like", kind: "carousel", items: similar }
        ],
        fields: [["Type", show.type], ["Genres", show.genres], ["Status", show.status], ["Network", network], ["Country", country], ["Premiered", show.premiered], ["Ended", show.ended], ["Schedule", schedule], ["Runtime", show.runtime || show.averageRuntime ? `${show.runtime || show.averageRuntime} min` : ""], ["Language", show.language], ["Also known as", unique(akas, row => row.name).map(row => row.name).slice(0, 8)], ["Seasons", seasons.length || ""], ["Episodes", eps.length || ""], ["TVmaze rating", show.rating?.average]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- AniList: anime series and movies ----
    anilist: async (item, s) => {
      const query = `query($id:Int){Media(id:$id,type:ANIME){id title{romaji english native} synonyms description coverImage{extraLarge large} bannerImage startDate{year month day} endDate{year month day} format status episodes duration source season seasonYear averageScore popularity favourites genres tags{name rank isMediaSpoiler} siteUrl studios(isMain:true){nodes{name}} staff(perPage:6){edges{role node{name{full} image{medium} siteUrl}}} characters(perPage:10,sort:ROLE){edges{role node{name{full} image{medium} siteUrl}}} relations{edges{relationType node{title{english romaji}format startDate{year}coverImage{medium}siteUrl}}} recommendations(perPage:10,sort:RATING_DESC){nodes{mediaRecommendation{title{english romaji}format startDate{year}coverImage{medium}siteUrl}}} trailer{site id} externalLinks{site url} isAdult}}`;
      const data = await get("https://graphql.anilist.co", { ...s, method: "POST", headers: POST_JSON, body: JSON.stringify({ query, variables: { id: Number(item.providerId) } }) });
      const m = data.data?.Media; if (!m) throw new Error("AniList could not load this title.");
      const title = m.title?.english || m.title?.romaji || item.title;
      const date = d => d?.year ? [d.year, String(d.month || 1).padStart(2, "0"), String(d.day || 1).padStart(2, "0")].join("-") : "";
      const studio = (m.studios?.nodes || []).map(node => node.name);
      const card = node => ({ title: node?.title?.english || node?.title?.romaji, meta: [node?.format, node?.startDate?.year].filter(Boolean).join(" · "), image: node?.coverImage?.medium || "", url: node?.siteUrl });
      const people = edges => (edges || []).map(edge => ({ title: edge.node?.name?.full, meta: edge.role ? String(edge.role).toLowerCase().replace(/_/g, " ") : "", image: edge.node?.image?.medium || "", url: edge.node?.siteUrl }));
      const links = [{ label: "AniList", url: m.siteUrl }, ...(m.externalLinks || []).slice(0, 5).map(link => ({ label: link.site, url: link.url }))];
      if (m.trailer?.site === "youtube" && m.trailer.id) links.push({ label: "Trailer", url: `https://www.youtube.com/watch?v=${m.trailer.id}` });
      const isMovie = m.format === "MOVIE";
      return details("anilist", item, {
        title, description: m.description, image: m.coverImage?.extraLarge || m.coverImage?.large, landscapeImage: m.bannerImage, year: m.startDate?.year, rating: m.averageScore ? m.averageScore / 10 : 0, url: m.siteUrl, goal: isMovie ? 0 : (m.episodes || 0),
        trailer: m.trailer?.site === "youtube" && m.trailer.id ? { url: `https://www.youtube.com/watch?v=${m.trailer.id}`, title: "Official trailer", image: `https://img.youtube.com/vi/${m.trailer.id}/hqdefault.jpg` } : null,
        links, tags: [...(m.genres || []), ...(m.tags || []).filter(tag => !tag.isMediaSpoiler && tag.rank >= 60).map(tag => tag.name)].slice(0, 16), badge: m.isAdult ? "Adult" : "",
        watch: { runtimeMinutes: m.duration || 0, episodeCount: isMovie ? 0 : (m.episodes || 0), seasonCount: 0 },
        sections: [
          { title: "Characters", kind: "carousel", items: people(m.characters?.edges) },
          { title: "Staff", kind: "carousel", items: people(m.staff?.edges) },
          { title: "Related", kind: "carousel", items: (m.relations?.edges || []).map(edge => ({ ...card(edge.node), meta: [String(edge.relationType).toLowerCase().replace(/_/g, " "), edge.node?.startDate?.year].filter(Boolean).join(" · ") })) },
          { title: "You might also like", kind: "carousel", items: (m.recommendations?.nodes || []).map(node => card(node.mediaRecommendation)).filter(row => row.title) }
        ],
        fields: [["Format", m.format], ["Status", m.status ? String(m.status).toLowerCase().replace(/_/g, " ") : ""], ["Genres", m.genres], ["Released", date(m.startDate)], ["Ended", date(m.endDate)], ["Season", m.season ? `${String(m.season).toLowerCase()} ${m.seasonYear || ""}`.trim() : ""], ["Studio", studio], ["Source", m.source ? String(m.source).toLowerCase().replace(/_/g, " ") : ""], ["Episodes", isMovie ? "" : m.episodes], ["Runtime", m.duration ? `${m.duration} min${isMovie ? "" : " per episode"}` : ""], ["Score", m.averageScore ? `${m.averageScore}/100` : ""], ["Popularity", m.popularity ? m.popularity.toLocaleString() : ""], ["Favourites", m.favourites ? m.favourites.toLocaleString() : ""], ["Also known as", unique([m.title?.native, m.title?.romaji, ...(m.synonyms || [])].filter(name => name && name !== title), name => name.toLowerCase()).slice(0, 6)]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- TMDB: movies and series (needs a key) ----
    tmdb: async (item, s) => {
      const kind = item.category === "movie" ? "movie" : "tv";
      const d = await controller.tmdbGet(`/${kind}/${encode(item.providerId)}?append_to_response=credits,images,recommendations,external_ids,videos`, s);
      const img = (path, size = "w500") => path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
      const people = (d.credits?.cast || []).slice(0, 30).map(row => ({ title: row.name, meta: row.character ? `as ${row.character}` : "", image: img(row.profile_path, "w185"), url: `https://www.themoviedb.org/person/${row.id}` }));
      const crew = unique(d.credits?.crew || [], row => `${row.id}:${row.job}`).filter(row => /director|writer|screenplay|producer|creator|composer/i.test(row.job)).slice(0, 20).map(row => ({ title: row.name, meta: row.job, image: img(row.profile_path, "w185"), url: `https://www.themoviedb.org/person/${row.id}` }));
      const shots = (d.images?.backdrops || []).slice(0, 20).map((row, index) => ({ title: `Image ${index + 1}`, image: img(row.file_path, "w780") }));
      const similar = (d.recommendations?.results || []).slice(0, 14).map(row => ({ title: row.title || row.name, meta: String(row.release_date || row.first_air_date || "").slice(0, 4), image: img(row.poster_path, "w342"), url: `https://www.themoviedb.org/${kind}/${row.id}` }));
      const seasons = (d.seasons || []).map(row => ({ title: row.name, meta: [row.episode_count ? `${row.episode_count} episodes` : "", String(row.air_date || "").slice(0, 4)].filter(Boolean).join(" · "), image: img(row.poster_path, "w342"), url: `https://www.themoviedb.org/tv/${d.id}/season/${row.season_number}` }));
      const trailer = (d.videos?.results || []).find(row => row.site === "YouTube" && /trailer/i.test(row.type));
      const links = [{ label: "TMDB", url: `https://www.themoviedb.org/${kind}/${d.id}` }];
      if (d.external_ids?.imdb_id) links.push({ label: "IMDb", url: `https://www.imdb.com/title/${d.external_ids.imdb_id}/` });
      if (d.homepage) links.push({ label: "Official site", url: d.homepage });
      if (trailer) links.push({ label: "Trailer", url: `https://www.youtube.com/watch?v=${trailer.key}` });
      const runtime = d.runtime || d.episode_run_time?.[0] || 0;
      return details("tmdb", item, {
        title: d.title || d.name, description: d.overview, trailer: trailer ? { url: `https://www.youtube.com/watch?v=${trailer.key}`, title: trailer.name, image: `https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg` } : null, image: img(d.poster_path), landscapeImage: img(d.backdrop_path, "w1280"), year: String(d.release_date || d.first_air_date || "").slice(0, 4), rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0, ratingCount: d.vote_count, url: links[0].url, links, tags: (d.genres || []).map(row => row.name), goal: kind === "tv" ? d.number_of_episodes || 0 : 0,
        watch: { runtimeMinutes: runtime, episodeCount: d.number_of_episodes || 0, seasonCount: d.number_of_seasons || 0 },
        sections: [{ title: "Images", kind: "gallery", items: shots }, { title: "Cast", kind: "carousel", items: people }, { title: "Staff", kind: "carousel", items: crew }, { title: "Seasons", kind: "carousel", items: seasons }, { title: "You might also like", kind: "carousel", items: similar }],
        fields: [["Tagline", d.tagline], ["Status", d.status], ["Released", d.release_date || d.first_air_date], ["Last aired", d.last_air_date], ["Runtime", runtime ? `${runtime} min` : ""], ["Genres", (d.genres || []).map(row => row.name)], ["Network", (d.networks || []).map(row => row.name)], ["Studio", (d.production_companies || []).map(row => row.name)], ["Country", (d.production_countries || []).map(row => row.name)], ["Language", d.original_language], ["Seasons", d.number_of_seasons], ["Episodes", d.number_of_episodes], ["Budget", d.budget ? `$${Number(d.budget).toLocaleString()}` : ""], ["Box office", d.revenue ? `$${Number(d.revenue).toLocaleString()}` : ""]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- TheTVDB: series and movies (needs a key) ----
    tvdb: async (item, s) => {
      const kind = item.category === "movie" ? "movies" : "series";
      const d = (await controller.tvdbGet(`/${kind}/${encode(item.providerId)}/extended${kind === "series" ? "?short=true" : ""}`, s)).data || {};
      const remote = Object.fromEntries((d.remoteIds || []).map(row => [row.sourceName, row.id]));
      const people = unique(d.characters || [], row => `${row.peopleId}:${row.name}`).filter(row => row.personName).slice(0, 30).map(row => ({ title: row.personName, meta: row.name ? `as ${row.name}` : row.peopleType, image: row.personImgURL || row.image || "", url: row.peopleId ? `https://thetvdb.com/people/${row.peopleId}` : "" }));
      const shots = (d.artworks || []).filter(row => [3, 15, 16, 7, 8].includes(row.type) || /background|fanart/i.test(String(row.type))).slice(0, 20).map((row, index) => ({ title: `Image ${index + 1}`, image: row.image }));
      const seasons = (d.seasons || []).filter(row => row.type?.type === "official").map(row => ({ title: row.name || `Season ${row.number}`, meta: row.year || "", image: row.image || "", url: `https://thetvdb.com/series/${d.slug}/seasons/official/${row.number}` }));
      const links = [{ label: "TheTVDB", url: `https://thetvdb.com/${kind === "movies" ? "movies" : "series"}/${d.slug || d.id}` }];
      if (remote.IMDB) links.push({ label: "IMDb", url: `https://www.imdb.com/title/${remote.IMDB}/` });
      const runtime = d.averageRuntime || d.runtime || 0;
      return details("tvdb", item, {
        title: d.name, description: (d.translations?.overviewTranslations || []).find(row => row.language === "eng")?.overview || d.overview, image: d.image, year: String(d.year || d.first_release?.date || d.firstAired || "").slice(0, 4), rating: d.score ? Math.round(Number(d.score) / 1000) / 10 : 0, url: links[0].url, links, tags: (d.genres || []).map(row => row.name),
        watch: { runtimeMinutes: runtime, episodeCount: 0, seasonCount: seasons.length },
        sections: [{ title: "Images", kind: "gallery", items: shots }, { title: "Cast", kind: "carousel", items: people }, { title: "Seasons", kind: "carousel", items: seasons }],
        fields: [["Status", d.status?.name], ["First aired", d.firstAired], ["Last aired", d.lastAired], ["Runtime", runtime ? `${runtime} min` : ""], ["Genres", (d.genres || []).map(row => row.name)], ["Network", d.originalNetwork?.name], ["Country", d.originalCountry], ["Language", d.originalLanguage], ["Also known as", (d.aliases || []).map(row => row.name).slice(0, 8)]].map(([label, value]) => ({ label, value }))
      });
    },

    // ---- IMDb and Rotten Tomatoes: unofficial, read from the public page's structured data ----
    imdb: async (item, s) => {
      const id = String(item.providerId), page = await controller.sourceText("imdb", `https://www.imdb.com/title/${encode(id)}/`, s, { noCache: true }).catch(error => { throw new Error(error?.status === 403 || error?.status === 202 ? "IMDb blocked this request. Add a browser cookie or user agent on the source page." : error?.message || "IMDb could not be reached."); });
      const ld = ldJson(page), person = row => (Array.isArray(row) ? row : row ? [row] : []).map(entry => ({ title: entry.name, url: entry.url ? `https://www.imdb.com${entry.url}` : "" })).filter(entry => entry.title);
      if (!ld) throw new Error("IMDb answered with a bot check instead of the title page. Add a browser cookie or user agent on the source page, or use TMDB/OMDb for details.");
      return details("imdb", item, {
        title: ld.name, description: ld.description, image: ld.image, year: String(ld.datePublished || "").slice(0, 4), rating: ld.aggregateRating?.ratingValue, ratingCount: ld.aggregateRating?.ratingCount, url: `https://www.imdb.com/title/${id}/`, links: [{ label: "IMDb", url: `https://www.imdb.com/title/${id}/` }], tags: toList(ld.genre), badge: ld.contentRating,
        watch: { runtimeMinutes: isoMinutes(ld.duration) },
        sections: [{ title: "Cast", kind: "carousel", items: person(ld.actor) }, { title: "Staff", kind: "carousel", items: [...person(ld.director).map(row => ({ ...row, meta: "Director" })), ...person(ld.creator).filter(row => row.title).map(row => ({ ...row, meta: "Creator" }))] }],
        fields: [["Released", ld.datePublished], ["Runtime", isoMinutes(ld.duration) ? `${isoMinutes(ld.duration)} min` : ""], ["Genres", toList(ld.genre)], ["Keywords", toList(ld.keywords).slice(0, 10)]].map(([label, value]) => ({ label, value }))
      });
    },
    rottentomatoes: async (item, s) => {
      const path = String(item.providerId).startsWith("/") ? String(item.providerId) : `/${item.providerId}`;
      const page = await controller.sourceText("rottentomatoes", `https://www.rottentomatoes.com${path}`, s, { noCache: true }).catch(error => { throw new Error(error?.status === 403 ? "Rotten Tomatoes blocked this request. Add a browser cookie or user agent on the source page." : error?.message || "Rotten Tomatoes could not be reached."); });
      const ld = ldJson(page); if (!ld) throw new Error("Rotten Tomatoes did not return readable details for this title.");
      const score = name => page.match(new RegExp(`${name}score="(\\d+)"`, "i"))?.[1] || "";
      const critics = score("tomatometer") || ld.aggregateRating?.ratingValue || "", audience = score("audience");
      const person = rows => (Array.isArray(rows) ? rows : rows ? [rows] : []).map(entry => ({ title: entry.name, url: entry.sameAs || "" })).filter(entry => entry.title);
      return details("rottentomatoes", item, {
        title: ld.name, description: ld.description, image: ld.image, year: String(ld.dateCreated || "").slice(0, 4), rating: critics ? Math.round(Number(critics)) / 10 : 0, url: `https://www.rottentomatoes.com${path}`, links: [{ label: "Rotten Tomatoes", url: `https://www.rottentomatoes.com${path}` }], tags: toList(ld.genre), badge: ld.contentRating,
        sections: [{ title: "Cast", kind: "carousel", items: person(ld.actor || ld.actors) }, { title: "Staff", kind: "carousel", items: [...person(ld.director || ld.directors).map(row => ({ ...row, meta: "Director" })), ...person(ld.producer).map(row => ({ ...row, meta: "Producer" }))] }],
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
      const breakdown = ratings.map(row => ({ label: row.Source.replace("Internet Movie Database", "IMDb"), percent: /%/.test(row.Value) ? numberFrom(row.Value) : /\/10$/.test(row.Value) ? numberFrom(row.Value) * 10 : /\/100$/.test(row.Value) ? numberFrom(row.Value) : 0 }));
      const cast = toList(na(d.Actors)).map(name => ({ title: name, meta: "", image: "" }));
      return details("omdb", item, {
        title: d.Title, description: na(d.Plot), image: na(d.Poster), year: na(d.Year).slice(0, 4), rating: na(d.imdbRating) ? Number(d.imdbRating) : 0, url: `https://www.imdb.com/title/${d.imdbID}/`,
        links: [{ label: "IMDb", url: `https://www.imdb.com/title/${d.imdbID}/` }, ...(na(d.Website) ? [{ label: "Website", url: d.Website }] : [])],
        tags: toList(na(d.Genre)), badge: na(d.Rated) ? `Rated ${d.Rated}` : "", ratingBreakdown: breakdown, ratingCount: numberFrom(na(d.imdbVotes)),
        watch: { runtimeMinutes: runtime, episodeCount: 0, seasonCount: seasons }, sections: [{ title: "Cast", kind: "list", collapsed: true, items: cast }],
        fields: [["Type", na(d.Type)], ["Released", na(d.Released)], ["Runtime", runtime ? `${runtime} min` : ""], ["Genres", na(d.Genre)], ["Director", na(d.Director)], ["Writer", na(d.Writer)], ["Language", na(d.Language)], ["Country", na(d.Country)], ["Awards", na(d.Awards)], ["Metascore", na(d.Metascore)], ["Rotten Tomatoes", rotten || ""], ["IMDb votes", na(d.imdbVotes)], ["Seasons", seasons || ""], ["Box office", na(d.BoxOffice)], ["Production", na(d.Production)]].map(([label, value]) => ({ label, value }))
      });
    }
  };
  function unique(list, keyOf) { const seen = new Set(); return list.filter(entry => { const key = keyOf(entry); if (key == null || key === "" || seen.has(key)) return false; seen.add(key); return true; }); }


  // In-app TVmaze pages opened from cast, characters, staff, episodes and suggestions.
  const idFromHref = href => String(href || "").match(/\/(\d+)(?:\?|$)/)?.[1] || "";
  const showCard = show => ({ id: show.id, title: show.name, meta: [show.premiered?.slice(0, 4), show.rating?.average ? `★ ${show.rating.average}` : ""].filter(Boolean).join(" · "), image: show.image?.medium || show.image?.original || "", year: show.premiered?.slice(0, 4) || "", description: clean(show.summary), url: show.url });
  const loadRef = async (ref, settings = {}) => {
    const base = "https://api.tvmaze.com", id = encode(ref.id);
    if (ref.type === "person") {
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
      const [ep, guestCast, guestCrew] = await Promise.all([get(`${base}/episodes/${id}?embed=show`, settings), get(`${base}/episodes/${id}/guestcast?embed[]=person&embed[]=character`, settings).catch(() => []), get(`${base}/episodes/${id}/guestcrew?embed=person`, settings).catch(() => [])]);
      const parent = ep._embedded?.show;
      const asRef = person => person?.id ? { type: "person", id: person.id, title: person.name } : null;
      const guests = unique(guestCast, row => `${row.person?.id}:${row.character?.id}`).map(row => ({ title: row.person?.name, meta: row.character?.name ? `as ${row.character.name}` : "", image: row.person?.image?.medium || "", url: row.person?.url, ref: asRef(row.person) }));
      const crewRows = unique(guestCrew, row => `${row.person?.id}:${row.type}`).map(row => ({ title: row.person?.name, meta: row.type, image: row.person?.image?.medium || "", url: row.person?.url, ref: asRef(row.person) }));
      return { type: "episode", title: ep.name, subtitle: `${parent?.name ? `${parent.name} · ` : ""}S${ep.season}E${ep.number}`, image: ep.image?.original || ep.image?.medium || parent?.image?.original || "", landscape: !!ep.image, url: ep.url, description: clean(ep.summary),
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
      return details(source.key, item, { title: text(map.title) || item.title, description: text(map.description) || item.description, image: text(map.image) || item.image, year: text(map.released).slice(0, 4) || item.year, rating: Number(text(map.rating)) || item.rating, url: text(map.url) || item.url, goal: episodes || item.goal, sections: shots.length ? [{ title: "Images", kind: "gallery", items: shots }] : [], tags: list(map.tags), links: item.url ? [{ label: `Open on ${source.name}`, url: item.url }] : [], watch: { runtimeMinutes: runtime, episodeCount: episodes, seasonCount: numberFrom(text(map.seasons)) }, fields: [["Released", text(map.released)], ["Genres", list(map.genres)], ["Director", list(map.directors)], ["Cast", list(map.cast)], ["Network", text(map.network)], ["Runtime", runtime ? `${runtime} min` : ""], ["Episodes", episodes || ""], ["Seasons", text(map.seasons)], ["Language", text(map.language)], ["Country", text(map.country)], ["Awards", text(map.awards)]].map(([label, value]) => ({ label, value })) });
    }
    if (!source || typeof loaders[source.key] !== "function") throw new Error(`This ${appKey} app does not support ${item.metadataSource} details for ${item.category}.`);
    if (!metadata.isEnabled(source.key, settings)) throw new Error(`${source.name} is disabled in Metadata Sources.`);
    const id = String(item.providerId);
    const normalizedItem = id.startsWith(`${source.key}:`) ? { ...item, providerId: id.slice(source.key.length + 1) } : item;
    return loaders[source.key](normalizedItem, settings);
  };
  window.SplitAppDetailController = Object.freeze({ appKey, load, loadRef });
})();
