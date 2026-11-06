// Adaptive speed control for building share files. Every step is timed; when the projected total is too long the
// build switches to a faster method on the fly and remembers the choice for next time.
//   level 0: default canvases, one-by-one encoding
//   level 1: CPU-backed canvases (no GPU read-back) and encoding in parallel batches
//   level 2: level 1 plus smaller covers / lower JPEG quality, synchronous encoder (toDataURL)
//   level 3: level 2 at the lowest resolution
(() => {
  const KEY = "screenmark_share_perf_level", MAX_LEVEL = 3;
  const safe = fn => { try { return fn(); } catch (_) { return null; } };
  const state = { level: Math.min(MAX_LEVEL, Number(safe(() => localStorage.getItem(KEY))) || 0) };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  // Test switch: window.__forceSlowShare = true makes level 0 artificially slow so the fallback can be seen.
  const forced = () => window.__forceSlowShare === true;

  const ctx2d = canvas => canvas.getContext("2d", state.level >= 1 ? { willReadFrequently: true } : undefined);
  const escalate = onChange => {
    if (state.level >= MAX_LEVEL) return false;
    state.level += 1; safe(() => localStorage.setItem(KEY, String(state.level)));
    onChange?.(state.level);
    return true;
  };
  const reset = () => { state.level = 0; safe(() => localStorage.removeItem(KEY)); };
  const label = level => (["standard mode", "fast mode", "faster mode", "fastest mode"])[level] || "fast mode";

  // JPEG bytes of a canvas. toBlob is the default; if it stalls (or the level asks for it) toDataURL is used instead.
  async function jpegBytes(canvas, quality) {
    if (forced() && state.level === 0) await sleep(450);
    if (state.level < 2) {
      const blob = await Promise.race([new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality)), sleep(5000).then(() => null)]);
      if (blob) return new Uint8Array(await blob.arrayBuffer());
    }
    const data = canvas.toDataURL("image/jpeg", quality), bin = atob(data.slice(data.indexOf(",") + 1)), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const quality = base => state.level >= 3 ? Math.max(.5, base - .2) : state.level >= 2 ? Math.max(.55, base - .12) : base;
  const scale = () => state.level >= 3 ? .6 : state.level >= 2 ? .75 : 1;

  // Tracks progress of `total` steps. step(ms) records one finished step; decide() says whether to switch method.
  function tracker(total, { slowStepMs = 150, slowTotalMs = 12000, onUpdate } = {}) {
    const started = performance.now(), samples = [];
    let done = 0, cooldown = 0, note = "";
    const info = () => {
      const recent = samples.slice(-5), avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      return { done, total, pct: total ? Math.min(100, Math.round(done / total * 100)) : 100, etaMs: Math.max(0, (total - done) * avg), avgMs: avg, level: state.level, note, elapsedMs: performance.now() - started };
    };
    return {
      step(ms) { samples.push(ms); done += 1; if (cooldown > 0) cooldown -= 1; onUpdate?.(info()); },
      advance(count = 1) { done += count; onUpdate?.(info()); },
      info,
      // True when recent steps are slow and the projected total is long enough to be worth changing method.
      shouldSwitch() {
        if (cooldown > 0 || samples.length < 3 || state.level >= MAX_LEVEL) return false;
        const { avgMs, etaMs } = info();
        return avgMs > slowStepMs && etaMs + (performance.now() - started) > slowTotalMs;
      },
      switched(level) { cooldown = 4; samples.length = 0; note = `switched to ${label(level)}`; onUpdate?.(info()); }
    };
  }

  window.SplitAppPerf = Object.freeze({ state, ctx2d, escalate, reset, jpegBytes, quality, scale, tracker, label, sleep, forced });
})();
