// PV Summary – eigenes Dashboard (Panel in der Seitenleiste)
// Ohne Build-Schritt und ohne Fremdbibliotheken: reines Web Component mit SVG-Diagrammen.

const COLORS = { pv: "#f0a30a", bat: "#1d9e75", house: "#5b7290", grid: "#7f77dd" };
// Farben für einzelne Strings (wiederholen sich ab dem 9. String)
const STRING_COLORS = ["#f0a30a", "#1d9e75", "#7f77dd", "#d85a30", "#378add", "#d4537e", "#639922", "#888780"];
const HISTORY_REFRESH_MS = 5 * 60 * 1000;
const LIVE_RENDER_MS = 2000;
const SUN_COLOR = "#e6b800";
const BIN_MS = 5 * 60 * 1000;       // Raster der geglätteten Tageskurven
const ZOOM_MIN_MS = 30 * 60 * 1000; // kleinster Zoom-Ausschnitt

const STYLE = `
  :host { display:block; min-height:100vh; background:var(--primary-background-color); color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family, inherit); }
  .toolbar { display:flex; align-items:center; gap:8px; height:56px; padding:0 12px; background:var(--app-header-background-color, var(--primary-color)); color:var(--app-header-text-color, #fff); position:sticky; top:0; z-index:2; }
  .toolbar .title { font-size:20px; flex:1; }
  .tabs { display:flex; gap:4px; }
  .tab { background:transparent; border:1px solid rgba(255,255,255,.4); color:inherit; border-radius:16px; padding:4px 12px; cursor:pointer; font:inherit; font-size:13px; }
  .tab.active { background:rgba(255,255,255,.2); }
  .content { max-width:1280px; margin:0 auto; padding:16px; display:grid; gap:16px; }
  .row { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); }
  .row.wide-left { grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); }
  .row.half { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .card { background:var(--card-background-color, #fff); border-radius:var(--ha-card-border-radius, 12px); box-shadow:var(--ha-card-box-shadow, none); border:1px solid var(--divider-color, rgba(0,0,0,.12)); padding:16px; min-width:0; }
  .card h3 { margin:0 0 12px; font-size:15px; font-weight:500; display:flex; align-items:center; gap:8px; }
  .card h3 .hint { margin-left:auto; font-size:12px; font-weight:400; color:var(--secondary-text-color); }
  .head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .head .name { font-size:22px; font-weight:500; }
  .chip { display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:4px 10px; border-radius:999px; background:var(--secondary-background-color, rgba(0,0,0,.05)); color:var(--secondary-text-color); }
  .chip.on { background:rgba(99,153,34,.18); color:var(--success-color, #43a047); }
  .chip.off { background:rgba(136,135,128,.15); }
  .chips { display:flex; gap:6px; flex-wrap:wrap; margin-left:auto; }
  .kpis { display:grid; gap:12px; grid-template-columns:repeat(2, minmax(0,1fr)); grid-auto-rows:1fr; }
  .kpi { display:flex; align-items:center; gap:12px; padding:12px 14px; }
  .kpi.click:hover { border-color:${COLORS.house}; }
  .kpi .ico { flex:none; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; --mdc-icon-size:20px; }
  .kpi .txt { min-width:0; }
  .flowcard { display:flex; flex-direction:column; }
  .flowcard svg { max-height:330px; margin:auto; width:100%; }
  .kpi .lbl { font-size:12px; color:var(--secondary-text-color); }
  .kpi .val { font-size:22px; font-weight:500; line-height:1.2; white-space:nowrap; }
  .kpi .val small { font-size:13px; font-weight:400; color:var(--secondary-text-color); margin-left:2px; }
  .kpi .sub { font-size:12px; color:var(--secondary-text-color); }
  .up { color:var(--success-color, #43a047) !important; } .down { color:var(--error-color, #db4437) !important; }
  .mini { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); }
  .mini .val { font-size:20px; }
  .tile { padding:12px 14px; display:flex; flex-direction:column; justify-content:center; min-width:0; }
  .tile .lbl { font-size:12px; color:var(--secondary-text-color); }
  .tile .val { font-size:20px; font-weight:500; line-height:1.25; white-space:nowrap; }
  .tile .val small { font-size:13px; font-weight:400; color:var(--secondary-text-color); margin-left:2px; }
  .tile .sub { font-size:12px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  g.click:hover circle { stroke-width:5; }
  .curve-wrap { position:relative; touch-action:pan-y; }
  .curve-wrap svg { cursor:crosshair; }
  .tip { position:absolute; top:6px; pointer-events:none; background:var(--card-background-color, #fff); border:1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius:8px; padding:8px 10px; font-size:12px; box-shadow:0 2px 8px rgba(0,0,0,.25); min-width:130px; z-index:1; }
  .tip .time { font-weight:500; margin-bottom:4px; }
  .tip .r { display:flex; align-items:center; gap:6px; white-space:nowrap; }
  .tip .r b { margin-left:auto; padding-left:12px; font-weight:500; }
  .tip .dot { width:8px; height:8px; border-radius:50%; }
  .tip .rng { display:block; text-align:right; font-size:11px; color:var(--secondary-text-color); margin:-1px 0 2px; }
  .list { display:grid; gap:10px; font-size:14px; }
  .cards { display:grid; gap:16px; grid-template-columns:repeat(12, minmax(0, 1fr)); }
  .cslot { min-width:0; display:flex; flex-direction:column; }
  .cslot > .card, .cslot > .kpis { flex:1; }
  .cslot.edit { outline:1px dashed var(--divider-color, rgba(0,0,0,.3)); outline-offset:4px; border-radius:12px; }
  .cslot.off > :not(.cbar) { opacity:.35; }
  .cslot.dragover { outline:2px solid var(--primary-color, #03a9f4); }
  .cbar { display:flex; align-items:center; gap:6px; margin-bottom:6px; font-size:12px; cursor:grab; color:var(--secondary-text-color); flex-wrap:wrap; }
  .cbar .ct { flex:1; font-weight:500; color:var(--primary-text-color); }
  .cbar .cgrip { font-size:16px; line-height:1; }
  .head .cedit, .head > .chips > .navbtn { margin-left:4px; }
  .modcard { display:flex; flex-direction:column; }
  .modroof-wrap { flex:1; display:flex; flex-direction:column; border-radius:8px; min-height:0; }
  .modroof-wrap.edit { display:block; flex:none; overflow:auto; max-height:600px; }
  .modroof.fit { flex:1; }
  .modroof.edit { min-width:520px; }
  .modroof { position:relative; border-radius:8px; background:repeating-linear-gradient(135deg, rgba(150,80,60,.10) 0 14px, rgba(150,80,60,.04) 14px 28px); }
  .modroof.edit { outline:1px dashed var(--divider-color, rgba(0,0,0,.25)); background-image:linear-gradient(var(--divider-color, rgba(0,0,0,.08)) 1px, transparent 1px), linear-gradient(90deg, var(--divider-color, rgba(0,0,0,.08)) 1px, transparent 1px);  }
  .modtile { position:absolute; box-sizing:border-box; border-radius:6px; border:3px solid #9aa6b5; padding:6px; display:flex; flex-direction:column; justify-content:flex-end; color:#fff; cursor:pointer; transition:background 1s ease, box-shadow 1s ease; user-select:none; overflow:hidden; }
  .modtile.black { border-color:#000; }
  .modroof.edit .modtile { cursor:grab; transition:none; touch-action:none; }
  .modroof.edit .modtile.drag { cursor:grabbing; z-index:2; outline:2px solid var(--primary-color, #03a9f4); }
  .modtile .mn { font-size:1em; text-shadow:0 1px 3px #000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .modtile .mv { font-size:1.3em; font-weight:500; text-shadow:0 1px 3px #000; white-space:nowrap; }
  .modtile .mrot { position:absolute; top:3px; right:5px; font-size:1.25em; cursor:pointer; text-shadow:0 1px 3px #000; }
  .modbar { display:flex; align-items:center; gap:8px; margin-top:10px; font-size:12px; }
  .modbar input[type=range] { flex:1; min-width:80px; accent-color:${SUN_COLOR}; }
  .modbar .modtm { min-width:44px; text-align:right; font-weight:500; }
  .modcard h3 .navbtns { flex-wrap:wrap; }
  .eurv { color:var(--secondary-text-color); font-size:12px; margin-left:8px; }
  .hm-wrap { position:relative; }
  .hm-wrap svg { display:block; width:100%; margin:0 auto; }
  .hm-wrap rect { cursor:pointer; }
  .hmfoot { display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; margin-top:10px; font-size:12px; color:var(--secondary-text-color); }
  .hmleg { display:inline-flex; align-items:center; gap:3px; }
  .hmleg i { display:inline-block; width:10px; height:10px; border-radius:2px; }
  .hmsum { margin-left:auto; }
  .list .item { cursor:pointer; }
  .list .line { display:flex; justify-content:space-between; gap:8px; }
  .list .line b { font-weight:500; }
  .bar { height:6px; border-radius:3px; background:var(--secondary-background-color, rgba(0,0,0,.06)); margin-top:4px; overflow:hidden; }
  .bar > div { height:100%; border-radius:3px; }
  .sep { border-top:1px solid var(--divider-color, rgba(0,0,0,.12)); padding-top:10px; }
  svg { display:block; width:100%; height:auto; overflow:visible; }
  svg text { fill:var(--secondary-text-color); font-size:11px; }
  svg .strong { fill:var(--primary-text-color); font-weight:500; }
  .flow { stroke-dasharray:5 7; animation:dash 0.9s linear infinite; }
  .flow.slow { animation-duration:1.8s; }
  @keyframes dash { to { stroke-dashoffset:-12; } }
  .idle { stroke:var(--divider-color, rgba(0,0,0,.12)); }
  .battery { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  .battery .info { display:grid; gap:4px; font-size:14px; }
  .muted { color:var(--secondary-text-color); }
  .empty { padding:40px 16px; text-align:center; color:var(--secondary-text-color); }
  .loading { display:inline-block; width:14px; height:14px; margin-right:8px; vertical-align:-2px; border:2px solid var(--divider-color, rgba(0,0,0,.15)); border-top-color:${COLORS.pv}; border-radius:50%; animation:spin .8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .click { cursor:pointer; }
  .card h3 { flex-wrap:wrap; }
  .list .total { margin-top:8px; }
  .list .total span { font-size:15px; }
  .list .total b { font-size:20px; }
  .strtile .val.big { font-size:32px; line-height:1.1; }
  .reccard { display:flex; flex-direction:column; }
  .recs { flex:1; display:grid; align-content:space-evenly; gap:10px; font-size:14px; }
  .recrow { display:flex; align-items:center; gap:8px; }
  .recrow b { margin-left:auto; font-size:20px; font-weight:500; white-space:nowrap; }
  .recs small { font-size:12px; font-weight:400; color:var(--secondary-text-color); margin-left:2px; }
  .recs .sep { padding-top:0; }
  .avgrow { display:grid; grid-template-columns:minmax(76px,auto) 1fr 78px; align-items:center; gap:10px; font-size:13px; }
  .avgrow .bar { margin-top:0; }
  .avgrow b { text-align:right; font-weight:500; white-space:nowrap; }
  .avg5 { font-size:12px; font-weight:400; color:var(--secondary-text-color); }
  svg text.sunt { fill:${SUN_COLOR}; font-size:11px; }
  .curve-wrap .zhint { position:absolute; left:50%; top:40%; transform:translate(-50%,-50%); pointer-events:none; background:rgba(0,0,0,.7); color:#fff; font-size:13px; padding:6px 12px; border-radius:8px; opacity:0; transition:opacity .2s; }
  .curve-wrap .zhint.show { opacity:1; }
  .lg { background:none; border:0; color:inherit; font:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:4px; margin-left:10px; padding:0; }
  .lg.fc { cursor:default; }
  .lg.off { opacity:.45; text-decoration:line-through; }
  .navbtns { display:inline-flex; gap:4px; align-items:center; }
  .navbtn { background:transparent; border:1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius:999px; color:var(--secondary-text-color); font:inherit; font-size:12px; padding:2px 10px; cursor:pointer; }
  .navbtn.active { background:var(--secondary-background-color, rgba(0,0,0,.06)); color:var(--primary-text-color); font-weight:500; }
  .navbtn:disabled { opacity:.35; cursor:default; }
  .views { display:inline-flex; border:1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius:999px; overflow:hidden; margin-left:8px; }
  .views button { background:transparent; border:0; color:var(--secondary-text-color); font:inherit; font-size:13px; padding:5px 14px; cursor:pointer; }
  .views button.active { background:var(--secondary-background-color, rgba(0,0,0,.06)); color:var(--primary-text-color); font-weight:500; }
  .batgrid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(270px, 1fr)); }
  .batblock { display:flex; align-items:center; gap:14px; padding:10px 12px; border:1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius:12px; min-width:0; }
  .batblock .info { display:grid; gap:3px; font-size:13px; min-width:0; }
  .batblock .info b { font-size:14px; font-weight:500; }
  .strgrid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); }
  .strtile { justify-content:flex-start; }
  .strtile .lbl { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--primary-text-color); font-weight:500; }
  .strtile .valrow { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .strtile .rows { display:grid; gap:2px; margin-top:6px; font-size:12px; color:var(--secondary-text-color); }
  .strtile .rows span { display:flex; justify-content:space-between; gap:8px; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; flex:none; }
  .share { display:grid; gap:14px; }
  .share .lbl { font-size:12px; color:var(--secondary-text-color); margin-bottom:4px; }
  .stack { display:flex; height:14px; border-radius:7px; overflow:hidden; background:var(--secondary-background-color, rgba(0,0,0,.06)); }
  .legend { display:grid; gap:4px; font-size:13px; }
  .legend span { display:flex; align-items:center; gap:6px; }
  .legend b { margin-left:auto; font-weight:500; }
  .legend i { font-style:normal; color:var(--secondary-text-color); min-width:58px; text-align:right; }
  .ovl-back { position:fixed; inset:0; z-index:10; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; padding:16px; }
  .ovl { width:min(760px, 100%); max-height:calc(100vh - 32px); overflow:auto; box-shadow:0 8px 32px rgba(0,0,0,.4); }
  .ovl h3 .hint { display:inline-flex; gap:12px; }
  .ovl h3 .hint > span { display:inline-flex; align-items:center; gap:4px; }
  .ovl h3 .dot { width:9px; height:9px; border-radius:2px; margin-right:4px; }
  .ovl-chart { position:relative; }
  .ovl-chart .tip { min-width:190px; }
  .ovl-chart .tip .dot { border-radius:2px; }
  .ovl-chart .tip .dev { font-size:11px; color:var(--secondary-text-color); text-align:right; margin:1px 0 6px; }
  .ovl-chart .tip .split { display:flex; height:8px; border-radius:4px; overflow:hidden; margin:2px 0 4px; }
  .ovl-chart .tip .sep { border-top:1px solid var(--divider-color, rgba(0,0,0,.12)); margin-top:5px; padding-top:4px; }
  .ovl-sum { display:flex; flex-wrap:wrap; gap:4px 18px; align-items:baseline; font-size:14px; margin-bottom:4px; }
  .ovl-sum b { font-weight:500; }
  .ovl-sum .aut { color:${COLORS.bat}; }
  .ovl-sum .muted { font-size:12px; }
  .ovl-foot { display:flex; justify-content:flex-end; margin-top:8px; }
  .oday .ohit { fill:transparent; }
  .oday.on .ohit { fill:var(--secondary-text-color); fill-opacity:.12; }
  @media (max-width: 700px) { .cards { gap:8px; } .cslot { grid-column:1 / -1 !important; } .row.wide-left, .row.half { grid-template-columns:1fr; } .content { padding:8px; gap:8px; } .row { gap:8px; } }
`;

class PVSummaryPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._entries = null;
    this._selected = 0;
    this._history = {};
    this._days = [];
    this._months = [];
    this._renderQueued = false;
    this._lastRender = 0;
    this._lastStates = {};
    this._view = "overview";
    this._curves = {};
    this._stringDays = {};
    this._day = null;        // null = heute, sonst Mitternacht des gewählten Tages (ms)
    this._zoom = null;       // [von, bis] in ms oder null
    this._prodMode = "30";  // "30" = letzte 30 Tage, "month" = ein Kalendermonat
    this._prodMonth = null;  // erster Tag des gewählten Monats
    this._monthDays = [];
    this._hidden = {};       // Diagramm -> Set der ausgeblendeten Reihen (nur bis zum nächsten Tag/Zoom)
    this._year = null;       // angezeigtes Jahr der Heatmap (null = aktuelles Jahr)
    this._yearDays = {};     // "Statistik-ID|Jahr" -> Tageswerte
    this._forecast = null;   // Prognose für heute: [[Stundenbeginn ms, Wh], ...] oder null
    this._modT = null;       // Modulansicht: gewählter Zeitpunkt (ms) oder null = live
    this._modEdit = false;   // Modulansicht: Anordnen aktiv
    this._modDraft = null;   // Anordnung während des Bearbeitens
    this._modDrag = null;    // gerade gezogene Kachel
    this._modTimer = null;   // Abspielen des Tages
    this._modSpeed = [0.5, 1, 2, 4].includes(Number(loadPref("pv-summary-modspeed", "1"))) ? Number(loadPref("pv-summary-modspeed", "1")) : 1;
    this._cardEdit = false;  // Karten anpassen aktiv
    this._cardDraft = null;  // Kartenanordnung während des Anpassens
    this._cardDrag = null;   // gerade gezogene Karte
    this._forecastAt = 0;    // Zeitpunkt der letzten Abfrage
    this._loading = {};      // laufende Abfragen: curve, days, month, year
    this._historyDay = null; // Tag, zu dem this._history gehört
    this._ovl = null;        // offenes Overlay
    this._stringMode = loadPref("pv-summary-stringmode", "stack") === "lines" ? "lines" : "stack"; // "stack" (gestapelte Flächen) oder "lines"
    this._dayMode = loadPref("pv-summary-daymode", "day"); // "day" = Produktionszeitraum, "full" = ganzer Tag
  }

  // Ausgeblendete Reihen; „Leistung heute“ zeigt anfangs nur PV
  _hiddenFor(chartId) {
    if (!this._hidden[chartId]) this._hidden[chartId] = new Set(chartId === "main" ? ["house_power", "battery_power", "grid_power"] : []);
    return this._hidden[chartId];
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    currentLocale = hass.locale?.language || hass.language || "de";
    if (this._menu) this._menu.hass = hass;
    if (first) this._init();
    else if (this._statesChanged()) this._queueRender();
  }

  set narrow(narrow) {
    this._narrow = narrow;
    if (this._menu) this._menu.narrow = narrow;
  }

  set panel(panel) { this._panel = panel; }

  connectedCallback() {
    if (this._entries && !this._timer) this._startTimer();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
  }

  // ------------------------------------------------------------------ Setup

  async _init() {
    this.shadowRoot.innerHTML = `<style>${STYLE}</style>
      <div class="toolbar"><ha-menu-button></ha-menu-button><div class="title">PV Summary</div><div class="tabs"></div></div>
      <div class="content"><div class="empty">${TT("Lade Daten …", "Loading …")}</div></div>`;
    this._menu = this.shadowRoot.querySelector("ha-menu-button");
    this._menu.hass = this._hass;
    this._menu.narrow = this._narrow;
    this._content = this.shadowRoot.querySelector(".content");
    this._content.addEventListener("click", (ev) => this._onClick(ev));
    this._resize = new ResizeObserver(() => {
      const w = this._content.clientWidth;
      if (Math.abs(w - (this._width || 0)) > 40) { this._width = w; this._render(); }
    });
    this._resize.observe(this._content);
    this._ovlEl = document.createElement("div");
    this.shadowRoot.appendChild(this._ovlEl);
    this._ovlEl.addEventListener("click", (ev) => this._onOverlayClick(ev));
    this._ovlEl.addEventListener("pointermove", (ev) => this._onOverlayHover(ev));
    this._onKey = (ev) => { if (ev.key === "Escape" && this._ovl) this._closeOverlay(); };
    this.shadowRoot.querySelector(".tabs").addEventListener("click", (ev) => {
      const idx = ev.target.closest(".tab")?.dataset.idx;
      if (idx === undefined) return;
      this._closeOverlay();
      this._selected = Number(idx);
      this._view = "overview";
      this._day = null;
      this._zoom = null;
      this._renderTabs();
      this._fetchHistory();
      this._render();
    });
    try {
      const result = await this._hass.callWS({ type: "pv_summary/config" });
      this._entries = result.entries;
    } catch (err) {
      this._content.innerHTML = `<div class="empty">${TT("PV Summary konnte nicht geladen werden", "PV Summary could not be loaded")}: ${escapeHtml(err.message || String(err))}</div>`;
      return;
    }
    if (!this._entries.length) {
      this._content.innerHTML = `<div class="empty">${TT("Noch keine PV-Anlage eingerichtet.", "No PV system set up yet.")}</div>`;
      return;
    }
    this._renderTabs();
    this._fetchHistory(); // setzt die Ladehinweise, bevor zum ersten Mal gezeichnet wird
    this._render();
    this._startTimer();
  }

  _startTimer() {
    this._timer = setInterval(() => this._fetchHistory(), HISTORY_REFRESH_MS);
  }

  get _entry() { return this._entries?.[this._selected]; }

  // Schlüssel "power" = Anlage, "<subentry_id>|battery_soc" = einzelner Akku oder String
  _subs() { return [...(this._entry?.batteries || []), ...(this._entry?.strings || [])]; }

  _id(key) {
    const sep = key.indexOf("|");
    if (sep < 0) return this._entry?.entities?.[key];
    const sub = this._subs().find((s) => s.id === key.slice(0, sep));
    return sub?.entities?.[key.slice(sep + 1)];
  }

  _state(key) {
    const id = this._id(key);
    return id ? this._hass.states[id] : undefined;
  }

  _num(key) {
    const st = this._state(key);
    if (!st) return null;
    const v = parseFloat(st.state);
    return Number.isFinite(v) ? v : null;
  }

  _has(key) { return Boolean(this._state(key)); }

  _statesChanged() {
    if (!this._entry) return false;
    let changed = false;
    const ids = [...Object.values(this._entry.entities), ...this._subs().flatMap((s) => Object.values(s.entities))];
    for (const id of ids) {
      const st = this._hass.states[id];
      if (this._lastStates[id] !== st) { this._lastStates[id] = st; changed = true; }
    }
    return changed;
  }

  _queueRender() {
    if (this._renderQueued) return;
    if (this._drag || this._pinch || this._modDrag) { setTimeout(() => this._queueRender(), 500); return; }
    this._renderQueued = true;
    const wait = Math.max(0, LIVE_RENDER_MS - (Date.now() - this._lastRender));
    setTimeout(() => { this._renderQueued = false; this._render(); }, wait);
  }

  _onClick(ev) {
    const cardBtn = ev.target.closest("[data-card]");
    if (cardBtn) { this._onCardAction(cardBtn.dataset.card, cardBtn.dataset.id); return; }
    const view = ev.target.closest("[data-view]");
    if (view) {
      this._modStop();
      this._view = view.dataset.view;
      this._hover = null;
      this._render();
      return;
    }
    const toggle = ev.target.closest("[data-series]");
    if (toggle) {
      const set = this._hiddenFor(toggle.dataset.chart);
      if (set.has(toggle.dataset.series)) set.delete(toggle.dataset.series); else set.add(toggle.dataset.series);
      this._hover = null;
      this._render();
      return;
    }
    const nav = ev.target.closest("[data-nav]");
    if (nav) {
      this._onNav(nav.dataset.nav);
      return;
    }
    const rot = ev.target.closest("[data-modrot]");
    if (rot && this._modDraft) {
      const t = this._modDraft.tiles[rot.dataset.modrot];
      if (t) t.rot = !t.rot;
      this._render();
      return;
    }
    if (this._modEdit && ev.target.closest("[data-mod]")) return;
    const ovl = ev.target.closest("[data-open-ovl]");
    if (ovl) {
      this._openOverlay(ovl.dataset.openOvl);
      return;
    }
    const el = ev.target.closest("[data-key]");
    if (!el) return;
    const entityId = this._id(el.dataset.key);
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _onNav(action) {
    if (action.startsWith("mod-")) { this._onModNav(action); return; }
    if (action.startsWith("day-")) { this._modStop(); this._modT = null; }
    const today = startOfDay(Date.now());
    if (action === "day-prev" || action === "day-next") {
      const cur = this._day ?? today;
      const next = startOfDay(cur + (action === "day-prev" ? -1 : 1) * 36e5 * 24 + 36e5 * 2);
      this._day = next >= today ? null : next;
      this._zoom = null;
      this._hidden = {};
      this._hover = null;
      this._fetchCurveHistory();
    } else if (action === "day-today") {
      this._day = null;
      this._zoom = null;
      this._hidden = {};
      this._fetchCurveHistory();
    } else if (action === "dmode-day" || action === "dmode-full") {
      this._dayMode = action === "dmode-full" ? "full" : "day";
      savePref("pv-summary-daymode", this._dayMode);
      this._zoom = null;
      this._hover = null;
      this._render();
    } else if (action === "year-prev" || action === "year-next") {
      const cur = new Date().getFullYear();
      const y = Math.min(cur, (this._year ?? cur) + (action === "year-prev" ? -1 : 1));
      this._year = y === cur ? null : y;
      this._fetchYearDays(y);
      this._render();
    } else if (action === "smode-lines" || action === "smode-stack") {
      this._stringMode = action === "smode-stack" ? "stack" : "lines";
      savePref("pv-summary-stringmode", this._stringMode);
      this._hover = null;
      this._render();
    } else if (action === "zoom-reset") {
      this._zoom = null;
      this._hidden = {};
      this._render();
    } else if (action === "prod-30" || action === "prod-month") {
      this._prodMode = action === "prod-30" ? "30" : "month";
      if (this._prodMode === "month" && !this._prodMonth) {
        const d = new Date(); this._prodMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      if (this._prodMode === "month") this._fetchMonthDays(); else this._render();
    } else if (action === "month-prev" || action === "month-next") {
      const m = this._prodMonth;
      const next = new Date(m.getFullYear(), m.getMonth() + (action === "month-prev" ? -1 : 1), 1);
      const now = new Date();
      if (next > new Date(now.getFullYear(), now.getMonth(), 1)) return;
      this._prodMonth = next;
      this._fetchMonthDays();
    }
  }

  // Erster Moment des angezeigten Tages (heute oder der gewählte vergangene Tag)
  get _dayStart() { return this._day ?? startOfDay(Date.now()); }

  get _isToday() { return this._day === null; }

  // Sonnenauf- und -untergang [ms, ms] am Standort von Home Assistant (null ohne Standort oder bei Polartag/-nacht)
  _sunTimes(dayStart) {
    const lat = this._hass?.config?.latitude, lon = this._hass?.config?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    this._sunCache ||= {};
    const k = `${dayStart}|${lat}|${lon}`;
    if (!(k in this._sunCache)) this._sunCache[k] = sunTimes(dayStart + 12 * 3600 * 1000, lat, lon);
    return this._sunCache[k];
  }

  // ------------------------------------------------------------------ Daten

  async _fetchHistory() {
    const entry = this._entry;
    if (!entry) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const strings = entry.strings || [];
    const total = this._id("total");
    const stringTotals = strings.map((s) => this._id(`${s.id}|string_total`)).filter(Boolean);
    const jobs = [this._fetchCurveHistory(false)];
    if (this._prodMode === "month") jobs.push(this._fetchMonthDays(false));
    jobs.push(this._fetchYearDays(new Date().getFullYear(), false));
    jobs.push(this._fetchForecast());
    if (total) {
      const dayStart = new Date(start); dayStart.setDate(dayStart.getDate() - 29);
      const monthStart = new Date(start.getFullYear(), start.getMonth() - 11, 1);
      const stats = (from, period) => this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: from.toISOString(),
        statistic_ids: [total],
        period,
        types: ["change"],
        units: { energy: "kWh" },
      }).then((res) => (res[total] || []).map((p) => ({ start: new Date(p.start), v: p.change ?? 0 })));
      this._loading.days = true;
      jobs.push(stats(dayStart, "day").then((d) => { this._days = d; }).catch(() => { this._days = []; }).finally(() => { this._loading.days = false; }));
      jobs.push(stats(monthStart, "month").then((m) => { this._months = m; }).catch(() => { this._months = []; }));
    }
    if (stringTotals.length) {
      const dayStart = new Date(start); dayStart.setDate(dayStart.getDate() - 29);
      jobs.push(this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: dayStart.toISOString(),
        statistic_ids: stringTotals,
        period: "day",
        types: ["change"],
        units: { energy: "kWh" },
      }).then((res) => {
        this._stringDays = Object.fromEntries(stringTotals.map((id) => [id, (res[id] || []).map((p) => ({ start: new Date(p.start), v: p.change ?? 0 }))]));
      }).catch(() => { this._stringDays = {}; }));
    }
    await Promise.all(jobs);
    if (entry === this._entry) this._render();
  }

  // Leistungsverlauf (PV, Haus, Akku, Netz, Strings) für den angezeigten Tag
  async _fetchCurveHistory(render = true) {
    const entry = this._entry;
    if (!entry) return;
    const start = this._dayStart;
    const ids = [
      ...["power", "battery_power", "house_power", "grid_power"],
      ...(entry.strings || []).map((s) => `${s.id}|string_power`),
    ].map((k) => this._id(k)).filter(Boolean);
    if (!ids.length) return;
    // Anderer Tag: alte Kurve nicht unter dem neuen Datum zeigen, sondern einen Ladehinweis
    if (this._historyDay !== start) {
      this._history = {};
      this._historyDay = start;
    }
    this._loading.curve = true;
    if (render) this._render();
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(),
        end_time: new Date(start + 24 * 3600 * 1000).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      if (start === this._dayStart) this._history = parseHistory(res);
    } catch (err) {
      this._history = {};
    }
    if (start === this._dayStart) this._loading.curve = false;
    if (render && entry === this._entry) this._render();
  }

  // Ertragsprognose (z. B. Forecast.Solar), so wie sie das Energie-Dashboard verwendet; höchstens alle 15 Minuten
  async _fetchForecast() {
    if (Date.now() - this._forecastAt < 15 * 60000) return;
    this._forecastAt = Date.now();
    try {
      const res = await this._hass.callWS({ type: "energy/solar_forecast" });
      const start = startOfDay(Date.now()), end = start + 24 * 3600000;
      const hours = new Map();
      for (const fc of Object.values(res || {})) {
        for (const [iso, wh] of Object.entries(fc?.wh_hours || {})) {
          const t = new Date(iso).getTime();
          if (t >= start && t < end && Number.isFinite(wh)) hours.set(t, (hours.get(t) || 0) + wh);
        }
      }
      this._forecast = hours.size ? [...hours].sort((a, b) => a[0] - b[0]) : null;
    } catch (err) {
      this._forecast = null; // keine Prognose eingerichtet oder Energie-Dashboard nicht aktiv
    }
  }

  // Tageswerte eines Kalenderjahres für die Heatmap; vergangene Jahre ändern sich nicht mehr und werden nur einmal geladen
  async _fetchYearDays(year, render = true) {
    const total = this._id("total");
    if (!total) return;
    const key = `${total}|${year}`;
    if (this._yearDays[key] && year < new Date().getFullYear()) return;
    this._loading.year = true;
    if (render) this._render();
    try {
      const res = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(year, 0, 1).toISOString(),
        end_time: new Date(year + 1, 0, 1).toISOString(),
        statistic_ids: [total],
        period: "day",
        types: ["change"],
        units: { energy: "kWh" },
      });
      this._yearDays[key] = (res[total] || []).map((p) => ({ start: new Date(p.start), v: p.change ?? 0 }));
    } catch (err) {
      if (!this._yearDays[key]) this._yearDays[key] = [];
    }
    this._loading.year = false;
    if (render) this._render();
  }

  // Tageswerte eines Kalendermonats für die Monatsansicht
  async _fetchMonthDays(render = true) {
    const total = this._id("total");
    const m = this._prodMonth;
    if (!total || !m) return;
    if (this._monthDaysFor !== m) { this._monthDays = []; this._monthDaysFor = m; }
    this._loading.month = true;
    if (render) this._render();
    try {
      const res = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: m.toISOString(),
        end_time: new Date(m.getFullYear(), m.getMonth() + 1, 1).toISOString(),
        statistic_ids: [total],
        period: "day",
        types: ["change"],
        units: { energy: "kWh" },
      });
      if (m === this._prodMonth) this._monthDays = (res[total] || []).map((p) => ({ start: new Date(p.start), v: p.change ?? 0 }));
    } catch (err) {
      this._monthDays = [];
    }
    if (m === this._prodMonth) this._loading.month = false;
    if (render) this._render();
  }

  // ------------------------------------------------------------------ Rendering

  // ------------------------------------------------------------------ Overlay „Haus heute“

  async _openOverlay(kind) {
    if (kind !== "house") return;
    const entry = this._entry;
    this._ovl = { kind, loading: true, days: [], sel: null };
    window.addEventListener("keydown", this._onKey);
    this._renderOverlay();
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 29);
    const keys = { house: "house_total", pv: "total", imp: "grid_import_total" };
    const ids = Object.fromEntries(Object.entries(keys).map(([k, key]) => [k, this._id(key)]).filter(([, id]) => id));
    let byDay = {};
    try {
      const res = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: start.toISOString(),
        statistic_ids: Object.values(ids),
        period: "day",
        types: ["change"],
        units: { energy: "kWh" },
      });
      for (const [k, id] of Object.entries(ids)) {
        for (const p of res[id] || []) {
          const d = new Date(p.start);
          (byDay[d.toDateString()] ||= { start: d })[k] = p.change ?? 0;
        }
      }
    } catch (err) {
      byDay = {};
    }
    if (!this._ovl || this._entry !== entry) return;
    // Heute aus den Live-Sensoren (die Statistik hinkt bis zu einer Stunde hinterher)
    const liveHouse = this._num("house_today");
    if (liveHouse !== null) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const d = (byDay[start.toDateString()] ||= { start });
      d.house = liveHouse;
      if (this._num("today") !== null) d.pv = this._num("today");
      if (this._num("grid_import_today") !== null) d.imp = this._num("grid_import_today");
    }
    this._ovl.days = Object.values(byDay).filter((d) => d.house !== undefined).sort((a, b) => a.start - b.start).slice(-30);
    this._ovl.loading = false;
    this._renderOverlay();
  }

  _closeOverlay() {
    this._ovl = null;
    window.removeEventListener("keydown", this._onKey);
    if (this._ovlEl) this._ovlEl.innerHTML = "";
  }

  _onOverlayClick(ev) {
    if (ev.target.classList.contains("ovl-back") || ev.target.closest("[data-ovl=close]")) { this._closeOverlay(); return; }
    if (ev.target.closest("[data-ovl=history]")) {
      const entityId = this._id("house_today");
      this._closeOverlay();
      if (entityId) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
      return;
    }
    this._onOverlayHover(ev);
  }

  // Tag unter dem Zeiger (bzw. angetippt) hervorheben und seine Werte im Tooltip neben dem Balken zeigen
  _onOverlayHover(ev) {
    if (!this._ovl) return;
    const wrap = this._ovlEl.querySelector(".ovl-chart");
    const tip = wrap?.querySelector(".tip");
    const g = ev.target.closest?.("[data-day]");
    const i = g ? Number(g.dataset.day) : null;
    if (this._ovl.sel !== i) {
      this._ovl.sel = i;
      for (const el of this._ovlEl.querySelectorAll("[data-day]")) el.classList.toggle("on", Number(el.dataset.day) === i);
    }
    if (!tip) return;
    if (i === null) { tip.style.display = "none"; return; }
    tip.innerHTML = this._overlayTip(this._ovl.days[i], this._overlayStats());
    tip.style.display = "block";
    const wr = wrap.getBoundingClientRect(), hit = g.querySelector(".ohit").getBoundingClientRect();
    let left = hit.right - wr.left + 6;
    if (left + tip.offsetWidth > wr.width) left = hit.left - wr.left - tip.offsetWidth - 6;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = "4px";
  }

  // Tooltip eines Tages: Hausverbrauch mit Abweichung zum Ø, Herkunft (PV/Akku gegen Netz), Autarkie und PV
  _overlayTip(d, st) {
    const row = (color, label, value, extra = "") => `<div class="r${extra}">${color ? `<span class="dot" style="background:${color}"></span>` : ""}${label}<b>${value}</b></div>`;
    const date = d.start.toLocaleDateString(LOCALE(), { weekday: "short", day: "numeric", month: "long" });
    const today = st.isToday(d);
    let html = `<div class="time">${date}${today ? ` <span class="muted">${TT("(bis jetzt)", "(so far)")}</span>` : ""}</div>`;
    html += row("", TT("Hausverbrauch", "House consumption"), `${fmt(d.house, 1)} kWh`);
    if (st.avg && !today && d !== st.partial) {
      const dev = ((d.house - st.avg) / st.avg) * 100;
      html += `<div class="dev">${dev >= 0 ? "+" : "−"}${fmt(Math.abs(dev), 0)} % ${TT("ggü. Ø", "vs. avg")} ${fmt(st.avg, 1)} kWh</div>`;
    }
    if (d.imp !== undefined) {
      const grid = Math.min(Math.max(d.imp, 0), d.house), own = Math.max(d.house - grid, 0);
      const ownPct = d.house > 0 ? (own / d.house) * 100 : 0;
      html += `<div class="split"><span style="width:${ownPct.toFixed(1)}%;background:${COLORS.pv}"></span><span style="flex:1;background:${COLORS.grid}"></span></div>`
        + row(COLORS.pv, TT("aus PV / Akku", "from PV / battery"), `${fmt(own, 1)} kWh`)
        + row(COLORS.grid, TT("aus dem Netz", "from the grid"), `${fmt(grid, 1)} kWh`);
      const aut = autarky(d.imp, d.house);
      if (aut !== null) html += row("", TT("Autarkie", "Self-sufficiency"), `<span style="color:${COLORS.bat}">${fmt(aut, 0)} %</span>`, " sep");
    }
    if (d.pv !== undefined) html += row("", TT("PV-Erzeugung", "PV production"), `${fmt(d.pv, 1)} kWh`, d.imp === undefined ? " sep" : "");
    if (d === st.partial) html += `<div class="muted" style="margin-top:4px">${TT("erster Tag, unvollständig", "first day, incomplete")}</div>`;
    return html;
  }

  // Kennwerte des Overlays: Ø und Autarkie nur aus vollen Tagen (ohne heute und ohne unvollständigen ersten Tag)
  _overlayStats() {
    const days = this._ovl.days;
    const todayKey = new Date().toDateString();
    const isToday = (d) => d.start.toDateString() === todayKey;
    let full = days.filter((d) => !isToday(d));
    // Erster Tag der Statistik (meist der Einrichtungstag): unvollständig, wenn auffällig klein
    let partial = null;
    if (full.length > 1 && days[0] === full[0]) {
      const rest = full.slice(1);
      const restAvg = rest.reduce((a, d) => a + d.house, 0) / rest.length;
      if (full[0].house < restAvg * 0.5) { partial = full[0]; full = rest; }
    }
    const sum = (k) => full.reduce((a, d) => a + (d[k] ?? 0), 0);
    const avg = full.length ? sum("house") / full.length : null;
    const withImp = full.length > 0 && full.every((d) => d.imp !== undefined);
    const aut = withImp ? autarky(sum("imp"), sum("house")) : null;
    return { isToday, partial, avg, aut };
  }

  _renderOverlay() {
    const o = this._ovl;
    if (!o || !this._ovlEl) return;
    const title = TT("Hausverbrauch, letzte 30 Tage", "House consumption, last 30 days");
    const legend = `<span class="hint"><span><span class="dot" style="background:${COLORS.house}"></span>${TT("Haus", "House")}</span><span><span class="dot" style="background:${COLORS.pv}"></span>PV</span></span>`;
    let body;
    if (o.loading) body = `<div class="empty">${LOADING()}</div>`;
    else if (!o.days.length) body = `<div class="empty">${TT("Noch keine Tageswerte für den Hausverbrauch.", "No daily values for the house consumption yet.")}</div>`;
    else {
      const st = this._overlayStats();
      const since = `<span class="muted">${o.days.length < 30 ? `${TT("Daten seit", "Data since")} ${fmtDayMonth(o.days[0].start)} · ` : ""}${TT("nur volle Tage", "full days only")}</span>`;
      body = `<div class="ovl-sum">${st.avg !== null ? `<span>${TT("Ø Haus", "Avg house")} <b>${fmt(st.avg, 1)} kWh</b></span>` : ""}${st.aut !== null ? `<span class="aut">${TT("Autarkie", "Self-sufficiency")} <b>${fmt(st.aut, 0)} %</b></span>` : ""}${since}</div>
        ${this._overlayChart(st)}`;
    }
    this._ovlEl.innerHTML = `<div class="ovl-back"><div class="ovl card" role="dialog" aria-modal="true" aria-label="${title}">
      <h3><ha-icon icon="mdi:home-lightning-bolt-outline"></ha-icon>${title}${legend}<button class="navbtn" data-ovl="close" title="${TT("Schließen", "Close")}">✕</button></h3>
      ${body}
      <div class="ovl-foot"><button class="navbtn" data-ovl="history">${TT("Verlauf öffnen", "Open history")}</button></div>
    </div></div>`;
  }

  _overlayChart(st) {
    const days = this._ovl.days, n = days.length;
    const W = Math.max(300, Math.min(760, window.innerWidth - 32) - 34), H = 220, L = 36, R = 6, T = 10, B = 22;
    const maxV = niceMax(Math.max(1, ...days.map((d) => Math.max(d.house, d.pv ?? 0))));
    const y = (v) => T + (1 - v / maxV) * (H - T - B);
    // Nur vorhandene Tage, Balkengruppe höchstens 70 px breit
    const slot = (W - L - R) / n, gw = Math.min(70, slot * 0.75);
    // Datum an jedem Balken, wenn Platz ist, sonst an jedem 5. bzw. 10. (vom heutigen Tag aus); Werte zeigt der Tooltip
    const every = slot >= 44 ? 1 : [5, 10, 15].find((k) => slot * k >= 44) ?? 30;
    let svg = `<defs><pattern id="ovl-hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${COLORS.house}" fill-opacity="0.3"/><line x1="0" y1="0" x2="0" y2="5" stroke="${COLORS.house}" stroke-width="2"/></pattern></defs>`;
    for (const v of ticks(0, maxV)) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtAxis(v)}</text>`;
    days.forEach((d, i) => {
      const cx = L + slot * i + slot / 2, gx = cx - gw / 2;
      const hw = gw * 0.66, pw = gw * 0.3;
      const today = st.isToday(d), partial = d === st.partial;
      let house = barRect(gx, hw, d.house, maxV, H - B, H - T - B, partial ? "url(#ovl-hatch)" : COLORS.house, "", 2).replace(/<title><\/title>/, "");
      if (today) house = house.replace("<rect ", `<rect fill-opacity="0.6" `);
      svg += `<g data-day="${i}" class="oday${this._ovl.sel === i ? " on" : ""}"><rect x="${(cx - slot / 2).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${H - T - B}" class="ohit"/>`
        + house
        + (d.pv !== undefined ? barRect(gx + hw + gw * 0.04, pw, d.pv, maxV, H - B, H - T - B, COLORS.pv, "", 1.5).replace(/<title><\/title>/, "") : "")
        + "</g>";
      if ((n - 1 - i) % every) return;
      svg += `<text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle" pointer-events="none">${fmtDayMonth(d.start)}</text>`;
    });
    if (st.avg !== null) svg += `<line x1="${L}" x2="${W - R}" y1="${y(st.avg)}" y2="${y(st.avg)}" stroke="${COLORS.house}" stroke-dasharray="5 4" stroke-width="1.5" pointer-events="none"/>`;
    const notes = [
      st.avg !== null ? TT("gestrichelt = Ø Haus", "dashed = avg house") : "",
      st.partial ? TT("schraffiert = erster Tag (unvollständig)", "hatched = first day (incomplete)") : "",
      days.some(st.isToday) ? TT("heute heller", "today lighter") : "",
    ].filter(Boolean).join(" · ");
    return `<div class="ovl-chart"><svg viewBox="0 0 ${W} ${H}">${svg}</svg><div class="tip" style="display:none"></div></div>${notes ? `<div class="muted" style="font-size:12px">${notes}</div>` : ""}`;
  }

  _renderTabs() {
    const tabs = this.shadowRoot.querySelector(".tabs");
    tabs.innerHTML = this._entries.length > 1
      ? this._entries.map((e, i) => `<button class="tab ${i === this._selected ? "active" : ""}" data-idx="${i}">${escapeHtml(e.title)}</button>`).join("")
      : "";
  }

  _render() {
    if (!this._entry || !this._content) return;
    if (this._pinch) { this._queueRender(); return; } // laufende Zwei-Finger-Geste nicht unterbrechen
    this._lastRender = Date.now();
    const parts = [this._renderHead(), this._renderCards()];
    this._content.innerHTML = parts.join("");
    this._bindCards();
    this._bindCurve();
    this._bindYear();
    this._bindModules();
  }

  // ---------------------------------------------------------------- Kartenraster (Reihenfolge, Ausblenden, Breite)

  _cardTab() { return this._view === "strings" && this._entry.strings?.length ? "strings" : "overview"; }

  // Karten je Tab mit Standardbreite (von 12 Spalten); „half“ = lässt sich auf halbe Breite stellen
  _cardDefs(tab) {
    if (tab === "strings") {
      return [
        { id: "scurve", span: 12, half: true, title: TT("Leistung je String", "Power per string"), html: () => this._curveCard("strings") },
        { id: "stiles", span: 12, half: true, title: TT("Ertrag je String", "Yield per string"), html: () => this._renderStringTiles() },
        { id: "sdays", span: 7, title: TT("Produktion je String, 30 Tage", "Production per string, 30 days"), html: () => this._renderStringDays() },
        { id: "share", span: 5, title: TT("Anteil am Gesamtertrag", "Share of total yield"), html: () => this._renderStringShare() },
        { id: "mods", span: 12, half: true, title: TT("Module", "Modules"), html: () => this._renderModules() },
      ];
    }
    const defs = [
      { id: "flow", span: 6, title: TT("Energiefluss jetzt", "Energy flow now"), html: () => this._renderFlow() },
      { id: "kpis", span: 6, title: TT("Kennzahlen", "Key figures"), html: () => this._renderKpis() },
      { id: "curve", span: 12, title: TT("Leistung heute", "Power today"), html: () => this._curveCard("main") },
      { id: "days", span: 7, title: TT("Produktion der letzten 30 Tage", "Production, last 30 days"), html: () => this._renderDays() },
      { id: "periods", span: 5, title: TT("Zeiträume", "Periods"), html: () => this._renderPeriods() },
    ];
    if (this._entry.batteries?.length) defs.push({ id: "battery", span: 12, title: TT("Akkus", "Batteries"), html: () => this._renderBattery() });
    defs.push(
      { id: "records", span: 6, title: TT("Durchschnitt und Rekorde", "Averages and records"), html: () => this._renderRecords() },
      { id: "months", span: 6, title: TT("Produktion der letzten 12 Monate", "Production, last 12 months"), html: () => this._renderMonths() },
    );
    if (this._id("total")) defs.push({ id: "year", span: 12, title: TT("Produktion im Jahr", "Production by year"), html: () => this._renderYear() });
    return defs;
  }

  _cardCfg(tab) { return (this._cardDraft || this._entry.cards || {})[tab] || {}; }

  _cardHalf(tab, id) { return (this._cardCfg(tab).half || []).includes(id); }

  // Gespeicherte Reihenfolge; Karten, die (noch) nicht darin stehen, kommen an ihren Standardplatz
  _cardOrder(tab) {
    const defs = this._cardDefs(tab), ids = defs.map((d) => d.id);
    const order = (this._cardCfg(tab).order || []).filter((id) => ids.includes(id));
    ids.forEach((id, i) => { if (!order.includes(id)) order.splice(Math.min(i, order.length), 0, id); });
    return order.map((id) => defs.find((d) => d.id === id));
  }

  _renderCards() {
    const tab = this._cardTab(), edit = this._cardEdit;
    const hidden = new Set(this._cardCfg(tab).hidden || []);
    const slots = this._cardOrder(tab).filter((d) => edit || !hidden.has(d.id)).map((d) => {
      const html = d.html();
      if (!html) return "";
      const half = d.half && this._cardHalf(tab, d.id), span = half ? 6 : d.span, off = hidden.has(d.id);
      const bar = edit ? `<div class="cbar" draggable="true" data-drag="${d.id}" title="${TT("Ziehen zum Verschieben", "Drag to move")}"><span class="cgrip">⠿</span><span class="ct">${escapeHtml(d.title)}</span>
          ${d.half ? `<button class="navbtn" data-card="half" data-id="${d.id}">${half ? TT("halbe Breite", "half width") : TT("volle Breite", "full width")}</button>` : ""}
          <button class="navbtn" data-card="up" data-id="${d.id}" title="${TT("Nach vorne", "Move up")}">↑</button>
          <button class="navbtn" data-card="down" data-id="${d.id}" title="${TT("Nach hinten", "Move down")}">↓</button>
          <button class="navbtn" data-card="eye" data-id="${d.id}" title="${off ? TT("Einblenden", "Show") : TT("Ausblenden", "Hide")}"><ha-icon icon="${off ? "mdi:eye-off-outline" : "mdi:eye-outline"}" style="--mdc-icon-size:15px"></ha-icon></button></div>` : "";
      return `<div class="cslot${edit ? " edit" : ""}${off ? " off" : ""}" data-slot="${d.id}" style="grid-column:span ${span}">${bar}${html}</div>`;
    });
    return `<div class="cards">${slots.join("")}</div>`;
  }

  // Ziehen der Karten im Anpassen-Modus (am Balken über der Karte)
  _bindCards() {
    if (!this._cardEdit) return;
    for (const bar of this._content.querySelectorAll(".cbar[data-drag]")) {
      bar.addEventListener("dragstart", (ev) => { this._cardDrag = bar.dataset.drag; ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", this._cardDrag); });
      bar.addEventListener("dragend", () => { this._cardDrag = null; });
    }
    for (const slot of this._content.querySelectorAll(".cslot")) {
      slot.addEventListener("dragover", (ev) => { if (this._cardDrag) { ev.preventDefault(); slot.classList.add("dragover"); } });
      slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
      slot.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const from = this._cardDrag, to = slot.dataset.slot;
        this._cardDrag = null;
        if (!from || from === to) { this._render(); return; }
        const order = this._cardDraftTab().order, fi = order.indexOf(from);
        order.splice(fi, 1);
        const ti = order.indexOf(to);
        order.splice(fi <= ti ? ti + 1 : ti, 0, from);
        this._render();
      });
    }
  }

  // Bearbeitungsstand des aktuellen Tabs (mit vollständiger Reihenfolge)
  _cardDraftTab() {
    const tab = this._cardTab();
    const cur = this._cardDraft[tab] || {};
    this._cardDraft[tab] = { order: this._cardOrder(tab).map((d) => d.id), hidden: [...(cur.hidden || [])], half: [...(cur.half || [])] };
    return this._cardDraft[tab];
  }

  _onCardAction(action, id) {
    if (action === "edit") {
      this._cardDraft = JSON.parse(JSON.stringify(this._entry.cards || {}));
      this._cardEdit = true;
      this._render();
      return;
    }
    if (!this._cardDraft) return;
    if (action === "cancel") {
      this._cardDraft = null;
      this._cardEdit = false;
    } else if (action === "reset") {
      if (!window.confirm(TT("Alle Karten dieses Tabs auf die Standardansicht zurücksetzen?", "Reset all cards of this tab to the default view?"))) return;
      delete this._cardDraft[this._cardTab()];
    } else if (action === "done") {
      const entry = this._entry, cards = Object.keys(this._cardDraft).length ? this._cardDraft : null;
      entry.cards = cards;
      this._cardDraft = null;
      this._cardEdit = false;
      this._hass.callWS({ type: "pv_summary/cards", entry_id: entry.entry_id, ...(cards ? { cards } : {}) })
        .then((res) => { entry.cards = res.cards; })
        .catch((err) => console.warn("PV Summary: Kartenanordnung konnte nicht gespeichert werden", err));
    } else {
      const t = this._cardDraftTab(), i = t.order.indexOf(id);
      if (action === "up" && i > 0) [t.order[i - 1], t.order[i]] = [t.order[i], t.order[i - 1]];
      else if (action === "down" && i >= 0 && i < t.order.length - 1) [t.order[i + 1], t.order[i]] = [t.order[i], t.order[i + 1]];
      else if (action === "eye") t.hidden = t.hidden.includes(id) ? t.hidden.filter((x) => x !== id) : [...t.hidden, id];
      else if (action === "half") t.half = t.half.includes(id) ? t.half.filter((x) => x !== id) : [...t.half, id];
    }
    this._render();
  }

  _curveCard(chartId) {
    if (chartId === "strings") {
      return this._renderCurve("strings", TT("Leistung je String", "Power per string"), "mdi:solar-panel-large",
        this._entry.strings.map((s, i) => ({ key: `${s.id}|string_power`, color: STRING_COLORS[i % STRING_COLORS.length], label: s.title })),
        { stacked: this._stringMode === "stack", modes: true });
    }
    return this._renderCurve("main", TT("Leistung", "Power"), "mdi:chart-areaspline", [
      { key: "power", color: COLORS.pv, fill: true, peak: true, label: "PV" },
      { key: "house_power", color: COLORS.house, label: TT("Haus", "House") },
      { key: "battery_power", color: COLORS.bat, signed: [TT("lädt", "charging"), TT("entlädt", "discharging")], label: TT("Akku", "Battery") },
      { key: "grid_power", color: COLORS.grid, signed: [TT("Bezug", "import"), TT("Einspeisung", "export")], label: TT("Netz", "Grid") },
    ]);
  }

  // Nur ein Diagramm neu zeichnen (beim Zoomen): das SVG-Element bleibt, damit laufende Gesten weitergehen
  _updateCurve(chartId) {
    const wrap = this._content?.querySelector(`.curve-wrap[data-chart="${chartId}"]`);
    const card = wrap?.closest(".card");
    if (!card) { this._render(); return; }
    const tpl = document.createElement("template");
    tpl.innerHTML = this._curveCard(chartId);
    const fresh = tpl.content.querySelector(".curve-wrap svg");
    if (!fresh) { this._render(); return; }
    const svg = wrap.querySelector("svg");
    svg.setAttribute("viewBox", fresh.getAttribute("viewBox"));
    svg.innerHTML = fresh.innerHTML;
    card.querySelector("h3").replaceWith(tpl.content.querySelector("h3"));
    this._showHover(chartId);
  }

  // Grundausschnitt ohne Zoom: ganzer Tag oder (Standard) nur der Zeitraum mit Sonne bzw. PV-Leistung,
  // je eine halbe Stunde Rand, auf halbe Stunden gerundet
  _curveBase(rows, dayStart) {
    const full = [dayStart, dayStart + 24 * 3600 * 1000];
    // Haus, Akku und Netz haben auch nachts Werte: dann immer der ganze Tag
    if (this._dayMode === "full" || rows.some((r) => !isPvKey(r.key))) return full;
    let a = Infinity, b = -Infinity;
    for (const r of rows) for (const bin of r.bins) if (bin[3] > 5) { a = Math.min(a, bin[0]); b = Math.max(b, bin[0] + BIN_MS); }
    const sun = this._sunTimes(dayStart);
    if (sun) { a = Math.min(a, sun[0]); b = Math.max(b, sun[1]); }
    if (!Number.isFinite(a) || !Number.isFinite(b)) return full;
    const half = 30 * 60 * 1000;
    a = dayStart + Math.floor((a - half - dayStart) / half) * half;
    b = dayStart + Math.ceil((b + half - dayStart) / half) * half;
    return [Math.max(a, full[0]), Math.min(b, full[1])];
  }

  // Ausschnitt setzen: auf den Tag begrenzt, mindestens ZOOM_MIN_MS; entspricht er dem Grundausschnitt, gibt es keinen Zoom
  _setZoom(a, b) {
    const d0 = this._dayStart, d1 = d0 + 24 * 3600 * 1000;
    const base = this._curves[this._view === "strings" ? "strings" : "main"]?.base ?? [d0, d1];
    let span = Math.min(Math.max(b - a, ZOOM_MIN_MS), d1 - d0);
    if (span >= d1 - d0 - 1000) { this._zoom = base[1] - base[0] >= d1 - d0 - 1000 ? null : [d0, d1]; return; }
    a = Math.min(Math.max(a, d0), d1 - span);
    this._zoom = [a, a + span];
  }

  // Zeichnen beim Zoomen höchstens einmal je Bildschirm-Frame
  _zoomFrame(chartId) {
    if (this._zoomRaf) return;
    this._zoomRaf = requestAnimationFrame(() => { this._zoomRaf = null; this._updateCurve(chartId); });
  }

  _renderHead() {
    const power = this._num("power");
    const active = power !== null && power >= (this._entry.threshold ?? 10);
    const chips = [
      `<span class="chip ${active ? "on" : "off"}"><ha-icon icon="${active ? "mdi:white-balance-sunny" : "mdi:weather-night"}" style="--mdc-icon-size:16px"></ha-icon>${active ? TT("produziert", "producing") : TT("ruht", "idle")}</span>`,
    ];
    const avg30 = this._num("avg_daily_30");
    if (avg30 !== null) chips.push(`<span class="chip click" data-key="avg_daily_30"><ha-icon icon="mdi:chart-line" style="--mdc-icon-size:16px"></ha-icon>Ø ${fmt(avg30, 1)} ${TT("kWh/Tag", "kWh/day")}</span>`);
    const views = this._entry.strings?.length
      ? `<div class="views">${[["overview", TT("Übersicht", "Overview")], ["strings", "Strings"]].map(([v, label]) => `<button data-view="${v}" class="${this._view === v ? "active" : ""}">${label}</button>`).join("")}</div>`
      : "";
    const edit = this._cardEdit
      ? `<span class="navbtns cedit"><button class="navbtn" data-card="reset"><ha-icon icon="mdi:restore" style="--mdc-icon-size:15px"></ha-icon> ${TT("Standardansicht", "Default view")}</button><button class="navbtn" data-card="cancel">${TT("Abbrechen", "Cancel")}</button><button class="navbtn active" data-card="done">${TT("Fertig", "Done")}</button></span>`
      : this._hass?.user?.is_admin ? `<button class="navbtn" data-card="edit" title="${TT("Karten anordnen und ausblenden", "Arrange and hide cards")}"><ha-icon icon="mdi:pencil-outline" style="--mdc-icon-size:15px"></ha-icon> ${TT("Anpassen", "Customize")}</button>` : "";
    return `<div class="head"><ha-icon icon="mdi:solar-power-variant" style="color:${COLORS.pv};--mdc-icon-size:28px"></ha-icon><span class="name">${escapeHtml(this._entry.title)}</span>${views}<div class="chips">${chips.join("")}${edit}</div></div>`;
  }

  _renderFlow() {
    const pv = this._num("power") ?? 0;
    const bat = this._has("battery_power") ? this._num("battery_power") ?? 0 : null;
    const house = this._has("house_power") ? this._num("house_power") ?? 0 : null;
    const soc = this._num("battery_soc");

    // Netz kommt vom Zähler (bzw. aus dem Hausverbrauch berechnet): positiv = Bezug, negativ = Einspeisung
    const grid = this._has("grid_power") ? this._num("grid_power") ?? 0 : null;
    const charge = bat !== null ? Math.max(bat, 0) : 0;
    const discharge = bat !== null ? Math.max(-bat, 0) : 0;
    const imp = grid !== null ? Math.max(grid, 0) : 0;
    const exp = grid !== null ? Math.max(-grid, 0) : 0;
    // Bilanz: Quellen (PV, Akku-Entladen, Netzbezug) auf Senken (Haus, Akku-Laden, Einspeisung) verteilen
    const need = house ?? Math.max(pv - charge, 0);
    // PV lädt zuerst den Akku: Lädt der Akku, während das Haus aus dem Netz bezieht, kommt die Ladung aus der PV
    const pvToBat = Math.min(pv, charge);
    const pvToHouse = Math.min(pv - pvToBat, need);
    const pvToGrid = Math.min(pv - pvToBat - pvToHouse, exp);
    const batToHouse = Math.min(discharge, need - pvToHouse);
    const batToGrid = Math.min(discharge - batToHouse, Math.max(exp - pvToGrid, 0));
    const gridToHouse = Math.min(imp, Math.max(need - pvToHouse - batToHouse, 0));
    const gridToBat = Math.min(Math.max(imp - gridToHouse, 0), Math.max(charge - pvToBat, 0));

    const nodes = {
      pv: { x: 60, y: 110, color: COLORS.pv, icon: "mdi:solar-power-variant", label: "PV", value: fmtW(pv), key: "power" },
      house: { x: 380, y: 110, color: COLORS.house, arcs: house ? [
        { label: "PV", color: COLORS.pv, v: pvToHouse },
        { label: TT("Akku", "Battery"), color: COLORS.bat, v: batToHouse },
        { label: TT("Netz", "Grid"), color: COLORS.grid, v: gridToHouse },
      ] : null, icon: "mdi:home", label: house !== null ? TT("Haus", "House") : TT("Haus/Netz", "House/Grid"), value: house !== null ? fmtW(house) : "≈ " + fmtW(need), key: house !== null ? "house_power" : null },
      // Leistung öffnet die Lade-/Entladeleistung, die Prozentzahl den Akkustand;
      // Ring und Symbol bleiben in der Akku-Farbe, nur die Füllung zeigt den Ladestand farbig
      bat: { x: 220, y: 195, color: COLORS.bat, fillColor: soc !== null ? socColor(soc) : COLORS.bat, fill: soc, icon: "mdi:home-battery", label: soc !== null ? `${fmt(soc, 0)} %` : TT("Akku", "Battery"), value: bat !== null ? (bat > 0 ? "+" : bat < 0 ? "−" : "") + fmtW(Math.abs(bat)) : "", key: this._has("battery_power") ? "battery_power" : soc !== null ? "battery_soc" : null, labelKey: bat !== null && soc !== null ? "battery_soc" : null },
      grid: { x: 220, y: 45, color: COLORS.grid, icon: "mdi:transmission-tower", label: grid === null || Math.abs(grid) <= 1 ? TT("Netz", "Grid") : grid < 0 ? TT("Einspeisung", "Export") : TT("Bezug", "Import"), value: grid !== null ? fmtW(Math.abs(grid)) : "", key: this._has("grid_power") ? "grid_power" : null },
    };
    const line = (a, b, forward, backward, colorA, colorB) => {
      const reverse = backward > 1 && backward > forward;
      const amount = reverse ? backward : forward;
      const [from, to] = reverse ? [nodes[b], nodes[a]] : [nodes[a], nodes[b]];
      const active = amount > 1;
      const cls = active ? `flow ${amount < 100 ? "slow" : ""}` : "idle";
      const stroke = active ? (reverse ? colorB : colorA) : "";
      return `<path d="M${from.x} ${from.y} L${to.x} ${to.y}" class="${cls}" stroke="${stroke}" stroke-width="${active ? 3 : 2}" fill="none"/>`;
    };
    const showBat = bat !== null || soc !== null;
    const showGrid = grid !== null;
    let lines = line("pv", "house", pvToHouse, 0, COLORS.pv);
    if (showBat) lines += line("pv", "bat", pvToBat, 0, COLORS.pv) + line("bat", "house", batToHouse, 0, COLORS.bat);
    if (showGrid) lines += line("pv", "grid", pvToGrid, 0, COLORS.pv) + line("grid", "house", gridToHouse, 0, COLORS.grid);
    if (showGrid && showBat) lines += line("bat", "grid", batToGrid, gridToBat, COLORS.bat, COLORS.grid);
    const circle = (n, show = true) => !show ? "" : `
      <g class="${n.key ? "click" : ""}" ${n.key ? `data-key="${n.key}"` : ""}>
        <circle cx="${n.x}" cy="${n.y}" r="40" fill="var(--card-background-color, #fff)" stroke="${n.color}" stroke-width="${n.arcs ? 4 : 3}"/>
        ${n.arcs ? sourceArcs(n) : ""}
        ${n.fill != null ? `<clipPath id="pvs-fill"><circle cx="${n.x}" cy="${n.y}" r="38.5"/></clipPath><rect x="${n.x - 40}" y="${(n.y + 40 - 0.8 * Math.min(Math.max(n.fill, 0), 100)).toFixed(1)}" width="80" height="${(0.8 * Math.min(Math.max(n.fill, 0), 100)).toFixed(1)}" fill="${n.fillColor || n.color}" fill-opacity="0.3" clip-path="url(#pvs-fill)"/>` : ""}
        <foreignObject x="${n.x - 12}" y="${n.y - 32}" width="24" height="24"><ha-icon icon="${n.icon}" style="color:${n.color};--mdc-icon-size:22px"></ha-icon></foreignObject>
        <text x="${n.x}" y="${n.y + 8}" text-anchor="middle" class="strong" style="font-size:13px">${n.value || n.label}</text>
        <text x="${n.x}" y="${n.y + 23}" text-anchor="middle" style="font-size:${n.labelKey ? 12 : 10}px" ${n.labelKey ? `class="click strong" data-key="${n.labelKey}"` : ""}>${n.value ? n.label : ""}</text>
      </g>`;
    const hint = house === null ? `<span class="hint">${TT("Netz bzw. Hausverbrauch nicht eingerichtet", "Grid or house consumption not set up")}</span>` : "";
    const flow = `<svg viewBox="0 ${showGrid ? 0 : 60} 440 ${(showBat ? 240 : 175) - (showGrid ? 0 : 60)}">${lines}${circle(nodes.grid, showGrid)}${circle(nodes.pv)}${circle(nodes.house)}${circle(nodes.bat, showBat)}</svg>`;
    return `<div class="card flowcard"><h3><ha-icon icon="mdi:transit-connection-variant"></ha-icon>${TT("Energiefluss jetzt", "Energy flow now")}${hint}</h3>${flow}</div>`;
  }

  _renderKpis() {
    const today = this._num("today");
    const avg30 = this._num("avg_daily_30");
    const max = this._state("max_power_today");
    const best = this._state("best_day");
    let delta = "";
    if (today !== null && avg30) {
      const pct = ((today - avg30) / avg30) * 100;
      delta = `<div class="sub ${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "+" : "−"}${fmt(Math.abs(pct), 0)} % ${TT("ggü. Ø 30 Tage", "vs. 30-day avg")}</div>`;
    }
    const kpi = (key, icon, color, label, value, unit, sub, attrs = "") => `<div class="card kpi${attrs ? " click" : ""}" ${attrs}>
        <div class="ico" style="background:${color}22;color:${color}"><ha-icon icon="${icon}"></ha-icon></div>
        <div class="txt"><div class="lbl">${label}</div><div class="val">${value}<small>${unit}</small></div>${sub || ""}</div>
      </div>`;
    const sub = (text) => `<div class="sub">${text || "&nbsp;"}</div>`;
    const hours = this._num("production_time_today");
    const sixth = this._has("house_today")
      ? kpi("house_today", "mdi:home-lightning-bolt-outline", COLORS.house, TT("Haus heute", "House today"), fmt(this._num("house_today"), 2), "kWh", sub(TT("Verbrauch · 30 Tage ›", "Consumption · 30 days ›")), `data-open-ovl="house" title="${TT("Hausverbrauch der letzten 30 Tage", "House consumption, last 30 days")}"`)
      : kpi("week", "mdi:calendar-week", "#639922", TT("Diese Woche", "This week"), fmt(this._num("week"), 1), "kWh", sub(""));
    const saved = this._num("savings_today");
    const savedSub = saved !== null ? `<div class="sub">≈ ${this._money(saved)} ${TT("gespart", "saved")}</div>` : "";
    return `<div class="kpis">
      ${kpi("today", "mdi:solar-power", COLORS.pv, TT("Heute", "Today"), fmt(today, 2), "kWh", (delta || (savedSub ? "" : sub(""))) + savedSub)}
      ${kpi("yesterday", "mdi:calendar-arrow-left", "#8a8a8a", TT("Gestern", "Yesterday"), fmt(this._num("yesterday"), 2), "kWh", sub(best ? TT("Bester Tag ", "Best day ") + fmt(this._num("best_day"), 1) + " kWh" : ""))}
      ${kpi("max_power_today", "mdi:flash", "#ef6c00", TT("Spitze heute", "Peak today"), fmtWValue(this._num("max_power_today")), fmtWUnit(this._num("max_power_today")), sub(max?.attributes?.time ? TT("um ", "at ") + fmtTime(max.attributes.time) : ""))}
      ${kpi("avg_power_today", "mdi:chart-bell-curve-cumulative", "#c9a000", TT("Ø Leistung", "Avg power"), fmtWValue(this._num("avg_power_today")), fmtWUnit(this._num("avg_power_today")), sub(TT("während der Produktion", "while producing")))}
      ${kpi("production_time_today", "mdi:timer-sand", "#5b7290", TT("Laufzeit heute", "Runtime today"), hours !== null ? fmtHours(hours).replace(" h", "") : "–", "h", sub(`${TT("über", "above")} ${fmt(this._entry.threshold ?? 10, 0)} W`))}
      ${sixth}
      ${this._renderShareKpis(kpi, sub)}
    </div>`;
  }

  // Autarkie und Eigenverbrauch heute (nur mit Netz-Zähler, der Bezug und Einspeisung als Energie liefert)
  _renderShareKpis(kpi, sub) {
    if (!this._has("grid_import_today") || !this._has("grid_export_today") || !this._has("house_today")) return "";
    const house = this._num("house_today"), imp = this._num("grid_import_today");
    const pv = this._num("today"), exp = this._num("grid_export_today");
    const pct = (part, whole) => (whole > 0 && part !== null ? Math.min(100, Math.max(0, (1 - part / whole) * 100)) : null);
    const aut = pct(imp, house), own = pct(exp, pv);
    return kpi("grid_import_today", "mdi:shield-home-outline", COLORS.bat, TT("Autarkie heute", "Self-sufficiency today"), aut === null ? "–" : fmt(aut, 0), "%",
        sub(`${fmt(imp, 2)} kWh ${TT("aus dem Netz", "from the grid")}`))
      + kpi("grid_export_today", "mdi:solar-power-variant-outline", COLORS.pv, TT("Eigenverbrauch heute", "Self-consumption today"), own === null ? "–" : fmt(own, 0), "%",
        sub(`${fmt(exp, 2)} kWh ${TT("eingespeist", "exported")}`));
  }

  // Tageskurve mit Tooltip; defs: [{ key, color, label, fill?, peak?, signed? }]
  _renderCurve(chartId, title, icon, defs, opts = {}) {
    const dayStart = this._dayStart, today = this._isToday;
    const now = today ? Date.now() : dayStart + 24 * 3600 * 1000;
    const hidden = this._hiddenFor(chartId);
    const rows = [];
    for (const def of defs) {
      const id = this._id(def.key);
      const all = id ? (this._history[id] || []).slice() : [];
      if (today) { const live = this._num(def.key); if (live !== null) all.push([now, live]); }
      all.sort((a, b) => a[0] - b[0]);
      if (!all.length) continue;
      // Geglättet: 5-Minuten-Abschnitte mit Mittelwert, Minimum und Maximum
      const bins = binSeries(all, dayStart, now);
      if (bins.length) rows.push({ ...def, bins });
    }
    const base = this._curveBase(rows.filter((r) => !hidden.has(r.key)), dayStart);
    const [t0, t1] = this._zoom ?? base;
    // Sichtbar: Abschnitte im Ausschnitt plus je einer davor und danach, damit die Linie bis an den Rand reicht
    const withData = rows
      .map((r) => ({ ...r, vis: r.bins.filter((b) => b[0] + 2 * BIN_MS > t0 && b[0] - BIN_MS < t1) }))
      .filter((r) => r.vis.length);
    const series = withData.filter((s) => !hidden.has(s.key));
    // Gestapelt: jede Fläche liegt auf der Summe der vorherigen Reihen
    const stacked = opts.stacked && series.length > 0;
    if (stacked) {
      series.forEach((s, k) => {
        const below = series.slice(0, k);
        s.cumAt = (tt) => [...below, s].reduce((a, r) => a + Math.max(binAt(r.bins, tt)?.[1] ?? 0, 0), 0);
      });
    }
    // Zeitpunkt, an dem ein Abschnitt gezeichnet wird: seine Mitte (der laufende endet bei „jetzt“)
    const mid = (b) => b[0] + (Math.min(b[0] + BIN_MS, now) - b[0]) / 2;
    const stackTimes = stacked ? [...new Set(series.flatMap((s) => s.vis.map((b) => b[0])))].sort((a, b) => a - b) : [];

    const W = this._chartWidth(chartId === "strings" && this._cardHalf("strings", "scurve") ? 0.5 : 1), H = 220, L = 44, R = 8, T = 10, B = 24;
    const vals = stacked
      ? stackTimes.map((tt) => series[series.length - 1].cumAt(tt))
      : series.flatMap((s) => s.vis.flatMap((b) => [b[2], b[3]]));
    // Sonnenbogen: Strahlungsstärke (Sinus der Sonnenhöhe), so hochgerechnet, dass er durch den besten
    // PV-Wert des Tages geht und nie unter einem Messwert liegt; Werte unter 10° Sonnenhöhe zählen nicht
    const sun = this._sunTimes(dayStart);
    const lat = this._hass?.config?.latitude, lon = this._hass?.config?.longitude;
    const hasSun = !!sun && typeof lat === "number" && typeof lon === "number";
    const sinEl = (tt) => Math.max(0, Math.sin((sunElevation(tt, lat, lon) * Math.PI) / 180));
    let arcK = 0;
    const pvRows = hasSun ? rows.filter((r) => !hidden.has(r.key) && isPvKey(r.key)) : [];
    if (pvRows.length) {
      const minSin = Math.sin((10 * Math.PI) / 180);
      for (const tt of new Set(pvRows.flatMap((r) => r.bins.map((b) => b[0])))) {
        const s = sinEl(mid([tt]));
        if (s < minSin) continue;
        const v = pvRows.reduce((a, r) => a + Math.max(binAt(r.bins, tt)?.[1] ?? 0, 0), 0);
        arcK = Math.max(arcK, v / s);
      }
    }
    const arcA = hasSun ? Math.max(sun[0], t0) : 0, arcB = hasSun ? Math.min(sun[1], t1) : 0;
    const arcPts = [];
    if (hasSun && arcB > arcA) {
      const stepMs = Math.max(60000, (arcB - arcA) / 120);
      for (let tt = arcA; tt < arcB; tt += stepMs) arcPts.push([tt, sinEl(tt)]);
      arcPts.push([arcB, sinEl(arcB)]);
    }
    // Prognose: Wh je Stunde = mittlere Leistung in W, gezeichnet zur Stundenmitte; ersetzt den Sonnenbogen
    const fc = chartId === "main" && today && !hidden.has("power") && this._forecast?.length ? this._forecast : null;
    if (fc) arcPts.length = 0;
    const fcPts = fc ? [[fc[0][0], 0], ...fc.map(([h, wh]) => [h + 1800000, wh]), [fc[fc.length - 1][0] + 3600000, 0]] : [];
    const fcTop = Math.max(0, ...fcPts.filter((q) => q[0] >= t0 - 3600000 && q[0] <= t1 + 3600000).map((q) => q[1]));
    const arcTop = !fc && arcK > 0 ? arcK * Math.max(0, ...arcPts.map((q) => q[1])) : 0;
    // Achse richtet sich nach dem höchsten Wert im sichtbaren Ausschnitt (samt Sonnenbogen bzw. Prognose)
    const maxV = niceMax(Math.max(10, ...vals, arcTop, fcTop)); // mindestens 10 W, damit sich die Beschriftung nicht wiederholt
    const minV = Math.min(0, ...vals) < 0 ? -niceMax(-Math.min(...vals)) : 0;
    const x = (tt) => L + ((tt - t0) / (t1 - t0)) * (W - L - R);
    const tAt = (px) => t0 + ((px - L) / (W - L - R)) * (t1 - t0);
    const y = (v) => T + (1 - (v - minV) / (maxV - minV)) * (H - T - B);

    let grid = "";
    for (const v of ticks(minV, maxV)) {
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))" stroke-width="1"/>`;
      grid += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtWShort(v)}</text>`;
    }
    const maxLabels = W < 500 ? 5 : 9;
    const step = [15, 30, 60, 120, 180, 360].map((m) => m * 60000).find((s) => (t1 - t0) / s <= maxLabels) ?? 6 * 3600000;
    // Marken ab Mitternacht Ortszeit ausrichten (nicht ab UTC)
    for (let tt = dayStart + Math.ceil((t0 - dayStart) / step) * step; tt <= t1 + 1; tt += step) {
      const d = new Date(tt);
      const label = d.getHours() === 0 && d.getMinutes() === 0 && tt > dayStart ? "24:00" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      grid += `<text x="${x(tt)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
    }
    if (today && now >= t0 && now <= t1) grid += `<line x1="${x(now)}" x2="${x(now)}" y1="${T}" y2="${H - B}" stroke="var(--secondary-text-color)" stroke-dasharray="2 4" stroke-width="1"/>`;
    // Nacht abgedunkelt, Sonnenauf- und -untergang als Linie mit Uhrzeit
    let night = "";
    if (sun) {
      const shade = (a, b) => {
        const xa = x(Math.max(a, t0)), xb = x(Math.min(b, t1));
        return xb > xa ? `<rect x="${xa.toFixed(1)}" y="${T}" width="${(xb - xa).toFixed(1)}" height="${H - T - B}" fill="#000" fill-opacity="${this._hass?.themes?.darkMode ? 0.28 : 0.05}"/>` : "";
      };
      night = shade(t0, sun[0]) + shade(sun[1], t1);
      sun.forEach((ts, i) => {
        if (ts < t0 || ts > t1) return;
        const xs = x(ts), right = xs < W - R - 70;
        const time = new Date(ts).toLocaleTimeString(LOCALE(), { hour: "2-digit", minute: "2-digit" });
        grid += `<line x1="${xs.toFixed(1)}" x2="${xs.toFixed(1)}" y1="${T}" y2="${H - B}" stroke="${SUN_COLOR}" stroke-dasharray="4 4" stroke-width="1"/>`
          + `<g transform="translate(${(right ? xs + 12 : xs - 12).toFixed(1)},${T + 12})">${sunIcon(i === 0)}</g>`
          + `<text x="${(right ? xs + 22 : xs - 22).toFixed(1)}" y="${T + 16}" text-anchor="${right ? "start" : "end"}" class="sunt">${time}</text>`;
      });
    }
    // Sonnenbogen als sehr blasse Fläche ohne Randlinie
    let arc = "";
    if (arcPts.length) {
      let ye;
      if (arcK > 0) ye = (s) => y(arcK * s);
      else {
        // Ohne brauchbaren PV-Wert: höchster Sonnenstand des Tages auf Höhe des höchsten Werts (ohne Werte: volle Höhe)
        let dayMax = 0;
        for (let tt = sun[0]; tt <= sun[1]; tt += 5 * 60000) dayMax = Math.max(dayMax, sinEl(tt));
        const top = Math.max(...vals, 0) > 0 ? y(Math.max(...vals)) : T;
        ye = (s) => H - B - (s / Math.max(dayMax, 0.01)) * (H - B - top);
      }
      const line = arcPts.map((q) => `${x(q[0]).toFixed(1)},${ye(q[1]).toFixed(1)}`).join(" ");
      arc = `<polygon points="${x(arcA).toFixed(1)},${ye(0).toFixed(1)} ${line} ${x(arcB).toFixed(1)},${ye(0).toFixed(1)}" fill="${SUN_COLOR}" fill-opacity="0.05" stroke="none" pointer-events="none"/>`;
    }
    grid = night + arc + grid;

    let paths = "";
    const xy = (p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`;
    // Linie durch die Abschnittsmitten; der laufende Abschnitt wird bis „jetzt“ fortgeführt
    const line = (vis, val) => {
      const pts = vis.map((b) => [mid(b), val(b)]);
      const last = vis[vis.length - 1];
      if (today && last[0] + BIN_MS > now) pts.push([now, val(last)]);
      return pts;
    };
    if (stacked) {
      const bins = stackTimes.map((tt) => [tt]);
      series.forEach((s, k) => {
        const top = line(bins, (b) => s.cumAt(b[0]));
        const bot = k ? line(bins, (b) => series[k - 1].cumAt(b[0])) : top.map((p) => [p[0], 0]);
        paths += `<polygon points="${[...top, ...bot.reverse()].map(xy).join(" ")}" fill="${s.color}" fill-opacity="0.55" stroke="${s.color}" stroke-width="1" stroke-linejoin="round"/>`;
      });
    }
    for (const s of stacked ? [] : series) {
      const pts = line(s.vis, (b) => b[1]);
      // Blasses Band vom kleinsten bis zum größten Wert je Abschnitt
      const band = `<polygon points="${[...line(s.vis, (b) => b[3]), ...line(s.vis, (b) => b[2]).reverse()].map(xy).join(" ")}"/>`;
      const d = "M" + pts.map(xy).join(" L");
      const area = `<path d="${d} L${xy([pts[pts.length - 1][0], 0])} L${xy([pts[0][0], 0])} Z"/>`;
      // Mit Fläche: Band und Fläche als eine Form (keine Streifen durch Überlappung), Fläche unter dem Mittel kräftiger
      paths += s.fill
        ? `<g fill="${s.color}" opacity="0.16">${band}${area}</g><g fill="${s.color}" opacity="0.14">${area}</g>`
        : `<g fill="${s.color}" opacity="0.16">${band}</g>`;
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.fill ? 2 : 1.5}" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (s.peak) {
        // Spitze = höchster Einzelwert im Ausschnitt (wie die Kennzahl „Spitze heute“), Punkt an der Oberkante des Bandes
        const peak = s.vis.filter((b) => mid(b) >= t0 && mid(b) <= t1).reduce((m, b) => (b[3] > m[3] ? b : m), [0, 0, 0, -Infinity]);
        if (peak[3] > 0) paths += `<circle cx="${x(mid(peak))}" cy="${y(peak[3])}" r="4" fill="${s.color}" stroke="var(--card-background-color,#fff)" stroke-width="2"/><text x="${Math.min(x(mid(peak)) + 8, W - 60)}" y="${Math.max(y(peak[3]) - 6, 12)}" class="strong">${fmtW(peak[3])}</text>`;
      }
    }
    if (fcPts.length) paths += `<path d="${fcPts.map((q, i) => `${i ? "L" : "M"}${x(q[0]).toFixed(1)},${y(q[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--secondary-text-color)" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round" pointer-events="none"/>`;
    paths = `<clipPath id="clip-${chartId}"><rect x="${L}" y="0" width="${W - L - R}" height="${H}"/></clipPath><g clip-path="url(#clip-${chartId})">${paths}</g>`;
    this._curves[chartId] = { W, t0, t1, now, x, y, tAt, L, R, stacked, series, dayStart, mid, base };
    const sel = `<rect class="sel" x="0" y="${T}" width="0" height="${H - T - B}" fill="var(--primary-color, #03a9f4)" fill-opacity="0.15" style="display:none"/>`;
    const hover = `<g class="hover" style="display:none"><line class="hl" y1="${T}" y2="${H - B}" stroke="var(--primary-text-color)" stroke-opacity="0.4" stroke-width="1"/>${series.map((s) => `<circle r="4" fill="${s.color}" stroke="var(--card-background-color,#fff)" stroke-width="2"/>`).join("")}</g>`;
    // Legende: Klick blendet die Linie aus bzw. wieder ein
    const fcKwh = fc ? fc.reduce((a, q) => a + q[1], 0) / 1000 : null;
    const fcLegend = fc ? `<span class="lg fc" title="${TT("Ertragsprognose aus dem Energie-Dashboard", "Production forecast from the energy dashboard")}"><span style="width:12px;border-top:2px dashed var(--secondary-text-color)"></span>${TT("Prognose", "Forecast")} ${fmt(fcKwh, 1)} kWh</span>` : "";
    const legend = fcLegend + withData.map((s) => `<button class="lg ${hidden.has(s.key) ? "off" : ""}" data-chart="${chartId}" data-series="${escapeHtml(s.key)}" title="${hidden.has(s.key) ? TT("Einblenden", "Show") : TT("Ausblenden", "Hide")}"><span style="width:10px;height:10px;border-radius:2px;background:${s.color}"></span>${escapeHtml(s.label)}</button>`).join("");
    const dateText = new Date(dayStart).toLocaleDateString(LOCALE(), { day: "2-digit", month: "2-digit", year: "numeric" });
    const heading = (today ? `${title} ${TT("heute", "today")}` : `${title} ${TT("am", "on")} ${dateText}`)
      + `<span class="avg5" title="${TT("Jeder Punkt ist der Durchschnitt über 5 Minuten", "Each point is the average over 5 minutes")}">${TT("Ø je 5 Minuten", "5-min average")}</span>`;
    const modes = opts.modes ? `<span class="navbtns">
        <button class="navbtn ${stacked ? "" : "active"}" data-nav="smode-lines">${TT("Linien", "Lines")}</button>
        <button class="navbtn ${stacked ? "active" : ""}" data-nav="smode-stack">${TT("Gestapelt", "Stacked")}</button></span>` : "";
    const fullDay = base[1] - base[0] >= 24 * 3600 * 1000 - 1000;
    const forced = this._dayMode !== "full" && fullDay && rows.some((r) => !hidden.has(r.key) && !isPvKey(r.key));
    const dmode = `<span class="navbtns">
        <button class="navbtn ${fullDay ? "" : "active"}" data-nav="dmode-day" title="${forced ? TT("Mit eingeblendetem Haus, Akku oder Netz wird immer der ganze Tag gezeigt", "With house, battery or grid shown the whole day is always displayed") : TT("Nur der Zeitraum mit Sonne bzw. Leistung", "Only the period with sun or power")}">${TT("Tag", "Day")}</button>
        <button class="navbtn ${fullDay ? "active" : ""}" data-nav="dmode-full">${TT("Ganzer Tag", "Full day")}</button></span>`;
    const nav = `${dmode}<span class="navbtns">
        ${this._zoom ? `<button class="navbtn" data-nav="zoom-reset">${TT("Zoom zurücksetzen", "Reset zoom")}</button>` : ""}
        <button class="navbtn" data-nav="day-prev" title="${TT("Vortag", "Previous day")}">‹</button>
        <button class="navbtn ${today ? "active" : ""}" data-nav="day-today">${TT("Heute", "Today")}</button>
        <button class="navbtn" data-nav="day-next" title="${TT("Nächster Tag", "Next day")}" ${today ? "disabled" : ""}>›</button></span>`;
    const empty = this._loading.curve ? LOADING() : today ? TT("Noch keine Verlaufsdaten für heute.", "No history for today yet.") : TT("Keine Daten vorhanden.", "No data available.");
    const body = !series.length && withData.length ? `<div class="empty">${TT("Alle Linien ausgeblendet.", "All lines hidden.")}</div>` : series.length ? `<div class="curve-wrap" data-chart="${chartId}"><svg viewBox="0 0 ${W} ${H}">${grid}${paths}${sel}${chartId === "strings" ? `<line class="modt" y1="${T}" y2="${H - B}" stroke="${SUN_COLOR}" stroke-width="1.5" style="display:none" pointer-events="none"/>` : ""}${hover}</svg><div class="tip" style="display:none"></div></div>` : `<div class="empty">${empty}</div>`;
    return `<div class="card"><h3><ha-icon icon="${icon}"></ha-icon>${heading}<span class="hint">${legend}</span>${modes}${nav}</h3>${body}</div>`;
  }

  // Tooltip und Zoom: Bewegen zeigt alle Werte, Ziehen wählt einen Zeitraum zum Heranzoomen,
  // Strg + Mausrad und zwei Finger zoomen, Doppelklick bzw. doppeltes Tippen setzt zurück
  _bindCurve() {
    for (const wrap of this._content.querySelectorAll(".curve-wrap")) {
      const chartId = wrap.dataset.chart;
      const svg = wrap.querySelector("svg");
      const sel = () => svg.querySelector(".sel");
      const fx = (clientX) => {
        const c = this._curves[chartId];
        const rect = svg.getBoundingClientRect();
        return ((clientX - rect.left) / rect.width) * c.W;
      };
      const px = (ev) => { const c = this._curves[chartId]; return Math.min(Math.max(fx(ev.clientX), c.L), c.W - c.R); };
      // Aktueller Ausschnitt (kann dem gezeichneten Diagramm einen Frame voraus sein)
      const range = () => this._zoom ?? this._curves[chartId].base;
      const span = () => range()[1] - range()[0];
      const timeAt = (x) => { const c = this._curves[chartId]; return range()[0] + ((x - c.L) / (c.W - c.L - c.R)) * span(); };
      const resetZoom = () => { if (this._zoom) { this._hover = null; this._onNav("zoom-reset"); } };
      const pointers = new Map();
      let lastTap = 0;

      svg.addEventListener("pointerdown", (ev) => {
        pointers.set(ev.pointerId, ev.clientX);
        if (pointers.size === 2) {
          // Zweiter Finger: Auswahl abbrechen, Zwei-Finger-Zoom beginnt
          this._drag = null;
          sel().style.display = "none";
          const [a, b] = [...pointers.values()];
          this._pinch = { chartId, dist: Math.max(Math.abs(a - b), 20), span: span(), tMid: timeAt(fx((a + b) / 2)) };
          this._hover = null;
          this._showHover(chartId);
          return;
        }
        if (ev.button !== 0 || pointers.size > 2) return;
        this._drag = { chartId, x0: px(ev), x1: px(ev) };
        svg.setPointerCapture(ev.pointerId);
      });
      svg.addEventListener("pointermove", (ev) => {
        const c = this._curves[chartId];
        if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, ev.clientX);
        if (this._pinch?.chartId === chartId && pointers.size >= 2) {
          const [a, b] = [...pointers.values()];
          const p = this._pinch;
          const newSpan = p.span * p.dist / Math.max(Math.abs(a - b), 20);
          // Der Zeitpunkt zwischen den Fingern bleibt unter ihnen, Verschieben mit zwei Fingern inklusive
          const frac = (fx((a + b) / 2) - c.L) / (c.W - c.L - c.R);
          this._setZoom(p.tMid - frac * newSpan, p.tMid + (1 - frac) * newSpan);
          this._zoomFrame(chartId);
          return;
        }
        const p = px(ev);
        if (this._drag?.chartId === chartId) {
          this._drag.x1 = p;
          const a = Math.min(this._drag.x0, p), b = Math.max(this._drag.x0, p);
          sel().setAttribute("x", a); sel().setAttribute("width", b - a);
          sel().style.display = b - a > 4 ? "" : "none";
        }
        this._hover = { chartId, t: c.tAt(p) };
        this._showHover(chartId);
      });
      const end = (ev) => {
        pointers.delete(ev.pointerId);
        if (this._pinch) {
          if (pointers.size < 2) { this._pinch = null; this._queueRender(); }
          return;
        }
        const drag = this._drag;
        this._drag = null;
        sel().style.display = "none";
        if (ev.type !== "pointerup" || !drag) return;
        if (Math.abs(drag.x1 - drag.x0) < 8) {
          // Doppeltes Tippen am Handy setzt den Zoom zurück
          if (ev.pointerType === "touch") {
            if (ev.timeStamp - lastTap < 350) { lastTap = 0; resetZoom(); } else lastTap = ev.timeStamp;
          }
          return;
        }
        const c = this._curves[chartId];
        const a = c.tAt(Math.min(drag.x0, drag.x1)), b = c.tAt(Math.max(drag.x0, drag.x1));
        const m = (a + b) / 2;
        if (b - a < ZOOM_MIN_MS) this._setZoom(m - ZOOM_MIN_MS / 2, m + ZOOM_MIN_MS / 2); else this._setZoom(a, b);
        this._hidden = {};
        this._hover = null;
        this._render();
      };
      svg.addEventListener("pointerup", end);
      svg.addEventListener("pointercancel", end);
      svg.addEventListener("dblclick", resetZoom);
      svg.addEventListener("pointerleave", () => { if (!this._drag) { this._hover = null; this._showHover(chartId); } });
      svg.addEventListener("wheel", (ev) => {
        const horizontal = Math.abs(ev.deltaX) > Math.abs(ev.deltaY);
        if (!ev.ctrlKey && !ev.metaKey) {
          // Gezoomt: Shift + Rad oder seitliches Wischen verschiebt den Ausschnitt
          if (this._zoom && (ev.shiftKey || horizontal)) {
            ev.preventDefault();
            const rect = svg.getBoundingClientRect();
            const dx = horizontal ? ev.deltaX : ev.deltaY;
            const shift = (dx / rect.width) * span();
            this._setZoom(range()[0] + shift, range()[1] + shift);
            this._zoomFrame(chartId);
          } else if (!horizontal) {
            this._zoomHint(wrap);
          }
          return;
        }
        // Strg + Rad (auch Zwei-Finger-Geste am Touchpad): um die Stelle unter dem Zeiger zoomen
        ev.preventDefault();
        const t = timeAt(px(ev));
        const factor = Math.exp(Math.max(-1, Math.min(1, ev.deltaY * (ev.deltaMode ? 0.05 : 0.002))));
        const newSpan = span() * factor;
        const frac = (t - range()[0]) / span();
        this._setZoom(t - frac * newSpan, t + (1 - frac) * newSpan);
        this._hover = { chartId, t };
        this._zoomFrame(chartId);
      }, { passive: false });
      if (this._hover?.chartId === chartId) this._showHover(chartId);
    }
  }

  // Hinweis „Strg + Mausrad zum Zoomen“, wenn ohne Strg über dem Diagramm gescrollt wird
  _zoomHint(wrap) {
    let hint = wrap.querySelector(".zhint");
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "zhint";
      hint.textContent = TT("Strg + Mausrad zum Zoomen", "Use Ctrl + scroll to zoom");
      wrap.appendChild(hint);
    }
    hint.classList.add("show");
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => hint.classList.remove("show"), 1200);
  }

  _showHover(chartId) {
    const wrap = this._content?.querySelector(`.curve-wrap[data-chart="${chartId}"]`);
    const c = this._curves[chartId];
    if (!wrap || !c) return;
    const g = wrap.querySelector(".hover");
    const tip = wrap.querySelector(".tip");
    if (this._hover?.chartId !== chartId) { g.style.display = "none"; tip.style.display = "none"; return; }
    // Auf den 5-Minuten-Abschnitt unter dem Zeiger einrasten
    const tc = Math.min(Math.max(this._hover.t, c.t0), Math.min(c.t1, c.now) - 1);
    const t = c.dayStart + Math.floor((tc - c.dayStart) / BIN_MS) * BIN_MS;
    const xv = Math.min(Math.max(c.x(c.mid([t])), c.L), c.W - c.R);
    g.style.display = "";
    const line = g.querySelector(".hl");
    line.setAttribute("x1", xv); line.setAttribute("x2", xv);
    const dots = g.querySelectorAll("circle");
    const signedW = (s, v) => {
      const text = fmtW(Math.abs(v));
      return s.signed ? (v > 1 ? `+${text} ${s.signed[0]}` : v < -1 ? `−${text} ${s.signed[1]}` : text) : text;
    };
    const rows = c.series.map((s, i) => {
      const b = binAt(s.bins, t);
      const dot = dots[i];
      if (!b || b[0] !== t) { dot.style.display = "none"; return ""; }
      dot.style.display = "";
      dot.setAttribute("cx", xv); dot.setAttribute("cy", c.y(c.stacked ? s.cumAt(t) : b[1]));
      const range = Math.round(b[3] - b[2]) >= 1 ? `<span class="rng">${fmtWValue(b[2])} … ${fmtW(b[3])}</span>` : "";
      return `<div class="r"><span class="dot" style="width:8px;height:8px;background:${s.color}"></span>${escapeHtml(s.label)}<b>${signedW(s, b[1])}</b></div>${range}`;
    }).join("");
    const hm = (ms) => new Date(ms).toLocaleTimeString(LOCALE(), { hour: "2-digit", minute: "2-digit" });
    const sum = c.series.reduce((a, s) => { const b = binAt(s.bins, t); return a + (b && b[0] === t ? Math.max(b[1], 0) : 0); }, 0);
    const total = c.stacked ? `<div class="r" style="border-top:1px solid var(--divider-color, rgba(0,0,0,.12));margin-top:2px;padding-top:2px">${TT("Summe", "Total")}<b>${fmtW(sum)}</b></div>` : "";
    tip.innerHTML = `<div class="time">${hm(t)}–${hm(Math.min(t + BIN_MS, c.now))}${TT(" Uhr", "")} <span class="rng" style="display:inline">${TT("Ø 5 min", "5 min avg")}</span></div>${rows}${total}`;
    tip.style.display = "";
    const rect = wrap.getBoundingClientRect();
    const left = (xv / c.W) * rect.width;
    const flip = left > rect.width - tip.offsetWidth - 24;
    tip.style.left = `${flip ? left - tip.offsetWidth - 12 : left + 12}px`;
  }

  _renderDays() {
    const month = this._prodMode === "month" && this._prodMonth;
    const W = this._chartWidth(0.58), H = 190, L = 36, R = 6, T = 14, B = 22;
    const now = new Date();
    const todayKey = now.toDateString();
    let days, slots, title, avg;
    if (month) {
      const m = this._prodMonth;
      slots = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const isCur = m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth();
      const monthDays = isCur ? withToday(this._monthDays, this._num("today")) : this._monthDays;
      const byDay = Object.fromEntries(monthDays.map((d) => [d.start.getDate(), d]));
      days = Array.from({ length: slots }, (_, i) => byDay[i + 1] || null);
      title = `${TT("Produktion im", "Production in")} ${m.toLocaleDateString(LOCALE(), { month: "long", year: "numeric" })}`;
      // Ø des Monats über abgeschlossene Tage mit Werten
      const done = this._monthDays.filter((d) => d.start.toDateString() !== todayKey && d.v > 0);
      avg = done.length ? done.reduce((a, d) => a + d.v, 0) / done.length : null;
    } else {
      days = withToday(this._days, this._num("today")).slice(-30);
      slots = 30;
      title = TT("Produktion der letzten 30 Tage", "Production, last 30 days");
      avg = this._num("avg_daily_30");
    }
    const isCurMonth = month && month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
    const toggle = `<span class="navbtns">
        <button class="navbtn ${month ? "" : "active"}" data-nav="prod-30">${TT("30 Tage", "30 days")}</button>
        <button class="navbtn ${month ? "active" : ""}" data-nav="prod-month">${TT("Monat", "Month")}</button>
        ${month ? `<button class="navbtn" data-nav="month-prev" title="${TT("Vormonat", "Previous month")}">‹</button><button class="navbtn" data-nav="month-next" title="${TT("Nächster Monat", "Next month")}" ${isCurMonth ? "disabled" : ""}>›</button>` : ""}</span>`;
    const head = (hint) => `<h3><ha-icon icon="mdi:chart-bar"></ha-icon>${title}<span class="hint">${hint}</span>${toggle}</h3>`;
    const present = days.filter(Boolean);
    if (!present.length && (month ? this._loading.month : this._loading.days)) return `<div class="card">${head("")}<div class="empty">${LOADING()}</div></div>`;
    if (!present.length) return `<div class="card">${head("")}<div class="empty">${month ? TT("Keine Daten vorhanden.", "No data available.") : TT("Statistiken werden gesammelt. Nach dem ersten vollen Tag erscheinen hier Balken.", "Statistics are being collected. Bars appear after the first full day.")}</div></div>`;
    const maxV = niceMax(Math.max(1, ...present.map((d) => d.v), avg || 0));
    const bw = (W - L - R) / slots;
    const y = (v) => T + (1 - v / maxV) * (H - T - B);
    const bestV = Math.max(...present.map((d) => d.v));
    let svg = "";
    for (const v of ticks(0, maxV)) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtAxis(v)}</text>`;
    const offset = month ? 0 : slots - days.length;
    const every = W < 450 ? 10 : 5;
    days.forEach((d, i) => {
      const xi = L + (offset + i) * bw;
      if (d) {
        const isToday = d.start.toDateString() === todayKey;
        svg += barRect(xi + 1.5, bw - 3, d.v, maxV, H - B, H - T - B, isToday ? COLORS.pv : d.v === bestV ? "#ef9f27" : "#97c459",
          `${d.start.toLocaleDateString(this._locale)}: ${fmt(d.v, 2)} kWh`, 2);
      }
      const date = d ? d.start : new Date(this._prodMonth.getFullYear(), this._prodMonth.getMonth(), i + 1);
      if (i % every === 0 || i === days.length - 1) svg += `<text x="${(xi + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${fmtDayMonth(date)}</text>`;
    });
    if (avg) svg += `<line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="#3b6d11" stroke-dasharray="5 4" stroke-width="1.5"/>`;
    return `<div class="card">${head(avg ? `${TT("gestrichelt = Ø", "dashed = avg")} ${fmt(avg, 1)} kWh` : "")}<svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
  }

  _renderPeriods() {
    const avg30 = this._num("avg_daily_30") || null;
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    // Balken = Anteil an dem, was bei Ø 30 Tage für den ganzen Zeitraum zu erwarten wäre
    // Ersparnis neben den kWh, wenn die Sensoren dazu existieren (Netz-Zähler und Strompreis eingetragen)
    const eur = (key) => {
      const v = this._num(key);
      if (v === null) return "";
      const est = key === "savings_total" && this._state(key)?.attributes?.includes_initial_total;
      return `<span class="eurv"${est ? ` title="${TT("geschätzt, inklusive Startwert vor der Einrichtung", "estimated, including the production before the setup")}"` : ""}>${est ? "≈ " : ""}${this._money(v)}</span>`;
    };
    const row = (key, label, expectedDays, color) => {
      const v = this._num(key);
      const expected = avg30 && expectedDays ? avg30 * expectedDays : null;
      const pct = expected ? Math.min(100, (v / expected) * 100) : 0;
      return `<div class="item" data-key="${key}"><div class="line"><span>${label}</span><span><b>${fmt(v, v !== null && v >= 100 ? 0 : 1)} kWh</b>${eur(`savings_${key}`)}</span></div>${expected ? `<div class="bar"><div style="width:${pct.toFixed(0)}%;background:${color}"></div></div>` : ""}</div>`;
    };
    return `<div class="card"><h3><ha-icon icon="mdi:calendar-range"></ha-icon>${TT("Zeiträume", "Periods")}<span class="hint">${TT("Balken = Anteil an der Hochrechnung aus Ø 30 Tage", "Bar = share of the projection from the 30-day avg")}</span></h3>
      <div class="list">
        ${row("week", TT("Diese Woche", "This week"), 7, "#97c459")}
        ${row("month", TT("Dieser Monat", "This month"), dim, "#639922")}
        ${row("year", TT("Dieses Jahr", "This year"), 365, "#3b6d11")}
        <div class="item line sep" data-key="last_month"><span class="muted">${TT("Letzter Monat", "Last month")}</span><b>${fmt(this._num("last_month"), 1)} kWh</b></div>
        <div class="item line total" data-key="total"><span class="muted">${TT("Gesamt", "Total")}</span><span><b>${fmt(this._num("total"), 0)} kWh</b>${eur("savings_total")}</span></div>
        ${this._renderPayback()}
      </div></div>`;
  }

  // Amortisation: Anteil der Anschaffungskosten, den die Ersparnis schon gedeckt hat, und das voraussichtliche Jahr
  _renderPayback() {
    const invest = Number(this._entry.investment) || 0;
    const total = this._num("savings_total");
    if (!invest || total === null) return "";
    const pct = Math.max(0, (total / invest) * 100);
    let eta = "";
    // Abbezahlt: statt der Prozentzahl den Gewinn (Ersparnis über die Anschaffungskosten hinaus) zeigen
    if (pct >= 100) eta = `${TT("abbezahlt", "paid off")} · +${this._money(total - invest)} ${TT("Gewinn", "profit")}`;
    else {
      // Jahresersparnis = Ø-Ertrag je Tag (365 Tage) × 365 × Wert je kWh; erst ab 30 Tagen Daten
      const since = this._state("savings_total")?.attributes?.since;
      const days = since ? (Date.now() - new Date(since).getTime()) / 864e5 : 0;
      const kwh = this._num("total"), avg = this._num("avg_daily_365");
      const perYear = kwh > 0 && avg > 0 ? avg * 365 * (total / kwh) : 0;
      if (days >= 30 && perYear > 0) {
        const left = ((invest - total) / perYear) * 365 * 864e5;
        eta = `${TT("voraussichtlich", "expected")} ${new Date(Date.now() + left).getFullYear()}`;
      }
    }
    return `<div class="item" data-key="savings_total"><div class="line" style="font-size:12px"><span class="muted">${TT("Amortisation von", "Payback of")} ${this._money(invest, 0)}</span><span class="muted">${pct >= 100 ? eta : `${fmt(pct, 0)} %${eta ? ` · ${eta}` : ""}`}</span></div>
      <div class="bar"><div style="width:${Math.min(100, pct).toFixed(1)}%;background:${COLORS.pv}"></div></div></div>`;
  }

  // Geldbetrag in der Währung von Home Assistant
  _money(v, digits = 2) {
    try {
      return new Intl.NumberFormat(LOCALE(), { style: "currency", currency: this._entry?.currency || "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    } catch (err) {
      return `${fmt(v, digits)} ${escapeHtml(this._entry?.currency || "")}`;
    }
  }

  _renderBattery() {
    const batteries = this._entry.batteries || [];
    const fmtState = (st) => st ? `${fmt(parseFloat(st.state), 1)} ${escapeHtml(st.attributes.unit_of_measurement || "")}` : null;
    const block = (b) => {
      const k = (key) => `${b.id}|${key}`;
      const soc = this._num(k("battery_soc"));
      const bat = this._num(k("battery_power"));
      const temp = this._state(k("battery_temperature"));
      const volt = this._state(k("battery_voltage"));
      const r = 40, c = 2 * Math.PI * r;
      const color = soc === null ? COLORS.bat : socColor(soc);
      const ring = soc === null ? `<ha-icon icon="mdi:home-battery-outline" style="--mdc-icon-size:40px;color:${COLORS.bat}"></ha-icon>` : `<svg viewBox="0 0 100 100" style="width:84px;flex:none" class="click" data-key="${k("battery_soc")}">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--secondary-background-color, rgba(0,0,0,.06))" stroke-width="10"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${((soc / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
          <text x="50" y="57" text-anchor="middle" class="strong" style="font-size:20px">${fmt(soc, 0)} %</text></svg>`;
      const status = bat === null ? "" : bat > 1 ? TT("lädt", "charging") : bat < -1 ? TT("entlädt", "discharging") : TT("ruht", "idle");
      const lines = [
        bat !== null ? `<span class="click" data-key="${k("battery_power")}"><ha-icon icon="mdi:flash" style="--mdc-icon-size:15px"></ha-icon> ${bat > 0 ? "+" : bat < 0 ? "−" : ""}${fmtW(Math.abs(bat))} ${status}</span>` : "",
        temp || volt ? `<span class="muted">${temp ? `<span class="click" data-key="${k("battery_temperature")}"><ha-icon icon="mdi:thermometer" style="--mdc-icon-size:15px"></ha-icon> ${fmtState(temp)}</span>` : ""}${temp && volt ? " · " : ""}${volt ? `<span class="click" data-key="${k("battery_voltage")}"><ha-icon icon="mdi:sine-wave" style="--mdc-icon-size:15px"></ha-icon> ${fmtState(volt)}</span>` : ""}</span>` : "",
        this._has(k("battery_charged_today")) ? `<span class="muted">${TT("heute", "today")} ↑ ${fmt(this._num(k("battery_charged_today")), 2)} kWh · ↓ ${fmt(this._num(k("battery_discharged_today")), 2)} kWh</span>` : "",
      ].join("");
      const capacity = b.capacity ? `<span class="muted">${fmt(b.capacity, 1)} kWh ${TT("Kapazität", "capacity")}</span>` : "";
      return `<div class="batblock">${ring}<div class="info"><b>${escapeHtml(b.title)}</b>${lines}${capacity}</div></div>`;
    };
    const mini = (key, label) => this._has(key) ? `<div class="card tile"><div class="lbl">${label}</div><div class="val">${fmt(this._num(key), 2)}<small>kWh</small></div></div>` : "";
    const totals = `${mini("battery_charged_today", batteries.length > 1 ? TT("Geladen heute (alle)", "Charged today (all)") : TT("Geladen heute", "Charged today"))}${mini("battery_discharged_today", batteries.length > 1 ? TT("Entladen heute (alle)", "Discharged today (all)") : TT("Entladen heute", "Discharged today"))}`;
    const soc = this._num("battery_soc");
    const hint = batteries.length > 1 && soc !== null ? `<span class="hint">${TT("Gemeinsam", "Combined")} ${fmt(soc, 0)} %</span>` : "";
    return `<div class="card"><h3><ha-icon icon="mdi:home-battery"></ha-icon>${batteries.length > 1 ? TT("Akkus", "Batteries") : TT("Akku", "Battery")}${hint}</h3>
      <div class="batgrid">${batteries.map(block).join("")}</div>
      ${totals ? `<div class="mini" style="margin-top:12px">${totals}</div>` : ""}</div>`;
  }

  // Jahres-Heatmap: ein Kästchen je Tag (Spalten = Wochen ab Montag), Farbe nach Ertrag relativ zum besten Tag
  _yearList(year) {
    const raw = this._yearDays[`${this._id("total")}|${year}`];
    return { raw, list: year === new Date().getFullYear() ? withToday(raw || [], this._num("today")) : raw || [] };
  }

  _renderYear() {
    const cur = new Date().getFullYear();
    const year = this._year ?? cur;
    const { raw, list } = this._yearList(year);
    const byDay = new Map(list.map((d) => [d.start.toDateString(), d.v]));
    const present = list.filter((d) => d.v !== null && d.v !== undefined);
    const nav = `<span class="navbtns">
        <button class="navbtn" data-nav="year-prev" title="${TT("Vorjahr", "Previous year")}" ${raw && !raw.length && year < cur ? "disabled" : ""}>‹</button>
        <button class="navbtn active" disabled>${year}</button>
        <button class="navbtn" data-nav="year-next" title="${TT("Nächstes Jahr", "Next year")}" ${year >= cur ? "disabled" : ""}>›</button></span>`;
    const head = `<h3><ha-icon icon="mdi:calendar-blank-multiple"></ha-icon>${TT("Produktion im Jahr", "Production by year")}<span class="hint">${TT("je Tag", "per day")}</span>${nav}</h3>`;
    if (!present.length) return `<div class="card yearcard">${head}<div class="empty">${this._loading.year || !raw ? LOADING() : TT("Keine Daten vorhanden.", "No data available.")}</div></div>`;
    const first = new Date(year, 0, 1);
    const n = Math.round((new Date(year + 1, 0, 1) - first) / 864e5);
    const off = (first.getDay() + 6) % 7;
    const avail = this._chartWidth(1);
    // Breit: Wochenraster (Spalten = Wochen, Zeilen = Mo bis So); schmal (Handy): Monatsraster (Zeilen = Monate, Spalten = Tag 1 bis 31)
    const weeks = (avail - 30) / Math.ceil((off + n) / 7) - 2 >= 8;
    const cols = weeks ? Math.ceil((off + n) / 7) : 31;
    const L = weeks ? 28 : 30, T = weeks ? 16 : 14, R = 2, g = weeks ? 2 : 1.5;
    const cs = Math.max(4, Math.min(20, (avail - L - R) / cols - g));
    const ch = weeks ? cs : Math.max(cs, 12); // im Monatsraster etwas höhere Zeilen, damit die Monatsnamen passen
    const W = L + cols * (cs + g) + R, H = T + (weeks ? 7 : 12) * (ch + g);
    const best = Math.max(0, ...present.map((d) => d.v));
    // Im dunklen Design wird die Skala umgedreht, damit viel Ertrag auch dort hell und auffällig ist
    const steps = this._hass?.themes?.darkMode ? ["#27500a", "#3b6d11", "#639922", "#97c459", "#c0dd97"] : ["#c0dd97", "#97c459", "#639922", "#3b6d11", "#27500a"];
    const color = (v) => v === undefined ? "var(--divider-color, rgba(0,0,0,.12))" : v < 0 ? "#e24b4a" : v === 0 || best <= 0 ? "var(--secondary-background-color, rgba(0,0,0,.06))" : steps[Math.min(4, Math.floor((v / best) * 5))];
    let svg = "";
    if (weeks) TT(["Mo", "Mi", "Fr"], ["Mon", "Wed", "Fri"]).forEach((w, i) => { svg += `<text x="0" y="${(T + i * 2 * (cs + g) + cs - 1).toFixed(1)}">${w}</text>`; });
    else [1, 10, 20, 31].forEach((dd) => { svg += `<text x="${(L + (dd - 1) * (cs + g) + cs / 2).toFixed(1)}" y="10" text-anchor="middle">${dd}</text>`; });
    let bestDone = false;
    for (let i = 0; i < n; i++) {
      const d = new Date(year, 0, 1 + i);
      const k = off + i;
      const xp = weeks ? L + Math.floor(k / 7) * (cs + g) : L + (d.getDate() - 1) * (cs + g);
      const yp = weeks ? T + (k % 7) * (cs + g) : T + d.getMonth() * (ch + g);
      const mon = d.toLocaleDateString(LOCALE(), { month: "short" }).replace(".", "");
      if (d.getDate() === 1) svg += weeks ? `<text x="${xp.toFixed(1)}" y="11">${mon}</text>` : `<text x="0" y="${(yp + ch - 2).toFixed(1)}">${mon}</text>`;
      const v = byDay.get(d.toDateString());
      const isBest = !bestDone && v !== undefined && v === best && best > 0;
      if (isBest) bestDone = true;
      svg += `<rect data-hm="${d.getTime()}" x="${xp.toFixed(1)}" y="${yp.toFixed(1)}" width="${cs.toFixed(1)}" height="${ch.toFixed(1)}" rx="2" fill="${color(v)}"${isBest ? ` stroke="#ef9f27" stroke-width="1.6" data-best="1"` : ""}/>`;
    }
    const sum = year === cur && this._num("year") !== null ? this._num("year") : present.reduce((a, d) => a + d.v, 0);
    // Ø nur über abgeschlossene Tage mit Produktion; Tage mit 0 kWh (z. B. vor der Inbetriebnahme) und der laufende Tag zählen nicht
    const todayKey = new Date().toDateString();
    const done = present.filter((d) => d.v > 0 && d.start.toDateString() !== todayKey);
    const avg = done.length ? done.reduce((a, d) => a + d.v, 0) / done.length : null;
    const legend = `<span class="hmleg">${TT("weniger", "less")} ${steps.map((c) => `<i style="background:${c}"></i>`).join("")} ${TT("mehr", "more")}</span>
      <span class="hmleg"><i style="outline:1.5px solid #ef9f27;outline-offset:-1.5px"></i> ${TT("bester Tag", "best day")}</span>
      <span class="hmsum">${fmt(sum, 0)} kWh${avg !== null ? ` · Ø ${fmt(avg, 1)} kWh/${TT("Tag", "day")}` : ""}</span>`;
    return `<div class="card yearcard">${head}<div class="hm-wrap"><svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" style="max-width:${Math.round(W)}px">${svg}</svg><div class="tip" style="display:none"></div></div><div class="hmfoot">${legend}</div></div>`;
  }

  _bindYear() {
    const wrap = this._content.querySelector(".hm-wrap");
    if (!wrap) return;
    const tip = wrap.querySelector(".tip");
    const { list } = this._yearList(this._year ?? new Date().getFullYear());
    const byDay = new Map(list.map((d) => [d.start.toDateString(), d.v]));
    const show = (ev) => {
      const r = ev.target.closest("rect[data-hm]");
      if (!r) { tip.style.display = "none"; return; }
      const d = new Date(Number(r.dataset.hm)), v = byDay.get(d.toDateString());
      tip.innerHTML = `<div class="time">${d.toLocaleDateString(LOCALE(), { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</div>`
        + `<div class="r">${TT("Produktion", "Production")}<b>${v === undefined ? "–" : `${fmt(v, 2)} kWh`}</b></div>`
        + (r.dataset.best ? `<div class="r" style="color:#ef9f27">${TT("bester Tag", "best day")}</div>` : "");
      tip.style.display = "block";
      const wr = wrap.getBoundingClientRect(), rr = r.getBoundingClientRect();
      const left = Math.max(0, Math.min(rr.left - wr.left + rr.width / 2 - tip.offsetWidth / 2, wr.width - tip.offsetWidth));
      const top = rr.top - wr.top - tip.offsetHeight - 6;
      tip.style.left = `${left}px`;
      tip.style.top = `${top < 0 ? rr.bottom - wr.top + 6 : top}px`;
    };
    wrap.addEventListener("mousemove", show);
    wrap.addEventListener("click", show);
    wrap.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  }

  // ---------------------------------------------------------------- Modulansicht (Tab Strings)

  _modLayout() { return this._modDraft || this._entry.layout || { mode: "max", tiles: {} }; }

  // Eine Kachel je Modul: ein String mit n Modulen ergibt n Kacheln mit je 1/n der Leistung
  _modTiles() {
    const tiles = [];
    (this._entry.strings || []).forEach((s) => {
      const n = Math.max(1, Number(s.modules) || 1);
      for (let k = 0; k < n; k++) tiles.push({ key: `${s.id}#${k}`, s, n, name: n > 1 ? `${s.title} ${k + 1}` : s.title });
    });
    return tiles;
  }

  // Kachelgröße in Breiten der Fläche (Hochformat 4:5), bei vielen Modulen kleiner
  _modSize(count) {
    const w = count <= 10 ? 0.1 : Math.max(0.05, 0.1 * Math.sqrt(10 / count));
    return { w, h: w * 1.25 };
  }

  // Höhe der Fläche in Breiten: bis zur untersten Kachel plus Rand, mindestens eine Reihe; beim Anordnen eine Reihe mehr
  _modHeight(pos, size) {
    const bottom = Math.max(0, ...pos.map((p) => p.y + (p.rot ? size.w : size.h)));
    return Math.max(size.h + 0.06, bottom + 0.03) + (this._modEdit ? size.h + 0.03 : 0);
  }

  // Gespeicherte Position oder eine freie Reihe von links oben
  _modPositions(tiles) {
    const lay = this._modLayout(), { w, h } = this._modSize(tiles.length);
    const perRow = Math.max(1, Math.floor(0.92 / (w + 0.015)));
    let free = 0;
    return tiles.map((t) => {
      const saved = lay.tiles?.[t.key];
      if (saved) return { ...saved };
      const i = free++;
      return { x: 0.04 + (i % perRow) * (w + 0.015), y: 0.03 + Math.floor(i / perRow) * (h + 0.03), rot: false };
    });
  }

  // Zeitraum des Schiebers: Sonnenauf- bis -untergang des angezeigten Tages (heute höchstens bis jetzt)
  _modRange() {
    const dayStart = this._dayStart, sun = this._sunTimes(dayStart);
    const step = 5 * 60000;
    let a = sun ? Math.floor(sun[0] / step) * step : dayStart + 5 * 3600000;
    let b = sun ? Math.ceil(sun[1] / step) * step : dayStart + 21 * 3600000;
    if (this._isToday) b = Math.min(b, Math.floor(Date.now() / step) * step);
    if (b < a) b = a;
    return [a, b];
  }

  // 5-Minuten-Werte je String für den angezeigten Tag (aus dem schon geladenen Verlauf)
  _modBins() {
    const dayStart = this._dayStart;
    if (this._modCache?.h === this._history && this._modCache.day === dayStart) return this._modCache.bins;
    const end = this._isToday ? Date.now() : dayStart + 864e5;
    const bins = {};
    for (const st of this._entry.strings || []) {
      const id = this._id(`${st.id}|string_power`);
      const pts = id ? (this._history[id] || []).slice().sort((a, b) => a[0] - b[0]) : [];
      bins[st.id] = pts.length ? binSeries(pts, dayStart, end) : [];
    }
    this._modCache = { h: this._history, day: dayStart, bins };
    return bins;
  }

  // Leistung je String zum gewählten Zeitpunkt (live: aktuelle Sensoren) und Tageshöchstwert je String
  _modValues() {
    const bins = this._modBins(), t = this._modT, live = t === null && this._isToday;
    const pow = {}, peak = {};
    for (const st of this._entry.strings || []) {
      const b = bins[st.id] || [];
      peak[st.id] = Math.max(0, ...b.map((x) => x[1] ?? 0));
      pow[st.id] = Math.max(0, (live ? this._num(`${st.id}|string_power`) : binAt(b, t ?? 0)?.[1]) ?? 0);
    }
    return { pow, peak, live };
  }

  _renderModules() {
    if (!this._entry.strings?.length) return "";
    const tiles = this._modTiles(), lay = this._modLayout(), edit = this._modEdit;
    const pos = this._modPositions(tiles), size = this._modSize(tiles.length), { w, h } = size;
    const H = this._modHeight(pos, size);
    const [a, b] = this._modRange();
    // Vergangener Tag ohne gewählte Uhrzeit: Zeitpunkt mit der höchsten Gesamtleistung
    if (!this._isToday && this._modT === null) {
      const bins = this._modBins();
      let best = a, bestV = -1;
      for (let tt = a; tt <= b; tt += 5 * 60000) {
        const v = Object.values(bins).reduce((s2, bb) => s2 + (binAt(bb, tt)?.[1] ?? 0), 0);
        if (v > bestV) { bestV = v; best = tt; }
      }
      // Erst setzen, wenn der Verlauf des Tages geladen ist
      if (bestV > 0) this._modT = best;
    }
    const admin = !!this._hass?.user?.is_admin;
    const btns = edit
      ? `<span class="navbtns">
          <button class="navbtn ${lay.mode !== "own" ? "active" : ""}" data-nav="mod-mode-max" title="${TT("Hellstes Modul = 100 %", "Brightest module = 100 %")}">${TT("rel. zum stärksten", "rel. to strongest")}</button>
          <button class="navbtn ${lay.mode === "own" ? "active" : ""}" data-nav="mod-mode-own" title="${TT("Jeder String zu seinem Tageshöchstwert", "Each string to its peak of the day")}">${TT("je String eigenes Max.", "own peak per string")}</button>
          <button class="navbtn ${lay.mode === "day" ? "active" : ""}" data-nav="mod-mode-day" title="${TT("Höchster Wert eines Moduls am ganzen Tag = 100 %", "Highest module value of the whole day = 100 %")}">${TT("zum Tagesmaximum", "to the day's peak")}</button>
          <button class="navbtn" data-nav="mod-cancel">${TT("Abbrechen", "Cancel")}</button>
          <button class="navbtn active" data-nav="mod-done">${TT("Fertig", "Done")}</button></span>`
      : `<span class="navbtns">${this._isToday ? `<button class="navbtn modlive" data-nav="mod-live"${this._modT === null ? ' style="display:none"' : ""}>${TT("Jetzt", "Now")}</button>` : ""}${admin ? `<button class="navbtn" data-nav="mod-edit">${TT("Anordnen", "Arrange")}</button>` : ""}</span>`;
    const roof = tiles.map((t, i) => {
      const p = pos[i], tw = p.rot ? h : w, th = p.rot ? w : h;
      const geo = `data-x="${p.x}" data-y="${p.y}" data-w="${tw}" data-h="${th}"`;
      const style = edit ? ` style="left:${(p.x * 100).toFixed(2)}%;top:${((p.y / H) * 100).toFixed(2)}%;width:${(tw * 100).toFixed(2)}%;height:${((th / H) * 100).toFixed(2)}%"` : "";
      return `<div class="modtile${t.s.color === "black" ? " black" : ""}" data-mod="${t.key}" data-key="${t.s.id}|string_power" ${geo}${style}>`
        + `${edit ? `<span class="mrot" data-modrot="${t.key}" title="${TT("Drehen", "Rotate")}">↻</span>` : ""}<span class="mn">${escapeHtml(t.name)}</span><span class="mv"></span></div>`;
    }).join("");
    const playing = !!this._modTimer;
    const time = (ms) => fmtTime(ms);
    return `<div class="card modcard"><h3><ha-icon icon="mdi:solar-panel"></ha-icon>${TT("Module", "Modules")}<span class="hint modmode"></span>${btns}</h3>
      <div class="modroof-wrap${edit ? " edit" : ""}"><div class="modroof${edit ? " edit" : " fit"}" data-h="${H.toFixed(4)}"${edit ? ` style="aspect-ratio:1 / ${H.toFixed(4)};background-size:5% ${(5 / H).toFixed(3)}%"` : ""}>${roof}</div></div>
      <div class="modbar"><button class="navbtn" data-nav="mod-play" title="${TT("Tag abspielen", "Play the day")}">${playing ? "❚❚" : "▶"}</button><button class="navbtn modspeed" data-nav="mod-speed" title="${TT("Tempo beim Abspielen", "Playback speed")}">${fmt(this._modSpeed, this._modSpeed < 1 ? 1 : 0)}×</button>
        <span class="muted">${time(a)}</span><input type="range" class="modsl" min="${a}" max="${b}" step="${5 * 60000}" value="${this._modT ?? b}"><span class="muted">${time(b)}</span><b class="modtm"></b></div>
      <div class="muted modsum" style="font-size:12px"></div></div>`;
  }

  // Helligkeit, Werte, Uhrzeit und Markierung in der Kurve aktualisieren, ohne die Karte neu aufzubauen
  _updateModules() {
    const card = this._content?.querySelector(".modcard");
    if (!card) return;
    const tiles = this._modTiles(), lay = this._modLayout();
    const { pow, peak, live } = this._modValues();
    const vals = tiles.map((t) => (pow[t.s.id] || 0) / t.n);
    // Tagesmaximum: höchster Wert eines Moduls am ganzen angezeigten Tag (heute bis jetzt, samt Live-Wert)
    const dayRef = Math.max(50, ...tiles.map((t) => (peak[t.s.id] || 0) / t.n), ...(live ? vals : []));
    const ref = lay.mode === "day" ? dayRef : Math.max(50, ...vals);
    tiles.forEach((t, i) => {
      const el = card.querySelector(`[data-mod="${t.key}"]`);
      if (!el) return;
      const p = Math.max(0, Math.min(1, lay.mode === "own" ? (pow[t.s.id] || 0) / Math.max(50, peak[t.s.id] || 0) : vals[i] / ref));
      const l = 10 + p * 45;
      // Feines Zellraster (6 × 10) für beide Modularten; die Fläche wird mit der Leistung heller
      const cells = (a) => `repeating-linear-gradient(90deg, transparent 0 calc(16.66% - 1px), rgba(255,255,255,${a}) calc(16.66% - 1px) 16.66%), repeating-linear-gradient(0deg, transparent 0 calc(10% - 1px), rgba(255,255,255,${a}) calc(10% - 1px) 10%)`;
      if (t.s.color === "black") {
        const k = 5 + p * 25; // Full Black: von tiefschwarz zu anthrazit
        el.style.background = `${cells(0.07)}, linear-gradient(160deg, hsl(220,6%,${(k + 6).toFixed(1)}%) 0%, hsl(220,6%,${k.toFixed(1)}%) 60%, hsl(220,6%,${(k * 0.5).toFixed(1)}%) 100%)`;
      } else {
        el.style.background = `${cells(0.12)}, linear-gradient(160deg, hsl(210,75%,${(l + 15).toFixed(1)}%) 0%, hsl(218,78%,${l.toFixed(1)}%) 60%, hsl(225,80%,${(l * 0.6).toFixed(1)}%) 100%)`;
      }
      el.style.boxShadow = `0 0 ${(p * 30).toFixed(1)}px ${(p * 8).toFixed(1)}px rgba(255,200,40,${(p * 0.8).toFixed(2)})`;
      el.querySelector(".mv").textContent = fmtW(vals[i]);
    });
    const total = Object.values(pow).reduce((x, y) => x + y, 0);
    card.querySelector(".modtm").textContent = live ? TT("live", "live") : this._modT !== null ? fmtTime(this._modT) : "";
    const sl = card.querySelector(".modsl");
    if (sl && this._modT !== null) sl.value = this._modT;
    const liveBtn = card.querySelector(".modlive");
    if (liveBtn) liveBtn.style.display = live ? "none" : "";
    card.querySelector(".modmode").textContent = lay.mode === "own" ? TT("Helligkeit je String zum Tageshöchstwert", "Brightness per string to its peak")
      : lay.mode === "day" ? TT("Helligkeit zum Tagesmaximum", "Brightness relative to the day's peak") : TT("Helligkeit relativ zum stärksten Modul", "Brightness relative to the strongest module");
    card.querySelector(".modsum").textContent = `${TT("Summe", "Total")} ${fmtW(total)} · ${(this._entry.strings || []).length} ${TT("Strings", "strings")}, ${tiles.length} ${TT("Module", "modules")}`;
    // Senkrechte Linie in „Leistung je String“
    const line = this._content.querySelector('.curve-wrap[data-chart="strings"] .modt'), c = this._curves.strings;
    if (line && c) {
      const on = this._modT !== null && this._modT >= c.t0 && this._modT <= c.t1;
      line.style.display = on ? "" : "none";
      if (on) { const xv = c.x(this._modT).toFixed(1); line.setAttribute("x1", xv); line.setAttribute("x2", xv); }
    }
  }

  // Normale Ansicht: Anordnung so vergrößern, dass sie die Fläche mit etwas Rand ausfüllt, und mittig setzen.
  // Beim Anordnen nur die Schriftgröße an die Kachel anpassen.
  _layoutModules() {
    const roof = this._content?.querySelector(".modcard .modroof");
    if (!roof) return;
    const tiles = [...roof.querySelectorAll(".modtile")];
    const font = (el, px) => { el.style.fontSize = `${Math.min(18, Math.max(10, px * 0.13)).toFixed(1)}px`; };
    if (!roof.classList.contains("fit")) {
      for (const el of tiles) font(el, el.offsetWidth);
      return;
    }
    if (!tiles.length) return;
    const d = tiles.map((el) => ({ el, x: +el.dataset.x, y: +el.dataset.y, w: +el.dataset.w, h: +el.dataset.h }));
    const minX = Math.min(...d.map((t) => t.x)), minY = Math.min(...d.map((t) => t.y));
    const bw = Math.max(...d.map((t) => t.x + t.w)) - minX, bh = Math.max(...d.map((t) => t.y + t.h)) - minY;
    const W = roof.clientWidth;
    if (!W) return;
    // Breite füllt höchstens 92 %, eine Kachel höchstens 22 % der Breite und 180 px (sonst werden wenige Module riesig)
    const maxW = Math.max(...d.map((t) => t.w));
    const scale = Math.min((0.92 / bw) * W, (0.22 / maxW) * W, 180 / maxW);
    const pad = Math.max(12, W * 0.03);
    roof.style.minHeight = `${Math.round(bh * scale + 2 * pad)}px`;
    const H = roof.clientHeight;
    const offX = (W - bw * scale) / 2 - minX * scale, offY = (H - bh * scale) / 2 - minY * scale;
    for (const t of d) {
      Object.assign(t.el.style, { left: `${(offX + t.x * scale).toFixed(1)}px`, top: `${(offY + t.y * scale).toFixed(1)}px`, width: `${(t.w * scale).toFixed(1)}px`, height: `${(t.h * scale).toFixed(1)}px` });
      font(t.el, Math.min(t.w, t.h) * scale);
    }
  }

  _bindModules() {
    const card = this._content.querySelector(".modcard");
    if (!card) return;
    this._updateModules();
    this._layoutModules();
    // Neu einpassen, wenn sich die Breite ändert (Fenster, halbe Breite)
    this._modRO?.disconnect();
    const roofEl = card.querySelector(".modroof");
    if (roofEl && window.ResizeObserver) {
      let lastW = roofEl.clientWidth;
      this._modRO = new ResizeObserver(() => { if (roofEl.clientWidth !== lastW) { lastW = roofEl.clientWidth; this._layoutModules(); } });
      this._modRO.observe(roofEl);
    }
    const sl = card.querySelector(".modsl");
    sl?.addEventListener("input", () => { this._modStop(); this._modT = Number(sl.value); this._updateModules(); });
    const roof = card.querySelector(".modroof");
    if (!this._modEdit || !roof) return;
    // Ziehen: Position relativ zur Fläche, eingerastet auf 1 %
    roof.addEventListener("pointerdown", (ev) => {
      const el = ev.target.closest("[data-mod]");
      if (!el || ev.target.closest("[data-modrot]")) return;
      const r = roof.getBoundingClientRect(), er = el.getBoundingClientRect();
      this._modDrag = { el, key: el.dataset.mod, dx: ev.clientX - er.left, dy: ev.clientY - er.top, r };
      el.setPointerCapture(ev.pointerId);
      el.classList.add("drag");
      ev.preventDefault();
    });
    roof.addEventListener("pointermove", (ev) => {
      const d = this._modDrag;
      if (!d) return;
      const snap = (v) => Math.round(v * 100) / 100;
      const H = Number(roof.dataset.h);
      const x = snap(Math.min(Math.max((ev.clientX - d.dx - d.r.left) / d.r.width, 0), 1 - d.el.offsetWidth / d.r.width));
      const y = snap(Math.min(Math.max((ev.clientY - d.dy - d.r.top) / d.r.width, 0), H - d.el.offsetHeight / d.r.width));
      d.el.style.left = `${(x * 100).toFixed(2)}%`;
      d.el.style.top = `${((y / H) * 100).toFixed(2)}%`;
      const t = this._modDraft.tiles[d.key];
      t.x = x; t.y = y;
    });
    const end = () => { if (this._modDrag) { this._modDrag = null; this._render(); } };
    roof.addEventListener("pointerup", end);
    roof.addEventListener("pointercancel", end);
  }

  // Ein 5-Minuten-Schritt alle 80 ms bei 1×, schneller bzw. langsamer je nach Tempo
  _modPlay() {
    this._modTimer = setInterval(() => {
      const [, end] = this._modRange();
      this._modT = Math.min(end, this._modT + 5 * 60000);
      if (this._modT >= end) { this._modStop(); this._render(); return; }
      this._updateModules();
    }, 80 / this._modSpeed);
  }

  _modStop() {
    if (this._modTimer) { clearInterval(this._modTimer); this._modTimer = null; }
  }

  _onModNav(action) {
    if (action === "mod-play") {
      if (this._modTimer) { this._modStop(); this._render(); return; }
      const [a, b] = this._modRange();
      if (this._modT === null || this._modT >= b) this._modT = a;
      this._modPlay();
      this._render();
    } else if (action === "mod-live") {
      this._modStop();
      this._modT = null;
      this._render();
    } else if (action === "mod-edit") {
      const tiles = this._modTiles(), pos = this._modPositions(tiles), lay = this._entry.layout || {};
      this._modDraft = { mode: ["own", "day"].includes(lay.mode) ? lay.mode : "max", tiles: Object.fromEntries(tiles.map((t, i) => [t.key, { ...pos[i] }])) };
      this._modEdit = true;
      this._render();
    } else if (action === "mod-mode-max" || action === "mod-mode-own" || action === "mod-mode-day") {
      if (this._modDraft) this._modDraft.mode = action.slice(9);
      this._render();
    } else if (action === "mod-speed") {
      const speeds = [0.5, 1, 2, 4];
      this._modSpeed = speeds[(speeds.indexOf(this._modSpeed) + 1) % speeds.length];
      savePref("pv-summary-modspeed", String(this._modSpeed));
      if (this._modTimer) { this._modStop(); this._modPlay(); }
      this._render();
    } else if (action === "mod-cancel") {
      this._modDraft = null;
      this._modEdit = false;
      this._render();
    } else if (action === "mod-done") {
      const layout = this._modDraft, entry = this._entry;
      this._modDraft = null;
      this._modEdit = false;
      entry.layout = layout;
      this._render();
      this._hass.callWS({ type: "pv_summary/layout", entry_id: entry.entry_id, layout })
        .then((res) => { entry.layout = res.layout; })
        .catch((err) => console.warn("PV Summary: Anordnung konnte nicht gespeichert werden", err));
    }
  }

  _renderRecords() {
    const best = this._state("best_day");
    const rec = this._state("max_power_alltime");
    const record = (key, icon, value, unit, label, when) => this._has(key) ? `<div class="recrow">
        <ha-icon icon="${icon}" style="color:${COLORS.pv};--mdc-icon-size:20px"></ha-icon>
        <span>${label}${when ? ` <span class="muted">${when}</span>` : ""}</span>
        <b>${value}<small>${unit}</small></b></div>` : "";
    // Durchschnitte als Balken im Verhältnis zum besten Tag
    const bestV = this._num("best_day");
    const avg = (key, label) => {
      if (!this._has(key)) return "";
      const v = this._num(key);
      const pct = bestV > 0 && v !== null ? Math.min(100, Math.max(0, (v / bestV) * 100)) : 0;
      return `<div class="avgrow"><span class="muted">${label}</span>
        <div class="bar"><div style="width:${pct.toFixed(1)}%;background:${COLORS.pv}"></div></div>
        <b>${fmt(v, 1)}<small>kWh</small></b></div>`;
    };
    const maxW = this._num("max_power_alltime");
    return `<div class="card reccard"><h3><ha-icon icon="mdi:trophy-outline"></ha-icon>${TT("Durchschnitt und Rekorde", "Averages and records")}</h3>
      <div class="recs">
        ${record("best_day", "mdi:trophy", fmt(bestV, 1), "kWh", TT("Bester Tag", "Best day"), best?.attributes?.date ? fmtDate(best.attributes.date) : "")}
        ${record("max_power_alltime", "mdi:flash", fmtWValue(maxW), fmtWUnit(maxW), TT("Leistungsrekord", "Power record"), rec?.attributes?.time ? fmtDate(rec.attributes.time) : "")}
        <div class="sep"></div>
        ${avg("avg_daily_7", TT("Ø 7 Tage", "Avg 7 days"))}
        ${avg("avg_daily_30", TT("Ø 30 Tage", "Avg 30 days"))}
        ${avg("avg_daily_365", TT("Ø 365 Tage", "Avg 365 days"))}
        ${avg("avg_daily_total", TT("Ø gesamt", "Avg overall"))}
      </div></div>`;
  }

  _renderMonths() {
    // Laufender Monat aus dem Live-Sensor (die Statistik hinkt bis zu einer Stunde hinterher)
    const months = this._months.slice(-12).map((m) => m);
    const liveMonth = this._num("month");
    if (liveMonth !== null) {
      const first = new Date(); first.setHours(0, 0, 0, 0); first.setDate(1);
      const last = months[months.length - 1];
      if (last && last.start.getFullYear() === first.getFullYear() && last.start.getMonth() === first.getMonth()) months[months.length - 1] = { ...last, v: liveMonth };
      else months.push({ start: first, v: liveMonth });
      if (months.length > 12) months.shift();
    }
    if (!months.length) return `<div class="card"><h3><ha-icon icon="mdi:calendar-month"></ha-icon>${TT("Produktion der letzten 12 Monate", "Production, last 12 months")}</h3><div class="empty">${this._loading.days ? LOADING() : TT("Noch keine Monatsdaten.", "No monthly data yet.")}</div></div>`;
    const W = this._chartWidth(0.5), H = 190, L = 40, R = 6, T = 18, B = 22;
    const maxV = niceMax(Math.max(1, ...months.map((m) => m.v)));
    const bw = (W - L - R) / 12;
    const y = (v) => T + (1 - v / maxV) * (H - T - B);
    const monthName = (d) => d.toLocaleDateString(LOCALE(), { month: "short" }).replace(".", "");
    let svg = "";
    for (const v of ticks(0, maxV)) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtAxis(v)}</text>`;
    const offset = 12 - months.length;
    const thisMonth = new Date().getMonth();
    months.forEach((m, i) => {
      const xi = L + (offset + i) * bw;
      const h = Math.max(1, (Math.max(m.v, 0) / maxV) * (H - T - B));
      const cur = m.start.getMonth() === thisMonth && i === months.length - 1;
      svg += barRect(xi + 3, bw - 6, m.v, maxV, H - B, H - T - B, cur ? COLORS.pv : "#639922", `${monthName(m.start)} ${m.start.getFullYear()}: ${fmt(m.v, 1)} kWh`, 3);
      svg += `<text x="${(xi + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${monthName(m.start)}</text>`;
      if (m.v > 0) svg += `<text x="${(xi + bw / 2).toFixed(1)}" y="${(H - B - h - 4).toFixed(1)}" text-anchor="middle">${fmt(m.v, 0)}</text>`;
    });
    return `<div class="card"><h3><ha-icon icon="mdi:calendar-month"></ha-icon>${TT("Produktion der letzten 12 Monate", "Production, last 12 months")}<span class="hint">kWh</span></h3><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
  }

  _stringInfo() {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    return (this._entry.strings || []).map((s, i) => {
      const k = (key) => `${s.id}|${key}`;
      const days = withToday(this._stringDays[this._id(k("string_total"))] || [], this._num(k("string_today")));
      return {
        s, k, days,
        color: STRING_COLORS[i % STRING_COLORS.length],
        today: this._num(k("string_today")),
        yesterday: days.find((d) => d.start.toDateString() === yesterday.toDateString())?.v ?? null,
        sum30: days.reduce((a, d) => a + d.v, 0),
      };
    });
  }

  _renderStringTiles() {
    const fmtState = (st) => st ? `${fmt(parseFloat(st.state), 1)} ${escapeHtml(st.attributes.unit_of_measurement || "")}` : "–";
    const tiles = this._stringInfo().map(({ s, k, color, today, yesterday }) => {
      const volt = this._state(k("string_voltage"));
      const curr = this._state(k("string_current"));
      const power = this._num(k("string_power"));
      const row = (label, value, key) => `<span${key ? ` class="click" data-key="${key}"` : ""}>${label}<b>${value}</b></span>`;
      return `<div class="card tile strtile">
        <div class="lbl"><span class="dot" style="background:${color}"></span>${escapeHtml(s.title)}</div>
        <div class="valrow">
          <div class="val">${fmt(today, 2)}<small>kWh ${TT("heute", "today")}</small></div>
          <div class="val big click" data-key="${k("string_power")}" style="color:${color}">${fmtWValue(power)}<small>${fmtWUnit(power)}</small></div>
        </div>
        <div class="rows">
          ${row(TT("Gestern", "Yesterday"), yesterday === null ? "–" : `${fmt(yesterday, 2)} kWh`)}
          ${row(TT("Gesamt", "Total"), `${fmt(this._num(k("string_total")), 1)} kWh`, k("string_total"))}
          ${volt ? row(TT("Spannung", "Voltage"), fmtState(volt), k("string_voltage")) : ""}
          ${curr ? row(TT("Strom", "Current"), fmtState(curr), k("string_current")) : ""}
        </div></div>`;
    }).join("");
    return `<div class="card"><h3><ha-icon icon="mdi:solar-panel"></ha-icon>${TT("Ertrag je String", "Yield per string")}</h3><div class="strgrid">${tiles}</div></div>`;
  }

  _renderStringShare() {
    const info = this._stringInfo();
    const totalToday = info.reduce((a, x) => a + (x.today || 0), 0);
    const total30 = info.reduce((a, x) => a + x.sum30, 0);
    const pct = (v, total) => (total > 0 ? (v / total) * 100 : 0);
    const stack = (values, total) => `<div class="stack">${values.map(({ v, color }) => `<div style="width:${pct(v, total).toFixed(2)}%;background:${color}"></div>`).join("")}</div>`;
    const legend = info.map(({ s, color, today, sum30 }) => `<span><span class="dot" style="background:${color}"></span>${escapeHtml(s.title)}<b>${fmt(pct(today || 0, totalToday), 0)} %</b><i>${total30 > 0 ? fmt(pct(sum30, total30), 0) + " %" : "–"}</i></span>`).join("");
    return `<div class="card"><h3><ha-icon icon="mdi:chart-donut"></ha-icon>${TT("Anteil am Gesamtertrag", "Share of total yield")}</h3>
      <div class="share">
        <div><div class="lbl">${TT("Heute", "Today")} · ${fmt(totalToday, 2)} kWh</div>${stack(info.map((x) => ({ v: x.today || 0, color: x.color })), totalToday)}</div>
        <div><div class="lbl">${TT("Letzte 30 Tage", "Last 30 days")} · ${fmt(total30, 1)} kWh</div>${total30 > 0 ? stack(info.map((x) => ({ v: x.sum30, color: x.color })), total30) : `<div class="muted" style="font-size:12px">${TT("Noch keine Statistik", "No statistics yet")}</div>`}</div>
        <div class="legend"><span class="muted" style="font-size:12px">String<b style="font-weight:400">${TT("heute", "today")}</b><i>${TT("30 Tage", "30 days")}</i></span>${legend}</div>
      </div></div>`;
  }

  _renderStringDays() {
    const info = this._stringInfo();
    const titleText = TT("Produktion je String, letzte 30 Tage", "Production per string, last 30 days");
    const title = `<h3><ha-icon icon="mdi:chart-bar"></ha-icon>${titleText}</h3>`;
    const dayKeys = [...new Set(info.flatMap((x) => x.days.map((d) => d.start.toDateString())))]
      .map((k) => new Date(k)).sort((a, b) => a - b).slice(-30);
    const hasData = info.some((x) => x.days.some((d) => d.v !== 0));
    if (!dayKeys.length || !hasData) return `<div class="card">${title}<div class="empty">${TT("Keine Daten vorhanden.", "No data available.")}</div></div>`;
    const W = this._chartWidth(0.58), H = 200, L = 36, R = 6, T = 14, B = 22;
    const values = info.map((x) => Object.fromEntries(x.days.map((d) => [d.start.toDateString(), d.v])));
    const maxV = niceMax(Math.max(0.5, ...values.flatMap((m) => Object.values(m))));
    const gw = (W - L - R) / 30;
    const bw = Math.max(1, (gw - 3) / info.length);
    const y = (v) => T + (1 - v / maxV) * (H - T - B);
    let svg = "";
    for (const v of ticks(0, maxV)) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtAxis(v)}</text>`;
    const offset = 30 - dayKeys.length;
    dayKeys.forEach((day, i) => {
      const gx = L + (offset + i) * gw + 1.5;
      info.forEach((x, j) => {
        const v = values[j][day.toDateString()] ?? 0;
        if (v !== 0) svg += barRect(gx + j * bw, Math.max(1, bw - 0.5), v, maxV, H - B, H - T - B, x.color, `${escapeHtml(x.s.title)}, ${day.toLocaleDateString(this._locale)}: ${fmt(v, 2)} kWh`, 1);
      });
      const every = W < 450 ? 10 : 5;
      if (i % every === 0 || i === dayKeys.length - 1) svg += `<text x="${(gx + gw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${fmtDayMonth(day)}</text>`;
    });
    const legend = info.map((x) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px"><span class="dot" style="background:${x.color}"></span>${escapeHtml(x.s.title)}</span>`).join("");
    return `<div class="card"><h3><ha-icon icon="mdi:chart-bar"></ha-icon>${titleText}<span class="hint">${legend}</span></h3><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
  }

  // Breite der SVG-Koordinaten = echte Pixelbreite der Karte (Schrift bleibt so 11 px groß)
  _chartWidth(share) {
    const w = (this._content?.clientWidth || 1000) - 32;
    const cardW = w < 700 ? w : w * share - 16;
    return Math.max(300, Math.round(cardW - 34));
  }

  get _locale() { return this._hass?.locale?.language || this._hass?.language || "de"; }
}

// ------------------------------------------------------------------ Hilfsfunktionen

let currentLocale = "de";
// Texte: Deutsch, wenn Home Assistant auf Deutsch steht, sonst Englisch
const TT = (de, en) => (currentLocale.toLowerCase().startsWith("de") ? de : en);
const LOCALE = () => currentLocale;
const LOADING = () => `<span class="loading"></span>${TT("Lade Daten …", "Loading data …")}`;

function fmt(v, digits = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return v.toLocaleString(LOCALE(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtW(w) { return `${fmtWValue(w)} ${fmtWUnit(w)}`; }
function fmtWValue(w) { if (w === null || !Number.isFinite(w)) return "–"; return Math.abs(w) >= 10000 ? fmt(w / 1000, 1) : fmt(w, 0); }
function fmtWUnit(w) { return w !== null && Math.abs(w) >= 10000 ? "kW" : "W"; }
function fmtWShort(w) { return Math.abs(w) >= 1000 ? `${fmt(w / 1000, w % 1000 ? 1 : 0)} kW` : `${fmt(w, 0)} W`; }
// Achsenwert: ganze Zahlen ohne, Zwischenschritte (z. B. 0,8 · 1,6 · 2,4) mit einer Nachkommastelle
function fmtAxis(v) { return fmt(v, Number.isInteger(v) ? 0 : 1); }
function fmtHours(h) { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`; }
function fmtTime(iso) { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString(LOCALE(), { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(LOCALE(), { day: "2-digit", month: "2-digit", year: "numeric" }); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= v * 1.05) return m * exp;
  return 10 * exp;
}
function ticks(min, max) {
  const step = niceMax((max - min) / 4) / 1;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000 || 0); // "|| 0" vermeidet die Anzeige "-0"
  return out;
}

