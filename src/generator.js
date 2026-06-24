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

// ---- Archetype: jetloft (jets) -----------------------------------------
// Ball rolls in, clears an approach wall, then a jet bank lofts it up onto a
// ledge. The landing is gated either by a roof to open (normal block) or by a
// pad to conjure (inverse block). Geometry hugs the hand-proven Fountain arc.
function genJetLoft(rng) {
  const g = blank();
  for (let c = 0; c < 19; c++) g[14][c] = '#';
  for (let c = 0; c < COLS; c++) g[15][c] = '#';
  g[8][1] = 'b';
  g[9][1] = '\\';

  const [wallColor, gateColor] = distinctColors(rng, 2);
  // approach wall (rolls into it before the jets)
  const wallCol = randint(rng, 4, 5);
  g[12][wallCol] = wallColor; g[13][wallCol] = wallColor;

  // jet bank
  const js = randint(rng, 7, 8);
  for (let c = js; c < js + 4; c++) g[13][c] = '^';

  // landing ledge + gate
  const ls = randint(rng, 13, 14);
  const roof = rng() < 0.5;
  const mid = ls + 2;
  if (roof) {
    for (let c = ls; c < ls + 4; c++) g[3][c] = gateColor;     // roof to open
    for (let c = ls; c < ls + 6 && c < COLS; c++) g[5][c] = '#'; // solid ledge
    g[4][mid] = 't';
  } else {
    for (let c = ls; c < ls + 6 && c < COLS; c++) {            // pad to conjure
      g[5][c] = INV_OF[gateColor];
      g[6][c] = 'x';
    }
    g[4][mid] = 't';
  }
  // Set-piece archetypes vary mainly by color + position (not structure), so
  // their signatures keep the actual colors and a coarse layout fingerprint.
  const sig = `jetloft:${roof ? 'R' : 'P'}:${wallColor}${gateColor}:j${js}l${ls}`;
  return { grid: stringify(g), archetype: 'jetloft', sig };
}

// ---- Archetype: portalroute (portals) ----------------------------------
// A vertical cap-chute: the ball drops through a stack of colored caps (phase
// each to fall to the next), into a portal that delivers it to a sealed
// chamber the target sits in — reachable no other way. Deterministic and
// reliable: portals catch a falling ball cleanly and preserve velocity.
function genPortalRoute(rng) {
  const g = blank();
  for (let c = 0; c < COLS; c++) g[15][c] = '#';
  const S = randint(rng, 5, 7);   // chute column
  g[1][S] = 'b';

  const nCaps = randint(rng, 2, 3);
  const caps = distinctColors(rng, nCaps);
  let row = 4;
  for (let i = 0; i < nCaps; i++) {
    for (let c = S - 1; c <= S + 1; c++) g[row][c] = caps[i];
    row += 2;
  }
  g[row][S] = '@';                // portal entrance below the last cap

  // sealed target chamber on the right — only the portal reaches it
  const cc = randint(rng, 15, 18);
  for (let r = 2; r <= 11; r++) { g[r][cc - 2] = '#'; g[r][cc + 2] = '#'; }
  for (let c = cc - 2; c <= cc + 2; c++) g[11][c] = '#';
  g[3][cc] = '&';
  g[10][cc] = 't';

  const sig = `portalroute:${caps.join('')}:cc${cc}`;
  return { grid: stringify(g), archetype: 'portalroute', sig };
}

export const ARCH = { gauntlet: genGauntlet, layered: genLayered, jetloft: genJetLoft, portalroute: genPortalRoute };

const ARCHETYPES = [
  genGauntlet, genGauntlet,
  genPortalRoute, genPortalRoute,
  genJetLoft, genJetLoft, genJetLoft,
  genLayered,
];

export function generateLevel(rng) {
  return pick(rng, ARCHETYPES)(rng);
}
