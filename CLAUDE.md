# CLAUDE.md — agent working notes for FallKard

Engineering-only guidance for an agent editing this repository. Read `README.md`
for the product overview and `SPEC.md` for the full design.

## What this repo is

FallKard is a browser card game plus two headless, dependency-free Node modules:

- `build.mjs` — the **card compiler**. Reads `../fallmarket/listings.json`,
  `manifest.json`, and a gitignored `.private-filter.json`, then derives
  `cards.json` and one procedural SVG per card under `art/`. It is a script with
  side effects (file I/O) and no exports; it refuses to run without the private
  filter so private repositories cannot leak into public output.
- `arena/*.mjs` — the **battle-simulation engine**. Pure, side-effect-free ES
  modules that export their functions. This is the unit-tested surface.

The `arena` module boundary:

| File                      | Responsibility                                                        |
| ------------------------- | --------------------------------------------------------------------- |
| `arena/engine.mjs`        | `seededRng`, `scoreCardForPlay`, `resolveMatch` (deterministic reducer) |
| `arena/genome.mjs`        | agent creation, fork, crossover, deck hashing, maturity vector, `divBond` |
| `arena/clinic.mjs`        | match-trace analysis (the seven "tells"), journal, shadow, remediation |
| `arena/policy/*.mjs`      | swappable "minds" implementing one `decide(state, agent)` contract     |

## Invariants an agent MUST preserve

1. **Determinism.** `seededRng(seed)` returns the same stream for the same seed,
   and `resolveMatch({agentA, agentB, seed, cardsByID})` returns a byte-identical
   verdict for identical inputs. The headless tournament depends on this. Passing
   `record: true` adds a trace but must never change the verdict, turn count, or
   rng stream.
2. **Content-addressed deck identity.** `deckSignature` is sorted by card id and
   `deckHash` is a stable hash of that signature, so the same composition hashes
   identically regardless of insertion order.
3. **Lawful bond.** `divBond(agent, pool)` is `0` when every policy bias weight
   has a backing card in the deck's support and vice-versa. `makeRandomAgent`,
   `forkAgent`, and `crossover` all prune bias maps to keep it `0`.
4. **Bounded stats.** Derived card stats stay clamped (see `build.mjs`
   `statsFor`); decks cap at 30 cards.

## How to run the tests

```bash
npm test        # or: node test.mjs
```

`test.mjs` imports the real `arena` source modules and asserts on observed return
values (deterministic seeds, pinned match verdicts, the bond invariant, the
maturity vector, and the clinic accumulators). Keep it green: if a change alters
a documented invariant, update the source and the assertion together; do not
delete an assertion to silence it. There are no runtime dependencies, so no
install step is required before running the suite.
