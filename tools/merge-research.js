// Merges workflow output files into the atlas data modules.
// Usage: node tools/merge-research.js <tasksDir>
// Picks, for each research family (events / territory / orgs), the most complete .output file,
// prefers fact-checked ("verified") batches over raw research, and falls back to the existing
// data files for anything still missing. Writes a research log to scratch/research-log.md.
const fs = require('fs');
const path = require('path');
const tasksDir = process.argv[2];
if (!tasksDir || !fs.existsSync(tasksDir)) {
  console.error('usage: node tools/merge-research.js <tasksDir>   (directory of research-agent .output files; set WF_DIR for workflow journals)');
  process.exit(1);
}

const loadGlobal = (file, name) => {
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  return sandbox.window[name];
};
const write = (name, glob, data) => {
  fs.writeFileSync(`data/${name}.js`, `window.${glob} = ${JSON.stringify(data)};\n`);
  console.log(`wrote data/${name}.js (${(fs.statSync(`data/${name}.js`).size / 1024).toFixed(0)} KB)`);
};

// ---- collect candidate outputs
const outputs = fs.readdirSync(tasksDir).filter(f => f.endsWith('.output')).map(f => {
  try { const j = JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf8')); return { f, j, mtime: fs.statSync(path.join(tasksDir, f)).mtimeMs }; } catch (e) { return null; }
}).filter(x => x && x.j && x.j.result);

// A workflow only writes its .output when the whole run finishes. Agents that already returned are
// recorded in journal.jsonl, so read those too and treat them as loose batches to fill any gap.
const loose = { figures: [], orgs: [], states: [], events: [] };
const wfDir = process.env.WF_DIR || '';
if (wfDir && fs.existsSync(wfDir)) {
  for (const run of fs.readdirSync(wfDir)) {
    const j = path.join(wfDir, run, 'journal.jsonl');
    if (!fs.existsSync(j)) continue;
    for (const line of fs.readFileSync(j, 'utf8').trim().split('\n')) {
      let e; try { e = JSON.parse(line); } catch (err) { continue; }
      const r = e && e.type === 'result' && e.result;
      if (!r) continue;
      for (const k of ['figures', 'orgs', 'states', 'events']) if (Array.isArray(r[k]) && r[k].length) loose[k].push({ items: r[k], verified: Array.isArray(r.corrections) });
    }
  }
  console.log(`journals: ${Object.entries(loose).map(([k, v]) => `${k}=${v.length}`).join(' ')} loose batches`);
}

const score = {
  events: r => (r.eras || []).reduce((n, e) => n + (e.result ? (e.result.verified ? 2 : 1) : 0), 0),
  territory: r => (r.regions || []).reduce((n, e) => n + (e.result ? (e.result.verified ? 2 : 1) : 0), 0) + (r.stats ? 1 : 0),
  orgs: r => (r.orgGroups || []).reduce((n, e) => n + (e.result ? (e.result.verified ? 2 : 1) : 0), 0) + (r.figureGroups || []).reduce((n, e) => n + (e.result ? (e.result.verified ? 2 : 1) : 0), 0),
};
// Per item (era / region / group), take the best result across every output file: fact-checked beats
// researched, and newer beats older on ties. Different runs of the same workflow lost different agents.
const itemScore = r => !r ? 0 : r.verified ? 2 : r.researched ? 1 : 0;
const pick = (kind, key) => {
  const c = outputs.filter(o => o.j.result[key]).sort((a, b) => b.mtime - a.mtime);
  if (!c.length) { console.log(`no output for ${kind}`); return null; }
  const merged = JSON.parse(JSON.stringify(c[0].j.result));
  const idOf = it => it.era || it.region || it.group;
  merged[key].forEach(it => {
    c.forEach(o => { const cand = (o.j.result[key] || []).find(x => idOf(x) === idOf(it)); if (cand && itemScore(cand.result) > itemScore(it.result)) it.result = cand.result; });
  });
  if (key === 'orgGroups') merged.figureGroups.forEach(it => c.forEach(o => { const cand = (o.j.result.figureGroups || []).find(x => x.group === it.group); if (cand && itemScore(cand.result) > itemScore(it.result)) it.result = cand.result; }));
  if (key === 'eras') c.forEach(o => { if (!merged.narratives && o.j.result.narratives) merged.narratives = o.j.result.narratives; });
  if (key === 'regions') c.forEach(o => { if (!(merged.stats && merged.stats.homicides && merged.stats.homicides.length) && o.j.result.stats && o.j.result.stats.homicides && o.j.result.stats.homicides.length) merged.stats = o.j.result.stats; });
  console.log(`${kind}: merged across ${c.length} output files (${c.map(o => o.f).join(', ')})`);
  return merged;
};
const EV = pick('events', 'eras');
const TR = pick('territory', 'regions');
const OR = pick('orgs', 'orgGroups');

const log = [];
const useBatch = (res, field) => {
  if (!res) return null;
  if (res.verified && res.verified[field] && res.verified[field].length) {
    (res.verified.corrections || []).forEach(c => log.push(`- ${c}`));
    (res.verified.flagged || []).forEach(c => log.push(`- FLAG: ${c}`));
    return { items: res.verified[field], verified: true };
  }
  if (res.researched && res.researched[field]) return { items: res.researched[field], verified: false };
  return null;
};

// ---- events + narratives
const fallbackEvents = loadGlobal('data/events.js', 'PLAZA_EVENTS') || [];
let events = [];
const coveredEras = new Set();
if (EV) {
  log.push('## Events');
  EV.eras.forEach(e => {
    const b = useBatch(e.result, 'events');
    if (!b) { console.log(`  era ${e.era}: MISSING`); return; }
    coveredEras.add(e.era);
    console.log(`  era ${e.era}: ${b.items.length} events (${b.verified ? 'fact-checked' : 'unverified'})`);
    b.items.forEach(ev => { if (!b.verified) ev.confidence = ev.confidence === 'high' ? 'medium' : ev.confidence; events.push(ev); });
  });
}
// fall back to hand-written events for uncovered years
const ERAS = [[1980, 1989], [1990, 1999], [2000, 2006], [2007, 2010], [2011, 2014], [2015, 2018], [2019, 2022], [2023, 2026]];
const eraKeyOf = y => { const i = ERAS.findIndex(([a, b]) => y >= a && y <= b); return 'e' + (i + 1); };
fallbackEvents.forEach(ev => { const y = +String(ev.date).slice(0, 4); if (!coveredEras.has(eraKeyOf(y))) events.push(ev); });
// dedupe by id, then by (date,title)
const seen = new Set(); events = events.filter(ev => { if (seen.has(ev.id)) return false; seen.add(ev.id); return true; });
events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
write('events', 'PLAZA_EVENTS', events);
if (EV && EV.narratives && EV.narratives.chapters && EV.narratives.chapters.length) write('narratives', 'PLAZA_NARRATIVES', EV.narratives);

// ---- territory + stats
const fallbackTerr = loadGlobal('data/territory.js', 'PLAZA_TERRITORY') || [];
const terrByState = new Map(fallbackTerr.map(t => [t.state, Object.assign({ _fallback: true }, t)]));
if (TR) {
  log.push('## Territory');
  TR.regions.forEach(r => {
    const b = useBatch(r.result, 'states');
    if (!b) { console.log(`  region ${r.region}: MISSING (fallback kept for ${r.states.join(', ')})`); return; }
    console.log(`  region ${r.region}: ${b.items.map(s => s.state).join(', ')} (${b.verified ? 'fact-checked' : 'unverified'})`);
    b.items.forEach(s => terrByState.set(s.state, Object.assign({}, s, { verified: b.verified })));
  });
}
const territory = Array.from(terrByState.values()).map(t => { const o = Object.assign({}, t); delete o._fallback; return o; });
write('territory', 'PLAZA_TERRITORY', territory);
console.log(`  fallback still used for: ${Array.from(terrByState.values()).filter(t => t._fallback).map(t => t.state).join(', ') || 'none'}`);
if (TR && TR.stats && TR.stats.homicides && TR.stats.homicides.length) write('stats', 'PLAZA_STATS', TR.stats);
else console.log('  stats: MISSING (fallback kept)');

// ---- orgs + figures
const fallbackOrgs = loadGlobal('data/cartels.js', 'PLAZA_ORGS') || [];
const orgById = new Map(fallbackOrgs.map(o => [o.id, Object.assign({ _fallback: true }, o)]));
if (OR) {
  log.push('## Organizations');
  OR.orgGroups.forEach(g => {
    const b = useBatch(g.result, 'orgs');
    if (!b) { console.log(`  orgs ${g.group}: MISSING`); return; }
    console.log(`  orgs ${g.group}: ${b.items.map(o => o.id).join(', ')} (${b.verified ? 'fact-checked' : 'unverified'})`);
    b.items.forEach(o => orgById.set(o.id, Object.assign({}, o, { verified: b.verified })));
  });
  log.push('## Figures');
  const figs = [];
  OR.figureGroups.forEach(g => {
    const b = useBatch(g.result, 'figures');
    if (!b) { console.log(`  figures ${g.group}: MISSING`); return; }
    console.log(`  figures ${g.group}: ${b.items.length} (${b.verified ? 'fact-checked' : 'unverified'})`);
    b.items.forEach(f => figs.push(Object.assign({}, f, { verified: b.verified })));
  });
  // A hand-run researcher can drop extra batches here as plain JSON arrays.
  const extraDir = 'scratch';
  if (fs.existsSync(extraDir)) {
    for (const f of fs.readdirSync(extraDir).filter(x => /^figures-.*\.json$/.test(x))) {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(extraDir, f), 'utf8'));
        if (Array.isArray(arr) && arr.length) { loose.figures.push({ items: arr, verified: false }); console.log(`  figures: +${arr.length} from ${f}`); }
      } catch (e) { console.log(`  figures: could not read ${f} (${e.message})`); }
    }
  }
  // Fill in from journal batches for figure groups the finished output did not carry.
  if (loose.figures.length) {
    const best = loose.figures.sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
    const before = figs.length;
    best.forEach(b => b.items.forEach(f => figs.push(Object.assign({}, f, { verified: b.verified }))));
    console.log(`  figures: +${figs.length - before} from ${loose.figures.length} loose batches`);
  }
  if (figs.length) {
    // The same person can arrive from several batches under different ids (mencho vs
    // nemesio_oseguera_cervantes), so collapse on the normalized name too and keep the
    // richest record: fact-checked first, then the longer biography.
    const parts = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['"]/g, '').split(/[^a-z0-9]+/).filter(p => p.length > 2);
    const rank = f => (f.verified ? 1e6 : 0) + (f.bio || '').length;
    // Two records are the same person when the first and last name parts agree and every part of
    // the shorter name appears in the longer one, so "Omar García Harfuch" and "Omar Hamid García
    // Harfuch" collapse while distinct siblings stay separate.
    const same = (a, b) => {
      const pa = parts(a), pb = parts(b);
      if (!pa.length || !pb.length) return false;
      if (pa[0] !== pb[0] || pa[pa.length - 1] !== pb[pb.length - 1]) return false;
      const [short, long] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
      return short.every(x => long.includes(x));
    };
    const kept = [];
    figs.sort((a, b) => rank(b) - rank(a)).forEach(f => {
      const hit = kept.find(k => (f.id && k.id === f.id) || same(k.name, f.name));
      if (!hit) { kept.push(f); return; }
      // Keep the richer record but do not lose affiliations the weaker one carried.
      (f.cartels || []).forEach(c => { if (!(hit.cartels || []).includes(c)) (hit.cartels = hit.cartels || []).push(c); });
    });
    const deduped = kept;
    write('figures', 'PLAZA_FIGURES', deduped);
    console.log(`  figures: ${deduped.length} unique (${deduped.filter(f => f.verified).length} fact-checked)`);
  } else console.log('  figures: none (fallback kept)');
}
const orgs = Array.from(orgById.values()).map(o => { const c = Object.assign({}, o); delete c._fallback; return c; });
write('cartels', 'PLAZA_ORGS', orgs);
console.log(`  org fallback still used for: ${Array.from(orgById.values()).filter(o => o._fallback).map(o => o.id).join(', ') || 'none'}`);

fs.writeFileSync('scratch/research-log.md', `# Fact-check log\n\n${log.join('\n')}\n`);
console.log(`research log: ${log.length} lines`);
