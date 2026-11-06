// Share one movie or series as an image or PDF using its saved ScreenMark details.
(() => {
  const W = 1080, M = 40, PH = 1527; // PH = one A4 page at this width
  const h = () => window.SplitAppShare.helpers;
  const native = () => window.Capacitor?.Plugins?.ShareIntent;
  const norm = s => String(s || "").toLowerCase();
  const perf = window.SplitAppPerf;

  function wrap(ctx, text, maxWidth) {
    const lines = [];
    String(text || "").split(/\n+/).forEach(paragraph => {
      let line = "";
      paragraph.split(/\s+/).filter(Boolean).forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
      });
      if (line) lines.push(line);
    });
    return lines;
  }

  // Splits the saved "Label: value" fields into the groups used by the sheet.
  function groupFields(fields) {
    const take = (patterns, { keep = false } = {}) => patterns.map(p => { const f = fields.find(x => p.test(String(x.label || ""))); return f ? [String(f.label), String(f.value)] : null; }).filter(Boolean);
    const key = take([/^developers?$/i, /^publishers?$/i, /^genres?$/i, /^(release date|released|premiered)$/i, /^platforms?$/i, /^network|studio$/i, /^director|writer|creator/i, /^country|language/i, /^type$/i]);
    const scores = take([/^(imdb|tmdb|rotten tomatoes|metacritic|community score|rating)/i, /^audience score/i]);
    const play = take([/^runtime$/i, /^episodes?$/i, /^seasons?$/i, /^total runtime$/i]);
    const playStats = [];
    const used = new Set([...key, ...scores, ...play, ...playStats].map(x => x[0]));
    const skip = /^(merged from|source|schema|url)/i;
    const more = fields.filter(f => !used.has(String(f.label)) && !skip.test(String(f.label)) && String(f.value || "").trim()).map(f => [String(f.label), String(f.value)]).slice(0, 12);
    return { key, scores, play, playStats, more };
  }

  // Draws the sheet. `paged` keeps each block inside one PDF page. Returns a canvas cropped to its content.
  async function draw(game, opts, paged) {
    const { themeColors, withAlpha, roundRect, fit } = h();
    const C = themeColors();
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    const tall = document.createElement("canvas"); tall.width = W; tall.height = 7000 + Math.ceil((opts.screenshots ? (game.shots || []).length : 0) / 2) * 360 + 400;
    const drawStart = performance.now();
    const ctx = perf.ctx2d(tall);
    ctx.fillStyle = C.page; ctx.fillRect(0, 0, W, tall.height);
    const inner = W - M * 2;
    const g = groupFields(game.fields);
    let y = 0;
    // Start a block of height `need`: in paged mode jump to the next page if it would straddle the break.
    const place = (need, gap = 22) => {
      y += gap;
      if (paged) { const into = y % PH; if (into + need > PH - 6 && need < PH - 160) y = (Math.floor(y / PH) + 1) * PH + 40; }
      return y;
    };
    const card = (top, height) => { ctx.fillStyle = C.card; roundRect(ctx, M, top, inner, height, 26); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; roundRect(ctx, M, top, inner, height, 26); ctx.stroke(); };
    const title = (text, top) => { ctx.fillStyle = C.accent; roundRect(ctx, M + 28, top + 30, 8, 30, 4); ctx.fill(); ctx.fillStyle = C.muted; ctx.font = `800 26px ${font}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(text.toUpperCase(), M + 52, top + 54); };
    const tile = (x, top, w, hgt, label, value, big = false) => {
      ctx.fillStyle = C.card2; roundRect(ctx, x, top, w, hgt, 18); ctx.fill();
      ctx.fillStyle = C.muted; ctx.font = `700 19px ${font}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(fit(ctx, label.toUpperCase(), w - 28), x + 16, top + 32);
      ctx.fillStyle = C.text; ctx.font = `800 ${big ? 42 : 32}px ${font}`; ctx.fillText(fit(ctx, value, w - 28), x + 16, top + (big ? 84 : 76));
    };

    // ---- Header
    const HEAD = 200;
    ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, HEAD);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = "#fff";
    ctx.font = `800 62px ${font}`; ctx.fillText(fit(ctx, game.title, inner), M, 96);
    ctx.globalAlpha = .88; ctx.font = `600 32px ${font}`; ctx.fillText(fit(ctx, game.subtitle, inner), M, 152); ctx.globalAlpha = 1;
    y = HEAD;

    // ---- Hero: cover + status + key facts
    const keyFacts = opts.details ? g.key.map(([l, v]) => [l, String(v).replace(/,\s*/g, ", ")]) : [];
    const coverW = 270, coverH = 380, factW = inner - 56 - coverW - 32;
    ctx.font = `600 28px ${font}`;
    const factLines = keyFacts.map(([, v]) => wrap(ctx, v, factW).slice(0, 2));
    const factsH = factLines.reduce((sum, lines) => sum + 28 + lines.length * 34 + 14, 0);
    const heroH = Math.max(coverH + 56, 140 + factsH + 20);
    let top = place(heroH);
    card(top, heroH);
    ctx.save(); roundRect(ctx, M + 28, top + 28, coverW, coverH, 22); ctx.clip();
    if (game.cover) { const sc = Math.max(coverW / game.cover.width, coverH / game.cover.height); const dw = game.cover.width * sc, dh = game.cover.height * sc; ctx.drawImage(game.cover, M + 28 + (coverW - dw) / 2, top + 28 + (coverH - dh) / 2, dw, dh); }
    else { ctx.fillStyle = withAlpha(C.accent, .14); ctx.fillRect(M + 28, top + 28, coverW, coverH); }
    ctx.restore();
    const ix = M + 28 + coverW + 32, iw = M + inner - 28 - ix;
    let iy = top + 30, px = ix;
    const pill = (text, bg, fg) => { ctx.font = `700 26px ${font}`; const w = ctx.measureText(text).width + 36; if (px + w > ix + iw) { px = ix; iy += 54; } ctx.fillStyle = bg; roundRect(ctx, px, iy, w, 42, 14); ctx.fill(); ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(text, px + 18, iy + 22); ctx.textBaseline = "alphabetic"; px += w + 12; };
    if (game.status) { const c = C.status(game.status); pill(game.status, withAlpha(c, .18), c); }
    if (game.rating) pill(game.rating, "rgba(245,158,11,.18)", "#d97706");
    iy += 62;
    if (game.progressText) {
      ctx.fillStyle = C.text; ctx.font = `800 34px ${font}`; ctx.fillText(game.progressText.includes("/") ? game.progressText : `${game.progressText} watched`, ix, iy + 22);
      if (game.percent != null) { const by = iy + 40; ctx.fillStyle = C.card2; roundRect(ctx, ix, by, iw, 14, 7); ctx.fill(); if (game.percent > 0) { ctx.fillStyle = C.accent; roundRect(ctx, ix, by, Math.max(14, iw * game.percent / 100), 14, 7); ctx.fill(); } iy += 84; } else iy += 52;
    }
    keyFacts.forEach(([label], idx) => {
      ctx.fillStyle = C.muted; ctx.font = `700 20px ${font}`; ctx.fillText(label.toUpperCase(), ix, iy + 4);
      ctx.fillStyle = C.text; ctx.font = `600 28px ${font}`;
      factLines[idx].forEach((line, n) => ctx.fillText(line, ix, iy + 38 + n * 34));
      iy += 28 + factLines[idx].length * 34 + 14;
    });
    y = top + heroH;

    // ---- Scores & stats tiles
    const SEC = 70;
    const section = (name, bodyH, drawBody) => { const t = place(bodyH + SEC); card(t, bodyH + SEC); title(name, t); drawBody(t + SEC); y = t + bodyH + SEC; };
    if (opts.details && g.scores.length) {
      const n = g.scores.length, cols = n <= 2 ? n : n === 4 ? 2 : 3, tw = (inner - 56 - 24 * (cols - 1)) / cols, rows = Math.ceil(g.scores.length / cols), th = 94;
      section("Scores & stats", rows * (th + 16) - 16 + 28, t => g.scores.forEach(([l, v], i) => tile(M + 28 + (i % cols) * (tw + 24), t + Math.floor(i / cols) * (th + 16), tw, th, l, v)));
    }
    // ---- Play time
    if (opts.playtime && g.play.length) {
      const tw = (inner - 56 - 24 * (g.play.length - 1)) / g.play.length;
      ctx.font = `500 24px ${font}`;
      const statsText = g.playStats.map(([l, v]) => `${v} ${l.toLowerCase()}`).join("  ·  ");
      const statLines = statsText ? wrap(ctx, statsText, inner - 56) : [];
      section(game.category === "series" ? "Episodes & runtime" : "Runtime", 124 + (statLines.length ? statLines.length * 32 + 26 : 0), t => {
        g.play.forEach(([l, v], i) => tile(M + 28 + i * (tw + 24), t, tw, 124, l, v, true));
        ctx.fillStyle = C.muted; ctx.font = `500 24px ${font}`; ctx.textAlign = "left";
        statLines.forEach((line, i) => ctx.fillText(line, M + 28, t + 124 + 36 + i * 32));
      });
    }
    // ---- Overview (flows onto the next page when it does not fit, instead of leaving a gap)
    if (opts.description && game.description) {
      ctx.font = `500 31px ${font}`;
      let rest = wrap(ctx, game.description.slice(0, 3200), inner - 56).slice(0, 36), first = true;
      while (rest.length) {
        let n = rest.length;
        if (paged) {
          const into = (y + 22) % PH, avail = PH - 30 - into - SEC;
          n = Math.max(0, Math.min(rest.length, Math.floor((avail - 14) / 44)));
          if (n < Math.min(4, rest.length)) { y = (Math.floor(y / PH) + 1) * PH + 18 - 22; continue; }
        }
        const chunk = rest.slice(0, n); rest = rest.slice(n);
        section(first ? "Overview" : "Overview (continued)", chunk.length * 44 + 14, t => { ctx.fillStyle = C.text; ctx.font = `500 31px ${font}`; ctx.textAlign = "left"; chunk.forEach((line, n2) => ctx.fillText(line, M + 28, t + 34 + n2 * 44)); });
        first = false;
      }
    }
    // ---- Requirements
    const req = game.requirements || {};
    if (opts.requirements && (req.minimum?.length || req.recommended?.length)) {
      const colW = (inner - 56 - 28) / 2;
      // Up to 6 lines per requirement; a longer note ends with an ellipsis instead of stopping mid-sentence.
      const reqLines = value => { ctx.font = `600 25px ${font}`; const all = wrap(ctx, value, colW); if (all.length <= 6) return all; const cut = all.slice(0, 6); cut[5] = fit(ctx, `${cut[5]} …`, colW); return cut; };
      const col = (rows, x, t, heading) => {
        ctx.fillStyle = C.accent; ctx.font = `800 24px ${font}`; ctx.fillText(heading, x, t + 24);
        let cy = t + 62;
        rows.forEach(([label, value]) => {
          ctx.fillStyle = C.muted; ctx.font = `700 20px ${font}`; ctx.fillText(String(label).toUpperCase(), x, cy);
          ctx.font = `600 25px ${font}`; ctx.fillStyle = C.text;
          const lines = reqLines(value);
          lines.forEach((line, i) => ctx.fillText(line, x, cy + 30 + i * 32)); cy += 40 + lines.length * 32 + 14;
        });
        return cy - t;
      };
      // measure
      const measure = rows => rows.reduce((sum, [, v]) => { ctx.font = `600 25px ${font}`; return sum + 40 + reqLines(v).length * 32 + 14; }, 62);
      const hgt = Math.max(measure(req.minimum || []), measure(req.recommended || []));
      section("System requirements", hgt, t => { if (req.minimum?.length) col(req.minimum, M + 28, t, "MINIMUM"); if (req.recommended?.length) col(req.recommended, M + 28 + colW + 28, t, "RECOMMENDED"); });
    }
    // ---- Tags & languages
    const chips = (label, list) => ({ label, list: list.filter(Boolean) });
    const chipGroups = [opts.tags ? chips("Tags", (game.tags || []).slice(0, 14)) : null, opts.tags ? chips("Languages", (game.languages || []).slice(0, 10)) : null].filter(x => x && x.list.length);
    if (chipGroups.length) {
      ctx.font = `600 26px ${font}`;
      const layout = []; let total = 0;
      chipGroups.forEach(gr => { let x = 0, rowY = 38, rows = [[]]; gr.list.forEach(text => { const w = ctx.measureText(text).width + 34; if (x + w > inner - 56) { rowY += 52; x = 0; } layout.push({ gr: gr.label, text, x, y: total + rowY, w }); x += w + 10; }); total += rowY + 70; });
      section("Tags & languages", total - 20, t => {
        chipGroups.forEach(gr => { const first = layout.find(l => l.gr === gr.label); ctx.fillStyle = C.muted; ctx.font = `700 20px ${font}`; ctx.fillText(gr.label.toUpperCase(), M + 28, t + first.y - 14); });
        layout.forEach(l => { ctx.fillStyle = C.card2; roundRect(ctx, M + 28 + l.x, t + l.y, l.w, 42, 14); ctx.fill(); ctx.fillStyle = C.text; ctx.font = `600 24px ${font}`; ctx.textBaseline = "middle"; ctx.fillText(l.text, M + 28 + l.x + 17, t + l.y + 22); ctx.textBaseline = "alphabetic"; });
      });
    }
    // ---- More info
    if (opts.details && g.more.length) {
      const colW2 = (inner - 56 - 24) / 2, rows = Math.ceil(g.more.length / 2);
      section("More info", rows * 78, t => g.more.forEach(([l, v], i) => { const x = M + 28 + (i % 2) * (colW2 + 24), yy = t + Math.floor(i / 2) * 78; ctx.fillStyle = C.muted; ctx.font = `700 20px ${font}`; ctx.fillText(fit(ctx, l.toUpperCase(), colW2), x, yy + 20); ctx.fillStyle = C.text; ctx.font = `600 27px ${font}`; ctx.fillText(fit(ctx, v, colW2), x, yy + 54); }));
    }
    // ---- Screenshots (all of them, 8 per section so a PDF page break never cuts a picture)
    const shots = opts.screenshots ? (game.shots || []).filter(Boolean) : [];
    let from = 0;
    while (from < shots.length) {
      const sw = (inner - 56 - 16) / 2, sh = Math.round(sw * 0.5625), rowH = sh + 16;
      let count = Math.min(8, shots.length - from);
      if (paged) {
        // Fill what is left of the page with whole rows of screenshots; start a new page when fewer than two rows fit.
        const into = (y + 22) % PH, avail = PH - 30 - into - SEC, rowsFit = Math.floor((avail + 16) / rowH);
        count = Math.min(count, Math.max(0, rowsFit * 2));
        if (count < Math.min(2, shots.length - from)) { y = (Math.floor(y / PH) + 1) * PH + 18 - 22; continue; }
      }
      const group = shots.slice(from, from + count), rows = Math.ceil(group.length / 2);
      section(from ? "Screenshots (continued)" : `Screenshots · ${shots.length}`, rows * rowH - 16, t => group.forEach((img, i2) => {
        const sx = M + 28 + (i2 % 2) * (sw + 16), sy = t + Math.floor(i2 / 2) * rowH;
        ctx.save(); roundRect(ctx, sx, sy, sw, sh, 16); ctx.clip();
        const sc = Math.max(sw / img.width, sh / img.height); const dw = img.width * sc, dh = img.height * sc;
        ctx.drawImage(img, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh); ctx.restore();
      }));
      from += count;
    }
    // ---- Footer
    // The footer is for the long image only: in a PDF it would land alone on an extra page.
    if (!paged) { y += 30; ctx.textBaseline = "middle"; ctx.fillStyle = C.muted; ctx.font = `600 26px ${font}`; ctx.textAlign = "left"; ctx.fillText("Shared from ScreenMark", M, y + 30); }
    const height = Math.min(tall.height, Math.round(y + (paged ? 28 : 80)));
    const out = document.createElement("canvas"); out.width = W; out.height = height;
    perf.ctx2d(out).drawImage(tall, 0, 0, W, height, 0, 0, W, height);
    out.drawMs = performance.now() - drawStart;
    out.pageBackground = C.page;
    return out;
  }

  const bytesToBase64 = bytes => { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const blobOf = (canvas, q) => new Promise(r => canvas.toBlob(r, "image/jpeg", q));

  // Minimal PDF: each A4-high slice of the sheet is a JPEG on its own page.
  async function makePdf(canvas, onProgress) {
    const PW = 595.28, scale = PW / canvas.width, sliceH = PH;
    const enc = new TextEncoder(), parts = [], offsets = [];
    let length = 0;
    const push = data => { const b = typeof data === "string" ? enc.encode(data) : data; parts.push(b); length += b.length; };
    const obj = (id, body) => { offsets[id] = length; push(`${id} 0 obj\n`); if (typeof body === "string") push(body); else body.forEach(x => push(x)); push("\nendobj\n"); };
    const slices = Math.ceil(canvas.height / sliceH), pageIds = [], pageObjs = [];
    let next = 3;
    // A CPU-backed copy avoids reading the big canvas back from the GPU for every page.
    const cpuCopy = c => { const k = document.createElement("canvas"); k.width = c.width; k.height = c.height; k.pageBackground = c.pageBackground; perf.ctx2d(k).drawImage(c, 0, 0); return k; };
    let source = perf.state.level >= 1 ? cpuCopy(canvas) : canvas;
    const track = perf.tracker(slices, { slowStepMs: 1200, slowTotalMs: 9000, onUpdate: onProgress });
    for (let i = 0; i < slices; i++) {
      const t0 = performance.now();
      const sy = i * sliceH, sh = Math.min(sliceH, canvas.height - sy), k = perf.scale();
      const piece = document.createElement("canvas"); piece.width = Math.round(canvas.width * k); piece.height = Math.round(PH * k);
      const pctx = perf.ctx2d(piece); pctx.fillStyle = canvas.pageBackground || "#fff"; pctx.fillRect(0, 0, piece.width, piece.height);
      pctx.drawImage(source, 0, sy, canvas.width, sh, 0, 0, piece.width, Math.round(sh * k));
      const jpeg = await perf.jpegBytes(piece, perf.quality(.84));
      track.step(performance.now() - t0);
      if (track.shouldSwitch() && perf.escalate(level => track.switched(level)) && perf.state.level === 1) source = cpuCopy(canvas);
      const pageId = next++, imgId = next++, contentId = next++;
      pageIds.push(pageId);
      const ph = PH * scale, content = `q ${PW.toFixed(2)} 0 0 ${ph.toFixed(2)} 0 0 cm /Im0 Do Q`;
      pageObjs.push({ pageId, imgId, contentId, ph, content, jpeg, w: piece.width, h: piece.height });
    }
    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    for (const p of pageObjs) {
      obj(p.pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW.toFixed(2)} ${p.ph.toFixed(2)}] /Resources << /XObject << /Im0 ${p.imgId} 0 R >> >> /Contents ${p.contentId} 0 R >>`);
      obj(p.imgId, [`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, "\nendstream"]);
      obj(p.contentId, `<< /Length ${p.content.length} >>\nstream\n${p.content}\nendstream`);
    }
    const xref = length, total = next;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(length); let o = 0; parts.forEach(b => { out.set(b, o); o += b.length; });
    return out;
  }

  function open(game, { showPopup, closePopup, toast, esc, loadImage }) {
    document.getElementById("share-title-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "share-title-dialog"; dialog.className = "choice-dialog share-dialog share-title-dialog";
    const g = groupFields(game.fields || []);
    game.shotUrls = game.shotUrls || [];
    const has = {
      details: g.key.length + g.scores.length + g.more.length > 0, playtime: g.play.length > 0, description: Boolean(game.description),
      requirements: Boolean(game.requirements?.minimum?.length || game.requirements?.recommended?.length),
      tags: Boolean((game.tags || []).length || (game.languages || []).length), screenshots: game.shotUrls.length > 0
    };
    const state = { format: "pdf", ...Object.fromEntries(Object.entries(has).map(([k, v]) => [k, v])) };
    const labels = { details: game.category === "series" ? ["Series details", "Premiered, creators, cast and ratings"] : ["Movie details", "Release date, director, cast and ratings"], playtime: game.category === "series" ? ["Episodes & runtime", "Episode count, seasons and runtime"] : ["Runtime", "Movie length and runtime"], description: ["Overview", "The saved synopsis"], requirements: ["Additional details", "Networks, studios and other saved metadata"], tags: ["Tags & languages", "Genres, tags and supported languages"], screenshots: ["Images", `All ${game.shotUrls.length} gallery images`] };
    const choice = (attr, key, label, help, active, disabled = false, kind = "radio") => `<button type="button" role="${kind}" aria-checked="${active}" class="export-choice${active ? " active" : ""}${disabled ? " locked" : ""}" ${disabled ? "disabled" : `data-${attr}="${key}"`}><span class="${kind === "radio" ? "export-radio" : "export-check"}" aria-hidden="true"></span><span><strong>${label}</strong><small>${help}</small></span></button>`;
    const check = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const paint = () => {
      const chip = (key, label, on, disabled, always) => `<button type="button" class="share-chip${on ? " on" : ""}${always ? " always" : ""}" ${disabled || always ? "disabled" : `data-inc="${key}"`} aria-pressed="${on}"><span class="share-chip-box">${on ? check : ""}</span><span>${label}</span></button>`;
      dialog.querySelector(".share-body").innerHTML = `<p class="settings-overline share-label">FORMAT</p>
        <div class="share-modes" role="radiogroup" aria-label="Format"><button type="button" role="radio" aria-checked="${state.format === "pdf"}" class="${state.format === "pdf" ? "active" : ""}" data-fmt="pdf">PDF</button><button type="button" role="radio" aria-checked="${state.format === "image"}" class="${state.format === "image" ? "active" : ""}" data-fmt="image">Image</button></div>
        <p class="share-hint">${state.format === "pdf" ? "A paged report, easy to open or print." : "One long picture, easy to post in chats."}</p>
        <p class="settings-overline share-label">INCLUDE</p>
        <div class="share-chips">${chip("base", "Cover, status & progress", true, false, true)}${Object.keys(labels).map(k => chip(k, labels[k][0], has[k] && state[k], !has[k], false)).join("")}</div>
        <p class="share-hint">${Object.keys(labels).filter(k => !has[k]).map(k => labels[k][0]).join(", ") ? "Greyed out: no saved data for these sections." : ""}</p>`;
    };
    dialog.innerHTML = `<div class="choice-dialog-grabber"></div><header class="choice-dialog-header"><div><p class="settings-overline">SHARE</p><h2>${esc(game.title)}</h2></div><button class="choice-dialog-close" type="button" data-share-close aria-label="Close">×</button></header><div class="share-body"></div><footer class="share-footer"><p class="share-status" data-share-status role="status" hidden></p><div class="share-actions"><button type="button" class="button secondary" data-share-save>Save</button><button type="button" class="button primary" data-share-go>Share</button></div></footer>`;
    document.body.appendChild(dialog); paint();
    const say = (text, tone = "") => { const el = dialog.querySelector("[data-share-status]"); el.hidden = !text; el.textContent = text; el.dataset.tone = tone; };

    // Images start loading the moment the popup opens, and the sheet is drawn ahead of the tap.
    let shotsLoaded = 0;
    const shotsPromise = Promise.all(game.shotUrls.map(u => loadImage(u).catch(() => null).then(img => { shotsLoaded += 1; return img; })));
    const cache = new Map();
    let progress = { pct: 0, etaMs: 0, note: "" };
    const progressText = () => progress.pct === 0 && game.shotUrls.length && shotsLoaded < game.shotUrls.length ? `Loading screenshots ${shotsLoaded} of ${game.shotUrls.length}…` : `Preparing… ${progress.pct}%${progress.etaMs > 2500 ? ` · about ${Math.ceil(progress.etaMs / 1000)} s left` : ""}${progress.note ? ` · ${progress.note}` : ""}`;
    const optsKey = () => JSON.stringify([state.format, ...Object.keys(has).map(k => has[k] && state[k])]);
    const build = () => {
      const key = optsKey();
      if (!cache.has(key)) cache.set(key, (async () => {
        const shots = state.screenshots && has.screenshots ? await shotsPromise : [];
        const o = Object.fromEntries(Object.keys(has).map(k => [k, has[k] && state[k]]));
        const cover = await game.coverPromise;
        progress = { pct: 5, etaMs: 0, note: "" };
        const canvas = await draw({ ...game, cover, shots }, o, state.format === "pdf");
        progress = { pct: 35, etaMs: 0, note: "" };
        // A slow layout step means a slow canvas: use the faster method from the next build on.
        if (canvas.drawMs > 5000 && perf.state.level === 0) perf.escalate();
        const bytes = state.format === "pdf" ? await makePdf(canvas, info => { progress = { pct: 35 + Math.round(info.pct * .65), etaMs: info.etaMs, note: info.note }; }) : await encodeImage(canvas);
        progress = { pct: 100, etaMs: 0, note: "" };
        return { bytes, pages: state.format === "pdf" ? Math.ceil(canvas.height / PH) : 1 };
      })());
      return cache.get(key);
    };
    let warm = 0;
    const prewarm = () => { clearTimeout(warm); warm = setTimeout(() => { if (dialog.isConnected) build().catch(() => cache.delete(optsKey())); }, 350); };
    prewarm();

    dialog.addEventListener("click", async event => {
      const t = event.target?.closest ? event.target : event.target?.parentElement;
      if (!t?.closest) return;
      if (t === dialog || t.closest("[data-share-close]")) return closePopup(dialog);
      const f = t.closest("[data-fmt]"); if (f) { state.format = f.dataset.fmt; paint(); return prewarm(); }
      const i = t.closest("[data-inc]"); if (i) { const k = i.dataset.inc; state[k] = !state[k]; paint(); return prewarm(); }
      const wantSave = Boolean(t.closest("[data-share-save]")), wantShare = Boolean(t.closest("[data-share-go]"));
      if (!wantSave && !wantShare) return;
      const buttons = dialog.querySelectorAll(".share-footer button"); buttons.forEach(b => { b.disabled = true; });
      try {
        say(progressText(), "busy");
        const ticker = setInterval(() => say(progressText(), "busy"), 250);
        let built; try { built = await build(); } finally { clearInterval(ticker); }
        const { bytes } = built;
        const name = game.title.normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "title";
        const pdf = state.format === "pdf";
        const mime = pdf ? "application/pdf" : "image/jpeg", ext = pdf ? "pdf" : "jpg";
        if (wantSave) { say("Saving…", "busy"); const where = await h().saveBytes(bytes, mime, ext, name); say(`Saved to ${where}.`, "ok"); toast(`Saved to ${where}.`); }
        else { say("Opening share…", "busy"); await h().shareBytes(bytes, mime, ext, name, game.title); say(""); }
      } catch (error) { cache.delete(optsKey()); if (!/cancel|abort/i.test(String(error?.message || error?.name))) say(error?.message || "Could not complete that.", "error"); else say(""); }
      finally { buttons.forEach(b => { b.disabled = false; }); }
    });
    dialog.addEventListener("close", () => { clearTimeout(warm); setTimeout(() => dialog.remove(), 300); });
    showPopup(dialog);
  }

  async function encodeImage(canvas) {
    let q = .9, source = canvas, bytes = await perf.jpegBytes(source, perf.quality(q));
    const LIMIT = 700000;
    for (let guard = 0; bytes.length > LIMIT && guard < 10; guard++) {
      if (q > .62) q -= .07;
      else { const next = document.createElement("canvas"); next.width = Math.round(source.width * .85); next.height = Math.round(source.height * .85); perf.ctx2d(next).drawImage(source, 0, 0, next.width, next.height); source = next; }
      bytes = await perf.jpegBytes(source, perf.quality(q));
    }
    return bytes;
  }

  window.SplitAppShareTitle = Object.freeze({ open });
})();
