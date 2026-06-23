// generator.js — procedural level generator for Hueball.
//
// It does NOT try to guarantee good puzzles; it emits plausible parametric
// layouts and leans on the solver (src/solver.js) to verify solvability and
// grade difficulty. The pipeline in tools/generate.mjs keeps only candidates
// that are solvable, non-trivial (par >= 2), and structurally distinct.

const COLS = 24, ROWS = 16;
const COLORS = ['m', 'y', 'g', 'c'];
const INV_OF = { m: '1', y: '2', g: '3', c: '4' };
const GHOST_OF = { m: 'M', y: 'Y', g: 'G', c: 'C' };

// Deterministic, seedable RNG (mulberry32) so runs are reproducible.
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

function blank() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
}
const stringify = g => g.map(row => row.join(''));

// Canonical puzzle signature: colors are relabeled by order of first
// appearance, so two levels that are identical up to a color permutation map
// to the same signature (a near-duplicate), while different obstacle types,
// orders, or positions stay distinct.
function makeSig(arch, tuples) {
  const map = {}; let n = 0;
  const parts = tuples.map(t => {
    const [kind, color, ...rest] = t;
    if (!(color in map)) map[color] = n++;
    return `${kind}${map[color]}${rest.length ? '@' + rest.join('@') : ''}`;
  });
  return `${arch}:${parts.join(',')}`;
}

// Pick `n` distinct colors (falls back to repeats if n > 4).
function distinctColors(rng, n) {
  const pool = [...COLORS];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    else out.push(pick(rng, COLORS));
  }
  return out;
}

// ---- Archetype: layered drop -------------------------------------------
// Full-width colored layers; phase each to fall through. Optional ghost
// sparks beneath layers and optional spike garnish in the gaps.
function genLayered(rng) {
  const g = blank();
  for (let c = 0; c < COLS; c++) { g[14][c] = '#'; g[15][c] = '#'; }
  const col = randint(rng, 7, 16);
  g[1][col] = 'b';

  const nLayers = randint(rng, 2, 4);
  const colors = distinctColors(rng, nLayers);
  const ghosts = rng() < 0.5;
  let row = randint(rng, 2, 4);
  for (let i = 0; i < nLayers; i++) {
    for (let c = 0; c < COLS; c++) g[row][c] = colors[i];
    if (ghosts && row + 1 < 12) g[row + 1][col] = GHOST_OF[colors[i]];
    row += 2;
  }
  g[13][col] = 't';
  const sig = makeSig('layered', colors.map(c => [ghosts ? 'L*' : 'L', c]));
  return { grid: stringify(g), archetype: 'layered', sig };
}

// ---- Archetype: gauntlet (horizontal roll) -----------------------------
// Ball is launched right and must clear a sequence of obstacles: colored
// walls (phase to remove), inverse bridges over spikes (phase to create),
// and normal bridges (passable unless that color gets phased). Reusing a
// color across obstacle types creates "one color, opposite jobs" tension.
function genGauntlet(rng) {
  const g = blank();
  for (let c = 0; c < COLS; c++) { g[13][c] = '#'; g[14][c] = '#'; g[15][c] = '#'; }
  // Spawn high but put the launch ramp at floor level: the ball converts its
  // fall into a fast ground-level roll with no arc, so every obstacle it meets
  // is actually in its path (no "flies over the first wall" vestigial pieces).
  g[1][1] = 'b';
  g[12][1] = '\\';

  const nOb = randint(rng, 2, 4);
  // Distinct colors assigned round-robin so consecutive obstacles differ,
  // forcing real phase switches (par scales with distinct colors used). Using
  // only walls (phase to remove) and inverse bridges (phase to create) keeps
  // these solvable by construction: phase each obstacle's color as you reach it.
  const palette = distinctColors(rng, randint(rng, 2, 3));
  const obs = [];
  let col = randint(rng, 4, 5);
  for (let i = 0; i < nOb && col < 19; i++) {
    const color = palette[i % palette.length];
    const type = pick(rng, ['wall', 'wall', 'inv']);
    const ghost = type === 'wall' && rng() < 0.3;
    if (type === 'wall') {
      const h = randint(rng, 2, 3);
      for (let rr = 13 - h; rr < 13; rr++) g[rr][col] = color;
      if (ghost) g[12][col - 1] = GHOST_OF[color]; // optional perched spark
      obs.push([ghost ? 'W*' : 'W', color, Math.round(col / 2)]);
      col += randint(rng, 3, 5);
    } else {
      const w = randint(rng, 2, 3);
      for (let k = 0; k < w && col + k < 20; k++) {
        g[13][col + k] = INV_OF[color];
        g[14][col + k] = 'x';
      }
      obs.push(['I' + w, color, Math.round(col / 2)]);
      col += w + randint(rng, 2, 3);
    }
  }
  g[12][21] = 't';
  g[13][22] = '/';
  return { grid: stringify(g), archetype: 'gauntlet', sig: makeSig('gauntlet', obs) };
}

const ARCHETYPES = [genGauntlet, genGauntlet, genGauntlet, genGauntlet, genLayered];

export function generateLevel(rng) {
  return pick(rng, ARCHETYPES)(rng);
}
