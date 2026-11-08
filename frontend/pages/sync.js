// Refresh status and provider match review, kept separate from the Metadata settings form.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.sync = context => {
    const { metadataSyncState, metadataSyncCounts, itemById, esc } = context;
    const entries = metadataSyncState?.entries || [];
    const counts = metadataSyncCounts || { changed: 0, unchanged: 0, failed: 0, skipped: 0, remaining: 0 };
    const updated = counts.changed;
    const unchanged = counts.unchanged;
    const failed = counts.failed;
    const remaining = counts.remaining;
    const heading = `<header class="settings-page-heading settings-subpage-heading"><a class="settings-back" href="#settings/metadata-sync"><span aria-hidden="true">‹</span> Metadata Sync</a><h1>Refresh status</h1><button type="button" class="sync-refresh-action" data-metadata-sync-action="start" aria-label="Refresh metadata" title="Refresh metadata" ${remaining ? "disabled" : ""}><i data-lucide="refresh-cw" aria-hidden="true"></i></button></header>`;
    const sourceByKey = new Map((window.SplitAppSources?.list?.() || []).map(source => [source.key, source.name]));
    const state = entries.length ? `<section class="sync-summary-card" aria-live="polite">
      <div class="sync-summary-head"><span class="sync-summary-icon"><i data-lucide="${remaining ? "loader-circle" : failed ? "circle-alert" : "circle-check"}" aria-hidden="true"></i></span><div><strong>${remaining ? "Refresh in progress" : failed ? "Refresh finished with errors" : "Refresh finished"}</strong><small>${updated} changed · ${unchanged} unchanged · ${failed} failed · ${counts.skipped || 0} skipped · ${remaining} remaining</small></div></div>
      <div class="sync-summary-actions">${failed ? `<button type="button" class="button secondary" data-metadata-sync-action="retry">Retry failed</button>` : ""}<button type="button" class="button secondary" data-metadata-sync-action="clear" ${remaining ? "disabled" : ""}>Clear history</button></div>
      <ol class="sync-entry-list">${entries.slice(0, 200).map(row => {
        const item = itemById?.(row.id), category = row.category || item?.category, providerId = row.providerId || item?.providerId, sourceName = sourceByKey.get(row.source || item?.metadataSource), checkedAt = item?.metadataFetchedAt ? new Date(Number(item.metadataFetchedAt)).toLocaleString() : "", meta = [sourceName, category === "movie" ? "Movie" : category === "series" ? "Series" : "", providerId ? `ID ${providerId}` : "", checkedAt ? `Checked ${checkedAt}` : ""].filter(Boolean).join(" · "), status = ({ done: "Updated", checked: "Unchanged", running: "Checking", queued: "Queued", failed: "Failed", skipped: "Skipped" })[row.status] || row.status;
        return `<li class="sync-entry sync-entry-${esc(row.status)}"><div class="sync-entry-heading"><span class="sync-entry-state">${esc(status)}</span>${row.status === "failed" ? `<button type="button" class="button secondary small" data-metadata-sync-action="retry" data-id="${esc(row.id)}"><i data-lucide="rotate-cw" aria-hidden="true"></i><span>Retry</span></button>` : ""}</div><div class="sync-entry-title">${item ? `<button type="button" class="sync-entry-open" data-open-details data-id="${esc(row.id)}">${esc(row.title || item.title || "Saved title")}</button>` : `<strong>${esc(row.title || "Saved title")}</strong>`}${meta ? `<small class="sync-entry-meta">${esc(meta)}</small>` : ""}${row.error ? `<small class="sync-entry-error">${esc(row.error)}</small>` : ""}</div></li>`;
      }).join("")}${entries.length > 200 ? `<li class="sync-note">Showing the first 200 of ${entries.length} refresh records.</li>` : ""}</ol>
    </section>` : `<section class="sync-empty"><span><i data-lucide="database-zap" aria-hidden="true"></i></span><h2>No refresh history yet</h2><p>Refresh saved movies and series from the enabled metadata sources.</p><button type="button" class="button primary" data-metadata-sync-action="start">Refresh saved metadata</button></section>`;
    return `<section class="settings-page settings-detail-page sync-page">${heading}${state}</section>`;
  };
})();
