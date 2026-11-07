// Share a Home group as images that look like the Home list (cover, title, subtitle, status).
(() => {
  const DEFAULT_PER_PAGE = 15, LONG_CHUNK = 45, W = 1080, ROW = 196, HEAD = 200, FOOT = 84, PAD = 40;
  const native = () => window.Capacitor?.Plugins?.ShareIntent;
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fit = (ctx, text, max) => {
    let value = String(text || "");
    if (ctx.measureText(value).width <= max) return value;
    while (value.length > 1 && ctx.measureText(value + "…").width > max) value = value.slice(0, -1);
    return value.trimEnd() + "…";
  };
  const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const loadImage = url => new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = url; });
  const statusColor = status => { const key = String(status || "").toLowerCase().replace(/\s+/g, "-"); return css(`--status-color-${key}`) || css("--accent") || "#6355f5"; };

  // Covers load once per title; a slow cover keeps loading in the background and is reused by the next draw.
  const coverJobs = new Map();
  const coverOf = (entry, getImage) => { if (!coverJobs.has(entry.id)) coverJobs.set(entry.id, getImage(entry).catch(() => null)); return coverJobs.get(entry.id); };
  const waitFor = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(undefined), ms))]);
  // Resolve any CSS colour expression (vars, color-mix) to rgb() so the canvas follows the active theme.
  const probe = document.createElement("span");
  const resolve = (expr, fallback) => { try { probe.style.color = ""; probe.style.color = expr; document.body.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return c || fallback; } catch (_) { return fallback; } };
  const withAlpha = (color, alpha) => { const m = String(color).match(/rgba?\(([^)]+)\)/); if (!m) return color; const [r, g, b] = m[1].split(/[ ,\/]+/).map(Number); return `rgba(${r},${g},${b},${alpha})`; };
  const themeColors = () => ({
    page: getComputedStyle(document.body).backgroundColor || "#f2f3f9",
    card: resolve("var(--surface)", "#fff"), card2: resolve("var(--surface-2)", "#f2f3f9"), line: resolve("var(--line)", "#e8eaf2"),
    text: getComputedStyle(document.body).color || "#1c2030", muted: resolve("var(--muted)", "#7a8094"), accent: resolve("var(--accent)", "#6355f5"),
    status: s => resolve(`var(--status-color-${String(s || "").toLowerCase().replace(/\s+/g, "-")}, var(--accent))`, "#6355f5")
  });
  const themeKey = () => { const c = themeColors(); return [c.page, c.card, c.accent, c.text].join("|"); };


  async function drawSheet({ title, entries, start, total, page, pages, showHead, getImage }) {
    const jobs = entries.map(entry => coverOf(entry, getImage));
    let images = await Promise.all(jobs.map(job => waitFor(job, 4000)));
    // Give covers that are only slow (not failed) one longer chance so a big list doesn't end up with blanks.
    if (images.some(img => img === undefined)) images = await Promise.all(jobs.map((job, i) => images[i] === undefined ? waitFor(job, 9000) : images[i]));
    const missing = images.filter(img => img === undefined).length;
    images = images.map(img => img || null);
    const C = themeColors();
    const head = showHead ? HEAD : 24, rows = entries.length;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = head + rows * ROW + FOOT;
    const ctx = canvas.getContext("2d");
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    ctx.fillStyle = C.page; ctx.fillRect(0, 0, W, canvas.height);
    if (showHead) {
      ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, HEAD);
      ctx.fillStyle = "#fff"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      ctx.font = `800 64px ${font}`; ctx.fillText(fit(ctx, title, W - PAD * 2), PAD, 96);
      ctx.globalAlpha = .85; ctx.font = `600 34px ${font}`;
      ctx.fillText(`${total} ${total === 1 ? "title" : "titles"}${pages > 1 ? ` · page ${page} of ${pages}` : ""}`, PAD, 150); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = C.card; roundRect(ctx, 20, head, W - 40, rows * ROW, 28); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; roundRect(ctx, 20, head, W - 40, rows * ROW, 28); ctx.stroke();
    entries.forEach((entry, index) => {
      const y = head + index * ROW, art = { x: 44, y: y + 18, w: 108, h: ROW - 36 };
      if (index) { ctx.fillStyle = C.line; ctx.fillRect(176, y, W - 216, 2); }
      ctx.save(); roundRect(ctx, art.x, art.y, art.w, art.h, 16); ctx.clip();
      const img = images[index];
      if (img) {
        const scale = Math.max(art.w / img.width, art.h / img.height), dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, art.x + (art.w - dw) / 2, art.y + (art.h - dh) / 2, dw, dh);
      } else { ctx.fillStyle = withAlpha(C.accent, .14); ctx.fillRect(art.x, art.y, art.w, art.h); ctx.fillStyle = C.muted; ctx.font = `700 40px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🎮", art.x + art.w / 2, art.y + art.h / 2); }
      ctx.restore();
      const tx = 176, maxW = W - tx - 48;
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = C.text; ctx.font = `700 38px ${font}`; ctx.fillText(fit(ctx, entry.title, maxW), tx, y + 60);
      ctx.fillStyle = C.muted; ctx.font = `500 27px ${font}`; if (entry.subtitle) ctx.fillText(fit(ctx, entry.subtitle, maxW), tx, y + 98);
      let px = tx; const py = y + 112, ph = 38;
      const pill = (text, bg, fg) => { ctx.font = `700 24px ${font}`; const w = ctx.measureText(text).width + 32; ctx.fillStyle = bg; roundRect(ctx, px, py, w, ph, 12); ctx.fill(); ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(text, px + 16, py + ph / 2 + 1); ctx.textBaseline = "alphabetic"; px += w + 12; };
      if (entry.status) { const c = C.status(entry.status); pill(entry.status, withAlpha(c, .18), c); }
      if (entry.progressText) { ctx.font = `700 26px ${font}`; ctx.fillStyle = C.text; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(entry.progressText, W - 48, py + ph / 2 + 1); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; }
      if (entry.percent != null) {
        const bx = tx, bw = W - tx - 48, by = y + 164;
        ctx.fillStyle = C.card2; roundRect(ctx, bx, by, bw, 10, 5); ctx.fill();
        if (entry.percent > 0) { ctx.fillStyle = C.accent; roundRect(ctx, bx, by, Math.max(10, bw * Math.min(1, entry.percent / 100)), 10, 5); ctx.fill(); }
      }
    });
    ctx.textBaseline = "middle"; ctx.fillStyle = C.muted; ctx.font = `600 26px ${font}`; ctx.textAlign = "left";
    ctx.fillText("Shared from ScreenMark", PAD, head + rows * ROW + FOOT / 2);
    if (pages > 1) { ctx.textAlign = "right"; ctx.fillText(`${page} / ${pages}`, W - PAD, head + rows * ROW + FOOT / 2); }
    const url = encode(canvas);
    return { url, complete: missing === 0 };
  }
  // The Android bridge gets very slow with payloads above ~250 KB, so keep the encoded image small.
  function encode(canvas) {
    const LIMIT = 235000;
    let source = canvas, quality = .86, url = source.toDataURL("image/jpeg", quality);
    for (let guard = 0; url.length > LIMIT && guard < 12; guard++) {
      if (quality > .7) quality -= .1;
      else { const next = document.createElement("canvas"); next.width = Math.round(source.width * .85); next.height = Math.round(source.height * .85); next.getContext("2d").drawImage(source, 0, 0, next.width, next.height); source = next; }
      url = source.toDataURL("image/jpeg", quality);
    }
    return url;
  }
  const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
  const buildImages = (entries, mode, perPage) => { const size = mode === "pages" ? perPage : LONG_CHUNK, groups = chunk(entries, size); return groups.map((group, index) => ({ group, index, pages: groups.length, start: index * size })); };
  const slug = value => String(value).normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "screenmark";

  async function saveImage(dataUrl, name) {
    const plugin = native();
    if (plugin?.downloadImage) { const r = await plugin.downloadImage({ src: dataUrl, filename: name, title: name }); return r?.location || "Downloads"; }
    const a = document.createElement("a"); a.href = dataUrl; a.download = `${name}.jpg`; document.body.appendChild(a); a.click(); a.remove(); return "your device";
  }
  async function shareImage(dataUrl, name) {
    const plugin = native();
    if (plugin?.shareImage) return plugin.shareImage({ src: dataUrl, filename: name, title: name });
    const blob = await (await fetch(dataUrl)).blob(), file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: name });
    throw new Error("Sharing images isn't available here — use Save instead.");
  }

  async function shareAllImages(urls, name) {
    const plugin = native();
    if (plugin?.stageImage && plugin?.shareStagedImages) {
      await plugin.clearStagedImages?.();
      for (let i = 0; i < urls.length; i++) await plugin.stageImage({ src: urls[i], filename: `${name}-${i + 1}` });
      return plugin.shareStagedImages({ title: name });
    }
    const files = await Promise.all(urls.map(async (u, i) => new File([await (await fetch(u)).blob()], `${name}-${i + 1}.jpg`, { type: "image/jpeg" })));
    if (navigator.canShare?.({ files })) return navigator.share({ files, title: name });
    throw new Error("Sharing several images isn't available here — use Save all instead.");
  }

  const PDF_ROWS_PER_PAGE = 16;
  async function loadCoversFor(entries, getImage) {
    const withTimeout = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(undefined), ms))]);
    const jobs = entries.map(entry => coverOf(entry, getImage));
    let images = await Promise.all(jobs.map(job => withTimeout(job, 4000)));
    if (images.some(img => img === undefined)) images = await Promise.all(jobs.map((job, n) => images[n] === undefined ? withTimeout(job, 9000) : images[n]));
    return images.map(img => img || null);
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
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = `${name}.${ext}`; document.body.appendChild(a); a.click(); a.remove(); return "your device";
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

  function open({ title, entries, getImage }, { showPopup, closePopup, toast, esc, cacheGet, cachePut }) {
    document.getElementById("share-dialog")?.remove();
    coverJobs.clear();
    const dialog = document.createElement("dialog");
    dialog.id = "share-dialog"; dialog.className = "choice-dialog share-dialog share-list-dialog";
    const count = entries.length;
    const pdfPages = Math.max(1, Math.ceil((count + 3) / PDF_ROWS_PER_PAGE));
    dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">SHARE</p><h2>${esc(title)} · ${count}</h2></div><button class="choice-dialog-close" type="button" data-share-close aria-label="Close">×</button></header>
      <div class="share-body"><section class="share-list-pdf-preview" aria-label="PDF preview"><span class="share-list-pdf-icon" aria-hidden="true"><i data-lucide="file-text"></i></span><div><strong>${count} ${count === 1 ? "title" : "titles"} in one PDF</strong><p>A clean list in your theme colours with covers, names, tags and viewing progress. About ${pdfPages} ${pdfPages === 1 ? "page" : "pages"}; text stays selectable.</p></div></section></div>
      <footer class="share-footer"><p class="share-status" data-share-status role="status" aria-live="polite" hidden></p><div class="share-list-total-row"><strong>All ${count} ${count === 1 ? "title" : "titles"}</strong><button type="button" class="button secondary" data-share-pdf-save>Save</button></div><button type="button" class="button primary share-list-share" data-share-pdf-share>Share</button></footer>`;
    document.body.appendChild(dialog);
    const q = sel => dialog.querySelector(sel);
    let pdfCache = null;
    const say = (text, tone = "") => { const el = q("[data-share-status]"); el.hidden = !text; el.textContent = text; el.dataset.tone = tone; };
    const busy = on => dialog.querySelectorAll(".share-footer button").forEach(button => { button.disabled = on; });
    const guard = async (fn, success, working) => {
      say(working, "busy"); busy(true);
      try { const result = await fn(); if (success) { const message = success(result); say(message, "ok"); toast(message); } else say("", ""); }
      catch (error) { if (/cancel|abort/i.test(String(error?.message || error?.name || ""))) say(""); else say(error?.message || "Could not complete that.", "error"); }
      finally { busy(false); }
    };
    const makeListPdf = async () => {
      if (pdfCache) return pdfCache;
      const covers = [];
      for (let n = 0; n < entries.length; n += 12) {
        say(`Loading covers ${Math.min(n + 12, entries.length)} of ${entries.length}…`, "busy");
        covers.push(...await loadCoversFor(entries.slice(n, n + 12), getImage));
      }
      const C = themeColors();
      say("Building PDF…", "busy");
      const { bytes } = await window.SplitAppListPdf.build({ title, entries: entries.map(e => ({ title: e.title, tags: e.tagsText || e.subtitle, progress: e.progressText })), covers, theme: { page: C.page, text: C.text, muted: C.muted, line: C.line, accent: C.accent, card2: C.card2 }, onProgress: info => say(`Building PDF… ${info.pct}%${info.etaMs > 2500 ? ` · about ${Math.ceil(info.etaMs / 1000)} s left` : ""}${info.note ? ` · ${info.note}` : ""}`, "busy") });
      pdfCache = bytes; return bytes;
    };
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
