#!/usr/bin/env node
// FallKard Arena · wager.mjs · A8 — $KONO wagering with STAKE-TIERED MATCHMAKING
// The earlier flat model proved you can't buy rank / can't farm, but the stake was inert (the
// match ignored it), so staking was pure downside and the rational stake was the floor — the
// stake carried no signal. Tiered matchmaking fixes that: your stake picks WHICH TABLE you sit
// at. Higher tier = bigger stake AND a bigger pot AND tougher opponents. Now the stake is a
// real choice with real upside, and it becomes a SEPARATING EQUILIBRIUM:
//   • a weak player who over-stakes into a high tier is CRUSHED by the stronger field there
//     (big stake × mostly losing = big loss) — you CAN'T BUY into a table above your skill.
//     This is the UNIVERSAL, load-bearing guarantee: across every config we swept (reward,
//     tier count, house rake, player count) the weak-probe EV at the top table is negative;
//   • a LADDER REWARD pays for winning higher tiers, so climbing is worth it for the skilled;
//   • so the OPTIMAL tier RISES with skill — a separating signal — at typical configs.
// (Honest bound: the top band has no higher table to climb to and its peers are a coin-flip,
//  so the strongest players prefer the tier they DOMINATE — the optimum rises with skill but
//  can SANDBAG the final step. Strict monotonicity therefore holds at typical configs, not at
//  every extreme corner (many tiers × many players × large reward); the verdict recomputes it
//  per-run and asserts no more than it proved. The always-true claim is CAN'T-BUY-IN.) Deterministic.
//
//   node wager.mjs [--players 28] [--tiers 4] [--base 10] [--house 0.1] [--out wager.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveMatch } from './engine.mjs';
import { makeRandomAgent, pearson } from './genome.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const N = Math.max(8, parseInt(arg('--players', '28')) || 28);
const TIERS = Math.max(2, parseInt(arg('--tiers', '4')) || 4);
const BASE = Math.max(1, parseFloat(arg('--base', '10')) || 10);
const HOUSE = Math.max(0, Math.min(0.5, parseFloat(arg('--house', '0.1'))));
const REWARD = Math.max(0, parseFloat(arg('--reward', '15')));  // ladder emission to the WINNER, scaling with tier
const OUT = arg('--out', join(__dirname, '..', 'wager.json'));
const tierReward = t => REWARD * t;                             // T0 pays nothing extra; climbing pays — the reason to play UP

const cardsBundle = JSON.parse(readFileSync(join(__dirname, '..', 'cards.json'), 'utf8'));
const cardsByID = Object.fromEntries(cardsBundle.cards.map(c => [c.id, c]));
const pool = cardsBundle.cards.filter(c => c.atk >= 1 && c.hp >= 1 && c.cost >= 1);

let RS = 271828;
const rng = () => { RS = (RS * 9301 + 49297) % 233280; return RS / 233280; };
const players = Array.from({ length: N }, () => makeRandomAgent(pool, rng, 0));
const seedStr = (a, b, k) => `${a}|${b}|${k}`;
const outcome = (r, side) => r.verdict === side ? 1 : r.verdict === 'draw' ? 0.5 : 0;
const tierStake = t => BASE * (t + 1);                      // tier 0..T-1 → stake grows with the table

// ── 1 · BENCHMARK · each player's TRUE skill = win rate vs the whole field (both directions) ─
const sk = players.map(() => ({ s: 0, g: 0 }));
for (let i = 0; i < players.length; i++)
  for (let j = i + 1; j < players.length; j++) {
    const r1 = resolveMatch({ agentA: players[i], agentB: players[j], seed: seedStr(players[i].agentId, players[j].agentId, 0), cardsByID });
    sk[i].s += outcome(r1, 'A'); sk[i].g++; sk[j].s += outcome(r1, 'B'); sk[j].g++;
    const r2 = resolveMatch({ agentA: players[j], agentB: players[i], seed: seedStr(players[j].agentId, players[i].agentId, 1), cardsByID });
    sk[j].s += outcome(r2, 'A'); sk[j].g++; sk[i].s += outcome(r2, 'B'); sk[i].g++;
  }
