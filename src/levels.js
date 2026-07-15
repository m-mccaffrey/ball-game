// levels.js — Hueball level data.
//
// Levels are 24x16 ASCII grids (each tile is 40px → 960x640):
//   .  empty            #  solid neutral block
//   /  ramp rising right    \  ramp falling right
//   m y g c  phaseable colored blocks (vanish while their color is phased)
//   1 2 3 4  inverse blocks (appear only while m/y/g/c is phased)
//   ^ < >    jets — push the ball up / left / right
//   x  spikes (a penalty stroke; back to the tee)
//   o  bumper (launches the ball)
//   @  portal in    &  portal out (one-way, one pair max)
//   b  ball spawn   t  target spark
//   M Y G C  ghost sparks — collectible only while that color is phased
//
// `par` is the stroke count of the best line (color presses; penalties count
// too when you take them). Every level is verified by node test/auto-solve.mjs.

export const LEVELS = [
  // --- Training: one level per mechanic. -------------------------------
  {
    name: 'Layer Cake',
    hint: 'Place a wire of each color along the drop, then press run.',
    par: 4,
    grid: [
      '........................',
      '...........b............',
      '........................',
      'mmmmmmmmmmmmmmmmmmmmmmmm',
      '........................',
      'yyyyyyyyyyyyyyyyyyyyyyyy',
      '........................',
      'cccccccccccccccccccccccc',
      '........................',
      'gggggggggggggggggggggggg',
      '........................',
      '........................',
      '........................',
      '........................',
      '...........t............',
      '########################',
    ],
  },
  {
    name: 'Wrecking Roll',
    hint: 'Momentum is your friend.',
    par: 1,
    grid: [
      '........................',
      '.....b..................',
      '........................',
      '........................',
      '...ccccc................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '.....\\..................',
      '.....#\\.................',
      '.....##\\.............t..',
      '.....###\\........../####',
      '########################',
    ],
  },
  {
    name: 'Gatekeeper',
    hint: 'One color, two jobs — you will need magenta twice.',
    par: 3,
    grid: [
      '........................',
      '....b...................',
      '........................',
      '........................',
      '..mmmmmm................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '....\\...........m.......',
      '....#\\..........m.......',
      '....##\\.........m.......',
      '....###\\........m.....t.',
      '###########mm###########',
    ],
  },
  {
    name: 'Now You See Me',
    hint: 'Ghost sparks only exist while their color is phased.',
    par: 3,
    grid: [
      '........................',
      '...........b............',
      '........................',
      '...........M............',
      '........mmmmmmmm........',
      '........................',
      '...........Y............',
      '........yyyyyyyy........',
      '........................',
      '...........C............',
      '........cccccccc........',
      '........................',
      '........................',
      '........................',
      '...........t............',
      '########################',
    ],
  },
  {
    name: 'Wormhole',
    hint: 'Portals: what falls into @ comes out of the ring.',
    par: 1,
    grid: [
      '........................',
      '..b.....................',
      '........................',
      '....................&...',
      'mmmm....................',
      '........................',
      '........................',
      '....................t...',
      '........................',
      '........................',
      '....................t...',
      '........................',
      '........................',
      '..@.....................',
      '........................',
      '########################',
    ],
  },
  {
    name: 'Phantom Bridge',
    hint: 'Hatched phantom blocks are solid only while their color is phased.',
    par: 1,
    grid: [
      '........................',
      '.b......................',
      '.\\......................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '..................t.....',
      '#########1111###########',
      '#########xxxx###########',
      '########################',
      '########################',
      '########################',
    ],
  },

  // --- The Course: routing puzzles. -------------------------------------
  // A recirculation portal returns the ball to the tee, so mistakes cost
  // strokes, not progress. (Multi-lap levels that reuse the same path are on
  // hold: under plan-then-run, wires fire by position, so repeat presses at
  // one spot need laps that physically branch — a future redesign.)
  {
    name: 'Skeleton Key',
    hint: 'One color can open every door on the way down — if you let it.',
    par: 2,
    grid: [
      '........................',
      '...........b............',
      '...........&............',
      '..........yyy...........',
      '........#..\\...t....#...',
      '........#####gg##mm##...',
      '............#..##..#....',
      '............#..##..#....',
      '............#..##..#....',
      '............#..##..#....',
      '............#..##t.#....',
      '............#..##..#....',
      '............#\\.##\\.#....',
      '..............\\...\\.....',
      '...................t.@..',
      '########################',
    ],
  },
];
