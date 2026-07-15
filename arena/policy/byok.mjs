// FallKard Arena · policy/byok.mjs
// Bring-Your-Own-Key brain: the same decide() contract, but inference runs on a
// remote OpenAI-compatible chat endpoint (OpenAI / Together / Groq / a local
// llama.cpp server / an Anthropic-compatible proxy). The key stays in the user's
// browser (localStorage) — never hardcoded, never sent anywhere but their endpoint.

import { heuristic, readPosition, AXES } from './heuristic.mjs';

let _cfg = { endpoint: '', apiKey: '', model: 'gpt-4o-mini' };

export function configure(cfg = {}) { _cfg = { ..._cfg, ...cfg }; }
export function config() { return { ..._cfg, apiKey: _cfg.apiKey ? '••••' : '' }; }

const SYS =
`You are the mind of a FallKard "Seal" playing a lane card game. Each turn pick ONE affordable
card (cost <= mana) from hand for an empty slot, or pass. Front lanes 3,4,5 attack; back 0,1,2 hold.
Reply with ONLY JSON: {"cardId":"<id or null>","slot":<0-5 or null>,"scores":{"tempo":0-1,"board":0-1,"aggression":0-1,"defense":0-1,"value":0-1,"patience":0-1,"reach":0-1},"why":"<=10 words"}`;

function buildPrompt(state) {
  const affordable = state.hand.filter(c => c.currentCost <= state.mana).slice(0, 10);
  const hand = affordable.map(c => `{id:"${c.id}",name:"${(c.name || c.id).slice(0, 22)}",atk:${c.currentAtk},hp:${c.currentHp},cost:${c.currentCost},chamber:"${c.chamber}",kw:[${(c.keywords || []).join(',')}]}`).join('\n');
  const empty = state.lanes.filter(i => !state.board[i]);
  const mine = state.board.map((m, i) => m ? `${i}:${m.currentAtk}/${m.currentHp}` : `${i}:_`).join(' ');
  const opp = (state.oppBoard || []).map((m, i) => m ? `${i}:${m.currentAtk}/${m.currentHp}` : `${i}:_`).join(' ');
  return `Turn ${state.turn}. myHp ${state.myHp} enemyHp ${state.oppHp} mana ${state.mana}/${state.manaMax}\nmyBoard ${mine}\nenemyBoard ${opp}\nemptySlots(prefer 3,4,5) ${empty.join(',') || 'none'}\nhand:\n${hand || '(none)'}\nJSON only.`;
}

function parseDecision(raw, state, agent) {
  const scores = readPosition(state, agent.policy || {});
  let obj = null;
  try { obj = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { obj = JSON.parse(m[0]); } catch {} } }
  if (!obj) return { move: heuristic.decide(state, agent).move, scores, why: 'unparseable→heuristic' };
  if (obj.scores) for (const a of AXES) if (typeof obj.scores[a] === 'number') scores[a] = Math.max(0, Math.min(1, obj.scores[a]));
  const cardId = obj.cardId;
  if (!cardId || cardId === 'null') return { move: null, scores, why: (obj.why || 'pass').slice(0, 40) };
  const card = state.hand.find(c => c.id === cardId && c.currentCost <= state.mana);
  const slot = Number.isInteger(obj.slot) ? obj.slot : NaN;
  if (!card || !(slot >= 0 && slot <= 5) || state.board[slot]) {
    return { move: heuristic.decide(state, agent).move, scores, why: (card ? 'bad-slot' : 'illegal') + '→heuristic' };
  }
  return { move: { cardId, slot }, scores, why: (obj.why || '').slice(0, 40) };
}

export const byok = {
  name: 'byok',
  local: false,
  available() { return !!_cfg.endpoint; },
  configure,
  async ready() { return !!_cfg.endpoint; },
  async decide(state, agent) {
    if (!_cfg.endpoint) return { ...heuristic.decide(state, agent), fallback: 'heuristic', why: 'no endpoint configured' };
    let raw = '{}';
    try {
      const r = await fetch(_cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(_cfg.apiKey ? { Authorization: 'Bearer ' + _cfg.apiKey } : {}) },
        body: JSON.stringify({
          model: _cfg.model,
          messages: [{ role: 'system', content: SYS }, { role: 'user', content: buildPrompt(state) }],
          temperature: 0.6, max_tokens: 220,
          response_format: { type: 'json_object' },
        }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      raw = j.choices?.[0]?.message?.content || (typeof j.content === 'string' ? j.content : '{}');
    } catch (e) {
      return { ...heuristic.decide(state, agent), fallback: 'heuristic', why: ('byok: ' + e.message).slice(0, 60) };
    }
    return parseDecision(raw, state, agent);
  },
};