// Rand des Haus-Knotens in Bögen je Quelle (PV, Akku, Netz) und Prozentzeile darunter
function sourceArcs(n) {
  const r = 40, c = 2 * Math.PI * r;
  const sum = n.arcs.reduce((a, p) => a + p.v, 0);
  if (sum <= 0) return "";
  let offset = 0;
  const arcs = n.arcs.map((p) => {
    const len = (p.v / sum) * c;
    const arc = len > 0.5 ? `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="none" stroke="${p.color}" stroke-width="4" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${n.x} ${n.y})"><title>${p.label}: ${fmt((p.v / sum) * 100, 0)} %</title></circle>` : "";
    offset += len;
    return arc;
  }).join("");
  const shares = n.arcs.filter((p) => p.v / sum >= 0.005).map((p) => `${p.label} ${fmt((p.v / sum) * 100, 0)} %`).join(" · ");
  return `${arcs}<text x="${n.x}" y="${n.y + 56}" text-anchor="middle" style="font-size:11px">${shares}</text>`;
}

// Farbe des Akkustands: unter 25 % rot, bis 75 % gelb, darüber grün
function socColor(soc) { return soc < 25 ? "#e24b4a" : soc < 75 ? "#e6b800" : "#43a047"; }

function fmtDayMonth(d) { return d.toLocaleDateString(LOCALE(), { day: "numeric", month: "numeric" }); }

