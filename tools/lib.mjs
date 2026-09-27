// Shared helpers for the book's tooling: reading and editing the DEMOS/CHAPTERS
// lists in index.html, serving the site locally, and taking thumbnails.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX = join(ROOT, 'index.html');
export const THUMB_W = 640, THUMB_H = 397;

const DEMOS_RE = /const DEMOS=\[\n([\s\S]*?)\n\];/;
const CHAPTERS_RE = /const CHAPTERS=(\[.*\]);/;

// The lists are plain JS literals written by hand, so evaluate them rather than parse.
const literal = src => Function(`"use strict";return (${src});`)();

export function readIndex() { return readFileSync(INDEX, 'utf8'); }

export function readDemos(html = readIndex()) {
  const m = html.match(DEMOS_RE);
  if (!m) throw new Error('Could not find the DEMOS array in index.html');
  return literal(`[${m[1]}]`);
}

export function readChapters(html = readIndex()) {
  const m = html.match(CHAPTERS_RE);
  if (!m) throw new Error('Could not find the CHAPTERS array in index.html');
  return literal(m[1]);
}

export const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')}'`;

// Same two-line layout as the hand-written entries.
export function formatDemo(d) {
  return ` {chapter:${q(d.chapter)},file:${q(d.file)},thumb:${q(d.thumb)},title:${q(d.title)},\n` +
         `  blurb:${q(d.blurb)},tags:[${d.tags.map(q).join(',')}]},`;
}

export function insertDemo(html, d) {
  return html.replace(DEMOS_RE, (all, body) => `const DEMOS=[\n${body}\n${formatDemo(d)}\n];`);
}

export function ensureChapter(html, name, sub = '') {
  if (readChapters(html).some(([ch]) => ch === name)) return { html, added: false };
  const out = html.replace(CHAPTERS_RE, (all, arr) => `const CHAPTERS=${arr.slice(0, -1)},[${q(name)},${q(sub)}]];`);
  return { html: out, added: true };
}

export function writeIndex(html) { writeFileSync(INDEX, html); }

export const kebab = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Minimal static server so pages load over http, as they will on GitHub Pages.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

export function serve(root = ROOT) {
  const server = createServer((req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p);
    try {
      if (!file.startsWith(root) || !statSync(file).isFile()) throw 0;
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () =>
    ok({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}

export async function launch() {
  const { chromium } = await import('playwright');
  // WebGL needs a software GL in headless CI.
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

// Open a page at 720×900, wait 5 s, click the 4th chapter pip if there is one,
// screenshot the stage and save it as a 640×397 webp.
export async function makeThumb(browser, pageUrl, outFile) {
  const page = await browser.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(pageUrl, { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    const pips = page.locator('.pip');
    if (await pips.count() >= 4) {
      await pips.nth(3).click();
      await page.waitForTimeout(5000);
    }
    let stage = null;
    for (const sel of ['#vp', '.sheet', 'canvas']) {
      const l = page.locator(sel).first();
      if (await l.count() && await l.isVisible()) { stage = l; break; }
    }
    if (!stage) throw new Error(`No #vp, .sheet or canvas on ${pageUrl}`);
    const png = await stage.screenshot();
    await sharp(png).resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).toFile(outFile);
  } finally { await page.close(); }
}
