// FallKard Arena · policy/webllm.mjs
// A REAL in-browser brain. Loads a small instruct model via WebLLM (WebGPU) and
// makes the play decision by reasoning over the board — same decide() contract
// as the heuristic engine, so a Seal swaps its mind by changing one field.
//
// Browser-only (needs WebGPU). The module is import-safe in Node: the web-llm
// CDN module is only fetched lazily when the brain is actually loaded, so the
// headless GA never touches it.

import { heuristic, readPosition, AXES } from './heuristic.mjs';

// Small, fast, good-enough to reason about a card board. Swappable.
export const DEFAULT_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
let _model = DEFAULT_MODEL;
let _engine = null;
let _loading = null;

export function setModel(m) { _model = m; _engine = null; _loading = null; }
export function currentModel() { return _model; }
export function webgpuOK() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

async function load(onProgress) {
  if (_engine) return _engine;
  if (!webgpuOK()) throw new Error('WebGPU unavailable — this browser cannot run a local brain. Use BYOK or the heuristic mind.');
  if (!_loading) {
    _loading = (async () => {
      const webllm = await import('https://esm.run/@mlc-ai/web-llm');
      _engine = await webllm.CreateMLCEngine(_model, { initProgressCallback: onProgress || (() => {}) });
      return _engine;
    })().catch(e => { _loading = null; throw e; });
  }
  return _loading;
}

const SYS =
`You are the mind of a FallKard "Seal" — a bred organism playing a lane card game.
Each turn you pick ONE card from your hand to play, or pass. Cards have atk (attack),
hp (health), cost (mana), chamber (theme) and keywords. You want to reduce the enemy hero
to 0 hp while protecting your own. Front lanes (slots 3,4,5) attack; back lanes (0,1,2) hold.
Reply with ONLY a JSON object, no prose:
{"cardId": "<id from hand or null>", "slot": <0-5 empty slot or null>,
 "scores": {"tempo":0-1,"board":0-1,"aggression":0-1,"defense":0-1,"value":0-1,"patience":0-1,"reach":0-1},
 "why": "<= 10 words"}
Pick a card you can afford (cost <= mana) and an empty slot. If nothing is worth playing, cardId=null.`;

function buildPrompt(state, agent) {
  const affordable = state.hand.filter(c => c.currentCost <= state.mana);
  const hand = affordable.slice(0, 10).map(c =>
    `{id:"${c.id}", name:"${(c.name || c.id).slice(0, 22)}", atk:${c.currentAtk}, hp:${c.currentHp}, cost:${c.currentCost}, chamber:"${c.chamber}", kw:[${(c.keywords || []).join(',')}]}`
  ).join('\n');
  const emptySlots = state.lanes.filter(i => !state.board[i]);
  const myBoard = state.board.map((m, i) => m ? `${i}:${m.currentAtk}/${m.currentHp}` : `${i}:empty`).join(' ');
  const oppBoard = (state.oppBoard || []).map((m, i) => m ? `${i}:${m.currentAtk}/${m.currentHp}` : `${i}:empty`).join(' ');
  return [
    `Turn ${state.turn}. My hero hp ${state.myHp}, enemy hero hp ${state.oppHp}. Mana ${state.mana}/${state.manaMax}.`,
    `My board: ${myBoard}`,
    `Enemy board: ${oppBoard}`,
    `Empty slots I can use (prefer front 3,4,5): ${emptySlots.join(',') || 'none'}`,
    `Playable hand:\n${hand || '(nothing affordable)'}`,
    `Play the strongest single card, or pass. JSON only.`,
  ].join('\n');
}

function parseDecision(raw, state, agent) {
  const scores = readPosition(state, agent.policy || {}); // fallback read
  let obj = null;
  try { obj = JSON.parse(raw); }
  catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { obj = JSON.parse(m[0]); } catch {} } }
  if (!obj) return { move: heuristic.decide(state, agent).move, scores, why: 'unparseable→heuristic' };
  // merge the model's self-scores if well-formed
  if (obj.scores && typeof obj.scores === 'object') {
    for (const a of AXES) if (typeof obj.scores[a] === 'number') scores[a] = Math.max(0, Math.min(1, obj.scores[a]));
  }
  // validate the move against the real rules; fall back to heuristic pick if illegal
  const cardId = obj.cardId;
  if (!cardId || cardId === 'null') return { move: null, scores, why: (obj.why || 'pass').slice(0, 40) };
  const card = state.hand.find(c => c.id === cardId && c.currentCost <= state.mana);
  let slot = Number.isInteger(obj.slot) ? obj.slot : NaN;
  if (!card || !(slot >= 0 && slot <= 5) || state.board[slot]) {
    const h = heuristic.decide(state, agent).move;
    return { move: h, scores, why: (card ? 'bad-slot' : 'illegal-card') + '→heuristic' };
  }
  return { move: { cardId, slot }, scores, why: (obj.why || '').slice(0, 40) };
}

export const webllm = {
  name: 'webllm',
  local: true,
  available: webgpuOK,
  currentModel,
  async ready(onProgress) { await load(onProgress); return true; },
  async decide(state, agent) {
    let eng;
    try { eng = await load(); }
    catch (e) { return { ...heuristic.decide(state, agent), fallback: 'heuristic', why: e.message.slice(0, 60) }; }
    let raw = '{}';
    try {
      const resp = await eng.chat.completions.create({
        messages: [{ role: 'system', content: SYS }, { role: 'user', content: buildPrompt(state, agent) }],
        response_format: { type: 'json_object' },
        temperature: 0.6, max_tokens: 200,
      });
      raw = resp.choices?.[0]?.message?.content || '{}';
    } catch (e) {
      return { ...heuristic.decide(state, agent), fallback: 'heuristic', why: ('infer-error: ' + e.message).slice(0, 60) };
    }
    return parseDecision(raw, state, agent);
  },
};
