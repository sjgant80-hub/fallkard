// fallkard · kernel.test.mjs — the card-derivation rules, each falsifiable.
// build.mjs was a script no test could reach: the mutation gate scored it 0/55.
// These tests run the extracted kernel against a small fixture where every rule
// has a case that fails if the rule bends. Hash pins were derived by running the
// real kernel once and pinning the observed value — a collapsed hash (the NaN>>>0
// class of mutant) lands on index 0 and every pin below moves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeKernel } from './kernel.mjs';

const manifest = {
  chamberFromPrefix: { 'fa': 'keep', 'fall': 'vault' },
  wellnessIds: ['well-1'], surfaceIds: ['surf-1'],
  genesisSet: [
    { id: 'gen-1', name: 'Genesis One', flavour: 'gen flavour' },
    { id: 'gen-missing', name: 'Ghost', flavour: 'ghost flavour' },
    { id: 'gen-sig', name: 'Sigiled', flavour: 'sig flavour', sigil: '✦' },
  ],
  flagshipIds: ['flag-1'],
  kinds: {
    tool: { curve_lo: 2, curve_hi: 5, base_atk: 3, sockets: 1, shape: 'Sword Shape' },
    sdk: { curve_lo: 1, curve_hi: 3, base_atk: 2, sockets: 2, shape: 'Pillar Shape' },
    surface: { curve_lo: 3, curve_hi: 6, base_atk: 1, sockets: 0, shape: 'Arch Shape' },
    wellness: { curve_lo: 1, curve_hi: 2, base_atk: 1, sockets: 0, shape: 'Well Shape' },
  },
  sets: { alpha: { members: ['flag-1'] } },
  abilityOverrides: { 'ovr-1': { name: 'Overridden', flavour: 'override flavour', keywords: ['K1'], cost: 9, atk: 7, hp: 2 } },
  chambers: { market: { color: '#111111' }, keep: { color: '#222222' }, vault: { color: '#333333' }, bridge: { color: '#444444' }, forge: { color: '#555555' } },
};
const FILTER = { denylist: ['secretword'], slugPrivatePattern: '^priv-', privateSlugs: ['exact-private'] };
const K = makeKernel(manifest, FILTER);

test('THE PRIVACY GATE HOLDS ON BOTH ARMS — pattern hits AND exact slugs are both private', () => {
  assert.equal(K.isPublicSafe('priv-anything'), false, 'a pattern-private slug was called safe');
  assert.equal(K.isPublicSafe('exact-private'), false, 'an exact-list private slug was called safe');
  assert.equal(K.isPublicSafe('clean-id'), true);
  // and a filter with no exact list at all still constructs and gates by pattern
  const K2 = makeKernel(manifest, { denylist: ['x'], slugPrivatePattern: '^priv-' });
  assert.equal(K2.isPublicSafe('priv-a'), false);
  assert.equal(K2.isPublicSafe('clean'), true);
});

test('A MISSING TITLE IS SAFE, A DENYLISTED TITLE IS NOT', () => {
  assert.equal(K.titleIsSafe(undefined), true, 'no title must mean nothing to leak');
  assert.equal(K.titleIsSafe('clean title'), true);
  assert.equal(K.titleIsSafe('mentions secretword here'), false);
});

test('THE SIGIL IS CONTENT-ADDRESSED — pinned; a collapsed hash lands on ◊ and this moves', () => {
  assert.equal(K.sigilFor('plain-1'), '⟡');
});

test('CHAMBER RESOLUTION: longest prefix wins, then kind, then market', () => {
  assert.equal(K.chamberFor('fallx', 'tool'), 'vault', 'the longer prefix must win');
  assert.equal(K.chamberFor('fa-y', 'tool'), 'keep');
  assert.equal(K.chamberFor('zzz', 'mcp'), 'bridge');
  assert.equal(K.chamberFor('zzz', 'api'), 'bridge');
  assert.equal(K.chamberFor('zzz', 'sdk'), 'forge');
  assert.equal(K.chamberFor('zzz', 'tool'), 'market');
});

test('KIND: manifest lists win over the listing, and no kind at all means tool', () => {
  assert.equal(K.kindFor('well-1', 'sdk'), 'wellness');
  assert.equal(K.kindFor('surf-1', 'sdk'), 'surface');
  assert.equal(K.kindFor('zzz', 'sdk'), 'sdk', 'the listing kind was discarded');
  assert.equal(K.kindFor('zzz', undefined), 'tool');
});

test('GRADE: genesis 0.99, flagship 0.94, and the heuristic is pinned with and without signals', () => {
  assert.equal(K.gradeFor('gen-1', {}), 0.99);
  assert.equal(K.gradeFor('flag-1', {}), 0.94);
  assert.equal(K.gradeFor('plain-1', { tags: ['a', 'b'], tiers: ['x'], docs_url: 'd', repo_url: 'r' }), 0.8650000000000001);
  assert.equal(K.gradeFor('plain-1', {}), 0.764, 'a listing with no tags/tiers arrays must not throw and must pin');
});

