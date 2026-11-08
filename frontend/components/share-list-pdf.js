// Builds a real (vector + text) PDF listing a group of titles: count, cover, name, tags and viewing progress.
// Text uses the PDF's built-in Helvetica; names with characters Helvetica cannot show are placed as small images.
(() => {
  const PW = 595.28, PH = 841.89, MX = 32, MT = 38, MB = 34, ROW = 46, TW = 28, TH = 38;
  const WIN = { 0x2026: 0x85, 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x20AC: 0x80, 0x2122: 0x99 };
  const num = n => (Math.round(n * 100) / 100).toString();

  // Parses rgb()/rgba(); a translucent colour is blended over `over` so lines and tints look the same as on screen.
  const rgb = (css, fallback, over) => {
    const m = /rgba?\(([^)]+)\)/.exec(String(css || ""));
    if (!m) return fallback;
    const parts = m[1].split(/[ ,/]+/).map(Number);
    const c = [parts[0] / 255, parts[1] / 255, parts[2] / 255], alpha = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
    return alpha < 1 && over ? over.map((v, i) => v * (1 - alpha) + c[i] * alpha) : c;
  };
  const fill = c => `${num(c[0])} ${num(c[1])} ${num(c[2])} rg\n`;
  const stroke = c => `${num(c[0])} ${num(c[1])} ${num(c[2])} RG\n`;
  const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);

  function winAnsi(text) {
    let out = "", ok = true;
    for (const ch of String(text || "")) {
      const cp = ch.codePointAt(0);
      let b;
      if (cp < 0x20) b = 32; else if (cp < 0x80 || (cp >= 0xA0 && cp <= 0xFF)) b = cp; else if (WIN[cp]) b = WIN[cp]; else { ok = false; b = 63; }
      out += String.fromCharCode(b);
    }
    return { text: out, ok };
  }
  const lit = s => `(${s.replace(/[\\()]/g, m => "\\" + m)})`;
  const latin1 = s => { const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255; return out; };

  function roundRect(x, y, w, h, r) {
    const k = r * 0.5523;
    return `${num(x + r)} ${num(y)} m ${num(x + w - r)} ${num(y)} l ${num(x + w - r + k)} ${num(y)} ${num(x + w)} ${num(y + r - k)} ${num(x + w)} ${num(y + r)} c ` +
      `${num(x + w)} ${num(y + h - r)} l ${num(x + w)} ${num(y + h - r + k)} ${num(x + w - r + k)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c ` +
      `${num(x + r)} ${num(y + h)} l ${num(x + r - k)} ${num(y + h)} ${num(x)} ${num(y + h - r + k)} ${num(x)} ${num(y + h - r)} c ` +
      `${num(x)} ${num(y + r)} l ${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c h\n`;
  }

  const perf = window.SplitAppPerf;
  const measure = document.createElement("canvas").getContext("2d");
  const widthOf = (text, size, bold) => { measure.font = `${bold ? "bold " : ""}${size}px Helvetica, Arial, sans-serif`; return measure.measureText(text).width; };
  const fitText = (text, size, bold, max) => {
    let v = String(text || "");
    if (widthOf(v, size, bold) <= max) return v;
    while (v.length > 1 && widthOf(v + "…", size, bold) > max) v = v.slice(0, -1);
    return v.trimEnd() + "…";
  };

  async function coverJpeg(img) {
    const k = perf.scale(), c = document.createElement("canvas"); c.width = Math.round(84 * k); c.height = Math.round(114 * k);
    const ctx = perf.ctx2d(c);
    const sc = Math.max(c.width / img.width, c.height / img.height), dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    return { bytes: await perf.jpegBytes(c, perf.quality(.8)), w: c.width, h: c.height };
  }
  // Text Helvetica can't draw (CJK, emoji…) becomes a small image on the page colour.
  async function textJpeg(text, sizePt, bold, color, bg, maxPt) {
    const k = 3, font = `${bold ? "bold " : ""}${sizePt * k}px sans-serif`;
    measure.font = font;
    const wPx = Math.min(Math.ceil(measure.measureText(text).width) + 4, Math.round(maxPt * k)), hPx = Math.round(sizePt * k * 1.35);
    const c = document.createElement("canvas"); c.width = wPx; c.height = hPx;
    const ctx = perf.ctx2d(c);
    ctx.fillStyle = `rgb(${bg.map(v => Math.round(v * 255)).join(",")})`; ctx.fillRect(0, 0, wPx, hPx);
    ctx.fillStyle = `rgb(${color.map(v => Math.round(v * 255)).join(",")})`; ctx.font = font; ctx.textBaseline = "middle";
    ctx.fillText(text, 0, hPx / 2 + 1);
    return { bytes: await perf.jpegBytes(c, perf.quality(.85)), w: wPx, h: hPx, ptW: wPx / k, ptH: hPx / k };
  }

  // entries: [{ title, tags, progress }]; covers: array of Image/ImageBitmap/null; theme: { page, text, muted, line, accent, card2 }
  async function build({ title, entries, covers, theme, layout = "list", titlePage = false, onProgress }) {
    layout = layout === "grid" ? "grid" : "list";
    const bg = rgb(theme.page, [1, 1, 1]), text = rgb(theme.text, [.1, .1, .15]), muted = rgb(theme.muted, [.45, .47, .55]);
    const line = rgb(theme.line, mix(bg, text, .12), bg), accent = rgb(theme.accent, [.39, .33, .96]), card2 = rgb(theme.card2, mix(bg, text, .06), bg);
    const track = perf.tracker(entries.length, { slowStepMs: 150, slowTotalMs: 12000, onUpdate: info => onProgress?.(info) });
    const jobs = new Map();
    const jpegFor = n => { if (!jobs.has(n)) jobs.set(n, coverJpeg(covers[n])); return jobs.get(n); };
    const images = [];            // { bytes, w, h }
    const addImage = img => { images.push(img); return images.length; };
    const pages = [];
    let ops = "", y = 0, pageIndex = -1;
    const newPage = first => {
      if (pageIndex >= 0) pages.push(ops);
      pageIndex++;
      ops = fill(bg) + `0 0 ${num(PW)} ${num(PH)} re f\n`;
      y = PH - MT;
      if (first) {
        const t = winAnsi(title);
        ops += fill(text) + `BT /F2 22 Tf ${num(MX)} ${num(y - 18)} Td ${lit(t.text)} Tj ET\n`;
        ops += fill(muted) + `BT /F1 11 Tf ${num(MX)} ${num(y - 36)} Td ${lit(winAnsi(`${entries.length} ${entries.length === 1 ? "title" : "titles"}`).text)} Tj ET\n`;
        ops += stroke(accent) + `1.5 w ${num(MX)} ${num(y - 46)} m ${num(MX + 36)} ${num(y - 46)} l S\n`;
        y -= 62;
      }
    };
    if (titlePage) {
      const titleText = fitText(title, 28, true, PW - MX * 2 - 32), countText = `${entries.length} ${entries.length === 1 ? "title" : "titles"}`;
      let coverOps = fill(bg) + `0 0 ${num(PW)} ${num(PH)} re f\n`;
      coverOps += fill(card2) + roundRect(MX, PH - 245, PW - MX * 2, 160, 18) + "f\n";
      coverOps += fill(accent) + roundRect(MX, PH - 245, 7, 160, 3) + "f\n";
      coverOps += fill(text) + `BT /F2 28 Tf ${num(MX + 26)} ${num(PH - 145)} Td ${lit(winAnsi(titleText).text)} Tj ET\n`;
      coverOps += fill(muted) + `BT /F1 14 Tf ${num(MX + 26)} ${num(PH - 183)} Td ${lit(winAnsi(countText).text)} Tj ET\n`;
      coverOps += stroke(accent) + `2 w ${num(MX + 26)} ${num(PH - 210)} m ${num(MX + 86)} ${num(PH - 210)} l S\n`;
      coverOps += fill(muted) + `BT /F2 9 Tf ${num(MX + 26)} 42 Td (SCREENMARK) Tj ET\n`;
      pages.push(coverOps);
    }
    newPage(true);
    const textCol = MX + 26 + TW + 10, rightW = 96, colW = PW - MX - rightW - textCol;
    if (layout === "grid") {
      const columns = 3, gap = 10, cardW = (PW - MX * 2 - gap * (columns - 1)) / columns, cardH = 188, coverW = 82, coverH = 108;
      const wrapTwo = (value, size, bold, max) => {
        const words = String(value || "").split(/\s+/).filter(Boolean), lines = [];
        let line = "";
        for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && widthOf(next, size, bold) > max) { lines.push(line); line = word; } else line = next; }
        if (line) lines.push(line);
        if (lines.length > 2) lines.length = 2;
        if (lines[1] && widthOf(lines[1], size, bold) > max) lines[1] = fitText(lines[1], size, bold, max);
        if (words.length && lines.length === 1 && widthOf(lines[0], size, bold) > max) lines[0] = fitText(lines[0], size, bold, max);
        return lines;
      };
      for (let i = 0; i < entries.length; i++) {
        const column = i % columns;
        if (column === 0) {
          if (y - cardH < MB) newPage(false);
          else if (i) y -= 10;
        }
        const e = entries[i], x = MX + column * (cardW + gap), top = y, bottom = top - cardH;
        ops += fill(card2) + roundRect(x, bottom, cardW, cardH, 9) + "f\n";
        ops += stroke(mix(bg, line, .8)) + "0.6 w\n" + roundRect(x, bottom, cardW, cardH, 9) + "S\n";
        const tx = x + (cardW - coverW) / 2, ty = top - 10 - coverH;
        ops += "q\n" + roundRect(tx, ty, coverW, coverH, 4) + "W n\n";
        if (covers[i]) {
          const t0 = performance.now();
          if (perf.state.level >= 1) for (let n = i; n < Math.min(entries.length, i + 12); n++) if (covers[n]) jpegFor(n);
          const jpg = await jpegFor(i); track.step(performance.now() - t0);
          if (track.shouldSwitch()) perf.escalate(level => track.switched(level));
          const id = addImage(jpg); ops += `${num(coverW)} 0 0 ${num(coverH)} ${num(tx)} ${num(ty)} cm /Im${id} Do\n`;
        } else {
          track.advance(); ops += fill(mix(bg, accent, .16)) + `${num(tx)} ${num(ty)} ${num(coverW)} ${num(coverH)} re f\n`;
          const letter = winAnsi(String(e.title || "?").trim().charAt(0).toUpperCase() || "?");
          if (letter.ok) ops += fill(accent) + `BT /F2 28 Tf ${num(tx + coverW / 2 - widthOf(letter.text, 28, true) / 2)} ${num(ty + coverH / 2 - 9)} Td ${lit(letter.text)} Tj ET\n`;
        }
        ops += "Q\n";
        const nameLines = wrapTwo(e.title, 9, true, cardW - 16);
        for (let n = 0; n < nameLines.length; n++) {
          const enc = winAnsi(nameLines[n]);
          if (enc.ok) ops += fill(text) + `BT /F2 9 Tf ${num(x + 8)} ${num(top - 130 - n * 11)} Td ${lit(enc.text)} Tj ET\n`;
          else { const img = await textJpeg(nameLines[n], 9, true, text, card2, cardW - 16); const id = addImage(img); ops += `q ${num(img.ptW)} 0 0 ${num(img.ptH)} ${num(x + 8)} ${num(top - 130 - n * 11 - 2)} cm /Im${id} Do Q\n`; }
        }
        if (e.tags) {
          const tags = fitText(e.tags, 7, false, cardW - 16), enc = winAnsi(tags);
          if (enc.ok) ops += fill(muted) + `BT /F1 7 Tf ${num(x + 8)} ${num(top - 155)} Td ${lit(enc.text)} Tj ET\n`;
          else { const img = await textJpeg(tags, 7, false, muted, card2, cardW - 16); const id = addImage(img); ops += `q ${num(img.ptW)} 0 0 ${num(img.ptH)} ${num(x + 8)} ${num(top - 157)} cm /Im${id} Do Q\n`; }
        }
        if (e.progress) { const p = fitText(e.progress, 7.5, false, cardW - 16), enc = winAnsi(p); if (enc.ok) ops += fill(accent) + `BT /F2 7.5 Tf ${num(x + 8)} ${num(top - 174)} Td ${lit(enc.text)} Tj ET\n`; }
      }
      pages.push(ops);
    } else for (let i = 0; i < entries.length; i++) {
      if (y - ROW < MB) newPage(false);
      const e = entries[i], top = y, mid = top - ROW / 2;
      // index
      const idx = String(i + 1);
      ops += fill(muted) + `BT /F1 8.5 Tf ${num(MX + 20 - widthOf(idx, 8.5, false))} ${num(mid - 3)} Td ${lit(idx)} Tj ET\n`;
      // cover
      const tx = MX + 26, ty = top - (ROW - TH) / 2 - TH;
      ops += "q\n" + roundRect(tx, ty, TW, TH, 4) + "W n\n";
      const cover = covers[i];
      if (cover) {
        const t0 = performance.now();
        // Faster modes encode the next covers in parallel batches.
        if (perf.state.level >= 1) for (let n = i; n < Math.min(entries.length, i + 12); n++) if (covers[n]) jpegFor(n);
        const jpg = await jpegFor(i); track.step(performance.now() - t0);
        if (track.shouldSwitch()) perf.escalate(level => track.switched(level));
        const id = addImage(jpg); ops += `${num(TW)} 0 0 ${num(TH)} ${num(tx)} ${num(ty)} cm /Im${id} Do\n`;
      } else {
        track.advance();
        // No cover: a soft accent tile with the title's first letter, so the row never looks empty.
        ops += fill(mix(bg, accent, .16)) + `${num(tx)} ${num(ty)} ${num(TW)} ${num(TH)} re f\n`;
        const letter = winAnsi(String(e.title || "?").trim().charAt(0).toUpperCase() || "?");
        if (letter.ok) { const w = widthOf(letter.text, 15, true); ops += fill(accent) + `BT /F2 15 Tf ${num(tx + (TW - w) / 2)} ${num(ty + TH / 2 - 5)} Td ${lit(letter.text)} Tj ET\n`; }
        else { const img = await textJpeg(String(e.title).trim().charAt(0), 15, true, accent, mix(bg, accent, .16), 20); const id = addImage(img); ops += `q ${num(img.ptW)} 0 0 ${num(img.ptH)} ${num(tx + (TW - img.ptW) / 2)} ${num(ty + (TH - img.ptH) / 2)} cm /Im${id} Do Q\n`; }
      }
      ops += "Q\n";
      // name
      const name = fitText(e.title, 11, true, colW), enc = winAnsi(name);
      if (enc.ok) ops += fill(text) + `BT /F2 11 Tf ${num(textCol)} ${num(top - 19)} Td ${lit(enc.text)} Tj ET\n`;
      else { const img = await textJpeg(name, 11, true, text, bg, colW); const id = addImage(img); ops += `q ${num(img.ptW)} 0 0 ${num(img.ptH)} ${num(textCol)} ${num(top - 19 - img.ptH * 0.3 - 2)} cm /Im${id} Do Q\n`; }
      // tags
      if (e.tags) {
        const tags = fitText(e.tags, 8, false, colW), t2 = winAnsi(tags);
        if (t2.ok) ops += fill(muted) + `BT /F1 8 Tf ${num(textCol)} ${num(top - 32)} Td ${lit(t2.text)} Tj ET\n`;
        else { const img = await textJpeg(tags, 8, false, muted, bg, colW); const id = addImage(img); ops += `q ${num(img.ptW)} 0 0 ${num(img.ptH)} ${num(textCol)} ${num(top - 32 - img.ptH * 0.3 - 1)} cm /Im${id} Do Q\n`; }
      }
      // viewing progress (right aligned)
      const rx = PW - MX;
      if (e.progress) {
        const ht = winAnsi(e.progress).text, w = widthOf(ht, 9, false);
        ops += fill(muted) + `BT /F1 9 Tf ${num(rx - w)} ${num(top - 20)} Td ${lit(ht)} Tj ET\n`;
      }
      // separator
      ops += stroke(mix(bg, line, .4)) + `0.25 w ${num(textCol)} ${num(top - ROW)} m ${num(PW - MX)} ${num(top - ROW)} l S\n`;
      y -= ROW;
    }
    pages.push(ops);

    // ---- assemble the file
    const parts = [], offsets = [];
    let length = 0;
    const push = d => { const b = typeof d === "string" ? latin1(d) : d; parts.push(b); length += b.length; };
    const obj = (id, body) => { offsets[id] = length; push(`${id} 0 obj\n`); if (typeof body === "string") push(body); else body.forEach(push); push("\nendobj\n"); };
    const firstImage = 6, firstPage = firstImage + images.length;
    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
    obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    obj(5, `<< /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${images.map((_, i) => `/Im${i + 1} ${firstImage + i} 0 R`).join(" ")} >> >>`);
    images.forEach((img, i) => obj(firstImage + i, [`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`, img.bytes, "\nendstream"]));
    pages.forEach((content, i) => {
      const pid = firstPage + i * 2, cid = pid + 1, data = latin1(content);
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PW)} ${num(PH)}] /Resources 5 0 R /Contents ${cid} 0 R >>`);
      obj(cid, [`<< /Length ${data.length} >>\nstream\n`, data, "\nendstream"]);
    });
    const xref = length, total = firstPage + pages.length * 2;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(length); let o = 0; parts.forEach(b => { out.set(b, o); o += b.length; });
    return { bytes: out, pages: pages.length };
  }

  window.SplitAppListPdf = Object.freeze({ build });
})();
