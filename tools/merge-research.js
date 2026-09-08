// Merges workflow output files into the atlas data modules.
// Usage: node scratch/merge.js [tasksDir]
// Picks, for each research family (events / territory / orgs), the most complete .output file,
// prefers fact-checked ("verified") batches over raw research, and falls back to the existing
// data files for anything still missing. Writes a research log to scratch/research-log.md.
const fs = require('fs');
const path = require('path');
const tasksDir = process.argv[2] || '/private/tmp/claude-501/-Users-dakshinsiva-dux/a4c2426b-00c0-46d0-97ed-b6fb572c7184/tasks';

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
  if (figs.length) {
    const fseen = new Set();
    write('figures', 'PLAZA_FIGURES', figs.filter(f => { if (fseen.has(f.id)) return false; fseen.add(f.id); return true; }));
  } else console.log('  figures: none (fallback kept)');
}
const orgs = Array.from(orgById.values()).map(o => { const c = Object.assign({}, o); delete c._fallback; return c; });
write('cartels', 'PLAZA_ORGS', orgs);
console.log(`  org fallback still used for: ${Array.from(orgById.values()).filter(o => o._fallback).map(o => o.id).join(', ') || 'none'}`);

fs.writeFileSync('scratch/research-log.md', `# Fact-check log\n\n${log.join('\n')}\n`);
console.log(`research log: ${log.length} lines`);
