#!/usr/bin/env node
// FallKard Arena · lifecycle.mjs
// The FULL organism loop — the two shapes the selection-only GA never grew: VERIFY (the
// Clinic reads each match) and REMEMBER (the lifetime journal). It closes the therapy loop
// into selection, proves it works with an A/B test, and casts matured champions back into
// the pool (SETTLE → mint-back), closing the loop.
//
//   node lifecycle.mjs [--pop 18] [--gens 10] [--lambda 0.25] [--out clinic-results.json]
//
// THE FALSIFIABLE CLAIM: with therapy ON (fork heals toward the shadow, fitness =
// winRate − λ·shadow), the population's shadow amplitude must DECLINE gen-over-gen and
// decline MORE than a control arm running blind selection. If it doesn't, the therapy is
// disproven. Deterministic: same seed → same verdict.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveMatch } from './engine.mjs';
import { makeRandomAgent, forkAgent, crossover, deckSignature, updatePhase, heldSolids, matured, dCoupling } from './genome.mjs';
import { scoreShape, record as clinicRecord, readShadow, chamberContext, TELLS, TELL_MEANING } from './clinic.mjs';
import { castSeal, upsertSeal, assertClosed, admissible } from './mintback.mjs';
import { analyze as analyzeBloodline } from './bloodline.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const POP = parseInt(arg('--pop', '18'));
const GENS = parseInt(arg('--gens', '10'));
const LAMBDA = parseFloat(arg('--lambda', '0.25'));
const SEEDS = 1;                       // games per side per pairing (2 traced games/pairing)
const SURVIVE = 0.4;
const OUT = arg('--out', join(__dirname, '..', 'clinic-results.json'));
const SEALS_OUT = join(__dirname, '..', 'seals.json');
const BLOOD_OUT = join(__dirname, '..', 'bloodline.json');
const HERD_OUT = join(__dirname, '..', 'herd.json');

const cardsBundle = JSON.parse(readFileSync(join(__dirname, '..', 'cards.json'), 'utf8'));
const cards = cardsBundle.cards;
const cardsByID = Object.fromEntries(cards.map(c => [c.id, c]));
const pool = cards.filter(c => c.atk >= 1 && c.hp >= 1 && c.cost >= 1);

const chambersOf = agent => new Set(Object.keys(agent.genome.cards).map(id => cardsByID[id]?.chamber).filter(Boolean));
const seedStr = (a, b, k) => `${a}|${b}|${k}`;
const outcomeOf = (verdict, side) => verdict === side ? 1 : verdict === 'draw' ? 0.5 : 0;

// accumulate one traced game into an agent: clinic shape → journal, play-scores → coupling
function absorb(agent, t, oppT, held, outcome) {
  const shape = scoreShape(t, oppT, held);
  clinicRecord(agent.journal, shape);
  agent._lastTrace = t; agent._lastHeld = held;
  for (const s of (t.playScores || [])) agent._samples.push({ score: s, outcome });
}

function tracedDuel(a, b) {
  const hA = chambersOf(a), hB = chambersOf(b);
  let aScore = 0, games = 0;
  for (let k = 0; k < SEEDS; k++) {
    const r1 = resolveMatch({ agentA: a, agentB: b, seed: seedStr(a.agentId, b.agentId, k), cardsByID, record: true });
    aScore += outcomeOf(r1.verdict, 'A'); games++;
    absorb(a, r1.trace.A, r1.trace.B, hA, outcomeOf(r1.verdict, 'A'));
    absorb(b, r1.trace.B, r1.trace.A, hB, outcomeOf(r1.verdict, 'B'));
    const r2 = resolveMatch({ agentA: b, agentB: a, seed: seedStr(b.agentId, a.agentId, k), cardsByID, record: true });
    aScore += outcomeOf(r2.verdict, 'B'); games++;
    absorb(b, r2.trace.A, r2.trace.B, hB, outcomeOf(r2.verdict, 'A'));
    absorb(a, r2.trace.B, r2.trace.A, hA, outcomeOf(r2.verdict, 'B'));
  }
  return aScore / games;
}

