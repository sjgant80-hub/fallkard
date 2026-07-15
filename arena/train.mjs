#!/usr/bin/env node
// FallKard Arena · train.mjs
// A5 — close the learning loop. The population loop (lifecycle.mjs) evolves ACROSS
// organisms; this trains WITHIN one. It takes the arena champion, builds a replay corpus
// by self-play against a frozen benchmark field (each match = a labeled datapoint
// {genomeA, genomeB, seed} → {verdict, traces}), and fits the champion's policy weights by
// evolutionary hill-climb to maximise  fitness = winRate − λ·shadow  while keeping the
// mind coupled to outcomes (dCoupling ≠ 0). Baldwin co-evolution: the mind learns to fit
// its own body inside a lifetime instead of waiting for selection.
//
//   node train.mjs [--field 10] [--steps 40] [--lambda 0.25] [--out trained-policy.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveMatch } from './engine.mjs';
import { makeRandomAgent, forkAgent, dCoupling } from './genome.mjs';
import { scoreShape, record as clinicRecord, readShadow, newJournal } from './clinic.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const FIELD = parseInt(arg('--field', '10'));
const STEPS = parseInt(arg('--steps', '40'));
const LAMBDA = parseFloat(arg('--lambda', '0.25'));
const OUT = arg('--out', join(__dirname, '..', 'trained-policy.json'));

const cardsBundle = JSON.parse(readFileSync(join(__dirname, '..', 'cards.json'), 'utf8'));
const cardsByID = Object.fromEntries(cardsBundle.cards.map(c => [c.id, c]));
const pool = cardsBundle.cards.filter(c => c.atk >= 1 && c.hp >= 1 && c.cost >= 1);
const arena = JSON.parse(readFileSync(join(__dirname, '..', 'arena-results.json'), 'utf8'));

const chambersOf = a => new Set(Object.keys(a.genome.cards).map(id => cardsByID[id]?.chamber).filter(Boolean));
const outcomeOf = (v, s) => v === s ? 1 : v === 'draw' ? 0.5 : 0;

// deterministic rng
let RS = 424242;
const rng = () => { RS = (RS * 9301 + 49297) % 233280; return RS / 233280; };

// the learner = the arena champion, rebuilt as a live organism
const fc = arena.finalChampion;
const learner = {
  agentId: 'sim:' + fc.handle, handle: fc.handle,
  genome: { cards: fc.deck, sockets: fc.sockets || {}, house: (fc.topChambers?.[0]?.split(':')[0]) || 'market' },
  policy: { engine: 'heuristic', weights: JSON.parse(JSON.stringify(fc.style)) },
  lineage: fc.lineage || { parent: null, generation: 0 },
  _fitness: { w: 0, l: 0, d: 0 },
};

// frozen benchmark field — a COMPETITIVE mix so outcomes vary (coupling needs win/loss
// spread): half fresh-random, half the champion's own mutated kin (close, hard matches).
// The corpus is every match played against this field.
const field = [
  ...Array.from({ length: Math.ceil(FIELD / 2) }, () => makeRandomAgent(pool, rng, 0)),
  ...Array.from({ length: Math.floor(FIELD / 2) }, () => forkAgent(learner, pool, rng, 0.5)),
];

// evaluate a weight vector: play the field, build the labeled corpus, read fitness
function evaluate(weights) {
  const agent = { ...learner, policy: { engine: 'heuristic', weights } };
  const journal = newJournal();
  const samples = [];
  const held = chambersOf(agent);
  let score = 0, games = 0, corpus = 0;
  for (const opp of field) {
    for (let k = 0; k < 2; k++) {
      const r = resolveMatch({ agentA: agent, agentB: opp, seed: `${agent.agentId}|${opp.agentId}|${k}`, cardsByID, record: true });
      const o = outcomeOf(r.verdict, 'A');
      score += o; games++; corpus++;
      clinicRecord(journal, scoreShape(r.trace.A, r.trace.B, held));
      for (const s of r.trace.A.playScores) samples.push({ score: s, outcome: o });
    }
  }
  const winRate = score / games;
  const shadow = readShadow(journal);
  const coupling = dCoupling(samples);
  return { winRate, shadow, coupling, corpus, fitness: winRate - LAMBDA * shadow.amplitude };
}

