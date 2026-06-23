// solver.js — DOM-free search that decides whether a level is winnable,
// and if so finds the minimum number of color presses (an honest "par")
// plus a witness solution. It drives the SAME engine the game runs, at the
// SAME fixed timestep, so a solution it reports is genuinely playable.
//
// Strategy: iterative deepening on press count. For pressLimit = 0,1,2,…,
// depth-first search where the only choices are made at decision points on a
// fixed time grid: keep the current phase (free) or switch to another phase
// (costs one press). Between decision points we advance the real simulation.
// We prune any branch that kills the ball (a clean, par solution never dies)
// and deduplicate physically-equivalent states. The first pressLimit that
// yields a win is the minimum, because we try them in increasing order.
import { createState, step, setPhase, PHASE_COLORS } from './engine.js';

const TICK = 1 / 240; // must match the game's simulation step

function cloneState(s) {
  return {
    ball: { x: s.ball.x, y: s.ball.y, vx: s.ball.vx, vy: s.ball.vy },
    phased: s.phased,
    ghost: new Set(s.ghost),
    targets: s.targets.map(t => ({ x: t.x, y: t.y, color: t.color, collected: t.collected })),
    portalCd: s.portalCd,
    time: s.time,
    switches: s.switches,
    deaths: s.deaths,
    won: s.won,
  };
}

function collectedMask(s) {
  let m = 0;
  for (let i = 0; i < s.targets.length; i++) if (s.targets[i].collected) m |= (1 << i);
  return m;
}

// Physically-equivalent states collapse to one key (time is omitted because
// the simulation is time-invariant apart from the short portal cooldown).
function stateKey(s) {
  const xb = Math.round(s.ball.x / 5);
  const yb = Math.round(s.ball.y / 5);
  const vxb = Math.round(s.ball.vx / 60);
  const vyb = Math.round(s.ball.vy / 60);
  const pcd = s.portalCd > 0 ? 1 : 0;
  return `${xb},${yb},${vxb},${vyb},${s.phased || '.'},${collectedMask(s)},${pcd}`;
}

export function solve(level, opts = {}) {
  const {
    maxPresses = 8,
    horizon = 18,        // seconds of simulation a solution may take
    decisionDt = 0.08,   // how often the solver may choose to press
    tickBudget = 60_000_000,
  } = opts;

  let ticks = 0;

  // Advance `state` in place by `dur` seconds. Returns true if the ball died.
  function advance(state, dur) {
    const end = Math.min(state.time + dur, horizon);
    let died = false;
    while (state.time < end && !state.won) {
      const evs = step(state, level, TICK);
      ticks++;
      for (const e of evs) if (e.type === 'death') died = true;
      if (died) break;
    }
    return died;
  }

  for (let limit = 0; limit <= maxPresses; limit++) {
    const visited = new Map();
    const path = [];
    const start = createState(level);
    const r = dfs(start, limit, path, visited);
    if (r === true) return { solvable: true, par: limit, solution: [...path], ticks };
    if (r === 'budget') return { solvable: false, par: Infinity, ticks, budgetExceeded: true };
  }
  return { solvable: false, par: Infinity, ticks };

  function dfs(state, pressesLeft, path, visited) {
    if (ticks > tickBudget) return 'budget';
    if (state.won) return true;
    if (state.time >= horizon) return false;

    const k = stateKey(state);
    const seen = visited.get(k);
    if (seen !== undefined && seen >= pressesLeft) return false;
    visited.set(k, pressesLeft);

    // Action list: keep (free) first, then each possible phase switch.
    const actions = ['keep'];
    if (pressesLeft > 0) {
      for (const c of PHASE_COLORS) if (c !== state.phased) actions.push(c);
      if (state.phased) actions.push('off'); // press current color again -> off
    }

    for (const a of actions) {
      const ns = cloneState(state);
      let used = 0;
      let rec = null;
      if (a !== 'keep') {
        const color = a === 'off' ? state.phased : a;
        setPhase(ns, level, color);
        used = 1;
        rec = { t: Math.round(state.time * 100) / 100, color };
        path.push(rec);
      }
      const died = advance(ns, decisionDt);
      if (!died) {
        const r = dfs(ns, pressesLeft - used, path, visited);
        if (r === true) return true;
        if (r === 'budget') { if (rec) path.pop(); return 'budget'; }
      }
      if (rec) path.pop();
    }
    return false;
  }
}
