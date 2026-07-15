// FallKard Arena · genome.mjs
// Agent = {agentId, handle, genome, policy, lineage, phase, journal}. Create · mutate · fork.
// Deterministic given a seeded rng so tournaments are reproducible.

import { newJournal, applyRemediation } from './clinic.mjs';

// The five shapes the organism matures through. It is not "done" until it HOLDS all five
// at or above the hold threshold. genesis=born, forge=body assembled, clinic=verified
// through enough matches, memory=bloodline depth, swarm=has forked. clinic+memory are the
// two that persist a self — the two a selection-only agent never grows.
export const HOLD_THRESHOLD = 0.618;
export const SOLIDS = ['genesis', 'forge', 'clinic', 'memory', 'swarm'];

const CHAMBERS = ['market','colony','estate','vault','clinic','studio','forge','reach','bridge'];
const KINDS = ['sdk','api','mcp','tool'];
const RUNES = ['El','Eld','Tir','Ith','Nef','Sol','Um','Ohm'];

const freshPhase = () => ({ genesis: 1, forge: 1, clinic: 0, memory: 0, swarm: 0 });
const clamp01 = x => Math.max(0, Math.min(1, x));

let COUNTER = 0;
const NAMES = ['Swarm','Loom','Forge','Bloom','Cinder','Vell','Rook','Kade','Nyx','Ø','Quill','Ash','Mire','Onyx','Sable','Wren','Fen','Bram','Corvid','Thane'];

// ── LAWFUL BIRTH · card→meta lookup (memoised per pool) so bias maps can be kept
// keyed ONLY over the chambers/kinds a deck actually plays. A brain that carried a
// weight for a chamber never in its deck is an "orphan weight" (a sink the body can
// never read) — divBond > 0. Sparse maps make divBond = 0 true by construction.
const _metaCache = new WeakMap();
function cardMetaOf(pool) {
  let m = _metaCache.get(pool);
  if (!m) { m = {}; for (const c of pool) m[c.id] = { chamber: c.chamber, kind: c.kind }; _metaCache.set(pool, m); }
  return m;
}
function realizedSupport(cards, meta) {
  const ch = new Set(), ki = new Set();
  for (const id of Object.keys(cards)) { const x = meta[id]; if (!x) continue; ch.add(x.chamber); ki.add(x.kind); }
  return { ch, ki };
}
// prune bias maps to realized support: keep existing weights for played chambers/kinds,
// seed newly-present ones at 0 (a neutral prior), drop weights for absent ones. Pure —
// no rng — so it never perturbs the deterministic tournament stream.
function pruneBias(weights, cards, meta) {
  const { ch, ki } = realizedSupport(cards, meta);
  const cb = {}; for (const c of ch) cb[c] = (weights.chamberBias && c in weights.chamberBias) ? weights.chamberBias[c] : 0;
  const kb = {}; for (const k of ki) kb[k] = (weights.kindBias && k in weights.kindBias) ? weights.kindBias[k] : 0;
  weights.chamberBias = cb; weights.kindBias = kb;
  return weights;
}
// the bond invariant: 0 = lawful (every weight has a card, every card has a weight).
export function divBond(agent, pool) {
  const meta = cardMetaOf(pool);
  const { ch, ki } = realizedSupport(agent.genome.cards, meta);
  const w = agent.policy.weights || {};
  let orphanW = 0, orphanC = 0;
  for (const c of Object.keys(w.chamberBias || {})) if (!ch.has(c)) orphanW++;
  for (const k of Object.keys(w.kindBias || {})) if (!ki.has(k)) orphanW++;
  for (const id of Object.keys(agent.genome.cards)) {
    const x = meta[id]; if (!x) continue;
    if (!(x.chamber in (w.chamberBias || {})) || !(x.kind in (w.kindBias || {}))) orphanC++;
  }
  return orphanW + orphanC;
}