function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }

// Balken; negative Werte (Zählersprung in der Statistik) als kurzer roter Balken, ohne die Skala zu verzerren
function barRect(x, w, v, maxV, base, height, color, title, rx) {
  if (v < 0) return `<rect x="${x.toFixed(1)}" y="${(base - 4).toFixed(1)}" width="${w.toFixed(1)}" height="4" rx="1" fill="#e24b4a"><title>${title}: ${TT("Zählersprung (negativer Wert)", "meter jump (negative value)")}</title></rect>`;
  const h = Math.max(1, (v / maxV) * height);
  return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${color}"><title>${title}</title></rect>`;
}

// Zuletzt bekannter Wert einer Reihe zum Zeitpunkt t (Binärsuche), null vor dem ersten Messpunkt
// Stufenverlauf [[ms, Wert], …] in 5-Minuten-Abschnitte [start, Mittel, Min, Max] zerlegen.
// Das Mittel ist nach der Zeit gewichtet; Abschnitte ohne Wert fehlen.
function binSeries(pts, from, to) {
  const out = [];
  let k = 0;
  while (k < pts.length && pts[k][0] <= from) k++;
  let cur = k ? pts[k - 1][1] : null;
  for (let b = from; b < to; b += BIN_MS) {
    const e = Math.min(b + BIN_MS, to);
    let t = b, sum = 0, dur = 0, lo = cur ?? Infinity, hi = cur ?? -Infinity;
    while (k < pts.length && pts[k][0] < e) {
      const [tk, vk] = pts[k++];
      if (cur !== null) { sum += cur * (tk - t); dur += tk - t; }
      cur = vk; t = Math.max(tk, b);
      lo = Math.min(lo, vk); hi = Math.max(hi, vk);
    }
    if (cur !== null) { sum += cur * (e - t); dur += e - t; }
    if (dur > 0) out.push([b, sum / dur, lo, hi]);
  }
  return out;
}

