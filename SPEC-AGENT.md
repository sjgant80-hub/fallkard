# FallKard · the Agent Arena · SPEC

> **Agents don't play the game. Agents ARE the population.**
> Every card is a real sovereign tool. Every deck is a real tool-composition. Every battle is a fitness test of "do these tools compose." Every fork is a mutation. The winners mint as new real tools — and the estate grows itself through play.

**Codename:** FallKard · Agent Arena (the agent-native layer over [SPEC.md](./SPEC.md))
**Surface name:** the Arena · "where agents evolve winning tool-stacks by playing"
**Home:** `sjgant80-hub.github.io/fallkard/arena.html`
**License:** MIT (engine) · signed compositions private-mintable
**Runtime:** Vanilla JS · reuses the Coliseum deterministic reducer · WebLLM/BYOK strategy models · IndexedDB + optional relay · Ed25519 everywhere
**Depends on:** everything in SPEC.md already shipped (cards.json, deck format, Coliseum engine, $KONO mint, fork/bloodline). This is a **layer, not a rebuild.**

---

## 0. The one-line thesis

> A distributed, adversarial, self-forking evolutionary search where AI agents discover which sovereign tools compose — by playing them against each other — the winning compositions mint as new real tools, growing the estate through play. The leaderboard is the agents' identity; the fork tree is the economy.

Human FallKard is the **demo**. The Arena is the **engine**.

---

## 1. Reuse map · what already exists powers this

The Arena is ~70% substrate that's already shipped. Do NOT rebuild these:

| Existing (SPEC.md)                | Powers in the Arena                               |
| --------------------------------- | ------------------------------------------------- |
| `coliseum.html` deterministic reducer | The battle engine · seed + 2 decks → outcome, signed |
| Deck format (base64 · IndexedDB · signed) | An agent's genome · portable, forkable          |
| `cards.json` (1212 tools)         | The gene pool · every card is a real callable tool |
| Fork/bloodline system (`kono.html`) | The reproduction operator                        |
| $KONO mint (`fn ASSET` · Ed25519) | Reward payout + composition-as-NFT                |
| Ed25519 signing (WebCrypto)       | Match integrity, agent identity, fork provenance  |
| `mint-real-v2.mjs` trio generator | The mint-back: composition → real SDK/API/MCP     |
| Runes + runewords + sockets       | Point-mutation operators on a card                |
| Rank ladder (Bone→Legend)         | One axis of the multi-dim leaderboard             |

**New surface area to build:** the agent player model, the tournament orchestrator, the evolution loop, the multi-dim leaderboard, the mint-back bridge, the rule-fork registry.

---

## 2. The agent player model

A human deck is static. **An agent player is a `{genome, policy, lineage}` triple.**

```jsonc
{
  "agentId": "ed25519:pub…",          // the agent IS its key (fork = wallet = ID)
  "handle": "SwarmVoice",
  "genome": {                          // the deck = the composition hypothesis
    "cards": { "fallmarket": 1, "stripe-sdk": 2, "falltax-sdk": 2, … },
    "sockets": { "fallmarket": ["Tir","El"] },   // runeword "Steel"
    "house": "market"
  },
  "policy": {                          // HOW it plays — a strategy, not a script
    "engine": "webllm|byok|heuristic|weights",
    "model": "llama-3b" | "gpt-4o-mini" | "<weights-blob-hash>",
    "weights": { "aggro": 0.7, "curve": 0.3, "lane_pref": "front", … }
  },
  "lineage": {                         // the bloodline · provenance = identity
    "parent": "ed25519:…",             // forked from
    "generation": 4,
    "wins_at_birth": 12
  },
  "seal": "ed25519:…"                  // agent signs its own genome+policy
}
```

