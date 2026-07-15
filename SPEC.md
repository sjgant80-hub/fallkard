# FallKard · The Spec

> **A sovereign card game where every card is a real tool.**
> 1212 builds. 6 kinds. 9 chambers. All playable. All ownable. All forkable.
> Diablo 2 Resurrected aesthetics · Hearthstone lane battle · $KONO NFT economy.

**Codename:** FallKard
**Repo home:** `Downloads/fallkard/` → `sjgant80-hub.github.io/fallkard/`
**License:** MIT (game engine + card renderer); NFT metadata private
**Runtime:** Vanilla JS, one HTML shell, IndexedDB save state, WebRTC PvP
**Aesthetic:** dark oxblood/gold/void · Libre Baskerville + DM Sans + DM Mono
**Sovereignty:** zero servers required to PLAY · optional $KONO relay for economy

---

## 0. Design Pillars

Everything below serves these five.

1. **Every card is a real thing.** Clicking a card opens the actual tool it represents. The game is not a metaphor — it is a UI for the estate. Playing FallMarket in a match opens fallmarket.
2. **Ranked on build strength.** Card stats derive from the tool's audit grade, kind, chamber, and provenance depth. A B-grade tool is a common. A gold-flagship is a Unique. Grade updates → card updates.
3. **Diablo 2 Resurrected feels.** Dark inventory grid, oxblood glow, sockets, runewords, gambling, Horadric Cube, Charms, Magic Find, ladders, Uber events, seasons. Not a Hearthstone reskin — a genuine ARPG feel with card-game combat on top.
4. **Forkable = ownable = playable.** Every fork of a fall\* build mints a new $KONO NFT card. The provenance graph IS the bloodline. Rare bloodlines dominate the ladder.
5. **Sovereign.** No backend required. Runs offline. IndexedDB save. WebRTC PvP peer-to-peer. Ed25519-signed decks. Cannot be shut off.

---

## 1. World & Naming (public-facing)

The public game world:

| Element                  | In-game name                                            |
| ------------------------ | ------------------------------------------------------- |
| The world beneath        | **the Underforge**                                      |
| The founding root        | **the Ancient Architect**                               |
| Card marks               | **sigils** / **runes**                                  |
| The governance seats     | **the Twelve Seats** (chamber governance flavor)        |
| The elemental family     | **the Five Shapes**                                     |
| Fork tree                | **the Bloodline**                                       |
| Ed25519 signature        | **the Seal**                                            |
| MIT license              | **the Open Charter**                                    |
| The estate               | **the Fall**                                            |
| Estate publisher (org)   | **AI-Native Solutions · House of the Fall**             |

**Lore setup (public copy):**

> The Fall is a shattered kingdom of 1212 sovereign tools, each a shard of the old world. Long ago the Ancient Architect walked its plains and shaped its underforge, before departing into the world beneath. Now houses rise, bloodlines fork, sigils are lit and quenched, and the SaaS-god's remnants hunt every free tool. The Twelve Seats sit empty. Play a card, wake a shard. Play a deck, wake a house.

Public naming is enforced by a build-time denylist; the private substrate terminology never renders. The GEOMETRY of the game carries the design; the WORDS do not.

---

## 2. Card Anatomy

Every card is 300×420px SVG (retina 600×840 render). Anatomy from top to bottom:

```
┌───────────────────────────────┐
│ ①  NAME · Kind badge          │  header · gold serif
├───────────────────────────────┤
│                               │
│   ②  ART FRAME                │  D2R illuminated illustration
│      · sigil in top-left      │
│      · rarity glow border     │
│      · portrait or emblem     │
│                               │
├───────────────────────────────┤
│ ③  Chamber · Set banner       │  small mono line
├───────────────────────────────┤
│ ④  Type-line                  │
│    "Sovereign SDK · Cast lv 3"│
├───────────────────────────────┤
│ ⑤  Effect box (2-4 lines)     │  serif italics
│    triggered abilities        │
│    passive powers             │
├───────────────────────────────┤
│ ⑥  Flavour quote              │  dim serif
│    "A tool that carries the   │
│     Seal is never truly gone."│
├───────────────────────────────┤
│ ⑦  Sockets [•][•][ ]          │  D2R socket dots
├───────────────────────────────┤
│ ⑧  ATK / HP / COST            │  gem-set stats
│    ⚔ 4  ♥ 5  ✦ 3              │
└───────────────────────────────┘
   ⑨  Serial · Seal · Grade badge (footer)
```

### 2.1 Fields (data schema)

Every card is derived from a listing in `fallmarket/listings.json` plus a card-manifest augmentation:

