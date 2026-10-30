// PV Summary – eigenes Dashboard (Panel in der Seitenleiste)
// Ohne Build-Schritt und ohne Fremdbibliotheken: reines Web Component mit SVG-Diagrammen.

const COLORS = { pv: "#f0a30a", bat: "#1d9e75", house: "#5b7290", grid: "#7f77dd" };
// Farben für einzelne Strings (wiederholen sich ab dem 9. String)
const STRING_COLORS = ["#f0a30a", "#1d9e75", "#7f77dd", "#d85a30", "#378add", "#d4537e", "#639922", "#888780"];
const HISTORY_REFRESH_MS = 5 * 60 * 1000;
const LIVE_RENDER_MS = 2000;

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
  .kpi .ico { flex:none; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; --mdc-icon-size:20px; }
  .kpi .txt { min-width:0; }
  .flowcard svg { max-height:250px; margin:0 auto; }
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
  .list { display:grid; gap:10px; font-size:14px; }
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
  .click { cursor:pointer; }
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
  @media (max-width: 700px) { .row.wide-left, .row.half { grid-template-columns:1fr; } .content { padding:8px; gap:8px; } .row { gap:8px; } }
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
      <div class="content"><div class="empty">Lade Daten …</div></div>`;
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
    this.shadowRoot.querySelector(".tabs").addEventListener("click", (ev) => {
      const idx = ev.target.closest(".tab")?.dataset.idx;
      if (idx === undefined) return;
      this._selected = Number(idx);
      this._view = "overview";
      this._renderTabs();
      this._fetchHistory();
      this._render();
    });
    try {
      const result = await this._hass.callWS({ type: "pv_summary/config" });
      this._entries = result.entries;
    } catch (err) {
      this._content.innerHTML = `<div class="empty">PV Summary konnte nicht geladen werden: ${escapeHtml(err.message || String(err))}</div>`;
      return;
    }
    if (!this._entries.length) {
      this._content.innerHTML = `<div class="empty">Noch keine PV-Anlage eingerichtet.</div>`;
      return;
    }
    this._renderTabs();
    this._render();
    this._fetchHistory();
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
    this._renderQueued = true;
    const wait = Math.max(0, LIVE_RENDER_MS - (Date.now() - this._lastRender));
    setTimeout(() => { this._renderQueued = false; this._render(); }, wait);
  }

  _onClick(ev) {
    const view = ev.target.closest("[data-view]");
    if (view) {
      this._view = view.dataset.view;
      this._hover = null;
      this._render();
      return;
    }
    const el = ev.target.closest("[data-key]");
    if (!el) return;
    const entityId = this._id(el.dataset.key);
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------ Daten

  async _fetchHistory() {
    const entry = this._entry;
    if (!entry) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const strings = entry.strings || [];
    const ids = [
      ...["power", "battery_power", "house_power", "grid_power"],
      ...strings.map((s) => `${s.id}|string_power`),
    ].map((k) => this._id(k)).filter(Boolean);
    const total = this._id("total");
    const stringTotals = strings.map((s) => this._id(`${s.id}|string_total`)).filter(Boolean);
    const jobs = [];
    if (ids.length) {
      jobs.push(this._hass.callWS({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      }).then((res) => { this._history = parseHistory(res); }).catch(() => { this._history = {}; }));
    }
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
      jobs.push(stats(dayStart, "day").then((d) => { this._days = d; }).catch(() => { this._days = []; }));
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

  // ------------------------------------------------------------------ Rendering

  _renderTabs() {
    const tabs = this.shadowRoot.querySelector(".tabs");
    tabs.innerHTML = this._entries.length > 1
      ? this._entries.map((e, i) => `<button class="tab ${i === this._selected ? "active" : ""}" data-idx="${i}">${escapeHtml(e.title)}</button>`).join("")
      : "";
  }

  _render() {
    if (!this._entry || !this._content) return;
    this._lastRender = Date.now();
    const parts = [this._renderHead()];
    if (this._view === "strings" && this._entry.strings?.length) {
      parts.push(
        this._renderCurve("strings", "Leistung je String heute", "mdi:solar-panel-large",
          this._entry.strings.map((s, i) => ({ key: `${s.id}|string_power`, color: STRING_COLORS[i % STRING_COLORS.length], label: s.title }))),
        this._renderStringTiles(),
        `<div class="row wide-left">${this._renderStringDays()}${this._renderStringShare()}</div>`,
      );
    } else {
      parts.push(
        `<div class="row half">${this._renderFlow()}${this._renderKpis()}</div>`,
        this._renderCurve("main", "Leistung heute", "mdi:chart-areaspline", [
          { key: "power", color: COLORS.pv, fill: true, peak: true, label: "PV" },
          { key: "house_power", color: COLORS.house, label: "Haus" },
          { key: "battery_power", color: COLORS.bat, signed: ["lädt", "entlädt"], label: "Akku" },
          { key: "grid_power", color: COLORS.grid, signed: ["Bezug", "Einspeisung"], label: "Netz" },
        ]),
        `<div class="row wide-left">${this._renderDays()}${this._renderPeriods()}</div>`,
      );
      if (this._entry.batteries?.length) parts.push(this._renderBattery());
      parts.push(`<div class="row">${this._renderRecords()}${this._renderMonths()}</div>`);
    }
    this._content.innerHTML = parts.join("");
    this._bindCurve();
  }

  _renderHead() {
    const power = this._num("power");
    const active = power !== null && power >= (this._entry.threshold ?? 10);
    const chips = [
      `<span class="chip ${active ? "on" : "off"}"><ha-icon icon="${active ? "mdi:white-balance-sunny" : "mdi:weather-night"}" style="--mdc-icon-size:16px"></ha-icon>${active ? "produziert" : "ruht"}</span>`,
    ];
    const avg30 = this._num("avg_daily_30");
    if (avg30 !== null) chips.push(`<span class="chip click" data-key="avg_daily_30"><ha-icon icon="mdi:chart-line" style="--mdc-icon-size:16px"></ha-icon>Ø ${fmt(avg30, 1)} kWh/Tag</span>`);
    const views = this._entry.strings?.length
      ? `<div class="views">${[["overview", "Übersicht"], ["strings", "Strings"]].map(([v, label]) => `<button data-view="${v}" class="${this._view === v ? "active" : ""}">${label}</button>`).join("")}</div>`
      : "";
    return `<div class="head"><ha-icon icon="mdi:solar-power-variant" style="color:${COLORS.pv};--mdc-icon-size:28px"></ha-icon><span class="name">${escapeHtml(this._entry.title)}</span>${views}<div class="chips">${chips.join("")}</div></div>`;
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
    const pvToHouse = Math.min(pv, need);
    const pvToBat = Math.min(pv - pvToHouse, charge);
    const pvToGrid = Math.min(pv - pvToHouse - pvToBat, exp);
    const batToHouse = Math.min(discharge, need - pvToHouse);
    const batToGrid = Math.min(discharge - batToHouse, Math.max(exp - pvToGrid, 0));
    const gridToHouse = Math.min(imp, Math.max(need - pvToHouse - batToHouse, 0));
    const gridToBat = Math.min(Math.max(imp - gridToHouse, 0), Math.max(charge - pvToBat, 0));

    const nodes = {
      pv: { x: 60, y: 110, color: COLORS.pv, icon: "mdi:solar-power-variant", label: "PV", value: fmtW(pv), key: "power" },
      house: { x: 380, y: 110, color: COLORS.house, icon: "mdi:home", label: house !== null ? "Haus" : "Haus/Netz", value: house !== null ? fmtW(house) : "≈ " + fmtW(need), key: house !== null ? "house_power" : null },
      // Leistung öffnet die Lade-/Entladeleistung, die Prozentzahl den Akkustand
      bat: { x: 220, y: 195, color: COLORS.bat, icon: "mdi:home-battery", label: soc !== null ? `${fmt(soc, 0)} %` : "Akku", value: bat !== null ? (bat > 0 ? "+" : bat < 0 ? "−" : "") + fmtW(Math.abs(bat)) : "", key: this._has("battery_power") ? "battery_power" : soc !== null ? "battery_soc" : null, labelKey: bat !== null && soc !== null ? "battery_soc" : null },
      grid: { x: 220, y: 45, color: COLORS.grid, icon: "mdi:transmission-tower", label: grid === null || Math.abs(grid) <= 1 ? "Netz" : grid < 0 ? "Einspeisung" : "Bezug", value: grid !== null ? fmtW(Math.abs(grid)) : "", key: this._has("grid_power") ? "grid_power" : null },
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
        <circle cx="${n.x}" cy="${n.y}" r="40" fill="var(--card-background-color, #fff)" stroke="${n.color}" stroke-width="3"/>
        <foreignObject x="${n.x - 12}" y="${n.y - 32}" width="24" height="24"><ha-icon icon="${n.icon}" style="color:${n.color};--mdc-icon-size:22px"></ha-icon></foreignObject>
        <text x="${n.x}" y="${n.y + 8}" text-anchor="middle" class="strong" style="font-size:13px">${n.value || n.label}</text>
        <text x="${n.x}" y="${n.y + 23}" text-anchor="middle" style="font-size:${n.labelKey ? 12 : 10}px" ${n.labelKey ? `class="click strong" data-key="${n.labelKey}"` : ""}>${n.value ? n.label : ""}</text>
      </g>`;
    const share = house ? Math.min(100, ((pvToHouse + batToHouse) / house) * 100) : null;
    const hint = share !== null ? `<span class="hint">${fmt(share, 0)} % aus PV/Akku</span>` : grid === null ? `<span class="hint">Hausverbrauch nicht eingerichtet</span>` : "";
    return `<div class="card flowcard"><h3><ha-icon icon="mdi:transit-connection-variant"></ha-icon>Energiefluss jetzt${hint}</h3>
      <svg viewBox="0 ${showGrid ? 0 : 60} 440 ${(showBat ? 240 : 160) - (showGrid ? 0 : 60)}">${lines}${circle(nodes.grid, showGrid)}${circle(nodes.pv)}${circle(nodes.house)}${circle(nodes.bat, showBat)}</svg></div>`;
  }

  _renderKpis() {
    const today = this._num("today");
    const avg30 = this._num("avg_daily_30");
    const max = this._state("max_power_today");
    const best = this._state("best_day");
    let delta = "";
    if (today !== null && avg30) {
      const pct = ((today - avg30) / avg30) * 100;
      delta = `<div class="sub ${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "+" : "−"}${fmt(Math.abs(pct), 0)} % ggü. Ø 30 Tage</div>`;
    }
    const kpi = (key, icon, color, label, value, unit, sub) => `<div class="card kpi">
        <div class="ico" style="background:${color}22;color:${color}"><ha-icon icon="${icon}"></ha-icon></div>
        <div class="txt"><div class="lbl">${label}</div><div class="val">${value}<small>${unit}</small></div>${sub || ""}</div>
      </div>`;
    const sub = (text) => `<div class="sub">${text || "&nbsp;"}</div>`;
    const hours = this._num("production_time_today");
    const sixth = this._has("house_today")
      ? kpi("house_today", "mdi:home-lightning-bolt-outline", COLORS.house, "Haus heute", fmt(this._num("house_today"), 2), "kWh", sub("Verbrauch"))
      : kpi("week", "mdi:calendar-week", "#639922", "Diese Woche", fmt(this._num("week"), 1), "kWh", sub(""));
    return `<div class="kpis">
      ${kpi("today", "mdi:solar-power", COLORS.pv, "Heute", fmt(today, 2), "kWh", delta || sub(""))}
      ${kpi("yesterday", "mdi:calendar-arrow-left", "#8a8a8a", "Gestern", fmt(this._num("yesterday"), 2), "kWh", sub(best ? "Bester Tag " + fmt(this._num("best_day"), 1) + " kWh" : ""))}
      ${kpi("max_power_today", "mdi:flash", "#ef6c00", "Spitze heute", fmtWValue(this._num("max_power_today")), fmtWUnit(this._num("max_power_today")), sub(max?.attributes?.time ? "um " + fmtTime(max.attributes.time) : ""))}
      ${kpi("avg_power_today", "mdi:chart-bell-curve-cumulative", "#c9a000", "Ø Leistung", fmtWValue(this._num("avg_power_today")), fmtWUnit(this._num("avg_power_today")), sub("während der Produktion"))}
      ${kpi("production_time_today", "mdi:timer-sand", "#5b7290", "Laufzeit heute", hours !== null ? fmtHours(hours).replace(" h", "") : "–", "h", sub(`über ${fmt(this._entry.threshold ?? 10, 0)} W`))}
      ${sixth}
    </div>`;
  }

  // Tageskurve mit Tooltip; defs: [{ key, color, label, fill?, peak?, signed? }]
  _renderCurve(chartId, title, icon, defs) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const t0 = start.getTime(), t1 = t0 + 24 * 3600 * 1000, now = Date.now();
    const series = [];
    for (const def of defs) {
      const id = this._id(def.key);
      const pts = id ? (this._history[id] || []).filter((p) => p[0] >= t0) : [];
      const live = this._num(def.key);
      if (live !== null) pts.push([now, live]);
      pts.sort((a, b) => a[0] - b[0]);
      if (pts.length) series.push({ ...def, pts });
    }

    const W = this._chartWidth(1), H = 220, L = 44, R = 8, T = 10, B = 24;
    const all = series.flatMap((s) => s.pts.map((p) => p[1]));
    const maxV = niceMax(Math.max(100, ...all));
    const minV = Math.min(0, ...all) < 0 ? -niceMax(-Math.min(...all)) : 0;
    const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - (v - minV) / (maxV - minV)) * (H - T - B);

    let grid = "";
    for (const v of ticks(minV, maxV)) {
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))" stroke-width="1"/>`;
      grid += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtWShort(v)}</text>`;
    }
    for (let h = 0; h <= 24; h += W < 500 ? 6 : 3) grid += `<text x="${x(t0 + h * 3600000)}" y="${H - 6}" text-anchor="middle">${String(h).padStart(2, "0")}:00</text>`;
    grid += `<line x1="${x(now)}" x2="${x(now)}" y1="${T}" y2="${H - B}" stroke="var(--secondary-text-color)" stroke-dasharray="2 4" stroke-width="1"/>`;

    let paths = "";
    for (const s of series) {
      const pts = s.pts;
      // Stufenlinie: ein Wert gilt bis zur nächsten Änderung
      let d = `M${x(pts[0][0]).toFixed(1)} ${y(pts[0][1]).toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i][0]).toFixed(1)} V${y(pts[i][1]).toFixed(1)}`;
      if (s.fill) {
        const area = `${d} V${y(0).toFixed(1)} H${x(pts[0][0]).toFixed(1)} Z`;
        paths += `<path d="${area}" fill="${s.color}" fill-opacity="0.25" stroke="none"/>`;
      }
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.fill ? 2 : 1.5}" stroke-linejoin="round"/>`;
      if (s.peak) {
        const peak = pts.reduce((m, p) => (p[1] > m[1] ? p : m), [0, -Infinity]);
        if (peak[1] > 0) paths += `<circle cx="${x(peak[0])}" cy="${y(peak[1])}" r="4" fill="${s.color}" stroke="var(--card-background-color,#fff)" stroke-width="2"/><text x="${x(peak[0]) + 8}" y="${y(peak[1]) - 6}" class="strong">${fmtW(peak[1])}</text>`;
      }
    }
    this._curves[chartId] = { W, t0, now, x, y, series };
    const hover = `<g class="hover" style="display:none"><line class="hl" y1="${T}" y2="${H - B}" stroke="var(--primary-text-color)" stroke-opacity="0.4" stroke-width="1"/>${series.map((s) => `<circle r="4" fill="${s.color}" stroke="var(--card-background-color,#fff)" stroke-width="2"/>`).join("")}</g>`;
    const legend = series.map((s) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px"><span style="width:10px;height:10px;border-radius:2px;background:${s.color}"></span>${escapeHtml(s.label)}</span>`).join("");
    const body = series.length ? `<div class="curve-wrap" data-chart="${chartId}"><svg viewBox="0 0 ${W} ${H}">${grid}${paths}${hover}</svg><div class="tip" style="display:none"></div></div>` : `<div class="empty">Noch keine Verlaufsdaten für heute.</div>`;
    return `<div class="card"><h3><ha-icon icon="${icon}"></ha-icon>${title}<span class="hint">${legend}</span></h3>${body}</div>`;
  }

  // Tooltip: zeigt zur Mausposition alle Reihen des Diagramms (zuletzt bekannter Wert)
  _bindCurve() {
    for (const wrap of this._content.querySelectorAll(".curve-wrap")) {
      const chartId = wrap.dataset.chart;
      const svg = wrap.querySelector("svg");
      svg.addEventListener("pointermove", (ev) => {
        const c = this._curves[chartId];
        const rect = svg.getBoundingClientRect();
        const px = ((ev.clientX - rect.left) / rect.width) * c.W;
        const msPerPx = (c.x(c.t0 + 3600000) - c.x(c.t0)) / 3600000;
        this._hover = { chartId, t: c.t0 + (px - c.x(c.t0)) / msPerPx };
        this._showHover(chartId);
      });
      svg.addEventListener("pointerleave", () => { this._hover = null; this._showHover(chartId); });
      if (this._hover?.chartId === chartId) this._showHover(chartId);
    }
  }

  _showHover(chartId) {
    const wrap = this._content?.querySelector(`.curve-wrap[data-chart="${chartId}"]`);
    const c = this._curves[chartId];
    if (!wrap || !c) return;
    const g = wrap.querySelector(".hover");
    const tip = wrap.querySelector(".tip");
    if (this._hover?.chartId !== chartId) { g.style.display = "none"; tip.style.display = "none"; return; }
    const t = Math.min(Math.max(this._hover.t, c.t0), c.now);
    const xv = c.x(t);
    g.style.display = "";
    const line = g.querySelector(".hl");
    line.setAttribute("x1", xv); line.setAttribute("x2", xv);
    const dots = g.querySelectorAll("circle");
    const rows = c.series.map((s, i) => {
      const v = valueAt(s.pts, t);
      const dot = dots[i];
      if (v === null) { dot.style.display = "none"; return ""; }
      dot.style.display = "";
      dot.setAttribute("cx", xv); dot.setAttribute("cy", c.y(v));
      let text = fmtW(Math.abs(v));
      if (s.signed) text = v > 1 ? `+${text} ${s.signed[0]}` : v < -1 ? `−${text} ${s.signed[1]}` : text;
      return `<div class="r"><span class="dot" style="width:8px;height:8px;background:${s.color}"></span>${escapeHtml(s.label)}<b>${text}</b></div>`;
    }).join("");
    const time = new Date(t).toLocaleTimeString(LOCALE(), { hour: "2-digit", minute: "2-digit" });
    tip.innerHTML = `<div class="time">${time} Uhr</div>${rows}`;
    tip.style.display = "";
    const rect = wrap.getBoundingClientRect();
    const left = (xv / c.W) * rect.width;
    const flip = left > rect.width - tip.offsetWidth - 24;
    tip.style.left = `${flip ? left - tip.offsetWidth - 12 : left + 12}px`;
  }

  _renderDays() {
    const days = this._days.slice(-30);
    const avg = this._num("avg_daily_30");
    const W = this._chartWidth(0.58), H = 190, L = 36, R = 6, T = 14, B = 22;
    if (!days.length) return `<div class="card"><h3><ha-icon icon="mdi:chart-bar"></ha-icon>Produktion der letzten 30 Tage</h3><div class="empty">Statistiken werden gesammelt – nach dem ersten vollen Tag erscheinen hier Balken.</div></div>`;
    const maxV = niceMax(Math.max(1, ...days.map((d) => d.v), avg || 0));
    const bw = (W - L - R) / 30;
    const y = (v) => T + (1 - v / maxV) * (H - T - B);
    const bestV = Math.max(...days.map((d) => d.v));
    const todayKey = new Date().toDateString();
    let svg = "";
    for (const v of ticks(0, maxV)) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, 0)}</text>`;
    const offset = 30 - days.length;
    days.forEach((d, i) => {
      const xi = L + (offset + i) * bw;
      const isToday = d.start.toDateString() === todayKey;
      const color = isToday ? COLORS.pv : d.v === bestV ? "#ef9f27" : "#97c459";
      const h = Math.max(1, (d.v / maxV) * (H - T - B));
      svg += `<rect x="${(xi + 1.5).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}"><title>${d.start.toLocaleDateString(this._locale)}: ${fmt(d.v, 2)} kWh</title></rect>`;
      const every = W < 450 ? 10 : 5;
      if (i % every === 0 || i === days.length - 1) svg += `<text x="${(xi + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${d.start.getDate()}.${d.start.getMonth() + 1}.</text>`;
    });
    if (avg) svg += `<line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="#3b6d11" stroke-dasharray="5 4" stroke-width="1.5"/>`;
    return `<div class="card"><h3><ha-icon icon="mdi:chart-bar"></ha-icon>Produktion der letzten 30 Tage<span class="hint">${avg ? `gestrichelt = Ø ${fmt(avg, 1)} kWh` : ""}</span></h3><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
  }

  _renderPeriods() {
    const avg30 = this._num("avg_daily_30") || null;
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    // Balken = Anteil an dem, was bei Ø 30 Tage für den ganzen Zeitraum zu erwarten wäre
    const row = (key, label, expectedDays, color) => {
      const v = this._num(key);
      const expected = avg30 && expectedDays ? avg30 * expectedDays : null;
      const pct = expected ? Math.min(100, (v / expected) * 100) : 0;
      return `<div class="item" data-key="${key}"><div class="line"><span>${label}</span><b>${fmt(v, v !== null && v >= 100 ? 0 : 1)} kWh</b></div>${expected ? `<div class="bar"><div style="width:${pct.toFixed(0)}%;background:${color}"></div></div>` : ""}</div>`;
    };
    return `<div class="card"><h3><ha-icon icon="mdi:calendar-range"></ha-icon>Zeiträume<span class="hint">Balken = Anteil an der Hochrechnung aus Ø 30 Tage</span></h3>
      <div class="list">
        ${row("week", "Diese Woche", 7, "#97c459")}
        ${row("month", "Dieser Monat", dim, "#639922")}
        ${row("year", "Dieses Jahr", 365, "#3b6d11")}
        <div class="item line sep" data-key="last_month"><span class="muted">Letzter Monat</span><b>${fmt(this._num("last_month"), 1)} kWh</b></div>
        <div class="item line" data-key="total"><span class="muted">Gesamt</span><b>${fmt(this._num("total"), 0)} kWh</b></div>
      </div></div>`;
  }

  _renderBattery() {
    const batteries = this._entry.batteries || [];
    const fmtState = (st) => st ? `${fmt(parseFloat(st.state), 1)} ${st.attributes.unit_of_measurement || ""}` : null;
    const block = (b) => {
      const k = (key) => `${b.id}|${key}`;
      const soc = this._num(k("battery_soc"));
      const bat = this._num(k("battery_power"));
      const temp = this._state(k("battery_temperature"));
      const volt = this._state(k("battery_voltage"));
      const r = 40, c = 2 * Math.PI * r;
      const color = soc === null ? COLORS.bat : soc < 20 ? "#e24b4a" : soc < 40 ? "#ef9f27" : COLORS.bat;
      const ring = soc === null ? `<ha-icon icon="mdi:home-battery-outline" style="--mdc-icon-size:40px;color:${COLORS.bat}"></ha-icon>` : `<svg viewBox="0 0 100 100" style="width:84px;flex:none" class="click" data-key="${k("battery_soc")}">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--secondary-background-color, rgba(0,0,0,.06))" stroke-width="10"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${((soc / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
          <text x="50" y="57" text-anchor="middle" class="strong" style="font-size:20px">${fmt(soc, 0)} %</text></svg>`;
      const status = bat === null ? "" : bat > 1 ? "lädt" : bat < -1 ? "entlädt" : "ruht";
      const lines = [
        bat !== null ? `<span class="click" data-key="${k("battery_power")}"><ha-icon icon="mdi:flash" style="--mdc-icon-size:15px"></ha-icon> ${bat > 0 ? "+" : bat < 0 ? "−" : ""}${fmtW(Math.abs(bat))} ${status}</span>` : "",
        temp || volt ? `<span class="muted">${temp ? `<span class="click" data-key="${k("battery_temperature")}"><ha-icon icon="mdi:thermometer" style="--mdc-icon-size:15px"></ha-icon> ${fmtState(temp)}</span>` : ""}${temp && volt ? " · " : ""}${volt ? `<span class="click" data-key="${k("battery_voltage")}"><ha-icon icon="mdi:sine-wave" style="--mdc-icon-size:15px"></ha-icon> ${fmtState(volt)}</span>` : ""}</span>` : "",
        this._has(k("battery_charged_today")) ? `<span class="muted">heute ↑ ${fmt(this._num(k("battery_charged_today")), 2)} kWh · ↓ ${fmt(this._num(k("battery_discharged_today")), 2)} kWh</span>` : "",
      ].join("");
      const capacity = b.capacity ? `<span class="muted">${fmt(b.capacity, 1)} kWh Kapazität</span>` : "";
      return `<div class="batblock">${ring}<div class="info"><b>${escapeHtml(b.title)}</b>${lines}${capacity}</div></div>`;
    };
    const mini = (key, label) => this._has(key) ? `<div class="card tile"><div class="lbl">${label}</div><div class="val">${fmt(this._num(key), 2)}<small>kWh</small></div></div>` : "";
    const totals = `${mini("battery_charged_today", batteries.length > 1 ? "Geladen heute (alle)" : "Geladen heute")}${mini("battery_discharged_today", batteries.length > 1 ? "Entladen heute (alle)" : "Entladen heute")}${mini("house_today", "Haus heute")}`;
    const soc = this._num("battery_soc");
    const hint = batteries.length > 1 && soc !== null ? `<span class="hint">gemeinsam ${fmt(soc, 0)} %</span>` : "";
    return `<div class="card"><h3><ha-icon icon="mdi:home-battery"></ha-icon>${batteries.length > 1 ? "Akkus" : "Akku"}${hint}</h3>
      <div class="batgrid">${batteries.map(block).join("")}</div>
      ${totals ? `<div class="mini" style="margin-top:12px">${totals}</div>` : ""}</div>`;
  }

  _renderRecords() {
    const best = this._state("best_day");
    const rec = this._state("max_power_alltime");
    const item = (key, label, value, sub) => this._has(key) ? `<div class="card tile"><div class="lbl">${label}</div><div class="val">${value}</div><div class="sub">${sub || "&nbsp;"}</div></div>` : "";
    return `<div class="card"><h3><ha-icon icon="mdi:trophy-outline"></ha-icon>Durchschnitt und Rekorde<span class="hint">pro Tag</span></h3><div class="mini" style="grid-template-columns:repeat(auto-fit, minmax(150px, 1fr))">
      ${item("avg_daily_7", "Ø 7 Tage", `${fmt(this._num("avg_daily_7"), 1)}<small>kWh</small>`)}
      ${item("avg_daily_30", "Ø 30 Tage", `${fmt(this._num("avg_daily_30"), 1)}<small>kWh</small>`)}
      ${item("avg_daily_365", "Ø 365 Tage", `${fmt(this._num("avg_daily_365"), 1)}<small>kWh</small>`)}
      ${item("avg_daily_total", "Ø gesamt", `${fmt(this._num("avg_daily_total"), 1)}<small>kWh</small>`)}
      ${item("best_day", "Bester Tag", `${fmt(this._num("best_day"), 1)}<small>kWh</small>`, best?.attributes?.date ? fmtDate(best.attributes.date) : "")}
      ${item("max_power_alltime", "Leistungsrekord", `${fmtWValue(this._num("max_power_alltime"))}<small>${fmtWUnit(this._num("max_power_alltime"))}</small>`, rec?.attributes?.time ? fmtDate(rec.attributes.time) : "")}
    </div></div>`;
  }

  _renderMonths() {
    const months = this._months.slice(-12);
    if (!months.length) return `<div class="card"><h3><ha-icon icon="mdi:calendar-month"></ha-icon>Produktion der letzten 12 Monate</h3><div class="empty">Noch keine Monatsdaten.</div></div>`;
    const W = this._chartWidth(0.5), H = 190, L = 40, R = 6, T = 18, B = 22;
    const maxV = niceMax(Math.max(1, ...months.map((m) => m.v)));
    const bw = (W - L - R) / 12;
    const y = (v) => T + (1 - v / maxV) * (H - T - B);
    const names = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    let svg = "";
    for (const v of ticks(0, maxV)) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, 0)}</text>`;
    const offset = 12 - months.length;
    const thisMonth = new Date().getMonth();
    months.forEach((m, i) => {
      const xi = L + (offset + i) * bw;
      const h = Math.max(1, (m.v / maxV) * (H - T - B));
      const cur = m.start.getMonth() === thisMonth && i === months.length - 1;
      svg += `<rect x="${(xi + 3).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${cur ? COLORS.pv : "#639922"}"><title>${names[m.start.getMonth()]} ${m.start.getFullYear()}: ${fmt(m.v, 1)} kWh</title></rect>`;
      svg += `<text x="${(xi + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${names[m.start.getMonth()]}</text>`;
      if (m.v > 0) svg += `<text x="${(xi + bw / 2).toFixed(1)}" y="${(H - B - h - 4).toFixed(1)}" text-anchor="middle">${fmt(m.v, 0)}</text>`;
    });
    return `<div class="card"><h3><ha-icon icon="mdi:calendar-month"></ha-icon>Produktion der letzten 12 Monate<span class="hint">kWh</span></h3><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
  }

  _stringInfo() {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    return (this._entry.strings || []).map((s, i) => {
      const k = (key) => `${s.id}|${key}`;
      const days = this._stringDays[this._id(k("string_total"))] || [];
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
    const fmtState = (st) => st ? `${fmt(parseFloat(st.state), 1)} ${st.attributes.unit_of_measurement || ""}` : "–";
    const tiles = this._stringInfo().map(({ s, k, color, today, yesterday }) => {
      const volt = this._state(k("string_voltage"));
      const curr = this._state(k("string_current"));
      const row = (label, value, key) => `<span${key ? ` class="click" data-key="${key}"` : ""}>${label}<b>${value}</b></span>`;
      return `<div class="card tile strtile">
        <div class="lbl"><span class="dot" style="background:${color}"></span>${escapeHtml(s.title)}</div>
        <div class="val">${fmt(today, 2)}<small>kWh heute</small></div>
        <div class="rows">
          ${row("Jetzt", fmtW(this._num(k("string_power"))), k("string_power"))}
          ${row("Gestern", yesterday === null ? "–" : `${fmt(yesterday, 2)} kWh`)}
          ${row("Gesamt", `${fmt(this._num(k("string_total")), 1)} kWh`, k("string_total"))}
          ${volt ? row("Spannung", fmtState(volt), k("string_voltage")) : ""}
          ${curr ? row("Strom", fmtState(curr), k("string_current")) : ""}
        </div></div>`;
    }).join("");
    return `<div class="card"><h3><ha-icon icon="mdi:solar-panel"></ha-icon>Ertrag je String</h3><div class="strgrid">${tiles}</div></div>`;
  }

  _renderStringShare() {
    const info = this._stringInfo();
    const totalToday = info.reduce((a, x) => a + (x.today || 0), 0);
    const total30 = info.reduce((a, x) => a + x.sum30, 0);
    const pct = (v, total) => (total > 0 ? (v / total) * 100 : 0);
    const stack = (values, total) => `<div class="stack">${values.map(({ v, color }) => `<div style="width:${pct(v, total).toFixed(2)}%;background:${color}"></div>`).join("")}</div>`;
    const legend = info.map(({ s, color, today, sum30 }) => `<span><span class="dot" style="background:${color}"></span>${escapeHtml(s.title)}<b>${fmt(pct(today || 0, totalToday), 0)} %</b><i>${total30 > 0 ? fmt(pct(sum30, total30), 0) + " %" : "–"}</i></span>`).join("");
    return `<div class="card"><h3><ha-icon icon="mdi:chart-donut"></ha-icon>Anteil am Gesamtertrag</h3>
      <div class="share">
        <div><div class="lbl">Heute · ${fmt(totalToday, 2)} kWh</div>${stack(info.map((x) => ({ v: x.today || 0, color: x.color })), totalToday)}</div>
        <div><div class="lbl">Letzte 30 Tage · ${fmt(total30, 1)} kWh</div>${total30 > 0 ? stack(info.map((x) => ({ v: x.sum30, color: x.color })), total30) : `<div class="muted" style="font-size:12px">Noch keine Statistik</div>`}</div>
        <div class="legend"><span class="muted" style="font-size:12px">String<b style="font-weight:400">heute</b><i>30 Tage</i></span>${legend}</div>
      </div></div>`;
  }

  _renderStringDays() {
    const info = this._stringInfo();
    const title = `<h3><ha-icon icon="mdi:chart-bar"></ha-icon>Produktion je String, letzte 30 Tage</h3>`;
    const dayKeys = [...new Set(info.flatMap((x) => x.days.map((d) => d.start.toDateString())))]
      .map((k) => new Date(k)).sort((a, b) => a - b).slice(-30);
    if (!dayKeys.length) return `<div class="card">${title}<div class="empty">Statistiken werden gesammelt – nach dem ersten vollen Tag erscheinen hier Balken.</div></div>`;
    const W = this._chartWidth(0.58), H = 200, L = 36, R = 6, T = 14, B = 22;
    const values = info.map((x) => Object.fromEntries(x.days.map((d) => [d.start.toDateString(), d.v])));
    const maxV = niceMax(Math.max(0.5, ...values.flatMap((m) => Object.values(m))));
    const gw = (W - L - R) / 30;
    const bw = Math.max(1, (gw - 3) / info.length);
    const y = (v) => T + (1 - v / maxV) * (H - T - B);
    let svg = "";
    for (const v of ticks(0, maxV)) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color, rgba(0,0,0,.1))"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, v < 10 ? 1 : 0)}</text>`;
    const offset = 30 - dayKeys.length;
    dayKeys.forEach((day, i) => {
      const gx = L + (offset + i) * gw + 1.5;
      info.forEach((x, j) => {
        const v = values[j][day.toDateString()] ?? 0;
        const h = Math.max(v > 0 ? 1 : 0, (v / maxV) * (H - T - B));
        svg += `<rect x="${(gx + j * bw).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${Math.max(1, bw - 0.5).toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${x.color}"><title>${escapeHtml(x.s.title)}, ${day.toLocaleDateString(this._locale)}: ${fmt(v, 2)} kWh</title></rect>`;
      });
      const every = W < 450 ? 10 : 5;
      if (i % every === 0 || i === dayKeys.length - 1) svg += `<text x="${(gx + gw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${day.getDate()}.${day.getMonth() + 1}.</text>`;
    });
    const legend = info.map((x) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px"><span class="dot" style="background:${x.color}"></span>${escapeHtml(x.s.title)}</span>`).join("");
    return `<div class="card"><h3><ha-icon icon="mdi:chart-bar"></ha-icon>Produktion je String, letzte 30 Tage<span class="hint">${legend}</span></h3><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
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
const LOCALE = () => currentLocale;

function fmt(v, digits = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return v.toLocaleString(LOCALE(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtW(w) { return `${fmtWValue(w)} ${fmtWUnit(w)}`; }
function fmtWValue(w) { if (w === null || !Number.isFinite(w)) return "–"; return Math.abs(w) >= 10000 ? fmt(w / 1000, 1) : fmt(w, 0); }
function fmtWUnit(w) { return w !== null && Math.abs(w) >= 10000 ? "kW" : "W"; }
function fmtWShort(w) { return Math.abs(w) >= 1000 ? `${fmt(w / 1000, w % 1000 ? 1 : 0)} kW` : `${fmt(w, 0)} W`; }
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

// Zuletzt bekannter Wert einer Reihe zum Zeitpunkt t (Binärsuche), null vor dem ersten Messpunkt
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