// pool = array of card objects (id, cost, kind, chamber, rarity, keywords, atk, hp)
export function makeRandomAgent(pool, rng, gen = 0) {
  // Build a legal-ish 30-card deck weighted by a random "style"
  const style = {
    aggro: rng(),
    curve: rng(),
    hpBias: rng(),
    lanePref: rng(),
    valSealed: rng() * 2,
    valFork: rng() * 2,
    valMarket: rng() * 2,
    chamberBias: Object.fromEntries(CHAMBERS.map(c => [c, (rng() - 0.5)])),
    kindBias: Object.fromEntries(KINDS.map(k => [k, (rng() - 0.5)])),
  };
  // Deck: bias card picks toward the agent's favored chamber/kind
  const cards = {};
  let taken = 0;
  const scored = pool.map(c => ({
    c,
    s: (style.chamberBias[c.chamber] || 0) + (style.kindBias[c.kind] || 0) + rng() * 0.8
      + (c.rarity === 'uber-unique' ? 1.2 : c.rarity === 'unique' ? 0.6 : c.rarity === 'rare' ? 0.3 : 0)
  })).sort((a, b) => b.s - a.s);
  for (const { c } of scored) {
    const max = (c.rarity === 'unique' || c.rarity === 'uber-unique') ? 1 : 2;
    let n = 0;
    while (n < max && taken < 30) { n++; taken++; }
    if (n) cards[c.id] = n;
    if (taken >= 30) break;
  }
  const handle = NAMES[Math.floor(rng() * NAMES.length)] + '-' + (COUNTER++).toString(36);
  // lawful birth: the full style biased the draw above; the STORED brain keeps
  // weights only for the chambers/kinds this deck actually plays (divBond = 0).
  pruneBias(style, cards, cardMetaOf(pool));
  return {
    agentId: 'sim:' + handle,
    handle,
    genome: { cards, sockets: {}, house: CHAMBERS[Math.floor(rng() * CHAMBERS.length)] },
    policy: { engine: 'heuristic', weights: style },
    lineage: { parent: null, generation: gen, winsAtBirth: 0 },
    phase: freshPhase(),          // INIT ◇ born · the five-shape maturity vector
    journal: newJournal(),        // REMEMBER ⬠ the lifetime clinical record
    _fitness: { w: 0, l: 0, d: 0, lp: 1000, novelty: 0 },
  };
}

// Fork = clone + mutate. mutRate controls magnitude. `shadow` (optional) = the parent's
// weakest-tell reading {axis, amplitude, ctx}; when present the fork heals TOWARD it.
export function forkAgent(parent, pool, rng, mutRate = 0.25, shadow = null) {
  const child = JSON.parse(JSON.stringify(parent));
  child.lineage = { parent: parent.agentId, generation: parent.lineage.generation + 1, winsAtBirth: parent._fitness.w };
  child.handle = parent.handle.split('~')[0] + '~' + (COUNTER++).toString(36);
  child.agentId = 'sim:' + child.handle;
  child._fitness = { w: 0, l: 0, d: 0, lp: 1000, novelty: 0 };
  child.journal = newJournal();                       // a new organism remembers nothing yet
  child.phase = freshPhase(); child.phase.swarm = 1;  // born of EXPLORE ⬡

  // POLICY mutation — nudge weights
  const w = child.policy.weights;
  // THERAPY-DIRECTED mutation: with probability ∝ how loud the parent's shadow is, apply
  // the remediation for its weakest tell BEFORE the blind nudges. This is what turns fork
  // from random drift into directed healing — the shadow shapes the child, falsifiably.
  if (shadow && shadow.axis && rng() < clamp01(shadow.amplitude)) {
    applyRemediation(w, shadow.axis, shadow.amplitude, shadow.ctx || {});
  }
  for (const k of ['aggro','curve','hpBias','lanePref','valSealed','valFork','valMarket']) {
    if (rng() < mutRate) w[k] = Math.max(0, Math.min(2, w[k] + (rng() - 0.5) * mutRate * 2));
  }
  for (const c of CHAMBERS) if (rng() < mutRate * 0.5) w.chamberBias[c] += (rng() - 0.5) * mutRate;
  for (const kk of KINDS) if (rng() < mutRate * 0.5) w.kindBias[kk] += (rng() - 0.5) * mutRate;

  // COMPOSITION mutation — swap a few cards
  const ids = Object.keys(child.genome.cards);
  const swaps = Math.max(1, Math.floor(mutRate * 6));
  for (let s = 0; s < swaps; s++) {
    if (rng() < mutRate && ids.length) {
      // remove one
      const drop = ids[Math.floor(rng() * ids.length)];
      const wasN = child.genome.cards[drop];
      delete child.genome.cards[drop];
      // add one (biased by policy)
      const cand = pool[Math.floor(rng() * pool.length)];
      const max = (cand.rarity === 'unique' || cand.rarity === 'uber-unique') ? 1 : 2;
      child.genome.cards[cand.id] = Math.min(max, wasN || 1);
    }
  }
  // rune socket mutation — try to form a runeword occasionally
  if (rng() < mutRate) {
    const cardIds = Object.keys(child.genome.cards);
    if (cardIds.length) {
      const target = cardIds[Math.floor(rng() * cardIds.length)];
      child.genome.sockets[target] = child.genome.sockets[target] || [];
      if (child.genome.sockets[target].length < 3) child.genome.sockets[target].push(RUNES[Math.floor(rng() * RUNES.length)]);
    }
  }
  // keep the bond lawful across the fork: composition mutation may have added a
  // card from a new chamber/kind (seed its weight at 0) or dropped the last of one.
  pruneBias(child.policy.weights, child.genome.cards, cardMetaOf(pool));
  return child;
}

