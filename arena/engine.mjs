// FallKard Arena · engine.mjs
// Policy-aware deterministic battle reducer · Node + browser compatible.
// Faithful to the Coliseum reducer (coliseum.html resolveMatch) but the play/attack
// decisions are driven by each agent's POLICY — a swappable MIND (policy/*.mjs).
// The default heuristic mind is a pure dot-product, so: same seed + same two agents
// → same verdict. Deterministic. Reproducible. A Seal can instead run a real WebLLM
// or BYOK brain via resolveMatchLive() without touching this reducer's guarantee.

import { scoreCardForPlay } from './policy/heuristic.mjs';

export function seededRng(seedStr) {
  let a = 0;
  for (let i = 0; i < seedStr.length; i++) a = ((a * 31) + seedStr.charCodeAt(i)) >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export { scoreCardForPlay };

export function resolveMatch({ agentA, agentB, seed, cardsByID, record = false, rules = {} }) {
  const rng = seededRng(seed);
  // BYLAWS — forkable rule params (A7). Defaults are the CANONICAL ruleset, so a caller that
  // passes no rules gets byte-identical behaviour (the GA is unaffected). The KERNEL (the win
  // condition, the 6-lane board, the ∇·B pairing) is NOT here — it cannot be forked.
  const startHand = rules.startHand ?? 3, manaCap = rules.manaCap ?? 10, maxTurns = rules.maxTurns ?? 30;
  // OPT-IN instrumentation. `record` NEVER touches the rng stream, the play order,
  // or the verdict — so with record:false the reducer is byte-identical to before,
  // and the headless GA stays fully deterministic. The trace exists only so the
  // Clinic (VERIFY) can read the organism's OWN transitions (unspent mana, unopened
  // chambers, repeat plays, passed turns, single-chamber tunnels, missed lethal) —
  // real observable behaviour, never imported pathology labels.
  const mkTrace = () => ({ turns:0, manaAvail:0, manaSpent:0, plays:0, repeatPlays:0, passTurns:0, lethalMissed:0, chamberCounts:{}, kindCounts:{}, lastPlayId:null, playScores:[] });
  const rndShuffle = arr => { for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(rng()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; } return arr; };
  const mkPlayer = (agent) => {
    const deck = [];
    Object.entries(agent.genome.cards).forEach(([id, n]) => {
      const card = cardsByID[id];
      if (!card) return;
      for (let i = 0; i < n; i++) deck.push({ ...card, currentAtk: card.atk, currentHp: card.hp, currentCost: card.cost });
    });
    rndShuffle(deck);
    return { name: agent.handle, policy: agent.policy, hp: 20, hpMax: 20, mana: 0, manaMax: 0, hand: [], deck, board: [null,null,null,null,null,null], trace: record ? mkTrace() : null };
  };
  const A = mkPlayer(agentA);
  const B = mkPlayer(agentB);
  const draw = p => { if (!p.deck.length) { p.hp = Math.max(0, p.hp - 1); return; } if (p.hand.length < 10) p.hand.push(p.deck.shift()); };
  for (let i = 0; i < startHand; i++) { draw(A); draw(B); }

  let turn = 1, active = 'A';
  const MAX_TURNS = maxTurns;

  const doTurn = (p, opp) => {
    p.manaMax = Math.min(manaCap, p.manaMax + 1);
    p.mana = p.manaMax;
    draw(p);
    // start-of-turn: minions become able to attack
    p.board.forEach(m => { if (m) m.canAttack = true; });
    // PLAY phase — policy-driven card selection + lane preference
    const pol = p.policy || {};
    const frontFirst = (pol.weights?.lanePref ?? 0.6) >= 0.5;
    const t = p.trace;
    if (t) { t.turns++; t.manaAvail += p.manaMax; }
    let couldStart = false, playsThisTurn = 0;
    if (t) couldStart = p.hand.some(c => c.currentCost <= p.mana) && [0,1,2,3,4,5].some(i => !p.board[i]);
    let guard = 20;
    while (guard-- > 0) {
      const affordable = p.hand.filter(c => c.currentCost <= p.mana);
      if (!affordable.length) break;
      const lanes = frontFirst ? [3,4,5,0,1,2] : [0,1,2,3,4,5];
      const slot = lanes.find(i => !p.board[i]);
      if (slot === undefined) break;
      // score by policy, pick best
      affordable.sort((a,b) => scoreCardForPlay(b, pol, p.mana) - scoreCardForPlay(a, pol, p.mana));
      const card = affordable[0];
      const playScore = t ? scoreCardForPlay(card, pol, p.mana) : 0;   // mind's score, pre-spend
      p.hand.splice(p.hand.indexOf(card), 1);
      p.mana -= card.currentCost;
      p.board[slot] = { ...card, canAttack: false, sealedUsed: false };
      if (t) {
        t.plays++; playsThisTurn++;
        t.playScores.push(playScore);
        t.chamberCounts[card.chamber] = (t.chamberCounts[card.chamber]||0) + 1;
        if (card.kind) t.kindCounts[card.kind] = (t.kindCounts[card.kind]||0) + 1;
        if (t.lastPlayId === card.id) t.repeatPlays++;
        t.lastPlayId = card.id;
      }
      // Marketplace keyword: every 3rd play draws
      p._played = (p._played || 0) + 1;
      if ((card.keywords||[]).includes('Marketplace') && p._played % 3 === 0) draw(p);
    }
    if (t) {
      t.manaSpent += (p.manaMax - p.mana);              // unspent-mana ratio = Hoard tell
      if (couldStart && playsThisTurn === 0) t.passTurns++; // could act, didn't = Freeze tell
    }
    // ATTACK phase — front row strikes. Policy decides face-vs-trade via aggro.
    const aggro = pol.weights?.aggro ?? 0.5;
    let frontAtk = 0, oppHpStart = opp.hp;
    if (t) for (const i of [3,4,5]) { const m = p.board[i]; if (m && m.canAttack) frontAtk += m.currentAtk; }
    for (const i of [3,4,5]) {
      const attacker = p.board[i];
      if (!attacker || !attacker.canAttack) continue;
      const oppSlot = 8 - i;
      const target = opp.board[oppSlot];
      const enemyHasFront = [3,4,5].some(j => opp.board[j]);
      // aggressive policies prefer face when possible; defensive prefer trades
      const goFace = !target && (aggro > 0.4 || !enemyHasFront);
      if (target && !(aggro > 0.75 && !target)) {
        // trade
        const absorbT = (target.keywords||[]).includes('Sealed') && !target.sealedUsed;
        if (absorbT) target.sealedUsed = true; else target.currentHp -= attacker.currentAtk;
        const absorbA = (attacker.keywords||[]).includes('Sealed') && !attacker.sealedUsed;
        if (absorbA) attacker.sealedUsed = true; else attacker.currentHp -= target.currentAtk;
        if (target.currentHp <= 0) {
          opp.board[oppSlot] = null;
          if ((target.keywords||[]).includes('Fork')) opp.board[oppSlot] = { ...target, currentAtk:1, currentHp:1, canAttack:false, sealedUsed:false };
        }
        if (attacker.currentHp <= 0) {
          p.board[i] = null;
          if ((attacker.keywords||[]).includes('Fork')) p.board[i] = { ...attacker, currentAtk:1, currentHp:1, canAttack:false, sealedUsed:false };
        }
      } else {
        opp.hp = Math.max(0, opp.hp - attacker.currentAtk);
        if (opp.hp <= 0) return;
      }
      attacker.canAttack = false;
    }
    // had lethal on the board this turn but the enemy hero survived = Miss tell
    if (t && oppHpStart > 0 && opp.hp > 0 && frontAtk >= oppHpStart) t.lethalMissed++;
  };

  while (turn <= MAX_TURNS && A.hp > 0 && B.hp > 0) {
    if (active === 'A') { doTurn(A, B); if (B.hp <= 0) break; active = 'B'; }
    else                { doTurn(B, A); if (A.hp <= 0) break; active = 'A'; turn++; }
  }
  let verdict;
  if (A.hp <= 0 && B.hp <= 0) verdict = 'draw';
  else if (A.hp <= 0) verdict = 'B';
  else if (B.hp <= 0) verdict = 'A';
  else verdict = A.hp > B.hp ? 'A' : (B.hp > A.hp ? 'B' : 'draw');
  const out = { verdict, aHp: A.hp, bHp: B.hp, turns: turn };
  if (record) out.trace = { A: A.trace, B: B.trace };   // VERIFY reads this
  return out;
}

// ── resolveMatchLive: the SAME rules, but the play phase is driven by an async
// MIND — decideA / decideB : (state) => Promise<{ move:{cardId,slot}|null, scores }>.
// This is how a real WebLLM/BYOK brain plays a full game in the browser. It is NOT
// used by the headless GA (which stays sync + deterministic via resolveMatch); it
// exists so a Seal can actually think. onEvent(evt) streams turns for a spectator.
export async function resolveMatchLive({ agentA, agentB, seed, cardsByID, decideA, decideB, onEvent, maxTurns = 30 }) {
  const rng = seededRng(seed || (agentA.agentId + '|' + agentB.agentId + '|live'));
  const shuffle = arr => { for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };
  const mkPlayer = (agent) => {
    const deck = [];
    Object.entries(agent.genome.cards).forEach(([id, n]) => {
      const card = cardsByID[id]; if (!card) return;
      for (let i = 0; i < n; i++) deck.push({ ...card, currentAtk: card.atk, currentHp: card.hp, currentCost: card.cost });
    });
    shuffle(deck);
    return { agent, name: agent.handle, policy: agent.policy, hp: 20, hpMax: 20, mana: 0, manaMax: 0, hand: [], deck, board: [null,null,null,null,null,null] };
  };
  const A = mkPlayer(agentA), B = mkPlayer(agentB);
  const draw = p => { if (!p.deck.length) { p.hp = Math.max(0, p.hp - 1); return; } if (p.hand.length < 10) p.hand.push(p.deck.shift()); };
  for (let i = 0; i < 3; i++) { draw(A); draw(B); }

  const doTurn = async (p, opp, decide, who) => {
    p.manaMax = Math.min(10, p.manaMax + 1); p.mana = p.manaMax; draw(p);
    p.board.forEach(m => { if (m) m.canAttack = true; });
    const frontFirst = (p.policy?.weights?.lanePref ?? 0.6) >= 0.5;
    const lanes = frontFirst ? [3,4,5,0,1,2] : [0,1,2,3,4,5];
    let guard = 12, lastScores = null;
    while (guard-- > 0) {
      const state = { hand: p.hand, mana: p.mana, manaMax: p.manaMax, board: p.board, oppBoard: opp.board, myHp: p.hp, oppHp: opp.hp, turn: p.manaMax, lanes };
      let out; try { out = await decide(state); } catch { out = null; }
      lastScores = out?.scores || lastScores;
      const mv = out?.move;
      if (!mv || !mv.cardId) break;
      const ci = p.hand.findIndex(c => c.id === mv.cardId && c.currentCost <= p.mana);
      if (ci < 0) break;
      const slot = (mv.slot >= 0 && mv.slot <= 5 && !p.board[mv.slot]) ? mv.slot : lanes.find(i => !p.board[i]);
      if (slot === undefined) break;
      const card = p.hand.splice(ci, 1)[0];
      p.mana -= card.currentCost;
      p.board[slot] = { ...card, canAttack: false, sealedUsed: false };
      p._played = (p._played || 0) + 1;
      if ((card.keywords||[]).includes('Marketplace') && p._played % 3 === 0) draw(p);
      onEvent && onEvent({ type: 'play', who, card: card.name || card.id, slot, why: out?.why, scores: out?.scores, fallback: out?.fallback });
    }
    // attack — same face-vs-trade rules as resolveMatch, aggro from policy
    const aggro = p.policy?.weights?.aggro ?? 0.5;
    for (const i of [3,4,5]) {
      const attacker = p.board[i]; if (!attacker || !attacker.canAttack) continue;
      const oppSlot = 8 - i; const target = opp.board[oppSlot];
      const enemyHasFront = [3,4,5].some(j => opp.board[j]);
      const goFace = !target && (aggro > 0.4 || !enemyHasFront);
      if (target && !(aggro > 0.75 && !target)) {
        const absorbT = (target.keywords||[]).includes('Sealed') && !target.sealedUsed;
        if (absorbT) target.sealedUsed = true; else target.currentHp -= attacker.currentAtk;
        const absorbA = (attacker.keywords||[]).includes('Sealed') && !attacker.sealedUsed;
        if (absorbA) attacker.sealedUsed = true; else attacker.currentHp -= target.currentAtk;
        if (target.currentHp <= 0) { opp.board[oppSlot] = null; if ((target.keywords||[]).includes('Fork')) opp.board[oppSlot] = { ...target, currentAtk:1, currentHp:1, canAttack:false, sealedUsed:false }; }
        if (attacker.currentHp <= 0) { p.board[i] = null; if ((attacker.keywords||[]).includes('Fork')) p.board[i] = { ...attacker, currentAtk:1, currentHp:1, canAttack:false, sealedUsed:false }; }
      } else {
        opp.hp = Math.max(0, opp.hp - attacker.currentAtk);
        onEvent && onEvent({ type: 'face', who, dmg: attacker.currentAtk, oppHp: opp.hp });
        if (opp.hp <= 0) return true;
      }
      if (p.board[i]) p.board[i].canAttack = false;
    }
    onEvent && onEvent({ type: 'endturn', who, myHp: p.hp, oppHp: opp.hp, scores: lastScores });
    return false;
  };

  let turn = 1, active = 'A';
  while (turn <= maxTurns && A.hp > 0 && B.hp > 0) {
    if (active === 'A') { if (await doTurn(A, B, decideA, 'A')) break; if (B.hp <= 0) break; active = 'B'; }
    else                { if (await doTurn(B, A, decideB, 'B')) break; if (A.hp <= 0) break; active = 'A'; turn++; }
  }
  let verdict;
  if (A.hp <= 0 && B.hp <= 0) verdict = 'draw';
  else if (A.hp <= 0) verdict = 'B';
  else if (B.hp <= 0) verdict = 'A';
  else verdict = A.hp > B.hp ? 'A' : (B.hp > A.hp ? 'B' : 'draw');
  onEvent && onEvent({ type: 'end', verdict, aHp: A.hp, bHp: B.hp, turns: turn });
  return { verdict, aHp: A.hp, bHp: B.hp, turns: turn };
}
