# HUEBALL

*A chromatic gravity puzzle.* Pure JavaScript, zero dependencies, runs anywhere — including GitHub Pages.

**Play it:** open `index.html` via any static server, or enable GitHub Pages for this repo
(Settings → Pages → Deploy from branch → `main`, root) and visit
`https://<user>.github.io/ball-game/`.

## How to play

A ball falls under gravity through a world built from four colors. Press a color
(**1 2 3 4**, **A S D F**, **J K L ;**, or tap the buttons) to **phase every block of
that color out of existence** — the ball drops straight through them. Press it again to
bring it back. Only one color can be phased at a time: picking a new color snaps the
previous one back, even if the ball is counting on it.

Guide the ball to every **spark ◎** to clear the level. Avoid spikes, don't fall
off the world, and watch for colors that do two jobs at once. Later levels add
**bumpers** that launch the ball, one-way **portals**, and colored **ghost sparks**
that only exist while their color is phased. **R** (or Space) resets the ball,
**Esc** opens the level select.

Each level has a **par** — clear it within par switches and without dying for ★★★.
Progress and stars are saved locally.

## The rebuild

This started life as a Corona SDK (Lua) prototype, preserved in the repo's original
files (`main.lua`, `play.lua`, `maps/`, …).
The core idea is unchanged — phase colors to steer a falling ball — but everything else
was rebuilt:

- **Pure JS + canvas**, ES modules, no build step, no dependencies.
- **Custom 2D physics**: circle-vs-tile collision with restitution, rolling friction,
  45° ramps that act as speed-preserving redirectors, and a forgiving target magnet.
- A color that re-solidifies *around* the ball stays intangible until the ball rolls
  clear — it never crushes you.
- **Juice**: synthesized WebAudio sound, particles, squash-and-stretch, screen shake,
  phase tinting, confetti.
- **Structure**: menu, level select, star ratings, local saves, mobile touch controls.

## Level format

The old game converted Inkscape SVGs to Lua polygon soup via a Python script. Levels are
now plain ASCII art in [`src/levels.js`](src/levels.js) — a 24×16 grid of 40px tiles:

```
.   empty                 #   solid neutral block
/   ramp rising right     \   ramp falling right
m y g c                   phaseable colored blocks
x   spikes (resets the ball)
o   bumper (launches the ball)
@   portal in             &   portal out (one-way, one pair max)
b   ball spawn            t   target spark
M Y G C                   ghost sparks — collectible only while that color is phased
```

Add a level by appending `{ name, hint, par, grid }` to `LEVELS`. The grid is validated
at load — and you do **not** write a solution. The solver finds one for you.

## The solver

`src/solver.js` drives the real engine at the real timestep and searches color-press
sequences with iterative deepening, so the first win it finds uses the **minimum** number
of presses — an honest `par`. `node test/auto-solve.mjs` runs it over every level and:

- proves each is winnable (no hand-written solution required), and
- fails the build if a declared `par` is **unachievable** (lower than the true optimum),
  warning when a `par` is merely loose.

This is what makes new content cheap: design a grid, run the solver, ship. It also grades
difficulty (press count) and is the verification half of a future procedural generator —
emit layouts, keep the ones the solver finds solvable and interesting.

## Development

```sh
python3 -m http.server          # then open http://localhost:8000
node test/auto-solve.mjs        # verify every level + check pars
node test/auto-solve.mjs twins  # solve just levels matching a name
```

| File | What it is |
| --- | --- |
| `src/engine.js` | Pure simulation core (physics, phasing, win/death). DOM-free, shared with tooling. |
| `src/levels.js` | Level data (ASCII grids). |
| `src/game.js` | Rendering, input, screens, particles, saves. |
| `src/audio.js` | Tiny WebAudio synth — no sound assets. |
| `src/solver.js` | Search solver: proves solvability, computes minimum-press par. |
| `test/auto-solve.mjs` | Runs the solver over every level as the verification gate. |