// crossover — merge two parents' decks (shared cards kept, rest sampled)
export function crossover(a, b, pool, rng) {
  const child = JSON.parse(JSON.stringify(a));
  child.lineage = { parent: a.agentId, coParent: b.agentId, generation: Math.max(a.lineage.generation, b.lineage.generation) + 1, winsAtBirth: a._fitness.w };
  child.handle = a.handle.split('~')[0] + '×' + b.handle.split('~')[0].slice(0,3) + '-' + (COUNTER++).toString(36);
  child.agentId = 'sim:' + child.handle;
  child._fitness = { w:0,l:0,d:0,lp:1000,novelty:0 };
  child.journal = newJournal();                       // fresh organism, empty memory
  child.phase = freshPhase(); child.phase.swarm = 1;  // recombination is an EXPLORE act
  // deck: union then trim to 30, prefer shared
  const merged = {};
  const shared = Object.keys(a.genome.cards).filter(id => b.genome.cards[id]);
  shared.forEach(id => merged[id] = Math.min(2, Math.max(a.genome.cards[id], b.genome.cards[id])));
  const rest = [...new Set([...Object.keys(a.genome.cards), ...Object.keys(b.genome.cards)])].filter(id => !merged[id]);
  rndShuffle(rest, rng);
  let taken = Object.values(merged).reduce((s,n)=>s+n,0);
  for (const id of rest) { if (taken >= 30) break; const n = a.genome.cards[id] || b.genome.cards[id] || 1; merged[id] = n; taken += n; }
  child.genome.cards = merged;
  // policy: average the parents' weights
  const wa = a.policy.weights, wb = b.policy.weights, wc = child.policy.weights;
  for (const k of ['aggro','curve','hpBias','lanePref','valSealed','valFork','valMarket']) wc[k] = ((wa[k]||0)+(wb[k]||0))/2;
  // the merged deck spans both parents' chambers/kinds — prune to that union so the
  // inherited (parent a's) bias map stays lawful for the new body.
  pruneBias(child.policy.weights, child.genome.cards, cardMetaOf(pool));
  return child;
}

function rndShuffle(arr, rng) { for (let i = arr.length-1; i>0; i--) { const j = Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

export function deckSignature(agent) {
  return Object.entries(agent.genome.cards).sort().map(([id,n]) => id+':'+n).join(';');
}

// ── content address: identity = HASH OF COMPOSITION, so the same discovered stack is the
// same card regardless of who forged it or which wallet paid (the closed-loop dedup key).
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(13, '0');
}
export function deckHash(agent) { return cyrb53(deckSignature(agent)); }

// the dominant kind (sdk/api/mcp/tool) across the deck — what the organism mostly is.
export function dominantKind(agent, cardsByID = {}) {
  const counts = {};
  for (const [id, n] of Object.entries(agent.genome.cards)) {
    const c = cardsByID[id]; if (!c || !c.kind) continue;
    counts[c.kind] = (counts[c.kind] || 0) + n;
  }
  let best = null, max = -1;
  for (const [k, v] of Object.entries(counts)) if (v > max) { max = v; best = k; }
  return best;
}

// ── the five-shape maturity. Recompute clinic (verified-through-matches), memory
// (bloodline depth) and swarm (has forked) from live state; read how many are held ≥ the hold threshold.
export function updatePhase(agent) {
  const p = agent.phase || (agent.phase = freshPhase());
  p.genesis = 1;
  p.forge = Object.keys(agent.genome.cards).length ? 1 : 0;
  p.clinic = clamp01((agent.journal?.matches || 0) / 6);      // verified through ≥ ~4 matches
  p.memory = clamp01((agent.lineage?.generation || 0) / 8);   // bloodline depth
  p.swarm  = (agent.lineage?.parent || agent._forked) ? 1 : (p.swarm || 0);
  return p;
}
export function heldSolids(agent) {
  const p = agent.phase || freshPhase();
  return SOLIDS.reduce((n, s) => n + ((p[s] || 0) >= HOLD_THRESHOLD ? 1 : 0), 0);
}
export function matured(agent) { return heldSolids(agent) === SOLIDS.length; }

// ── dCoupling (A4 step 5): correlation between the score the mind assigned a play and the
// realized outcome of that play. A frozen rng brain scores ~0 and is INADMISSIBLE — this
// replaces the count-based divBond with a check that actually reads a weight VALUE.
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const x = xs[i], y = ys[i]; sx += x; sy += y; sxx += x*x; syy += y*y; sxy += x*y; }
  const cov = n * sxy - sx * sy;
  const dx = n * sxx - sx * sx, dy = n * syy - sy * sy;
  return (dx > 0 && dy > 0) ? cov / Math.sqrt(dx * dy) : 0;
}
export function dCoupling(samples) {
  return pearson(samples.map(s => s.score), samples.map(s => s.outcome));
}
