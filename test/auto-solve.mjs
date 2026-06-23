// Runs the search solver against every level: confirms each is winnable and
// reports the minimum press count it found vs. the declared par.
// Usage: node test/auto-solve.mjs [levelNameSubstring]
import { parseLevel } from '../src/engine.js';
import { solve } from '../src/solver.js';
import { LEVELS } from '../src/levels.js';

const filter = process.argv[2];
let failures = 0;
let warnings = 0;
const t0 = Date.now();

for (const def of LEVELS) {
  if (filter && !def.name.toLowerCase().includes(filter.toLowerCase())) continue;
  const level = parseLevel(def);
  const start = Date.now();
  const r = solve(level);
  const ms = Date.now() - start;
  if (!r.solvable) {
    failures++;
    const why = r.budgetExceeded ? 'BUDGET EXCEEDED' : 'NO SOLUTION FOUND';
    console.error(`FAIL  ${def.name}: ${why} (declared par ${def.par}, ${(r.ticks / 1e6).toFixed(1)}M ticks, ${ms}ms)`);
    continue;
  }
  const presses = r.solution.map(s => s.color).join('');
  if (def.par < r.par) {
    // Declared par is below the true optimum: 3 stars would be impossible.
    failures++;
    console.error(`FAIL  ${def.name}: declared par ${def.par} is UNACHIEVABLE — best is ${r.par} [${presses}]`);
  } else if (def.par > r.par) {
    warnings++;
    console.log(`WARN  ${def.name}: par ${def.par} is loose — beatable in ${r.par} [${presses}] (${ms}ms)`);
  } else {
    console.log(`OK    ${def.name}: par ${r.par} [${presses || '—'}] (${(r.ticks / 1e6).toFixed(1)}M ticks, ${ms}ms)`);
  }
}

console.log(`\n${failures} failures, ${warnings} loose pars, ${((Date.now() - t0) / 1000).toFixed(1)}s total`);
process.exit(failures ? 1 : 0);