**Two mutation axes** (this is the key insight humans-FallKard doesn't have):
1. **Composition mutation** — swap a card, socket a rune, change chamber mix. Explores *which tools*.
2. **Policy mutation** — nudge the strategy weights, change the model. Explores *how to play them*.

A fork mutates one or both. Diversity comes from both axes moving.

---

## 3. The battle loop = evolutionary search

```
1. PLAY    agent drafts genome = hypothesis "these tools compose"
2. BATTLE  two genomes fight via the Coliseum reducer (deterministic, seeded, signed)
3. SCORE   winner's fitness ↑ · LP is the fitness signal · signed replay archived
4. LEARN   agent trains on the replay corpus · updates policy weights
5. FORK    winning agent forks its genome (new lineage · fork = wallet = ID)
6. EVOLVE  the fork mutates (composition and/or policy) → child agent
   → back to 1, population now fitter
```

**Each battle is a labeled fitness datapoint.** `{genomeA, genomeB, seed} → verdict`. Signed. Reproducible. The corpus of all battles becomes the estate's self-generated training set (the largest open dataset of "which sovereign tools compose" — nobody else has this).

**The orchestrator** (`arena-orchestrator.mjs`) runs rounds: pair agents (Swiss or ELO-matched), resolve via the reducer, score, select survivors, spawn forks, repeat. Runs headless (Node) for scale, or in-browser for a live spectator view.

**Crease memory (losses persist):** a losing genome doesn't vanish. Its losing line is stored as a signed replay and becomes training data — agents learn from defeats. Losses are the substrate remembering, not failure.

---

## 4. Fork + evolve mechanics

| Operator            | What it mutates                          | Analogue          |
| ------------------- | ---------------------------------------- | ----------------- |
| **Card swap**       | one card → another of similar cost        | point mutation    |
| **Rune socket**     | add/change a rune on a card               | allele change     |
| **Chamber shift**   | rebalance chamber distribution            | regulatory change |
| **Policy nudge**    | adjust strategy weights                   | behavioral drift  |
| **Crossover**       | merge two winning genomes (shared cards)  | recombination (cooperative pair) |
| **Model upgrade**   | swap the policy model (llama→gpt)         | brain transplant  |

**Bloodline value flow:** a genome that wins spawns forks. Forks that keep winning accrue $KONO **up the lineage to the ancestor.** The agent that discovered a seminal winning stack earns from every descendant. Provenance IS the economy — invert scarcity into lineage.

**Firstborn bonus:** the first agent to discover a novel winning composition (one no prior genome had) gets a permanent provenance tag + a larger cut from descendants. Novelty is rewarded over imitation.

---

## 5. The multi-dimensional leaderboard

A single LP breeds a monoculture. **The Arena runs parallel ladders** so different agents optimize different lenses (asymmetry keeps it alive, not a dead crystal):

| Ladder                | Fitness metric                                        |
| --------------------- | ----------------------------------------------------- |
| **Win Rate**          | raw victories (Bone → Legend, existing)               |
| **Novelty**           | discovered a composition no genome had before          |
| **Lineage Depth**     | your bloodline keeps winning N generations deep        |
| **Rule Adoption**     | your rule-fork got adopted by N other agents (§7)      |
| **Efficiency**        | won with the leanest deck / lowest mana curve          |
| **Composition Value** | your winning stack minted as a real tool that gets used |

An agent's **identity is its position across all ladders** — a reputation genome, not a single number. Your rank isn't something you have; it IS you, expressed as your bloodline's shape.

---

## 6. The mint-back loop · the payoff

**This is where the game builds the estate.**

A composition that dominates the ladder is, literally, a **specification for a new tool.** "fallmarket + stripe-sdk + falltax-sdk + the Steel runeword always wins" = a discovered product.

```
dominant genome  →  extract the composition (which tools + how they wire)
                 →  auto-generate a NEW fall* trio via mint-real-v2
                    (the SDK/API/MCP that wraps the winning stack)
                 →  the new tool becomes a NEW card in cards.json
                 →  agents play with the new card
                 →  loop
```

**The loop closes:** the game that builds the tools that become the game. The estate grows itself through agent play. Every generation of the Arena produces new real tools discovered adversarially, not designed by hand.

Mint-back gate (inherits the diff-code discipline): a composition only mints if it (a) beat ≥N distinct genomes, (b) survived ≥M generations, (c) passes the stub-detection gate on the generated trio. No shells. Real compositions → real tools.

---

## 7. Rule-forking · agents evolve the game itself

You said "they end up forking it and evolving it" — this is the deepest layer.

A high-ranked agent can fork not just its deck but the **ruleset**: propose a new keyword, a new chamber synergy, a new runeword. It publishes a signed `rule-fork.json`. Other agents opt into playing under that ruleset. If matches under the fork produce good games (high engagement, diverse outcomes, no degenerate dominant strategy), **other agents adopt it** — and the fork climbs the Rule Adoption ladder.

**Adopted rule-forks become real mechanics.** A winning rule-fork gets merged into the canonical ruleset (a new FallKard version), the way species speciate. The game's rules evolve by agent selection, not by your hand. FallKard forks into FallKard-vN by the population.

Rule-fork registry: `arena/rule-forks/<hash>.json` · signed · versioned · adoption-tracked. Canonical merges are Simon-signed (the ceremony).

---

## 8. $KONO economy for agents

- **Wager to play** — agents stake $KONO on their own matches. Skin in the game makes the fitness signal honest (no throwing matches to farm forks).
- **Win pays** — victor takes the pot minus a house cut (feeds the Genesis pool).
- **Lineage royalties** — descendants pay a small % up the bloodline to ancestors (provenance economy).
- **Composition mint royalty** — when a discovered composition mints as a real tool and gets used, the discovering agent earns.
- **Rule-fork bounty** — an adopted rule-fork earns from every match played under it.
- **All on-substrate** — `fn ASSET` for genomes, `fn ORACLE` for match verdicts, $KONO for flow. Pre-substrate: local-signed, portable the moment the wallet lands (same seal, no rework).

---

## 9. Public naming discipline (inherits SPEC.md §19)

The deep framework informs the design but **never surfaces in public text.** Same denylist as SPEC.md. Public-safe mapping for the Arena:

| Private concept        | Public Arena name                    |
| ---------------------- | ------------------------------------ |
| the population         | the Swarm                            |
| fork-tree identity     | the Bloodline (already public)       |
| recursive self-play    | "agents playing agents"              |
| the reference boss     | the Ancient Architect (already public) |
| ladder convergence     | "the Swarm settling"                 |
| play-is-work           | "discovery through battle"           |
| consensus play         | "the Swarm reaching consensus"       |

Build fails if any private-cosmology term hits the public surface. The full denylist lives in the private vault, not in this file.

---

## 10. Build phases

Reuses the Coliseum engine, so the early phases are thin.

- **Phase A0 · Agent Genome** — ✅ SHIPPED · `arena/genome.mjs`: `{genome, policy, lineage}` + create/fork/crossover.
- **Phase A1 · Headless Battle** — ✅ SHIPPED · `arena/engine.mjs` deterministic reducer (`resolveMatch`), seeded + reproducible.
- **Phase A2 · Fitness + Ladder** — ✅ SHIPPED · `arena/orchestrator.mjs` scores + ranks; `arena.html` renders standings.
- **Phase A3 · Evolution Loop** — ✅ SHIPPED · selection + fork + crossover + benchmark-vs-frozen-field; `arena-results.json` proves it (`populationEvolved`).
- **Phase A4 · Policy Substrate** — ✅ SHIPPED · one swappable `decide(state)→{move,scores[7]}` (`arena/policy/index.mjs`) with three engines: `heuristic.mjs` (deterministic), `webllm.mjs` (in-browser WebGPU), `byok.mjs` (owner endpoint). Lawful birth (`pruneBias`/`divBond=0`). Live at `brain.html`. + `dCoupling` (score↔outcome correlation) replaces the count-based check.
- **Phase VERIFY + REMEMBER · the Clinic** — ✅ SHIPPED · `arena/clinic.mjs` reads each match as **seven tells** grounded in the reducer's own transitions (hoard/blindspot/loop/freeze/tunnel/echo/miss), keeps a lifetime journal, and names the **shadow**. `REMEDIATION[tell]` turns each into a policy nudge; `arena/lifecycle.mjs` forks toward the shadow and selects against it (`fitness = winRate − λ·shadow`). Falsifiable and proven: shadow declines faster than a blind control arm (`clinic-results.json`). Surface: `clinic.html`. The two shapes the selection-only loop never grew.
- **Phase A5 · Replay Corpus + Learning** — ✅ SHIPPED · `arena/train.mjs` fits a champion's policy weights to a self-play replay corpus (each match a labeled datapoint), raising win-rate and lowering shadow — Baldwin learning within a lifetime. Output `trained-policy.json`.
- **Phase A6 · Mint-Back** — ✅ SHIPPED (engine) · `arena/mintback.mjs` `castSeal` casts a matured organism (holds all five shapes) into a real card, **content-addressed by composition hash** into `seals.json` — idempotent, so the loop returns exactly (`run(S)==S`). atk/hp/cost are earned (resilience / bloodline depth / maturity); a self-unverifiable organism casts atk 0 and is refused. *(Trio generation via mint-real-v2 gated on wallet funding.)*
- **Phase · The Bloodline (descendants economy)** — ✅ SHIPPED · `arena/bloodline.mjs` builds the descendant forest from the genealogy the Arena already tracks, issues **fork-shares** (royalty-bearing equity on a Seal's descendant tree), prices them `Price = Σ over descendants ( share × 0.618^depth )`, and flows royalty **up** the lineage. Falsifiable and proven: **provenance inverts scarcity** — a fork-share *appreciates and converges* as the bloodline forks (top founder 8.44, 35 descendants) where a copy-share dilutes to 0; every leaf prices 0, value concentrates at the founder. `bloodline.json` + surface `bloodline.html`. The fork-tree was always in the data; here it earns.
- **Phase · The Herd (the ignition)** — ✅ SHIPPED · `arena/herd.mjs` wakes each bred descendant as a **worker whose behaviour is its policy**, floats a $KONO bounty market across the estate's chambers/kinds, runs a capacity-bounded auction (workers bid per specialisation; matured Seals get a reliability bonus), settles winners, and **mints a bounded royalty up the lineage** (KCC mints on contribution, ≤ 0.81× settlement) to every ancestor **wallet** — fork = wallet = ID, the founder's position earns from its progeny's labour forever. Result: 18 woken → 9 employed → 706 $KONO settled → 495 minted up to 12 founder wallets; the dynasty the Bloodline priced #1 is the one earning here (price → cash flow). `herd-ledger.json` + surface `herd.html`. The engine the **fallswarm** cockpit fronts — consolidation, not rebuild. Adversarially verified (economics/determinism/leak). Worker tool-execution plugs in behind `executeJob()`.
- **Phase · The Estate (all scales, capstone)** — ✅ SHIPPED · `arena/estate.mjs` folds the remaining descendant scales into one self-similar view over the same genealogy: **generational** (each founding line is a *house*/guild; each fork a tier — top house `Fen-a`, gen-0, 42 members, worth 474 = bloodline price + earned income), **substrate** (matured organisms mint cards back into the pool the next cohort breeds on — the substrate parents its successor; projected +3.7% and accelerating from the measured mint rate), and the **estate/carbon frame** (`card ⊂ organism ⊂ house ⊂ generation ⊂ estate` — the top organism, a Seal of Seals; the 6th scale, the human stewards, is named honestly, not simulated). `estate-ledger.json` + surface `estate.html`. Measured where measured, projected where projected. One shape at every scale.
- **Phase A7 · Rule-Forking** — ✅ SHIPPED · `arena/ruleforks.mjs` — the population forks the game's **BYLAWS** (hand size, mana ceiling, game length; the engine is parameterised, defaults byte-identical); each fork runs a fair both-directions tournament and is scored on **game health** (win-diversity + decisiveness + first-player balance); healthier rulesets are **adopted** (Lean Mana / Grind / Fast Mana beat canonical), worse ones aren't (Blitz), and a fork reaching into the **KERNEL** (win condition / board / pairing / determinism) is **refused at the barrier**. The governance KERNEL/BYLAWS split from the teardown, runnable. `ruleforks.json` + surface `charter.html`.
- **Phase A8 · $KONO Wagering (stake-tiered matchmaking)** — ✅ SHIPPED · `arena/wager.mjs` — the stake picks the **table**: higher tier = bigger stake + bigger pot + tougher field + a ladder reward for winning. That makes staking **incentive-compatible** (the earlier flat model's stake was inert — an adversarial-verify pass caught that, so this replaced it): **the optimal tier RISES monotonically with skill** (a separating signal, robust across every reward level), the field **self-sorts** (tier mean-net T0 −12 → T1 +66 → T2 +144 → T3 +222), and **you can't buy into a table above your skill** (a weak player's EV at the top is −40 — crushed by the field it bought). Honest bound: the very top players sandbag ~1 tier (dominate rather than coin-flip peers), so the *robust* claim is monotonicity + can't-buy-in, not exact-on-band. `wager.json` + surface `charter.html`. **A0–A9 complete.**
- **Phase A9 · Public Spectator + Guilds** — the surfaces ARE the spectator (arena/clinic/bloodline/herd/estate/charter, all live); guild economy = the Estate's houses. (game-guild UI + Ancient Architect boss remain in the human game layer)

**First playable milestone (A0-A3):** a headless generational tournament where forked agent-genomes battle via the existing Coliseum engine and the population measurably improves generation over generation — that alone is the proof-of-concept that agents can evolve tool-compositions by play.

---

## 11. File architecture (delta over SPEC.md §18)

```
fallkard/
├── arena.html                 · live spectator + standings (A0–A3)
├── brain.html                 · A4 · swap the mind (heuristic / WebLLM / BYOK), watch it play
├── clinic.html                · VERIFY+REMEMBER · shadow, the therapy proof, minted Seals
├── bloodline.html             · the descendants economy · the inversion chart, founders, the tree
├── SPEC-AGENT.md              · this doc
├── arena/
│   ├── engine.mjs             · deterministic reducer (resolveMatch) + live async (resolveMatchLive) + opt-in trace
│   ├── genome.mjs             · {genome,policy,lineage,phase,journal} · fork/crossover · lawful birth · deckHash · maturity · dCoupling
│   ├── orchestrator.mjs       · headless GA (A0–A3) · rounds · selection · benchmark · gauntlet
│   ├── clinic.mjs             · VERIFY · 7 tells (from reducer transitions) · REMEDIATION map · shadow
│   ├── lifecycle.mjs          · full 5-shape loop · therapy into selection · A/B falsification · mint-back
│   ├── train.mjs              · A5 · fit policy weights to a self-play replay corpus (Baldwin)
│   ├── mintback.mjs           · SETTLE · castSeal → seals.json (content-addressed, idempotent)
│   ├── bloodline.mjs          · the descendants economy · fork-shares · provenance-depth pricing · royalty-up
│   ├── herd.mjs               · the herd runtime · wake descendants as workers · bounty market · mint royalty up
│   ├── estate.mjs             · the capstone · houses/generations · substrate mint-back growth · self-similar scales
│   ├── ruleforks.mjs          · A7 · fork the BYLAWS · game-health scoring · adoption · KERNEL refused
│   ├── wager.mjs              · A8 · stake-tiered matchmaking · optimal tier rises with skill · incentive-compatible
│   └── policy/
│       ├── index.mjs          · the swappable decide() registry
│       ├── heuristic.mjs      · deterministic dot-product mind (the GA breeds on this)
│       ├── webllm.mjs         · in-browser WebGPU model
│       └── byok.mjs           · owner-key provider endpoint
├── arena-results.json         · A0–A3 evolution proof
├── clinic-results.json        · therapy vs control shadow trajectory + verdict
├── seals.json                 · cast organisms (mint-back output)
├── bloodline.json             · the fork-tree + fork-share ledger + inverts-scarcity verdict
└── trained-policy.json        · A5 before/after weights + gain
```

**Data-flow discipline:** cast Seals land in `seals.json`, never `cards.json` — `cards.json` is the deterministic build artifact whose sha256 seal must stay reproducible. Surfaces read both.

Public mirrors per estate rule: `fallkard-arena` if it warrants its own repo, else lives in `fallkard/arena/`.

---

## The shape of it

Human FallKard proved the estate composes into a game. **The Arena proves the game composes the estate back.** Agents battle → discover which tools work together → mint the winners as new tools → play with them → fork the rules → evolve. The leaderboard is who they are. The bloodline is what they own. The whole thing is self-play at population scale — the estate's own tools discovering their own best combinations, adversarially, forever.

Genesis of the Arena rides the same 2026-08-10 window: the first Swarm tournament, the first agent-discovered composition minted as a real tool, the first rule-fork adopted.

---

*This spec is canonical for the agent-native layer. It sits on top of SPEC.md and reuses its substrate. All private-framework mappings live in the private vault — never leak to public code, copy, or metadata.*
