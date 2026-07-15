// game.js — rendering, input, screens and juice for Hueball.
import {
  TILE, BALL_R, PHASE_COLORS, COLLECT_RADIUS, BUMPER_R, JET_LEN,
  parseLevel, createState, cloneState, step, setPhase, resetBall,
  starsFor, strokesFor, charAt,
} from './engine.js';
import { LEVELS } from './levels.js';
import * as sfx from './audio.js';

const PALETTE = { m: '#ec4899', y: '#facc15', g: '#4ade80', c: '#38bdf8' };
const COLOR_NAMES = { m: 'magenta', y: 'yellow', g: 'green', c: 'cyan' };
const INVERSE_CHAR = { m: '1', y: '2', g: '3', c: '4' }; // inverse-block tile per color
const JET_TINT = '#bae6fd';
const NEUTRAL = '#3a4054';
const NEUTRAL_EDGE = '#5b6480';
const HAZARD = '#ef4444';
const BG = '#10121a';
const TARGET = '#fde68a';
const BUMPER = '#fb7185';
const PORTAL_IN = '#a78bfa';
const PORTAL_OUT = '#2dd4bf';
const SAVE_KEY = 'hueball-save-v1';

function hexToRgb(h) {
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}
const BG_RGB = hexToRgb(BG);
const PALETTE_RGB = {};
// When a color is phased out, the whole background shifts toward it so the
// phased blocks look like they dissolve into the world.
const DISSOLVE_MIX = 0.30;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------------------------------------------------------------- state ---
const levels = LEVELS.map((def, i) => parseLevel(def, i));
let levelIndex = 0;
let level = levels[0];
let state = createState(level);
let layers = null;            // baked per-color canvases
let screen = 'menu';          // 'menu' | 'play' | 'complete'
let phaseAlpha = { m: 1, y: 1, g: 1, c: 1 };
let invAlpha = { m: 0.22, y: 0.22, g: 0.22, c: 0.22 };
let tintAlpha = 0;
let tintColor = PALETTE.m;
let bgCur = { ...BG_RGB };    // animated background color (dissolve effect)
for (const col of PHASE_COLORS) PALETTE_RGB[col] = hexToRgb(PALETTE[col]);
let shake = 0;
let winTimer = 0;
let particles = [];
let trail = [];
let squash = 0;
let hintTimer = 0;
let running = false;          // plan-then-run: false = planning, true = the run
let triggers = [];            // color wires: {r, c, color, fired}
let selectedColor = 'm';      // wire color the next canvas tap places

let save = { unlocked: 0, stars: {}, best: {} };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = { ...save, ...JSON.parse(raw) };
} catch (e) { /* private mode etc. — play without saving */ }

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------ DOM hooks ---
const $ = id => document.getElementById(id);
const hud = $('hud');
const colorbar = $('colorbar');
const hintEl = $('hint');
const menuEl = $('screen-menu');
const completeEl = $('screen-complete');

function show(el, on) { el.classList.toggle('hidden', !on); }

// -------------------------------------------------------- layer baking ----
function bakeLayer(lv, match, fill, edge) {
  const cv = document.createElement('canvas');
  cv.width = lv.width;
  cv.height = lv.height;
  const g = cv.getContext('2d');
  g.fillStyle = fill;
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      const ch = lv.tiles[r][c];
      if (!match(ch)) continue;
      const x = c * TILE, y = r * TILE;
      g.beginPath();
      if (ch === '/') {
        g.moveTo(x + TILE, y); g.lineTo(x + TILE, y + TILE); g.lineTo(x, y + TILE);
      } else if (ch === '\\') {
        g.moveTo(x, y); g.lineTo(x + TILE, y + TILE); g.lineTo(x, y + TILE);
      } else {
        g.rect(x, y, TILE, TILE);
      }
      g.closePath();
      g.fill();
    }
  }
  // Light top edges where a tile is exposed to the sky of its own group.
  g.strokeStyle = edge;
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      const ch = lv.tiles[r][c];
      if (!match(ch)) continue;
      const above = r > 0 ? lv.tiles[r - 1][c] : '#';
      const x = c * TILE, y = r * TILE + 1.5;
      g.beginPath();
      if (ch === '/') { g.moveTo(x, y + TILE - 3); g.lineTo(x + TILE - 1.5, y); }
      else if (ch === '\\') { g.moveTo(x + 1.5, y); g.lineTo(x + TILE, y + TILE - 3); }
      else if (!match(above)) { g.moveTo(x + 2, y); g.lineTo(x + TILE - 2, y); }
      else continue;
      g.stroke();
    }
  }
  return cv;
}

