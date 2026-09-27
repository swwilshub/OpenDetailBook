// Regenerate every thumbnail listed in DEMOS. Pass file names to limit it:
// node tools/thumbs.mjs [window-jamb ...]
import { join } from 'node:path';
import { ROOT, readDemos, serve, launch, makeThumb } from './lib.mjs';

const only = process.argv.slice(2);
const demos = readDemos().filter(d => !only.length || only.some(s => d.file.includes(s)));
const server = await serve();
const browser = await launch();
let failed = 0;
try {
  for (const d of demos) {
    try { await makeThumb(browser, server.url + d.file, join(ROOT, d.thumb)); console.log(`ok   ${d.thumb}`); }
    catch (e) { failed++; console.error(`FAIL ${d.thumb}: ${e.message}`); }
  }
} finally { await browser.close(); server.close(); }
process.exit(failed ? 1 : 0);
