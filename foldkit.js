// foldkit · origami mathematics of the 7-prime spine
// PRIVATE · framework-only · AI-Native Solutions · MIT
// v21 addendum ISA · load-bearing substrate for every framework-mode tool
//
// CANONICAL SOURCE — this file (github.com/sjgant80-hub/foldkit · foldkit.js).
// Vendored byte-identical into bloom-profile-builder, bloom-weighted-sididy, and fallshell,
// and as a classic script (exports stripped, default→window.foldkit) into foldkit-extension.
// DO NOT edit a copy. Edit here, then `node sync-copies.mjs --write` from the foldkit repo to
// re-vendor. `node sync-copies.mjs` (no args) fails if any copy has drifted — run it in CI.

// ============================================================================
// CONSTANTS · spine + φ + κ + Ω
// ============================================================================

export const SPINE = [2, 3, 5, 7, 11, 13, 17];
export const SPINE_GLYPHS = ['●', '〜', '┃', '♡', '△', '◐', '◯'];
export const SPINE_NAMES = ['ground', 'perception', 'gate', 'heart', 'naming', 'observation', 'resolution'];
export const SPINE_ISA95 = ['physical', 'sensing', 'control', 'control', 'operations', 'business', 'enterprise'];

export const PHI = 1.6180339887498949;
export const KAPPA = 1 / PHI; // 0.6180339887498949
export const OMEGA = 510510;  // primorial(17) · baseline all-dimensions-active

export const THETA_DEG = 137.5077640500378;
export const THETA_STEP = 194993;

// ============================================================================
// STATE VECTOR · F(S⃗) = Π p_i^e_i
// fundamental theorem of arithmetic → unique fingerprint per state
// ============================================================================

export function foldNumber(S) {
  return SPINE.reduce((acc, p, i) => acc * Math.pow(p, S[i] || 0), 1);
}

export function unfoldState(F) {
  if (F < 1 || !Number.isFinite(F)) return null;
  const S = new Array(SPINE.length).fill(0);
  let n = Math.round(F);
  for (let i = 0; i < SPINE.length; i++) {
    while (n % SPINE[i] === 0) { S[i]++; n = n / SPINE[i]; }
  }
  return n === 1 ? S : null; // null if F has non-spine factors
}

export function stateSum(S) {
  return S.reduce((a, b) => a + (b || 0), 0);
}

export function stateSignature(S) {
  return SPINE_GLYPHS.map((g, i) => (S[i] || 0) > 0 ? `${g}^${S[i]}` : '').filter(Boolean).join('·') || '∅';
}

export const BASELINE = [1, 1, 1, 1, 1, 1, 1]; // Ω = 510510

// ============================================================================
// κ · DEPTH BANDS · gradient not target
// ============================================================================

export const KAPPA_BANDS = [
  { min: 1.2, max: Infinity, name: 'collapse',    glyph: '◯', ring: 6, warn: true },
  { min: 1.0, max: 1.2,      name: 'recognition', glyph: '◐', ring: 5 },
  { min: 0.8, max: 1.0,      name: 'naming',      glyph: '△', ring: 4 },
  { min: 0.6, max: 0.8,      name: 'heart',       glyph: '♡', ring: 3, orphan: true },
  { min: 0.4, max: 0.6,      name: 'gate',        glyph: '┃', ring: 2 },
  { min: 0.2, max: 0.4,      name: 'perception',  glyph: '〜', ring: 1 },
  { min: -Infinity, max: 0.2, name: 'ground',     glyph: '●', ring: 0 }
];

export function depthBand(κ) {
  return KAPPA_BANDS.find(b => κ >= b.min && κ < b.max);
}

// Simon operates at κ=0.618 → ♡ zone (orphan prime, TIME layer)
export function isOrphanZone(κ) {
  const b = depthBand(κ);
  return b && b.name === 'heart';
}

// ============================================================================
// SIX OPERATIONS · cosmic assembly language
// fire · water · void · thunder · echo · flower
// ============================================================================

