# FallKard FAQ

### What is FallKard?

A sovereign card game where every AI-Native Solutions tool is a real, playable, ownable, forkable card. Diablo 2 Resurrected aesthetics. Hearthstone lane combat. $KONO NFT economy.

### How many cards are there?

1196 at Phase 0 launch. Grows as the estate grows.

### Do I need an account?

No. Runs entirely in your browser. Saves to IndexedDB. PvP is peer-to-peer via WebRTC.

### Does it need a server?

No. Everything is client-side. Optional $KONO substrate calls for NFT minting (Phase 7+), and WebRTC signalling for PvP goes through the sovereign fallnet peer.

### What's the launch date?

Phase 0 shipped 2026-07-10. Genesis Set (10 Uber Uniques) mints 2026-08-10.

### Where do card stats come from?

They're derived from each tool's audit grade, kind, chamber membership, and complexity. A B-grade tool becomes a Magic-rarity card. An A-grade tool becomes a Rare. Flagship builds become Uniques. Cards refresh their stats every session.

### What's a bloodline?

A card's ancestry graph derived from the fork tree of its source repository. Playing multiple cards from the same bloodline triggers +1/+1 buffs. Forking a real repo mints a new bloodline card.

### How do I own a card?

Cards Rare-and-above can be minted as `fn ASSET` NFTs on the OnlyBrains substrate (from Phase 7). Ownership is Ed25519-signed. Trades are peer-to-peer.

### Can I play it now?

Phase 0 is shipped. Cards + art + spec exist. Playable phases: Collection Viewer (Phase 1), Deck Builder (Phase 2), Solo Match (Phase 3). All target Genesis window 2026-08-10.

### What are the rarities?

Common · Magic · Rare · Unique · Set · Uber Unique · Runeword · Charm. Uber Uniques are 1-of-1 Genesis cards only. Never mintable after the Genesis window.

### What's the Genesis Set?

10 Uber Unique cards minted 2026-08-10: The Market's Coin (FallMarket), The Colony's Banner (FallColony), The Nested Cube (FallCube), The Bridge (FallOS), The Origin (FallSeed), The Mirror (FallMirror), The Compass (ShadowCompass), The Autopilot (fall-autopilot-kit), The House Sovereign (FallHub), The Charter (FallEnterprise).

### What are the runewords?

Ten D2R-canon runewords, reworked for card combat: Steel, Malice, Enigma, Faith, Enlightenment, Fortitude, Grief, Chains of Honor, Call to Arms, Heart of Wolves.

### Who are the bosses?

Corrupt-SaaS remnants of the Ancient's fallen kingdom. Slack Fiend, Salesforce Wyrm, Notion Lich, Zoom Basilisk, AWS Behemoth, Twitter/X Manticore, Adobe Golem, Stripe Chimera, Docker Hydra.

### Is it MIT?

Yes. Engine and card renderer are MIT. Game data (grades, bloodlines) fetches live from the estate.

### Can I fork it?

Yes. Every fork is a bloodline. The provenance graph is the economic tree.

### Where's the code?

`https://github.com/sjgant80-hub/fallkard`. See SPEC.md for canonical rules.

### Who made it?

AI-Native Solutions · House of the Fall. Publisher of the 1212-tool sovereign estate.

### What does "cosmology private" mean in the code?

FallKard's build denies a private substrate-terminology list. If a card's name, flavour, or type-line contains a denied term, the build fails. The game surface is public-safe by construction.
