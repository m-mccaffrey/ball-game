// Procedural level pipeline: generate candidates, screen each with the real
// solver, keep the ones that are solvable, non-trivial, and structurally
// distinct from existing + already-accepted levels. Prints a funnel report
// and writes the keepers to tools/generated.mjs for review.
//
// Usage: node tools/generate.mjs [--want N] [--seed S] [--tries T]
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseLevel } from '../src/engine.js';
import { solve } from '../src/solver.js';
import { makeRng, generateLevel } from '../src/generator.js';

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const WANT = arg('--want', 12);
const SEED = arg('--seed', 1);
const MAX_TRIES = arg('--tries', 600);

// Difficulty band and dedup tuning.
const PAR_MIN = 2, PAR_MAX = 5;
const MAX_PER_ARCH = { layered: 3 }; // keep clone-prone archetypes from dominating
const SOLVE_OPTS = { maxPresses: PAR_MAX, horizon: 13, tickBudget: 1_200_000 };
const INV = { '1': 'm', '2': 'y', '3': 'g', '4': 'c' };

// Colors of every phaseable obstacle in the grid. If the solver's solution
// doesn't touch one of them, that obstacle is vestigial (e.g., a narrow pit
// the ball just rolls over at speed) — a misleading dead element we reject.
function obstacleColors(grid) {
  const s = new Set();
  for (const row of grid) for (const ch of row) {
    if ('mygc'.includes(ch)) s.add(ch);
    else if (INV[ch]) s.add(INV[ch]);
  }
  return s;
}

const rng = makeRng(SEED);
const seenSigs = new Set();      // semantic dedup: one level per canonical puzzle
const accepted = [];
const stats = { tried: 0, invalid: 0, unsolvable: 0, trivial: 0, tooHard: 0, vestigial: 0, dup: 0, capped: 0, byArch: {} };

while (accepted.length < WANT && stats.tried < MAX_TRIES) {
  stats.tried++;
  const cand = generateLevel(rng);
  let level;
  try { level = parseLevel({ name: 'gen', grid: cand.grid, par: 1 }); }
  catch { stats.invalid++; continue; }

  const r = solve(level, SOLVE_OPTS);
  if (!r.solvable) { stats.unsolvable++; continue; }
  if (r.par < PAR_MIN) { stats.trivial++; continue; }
  if (r.par > PAR_MAX) { stats.tooHard++; continue; }

  const solColors = new Set(r.solution.map(s => s.color));
  if ([...obstacleColors(cand.grid)].some(c => !solColors.has(c))) { stats.vestigial++; continue; }

  const used = stats.byArch[cand.archetype] || 0;
  if (MAX_PER_ARCH[cand.archetype] && used >= MAX_PER_ARCH[cand.archetype]) { stats.capped++; continue; }

  if (seenSigs.has(cand.sig)) { stats.dup++; continue; }
  seenSigs.add(cand.sig);

  stats.byArch[cand.archetype] = (stats.byArch[cand.archetype] || 0) + 1;
  accepted.push({
    name: `Gen ${cand.archetype}-${accepted.length + 1}`,
    archetype: cand.archetype,
    par: r.par,
    solution: r.solution.map(s => s.color).join(''),
    grid: cand.grid,
  });
}

console.log(`\nFunnel (seed ${SEED}): tried ${stats.tried}`);
console.log(`  invalid ${stats.invalid} · unsolvable ${stats.unsolvable} · trivial(<${PAR_MIN}) ${stats.trivial} · tooHard(>${PAR_MAX}) ${stats.tooHard} · vestigial ${stats.vestigial} · dup ${stats.dup} · capped ${stats.capped}`);
console.log(`  accepted ${accepted.length}  ${JSON.stringify(stats.byArch)}\n`);

for (const a of accepted) {
  console.log(`${a.name}  par ${a.par} [${a.solution}]`);
  for (const row of a.grid) console.log('    ' + row);
  console.log();
}

const out = 'export const GENERATED = ' + JSON.stringify(
  accepted.map(({ name, archetype, par, grid }) => ({ name, archetype, par, grid })), null, 2) + ';\n';
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'generated.mjs'), out);
console.log(`Wrote ${accepted.length} levels to tools/generated.mjs`);