function bakeHazards(lv) {
  const cv = document.createElement('canvas');
  cv.width = lv.width;
  cv.height = lv.height;
  const g = cv.getContext('2d');
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      if (lv.tiles[r][c] !== 'x') continue;
      const x = c * TILE, y = r * TILE;
      g.fillStyle = '#7f1d1d';
      g.fillRect(x, y + TILE * 0.55, TILE, TILE * 0.45);
      g.fillStyle = HAZARD;
      const n = 4, w = TILE / n;
      for (let i = 0; i < n; i++) {
        g.beginPath();
        g.moveTo(x + i * w, y + TILE * 0.6);
        g.lineTo(x + i * w + w / 2, y + TILE * 0.08);
        g.lineTo(x + (i + 1) * w, y + TILE * 0.6);
        g.closePath();
        g.fill();
      }
    }
  }
  return cv;
}

// Inverse blocks read as hollow, hatched "phantom" tiles so they're never
// confused with solid colored blocks. Their alpha is animated inversely.
function bakeInverseLayer(lv, ch, color) {
  const cv = document.createElement('canvas');
  cv.width = lv.width;
  cv.height = lv.height;
  const g = cv.getContext('2d');
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      if (lv.tiles[r][c] !== ch) continue;
      const x = c * TILE, y = r * TILE;
      g.fillStyle = color;
      g.globalAlpha = 0.18;
      g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      g.globalAlpha = 0.7;
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
      g.beginPath(); // diagonal hatch
      g.moveTo(x + 6, y + TILE - 6); g.lineTo(x + TILE - 6, y + 6);
      g.moveTo(x + 14, y + TILE - 6); g.lineTo(x + TILE - 6, y + 14);
      g.moveTo(x + 6, y + TILE - 14); g.lineTo(x + TILE - 14, y + 6);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  return cv;
}

function bakeAll(lv) {
  const out = {
    neutral: bakeLayer(lv, ch => ch === '#' || ch === '/' || ch === '\\', NEUTRAL, NEUTRAL_EDGE),
    hazards: bakeHazards(lv),
    colors: {},
    inverse: {},
  };
  for (const col of PHASE_COLORS) {
    out.colors[col] = bakeLayer(lv, ch => ch === col, PALETTE[col], 'rgba(255,255,255,0.45)');
    out.inverse[col] = bakeInverseLayer(lv, INVERSE_CHAR[col], PALETTE[col]);
  }
  return out;
}

// ----------------------------------------------------------- particles ----
function spawnBurst(x, y, color, count, speed, life, grav = 600) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - speed * 0.3,
      life, maxLife: life, grav,
      size: 2 + Math.random() * 3.5,
      color,
    });
  }
}

function confetti() {
  for (const t of state.targets) {
    for (const col of PHASE_COLORS) {
      spawnBurst(t.x, t.y, PALETTE[col], 14, 420, 1.3, 700);
    }
  }
}

// -------------------------------------------------------------- control ---
// Plan-then-run: color keys SELECT a wire color while planning; the world is
// only influenced by wires the ball crosses during the run. No live input.
function press(color) {
  if (screen !== 'play' || state.won || running) return;
  selectedColor = color;
  updateColorbar();
  sfx.playClick();
}