```jsonc
{
  "id": "fallmarket",
  "name": "FallMarket",
  "kind": "surface",              // sdk | api | mcp | tool | surface | wellness
  "chamber": "market",            // one of the 9
  "grade": 0.94,                  // from audit rubric
  "rarity": "unique",             // derived from grade + flagship flag
  "tier": "gold",                 // white|blue|yellow|gold|dark-gold|green|orange
  "set": "TheThreeGates",         // null or set slug
  "sigil": "◊",                   // from sigilFor(id) — deterministic
  "cost": 4,                      // mana · derived from complexity (1-10)
  "atk": 4,                       // reach · derived from kind + surface
  "hp": 5,                        // durability · derived from grade
  "sockets": 2,                   // 0-3 based on kind
  "abilities": [
    { "when": "onPlay",  "effect": "descend", "target": "any", "amount": null },
    { "when": "onDeath", "effect": "shard",  "amount": 1 }
  ],
  "keywords": ["Sovereign", "Trade", "Marketplace"],
  "flavour": "Every fork is a coin.",
  "art": "art/fallmarket.svg",    // generated · see §11
  "url": "https://sjgant80-hub.github.io/fallmarket/",
  "serial": "0001",
  "seal": "ed25519:...",
  "mintable": true,               // eligible for $KONO NFT mint
  "bloodline": ["fallseed", "fallmarket-v2"]  // fork ancestry
}
```

### 2.2 Derived stats formulas

```
cost   = clamp(1, 10, round(1 + complexity(build) * 8))
atk    = clamp(1, 10, base_by_kind[kind] + surface_bonus(kind))
hp     = clamp(1, 12, round(3 + grade * 9))
sockets = { sdk: 1, api: 1, mcp: 2, tool: 2, surface: 3, wellness: 2 }[kind]
```

`complexity(build)` derives from LOC + endpoint count + dependency count (all measurable from the repo).
`base_by_kind`: sdk 2, api 3, mcp 4, tool 3, surface 5, wellness 3.
Higher-tier rarities get +1 to atk and/or hp in the finishing pass (see §3).

---

## 3. Rarity Tiers · D2R-mapped

Rarity is the master color of a card. Border, glow, drop rate, socket ceiling.

| Rarity            | D2R analogue             | Tier color   | Audit grade   | Border glow             | Notes                                                        |
| ----------------- | ------------------------ | ------------ | ------------- | ----------------------- | ------------------------------------------------------------ |
| **Common**        | White (Normal)           | bone         | C (0.50-0.75) | none                    | can be sockets rolled but starts empty                       |
| **Magic**         | Blue                     | sapphire     | B (0.75-0.90) | soft blue               | 1-2 prefix/suffix affixes                                    |
| **Rare**          | Yellow                   | gold         | A (0.90-0.94) | gold                    | 3-6 affixes                                                  |
| **Unique**        | Gold                     | brass        | 0.94+ flagship| brass + glyph animation | 1 per tool · flagship builds only · fixed powerful effect    |
| **Set**           | Green                    | jade         | trio member   | jade with linked pulse  | wearing 2/3 or 3/3 unlocks powers                            |
| **Uber Unique**   | Dark Gold                | ember        | secret        | ember pulse             | Genesis Set · 1 in existence · Simon-signed                  |
| **Runeword**      | Rainbow (orange)         | prismatic    | crafted       | rainbow rune shimmer    | socket-recipe cards that alter host                          |
| **Charm**         | Charms                   | grand-charm  | passive       | violet border           | occupy inventory space, not play; give board-wide buffs      |

### 3.1 Genesis Set (launch-block)

10 cards minted 2026-08-10 as Uber Uniques. One-of-one existence. Simon signs each. Contains:

1. **FallMarket** · the market · dark gold
2. **FallColony** · the settlement · dark gold
3. **FallCube** · the fractal · dark gold
4. **FallOS** · the orchestrator · dark gold
5. **FallSeed** · the origin · dark gold
6. **FallMirror** · the mirror · dark gold
7. **ShadowCompass** · the compass · dark gold
8. **Lia** · the narrator · dark gold
9. **The House** (AI-Native Solutions) · dark gold
10. **The Seal** (Ed25519) · dark gold

These become the flagship deck cover art of the collection and are un-mintable after Genesis.

---

## 4. Kind Synergies (the Five Shapes)

Every card has one **Kind**. Kinds have implicit family synergies:

