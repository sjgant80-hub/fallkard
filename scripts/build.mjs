#!/usr/bin/env node
// fallkard/scripts/build.mjs — the I/O shell around kernel.mjs.
// Read fallmarket/listings.json + manifest.json → produce cards.json + art/*.svg
// Deterministic. Idempotent. Denylist-gated. All derivation logic lives in the
// gated kernel; this file only reads inputs and writes outputs.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { makeKernel } from '../kernel.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LISTINGS = join(ROOT, '..', 'fallmarket', 'listings.json');
const MANIFEST = join(ROOT, 'manifest.json');
const OUT_CARDS = join(ROOT, 'cards.json');
const OUT_ART_DIR = join(ROOT, 'art');
const OUT_SUMMARY = join(ROOT, 'build-summary.json');

// ────────── load
const listings = JSON.parse(readFileSync(LISTINGS, 'utf8'));
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
// PRIVATE build filter — gitignored, never committed/served. Refuse to build without it (would leak private repos into cards.json).
let FILTER;
try { FILTER = JSON.parse(readFileSync(join(ROOT, '.private-filter.json'), 'utf8')); }
catch { console.error('[build] FATAL: .private-filter.json missing — refusing to build (would leak private repos). Restore it from the private vault.'); process.exit(1); }
console.log('[build] loaded', listings.listings.length, 'listings');

// ────────── derive
console.log('[build] deriving cards');
const K = makeKernel(manifest, FILTER);
const { cards, skipped, synthesized, rarityDist, chamberDist, kindDist } = K.deriveCards(listings);
if (synthesized.length) console.log('[build] synthesized', synthesized.length, 'Genesis cards from manifest:', synthesized.join(', '));
console.log('[build]', cards.length, 'cards derived,', skipped.length, 'skipped for private slug');

// ────────── write SVG art
if (existsSync(OUT_ART_DIR)) {
  for (const f of readdirSync(OUT_ART_DIR)) rmSync(join(OUT_ART_DIR, f));
}
mkdirSync(OUT_ART_DIR, { recursive: true });
let artWritten = 0;
for (const card of cards) {
  const svg = K.svgFor(card);
  writeFileSync(join(OUT_ART_DIR, card.id + '.svg'), svg, 'utf8');
  artWritten++;
}
console.log('[build] wrote', artWritten, 'SVGs to art/');

// ────────── seal · deterministic hash of cards.json content
const raw = JSON.stringify(cards);
const seal = createHash('sha256').update(raw).digest('hex');

// ────────── write cards.json
const bundle = {
  v: 1,
  generated: '2026-07-10',
  total: cards.length,
  seal: 'sha256:' + seal,
  meta: {
    rarityDistribution: rarityDist,
    chamberDistribution: chamberDist,
    kindDistribution: kindDist,
    skipped: skipped.length,
    denylistPatterns: FILTER.denylist.length
  },
  cards
};
writeFileSync(OUT_CARDS, JSON.stringify(bundle, null, 2), 'utf8');
console.log('[build] wrote cards.json seal', bundle.seal.slice(0, 16));

// ────────── build summary for CI/reports
writeFileSync(OUT_SUMMARY, JSON.stringify({
  generated: bundle.generated,
  total: bundle.total,
  seal: bundle.seal,
  rarityDistribution: rarityDist,
  chamberDistribution: chamberDist,
  kindDistribution: kindDist,
  skipped
}, null, 2), 'utf8');

console.log('[build] rarity:', rarityDist);
console.log('[build] chambers:', chamberDist);
console.log('[build] kinds:', kindDist);
console.log('[build] done');
