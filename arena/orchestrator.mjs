#!/usr/bin/env node
// FallKard Arena · orchestrator.mjs
// The evolution loop. Seeds a population of agent-genomes, runs generational
// tournaments via the deterministic battle engine, selects survivors, forks +
// mutates them, and measures fitness vs a FROZEN gen-0 benchmark so we can SEE
// the population get fitter generation over generation.
//
//   node orchestrator.mjs [--pop 24] [--gens 12] [--seeds 3] [--out arena-results.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveMatch } from './engine.mjs';
import { makeRandomAgent, forkAgent, crossover, deckSignature } from './genome.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i+1] : d; };
const POP = parseInt(arg('--pop', '24'));
const GENS = parseInt(arg('--gens', '12'));
const SEEDS = parseInt(arg('--seeds', '3'));       // matches per pairing (different shuffles)
const OUT = arg('--out', join(__dirname, '..', 'arena-results.json'));
const SURVIVE = 0.4;                                // top 40% survive each gen

// deterministic rng for the whole run (reproducible)
let RS = 12345;
const rng = () => { RS = (RS * 9301 + 49297) % 233280; return RS / 233280; };
const seedStr = (a, b, k) => `${a}|${b}|${k}`;

// ── load cards
const cardsBundle = JSON.parse(readFileSync(join(__dirname, '..', 'cards.json'), 'utf8'));
const cards = cardsBundle.cards;
const cardsByID = Object.fromEntries(cards.map(c => [c.id, c]));
// pool = playable cards (exclude the tiny/degenerate; keep real stat cards)
const pool = cards.filter(c => c.atk >= 1 && c.hp >= 1 && c.cost >= 1);
console.log(`[arena] pool ${pool.length} cards · pop ${POP} · gens ${GENS} · ${SEEDS} seeds/pairing`);

// ── battle: play SEEDS games (alternating who's A), return A's score (1 win, .5 draw)
function duel(a, b) {
  let aWins = 0, games = 0;
  for (let k = 0; k < SEEDS; k++) {
    const r1 = resolveMatch({ agentA: a, agentB: b, seed: seedStr(a.agentId, b.agentId, k), cardsByID });
    aWins += r1.verdict === 'A' ? 1 : r1.verdict === 'draw' ? 0.5 : 0; games++;
    const r2 = resolveMatch({ agentA: b, agentB: a, seed: seedStr(b.agentId, a.agentId, k), cardsByID });
    aWins += r2.verdict === 'B' ? 1 : r2.verdict === 'draw' ? 0.5 : 0; games++;
  }
  return aWins / games;   // A's win fraction across both sides
}

// ── round-robin tournament for a generation, fill _fitness
function runGeneration(population) {
  population.forEach(a => a._fitness = { w:0, l:0, d:0, lp:1000, score:0, games:0 });
  for (let i = 0; i < population.length; i++) {
    for (let j = i+1; j < population.length; j++) {
      const a = population[i], b = population[j];
      const aScore = duel(a, b);           // 0..1
      a._fitness.score += aScore; a._fitness.games++;
      b._fitness.score += (1 - aScore); b._fitness.games++;
      if (aScore > 0.5) { a._fitness.w++; b._fitness.l++; }
      else if (aScore < 0.5) { b._fitness.w++; a._fitness.l++; }
      else { a._fitness.d++; b._fitness.d++; }
    }
  }
  population.forEach(a => a._fitness.winRate = a._fitness.score / Math.max(1, a._fitness.games));
  population.sort((x, y) => y._fitness.winRate - x._fitness.winRate);
}

// ── benchmark: current champion vs the FROZEN gen-0 field → absolute fitness
function benchmark(champion, frozenField) {
  let s = 0;
  for (const g of frozenField) s += duel(champion, g);
  return s / frozenField.length;   // fraction of frozen field beaten
}

// ── seed gen-0
let population = Array.from({ length: POP }, () => makeRandomAgent(pool, rng, 0));
const frozen = population.map(a => JSON.parse(JSON.stringify(a)));   // benchmark field
const hallOfFame = [];                                               // frozen champion per generation

const history = [];
for (let gen = 0; gen < GENS; gen++) {
  runGeneration(population);
  const champ = population[0];
  hallOfFame.push({ gen, agent: JSON.parse(JSON.stringify(champ)) });  // freeze this gen's champion
  const bench = benchmark(champ, frozen);
  const avgWR = population.reduce((s,a)=>s+a._fitness.winRate,0)/population.length;
  const sigs = new Set(population.map(deckSignature));
  const maxGen = Math.max(...population.map(a => a.lineage.generation));
  const rec = {
    gen,
    championHandle: champ.handle,
    championWinRate: +champ._fitness.winRate.toFixed(3),
    championVsFrozenField: +bench.toFixed(3),       // ← THE improvement signal
    avgWinRate: +avgWR.toFixed(3),
    diversity: sigs.size,                            // distinct decks in the pop
    deepestLineage: maxGen,
    championDeck: Object.keys(champ.genome.cards).slice(0, 8),
    championStyle: {
      aggro:+champ.policy.weights.aggro.toFixed(2),
      curve:+champ.policy.weights.curve.toFixed(2),
      lanePref:+champ.policy.weights.lanePref.toFixed(2)
    },
    topChambers: topChambers(champ, cardsByID),
  };
  history.push(rec);
  console.log(`gen ${String(gen).padStart(2)} · champ ${champ.handle.padEnd(14)} · vs-frozen ${(bench*100).toFixed(0)}% · popWR ${(avgWR*100).toFixed(0)}% · diversity ${sigs.size} · lineage-depth ${maxGen}`);

  if (gen === GENS-1) break;
  // ── SELECTION + REPRODUCTION
  const nSurv = Math.max(2, Math.floor(POP * SURVIVE));
  const survivors = population.slice(0, nSurv);
  const next = survivors.map(s => JSON.parse(JSON.stringify(s)));   // elitism: survivors carry on
  // fill the rest with forks (mutation) + crossover + a little fresh blood
  while (next.length < POP) {
    const roll = rng();
    if (roll < 0.65) {                       // fork a survivor
      const p = survivors[Math.floor(rng() * survivors.length)];
      next.push(forkAgent(p, pool, rng, 0.25));
    } else if (roll < 0.9) {                 // crossover two survivors
      const p = survivors[Math.floor(rng() * survivors.length)];
      const q = survivors[Math.floor(rng() * survivors.length)];
      next.push(crossover(p, q, pool, rng));
    } else {                                 // fresh random (diversity injection)
      next.push(makeRandomAgent(pool, rng, gen + 1));
    }
  }
  population = next;
}

