// FallKard · test.mjs
// Real unit + integration suite for the Arena engine. Every assertion below was
// derived by importing the project's own source, calling it, and pinning the
// observed return value. Run with:  node test.mjs   (or: npm test)
//
// Covered source (all under ./arena):
//   engine.mjs   — seededRng, scoreCardForPlay, resolveMatch (deterministic reducer)
//   genome.mjs   — pearson, dCoupling, deckSignature/deckHash, dominantKind,
//                  updatePhase/heldSolids/matured, divBond, makeRandomAgent, forkAgent
//   clinic.mjs   — newJournal/record/readShadow, applyRemediation, chamberContext,
//                  scoreShape, TELLS
//
// The suite exists to protect the ENGINEERING invariants that make a tournament
// reproducible: a fixed seed yields a byte-identical verdict, content-addressed
// deck identity ignores insertion order, and the "bond" accounting stays lawful
// across a fork.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seededRng, resolveMatch, scoreCardForPlay } from './arena/engine.mjs';
import {
  pearson, dCoupling,
  deckSignature, deckHash, dominantKind,
  updatePhase, heldSolids, matured, HOLD_THRESHOLD, SOLIDS,
  divBond, makeRandomAgent, forkAgent
} from './arena/genome.mjs';
import {
  newJournal, record, readShadow,
  applyRemediation, chamberContext, scoreShape, TELLS
} from './arena/clinic.mjs';

// ---------------------------------------------------------------------------
// A deterministic synthetic card pool + lookup, reused by the engine tests.
// ---------------------------------------------------------------------------
function makePool() {
  const kinds = ['sdk', 'api', 'mcp', 'tool'];
  const chambers = ['market', 'forge', 'bridge', 'vault'];
  const pool = [];
  for (let i = 0; i < 40; i++) {
    pool.push({
      id: 'c' + i,
      cost: (i % 6) + 1,
      atk: (i % 5) + 1,
      hp: (i % 4) + 2,
      kind: kinds[i % 4],
      chamber: chambers[i % 4],
      rarity: 'common',
      keywords: []
    });
  }
  return pool;
}
const cardsByIDof = pool => Object.fromEntries(pool.map(c => [c.id, c]));

// ===========================================================================
// engine.seededRng — a seeded PRNG is the root of every reproducibility claim.
// ===========================================================================
test('seededRng is reproducible for a given seed', () => {
  const a = seededRng('abc');
  const b = seededRng('abc');
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  // first draw is a fixed, observed constant
  assert.equal(seqA[0], 0.35655662906356156);
});

test('seededRng diverges on a different seed', () => {
  assert.notEqual(seededRng('abc')(), seededRng('abd')());
  assert.equal(seededRng('abd')(), 0.8320725737139583);
});

test('seededRng stays within [0, 1)', () => {
  const r = seededRng('range-test');
  for (let i = 0; i < 5000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `draw ${v} out of range`);
  }
});

// ===========================================================================
// engine.scoreCardForPlay — the pure dot-product the deterministic mind uses.
// ===========================================================================
test('scoreCardForPlay applies default weights and the Sealed bonus', () => {
  const card = { currentAtk: 4, currentHp: 3, currentCost: 2, chamber: 'market', kind: 'sdk', keywords: ['Sealed'] };
  // 0.5*4 + 0.5*3 + 0.3*(10-|5-2|) + valSealed(1) = 2 + 1.5 + 2.1 + 1
  assert.equal(scoreCardForPlay(card, {}, 5), 6.6);
});

test('scoreCardForPlay honours explicit weights', () => {
  const card = { currentAtk: 4, currentHp: 3, currentCost: 2, chamber: 'market', kind: 'sdk', keywords: ['Sealed'] };
  // aggro 1*4 + hpBias 0 + curve 0 + valSealed 2 = 6
  assert.equal(scoreCardForPlay(card, { weights: { aggro: 1, hpBias: 0, curve: 0, valSealed: 2 } }, 2), 6);
});

// ===========================================================================
// genome.pearson / dCoupling — the coupling statistic behind admissibility.
// ===========================================================================
test('pearson returns +1 / -1 for perfect linear relationships', () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  assert.equal(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1);
});

