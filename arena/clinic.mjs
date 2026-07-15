// FallKard Arena · clinic.mjs
// VERIFY — the organism reads the body it built. (Node + browser compatible.)
//
// The Clinic is the dual of the Forge: what BUILD composes, VERIFY inverts and reads
// back. It takes a match trace (engine.mjs, record:true) and projects it onto SEVEN
// TELLS — each grounded in the reducer's OWN observable transitions, never an imported
// pathology label. High tell = the gate that fails first. Accumulated over a lifetime
// (the Memory journal) the strongest tell is the organism's SHADOW.
//
// Then REMEDIATION turns a diagnosis into a gradient: each tell maps to a concrete
// policy-weight nudge, so the Swarm (EXPLORE) can fork TOWARD the fix instead of blindly.
// Wire it into selection as  fitness = winRate − λ·shadow  and the loop is falsifiable:
// the shadow must shrink generation over generation, or the therapy is disproven.

export const TELLS = ['hoard', 'blindspot', 'loop', 'freeze', 'tunnel', 'echo', 'miss'];

export const TELL_MEANING = {
  hoard:     'left mana unspent — sat on resources it could have deployed',
  blindspot: 'held chambers it never played — dead weight in the body',
  loop:      'replayed the same card back-to-back — stuck in a groove',
  freeze:    'could act but passed the turn — hesitation',
  tunnel:    'collapsed into a single chamber — no breadth',
  echo:      'mirrored the opponent instead of running its own plan',
  miss:      'had lethal on board and did not take it — failed to close',
};

const clamp01 = x => Math.max(0, Math.min(1, x));
const sum = o => Object.values(o).reduce((s, n) => s + n, 0);

// cosine similarity of two chamber histograms (for the echo tell)
function cosine(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) { const x = a[k] || 0, y = b[k] || 0; dot += x * y; na += x * x; nb += y * y; }
  return (na && nb) ? dot / Math.sqrt(na * nb) : 0;
}

// Herfindahl concentration of a histogram (0 = perfectly spread, 1 = all one bucket)
function herfindahl(hist) {
  const tot = sum(hist);
  if (!tot) return 0;
  let h = 0; for (const v of Object.values(hist)) { const p = v / tot; h += p * p; }
  return h;
}

// ── scoreShape: one match trace → the 7-tell vector (0..1 each, higher = weaker).
//   t         = this player's trace  (from engine.resolveMatch record:true)
//   oppT      = the opponent's trace (for the echo tell)
//   heldChambers = Set of chambers present in this organism's deck (for blindspot/tunnel)
export function scoreShape(t, oppT, heldChambers) {
  if (!t || !t.turns) return Object.fromEntries(TELLS.map(k => [k, 0]));
  const playedChambers = Object.keys(t.chamberCounts);
  const held = heldChambers && heldChambers.size ? heldChambers : new Set(playedChambers);
  const neverPlayed = [...held].filter(c => !t.chamberCounts[c]).length;

  return {
    hoard:     clamp01(t.manaAvail ? 1 - t.manaSpent / t.manaAvail : 0),
    blindspot: clamp01(held.size ? neverPlayed / held.size : 0),
    loop:      clamp01(t.plays ? t.repeatPlays / t.plays : 0),
    freeze:    clamp01(t.turns ? t.passTurns / t.turns : 0),
    tunnel:    clamp01(t.plays ? (herfindahl(t.chamberCounts) - 1 / Math.max(1, held.size)) / (1 - 1 / Math.max(2, held.size)) : 0),
    // echo = EXCESS mirroring beyond the normal draft overlap (baseline ~0.7), so a
    // both-market meta doesn't read as pathology — only unusually reactive play flags.
    echo:      clamp01(oppT ? Math.max(0, cosine(t.chamberCounts, oppT.chamberCounts) - 0.7) / 0.3 : 0),
    miss:      clamp01(t.turns ? t.lethalMissed / t.turns : 0),
  };
}

// ── the running clinical record (Memory / REMEMBER). Accumulate shape vectors across a
// lifetime; the shadow is the tell with the highest mean amplitude.
export function newJournal() {
  return { matches: 0, sums: Object.fromEntries(TELLS.map(k => [k, 0])) };
}
export function record(journal, shape) {
  journal.matches++;
  for (const k of TELLS) journal.sums[k] += (shape[k] || 0);
  return journal;
}
export function readShadow(journal) {
  const n = Math.max(1, journal.matches);
  const means = Object.fromEntries(TELLS.map(k => [k, journal.sums[k] / n]));
  let axis = TELLS[0];
  for (const k of TELLS) if (means[k] > means[axis]) axis = k;
  return { axis, amplitude: means[axis], means };   // amplitude drives fitness = winRate − λ·amplitude
}

// ── REMEDIATION — the axis → gene-delta homomorphism. Each tell names the policy weight
// to nudge and the direction that reduces it. This is what makes the therapy a GRADIENT
// and not just a read-out. `neglected` = a chamber the organism holds but never plays
// (supplied by the caller for the blindspot fix).
export const REMEDIATION = {
  hoard:     { param: 'curve',    sign: +1, delta: 0.14 },   // spend mana — reward tempo/curve
  blindspot: { param: 'chamberBias', sign: +1, delta: 0.18 }, // bias toward the neglected chamber
  loop:      { param: 'curve',    sign: +1, delta: 0.10 },   // spread the curve, break the groove
  freeze:    { param: 'aggro',    sign: +1, delta: 0.14 },   // commit — willingness to act
  tunnel:    { param: 'chamberBias', sign: -1, delta: 0.16 }, // flatten the dominant chamber
  echo:      { param: 'chamberBias', sign: -1, delta: 0.14 }, // diversify off the crowded chamber
  miss:      { param: 'aggro',    sign: +1, delta: 0.16 },   // go face when lethal is on the board
};

// apply a remediation to a weights object, in place, scaled by `mag` (0..1 = how loud the
// shadow is). Bounded so a nudged weight stays in a sane range. Pure (no rng) so the
// deterministic tournament stream is untouched. `ctx` carries the neglected/dominant
// chamber for the chamberBias fixes.
export function applyRemediation(weights, axis, mag = 1, ctx = {}) {
  const r = REMEDIATION[axis];
  if (!r) return weights;
  const step = r.sign * r.delta * clamp01(mag);
  if (r.param === 'chamberBias') {
    weights.chamberBias = weights.chamberBias || {};
    const ch = axis === 'blindspot' ? ctx.neglected : ctx.dominant;
    if (ch) weights.chamberBias[ch] = Math.max(-1, Math.min(1, (weights.chamberBias[ch] || 0) + step));
  } else {
    const cur = typeof weights[r.param] === 'number' ? weights[r.param] : 0.5;
    weights[r.param] = Math.max(0, Math.min(2, cur + step));
  }
  return weights;
}

// the neglected chamber (held, never played) and dominant chamber (played most) — the
// context the chamberBias remediations need. Derived from a shape's source trace + deck.
export function chamberContext(trace, heldChambers) {
  const played = trace?.chamberCounts || {};
  let dominant = null, max = -1;
  for (const [c, n] of Object.entries(played)) if (n > max) { max = n; dominant = c; }
  let neglected = null;
  for (const c of (heldChambers || [])) if (!played[c]) { neglected = c; break; }
  return { dominant, neglected };
}