function topChambers(agent, byId) {
  const ch = {};
  Object.entries(agent.genome.cards).forEach(([id, n]) => { const c = byId[id]; if (c) ch[c.chamber] = (ch[c.chamber]||0)+n; });
  return Object.entries(ch).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>`${c}:${n}`);
}

// ── CHAMPION GAUNTLET · the real proof: do later-gen champions beat earlier ones?
// Round-robin among all frozen generation-champions. If evolution worked, the
// ranking correlates with generation (later champions climb).
console.log('\n[arena] running champion gauntlet (each gen-champion vs every other)...');
const champs = hallOfFame.map(h => ({ ...JSON.parse(JSON.stringify(h.agent)), _gen: h.gen, _gwins: 0, _gscore: 0, _ggames: 0 }));
for (let i = 0; i < champs.length; i++) {
  for (let j = i+1; j < champs.length; j++) {
    const aScore = duel(champs[i], champs[j]);
    champs[i]._gscore += aScore; champs[i]._ggames++;
    champs[j]._gscore += (1-aScore); champs[j]._ggames++;
    if (aScore > 0.5) champs[i]._gwins++; else if (aScore < 0.5) champs[j]._gwins++;
  }
}
champs.forEach(c => c._grate = c._gscore / Math.max(1, c._ggames));
const gauntlet = champs.map(c => ({ gen: c._gen, handle: c.handle, gauntletWinRate: +c._grate.toFixed(3), lineageDepth: c.lineage.generation }))
                       .sort((a,b) => b.gauntletWinRate - a.gauntletWinRate);
// correlation between generation and gauntlet rank (Spearman-ish): does later = stronger?
const byGen = [...gauntlet].sort((a,b)=>a.gen-b.gen);
const firstHalfAvg = byGen.slice(0, Math.floor(byGen.length/2)).reduce((s,c)=>s+c.gauntletWinRate,0)/Math.floor(byGen.length/2);
const secondHalfAvg = byGen.slice(Math.floor(byGen.length/2)).reduce((s,c)=>s+c.gauntletWinRate,0)/Math.ceil(byGen.length/2);

// ── result: did evolution work?
const g0 = history[0].championVsFrozenField;
const gN = history[history.length-1].championVsFrozenField;
const improved = secondHalfAvg > firstHalfAvg;
const champion = population[0];
const result = {
  generated: '2026-07-12',
  config: { pop: POP, gens: GENS, seeds: SEEDS },
  history,
  finalChampion: {
    handle: champion.handle,
    lineage: champion.lineage,
    deck: champion.genome.cards,
    sockets: champion.genome.sockets,
    style: champion.policy.weights,
    winRate: +champion._fitness.winRate.toFixed(3),
    vsFrozenField: +benchmark(champion, frozen).toFixed(3),
    topChambers: topChambers(champion, cardsByID),
  },
  gauntlet,
  verdict: {
    earlyGenChampsAvgGauntlet: +firstHalfAvg.toFixed(3),
    lateGenChampsAvgGauntlet: +secondHalfAvg.toFixed(3),
    lateBeatEarly: +(secondHalfAvg - firstHalfAvg).toFixed(3),
    populationEvolved: improved,
  },
};
writeFileSync(OUT, JSON.stringify(result, null, 2));

console.log('\n════ CHAMPION GAUNTLET · gen-champions ranked by head-to-head ════');
gauntlet.forEach((c,i) => console.log(`  #${String(i+1).padStart(2)} · gen ${String(c.gen).padStart(2)} champion · ${(c.gauntletWinRate*100).toFixed(0)}% · ${c.handle}`));
console.log('\n════ EVOLUTION VERDICT ════');
console.log(`early-gen champions (gen 0..${Math.floor(GENS/2)-1}) avg gauntlet win-rate: ${(firstHalfAvg*100).toFixed(0)}%`);
console.log(`late-gen champions  (gen ${Math.floor(GENS/2)}..${GENS-1}) avg gauntlet win-rate: ${(secondHalfAvg*100).toFixed(0)}%`);
console.log(`late-beats-early margin: ${((secondHalfAvg-firstHalfAvg)*100).toFixed(0)} points · population ${improved ? 'EVOLVED ✓ (later champions beat earlier ones)' : 'plateaued'}`);
console.log(`final champion: ${champion.handle} · lineage gen ${champion.lineage.generation} · chambers ${topChambers(champion, cardsByID).join(' ')}`);
console.log(`\n[arena] results → ${OUT}`);
