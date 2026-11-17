// Opening animation "studio": live stage, swipeable style cards, size and app-name controls, Reset / Full screen / Save.
// Shared by SavePoint and ScreenMark. The host app supplies window.SplashHost; settings.js calls SplashStudio.render(config).
(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const probe = document.createElement("video");
  const ext = probe.canPlayType('video/mp4; codecs="avc1.42E01E"') ? "mp4" : probe.canPlayType('video/webm; codecs="vp9"') ? "webm" : "";
  const MIN = 50, MAX = 130, CHIPS = [50, 75, 100, 130];
  let cfg = null, draft = null, bootTimer = 0;
  const $ = selector => document.querySelector(selector);
  const clampSize = value => Math.min(MAX, Math.max(MIN, Math.round(Number(value) || 100)));
  const preset = id => cfg.presets.find(row => row.id === id) || cfg.presets[0];
  const saved = () => { const layout = window.SplashHost.layout(); return { id: window.SplashHost.style(), size: layout.size, name: layout.name }; };
  const defaults = id => ({ id: cfg.defaultId, size: 100, name: !!cfg.defaultName(id || cfg.defaultId) });

  // The logo itself: video (hardware decoded) with the still poster as placeholder and fallback, or the app's built-in mark.
  function logo(p, { loop = false, full = false } = {}) {
    if (p.builtin && full) return `<span class="ss-builtin ss-default"><img src="${esc(p.builtin)}" alt=""><b>${esc(cfg.appName)}</b><small>${esc(cfg.builtinSub || "")}</small><i><u></u><u></u><u></u></i></span>`;
    if (p.builtin) return `<span class="ss-builtin"><img src="${esc(p.builtin)}" alt=""><i><u></u><u></u><u></u></i></span>`;
    if (!ext) return `<img class="ss-media" src="${esc(p.poster)}" alt="">`;
    return `<video class="ss-media" src="${esc(p.poster.replace(/\.jpg$/, "." + ext))}" poster="${esc(p.poster)}" data-poster="${esc(p.poster)}" onerror="var i=new Image();i.className='ss-media';i.src=this.dataset.poster;this.replaceWith(i)" muted ${loop ? "loop" : ""} autoplay playsinline preload="auto" disablepictureinpicture></video>`;
  }
  // The app's built-in launch screen (preset.builtin) is fixed: its own size and wording, no size or name controls.
  const fixed = d => !!preset(d.id).builtin;
  const stageInner = d => fixed(d)
    ? `<div class="ss-logo" style="--ss-k:1">${logo(preset(d.id), { full: true })}</div>`
    : `<div class="ss-logo" style="--ss-k:${d.size / 100}">${logo(preset(d.id), { loop: true })}${d.name ? `<b class="ss-name">${esc(cfg.appName)}</b>` : ""}</div>`;
  const same = (d, s) => d.id === s.id && (fixed(d) || (d.size === s.size && d.name === s.name));

  function render(config) {
    cfg = config;
    if (!draft) draft = { ...saved(), step: 1, collapsed: false };
    const p = preset(draft.id), s = saved();
    const cards = cfg.presets.map(row => `<button type="button" class="ss-card${row.id === draft.id ? " is-active" : ""}" data-ss-preset="${row.id}" aria-pressed="${row.id === draft.id}"><span class="ss-card-top"><span class="ss-thumb">${logo(row, { loop: true })}</span><span class="ss-check" aria-hidden="true">✓</span></span><strong>${esc(row.label)}</strong><small>${esc(row.note)}</small></button>`).join("");
    const chips = CHIPS.map(v => `<button type="button" class="ss-chip${v === draft.size ? " is-active" : ""}" data-ss-chip="${v}">${v}%</button>`).join("");
    const pct = (draft.size - MIN) / (MAX - MIN) * 100;
    return `<section class="settings-page settings-detail-page settings-manager-page ss-page" id="ss-root" style="--ss-bg:${cfg.bg};--ss-base:${cfg.base}px;--ss-radius:${cfg.radius || 0}">
      ${cfg.header}
      <div class="ss-stage" id="ss-stage" data-ss-stage aria-label="Live preview">
        <button type="button" class="ss-test" data-ss-test><i data-lucide="play" aria-hidden="true"></i> Test boot</button>
        <div class="ss-stage-inner" id="ss-stage-inner">${stageInner(draft)}</div>
        <div class="ss-pill"><span class="ss-dot"></span><span id="ss-caption">${esc(p.label)} — ${esc(p.note)}</span><span class="ss-sep">|</span><b id="ss-pill-size">${fixed(draft) ? "Default" : draft.size + "%"}</b></div>
      </div>
      <div class="ss-dock">
        <div class="ss-dock-head">
          <div class="ss-tabs" role="tablist">
            <button type="button" role="tab" class="ss-tab${draft.step === 1 ? " is-active" : ""}" data-ss-step="1">1. Style <em id="ss-tab-code">${esc(p.id.toUpperCase())}</em></button>
            <button type="button" role="tab" class="ss-tab${draft.step === 2 ? " is-active" : ""}" data-ss-step="2" ${fixed(draft) ? "hidden" : ""}>2. Size &amp; name</button>
          </div>
          <button type="button" class="ss-icon-btn" data-ss-replay title="Replay animation" aria-label="Replay animation"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button>
        </div>
        <div class="ss-body${draft.collapsed ? " is-collapsed" : ""}" id="ss-body">
          <div class="ss-panel" id="ss-panel-1" ${draft.step === 1 ? "" : "hidden"}>
            <p class="ss-hint"><span>Tap a style to preview it above</span><span>Swipe →</span></p>
            <div class="ss-cards">${cards}</div>
          </div>
          <div class="ss-panel" id="ss-panel-2" ${draft.step === 2 ? "" : "hidden"}>
            <div class="ss-box">
              <div class="ss-box-row"><strong>Logo size</strong><div class="ss-chips">${chips}</div><output id="ss-size-out">${draft.size}%</output></div>
              <input id="ss-size" class="ss-range" type="range" min="${MIN}" max="${MAX}" step="1" value="${draft.size}" style="--ss-fill:${pct}%" aria-label="Logo size">
            </div>
            <label class="ss-box ss-box-row ss-name-row"><span><strong>Show app name below logo</strong><small>Displays “${esc(cfg.appName)}” under the opening animation.</small></span><span class="toggle"><input id="ss-name" type="checkbox" role="switch" ${draft.name ? "checked" : ""}><span class="toggle-track" aria-hidden="true"></span></span></label>
          </div>
        </div>
      </div>
      <div class="ss-fab" role="group" aria-label="Opening animation actions">
        <button type="button" class="ss-fab-btn" data-ss-reset title="Reset size and name" aria-label="Reset size and name" ${fixed(draft) ? "hidden" : ""}><i data-lucide="undo-2" aria-hidden="true"></i></button>
        <button type="button" class="ss-fab-btn is-primary" data-ss-save title="Save" aria-label="Save" ${same(draft, s) ? "disabled" : ""}><i data-lucide="check" aria-hidden="true"></i></button>
      </div>
    </section>`;
  }

  // Refresh the parts of the page that depend on the draft without rebuilding it, so playing videos are not interrupted.
  function sync({ restart = false } = {}) {
    if (!$("#ss-root") || !draft) return;
    const p = preset(draft.id), s = saved(), fx = fixed(draft);
    if (fx) draft.step = 1;
    if (restart) { $("#ss-stage-inner").innerHTML = stageInner(draft); }
    else {
      const holder = $("#ss-stage-inner .ss-logo");
      if (holder) { holder.style.setProperty("--ss-k", draft.size / 100); holder.querySelector(".ss-name")?.remove(); if (draft.name) holder.insertAdjacentHTML("beforeend", `<b class="ss-name">${esc(cfg.appName)}</b>`); }
    }
    $("#ss-caption").textContent = `${p.label} — ${p.note}`;
    $("#ss-pill-size").textContent = fx ? "Default" : `${draft.size}%`; $("#ss-size-out").textContent = `${draft.size}%`;
    const tab2 = document.querySelector('[data-ss-step="2"]'); if (tab2) tab2.hidden = fx;
    const rst = document.querySelector("[data-ss-reset]"); if (rst) rst.hidden = fx;
    $("#ss-tab-code").textContent = p.id.toUpperCase();
    document.querySelectorAll("[data-ss-preset]").forEach(card => { const on = card.dataset.ssPreset === draft.id; card.classList.toggle("is-active", on); card.setAttribute("aria-pressed", on); if (on) card.scrollIntoView?.({ block: "nearest", inline: "nearest" }); });
    document.querySelectorAll("[data-ss-chip]").forEach(chip => chip.classList.toggle("is-active", Number(chip.dataset.ssChip) === draft.size));
    const range = $("#ss-size"); range.value = draft.size; range.style.setProperty("--ss-fill", `${(draft.size - MIN) / (MAX - MIN) * 100}%`);
    $("#ss-name").checked = draft.name;
    document.querySelectorAll("[data-ss-step]").forEach(tab => tab.classList.toggle("is-active", Number(tab.dataset.ssStep) === draft.step));
    $("#ss-panel-1").hidden = draft.step !== 1; $("#ss-panel-2").hidden = draft.step !== 2;
    $("#ss-body").classList.toggle("is-collapsed", draft.collapsed);
    $("[data-ss-save]").disabled = same(draft, s);
  }

  // Full-screen test: plays the draft exactly as the app would on launch, with no controls, then closes itself.
  function testBoot() {
    document.getElementById("ss-boot")?.remove(); clearTimeout(bootTimer);
    const p = preset(draft.id), ms = p.builtin ? 2200 : 4000;
    const overlay = document.createElement("div");
    overlay.id = "ss-boot"; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-label", "Opening animation test");
    overlay.style.cssText = `--ss-bg:${cfg.bg};--ss-base:${cfg.base}px;--ss-radius:${cfg.radius || 0}`;
    overlay.innerHTML = `<div class="ss-boot-hud"><span class="ss-dot"></span>Simulating ${esc(cfg.appName)} cold start · tap to exit</div><div class="ss-boot-stage">${stageInner(draft)}</div><div class="ss-boot-bar"><i style="animation-duration:${ms}ms"></i></div>`;
    const close = () => {
      clearTimeout(bootTimer); document.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      overlay.classList.add("is-leaving"); setTimeout(() => overlay.remove(), 260);
    };
    const onKey = event => { if (event.key === "Escape") close(); };
    const onFs = () => { if (!document.fullscreenElement) close(); };
    overlay.addEventListener("click", close); document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    // In a browser, take over the whole screen like a real launch; the Android app is already full screen.
    try { overlay.requestFullscreen?.().then(() => document.addEventListener("fullscreenchange", onFs)).catch(() => {}); } catch (_) {}
    overlay.querySelector("video")?.removeAttribute("loop");
    bootTimer = setTimeout(close, ms);
  }

  document.addEventListener("click", event => {
    const hit = selector => event.target.closest?.(selector);
    if (!$("#ss-root") && !hit("[data-ss-test]")) return;
    let node;
    if ((node = hit("[data-ss-preset]"))) { draft.id = node.dataset.ssPreset; if (!window.SplashHost.layoutSaved()) draft.name = defaults(draft.id).name; sync({ restart: true }); return; }
    if ((node = hit("[data-ss-step]"))) { draft.step = Number(node.dataset.ssStep); draft.collapsed = false; sync(); return; }
    if (hit("[data-ss-replay]") || hit("[data-ss-stage]") && !hit("[data-ss-test]")) { sync({ restart: true }); return; }
    if ((node = hit("[data-ss-chip]"))) { draft.size = clampSize(node.dataset.ssChip); sync(); return; }
    if (hit("[data-ss-test]")) { testBoot(); return; }
    if (hit("[data-ss-reset]")) { if (fixed(draft)) return; Object.assign(draft, defaults(draft.id), { step: draft.step, id: draft.id }); sync({ restart: true }); window.SplashHost.toast("Size and name reset."); return; }
    if (hit("[data-ss-save]")) { window.SplashHost.save(fixed(draft) ? { id: draft.id } : { id: draft.id, size: draft.size, name: draft.name }); sync(); return; }
  });
  document.addEventListener("input", event => { if (event.target.id === "ss-size" && draft) { draft.size = clampSize(event.target.value); sync(); } });
  document.addEventListener("change", event => { if (event.target.id === "ss-name" && draft) { draft.name = event.target.checked; sync(); } });
  // Leaving the page discards unsaved changes.
  window.addEventListener("hashchange", () => { if (!/splash-style/.test(location.hash)) { draft = null; document.getElementById("ss-boot")?.remove(); } });

  // Keep the Reset / Save buttons just above the app's bottom bar, whatever its height.
  const placeFab = () => { const bar = document.querySelector(".bottom-bar"); document.documentElement.style.setProperty("--ss-bar", `${bar ? Math.round(bar.getBoundingClientRect().height) : 0}px`); };
  window.addEventListener("resize", placeFab);
  // First paint: bring the selected style card into view.
  const reveal = () => { placeFab(); document.querySelector(".ss-card.is-active")?.scrollIntoView?.({ block: "nearest", inline: "center" }); };
  window.SplashStudio = { render: config => { setTimeout(reveal, 60); return render(config); } };
})();