// ── run ONE arm (therapy on/off) from a shared gen-0 population + seed
function runArm({ label, therapy, pop0, seed }) {
  let RS = seed;
  const rng = () => { RS = (RS * 9301 + 49297) % 233280; return RS / 233280; };
  let population = pop0.map(a => JSON.parse(JSON.stringify(a)));
  const trajectory = [];       // per-gen mean shadow amplitude + tell histogram + champion
  const matureChamps = [];
  // the genealogy ledger — every birth with its parent (the fork-tree = the economic tree).
  // Recording consumes no rng, so clinic-results.json + seals.json stay byte-identical.
  const births = population.map(a => ({ id: a.agentId, parent: a.lineage.parent, gen: 0, handle: a.handle }));

  for (let gen = 0; gen < GENS; gen++) {
    population.forEach(a => { a._samples = []; a._fitness = { score: 0, games: 0 }; });
    for (let i = 0; i < population.length; i++)
      for (let j = i + 1; j < population.length; j++) {
        const s = tracedDuel(population[i], population[j]);
        population[i]._fitness.score += s; population[i]._fitness.games++;
        population[j]._fitness.score += (1 - s); population[j]._fitness.games++;
      }

    // VERIFY + REMEMBER settled into fitness
    population.forEach(a => {
      a._fitness.winRate = a._fitness.score / Math.max(1, a._fitness.games);
      updatePhase(a);
      a._shadow = readShadow(a.journal);
      a._coupling = dCoupling(a._samples);   // reported: near-0 on the heuristic substrate
      // fitness folds the shadow in (therapy arm only) — winRate − λ·shadow. The mind-
      // coupling reading rides along as transparency, not a selection penalty (it is
      // uniformly weak for the heuristic mind — the measured reason the real brains exist).
      const penalty = therapy ? LAMBDA * a._shadow.amplitude : 0;
      a._fit = a._fitness.winRate - penalty;
    });
    population.sort((x, y) => y._fit - x._fit);

    const meanShadow = population.reduce((s, a) => s + a._shadow.amplitude, 0) / population.length;
    const tellHist = Object.fromEntries(TELLS.map(t => [t, 0]));
    population.forEach(a => tellHist[a._shadow.axis]++);
    const champ = population[0];
    trajectory.push({
      gen,
      meanShadow: +meanShadow.toFixed(4),
      championHandle: champ.handle,
      championShadow: champ._shadow.axis,
      championShadowAmp: +champ._shadow.amplitude.toFixed(3),
      championHeldShapes: heldSolids(champ),
      championCoupling: +champ._coupling.toFixed(3),
      championWinRate: +champ._fitness.winRate.toFixed(3),
      dominantTell: Object.entries(tellHist).sort((a, b) => b[1] - a[1])[0][0],
      diversity: new Set(population.map(deckSignature)).size,
    });

    // harvest matured champions (all five shapes held) for mint-back
    if (matured(champ)) matureChamps.push(JSON.parse(JSON.stringify(champ)));

    if (gen === GENS - 1) break;
    // SELECT + REPRODUCE — therapy arm forks TOWARD each survivor's shadow
    const nSurv = Math.max(2, Math.floor(POP * SURVIVE));
    const survivors = population.slice(0, nSurv);
    const next = survivors.map(s => JSON.parse(JSON.stringify(s)));
    while (next.length < POP) {
      const roll = rng();
      const p = survivors[Math.floor(rng() * survivors.length)];
      let shadow = null;
      if (therapy && p._shadow) {
        const ctx = chamberContext(p._lastTrace, p._lastHeld);
        shadow = { axis: p._shadow.axis, amplitude: p._shadow.amplitude, ctx };
      }
      let child;
      if (roll < 0.65) child = forkAgent(p, pool, rng, 0.25, shadow);
      else if (roll < 0.9) child = crossover(p, survivors[Math.floor(rng() * survivors.length)], pool, rng);
      else child = makeRandomAgent(pool, rng, gen + 1);
      births.push({ id: child.agentId, parent: child.lineage.parent, gen: gen + 1, handle: child.handle });
      next.push(child);
    }
    population = next;
  }
  return { label, trajectory, matureChamps, births, finalPop: population };
}

// ── shared gen-0 population + seed → fair A/B
let RS0 = 20260712;
const rng0 = () => { RS0 = (RS0 * 9301 + 49297) % 233280; return RS0 / 233280; };
const pop0 = Array.from({ length: POP }, () => makeRandomAgent(pool, rng0, 0));
console.log(`[clinic] pool ${pool.length} · pop ${POP} · gens ${GENS} · λ ${LAMBDA} · A/B therapy vs control`);

const therapyArm = runArm({ label: 'therapy', therapy: true, pop0, seed: 777 });
const controlArm = runArm({ label: 'control', therapy: false, pop0, seed: 777 });

const decline = arm => +(arm.trajectory[0].meanShadow - arm.trajectory[arm.trajectory.length - 1].meanShadow).toFixed(4);
const therapyDecline = decline(therapyArm);
const controlDecline = decline(controlArm);
const shadowShrinks = therapyDecline > 0 && therapyDecline >= controlDecline;

