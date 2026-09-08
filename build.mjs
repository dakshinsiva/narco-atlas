// Builds two single-file bundles from index.html:
//   dist/narco-atlas.html           standalone page (open directly in a browser)
//   dist/narco-atlas.artifact.html  body-only fragment for the Claude Artifact host
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

const inlined = html
  .replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, p) => `<style>\n${readFileSync(resolve(root, p), 'utf8')}\n</style>`)
  .replace(/<script src="((?:src|data)\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${readFileSync(resolve(root, p), 'utf8')}\n</script>`)
  // Analytics only resolves on the Vercel deployment, so the portable bundles ship without it.
  .replace(/<!-- Vercel Web Analytics[\s\S]*?<script defer src="\/_vercel\/speed-insights\/script\.js"><\/script>/, '');

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/narco-atlas.html'), inlined);

// Artifact fragment: keep <title>, font links, styles, body content and scripts; drop the document wrapper.
const head = inlined.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = inlined.match(/<body>([\s\S]*?)<\/body>/)[1];
const keepFromHead = head
  .split('\n')
  .filter(l => !/<meta charset|<meta name="viewport"/.test(l))
  .join('\n');
const fragment = `${keepFromHead}\n${body}`;
writeFileSync(resolve(root, 'dist/narco-atlas.artifact.html'), fragment);

const kb = n => `${(n / 1024).toFixed(0)} KB`;
console.log(`standalone ${kb(Buffer.byteLength(inlined))} · artifact ${kb(Buffer.byteLength(fragment))}`);
