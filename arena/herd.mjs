#!/usr/bin/env node
// FallKard Arena · herd.mjs · the HERD RUNTIME (the ignition behind fallswarm)
// The Bloodline (bloodline.mjs) PRICES descendants; the herd makes them EARN. It wakes each
// bred descendant as a worker whose behaviour is its policy, floats a market of $KONO
// bounties, lets workers bid per their specialisation, settles the winners, and routes a
// royalty UP the lineage on every settlement — so a founder earns from its progeny's LABOUR,
// not just its existence. That gives the Bloodline economy a revenue source: work.
//
// Consolidate, don't reinvent: this is the glue between organs that already exist —
//   FallKard Arena (breeds) → Clinic (matures) → Bloodline (prices) → HERD (earns) → up the tree.
// The worker's real tool-execution plugs in behind executeJob() (a sovereign agent cascade /
// kcc-runner); here the runtime, the bus-order, the market and the settlement are real and
// deterministic. Same seed → same ledger. Royalty is MINTED up the lineage on contribution
// (KCC mints on proof-of-contribution — it is not carved out of the worker's settlement),
// bounded ≤ 0.81× the settlement by the per-generation discount.
//
//   node herd.mjs [--jobs 120] [--rounds 6] [--royalty 0.5] [--out herd-ledger.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildForest, royaltyUp } from './bloodline.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const N_JOBS = Math.max(1, parseInt(arg('--jobs', '120')) || 120);
const ROUNDS = Math.max(1, parseInt(arg('--rounds', '6')) || 6);
const ROYALTY = Math.max(0, Math.min(1, parseFloat(arg('--royalty', '0.5')) || 0.5)); // royalty MINTED up per $KONO settled (KCC mints on contribution)
const OUT = arg('--out', join(__dirname, '..', 'herd-ledger.json'));

const herd = JSON.parse(readFileSync(join(__dirname, '..', 'herd.json'), 'utf8'));
const CHAMBERS = ['market', 'colony', 'estate', 'vault', 'clinic', 'studio', 'forge', 'reach', 'bridge'];
const KINDS = ['sdk', 'api', 'mcp', 'tool'];

// deterministic rng
let RS = 5150;
const rng = () => { RS = (RS * 9301 + 49297) % 233280; return RS / 233280; };
const clamp01 = x => Math.max(0, Math.min(1, x));

// ── the job market — $KONO bounties across the estate's chambers/kinds
function floatJobs(n) {
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const chamber = CHAMBERS[Math.floor(rng() * CHAMBERS.length)];
    const kind = KINDS[Math.floor(rng() * KINDS.length)];
    const difficulty = 0.3 + rng() * 0.6;                 // 0.3..0.9
    const reward = Math.round((2 + rng() * 8) * (0.7 + difficulty)) ;  // $KONO, harder pays more
    jobs.push({ id: 'job-' + i, chamber, kind, difficulty: +difficulty.toFixed(2), reward });
  }
  return jobs;
}

// ── a worker's fit for a job = how much its policy "knows" that domain. Reads the ACTUAL
// policy vector (chamber/kind bias + market/curve affinity), so specialisation pays.
function fit(w, job) {
  const wt = w.weights || {};
  const cb = (wt.chamberBias && wt.chamberBias[job.chamber]) || 0;   // domain affinity
  const kb = (wt.kindBias && wt.kindBias[job.kind]) || 0;
  const marketPull = job.chamber === 'market' ? (wt.valMarket ?? 0.8) * 0.15 : 0;
  const base = 0.4 + cb + kb + marketPull;                           // ~0.4 neutral
  const matured = w.matured ? 0.12 : 0;                              // verified workers are more reliable
  return clamp01(base + matured);
}

// bid = willingness to claim, driven by aggro + fit. higher bidder wins the job.
function bid(w, job) { return fit(w, job) * (0.5 + (w.weights?.aggro ?? 0.5) * 0.5); }

// ── the runtime
const forest = buildForest(herd.births);
const nodeHandle = id => (forest.node.get(id)?.handle) || id;
const workers = herd.workers.map(w => ({ ...w, earned: 0, won: 0, done: 0, success: 0, _round: 0 }));
const wById = Object.fromEntries(workers.map(w => [w.id, w]));
// fork = wallet = ID: an ancestor's POSITION earns royalty forever, even when the organism
// itself is no longer in the working set. So royalties accrue to a per-wallet ledger over the
// WHOLE forest, not just the live herd.
const royaltyLedger = new Map();
const addRoyalty = (id, amt) => royaltyLedger.set(id, (royaltyLedger.get(id) || 0) + amt);

