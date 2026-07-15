#!/usr/bin/env node
// fallkard/build.mjs
// Read fallmarket/listings.json + manifest.json → produce cards.json + art/*.svg
// Deterministic. Idempotent. Denylist-gated.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
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

// ────────── denylist gate (patterns loaded from the private filter, not the public manifest)
const DENY = new RegExp('\\b(?:' + FILTER.denylist.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
const SLUG_PRIVATE = new RegExp(FILTER.slugPrivatePattern, 'i');
// Exact-slug denylist — anything private repo that slips past the pattern above
const PRIVATE_SLUGS_EXACT = new Set(FILTER.privateSlugs || []);
const isPublicSafe = (id) => !SLUG_PRIVATE.test(id) && !PRIVATE_SLUGS_EXACT.has(id);
// Also skip listings whose title itself contains any denylist term
function titleIsSafe(title) {
  if (!title) return true;
  return !DENY.test(title);
}

// ────────── sigil
const SIGILS = ['◊','◈','△','▽','◇','⬡','◐','◑','◒','◓','⬢','⬣','⟁','⟐','⟡','⟢'];
function sigilFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(id.length - 1 - i)) >>> 0;
  return SIGILS[h % SIGILS.length];
}

// ────────── chamber
function chamberFor(id, kind) {
  const map = manifest.chamberFromPrefix;
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const k of keys) if (id.startsWith(k)) return map[k];
  if (kind === 'mcp' || kind === 'api') return 'bridge';
  if (kind === 'sdk') return 'forge';
  return 'market';
}

// ────────── kind resolve · manifest wins over listing
function kindFor(id, listingKind) {
  if (manifest.wellnessIds.includes(id)) return 'wellness';
  if (manifest.surfaceIds.includes(id)) return 'surface';
  return listingKind || 'tool';
}

// ────────── grade heuristic (real audit report not yet plumbed here)
function gradeFor(id, listing) {
  // Flagships get a floor of 0.94 (Unique). Genesis get 0.99.
  if (manifest.genesisSet.some(g => g.id === id)) return 0.99;
  if (manifest.flagshipIds.includes(id)) return 0.94;
  // Heuristic: more tags, more tiers, more urls = higher signal
  let base = 0.72;
  const tags = (listing.tags || []).length;
  const tiers = (listing.tiers || []).length;
  if (listing.docs_url) base += 0.04;
  if (listing.playground_url) base += 0.04;
  if (listing.repo_url) base += 0.03;
  base += Math.min(0.06, tags * 0.008);
  base += Math.min(0.05, tiers * 0.015);
  // Deterministic jitter by slug hash to spread rarity distribution
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 131 + id.charCodeAt(i)) >>> 0;
  const jitter = ((h % 100) - 50) / 1000; // ±0.05
  return Math.max(0.50, Math.min(0.99, base + jitter));
}

// ────────── rarity from grade
function rarityFor(id, grade) {
  if (manifest.genesisSet.some(g => g.id === id)) return { rarity: 'uber-unique', tier: 'dark-gold' };
  if (manifest.flagshipIds.includes(id)) return { rarity: 'unique', tier: 'gold' };
  if (grade >= 0.90) return { rarity: 'rare', tier: 'yellow' };
  if (grade >= 0.75) return { rarity: 'magic', tier: 'blue' };
  return { rarity: 'common', tier: 'bone' };
}

// ────────── stats
function statsFor(id, kind, grade) {
  const k = manifest.kinds[kind] || manifest.kinds.tool;
  // cost from curve
  const rangeSpan = k.curve_hi - k.curve_lo;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 137 + id.charCodeAt(i)) >>> 0;
  let cost = k.curve_lo + (h % (rangeSpan + 1));
  let atk = k.base_atk;
  let hp = Math.round(3 + grade * 9);
  const sockets = k.sockets;

  // Rarity bumps
  if (manifest.genesisSet.some(g => g.id === id)) { atk += 3; hp += 4; }
  else if (manifest.flagshipIds.includes(id))     { atk += 2; hp += 2; }
  else if (grade >= 0.90)                         { atk += 1; hp += 1; }

  atk = Math.max(1, Math.min(10, atk));
  hp = Math.max(1, Math.min(14, hp));
  cost = Math.max(1, Math.min(10, cost));
  return { cost, atk, hp, sockets };
}