test('pearson guards degenerate inputs with 0', () => {
  assert.equal(pearson([1], [1]), 0);        // n < 2
  assert.equal(pearson([5, 5, 5], [1, 2, 3]), 0); // zero variance in x
});

test('dCoupling reads score/outcome pairs off samples', () => {
  const c = dCoupling([{ score: 0.1, outcome: 1 }, { score: 0.2, outcome: 2 }, { score: 0.3, outcome: 3 }]);
  assert.ok(Math.abs(c - 1) < 1e-9, `expected ~1, got ${c}`);
});

// ===========================================================================
// genome.deckSignature / deckHash — content-addressed deck identity.
// ===========================================================================
test('deckSignature sorts by card id regardless of insertion order', () => {
  assert.equal(deckSignature({ genome: { cards: { b: 2, a: 1, c: 1 } } }), 'a:1;b:2;c:1');
});

test('deckHash is a stable 13-char hex content address', () => {
  const x = { genome: { cards: { b: 2, a: 1, c: 1 } } };
  const y = { genome: { cards: { c: 1, a: 1, b: 2 } } };
  assert.match(deckHash(x), /^[0-9a-f]{13}$/);
  assert.equal(deckHash(x), deckHash(y));  // same composition -> same identity
});

test('dominantKind reports the most-represented kind in a deck', () => {
  const cardsByID = { a: { kind: 'sdk' }, b: { kind: 'api' }, c: { kind: 'sdk' } };
  assert.equal(dominantKind({ genome: { cards: { a: 1, b: 1, c: 1 } } }, cardsByID), 'sdk');
});

// ===========================================================================
// genome maturity vector — updatePhase / heldSolids / matured.
// ===========================================================================
test('phase constants are the published five-shape vector', () => {
  assert.equal(HOLD_THRESHOLD, 0.618);
  assert.deepEqual(SOLIDS, ['genesis', 'forge', 'clinic', 'memory', 'swarm']);
});

test('a freshly born agent holds only genesis + forge', () => {
  const fresh = { genome: { cards: { a: 1 } }, journal: { matches: 0 }, lineage: { generation: 0, parent: null } };
  assert.deepEqual(updatePhase(fresh), { genesis: 1, forge: 1, clinic: 0, memory: 0, swarm: 0 });
  assert.equal(heldSolids(fresh), 2);
  assert.equal(matured(fresh), false);
});

test('an experienced, forked, deep-lineage agent is fully matured', () => {
  const grown = { genome: { cards: { a: 1 } }, journal: { matches: 12 }, lineage: { generation: 10, parent: 'x' } };
  assert.deepEqual(updatePhase(grown), { genesis: 1, forge: 1, clinic: 1, memory: 1, swarm: 1 });
  assert.equal(heldSolids(grown), 5);
  assert.equal(matured(grown), true);
});

// ===========================================================================
// genome.divBond + fork lawfulness — the "every weight has a card" invariant.
// ===========================================================================
test('makeRandomAgent builds a 30-card, lawful (divBond 0) agent', () => {
  const pool = makePool();
  const agent = makeRandomAgent(pool, seededRng('a1'), 0);
  const total = Object.values(agent.genome.cards).reduce((s, n) => s + n, 0);
  assert.equal(total, 30);
  assert.equal(divBond(agent, pool), 0);
});

test('divBond counts an orphan bias weight with no backing card', () => {
  const pool = makePool();
  const agent = makeRandomAgent(pool, seededRng('a1'), 0);
  const orphan = JSON.parse(JSON.stringify(agent));
  orphan.policy.weights.chamberBias = { ...(orphan.policy.weights.chamberBias || {}), zzz_nonexistent: 0.5 };
  assert.equal(divBond(orphan, pool), 1);
});

test('forkAgent advances lineage and stays lawful', () => {
  const pool = makePool();
  const parent = makeRandomAgent(pool, seededRng('a1'), 0);
  const child = forkAgent(parent, pool, seededRng('fork1'), 0.25);
  assert.equal(child.lineage.generation, parent.lineage.generation + 1);
  assert.equal(child.lineage.parent, parent.agentId);
  assert.equal(divBond(child, pool), 0);
});