const JOBS_PER_ROUND = Math.round(N_JOBS / ROUNDS);
const CAP = Math.max(2, Math.ceil(JOBS_PER_ROUND / Math.max(1, workers.length) * 2.5)); // per-worker per-round capacity — spreads the work

let settled = 0, royaltiesRouted = 0, jobsFilled = 0;
const roundLog = [];
for (let r = 0; r < ROUNDS; r++) {
  workers.forEach(w => w._round = 0);
  const jobs = floatJobs(JOBS_PER_ROUND);
  let roundSettled = 0;
  for (const job of jobs) {
    // auction: highest qualified bidder that is not already at capacity this round
    let winner = null, best = -1;
    for (const w of workers) {
      if (w._round >= CAP) continue;
      if (fit(w, job) < job.difficulty * 0.55) continue;      // unqualified — can't clear the bar
      const b = bid(w, job);
      if (b > best || (b === best && winner && w.id < winner.id)) { best = b; winner = w; }
    }
    if (!winner) continue;                                     // job goes unfilled this round
    winner._round++; winner.won++; winner.done++;
    // execute: success probability = fit vs difficulty (deterministic roll)
    const p = clamp01(fit(winner, job) - job.difficulty + 0.5);
    if (rng() >= p) continue;                                  // failed delivery — no settlement
    winner.success++;
    winner.earned += job.reward; settled += job.reward; roundSettled += job.reward; jobsFilled++;
    // royalty UP the bloodline — a fraction of the settlement, DECAY^depth to each ancestor wallet
    for (const hop of royaltyUp(forest, winner.id, job.reward * ROYALTY)) {
      addRoyalty(hop.ancestor, hop.royalty); royaltiesRouted += hop.royalty;
    }
  }
  roundLog.push({ round: r, settled: +roundSettled.toFixed(2), workersActive: workers.filter(w => w._round > 0).length });
}

// per-worker take = own work + any royalty its own wallet received (as an ancestor)
workers.forEach(w => { w.royalties = +(royaltyLedger.get(w.id) || 0).toFixed(2); w.total = +(w.earned + w.royalties).toFixed(2); w.successRate = w.done ? +(w.success / w.done).toFixed(3) : 0; });

const topEarners = [...workers].sort((a, b) => b.total - a.total).slice(0, 8)
  .map(w => ({ handle: w.handle, gen: forest.node.get(w.id)?.gen ?? w.gen, earned: +w.earned.toFixed(2), royalties: w.royalties, total: w.total, won: w.won, successRate: w.successRate, matured: !!w.matured }));

// the founder WALLETS earning the most from descendant labour — the fork-share payoff.
// These are the same deep-rooted founders the Bloodline priced highest: price → cash flow.
const topRoyalty = [...royaltyLedger.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  .map(([id, amt]) => ({ handle: nodeHandle(id), gen: forest.node.get(id)?.gen ?? null, royaltyIncome: +amt.toFixed(2) }));

// THE PROOF · the herd metabolises real work into $KONO, and a bounded share flows UP to the
// founders' wallets — the bloodline economy now has a revenue source: its descendants' labour.
const verdict = {
  konoSettled: +settled.toFixed(2),
  jobsFilled,
  royaltiesRouted: +royaltiesRouted.toFixed(2),
  royaltyShareOfSettlement: settled ? +(royaltiesRouted / settled).toFixed(3) : 0,  // MINTED up per $KONO settled (bounded ≤ 0.81)
  earningsFlowUp: royaltiesRouted > 0,
  founderWalletsPaid: royaltyLedger.size,
  workersEmployed: workers.filter(w => w.done > 0).length,
  herdSize: workers.length,
};

const ledger = { generated: '2026-07-12', config: { jobs: N_JOBS, rounds: ROUNDS, royalty: ROYALTY, capacity: CAP }, rounds: roundLog, topEarners, topRoyalty, verdict };
writeFileSync(OUT, JSON.stringify(ledger, null, 2));

console.log(`[herd]  ${workers.length} descendants woken · ${verdict.workersEmployed} employed · cap ${CAP}/round`);
console.log(`[herd]  $KONO settled ${verdict.konoSettled} over ${jobsFilled} jobs · royalty MINTED UP ${verdict.royaltiesRouted} (${verdict.royaltyShareOfSettlement} per $KONO, bounded) → ${verdict.founderWalletsPaid} founder wallets`);
console.log(`[herd]  earnings-flow-up ${verdict.earningsFlowUp ? 'YES ✓' : 'no'} · top founder-wallet ${topRoyalty[0]?.handle} earns ${topRoyalty[0]?.royaltyIncome} $KONO from descendants' labour`);
console.log(`[herd]  ledger → ${OUT}`);
