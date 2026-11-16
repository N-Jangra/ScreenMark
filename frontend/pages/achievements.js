// Achievement tiers are derived from local watch progress and work offline.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  const BADGES = [
    ["first-title", "Opening credits", "Start a watchlist with a story worth following.", m => m.titles, "titles", [[1, "Pilot", 50], [10, "Season regular", 100], [50, "Showrunner", 250]]],
    ["movie-fan-5", "Movie night", "Make every screening count.", m => m.moviesDone, "movies", [[1, "Matinee", 50], [5, "Double feature", 125], [25, "Festival pass", 250]]],
    ["series-fan-5", "Season regular", "Keep watching through the finale.", m => m.seriesDone, "series", [[1, "New episode", 50], [5, "Binge watcher", 125], [25, "Complete run", 250]]],
    ["episode-25", "Episode explorer", "Every episode moves the story forward.", m => m.episodes, "episodes", [[25, "First season", 75], [100, "Binge mode", 175], [500, "TV historian", 300]]],
    ["favorite-five", "Personal canon", "Save the stories you would watch again.", m => m.favorites, "favorites", [[1, "First pick", 50], [5, "Curator", 125], [25, "Hall of fame", 250]]],
    ["movie-reel", "Movie archive", "Build a collection for every kind of movie night.", m => m.movies, "movies collected", [[1, "First screening", 50], [10, "Double-digit cinema", 125], [50, "Personal archive", 275]]],
    ["series-shelf", "Series shelf", "Save shows you want to follow from pilot to finale.", m => m.series, "series collected", [[1, "Pilot picked", 50], [10, "Seasoned viewer", 125], [50, "Show library", 275]]],
    ["season-finale", "Season finale", "Finish every episode in a season.", m => m.seasonsDone, "seasons completed", [[1, "Final episode", 75], [5, "Season closer", 175], [25, "Finale legend", 325]]],
    ["genre-passport", "Genre passport", "Travel through very different kinds of stories.", m => m.genres, "genres", [[3, "Curious viewer", 50], [8, "Story traveller", 125], [15, "Genre explorer", 275]]],
    ["source-sampler", "Source sampler", "Discover titles from different catalogues.", m => m.sources, "catalogue sources", [[2, "Two channels", 50], [4, "Source scout", 125], [8, "Wide receiver", 275]]],
    ["year-hopper", "Time traveller", "Watch stories from across the decades.", m => m.years, "release years", [[3, "Across time", 50], [8, "Decade hopper", 125], [15, "Time traveller", 275]]],
    ["art-collector", "Frame collector", "Build a watchlist with cover art to match.", m => m.art, "titles with artwork", [[1, "First frame", 50], [10, "Gallery wall", 125], [50, "Art house", 275]]],
    ["binge-master", "Binge master", "Keep going, one episode at a time.", m => m.episodes, "episodes watched", [[1000, "Long weekend", 75], [5000, "Binge master", 175], [10000, "Television titan", 325]]],
    ["loved-finished", "Loved and finished", "Finish the stories you marked as favourites.", m => m.favoriteDone, "favourites finished", [[1, "Worth the watch", 75], [5, "Heart of gold", 175], [20, "Cherished classics", 300]]],
    ["series-starter", "Series starter", "Start watching more than one show.", m => m.seriesStarted, "series started", [[1, "Episode one", 50], [10, "Many shows deep", 125], [25, "Watch-everything", 275]]],
    ["marathon-run", "Marathon run", "Go deep on a single series.", m => m.longestSeries, "episodes in one series", [[10, "Hooked", 75], [50, "Long runner", 175], [150, "Saga survivor", 325]]],
    ["double-feature", "Double life", "Balance movies and series in one library.", m => Math.min(m.movies, m.series), "of each kind", [[1, "Both worlds", 50], [5, "Balanced diet", 125], [20, "Screen all-rounder", 275]]],
    ["new-release", "Fresh premiere", "Keep up with recent releases.", m => m.recent, "recent titles", [[1, "Just out", 50], [5, "Trend watcher", 125], [20, "Premiere regular", 275]]],
    ["classic-collector", "Classic collector", "Preserve the older favourites.", m => m.classics, "pre-2000 titles", [[1, "Golden age", 50], [5, "Classic taste", 125], [20, "Film historian", 275]]],
    ["decade-diver", "Decade diver", "Spread your library across decades.", m => m.decades, "decades", [[2, "Two eras", 50], [4, "Era hopper", 125], [7, "Every decade", 275]]],
    ["grand-library", "Grand library", "Build a watchlist that never runs dry.", m => m.titles, "titles saved", [[50, "Packed queue", 100], [150, "Media vault", 200], [400, "Endless catalogue", 350]]],
    ["show-closer", "Show closer", "Finish whole series, start to end.", m => m.seriesDone, "series completed", [[10, "Season sealer", 100], [30, "Series survivor", 200], [75, "Finale veteran", 350]]],
    ["cinema-buff", "Cinema buff", "Make a habit of finishing movies.", m => m.moviesDone, "movies watched", [[50, "Regular", 100], [150, "Cinephile", 200], [400, "Projectionist", 350]]],
    ["completionist", "Completionist", "Finish a big share of your library.", m => m.titles >= 10 ? Math.floor(m.completed / m.titles * 100) : 0, "% finished (10+ titles)", [[25, "Quarter clear", 75], [50, "Halfway hero", 175], [75, "True completionist", 325]]],
    ["genre-loyalist", "Genre loyalist", "Find a genre you keep coming back to.", m => m.topGenre, "titles in one genre", [[5, "Favourite flavour", 75], [20, "Genre devotee", 175], [50, "Genre master", 325]]],
    ["favorite-vault", "Favourite vault", "Grow a shelf of all-time favourites.", m => m.favorites, "favourites", [[50, "Treasure shelf", 100], [100, "Vault of legends", 200], [200, "Hall of heroes", 350]]],
    ["season-collector", "Season collector", "Finish seasons by the dozen.", m => m.seasonsDone, "seasons completed", [[50, "Season hoarder", 100], [100, "Season veteran", 200], [250, "Season legend", 350]]],
    ["long-runner-fan", "Long-runner fan", "Stick with shows that never end.", m => m.longSeries, "series with 50+ episodes watched", [[1, "In for the long haul", 75], [5, "Endless viewer", 175], [15, "Never-ending fan", 325]]],
    ["endgame", "Endgame", "Finish a huge number of stories.", m => m.completed, "titles finished", [[150, "Veteran", 150], [300, "Elite finisher", 250], [500, "Endgame legend", 400]]],
    ["pilot-hunter", "Pilot hunter", "Sample pilots from many different shows.", m => m.seriesStarted, "series started", [[50, "Pilot sampler", 100], [100, "Pilot hunter", 200], [250, "Pilot machine", 350]]],
    ["genre-cartographer", "Genre cartographer", "Map out every corner of storytelling.", m => m.genres, "genres and tags", [[25, "Wide taste", 150], [50, "World mapper", 250], [100, "Atlas complete", 400]]],
    ["cover-wall", "Cover wall", "Fill your library with artwork.", m => m.art, "titles with artwork", [[100, "Gallery wall", 150], [250, "Museum floor", 250], [500, "Grand exhibition", 400]]],
    ["time-machine", "Time machine", "Collect stories from across the years.", m => m.years, "release years", [[25, "Time skipper", 150], [50, "Era collector", 250], [80, "Every year", 400]]],
    ["film-library", "Film library", "Build a serious movie collection.", m => m.movies, "movies collected", [[100, "Reel stack", 150], [250, "Film vault", 250], [500, "Cinema archive", 400]]],
    ["series-library", "Series library", "Build a serious show collection.", m => m.series, "series collected", [[100, "Box-set shelf", 150], [250, "Show vault", 250], [500, "Television archive", 400]]],
    ["story-finisher", "Story finisher", "Bring more complete stories to your library.", m => m.completed, "finished titles", [[10, "Closing credits", 75], [50, "Seasoned finisher", 175], [100, "Story finisher", 325]]]
  ];
  const metrics = (items, roles = {}) => {
    const titles = items.filter(item => ["movie", "series"].includes(item.category)), doneStatus = roles.done || "Completed";
    let episodes = 0, seasonsDone = 0, longestSeries = 0, seriesStarted = 0, longSeries = 0;
    titles.filter(item => item.category === "series").forEach(item => {
      const ids = new Set((item.watchedEpisodeIds || []).map(String)), info = window.SplitAppLibrary?.episodeInfo?.(item);
      const watched = Math.max(ids.size, Number(info?.done) || 0, Number(item.progress) || 0);
      episodes += watched; longestSeries = Math.max(longestSeries, watched); if (watched > 0) seriesStarted++; if (watched >= 50) longSeries++;
      if (info?.eps?.length) {
        const seasons = new Map();
        info.eps.forEach(ep => { const list = seasons.get(ep.season) || []; list.push(ep); seasons.set(ep.season, list); });
        for (const list of seasons.values()) if (list.length && list.every(ep => info.watched.has(String(ep.id)))) seasonsDone++;
      }
    });
    const moviesDone = titles.filter(item => item.category === "movie" && (item.status === doneStatus || (Number(item.goal) > 0 && Number(item.progress) >= Number(item.goal)))).length;
    const seriesDone = titles.filter(item => item.category === "series" && (item.status === doneStatus || (() => { const info = window.SplitAppLibrary?.episodeInfo?.(item); return Number(info?.total) > 0 && Number(info?.done) >= Number(info.total); })())).length;
    const labels = value => (Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;|]/) : []).map(row => String(row?.name || row?.label || row || "").trim()).filter(Boolean);
    const genres = new Set(titles.flatMap(item => [...labels(item.genres), ...labels(item.genre), ...labels(item.tags), ...labels(item.cachedDetails?.genres), ...labels(item.cachedDetails?.tags)]).map(value => value.toLocaleLowerCase()));
    const sources = new Set(titles.map(item => String(item.metadataSource || item.source || item.provider || "").trim().toLocaleLowerCase()).filter(Boolean));
    const years = new Set(titles.map(item => String(item.year || item.releaseDate || item.cachedDetails?.year || "").match(/(?:19|20)\d{2}/)?.[0]).filter(Boolean));
    const art = titles.filter(item => item.image || item.customCover || item.backdrop || item.localThumbnailData || item.localPortraitData || item.cachedDetails?.portraitImage).length;
    const yearOf = item => Number(String(item.year || item.releaseDate || item.cachedDetails?.year || "").match(/(?:19|20)\d{2}/)?.[0]) || 0, thisYear = new Date().getFullYear();
    const favoriteDone = titles.filter(item => item.favorite && (item.status === doneStatus || (item.category === "movie" && Number(item.goal) > 0 && Number(item.progress) >= Number(item.goal)))).length;
    const genreCounts = new Map(); titles.forEach(item => new Set([...labels(item.genres), ...labels(item.genre), ...labels(item.tags), ...labels(item.cachedDetails?.genres)].map(v => v.toLocaleLowerCase())).forEach(g => genreCounts.set(g, (genreCounts.get(g) || 0) + 1)));
    return { topGenre: Math.max(0, ...genreCounts.values()), favoriteDone, recent: titles.filter(item => yearOf(item) >= thisYear - 1).length, classics: titles.filter(item => yearOf(item) && yearOf(item) < 2000).length, decades: new Set(titles.map(item => Math.floor(yearOf(item) / 10)).filter(Boolean)).size, titles: titles.length, movies: titles.filter(item => item.category === "movie").length, series: titles.filter(item => item.category === "series").length, moviesDone, seriesDone,
      completed: moviesDone + seriesDone, episodes, seasonsDone, longestSeries, seriesStarted, longSeries, genres: genres.size, sources: sources.size, years: years.size, art,
      favorites: titles.filter(item => item.favorite).length, rated: titles.filter(item => Number(item.rating) > 0 || Number(item.facts?.rating) > 0).length };
  };
  // ---- Flat achievements: every rank of every badge is its own achievement, grouped into categories. ----
  const GROUPS = [
    ["collection", "Collection", "Build a watchlist full of movies and series.", ["first-title", "movie-reel", "series-shelf", "grand-library", "film-library", "series-library", "double-feature"]],
    ["watching", "Watching", "Every episode counts. Keep the screen glowing.", ["episode-25", "binge-master", "series-starter", "marathon-run", "long-runner-fan", "pilot-hunter", "season-collector"]],
    ["finishing", "Finishing", "Roll the credits on movies, seasons and whole series.", ["movie-fan-5", "series-fan-5", "season-finale", "show-closer", "cinema-buff", "completionist", "endgame", "story-finisher", "loved-finished"]],
    ["taste", "Favourites", "Keep the stories you love close.", ["favorite-five", "favorite-vault"]],
    ["discovery", "Discovery", "Explore genres, eras and catalogues.", ["genre-passport", "source-sampler", "year-hopper", "decade-diver", "genre-loyalist", "genre-cartographer", "time-machine", "new-release", "classic-collector"]],
    ["artwork", "Artwork", "Give every title a face.", ["art-collector", "cover-wall"]]
  ];
  const META_GROUPS = [
    ["medals", "Medal Kings", "Collect every bronze, silver and gold medal."],
    ["collector", "Badge Collector", "Grow your total number of unlocked achievements."],
    ["levels", "Levels & Ranks", "Climb the level ladder and master whole badge families."]
  ];
  const ALL_GROUPS = [...GROUPS.map(([id, title, blurb]) => [id, title, blurb]), ...META_GROUPS];
  const GROUP_OF = new Map(GROUPS.flatMap(([gid, , , ids]) => ids.map(id => [id, gid])));
  const MEDALS = [["bronze", "Bronze"], ["silver", "Silver"], ["gold", "Gold"]];
  const RARITY = { bronze: "Common", silver: "Rare", gold: "Epic", special: "Legendary" };
  const REWARD = { bronze: 50, silver: 150, gold: 300, special: 500 };
  const LEVEL_XP = 500;
  const STORE = "screenmark";
  const DATES_KEY = `${STORE}_achievement_dates_v1`;
  const LEVEL_NAMES = "Extra|Ticket Holder|Matinee Goer|Usher|Popcorn Regular|Front Row Viewer|Trailer Watcher|Pilot Viewer|Weeknight Watcher|Binge Beginner|Season Starter|Box-Set Buff|Credits Reader|Cliffhanger Survivor|Plot Twist Spotter|Film Club Member|Marathon Runner|Director's Cut Fan|Screening Regular|Critic in Training|Festival Goer|Series Specialist|Premiere Guest|Script Reader|Story Scholar|Casting Director|Cinematographer|Showrunner's Pick|Awards Voter|Cinephile|Archive Keeper|Season Sage|Finale Veteran|Studio Insider|Curator of Screens|Executive Producer|Festival Jury|Film Historian|Screen Legend|Grand Cinephile|Hall of Fame|Living Archive|Master of the Medium|Icon of the Screen|Eternal Watcher|Golden Reel|Platinum Premiere|Legend of the Lounge|Beyond the Credits|Infinite Binge|Director of Dreams".split("|");
  // Military-style insignia: c = chevrons, r = rockers, s = stars, b = bars.
  const INSIGNIA = [[1, "c1"], [5, "c2"], [10, "c3"], [15, "c3r1"], [20, "c3r2"], [25, "c3r3"], [30, "s1c3"], [35, "s2c3"], [40, "B1"], [42, "O1"], [44, "T3"], [46, "D4"], [48, "P5"], [50, "O1k"]];
  const insigniaSpec = level => INSIGNIA.reduce((spec, [from, value]) => level >= from ? value : spec, "c1");
  const starPoints = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; return `${(cx + d * Math.cos(a)).toFixed(1)},${(cy + d * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const insignia = (spec, paint = "currentColor") => {
    if (/^[BOTDP]\d/.test(spec)) {
      const kind = spec[0], crown = spec.includes("k"), star = (x, y, R) => `<polygon points="${starPoints(x, y, R, R * 0.46)}" fill="${paint}" stroke="${paint}" stroke-width="2" stroke-linejoin="round"/>`;
      if (kind === "B") return star(48, 50, 25);
      if (kind === "T") return star(48, 33, 14) + star(32, 62, 14) + star(64, 62, 14);
      if (kind === "D") return star(48, 28, 12) + star(48, 72, 12) + star(26, 50, 12) + star(70, 50, 12);
      if (kind === "P") return Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return star(48 + 25 * Math.cos(a), 52 + 25 * Math.sin(a), 12); }).join("");
      const cy = crown ? 58 : 50, r = crown ? 23 : 28;
      return `<circle cx="48" cy="${cy}" r="${r}" fill="none" stroke="${paint}" stroke-width="5"/>${star(48, cy, r - 9)}${crown ? `<polygon points="35,28 33,15 41,21 48,10 55,21 63,15 61,28" fill="${paint}" stroke="${paint}" stroke-width="1.5" stroke-linejoin="round"/>` : ""}`;
    }
    const n = letter => Number((String(spec).match(new RegExp(`${letter}(\\d)`)) || [])[1]) || 0, stars = n("s"), chevrons = n("c"), rockers = n("r"), bars = n("b");
    const parts = [[stars, 16, y => { const gap = 16, x0 = 48 - (stars - 1) * gap / 2; return Array.from({ length: stars }, (_, i) => `<polygon points="${starPoints(x0 + i * gap, y + 8, 8, 3.4)}" fill="${paint}"/>`).join(""); }],
      [chevrons, (chevrons - 1) * 11 + 10, y => Array.from({ length: chevrons }, (_, i) => `<polyline points="29,${y + i * 11 + 10} 48,${y + i * 11} 67,${y + i * 11 + 10}" fill="none" stroke="${paint}" stroke-width="5.5" stroke-linejoin="miter" stroke-linecap="butt"/>`).join("")],
      [rockers, (rockers - 1) * 9 + 8, y => Array.from({ length: rockers }, (_, i) => `<path d="M29 ${y + i * 9} Q48 ${y + i * 9 + 11} 67 ${y + i * 9}" fill="none" stroke="${paint}" stroke-width="4"/>`).join("")],
      [bars, (bars - 1) * 11 + 6, y => Array.from({ length: bars }, (_, i) => `<rect x="27" y="${y + i * 11}" width="42" height="6" rx="1" fill="${paint}"/>`).join("")]].filter(part => part[0]);
    const total = parts.reduce((sumH, part) => sumH + part[1], 0) + (parts.length - 1) * 6;
    let y = 48 - total / 2;
    return parts.map(([, height, draw]) => { const out = draw(y); y += height + 6; return out; }).join("");
  };
  const levelName = level => LEVEL_NAMES[level - 1] || `Level ${level}`;
  const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);
  const readDates = () => { try { const value = JSON.parse(localStorage.getItem(DATES_KEY) || "null"); return value && typeof value === "object" ? value : null; } catch (_) { return null; } };

  const baseRows = (items, roles) => {
    const values = metrics(items, roles), rows = [];
    BADGES.forEach(([family, familyTitle, description, metric, unit, tiers]) => {
      const current = Math.max(0, Number(metric(values)) || 0);
      tiers.forEach(([target, title, xp], index) => rows.push({
        id: `${family}-t${index + 1}`, family, familyTitle, group: GROUP_OF.get(family) || GROUPS[0][0], title, description,
        unit, current, target, xp, tier: MEDALS[index][0], kind: "badge", rank: index + 1, ranks: tiers.length, legacyId: `${family}:${target}`,
        unlocked: current >= target
      }));
    });
    return rows;
  };

  const context = (base, level) => {
    const tierCount = (tier, onlyDone) => base.filter(row => row.tier === tier && (!onlyDone || row.unlocked)).length;
    const families = new Map();
    base.forEach(row => { const f = families.get(row.family) || { n: 0, d: 0 }; f.n++; if (row.unlocked) f.d++; families.set(row.family, f); });
    return { done: base.filter(row => row.unlocked).length, total: base.length, level, bronze: tierCount("bronze", true), bronzeTotal: tierCount("bronze"), silver: tierCount("silver", true), silverTotal: tierCount("silver"),
      gold: tierCount("gold", true), goldTotal: tierCount("gold"), maxed: [...families.values()].filter(f => f.n === f.d).length, familyTotal: families.size };
  };

  const metaRows = (c) => {
    const out = [], add = (id, group, title, description, unit, current, target, tier, glyph, label) => out.push({ id, family: id, familyTitle: title, group, title, description, unit, current, target, xp: REWARD[tier], tier, kind: "meta", glyph, label, rank: 1, ranks: 1, legacyId: `${id}:${target}`, unlocked: current >= target });
    MEDALS.forEach(([key, label]) => {
      const total = c[`${key}Total`], lower = label.toLowerCase();
      const targets = [...new Set([Math.min(3, total), Math.min(10, total), total])].filter(t => t > 0);
      targets.forEach((target, i) => {
        const king = i === targets.length - 1;
        add(`medal-${key}-${i + 1}`, "medals", king ? `${label} King` : `${label} ${i === 0 ? "Starter" : "Collector"}`, king ? `Earn every ${lower} badge. The full ${label} set is yours.` : `Earn ${target} ${lower} badges.`, `${lower} badges`, c[key], target, key, king ? "crown" : "medal", String(target));
      });
    });
    const COLLECT = [[1, "First Badge"], [10, "Ten Strong"], [25, "Quarter Century"], [50, "Half Century"], [75, "Three Quarters"], [100, "Centurion"], [150, "Badge Baron"], [200, "Overachiever"]].filter(([target]) => target < c.total);
    COLLECT.forEach(([target, title], i) => add(`collect-${target}`, "collector", title, target === 1 ? "Unlock your very first achievement." : `Unlock ${target} achievements in total.`, "achievements", c.done, target, ["bronze", "bronze", "silver", "silver", "gold", "gold", "special", "special"][i], "laurel", String(target)));
    add("collect-all", "collector", "Collection Complete", "Unlock every single achievement. Nothing left to chase.", "achievements", c.done, c.total, "special", "crown", "laurel");
    [[1, "Rank Up"], [5, "Rank Climber"], [10, "Rank Master"], [20, "Rank Legend"]].filter(([target]) => target < c.familyTotal).forEach(([target, title], i) => add(`maxed-${target}`, "levels", title, `Reach the top rank of ${target} different badge${target === 1 ? "" : "s"}.`, "badges at top rank", c.maxed, target, ["bronze", "silver", "gold", "special"][i], "ins", ["b1", "b2", "b3", "b4"][i]));
    add("maxed-all", "levels", "Maxed Out", "Reach the top rank of every badge family.", "badges at top rank", c.maxed, c.familyTotal, "special", "ins", "s1b3");
    [2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].forEach(n => add(`level-${n}`, "levels", levelName(n), `Reach level ${n} and earn the rank of ${levelName(n)}.`, "level", c.level, n, n <= 10 ? "bronze" : n <= 25 ? "silver" : n <= 40 ? "gold" : "special", "ins", insigniaSpec(n)));
    return out;
  };

  const entries = (items, roles = {}) => {
    const base = baseRows(items, roles), dates = readDates() || {};
    let level = 1 + Math.floor(sum(base.filter(row => row.unlocked), row => row.xp) / LEVEL_XP), meta = metaRows(context(base, level));
    for (let i = 0; i < 8; i++) {
      const next = 1 + Math.floor(sum([...base, ...meta].filter(row => row.unlocked), row => row.xp) / LEVEL_XP);
      if (next === level) break;
      level = next; meta = metaRows(context(base, level));
    }
    return [...base, ...meta].map(row => {
      const asset = `icons/achievement-badges/${row.id}.svg`, unlockedAt = row.unlocked ? Number(dates[row.id]) || 0 : 0;
      return { ...row, asset, unlockedAt, rarity: RARITY[row.tier], percent: row.unlocked ? 100 : Math.min(99, Math.floor(row.current / Math.max(1, row.target) * 100)),
        name: row.title, level: row.unlocked ? 1 : 0, earned: row.unlocked ? [{ id: row.legacyId, name: row.title, target: row.target, xp: row.xp, asset }] : [] };
    });
  };
  const progression = rows => {
    const xp = sum(rows.filter(row => row.unlocked), row => row.xp), level = 1 + Math.floor(xp / LEVEL_XP), intoLevel = xp % LEVEL_XP;
    return { xp, level, intoLevel, name: levelName(level), nextName: levelName(level + 1), nextLevelXp: LEVEL_XP, percent: Math.round(intoLevel / LEVEL_XP * 100), earned: rows.filter(row => row.unlocked).length, total: rows.length };
  };
  const recent = (rows, count = 3) => rows.filter(row => row.unlocked).map((row, index) => ({ row, index })).sort((a, b) => (b.row.unlockedAt - a.row.unlockedAt) || (b.index - a.index)).slice(0, count).map(entry => entry.row);
  const unlocks = (items, roles) => entries(items, roles).filter(row => row.unlocked).map(row => ({ id: row.legacyId, name: row.title, target: row.target, xp: row.xp, asset: row.asset, title: row.familyTitle, badgeId: `a-${row.id}` }));
  const stamp = (items, roles) => {
    try {
      const had = readDates(), dates = had || {}; let changed = !had;
      entries(items, roles).filter(row => row.unlocked).forEach(row => { if (!(row.id in dates)) { dates[row.id] = had ? Date.now() : 0; changed = true; } });
      if (changed) localStorage.setItem(DATES_KEY, JSON.stringify(dates));
    } catch (_) {}
  };
  const levelTable = maxLevel => Array.from({ length: maxLevel }, (_, i) => ({ level: i + 1, name: levelName(i + 1), xp: i * LEVEL_XP }));

  // ---- Rendering ----
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const ring = (percent, level = 1) => `<svg class="achievement-level-ring" viewBox="0 0 100 112" aria-hidden="true"><defs><linearGradient id="lvg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff2a6"/><stop offset=".5" stop-color="#f1b01f"/><stop offset="1" stop-color="#b86f00"/></linearGradient><linearGradient id="lvf" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#2b2f66"/><stop offset="1" stop-color="#0a0c1e"/></linearGradient></defs><polygon points="50.0,10.0 89.8,33.0 89.8,79.0 50.0,102.0 10.2,79.0 10.2,33.0" class="ring-track" pathLength="100"/><polygon points="50.0,17.0 83.8,36.5 83.8,75.5 50.0,95.0 16.2,75.5 16.2,36.5" fill="url(#lvf)"/><g transform="translate(50 50) scale(.78) translate(-48 -48)">${insignia(insigniaSpec(level), "#f6d56b")}</g><polygon points="50.0,10.0 89.8,33.0 89.8,79.0 50.0,102.0 10.2,79.0 10.2,33.0" class="ring-bar" pathLength="100" stroke-dasharray="${Math.max(0.1, percent)} 100"/></svg>`;
  const LOCK = `<svg class="level-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Locked"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
  const dateText = row => row.unlockedAt > 0 ? new Date(row.unlockedAt).toLocaleDateString() : "";
  const requirement = row => `${Number(row.target).toLocaleString()} ${row.unit}`;
  const sub = row => row.unlocked ? (dateText(row) || "Unlocked") : row.current > 0 ? `${Math.floor(row.current).toLocaleString()}/${requirement(row)}` : requirement(row);
  const artImg = (row, cls, size) => `<span class="ach-art-wrap ${cls}-wrap"><img class="${cls}${row.unlocked ? "" : " is-locked"}" src="${row.asset}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" onload="this.parentNode.classList.add('is-ready')" onerror="this.parentNode.classList.add('is-ready')"></span>`;
  const tile = row => `<a class="ach-badge is-${row.tier} ${row.unlocked ? "is-unlocked" : "is-locked"}" href="#achievements/a-${row.id}" aria-label="${esc(row.title)}, ${row.unlocked ? "unlocked" : "locked"}">${artImg({ asset: row.asset, unlocked: true }, "ach-badge-art", 96)}<strong>${esc(row.title)}</strong><small>${esc(sub(row))}</small>${!row.unlocked && row.current > 0 ? `<span class="ach-tier-bar"><i style="width:${row.percent}%"></i></span>` : ""}</a>`;
  const groupRows = (rows, id) => rows.filter(row => row.group === id);
  const featured = list => [...list.filter(row => row.unlocked).sort((a, b) => b.unlockedAt - a.unlockedAt), ...list.filter(row => !row.unlocked).sort((a, b) => b.percent - a.percent)];
  const head = (back, title = "Achievements", right = `<span class="detail-heading-spacer" aria-hidden="true"></span>`) => `<header class="detail-page-heading analytics-page-heading"><a class="detail-back" href="${back}"><span aria-hidden="true">‹</span> Back</a><strong>${esc(title)}</strong>${right}</header>`;

  function page(ctx) {
    const rows = entries(ctx.items || [], ctx.roles || {}), progress = progression(rows), route = String(ctx.achievementId || "");
    if (route === "levels") {
      const maxLevel = 1 + Math.floor(sum(rows, row => row.xp) / LEVEL_XP), table = levelTable(maxLevel);
      return `<section class="achievements-page">${head("#achievements", "Levels")}<article class="level-summary"><div class="achievement-level-orb is-static">${ring(progress.percent, progress.level)}<span>LVL</span><strong>${progress.level}</strong></div><div><p class="achievement-eyebrow">YOU ARE</p><h1>${esc(progress.name)}</h1><p>${progress.xp} XP · ${LEVEL_XP - progress.intoLevel} XP to ${esc(progress.nextName)}</p></div></article><p class="level-note">Every ${LEVEL_XP} XP earns a level. Earn XP by unlocking achievements. Level ${maxLevel} is the top level reachable with every achievement.</p><ol class="level-list">${table.map(row => `<li class="level-row${row.level > progress.level + 2 ? " is-far" : ""} ${row.level < progress.level ? "is-reached" : row.level === progress.level ? "is-current" : "is-locked"}"><span class="level-num" title="Level ${row.level}"><svg viewBox="10 10 76 76" aria-hidden="true">${insignia(insigniaSpec(row.level), "#2a1a00")}</svg><b>${row.level}</b></span><div><strong>${esc(row.name)}</strong><small>${row.xp.toLocaleString()} XP required</small>${row.level === progress.level ? `<span class="level-bar"><i style="width:${progress.percent}%"></i></span>` : ""}</div><span class="level-state">${row.level > progress.level + 2 ? LOCK : row.level < progress.level ? "Reached" : row.level === progress.level ? "You are here" : `${(row.xp - progress.xp).toLocaleString()} XP to go`}</span></li>`).join("")}</ol></section>`;
    }
    const legacy = rows.find(row => row.family === route);
    const groupId = route.startsWith("g-") ? route.slice(2) : legacy && !route.startsWith("a-") ? legacy.group : "";
    if (groupId) {
      const group = ALL_GROUPS.find(row => row[0] === groupId), list = groupRows(rows, groupId);
      if (!group || !list.length) return `<section class="achievements-page">${head("#achievements")}<h1>Category not found</h1></section>`;
      return `<section class="achievements-page">${head("#achievements", group[1])}<header class="ach-group-intro"><p>${esc(group[2])}</p><small>${list.filter(row => row.unlocked).length} of ${list.length} unlocked</small></header><div class="ach-grid">${list.map(tile).join("")}</div></section>`;
    }
    if (route.startsWith("a-")) {
      const row = rows.find(item => item.id === route.slice(2));
      if (!row) return `<section class="achievements-page">${head("#achievements")}<h1>Achievement not found</h1></section>`;
      const group = ALL_GROUPS.find(item => item[0] === row.group), date = dateText(row);
      const status = row.unlocked ? (date ? `Unlocked on ${date}` : "Unlocked") : "Not unlocked yet";
      return `<section class="achievements-page">${head(`#achievements/g-${row.group}`, group ? group[1] : "Achievements", `<button type="button" class="ach-share-icon" data-share-badge="${esc(row.id)}" aria-label="Share badge image" title="Share badge"><i data-lucide="share-2" aria-hidden="true"></i></button>`)}<article class="achievement-detail-card ach-detail is-${row.tier}${row.unlocked ? " is-unlocked" : ""}"><span class="ach-tier-chip">${MEDALS.find(m => m[0] === row.tier)?.[1] || "Legendary"}${row.kind === "badge" ? ` · ${esc(row.familyTitle)}` : ""}</span><h1>${esc(row.title)}</h1><p>${esc(row.description)}</p>${artImg(row, "achievement-art is-large", 220)}<p class="ach-detail-status${row.unlocked ? " is-done" : ""}">${esc(status)}</p>${row.unlocked ? "" : `<div class="achievement-progress"><span><i style="width:${row.percent}%"></i></span><small>${Math.floor(row.current).toLocaleString()} / ${esc(requirement(row))}</small></div>`}<div class="ach-stats"><div><strong>${esc(requirement(row))}</strong><small>Goal</small></div><div><strong>${esc(row.rarity)}</strong><small>Rarity</small></div><div><strong>+${row.xp} XP</strong><small>${row.unlocked ? "Earned" : "Reward"}</small></div></div></article></section>`;
    }
    const sections = ALL_GROUPS.map(([id, title]) => {
      const list = groupRows(rows, id); if (!list.length) return "";
      return `<section class="ach-section"><div class="ach-section-head"><div><h2>${esc(title)}</h2><small>${list.filter(row => row.unlocked).length} of ${list.length} unlocked</small></div><a href="#achievements/g-${id}">View all</a></div><div class="ach-row">${featured(list).slice(0, 10).map(tile).join("")}</div></section>`;
    }).join("");
    return `<section class="achievements-page">${head("#profile", "Achievements", `<a class="detail-back ach-levels-link" href="#achievements/levels">Levels</a>`)}<header class="achievement-hero"><a class="achievement-level-orb" href="#achievements/levels" aria-label="Level ${progress.level}, ${esc(progress.name)}. ${LEVEL_XP - progress.intoLevel} XP to next level. View all levels">${ring(progress.percent, progress.level)}<span>LVL</span><strong>${progress.level}</strong></a><div class="achievement-hero-copy"><p class="achievement-eyebrow">YOUR WATCH LEVEL</p><h1>${esc(progress.name)}</h1><p>${progress.xp} XP · ${progress.earned} of ${progress.total} achievements unlocked</p><small>${LEVEL_XP - progress.intoLevel} XP to ${esc(progress.nextName)} · <a href="#achievements/levels">All levels ›</a></small></div></header>${sections}</section>`;
  }
  // ---- Share a badge as a PNG card (the real SVG art, not a screenshot of text) ----
  const APP_NAME = STORE === "savepoint" ? "SavePoint" : "ScreenMark";
  const wrapText = (ctx, text, maxWidth) => { const lines = []; let line = ""; String(text).split(/\s+/).filter(Boolean).forEach(word => { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next; }); if (line) lines.push(line); return lines; };
  const loadImage = async src => {
    let url = src, revoke = false;
    try { const res = await fetch(src); if (res.ok) { url = URL.createObjectURL(new Blob([await res.text()], { type: "image/svg+xml" })); revoke = true; } } catch (_) {}
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => { resolve(img); if (revoke) setTimeout(() => URL.revokeObjectURL(url), 2000); }; img.onerror = () => reject(new Error("Could not load the badge image.")); img.src = url; });
  };
  const shareImage = async (items, roles, id) => {
    const row = entries(items, roles).find(item => item.id === id);
    if (!row) throw new Error("Achievement not found.");
    const W = 1080, H = 1350, canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d"), font = (typeof document !== "undefined" && getComputedStyle(document.body).fontFamily) || "sans-serif";
    const tint = { bronze: "#b8693a", silver: "#a9b6c8", gold: "#f1b01f", special: "#a855f7" }[row.tier], muted = "#9aa0b4";
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1b1d27"); bg.addColorStop(1, "#0b0c12"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 400, 30, W / 2, 400, 520); glow.addColorStop(0, `${tint}66`); glow.addColorStop(1, `${tint}00`); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `${tint}99`; ctx.lineWidth = 4; if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(28, 28, W - 56, H - 56, 48); ctx.stroke(); } else ctx.strokeRect(28, 28, W - 56, H - 56);
    const art = await loadImage(row.asset);
    ctx.save(); if (!row.unlocked) ctx.filter = "grayscale(1) brightness(.55)"; ctx.drawImage(art, W / 2 - 250, 130, 500, 500); ctx.restore();
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const chip = `${(MEDALS.find(m => m[0] === row.tier) || ["", "Legendary"])[1]}${row.kind === "badge" ? ` · ${row.familyTitle}` : ""}`.toUpperCase();
    ctx.fillStyle = tint; ctx.font = `800 32px ${font}`; ctx.fillText(chip, W / 2, 705);
    ctx.fillStyle = "#fff"; ctx.font = `800 80px ${font}`; let y = 800;
    wrapText(ctx, row.title, W - 160).slice(0, 2).forEach(line => { ctx.fillText(line, W / 2, y); y += 90; });
    ctx.fillStyle = muted; ctx.font = `500 38px ${font}`; y += -10;
    wrapText(ctx, row.description, W - 200).slice(0, 3).forEach(line => { ctx.fillText(line, W / 2, y); y += 52; });
    const date = dateText(row);
    ctx.fillStyle = row.unlocked ? tint : muted; ctx.font = `700 40px ${font}`;
    ctx.fillText(row.unlocked ? (date ? `Unlocked on ${date}` : "Unlocked") : `Not unlocked yet · ${Math.floor(row.current).toLocaleString()} / ${requirement(row)}`, W / 2, Math.max(y + 40, 1010));
    const boxes = [[requirement(row), "Goal"], [row.rarity, "Rarity"], [`+${row.xp} XP`, row.unlocked ? "Earned" : "Reward"]], bw = 290, gap = 26, x0 = (W - (bw * 3 + gap * 2)) / 2;
    boxes.forEach(([value, label], i) => {
      const x = x0 + i * (bw + gap); ctx.fillStyle = "rgba(255,255,255,.07)"; if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, 1080, bw, 150, 28); ctx.fill(); } else ctx.fillRect(x, 1080, bw, 150);
      ctx.fillStyle = "#fff"; ctx.font = `800 34px ${font}`; const lines = wrapText(ctx, value, bw - 30).slice(0, 2); lines.forEach((line, n) => ctx.fillText(line, x + bw / 2, 1132 + n * 40 - (lines.length - 1) * 14));
      ctx.fillStyle = muted; ctx.font = `500 26px ${font}`; ctx.fillText(label, x + bw / 2, 1208);
    });
    ctx.fillStyle = muted; ctx.font = `600 28px ${font}`; ctx.fillText(`${APP_NAME} · Achievements`, W / 2, 1290);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Image export failed.");
    return { blob, filename: `${row.id}.png`, title: `${row.title} badge` };
  };
  window.SplitAppPages.achievements = page;
  window.SplitAppAchievements = { metrics, entries, progression, unlocks, recent, stamp, levelName, levelTable, shareImage, insignia, insigniaSpec, groups: ALL_GROUPS };
})();
