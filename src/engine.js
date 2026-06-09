// engine.js — pure simulation core for Hueball.
// No DOM access: the same code runs in the browser and in the headless
// solvability tests under node (test/solve.mjs).

export const TILE = 40;
export const BALL_R = 10;
export const GRAVITY = 1700;
export const RESTITUTION = 0.42;
export const FRICTION = 0.0008;
export const MAX_SPEED = 1500;
export const MAGNET_RADIUS = 70;
export const MAGNET_PULL = 1500;
export const COLLECT_RADIUS = 24;
export const PHASE_COLORS = ['m', 'y', 'g', 'c'];

// Grid legend:
//   .  empty            #  solid neutral block
//   /  neutral ramp rising to the right (solid lower-right triangle)
//   \  neutral ramp falling to the right (solid lower-left triangle)
//   m y g c  phaseable colored blocks
//   x  hazard (spikes) — touching it resets the ball
//   b  ball spawn       t  target spark

export function parseLevel(def, index = 0) {
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const tiles = [];
  let spawn = null;
  const targets = [];
  for (let r = 0; r < rows; r++) {
    if (def.grid[r].length !== cols) {
      throw new Error(`Level "${def.name}" row ${r} is ${def.grid[r].length} chars, expected ${cols}`);
    }
    const line = def.grid[r].split('');
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      if (ch === 'b') {
        if (spawn) throw new Error(`Level "${def.name}" has multiple spawns`);
        spawn = { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
        line[c] = '.';
      } else if (ch === 't') {
        targets.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE });
        line[c] = '.';
      } else if (!'.#/\\xmygc'.includes(ch)) {
        throw new Error(`Level "${def.name}" has unknown tile '${ch}' at ${r},${c}`);
      }
    }
    tiles.push(line);
  }
  if (!spawn) throw new Error(`Level "${def.name}" has no ball spawn (b)`);
  if (!targets.length) throw new Error(`Level "${def.name}" has no targets (t)`);
  return {
    index,
    name: def.name,
    hint: def.hint || '',
    par: def.par || 1,
    rows, cols, tiles, spawn, targets,
    width: cols * TILE,
    height: rows * TILE,
  };
}

export function createState(level) {
  return {
    ball: { x: level.spawn.x, y: level.spawn.y, vx: 0, vy: 0 },
    phased: null,                 // color currently phased out, or null
    ghost: new Set(),             // tiles kept intangible until the ball clears them
    targets: level.targets.map(t => ({ x: t.x, y: t.y, collected: false })),
    time: 0,
    switches: 0,
    deaths: 0,
    won: false,
  };
}

export function charAt(level, r, c) {
  if (c < 0 || c >= level.cols || r < 0) return '#'; // walls + ceiling
  if (r >= level.rows) return '.';                   // the bottom is open
  return level.tiles[r][c];
}

export function isSolid(ch, phased) {
  if (ch === '#' || ch === '/' || ch === '\\' || ch === 'x') return true;
  if (ch === 'm' || ch === 'y' || ch === 'g' || ch === 'c') return ch !== phased;
  return false;
}

