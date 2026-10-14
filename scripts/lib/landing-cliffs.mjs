// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLIFF SWEEP (`make landing ARGS=--cliffs`) — a skier skied off every
// cliff of the free ride's mountains, tucked, at three speeds, and the one
// question asked of the fall: does anything but the snow below push him UP
// on the way down? A body in the air only falls — the air's drag on a
// falling body is a fraction of a g and never turns the fall round — so
// any rise in his vertical speed while he is well over the snow is
// something meeting him that is not there: the legs standing on the face
// he is falling past, a hull point caught on its lip.
//
// Every drop is a row (the seed, the cliff, its drop, the speed, the AIR
// KICK — the upward speed he gained in the air, m/s — and how high over
// the snow it found him), and the worst is drawn as a strobe from the side
// (`previews/landing-cliff.png`): the ground along his line, his centre of
// gravity every 1/30 s and his skis under it, the steps the kick lifted him
// in red.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

/** How far over the snow under him a rise counts as one in the air, m —
 * clear of a landing's own push back up off the legs, the snow under
 * the tips a metre over the snow under him on a short drop's apron. */
const CLEAR = 2;
/** Speeds he leaves the edge at, km/h, and the run-up behind it, m. */
const SPEEDS = [30, 50, 70];
const RUN_UP = 6;
const SECONDS = 4;

const INK = {
  bg: [18, 22, 30],
  grid: [44, 52, 66],
  dim: [130, 140, 156],
  text: [226, 232, 240],
  ground: [200, 214, 232],
  body: [120, 190, 255],
  ski: [250, 196, 90],
  kick: [255, 80, 80],
};

/** Ski off one cliff at `kmh`, every step kept. */
function dropOff(E, seed, level, spec, cliff, kmh) {
  const state = E.createGame({
    level,
    mode: "free",
    rivals: 0,
    countdown: 0,
    crowd: 0,
    quiet: true,
    spec,
  });
  const fx = Math.sin(cliff.heading);
  const fz = Math.cos(cliff.heading);
  E.placeRun(state, {
    x: cliff.x - fx * RUN_UP,
    z: cliff.z - fz * RUN_UP,
    heading: cliff.heading,
    speed: kmh / 3.6,
  });
  const c = state.skier;
  const frames = [];
  const input = { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false };
  for (let i = 0; i <= SECONDS * E.TUNING.physicsHz; i++) {
    if (i > 0) E.step(state, input);
    if (c.thrown) break;
    const along = (c.x - cliff.x) * fx + (c.z - cliff.z) * fz;
    frames.push({
      along,
      y: c.y,
      vy: c.vy,
      over: c.y - level.groundAt(c.x, c.z),
      skis: c.contacts.map((k) => ({
        along: (k.x - cliff.x) * fx + (k.z - cliff.z) * fz,
        y: k.y,
        touching: k.touching,
      })),
    });
  }
  // THE AIR KICK: every step his vertical speed rose while he was clear of
  // the snow, summed.
  let kick = 0;
  let at = 0;
  for (let i = 1; i < frames.length; i++) {
    const rise = frames[i].vy - frames[i - 1].vy;
    if (rise > 0 && frames[i].over > CLEAR) {
      kick += rise;
      at = Math.max(at, frames[i].over);
      frames[i].kicked = true;
    }
  }
  const ground = [];
  for (let s = -RUN_UP - 2; s <= 30; s += 0.25) {
    ground.push({
      along: s,
      y: level.groundAt(cliff.x + fx * s, cliff.z + fz * s),
    });
  }
  return { seed, cliff, kmh, frames, ground, kick, at };
}

/** The strobe of one drop from the side, as a PNG. */
function drawDrop(run, title) {
  const W = 1200;
  const H = 700;
  const d = createDrawing(W, H, INK.bg);
  d.text(title, 16, 12, INK.text, 2);
  d.text(
    `seed ${run.seed}  ${run.cliff.id}  drop ${run.cliff.drop.toFixed(1)} m  ${run.kmh} km/h  air kick ${run.kick.toFixed(2)} m/s`,
    16,
    40,
    INK.dim,
  );
  const xs = [...run.ground.map((g) => g.along), ...run.frames.map((f) => f.along)];
  const ys = [...run.ground.map((g) => g.y), ...run.frames.map((f) => f.y)];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys) - 1;
  const y1 = Math.max(...ys) + 2;
  // One scale both ways, so the face stands as steep as it is.
  const s = Math.min((W - 60) / (x1 - x0), (H - 110) / (y1 - y0));
  const X = (a) => 30 + (a - x0) * s;
  const Y = (y) => H - 30 - (y - y0) * s;
  for (let y = Math.ceil(y0); y <= y1; y += 5) d.line(30, Y(y), W - 30, Y(y), INK.grid);
  d.polyline(
    run.ground.filter((g) => g.along >= x0 && g.along <= x1).map((g) => [X(g.along), Y(g.y)]),
    INK.ground,
  );
  for (let i = 0; i < run.frames.length; i += 4) {
    const f = run.frames[i];
    const hot = run.frames.slice(i, i + 4).some((g) => g.kicked);
    const touching = f.skis.filter((k) => k.touching);
    for (const k of touching)
      d.line(X(f.along), Y(f.y), X(k.along), Y(k.y), hot ? INK.kick : INK.ski);
    d.disk(X(f.along), Y(f.y), 3, hot ? INK.kick : INK.body);
  }
  return d.toPng();
}

/** The sweep over seeds 1..`args.seeds`, the table and the worst drawn. */
export function cliffSweep(E, args, root, spec) {
  const runs = [];
  for (let seed = 1; seed <= args.seeds; seed++) {
    const { level } = E.createGame({
      seed,
      mode: "free",
      rivals: 0,
      countdown: 0,
      crowd: 0,
      quiet: true,
    });
    for (const cliff of level.cliffs ?? []) {
      for (const kmh of SPEEDS) runs.push(dropOff(E, seed, level, spec, cliff, kmh));
    }
  }
  console.log(" seed  cliff   drop  km/h   kick m/s   over m");
  for (const r of runs) {
    if (!args.list && r.kick <= 0.05) continue;
    console.log(
      `${String(r.seed).padStart(5)}  ${r.cliff.id.padEnd(5)} ${r.cliff.drop.toFixed(1).padStart(6)} ${String(r.kmh).padStart(5)} ${r.kick.toFixed(2).padStart(10)} ${r.at.toFixed(1).padStart(8)}`,
    );
  }
  const kicked = runs.filter((r) => r.kick > 0.05);
  console.log(
    `\n${runs.length} drops off ${new Set(runs.map((r) => `${r.seed}:${r.cliff.id}`)).size} cliffs · ${kicked.length} pushed up in the air · worst ${Math.max(0, ...runs.map((r) => r.kick)).toFixed(2)} m/s`,
  );
  if (runs.length === 0) return;
  const worst = runs.reduce((a, b) => (b.kick > a.kick ? b : a));
  const shown = args.cliff
    ? (runs.find((r) => `${r.seed}:${r.cliff.id}:${r.kmh}` === args.cliff) ?? worst)
    : worst;
  const dir = join(root, "previews");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "landing-cliff.png");
  writeFileSync(file, drawDrop(shown, "THE CLIFF SWEEP - a drop seen from the side"));
  console.log(`wrote ${file}`);
}
