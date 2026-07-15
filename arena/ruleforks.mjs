#!/usr/bin/env node
// FallKard Arena · ruleforks.mjs · A7 — the population forks the GAME ITSELF
// The deepest self-reference: agents don't only fork their decks, they fork the RULES. A
// rule-fork proposes new BYLAWS (hand size, mana ceiling, game length); the population runs
// under it, and a fork is ADOPTED only if it makes for HEALTHIER games — more diverse
// outcomes, more decisive, more balanced — not a degenerate one-strategy meta. Forks that try
// to touch the KERNEL (the win condition, the board, the ∇·B pairing) are rejected outright:
// the KERNEL is the invariant the barrier verifies, the BYLAWS are the forkable surface.
// (This is the governance split from the 12-face teardown, made runnable.)
//
//   node ruleforks.mjs [--agents 12] [--seeds 2] [--out ruleforks.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveMatch } from './engine.mjs';
import { makeRandomAgent } from './genome.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const N_AGENTS = Math.max(4, parseInt(arg('--agents', '12')) || 12);
const SEEDS = Math.max(1, parseInt(arg('--seeds', '2')) || 2);
const OUT = arg('--out', join(__dirname, '..', 'ruleforks.json'));

const cardsBundle = JSON.parse(readFileSync(join(__dirname, '..', 'cards.json'), 'utf8'));
const cardsByID = Object.fromEntries(cardsBundle.cards.map(c => [c.id, c]));
const pool = cardsBundle.cards.filter(c => c.atk >= 1 && c.hp >= 1 && c.cost >= 1);

// KERNEL = the invariants that CANNOT be forked. BYLAWS = the only forkable rule keys.
const BYLAWS = ['startHand', 'manaCap', 'maxTurns'];
const KERNEL = ['winCondition (hero to 0)', 'the 6-lane board', 'the two-body pairing (∇·B=0)', 'determinism (seeded)'];

// candidate rule-forks proposed by the population (the last two are traps: one degenerate,
// one that reaches into the KERNEL and must be refused).
const FORKS = [
  { name: 'Canonical', rules: {}, note: 'the standing ruleset' },
  { name: 'Big Hand', rules: { startHand: 5 }, note: 'draw 5 to open — more options early' },
  { name: 'Fast Mana', rules: { manaCap: 12 }, note: 'mana climbs to 12 — bigger late swings' },
  { name: 'Grind', rules: { maxTurns: 45 }, note: 'long games — value over tempo' },
  { name: 'Blitz', rules: { maxTurns: 14 }, note: 'short games — tempo over value' },
  { name: 'Lean Mana', rules: { manaCap: 4 }, note: 'low power ceiling — more strategies stay viable' },
  { name: 'Rewrite Victory', rules: { winCondition: 'hero to 5' }, note: 'proposes a KERNEL change' },
];

// deterministic rng for the shared agent field
let RS = 8675309;
const rng = () => { RS = (RS * 9301 + 49297) % 233280; return RS / 233280; };
const seedStr = (a, b, k, fork) => `${fork}|${a}|${b}|${k}`;
const agents = Array.from({ length: N_AGENTS }, () => makeRandomAgent(pool, rng, 0));

function herfindahl(counts) { const t = counts.reduce((s, n) => s + n, 0); if (!t) return 1; return counts.reduce((s, n) => s + (n / t) ** 2, 0); }

