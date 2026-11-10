// Streaming reader for backup files shaped like {"app":…,"index":[…],"items":[ {…}, {…} ],"history":[…],"preferences":{…}}.
// Large libraries are read one title at a time from the (decompressed) byte stream, so the whole file is never held as one huge
// string next to the parsed objects. Anything that does not look like a backup makes parse() throw, and the caller falls back to
// the normal whole-file path.
(() => {
  async function parse(stream, { onProgress, yieldEvery = 400 } = {}) {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    const items = [];
    let buffer = "", state = "head", depth = 0, inString = false, escaped = false, start = -1, scanned = 0, tail = "", head = "", counted = 0;
    // head: look for `"items":[` ; items: collect objects at depth 1 inside the array ; tail: everything after the array.
    const needle = /"items"\s*:\s*\[/;
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buffer += value;
      if (state === "head") {
        const match = needle.exec(buffer);
        if (match) { head = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length); state = "items"; scanned = 0; }
        else if (buffer.length > 2 * 1024 * 1024) throw new Error("Not a recognised backup layout.");
      }
      if (state === "items") {
        for (let at = scanned; at < buffer.length; at++) {
          const char = buffer[at];
          if (inString) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') inString = false; continue; }
          if (char === '"') { inString = true; continue; }
          if (char === "{" || char === "[") { if (depth === 0 && char === "{") start = at; depth++; }
          else if (char === "}" || char === "]") {
            if (depth === 0 && char === "]") { tail = buffer.slice(at + 1); state = "tail"; buffer = ""; break; }
            depth--;
            if (depth === 0 && start >= 0) {
              items.push(JSON.parse(buffer.slice(start, at + 1)));
              start = -1; counted++;
              if (counted % yieldEvery === 0) { onProgress?.(counted); await new Promise(resolve => setTimeout(resolve, 0)); }
            }
          }
        }
        if (state === "items") {
          scanned = buffer.length;
          // Drop what has been consumed, keeping the partly read object (if any).
          const keepFrom = start >= 0 ? start : scanned;
          buffer = buffer.slice(keepFrom); scanned -= keepFrom; if (start >= 0) start = 0;
        }
      } else if (state === "tail") tail += buffer, buffer = "";
      if (done) break;
    }
    if (state !== "tail") throw new Error("The backup item list is incomplete.");
    // The remaining top-level fields (history, preferences, …) are small and are read from the text around the item list.
    const rest = parseLoose(head, tail);
    return { ...rest, items };
  }
  // Fallback for the small fields around the item list: pull `"history":[…]` and `"preferences":{…}` out of the tail.
  function parseLoose(head, tail) {
    const out = {};
    const text = `${head}${tail}`;
    for (const key of ["history", "preferences", "app", "version", "exportedAt"]) {
      const at = text.search(new RegExp(`"${key}"\\s*:`));
      if (at < 0) continue;
      let i = text.indexOf(":", at) + 1;
      while (/\s/.test(text[i])) i++;
      const open = text[i];
      if (open !== "[" && open !== "{") { const end = text.slice(i).search(/[,}]/); try { out[key] = JSON.parse(text.slice(i, i + (end < 0 ? undefined : end))); } catch (_) {} continue; }
      let depth = 0, inString = false, escaped = false;
      for (let at2 = i; at2 < text.length; at2++) {
        const c = text[at2];
        if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
        if (c === '"') inString = true; else if (c === "{" || c === "[") depth++; else if (c === "}" || c === "]") { depth--; if (!depth) { try { out[key] = JSON.parse(text.slice(i, at2 + 1)); } catch (_) {} break; } }
      }
    }
    return out;
  }
  async function parseFile(file, options) {
    if (!file?.stream || typeof TextDecoderStream !== "function") throw new Error("Streaming is not available.");
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    let stream = file.stream();
    if (head[0] === 0x1f && head[1] === 0x8b) {
      if (typeof DecompressionStream !== "function") throw new Error("This device cannot open compressed backups.");
      stream = stream.pipeThrough(new DecompressionStream("gzip"));
    }
    return parse(stream, options);
  }
  window.SplitAppBackupStream = { parse, parseFile };
})();
