// Check the book: every DEMOS entry has its HTML and thumbnail, and the index and
// every detail page load in headless Chromium without errors.
// Failed Google Fonts requests are ignored (fonts fall back and CI may be offline).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT, readDemos, readChapters, serve, launch, THUMB_W, THUMB_H } from './lib.mjs';

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const problems = [];
const fail = (where, msg) => { problems.push(`${where}: ${msg}`); console.error(`  FAIL ${msg}`); };

const demos = readDemos(), chapters = readChapters().map(([c]) => c);
console.log(`${demos.length} details in DEMOS\n\nFiles`);
for (const d of demos) {
  console.log(`- ${d.file}`);
  if (!chapters.includes(d.chapter)) fail(d.file, `chapter "${d.chapter}" is not in CHAPTERS`);
  for (const k of ['title', 'blurb']) if (!d[k]) fail(d.file, `missing ${k}`);
  if (!Array.isArray(d.tags) || !d.tags.length) fail(d.file, 'missing tags');
  if (!existsSync(join(ROOT, d.file))) fail(d.file, 'HTML file not found');
  if (!existsSync(join(ROOT, d.thumb))) fail(d.file, `thumbnail ${d.thumb} not found`);
  else {
    const { width, height } = await sharp(join(ROOT, d.thumb)).metadata();
    if (width !== THUMB_W || height !== THUMB_H) fail(d.file, `thumbnail is ${width}×${height}, expected ${THUMB_W}×${THUMB_H}`);
  }
}
if (new Set(demos.map(d => d.file)).size !== demos.length) fail('index.html', 'duplicate file in DEMOS');

async function load(browser, url, name, settle) {
  const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !FONTS.test(m.location().url || '') && !/Failed to load resource/.test(m.text())) errs.push(`console error: ${m.text()}`); });
  page.on('requestfailed', r => { if (!FONTS.test(r.url())) errs.push(`request failed: ${r.url()} (${r.failure()?.errorText})`); });
  page.on('response', r => { if (r.status() >= 400 && !FONTS.test(r.url())) errs.push(`HTTP ${r.status()}: ${r.url()}`); });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(settle);
    return { page, errs };
  } catch (e) { errs.push(`load: ${e.message.split('\n')[0]}`); return { page, errs }; }
}

console.log('\nPages');
const server = await serve();
const browser = await launch();
try {
  console.log('- index.html');
  const idx = await load(browser, server.url, 'index.html', 1000);
  const cards = await idx.page.locator('a.demo').count().catch(() => 0);
  if (cards !== demos.length) idx.errs.push(`index shows ${cards} details, DEMOS has ${demos.length}`);
  const broken = await idx.page.$$eval('a.demo img', imgs => imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src'))).catch(() => []);
  for (const b of broken) idx.errs.push(`thumbnail did not load: ${b}`);
  idx.errs.forEach(e => fail('index.html', e));
  await idx.page.close();

  for (const d of demos) {
    if (!existsSync(join(ROOT, d.file))) continue;
    console.log(`- ${d.file}`);
    const r = await load(browser, server.url + d.file, d.file, 4000);
    r.errs.forEach(e => fail(d.file, e));
    await r.page.close();
  }
} finally { await browser.close(); server.close(); }

if (problems.length) { console.error(`\n${problems.length} problem(s):\n` + problems.map(p => '  ' + p).join('\n')); process.exit(1); }
console.log('\nAll checks passed.');