function tileVerts(ch, r, c) {
  const x0 = c * TILE, y0 = r * TILE, x1 = x0 + TILE, y1 = y0 + TILE;
  // Vertices wind clockwise in screen coords so edge normals point outward.
  if (ch === '/') return [{ x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  if (ch === '\\') return [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

// Circle vs convex polygon. Returns {nx, ny, pen} or null.
function circlePoly(px, py, radius, verts) {
  const n = verts.length;
  let inside = true, maxS = -Infinity, maxNx = 0, maxNy = 0;
  for (let i = 0; i < n; i++) {
    const a = verts[i], b = verts[(i + 1) % n];
    const ex = b.x - a.x, ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    const nx = ey / len, ny = -ex / len;
    const s = (px - a.x) * nx + (py - a.y) * ny;
    if (s > 0) inside = false;
    if (s > maxS) { maxS = s; maxNx = nx; maxNy = ny; }
  }
  if (inside) return { nx: maxNx, ny: maxNy, pen: radius - maxS };
  let bestD2 = Infinity, bx = 0, by = 0;
  for (let i = 0; i < n; i++) {
    const a = verts[i], b = verts[(i + 1) % n];
    const ex = b.x - a.x, ey = b.y - a.y;
    const t = clamp(((px - a.x) * ex + (py - a.y) * ey) / (ex * ex + ey * ey), 0, 1);
    const qx = a.x + t * ex, qy = a.y + t * ey;
    const d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
    if (d2 < bestD2) { bestD2 = d2; bx = qx; by = qy; }
  }
  if (bestD2 > radius * radius) return null;
  const d = Math.sqrt(bestD2) || 1e-6;
  return { nx: (px - bx) / d, ny: (py - by) / d, pen: radius - d };
}

function overlapsTile(level, state, r, c, margin) {
  const ch = charAt(level, r, c);
  if (ch === '.') return false;
  return !!circlePoly(state.ball.x, state.ball.y, BALL_R + margin, tileVerts(ch, r, c));
}

// When a color becomes solid again, any of its tiles still overlapping the
// ball stay intangible until the ball rolls clear — it never crushes you.
function markGhosts(state, level, color) {
  const b = state.ball;
  const c0 = Math.floor((b.x - BALL_R - 2) / TILE), c1 = Math.floor((b.x + BALL_R + 2) / TILE);
  const r0 = Math.floor((b.y - BALL_R - 2) / TILE), r1 = Math.floor((b.y + BALL_R + 2) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (charAt(level, r, c) === color && overlapsTile(level, state, r, c, 2)) {
        state.ghost.add(r + ',' + c);
      }
    }
  }
}

// Toggle a phase color. Returns true if the state changed.
export function setPhase(state, level, color) {
  if (state.won || !PHASE_COLORS.includes(color)) return false;
  const prev = state.phased;
  state.phased = prev === color ? null : color;
  if (prev && prev !== state.phased) markGhosts(state, level, prev);
  state.switches++;
  return true;
}

export function resetBall(state, level, countDeath) {
  state.ball.x = level.spawn.x;
  state.ball.y = level.spawn.y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.phased = null;
  state.ghost.clear();
  for (const t of state.targets) t.collected = false;
  if (countDeath) state.deaths++;
  else { state.switches = 0; state.time = 0; }
}

// Advance the simulation by dt seconds. Call with a small fixed dt
// (the game loop uses 1/240). Returns an array of events:
//   {type:'bounce', mag, x, y} | {type:'collect', x, y}
//   {type:'death', x, y}       | {type:'win'}
export function step(state, level, dt) {
  const events = [];
  if (state.won) return events;
  state.time += dt;
  const b = state.ball;

  // Gentle magnet toward the nearest spark, so near-misses feel fair.
  let nearest = null, nd = Infinity;
  for (const t of state.targets) {
    if (t.collected) continue;
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (d < nd) { nd = d; nearest = t; }
  }
  if (nearest && nd < MAGNET_RADIUS && nd > 1) {
    const a = MAGNET_PULL * (1 - nd / MAGNET_RADIUS);
    b.vx += a * (nearest.x - b.x) / nd * dt;
    b.vy += a * (nearest.y - b.y) / nd * dt;
  }

  b.vy += GRAVITY * dt;
  b.vx *= 1 - 0.03 * dt;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  let died = false;
  for (let pass = 0; pass < 2; pass++) {
    const c0 = Math.floor((b.x - BALL_R) / TILE), c1 = Math.floor((b.x + BALL_R) / TILE);
    const r0 = Math.floor((b.y - BALL_R) / TILE), r1 = Math.floor((b.y + BALL_R) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = charAt(level, r, c);
        if (!isSolid(ch, state.phased)) continue;
        if (state.ghost.has(r + ',' + c)) continue;
        const hit = circlePoly(b.x, b.y, BALL_R, tileVerts(ch, r, c));
        if (!hit) continue;
        if (ch === 'x') { died = true; continue; }
        b.x += hit.nx * hit.pen;
        b.y += hit.ny * hit.pen;
        const vn = b.vx * hit.nx + b.vy * hit.ny;
        const tx = -hit.ny, ty = hit.nx;
        const vt = (b.vx * tx + b.vy * ty) * (1 - FRICTION);
        if (vn < 0 && (ch === '/' || ch === '\\')) {
          // Ramps are redirectors: the full speed is turned along the
          // slope, which keeps rolling fast and predictable.
          const speed = Math.hypot(b.vx, b.vy) * (1 - FRICTION);
          const dir = vt >= 0 ? 1 : -1;
          b.vx = tx * dir * speed;
          b.vy = ty * dir * speed;
          continue;
        }
        let vn2 = vn;
        if (vn < 0) {
          const e = -vn > 150 ? RESTITUTION : 0;
          vn2 = -e * vn;
          if (pass === 0 && e > 0) {
            events.push({ type: 'bounce', mag: Math.min(1, -vn / 900), x: b.x, y: b.y });
          }
        }
        b.vx = hit.nx * vn2 + tx * vt;
        b.vy = hit.ny * vn2 + ty * vt;
      }
    }
  }

  for (const key of state.ghost) {
    const [r, c] = key.split(',').map(Number);
    const ch = charAt(level, r, c);
    if (!isSolid(ch, state.phased) || !overlapsTile(level, state, r, c, 2)) {
      state.ghost.delete(key);
    }
  }

  if (b.y - BALL_R > level.height + 40) died = true;
  if (died) {
    events.push({ type: 'death', x: b.x, y: b.y });
    resetBall(state, level, true);
    return events;
  }

  for (const t of state.targets) {
    if (t.collected) continue;
    if (Math.hypot(t.x - b.x, t.y - b.y) < COLLECT_RADIUS) {
      t.collected = true;
      events.push({ type: 'collect', x: t.x, y: t.y });
    }
  }
  if (state.targets.every(t => t.collected)) {
    state.won = true;
    events.push({ type: 'win' });
  }
  return events;
}

export function starsFor(level, state) {
  if (state.deaths === 0 && state.switches <= level.par) return 3;
  if (state.deaths <= 1 || state.switches <= level.par + 2) return 2;
  return 1;
}
