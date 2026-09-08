/* Narco Atlas — application logic. Depends on d3 v7, topojson-client v3, PLAZA_CONFIG and the PLAZA_* data globals. */
(function () {
  'use strict';
  const C = window.PLAZA_CONFIG;
  const YMIN = C.YEAR_MIN, YMAX = C.YEAR_MAX;
  const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtInt = d3.format(',');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const PLACES = { US: 'United States', CR: 'Costa Rica', CO: 'Colombia', CA: 'Canada', HN: 'Honduras', VE: 'Venezuela', GT: 'Guatemala', ES: 'Spain', PY: 'Paraguay', BZ: 'Belize', SV: 'El Salvador', NI: 'Nicaragua', PA: 'Panama', MULTI: 'Nationwide' };
  const placeName = code => C.STATES[code] || PLACES[code] || code;
  const inMexico = e => e.lat > 14 && e.lat < 33.5 && e.lng > -119 && e.lng < -86 && e.state !== 'US';

  // ------------------------------------------------------------------ data
  const ORG = {};
  C.ORG_ORDER.forEach(id => { ORG[id] = Object.assign({ profile: null }, C.ORG_META[id]); });
  (window.PLAZA_ORGS || []).forEach(p => {
    if (!ORG[p.id]) ORG[p.id] = { id: p.id, name: p.name, short: p.name, family: 'independent', color: '#8B8378', colorLight: '#6B655B' };
    ORG[p.id].profile = p;
    if (p.name && !C.ORG_META[p.id]) ORG[p.id].name = p.name;
  });
  const orgOf = id => ORG[id] || ORG.other;
  const knownOrg = id => (ORG[id] ? id : 'other');

  const TERR = {};
  Object.keys(C.STATES).forEach(code => { TERR[code] = { state: code, periods: [], plazas: [], facts: [], sources: [] }; });
  (window.PLAZA_TERRITORY || []).forEach(t => {
    if (!TERR[t.state]) return;
    TERR[t.state] = Object.assign(TERR[t.state], t);
  });
  Object.values(TERR).forEach(t => {
    const ps = (t.periods || []).map(p => Object.assign({}, p, {
      from: clamp(+p.from || YMIN, YMIN, YMAX), to: clamp(+p.to || YMAX, YMIN, YMAX),
      primary: knownOrg(p.primary || 'none'), secondary: (p.secondary || []).map(knownOrg).filter(s => s !== 'other' || true),
      intensity: clamp(+p.intensity || 1, 1, 5), contested: !!p.contested,
    })).filter(p => p.to >= p.from).sort((a, b) => a.from - b.from);
    // fill gaps with 'none'
    const out = []; let cursor = YMIN;
    ps.forEach(p => {
      if (p.from > cursor) out.push({ from: cursor, to: p.from - 1, primary: 'none', secondary: [], contested: false, intensity: 1, note: '' });
      if (p.from < cursor) p.from = cursor;
      if (p.from <= p.to) { out.push(p); cursor = p.to + 1; }
    });
    if (cursor <= YMAX) out.push({ from: cursor, to: YMAX, primary: 'none', secondary: [], contested: false, intensity: 1, note: '' });
    t.periods = out;
    t.plazas = (t.plazas || []).filter(p => isFinite(p.lat) && isFinite(p.lng));
  });
  const periodAt = (code, y) => (TERR[code] && TERR[code].periods.find(p => y >= p.from && y <= p.to)) || { primary: 'none', secondary: [], contested: false, intensity: 1, note: '' };

  const EVENTS = (window.PLAZA_EVENTS || []).map(e => {
    const [y, m, d] = String(e.date || '').split('-').map(Number);
    const yr = clamp(y || YMIN, YMIN, YMAX);
    const t = yr + (((m || 1) - 1) / 12) + (((d || 1) - 1) / 372);
    return Object.assign({}, e, { y: yr, m: m || 1, d: d || 1, t, cartels: (e.cartels || []).map(knownOrg), importance: clamp(+e.importance || 2, 1, 5), type: C.EVENT_TYPES[e.type] ? e.type : 'other' });
  }).filter(e => isFinite(e.lat) && isFinite(e.lng)).sort((a, b) => a.t - b.t);
  const EV_BY_ID = new Map(EVENTS.map(e => [e.id, e]));
  const EV_BY_YEAR = d3.group(EVENTS, e => e.y);

  const FIGS = (window.PLAZA_FIGURES || []).map(f => Object.assign({}, f, { cartels: (f.cartels || []).map(knownOrg) }));
  // Every organization profile lists its leadership with roles, dates and fates. Anyone who has no
  // dedicated biography still becomes a person in the index, built from those leadership records.
  (function deriveFromLeaders() {
    const slug = n => String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
    const byId = new Map(FIGS.map(f => [f.id, f]));
    const derived = new Map();
    Object.values(ORG).forEach(o => {
      if (!o.profile) return;
      (o.profile.leaders || []).forEach(l => {
        if (!l.name || l.name.length < 4) return;
        const id = slug(l.name);
        if (byId.has(id)) return;
        const existing = derived.get(id);
        if (existing) {
          if (!existing.cartels.includes(o.id)) existing.cartels.push(o.id);
          if ((l.fate || '').length > (existing.status_2026 || '').length) existing.status_2026 = l.fate;
          existing.notable.push(`${o.short}: ${l.role}, ${l.from}\u2013${l.to || 'present'}`);
          return;
        }
        derived.set(id, {
          id, name: l.name, alias: (l.alias || '').replace(/^["']|["']$/g, ''), cartels: [o.id],
          born: 0, died: 0, role: l.role || 'Leadership figure', status_2026: l.fate || '',
          bio: `${l.name}${l.alias ? ` ("${l.alias}")` : ''} served as ${(l.role || 'a leader').toLowerCase()} of the ${o.name} from ${l.from} to ${l.to || 'the present'}. ${l.fate || ''}`.trim(),
          notable: [], state: (o.profile.origin && o.profile.origin.state) || '', lat: (o.profile.origin && o.profile.origin.lat) || 0, lng: (o.profile.origin && o.profile.origin.lng) || 0,
          sources: (o.profile.sources || []).slice(0, 2), derived: true,
        });
      });
    });
    derived.forEach(f => FIGS.push(f));
  })();
  const FIG_BY_ID = new Map(FIGS.map(f => [f.id, f]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['"“”‘’]/g, ' ').replace(/\s+/g, ' ').trim();
  const FIG_CACHE = new Map();
  const figByName = name => {
    if (!name) return null;
    if (FIG_CACHE.has(name)) return FIG_CACHE.get(name);
    const n = norm(name);
    let hit = FIGS.find(f => norm(f.name) === n) || null;
    if (!hit) hit = FIGS.find(f => { const parts = norm(f.name).split(' ').filter(p => p.length > 2); const first = parts[0], last = parts[parts.length - 1]; return first && last && n.includes(first) && n.includes(last); }) || null;
    if (!hit) hit = FIGS.find(f => { const a = norm(f.alias); return a.length > 4 && n.includes(a); }) || null;
    FIG_CACHE.set(name, hit);
    return hit;
  };

  const STATS = Object.assign({ homicides: [], presidents: [], us_policy: [], drug_shifts: [], key_numbers: [] }, window.PLAZA_STATS || {});
  const partialYear = d => !!d && (/year-to-date|ytd|through|partial|jan(uary)?[-–]/i.test(d.note || '') || d.year >= 2026);
  const HOM = new Map(STATS.homicides.map(h => [h.year, h]));
  const NARR = Object.assign({ intro: '', epilogue_2026: '', chapters: [] }, window.PLAZA_NARRATIVES || {});
  const CHAP = new Map(NARR.chapters.map(c => [c.key, c]));
  const ERAS = C.ERAS.map((e, i) => Object.assign({ index: i }, e, CHAP.get(e.key) || {}));
  const eraAt = y => ERAS.find(e => y >= e.from && y <= e.to) || ERAS[ERAS.length - 1];

  // control series: number of states where org is primary, per year
  const YEARS = d3.range(YMIN, YMAX + 1);
  const CONTROL = YEARS.map(y => {
    const row = { year: y };
    Object.keys(TERR).forEach(code => { const p = periodAt(code, y); if (p.primary !== 'none' && p.primary !== 'fragmented') row[p.primary] = (row[p.primary] || 0) + 1; });
    return row;
  });
  const PRESENCE = YEARS.map(y => {
    const row = { year: y };
    Object.keys(TERR).forEach(code => { const p = periodAt(code, y); [p.primary].concat(p.secondary).forEach(o => { if (o !== 'none' && o !== 'fragmented') row[o] = (row[o] || 0) + 1; }); });
    return row;
  });
  const STACK_KEYS = (() => {
    const first = {};
    CONTROL.forEach(r => Object.keys(r).forEach(k => { if (k !== 'year' && first[k] == null) first[k] = r.year; }));
    return Object.keys(first).sort((a, b) => first[a] - first[b] || a.localeCompare(b));
  })();

  // ------------------------------------------------------------------ state
  const S = {
    year: YMIN, playing: false, speed: 1, timer: null,
    hover: null, pinned: null, highlightOrg: null, eraEvents: false, zoomK: 1, legendOpen: true,
    figFilter: { q: '', org: '' },
  };
  const themeName = () => getComputedStyle(document.documentElement).getPropertyValue('--theme-name').trim() || 'light';
  const isDark = () => themeName() === 'dark';
  const orgColor = id => { const o = orgOf(id); return isDark() ? o.color : o.colorLight; };

  // ------------------------------------------------------------------ DOM
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <h1>Narco Atlas</h1>
        <span class="sub">Cartel territory in Mexico, 1980–2026 · who held which plaza, when, and what happened there</span>
      </div>
      <div class="spacer"></div>
      <div class="actions">
        <button class="btn" data-act="open" data-modal="search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Search <span class="kbd">⌘K</span></button>
        <button class="btn" data-act="open" data-modal="lineage">Lineage</button>
        <button class="btn" data-act="open" data-modal="figures">Who's who</button>
        <button class="btn ghost" data-act="open" data-modal="about">Sources</button>
        <a class="credit" href="https://github.com/dakshinsiva" target="_blank" rel="noopener" title="Built by Dakshin Siva">by <b>Dakshin Siva</b></a>
        <button class="icon-btn" data-act="theme" title="Toggle light / dark" aria-label="Toggle theme"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.5 0-1-.1-1.4A5.5 5.5 0 0 1 13.4 3.1 9 9 0 0 0 12 3z"/></svg></button>
      </div>
    </header>
    <div class="main">
      <aside class="pane pane-left" id="pane-left"><div class="era" id="era"></div></aside>
      <section class="map-wrap" id="map-wrap">
        <svg class="map" id="map" role="img" aria-label="Map of Mexico colored by dominant criminal organization"></svg>
        <div class="hud" id="hud"></div>
        <div class="legend" id="legend"></div>
        <div class="zoom-ctl">
          <button class="icon-btn" data-act="zoom" data-dir="in" aria-label="Zoom in"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
          <button class="icon-btn" data-act="zoom" data-dir="out" aria-label="Zoom out"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
          <button class="icon-btn" data-act="zoom" data-dir="reset" aria-label="Reset view"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/></svg></button>
        </div>
        <div class="map-foot">
          <button class="toggle" id="tg-era" data-act="toggle-era"><span class="dot"></span>Show every event of this era</button>
        </div>
        <div class="intro" id="intro"></div>
      </section>
      <aside class="pane pane-right" id="pane-right"><div class="insp" id="insp"></div></aside>
    </div>
    <nav class="mob-tabs" id="mob-tabs">
      <button data-act="mob-tab" data-tab="left" class="on">Chapter</button>
      <button data-act="mob-tab" data-tab="right">Inspector</button>
    </nav>
    <footer class="timeline">
      <div class="tl-ctl">
        <div class="row">
          <button class="icon-btn" data-act="step" data-n="-100" aria-label="Go to 1980"><svg viewBox="0 0 24 24"><path d="M6 5v14M18 5 8 12l10 7z"/></svg></button>
          <button class="icon-btn" data-act="step" data-n="-1" aria-label="Previous year"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>
          <button class="icon-btn play" id="play" data-act="play" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M7 5v14l12-7z"/></svg></button>
          <button class="icon-btn" data-act="step" data-n="1" aria-label="Next year"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>
        </div>
        <div class="row">
          <select id="speed" aria-label="Playback speed"><option value="0.5">0.5× · slow</option><option value="1" selected>1× · 1.4 s / yr</option><option value="2">2× · fast</option><option value="4">4× · sprint</option></select>
        </div>
        <div class="hint">← → step year · space play<br>hover the chart for shares</div>
      </div>
      <div class="tl-chart" id="tl"><svg id="tl-svg"></svg></div>
    </footer>
    <div class="tip" id="tip" role="tooltip"></div>
    <div class="modal-back" id="modal-back"><div class="modal" id="modal" role="dialog" aria-modal="true"></div></div>
  `;
  const $ = sel => app.querySelector(sel);
  const tip = document.getElementById('tip');

  // ------------------------------------------------------------------ map
  const topo = window.MX_TOPO;
  const states = topojson.feature(topo, topo.objects.states);
  const borders = topojson.mesh(topo, topo.objects.states, (a, b) => a !== b);
  const coast = topojson.mesh(topo, topo.objects.states, (a, b) => a === b);
  const featByCode = new Map(states.features.map(f => [f.properties.id, f]));
  const mapWrap = $('#map-wrap');
  const svg = d3.select('#map');
  const defs = svg.append('defs');
  const gRoot = svg.append('g').attr('class', 'root');
  gRoot.append('rect').attr('class', 'ground').attr('x', -5000).attr('y', -5000).attr('width', 10000).attr('height', 10000).attr('fill', 'none').attr('pointer-events', 'all');
  const gStates = gRoot.append('g').attr('class', 'states');
  const gHatch = gRoot.append('g').attr('class', 'hatch');
  const gLines = gRoot.append('g');
  const gLabels = gRoot.append('g').attr('class', 'labels');
  const gPlazas = gRoot.append('g').attr('class', 'plazas');
  const gEvents = gRoot.append('g').attr('class', 'events');
  const projection = d3.geoConicConformal().parallels([17.5, 29.5]).rotate([102, 0]);
  const path = d3.geoPath(projection);
  const centroids = new Map();

  function buildPatterns() {
    defs.selectAll('*').remove();
    C.ORG_ORDER.forEach(id => {
      const p = defs.append('pattern').attr('id', 'hatch-' + id).attr('patternUnits', 'userSpaceOnUse').attr('width', 7).attr('height', 7).attr('patternTransform', 'rotate(45)');
      const g = p.append('g');
      g.append('rect').attr('width', 7).attr('height', 2.6).attr('fill', orgColor(id)).attr('opacity', 0.92);
      g.append('rect').attr('y', -7).attr('width', 7).attr('height', 2.6).attr('fill', orgColor(id)).attr('opacity', 0.92);
      if (!RM) g.append('animateTransform').attr('attributeName', 'transform').attr('type', 'translate').attr('from', '0 0').attr('to', '0 7').attr('dur', '2.2s').attr('repeatCount', 'indefinite');
    });
    const glow = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', 2.2).attr('result', 'b');
    const m = glow.append('feMerge'); m.append('feMergeNode').attr('in', 'b'); m.append('feMergeNode').attr('in', 'SourceGraphic');
  }

  const zoom = d3.zoom().scaleExtent([1, 9]).clickDistance(6).on('zoom', ev => {
    gRoot.attr('transform', ev.transform);
    S.zoomK = ev.transform.k;
    mapWrap.classList.toggle('zoomed', S.zoomK > 1.9);
    applyZoomScale();
  }).on('start', () => mapWrap.classList.add('grabbing')).on('end', () => mapWrap.classList.remove('grabbing'));
  svg.call(zoom).on('dblclick.zoom', null);

  function layoutMap() {
    const w = mapWrap.clientWidth, h = mapWrap.clientHeight;
    if (!w || !h) return;
    svg.attr('viewBox', `0 0 ${w} ${h}`);
    projection.fitExtent([[24, 20], [w - 24, h - 44]], states);
    states.features.forEach(f => centroids.set(f.properties.id, path.centroid(f)));
    gStates.selectAll('path.state').data(states.features, d => d.properties.id).join('path').attr('class', 'state').attr('d', path)
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', d => C.STATES[d.properties.id])
      .on('pointerenter', (ev, d) => hoverState(d.properties.id, ev)).on('pointermove', ev => moveTip(ev)).on('pointerleave', () => hoverState(null))
      .on('focus', (ev, d) => { const b = ev.target.getBoundingClientRect(); hoverState(d.properties.id, { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }); })
      .on('blur', () => hoverState(null))
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pin({ kind: 'state', id: d.properties.id }); } })
      .on('click', (ev, d) => { pin({ kind: 'state', id: d.properties.id }); ev.stopPropagation(); });
    gHatch.selectAll('path.hatch').data(states.features, d => d.properties.id).join('path').attr('class', 'hatch').attr('d', path).attr('fill', 'none').attr('opacity', 0);
    gLines.selectAll('path.borders').data([borders]).join('path').attr('class', 'borders').attr('d', path);
    gLines.selectAll('path.coast').data([coast]).join('path').attr('class', 'coast').attr('d', path);
    gLabels.selectAll('text.lbl').data(states.features, d => d.properties.id).join('text')
      .attr('class', d => 'lbl' + (C.SMALL_STATES.has(d.properties.id) ? ' small' : '')).attr('x', d => centroids.get(d.properties.id)[0]).attr('y', d => centroids.get(d.properties.id)[1] + 3).text(d => d.properties.id);
    renderMap(false);
    renderEventMarkers();
    renderPlazas();
  }

  function renderMap(animate) {
    const dur = animate && !RM ? 650 : 0;
    const paths = gStates.selectAll('path.state');
    paths.each(function (d) { d.p = periodAt(d.properties.id, S.year); });
    paths.transition().duration(dur)
      .attr('fill', d => d.p.primary === 'none' ? 'var(--state-none)' : orgColor(d.p.primary))
      .attr('fill-opacity', d => d.p.primary === 'none' ? 1 : d.p.primary === 'fragmented' ? 0.7 : 0.5 + 0.125 * (d.p.intensity - 1));
    gHatch.selectAll('path.hatch').each(function (d) { d.p = periodAt(d.properties.id, S.year); })
      .attr('fill', d => (d.p.contested && d.p.secondary.length) ? `url(#hatch-${d.p.secondary[0]})` : (d.p.primary === 'fragmented' ? 'url(#hatch-other)' : 'none'))
      .transition().duration(dur).attr('opacity', d => (d.p.contested && d.p.secondary.length) || d.p.primary === 'fragmented' ? 1 : 0);
    applyHighlight();
  }

  function applyHighlight() {
    const org = S.highlightOrg;
    const hov = S.hover;
    const kinOf = code => { const p = periodAt(code, S.year); return [p.primary].concat(p.secondary); };
    const target = org || (hov ? periodAt(hov, S.year).primary : null);
    gStates.selectAll('path.state')
      .classed('dim', d => !!target && target !== 'none' && !kinOf(d.properties.id).includes(target))
      .classed('kin', d => !!target && target !== 'none' && kinOf(d.properties.id).includes(target) && d.properties.id !== hov)
      .classed('hover', d => d.properties.id === hov)
      .classed('pinned', d => S.pinned && S.pinned.kind === 'state' && S.pinned.id === d.properties.id);
    gHatch.selectAll('path.hatch').classed('dim', d => !!target && target !== 'none' && !kinOf(d.properties.id).includes(target));
    // raise hovered and pinned
    gStates.selectAll('path.state').filter(d => d.properties.id === hov || (S.pinned && S.pinned.kind === 'state' && S.pinned.id === d.properties.id)).raise();
  }

  function visibleEvents() {
    if (S.eraEvents) { const e = eraAt(S.year); return EVENTS.filter(x => x.y >= e.from && x.y <= e.to); }
    return EV_BY_YEAR.get(S.year) || [];
  }
  function renderEventMarkers() {
    const evs = visibleEvents().filter(inMexico);
    // spread markers that share a location around a small ring so none is hidden
    const buckets = new Map();
    evs.forEach(e => { const p = projection([e.lng, e.lat]); const key = Math.round(p[0] / 6) + ':' + Math.round(p[1] / 6); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(e); e._px = p; });
    buckets.forEach(list => { if (list.length < 2) { list[0]._off = [0, 0]; return; } const r = 7; list.forEach((e, i) => { const a = (i / list.length) * Math.PI * 2 - Math.PI / 2; e._off = [Math.cos(a) * r, Math.sin(a) * r]; }); });
    const sel = gEvents.selectAll('g.ev').data(evs, d => d.id);
    sel.exit().transition().duration(RM ? 0 : 250).attr('opacity', 0).remove();
    const enter = sel.enter().append('g').attr('class', 'ev').attr('opacity', 0)
      .on('pointerenter', (ev, d) => showEventTip(d, ev)).on('pointermove', ev => moveTip(ev)).on('pointerleave', hideTip)
      .on('click', (ev, d) => { pin({ kind: 'event', id: d.id }); ev.stopPropagation(); });
    enter.append('circle').attr('class', 'pulse');
    enter.append('circle').attr('class', 'dot');
    enter.transition().duration(RM ? 0 : 350).attr('opacity', 1);
    gEvents.selectAll('g.ev')
      .attr('transform', d => `translate(${d._px[0] + d._off[0] / Math.sqrt(S.zoomK)},${d._px[1] + d._off[1] / Math.sqrt(S.zoomK)})`)
      .classed('major', d => d.importance >= 4)
      .classed('faded', d => S.eraEvents && d.y !== S.year)
      .classed('pinned', d => S.pinned && S.pinned.kind === 'event' && S.pinned.id === d.id);
    applyZoomScale();
  }
  function applyZoomScale() {
    const k = S.zoomK;
    gEvents.selectAll('g.ev').each(function (d) {
      const r = (2.6 + d.importance * 1.15) / Math.sqrt(k);
      d3.select(this).select('circle.dot').attr('r', r);
      d3.select(this).select('circle.pulse').attr('r', r * 1.15);
    });
    gEvents.selectAll('g.ev').attr('transform', d => d._px ? `translate(${d._px[0] + d._off[0] / Math.sqrt(k)},${d._px[1] + d._off[1] / Math.sqrt(k)})` : null);
    gLabels.selectAll('text.lbl').attr('font-size', 9.5 / Math.sqrt(k));
    gPlazas.selectAll('g.plaza').attr('transform', k2 => `translate(${k2.x},${k2.y}) scale(${1 / k})`);
    defs.selectAll('pattern').attr('patternTransform', `rotate(45) scale(${1 / Math.sqrt(k)})`);
  }
  function renderPlazas() {
    const code = (S.pinned && S.pinned.kind === 'state') ? S.pinned.id : S.hover;
    const plazas = code ? (TERR[code].plazas || []) : [];
    // Lay labels out so they never sit on top of each other: put each on the side of its marker that
    // points away from the state's centre, then push apart any that still share a line.
    const c = code ? centroids.get(code) : null;
    const placed = plazas.map(d => { const p = projection([d.lng, d.lat]); return { d, x: p[0], y: p[1], side: c && p[0] < c[0] ? -1 : 1, dy: 3 }; });
    placed.sort((a, b) => a.y - b.y);
    const GAP = 13; // one line of the 9px label face, plus breathing room
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (let i = 1; i < placed.length; i++) {
        const b = placed[i];
        for (let j = 0; j < i; j++) {
          const a = placed[j];
          if (a.side !== b.side) continue;
          const gap = (b.y + b.dy) - (a.y + a.dy);
          if (gap >= 0 && gap < GAP) { b.dy += GAP - gap; moved = true; }
        }
      }
      if (!moved) break;
    }
    const sel = gPlazas.selectAll('g.plaza').data(placed, k => k.d.city);
    sel.exit().remove();
    const g = sel.enter().append('g').attr('class', 'plaza');
    g.append('line').attr('class', 'lead');
    g.append('rect').attr('x', -3).attr('y', -3).attr('width', 6).attr('height', 6);
    g.append('text');
    const all = gPlazas.selectAll('g.plaza');
    all.select('line.lead').attr('x1', 0).attr('y1', 0).attr('x2', k => k.side * 6).attr('y2', k => k.dy - 3);
    all.select('text').attr('x', k => k.side * 8).attr('y', k => k.dy).attr('text-anchor', k => k.side < 0 ? 'end' : 'start').text(k => k.d.city);
    applyZoomScale();
  }

  // ------------------------------------------------------------------ hover / tips
  function hoverState(code, ev) {
    S.hover = code;
    applyHighlight();
    renderPlazas();
    if (!code) { hideTip(); return; }
    const p = periodAt(code, S.year);
    const evs = (EV_BY_YEAR.get(S.year) || []).filter(e => e.state === code);
    const prim = orgOf(p.primary);
    const rows = [];
    rows.push(`<div class="tip-row"><i class="sw" style="background:${orgColor(p.primary)}"></i><span><b>${esc(prim.name)}</b></span><span class="role">${p.primary === 'none' ? 'no dominant org' : p.primary === 'fragmented' ? 'fragmented' : 'dominant'}</span></div>`);
    p.secondary.slice(0, 3).forEach((s, i) => {
      rows.push(`<div class="tip-row"><i class="sw${p.contested && i === 0 ? ' hatch' : ''}" style="--stripe:${orgColor(s)};background-color:${p.contested && i === 0 ? 'transparent' : orgColor(s)}"></i><span>${esc(orgOf(s).name)}</span><span class="role">${p.contested && i === 0 ? 'contesting' : 'present'}</span></div>`);
    });
    tip.className = 'tip show';
    tip.innerHTML = `
      <div class="tip-h"><span class="code">${code}</span><strong>${esc(C.STATES[code])}</strong></div>
      ${rows.join('')}
      <div class="tip-row"><span class="muted">Violence</span>${meter(p.intensity)}<span class="role">${p.contested ? 'contested' : 'held'} · ${p.from}–${p.to}</span></div>
      ${sparkline(TERR[code], 268, 34)}
      ${p.note ? `<div class="note">${esc(truncate(p.note, 190))}</div>` : ''}
      <div class="foot"><span>${evs.length ? `${evs.length} event${evs.length > 1 ? 's' : ''} here in ${S.year}` : `no recorded event in ${S.year}`}</span><span>click to pin</span></div>`;
    moveTip(ev);
  }
  function showEventTip(e, ev) {
    tip.className = 'tip show compact';
    tip.innerHTML = `<div class="ev-date">${fmtDate(e)} · ${esc(e.city)}</div><div class="ev-title">${esc(e.title)}</div><div class="tip-row" style="margin-top:4px">${e.cartels.slice(0, 3).map(c => `<i class="sw" style="background:${orgColor(c)}"></i><span class="muted">${esc(orgOf(c).short)}</span>`).join('')}</div>`;
    moveTip(ev);
  }
  function showTextTip(html, ev) { tip.className = 'tip show compact'; tip.innerHTML = html; moveTip(ev); }
  function moveTip(ev) {
    if (!ev) return;
    const pad = 16, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.className = 'tip'; }
  const meter = n => `<span class="meter">${d3.range(1, 6).map(i => `<i class="${i <= n ? 'on' : ''}${i <= n && n >= 4 ? ' hot' : ''}"></i>`).join('')}</span>`;
  const importanceBars = n => `<span class="imp" title="importance ${n}/5">${d3.range(1, 6).map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const truncate = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  function fmtDate(e) { return e.precision === 'year' ? String(e.y) : e.precision === 'month' ? `${MONTHS[e.m - 1]} ${e.y}` : `${e.d} ${MONTHS[e.m - 1]} ${e.y}`; }

  function sparkline(t, w, h) {
    // intensity by year, colored by primary org
    const x = d3.scaleLinear([YMIN, YMAX + 1], [0, w]);
    const y = d3.scaleLinear([0, 5], [h - 2, 2]);
    const segs = t.periods.map(p => `<rect x="${x(p.from).toFixed(1)}" y="${y(p.intensity).toFixed(1)}" width="${Math.max(0.8, x(p.to + 1) - x(p.from) - 0.6).toFixed(1)}" height="${(y(0) - y(p.intensity)).toFixed(1)}" fill="${p.primary === 'none' ? 'var(--hair-2)' : orgColor(p.primary)}" opacity="${p.primary === 'none' ? 0.7 : 0.9}"></rect>`).join('');
    const cx = x(S.year + 0.5);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${segs}<line x1="${cx}" x2="${cx}" y1="0" y2="${h}" stroke="var(--accent)" stroke-width="1.5"></line></svg>`;
  }
  function orgSpark(id, w, h) {
    const x = d3.scaleLinear([YMIN, YMAX + 1], [0, w]);
    const max = Math.max(4, d3.max(PRESENCE, r => r[id] || 0));
    const y = d3.scaleLinear([0, max], [h - 12, 4]);
    const area = d3.area().x(r => x(r.year)).y0(y(0)).y1(r => y(r[id] || 0)).curve(d3.curveStepAfter);
    const line = d3.line().x(r => x(r.year)).y(r => y(r[id] || 0)).curve(d3.curveStepAfter);
    const cx = x(S.year + 0.5);
    const now = (PRESENCE[S.year - YMIN] || {})[id] || 0;
    return `<svg class="spark-lg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="states with presence per year">
      <path d="${area(PRESENCE)}" fill="${orgColor(id)}" opacity="0.25"></path><path d="${line(PRESENCE)}" fill="none" stroke="${orgColor(id)}" stroke-width="1.6"></path>
      <line x1="${cx}" x2="${cx}" y1="0" y2="${h - 12}" stroke="var(--accent)" stroke-width="1.2"></line>
      <text x="${Math.min(w - 4, cx + 4)}" y="${h - 1}" font-family="var(--f-mono)" font-size="9" fill="var(--muted)" text-anchor="${cx > w - 60 ? 'end' : 'start'}">${S.year}: present in ${now} state${now === 1 ? '' : 's'} · max ${max}</text></svg>`;
  }

  // ------------------------------------------------------------------ HUD, legend, era, intro
  function renderHUD() {
    const e = eraAt(S.year);
    const evs = EV_BY_YEAR.get(S.year) || [];
    const contested = Object.keys(TERR).filter(c => periodAt(c, S.year).contested).length;
    const h = HOM.get(S.year);
    const abroad = evs.filter(x => !inMexico(x));
    $('#hud').innerHTML = `<div class="year">${S.year}</div><div class="year-era">${esc(e.title)} · ${e.from}–${e.to}</div>
      <div class="year-stats"><span><b>${evs.length}</b> events</span><span><b>${contested}</b> contested states</span>${h ? `<span><b>${fmtInt(h.count)}</b> homicides${partialYear(h) ? ' so far' : ''}</span>` : ''}</div>
      ${abroad.length ? `<div class="abroad"><span class="eyebrow">Beyond the map</span>${abroad.slice(0, 4).map(x => `<button class="abroad-item" data-act="pin-event" data-id="${x.id}"><span class="d">${esc(placeName(x.state) === 'Nationwide' ? 'Nationwide' : x.city)}</span><span class="t">${esc(truncate(x.title, 54))}</span></button>`).join('')}${abroad.length > 4 ? `<span class="muted" style="font-size:11px">+${abroad.length - 4} more in the inspector</span>` : ''}</div>` : ''}`;
  }
  function renderLegend() {
    const row = CONTROL[S.year - YMIN];
    const pres = PRESENCE[S.year - YMIN];
    const ids = Object.keys(pres).filter(k => k !== 'year').sort((a, b) => (row[b] || 0) - (row[a] || 0) || (pres[b] || 0) - (pres[a] || 0));
    $('#legend').innerHTML = `<button class="legend-head" data-act="legend-toggle" aria-expanded="${S.legendOpen ? 'true' : 'false'}"><span class="eyebrow">Who holds what · ${S.year}</span><span class="eyebrow n">${ids.length}</span><span class="chev" aria-hidden="true"></span></button>
      <div class="legend-list">${ids.map(id => `<button data-act="hl-org" data-id="${id}" class="${S.highlightOrg === id ? 'on' : ''}"><i class="sw" style="background:${orgColor(id)}"></i><span>${esc(orgOf(id).short)}</span><span class="n">${row[id] || 0}<span class="muted">/${pres[id]}</span></span><span class="bar"><i style="width:${(row[id] || 0) / 32 * 100}%;background:${orgColor(id)}"></i></span></button>`).join('')}</div>
      <div class="legend-key"><span class="hatch-demo"></span><span>striped: actively contested by the striped group</span><span class="int-demo"><i style="opacity:.3"></i><i style="opacity:.55"></i><i style="opacity:.8"></i><i></i></span><span>brighter fill: more violent (1–5)</span></div>`;
    $('#legend').classList.toggle('open', S.legendOpen);
  }
  function renderEra() {
    const e = eraAt(S.year);
    const body = (e.narrative || 'Narrative for this chapter is being compiled.').split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join('');
    $('#era').innerHTML = `
      <div class="era-nav" role="tablist" aria-label="Chapters">${ERAS.map(x => `<button role="tab" data-act="set-year" data-year="${x.from}" class="${x.key === e.key ? 'on' : ''}" title="${esc(x.title)} (${x.from}–${x.to})"><span>${String(x.from).slice(2)}</span></button>`).join('')}</div>
      <div class="era-head">
        <div class="eyebrow">Chapter ${e.index + 1} of ${ERAS.length} · ${e.from}–${e.to}</div>
        <h2 class="era-title">${esc(e.title)}</h2>
        ${e.subtitle ? `<div class="era-sub">${esc(e.subtitle)}</div>` : ''}
      </div>
      <div class="era-body">${body}</div>
      ${e.shifts && e.shifts.length ? `<div><div class="eyebrow" style="margin-bottom:8px">What changed</div><ul class="shifts">${e.shifts.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      ${e.dominant_orgs && e.dominant_orgs.length ? `<div><div class="eyebrow" style="margin-bottom:8px">Defining organizations</div><div class="chips">${e.dominant_orgs.filter(o => ORG[o]).map(o => `<button class="chip" data-act="pin-org" data-id="${o}" data-hl="${o}"><i class="sw" style="background:${orgColor(o)}"></i>${esc(orgOf(o).short)}</button>`).join('')}</div></div>` : ''}
      ${e.focus_states && e.focus_states.length ? `<div><div class="eyebrow" style="margin-bottom:8px">Where the action was</div><div class="chips">${e.focus_states.filter(s => C.STATES[s]).map(s => `<button class="chip state" data-act="pin-state" data-id="${s}" data-hover-state="${s}"><i class="sw" style="background:${orgColor(periodAt(s, S.year).primary)}"></i>${esc(C.STATES[s])}</button>`).join('')}</div></div>` : ''}
      <div class="nav-row">${e.index > 0 ? `<button class="btn" data-act="set-year" data-year="${ERAS[e.index - 1].from}">← ${esc(ERAS[e.index - 1].title)}</button>` : ''}${e.index < ERAS.length - 1 ? `<button class="btn" data-act="set-year" data-year="${ERAS[e.index + 1].from}">${esc(ERAS[e.index + 1].title)} →</button>` : ''}</div>`;
  }
  function renderIntro() {
    let seen = false; try { seen = localStorage.getItem('narco-atlas-intro') === '1'; } catch (e) { /* storage unavailable */ }
    const el = $('#intro');
    if (seen) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="eyebrow">How to read this atlas</div>
      <p>${esc(NARR.intro || 'Each state is colored by the organization that dominated its criminal economy that year. Stripes mean the plaza was actively contested. Brighter fills mean more violence. Glowing markers are the year\'s events: hover anything for detail, click to pin it.')}</p>
      <div class="row"><button class="btn primary" data-act="play-intro">▶ Play the 46 years</button><button class="btn ghost" data-act="dismiss-intro">Explore on my own</button></div>`;
  }

  // ------------------------------------------------------------------ inspector
  function pin(sel) {
    S.pinned = sel;
    if (sel && sel.kind === 'event') { const e = EV_BY_ID.get(sel.id); if (e && e.y !== S.year) { setYear(e.y, true, true); } }
    renderInspector(); applyHighlight(); renderPlazas(); renderEventMarkers(); updateHash();
    if (window.innerWidth <= 920) showMobTab('right');
  }
  function renderInspector() {
    const p = S.pinned;
    let head = 'This year', html = '';
    if (!p) html = viewYear();
    else if (p.kind === 'state') { head = 'State'; html = viewState(p.id); }
    else if (p.kind === 'org') { head = 'Organization'; html = viewOrg(p.id); }
    else if (p.kind === 'event') { head = 'Event'; html = viewEvent(p.id); }
    else if (p.kind === 'figure') { head = 'Figure'; html = viewFigure(p.id); }
    $('#insp').innerHTML = `<div class="insp-head"><span class="eyebrow">${head}</span>${p ? `<button class="btn ghost" data-act="unpin">Close ✕</button>` : `<span class="muted" style="font-size:12px">click a state, marker or name to pin</span>`}</div><div class="insp-body">${html}</div>`;
    const sc = $('#pane-right'); if (sc) sc.scrollTop = 0;
  }
  const orgChip = id => `<button class="chip" data-act="pin-org" data-id="${id}" data-hl="${id}"><i class="sw" style="background:${orgColor(id)}"></i>${esc(orgOf(id).short)}</button>`;
  const stateChip = code => `<button class="chip state" data-act="pin-state" data-id="${code}" data-hover-state="${code}"><i class="sw" style="background:${orgColor(periodAt(code, S.year).primary)}"></i>${esc(C.STATES[code] || code)}</button>`;
  const figLink = name => { const f = figByName(name); return f ? `<button class="link" data-act="pin-figure" data-id="${f.id}">${esc(name)}</button>` : esc(name); };
  function eventItem(e, opts) {
    const on = S.pinned && S.pinned.kind === 'event' && S.pinned.id === e.id;
    return `<button class="ev-item ${on ? 'on' : ''}" data-act="pin-event" data-id="${e.id}"><span class="d">${fmtDate(e)}</span><span><div class="t">${esc(e.title)}</div><div class="m">${importanceBars(e.importance)}<span>${esc(e.city)}${opts && opts.state ? '' : `, ${esc(placeName(e.state))}`}</span></div></span></button>`;
  }
  function viewYear() {
    const evs = EV_BY_YEAR.get(S.year) || [];
    const row = CONTROL[S.year - YMIN];
    const ids = Object.keys(row).filter(k => k !== 'year').sort((a, b) => row[b] - row[a]).slice(0, 8);
    const h = HOM.get(S.year), hp = HOM.get(S.year - 1);
    const delta = h && hp ? (h.count - hp.count) / hp.count : null;
    const pres = STATS.presidents.find(x => S.year >= +x.from.slice(0, 4) && S.year <= +x.to.slice(0, 4) && !(S.year === +x.from.slice(0, 4) && +x.from.slice(5, 7) > 6)) || STATS.presidents.find(x => S.year >= +x.from.slice(0, 4) && S.year <= +x.to.slice(0, 4));
    const e = eraAt(S.year);
    return `
      <h2>${S.year}</h2>
      <div class="stat-row">
        <div class="stat"><div class="v">${h ? fmtInt(h.count) : '—'}${delta != null && !partialYear(h) ? `<span class="delta ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%</span>` : ''}</div><div class="l">${h ? (partialYear(h) ? `homicides so far · ${esc(truncate(h.note || 'partial year', 60))}` : `homicides${h.rate ? ` · ${h.rate.toFixed ? h.rate.toFixed(1) : h.rate} per 100k` : ''}`) : 'no homicide figure'}</div></div>
        <div class="stat"><div class="v">${Object.keys(TERR).filter(c => periodAt(c, S.year).contested).length}<span class="muted" style="font-size:14px">/32</span></div><div class="l">states actively contested</div></div>
      </div>
      ${pres ? `<div class="ctrl-row"><span class="who">${esc(pres.name)}</span><span class="role">${esc(pres.party)} · ${pres.from.slice(0, 4)}–${pres.to.slice(0, 4)}</span></div>` : ''}
      <div><h3>Dominant organizations, by states held</h3><div class="rank">${ids.map(id => `<button data-act="pin-org" data-id="${id}" data-hl="${id}"><i class="sw" style="background:${orgColor(id)}"></i><span>${esc(orgOf(id).name)}</span><span class="n">${row[id]}</span><span class="bar"><i style="width:${row[id] / 32 * 100}%;background:${orgColor(id)}"></i></span></button>`).join('') || '<div class="empty">No organization held a state outright.</div>'}</div></div>
      <div><h3>${evs.length} event${evs.length === 1 ? '' : 's'} in ${S.year}</h3><div class="ev-list">${evs.map(x => eventItem(x)).join('') || '<div class="empty">No events recorded for this year.</div>'}</div></div>
      <div><h3>Chapter</h3><div class="prose"><p>${esc(truncate(e.narrative || '', 320))}</p></div></div>`;
  }
  function viewState(code) {
    const t = TERR[code]; const p = periodAt(code, S.year); const e = eraAt(S.year);
    const evsHere = EVENTS.filter(x => x.state === code);
    const evsEra = evsHere.filter(x => x.y >= e.from && x.y <= e.to);
    const figsHere = FIGS.filter(f => f.state === code).slice(0, 8);
    return `
      <div class="eyebrow">${code} · ${S.year}</div>
      <h2>${esc(C.STATES[code])}</h2>
      <div class="ctrl-row"><i class="sw" style="background:${orgColor(p.primary)}"></i><span class="who">${p.primary === 'none' || p.primary === 'fragmented' ? esc(orgOf(p.primary).name) : `<button class="link" data-act="pin-org" data-id="${p.primary}">${esc(orgOf(p.primary).name)}</button>`}</span><span class="role">${p.primary === 'none' ? '' : p.contested ? 'contested' : 'dominant'}</span></div>
      ${p.secondary.map((s, i) => `<div class="ctrl-row"><i class="sw ${p.contested && i === 0 ? 'hatch' : ''}" style="--stripe:${orgColor(s)};background-color:${p.contested && i === 0 ? 'transparent' : orgColor(s)}"></i><span class="who"><button class="link" data-act="pin-org" data-id="${s}">${esc(orgOf(s).name)}</button></span><span class="role">${p.contested && i === 0 ? 'challenger' : 'present'}</span></div>`).join('')}
      <div class="kv"><dt>Violence</dt><dd>${meter(p.intensity)} <span class="muted">${['', 'calm', 'moderate', 'elevated', 'high', 'extreme'][p.intensity]}</span></dd><dt>Period</dt><dd class="mono">${p.from}–${p.to}</dd></div>
      ${p.note ? `<div class="lede">${esc(p.note)}</div>` : ''}
      <div><h3>Control, 1980–2026</h3>${sparkline(t, 300, 40)}<div class="period-list">${t.periods.map(x => `<button class="period ${x === p ? 'on' : ''}" data-act="set-year" data-year="${x.from}"><span class="yrs">${x.from}–${x.to}</span><i class="sw" style="background:${orgColor(x.primary)}"></i><span><span class="who">${esc(orgOf(x.primary).short)}${x.secondary.length ? ` <span class="vs">${x.contested ? 'vs' : '·'} ${x.secondary.map(s => esc(orgOf(s).short)).join(', ')}</span>` : ''}</span>${x.note ? `<div class="note">${esc(truncate(x.note, 150))}</div>` : ''}</span></button>`).join('')}</div></div>
      ${t.plazas.length ? `<div><h3>Key plazas</h3><div class="period-list">${t.plazas.map(pl => { const c = (pl.controllers || []).find(k => S.year >= k.from && S.year <= k.to); return `<div class="period"><span class="yrs">${esc(pl.city)}</span><i class="sw" style="background:${c ? orgColor(knownOrg(c.cartel)) : 'var(--hair-2)'}"></i><span><span class="who">${c ? esc(orgOf(knownOrg(c.cartel)).short) : '—'}</span><div class="note">${esc(pl.why || '')}</div></span></div>`; }).join('')}</div></div>` : ''}
      <div><h3>Events here · ${e.from}–${e.to}</h3><div class="ev-list">${evsEra.map(x => eventItem(x, { state: true })).join('') || '<div class="empty">No recorded events in this state during this chapter.</div>'}</div>${evsHere.length > evsEra.length ? `<details class="fold" style="margin-top:8px"><summary>All ${evsHere.length} events in ${esc(C.STATES[code])}</summary><div class="ev-list">${evsHere.filter(x => !evsEra.includes(x)).map(x => eventItem(x, { state: true })).join('')}</div></details>` : ''}</div>
      ${t.facts && t.facts.length ? `<div><h3>Facts</h3><ul class="facts">${t.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
      ${figsHere.length ? `<div><h3>Figures based here</h3><div class="chips">${figsHere.map(f => `<button class="chip" data-act="pin-figure" data-id="${f.id}">${esc(f.name)}</button>`).join('')}</div></div>` : ''}
      ${t.sources && t.sources.length ? `<details class="fold"><summary>Sources</summary><ul class="sources">${t.sources.map(s => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></li>`).join('')}</ul></details>` : ''}`;
  }
  function viewOrg(id) {
    const o = orgOf(id); const pr = o.profile;
    const heldNow = Object.keys(TERR).filter(c => periodAt(c, S.year).primary === id);
    const presentNow = Object.keys(TERR).filter(c => { const p = periodAt(c, S.year); return p.primary !== id && p.secondary.includes(id); });
    const evs = EVENTS.filter(e => e.cartels.includes(id));
    const evsNear = evs.filter(e => Math.abs(e.y - S.year) <= 2);
    const figs = FIGS.filter(f => f.cartels.includes(id));
    const children = Object.values(ORG).filter(x => x.profile && x.profile.parent === id);
    const fmtYr = y => y ? y : 'active';
    return `
      <div class="eyebrow">${pr ? `${pr.founded}–${pr.dissolved ? pr.dissolved : 'present'}` : 'organization'}${pr && pr.origin ? ` · ${esc(pr.origin.city)}, ${esc(C.STATES[pr.origin.state] || pr.origin.state)}` : ''}</div>
      <h2><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${orgColor(id)};vertical-align:baseline;margin-right:8px"></span>${esc(o.name)}</h2>
      ${pr && pr.aka && pr.aka.length ? `<div class="muted" style="font-family:var(--f-serif);font-style:italic">${esc(pr.aka.join(' · '))}</div>` : ''}
      ${pr ? `<div class="lede">${esc(pr.summary)}</div>` : '<div class="empty">No profile compiled for this group; it appears in the territorial record.</div>'}
      <div><h3>Footprint over time</h3>${orgSpark(id, 300, 60)}</div>
      <div class="stat-row"><div class="stat"><div class="v">${heldNow.length}</div><div class="l">states dominated in ${S.year}</div></div><div class="stat"><div class="v">${presentNow.length}</div><div class="l">more with presence</div></div></div>
      ${heldNow.length || presentNow.length ? `<div class="chips">${heldNow.map(stateChip).join('')}${presentNow.map(c => stateChip(c)).join('')}</div>` : ''}
      ${pr && pr.status_2026 ? `<div><h3>Status, September 2026</h3><div class="prose"><p>${esc(pr.status_2026)}</p></div></div>` : ''}
      ${pr && pr.leaders && pr.leaders.length ? `<div><h3>Leadership</h3><div class="leaders">${pr.leaders.map(l => `<div class="leader"><span class="nm">${figLink(l.name)}${l.alias ? ` <span class="al">“${esc(l.alias)}”</span>` : ''}</span><span class="yrs">${l.from}–${fmtYr(l.to)}</span><span class="fate">${esc(l.role)}${l.fate ? ` — ${esc(l.fate)}` : ''}</span></div>`).join('')}</div></div>` : ''}
      ${pr && pr.factions && pr.factions.length ? `<div><h3>Factions & cells</h3><div class="period-list">${pr.factions.map(f => `<div class="period"><span class="yrs">${f.from}–${f.to || 'now'}</span><i class="sw" style="background:${ORG[f.id] ? orgColor(f.id) : orgColor(id)};opacity:.7"></i><span><span class="who">${ORG[f.id] ? `<button class="link" data-act="pin-org" data-id="${f.id}">${esc(f.name)}</button>` : esc(f.name)}</span> <span class="vs">${esc(f.area)}${f.leader ? ` · ${esc(f.leader)}` : ''}</span>${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}</span></div>`).join('')}</div></div>` : ''}
      ${(pr && ((pr.allies && pr.allies.length) || (pr.rivals && pr.rivals.length) || pr.parent)) || children.length ? `<div><h3>Relations</h3><div class="period-list">
        ${pr && pr.parent && ORG[pr.parent] ? `<div class="period"><span class="yrs">origin</span><i class="sw" style="background:${orgColor(pr.parent)}"></i><span><span class="who">Split from <button class="link" data-act="pin-org" data-id="${pr.parent}">${esc(orgOf(pr.parent).short)}</button></span></span></div>` : ''}
        ${children.map(c => `<div class="period"><span class="yrs">${c.profile.founded}</span><i class="sw" style="background:${orgColor(c.id)}"></i><span><span class="who"><button class="link" data-act="pin-org" data-id="${c.id}">${esc(c.short)}</button> <span class="vs">split away</span></span></span></div>`).join('')}
        ${pr ? (pr.allies || []).filter(a => ORG[a.cartel]).map(a => `<div class="period"><span class="yrs">${a.from}–${a.to || 'now'}</span><i class="sw" style="background:${orgColor(a.cartel)}"></i><span><span class="who">Ally · <button class="link" data-act="pin-org" data-id="${a.cartel}">${esc(orgOf(a.cartel).short)}</button></span>${a.note ? `<div class="note">${esc(a.note)}</div>` : ''}</span></div>`).join('') : ''}
        ${pr ? (pr.rivals || []).filter(a => ORG[a.cartel]).map(a => `<div class="period"><span class="yrs">${a.from}–${a.to || 'now'}</span><i class="sw hatch" style="--stripe:${orgColor(a.cartel)};background-color:transparent"></i><span><span class="who">Rival · <button class="link" data-act="pin-org" data-id="${a.cartel}">${esc(orgOf(a.cartel).short)}</button></span>${a.note ? `<div class="note">${esc(a.note)}</div>` : ''}</span></div>`).join('') : ''}
      </div></div>` : ''}
      ${pr && pr.history ? `<details class="fold" open><summary>Full history</summary><div class="prose">${pr.history.split(/\n\s*\n/).map(x => `<p>${esc(x)}</p>`).join('')}</div></details>` : ''}
      ${pr && pr.facts && pr.facts.length ? `<div><h3>Facts</h3><ul class="facts">${pr.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
      ${pr && pr.activities && pr.activities.length ? `<div><h3>Business</h3><div class="chips">${pr.activities.map(a => `<span class="badge">${esc(a)}</span>`).join('')}</div></div>` : ''}
      <div><h3>Events · ${evs.length} total${evsNear.length ? `, ${evsNear.length} near ${S.year}` : ''}</h3><div class="ev-list">${(evsNear.length ? evsNear : evs.slice(0, 8)).map(x => eventItem(x)).join('') || '<div class="empty">No linked events.</div>'}</div>${evs.length > 8 ? `<details class="fold" style="margin-top:8px"><summary>All ${evs.length} events</summary><div class="ev-list">${evs.map(x => eventItem(x)).join('')}</div></details>` : ''}</div>
      ${figs.length ? `<div><h3>People</h3><div class="chips">${figs.map(f => `<button class="chip" data-act="pin-figure" data-id="${f.id}">${esc(f.name)}</button>`).join('')}</div></div>` : ''}
      ${pr && pr.sources && pr.sources.length ? `<details class="fold"><summary>Sources</summary><ul class="sources">${pr.sources.map(s => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></li>`).join('')}</ul></details>` : ''}`;
  }
  function viewEvent(id) {
    const e = EV_BY_ID.get(id); if (!e) return '<div class="empty">Event not found.</div>';
    const i = EVENTS.indexOf(e); const prev = EVENTS[i - 1], next = EVENTS[i + 1];
    const T = C.EVENT_TYPES[e.type];
    return `
      <div class="eyebrow">${fmtDate(e)} · ${esc(e.city)}${e.state !== 'MULTI' ? `, ${esc(placeName(e.state))}` : ' · nationwide'}</div>
      <h2>${esc(e.title)}</h2>
      <div class="chips"><span class="badge type-${e.type}">${T.glyph} ${T.label}</span><span class="badge">importance ${e.importance}/5</span>${e.confidence && e.confidence !== 'high' ? `<span class="badge" title="fact-check confidence">${esc(e.confidence)} confidence</span>` : ''}</div>
      <div class="lede">${esc(e.summary)}</div>
      ${e.impact ? `<div><h3>Why it mattered</h3><div class="prose"><p>${esc(e.impact)}</p></div></div>` : ''}
      ${e.cartels.length ? `<div><h3>Organizations</h3><div class="chips">${e.cartels.map(orgChip).join('')}</div></div>` : ''}
      ${e.figures && e.figures.length ? `<div><h3>People</h3><div class="prose"><p>${e.figures.map(figLink).join(' · ')}</p></div></div>` : ''}
      ${C.STATES[e.state] ? `<div><h3>Place</h3><div class="chips">${stateChip(e.state)}</div></div>` : ''}
      ${e.sources && e.sources.length ? `<details class="fold"><summary>Sources</summary><ul class="sources">${e.sources.map(s => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></li>`).join('')}</ul></details>` : ''}
      <div class="nav-row">${prev ? `<button class="btn" data-act="pin-event" data-id="${prev.id}" title="${esc(prev.title)}">← ${fmtDate(prev)}</button>` : ''}${next ? `<button class="btn" data-act="pin-event" data-id="${next.id}" title="${esc(next.title)}">${fmtDate(next)} →</button>` : ''}</div>`;
  }
  function statusClass(s) { s = (s || '').toLowerCase(); if (/killed|dead|died|death|deceased|murdered|executed/.test(s)) return 'dead'; if (/prison|imprison|custody|sentence|jail|detained|arrest|extradit|transferred|awaiting|convicted|pleaded|plea/.test(s)) return 'jail'; if (/fugitive|at large|free|released|active|unknown/.test(s)) return 'free'; return ''; }
  function viewFigure(id) {
    const f = FIG_BY_ID.get(id); if (!f) return '<div class="empty">Figure not found.</div>';
    const evs = EVENTS.filter(e => (e.figures || []).some(n => figByName(n) === f));
    return `
      <div class="eyebrow">${f.born ? `b. ${f.born}` : ''}${f.died ? ` · d. ${f.died}` : ''}${f.state && C.STATES[f.state] ? ` · ${esc(C.STATES[f.state])}` : ''}</div>
      <h2>${esc(f.name)}</h2>
      ${f.alias ? `<div class="muted" style="font-family:var(--f-serif);font-style:italic;font-size:15px">“${esc(f.alias)}”</div>` : ''}
      <div class="chips"><span class="pill ${statusClass(f.status_2026)}">${esc(f.status_2026 || 'status unknown')}</span></div>
      <div class="kv"><dt>Role</dt><dd>${esc(f.role)}</dd>${f.cartels.length ? `<dt>Group</dt><dd class="chips">${f.cartels.map(orgChip).join('')}</dd>` : ''}</div>
      <div class="prose">${(f.bio || '').split(/\n\s*\n/).map(x => `<p>${esc(x)}</p>`).join('')}</div>
      ${f.derived ? `<div class="empty">Compiled from the leadership records of ${f.cartels.map(c => esc(orgOf(c).short)).join(', ')}. Open the organization for the full history.</div>` : ''}
      ${f.notable && f.notable.length ? `<div><h3>Notable</h3><ul class="facts">${f.notable.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
      ${evs.length ? `<div><h3>Events</h3><div class="ev-list">${evs.map(x => eventItem(x)).join('')}</div></div>` : ''}
      ${f.sources && f.sources.length ? `<details class="fold"><summary>Sources</summary><ul class="sources">${f.sources.map(s => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></li>`).join('')}</ul></details>` : ''}`;
  }

  // ------------------------------------------------------------------ timeline
  const tlEl = document.getElementById('tl');
  const tlSvg = d3.select('#tl-svg');
  let tlX = null, tlLayers = null;
  function layoutTimeline() {
    const w = tlEl.clientWidth, h = tlEl.clientHeight;
    if (!w || !h) return;
    tlSvg.attr('viewBox', `0 0 ${w} ${h}`).selectAll('*').remove();
    const M = { l: 44, r: 16 };
    const x = d3.scaleLinear([YMIN, YMAX + 1], [M.l, w - M.r]); tlX = x;
    const rowEra = { y: 6, h: 16 }, rowStack = { y: 30, h: Math.max(46, h - 30 - 24 - 40 - 22) }, rowTicks = { y: 0, h: 18 }, rowHom = { y: 0, h: 34 };
    rowTicks.y = rowStack.y + rowStack.h + 4; rowHom.y = rowTicks.y + rowTicks.h + 6;
    const axisY = rowHom.y + rowHom.h + 4;
    // era band
    const band = tlSvg.append('g').attr('class', 'era-band');
    const eb = band.selectAll('g').data(ERAS).join('g');
    eb.append('rect').attr('x', d => x(d.from)).attr('y', rowEra.y).attr('width', d => x(d.to + 1) - x(d.from)).attr('height', rowEra.h).attr('rx', 3)
      .on('click', (ev, d) => setYear(d.from, true)).on('pointerenter', (ev, d) => showTextTip(`<div class="ev-title">${esc(d.title)}</div><div class="muted">${d.from}–${d.to}${d.subtitle ? ` · ${esc(d.subtitle)}` : ''}</div>`, ev)).on('pointermove', ev => moveTip(ev)).on('pointerleave', hideTip);
    const clipDefs = tlSvg.append('defs');
    ERAS.forEach(d => clipDefs.append('clipPath').attr('id', 'clip-' + d.key).append('rect').attr('x', x(d.from)).attr('y', rowEra.y).attr('width', Math.max(0, x(d.to + 1) - x(d.from) - 6)).attr('height', rowEra.h));
    eb.append('text').attr('clip-path', d => `url(#clip-${d.key})`).attr('x', d => x(d.from) + 5).attr('y', rowEra.y + 11.5).text(d => { const wpx = x(d.to + 1) - x(d.from); return wpx < 46 ? String(d.from) : d.title; });
    // stacked control area
    const stack = d3.stack().keys(STACK_KEYS).value((r, k) => r[k] || 0).order(d3.stackOrderNone).offset(d3.stackOffsetNone)(CONTROL);
    const yS = d3.scaleLinear([0, 32], [rowStack.y + rowStack.h, rowStack.y]);
    const area = d3.area().x(d => x(d.data.year + 0.5)).y0(d => yS(d[0])).y1(d => yS(d[1])).curve(d3.curveMonotoneX);
    const grid = tlSvg.append('g').attr('class', 'grid');
    [8, 16, 24, 32].forEach(v => grid.append('line').attr('x1', M.l).attr('x2', w - M.r).attr('y1', yS(v)).attr('y2', yS(v)));
    tlSvg.append('text').attr('class', 'row-label').attr('x', 4).attr('y', rowStack.y + 9).text('states');
    [16, 32].forEach(v => tlSvg.append('text').attr('class', 'axis').append('tspan').attr('x', M.l - 6).attr('y', yS(v) + 3).attr('text-anchor', 'end').attr('font-family', 'var(--f-mono)').attr('font-size', 9.5).attr('fill', 'var(--muted)').text(v));
    tlLayers = tlSvg.append('g').attr('class', 'layers').selectAll('path.layer').data(stack).join('path').attr('class', 'layer').attr('d', area).attr('fill', d => orgColor(d.key))
      .on('pointerenter', (ev, d) => { S.highlightOrg = d.key; applyHighlight(); renderLegend(); tlLayers.classed('dim', l => l.key !== d.key); })
      .on('pointermove', (ev, d) => { const yr = clamp(Math.floor(x.invert(d3.pointer(ev, tlSvg.node())[0])), YMIN, YMAX); const row = CONTROL[yr - YMIN]; const top = Object.keys(row).filter(k => k !== 'year').sort((a, b) => row[b] - row[a]).slice(0, 6); showTextTip(`<div class="ev-date">${yr}</div>${top.map(k => `<div class="tip-row"><i class="sw" style="background:${orgColor(k)}"></i><span ${k === d.key ? 'style="font-weight:700"' : ''}>${esc(orgOf(k).short)}</span><span class="role">${row[k]} states</span></div>`).join('')}`, ev); })
      .on('pointerleave', () => { S.highlightOrg = null; applyHighlight(); renderLegend(); tlLayers.classed('dim', false); hideTip(); })
      .on('click', (ev, d) => { const yr = clamp(Math.floor(x.invert(d3.pointer(ev, tlSvg.node())[0])), YMIN, YMAX); setYear(yr, true); });
    // event ticks
    const ticks = tlSvg.append('g').attr('class', 'ticks');
    tlSvg.append('text').attr('class', 'row-label').attr('x', 4).attr('y', rowTicks.y + 12).text('events');
    ticks.selectAll('line').data(EVENTS).join('line').attr('class', d => 'tick-ev' + (d.importance >= 4 ? ' major' : ''))
      .attr('x1', d => x(d.t)).attr('x2', d => x(d.t)).attr('y1', d => rowTicks.y + rowTicks.h - 2 - (d.importance * 2.6)).attr('y2', rowTicks.y + rowTicks.h - 2)
      .on('pointerenter', (ev, d) => showEventTip(d, ev)).on('pointermove', ev => moveTip(ev)).on('pointerleave', hideTip).on('click', (ev, d) => { pin({ kind: 'event', id: d.id }); ev.stopPropagation(); });
    // homicides
    const homAll = STATS.homicides.filter(d => d.year >= YMIN && d.year <= YMAX && d.count > 0).sort((a, b) => a.year - b.year);
    const isPartial = d => /year-to-date|ytd|through|partial|jan(uary)?[-–]/i.test(d.note || '') || d.year >= 2026;
    const hom = homAll.filter(d => !isPartial(d));
    const partial = homAll.filter(isPartial);
    if (hom.length) {
      const yH = d3.scaleLinear([0, d3.max(homAll, d => d.count) * 1.05], [rowHom.y + rowHom.h, rowHom.y + 2]);
      const l = d3.line().x(d => x(d.year + 0.5)).y(d => yH(d.count)).curve(d3.curveMonotoneX);
      const a = d3.area().x(d => x(d.year + 0.5)).y0(rowHom.y + rowHom.h).y1(d => yH(d.count)).curve(d3.curveMonotoneX);
      tlSvg.append('path').attr('class', 'hom-area').attr('d', a(hom));
      tlSvg.append('path').attr('class', 'hom-line').attr('d', l(hom));
      // partial years (e.g. the current year to date) as hollow markers, not part of the annual line
      partial.forEach(d => tlSvg.append('circle').attr('cx', x(d.year + 0.5)).attr('cy', yH(d.count)).attr('r', 3).attr('fill', 'var(--surface)').attr('stroke', 'var(--ink)').attr('stroke-width', 1.2).attr('stroke-dasharray', '2 1.5').append('title').text(`${d.year}: ${fmtInt(d.count)} so far (${d.note || 'partial year'})`));
      tlSvg.append('text').attr('class', 'row-label').attr('x', 4).attr('y', rowHom.y + 9).text('killed');
      const mx = hom.reduce((m, d) => d.count > m.count ? d : m, hom[0]);
      tlSvg.append('text').attr('class', 'axis').append('tspan').attr('x', x(mx.year + 0.5) + (mx.year > 2016 ? -6 : 6)).attr('y', yH(mx.count) - 3).attr('text-anchor', mx.year > 2016 ? 'end' : 'start').attr('font-family', 'var(--f-mono)').attr('font-size', 9.5).attr('fill', 'var(--muted)').text(`${fmtInt(mx.count)} in ${mx.year}`);
      tlSvg.append('circle').attr('class', 'hom-pt').attr('r', 3.2).attr('cx', x(YMIN + 0.5)).attr('cy', yH(hom[0].count));
      tlSvg.node().__homY = yH; tlSvg.node().__hom = homAll;
    }
    // axis
    const ax = tlSvg.append('g').attr('class', 'axis');
    d3.range(1980, 2027, 5).forEach(y => { ax.append('line').attr('x1', x(y)).attr('x2', x(y)).attr('y1', axisY).attr('y2', axisY + 4); ax.append('text').attr('x', x(y)).attr('y', axisY + 14).attr('text-anchor', 'middle').text(y); });
    // cursor
    const cur = tlSvg.append('g').attr('class', 'cursor').attr('pointer-events', 'none');
    cur.append('line').attr('y1', rowEra.y).attr('y2', axisY + 4);
    cur.append('rect').attr('y', axisY + 3).attr('width', 40).attr('height', 15).attr('rx', 3).attr('x', -20);
    cur.append('text').attr('y', axisY + 14).attr('text-anchor', 'middle');
    // scrubber
    tlSvg.append('rect').attr('class', 'scrub').attr('x', M.l).attr('y', rowEra.y + rowEra.h + 2).attr('width', w - M.l - M.r).attr('height', rowStack.y - rowEra.y - rowEra.h - 2 + 0).attr('fill', 'transparent');
    const scrubAll = tlSvg.append('rect').attr('class', 'scrub').attr('x', M.l).attr('y', axisY - 2).attr('width', w - M.l - M.r).attr('height', 22);
    const drag = d3.drag().on('start drag', ev => { const yr = clamp(Math.floor(x.invert(ev.x)), YMIN, YMAX); if (yr !== S.year) setYear(yr, false); });
    scrubAll.call(drag).on('click', ev => setYear(clamp(Math.floor(x.invert(d3.pointer(ev, tlSvg.node())[0])), YMIN, YMAX), true));
    cur.call(drag);
    renderCursor();
  }
  function renderCursor() {
    if (!tlX) return;
    const cx = tlX(S.year + 0.5);
    const cur = tlSvg.select('g.cursor');
    cur.select('line').attr('x1', cx).attr('x2', cx);
    cur.select('rect').attr('x', cx - 20);
    cur.select('text').attr('x', cx).text(S.year);
    const yH = tlSvg.node().__homY, hom = tlSvg.node().__hom;
    if (yH) { const d = hom.find(r => r.year === S.year); tlSvg.select('.hom-pt').attr('opacity', d ? 1 : 0).attr('cx', cx).attr('cy', d ? yH(d.count) : 0); }
    tlSvg.selectAll('.era-band rect').classed('on', d => S.year >= d.from && S.year <= d.to);
  }

  // ------------------------------------------------------------------ modals
  const modalBack = document.getElementById('modal-back');
  const modal = document.getElementById('modal');
  let searchIdx = 0, searchResults = [];
  function openModal(kind) {
    modal.className = 'modal' + (kind === 'search' || kind === 'about' ? ' narrow' : '');
    if (kind === 'search') {
      modal.innerHTML = `<input class="search-input" id="q" placeholder="Search states, organizations, people, events…" autocomplete="off" aria-label="Search"><div class="modal-body pad0"><div class="results" id="results"></div></div>`;
      modalBack.classList.add('show');
      const q = document.getElementById('q'); q.focus(); q.addEventListener('input', () => runSearch(q.value));
      runSearch('');
    } else if (kind === 'lineage') {
      modal.innerHTML = `<div class="modal-head"><h2>Lineage of the cartels</h2><span class="grow muted" style="font-size:13px">Bars run from founding to dissolution; dotted links show which organization a group split from. Click a bar to open its profile.</span><button class="btn ghost" data-act="close">Close ✕</button></div><div class="modal-body lineage-wrap"><svg class="lineage" id="lineage"></svg></div>`;
      modalBack.classList.add('show');
      drawLineage();
    } else if (kind === 'figures') {
      modal.innerHTML = `<div class="modal-head"><h2>Who's who</h2><span class="grow muted" style="font-size:13px">${FIGS.length} people</span><button class="btn ghost" data-act="close">Close ✕</button></div><div class="modal-body"><div class="fig-tools"><input id="figq" placeholder="Filter by name or alias" value="${esc(S.figFilter.q)}"><select id="figorg"><option value="">All organizations</option>${C.ORG_ORDER.filter(o => FIGS.some(f => f.cartels.includes(o))).map(o => `<option value="${o}" ${S.figFilter.org === o ? 'selected' : ''}>${esc(orgOf(o).name)}</option>`).join('')}</select></div><div class="fig-grid" id="figgrid"></div></div>`;
      modalBack.classList.add('show');
      renderFigGrid();
      document.getElementById('figq').addEventListener('input', ev => { S.figFilter.q = ev.target.value; renderFigGrid(); });
      document.getElementById('figorg').addEventListener('change', ev => { S.figFilter.org = ev.target.value; renderFigGrid(); });
    } else if (kind === 'about') {
      modal.innerHTML = `<div class="modal-head"><h2>About this atlas</h2><span class="grow"></span><button class="btn ghost" data-act="close">Close ✕</button></div><div class="modal-body">${viewAbout()}</div>`;
      modalBack.classList.add('show');
    }
  }
  function closeModal() { modalBack.classList.remove('show'); modal.innerHTML = ''; }
  function runSearch(q) {
    q = q.trim().toLowerCase();
    const out = [];
    const push = (k, t, s, sel) => out.push({ k, t, s, sel });
    Object.keys(C.STATES).forEach(c => { if (!q || C.STATES[c].toLowerCase().includes(q) || c.toLowerCase() === q) push('State', C.STATES[c], orgOf(periodAt(c, S.year).primary).name + ' · ' + S.year, { kind: 'state', id: c }); });
    Object.values(ORG).forEach(o => { if (o.id === 'none' || o.id === 'fragmented') return; const hay = (o.name + ' ' + o.short + ' ' + ((o.profile && o.profile.aka) || []).join(' ')).toLowerCase(); if (!q || hay.includes(q)) push('Group', o.name, o.profile ? `${o.profile.founded}–${o.profile.dissolved || 'present'}` : '', { kind: 'org', id: o.id }); });
    FIGS.forEach(f => { if (!q || (f.name + ' ' + f.alias).toLowerCase().includes(q)) push('Person', f.name + (f.alias ? ` “${f.alias}”` : ''), f.role, { kind: 'figure', id: f.id }); });
    EVENTS.forEach(e => { if (q && (e.title + ' ' + e.city + ' ' + (e.figures || []).join(' ')).toLowerCase().includes(q)) push('Event', e.title, `${fmtDate(e)} · ${e.city}`, { kind: 'event', id: e.id }); });
    searchResults = out.slice(0, 40); searchIdx = 0;
    document.getElementById('results').innerHTML = searchResults.map((r, i) => `<button class="result ${i === 0 ? 'on' : ''}" data-act="search-pick" data-i="${i}"><span class="k">${r.k}</span><span><div class="t">${esc(r.t)}</div><div class="s">${esc(r.s)}</div></span></button>`).join('') || '<div class="empty" style="padding:16px">Nothing matches.</div>';
  }
  function renderFigGrid() {
    const q = S.figFilter.q.toLowerCase(), org = S.figFilter.org;
    const list = FIGS.filter(f => (!q || (f.name + ' ' + f.alias).toLowerCase().includes(q)) && (!org || f.cartels.includes(org)))
      .sort((a, b) => (a.derived ? 1 : 0) - (b.derived ? 1 : 0) || (a.born || 9999) - (b.born || 9999) || a.name.localeCompare(b.name));
    document.getElementById('figgrid').innerHTML = list.map(f => `<button class="fig-card" data-act="pin-figure" data-id="${f.id}"><div class="nm">${esc(f.name)}</div>${f.alias ? `<div class="al">“${esc(f.alias)}”</div>` : ''}<div class="role">${esc(f.role)}</div><div class="foot">${f.cartels.slice(0, 2).map(c => `<span class="chip" style="height:20px;font-size:11px"><i class="sw" style="background:${orgColor(c)}"></i>${esc(orgOf(c).short)}</span>`).join('')}<span class="pill ${statusClass(f.status_2026)}">${esc(truncate(f.status_2026 || '', 34))}</span></div></button>`).join('') || '<div class="empty">No one matches.</div>';
  }
  function viewAbout() {
    const nSrc = new Set();
    EVENTS.forEach(e => (e.sources || []).forEach(s => nSrc.add(s)));
    Object.values(ORG).forEach(o => o.profile && (o.profile.sources || []).forEach(s => nSrc.add(s)));
    Object.values(TERR).forEach(t => (t.sources || []).forEach(s => nSrc.add(s)));
    const domains = d3.rollups(Array.from(nSrc), v => v.length, s => { try { return new URL(s).hostname.replace(/^www\./, ''); } catch (e) { return 'other'; } }).sort((a, b) => b[1] - a[1]).slice(0, 18);
    return `<div class="about">
      <p>${esc(NARR.intro || 'Narco Atlas maps the territorial history of Mexican organized crime from 1980 to 2026.')}</p>
      <h3>What the map encodes</h3>
      <ul><li><b>Fill color</b>: the organization with the largest share of a state's criminal economy in the selected year. This is an assessment of dominance, not a claim of total control: cartel territory is a patchwork of cities, corridors and alliances, and state lines are a coarse grid laid over it.</li>
      <li><b>Stripes</b>: the state was actively contested; the stripe color is the main challenger.</li>
      <li><b>Fill brightness</b>: a 1–5 violence index relative to Mexico's worst places at the time, informed by INEGI and SESNSP homicide data.</li>
      <li><b>Markers</b>: recorded events in the selected year (or the whole chapter, with the toggle). Amber markers are events of national importance.</li></ul>
      <h3>How the data was compiled</h3>
      <p>Territorial periods, organization profiles, event records and biographies were researched from public reporting and scholarship, then independently fact-checked by a second pass that challenged every date, place and attribution. Items that could not be confirmed carry a lower confidence flag. Coverage: ${Object.keys(TERR).length} states, ${Object.values(ORG).filter(o => o.profile).length} organization profiles, ${EVENTS.length} events, ${FIGS.length} people, ${nSrc.size} distinct source links.</p>
      <div class="table-wrap"><table><thead><tr><th>Event confidence after fact-check</th><th>Events</th><th>Meaning</th></tr></thead><tbody>
        <tr><td>High</td><td class="mono">${EVENTS.filter(e => e.confidence === 'high').length}</td><td>Date, place and attribution confirmed against independent sources.</td></tr>
        <tr><td>Medium</td><td class="mono">${EVENTS.filter(e => e.confidence === 'medium').length}</td><td>Core facts confirmed; a detail (exact day, number, coordinate) rests on a single or secondary source.</td></tr>
        <tr><td>Low</td><td class="mono">${EVENTS.filter(e => e.confidence === 'low').length}</td><td>Contested or unconfirmed accounts, kept because they are widely cited; read the event record's caveats.</td></tr>
      </tbody></table></div>
      ${STATS.key_numbers && STATS.key_numbers.length ? `<h3>Key numbers</h3><div class="table-wrap"><table><thead><tr><th>Measure</th><th>Value</th><th>Note</th></tr></thead><tbody>${STATS.key_numbers.map(k => `<tr><td>${esc(k.label)}</td><td class="mono">${esc(k.value)}</td><td>${esc(k.note)}${k.source ? ` <a href="${esc(k.source)}" target="_blank" rel="noopener">↗</a>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${STATS.presidents && STATS.presidents.length ? `<h3>Administrations</h3><div class="table-wrap"><table><thead><tr><th>President</th><th>Term</th><th>Security strategy</th></tr></thead><tbody>${STATS.presidents.map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.party)}</span></td><td class="mono">${p.from.slice(0, 4)}–${p.to.slice(0, 4)}</td><td>${esc(p.strategy)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${STATS.drug_shifts && STATS.drug_shifts.length ? `<h3>How the business changed</h3><div class="table-wrap"><table><tbody>${STATS.drug_shifts.map(d => `<tr><td class="mono" style="white-space:nowrap">${d.from}–${d.to}</td><td><b>${esc(d.title)}</b><br>${esc(d.note)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${STATS.us_policy && STATS.us_policy.length ? `<h3>United States policy milestones</h3><div class="table-wrap"><table><tbody>${STATS.us_policy.map(d => `<tr><td class="mono" style="white-space:nowrap">${esc(d.date)}</td><td><b>${esc(d.title)}</b><br>${esc(d.note)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${NARR.epilogue_2026 ? `<h3>Where things stand, September 2026</h3><p>${esc(NARR.epilogue_2026)}</p>` : ''}
      <h3>Most-cited sources</h3><div class="table-wrap"><table><tbody>${domains.map(([d, n]) => `<tr><td>${esc(d)}</td><td class="mono">${n}</td></tr>`).join('')}</tbody></table></div>
      <h3>Built by</h3>
      <p>Dakshin Siva. Code and data on <a href="https://github.com/dakshinsiva/narco-atlas" target="_blank" rel="noopener">GitHub</a>; questions and corrections to <a href="mailto:anudeep.cr7@gmail.com">anudeep.cr7@gmail.com</a>. Boundaries are INEGI state limits rendered with D3; the research was compiled and fact-checked with Claude Code.</p>
      <h3>Caveats</h3><p>Assigning a single dominant organization to a whole state flattens real complexity, especially in Guerrero, Michoacán and Mexico City, where dozens of cells operate. Dates for clandestine events are often disputed; where sources disagree the atlas follows the most widely corroborated account and flags the rest. Boundaries follow INEGI state limits.</p>
    </div>`;
  }
  function drawLineage() {
    const orgs = Object.values(ORG).filter(o => o.profile && o.profile.founded > 1900);
    const famOrder = ['guadalajara', 'sinaloa', 'beltran', 'gulf', 'cjng', 'michoacan', 'independent', 'guerrero', 'cdmx', 'state'];
    const famLabel = { guadalajara: 'Guadalajara lineage', sinaloa: 'Sinaloa', beltran: 'Beltrán Leyva splinters', gulf: 'Gulf & Zetas', cjng: 'Milenio → CJNG', michoacan: 'Michoacán', independent: 'Independents', guerrero: 'Guerrero', cdmx: 'Mexico City', state: 'State & militias' };
    orgs.sort((a, b) => famOrder.indexOf(a.family) - famOrder.indexOf(b.family) || a.profile.founded - b.profile.founded);
    const W = Math.max(900, modal.clientWidth - 40), rowH = 26, left = 170, top = 28;
    const lanes = []; let y = top, lastFam = null;
    orgs.forEach(o => { if (o.family !== lastFam) { y += lastFam ? 14 : 0; lanes.push({ fam: o.family, y }); lastFam = o.family; } o._y = y; y += rowH; });
    const H = y + 30;
    const x = d3.scaleLinear([1974, YMAX + 1.5], [left, W - 20]);
    const s = d3.select('#lineage').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H); s.selectAll('*').remove();
    d3.range(1975, 2027, 5).forEach(yr => { s.append('line').attr('class', 'grid').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', top - 14).attr('y2', H - 20); s.append('text').attr('class', 'yr').attr('x', x(yr)).attr('y', top - 18).attr('text-anchor', 'middle').text(yr); });
    lanes.forEach(l => s.append('text').attr('class', 'fam').attr('x', 8).attr('y', l.y - 4).text(famLabel[l.fam] || l.fam));
    // links
    orgs.forEach(o => { const p = ORG[o.profile.parent]; if (!p || !p.profile || p._y == null) return; const x0 = x(clamp(o.profile.founded, p.profile.founded, YMAX)), y0 = p._y + 7, y1 = o._y + 7; s.append('path').attr('class', 'link').attr('d', `M${x0},${y0} C${x0},${(y0 + y1) / 2} ${x0},${(y0 + y1) / 2} ${x0},${y1}`); });
    const g = s.selectAll('g.org').data(orgs).join('g').attr('class', 'org');
    g.append('rect').attr('class', 'bar').attr('x', d => x(d.profile.founded)).attr('y', d => d._y).attr('width', d => Math.max(6, x(d.profile.dissolved || YMAX + 1) - x(d.profile.founded))).attr('height', 14).attr('rx', 3).attr('fill', d => orgColor(d.id))
      .on('click', (ev, d) => { closeModal(); pin({ kind: 'org', id: d.id }); })
      .on('pointerenter', (ev, d) => showTextTip(`<div class="ev-title">${esc(d.name)}</div><div class="muted">${d.profile.founded}–${d.profile.dissolved || 'present'}</div><div style="margin-top:4px;max-width:300px">${esc(truncate(d.profile.summary || '', 200))}</div>`, ev)).on('pointermove', ev => moveTip(ev)).on('pointerleave', hideTip);
    g.append('text').attr('class', 'nm').attr('x', left - 8).attr('y', d => d._y + 11).attr('text-anchor', 'end').text(d => truncate(d.short, 24));
    g.append('text').attr('class', 'yr').attr('x', d => x(d.profile.founded) + 4).attr('y', d => d._y + 11).attr('fill', 'var(--accent-ink)').text(d => (x(d.profile.dissolved || YMAX + 1) - x(d.profile.founded)) > 70 ? `${d.profile.founded}–${d.profile.dissolved || ''}` : '');
    // current-year cursor
    s.append('line').attr('x1', x(S.year + 0.5)).attr('x2', x(S.year + 0.5)).attr('y1', top - 14).attr('y2', H - 20).attr('stroke', 'var(--accent)').attr('stroke-width', 1.5);
  }

  // ------------------------------------------------------------------ control flow
  function setYear(y, animate, keepPin) {
    y = clamp(Math.round(y), YMIN, YMAX);
    const changed = y !== S.year;
    S.year = y;
    if (changed && S.pinned && S.pinned.kind === 'event' && !keepPin) { /* keep event pinned; it just shows in its own year */ }
    renderMap(animate !== false);
    renderEventMarkers();
    renderHUD(); renderLegend(); renderEra(); renderCursor(); renderInspector();
    if (S.hover) { /* refresh tooltip content if pointer still over a state */ }
    updateHash();
  }
  function play() {
    if (S.playing) return;
    clearTimeout(S.timer);
    if (S.year >= YMAX) S.year = YMIN - 1;
    S.playing = true; $('#play').classList.add('on'); $('#play').innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>'; $('#play').setAttribute('aria-label', 'Pause');
    tick();
  }
  function tick() {
    if (!S.playing) return;
    if (S.year >= YMAX) { pause(); return; }
    setYear(S.year + 1, true);
    S.timer = setTimeout(tick, 1400 / S.speed);
  }
  function pause() {
    S.playing = false; clearTimeout(S.timer);
    $('#play').classList.remove('on'); $('#play').innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 5v14l12-7z"/></svg>'; $('#play').setAttribute('aria-label', 'Play');
  }
  function updateHash() {
    const parts = [`y=${S.year}`];
    if (S.pinned) parts.push(`pin=${S.pinned.kind}:${encodeURIComponent(S.pinned.id)}`);
    try { history.replaceState(null, '', '#' + parts.join('&')); } catch (e) { /* ignore */ }
  }
  function readHash() {
    const h = location.hash.replace(/^#/, ''); if (!h) return;
    const q = new URLSearchParams(h);
    if (q.get('y')) S.year = clamp(+q.get('y') || YMIN, YMIN, YMAX);
    const p = q.get('pin'); if (p) { const [kind, id] = p.split(':'); if (['state', 'org', 'event', 'figure'].includes(kind) && id) S.pinned = { kind, id: decodeURIComponent(id) }; }
  }
  function showMobTab(tab) {
    document.getElementById('pane-left').classList.toggle('hide', tab !== 'left');
    document.getElementById('pane-right').classList.toggle('hide', tab !== 'right');
    document.querySelectorAll('#mob-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  }
  function toggleTheme() {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('narco-atlas-theme', next); } catch (e) { /* ignore */ }
    rethemed();
  }
  function rethemed() { buildPatterns(); renderMap(false); renderLegend(); renderEra(); renderInspector(); layoutTimeline(); }

  // delegated clicks
  app.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'set-year') setYear(+b.dataset.year, true);
    else if (a === 'step') { pause(); setYear(b.dataset.n === '-100' ? YMIN : S.year + (+b.dataset.n), true); }
    else if (a === 'play') { S.playing ? pause() : play(); }
    else if (a === 'play-intro') { dismissIntro(); pause(); setYear(YMIN, false); play(); }
    else if (a === 'dismiss-intro') dismissIntro();
    else if (a === 'pin-state') pin({ kind: 'state', id: b.dataset.id });
    else if (a === 'pin-org') pin({ kind: 'org', id: b.dataset.id });
    else if (a === 'pin-event') pin({ kind: 'event', id: b.dataset.id });
    else if (a === 'pin-figure') pin({ kind: 'figure', id: b.dataset.id });
    else if (a === 'unpin') pin(null);
    else if (a === 'hl-org') { S.highlightOrg = S.highlightOrg === b.dataset.id ? null : b.dataset.id; applyHighlight(); renderLegend(); if (S.highlightOrg && ev.detail === 2) pin({ kind: 'org', id: b.dataset.id }); }
    else if (a === 'legend-toggle') { S.legendOpen = !S.legendOpen; $('#legend').classList.toggle('open', S.legendOpen); b.setAttribute('aria-expanded', S.legendOpen ? 'true' : 'false'); }
    else if (a === 'toggle-era') { S.eraEvents = !S.eraEvents; $('#tg-era').classList.toggle('on', S.eraEvents); renderEventMarkers(); }
    else if (a === 'zoom') { const d = b.dataset.dir; if (d === 'reset') svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity); else svg.transition().duration(300).call(zoom.scaleBy, d === 'in' ? 1.6 : 1 / 1.6); }
    else if (a === 'open') openModal(b.dataset.modal);
    else if (a === 'theme') toggleTheme();
    else if (a === 'mob-tab') showMobTab(b.dataset.tab);
  });
  // legend hover → highlight
  app.addEventListener('pointerover', ev => {
    const b = ev.target.closest('[data-hl]'); if (b) { S.highlightOrg = b.dataset.hl; applyHighlight(); return; }
    const s = ev.target.closest('[data-hover-state]'); if (s) { S.hover = s.dataset.hoverState; applyHighlight(); renderPlazas(); }
    const l = ev.target.closest('.legend-list button'); if (l && !S.highlightOrg) { S._legendHover = l.dataset.id; applyHighlightTemp(l.dataset.id); }
  });
  app.addEventListener('pointerout', ev => {
    const b = ev.target.closest('[data-hl]'); if (b && !ev.target.closest('.legend-list')) { S.highlightOrg = null; applyHighlight(); }
    const s = ev.target.closest('[data-hover-state]'); if (s) { S.hover = null; applyHighlight(); renderPlazas(); }
    const l = ev.target.closest('.legend-list button'); if (l && S._legendHover) { S._legendHover = null; applyHighlight(); }
  });
  function applyHighlightTemp(id) { const keep = S.highlightOrg; S.highlightOrg = id; applyHighlight(); S.highlightOrg = keep; }
  modalBack.addEventListener('click', ev => {
    if (ev.target === modalBack) { closeModal(); return; }
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') closeModal();
    else if (a === 'search-pick') { const r = searchResults[+b.dataset.i]; closeModal(); if (r) pin(r.sel); }
    else if (a === 'pin-figure') { closeModal(); pin({ kind: 'figure', id: b.dataset.id }); }
    else if (a === 'pin-org') { closeModal(); pin({ kind: 'org', id: b.dataset.id }); }
    else if (a === 'pin-state') { closeModal(); pin({ kind: 'state', id: b.dataset.id }); }
    else if (a === 'pin-event') { closeModal(); pin({ kind: 'event', id: b.dataset.id }); }
  });
  document.addEventListener('keydown', ev => {
    const inField = /input|select|textarea/i.test(ev.target.tagName);
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openModal('search'); return; }
    if (ev.key === 'Escape') { if (modalBack.classList.contains('show')) closeModal(); else if (S.pinned) pin(null); return; }
    if (modalBack.classList.contains('show')) {
      if (document.getElementById('q') && ['ArrowDown', 'ArrowUp', 'Enter'].includes(ev.key)) {
        ev.preventDefault();
        if (ev.key === 'Enter') { const r = searchResults[searchIdx]; closeModal(); if (r) pin(r.sel); return; }
        searchIdx = clamp(searchIdx + (ev.key === 'ArrowDown' ? 1 : -1), 0, Math.max(0, searchResults.length - 1));
        document.querySelectorAll('.result').forEach((el, i) => el.classList.toggle('on', i === searchIdx));
        const on = document.querySelector('.result.on'); if (on) on.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (inField) return;
    if (ev.key === 'ArrowRight') { pause(); setYear(S.year + 1, true); }
    else if (ev.key === 'ArrowLeft') { pause(); setYear(S.year - 1, true); }
    else if (ev.key === ' ') { ev.preventDefault(); S.playing ? pause() : play(); }
    else if (ev.key === '/') { ev.preventDefault(); openModal('search'); }
  });
  document.getElementById('speed').addEventListener('change', ev => { S.speed = +ev.target.value; });
  function dismissIntro() { $('#intro').hidden = true; try { localStorage.setItem('narco-atlas-intro', '1'); } catch (e) { /* ignore */ } }
  svg.on('click', ev => { if (S.pinned && ev.target && ev.target.classList.contains('ground')) pin(null); });

  // theme bootstrapping: honour a stored explicit choice, otherwise follow the host
  try { const t = localStorage.getItem('narco-atlas-theme'); if (t && !document.documentElement.getAttribute('data-theme')) document.documentElement.setAttribute('data-theme', t); } catch (e) { /* ignore */ }
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rethemed);
  new MutationObserver(rethemed).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // resize
  const ro = new ResizeObserver(() => { layoutMap(); layoutTimeline(); });
  ro.observe(mapWrap); ro.observe(tlEl);

  // ------------------------------------------------------------------ boot
  readHash();
  if (window.innerWidth <= 920) S.legendOpen = false;
  buildPatterns();
  layoutMap();
  layoutTimeline();
  renderHUD(); renderLegend(); renderEra(); renderInspector(); renderIntro();
  applyHighlight();
})();
