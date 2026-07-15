// FallKard Arena · policy/index.mjs
// The brain registry. One swappable contract — decide(state, agent) → {move, scores} —
// with three drop-in engines behind it. A Seal picks its mind by name; every caller
// (the reducer, the browser, a live duel) talks to the same interface.
//
//   heuristic — deterministic dot-product; the GA breeds on this (browser + Node).
//   webllm    — a real small model in-browser via WebGPU. The mind, made real.
//   byok      — the same, but inference on the user's own remote endpoint.
//
// Import-safe in Node: webllm/byok only fetch their runtimes lazily when loaded.

import { heuristic, AXES, scoreCardForPlay, readPosition } from './heuristic.mjs';
import { webllm } from './webllm.mjs';
import { byok } from './byok.mjs';

export { AXES, scoreCardForPlay, readPosition };
export const ENGINES = { heuristic, webllm, byok };

export function getEngine(name) { return ENGINES[name] || heuristic; }

// Resolve the decider for an agent. Honours agent.policy.engine, defaults to heuristic.
export function deciderFor(agent, override) {
  const name = override || agent?.policy?.engine || 'heuristic';
  const eng = getEngine(name);
  return (state) => eng.decide(state, agent);
}
