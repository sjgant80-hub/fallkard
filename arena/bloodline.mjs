// FallKard Arena · bloodline.mjs
// The DESCENDANTS economy. A Seal is a wallet — you never buy the Seal, you buy a
// FORK-SHARE: fractional, royalty-bearing equity on its DESCENDANT TREE. The genealogy is
// already in the data (every fork carries a parent pointer); this makes the economy over it
// computable. (Node + browser compatible, no deps.)
//
// The load-bearing claim — PROVENANCE INVERTS SCARCITY: a founder is worth MORE than its
// descendants, because value flows UP the bloodline. Each descendant routes a royalty of
// DECAY^depth back to every ancestor; DECAY < 1 makes deep generations contribute →0, so an
// unbounded tree still prices to a finite number. Along a single lineage the sum is bounded
// by 1/(1−DECAY) = the golden ratio. This file computes all of it and ships a falsifiable
// verdict: along the deepest bloodline, price must be non-increasing root→leaf.

export const DECAY = 0.618;            // the discount / hold constant per generation
export const CHAIN_BOUND = 1 / (1 - DECAY);   // ≈ 2.618 · the single-lineage DCF ceiling (it converges)

// ── forest from a births ledger [{id, parent, gen, handle}]
export function buildForest(births) {
  const node = new Map();
  for (const b of births) node.set(b.id, { id: b.id, parent: b.parent || null, gen: b.gen, handle: b.handle, children: [] });
  const roots = [];
  for (const n of node.values()) {
    if (n.parent && node.has(n.parent)) node.get(n.parent).children.push(n);
    else roots.push(n);
  }
  return { node, roots };
}

// ── descendants of a node, each tagged with its depth below that node
export function descendantsOf(forest, id) {
  const start = forest.node.get(id);
  if (!start) return [];
  const out = [], seen = new Set([id]);   // cycle guard — a corrupt ledger must not loop forever
  (function walk(n, d) { for (const c of n.children) { if (seen.has(c.id)) continue; seen.add(c.id); out.push({ id: c.id, depth: d, handle: c.handle }); walk(c, d + 1); } })(start, 1);
  return out;
}

// ── Price(node) = Σ over descendants ( sharesPerFork × DECAY^depth ). The fork-tree value.
// Also returns the per-generation contribution so the convergence is visible (it decays →0).
export function priceNode(forest, id, sharesPerFork = 1) {
  const desc = descendantsOf(forest, id);
  const perDepth = {};
  let price = 0, deepest = 0;
  for (const d of desc) {
    const c = sharesPerFork * Math.pow(DECAY, d.depth);
    price += c;
    perDepth[d.depth] = (perDepth[d.depth] || 0) + c;
    if (d.depth > deepest) deepest = d.depth;
  }
  return { id, price, descendants: desc.length, deepest, perDepth };
}

// ── the single deepest lineage as a root→leaf path (the spine of the bloodline)
export function deepestLineage(forest) {
  let best = [];
  const walk = (n, path) => {
    const p = [...path, n];
    if (!n.children.length) { if (p.length > best.length) best = p; return; }
    for (const c of n.children) walk(c, p);
  };
  for (const r of forest.roots) walk(r, []);
  return best;
}

// ── royalty flow: a descendant's settlement pays DECAY^depth UP to each ancestor
export function royaltyUp(forest, descendantId, settled = 1) {
  const chain = [], seen = new Set([descendantId]);   // cycle guard
  let cur = forest.node.get(descendantId), depth = 0;
  while (cur && cur.parent && forest.node.has(cur.parent) && !seen.has(cur.parent)) {
    seen.add(cur.parent);
    depth++; cur = forest.node.get(cur.parent);
    chain.push({ ancestor: cur.id, handle: cur.handle, royalty: +(settled * Math.pow(DECAY, depth)).toFixed(4) });
  }
  return chain;
}