const KEYS = ['aggro', 'curve', 'hpBias', 'lanePref', 'valSealed', 'valFork', 'valMarket'];
function mutate(weights) {
  const w = JSON.parse(JSON.stringify(weights));
  const k = KEYS[Math.floor(rng() * KEYS.length)];
  w[k] = Math.max(0, Math.min(2, (w[k] ?? 0.5) + (rng() - 0.5) * 0.3));
  return w;
}

// ── hill-climb: keep any mutation that improves fitness. The corpus grows every step.
let best = JSON.parse(JSON.stringify(learner.policy.weights));
let bestEval = evaluate(best);
const base = bestEval;
const traj = [{ step: 0, fitness: +bestEval.fitness.toFixed(4), winRate: +bestEval.winRate.toFixed(3), shadow: +bestEval.shadow.amplitude.toFixed(3), shadowAxis: bestEval.shadow.axis, coupling: +bestEval.coupling.toFixed(3) }];
let corpusTotal = bestEval.corpus, improvements = 0;

console.log(`[train] champion ${learner.handle} · field ${FIELD} · steps ${STEPS} · λ ${LAMBDA}`);
console.log(`[train] base   · winRate ${(base.winRate*100).toFixed(0)}% · shadow ${base.shadow.amplitude.toFixed(3)} (${base.shadow.axis}) · coupling ${base.coupling.toFixed(3)}`);
for (let step = 1; step <= STEPS; step++) {
  const cand = mutate(best);
  const ev = evaluate(cand);
  corpusTotal += ev.corpus;
  if (ev.fitness > bestEval.fitness) { best = cand; bestEval = ev; improvements++; }
  traj.push({ step, fitness: +bestEval.fitness.toFixed(4), winRate: +bestEval.winRate.toFixed(3), shadow: +bestEval.shadow.amplitude.toFixed(3), shadowAxis: bestEval.shadow.axis, coupling: +bestEval.coupling.toFixed(3) });
}

const out = {
  generated: '2026-07-12',
  champion: learner.handle,
  config: { field: FIELD, steps: STEPS, lambda: LAMBDA },
  corpusMatches: corpusTotal,
  improvements,
  base: { weights: learner.policy.weights, winRate: +base.winRate.toFixed(3), shadow: +base.shadow.amplitude.toFixed(3), shadowAxis: base.shadow.axis, coupling: +base.coupling.toFixed(3), fitness: +base.fitness.toFixed(4) },
  trained: { weights: best, winRate: +bestEval.winRate.toFixed(3), shadow: +bestEval.shadow.amplitude.toFixed(3), shadowAxis: bestEval.shadow.axis, coupling: +bestEval.coupling.toFixed(3), fitness: +bestEval.fitness.toFixed(4) },
  gain: { winRate: +(bestEval.winRate - base.winRate).toFixed(3), shadowReduced: +(base.shadow.amplitude - bestEval.shadow.amplitude).toFixed(3), fitness: +(bestEval.fitness - base.fitness).toFixed(4) },
  trajectory: traj,
  learned: bestEval.fitness > base.fitness,
};
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`[train] trained · winRate ${(bestEval.winRate*100).toFixed(0)}% · shadow ${bestEval.shadow.amplitude.toFixed(3)} (${bestEval.shadow.axis}) · coupling ${bestEval.coupling.toFixed(3)}`);
console.log(`[train] ${improvements} improvement(s) over ${STEPS} steps · corpus ${corpusTotal} matches · ${out.learned ? 'LEARNED ✓ (fitness rose from the replay corpus)' : 'no gain'}`);
console.log(`[train] → ${OUT}`);
