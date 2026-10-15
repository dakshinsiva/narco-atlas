// Integrity checks on the data modules the atlas renders from. Every id an event, figure or
// territory period points at must exist, every event needs a date inside the atlas's range and at
// least one source, and the territory table must cover all 32 states in the map topology.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = (file, name) => {
  const w = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))(w);
  return w[name];
};
const orgs = load('cartels.js', 'PLAZA_ORGS');
const events = load('events.js', 'PLAZA_EVENTS');
const territory = load('territory.js', 'PLAZA_TERRITORY');
const figures = load('figures.js', 'PLAZA_FIGURES');
const topo = load('geo.js', 'MX_TOPO');
const orgIds = new Set(orgs.map(o => o.id));
const stateIds = new Set(topo.objects.states.geometries.map(g => g.properties.id));
const figureIds = new Set(figures.map(f => f.id));
const YEARS = [1980, 2026];
// Sentinel actors the data uses alongside real organization ids.
const ACTOR_SENTINELS = new Set(['government', 'us_government', 'other', 'none', 'fragmented']);
const knownActor = id => orgIds.has(id) || ACTOR_SENTINELS.has(id);
// Events and figures outside Mexico carry a country code or MULTI instead of a state id.
const FOREIGN = new Set(['US', 'CO', 'CR', 'HN', 'VE', 'CA', 'GT', 'MULTI']);
const knownPlace = id => stateIds.has(id) || FOREIGN.has(id);

test('organization ids are unique and dated', () => {
  assert.equal(orgIds.size, orgs.length);
  for (const o of orgs) {
    assert.ok(o.name, `${o.id} has a name`);
    assert.ok(o.founded >= 1900 && o.founded <= YEARS[1], `${o.id} founded ${o.founded}`);
    if (o.parent) assert.ok(orgIds.has(o.parent), `${o.id} parent ${o.parent} exists`);
  }
});

test('every state in the topology has a territory record covering the full range', () => {
  assert.equal(stateIds.size, 32);
  const byState = new Map(territory.map(t => [t.state, t]));
  for (const id of stateIds) {
    const t = byState.get(id);
    assert.ok(t, `territory for ${id}`);
    const periods = [...t.periods].sort((a, b) => a.from - b.from);
    assert.equal(periods[0].from, YEARS[0], `${id} starts in ${YEARS[0]}`);
    assert.equal(periods[periods.length - 1].to, YEARS[1], `${id} runs to ${YEARS[1]}`);
    for (let i = 1; i < periods.length; i++) {
      assert.equal(periods[i].from, periods[i - 1].to + 1, `${id} periods are contiguous at ${periods[i].from}`);
    }
    for (const p of periods) {
      assert.ok(knownActor(p.primary), `${id} ${p.from}: primary ${p.primary} exists`);
      for (const s of p.secondary || []) assert.ok(knownActor(s), `${id} ${p.from}: secondary ${s} exists`);
      assert.ok(p.intensity >= 1 && p.intensity <= 5, `${id} ${p.from}: intensity ${p.intensity}`);
    }
  }
});

test('events have unique ids, in-range dates, known places and actors, and sources', () => {
  const ids = new Set();
  for (const e of events) {
    assert.ok(!ids.has(e.id), `duplicate event id ${e.id}`);
    ids.add(e.id);
    const year = Number(e.date.slice(0, 4));
    assert.ok(year >= YEARS[0] && year <= YEARS[1], `${e.id} year ${year}`);
    assert.ok(e.title && e.summary, `${e.id} has title and summary`);
    if (e.state) assert.ok(knownPlace(e.state), `${e.id} state ${e.state} exists`);
    for (const c of e.cartels || []) assert.ok(knownActor(c), `${e.id} cartel ${c} exists`);
    for (const f of e.figures || []) assert.ok(typeof f === 'string' && f.trim(), `${e.id} has a named figure`);
    assert.ok(Array.isArray(e.sources) && e.sources.length > 0, `${e.id} has sources`);
    assert.ok(e.importance >= 1 && e.importance <= 5, `${e.id} importance ${e.importance}`);
  }
});

test('figures reference known organizations', () => {
  assert.equal(figureIds.size, figures.length);
  for (const f of figures) {
    for (const c of f.cartels || []) assert.ok(knownActor(c), `${f.id} cartel ${c} exists`);
    if (f.state) assert.ok(knownPlace(f.state), `${f.id} state ${f.state} exists`);
    assert.ok(Array.isArray(f.sources) && f.sources.length > 0, `${f.id} has sources`);
  }
});