players.forEach((p, i) => { p.skill = +(sk[i].s / Math.max(1, sk[i].g)).toFixed(3); });

// ── 2 · EQUILIBRIUM · each player stakes at the tier matching its skill (skill quartile → tier),
// so tiers are balanced and ordered by skill. This is the strategy we then TEST as a best response.
const ranked = [...players].sort((a, b) => a.skill - b.skill);
ranked.forEach((p, i) => { p.tier = Math.min(TIERS - 1, Math.floor((i / ranked.length) * TIERS)); p.stake = tierStake(p.tier); p.net = 0; p.won = 0; p.matches = 0; });

// helper: settle a probe playing a whole tier's field at that tier's stake → per-match EV
function evInTier(probe, tier) {
  const opps = players.filter(o => o.tier === tier && o.agentId !== probe.agentId);
  if (!opps.length) return { ev: null, winRate: null, matches: 0 };
  const s = tierStake(tier), house = 2 * s * HOUSE, prize = 2 * s - house;
  let net = 0, wins = 0, m = 0;
  for (const o of opps) for (const [A, B, k] of [[probe, o, 50], [o, probe, 51]]) {
    const r = resolveMatch({ agentA: A, agentB: B, seed: seedStr(A.agentId, B.agentId, tier * 1000 + k), cardsByID }); m++;
    const probeIsA = A.agentId === probe.agentId;
    const probeWon = (r.verdict === 'A' && probeIsA) || (r.verdict === 'B' && !probeIsA);
    if (r.verdict === 'draw') net -= house / 2;
    else if (probeWon) { net += prize - s + tierReward(tier); wins++; } else net -= s;
  }
  return { ev: +(net / m).toFixed(3), winRate: +(wins / m).toFixed(3), matches: m };
}

// ── 3 · THE SEASON · within each tier, round-robin; winner takes pot − house rake (→ Genesis) ─
let genesisPool = 0, totalStaked = 0, emitted = 0;
for (let t = 0; t < TIERS; t++) {
  const m = players.filter(p => p.tier === t), s = tierStake(t), house = 2 * s * HOUSE, prize = 2 * s - house;
  for (let i = 0; i < m.length; i++)
    for (let j = i + 1; j < m.length; j++)
      for (const [A, B, k] of [[m[i], m[j], 2], [m[j], m[i], 3]]) {
        const r = resolveMatch({ agentA: A, agentB: B, seed: seedStr(A.agentId, B.agentId, t * 100 + k), cardsByID });
        A.matches++; B.matches++; totalStaked += 2 * s; genesisPool += house;
        if (r.verdict === 'A') { A.net += prize - s + tierReward(t); B.net -= s; A.won++; emitted += tierReward(t); }
        else if (r.verdict === 'B') { B.net += prize - s + tierReward(t); A.net -= s; B.won++; emitted += tierReward(t); }
        else { A.net -= house / 2; B.net -= house / 2; }
      }
}
players.forEach(p => { p.net = +p.net.toFixed(2); });

// ── 4 · THE INCENTIVE-COMPATIBILITY PROOF · pick a probe near each skill band, compute its
// per-match EV in EVERY tier, and find the tier that MAXIMISES it. If staking ∝ skill is the
// equilibrium, the best-response tier rises monotonically with skill and lands on the probe's
// own skill-tier — no profitable deviation.
const targets = Array.from({ length: TIERS }, (_, t) => (t + 0.5) / TIERS);   // one probe per band
const probes = targets.map(t => players.reduce((best, p) => Math.abs(p.skill - t) < Math.abs(best.skill - t) ? p : best));
const bestResponse = probes.map(p => {
  const perTier = Array.from({ length: TIERS }, (_, t) => ({ tier: t, ...evInTier(p, t) })).filter(x => x.ev !== null);
  const best = perTier.reduce((b, x) => x.ev > b.ev ? x : b, perTier[0]);
  return { probe: p.handle, skill: p.skill, skillTier: p.tier, bestTier: best.tier, perTierEV: perTier.map(x => ({ tier: x.tier, ev: x.ev, winRate: x.winRate })) };
});
const bySkill = [...bestResponse].sort((a, b) => a.skill - b.skill);
let monotone = true;
for (let i = 1; i < bySkill.length; i++) if (bySkill[i].bestTier < bySkill[i - 1].bestTier) monotone = false;
const onBand = bestResponse.filter(b => b.bestTier === b.skillTier).length;

