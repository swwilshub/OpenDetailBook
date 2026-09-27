// Add a detail to the book.
// node tools/add-detail.mjs <path-to-html> --chapter "Walls" --title "..." --blurb "..." --tags "Walls,ψ-value"
//   [--slug name] [--chapter-blurb "..."] [--force]
import { copyFileSync, existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, readIndex, readDemos, insertDemo, ensureChapter, writeIndex, kebab, serve, launch, makeThumb } from './lib.mjs';

const USAGE = 'Usage: npm run add -- <path-to-html> --chapter "Walls" --title "..." --blurb "..." --tags "Walls,ψ-value" [--slug name] [--chapter-blurb "..."] [--force]';
let args;
try {
  args = parseArgs({ allowPositionals: true, options: {
    chapter: { type: 'string' }, title: { type: 'string' }, blurb: { type: 'string' }, tags: { type: 'string' },
    slug: { type: 'string' }, 'chapter-blurb': { type: 'string', default: '' }, force: { type: 'boolean', default: false } } });
} catch (e) { console.error(e.message + '\n' + USAGE); process.exit(1); }
const { values: o, positionals: [src] } = args;
const missing = ['chapter', 'title', 'blurb', 'tags'].filter(k => !o[k]?.trim());
if (!src || missing.length) { console.error((missing.length ? `Missing --${missing.join(', --')}\n` : '') + USAGE); process.exit(1); }
if (!existsSync(src)) { console.error(`No such file: ${src}`); process.exit(1); }

const slug = kebab(o.slug || basename(src, extname(src)));
if (!slug) { console.error('Could not make a filename; pass --slug'); process.exit(1); }
const file = `demos/${slug}.html`, thumb = `thumbs/${slug}.webp`;

let html = readIndex();
if (readDemos(html).some(d => d.file === file)) { console.error(`${file} is already in DEMOS`); process.exit(1); }
if (existsSync(join(ROOT, file)) && !o.force) { console.error(`${file} already exists (use --force to overwrite)`); process.exit(1); }

copyFileSync(src, join(ROOT, file));
console.log(`Copied ${src} -> ${file}`);

const server = await serve();
const browser = await launch();
try { await makeThumb(browser, server.url + file, join(ROOT, thumb)); }
finally { await browser.close(); server.close(); }
console.log(`Thumbnail  -> ${thumb}`);

const ch = ensureChapter(html, o.chapter.trim(), o['chapter-blurb']);
if (ch.added) console.log(`New chapter: ${o.chapter.trim()}`);
html = insertDemo(ch.html, { chapter: o.chapter.trim(), file, thumb, title: o.title.trim(), blurb: o.blurb.trim(),
  tags: o.tags.split(',').map(t => t.trim()).filter(Boolean) });
writeIndex(html);
console.log('Added to DEMOS in index.html. Run `npm run check`, then commit and push.');