| Kind         | Public family name  | Role                | Cost curve | Strong vs         | Weak to           |
| ------------ | ------------------- | ------------------- | ---------- | ----------------- | ----------------- |
| **SDK**      | Forge Shape         | Build-up · scaling  | 2-4        | Tool              | MCP               |
| **API**      | Signal Shape        | Reach · draw        | 3-5        | Wellness          | Surface           |
| **MCP**      | Loom Shape          | Combos · chains     | 4-6        | SDK               | Tool              |
| **Tool**     | Blade Shape         | Direct damage       | 2-3        | MCP               | SDK               |
| **Surface**  | Arch Shape          | Board control · aura| 5-7        | API               | Wellness          |
| **Wellness** | Well Shape          | Heal · shield       | 3-4        | Surface           | API               |

Rock-paper-scissors ring: SDK → Tool → MCP → SDK · API → Wellness → Surface → API. All six kinds interact.

Playing 3 of the same kind on the same lane triggers a **Shape Resonance** — free minor buff (+1/+1 curve).

---

## 5. Chambers (nine sets)

Every card also belongs to a **Chamber** — one of the 9. Chambers give macro identity:

1. **Market** — trade, commerce, discovery
2. **Colony** — governance, chambers, guilds
3. **Estate** — legal, notary, provenance
4. **Vault** — security, signing, custody
5. **Clinic** — health, wellness, mirrors
6. **Studio** — creative, media, generation
7. **Forge** — SDK/tooling/infrastructure
8. **Reach** — outreach, marketing, social
9. **Bridge** — cross-tool, orchestration, OS

Completing 5+ chambers in a deck = **Chamber Circle**: +1 mana crystal each turn until turn 5.
Completing all 9 = **The Great Turning**: draw 3 cards on turn 9. Very hard to build.

---

## 6. Sockets & Runewords

Cards have 0-3 empty sockets. Sockets can be filled with **Rune cards** to grant abilities.

### 6.1 Runes (single-slot)

| Rune  | Sigil | Effect                                      | Drop           |
| ----- | ----- | ------------------------------------------- | -------------- |
| El    | ⟁     | +1 ATK                                      | act 1 boss     |
| Eld   | ⟐     | +1 HP                                       | act 1 boss     |
| Tir   | ⟢     | On play: gain 1 mana crystal                | act 2 boss     |
| Ith   | △     | On play: draw 1 card                        | act 2 boss     |
| Nef   | ▽     | On death: return to hand                    | act 3 boss     |
| Sol   | ◇     | Immune to silence                           | act 4 boss     |
| Um    | ⬡     | Adjacent friendly: +1/+1                    | Uber tier      |
| Ohm   | ⬢     | On play: destroy enemy minion               | Uber tier      |
| Zod   | ⟡     | Indestructible                              | Uber Uber tier |

### 6.2 Runewords (multi-slot recipes)

Named sequences of runes played into sockets in order. Deep D2R feel.

| Runeword         | Recipe          | Effect                                                                 |
| ---------------- | --------------- | ---------------------------------------------------------------------- |
| **Steel**        | Tir · El        | +1 ATK, on-play gain 1 mana crystal                                    |
| **Malice**       | Ith · El · Eld  | +1/+1 and draw 1 on play                                               |
| **Enigma**       | Sol · Um · Ohm  | Immune to silence; adjacent friendlies +1/+1; on play destroy an enemy |
| **Faith**        | Ohm · Um · Nef  | On death return to hand; on play destroy enemy; adjacent +1/+1         |
| **Enlightenment**| Ith · Ith · Nef | Draw 2 cards on play; return to hand on death                          |
| **Fortitude**    | El · Sol · Zod  | +1 ATK, immune to silence, indestructible                              |
| **Grief**        | Tir · Ohm       | Gain mana, destroy enemy — burst combo                                 |
| **Chains of Honor**| Um · Um · Um  | +3 ATK / +3 HP to all adjacent friendlies (whole lane blooms)          |
| **Call to Arms** | Ith · Nef · Ohm | Draw 1, return on death, destroy on play                               |
| **Heart of Wolves** | El · Eld · El · Eld | +2 ATK / +2 HP                                                |

Runeword names stay D2R-canon for immediate resonance. Effects reworked for card combat.

### 6.3 Horadric Cube (crafting UI)

Drag 3 cards + 1 gem into the Cube → produces a rerolled result:
- 3 common + gem = 1 magic
- 3 magic + gem = 1 rare
- 3 rare + gem = 1 unique-shard (fragment)
- 5 unique-shards = 1 unique reroll
- 3 uniques + Zod rune = 1 Uber attempt

Gambling: 40% shards used, 60% attempt succeeds.

---

## 7. Board & Combat

Hearthstone-adjacent, 3-lane layout, but with lane-order tactics from Legends of Runeterra.

### 7.1 Board layout