// Abschnitt, in dem t liegt (oder null)
function binAt(bins, t) {
  let lo = 0, hi = bins.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (t < bins[m][0]) hi = m - 1; else if (t >= bins[m][0] + BIN_MS) lo = m + 1; else return bins[m];
  }
  return null;
}

// Sonnenauf- und -untergang nach der Näherung der Sonnenaufgangsgleichung (Genauigkeit etwa 1 Minute)
function sunTimes(ms, lat, lon) {
  const rad = Math.PI / 180, day = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
  const d = ms / day - 0.5 + J1970 - J2000;
  const lw = rad * -lon, phi = rad * lat;
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(rad * 23.4397) * Math.sin(L));
  const cosW = (Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW);
  const transit = (a) => J2000 + J0 + (a + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const toMs = (j) => (j + 0.5 - J1970) * day;
  const noon = transit(0), set = transit(w);
  return [toMs(noon - (set - noon)), toMs(set)];
}

// Sonnenhöhe in Grad (Näherung wie bei sunTimes, Genauigkeit etwa 1°)
function sunElevation(ms, lat, lon) {
  const rad = Math.PI / 180, d = ms / 864e5 - 0.5 + 2440588 - 2451545;
  const M = rad * (357.5291 + 0.98560028 * d);
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  const e = rad * 23.4397;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const H = rad * (280.16 + 360.9856235 * d) + rad * lon - ra;
  const phi = rad * lat;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / rad;
}

