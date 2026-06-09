// Headless solvability check: simulates a scripted solution for every level
// using the exact same engine the browser runs. Run with: node test/solve.mjs
import { parseLevel, createState, step, setPhase, TILE } from '../src/engine.js';
import { LEVELS } from '../src/levels.js';

// Each action fires once `after` seconds have passed AND its condition holds:
//   rest      ball nearly stationary
//   xgt/xlt   ball x beyond a column boundary (in tiles)
//   ygt       ball y below a row boundary (in tiles)
const SOLUTIONS = {
  'Layer Cake': [
    { when: { rest: true }, press: 'm' },
    { when: { rest: true }, press: 'y' },
    { when: { rest: true }, press: 'c' },
    { when: { rest: true }, press: 'g' },
  ],
  'Wrecking Roll': [
    { when: { rest: true }, press: 'c' },
  ],
  'Roulette': [
    { when: { xgt: 9.0 }, press: 'y' },
  ],
  'Gatekeeper': [
    { when: { rest: true }, press: 'm' },
    { when: { xgt: 9.0 }, press: 'm' },  // restore before the pit
    { when: { xgt: 14.0 }, press: 'm' }, // open the wall
  ],
  'Switchback': [
    { when: { xgt: 6.0 }, press: 'm' },
    { after: 0.5, when: { ygt: 6.5 }, press: 'c' },
    { after: 1.0, when: { ygt: 12.5 }, press: 'y' },
  ],
  'Twins': [
    { when: { xlt: 20.0 }, press: 'm' },
    { after: 1.0, when: { ygt: 9.0 }, press: 'm' }, // restore for the pit
    { after: 2.0, when: { xgt: 15.0 }, press: 'c' },
  ],
  'Combo Shaft': [
    { when: { rest: true }, press: 'm' },
    { when: { rest: true }, press: 'c' },
    { when: { rest: true }, press: 'y' },
    { when: { rest: true }, press: 'g' },
    { when: { rest: true }, press: 'm' },
  ],
  'Full Spectrum': [
    { when: { rest: true }, press: 'm' },
    { when: { rest: true }, press: 'y' },
    { when: { xgt: 7.0 }, press: 'c' },
    { after: 2.0, when: { xgt: 17.0 }, press: 'g' },
  ],
};

const DT = 1 / 240;
const TIME_LIMIT = 45;

function conditionMet(cond, state, sinceLast) {
  const b = state.ball;
  if (cond.rest) return sinceLast > 0.25 && Math.hypot(b.vx, b.vy) < 12;
  if (cond.xgt !== undefined) return b.x > cond.xgt * TILE;
  if (cond.xlt !== undefined) return b.x < cond.xlt * TILE;
  if (cond.ygt !== undefined) return b.y > cond.ygt * TILE;
  return true;
}

let failures = 0;
for (let i = 0; i < LEVELS.length; i++) {
  const level = parseLevel(LEVELS[i], i);
  const plan = SOLUTIONS[level.name];
  if (!plan) {
    console.error(`FAIL  ${level.name}: no scripted solution`);
    failures++;
    continue;
  }
  const state = createState(level);
  let next = 0;
  let lastAction = -1;
  const trace = [];
  while (state.time < TIME_LIMIT && !state.won) {
    if (next < plan.length) {
      const a = plan[next];
      if (state.time >= (a.after || 0) && conditionMet(a.when || {}, state, state.time - lastAction)) {
        setPhase(state, level, a.press);
        trace.push(`t=${state.time.toFixed(2)} press ${a.press} at (${state.ball.x.toFixed(0)},${state.ball.y.toFixed(0)})`);
        lastAction = state.time;
        next++;
      }
    }
    const events = step(state, level, DT);
    for (const e of events) {
      if (e.type === 'death') trace.push(`t=${state.time.toFixed(2)} DEATH at (${e.x.toFixed(0)},${e.y.toFixed(0)})`);
      if (e.type === 'collect') trace.push(`t=${state.time.toFixed(2)} collect at (${e.x},${e.y})`);
    }
  }
  const b = state.ball;
  if (state.won && state.deaths === 0) {
    const tag = state.switches <= level.par ? 'par' : `OVER PAR (${state.switches}/${level.par})`;
    console.log(`PASS  ${level.name}: ${state.time.toFixed(1)}s, ${state.switches} switches [${tag}]`);
  } else {
    failures++;
    console.error(`FAIL  ${level.name}: won=${state.won} deaths=${state.deaths} ` +
      `ball=(${b.x.toFixed(0)},${b.y.toFixed(0)}) v=(${b.vx.toFixed(0)},${b.vy.toFixed(0)}) actionsUsed=${next}/${plan.length}`);
    for (const line of trace) console.error('      ' + line);
  }
}
process.exit(failures ? 1 : 0);