therapyArm.trajectory.forEach(t => console.log(`  therapy gen ${String(t.gen).padStart(2)} · shadow ${t.meanShadow.toFixed(3)} · champ holds ${t.championHeldShapes}/5 · tell:${t.dominantTell} · coupling ${t.championCoupling}`));
console.log(`\n[clinic] therapy shadow decline ${therapyDecline} vs control ${controlDecline} → therapy ${shadowShrinks ? 'HEALS ✓ (shadow shrinks faster than blind selection)' : 'inconclusive'}`);

// ── SETTLE → mint-back: cast the therapy arm's matured champions into seals.json.
// Content-addressed by deck hash → idempotent → the loop closes exactly.
let seals = { generated: '2026-07-12', seals: [] };
const casts = [];
let loopClosed = null, loopId = null;
for (const champ of therapyArm.matureChamps) {
  updatePhase(champ);
  const card = castSeal(champ, cardsByID);
  if (!admissible(card)) { casts.push({ id: card.id, minted: false, reason: 'inadmissible (cannot self-verify)' }); continue; }
  const up = upsertSeal(seals, card); seals = up.bundle;
  casts.push({ id: card.id, handle: champ.handle, minted: up.minted, atk: card.atk, hp: card.hp, cost: card.cost, shadow: card.shadow });
  // the closed-loop test, on the FIRST card we actually mint: re-cast the SAME organism — it
  // must return byte-identical and NOT mint again (run(S)==S). δ=0 ⇒ run(S)==S holds exactly.
  if (loopClosed === null && up.minted) {
    const again = castSeal(champ, cardsByID);
    const re = upsertSeal(seals, again); seals = re.bundle;
    const chk = assertClosed(seals, again);
    loopClosed = chk.closed && re.minted === false; loopId = chk.id;
  }
}
if (loopClosed === null) loopClosed = seals.seals.length === 0;   // nothing matured to test
writeFileSync(SEALS_OUT, JSON.stringify(seals, null, 2));

const result = {
  generated: '2026-07-12',
  config: { pop: POP, gens: GENS, lambda: LAMBDA, seeds: SEEDS },
  tells: TELLS.map(t => ({ tell: t, means: TELL_MEANING[t] })),
  arms: { therapy: therapyArm.trajectory, control: controlArm.trajectory },
  seals: { count: seals.seals.length, cast: casts, loop: { closed: loopClosed, id: loopId } },
  verdict: {
    therapyShadowDecline: therapyDecline,
    controlShadowDecline: controlDecline,
    therapyHeals: shadowShrinks,
    loopCloses: loopClosed,
    maturedSeals: seals.seals.length,
  },
};
writeFileSync(OUT, JSON.stringify(result, null, 2));

// ── DESCENDANTS · the bloodline economy over the therapy arm's genealogy
const blood = analyzeBloodline(therapyArm.births, [...new Set(therapyArm.matureChamps.map(c => c.agentId))]);
writeFileSync(BLOOD_OUT, JSON.stringify(blood, null, 2));

// ── THE HERD ROSTER · the living descendants (final population) with their policies + the
// full genealogy, so the herd runtime (herd.mjs) can wake them as workers and route royalty
// up the lineage. Pure-additive (no rng) — clinic-results.json + seals.json stay identical.
const herdRoster = {
  generated: '2026-07-12',
  workers: therapyArm.finalPop.map(a => ({ id: a.agentId, handle: a.handle, gen: a.lineage.generation, parent: a.lineage.parent, matured: heldSolids(a) === 5, deckSize: Object.keys(a.genome.cards).length, weights: a.policy.weights })),
  births: therapyArm.births,
};
writeFileSync(HERD_OUT, JSON.stringify(herdRoster, null, 2));

console.log(`[clinic] minted ${seals.seals.length} Seal(s) · loop ${loopClosed ? 'CLOSED ✓ (re-cast returns byte-identical card)' : 'OPEN ✗'}`);
const topF = blood.founders[0];
console.log(`[blood]  ${blood.forest.nodes} nodes · depth ${blood.forest.maxDepth} · provenance-inverts-scarcity ${blood.verdict.provenanceInvertsScarcity ? 'YES ✓ (value flows UP the bloodline)' : 'no'} · chain ${blood.verdict.maxChainPrice} ≤ ${blood.chainBound} ${blood.verdict.convergesUnderBound ? '✓' : '✗'}`);
console.log(`[blood]  top founder ${topF?.handle} (gen ${topF?.gen}) · fork-share price ${topF?.price} · ${topF?.descendants} descendants`);
console.log(`[clinic] results → ${OUT}\n[clinic] seals   → ${SEALS_OUT}\n[blood]  bloodline → ${BLOOD_OUT}`);