test('RARITY THRESHOLDS ARE INCLUSIVE AT 0.90 AND 0.75 — and identity beats grade', () => {
  assert.deepEqual(K.rarityFor('gen-1', 0.5), { rarity: 'uber-unique', tier: 'dark-gold' });
  assert.deepEqual(K.rarityFor('flag-1', 0.5), { rarity: 'unique', tier: 'gold' });
  assert.deepEqual(K.rarityFor('x', 0.90), { rarity: 'rare', tier: 'yellow' }, '0.90 exactly must be rare');
  assert.deepEqual(K.rarityFor('x', 0.8999), { rarity: 'magic', tier: 'blue' });
  assert.deepEqual(K.rarityFor('x', 0.75), { rarity: 'magic', tier: 'blue' }, '0.75 exactly must be magic');
  assert.deepEqual(K.rarityFor('x', 0.7499), { rarity: 'common', tier: 'bone' });
});

test('STATS: the cost curve is pinned, bumps land at exactly 0.90, and unknown kinds use the tool curve', () => {
  assert.deepEqual(K.statsFor('plain-1', 'tool', 0.8), { cost: 4, atk: 3, hp: 10, sockets: 1 });
  assert.deepEqual(K.statsFor('plain-1', 'tool', 0.90), { cost: 4, atk: 4, hp: 12, sockets: 1 },
    'the rare bump must land at exactly 0.90');
  const gen = K.statsFor('gen-1', 'tool', 0.99);
  assert.equal(gen.atk, 6, 'genesis must get +3 atk on base 3');
  const flag = K.statsFor('flag-1', 'tool', 0.94);
  assert.equal(flag.atk, 5, 'flagship must get +2 atk on base 3');
  assert.deepEqual(K.statsFor('plain-1', 'weird-kind', 0.8), { cost: 4, atk: 3, hp: 10, sockets: 1 },
    'an unknown kind must fall back to the tool curve, not throw');
});

test('FLAVOUR: override wins, kind list is content-addressed (pinned), unknown kind uses tool lines', () => {
  assert.equal(K.flavourFor('ovr-1', 'tool'), 'override flavour');
  assert.equal(K.flavourFor('plain-1', 'tool'), 'One tool. One job. Done well.');
  assert.equal(K.flavourFor('plain-1', 'weird'), 'One tool. One job. Done well.', 'unknown kind must use the tool list');
});

test('KEYWORDS: override, kind default, Shard fallback', () => {
  assert.deepEqual(K.keywordsFor('ovr-1', 'tool'), ['K1']);
  assert.deepEqual(K.keywordsFor('plain-1', 'sdk'), ['Sovereign']);
  assert.deepEqual(K.keywordsFor('plain-1', 'weird'), ['Shard']);
});

test('SET MEMBERSHIP and TYPE LINE — the shape comes from the manifest, not the fallback', () => {
  assert.equal(K.setFor('flag-1'), 'alpha');
  assert.strictEqual(K.setFor('nobody'), null);
  assert.equal(K.typeLineFor('tool', 'market', 'rare'), 'Rare · Sword Shape · Market');
  assert.equal(K.typeLineFor('no-such-kind', 'market', 'rare'), 'Rare · Blade Shape · Market');
});

test('THE TEXT GATE THROWS ON A DENYLIST HIT and passes clean or empty text through', () => {
  assert.throws(() => K.gatePublicText('contains secretword', 'x'), /Denylist hit/);
  assert.equal(K.gatePublicText('clean', 'x'), 'clean');
  assert.equal(K.gatePublicText('', 'x'), '');
});

test('THE SVG CARRIES THE CARD — palette, border, emblem, escaping and the stats bar, all pinned', () => {
  const card = {
    id: 'the-id', name: 'A & B <C>', kind: 'weird', chamber: 'no-such-chamber',
    rarity: 'rare', sigil: '◊', typeLine: 'T', flavour: 'F', atk: 7, hp: 9, cost: 4, sockets: 2,
  };
  const svg = K.svgFor(card);
  assert.ok(svg.includes('#111111'), 'an unknown chamber must fall back to the market palette');
  assert.ok(svg.includes('stroke="#d4a017"'), 'the rare border colour is missing');
  assert.ok(svg.includes('150,100 175,280'), 'an unknown kind must render the blade emblem');
  assert.ok(svg.includes('A &amp; B &lt;C&gt;'), 'XML was not escaped');
  assert.ok(svg.includes('<rect x="8" y="390"'), 'the stats bar rect moved');
  assert.ok(svg.includes('y="405" font-family="DM Mono, monospace" font-size="12" fill="#d44a4a" font-weight="700">⚔ 7'), 'the atk cell moved or lost its value');
  assert.ok(svg.includes('fill="#5aa25c" font-weight="700">♥ 9'), 'the hp cell lost its value');
  assert.ok(svg.includes('font-weight="700">✦ 4'), 'the cost cell lost its value');
  // the name falls back to the id when there is none
  const svg2 = K.svgFor({ ...card, name: undefined });
  assert.ok(svg2.includes('>the-id<'), 'a nameless card must show its id');

  // a KNOWN kind must render its OWN emblem, not fall through to the blade
  const sdkSvg = K.svgFor({ ...card, kind: 'sdk' });
  assert.ok(sdkSvg.includes('<rect x="120" y="120" width="60" height="150"'),
    'an sdk card must render the pillar emblem');
  assert.ok(!sdkSvg.includes('150,100 175,280'), 'the blade emblem leaked onto an sdk card');

  // the stats bar geometry is pinned whole — width included, all three cells at y=405
  assert.ok(svg.includes('<rect x="8" y="390" width="284" height="20"'), 'the stats bar geometry moved');
  assert.ok(svg.includes('<text x="118" y="405"'), 'the hp cell moved');
  assert.ok(svg.includes('<text x="200" y="405"'), 'the cost cell moved');
});

