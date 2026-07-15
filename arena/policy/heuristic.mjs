// FallKard Arena · policy/heuristic.mjs
// The default mind: a fast, deterministic dot-product over the policy weights.
// This is the engine the headless GA breeds on — same seed → same decision, so
// the whole tournament stays reproducible. The other engines (webllm, byok)
// implement the SAME decide() contract, so a Seal can swap its brain without
// touching a single caller.
//
// The contract:  decide(state, agent) → { move, scores }
//   state  = { hand:[card], mana, manaMax, board:[6], oppBoard:[6], myHp, oppHp, turn, lanes:[6] }
//   move   = { cardId, slot } | null   (null = pass / stop playing)
//   scores = 7-vector (0..1), the mind's read of the position — for the clinic + UI.

export const AXES = ['tempo', 'board', 'aggression', 'defense', 'value', 'patience', 'reach'];

// ── the raw scorer. VERBATIM from the original engine so the deterministic
// Node reducer that imports it is byte-identical to before the policy port.
export function scoreCardForPlay(card, policy, mana) {
  const w = policy.weights || {};
  let s = 0;
  s += (w.aggro ?? 0.5) * card.currentAtk;
  s += (w.hpBias ?? 0.5) * card.currentHp;
  // curve: prefer cards that use most of current mana (tempo) if curve high
  s += (w.curve ?? 0.3) * (10 - Math.abs(mana - card.currentCost));
  s += ((w.chamberBias && w.chamberBias[card.chamber]) || 0) * 3;
  s += ((w.kindBias && w.kindBias[card.kind]) || 0) * 3;
  const kw = card.keywords || [];
  if (kw.includes('Sealed')) s += (w.valSealed ?? 1);
  if (kw.includes('Fork')) s += (w.valFork ?? 1);
  if (kw.includes('Marketplace')) s += (w.valMarket ?? 0.8);
  return s;
}

// the mind's read of the position: a clean 7-vector the clinic (VERIFY) and the
// UI both consume. Heuristic derives it from observable state; the LLM engines
// emit their own. All values clamped to 0..1.
export function readPosition(state, policy) {
  const w = policy.weights || {};
  const clamp = x => Math.max(0, Math.min(1, x));
  const mine = state.board.filter(Boolean);
  const theirs = (state.oppBoard || []).filter(Boolean);
  const handKw = state.hand.filter(c => (c.keywords || []).length).length;
  const boardAtk = mine.reduce((s, m) => s + (m.currentAtk || 0), 0);
  return {
    tempo:      clamp(state.manaMax ? 1 - state.mana / state.manaMax : 0),      // mana actually spent
    board:      clamp((mine.length) / (mine.length + theirs.length + 1)),        // presence share
    aggression: clamp((w.aggro ?? 0.5) / 2),                                     // stance
    defense:    clamp((w.hpBias ?? 0.5) / 2),                                    // stance
    value:      clamp(state.hand.length ? handKw / state.hand.length : 0),       // keyword density in hand
    patience:   clamp(state.hand.length / 10),                                   // cards held
    reach:      clamp(boardAtk / 10),                                            // ability to close
  };
}

export const heuristic = {
  name: 'heuristic',
  local: true,
  available() { return true; },
  async ready() { return true; },
  decide(state, agent) {
    const pol = agent.policy || {};
    const affordable = state.hand.filter(c => c.currentCost <= state.mana);
    const scores = readPosition(state, pol);
    if (!affordable.length) return { move: null, scores };
    affordable.sort((a, b) => scoreCardForPlay(b, pol, state.mana) - scoreCardForPlay(a, pol, state.mana));
    const best = affordable[0];
    const slot = state.lanes.find(i => !state.board[i]);
    return { move: slot === undefined ? null : { cardId: best.id, slot }, scores };
  },
};
