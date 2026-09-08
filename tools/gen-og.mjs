// Renders the social share image from the atlas's own data: the 2026 map, colored by the
// organization dominating each state, over the title. Writes og.png (1200x630) and og-square.png.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoConicConformal, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import sharp from 'sharp';

const run = src => { const w = {}; new Function('window', src)(w); return w; };
const TOPO = run(readFileSync('data/geo.js', 'utf8')).MX_TOPO;
const CFG = run(readFileSync('src/config.js', 'utf8')).PLAZA_CONFIG;
const TERR = run(readFileSync('data/territory.js', 'utf8')).PLAZA_TERRITORY;
const EVENTS = run(readFileSync('data/events.js', 'utf8')).PLAZA_EVENTS;

const YEAR = 2026;
const periodAt = (code, y) => {
  const t = TERR.find(x => x.state === code);
  return (t && t.periods.find(p => y >= p.from && y <= p.to)) || { primary: 'none', secondary: [], contested: false, intensity: 1 };
};
const color = id => (CFG.ORG_META[id] || CFG.ORG_META.other).color;

const W = 1200, H = 630;
const states = feature(TOPO, TOPO.objects.states);
const borders = mesh(TOPO, TOPO.objects.states, (a, b) => a !== b);
// Map occupies the right two-thirds; the title block sits left.
const projection = geoConicConformal().parallels([17.5, 29.5]).rotate([102, 0]);
projection.fitExtent([[430, 56], [W - 40, H - 56]], states);
const path = geoPath(projection);

const used = new Map();
const paths = states.features.map(f => {
  const p = periodAt(f.properties.id, YEAR);
  const c = p.primary === 'none' ? '#2A2723' : color(p.primary);
  if (p.primary !== 'none' && p.primary !== 'fragmented') used.set(p.primary, (used.get(p.primary) || 0) + 1);
  const op = p.primary === 'none' ? 1 : 0.55 + 0.11 * (p.intensity - 1);
  return `<path d="${path(f)}" fill="${c}" fill-opacity="${op.toFixed(2)}" stroke="#111010" stroke-width="0.7"/>`;
}).join('');

// Stripes for contested states, drawn as a second pass so they read on top.
const defs = [];
const hatches = states.features.map(f => {
  const p = periodAt(f.properties.id, YEAR);
  if (!p.contested || !p.secondary.length) return '';
  const id = 'h_' + f.properties.id;
  defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="2.6" fill="${color(p.secondary[0])}" fill-opacity="0.92"/></pattern>`);
  return `<path d="${path(f)}" fill="url(#${id})" stroke="none"/>`;
}).join('');

// Event markers for the year, so the card shows the atlas is event-level, not just a choropleth.
const marks = EVENTS.filter(e => e.date.startsWith(String(YEAR)) && e.lat > 14 && e.lat < 33.5 && e.lng > -119 && e.lng < -86)
  .map(e => { const p = projection([e.lng, e.lat]); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(3 + e.importance * 1.1).toFixed(1)}" fill="#E3A63B" stroke="#131210" stroke-width="1.6"/>`; }).join('');

const top = [...used.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
const legend = top.map(([id, n], i) => {
  const y = 462 + i * 26;
  const name = (CFG.ORG_META[id] || {}).short || id;
  return `<rect x="64" y="${y - 10}" width="13" height="13" rx="3" fill="${color(id)}"/>`
    + `<text x="87" y="${y + 1}" font-family="Helvetica Neue, Arial, sans-serif" font-size="16" fill="#CBC2B2">${name}</text>`
    + `<text x="360" y="${y + 1}" font-family="Menlo, monospace" font-size="15" fill="#9A8F80" text-anchor="end">${n} state${n > 1 ? 's' : ''}</text>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${defs.join('')}
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#131210"/><stop offset="0.62" stop-color="#131210" stop-opacity="0.92"/><stop offset="1" stop-color="#131210" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="#131210"/>
<g>${paths}${hatches}<path d="${path(borders)}" fill="none" stroke="#111010" stroke-width="0.6"/>${marks}</g>
<rect x="0" y="0" width="470" height="${H}" fill="url(#fade)"/>
<text x="64" y="132" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="82" letter-spacing="-2" fill="#ECE4D6">NARCO</text>
<text x="64" y="206" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="82" letter-spacing="-2" fill="#E3A63B">ATLAS</text>
<rect x="64" y="240" width="86" height="4" fill="#E3A63B"/>
<text x="64" y="292" font-family="Helvetica Neue, Arial, sans-serif" font-size="25" fill="#CBC2B2">Cartel territory in Mexico,</text>
<text x="64" y="326" font-family="Helvetica Neue, Arial, sans-serif" font-size="25" fill="#CBC2B2">1980 to 2026</text>
<text x="64" y="384" font-family="Menlo, monospace" font-size="16" fill="#9A8F80">${TERR.length} states · ${EVENTS.length} events · 36 organizations</text>
<text x="64" y="412" font-family="Menlo, monospace" font-size="16" fill="#9A8F80">46 years, mapped year by year</text>
<text x="64" y="440" font-family="Menlo, monospace" font-size="13" letter-spacing="1.6" fill="#6E6558">WHO HOLDS WHAT · ${YEAR}</text>
${legend}
<text x="64" y="600" font-family="Menlo, monospace" font-size="15" fill="#E3A63B">narcoatlas.vercel.app</text>
</svg>`;

writeFileSync('tools/og.svg', svg);
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('og.png');
// WhatsApp also uses a square crop in some surfaces; provide one that keeps the title block.
await sharp(Buffer.from(svg)).extract({ left: 0, top: 0, width: 630, height: 630 }).resize(600, 600).png({ compressionLevel: 9 }).toFile('og-square.png');
const meta = await sharp('og.png').metadata();
const { size } = await sharp('og.png').toBuffer({ resolveWithObject: true }).then(r => r.info);
console.log(`og.png ${meta.width}x${meta.height}, ${(size / 1024).toFixed(0)} KB`);