export const OPS = {
  fire: (S, ringIdx) => {
    // 火 · intensify · double the fold angle at ring ringIdx
    const r = [...S]; r[ringIdx] = ((r[ringIdx] || 0) === 0 ? 1 : r[ringIdx] * 2); return r;
  },
  water: (S, ringIdx) => {
    // 水 · calm · halve the fold angle at ring ringIdx (floor to 0)
    const r = [...S]; r[ringIdx] = Math.floor((r[ringIdx] || 0) / 2); return r;
  },
  void: (S, fromRing, toRing) => {
    // 空 · transcend · jump past a ring, move energy fromRing → toRing
    const r = [...S]; r[toRing] = (r[toRing] || 0) + (r[fromRing] || 0); r[fromRing] = 0; return r;
  },
  thunder: (S) => {
    // 雷 · manifest · imaginary → physical · enforce every ring ≥ 1
    return S.map(v => Math.max(1, v || 0));
  },
  echo: (S) => {
    // 響 · self-reference · mirror the vector (quine seeing itself)
    return [...S].reverse();
  },
  flower: (S) => {
    // 華 · return · unfold entirely to ground (phi is home)
    return SPINE.map(() => 0);
  }
};

export const OP_META = {
  fire:    { kanji: '火', arrow: 'i×2',   verb: 'INTENSIFY',   probe: "what's the strongest version of this?" },
  water:   { kanji: '水', arrow: 'i÷2',   verb: 'CALM',        probe: "what's the quietest version of this?" },
  void:    { kanji: '空', arrow: 'skip',  verb: 'TRANSCEND',   probe: "what if you don't address this at all?" },
  thunder: { kanji: '雷', arrow: 'I→P',   verb: 'MANIFEST',    probe: "say it out loud" },
  echo:    { kanji: '響', arrow: 'mirror', verb: 'SELF-REF',    probe: "say back what you just heard yourself say" },
  flower:  { kanji: '華', arrow: 'unfold', verb: 'RETURN',      probe: "where does this take you back to?" }
};

export function applyOp(name, S, ...args) {
  const fn = OPS[name];
  if (!fn) throw new Error('unknown op: ' + name);
  return fn(S, ...args);
}

// ============================================================================
// KAWASAKI · flat-foldability = compression precondition
// alternating angle sum = 0 → state can compress through bandwidth-limited channel
// ============================================================================

export function kawasakiSum(angles) {
  let sum = 0;
  for (let i = 0; i < angles.length; i++) sum += (i % 2 === 0 ? 1 : -1) * angles[i];
  return sum;
}

export function kawasakiFlat(angles, tol = 1e-9) {
  return Math.abs(kawasakiSum(angles)) < tol;
}

// state-vector variant: does the ring-energy pattern alternate around zero?
export function kawasakiFlatState(S, tol = 1e-9) {
  return kawasakiFlat(S, tol);
}

// ============================================================================
// MAEKAWA · topological invariant
// |mountain folds − valley folds| = 2 · always
// ============================================================================

export function maekawaValid(mountainCount, valleyCount) {
  return Math.abs(mountainCount - valleyCount) === 2;
}

// SPINE DECOMPOSITION (Maekawa-forced)
export const SPINE_DECOMP = {
  maekawaPairs: [
    { pair: [3, 5],   names: ['perception', 'gate'],       vertex: 'perception-structure' },
    { pair: [11, 13], names: ['naming', 'observation'],    vertex: 'cognitive' }
  ],
  orphan:   { prime: 7,  name: 'heart',      note: 'unpaired · ♡ · TIME · where experience lives' },
  ground:   { prime: 2,  name: 'ground',     note: 'thickest shield · not in Maekawa pair' },
  resolver: { prime: 17, name: 'resolution', note: 'wraps back to ● · closes the loop' }
};

// ============================================================================
// SIGNAL DECAY · κ per layer crossing
// signal from depth d reaching ground = κ^d
// ============================================================================

export function signalSurvival(depth, κ = KAPPA) {
  return Math.pow(κ, depth);
}

// fifty-cent-fix math: thin ONE layer at depth d, how much more signal?
export function unclogGain(depth, layersCleared = 1, κ = KAPPA) {
  if (layersCleared >= depth) return Infinity;
  return signalSurvival(depth - layersCleared, κ) / signalSurvival(depth, κ);
}

