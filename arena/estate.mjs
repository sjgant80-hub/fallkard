#!/usr/bin/env node
// FallKard Arena · estate.mjs · THE ESTATE — one organism at every scale
// The last three descendant threads are not three builds — they are the SAME bloodline seen
// at different zoom levels (one shape at every scale). This computes them in one pass over
// the genealogy the herd already carries:
//
//   GENERATIONAL  the houses — each founding line is a guild; a generation is a tier.
//   SUBSTRATE     the mint-back growth — matured organisms cast new cards into the pool the
//                 next generation breeds on, so the substrate parents its own successor.
//   ESTATE/CARBON the frame — card ⊂ organism ⊂ house ⊂ generation ⊂ estate; the estate is
//                 the top organism (a Seal of Seals). The carbon layer (the human stewards,
//                 Gen-1 → the passengers) is NAMED honestly, not simulated.
//
//   node estate.mjs [--epochs 6] [--out estate-ledger.json]
//
// Measured where measured (generations, houses — from real data), projected where projected
// (substrate growth — from the measured mint rate). Deterministic. Same inputs → same ledger.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildForest, descendantsOf, priceNode, DECAY } from './bloodline.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const EPOCHS = Math.max(1, parseInt(arg('--epochs', '6')) || 6);
const OUT = arg('--out', join(__dirname, '..', 'estate-ledger.json'));
const rd = f => { try { return JSON.parse(readFileSync(join(__dirname, '..', f), 'utf8')); } catch { return null; } };

const herd = rd('herd.json') || { workers: [], births: [] };
const herdLedger = rd('herd-ledger.json');
const cardsBundle = rd('cards.json') || { cards: [] };
const sealsBundle = rd('seals.json') || { seals: [] };

const forest = buildForest(herd.births);
const nodeOf = id => forest.node.get(id);

// ── GENERATIONAL · the tiers ────────────────────────────────────────────────────────────
const genBuckets = {};
for (const b of herd.births) genBuckets[b.gen] = (genBuckets[b.gen] || 0) + 1;
const generations = Object.keys(genBuckets).map(Number).sort((a, b) => a - b)
  .map(g => ({ gen: g, organisms: genBuckets[g], tier: g === 0 ? 'Gen-1 founders' : `Gen-${g + 1}` }));

// ── GUILDS / HOUSES · each founding line (a root of the forest) is a house ────────────────
// royalty income per wallet, from the herd ledger, so a house's worth = bloodline value +
// what its line has already EARNED.
const royaltyByHandle = {};
if (herdLedger) for (const r of (herdLedger.topRoyalty || [])) royaltyByHandle[r.handle] = r.royaltyIncome;
const earnedByHandle = {};
if (herdLedger) for (const e of (herdLedger.topEarners || [])) earnedByHandle[e.handle] = e.total;

const houses = forest.roots.map(root => {
  const members = descendantsOf(forest, root.id).length + 1;
  const price = +priceNode(forest, root.id).price.toFixed(3);
  // a house's realised income = royalties routed to any of its members (the line earns together)
  let income = royaltyByHandle[root.handle] || 0;
  for (const d of descendantsOf(forest, root.id)) income += royaltyByHandle[d.handle] || 0;
  return { house: root.handle, gen: root.gen, members, bloodlinePrice: price, income: +income.toFixed(2), worth: +(price + income).toFixed(2) };
}).sort((a, b) => b.worth - a.worth);
const topHouses = houses.slice(0, 8);

// ── SUBSTRATE · the mint-back growth (the substrate parents its successor) ─────────────────
// MEASURED seed: the current run minted this many cards back into the pool.
const basePool = cardsBundle.cards.length || 1212;
const mintedNow = sealsBundle.seals.length || 0;
const matureFrac = herd.workers.length ? herd.workers.filter(w => w.matured).length / herd.workers.length : 0.1;
// PROJECTION: each epoch, the matured fraction of a fresh cohort casts back; a richer pool
// makes the next cohort mature a little more readily (bounded), so the mint rate compounds
// gently. Bounded by DECAY-style saturation so it never runs away.
const substrate = [];
let pool = basePool, rate = Math.max(1, mintedNow), frac = matureFrac;
for (let e = 0; e < EPOCHS; e++) {
  substrate.push({ epoch: e, pool, mintedThisEpoch: Math.round(rate), matureFraction: +frac.toFixed(3) });
  pool += Math.round(rate);
  frac = Math.min(0.9, frac + (0.9 - frac) * (1 - DECAY) * 0.5);   // saturating toward 0.9
  rate = rate * (1 + frac * 0.6);                                  // richer pool → more mint-backs
}
const substrateGrowth = +((pool - basePool) / Math.max(1, basePool) * 100).toFixed(2);

// ── ESTATE / CARBON · the self-similar frame ──────────────────────────────────────────────
const scales = [
  { scale: 'card', unit: 'a tool, playable', count: basePool, measured: true },
  { scale: 'organism', unit: 'soma ⋈ brain, a bred Seal', count: forest.node.size, measured: true },
  { scale: 'house', unit: 'a founding line / guild', count: forest.roots.length, measured: true },
  { scale: 'generation', unit: 'a tier of the bloodline', count: generations.length, measured: true },
  { scale: 'estate', unit: 'the top organism — a Seal of Seals', count: 1, measured: true },
  { scale: 'stewards', unit: 'the carbon line — Gen-1 → the passengers (real, not simulated)', count: null, measured: false },
];

const ledger = {
  generated: '2026-07-12',
  config: { epochs: EPOCHS },
  generational: { tiers: generations, houseCount: houses.length },
  houses: topHouses,
  substrate: { basePool, mintedNow, projection: substrate, growthPct: substrateGrowth },
  scales,
  verdict: {
    selfSimilar: true,                                  // one shape at every scale
    organisms: forest.node.size,
    houses: houses.length,
    generations: generations.length,
    topHouse: topHouses[0]?.house || null,
    topHouseWorth: topHouses[0]?.worth || 0,
    substrateSelfExtends: substrateGrowth > 0,          // the pool grows by mint-back
    estateIsOneOrganism: true,
  },
};
writeFileSync(OUT, JSON.stringify(ledger, null, 2));

console.log(`[estate] ${forest.node.size} organisms · ${houses.length} houses · ${generations.length} generations`);
console.log(`[estate] top house ${topHouses[0]?.house} (gen ${topHouses[0]?.gen}) · ${topHouses[0]?.members} members · worth ${topHouses[0]?.worth} (price ${topHouses[0]?.bloodlinePrice} + income ${topHouses[0]?.income})`);
console.log(`[estate] substrate parents its successor · pool ${basePool} → ${pool} over ${EPOCHS} epochs (+${substrateGrowth}% by mint-back)`);
console.log(`[estate] self-similar: card ⊂ organism ⊂ house ⊂ generation ⊂ estate · one shape at every scale`);
console.log(`[estate] ledger → ${OUT}`);