// ===========================================================================
// clinic — journal accumulation, shadow, remediation, context.
// ===========================================================================
test('TELLS is the seven-tell vocabulary', () => {
  assert.deepEqual(TELLS, ['hoard', 'blindspot', 'loop', 'freeze', 'tunnel', 'echo', 'miss']);
});

test('newJournal starts empty and record accumulates the shadow', () => {
  const j = newJournal();
  assert.deepEqual(j, { matches: 0, sums: { hoard: 0, blindspot: 0, loop: 0, freeze: 0, tunnel: 0, echo: 0, miss: 0 } });
  record(j, { hoard: 0.5, blindspot: 0.1, loop: 0, freeze: 0, tunnel: 0, echo: 0, miss: 0 });
  record(j, { hoard: 0.7, blindspot: 0.1, loop: 0, freeze: 0, tunnel: 0, echo: 0, miss: 0 });
  assert.equal(j.matches, 2);
  const shadow = readShadow(j);
  assert.equal(shadow.axis, 'hoard');
  assert.equal(shadow.amplitude, 0.6);  // mean of 0.5 and 0.7
});

test('applyRemediation for the freeze tell nudges aggro upward', () => {
  const w = { aggro: 0.5 };
  applyRemediation(w, 'freeze', 1, {});
  assert.equal(w.aggro, 0.64);  // 0.5 + 0.14
});

test('chamberContext names the dominant and neglected chambers', () => {
  const trace = { turns: 3, chamberCounts: { market: 3, forge: 1 } };
  assert.deepEqual(chamberContext(trace, new Set(['market', 'forge', 'vault'])), { dominant: 'market', neglected: 'vault' });
});

test('scoreShape of an empty trace is the zero vector', () => {
  assert.deepEqual(scoreShape(null, null, null), { hoard: 0, blindspot: 0, loop: 0, freeze: 0, tunnel: 0, echo: 0, miss: 0 });
});

// ===========================================================================
// engine.resolveMatch — the whole reason the seeds exist: same input -> same
// verdict. This is the integration invariant the headless GA depends on.
// ===========================================================================
test('resolveMatch is deterministic for a fixed seed and agents', () => {
  const pool = makePool();
  const cardsByID = cardsByIDof(pool);
  const a = makeRandomAgent(pool, seededRng('a1'), 0);
  const b = makeRandomAgent(pool, seededRng('a2'), 0);
  const m1 = resolveMatch({ agentA: a, agentB: b, seed: 'match-1', cardsByID });
  const m2 = resolveMatch({ agentA: a, agentB: b, seed: 'match-1', cardsByID });
  assert.deepEqual(m1, m2);
  // pinned, observed verdict for this exact configuration
  assert.deepEqual(m1, { verdict: 'A', aHp: 16, bHp: 0, turns: 9 });
});

test('resolveMatch yields a legal verdict and positive turn count', () => {
  const pool = makePool();
  const cardsByID = cardsByIDof(pool);
  const a = makeRandomAgent(pool, seededRng('a1'), 0);
  const b = makeRandomAgent(pool, seededRng('a2'), 0);
  const m = resolveMatch({ agentA: a, agentB: b, seed: 'match-2', cardsByID });
  assert.ok(['A', 'B', 'draw'].includes(m.verdict));
  assert.ok(m.turns > 0);
  assert.ok(m.aHp <= 0 || m.bHp <= 0 || m.turns >= 1);
});

test('resolveMatch with record:true emits per-player traces without changing the verdict', () => {
  const pool = makePool();
  const cardsByID = cardsByIDof(pool);
  const a = makeRandomAgent(pool, seededRng('a1'), 0);
  const b = makeRandomAgent(pool, seededRng('a2'), 0);
  const plain = resolveMatch({ agentA: a, agentB: b, seed: 'match-1', cardsByID });
  const traced = resolveMatch({ agentA: a, agentB: b, seed: 'match-1', cardsByID, record: true });
  assert.equal(traced.verdict, plain.verdict);
  assert.equal(traced.turns, plain.turns);
  assert.ok(traced.trace && traced.trace.A && traced.trace.B);
  assert.equal(typeof traced.trace.A.turns, 'number');
  assert.ok(traced.trace.A.turns > 0);
});