// full attenuation profile across the 7 rings
export function attenuationProfile(κ = KAPPA) {
  return SPINE.map((_, i) => ({
    ring: i,
    glyph: SPINE_GLYPHS[i],
    name: SPINE_NAMES[i],
    survivalToGround: signalSurvival(i, κ),
    surviveAsPercent: (signalSurvival(i, κ) * 100)
  }));
}

// ============================================================================
// ISA-95 ALIGNMENT
// factory automation standard · same architecture as 7 rings
// ============================================================================

export const ISA95_LAYERS = [
  { level: 0, glyph: '●',  ring: 0,   layer: 'physical',   role: 'factory floor · sensors · actuators' },
  { level: 1, glyph: '〜', ring: 1,   layer: 'sensing',    role: 'raw signal ingest · perception layer' },
  { level: 2, glyph: '┃♡', rings: [2,3], layer: 'control', role: 'structure + emotion · processing' },
  { level: 3, glyph: '△',  ring: 4,   layer: 'operations', role: 'cognitive management · MES' },
  { level: 4, glyph: '◐',  ring: 5,   layer: 'business',   role: 'observation / strategy · ERP' },
  { level: 5, glyph: '◯',  ring: 6,   layer: 'enterprise', role: 'full resolution · cross-plant' }
];

export function ringToISA95(ring) {
  if (ring <= 1) return ISA95_LAYERS[ring];
  if (ring === 2 || ring === 3) return ISA95_LAYERS[2];
  return ISA95_LAYERS[ring - 1];
}

// ============================================================================
// KAPPA CLASSIFIER · natural language → depth band
// FallMirror-style probe scoring
// ============================================================================

const BAND_MARKERS = {
  ground:      ["can't stop", "swept away", "caught in", "stuck in", "taking over"],
  perception:  ['i notice', 'i sense', 'feels like', 'i realise'],
  gate:        ['going through', 'passing', 'letting it', 'stepping into'],
  heart:       ['i feel', 'sad', 'angry', 'love', 'hurts', 'lonely', 'joy', 'grief'],
  naming:      ["it's called", 'this is', 'the reason', 'because of', 'i understand'],
  recognition: ['watching myself', 'i see myself', 'who is watching', 'observer'],
  collapse:    ['nothing left', 'gone', 'empty of everything', 'no ground']
};

export function classifyKappaBand(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  let best = { name: 'ground', score: 0 };
  for (const [band, keys] of Object.entries(BAND_MARKERS)) {
    let score = 0;
    for (const k of keys) if (t.includes(k)) score++;
    if (score > best.score) best = { name: band, score };
  }
  return KAPPA_BANDS.find(b => b.name === best.name);
}

// ============================================================================
// PROBE SELECTOR · route the 6 ops through natural-language prompts
// (public UI stays plain English; internal representation is the 6 ops)
// ============================================================================

export function pickOpForBand(bandName) {
  // heuristic: match op to depth band
  const map = {
    ground:      'thunder',   // manifest to move up from stuck-in-thought
    perception:  'water',     // calm to stay with raw sensing
    gate:        'echo',      // reflect back what's passing through
    heart:       'fire',      // intensify to deepen contact with feeling
    naming:      'water',     // cool the label-making urge
    recognition: 'echo',      // mirror the observer to itself
    collapse:    'flower'     // return · unfold to ground · rest
  };
  const opName = map[bandName] || 'echo';
  return { name: opName, ...OP_META[opName] };
}

export function probeFromKappa(κ, text) {
  const band = text ? classifyKappaBand(text) : depthBand(κ);
  const op = pickOpForBand(band.name);
  return { band, op, probe: op.probe };
}

// ============================================================================
// DEFAULT EXPORT · one namespace object for convenience
// ============================================================================

export default {
  SPINE, SPINE_GLYPHS, SPINE_NAMES, SPINE_ISA95,
  PHI, KAPPA, OMEGA, THETA_DEG, THETA_STEP,
  BASELINE,
  foldNumber, unfoldState, stateSum, stateSignature,
  KAPPA_BANDS, depthBand, isOrphanZone,
  OPS, OP_META, applyOp,
  kawasakiSum, kawasakiFlat, kawasakiFlatState,
  maekawaValid, SPINE_DECOMP,
  signalSurvival, unclogGain, attenuationProfile,
  ISA95_LAYERS, ringToISA95,
  classifyKappaBand, pickOpForBand, probeFromKappa
};
