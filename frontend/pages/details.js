// Source-rich detail screen shared by the split apps.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.details = context => {
    const {
      detailPreview, items, detailItemId, detailReturnPage, detailData,
      detailLoading, detailError, detailEditMode, category, labelCategory, prefs, esc
    } = context;

    const detailValue = value => Array.isArray(value)
      ? value.map(detailValue).filter(Boolean).join(", ")
      : value && typeof value === "object"
        ? Object.values(value).map(detailValue).filter(Boolean).join(" · ")
        : window.SplitAppDates.text(String(value ?? ""));

    const safeUrl = value => {
      try {
        const url = new URL(String(value || ""));
        return ["https:", "http:"].includes(url.protocol) ? url.href : "";
      } catch { return ""; }
    };
    const safeImage = value => /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || "")) ? String(value) : safeUrl(value);

    const heading = title => { const m = /^(.*?)\s*\((\d+)\)\s*$/.exec(String(title || "")); return m ? `${esc(m[1])} <b>${m[2]}</b>` : esc(title || ""); };
    const refButton = (ref, className, inner) => `<button type="button" class="${className}" data-detail-ref="${esc(ref.type)}:${esc(ref.id)}" data-detail-ref-title="${esc(ref.title || "")}"${ref.extra ? ` data-detail-ref-extra="${esc(JSON.stringify(ref.extra))}"` : ""}>${inner}</button>`;
    const ratingTone = rating => rating >= 9 ? "r5" : rating >= 8 ? "r4" : rating >= 7 ? "r3" : rating >= 6 ? "r2" : "r1";
    const ratingsGrid = rows => {
      const rated = rows.filter(row => row.rating), seasons = [...new Set(rows.map(row => row.season))];
      if (!rated.length) return `<p class="detail-description">No episode ratings yet.</p>`;
      const average = rated.reduce((sum, row) => sum + row.rating, 0) / rated.length;
      const cell = row => `<button type="button" class="ep-rate ${row.rating ? ratingTone(row.rating) : "r0"}" data-detail-ref="episode:${esc(row.id)}" data-detail-ref-title="${esc(row.title)}" title="S${esc(row.season)}E${esc(row.number)} · ${esc(row.title)}${row.rating ? ` · ★ ${row.rating}` : ""}">${row.rating ? Number(row.rating).toFixed(1) : "–"}</button>`;
      const longest = Math.max(...seasons.map(season => rows.filter(row => row.season === season).length));
      let saved = ""; try { saved = localStorage.getItem("screenmark_ratings_layout") || ""; } catch (_) {}
      const layout = saved === "horizontal" || saved === "vertical" ? saved : longest > 12 ? "vertical" : "horizontal";
      const numbers = Array.from({ length: longest }, (_, index) => index + 1);
      const horizontal = seasons.map(season => `<div class="ep-ratings-row"><span class="ep-ratings-label">S${esc(season)}</span>${rows.filter(row => row.season === season).map(cell).join("")}</div>`).join("");
      const vertical = `<div class="ep-ratings-cols" style="--seasons:${seasons.length}"><span class="ep-ratings-label"></span>${seasons.map(season => `<span class="ep-ratings-label ep-ratings-head">S${esc(season)}</span>`).join("")}${numbers.map(number => `<span class="ep-ratings-label">E${number}</span>${seasons.map(season => { const row = rows.find(entry => entry.season === season && entry.number === number); return row ? cell(row) : `<span class="ep-rate-empty"></span>`; }).join("")}`).join("")}</div>`;
      return `<div class="ep-ratings" data-layout="${layout}"><div class="ep-ratings-bar"><p class="ep-ratings-note">Average ★ ${average.toFixed(1)} across ${rated.length} rated episodes</p><button type="button" class="ep-layout-toggle" data-ratings-layout aria-label="Switch grid direction">${layout === "vertical" ? "Horizontal" : "Vertical"}</button></div><div class="ep-ratings-scroll ep-ratings-h">${horizontal}</div><div class="ep-ratings-scroll ep-ratings-v">${vertical}</div></div>`;
    };
    const episodeGuide = (section, rows, watchedIds, canToggle, item, sectionIndex, imageButton, fallbackImage = "") => {
      const seasons = [...new Set(rows.map(row => row.season))].sort((a, b) => a - b);
      const firstOpen = rows.find(row => !watchedIds.has(String(row.id)))?.season ?? seasons[seasons.length - 1];
      const selected = seasons.map(String).includes(String(context.detailSeason)) ? Number(context.detailSeason) : firstOpen;
      const stats = season => { const list = rows.filter(row => row.season === season); return { list, done: list.filter(row => watchedIds.has(String(row.id))).length }; };
      const coverOf = season => { const info = section.seasons?.[season] || {}; return safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.seasons.${season}.image`] || info.image) || safeImage(rows.find(row => row.season === season && row.image)?.image); };
      const avgOf = list => { const rated = list.filter(row => row.rating); return rated.length ? (rated.reduce((sum, row) => sum + row.rating, 0) / rated.length).toFixed(1) : ""; };
      const pills = `<div class="season-deck-header"><span class="sec-title">Seasons <b>${seasons.length}</b></span></div><div class="season-pills season-poster-deck" role="tablist" aria-label="Seasons">${seasons.map(season => { const { list, done } = stats(season), info = section.seasons?.[season] || {}, cover = coverOf(season), avg = avgOf(list), all = done === list.length, year = info.premiere ? String(info.premiere).slice(0, 4) : ""; return `<button type="button" role="tab" class="season-pill season-card${season === selected ? " active" : ""}${all ? " complete" : ""}" aria-selected="${season === selected}" data-season-pill="${esc(season)}"><span class="sc-art">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : ""}<span class="sc-art-scrim"></span>${canToggle && all ? `<span class="sc-check-pill">✓</span>` : ""}${year ? `<span class="sc-year-pill">${esc(year)}</span>` : ""}</span><span class="sc-meta"><span class="sc-title"><b>Season ${esc(season)}</b>${avg ? `<i>★${avg}</i>` : ""}</span><span class="sc-sub">${canToggle ? `${done}/${list.length}` : list.length} eps</span><span class="sc-bar"><i class="sc-bar-fill${all ? " done" : ""}" style="width:${canToggle ? Math.round(done / list.length * 100) : 0}%"></i></span></span></button>`; }).join("")}</div>`;
      const panels = seasons.map(season => {
        const { list, done } = stats(season), info = section.seasons?.[season] || {};
        const rated = list.filter(row => row.rating), average = rated.length ? (rated.reduce((sum, row) => sum + row.rating, 0) / rated.length).toFixed(1) : "";
        const cover = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.seasons.${season}.image`] || info.image) || safeImage(list.find(row => row.image)?.image);
        const ids = list.map(row => row.id).join(",");
        const rowsHtml = `<ul class="episode-list">${list.map(row => {
          const watched = watchedIds.has(String(row.id)), thumb = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.items.${rows.indexOf(row)}.image`] || row.image) || fallbackImage;
          const check = canToggle ? `<button type="button" class="episode-check ${watched ? "is-watched" : ""}" data-episode-toggle data-episode-id="${esc(row.id)}" data-episode-title="${esc(`S${row.season}E${row.number} ${row.title}`)}" role="checkbox" aria-checked="${watched}" aria-label="Mark ${esc(row.title)} watched">${watched ? "✓" : ""}</button>` : "";
          const meta = [window.SplitAppDates.text(row.airdate), row.runtime ? `${row.runtime}m` : ""].filter(Boolean).join("  ");
          return `<li class="episode-row${watched ? " is-watched" : ""}">${refButton(row.ref || { type: "episode", id: row.id }, "episode-main", `<span class="episode-thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async">` : ""}</span><span class="episode-text"><strong>S${esc(row.season)}·E${esc(row.number)} — ${esc(row.title)}</strong><small>${esc(meta)}${row.rating ? ` <b class="episode-rating ${ratingTone(row.rating)}">★ ${Number(row.rating).toFixed(1)}</b>` : ""}</small>${row.description ? `<em>${esc(row.description)}</em>` : ""}</span>`)}${check}</li>`;
        }).join("")}</ul>`;
        const pct = list.length ? Math.round(done / list.length * 100) : 0, yr = info.premiere ? String(info.premiere).slice(0, 4) : "", yrEnd = info.end ? String(info.end).slice(0, 4) : "";
        return `<div class="season-panel" data-season-panel="${esc(season)}"${season === selected ? "" : " hidden"}><div class="season-summary active-season-spotlight"><span class="season-art ass-thumb">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : ""}</span><span class="season-head ass-body"><span class="ass-top"><strong>Season ${esc(season)}${yr ? ` (${esc(yr)})` : ""}</strong>${canToggle ? `<span class="season-count">${done}/${list.length} · ${pct}%</span>` : ""}</span><small>${list.length} episodes${yr ? ` · ${esc(yr)}${yrEnd && yrEnd !== yr ? `–${esc(yrEnd)}` : ""}` : ""}${average ? ` · ★ ${average}` : ""}</small>${canToggle ? `<span class="season-progress"><i style="width:${pct}%"></i></span>` : ""}</span></div>${canToggle ? `<div class="season-actions"><button type="button" class="season-all" data-season-toggle="${esc(ids)}" data-season-done="${done === list.length}">${done === list.length ? "↺ Uncheck whole season" : "✓ Check whole season"}</button></div>` : ""}${season === selected ? rowsHtml : `<template data-lazy-season>${rowsHtml}</template>`}</div>`;
      }).join("");
      return `<div class="season-list">${pills}${panels}</div>`;
    };

    const renderRefPage = () => {
      const data = context.refData, kind = context.detailRef?.type;
      // A saved series' episode: watched toggle and Prev/Next navigation.
      const savedItem = kind === "episode" ? context.refItem : null, epInfo = savedItem ? window.SplitAppLibrary.episodeInfo(savedItem) : null;
      const epId = String(context.detailRef?.id ?? ""), epIndex = epInfo ? epInfo.eps.findIndex(entry => String(entry.id) === epId) : -1;
      const epWatched = epIndex >= 0 && epInfo.watched.has(epId);
      const watchedButton = epIndex >= 0 ? `<button type="button" class="ep-watch-button${epWatched ? " is-watched" : ""}" data-episode-toggle data-item-id="${esc(savedItem.id)}" data-episode-id="${esc(epId)}" data-episode-title="${esc(data?.title || "Episode")}" aria-pressed="${epWatched}">${epWatched ? "✓ Watched" : "Mark watched"}</button>` : "<span></span>";
      const back = `<header class="detail-page-heading demo-detail-heading"><button type="button" class="detail-back" data-detail-back><span aria-hidden="true">‹</span> Back</button><strong class="detail-heading-title">${esc(kind === "episode" && data?.subtitle ? data.subtitle : data?.title || "")}</strong></header>`;
      const refClass = `detail-page demo-cinema-page demo-ref-page demo-${esc(kind || "detail")}-page`;
      if (context.refLoading && !data) return `<div class="${refClass}">${back}<p class="app-info detail-loading">Loading from TVmaze…</p></div>`;
      if (!data) return `<div class="${refClass}">${back}<div class="detail-error"><p>${esc(context.refError || "Could not load this page.")}</p><button class="button secondary small" data-detail-ref-retry>Try again</button></div></div>`;
      const image = safeImage(data.image);
      const episodeFallback = safeImage(savedItem?.customCover || savedItem?.localThumbnailData || savedItem?.image) || safeImage((data.sections || []).flatMap(section => section.items || []).find(row => /poster|screenshot|still/i.test(`${row.title || ""} ${row.meta || ""}`) && row.image)?.image);
      const episodeImage = image || episodeFallback;
      const actorPortrait = image ? `<button type="button" class="demo-actor-portrait detail-image-trigger" data-detail-image-src="${esc(image)}" data-detail-image-label="${esc(data.title)}"><img src="${esc(image)}" alt="${esc(data.title)}" onerror="this.hidden=true"></button>` : `<span class="demo-actor-portrait" aria-hidden="true"><svg class="person-placeholder" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg></span>`;
      const actorHero = `<header class="demo-actor-hero">${actorPortrait}<div class="demo-actor-copy"><span class="demo-source-label">${kind === "character" ? "Character profile" : "Actor &amp; crew profile"}</span><h1>${esc(data.title)}</h1>${data.subtitle ? `<p>${esc(data.subtitle)}</p>` : ""}<div class="demo-fact-pills">${(data.facts || []).map(([label, value]) => `<span>${esc(label)} · ${esc(window.SplitAppDates.text(value))}</span>`).join("")}</div></div></header>`;
      const hero = `<article class="detail-hero ios-hero ref-hero demo-ref-hero"><div class="ios-hero-bg"${image ? ` style="background-image:url('${esc(image)}')"` : ""}></div><div class="ios-hero-body">${image ? `<button type="button" class="detail-image-trigger detail-cover-trigger${data.landscape ? " is-landscape" : ""}" data-detail-image-src="${esc(image)}" data-detail-image-label="${esc(data.title)}"><img class="detail-image" src="${esc(image)}" alt="" onerror="this.hidden=true"></button>` : `<div class="detail-image-placeholder">✦</div>`}<div class="detail-hero-copy"><p class="eyebrow">TVmaze · ${esc(kind)}</p><h2>${esc(data.title)}</h2>${data.subtitle ? `<p class="detail-description">${esc(data.subtitle)}</p>` : ""}<div class="detail-badges">${(data.facts || []).map(([label, value]) => `<span>${esc(label)}: ${esc(window.SplitAppDates.text(value))}</span>`).join("")}</div></div></div>${epIndex >= 0 ? (() => { const prev = epInfo.eps[epIndex - 1], next = epInfo.eps[epIndex + 1]; const nav = (entry, label) => entry ? `<button type="button" class="button secondary" data-detail-ref="episode:${esc(entry.id)}" data-detail-ref-title="${esc(entry.title)}" data-ref-replace="true">${label}</button>` : `<button type="button" class="button secondary" disabled>${label}</button>`; return `<div class="ep-nav-row">${nav(prev, "‹ Prev ep")}${nav(next, "Next ep ›")}</div>`; })() : ""}</article>`;
      const factPills = (data.facts || []).map(([label, value]) => `<span class="${label === "Rating" ? "is-rating" : ""}">${esc(label)}: ${esc(window.SplitAppDates.text(value))}</span>`).join("");
      const navButton = (entry, label) => entry ? `<button type="button" class="ep-nav-button" data-detail-ref="episode:${esc(entry.id)}" data-detail-ref-title="${esc(entry.title)}" data-ref-replace="true">${label}</button>` : `<button type="button" class="ep-nav-button" disabled>${label}</button>`;
      const epCode = /^(.*?)\s*·\s*S(\d+)E(\d+)\s*$/i.exec(String(data.subtitle || ""));
      const epKicker = epCode ? `${epCode[1]} · Season ${epCode[2]} · Episode ${epCode[3]}` : data.subtitle || "Episode";
      const epFacts = (data.facts || []).map(([label, value]) => { const text = window.SplitAppDates.text(value); return /rating/i.test(label) ? `<span class="is-rating">${esc(String(text).replace(/^★?\s*/, "★ "))}</span>` : /aired|date/i.test(label) ? `<span>Aired ${esc(text)}</span>` : /runtime/i.test(label) ? `<span>${esc(String(text).replace(/\s*min.*/i, ""))} min</span>` : `<span>${esc(label)}: ${esc(text)}</span>`; }).join("");
      const epHero = kind === "episode" ? `<article class="ep-hero"><div class="ep-still">${episodeImage ? `<button type="button" class="detail-image-trigger" data-detail-image-src="${esc(episodeImage)}" data-detail-image-label="${esc(data.title)}"><img src="${esc(episodeImage)}" alt="" onerror="this.hidden=true"></button>` : ""}<div class="ep-still-copy"><span class="ep-kicker">${esc(epKicker)}</span><h1>${esc(data.title)}</h1><div class="demo-episode-facts ep-pills">${epFacts}</div></div></div></article>` : "";
      const epNavCard = kind === "episode" && epIndex >= 0 ? `<section class="ep-checkin-card"><span class="db-label">Episode navigation &amp; check-in</span><div class="ep-nav-row">${navButton(epInfo.eps[epIndex - 1], "‹ Prev")}<button type="button" class="ep-nav-button ep-center-check${epWatched ? " is-watched" : ""}" data-episode-toggle data-item-id="${esc(savedItem.id)}" data-episode-id="${esc(epId)}" data-episode-title="${esc(data.title)}" aria-pressed="${epWatched}">${epWatched ? "✓ Watched" : "＋ Mark watched"}</button>${navButton(epInfo.eps[epIndex + 1], "Next ›")}</div></section>` : "";
      const seriesGuide = kind === "episode" && savedItem ? (() => { const art = safeImage(savedItem.customCover || savedItem.localThumbnailData || savedItem.image); return `<button type="button" class="detail-section detail-card series-guide-card" data-detail-back><span class="sg-art">${art ? `<img src="${esc(art)}" alt="" onerror="this.hidden=true">` : ""}</span><span class="sg-copy"><small>Series guide</small><strong>${esc(savedItem.title)}</strong><em>${epInfo ? `${epInfo.done}/${epInfo.total} episodes watched · ` : ""}Return to full season list ›</em></span></button>`; })() : "";
      const reactionCard = "";
      const personSections = data.sections || [], refPageSize = 20;
      const personCredits = kind === "person" ? personSections.reduce((sum, section) => sum + (section.items || []).length, 0) : 0;
      const refPages = Math.max(1, Math.ceil(personCredits / refPageSize)), refPage = Math.min(refPages - 1, Math.floor((Number(context.detailRefOffset) || 0) / refPageSize));
      let creditCursor = 0;
      const sections = personSections.filter(section => !(kind === "episode" && savedItem && /^show$/i.test(section.title || ""))).map(section => {
        const sourceRows = section.items || [], start = creditCursor; creditCursor += sourceRows.length;
        const rows = kind === "person" ? sourceRows.slice(Math.max(0, refPage * refPageSize - start), Math.max(0, (refPage + 1) * refPageSize - start)) : sourceRows;
        if (kind === "person" && !rows.length) return "";
        const body = section.kind === "episodes-list"
          ? `<ul class="episode-list">${rows.map(row => { const thumb = safeImage(row.image) || episodeFallback; return `<li class="episode-row">${refButton(row.ref, "episode-main", `<span class="episode-thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : ""}</span><span class="episode-text"><strong>${esc(row.title)}</strong>${row.meta ? `<small>${esc(window.SplitAppDates.text(row.meta))}</small>` : ""}</span>`)}</li>`; }).join("")}</ul>`
          : `<div class="detail-carousel">${rows.map(row => {
              const art = safeImage(row.image), isCast = /^(cast|characters|staff|guest cast|guest crew)/i.test(section.title || ""), fallback = isCast ? `<svg class="person-placeholder" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>` : "", inner = `<span class="detail-carousel-art">${art ? `<img src="${esc(art)}" alt="" loading="lazy">` : fallback}</span><strong>${esc(row.title)}</strong>${row.meta ? `<small>${esc(row.meta)}</small>` : ""}`;
              const ref = section.kind === "shows" ? { type: "show", id: row.id, title: row.title } : row.ref;
              return ref ? refButton(ref, "detail-carousel-card", inner) : `<div class="detail-carousel-card">${inner}</div>`;
            }).join("")}</div>`;
        const castClass = /^(cast|characters|staff|guest cast|guest crew)/i.test(section.title || "") ? "demo-cast-section" : "";
        return `<section class="detail-section demo-list-section ${castClass}"><h3>${heading(section.title)}</h3>${body}</section>`;
      }).join("");
      const creditsPager = kind === "person" && refPages > 1 ? `<nav class="detail-ref-pager" aria-label="Cast credits pages"><button type="button" data-detail-ref-page="${Math.max(0, (refPage - 1) * refPageSize)}" ${refPage === 0 ? "disabled" : ""} aria-label="Previous page">‹</button><span>${refPage * refPageSize + 1}–${Math.min(personCredits, (refPage + 1) * refPageSize)} of ${personCredits} · page ${refPage + 1}/${refPages}</span><button type="button" data-detail-ref-page="${Math.min((refPages - 1) * refPageSize, (refPage + 1) * refPageSize)}" ${refPage >= refPages - 1 ? "disabled" : ""} aria-label="Next page">›</button></nav>` : "";
      const refHero = kind === "episode" ? epHero : kind === "person" || kind === "character" ? actorHero : hero;
      return `<div class="${refClass}">${back}${refHero}${epNavCard}${reactionCard}${data.description ? `<section class="detail-section detail-card"><h3>${kind === "episode" ? "Synopsis" : "Overview"}</h3><p class="detail-description">${esc(data.description)}</p></section>` : ""}${seriesGuide}${sections}${creditsPager}${kind !== "person" && kind !== "episode" && safeUrl(data.url) ? `<section class="detail-section detail-card"><div class="detail-link-list"><a href="${esc(safeUrl(data.url))}" target="_blank" rel="noopener noreferrer">Open on TVmaze ↗</a></div></section>` : ""}<dialog class="detail-image-modal" id="detail-image-modal" aria-label="Image viewer"><button type="button" class="detail-image-modal-close" data-detail-image-close aria-label="Close image">×</button><button type="button" class="detail-image-modal-nav detail-image-modal-prev" data-detail-image-prev aria-label="Previous image">‹</button><figure><img data-detail-modal-img alt=""><figcaption data-detail-modal-caption></figcaption></figure><button type="button" class="detail-image-modal-nav detail-image-modal-next" data-detail-image-next aria-label="Next image">›</button></dialog></div>`;
    };

    const renderSection = (section, watchedIds = new Set(), canToggleEpisodes = false, item = null, sectionIndex = 0, imageButton = () => "", fallbackEpisodeImage = "") => {
      const items = section.items || [];
      const body = section.kind === "carousel"
        ? `<div class="detail-carousel">${items.map((entry, entryIndex) => {
            const href = safeUrl(entry.url);
            const image = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.items.${entryIndex}.image`] || entry.image);
            const isCast = /^(cast|characters|staff|guest cast|guest crew)/i.test(section.title || "");
            const placeholder = isCast ? `<svg class="person-placeholder" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>` : "";
            const inner = `<span class="detail-carousel-art">${image ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async">` : placeholder}</span><strong>${esc(entry.title || "Untitled")}</strong>${entry.meta ? `<small>${esc(detailValue(entry.meta))}</small>` : ""}`;
            return entry.ref ? refButton(entry.ref, "detail-carousel-card", inner) : href ? `<a class="detail-carousel-card" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="detail-carousel-card">${inner}</div>`;
          }).join("")}</div>`
        : section.kind === "ratings" ? ratingsGrid(items)
        : section.kind === "episodes" ? episodeGuide(section, items, watchedIds, canToggleEpisodes, item, sectionIndex, imageButton, fallbackEpisodeImage)
        : section.kind === "gallery"
        ? `<div class="detail-gallery">${items.map((entry, entryIndex) => {
            const image = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.items.${entryIndex}.image`] || entry.image || entry.url);
            return image ? imageButton(image, entry.title || "Screenshot", `<img src="${esc(image)}" alt="${esc(entry.title || "Source image")}" loading="lazy"><span>${esc(entry.title || "")}</span>`, "detail-gallery-image") : "";
          }).join("")}</div>`
        : `<div class="detail-source-list">${items.map((entry, entryIndex) => {
            const href = safeUrl(entry.url);
            const image = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.items.${entryIndex}.image`] || entry.image);
            const title = esc(entry.title || "Untitled");
            const episodeId = String(entry.id ?? entry.title ?? "");
            const watched = watchedIds.has(episodeId);
            const toggle = section.kind === "episodes" && canToggleEpisodes
              ? `<button class="episode-toggle ${watched ? "is-watched" : ""}" type="button" data-episode-toggle data-episode-id="${esc(episodeId)}" data-episode-title="${title}" aria-pressed="${watched}">${watched ? "Watched ✓" : "Mark watched"}</button>`
              : "";
            const thumbnail = image ? imageButton(image, entry.title || "Source image", `<img src="${esc(image)}" alt="" loading="lazy">`, "detail-source-image") : "";
            const content = `<div class="detail-source-item">${thumbnail}<div><strong>${title}</strong>${entry.meta ? `<small>${esc(detailValue(entry.meta))}</small>` : ""}${entry.description ? `<p>${esc(entry.description)}</p>` : ""}${href && section.kind !== "episodes" ? `<a class="detail-entry-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ""}${toggle}</div></div>`;
            return content;
          }).join("")}</div>`;
      const demoSectionClass = /^(cast|characters|staff|guest cast|guest crew)/i.test(section.title || "") ? "demo-cast-section" : section.kind === "episodes" || section.kind === "episodes-list" ? "demo-episode-section" : section.kind === "ratings" ? "demo-rating-section" : /^(related|you might also like|same series)/i.test(section.title || "") ? "demo-related-section" : "";
      return section.collapsed && !/^posters/i.test(section.title || "")
        ? `<details class="detail-section detail-collapsible ${demoSectionClass}"><summary><h3>${heading(section.title || "More details")}</h3><span aria-hidden="true">›</span></summary>${body}</details>`
        : `<section class="detail-section ${demoSectionClass}"><h3>${/^(cast|characters|staff)/i.test(section.title || "") && items.length > 8 && section.kind === "carousel" ? `<span class="detail-section-head">${heading(section.title)}<button type="button" class="detail-full-list" data-carousel-expand>Full list</button></span>` : heading(section.title || "More details")}</h3>${body}</section>`;
    };

    function renderDetails() {
      if (context.detailRef) return renderRefPage();
      const item = detailPreview || items.find(row => row.id === detailItemId);
      if (!item) return `<div class="empty-state"><strong>That entry is no longer in your library.</strong><button class="button secondary" data-go="${esc(detailReturnPage)}">Back to library</button></div>`;

      const source = window.SplitAppMetadata.providers.find(row => row.key === (item.metadataSource || item.source));
      const loaded = detailData || {};
      const image = safeImage(item.customCover || item.localThumbnailData || item.localImageData?.["image"] || item.localImageData?.["cachedDetails.portraitImage"] || item.localImageData?.["cachedDetails.image"] || loaded.portraitImage || loaded.image || item.image);
      const landscape = safeImage(item.localImageData?.["cachedDetails.landscapeImage"] || item.localImageData?.["cachedDetails.backgroundImage"] || loaded.landscapeImage || loaded.backgroundImage);
      const summary = loaded.description || item.description || item.summary || "No description is available for this entry yet.";
      const sourceUrl = safeUrl(loaded.url || item.url || item.providerUrl);
      const goal = Math.max(0, Number(item.goal || loaded.goal) || (category(item.category)?.unit === "minutes" ? Number(loaded.facts?.runtimeMinutes) : 0) || 0);
      const progress = Math.max(0, Number(item.progress) || 0);
      const percent = goal ? Math.max(0, Math.min(100, Math.round(progress / goal * 100))) : 0;
      const unit = category(item.category)?.unit || "";
      const facts = [
        ["Year", loaded.year || item.year],
        ["Rating", loaded.rating ? `★ ${loaded.rating}` : ""]
      ].filter(([, value]) => value !== "" && value !== undefined && value !== null);
      const fields = (loaded.fields || []).filter(row => row && row.value !== "" && row.value != null);
      const links = (loaded.links || []).map(link => ({ ...link, href: safeUrl(link.url) })).filter(link => link.href);
      const sections = (loaded.sections || []).filter(section => section && section.items?.length);
      const canProgress = !detailPreview;
      const popupImageButton = (src, label, content, className = "") => src
        ? `<button type="button" class="detail-image-trigger ${className}" data-detail-image-src="${esc(src)}" data-detail-image-label="${esc(label)}" aria-label="View ${esc(label)}">${content}</button>`
        : "";
      const detailImage = popupImageButton(image, `${item.title} cover`, `<img class="detail-image" src="${esc(image)}" alt="${esc(item.title)} cover" onerror="this.hidden=true">`, "detail-cover-trigger");
      const buySub = [fields.find(row => /developer/i.test(row.label))?.value, loaded.year || item.year].filter(Boolean).map(detailValue).join(" • ");
      const purchase = loaded.purchase && safeUrl(loaded.purchase.url)
        ? `<div class="ios-buy"><div class="ios-buy-copy"><p>${loaded.purchase.isFree ? "Play" : "Buy"} ${esc(item.title)} <span>on Steam</span></p>${buySub ? `<small>${esc(buySub)}</small>` : ""}</div><strong>${esc(loaded.purchase.price || "")}</strong><a class="button primary" href="${esc(loaded.purchase.url)}" target="_blank" rel="noopener noreferrer">${loaded.purchase.isFree ? "Play on Steam" : "Buy on Steam"}</a></div>`
        : "";
      const statuses = category(item.category)?.statuses || [];
      const watchedSet = new Set((item.watchedEpisodeIds || []).map(String));
      const indexedSections = sections.map((section, index) => ({ section, index })), taken = new Set();
      const takeSlot = pattern => indexedSections.filter(({ section, index }) => !taken.has(index) && pattern.test(section.title || "") && taken.add(index));
      const slots = { media: takeSlot(/^(trailers|images|screenshots|posters)/i), cast: takeSlot(/^(cast|characters|staff)/i), ratings: indexedSections.filter(({ section, index }) => !taken.has(index) && section.kind === "ratings" && taken.add(index)), episodes: indexedSections.filter(({ section, index }) => !taken.has(index) && section.kind === "episodes" && taken.add(index)), related: takeSlot(/^(related|you might also like|same series)/i) };
      slots.other = indexedSections.filter(({ index }) => !taken.has(index));
      const fallbackEpisodeImage = safeImage(item.customCover || item.localThumbnailData || item.image || item.backdrop) || safeImage(slots.media.flatMap(({ section, index }) => (section.items || []).map((entry, entryIndex) => item.localImageData?.[`cachedDetails.sections.${index}.items.${entryIndex}.image`] || entry.image)).find(Boolean));
      const renderRows = rows => rows.map(({ section, index }) => renderSection(section, watchedSet, canProgress, item, index, popupImageButton, fallbackEpisodeImage)).join("");
      const useSynopsisLayout = item.category === "series" || item.category === "movie";
      const synopsisTrailerUrl = safeUrl(loaded.trailer?.url) || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${loaded.title || item.title} ${loaded.year || item.year || ""} official trailer`.trim())}`;
      const synopsisTrailer = useSynopsisLayout ? `<a class="demo-synopsis-trailer" href="${esc(synopsisTrailerUrl)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> Watch official ${item.category === "series" ? "series" : "movie"} trailer (YouTube)</a>` : "";
      const part = {
        legacyProgress: canProgress ? (() => {
          const cat = category(item.category) || {}, stepSize = cat.step || 1, short = cat.unit === "minutes" ? "m" : "ep";
          const quick = [-1, 1, cat.unit === "minutes" ? 3 : 5].map(multiple => multiple * stepSize);
          const runtime = Number(item.facts?.runtimeMinutes || loaded.facts?.runtimeMinutes) || 0;
          const leftUnits = goal ? Math.max(0, goal - progress) : 0;
          const leftMinutes = cat.unit === "minutes" ? leftUnits : leftUnits * runtime;
          const leftText = !goal ? "" : !leftUnits ? "finished" : leftMinutes ? `${leftMinutes >= 60 ? `${Math.floor(leftMinutes / 60)}h ${leftMinutes % 60 ? `${leftMinutes % 60}m` : ""}`.trim() : `${leftMinutes}m`} left` : `${leftUnits} ${cat.unit} left`;
          const fmtLeft = leftMinutes ? (leftMinutes >= 60 ? `${Math.floor(leftMinutes / 60)}h${leftMinutes % 60 ? ` ${leftMinutes % 60}m` : ""}` : `${leftMinutes}m`) : "";
          return `<section class="detail-progress-card progress-console"><div class="pc-top-row"><div class="pc-big-ratio"><b>${progress}</b>${goal ? `/${goal}` : ""} <small>${esc(short === "m" ? "min" : "ep")}</small> <span>${goal ? `${percent}%` : ""}</span></div><span class="pc-remaining">${goal ? (leftUnits ? `${fmtLeft || `${leftUnits} ${esc(unit)}`} left` : "Completed") : ""}</span></div><div class="progress-line pc-bar-track"><span style="width:${percent}%"></span></div>${goal ? "" : `<small class="pc-note">Edit the entry to set a total and track completion.</small>`}<div class="detail-quick-adjust pc-steppers"><span class="pc-step-label">${cat.unit === "minutes" ? "Runtime scrub" : "Quick adjust"}</span><div class="ios-stepper pc-step-group">${quick.map((amount, index) => `<button type="button"${index === 1 ? ' class="accent"' : ""} data-adjust-progress="${amount}">${amount < 0 ? "−" : "+"}${Math.abs(amount)}${short}</button>`).join("")}</div></div></section>`;
        })() : "",
        tracking: canProgress ? `<section class="detail-section detail-tracking-section"><h3>Tracking status</h3><div class="ios-pills detail-status-pills">${statuses.map(status => `<button type="button" class="ios-pill${status === item.status ? " active" : ""}" data-detail-status-btn="${esc(status)}">${esc(status)}</button>`).join("")}</div></section><dialog class="choice-dialog detail-delete-dialog" id="detail-delete-dialog"><form method="dialog"><div class="choice-dialog-grabber"></div><h2>Delete ${esc(item.title)}?</h2><p>This removes the title from your collection.</p><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-detail-delete-cancel>Cancel</button><button type="button" class="button primary" data-detail-delete-confirm>Delete</button></footer></form></dialog>` : "",
        media: renderRows(slots.media),
        trailer: useSynopsisLayout ? "" : loaded.trailer && safeUrl(loaded.trailer.url) ? `<section class="detail-section"><h3>Official trailer</h3><a class="detail-trailer" href="${esc(safeUrl(loaded.trailer.url))}" target="_blank" rel="noopener noreferrer">${safeImage(loaded.trailer.image) ? `<img src="${esc(safeImage(loaded.trailer.image))}" alt="" loading="lazy">` : ""}<span class="detail-trailer-play" aria-hidden="true">▶</span><strong>${esc(loaded.trailer.title || "Watch trailer")}</strong></a></section>` : (loaded.title || item.title) ? `<section class="detail-section"><h3>Trailer</h3><a class="detail-trailer-search" href="${esc(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${loaded.title || item.title} ${loaded.year || item.year || ""} official trailer`.trim())}`)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span><span>Find the trailer on YouTube</span><small>This source has no trailer link</small></a></section>` : "",
        ratings: renderRows(slots.ratings),
        episodes: renderRows(slots.episodes),
        stores: (loaded.stores || []).length ? `<section class="detail-section detail-stores"><h3>Where to buy</h3><div class="detail-store-list">${loaded.stores.map(row => safeUrl(row.url) ? `<a class="button secondary small" href="${esc(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer">${esc(row.name)} ↗</a>` : "").join("")}</div></section>` : "",
        tags: (loaded.tags || []).length ? `<section class="detail-section"><h3>Tags</h3><div class="detail-chips">${loaded.tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div></section>` : "",
        breakdown: (loaded.ratingBreakdown || []).length ? `<section class="detail-section detail-rating-breakdown"><h3>Player ratings${loaded.ratingCount ? ` · ${Number(loaded.ratingCount).toLocaleString()}` : ""}</h3><div class="rating-bar" role="img" aria-label="${esc(loaded.ratingBreakdown.map(row => `${row.label} ${row.percent}%`).join(", "))}">${loaded.ratingBreakdown.map((row, index) => `<span class="rating-seg rating-seg-${index % 4}" style="width:${Math.max(2, Number(row.percent) || 0)}%"></span>`).join("")}</div><div class="rating-legend">${loaded.ratingBreakdown.map((row, index) => `<span><i class="rating-seg-${index % 4}"></i>${esc(row.label)} <b>${esc(row.percent)}%</b></span>`).join("")}</div></section>` : "",
        facts: facts.length || fields.length ? `<section class="detail-section"><h3>${item.category === "movie" ? "Theatrical release facts" : "Production details"}</h3><div class="detail-facts">${facts.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(detailValue(value))}</strong></div>`).join("")}${fields.filter(row => !(item.category === "series" && /^genres?$/i.test(String(row.label || "")))).map(row => `<div><span>${esc(row.label)}</span><strong>${esc(detailValue(row.value))}</strong></div>`).join("")}</div></section>` : "",
        requirements: loaded.requirements ? (() => {
          const { minimum = [], recommended = [] } = loaded.requirements;
          const labels = [...new Set([...minimum, ...recommended].map(([label]) => label))];
          const get = (rows, label) => rows.find(([key]) => key === label)?.[1] || "";
          const both = minimum.length && recommended.length;
          return `<section class="detail-section detail-requirements"><h3>System requirements</h3><div class="detail-table-wrap"><table class="detail-table req-table"><thead><tr><th scope="col"></th>${minimum.length ? "<th scope=\"col\">Minimum</th>" : ""}${recommended.length ? "<th scope=\"col\">Recommended</th>" : ""}</tr></thead><tbody>${labels.map(label => `<tr><th scope="row">${esc(label)}</th>${minimum.length ? `<td>${esc(get(minimum, label)) || "—"}</td>` : ""}${recommended.length ? `<td>${esc(get(recommended, label)) || "—"}</td>` : ""}</tr>`).join("")}</tbody></table></div>${both ? "" : ""}</section>`;
        })() : "",
        cast: renderRows(slots.cast),
        languages: (loaded.languages || []).length ? `<details class="detail-section detail-collapsible detail-languages"><summary><h3>Languages (${loaded.languages.length})</h3><span aria-hidden="true">›</span></summary><div class="detail-table-wrap"><table class="detail-table lang-table"><thead><tr><th scope="col">Language</th><th scope="col">Interface</th><th scope="col">Full audio</th></tr></thead><tbody>${loaded.languages.map(row => `<tr><th scope="row">${esc(row.name)}</th><td class="lang-yes">✓</td><td class="${row.audio ? "lang-yes" : "lang-no"}">${row.audio ? "✓" : "—"}</td></tr>`).join("")}</tbody></table></div></details>` : "",
        related: renderRows(slots.related),
        other: renderRows(slots.other),
        links: links.length ? `<section class="detail-section"><h3>Links</h3><div class="detail-link-list">${links.map(link => `<a href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">${esc(link.label || link.title || link.site || link.href)} ↗</a>`).join("")}</div></section>` : "",
        overview: `<section class="detail-section demo-overview-section"><h3>${useSynopsisLayout ? "Synopsis" : "Overview"}</h3><p class="detail-description">${esc(summary)}</p>${synopsisTrailer}</section>`
      };
      const epInfo = canProgress && item.category === "series" ? window.SplitAppLibrary.episodeInfo(item) : null;
      const unifiedProgress = epInfo ? (() => {
        const goal = Math.min(Math.max(1, Number(item.goal) || epInfo.total), epInfo.total);
        const done = Math.min(epInfo.done, goal), percent = Math.round(done / goal * 100);
        const allEpisodesWatched = epInfo.total > 0 && epInfo.done >= epInfo.total;
        const remaining = Math.max(0, goal - done);
        const runtime = Number(item.facts?.runtimeMinutes || loaded.facts?.runtimeMinutes) || 0, leftMinutes = remaining * runtime;
        const runtimeLeft = leftMinutes >= 60 ? `${Math.floor(leftMinutes / 60)}h${leftMinutes % 60 ? ` ${leftMinutes % 60}m` : ""}` : `${leftMinutes}m`;
        const leftLabel = allEpisodesWatched ? "Finished" : remaining === 0 ? "0 eps left (0h)" : `${remaining} eps left${runtime ? ` (${runtimeLeft})` : ""}`;
        const nextEpisode = epInfo.next;
        const episodeActions = allEpisodesWatched
          ? `<button type="button" class="button secondary btn-surface is-solo" disabled aria-label="All episodes watched">✓ Finished</button>`
          : `${nextEpisode ? `<button type="button" class="button primary btn-gold" data-action="watch-next" data-id="${esc(item.id)}">▶ Next · ${esc(epInfo.mark(nextEpisode))}</button>` : ""}<button type="button" class="button secondary btn-surface${nextEpisode ? "" : " is-solo"}" data-action="mark-all-watched" data-id="${esc(item.id)}">✓ Mark All</button>`;
        return `<section class="detail-progress-card detail-unified-progress progress-console"><div class="pc-top-row"><div class="pc-big-ratio"><b>${done}</b>/${goal} <span>${percent}%</span></div><span class="pc-remaining">${esc(leftLabel)}</span></div><div class="progress-line pc-bar-track"><span style="width:${percent}%"></span></div><div class="detail-episode-actions pc-btn-row">${episodeActions}</div><div class="detail-quick-adjust pc-steppers"><span class="pc-step-label">Quick adjust</span><div class="ios-stepper pc-step-group">${[-1, 1, 5].map(amount => `<button type="button"${amount === 1 ? ' class="accent"' : ""} data-adjust-progress="${amount}">${amount < 0 ? "−" : "+"}${Math.abs(amount)} ep</button>`).join("")}</div></div></section>`;
      })() : part.legacyProgress;
      const hasTabs = slots.episodes.length > 0 || slots.ratings.length > 0;
      let detailBody;
      if (hasTabs) {
        const tabs = [slots.episodes.length && ["episodes", "Episodes"], ["overview", "Overview"], slots.ratings.length && ["ratings", "Ratings"], slots.cast.length && ["cast", "Cast & Crew"]].filter(Boolean);
        const activeTab = tabs.some(([key]) => key === context.detailTab) ? context.detailTab : tabs[0][0];
        const panel = (key, html) => `<div class="detail-tab-panel" data-detail-panel="${key}"${activeTab === key ? "" : " hidden"}>${html}</div>`;
        detailBody = `<div class="detail-tabs" role="tablist">${tabs.map(([key, label]) => `<button type="button" role="tab" class="${activeTab === key ? "active" : ""}" aria-selected="${activeTab === key}" data-detail-tab="${key}">${label}</button>`).join("")}</div>`
          + (slots.episodes.length ? panel("episodes", part.episodes) : "")
          + panel("overview", [part.overview, part.trailer, part.tracking, part.facts, item.category === "series" ? "" : part.tags, part.breakdown, part.media, part.stores, part.requirements, part.languages, part.other, part.related, part.links].join(""))
          + (slots.ratings.length ? panel("ratings", part.ratings) : "")
          + (slots.cast.length ? panel("cast", part.cast) : "");
      } else {
        detailBody = [part.overview, part.tracking, part.facts, part.media, part.trailer, part.ratings, part.episodes, part.stores, item.category === "series" ? "" : part.tags, part.breakdown, part.requirements, part.cast, part.languages, part.related, part.other, part.links].join("");
      }
      return `<div class="detail-page demo-cinema-page demo-title-page ${item.category === "series" ? "demo-show-page" : "demo-movie-page"}">
        <header class="detail-page-heading demo-detail-heading"><button type="button" class="detail-back" ${context.detailStackSize ? "data-detail-back" : `data-go="${esc(detailReturnPage)}"`}><span aria-hidden="true">‹</span> Back</button><strong class="detail-heading-title">${esc(canProgress ? item.title : (loaded.title || item.title))}</strong>${detailPreview ? "<span></span>" : detailEditMode ? `<span class="detail-heading-actions detail-edit-actions"><button type="button" class="button secondary small" data-action="cancel-detail-edit">Cancel</button><button type="button" class="button primary small" data-detail-save>Save</button></span>` : `<span class="detail-heading-actions"><button type="button" class="detail-icon-button" data-action="share-title" data-id="${esc(item.id)}" aria-label="Share title" title="Share title"><i data-lucide="share-2"></i></button><button type="button" class="detail-icon-button" data-action="edit" data-id="${esc(item.id)}" aria-label="Edit entry" title="Edit entry"><i data-lucide="pencil"></i></button><button type="button" class="detail-icon-button${item.favorite ? " active" : ""}" data-action="toggle-favorite" data-id="${esc(item.id)}" aria-pressed="${Boolean(item.favorite)}" aria-label="Favorite" title="Favorite"><i data-lucide="heart"></i></button><button type="button" class="detail-delete-button" data-action="delete-detail" data-id="${esc(item.id)}" aria-label="Delete from collection" title="Delete from collection"><i data-lucide="trash2"></i></button></span>`}</header>
        ${detailPreview ? `<div class="toolbar detail-toolbar"><button type="button" class="button primary small" data-action="save-detail-item">＋ Add to library</button></div>` : ""}
        <article class="detail-hero ios-hero">
          <div class="ios-hero-bg"${(landscape || image) ? ` style="background-image:url('${esc(landscape || image)}')"` : ""}><span class="hero-source-badge"><i data-lucide="${item.category === "movie" ? "film" : "tv"}" aria-hidden="true"></i>${esc(item.metadataSource === "mix" ? `Mix · ${(loaded.mixSources || []).join(" + ") || "all sources"}` : source?.name || item.metadataSource || "ScreenMark")} • ${esc(category(item.category)?.singular || labelCategory(item.category))}</span></div>
          <div class="ios-hero-body">
            ${image ? detailImage : `<div class="detail-image-placeholder">${esc(category(item.category)?.icon || "✦")}</div>`}
            <div class="detail-hero-copy">
              ${(() => { const label = `${item.category === "movie" ? "🎞" : "📺"} ${source?.name || item.metadataSource || "ScreenMark"} · ${category(item.category)?.singular || labelCategory(item.category)}`; return sourceUrl ? `<a class="dh-source-tag" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : `<span class="dh-source-tag">${esc(label)}</span>`; })()}
              <h2>${esc(canProgress ? item.title : (loaded.title || item.title))}</h2>
              <div class="detail-badges">${facts.slice(0, 3).map(([label, value]) => label === "Rating" ? `<span class="is-rating">★ ${esc(String(value).replace(/^★\s*/, ""))}</span>` : `<span class="${label === "Year" ? "is-year" : ""}">${esc(detailValue(value))}</span>`).join("")}${canProgress ? `<span class="ios-status-badge${item.status === (category(item.category)?.statuses || []).slice(-1)[0] ? " is-done" : ""}">${esc(item.status)}</span>` : ""}${(() => { const m = Number(item.facts?.runtimeMinutes || loaded.facts?.runtimeMinutes) || 0; return m ? `<span class="is-runtime">${m}${item.category === "movie" ? " min" : "m"}</span>` : ""; })()}${loaded.badge ? `<span class="detail-age-badge">${esc(loaded.badge)}</span>` : ""}</div>
              ${(loaded.tags || []).length ? `<p class="detail-genres">${esc(loaded.tags.slice(0, 4).join(" · "))}</p>` : ""}
            </div>
          </div>
          ${purchase}
        </article>
        ${detailLoading ? `<p class="app-info detail-loading">Loading full details from ${esc(source?.name || "the metadata source")}…</p>` : ""}
        ${detailError ? `<div class="detail-error"><p>${esc(detailError)}</p><button class="button secondary small" data-action="refresh-details">Try again</button></div>` : ""}
        ${canProgress && detailEditMode ? `<form id="detail-edit-form" class="detail-edit-form"><label>Title<input name="title" required maxlength="180" value="${esc(item.title)}"></label><label>Status<span class="detail-select-wrap"><select name="status">${statuses.map(status => `<option value="${esc(status)}" ${status === item.status ? "selected" : ""}>${esc(status)}</option>`).join("")}</select><i data-lucide="chevron-down" aria-hidden="true"></i></span></label><div class="detail-edit-numbers"><label>Progress<input name="progress" type="number" min="0" step="${esc(prefs.progressIncrement || 1)}" value="${progress}"></label><label>Goal<input name="goal" type="number" min="0" step="1" value="${goal}"></label></div></form>` : ""}
        <div class="detail-body-grid"><aside class="demo-detail-console">${unifiedProgress}${canProgress && !detailEditMode ? `<section class="detail-manage-card inline-tools-strip" aria-label="Metadata and artwork"><button type="button" class="detail-manage-btn mini-tool-btn" data-fix-match="${esc(item.id)}"><i data-lucide="link" aria-hidden="true"></i>Fix match</button><button type="button" class="detail-manage-btn mini-tool-btn" data-change-cover="${esc(item.id)}"><i data-lucide="image" aria-hidden="true"></i>Change poster</button></section>` : ""}</aside><div class="demo-detail-content">${detailBody}</div></div>
        <dialog class="detail-image-modal" id="detail-image-modal" aria-label="Image viewer"><button type="button" class="detail-image-modal-close" data-detail-image-close aria-label="Close image">×</button><button type="button" class="detail-image-modal-nav detail-image-modal-prev" data-detail-image-prev aria-label="Previous image">‹</button><figure><img data-detail-modal-img alt=""><figcaption data-detail-modal-caption></figcaption></figure><button type="button" class="detail-image-modal-nav detail-image-modal-next" data-detail-image-next aria-label="Next image">›</button></dialog>
      </div>`;
    }

    return renderDetails();
  };
})();