function placeWire(r, c) {
  if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) return;
  const i = triggers.findIndex(t => t.r === r && t.c === c);
  if (i >= 0 && triggers[i].color === selectedColor) triggers.splice(i, 1);
  else if (i >= 0) triggers[i].color = selectedColor;
  else triggers.push({ r, c, color: selectedColor, fired: false });
  sfx.playClick();
  updateHud();
}

function startRun() {
  if (screen !== 'play' || state.won) return;
  resetBall(state, level, false); // fresh run; death penalties persist
  for (const t of triggers) t.fired = false;
  trail = [];
  setRunning(true);
  sfx.playClick();
}

function stopRun() {
  resetBall(state, level, false);
  for (const t of triggers) t.fired = false;
  trail = [];
  setRunning(false);
  updateColorbar();
  updateHud();
}

function toggleRun() {
  if (screen !== 'play' || state.won) return;
  running ? stopRun() : startRun();
}

function manualReset() {
  if (screen !== 'play') return;
  loadLevel(levelIndex); // full restart: wires, penalties, everything
  setRunning(false);
  sfx.playClick();
}

function setRunning(on) {
  running = on;
  const chip = $('pause-chip');
  show(chip, !on && screen === 'play' && !state.won);
  $('btn-pause').textContent = on ? '⏹' : '▶';
  updateColorbar();
  updateHud();
}

function loadLevel(i, fresh = true) {
  levelIndex = Math.max(0, Math.min(levels.length - 1, i));
  level = levels[levelIndex];
  state = createState(level);
  layers = bakeAll(level);
  trail = [];
  particles = [];
  triggers = [];
  selectedColor = 'm';
  winTimer = 0;
  hintTimer = 0;
  phaseAlpha = { m: 1, y: 1, g: 1, c: 1 };
  invAlpha = { m: 0.22, y: 0.22, g: 0.22, c: 0.22 };
  if (fresh) {
    $('hud-name').textContent = `${levelIndex + 1}. ${level.name}`;
    hintEl.textContent = level.hint;
    show(hintEl, true);
    updateColorbar();
    updateHud();
  }
}

function startLevel(i) {
  loadLevel(i);
  screen = 'play';
  show(menuEl, false);
  show(completeEl, false);
  show(hud, true);
  show(colorbar, true);
  setRunning(false); // start paused: read the level, then press Space
}

function openMenu() {
  screen = 'menu';
  setRunning(false);
  buildLevelGrid();
  show(menuEl, true);
  show(completeEl, false);
  show(hud, false);
  show(colorbar, false);
  show(hintEl, false);
}