// ────────── flavour text · not private
const FLAVOUR_BY_KIND = {
  sdk: [
    "Cast a sigil. Hold the line.",
    "Every function is a small oath.",
    "The forge remembers.",
    "Build once. Fork forever."
  ],
  api: [
    "The signal carries.",
    "A door opens over any distance.",
    "Every reply is a promise kept.",
    "The wire hums with old work."
  ],
  mcp: [
    "One tool moves another.",
    "The loom weaves what the blade cannot cut.",
    "Every chain begins with one link.",
    "The bridge holds because the rope is old."
  ],
  tool: [
    "Sharp. Sovereign. Signed.",
    "A blade that carries the Seal is never truly gone.",
    "One tool. One job. Done well.",
    "The old smiths would recognise it."
  ],
  surface: [
    "The tower stands over the plain.",
    "Every house begins with one arch.",
    "The chamber is empty until you speak.",
    "You entered the house of the Fall."
  ],
  wellness: [
    "The mirror shows what the mask hid.",
    "The well is fed by ten thousand small rains.",
    "The shape of the shape.",
    "The compass is silent when the road is right."
  ]
};

function flavourFor(id, kind) {
  const o = manifest.abilityOverrides[id];
  if (o?.flavour) return o.flavour;
  const list = FLAVOUR_BY_KIND[kind] || FLAVOUR_BY_KIND.tool;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 41 + id.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

// ────────── keywords defaults per kind
const KEYWORDS_BY_KIND = {
  sdk:     ['Sovereign'],
  api:     ['Trade'],
  mcp:     ['Chain'],
  tool:    ['Shard'],
  surface: ['Marketplace', 'Descend'],
  wellness:['Sealed']
};

function keywordsFor(id, kind) {
  const o = manifest.abilityOverrides[id];
  if (o?.keywords) return o.keywords;
  return KEYWORDS_BY_KIND[kind] || ['Shard'];
}

// ────────── set membership
function setFor(id) {
  for (const [setName, def] of Object.entries(manifest.sets)) {
    if (def.members.includes(id)) return setName;
  }
  return null;
}

// ────────── type line
function typeLineFor(kind, chamber, rarity) {
  const shape = manifest.kinds[kind]?.shape || 'Blade Shape';
  const cham = chamber[0].toUpperCase() + chamber.slice(1);
  const rar = rarity[0].toUpperCase() + rarity.slice(1);
  return `${rar} · ${shape} · ${cham}`;
}

// ────────── denylist gate on every string
function gatePublicText(text, id) {
  if (!text) return text;
  if (DENY.test(text)) {
    throw new Error(`Denylist hit in text for ${id}: "${text}"`);
  }
  return text;
}

// ────────── SVG art generator (procedural)
const CHAMBER_PALETTE = manifest.chambers;
const KIND_SHAPE = {
  sdk:     'pillar',
  api:     'tower',
  mcp:     'loom',
  tool:    'blade',
  surface: 'arch',
  wellness:'well'
};
const RARITY_BORDER = {
  common:      { color: '#b8b6ad', glow: 0 },
  magic:       { color: '#4a7dc9', glow: 4 },
  rare:        { color: '#d4a017', glow: 8 },
  unique:      { color: '#b8974a', glow: 14 },
  set:         { color: '#3fa068', glow: 10 },
  'uber-unique': { color: '#c46a2e', glow: 20 },
  runeword:    { color: '#e6846e', glow: 12 },
  charm:       { color: '#9a6dbf', glow: 8 }
};

function svgFor(card) {
  const w = 300, h = 420;
  const chamber = CHAMBER_PALETTE[card.chamber] || CHAMBER_PALETTE.market;
  const border = RARITY_BORDER[card.rarity] || RARITY_BORDER.common;
  const shape = KIND_SHAPE[card.kind] || 'blade';

  // Kind emblem SVG paths (simple geometric primitives, D2R illuminated style)
  const emblems = {
    pillar: `<rect x="120" y="120" width="60" height="150" fill="${chamber.color}" opacity="0.5"/>
             <rect x="115" y="115" width="70" height="10" fill="${chamber.color}"/>
             <rect x="115" y="265" width="70" height="10" fill="${chamber.color}"/>
             <line x1="150" y1="125" x2="150" y2="265" stroke="${border.color}" stroke-width="1.5" opacity="0.7"/>`,
    tower:  `<polygon points="150,110 200,170 200,270 100,270 100,170" fill="${chamber.color}" opacity="0.5" stroke="${border.color}" stroke-width="1.2"/>
             <rect x="140" y="130" width="20" height="30" fill="${border.color}" opacity="0.8"/>
             <circle cx="150" cy="200" r="14" fill="none" stroke="${border.color}" stroke-width="1.4"/>`,
    loom:   `<line x1="100" y1="130" x2="100" y2="280" stroke="${chamber.color}" stroke-width="2.5" opacity="0.7"/>
             <line x1="200" y1="130" x2="200" y2="280" stroke="${chamber.color}" stroke-width="2.5" opacity="0.7"/>
             <line x1="100" y1="160" x2="200" y2="160" stroke="${border.color}" stroke-width="1"/>
             <line x1="100" y1="200" x2="200" y2="200" stroke="${border.color}" stroke-width="1"/>
             <line x1="100" y1="240" x2="200" y2="240" stroke="${border.color}" stroke-width="1"/>
             <line x1="100" y1="280" x2="200" y2="280" stroke="${border.color}" stroke-width="1"/>
             <polygon points="150,120 160,140 150,160 140,140" fill="${border.color}"/>`,
    blade:  `<polygon points="150,100 175,280 150,300 125,280" fill="${chamber.color}" opacity="0.6" stroke="${border.color}" stroke-width="1.5"/>
             <line x1="150" y1="110" x2="150" y2="295" stroke="${border.color}" stroke-width="0.8"/>
             <rect x="130" y="280" width="40" height="14" fill="${border.color}" opacity="0.8"/>
             <rect x="120" y="290" width="60" height="8" fill="${chamber.color}"/>`,
    arch:   `<path d="M 90 280 L 90 200 Q 90 130 150 130 Q 210 130 210 200 L 210 280" fill="${chamber.color}" opacity="0.45" stroke="${border.color}" stroke-width="1.6"/>
             <rect x="85" y="278" width="130" height="6" fill="${border.color}" opacity="0.8"/>
             <circle cx="150" cy="180" r="16" fill="none" stroke="${border.color}" stroke-width="1.4"/>
             <circle cx="150" cy="180" r="7" fill="${border.color}" opacity="0.7"/>`,
    well:   `<ellipse cx="150" cy="270" rx="65" ry="14" fill="${chamber.color}" opacity="0.35" stroke="${border.color}" stroke-width="1"/>
             <ellipse cx="150" cy="180" rx="55" ry="12" fill="${chamber.color}" opacity="0.55" stroke="${border.color}" stroke-width="1"/>
             <ellipse cx="150" cy="130" rx="40" ry="9" fill="${chamber.color}" opacity="0.7" stroke="${border.color}" stroke-width="1"/>
             <line x1="95" y1="180" x2="85" y2="270" stroke="${border.color}" stroke-width="1"/>
             <line x1="205" y1="180" x2="215" y2="270" stroke="${border.color}" stroke-width="1"/>`
  };
  const emblem = emblems[shape] || emblems.blade;

  // Escape XML in text
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nameShort = esc((card.name || card.id).slice(0, 22));
  const chamberLine = esc(card.chamber.toUpperCase());
  const typeLine = esc(card.typeLine);
  const flavour = esc(card.flavour);
  const kindBadge = esc(card.kind.toUpperCase());

  // Radial gradient background chamber-tinted
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <radialGradient id="g_${card.id}" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="${chamber.color}" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="#141218" stop-opacity="1"/>
      <stop offset="100%" stop-color="#0b0a0f" stop-opacity="1"/>
    </radialGradient>
    <filter id="grain_${card.id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
      <feColorMatrix values="0 0 0 0 0.06  0 0 0 0 0.06  0 0 0 0 0.08  0 0 0 0.14 0"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#g_${card.id})" rx="10"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#g_${card.id})" filter="url(#grain_${card.id})" rx="10" opacity="0.6"/>

  <!-- Rarity border -->
  <rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="none" stroke="${border.color}" stroke-width="2" rx="8" opacity="0.9"
        ${border.glow ? `filter="drop-shadow(0 0 ${border.glow}px ${border.color})"` : ''}/>

  <!-- Corner brackets -->
  <path d="M 8 22 L 8 8 L 22 8" fill="none" stroke="${border.color}" stroke-width="1.2"/>
  <path d="M ${w - 8} 22 L ${w - 8} 8 L ${w - 22} 8" fill="none" stroke="${border.color}" stroke-width="1.2"/>
  <path d="M 8 ${h - 22} L 8 ${h - 8} L 22 ${h - 8}" fill="none" stroke="${border.color}" stroke-width="1.2"/>
  <path d="M ${w - 8} ${h - 22} L ${w - 8} ${h - 8} L ${w - 22} ${h - 8}" fill="none" stroke="${border.color}" stroke-width="1.2"/>

  <!-- Sigil top-left -->
  <text x="22" y="42" font-family="DM Mono, monospace" font-size="24" fill="${border.color}" opacity="0.85">${card.sigil}</text>

  <!-- Kind badge top-right -->
  <rect x="215" y="22" width="70" height="22" fill="rgba(11,10,15,0.9)" stroke="${border.color}" stroke-width="0.6" rx="3"/>
  <text x="250" y="38" font-family="DM Mono, monospace" font-size="10" fill="${border.color}" text-anchor="middle" letter-spacing="1.5">${kindBadge}</text>

  <!-- Central emblem -->
  ${emblem}

  <!-- Divider before name -->
  <line x1="30" y1="315" x2="270" y2="315" stroke="${border.color}" stroke-width="0.7" opacity="0.5"/>

  <!-- Name -->
  <text x="150" y="336" font-family="Libre Baskerville, serif" font-size="15" fill="#e6d8b0" text-anchor="middle" font-weight="700">${nameShort}</text>

  <!-- Chamber line -->
  <text x="150" y="352" font-family="DM Mono, monospace" font-size="8" fill="${chamber.color}" text-anchor="middle" letter-spacing="2.5">${chamberLine}</text>

  <!-- Type-line -->
  <text x="150" y="366" font-family="DM Mono, monospace" font-size="7" fill="#8a857a" text-anchor="middle" letter-spacing="1.2">${typeLine}</text>

  <!-- Flavour -->
  <text x="150" y="384" font-family="Libre Baskerville, serif" font-size="8" fill="#8a857a" text-anchor="middle" font-style="italic">${flavour}</text>

  <!-- Stats bar -->
  <rect x="8" y="${h - 30}" width="${w - 16}" height="20" fill="rgba(11,10,15,0.9)" stroke="${border.color}" stroke-width="0.6" rx="3"/>
  <text x="30" y="${h - 15}" font-family="DM Mono, monospace" font-size="12" fill="#d44a4a" font-weight="700">⚔ ${card.atk}</text>
  <text x="118" y="${h - 15}" font-family="DM Mono, monospace" font-size="12" fill="#5aa25c" font-weight="700">♥ ${card.hp}</text>
  <text x="200" y="${h - 15}" font-family="DM Mono, monospace" font-size="12" fill="${chamber.color}" font-weight="700">✦ ${card.cost}</text>

  <!-- Socket dots -->
  ${Array.from({length: card.sockets}).map((_, i) => `<circle cx="${255 + i * 10}" cy="${h - 20}" r="3" fill="#3d3a45" stroke="${border.color}" stroke-width="0.6"/>`).join('')}
</svg>`;
}

// ────────── build cards
console.log('[build] deriving cards');
const cards = [];
const skipped = [];
for (const listing of listings.listings) {
  const id = listing.id;
  if (!isPublicSafe(id)) { skipped.push({ id, reason: 'private-slug' }); continue; }
  if (!titleIsSafe(listing.title)) { skipped.push({ id, reason: 'private-title', title: listing.title }); continue; }
  const listingKind = listing.kind;
  const kind = kindFor(id, listingKind);
  const chamber = chamberFor(id, kind);
  const grade = gradeFor(id, listing);
  const { rarity, tier } = rarityFor(id, grade);
  const { cost, atk, hp, sockets } = statsFor(id, kind, grade);
  const sigil = sigilFor(id);
  const set = setFor(id);
  const keywords = keywordsFor(id, kind);
  const flavour = flavourFor(id, kind);
  const typeLine = typeLineFor(kind, chamber, rarity);

  // apply overrides
  const override = manifest.abilityOverrides[id] || {};
  const genesisEntry = manifest.genesisSet.find(g => g.id === id);

  const card = {
    id,
    name: genesisEntry?.name || override.name || listing.title || id,
    kind, chamber, grade: Number(grade.toFixed(3)),
    rarity, tier, set,
    sigil,
    cost: override.cost ?? cost,
    atk: override.atk ?? atk,
    hp: override.hp ?? hp,
    sockets,
    keywords,
    flavour: genesisEntry?.flavour || flavour,
    typeLine,
    // Prefer github.com/<org>/<id> — repo pages are always live if the repo exists.
    // docs_url points at github.io/<id>/, which 404s for the majority of repos that never enabled Pages.
    url: listing.repo_url || `https://github.com/sjgant80-hub/${id}`,
    docsUrl: listing.docs_url || null,
    serial: null,
    seal: null,
    mintable: rarity !== 'common',
    bloodline: [] // filled Phase 7 with real fork data
  };

  // Denylist gate every text field
  for (const field of ['name', 'flavour', 'typeLine']) {
    gatePublicText(card[field], id);
  }

  cards.push(card);
}