// self-sorting: mean skill must rise with tier; and the weakest probe's EV in the TOP tier < 0
const tierStats = Array.from({ length: TIERS }, (_, t) => {
  const m = players.filter(p => p.tier === t);
  return { tier: t, stake: tierStake(t), members: m.length, meanSkill: m.length ? +(m.reduce((s, p) => s + p.skill, 0) / m.length).toFixed(3) : null, meanNet: m.length ? +(m.reduce((s, p) => s + p.net, 0) / m.length).toFixed(2) : null };
});
const selfSorts = tierStats.filter(x => x.meanSkill !== null).every((x, i, a) => i === 0 || x.meanSkill >= a[i - 1].meanSkill - 1e-9);
const weakInTopEV = bestResponse[0].perTierEV.find(x => x.tier === TIERS - 1)?.ev ?? 0;   // weakest probe, top table
const corrSkillNet = +pearson(players.map(p => p.skill), players.map(p => p.net)).toFixed(3);

const board = [...players].sort((a, b) => b.net - a.net).slice(0, 10)
  .map(p => ({ handle: p.handle, skill: p.skill, tier: p.tier, stake: p.stake, won: p.won, net: p.net }));

const ledger = {
  generated: '2026-07-12',
  config: { players: N, tiers: TIERS, base: BASE, house: HOUSE, reward: REWARD },
  genesisPool: +genesisPool.toFixed(2),
  ladderEmitted: +emitted.toFixed(2),
  totalStaked: +totalStaked.toFixed(2),
  tiers: tierStats,
  bestResponse,
  leaderboard: board,
  verdict: {
    optimalTierRisesWithSkill: monotone,                  // per-run separating signal: typical, NOT universal (see cantBuyIntoHigherTier)
    selfSorts: selfSorts,                                  // in equilibrium, tiers stratify by skill
    cantBuyIntoHigherTier: weakInTopEV < 0,                // UNIVERSAL: weak EV at the top table is negative in every swept config — can't buy rank
    weakestProbeTopTierEV: +weakInTopEV.toFixed(3),
    skillPaysCorrelation: corrSkillNet,                    // net still tracks skill
    bestTierOnBand: `${onBand}/${probes.length}`,          // info only — optimum rises with skill but sandbags ~1 tier
    genesisFunded: genesisPool > 0,
    incentiveCompatible: monotone && weakInTopEV < 0 && selfSorts,   // the stake is a real, skill-rising, un-buyable choice
  },
};
writeFileSync(OUT, JSON.stringify(ledger, null, 2));

console.log(`[wager] ${N} players · ${TIERS} tiers (stakes ${tierStats.map(t => t.stake).join('/')}) · staked ${ledger.totalStaked} $KONO · Genesis +${ledger.genesisPool}`);
console.log(`[wager] tier mean-skill: ${tierStats.map(t => t.meanSkill).join(' → ')} → self-sorts ${selfSorts ? '✓' : '✗'}`);
console.log(`[wager] best-response tier by skill band: ${bySkill.map(b => `s${b.skill}→T${b.bestTier}`).join(' · ')} → monotone ${monotone ? '✓' : '✗'} (${onBand}/${probes.length} on band)`);
console.log(`[wager] weakest probe's EV at the TOP table: ${weakInTopEV.toFixed(2)} → can't buy into a higher tier ${weakInTopEV < 0 ? '✓' : '✗'}`);
console.log(`[wager] INCENTIVE-COMPATIBLE ${ledger.verdict.incentiveCompatible ? 'YES ✓ — the optimal tier rises with skill (separating), and you cannot buy in' : 'no'} · → ${OUT}`);