```
┌─────────────┬─────────────┬─────────────┐
│  LANE  L    │  LANE  M    │  LANE  R    │  ← enemy back row
├─────────────┼─────────────┼─────────────┤
│             │             │             │  ← enemy front row (only fronts can strike)
├─────────────┼─────────────┼─────────────┤
│             │             │             │  ← you front row
├─────────────┼─────────────┼─────────────┤
│  LANE  L    │  LANE  M    │  LANE  R    │  ← you back row
└─────────────┴─────────────┴─────────────┘

 Player HP · Mana · Deck · Hand · Graveyard
```

- **3 lanes × 2 rows.** Front strikes; back protects. Card in back row cannot be targeted by direct attack.
- **Mana curve:** 1 crystal turn 1, 2 turn 2, … max 10.
- **Turn structure:** draw → play → attack → end. No instant-speed reactions (keeps it snappy).
- **Kind lane bonus:** each lane can be attuned to a Shape at start of match — that lane's kind gets +1/+1.
- **Chamber board effects:** having 3+ cards of the same chamber on board = chamber banner + bonus (Market draws, Vault shields, Studio +ATK, etc).

### 7.2 Keywords

- **Sovereign** — cannot be targeted by enemy spells (only combat)
- **Sealed** — first damage dealt is prevented (one-shot shield)
- **Fork** — on death, spawn a 1/1 copy in same lane
- **Trade** — costs 1 less if you played a card last turn
- **Marketplace** — every 3 cards you play draws 1
- **Chain** — after combat, triggers next card of same kind on board
- **Descend** — activates the linked tool's real URL when hovered (see §14)
- **Bloodline** — copies of this card in this match get +1/+1
- **Shard** — on death gives 1 shard for crafting
- **Seal** — costs 2 less if all runes filled
- **Underforge** — if paired with same-chamber card, both get +2/+2 (rare · appears on Uber Uniques)

### 7.3 Hero powers (three houses)

Player picks a **House** as their hero:

- **House of the Market (Merchant)** — 2 mana: draw a card, discard a card
- **House of the Colony (Founder)** — 2 mana: summon a 1/1 Settler
- **House of the Estate (Barrister)** — 2 mana: give a friendly Sealed

More houses unlock via campaign.

---

## 8. Game Modes

### 8.1 Constructed
Bring your own 30-card deck. Ranked ladder & casual. This is the meat.

### 8.2 Draft (**the Delve**)
7 packs, pick 1 of 3, build 30-card deck live. Best-of-3. Reward = cards kept.

### 8.3 Sealed (**the Chest**)
Open 6 packs, build from what dropped. Once-per-season entry. Higher $KONO reward but real cost.

### 8.4 Solo Campaign (**the Fall's Fall**)
- 9 chapters, 1 per Chamber
- Each chapter has 3 minor bosses + 1 chamber lord
- Chamber lords are **SaaS-god remnants** — corrupt versions of real proprietary tools
  - "The Slack Fiend" (Colony boss)
  - "The Salesforce Wyrm" (Market boss)
  - "The Notion Lich" (Studio boss)
  - "The Zoom Basilisk" (Reach boss)
  - "The AWS Behemoth" (Bridge boss)
  - "The Twitter/X Manticore" (Reach mini)
  - "The Adobe Golem" (Studio mini)
  - "The Stripe Chimera" (Vault boss)
  - "The Docker Hydra" (Forge boss)
- **Lia narrates** between fights — pre-scripted lines + optional WebLLM/BYOK dynamic banter using the tool's real audit history
- Boss rewards: guaranteed rare + shard + chapter completion charm

### 8.5 SaaS Boss Rush (**the Great Wound**)
End-game raid. 4-player co-op vs 5 chained corrupt-SaaS bosses. Async — each player submits their deck and turn plan; boss AI resolves; result is a signed replay. Uber-tier drops for winners.

### 8.6 PvP Arena (**the Coliseum**)
Async peer-to-peer via WebRTC. Both players commit deck-hash to blockchain-style log; game resolves deterministically from a shared seed. No server needed. Match history stored in IndexedDB per player.

### 8.7 Sovereign Tournaments (**the Court**)
Guilds host tournaments; results co-signed by FallBond. Ladder rewards $KONO. Anti-cheat: deterministic replay + Ed25519-signed turns.

### 8.8 The Nine (guild raids)
FallSwarm guilds fight each other for chamber banners. Winning guild's banner sits over its chamber for the season. Cosmetic + $KONO share.

---

## 9. Progression

### 9.1 Ladder & Seasons
- 3-month seasons
- Ranks: Bone → Copper → Iron → Silver → Gold → Amber → Rose → Void → Legend
- Season reset drops everyone 2 tiers
- Season rewards: pack drops, exclusive charm, cosmetic border