// run the whole field under one ruleset, measure GAME HEALTH
function runFork(fork) {
  const wins = agents.map(() => 0);
  let games = 0, draws = 0, firstPlayerWins = 0, decisive = 0, turnsSum = 0;
  // play EACH pairing both directions so going-first cancels in the win-counts (fair diversity),
  // while firstPlayerWins still measures the raw tempo advantage (the balance signal).
  const play = (ai, bi, k) => {
    const r = resolveMatch({ agentA: agents[ai], agentB: agents[bi], seed: seedStr(agents[ai].agentId, agents[bi].agentId, k, fork.name), cardsByID, rules: fork.rules });
    games++; turnsSum += r.turns;
    if (r.verdict === 'draw') draws++;
    else { decisive++; if (r.verdict === 'A') { wins[ai]++; firstPlayerWins++; } else wins[bi]++; }
  };
  for (let i = 0; i < agents.length; i++)
    for (let j = i + 1; j < agents.length; j++)
      for (let k = 0; k < SEEDS; k++) { play(i, j, k); play(j, i, k + 1000); }
  const diversity = 1 - herfindahl(wins);                        // spread of wins (1 = perfectly even)
  const decisiveness = games ? decisive / games : 0;             // fewer draws = more decisive
  const balance = decisive ? 1 - 2 * Math.abs(firstPlayerWins / decisive - 0.5) : 0; // first-player fairness
  const health = +(diversity * 0.5 + decisiveness * 0.3 + balance * 0.2).toFixed(4);
  return { games, drawRate: +(draws / games).toFixed(3), avgTurns: +(turnsSum / games).toFixed(1), diversity: +diversity.toFixed(3), decisiveness: +decisiveness.toFixed(3), balance: +balance.toFixed(3), health };
}

// validate a fork against the KERNEL, then (if lawful) measure it
const results = FORKS.map(f => {
  const illegalKeys = Object.keys(f.rules).filter(k => !BYLAWS.includes(k));
  if (illegalKeys.length) return { name: f.name, note: f.note, rules: f.rules, rejected: true, reason: `touches the KERNEL (${illegalKeys.join(', ')}) — refused at the barrier` };
  return { name: f.name, note: f.note, rules: f.rules, rejected: false, ...runFork(f) };
});

const canonical = results.find(r => r.name === 'Canonical');
const lawful = results.filter(r => !r.rejected);
lawful.forEach(r => { r.deltaVsCanonical = +(r.health - canonical.health).toFixed(4); });
const ranked = [...lawful].sort((a, b) => b.health - a.health);
// ADOPTED = lawful forks that are HEALTHIER than the standing ruleset (the population upgrades the game)
const adopted = ranked.filter(r => r.name !== 'Canonical' && r.deltaVsCanonical > 0).map(r => r.name);
const rejectedKernel = results.filter(r => r.rejected).map(r => r.name);
const notAdopted = lawful.filter(r => r.name !== 'Canonical' && r.deltaVsCanonical <= 0).map(r => r.name); // below the standing rule → not an improvement, kept out

const ledger = {
  generated: '2026-07-12',
  config: { agents: N_AGENTS, seeds: SEEDS },
  kernel: KERNEL, bylaws: BYLAWS,
  forks: results,
  ranked: ranked.map(r => ({ name: r.name, health: r.health, delta: r.deltaVsCanonical, diversity: r.diversity, decisiveness: r.decisiveness, balance: r.balance })),
  verdict: {
    canonicalHealth: canonical.health,
    topFork: ranked[0]?.name,
    adopted,
    notAdopted,
    kernelRefused: rejectedKernel,
    populationForksTheGame: adopted.length > 0,       // the rules evolved by play, not by decree
    kernelHeld: rejectedKernel.length > 0,            // the invariant survived the fork attempt
  },
};
writeFileSync(OUT, JSON.stringify(ledger, null, 2));

console.log(`[rules] ${lawful.length} lawful forks tested · KERNEL refused ${rejectedKernel.length}`);
console.log(`[rules] health ranking: ${ranked.map(r => `${r.name} ${r.health}`).join(' · ')}`);
console.log(`[rules] ADOPTED (healthier than canonical): ${adopted.join(', ') || 'none — canonical holds'} · not adopted: ${notAdopted.join(', ') || 'none'}`);
console.log(`[rules] KERNEL held: "${rejectedKernel.join(', ')}" refused at the barrier ✓`);
console.log(`[rules] → ${OUT}`);