// Kleine Sonne am Horizont mit Pfeil nach oben (Aufgang) bzw. unten (Untergang)
function sunIcon(up) {
  return `<g stroke="${SUN_COLOR}" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M-6 3 A6 6 0 0 1 6 3"/><line x1="-8" y1="3" x2="8" y2="3"/>`
    + `<line x1="0" y1="-4" x2="0" y2="-9"/><path d="${up ? "M-2.5 -6.5 L0 -9 L2.5 -6.5" : "M-2.5 -6.5 L0 -4 L2.5 -6.5"}"/></g>`;
}

// Tageswerte [{start, v}] mit dem heutigen Tag aus dem Live-Sensor (ersetzt bzw. ergänzt den Statistikwert)
function withToday(list, live) {
  if (live === null || live === undefined) return list;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const out = list.filter((d) => d.start.toDateString() !== start.toDateString());
  out.push({ start, v: live });
  return out.sort((a, b) => a.start - b.start);
}

// PV-Reihen (Anlage und Strings) sind nachts 0, Haus, Akku und Netz nicht
function isPvKey(key) { return key === "power" || key.endsWith("|string_power"); }

// Einstellungen im Browser merken (kann in privaten Fenstern fehlen)
function loadPref(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (err) { return fallback; } }
function savePref(key, value) { try { localStorage.setItem(key, value); } catch (err) { /* nicht speicherbar */ } }

// Autarkie in %: Anteil des Hausverbrauchs, der nicht aus dem Netz kam
function autarky(imp, house) {
  return house > 0 && imp !== null && imp !== undefined ? Math.min(100, Math.max(0, (1 - imp / house) * 100)) : null;
}

function valueAt(pts, t) {
  let lo = 0, hi = pts.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found < 0 ? null : pts[found][1];
}

// Antwort von history/history_during_period (komprimiertes Format) in [[ms, Wert], …] umwandeln
function parseHistory(res) {
  const out = {};
  for (const [id, states] of Object.entries(res || {})) {
    // Die Leistungssensoren der Integration liefern immer W
    out[id] = states
      .map((s) => {
        const v = parseFloat(s.s ?? s.state);
        const t = s.lu ?? s.lc ?? (Date.parse(s.last_updated || s.last_changed) / 1000);
        return [t * 1000, v];
      })
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }
  return out;
}

if (!customElements.get("pv-summary-panel")) customElements.define("pv-summary-panel", PVSummaryPanel);