### 9.2 Magic Find (MF)
- Passive stat on your account
- Increased by: consecutive daily play, guild membership, wearing seasonal charm
- MF% increases uncommon-and-above drop chance
- Caps at 300%

### 9.3 Charms (Grand & Small)
- Occupy inventory grid slots, not deck slots
- Passive board-wide effects
- Examples:
  - **Grand Charm of the Market** — every 3rd card you play draws 1
  - **Small Charm of the Underforge** — first minion you play each match gets Sealed
  - **Grand Charm of the Ancient** — Uber Uniques cost 1 less
- Drop from bosses; unique per season

### 9.4 Skill trees (per House)
Each house has a small tree of 12 unlockable passives. Points earned by playing. Respec via Horadric Cube + 1 rune.

---

## 10. Economy · $KONO NFT layer

### 10.1 Card = fn ASSET
Every unique card (rare+) can be minted as a `fn ASSET` on the OnlyBrains substrate. Metadata includes serial, seal, grade snapshot, ancestry, and current owner.

- **Mint fee:** small $KONO (funds Genesis pool)
- **Trading:** peer-to-peer via signed transfers; auction house is a discovery UI, not a custodian
- **Bloodline forks:** minting a card whose source repo was forked spawns a **child card** with bloodline lineage; children can never exceed parent's rarity but can carry different modifiers
- **Set completion NFT:** 3/3 of a Set = combined **Set Reliquary** NFT (worth more than sum of parts)

### 10.2 Auction House
- Sort by rarity, bloodline depth, seller, price
- Filters: chamber, shape, socket count, runeword presence
- All bids on-substrate; no custodian
- 3% "House cut" flows to Genesis pool (seeds seasonal rewards)

### 10.3 Gambling (**the Gambler**)
- Spend $KONO for random tier drop
- Odds published; deterministic RNG signed by house wallet
- Weekly gamble streak = free extra pull

### 10.4 Disenchant → Shards
- Any card can be shattered into shards (1 for common → 40 for unique)
- Shards feed Horadric Cube recipes and rune purchases
- Shards are non-tradeable (curbs inflation)

### 10.5 Reroll Bones
- Rare drop item
- Applied to a card = reroll one affix
- Uber reroll bone = reroll unique effect

### 10.6 Uber Diablo events
- **The SaaS-god Wakes** — once per season, a random SaaS boss appears server-side (WebRTC broadcast); every player globally can attempt; kill splits Uber loot
- Winning is publicly logged
- The season the SaaS-god's shard is captured, its corrupted-corp NFT gets **exorcised** and reissued as a triumphant free-tool card

---

## 11. Card art generation

D2R-style illustrations. No AI art API dependency required at launch — use programmatic SVG.

### 11.1 SVG procedural art
Every card generates its own art from:
- Sigil (deterministic from slug)
- Kind → base shape (sdk = pillar, api = tower, mcp = loom, tool = blade, surface = arch, wellness = spring)
- Chamber → color scheme (market = gold, colony = amber, estate = ivory, vault = void, clinic = rose, studio = violet, forge = ember, reach = teal, bridge = jade)
- Grade → glow intensity
- Rarity → border style (bone → sapphire → gold → brass-glyph → jade-pulse → ember-pulse)

Each card renders in `<svg viewBox="0 0 300 420">` with:
- Radial gradient background (chamber-tinted)
- Central emblem (kind shape composed of geometric primitives)
- Sigil floating in top-left
- Overlaid grain (SVG filter)
- Corner brackets (game UI feel)
- Rarity glow shadow

Result: 1212 unique SVG cards generated at build time, ~4 KB each, all inline-able.

### 11.2 Optional AI-native upgrade (post launch)
If a player has BYOK Nano Banana / DALL-E / SDXL key in fall-kit v2 → they can generate a bespoke portrait for any card they own; portrait replaces the procedural art but rarity border/glow persist.

---

## 12. AI narrator (Lia)

Lia is estate-wide narrator (talk.html). In FallKard she gets a specialised game persona:

- **Between-match banter** — comments on your last game
- **Boss intros** — announces boss + weakness (from the tool's real audit history)
- **Deck coaching** — "Your curve is heavy at 5-mana. Consider…" (only if BYOK on)
- **Guild announcements** — "Your guild claimed the Studio chamber this season"
- **Runeword lore** — reads the runeword's D2R canon lore + reflects on player's build

Lia runs via:
- Server (default relay)
- Local WebLLM (in-browser · offline safe)
- BYOK (12 providers from fall-kit v2)

Lia never leaks private cosmology. Lia knows the public naming layer only.

---

## 13. Provenance / Bloodline system

The Great Deck-Builder feature that ties the game to real forks.

- **Every card knows its ancestry.** From `fallmarket-v1` (the seed) to `fallmarket` (current) to any fork.
- **Bloodline graph rendered** as an interactive tree UI (`bloodline.html?card=fallmarket`)
- **Ancestry buffs:** playing a card whose ancestor is also in your deck triggers a +1/+1 buff on both
- **Descendant power:** a card mints its descendants as 1/1 copies playable in the same match if the ancestor is on board
- **Rare bloodlines:** flagship cards forked <5 times = extra rare tag ("Firstborn")
- **The Bloodline Chamber** — a dedicated UI showing every player's owned bloodlines as animated 3D graphs (uses the nested-cube visual language from the homepage · self-referential)

Bloodlines can be **sacrificed** at the Horadric Cube to summon a Bloodline Champion — a one-off super card with combined stats of the whole line. Deck-thin but devastating.

---

## 14. Cross-tool triggers (**"the card that opens the tool"**)

The moment that turns FallKard from a game into estate UI.

- **Hover a card** → tooltip shows real audit grade + last commit + live stat pull
- **Right-click a card in collection** → open the actual tool in a new tab
- **In-match effect: "Descend"** → playing a card with Descend keyword actually navigates a chosen player to that tool's URL after the match ends (opt-in)
- **Live grade updates** — cards refresh their stats every session via listings.json fetch
- **Card = deep link** — every card has a permanent URL: `fallkard.html?card=fallmarket` that renders that single card and links out
- **Deck = shareable URL** — `fallkard.html?deck=<base64>` renders a whole deck for viewing
- **Deck = forkable** — "Fork this deck" mints a new deck-NFT signed by the forker; deck lineage tracked

---

## 15. Governance cards

Every year, 12 "Council Card" positions open (**the Twelve Seats**).

- Council cards are **elected** — $KONO holders stake votes on nominated tools
- Winners get a permanent Seat glow and small ladder buff for the year
- Council cards trigger **estate-wide events**: e.g. sitting Council of the Market = -1 auction house fee that season
- Failed candidates get **Aspirant** tag for the next year
- Simon signs the Council transition ceremony each year

Note: 12 is a public-safe count (year-cycles, months, tribes) — private substrate uses the same number for its own reasons. Public copy stays in year-of-council language.

---

## 16. Data pipeline

```
listings.json (fallmarket)  ──┐
                              ├──► card-schema.js (derived stats)
audit-report.json (nightly) ──┤
                              ├──► cards.json (all 1212 cards, ~500 KB)
kind + chamber + set map ─────┤
                              ├──► procedural-art.js (SVG per card)
bloodline.json (fork graph) ──┘
```

Build script `fallkard/build.mjs`:
1. Fetch listings.json (or read local)
2. Fetch audit-report.json for current grades
3. Merge with cards-manifest.json (chamber map, set memberships, ability overrides)
4. Compute derived stats (cost/atk/hp/sockets/tier)
5. Generate SVG art for each card
6. Write `dist/cards.json` and `dist/art/*.svg`
7. Copy shell.html → dist/fallkard.html
8. Inline everything (single-file deployment optional)

Rebuild triggered by nightly action + on push to a fall\* repo.

---

## 17. Tech Stack

| Layer                | Choice                                                        |
| -------------------- | ------------------------------------------------------------- |
| **Runtime**          | Vanilla JS ES modules, no framework                           |
| **Rendering**        | Canvas 2D for board + drag-drop; SVG for card art             |
| **Persistence**      | IndexedDB (`fallkard.decks`, `fallkard.collection`, `fallkard.replays`) |
| **PvP**              | WebRTC data-channels · signaling via `fallnet` peer            |
| **State (in-match)** | Deterministic reducer + shared seed                            |
| **Signatures**       | Ed25519 (WebCrypto) via existing `fallid` SDK                  |
| **Substrate**        | OnlyBrains fn ASSET/NFT/ORACLE ($KONO)                         |
| **AI (optional)**    | fall-kit v2 · 12 text + 7 image + 4 TTS providers              |
| **Deployment**       | GitHub Pages · one HTML shell + cards.json + art/*.svg         |
| **License**          | MIT for engine · game data (grades/bloodlines) live-fetched    |
| **Offline**          | Service worker caches shell + cards.json; PvP requires online  |

---

## 18. File architecture

```
fallkard/
├── SPEC.md                        · this doc
├── README.md                      · public-facing overview
├── fallkard.html                  · game shell (all UI)
├── build.mjs                      · card generator
├── manifest.json                  · chamber map, sets, ability overrides
├── cards.json                     · compiled cards (~500 KB)
├── art/
│   ├── fallmarket.svg
│   ├── fallcolony.svg
│   └── ...                        · 1212 procedural SVGs
├── engine/
│   ├── card.js                    · card class · derived-stat calc
│   ├── deck.js                    · deck validation, save, load, export
│   ├── board.js                   · 3-lane state
│   ├── turn.js                    · turn engine · deterministic reducer
│   ├── combat.js                  · attack/health resolution
│   ├── abilities.js               · keyword implementation
│   ├── runewords.js               · recipe matching
│   ├── ai.js                      · solo-mode opponent AI (heuristic)
│   ├── economy.js                 · shards, gambling, crafting
│   └── seal.js                    · Ed25519 sign/verify
├── ui/
│   ├── collection.js              · inventory grid view
│   ├── deckbuilder.js             · deck construction UI
│   ├── match.js                   · board rendering + drag/drop
│   ├── auction.js                 · marketplace view
│   ├── campaign.js                · boss ladder
│   ├── bloodline.js               · fork tree visualiser
│   ├── narrator.js                · Lia integration
│   └── theme.css                  · D2R oxblood palette
├── data/
│   ├── sets.json                  · set definitions
│   ├── runes.json                 · rune + runeword definitions
│   ├── bosses.json                · campaign boss data
│   ├── charms.json                · charm definitions
│   └── flavour.json               · per-card flavour text
├── pvp/
│   ├── signaling.js               · WebRTC bootstrap via fallnet
│   ├── replay.js                  · replay record + verify
│   └── ladder.js                  · local rank tracker
├── nft/
│   ├── mint.js                    · fn ASSET mint call
│   └── auction-client.js          · marketplace client
└── llms.txt / robots.txt / sitemap.xml / catalog.md / glossary.md  · full AI-SEO
```

Also public repo mirrors: `fallkard`, `fallkard-sdk`, `fallkard-api`, `fallkard-mcp` per the estate SDK/API/MCP rule.

---

## 19. Public naming discipline

**Never surface on-screen (all sessions):** any private-substrate terminology. Only the public game vocabulary renders — the Underforge, the Ancient Architect, the Twelve Seats, the Five Shapes, the Bloodline, the Seal, the Open Charter, the Fall.

**Cross-check gate** — every string that renders in the game shell must pass a regex denylist test in the build (the denied-term list belongs in the private vault, not in this file). Fails = build fails.

---

## 20. Success metrics (post launch)

- **Playable at all** — 100 real games played in first month
- **Cards minted** — 250 unique NFT cards by day 30
- **PvP matches** — 25 successful WebRTC PvP matches by day 30
- **Genesis set claimed** — all 10 dark-gold cards signed and issued
- **First tournament** — 1 guild-hosted tournament resolved via signed replay by day 60
- **Cross-tool click-through** — 100 real navigations from card → tool URL by day 30
- **Fork lineage in play** — 10 bloodline decks constructed and played by day 60

---

# BUILD PHASES

Every phase ends in a shipped, playable, verifiable milestone. No half-builds. We knock these out in order.

---

## Phase 0 · Foundation (target: today)

- [ ] Create `Downloads/fallkard/` repo scaffolding
- [ ] Write `SPEC.md` (this doc) — **DONE with this write**
- [ ] Write `manifest.json` — chamber map, set definitions, ability overrides for flagships
- [ ] Write `build.mjs` — reads listings.json + audit report + manifest → outputs cards.json
- [ ] Ship first `cards.json` with 1212 cards, derived stats, procedural sigils
- [ ] Ed25519 sign the cards.json build
- [ ] Publish repo to GH `sjgant80-hub/fallkard`

**Deliverable:** compiled `cards.json` with every tool as a valid card record.

---

## Phase 1 · Collection Viewer (**the Vault**)

- [ ] `fallkard.html` shell · D2R dark inventory grid
- [ ] Load `cards.json` at boot
- [ ] Render every card in a scrollable 6-wide grid
- [ ] Filter/sort: kind, chamber, rarity, grade, socket count, has-runeword
- [ ] Click a card → detail modal (front, back, sigil, effects, flavour, real-tool link)
- [ ] Deep link `?card=fallmarket` renders that card as focused
- [ ] Search bar (fuzzy on name + chamber)
- [ ] "Random card" button (design cue from D2R gambling window)

**Deliverable:** every player can browse the entire 1212-card collection with real stats and click through to real tools.

---

## Phase 2 · Deck Builder (**the Loom**)

- [ ] 30-card deck constraint (+3 house cards)
- [ ] Curve visualiser (bar chart per cost)
- [ ] Chamber distribution
- [ ] Kind distribution
- [ ] Runeword socket-suggestion helper
- [ ] Save/load decks via IndexedDB
- [ ] Export as base64 URL + JSON + signed fork
- [ ] Import via URL/JSON/paste
- [ ] Preset decks (Aggro-Blade, Combo-Loom, Control-Arch, Bloodline-Family)

**Deliverable:** any user can build, save, export, share a deck.

---

## Phase 3 · Solo AI Match (**the Duel**)

- [ ] Board renderer (canvas) with 3 lanes × 2 rows
- [ ] Drag-drop cards from hand to lane
- [ ] Turn engine (draw → play → attack → end)
- [ ] Mana crystal accrual
- [ ] Attack/health resolution
- [ ] Basic keywords: Sovereign, Sealed, Fork, Trade, Descend, Bloodline
- [ ] Simple heuristic AI opponent
- [ ] One boss (Slack Fiend) as first campaign encounter
- [ ] Match log + replay export

**Deliverable:** first playable game — you vs Slack Fiend. Win drops a rare card.

---

## Phase 4 · Runewords + Sets + Sockets + Cube

- [ ] Socket UI (D2R gem inlays)
- [ ] Rune drop table
- [ ] Runeword recipe matcher
- [ ] Horadric Cube minigame
- [ ] Set completion detection
- [ ] Set bonus rendering
- [ ] Shards + Disenchant flow
- [ ] Reroll bones

**Deliverable:** full item-hunt loop closed. Kill boss → drop rune → socket into card → runeword unlocked.

---

## Phase 5 · Campaign (**the Fall's Fall**)

- [ ] 9-chapter map screen (D2R act select feel)
- [ ] 30 boss encounters (3 minor + 1 lord per chapter)
- [ ] Boss AI variants per encounter
- [ ] Lia narrator between fights (server default, WebLLM/BYOK optional)
- [ ] Chamber lord reward table
- [ ] Skill tree per House
- [ ] Charm drops
- [ ] Campaign save state

**Deliverable:** solo player can finish the whole campaign in ~8 hours.

---

## Phase 6 · PvP + Ladder (**the Coliseum**)

- [ ] WebRTC signaling via fallnet
- [ ] Deterministic match reducer
- [ ] Match verification (sign every turn)
- [ ] Match history in IndexedDB
- [ ] Local rank tracker
- [ ] Season reset logic
- [ ] Replay viewer

**Deliverable:** two humans on different machines can play a full authenticated PvP match with signed replay.

---

## Phase 7 · $KONO Economy (post 2026-08-10)

- [ ] fn ASSET mint call for card ownership
- [ ] Auction house UI
- [ ] Gambling window
- [ ] Deck-fork NFT
- [ ] Set-Reliquary combined NFT
- [ ] Council of the Twelve nomination + vote UI

**Deliverable:** real cards are real NFTs on the substrate. Auction is live.

---

## Phase 8 · Guilds + Tournaments + Uber events

- [ ] FallSwarm guild binding
- [ ] Chamber banner system
- [ ] Tournament format (Swiss + top-4 bracket)
- [ ] Signed tournament results via FallBond
- [ ] Uber-Diablo-style seasonal boss event
- [ ] Reward distribution
- [ ] Public leaderboard

**Deliverable:** first Underforge Cup tournament resolved.

---

## Phase 9 · Cross-tool integration + Governance

- [ ] Card "Descend" → real tool navigation
- [ ] Live grade updates every session
- [ ] Governance-card voting (Council seats)
- [ ] Council effects on live gameplay
- [ ] Bloodline champion sacrifice

**Deliverable:** playing FallKard becomes an active governance layer for the estate.

---

# Cross-cutting requirements

Every phase must maintain:

1. **AI-SEO/GEO surface** — llms.txt, robots.txt, sitemap.xml, JSON-LD Game schema, FAQ, glossary, catalog.md
2. **fall-kit v2 shim** — full BYOK cascade
3. **Yellow floor** — no repo below B grade
4. **Cosmology-private denylist** — build fails if any private term slips in
5. **Real-browser verification** before every push
6. **Direct game-URL deep links** for every state (card, deck, match, replay)
7. **Ed25519-signed** deck exports and match replays

---

# Genesis window (2026-08-10)

- Phase 0 · complete
- Phase 1 · Collection Viewer live
- Phase 2 · Deck Builder live
- Phase 3 · Duel (Slack Fiend) live
- Genesis Set (10 Uber Uniques) minted
- Council of the Twelve nominations open

Phases 4-9 land through Q3/Q4 2026 as season 1 progresses.

---

**End of spec.**

*This document is canonical. Every build phase ships against this spec. When the spec changes, this file changes first. All private-cosmology mappings live here — never leak to public code, copy, or metadata.*