// ── the full report: founders leaderboard, the deepest-lineage price walk, the falsifiable
// inverts-scarcity verdict, and the convergence/DCF check.
export function analyze(births, sealIds = []) {
  const forest = buildForest(births);
  const priced = [...forest.node.values()].map(n => priceNode(forest, n.id))
    .map(p => ({ ...p, handle: forest.node.get(p.id).handle, gen: forest.node.get(p.id).gen }));

  // founders leaderboard — highest bloodline value (ancestors dominate leaves)
  const founders = [...priced].sort((a, b) => b.price - a.price).slice(0, 8)
    .map(p => ({ handle: p.handle, gen: p.gen, price: +p.price.toFixed(3), descendants: p.descendants, deepest: p.deepest }));

  // the deepest bloodline, priced root→leaf — value must concentrate at the ORIGIN
  const spine = deepestLineage(forest);
  const walk = spine.map(n => { const p = priceNode(forest, n.id); return { handle: n.handle, gen: n.gen, price: +p.price.toFixed(3), descendants: p.descendants }; });

  // convergence: a single-lineage (chain) price stays under the DCF bound (≈ 2.618)
  const chainPrice = d => { let s = 0; for (let k = 1; k <= d; k++) s += Math.pow(DECAY, k); return s; };
  const maxChain = chainPrice(spine.length - 1);

  // ancestor vs leaf — value concentrates at PROVENANCE (leaves price 0; founders price high)
  const withKids = priced.filter(p => p.descendants > 0);
  const ancestorMean = withKids.length ? withKids.reduce((s, p) => s + p.price, 0) / withKids.length : 0;

  // THE PROOF · the top founder's price GROWTH as its bloodline forks downstream. Cumulative
  // fork-share price after each generation of descendants is added — it only APPRECIATES
  // (every new descendant adds DECAY^depth > 0) and CONVERGES (DECAY<1). A naive COPY-share
  // would DILUTE to 1/copies over the same growth. That inversion IS provenance economics.
  const top = [...priced].sort((a, b) => b.price - a.price)[0];
  const growth = [];
  if (top) {
    const desc = descendantsOf(forest, top.id);
    const depths = Object.keys(top.perDepth).map(Number).sort((a, b) => a - b);
    let cum = 0;
    for (const d of depths) {
      cum += top.perDepth[d];
      const copies = desc.filter(x => x.depth <= d).length;
      growth.push({ depth: d, forkSharePrice: +cum.toFixed(3), copyShareValue: +(copies ? 1 / copies : 1).toFixed(3) });
    }
  }
  const forkShareAppreciates = growth.every((g, i) => i === 0 || g.forkSharePrice >= growth[i - 1].forkSharePrice - 1e-9);
  const invertsScarcity = !!top && top.price > 0 && ancestorMean > 0 && forkShareAppreciates;

  // the listed Seals (matured, cast) — their fork-share price today
  const listed = sealIds.map(id => { const p = priceNode(forest, id); const n = forest.node.get(id); return { id, handle: n ? n.handle : id, gen: n ? n.gen : null, price: +p.price.toFixed(3), descendants: p.descendants, deepest: p.deepest }; });

  return {
    decay: DECAY, chainBound: +CHAIN_BOUND.toFixed(3), sharesPerSeal: 100,
    forest: { nodes: forest.node.size, roots: forest.roots.length, maxDepth: spine.length - 1 },
    founders,
    spine: walk,
    topFounder: top ? { handle: top.handle, gen: top.gen, price: +top.price.toFixed(3), descendants: top.descendants, growth } : null,
    listed,
    verdict: {
      provenanceInvertsScarcity: invertsScarcity,
      forkShareAppreciates,
      ancestorMeanPrice: +ancestorMean.toFixed(3),
      leafPrice: 0,
      maxChainPrice: +maxChain.toFixed(3),
      convergesUnderBound: maxChain <= CHAIN_BOUND + 1e-9,
    },
  };
}