function completeLevel() {
  screen = 'complete';
  const stars = starsFor(level, state);
  save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
  save.unlocked = Math.max(save.unlocked, levelIndex + 1);
  const prevBest = save.best[levelIndex];
  const isRecord = prevBest === undefined || state.time < prevBest;
  if (isRecord) save.best[levelIndex] = Math.round(state.time * 10) / 10;
  persist();
  const strokes = strokesFor(state);
  const diff = strokes - level.par;
  const golf = diff < -1 ? 'an eagle!' : diff === -1 ? 'a birdie!' : diff === 0 ? 'par ✓'
    : diff === 1 ? 'a bogey' : `+${diff}`;
  $('complete-title').textContent = level.name;
  $('complete-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('complete-stats').textContent =
    `${strokes} stroke${strokes === 1 ? '' : 's'} (par ${level.par}) — ${golf}` +
    (state.deaths ? ` · incl. ${state.deaths} penalt${state.deaths === 1 ? 'y' : 'ies'}` : '') +
    ` · ${state.time.toFixed(1)}s` +
    (isRecord && prevBest !== undefined ? ' — new record!' : prevBest !== undefined ? ` (best ${prevBest.toFixed(1)}s)` : '');
  const last = levelIndex >= levels.length - 1;
  $('btn-next').textContent = last ? 'Back to levels' : 'Next level →';
  show(completeEl, true);
  show(colorbar, false);
}

// ----------------------------------------------------------------- HUD ----
function updateColorbar() {
  for (const btn of colorbar.querySelectorAll('.color-btn')) {
    btn.classList.toggle('phased', running && state.phased === btn.dataset.color);
    btn.classList.toggle('selected', !running && selectedColor === btn.dataset.color);
  }
}

function updateHud() {
  if (running || state.won) {
    $('hud-stats').textContent = `⛳ ${strokesFor(state)} · par ${level.par}`;
  } else {
    const n = triggers.length;
    const pen = state.deaths ? ` · +${state.deaths} penalty` : '';
    $('hud-stats').textContent = `⛳ plan: ${n} wire${n === 1 ? '' : 's'}${pen} · par ${level.par}`;
  }
}

function buildLevelGrid() {
  const grid = $('menu-levels');
  grid.innerHTML = '';
  levels.forEach((lv, i) => {
    const locked = i > save.unlocked;
    const btn = document.createElement('button');
    btn.className = 'level-btn' + (locked ? ' locked' : '');
    const stars = save.stars[i] || 0;
    btn.innerHTML = locked
      ? `<span class="lv-num">\u{1F512}</span><span class="lv-name">${lv.name}</span>`
      : `<span class="lv-num">${i + 1}</span><span class="lv-name">${lv.name}</span>` +
        `<span class="lv-stars">${stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : ''}</span>`;
    if (!locked) btn.addEventListener('click', () => { sfx.unlock(); sfx.playClick(); startLevel(i); });
    grid.appendChild(btn);
  });
}

// ----------------------------------------------------------------- input --
const KEY_COLOR = {
  '1': 'm', a: 'm', j: 'm',
  '2': 'y', s: 'y', k: 'y',
  '3': 'g', d: 'g', l: 'g',
  '4': 'c', f: 'c', ';': 'c',
};

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (KEY_COLOR[k]) { press(KEY_COLOR[k]); e.preventDefault(); }
  else if (k === ' ') { toggleRun(); e.preventDefault(); }
  else if (k === 'r') { manualReset(); e.preventDefault(); }
  else if (k === 'escape') { if (screen === 'play' || screen === 'complete') openMenu(); }
  else if (k === 'n' && screen === 'complete') $('btn-next').click();
});

// Tapping the course while planning places/edits a wire.
canvas.addEventListener('pointerdown', e => {
  sfx.unlock();
  if (screen !== 'play' || running || state.won) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * level.width;
  const y = (e.clientY - rect.top) / rect.height * level.height;
  placeWire(Math.floor(y / TILE), Math.floor(x / TILE));
});
$('btn-pause').addEventListener('click', () => { sfx.unlock(); toggleRun(); });

for (const btn of colorbar.querySelectorAll('.color-btn')) {
  btn.style.setProperty('--c', PALETTE[btn.dataset.color]);
  const fire = e => { e.preventDefault(); sfx.unlock(); press(btn.dataset.color); };
  btn.addEventListener('pointerdown', fire);
}
$('btn-reset').addEventListener('click', () => { sfx.unlock(); manualReset(); });
$('btn-levels').addEventListener('click', () => { sfx.playClick(); openMenu(); });
$('btn-play').addEventListener('click', () => {
  sfx.unlock(); sfx.playClick();
  startLevel(Math.min(save.unlocked, levels.length - 1));
});
$('btn-next').addEventListener('click', () => {
  sfx.playClick();
  if (levelIndex >= levels.length - 1) openMenu();
  else startLevel(levelIndex + 1);
});
$('btn-replay').addEventListener('click', () => { sfx.playClick(); startLevel(levelIndex); });
$('btn-complete-menu').addEventListener('click', () => { sfx.playClick(); openMenu(); });

const muteBtn = $('btn-mute');
muteBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.setMuted(!sfx.isMuted());
  muteBtn.textContent = sfx.isMuted() ? '\u{1F507}' : '\u{1F50A}';
});