// Synthesize Genesis cards for surfaces missing from listings.json
const existingIds = new Set(cards.map(c => c.id));
const synthesized = [];
for (const g of manifest.genesisSet) {
  if (existingIds.has(g.id)) continue;
  const kind = manifest.surfaceIds.includes(g.id) ? 'surface' : (manifest.wellnessIds.includes(g.id) ? 'wellness' : 'tool');
  const chamber = chamberFor(g.id, kind);
  const grade = 0.99;
  const { rarity, tier } = rarityFor(g.id, grade);
  const { cost, atk, hp, sockets } = statsFor(g.id, kind, grade);
  const override = manifest.abilityOverrides[g.id] || {};
  const card = {
    id: g.id, name: g.name || g.id, kind, chamber,
    grade, rarity, tier, set: setFor(g.id), sigil: g.sigil || sigilFor(g.id),
    cost: override.cost ?? cost, atk: override.atk ?? atk, hp: override.hp ?? hp, sockets,
    keywords: keywordsFor(g.id, kind),
    flavour: g.flavour || flavourFor(g.id, kind),
    typeLine: typeLineFor(kind, chamber, rarity),
    url: `https://github.com/sjgant80-hub/${g.id}`,
    docsUrl: `https://sjgant80-hub.github.io/${g.id}/`,
    serial: null, seal: null, mintable: true, bloodline: []
  };
  for (const field of ['name', 'flavour', 'typeLine']) gatePublicText(card[field], g.id);
  cards.push(card);
  synthesized.push(g.id);
}
if (synthesized.length) console.log('[build] synthesized', synthesized.length, 'Genesis cards from manifest:', synthesized.join(', '));

console.log('[build]', cards.length, 'cards derived,', skipped.length, 'skipped for private slug');

// ────────── write SVG art
if (existsSync(OUT_ART_DIR)) {
  for (const f of readdirSync(OUT_ART_DIR)) rmSync(join(OUT_ART_DIR, f));
}
mkdirSync(OUT_ART_DIR, { recursive: true });
let artWritten = 0;
for (const card of cards) {
  const svg = svgFor(card);
  writeFileSync(join(OUT_ART_DIR, card.id + '.svg'), svg, 'utf8');
  artWritten++;
}
console.log('[build] wrote', artWritten, 'SVGs to art/');

// ────────── seal · deterministic hash of cards.json content
const raw = JSON.stringify(cards);
const seal = createHash('sha256').update(raw).digest('hex');

// ────────── rarity distribution
const rarityDist = cards.reduce((acc, c) => { acc[c.rarity] = (acc[c.rarity] || 0) + 1; return acc; }, {});
const chamberDist = cards.reduce((acc, c) => { acc[c.chamber] = (acc[c.chamber] || 0) + 1; return acc; }, {});
const kindDist = cards.reduce((acc, c) => { acc[c.kind] = (acc[c.kind] || 0) + 1; return acc; }, {});

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
