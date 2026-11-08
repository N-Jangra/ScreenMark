// Share a library list as a PDF.
(() => {
  const native = () => window.Capacitor?.Plugins?.ShareIntent;
  const fit = (ctx, text, max) => {
    let value = String(text || "");
    if (ctx.measureText(value).width <= max) return value;
    while (value.length > 1 && ctx.measureText(value + "…").width > max) value = value.slice(0, -1);
    return value.trimEnd() + "…";
  };
  const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const loadImage = url => new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = url; });

  // Covers load once per title and slow requests can be reused by the PDF builder.
  const coverJobs = new Map();
  const coverOf = (entry, getImage) => {
    if (!coverJobs.has(entry.id)) {
      coverJobs.set(entry.id, getImage(entry).catch(() => null));
      while (coverJobs.size > 64) coverJobs.delete(coverJobs.keys().next().value);
    }
    const job = coverJobs.get(entry.id);
    coverJobs.delete(entry.id); coverJobs.set(entry.id, job);
    return job;
  };
  // Resolve any CSS colour expression (vars, color-mix) to rgb() so the canvas follows the active theme.
  const probe = document.createElement("span");
  const resolve = (expr, fallback) => { try { probe.style.color = ""; probe.style.color = expr; document.body.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return c || fallback; } catch (_) { return fallback; } };
  const withAlpha = (color, alpha) => { const m = String(color).match(/rgba?\(([^)]+)\)/); if (!m) return color; const [r, g, b] = m[1].split(/[ ,\/]+/).map(Number); return `rgba(${r},${g},${b},${alpha})`; };
  const themeColors = (mode = "app") => {
    const current = {
    page: getComputedStyle(document.body).backgroundColor || "#f2f3f9",
    card: resolve("var(--surface)", "#fff"), card2: resolve("var(--surface-2)", "#f2f3f9"), line: resolve("var(--line)", "#e8eaf2"),
    text: getComputedStyle(document.body).color || "#1c2030", muted: resolve("var(--muted)", "#7a8094"), accent: resolve("var(--accent)", "#6355f5"),
    status: s => resolve(`var(--status-color-${String(s || "").toLowerCase().replace(/\s+/g, "-")}, var(--accent))`, "#6355f5")
    };
    if (mode === "light") return { ...current, page: "#f8fafc", card: "#ffffff", card2: "#f1f5f9", line: "#d8dee8", text: "#172033", muted: "#667085" };
    if (mode === "dark") return { ...current, page: "#111318", card: "#1b1e25", card2: "#242832", line: "#373d49", text: "#f4f6fb", muted: "#a7afbd" };
    return current;
  };


  const slug = value => String(value).normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "screenmark";

  const PDF_ROWS_PER_PAGE = 16, PDF_GRID_ITEMS_PER_PAGE = 9;
  const closeImageBitmap = image => { try { image?.close?.(); } catch (_) {} };
  async function loadCoversFor(entries, getImage) {
    const withTimeout = (promise, ms, closeLate = false) => new Promise(resolve => {
      const timer = setTimeout(() => {
        if (closeLate) promise.then(closeImageBitmap, () => {});
        resolve(undefined);
      }, ms);
      promise.then(image => { clearTimeout(timer); resolve(image); }, () => { clearTimeout(timer); resolve(null); });
    });
    const images = new Array(entries.length);
    let next = 0;
    const reportedMemory = Number(navigator.deviceMemory) || 4;
    const workers = Math.min(entries.length, reportedMemory <= 2 ? 2 : 4);
    await Promise.all(Array.from({ length: workers }, async () => {
      while (next < entries.length) {
        const index = next++, job = coverOf(entries[index], getImage);
        let image = await withTimeout(job, 4000);
        if (image === undefined) image = await withTimeout(job, 9000, true);
        images[index] = image || null;
      }
    }));
    return images;
  }
  const b64 = bytes => { let bin = ""; for (let n = 0; n < bytes.length; n += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(n, n + 0x8000)); return btoa(bin); };
  async function stageBytes(bytes, ext, name) {
    const plugin = native();
    await plugin.beginFile({ extension: ext, filename: name });
    for (let offset = 0; offset < bytes.length; offset += 60000) await plugin.appendFileChunk({ data: b64(bytes.subarray(offset, offset + 60000)) });
  }
  async function saveBytes(bytes, mime, ext, name) {
    const plugin = native();
    if (plugin?.saveChunkedFile) { await stageBytes(bytes, ext, name); const r = await plugin.saveChunkedFile({ mimeType: mime, filename: name }); return r?.location || "Downloads"; }
    const a = document.createElement("a"), url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    a.href = url; a.download = `${name}.${ext}`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "your device";
  }
  async function shareBytes(bytes, mime, ext, name, title) {
    const plugin = native();
    if (plugin?.beginFile && plugin?.appendFileChunk && plugin?.shareChunkedFile) {
      await plugin.beginFile({ extension: ext, filename: name });
      for (let offset = 0; offset < bytes.length; offset += 60000) await plugin.appendFileChunk({ data: b64(bytes.subarray(offset, offset + 60000)) });
      return plugin.shareChunkedFile({ mimeType: mime, title });
    }
    const file = new File([bytes], `${name}.${ext}`, { type: mime });
    if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title });
    throw new Error("Sharing files isn't available here.");
  }

  function open({ title, entries, getImage }, { showPopup, closePopup, toast, esc }) {
    document.getElementById("share-dialog")?.remove();
    coverJobs.clear();
    const dialog = document.createElement("dialog");
    dialog.id = "share-dialog"; dialog.className = "choice-dialog share-dialog share-list-dialog";
    const count = entries.length;
    dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">SHARE</p><h2>${esc(title)} · ${count}</h2></div><button class="choice-dialog-close" type="button" data-share-close aria-label="Close">×</button></header>
      <div class="share-body">
        <section class="share-pdf-options" aria-label="PDF options">
          <label>View<select data-share-layout><option value="list">List</option><option value="grid">Poster grid</option></select></label>
          <label>Theme<select data-share-theme><option value="app">App theme</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label class="share-pdf-cover-option"><input type="checkbox" data-share-title-page><span><strong>Title page</strong><small>Add a separate cover page to the PDF.</small></span></label>
        </section>
        <section class="share-list-pdf-preview" aria-label="PDF preview"><header><span class="share-list-pdf-icon" aria-hidden="true"><i data-lucide="file-text"></i></span><div><strong data-share-preview-heading></strong><p data-share-preview-summary></p></div></header><div class="share-list-preview-page" data-share-preview-page aria-live="polite"></div></section>
      </div>
      <footer class="share-footer"><p class="share-status" data-share-status role="status" aria-live="polite" hidden></p><div class="share-list-total-row"><strong>All ${count} ${count === 1 ? "title" : "titles"}</strong><button type="button" class="button secondary" data-share-pdf-save>Save</button></div><button type="button" class="button primary share-list-share" data-share-pdf-share>Share</button></footer>`;
    document.body.appendChild(dialog);
    const q = sel => dialog.querySelector(sel);
    let pdfCache = null, layout = "list", theme = "app", titlePage = false, previewImages = [];
    const say = (text, tone = "") => { const el = q("[data-share-status]"); el.hidden = !text; el.textContent = text; el.dataset.tone = tone; };
    const busy = on => dialog.querySelectorAll(".share-footer button,[data-share-layout],[data-share-theme],[data-share-title-page]").forEach(control => { if (on) { control.dataset.wasDisabled = String(control.disabled); control.disabled = true; } else { control.disabled = control.dataset.wasDisabled === "true"; delete control.dataset.wasDisabled; } });
    const guard = async (fn, success, working) => {
      say(working, "busy"); busy(true);
      try { const result = await fn(); if (success) { const message = success(result); say(message, "ok"); toast(message); } else say("", ""); }
      catch (error) { if (/cancel|abort/i.test(String(error?.message || error?.name || ""))) say(""); else say(error?.message || "Could not complete that.", "error"); }
      finally { busy(false); }
    };
    const updatePreview = () => {
      const C = themeColors(theme), page = q("[data-share-preview-page]");
      dialog.dataset.previewTheme = theme;
      page.style.setProperty("--preview-page", C.page); page.style.setProperty("--preview-card", C.card); page.style.setProperty("--preview-card-2", C.card2); page.style.setProperty("--preview-line", C.line); page.style.setProperty("--preview-text", C.text); page.style.setProperty("--preview-muted", C.muted); page.style.setProperty("--preview-accent", C.accent);
      q("[data-share-preview-heading]").textContent = `${count} ${count === 1 ? "title" : "titles"} · ${layout === "grid" ? "Poster grid" : "List"}`;
      const pages = Math.max(1, Math.ceil(layout === "grid" ? count / PDF_GRID_ITEMS_PER_PAGE : (count + 3) / PDF_ROWS_PER_PAGE) + (titlePage ? 1 : 0));
      q("[data-share-preview-summary]").textContent = `${titlePage ? "Title page · " : ""}About ${pages} ${pages === 1 ? "page" : "pages"}; text stays selectable.`;
      const samples = entries.slice(0, layout === "grid" ? 3 : 2);
      if (titlePage) {
        page.className = "share-list-preview-page is-cover";
        page.innerHTML = `<strong>${esc(title)}</strong><span>${count} ${count === 1 ? "title" : "titles"}</span><i>SCREENMARK</i>`;
        return;
      }
      page.className = `share-list-preview-page is-${layout}`;
      page.innerHTML = samples.map((entry, index) => `<article><span class="share-list-preview-art">${previewImages[index] ? `<img src="${previewImages[index]}" alt="">` : esc(String(entry.title || "?").trim().charAt(0).toUpperCase() || "?")}</span><span class="share-list-preview-copy"><strong>${esc(entry.title)}</strong><small>${esc(entry.tagsText || entry.subtitle || "")}</small></span>${layout === "list" && entry.progressText ? `<em>${esc(entry.progressText)}</em>` : ""}</article>`).join("");
    };
    const makeListPdf = async () => {
      if (pdfCache) return pdfCache;
      const chosenLayout = layout, chosenTheme = theme, chosenTitlePage = titlePage;
      const covers = [];
      for (let n = 0; n < entries.length; n += 12) {
        say(`Loading covers ${Math.min(n + 12, entries.length)} of ${entries.length}…`, "busy");
        covers.push(...await loadCoversFor(entries.slice(n, n + 12), getImage));
      }
      try {
        const C = themeColors(chosenTheme);
        say("Building PDF…", "busy");
        const { bytes } = await window.SplitAppListPdf.build({ title, layout: chosenLayout, titlePage: chosenTitlePage, entries: entries.map(e => ({ title: e.title, tags: e.tagsText || e.subtitle, progress: e.progressText })), covers, theme: { page: C.page, text: C.text, muted: C.muted, line: C.line, accent: C.accent, card2: C.card2 }, onProgress: info => say(`Building PDF… ${info.pct}%${info.etaMs > 2500 ? ` · about ${Math.ceil(info.etaMs / 1000)} s left` : ""}${info.note ? ` · ${info.note}` : ""}`, "busy") });
        pdfCache = bytes; return bytes;
      } finally {
        covers.forEach(closeImageBitmap);
        entries.forEach(entry => coverJobs.delete(String(entry.id)));
      }
    };
    q("[data-share-layout]").addEventListener("change", event => { layout = event.target.value === "grid" ? "grid" : "list"; pdfCache = null; updatePreview(); });
    q("[data-share-theme]").addEventListener("change", event => { theme = ["light", "dark"].includes(event.target.value) ? event.target.value : "app"; pdfCache = null; updatePreview(); });
    q("[data-share-title-page]").addEventListener("change", event => { titlePage = event.target.checked; pdfCache = null; updatePreview(); });
    updatePreview();
    Promise.all(entries.slice(0, 3).map(async (entry, index) => {
      const image = await coverOf(entry, getImage);
      if (!image || !dialog.isConnected) { closeImageBitmap(image); return; }
      try { const canvas = document.createElement("canvas"); canvas.width = 54; canvas.height = 74; const ctx = canvas.getContext("2d"); const scale = Math.max(canvas.width / image.width, canvas.height / image.height); const w = image.width * scale, h = image.height * scale; ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h); previewImages[index] = canvas.toDataURL("image/jpeg", .72); updatePreview(); } catch (_) {} finally { closeImageBitmap(image); }
    }));
    q("[data-share-pdf-save]").addEventListener("click", () => guard(async () => saveBytes(await makeListPdf(), "application/pdf", "pdf", slug(title)), result => `Saved to ${result}.`, "Preparing PDF…"));
    q("[data-share-pdf-share]").addEventListener("click", () => guard(async () => { const bytes = await makeListPdf(); say("Opening share…", "busy"); await shareBytes(bytes, "application/pdf", "pdf", slug(title), title); }, null, "Preparing PDF…"));
    dialog.addEventListener("click", event => {
      const t = event.target?.closest ? event.target : event.target?.parentElement;
      if (!t?.closest) return;
      if (t === dialog || t.closest("[data-share-close]")) return closePopup(dialog);
    });
    dialog.addEventListener("close", () => setTimeout(() => dialog.remove(), 300));
    window.lucide?.createIcons({ root: dialog, attrs: { "aria-hidden": "true" } });
    showPopup(dialog);
  }
  window.SplitAppShare = Object.freeze({ open, helpers: { themeColors, withAlpha, roundRect, fit, loadImage, saveBytes, shareBytes } });
})();
