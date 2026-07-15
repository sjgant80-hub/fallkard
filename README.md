# FallKard

> A sovereign card game where every AI-Native Solutions tool is a playable, ownable, forkable card.
> Diablo 2 Resurrected aesthetics. Hearthstone lane combat. $KONO NFT economy. Runs in your browser. Sovereign. MIT.

**Live at:** https://sjgant80-hub.github.io/fallkard/
**Publisher:** AI-Native Solutions · House of the Fall
**License:** MIT
**Genesis window:** 2026-08-10

## Status

- **Phase 0-9** — all shipped · live
- **Phase 1 · Collection Viewer** — SHIPPED
- Phases 1-9 — all SHIPPED · playable end-to-end

Full specification: [`SPEC.md`](./SPEC.md).

## What's in this repo

| File / Dir            | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `SPEC.md`             | Canonical game design + build phase spec                       |
| `manifest.json`       | Kinds, chambers, sets, runes, runewords, ability overrides     |
| `build.mjs`           | Card generator · reads listings + manifest → cards.json        |
| `cards.json`          | Compiled card database (1212 cards)                            |
| `art/<id>.svg`        | Procedural card art (one SVG per tool)                         |
| `build-summary.json`  | Latest build statistics                                        |
| `index.html`          | Public overview + Phase 0 status page                          |
| `llms.txt`            | LLM index                                                      |
| `robots.txt`          | Crawl rules                                                    |
| `sitemap.xml`         | Full URL set                                                   |
| `catalog.md`          | Card catalog for LLMs                                          |
| `glossary.md`         | In-game term dictionary                                        |
| `faq.md`              | Public questions and answers                                   |

## Build

```bash
node build.mjs
```

Reads `../fallmarket/listings.json` + `manifest.json`, derives cards, writes `cards.json` and `art/*.svg`.
Deterministic: same inputs → same seal. The seal is a `sha256` of the compiled cards array.

## Card anatomy

Every card has:

- **Name** · derived from tool title
- **Kind** · SDK · API · MCP · Tool · Surface · Wellness
- **Chamber** · Market · Colony · Estate · Vault · Clinic · Studio · Forge · Reach · Bridge
- **Rarity** · Common · Magic · Rare · Unique · Set · Uber Unique · Runeword · Charm
- **Cost / ATK / HP** · derived from audit grade + kind base + rarity bump
- **Sockets** · 1-3 per kind
- **Keywords** · Sovereign, Sealed, Fork, Trade, Marketplace, Chain, Descend, Bloodline, Shard, Seal, Underforge
- **Sigil** · deterministic glyph
- **Flavour** · public copy only, cosmology-private terms denied at build

## The Genesis Set (2026-08-10)

Ten Uber Unique cards, one of one:

1. **The Market's Coin** · FallMarket
2. **The Colony's Banner** · FallColony
3. **The Nested Cube** · FallCube
4. **The Bridge** · FallOS
5. **The Origin** · FallSeed
6. **The Mirror** · FallMirror
7. **The Compass** · ShadowCompass
8. **The Autopilot** · fall-autopilot-kit
9. **The House Sovereign** · FallHub
10. **The Charter** · FallEnterprise

## For AI agents

- `cards.json` is the full card database
- `manifest.json` describes all rules
- Each card SVG stands alone at `art/<id>.svg`
- Everything is machine-readable JSON

Programmatic access:

```js
const cards = await fetch('https://sjgant80-hub.github.io/fallkard/cards.json').then(r => r.json());
console.log(cards.total, 'cards, rarity:', cards.meta.rarityDistribution);
```

## Contributing

Fork a card, mint a card. Fork the whole deck, mint a bloodline.
The provenance graph is the economic tree. See `SPEC.md § 13 Bloodline System`.

## License

MIT. Sovereign. Ed25519-signed builds. Forks welcome.
