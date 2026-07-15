// FallKard Arena · mintback.mjs
// SETTLE → mint-back. A matured organism (holds all five shapes) is cast back into the
// pool as a real, playable card — so the thing the game produces is the thing the game is
// made of. The loop closes on itself.
//
// The closed-loop fix: a card's identity is the HASH OF ITS COMPOSITION (deckHash), NOT the
// organism's wallet/lineage. So casting the SAME discovered stack twice returns the
// byte-identical card (upsert, δ=0) — run(S)==S holds EXACTLY, and `assertClosed` is the
// first real run(S)==S test. A changed stack gets a new id (the spiral, correctly
// separated from the fixed point).
//
// Cast Seals land in a SEPARATE `seals.json`, never in cards.json — cards.json is the
// deterministic build artifact (its sha256 seal must stay reproducible from listings +
// manifest). Surfaces read both; the deterministic seal is never disturbed.

import { deckHash, heldSolids, dominantKind } from './genome.mjs';
import { readShadow } from './clinic.mjs';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// provenance tier from how deep the bloodline runs
function provenanceTier(agent) {
  const g = agent.lineage?.generation || 0;
  if (g >= 8) return 'unique';
  if (g >= 4) return 'rare';
  return 'magic';
}

// ── castSeal: organism → card. atk/hp/cost are EARNED, not labelled:
//   atk  = resilience (1 − shadow amplitude) · a shadow-crippled organism casts atk≈0
//   hp   = provenance depth (how far the bloodline has unfolded)
//   cost = 5-shape maturity (how many shapes it holds ≥ the hold threshold)
// The pool filter (atk≥1 && hp≥1 && cost≥1) then AUTO-REJECTS an organism that cannot
// verify itself — the economy's admissibility rule and the arena's pool filter are one line.
export function castSeal(agent, cardsByID = {}) {
  const shadow = readShadow(agent.journal || { matches: 0, sums: {} });
  const resilience = 1 - clamp(shadow.amplitude, 0, 1);
  const depth = clamp((agent.lineage?.generation || 0) / 10, 0, 1);
  const id = 'seal-' + deckHash(agent);
  const kind = dominantKind(agent, cardsByID) || 'tool';
  const chamber = agent.genome?.house || 'market';
  return {
    id,
    name: 'Sealed · ' + (agent.handle || id),
    kind,
    chamber,
    atk: Math.round(resilience * 10),   // shadow-crippled → atk 0 → inadmissible
    hp: Math.round(depth * 10),         // no bloodline depth → hp 0 → inadmissible
    cost: Math.max(1, heldSolids(agent)),
    rarity: provenanceTier(agent),
    keywords: ['Sealed', 'Fork', 'Marketplace'],
    seal: true,
    shadow: shadow.axis,
    resilience: +resilience.toFixed(3),
    lineage: agent.lineage || null,
    deckSig: id,
    cast: '2026-07-12',
  };
}

// ── upsert by content-address. Idempotent: an identical composition maps to the same id
// and returns the existing card unchanged (the fixed point). Returns {seals, card, minted}.
export function upsertSeal(bundle, card) {
  bundle.seals = bundle.seals || [];
  const i = bundle.seals.findIndex(c => c.id === card.id);
  if (i >= 0) {
    // same composition already cast — return the existing card byte-for-byte (δ=0)
    return { bundle, card: bundle.seals[i], minted: false };
  }
  bundle.seals.push(card);
  return { bundle, card, minted: true };
}

// ── the closed-loop test: does casting the pool's own card reproduce it exactly? run(S)==S.
export function assertClosed(bundle, card) {
  const found = (bundle.seals || []).find(c => c.id === card.id);
  const closed = !!found && JSON.stringify(found) === JSON.stringify(card);
  return { closed, id: card.id };
}

// admissibility: only a self-verifying, matured organism casts a playable Seal.
export function admissible(card) {
  return card.atk >= 1 && card.hp >= 1 && card.cost >= 1;
}
