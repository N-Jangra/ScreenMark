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
        : String(value ?? "");

    const safeUrl = value => {
      try {
        const url = new URL(String(value || ""));
        return ["https:", "http:"].includes(url.protocol) ? url.href : "";
      } catch { return ""; }
    };
    const safeImage = value => /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || "")) ? String(value) : safeUrl(value);

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
    const episodeGuide = (section, rows, watchedIds, canToggle, item, sectionIndex, imageButton) => {
      const seasons = [...new Set(rows.map(row => row.season))].sort((a, b) => a - b);
      return `<div class="season-list">${seasons.map((season, seasonIndex) => {
        const list = rows.filter(row => row.season === season), info = section.seasons?.[season] || {};
        const done = list.filter(row => watchedIds.has(String(row.id))).length, rated = list.filter(row => row.rating);
        const average = rated.length ? (rated.reduce((sum, row) => sum + row.rating, 0) / rated.length).toFixed(1) : "";
        const cover = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.seasons.${season}.image`] || info.image) || safeImage(list.find(row => row.image)?.image);
        const ids = list.map(row => row.id).join(",");
        return `<details class="season-block"${seasonIndex === 0 ? " open" : ""}><summary><span class="season-art">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : ""}</span><span class="season-head"><strong>Season ${esc(season)}</strong><small>${list.length} episodes${info.premiere ? ` · ${esc(String(info.premiere).slice(0, 4))}` : ""}${average ? ` · ★ ${average}` : ""}</small>${canToggle ? `<span class="season-progress"><i style="width:${Math.round(done / list.length * 100)}%"></i></span>` : ""}</span>${canToggle ? `<span class="season-count">${done}/${list.length}</span>` : ""}<span aria-hidden="true" class="season-chevron">›</span></summary>${canToggle ? `<button type="button" class="season-all" data-season-toggle="${esc(ids)}" data-season-done="${done === list.length}">${done === list.length ? "Uncheck season" : "Check whole season"}</button>` : ""}${seasonIndex === 0 ? "" : "<template data-lazy-season>"}<ul class="episode-list">${list.map(row => {
          const watched = watchedIds.has(String(row.id)), thumb = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.items.${rows.indexOf(row)}.image`] || row.image);
          const check = canToggle ? `<button type="button" class="episode-check ${watched ? "is-watched" : ""}" data-episode-toggle data-episode-id="${esc(row.id)}" data-episode-title="${esc(`S${row.season}E${row.number} ${row.title}`)}" role="checkbox" aria-checked="${watched}" aria-label="Mark ${esc(row.title)} watched">${watched ? "✓" : ""}</button>` : "";
          const meta = [row.airdate, row.runtime ? `${row.runtime} min` : ""].filter(Boolean).join(" · ");
          return `<li class="episode-row${watched ? " is-watched" : ""}">${check}${refButton(row.ref || { type: "episode", id: row.id }, "episode-main", `<span class="episode-thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async">` : ""}</span><span class="episode-text"><strong>${esc(row.number ? `${row.number}. ` : "")}${esc(row.title)}</strong>${meta ? `<small>${esc(meta)}</small>` : ""}${row.description ? `<em>${esc(row.description)}</em>` : ""}</span>`)}${row.rating ? `<span class="episode-rating ${ratingTone(row.rating)}">★ ${Number(row.rating).toFixed(1)}</span>` : ""}</li>`;
        }).join("")}</ul>${seasonIndex === 0 ? "" : "</template>"}</details>`;
      }).join("")}</div>`;
    };

    const renderRefPage = () => {
      const data = context.refData, kind = context.detailRef?.type;
      const back = `<header class="detail-page-heading"><button type="button" class="button secondary small" data-detail-back>‹ Back</button><span class="detail-heading-spacer" aria-hidden="true"></span><span></span></header>`;
      if (context.refLoading && !data) return `<div class="detail-page">${back}<p class="app-info detail-loading">Loading from TVmaze…</p></div>`;
      if (!data) return `<div class="detail-page">${back}<div class="detail-error"><p>${esc(context.refError || "Could not load this page.")}</p><button class="button secondary small" data-detail-ref-retry>Try again</button></div></div>`;
      const image = safeImage(data.image);
      const hero = `<article class="detail-hero ios-hero ref-hero"><div class="ios-hero-body">${image ? `<button type="button" class="detail-image-trigger detail-cover-trigger${data.landscape ? " is-landscape" : ""}" data-detail-image-src="${esc(image)}" data-detail-image-label="${esc(data.title)}"><img class="detail-image" src="${esc(image)}" alt="" onerror="this.hidden=true"></button>` : `<div class="detail-image-placeholder">✦</div>`}<div class="detail-hero-copy"><p class="eyebrow">TVmaze · ${esc(kind)}</p><h2>${esc(data.title)}</h2>${data.subtitle ? `<p class="detail-description">${esc(data.subtitle)}</p>` : ""}<div class="detail-badges">${(data.facts || []).map(([label, value]) => `<span>${esc(label)}: ${esc(value)}</span>`).join("")}</div></div></div></article>`;
      const sections = (data.sections || []).map(section => {
        const body = section.kind === "episodes-list"
          ? `<ul class="episode-list">${section.items.map(row => `<li class="episode-row">${refButton(row.ref, "episode-main", `<span class="episode-thumb">${safeImage(row.image) ? `<img src="${esc(safeImage(row.image))}" alt="" loading="lazy">` : ""}</span><span class="episode-text"><strong>${esc(row.title)}</strong>${row.meta ? `<small>${esc(row.meta)}</small>` : ""}</span>`)}</li>`).join("")}</ul>`
          : `<div class="detail-carousel">${section.items.map(row => {
              const art = safeImage(row.image), inner = `<span class="detail-carousel-art">${art ? `<img src="${esc(art)}" alt="" loading="lazy">` : ""}</span><strong>${esc(row.title)}</strong>${row.meta ? `<small>${esc(row.meta)}</small>` : ""}`;
              const ref = section.kind === "shows" ? { type: "show", id: row.id, title: row.title } : row.ref;
              return ref ? refButton(ref, "detail-carousel-card", inner) : `<div class="detail-carousel-card">${inner}</div>`;
            }).join("")}</div>`;
        return `<section class="detail-section"><h3>${esc(section.title)}</h3>${body}</section>`;
      }).join("");
      return `<div class="detail-page">${back}${hero}${data.description ? `<section class="detail-section"><h3>Overview</h3><p class="detail-description">${esc(data.description)}</p></section>` : ""}${sections}${safeUrl(data.url) ? `<section class="detail-section"><div class="detail-link-list"><a href="${esc(safeUrl(data.url))}" target="_blank" rel="noopener noreferrer">Open on TVmaze ↗</a></div></section>` : ""}<dialog class="detail-image-modal" id="detail-image-modal" aria-label="Image viewer"><button type="button" class="detail-image-modal-close" data-detail-image-close aria-label="Close image">×</button><button type="button" class="detail-image-modal-nav detail-image-modal-prev" data-detail-image-prev aria-label="Previous image">‹</button><figure><img data-detail-modal-img alt=""><figcaption data-detail-modal-caption></figcaption></figure><button type="button" class="detail-image-modal-nav detail-image-modal-next" data-detail-image-next aria-label="Next image">›</button></dialog></div>`;
    };

    const renderSection = (section, watchedIds = new Set(), canToggleEpisodes = false, item = null, sectionIndex = 0, imageButton = () => "") => {
      const items = section.items || [];
      const body = section.kind === "carousel"
        ? `<div class="detail-carousel">${items.map((entry, entryIndex) => {
            const href = safeUrl(entry.url);
            const image = safeImage(item?.localImageData?.[`cachedDetails.sections.${sectionIndex}.items.${entryIndex}.image`] || entry.image);
            const inner = `<span class="detail-carousel-art">${image ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async">` : ""}</span><strong>${esc(entry.title || "Untitled")}</strong>${entry.meta ? `<small>${esc(detailValue(entry.meta))}</small>` : ""}`;
            return entry.ref ? refButton(entry.ref, "detail-carousel-card", inner) : href ? `<a class="detail-carousel-card" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="detail-carousel-card">${inner}</div>`;
          }).join("")}</div>`
        : section.kind === "ratings" ? ratingsGrid(items)
        : section.kind === "episodes" ? episodeGuide(section, items, watchedIds, canToggleEpisodes, item, sectionIndex, imageButton)
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
      return section.collapsed
        ? `<details class="detail-section detail-collapsible"><summary><h3>${esc(section.title || "More details")}</h3><span aria-hidden="true">›</span></summary>${body}</details>`
        : `<section class="detail-section"><h3>${/^(cast|characters|staff)/i.test(section.title || "") && items.length > 8 && section.kind === "carousel" ? `<span class="detail-section-head">${esc(section.title)}<button type="button" class="detail-full-list" data-carousel-expand>Full list</button></span>` : esc(section.title || "More details")}</h3>${body}</section>`;
    };

    function renderDetails() {
      if (context.detailRef) return renderRefPage();
      const item = detailPreview || items.find(row => row.id === detailItemId);
      if (!item) return `<div class="empty-state"><strong>That entry is no longer in your library.</strong><button class="button secondary" data-go="${esc(detailReturnPage)}">Back to library</button></div>`;

      const source = window.SplitAppMetadata.providers.find(row => row.key === (item.metadataSource || item.source));
      const loaded = detailData || {};
      const image = safeImage(item.localThumbnailData || item.localImageData?.["image"] || item.localImageData?.["cachedDetails.portraitImage"] || item.localImageData?.["cachedDetails.image"] || loaded.portraitImage || loaded.image || item.image);
      const landscape = safeImage(item.localImageData?.["cachedDetails.landscapeImage"] || item.localImageData?.["cachedDetails.backgroundImage"] || loaded.landscapeImage || loaded.backgroundImage);
      const summary = loaded.description || item.description || item.summary || "No description is available for this entry yet.";
      const sourceUrl = safeUrl(loaded.url || item.url || item.providerUrl);
      const goal = Math.max(0, Number(item.goal || loaded.goal) || (category(item.category)?.unit === "minutes" ? Number(loaded.facts?.runtimeMinutes) : 0) || 0);
      const progress = Math.max(0, Number(item.progress) || 0);
      const percent = goal ? Math.max(0, Math.min(100, Math.round(progress / goal * 100))) : 0;
      const unit = category(item.category)?.unit || "";
      const facts = [
        ["Year", loaded.year || item.year],
        ["Rating", loaded.rating || item.rating ? `★ ${loaded.rating || item.rating}` : ""]
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
      const maxRating = prefs?.ratingFormat === "10-point" ? 10 : 5;
      const ratingControl = maxRating === 5
        ? `<div class="detail-rating-stars" role="radiogroup" aria-label="Rating">${Array.from({ length: 5 }, (_, index) => { const score = index + 1; const active = score <= Number(item.rating); return `<button type="button" data-detail-rating="${score}" role="radio" aria-label="${score} out of 5" aria-checked="${active}"><i data-lucide="star" class="${active ? "active" : ""}"></i></button>`; }).join("")}</div>`
        : `<label class="detail-rating-select"><span>Rating</span><span class="detail-select-wrap"><select data-detail-rating-select aria-label="Rating"><option value="0">No rating</option>${Array.from({ length: 10 }, (_, index) => `<option value="${index + 1}" ${Number(item.rating) === index + 1 ? "selected" : ""}>${index + 1} / 10</option>`).join("")}</select><i data-lucide="chevron-down" aria-hidden="true"></i></span></label>`;

      const watchedSet = new Set((item.watchedEpisodeIds || []).map(String));
      const indexedSections = sections.map((section, index) => ({ section, index })), taken = new Set();
      const takeSlot = pattern => indexedSections.filter(({ section, index }) => !taken.has(index) && pattern.test(section.title || "") && taken.add(index));
      const slots = { media: takeSlot(/^(trailers|images|screenshots)/i), cast: takeSlot(/^(cast|characters|staff)/i), ratings: indexedSections.filter(({ section, index }) => !taken.has(index) && section.kind === "ratings" && taken.add(index)), episodes: indexedSections.filter(({ section, index }) => !taken.has(index) && section.kind === "episodes" && taken.add(index)), related: takeSlot(/^(related|you might also like|same series)/i) };
      slots.other = indexedSections.filter(({ index }) => !taken.has(index));
      const renderRows = rows => rows.map(({ section, index }) => renderSection(section, watchedSet, canProgress, item, index, popupImageButton)).join("");
      return `<div class="detail-page">
        <header class="detail-page-heading"><button type="button" class="button secondary small" ${context.detailStackSize ? "data-detail-back" : `data-go="${esc(detailReturnPage)}"`}>‹ Back</button><span class="detail-heading-spacer" aria-hidden="true"></span>${detailPreview ? "<span></span>" : `<span class="detail-heading-actions"><button type="button" class="detail-icon-button${item.favorite ? " active" : ""}" data-action="toggle-favorite" data-id="${esc(item.id)}" aria-pressed="${Boolean(item.favorite)}" aria-label="Favorite" title="Favorite"><i data-lucide="heart"></i></button><button type="button" class="detail-delete-button" data-action="delete-detail" data-id="${esc(item.id)}" aria-label="Delete from collection" title="Delete from collection"><i data-lucide="trash2"></i></button></span>`}</header>
        <div class="toolbar detail-toolbar">
          ${detailPreview
            ? `<button type="button" class="button primary small" data-action="save-detail-item">＋ Add to library</button>`
            : detailEditMode ? `<button type="button" class="button secondary small" data-action="cancel-detail-edit">Cancel</button><button type="button" class="button primary small" data-detail-save>Save changes</button>` : `<button type="button" class="button secondary small" data-action="edit" data-id="${esc(item.id)}">Edit entry</button>`}
          ${canProgress ? `<button type="button" class="button primary small" data-action="progress" data-id="${esc(item.id)}">＋ ${item.category === "series" ? "Next episode" : "Log minutes"}</button>` : ""}
          ${item.metadataSource && item.providerId ? `<button type="button" class="button secondary small" data-action="refresh-details" ${detailLoading ? "disabled" : ""}>${detailLoading ? "Refreshing…" : "Refresh source"}</button>` : ""}
        </div>
        <article class="detail-hero ios-hero">
          <div class="ios-hero-bg"${(landscape || image) ? ` style="background-image:url('${esc(landscape || image)}')"` : ""}></div>
          <div class="ios-hero-body">
            ${image ? detailImage : `<div class="detail-image-placeholder">${esc(category(item.category)?.icon || "✦")}</div>`}
            <div class="detail-hero-copy">
              <p class="eyebrow">${esc(item.metadataSource === "mix" ? `Mix · ${(loaded.mixSources || []).join(" + ") || "all sources"}` : source?.name || item.metadataSource || "SCREENMARK")}${` • ${esc(category(item.category)?.singular || labelCategory(item.category))}`}</p>
              <h2>${esc(loaded.title || item.title)}</h2>
              ${(loaded.tags || []).length ? `<p class="detail-genres">${esc(loaded.tags.slice(0, 4).join(", "))}</p>` : ""}
              <div class="detail-badges">${canProgress ? `<span class="ios-status-badge">${esc(item.status)}</span>` : ""}${facts.slice(0, 3).map(([label, value]) => `<span>${esc(label === "Rating" ? value : detailValue(value))}</span>`).join("")}${loaded.badge ? `<span class="detail-age-badge">${esc(loaded.badge)}</span>` : ""}${sourceUrl ? `<a class="detail-source-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source page ↗</a>` : ""}</div>
            </div>
          </div>
          ${purchase}
        </article>
        ${detailLoading ? `<p class="app-info detail-loading">Loading full details from ${esc(source?.name || "the metadata source")}…</p>` : ""}
        ${detailError ? `<div class="detail-error"><p>${esc(detailError)}</p><button class="button secondary small" data-action="refresh-details">Try again</button></div>` : ""}
        ${canProgress && detailEditMode ? `<form id="detail-edit-form" class="detail-edit-form"><label>Title<input name="title" required maxlength="180" value="${esc(item.title)}"></label><label>Status<span class="detail-select-wrap"><select name="status">${statuses.map(status => `<option value="${esc(status)}" ${status === item.status ? "selected" : ""}>${esc(status)}</option>`).join("")}</select><i data-lucide="chevron-down" aria-hidden="true"></i></span></label><div class="detail-edit-numbers"><label>Progress<input name="progress" type="number" min="0" step="${esc(prefs.progressIncrement || 1)}" value="${progress}"></label><label>Goal<input name="goal" type="number" min="0" step="1" value="${goal}"></label></div></form>` : ""}
        ${canProgress && item.category === "series" ? (() => {
          const info = window.SplitAppLibrary.episodeInfo(item); if (!info) return "";
          const ago = (() => { const diff = Date.now() - (Number(item.updatedAt) || 0), minutes = Math.round(diff / 60000); return !item.updatedAt || !info.done ? "" : minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1440)}d ago`; })();
          const percent = Math.round(info.done / info.total * 100), all = info.done === info.total;
          return `<section class="detail-episode-summary"><div class="detail-episode-line"><span>${info.done}/${info.total} episodes · ${percent}%</span>${ago ? `<small>last watched ${esc(ago)}</small>` : ""}</div><div class="progress-line"><span style="width:${percent}%"></span></div><div class="detail-episode-actions"><button type="button" class="button primary" data-action="mark-all-watched" data-id="${esc(item.id)}">${all ? "✓ All watched — undo" : "✓ Mark all watched"}</button>${info.next ? `<button type="button" class="button secondary" data-action="watch-next" data-id="${esc(item.id)}">Next · ${esc(info.mark(info.next))}</button>` : ""}</div></section>`;
        })() : ""}
        ${canProgress ? (() => {
          const cat = category(item.category) || {}, stepSize = cat.step || 1, short = cat.unit === "minutes" ? "m" : "ep";
          const quick = [-1, 1, cat.unit === "minutes" ? 3 : 5].map(multiple => multiple * stepSize);
          const runtime = Number(item.facts?.runtimeMinutes || loaded.facts?.runtimeMinutes) || 0;
          const leftUnits = goal ? Math.max(0, goal - progress) : 0;
          const leftMinutes = cat.unit === "minutes" ? leftUnits : leftUnits * runtime;
          const leftText = !goal ? "" : !leftUnits ? "finished" : leftMinutes ? `${leftMinutes >= 60 ? `${Math.floor(leftMinutes / 60)}h ${leftMinutes % 60 ? `${leftMinutes % 60}m` : ""}`.trim() : `${leftMinutes}m`} left` : `${leftUnits} ${cat.unit} left`;
          return `<section class="detail-progress-card"><div class="ios-progress-head"><div><span>Watch progress</span><strong>${progress}${goal ? `<small> / ${goal} ${esc(unit)}</small>` : `<small> ${esc(unit)}</small>`}</strong></div><div class="ios-stepper">${quick.map((amount, index) => `<button type="button"${index === 1 ? ' class="accent"' : ""} data-adjust-progress="${amount}">${amount < 0 ? "−" : "+"}${Math.abs(amount)}${short}</button>`).join("")}</div></div><div class="progress-line"><span style="width:${percent}%"></span></div><small>${goal ? `${percent}% watched${leftText ? ` • ${leftText}` : ""}` : "Edit the entry to set a total and track completion."}</small></section>`;
        })() : ""}
        ${canProgress ? `<section class="detail-section detail-tracking-section"><h3>Tracking &amp; Rating</h3><span class="ios-sub">Status</span><div class="ios-pills detail-status-pills">${statuses.map(status => `<button type="button" class="ios-pill${status === item.status ? " active" : ""}" data-detail-status-btn="${esc(status)}">${esc(status)}</button>`).join("")}</div><div class="detail-tracking-row"><span>My Rating</span>${ratingControl}</div></section><dialog class="choice-dialog detail-delete-dialog" id="detail-delete-dialog"><form method="dialog"><div class="choice-dialog-grabber"></div><h2>Delete ${esc(item.title)}?</h2><p>This removes the game from your collection.</p><footer class="choice-dialog-actions"><button type="button" class="button secondary" data-detail-delete-cancel>Cancel</button><button type="button" class="button primary" data-detail-delete-confirm>Delete</button></footer></form></dialog>` : ""}
        ${renderRows(slots.media)}
        <section class="detail-section"><h3>Overview</h3><p class="detail-description">${esc(summary)}</p></section>
        ${loaded.trailer && safeUrl(loaded.trailer.url) ? `<section class="detail-section"><h3>Official trailer</h3><a class="detail-trailer" href="${esc(safeUrl(loaded.trailer.url))}" target="_blank" rel="noopener noreferrer">${safeImage(loaded.trailer.image) ? `<img src="${esc(safeImage(loaded.trailer.image))}" alt="" loading="lazy">` : ""}<span class="detail-trailer-play" aria-hidden="true">▶</span><strong>${esc(loaded.trailer.title || "Watch trailer")}</strong></a></section>` : ""}
        ${renderRows(slots.ratings)}
        ${renderRows(slots.episodes)}
        ${(loaded.stores || []).length ? `<section class="detail-section detail-stores"><h3>Where to buy</h3><div class="detail-store-list">${loaded.stores.map(row => safeUrl(row.url) ? `<a class="button secondary small" href="${esc(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer">${esc(row.name)} ↗</a>` : "").join("")}</div></section>` : ""}
        ${(loaded.tags || []).length ? `<section class="detail-section"><h3>Tags</h3><div class="detail-chips">${loaded.tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div></section>` : ""}
        ${(loaded.ratingBreakdown || []).length ? `<section class="detail-section detail-rating-breakdown"><h3>Player ratings${loaded.ratingCount ? ` · ${Number(loaded.ratingCount).toLocaleString()}` : ""}</h3><div class="rating-bar" role="img" aria-label="${esc(loaded.ratingBreakdown.map(row => `${row.label} ${row.percent}%`).join(", "))}">${loaded.ratingBreakdown.map((row, index) => `<span class="rating-seg rating-seg-${index % 4}" style="width:${Math.max(2, Number(row.percent) || 0)}%"></span>`).join("")}</div><div class="rating-legend">${loaded.ratingBreakdown.map((row, index) => `<span><i class="rating-seg-${index % 4}"></i>${esc(row.label)} <b>${esc(row.percent)}%</b></span>`).join("")}</div></section>` : ""}
        ${facts.length || fields.length ? `<section class="detail-section"><h3>Details</h3><div class="detail-facts">${facts.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(detailValue(value))}</strong></div>`).join("")}${fields.map(row => `<div><span>${esc(row.label)}</span><strong>${esc(detailValue(row.value))}</strong></div>`).join("")}</div></section>` : ""}
        ${loaded.requirements ? (() => {
          const { minimum = [], recommended = [] } = loaded.requirements;
          const labels = [...new Set([...minimum, ...recommended].map(([label]) => label))];
          const get = (rows, label) => rows.find(([key]) => key === label)?.[1] || "";
          const both = minimum.length && recommended.length;
          return `<section class="detail-section detail-requirements"><h3>System requirements</h3><div class="detail-table-wrap"><table class="detail-table req-table"><thead><tr><th scope="col"></th>${minimum.length ? "<th scope=\"col\">Minimum</th>" : ""}${recommended.length ? "<th scope=\"col\">Recommended</th>" : ""}</tr></thead><tbody>${labels.map(label => `<tr><th scope="row">${esc(label)}</th>${minimum.length ? `<td>${esc(get(minimum, label)) || "—"}</td>` : ""}${recommended.length ? `<td>${esc(get(recommended, label)) || "—"}</td>` : ""}</tr>`).join("")}</tbody></table></div>${both ? "" : ""}</section>`;
        })() : ""}
        ${renderRows(slots.cast)}
        ${(loaded.languages || []).length ? `<details class="detail-section detail-collapsible detail-languages"><summary><h3>Languages (${loaded.languages.length})</h3><span aria-hidden="true">›</span></summary><div class="detail-table-wrap"><table class="detail-table lang-table"><thead><tr><th scope="col">Language</th><th scope="col">Interface</th><th scope="col">Full audio</th></tr></thead><tbody>${loaded.languages.map(row => `<tr><th scope="row">${esc(row.name)}</th><td class="lang-yes">✓</td><td class="${row.audio ? "lang-yes" : "lang-no"}">${row.audio ? "✓" : "—"}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
        ${renderRows(slots.related)}
        ${renderRows(slots.other)}
        ${links.length ? `<section class="detail-section"><h3>Links</h3><div class="detail-link-list">${links.map(link => `<a href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">${esc(link.label || link.title || link.site || link.href)} ↗</a>`).join("")}</div></section>` : ""}
        <dialog class="detail-image-modal" id="detail-image-modal" aria-label="Image viewer"><button type="button" class="detail-image-modal-close" data-detail-image-close aria-label="Close image">×</button><button type="button" class="detail-image-modal-nav detail-image-modal-prev" data-detail-image-prev aria-label="Previous image">‹</button><figure><img data-detail-modal-img alt=""><figcaption data-detail-modal-caption></figcaption></figure><button type="button" class="detail-image-modal-nav detail-image-modal-next" data-detail-image-next aria-label="Next image">›</button></dialog>
      </div>`;
    }

    return renderDetails();
  };
})();