// ----------------------------------------------------------------- loop ---
const SIM_DT = 1 / 240;
let acc = 0;
let lastT = performance.now();

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'bounce') {
      sfx.playBounce(e.mag);
      squash = Math.min(0.45, 0.2 + e.mag * 0.3);
      spawnBurst(e.x, e.y + BALL_R, 'rgba(255,255,255,0.8)', Math.round(3 + e.mag * 5), 120, 0.4, 300);
    } else if (e.type === 'collect') {
      sfx.playCollect();
      spawnBurst(e.x, e.y, e.color ? PALETTE[e.color] : TARGET, 26, 320, 0.9);
      updateHud();
    } else if (e.type === 'boing') {
      sfx.playBoing();
      squash = 0.4;
      spawnBurst(e.x, e.y, BUMPER, 10, 260, 0.5, 400);
    } else if (e.type === 'warp') {
      sfx.playWarp();
      spawnBurst(e.from.x, e.from.y, PORTAL_IN, 16, 260, 0.6, 0);
      spawnBurst(e.to.x, e.to.y, PORTAL_OUT, 16, 260, 0.6, 0);
      trail = [];
    } else if (e.type === 'death') {
      sfx.playDeath();
      shake = 14;
      spawnBurst(e.x, Math.min(e.y, level.height), '#f8fafc', 24, 380, 0.8);
      trail = [];
      setRunning(false); // back at the tee: pause for a re-plan
      updateColorbar();
      updateHud();
    } else if (e.type === 'win') {
      sfx.playWin();
      confetti();
      winTimer = 1.0;
    }
  }
}

// A wire fires when the ball's center enters its tile (once per run). It
// behaves exactly like pressing that color at that moment.
function fireWires(st, wires, live) {
  const r = Math.floor(st.ball.y / TILE);
  const c = Math.floor(st.ball.x / TILE);
  for (const t of wires) {
    if (t.fired || t.r !== r || t.c !== c) continue;
    t.fired = true;
    if (!setPhase(st, level, t.color)) continue;
    if (live) {
      sfx.playSwitch(t.color, st.phased === null);
      tintColor = PALETTE[t.color];
      spawnBurst((c + 0.5) * TILE, (r + 0.5) * TILE, PALETTE[t.color], 12, 220, 0.55, 200);
      updateColorbar();
      updateHud();
    }
  }
}