test('DERIVE: the gates skip, the chains pick the right name/flavour/url, mintable is earned', () => {
  const listings = {
    listings: [
      { id: 'priv-x', title: 'fine' },
      { id: 'exact-private', title: 'fine' },
      { id: 'bad-title', title: 'contains secretword here' },
      { id: 'flag-1', title: 'Flagship Title', kind: 'tool', repo_url: 'https://real-repo', docs_url: 'https://real-docs' },
      { id: 'gen-1', title: 'Listing Title Ignored', kind: 'tool' },
      { id: 'ovr-1', title: 'Override Loses To Nothing', kind: 'tool' },
      { id: 'dull-1', kind: 'tool' },
    ],
  };
  const r = K.deriveCards(listings);
  assert.deepEqual(r.skipped.map(s => [s.id, s.reason]), [
    ['priv-x', 'private-slug'], ['exact-private', 'private-slug'], ['bad-title', 'private-title'],
  ]);
  const byId = Object.fromEntries(r.cards.map(c => [c.id, c]));

  // name chain: genesis > override > title > id
  assert.equal(byId['gen-1'].name, 'Genesis One', 'genesis name must beat the listing title');
  assert.equal(byId['ovr-1'].name, 'Overridden', 'the override name must beat the title');
  assert.equal(byId['flag-1'].name, 'Flagship Title');
  assert.equal(byId['dull-1'].name, 'dull-1', 'no title anywhere must fall back to the id');

  // flavour chain and override stats
  assert.equal(byId['gen-1'].flavour, 'gen flavour');
  assert.deepEqual([byId['ovr-1'].cost, byId['ovr-1'].atk, byId['ovr-1'].hp], [9, 7, 2]);

  // url chain
  assert.equal(byId['flag-1'].url, 'https://real-repo', 'a real repo_url must not be replaced by the default');
  assert.equal(byId['flag-1'].docsUrl, 'https://real-docs');
  assert.equal(byId['dull-1'].url, 'https://github.com/sjgant80-hub/dull-1');
  assert.strictEqual(byId['dull-1'].docsUrl, null);

  // mintable is earned from rarity
  assert.equal(byId['gen-1'].rarity, 'uber-unique');
  assert.equal(byId['gen-1'].mintable, true);
  assert.equal(byId['dull-1'].rarity, 'common', 'fixture drift: dull-1 was meant to grade common');
  assert.equal(byId['dull-1'].mintable, false, 'a common card must not be mintable');
});

test('GENESIS SYNTHESIS: missing genesis ids become cards with their OWN name, flavour and sigil', () => {
  const r = K.deriveCards({ listings: [{ id: 'gen-1', title: 't', kind: 'tool' }] });
  assert.deepEqual(r.synthesized.sort(), ['gen-missing', 'gen-sig']);
  const byId = Object.fromEntries(r.cards.map(c => [c.id, c]));
  assert.equal(byId['gen-missing'].name, 'Ghost');
  assert.equal(byId['gen-missing'].flavour, 'ghost flavour');
  assert.equal(byId['gen-missing'].grade, 0.99);
  assert.equal(byId['gen-missing'].mintable, true);
  assert.equal(byId['gen-missing'].docsUrl, 'https://sjgant80-hub.github.io/gen-missing/');
  assert.equal(byId['gen-sig'].sigil, '✦', 'a genesis sigil must not be replaced by the hash sigil');
  assert.equal(byId['gen-missing'].sigil, K.sigilFor('gen-missing'), 'no genesis sigil means the hash sigil');
});

test('THE DISTRIBUTIONS COUNT EXACTLY — one card, one increment, no NaN', () => {
  const r = K.deriveCards({ listings: [
    { id: 'flag-1', title: 'F', kind: 'tool' },
    { id: 'dull-1', kind: 'tool' },
  ] });
  // flag-1 (unique) + plain-1 (common) + gen-1/gen-missing/gen-sig synthesized (uber-unique ×3)
  assert.deepEqual(r.rarityDist, { unique: 1, common: 1, 'uber-unique': 3 });
  assert.deepEqual(r.kindDist, { tool: 5 });
  assert.equal(Object.values(r.chamberDist).reduce((a, b) => a + b, 0), 5, 'every card sits in exactly one chamber');
});
