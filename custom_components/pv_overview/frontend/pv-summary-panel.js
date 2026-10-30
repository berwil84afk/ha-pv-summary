// PV Summary – eigenes Dashboard (Panel in der Seitenleiste)
// Ohne Build-Schritt und ohne Fremdbibliotheken: reines Web Component mit SVG-Diagrammen.

const COLORS = { pv: "#f0a30a", bat: "#1d9e75", house: "#5b7290", grid: "#7f77dd" };
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
  .kpi { cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 14px; }
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

  _id(key) { return this._entry?.entities?.[key]; }

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
    for (const id of Object.values(this._entry.entities)) {
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
    const ids = ["power", "battery_power", "house_power"].map((k) => this._id(k)).filter(Boolean);
    const total = this._id("total");
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
    const parts = [
      this._renderHead(),
      `<div class="row half">${this._renderFlow()}${this._renderKpis()}</div>`,
      this._renderCurve(),
      `<div class="row wide-left">${this._renderDays()}${this._renderPeriods()}</div>`,
    ];
    if (this._has("battery_soc") || this._has("battery_power")) parts.push(this._renderBattery());
    parts.push(`<div class="row">${this._renderRecords()}${this._renderMonths()}</div>`);
    this._content.innerHTML = parts.join("");
  }

  _renderHead() {
    const power = this._num("power");
    const active = power !== null && power >= (this._entry.threshold ?? 10);
    const chips = [
      `<span class="chip ${active ? "on" : "off"}"><ha-icon icon="${active ? "mdi:white-balance-sunny" : "mdi:weather-night"}" style="--mdc-icon-size:16px"></ha-icon>${active ? "produziert" : "ruht"}</span>`,
    ];
    const avg30 = this._num("avg_daily_30");
    if (avg30 !== null) chips.push(`<span class="chip click" data-key="avg_daily_30"><ha-icon icon="mdi:chart-line" style="--mdc-icon-size:16px"></ha-icon>Ø ${fmt(avg30, 1)} kWh/Tag</span>`);
    return `<div class="head"><ha-icon icon="mdi:solar-power-variant" style="color:${COLORS.pv};--mdc-icon-size:28px"></ha-icon><span class="name">${escapeHtml(this._entry.title)}</span><div class="chips">${chips.join("")}</div></div>`;
  }

  _renderFlow() {
    const pv = this._num("power") ?? 0;
    const bat = this._has("battery_power") ? this._num("battery_power") ?? 0 : null;
    const house = this._has("house_power") ? this._num("house_power") ?? 0 : null;
    const soc = this._num("battery_soc");

    // Netz = Haus + Akku-Laden − PV (positiv = Bezug, negativ = Einspeisung)
    const grid = house !== null ? house + (bat ?? 0) - pv : null;
    const charge = bat !== null ? Math.max(bat, 0) : 0;
    const discharge = bat !== null ? Math.max(-bat, 0) : 0;
    const pvToBat = Math.min(pv, charge);
    const pvToHouse = house !== null ? Math.min(pv - pvToBat, house) : pv - pvToBat;
    const pvToGrid = grid !== null ? Math.max(-grid, 0) : 0;
    const gridToHouse = grid !== null ? Math.max(grid, 0) : 0;

    const nodes = {
      pv: { x: 60, y: 110, color: COLORS.pv, icon: "mdi:solar-power-variant", label: "PV", value: fmtW(pv), key: "power" },
      house: { x: 380, y: 110, color: COLORS.house, icon: "mdi:home", label: house !== null ? "Haus" : "Haus/Netz", value: house !== null ? fmtW(house) : "≈ " + fmtW(Math.max(pv - pvToBat, 0)), key: house !== null ? "house_power" : null },
      bat: { x: 220, y: 195, color: COLORS.bat, icon: "mdi:home-battery", label: soc !== null ? `${fmt(soc, 0)} %` : "Akku", value: bat !== null ? (bat > 0 ? "+" : bat < 0 ? "−" : "") + fmtW(Math.abs(bat)) : "", key: soc !== null ? "battery_soc" : "battery_power" },
      grid: { x: 220, y: 45, color: COLORS.grid, icon: "mdi:transmission-tower", label: grid === null || Math.abs(grid) <= 1 ? "Netz" : grid < 0 ? "Einspeisung" : "Bezug", value: grid !== null ? fmtW(Math.abs(grid)) : "", key: null },
    };
    const line = (from, to, amount, color) => {
      const a = nodes[from], b = nodes[to];
      const active = amount > 1;
      const cls = active ? `flow ${amount < 100 ? "slow" : ""}` : "idle";
      const stroke = active ? color : "";
      return `<path d="M${a.x} ${a.y} L${b.x} ${b.y}" class="${cls}" stroke="${stroke}" stroke-width="${active ? 3 : 2}" fill="none"/>`;
    };
    const showBat = bat !== null || soc !== null;
    const showGrid = grid !== null;
    let lines = line("pv", "house", pvToHouse, COLORS.pv);
    if (showBat) lines += line("pv", "bat", pvToBat, COLORS.pv) + line("bat", "house", discharge, COLORS.bat);
    if (showGrid) lines += line("pv", "grid", pvToGrid, COLORS.pv) + line("grid", "house", gridToHouse, COLORS.grid);
    const circle = (n, show = true) => !show ? "" : `
      <g class="${n.key ? "click" : ""}" ${n.key ? `data-key="${n.key}"` : ""}>
        <circle cx="${n.x}" cy="${n.y}" r="40" fill="var(--card-background-color, #fff)" stroke="${n.color}" stroke-width="3"/>
        <foreignObject x="${n.x - 12}" y="${n.y - 32}" width="24" height="24"><ha-icon icon="${n.icon}" style="color:${n.color};--mdc-icon-size:22px"></ha-icon></foreignObject>
        <text x="${n.x}" y="${n.y + 8}" text-anchor="middle" class="strong" style="font-size:13px">${n.value || n.label}</text>
        <text x="${n.x}" y="${n.y + 22}" text-anchor="middle" style="font-size:10px">${n.value ? n.label : ""}</text>
      </g>`;
    const share = house ? Math.min(100, ((pvToHouse + discharge) / house) * 100) : null;
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
    const kpi = (key, icon, color, label, value, unit, sub) => `<div class="card kpi" data-key="${key}">
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

  _renderCurve() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const t0 = start.getTime(), t1 = t0 + 24 * 3600 * 1000, now = Date.now();
    const series = [];
    const add = (key, color, fill, label) => {
      const id = this._id(key);
      const pts = id ? (this._history[id] || []).slice() : [];
      const live = this._num(key);
      if (live !== null) pts.push([now, live]);
      if (pts.length) series.push({ pts, color, fill, label });
    };
    add("power", COLORS.pv, true, "PV");
    add("house_power", COLORS.house, false, "Haus");
    add("battery_power", COLORS.bat, false, "Akku");

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
      const pts = s.pts.filter((p) => p[0] >= t0).sort((a, b) => a[0] - b[0]);
      if (!pts.length) continue;
      // Stufenlinie: ein Wert gilt bis zur nächsten Änderung
      let d = `M${x(pts[0][0]).toFixed(1)} ${y(pts[0][1]).toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i][0]).toFixed(1)} V${y(pts[i][1]).toFixed(1)}`;
      if (s.fill) {
        const area = `${d} V${y(0).toFixed(1)} H${x(pts[0][0]).toFixed(1)} Z`;
        paths += `<path d="${area}" fill="${s.color}" fill-opacity="0.25" stroke="none"/>`;
      }
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.fill ? 2 : 1.5}" stroke-linejoin="round"/>`;
    }
    const pv = series.find((s) => s.label === "PV");
    if (pv) {
      const peak = pv.pts.filter((p) => p[0] >= t0).reduce((m, p) => (p[1] > m[1] ? p : m), [0, -Infinity]);
      if (peak[1] > 0) paths += `<circle cx="${x(peak[0])}" cy="${y(peak[1])}" r="4" fill="${COLORS.pv}" stroke="var(--card-background-color,#fff)" stroke-width="2"/><text x="${x(peak[0]) + 8}" y="${y(peak[1]) - 6}" class="strong">${fmtW(peak[1])}</text>`;
    }
    const legend = series.map((s) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px"><span style="width:10px;height:10px;border-radius:2px;background:${s.color}"></span>${s.label}</span>`).join("");
    const body = series.length ? `<svg viewBox="0 0 ${W} ${H}">${grid}${paths}</svg>` : `<div class="empty">Noch keine Verlaufsdaten für heute.</div>`;
    return `<div class="card"><h3><ha-icon icon="mdi:chart-areaspline"></ha-icon>Leistung heute<span class="hint">${legend}</span></h3>${body}</div>`;
  }

  _renderDays() {
    const days = this._days.slice(-30);
    const avg = this._num("avg_daily_30");
    const W = this._chartWidth(0.58), H = 190, L = 36, R = 6, T = 14, B = 22;
    if (!days.length) return `<div class="card"><h3><ha-icon icon="mdi:chart-bar"></ha-icon>Letzte 30 Tage</h3><div class="empty">Statistiken werden gesammelt – nach dem ersten vollen Tag erscheinen hier Balken.</div></div>`;
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
    return `<div class="card"><h3><ha-icon icon="mdi:chart-bar"></ha-icon>Letzte 30 Tage<span class="hint">${avg ? `gestrichelt = Ø ${fmt(avg, 1)} kWh` : ""}</span></h3><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
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
    const soc = this._num("battery_soc");
    const bat = this._num("battery_power");
    const temp = this._state("battery_temperature");
    const volt = this._state("battery_voltage");
    const r = 40, c = 2 * Math.PI * r;
    const color = soc === null ? COLORS.bat : soc < 20 ? "#e24b4a" : soc < 40 ? "#ef9f27" : COLORS.bat;
    const ring = soc === null ? "" : `<svg viewBox="0 0 100 100" style="width:110px" class="click" data-key="battery_soc">
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--secondary-background-color, rgba(0,0,0,.06))" stroke-width="10"/>
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${((soc / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
        <text x="50" y="56" text-anchor="middle" class="strong" style="font-size:18px">${fmt(soc, 0)} %</text></svg>`;
    const status = bat === null ? "" : bat > 1 ? "Akku lädt" : bat < -1 ? "Akku entlädt" : "Akku ruht";
    const fmtState = (st) => st ? `${fmt(parseFloat(st.state), 1)} ${st.attributes.unit_of_measurement || ""}` : null;
    const details = [
      bat !== null ? `<span class="click" data-key="battery_power"><ha-icon icon="mdi:flash" style="--mdc-icon-size:16px"></ha-icon> ${bat > 0 ? "+" : bat < 0 ? "−" : ""}${fmtW(Math.abs(bat))}</span>` : "",
      temp ? `<span class="click muted" data-key="battery_temperature"><ha-icon icon="mdi:thermometer" style="--mdc-icon-size:16px"></ha-icon> ${fmtState(temp)}</span>` : "",
      volt ? `<span class="click muted" data-key="battery_voltage"><ha-icon icon="mdi:sine-wave" style="--mdc-icon-size:16px"></ha-icon> ${fmtState(volt)}</span>` : "",
    ].join("");
    const mini = (key, label) => this._has(key) ? `<div class="card kpi" data-key="${key}"><div class="lbl">${label}</div><div class="val" style="font-size:20px">${fmt(this._num(key), 2)}<small>kWh</small></div></div>` : "";
    return `<div class="card"><h3><ha-icon icon="mdi:home-battery"></ha-icon>Akku</h3>
      <div class="row" style="grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);align-items:center">
        <div class="battery">${ring}<div class="info"><b>${status}</b>${details}</div></div>
        <div class="mini">${mini("battery_charged_today", "Geladen heute")}${mini("battery_discharged_today", "Entladen heute")}${mini("house_today", "Haus heute")}</div>
      </div></div>`;
  }

  _renderRecords() {
    const best = this._state("best_day");
    const rec = this._state("max_power_alltime");
    const item = (key, label, value, sub) => this._has(key) ? `<div class="card kpi" data-key="${key}"><div class="lbl">${label}</div><div class="val" style="font-size:20px">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>` : "";
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
    if (!months.length) return `<div class="card"><h3><ha-icon icon="mdi:calendar-month"></ha-icon>Letzte 12 Monate</h3><div class="empty">Noch keine Monatsdaten.</div></div>`;
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
    return `<div class="card"><h3><ha-icon icon="mdi:calendar-month"></ha-icon>Letzte 12 Monate<span class="hint">kWh</span></h3><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div>`;
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
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
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
