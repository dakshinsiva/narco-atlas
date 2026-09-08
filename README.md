# Narco Atlas

An interactive atlas of cartel territory in Mexico, 1980–2026: which organization dominated each state in a given year, where the plazas were contested, what happened there, and who the people were.

## Run it

Everything is static. Open `index.html` through any local web server:

```bash
python3 -m http.server 8765
```

Then visit http://localhost:8765. A single-file build (fonts and libraries still load from Google Fonts and cdnjs) is produced by:

```bash
node build.mjs
```

which writes `dist/narco-atlas.html` (standalone) and `dist/narco-atlas.artifact.html` (body-only fragment for the Claude Artifact host).

## How to use it

- **Scrub time** with the timeline at the bottom, the arrow keys, or the play button (space). The chart under the era band stacks the number of states each organization dominated per year; the row beneath marks every recorded event, and the bottom row is INEGI's annual homicide count.
- **Hover a state** for its controller, challenger, violence index (1–5), a 46-year control sparkline and the period note. States held by the same organization stay lit, everything else dims. **Click** to pin it in the inspector, which lists every control period, key plazas, events, facts and people.
- **Legend** (top right) lists who holds what this year. Hover to see an organization's footprint; click to keep the highlight; double-click to open its profile.
- **Markers** are the year's events (amber = national importance). Hover for the headline, click for the full record with sources. The toggle under the map shows every event of the chapter at once. Events outside Mexico are listed under the year counter.
- **Lineage** draws the genealogy of the organizations; **Who's who** is a filterable gallery of figures; **Search** (⌘K or `/`) covers states, groups, people and events. The URL hash keeps the year and the pinned item, so views can be shared.

## Deploy

Live at https://narcoatlas.vercel.app (Vercel project `narcoatlas`). Redeploy with:

```bash
vercel deploy --prod --yes
```

The social share card is generated from the atlas data (the 2026 map, its real control colors and that year's events), not hand-drawn. Regenerate it after a data change:

```bash
node tools/gen-og.mjs
```

That writes `og.png` (1200x630) and `og-square.png`, which the Open Graph and Twitter tags in `index.html` point at.

## Data

| File | Contents |
|---|---|
| `data/territory.js` | For each of the 32 states: contiguous control periods 1980–2026 (`primary`, `secondary`, `contested`, `intensity` 1–5, note), key plazas with controller sequences, facts, sources |
| `data/events.js` | Dated, geolocated events with type, importance, organizations, people, impact and source links |
| `data/cartels.js` | Organization profiles: lineage, leaders and fates, factions, allies and rivals, peak, facts, status in 2026 |
| `data/figures.js` | Biographies and 2026 status of key figures |
| `data/stats.js` | INEGI homicides per year, administrations and their strategies, US policy milestones, business shifts, headline numbers |
| `data/narratives.js` | The eight chapter narratives, intro and 2026 epilogue |
| `data/geo.js` | State boundaries (TopoJSON, ISO 3166-2:MX ids) |
| `src/config.js` | Canonical organization ids, colors, families, state names, era bounds |

The research was compiled from public reporting and scholarship by parallel research agents, then re-checked by adversarial fact-check passes that challenged dates, places and attributions. Items whose verification did not complete carry `confidence: "medium"` or lower, and the merge script (`scratch/merge.js`) marks which batches were fact-checked. The fact-check log is in `scratch/research-log.md`.

Assigning one dominant organization per state is a deliberate simplification; the notes, plazas and secondary organizations carry the nuance.

## Built by

Dakshin Siva — [github.com/dakshinsiva](https://github.com/dakshinsiva) · anudeep.cr7@gmail.com

Research compiled and adversarially fact-checked with Claude Code. Boundaries are INEGI state limits; the map is rendered with D3. Licensed MIT (see `LICENSE`); the underlying reporting belongs to the outlets cited in each record.

## Repository layout

| Path | What it is |
|---|---|
| `index.html`, `src/` | The application: one page, no framework, D3 and TopoJSON from a CDN |
| `data/` | The dataset (see the table above) |
| `tools/gen-og.mjs` | Renders the social share card from the atlas data |
| `tools/merge-research.js` | Merges research-agent output into `data/` |
| `docs/fact-check-log.md` | Every correction and open doubt raised by the fact-check passes |
| `docs/workflows/` | The research workflow scripts that produced the dataset |