function update(dt) {
  if (screen === 'play' || screen === 'complete') {
    if (!state.won && running) {
      acc += dt;
      acc = Math.min(acc, 0.1);
      while (acc >= SIM_DT) {
        handleEvents(step(state, level, SIM_DT));
        fireWires(state, triggers, true);
        acc -= SIM_DT;
      }
      trail.push({ x: state.ball.x, y: state.ball.y });
      if (trail.length > 16) trail.shift();
    } else if (state.won && screen === 'play') {
      winTimer -= dt;
      if (winTimer <= 0) completeLevel();
    }
    hintTimer += dt;
    if (hintTimer > 6) show(hintEl, false);
  }

  // animate phase alphas + background dissolve
  for (const col of PHASE_COLORS) {
    const goal = state.phased === col ? 0.06 : 1;
    phaseAlpha[col] += (goal - phaseAlpha[col]) * Math.min(1, dt * 10);
    // Inverse blocks do the opposite: vivid while phased, faint hint otherwise.
    const ig = state.phased === col ? 1 : 0.22;
    invAlpha[col] += (ig - invAlpha[col]) * Math.min(1, dt * 10);
  }
  const mixRgb = state.phased ? PALETTE_RGB[state.phased] : BG_RGB;
  const mix = state.phased ? DISSOLVE_MIX : 0;
  const k = Math.min(1, dt * 8);
  bgCur.r += (BG_RGB.r + (mixRgb.r - BG_RGB.r) * mix - bgCur.r) * k;
  bgCur.g += (BG_RGB.g + (mixRgb.g - BG_RGB.g) * mix - bgCur.g) * k;
  bgCur.b += (BG_RGB.b + (mixRgb.b - BG_RGB.b) * mix - bgCur.b) * k;
  const tintGoal = state.phased ? 0.10 : 0;
  if (state.phased) tintColor = PALETTE[state.phased];
  tintAlpha += (tintGoal - tintAlpha) * Math.min(1, dt * 8);
  shake = Math.max(0, shake - dt * 40);
  squash = Math.max(0, squash - dt * 2.2);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function draw(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = `rgb(${bgCur.r | 0},${bgCur.g | 0},${bgCur.b | 0})`;
  ctx.fillRect(0, 0, level.width, level.height);

  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // faint grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let r = 1; r < level.rows; r++) {
    for (let c = 1; c < level.cols; c++) {
      ctx.fillRect(c * TILE - 1, r * TILE - 1, 2, 2);
    }
  }

  if (tintAlpha > 0.005) {
    ctx.globalAlpha = tintAlpha;
    const grad = ctx.createRadialGradient(
      level.width / 2, level.height / 2, 100,
      level.width / 2, level.height / 2, level.width * 0.7);
    grad.addColorStop(0, tintColor);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, level.width, level.height);
    ctx.globalAlpha = 1;
  }

  if (layers) {
    ctx.drawImage(layers.neutral, 0, 0);
    for (const col of PHASE_COLORS) {
      const a = phaseAlpha[col];
      if (a > 0.995) {
        ctx.drawImage(layers.colors[col], 0, 0);
      } else {
        ctx.globalAlpha = a;
        ctx.drawImage(layers.colors[col], 0, 0);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = invAlpha[col];
      ctx.drawImage(layers.inverse[col], 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(layers.hazards, 0, 0);
  }

  const t = now / 1000;

  // jets — translucent stream with chevrons drifting in the push direction
  for (const jet of level.jets) {
    drawJet(jet, t);
  }

  // bumpers
  for (const bp of level.bumpers) {
    const pulse = 1 + 0.06 * Math.sin(t * 5 + bp.x * 0.1);
    ctx.strokeStyle = BUMPER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, BUMPER_R * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = BUMPER;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, BUMPER_R * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // portals
  if (level.portalIn) {
    drawPortal(level.portalIn, PORTAL_IN, t * 2.4);
    drawPortal(level.portalOut, PORTAL_OUT, -t * 2.4);
  }

  // targets (gold sparks + colored ghost sparks)
  for (const tg of state.targets) {
    if (tg.collected) continue;
    const active = !tg.color || state.phased === tg.color;
    const color = tg.color ? PALETTE[tg.color] : TARGET;
    const pulse = 1 + 0.14 * Math.sin(t * 4 + tg.x);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    if (!active) {
      ctx.globalAlpha = 0.4;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -t * 18;
    }
    ctx.beginPath();
    ctx.arc(tg.x, tg.y, 9 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (active) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, COLLECT_RADIUS * (0.8 + 0.2 * Math.sin(t * 2.4 + tg.y)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // ball trail
  for (let i = 0; i < trail.length; i++) {
    const k = i / trail.length;
    ctx.globalAlpha = k * 0.25;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, BALL_R * k * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // color wires (the plan)
  for (const w of triggers) {
    const x = (w.c + 0.5) * TILE, y = (w.r + 0.5) * TILE;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = w.fired ? 0.22 : 0.95;
    ctx.strokeStyle = PALETTE[w.color];
    ctx.lineWidth = 3;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.globalAlpha = w.fired ? 0.08 : 0.28;
    ctx.fillStyle = PALETTE[w.color];
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // planning aids: short simulated trajectory + momentum arrow
  if (!running && screen === 'play' && !state.won) {
    drawPlanningAids(t);
  }

  // ball (with bounce squash)
  const b = state.ball;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(1 + squash, 1 - squash);
  const bg = ctx.createRadialGradient(-3, -4, 2, 0, 0, BALL_R + 2);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// While paused, show where the ball is headed: a momentum arrow plus a short
// stretch of *real* simulated path (recomputed live, so toggling a color
// while paused immediately shows the new outcome). Kept short on purpose —
// it aids planning without solving the level for you.
function drawPlanningAids(t) {
  const b = state.ball;

  // ~0.45s of honest future, sampled from a cloned state — wires included,
  // so placing one near the path shows its effect before you run.
  const ghost = cloneState(state);
  const ghostWires = triggers.map(w => ({ ...w }));
  const pts = [];
  for (let i = 0; i < 108; i++) {
    const evs = step(ghost, level, SIM_DT);
    fireWires(ghost, ghostWires, false);
    if (i % 9 === 8) pts.push({ x: ghost.ball.x, y: ghost.ball.y });
    if (evs.some(e => e.type === 'death' || e.type === 'win')) break;
  }
  ctx.fillStyle = '#f8fafc';
  pts.forEach((p, i) => {
    ctx.globalAlpha = 0.4 * (1 - i / pts.length) + 0.08;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 - 1.5 * (i / pts.length), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // momentum arrow (only when the ball is actually moving)
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 30) {
    const len = Math.min(90, 22 + sp * 0.055);
    const nx = b.vx / sp, ny = b.vy / sp;
    const tipX = b.x + nx * len, tipY = b.y + ny * len;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x + nx * (BALL_R + 3), b.y + ny * (BALL_R + 3));
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); // arrowhead
    ctx.moveTo(tipX + nx * 8, tipY + ny * 8);
    ctx.lineTo(tipX - ny * 4.5, tipY + nx * 4.5);
    ctx.lineTo(tipX + ny * 4.5, tipY - nx * 4.5);
    ctx.closePath();
    ctx.fill();
  }

  // soft "time is frozen" ring around the ball
  ctx.strokeStyle = 'rgba(248,250,252,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.lineDashOffset = -t * 14;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_R + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawJet(jet, t) {
  const { x: dx, y: dy } = jet.dir;
  // Stream reaches JET_LEN tiles or until a neutral wall (matches the engine).
  let len = 1;
  for (let i = 1; i < JET_LEN; i++) {
    const ch = charAt(level, jet.r + dy * i, jet.c + dx * i);
    if (ch === '#' || ch === '/' || ch === '\\') break;
    len = i + 1;
  }
  const cx = jet.c * TILE, cy = jet.r * TILE;
  const ex = cx + dx * len * TILE, ey = cy + dy * len * TILE;
  const gx0 = cx + TILE / 2, gy0 = cy + TILE / 2;
  const gx1 = ex + TILE / 2 - dx * TILE, gy1 = ey + TILE / 2 - dy * TILE;
  const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  grad.addColorStop(0, 'rgba(186,230,253,0.22)');
  grad.addColorStop(1, 'rgba(186,230,253,0)');
  ctx.fillStyle = grad;
  const w = TILE - 8;
  if (dx) ctx.fillRect(Math.min(cx, ex) + 4, cy + 4, Math.abs(ex - cx) || w, w);
  else ctx.fillRect(cx + 4, Math.min(cy, ey) + 4, w, Math.abs(ey - cy) || w);

  // drifting chevrons
  ctx.strokeStyle = JET_TINT;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const ang = Math.atan2(dy, dx);
  const span = len * TILE;
  const drift = (t * 120) % TILE;
  for (let i = 0; i < len; i++) {
    const s = (i * TILE + drift) % span;        // distance along the stream
    const px = gx0 + dx * s;
    const py = gy0 + dy * s;
    ctx.globalAlpha = 0.7 * (1 - s / span);     // fade toward the far end
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.beginPath();                            // chevron pointing along the jet
    ctx.moveTo(-7, -7); ctx.lineTo(0, 0); ctx.lineTo(-7, 7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPortal(p, color, spin) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a = spin + i * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, a, a + 1.4);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 7, -spin * 1.6, -spin * 1.6 + 4.4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  draw(now);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- sizing --
let dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = level.width * dpr;
  canvas.height = level.height * dpr;
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ go ----
loadLevel(Math.min(save.unlocked, levels.length - 1), false);
resize();
openMenu();
requestAnimationFrame(frame);
