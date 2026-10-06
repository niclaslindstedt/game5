// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB's page (driven by `scripts/world-preview.mjs`): one seed
// stood up and ridden by the bot — the player's skier and the field's — and
// drawn through the game's own renderer at a list of named moments. It
// exposes `window.__world.shoot(name)`, which rides the run on to that
// moment and draws it; the script photographs the canvas after each.
//
// ONE CONTINUOUS RUN, so the trails the views show are the trails that run
// actually cut. Between two shots the run is fast-forwarded at the display's
// own pace with `present` off (`renderer.ts`): every frame still stamps its
// furrows and flies its spray, it only skips drawing the picture — which in a
// software rasterizer is most of the cost.

import {
  botInput,
  createGame,
  isPisteGrade,
  isRegionId,
  NEUTRAL_INPUT,
  placeRun,
  step,
  type GameState,
  type PisteGrade,
  type RegionId,
  type Thrown,
  planLift,
  ropeAt,
} from "@engine";

import { beastById } from "../game/beast-defs.ts";
import { beastPlanFor, beastPose, freshBeastPose, roundAt } from "../game/beast-plan.ts";
import { birdPlanFor, birdPose, flightShare, freshBirdPose } from "../game/bird-plan.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { markView } from "./mark-view.ts";
import { ringView } from "./ring-view.ts";
import { intoNet, netLens } from "./net-view.ts";
import { signView } from "./sign-view.ts";
import {
  DEFAULT_VIDEO,
  SHADOW_LEVELS,
  TIERS,
  readPicture,
  withPreset,
  type ShadowLevel,
  type Tier,
} from "../game/settings-video.ts";
import { wildGround } from "../game/wild-ground.ts";
import { tunnelNear, tunnelPointAt, tunnelsOf, type WindTunnel } from "../game/wind-tunnel-plan.ts";

type Shot = { name: string; note: string };

declare global {
  interface Window {
    __world?: {
      ready: Promise<void>;
      shoot(name: string): Promise<Shot>;
      frameMs(frames: number): Promise<{ ms: number; calls: number; triangles: number }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
/** The kind of snow country (R21); the alpine unless named. */
const region = isRegionId(params.get("region")) ? (params.get("region") as RegionId) : undefined;
/** The piste grade (R23); the seed's own unless named. */
const grade = isPisteGrade(params.get("grade")) ? (params.get("grade") as PisteGrade) : undefined;
/** The picture, a preset at a time (`settings-video.ts`); HIGH unless named. */
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
/** Picture rows laid over the preset (`?picture=distance:max`, the app's own
 * `readPicture`): how the vista is photographed to the valley floor, past
 * the DISTANCE row's mist wall at HIGH. */
const picture = readPicture(params.get("picture"));
/** The SHADOWS row over the preset, when one is named. */
const shadows = (SHADOW_LEVELS as readonly string[]).includes(params.get("shadows") ?? "")
  ? (params.get("shadows") as ShadowLevel)
  : null;
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const label = document.getElementById("label") as HTMLDivElement;

// The models the game draws (the lab copied them beside the page).
await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: { ...withPreset(DEFAULT_VIDEO, tier), ...picture, ...(shadows ? { shadows } : {}) },
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
/** The run's snow dial (`SNOW_DIAL`) — the ordinary snow unless named. */
const snow = Number(params.get("snow"));
/** A DOWNHILL set over the seed (`?downhill=1`) — its A-nets for the
 * `net-<s>` views. */
const downhill = params.get("downhill") === "1";
/** A FREE RIDE over the seed (`?free=1`) — its lifts' boarding rings, for
 * the `lift-ring` view. */
const free = params.get("free") === "1";
const state: GameState = createGame({
  seed,
  region,
  grade,
  ...(downhill ? { mode: "downhill" as const, rivals: 0 } : {}),
  ...(free ? { mode: "free" as const } : {}),
  ...(Number.isFinite(snow) && snow > 0 ? { snowDepth: snow } : {}),
});
/** The sun's solar hour (`withSky`), the map's own unless named: a low sun
 * is where a shadow shows what it is made of. */
const hour = Number(params.get("hour"));
if (params.get("hour") !== null && Number.isFinite(hour)) renderer.setSky({ hour });

const FRAME = 1 / 60;

/** One display frame: two engine steps, then a frame drawn (or not). */
function frame(present: boolean) {
  for (let i = 0; i < 2; i++) step(state, botInput(state));
  renderer.draw(state, 0, FRAME, present);
}

/** Ride on until `done` holds or the clock reaches `limit`. */
function rideUntil(done: () => boolean, limit: number): boolean {
  while (state.t < limit) {
    if (done()) return true;
    frame(false);
  }
  return done();
}

/** Let the lens settle, then draw. */
function settle(frames: number) {
  for (let i = 0; i < frames; i++) frame(false);
  frame(true);
}

/** Draw the current moment without moving the run on. */
function still() {
  renderer.draw(state, 0, FRAME, true);
}

const level = state.level;

/** THE WIND TUNNELS the views stand at: the map's own, or — on a map whose
 * generator laid none — a STUB PAIR across the valley floor, one each way,
 * so the picture can be judged before the engine lays them. */
const stubbed = tunnelsOf(level).length === 0;
if (stubbed) {
  const base = level.mountain?.base ?? { x: level.size / 2, z: level.size * 0.9 };
  const lane = (id: string, z: number, from: number, to: number): WindTunnel => {
    const points: WindTunnel["points"] = [];
    const length = Math.abs(to - from);
    const way = Math.sign(to - from);
    for (let s = 0; s <= length; s += 4) {
      const x = from + way * s;
      points.push({ x, z, y: level.groundAt(x, z), s, heading: (way * Math.PI) / 2 });
    }
    return { id, points, length: points[points.length - 1].s, width: 9, speed: 28 };
  };
  const z = Math.min(level.size - 60, base.z);
  const tunnels = [
    lane("W1", z - 12, base.x - 180, base.x + 180),
    lane("W2", z + 12, base.x + 180, base.x - 180),
  ];
  const resort = (level.resort ?? {}) as { tunnels?: WindTunnel[] };
  resort.tunnels = tunnels;
  (level as { resort?: unknown }).resort = resort;
}

/** The skier stood `s` m down the first tunnel at `speed` and ridden a
 * third of a second with his hands off — the engine's clock has to move
 * for the picture to take the new stand rather than ease toward it from
 * the last one — then where he is on the lane. */
function inTunnel(
  s: number,
  speed: number,
): { tunnel: WindTunnel; x: number; y: number; z: number; heading: number } | null {
  const tunnel = tunnelsOf(level)[0];
  if (!tunnel) return null;
  const p = tunnelPointAt(tunnel, s);
  placeRun(state, { x: p.x, z: p.z, heading: p.heading, speed });
  for (let i = 0; i < 20; i++) {
    for (let k = 0; k < 2; k++) step(state, NEUTRAL_INPUT);
    renderer.draw(state, 0, FRAME, false);
  }
  const hit = tunnelNear(level, state.skier.x, state.skier.z, 50);
  return { tunnel, ...tunnelPointAt(tunnel, hit?.tunnel === tunnel ? hit.s : s) };
}

/** A note on a tunnel view: whose tunnel it is. */
const tunnelNote = (said: string): string =>
  `${said}${stubbed ? " (STUB tunnels: the generator laid none on this map)" : ""}`;

/** The summit ridge over the mountain, looking down the face. */
function vista(): LensPose {
  const m = level.mountain ?? {
    summit: {
      x: level.size / 2,
      z: level.size * 0.08,
      y: level.groundAt(level.size / 2, level.size * 0.08),
    },
    base: {
      x: level.size / 2,
      z: level.size * 0.92,
      y: level.groundAt(level.size / 2, level.size * 0.92),
    },
    vertical: 600,
  };
  const c = { x: m.base.x, z: m.base.z };
  let best = { x: m.summit.x, z: m.summit.z, y: -Infinity };
  for (let f = -0.25; f <= 0.25; f += 0.01) {
    const x = m.summit.x + level.size * f;
    const z = m.summit.z;
    const y = level.groundAt(x, z);
    if (y > best.y) best = { x, z, y };
  }
  return {
    eye: { x: best.x, y: best.y + 6, z: best.z },
    target: { x: c.x, y: level.groundAt(c.x, c.z) + 10, z: c.z },
    fov: 60,
    roll: 0,
  };
}

/** THE LIFTS: the resort's longest lift (or its first of a kind), seen
 * from `side` m off its line and `back` m down it from the point `share`
 * of the way up, the lens `high` m over the snow, looking up the line at
 * the rope `ahead` m on. */
function liftView(
  kind: "longest" | "gondola" | "chair" | "drag",
  [share, side, back, high, ahead]: readonly number[],
): LensPose | null {
  const all = level.resort?.lifts ?? [];
  const lifts = kind === "longest" ? all : all.filter((l) => l.kind === kind);
  if (lifts.length === 0) return null;
  const lift = lifts.reduce((a, b) =>
    Math.hypot(b.top.x - b.bottom.x, b.top.z - b.bottom.z) >
    Math.hypot(a.top.x - a.bottom.x, a.top.z - a.bottom.z)
      ? b
      : a,
  );
  const plan = planLift(level, lift);
  const u = plan.length * share;
  const ex = lift.bottom.x + plan.dx * (u - back) + plan.dz * side;
  const ez = lift.bottom.z + plan.dz * (u - back) - plan.dx * side;
  const t = Math.min(plan.length, u + ahead);
  const tx = lift.bottom.x + plan.dx * t;
  const tz = lift.bottom.z + plan.dz * t;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + high, z: ez },
    target: { x: tx, y: ropeAt(plan, t) - 3, z: tz },
    fov: 60,
    roll: 0,
  };
}

/** The densest stand of trees, seen from `distance` m out over open snow
 * at head height. */
function forestView(distance = 34): LensPose {
  const trees = level.trees;
  let best = trees[0];
  let most = -1;
  for (let i = 0; i < trees.length; i += 7) {
    const t = trees[i];
    let n = 0;
    for (let j = 0; j < trees.length; j += 3) {
      const u = trees[j];
      if ((u.x - t.x) ** 2 + (u.z - t.z) ** 2 < 400) n++;
    }
    if (n > most) {
      most = n;
      best = t;
    }
  }
  // Back off from the stand toward open snow: the direction with the fewest
  // trees within forty metres.
  let bestDir = 0;
  let fewest = Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const x = best.x + Math.sin(a) * 40;
    const z = best.z + Math.cos(a) * 40;
    let n = 0;
    for (const u of trees) if ((u.x - x) ** 2 + (u.z - z) ** 2 < 400) n++;
    if (n < fewest) {
      fewest = n;
      bestDir = a;
    }
  }
  const ex = best.x + Math.sin(bestDir) * distance;
  const ez = best.z + Math.cos(bestDir) * distance;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 2.2, z: ez },
    target: { x: best.x, y: best.y + 5, z: best.z },
    fov: 62,
    roll: 0,
  };
}

/** Ahead of the player looking back down the furrows he has cut — from
 * whichever side has no tree standing where the lens would be. */
function lookBack(): LensPose {
  const s = state.skier;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const clear = (x: number, z: number) =>
    Math.min(...level.trees.map((t) => Math.hypot(t.x - x, t.z - z) - t.crown));
  let ex = 0;
  let ez = 0;
  let room = -Infinity;
  for (const side of [2.5, -2.5, 5, -5]) {
    const x = s.x + fx * 7 + fz * side;
    const z = s.z + fz * 7 - fx * side;
    const c = clear(x, z);
    if (c > room) {
      room = c;
      ex = x;
      ez = z;
    }
  }
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 2.6, z: ez },
    target: { x: s.x - fx * 8, y: s.y - 0.5, z: s.z - fz * 8 },
    fov: 60,
    roll: 0,
  };
}

/** Down on the furrows just behind the player, from a couple of metres up
 * and off to one side — the trough's walls, its floor and its berm. */
function furrow(): LensPose {
  const s = state.skier;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const ex = s.x - fx * 3 + fz * 2.2;
  const ez = s.z - fz * 3 - fx * 2.2;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 1.8, z: ez },
    target: { x: s.x - fx * 9, y: level.groundAt(s.x - fx * 9, s.z - fz * 9), z: s.z - fz * 9 },
    fov: 55,
    roll: 0,
  };
}

/** A CLIFF (R22): the tallest the map has, from out on its landing looking
 * back up at the face, and from the shelf behind the edge looking over it. */
function cliffView(over: boolean): { pose: LensPose; note: string } | null {
  const cliffs = level.cliffs ?? [];
  if (cliffs.length === 0) return null;
  const c = cliffs.reduce((a, b) => (b.drop > a.drop ? b : a));
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const note = `${c.id}, a ${c.drop.toFixed(1)} m face`;
  if (over) {
    const ex = c.x - fx * 12;
    const ez = c.z - fz * 12;
    const tx = c.x + fx * 40;
    const tz = c.z + fz * 40;
    return {
      pose: {
        eye: { x: ex, y: level.groundAt(ex, ez) + 1.6, z: ez },
        target: { x: tx, y: level.groundAt(tx, tz), z: tz },
        fov: 60,
        roll: 0,
      },
      note: `${note}, from the shelf`,
    };
  }
  // Off to one side, far enough down the landing to take in the whole face.
  const back = c.face + c.landing + 10;
  const ex = c.x + fx * back + fz * c.width * 0.35;
  const ez = c.z + fz * back - fx * c.width * 0.35;
  return {
    pose: {
      eye: { x: ex, y: level.groundAt(ex, ez) + 1.8, z: ez },
      target: { x: c.x, y: c.y - c.drop * 0.4, z: c.z },
      fov: 55,
      roll: 0,
    },
    note: `${note}, from below`,
  };
}

/** THE WILDLIFE: the biggest kind of animal the map holds, from beside it
 * at head height — the herd at its wood's edge, the fox on its meadow. */
function herdView(): { pose: LensPose; note: string } | null {
  const ground = wildGround(level);
  const groups = beastPlanFor(level).groups;
  const g = ["moose", "reindeer", "lynx", "fox", "hare"]
    .map((id) => groups.find((x) => x.species === id))
    .find((x) => x !== undefined);
  if (!g) return null;
  const spec = beastById(g.species);
  const at = beastPose(g, 0, state.t, ground, freshBeastPose());
  const d = Math.max(7, spec.length * 6);
  const a = at.heading + Math.PI / 2;
  const ex = at.x + Math.sin(a) * d;
  const ez = at.z + Math.cos(a) * d;
  return {
    pose: {
      eye: { x: ex, y: ground.snowY(ex, ez) + 1.6, z: ez },
      target: { x: at.x, y: at.y + spec.height * 0.6, z: at.z },
      fov: 50,
      roll: 0,
    },
    note: `${spec.name.toLowerCase()} ×${g.count}, ${d.toFixed(0)} m off`,
  };
}

/** A bird over the wood: the flock most in the air at this moment, from
 * the snow thirty metres off, looking up at its leader. */
function birdView(): { pose: LensPose; note: string } | null {
  const plan = birdPlanFor(level);
  if (plan.flocks.length === 0) return null;
  const up = (f: (typeof plan.flocks)[number]) => flightShare(f, state.t);
  const flock = plan.flocks.reduce((a, b) => (up(b) > up(a) ? b : a));
  const bird = birdPose(flock, 0, state.t, freshBirdPose());
  const ground = wildGround(level);
  const ex = bird.x + 24;
  const ez = bird.z + 12;
  return {
    pose: {
      eye: { x: ex, y: ground.snowY(ex, ez) + 1.8, z: ez },
      target: { x: bird.x, y: bird.y, z: bird.z },
      fov: 40,
      roll: 0,
    },
    note: `${flock.species} ×${flock.count}, ${Math.round(up(flock) * 100)} % in the air`,
  };
}

let trackAt = -1;

/** Ride `seconds` on a fixed input (not the bot's), drawing unseen. */
function ride(input: typeof NEUTRAL_INPUT, seconds: number) {
  const end = state.t + seconds;
  while (state.t < end) {
    for (let i = 0; i < 2; i++) step(state, input);
    renderer.draw(state, 0, FRAME, false);
  }
}

/** An open, gentle stretch of virgin powder near the skier: forty metres
 * of it clear of the loop and the trees, and the heading along it. */
function meadow(): { x: number; z: number; heading: number } | null {
  const s = state.skier;
  const open = (x: number, z: number) =>
    level.packedAt(x, z) < 0.02 &&
    level.trees.every((t) => Math.hypot(t.x - x, t.z - z) > t.crown + 4);
  for (let r = 20; r < 600; r += 10) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      const x = s.x + Math.sin(a) * r;
      const z = s.z + Math.cos(a) * r;
      for (const heading of [a, a + Math.PI / 2, a - Math.PI / 2]) {
        let ok = true;
        for (let d = -6; d <= 40 && ok; d += 4) {
          const px = x + Math.sin(heading) * d;
          const pz = z + Math.cos(heading) * d;
          ok =
            open(px, pz) &&
            Math.abs(level.groundAt(px, pz) - level.groundAt(x, z)) < 0.12 * Math.abs(d) + 0.3;
        }
        if (ok) return { x, z, heading };
      }
    }
  }
  return null;
}

/** How far out the approach views stand from the wood, m. */
const APPROACH = [140, 90, 60, 40];

/** THE RUN FROM THE CHASE BOOM at `t` s down the whole mountain (the view
 * `chase-<t>`, any whole second) — what a shadow that drifts as the skier
 * descends looks like at each height of the face. */
function chaseAt(t: number): string {
  renderer.setCamera("chase", true);
  rideUntil(() => state.t >= t && !state.skier.airborne, t + 30);
  settle(30);
  return `chase at t ${state.t.toFixed(1)} s, y ${state.skier.y.toFixed(0)} m`;
}

/** THE FALL AS A SEQUENCE (the views `fall-<s>`, any time off the skis):
 * the player put into the nearest trunk flat out — the wipeout view's
 * staging — and drawn `t` s after he left his skis from a lens that keeps
 * square to the line he was thrown along, 7 m off his side and a little
 * over him, so a run of them reads as the frames of one fall. The YARD
 * SALE (`yard-<s>`) is the same fall from over it, pulled back to take in
 * him and both skis he left (`lone-skis.ts`). */
let fallSide = 0;
function fallAt(t: number, yard = false): string {
  if (!state.skier.thrown) {
    intoTrunk();
    const pinned = { ...NEUTRAL_INPUT, tuck: 1 };
    const until = state.t + 6;
    while (!state.skier.thrown && state.t < until) {
      for (let i = 0; i < 2; i++) step(state, pinned);
      renderer.draw(state, 0, FRAME, false);
    }
    // Read afresh: the steps above may have thrown him.
    const off = state.skier.thrown as Thrown | null;
    if (!off) return "no wipeout";
    fallSide = off.heading + Math.PI / 2;
  }
  while (state.skier.thrown && state.skier.thrown.t < t - 1e-9) {
    step(state, NEUTRAL_INPUT);
    if (state.tick % 2 === 0) renderer.draw(state, 0, FRAME, false);
  }
  const off = state.skier.thrown;
  if (!off) return "already stood back up";
  if (yard) {
    // The middle of him and the two skis, and the farthest of them from it.
    const at = [{ x: off.x, y: off.y, z: off.z }];
    for (const ski of off.skis) {
      const e = ski.ends;
      at.push({ x: (e[0] + e[3]) / 2, y: (e[1] + e[4]) / 2, z: (e[2] + e[5]) / 2 });
    }
    const mid = {
      x: at.reduce((a, p) => a + p.x, 0) / at.length,
      y: at.reduce((a, p) => a + p.y, 0) / at.length,
      z: at.reduce((a, p) => a + p.z, 0) / at.length,
    };
    const far = Math.max(...at.map((p) => Math.hypot(p.x - mid.x, p.z - mid.z)));
    const back = Math.max(6, far * 1.6 + 3);
    const ex = mid.x + Math.sin(fallSide) * back * 0.6;
    const ez = mid.z + Math.cos(fallSide) * back * 0.6;
    renderer.setOverride({
      eye: { x: ex, y: Math.max(level.groundAt(ex, ez), mid.y) + back * 0.8, z: ez },
      target: mid,
      fov: 50,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    const gap = Math.hypot(at[1].x - at[2].x, at[1].z - at[2].z);
    const lift = at
      .slice(1)
      .map((p) => (p.y - level.groundAt(p.x, p.z)).toFixed(2))
      .join(", ");
    return `${off.cause}, ${off.t.toFixed(2)} s off, skis ${gap.toFixed(1)} m apart, ${lift} m over the snow`;
  }
  const ex = off.x + Math.sin(fallSide) * 7;
  const ez = off.z + Math.cos(fallSide) * 7;
  renderer.setOverride({
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 1.2, off.y + 0.6), z: ez },
    target: { x: off.x, y: off.y, z: off.z },
    fov: 40,
    roll: 0,
  });
  still();
  renderer.setOverride(null);
  return `${off.cause}, ${off.t.toFixed(2)} s off, tumbled ${(off.tumble / (2 * Math.PI)).toFixed(1)} turns`;
}

/** The player stood short of the trunk nearest him and pointed at it at
 * 55 km/h. */
function intoTrunk(): void {
  const s = state.skier;
  let tree = level.trees[0];
  for (const t of level.trees) {
    if (Math.hypot(t.x - s.x, t.z - s.z) < Math.hypot(tree.x - s.x, tree.z - s.z)) tree = t;
  }
  const h = Math.atan2(s.x - tree.x, s.z - tree.z);
  placeRun(state, {
    x: tree.x + Math.sin(h) * 25,
    z: tree.z + Math.cos(h) * 25,
    heading: h + Math.PI,
    speed: 55 / 3.6,
  });
}

/** INTO THE A-NETS AS A SEQUENCE (the views `net-<s>`, on a
 * `?downhill=1` run): `net-view.ts` stands the player and plants the lens;
 * this rides the crash on to `t` s off his skis and draws it. */
function netAt(t: number): string {
  if (!state.skier.thrown) {
    if (!intoNet(state)) return "no downhill on this run (--downhill)";
    const until = state.t + 3;
    while (!state.skier.thrown && state.t < until) {
      for (let i = 0; i < 2; i++) step(state, NEUTRAL_INPUT);
      renderer.draw(state, 0, FRAME, false);
    }
    if (!state.skier.thrown) return "never reached the net";
  }
  while (state.skier.thrown && state.skier.thrown.t < t - 1e-9) {
    step(state, NEUTRAL_INPUT);
    if (state.tick % 2 === 0) renderer.draw(state, 0, FRAME, false);
  }
  const off = state.skier.thrown;
  const lens = netLens(state);
  if (!off || !lens) return "already stood back up";
  renderer.setOverride(lens);
  still();
  renderer.setOverride(null);
  const hooked = off.skis.filter((k) => k.hooked).length;
  return `${off.cause}, ${off.t.toFixed(2)} s off, ${hooked} of 2 skis hooked in the net`;
}

/** How far the lens stands off the skier's origin, m — so a boom pulled in
 * against the slope shows in the note, not only in the picture. */
function standoff(): string {
  const l = renderer.lensPose();
  const s = state.skier;
  return `${Math.hypot(l.x - s.x, l.y - s.y, l.z - s.z).toFixed(1)} m off`;
}

const shots: Record<string, () => string> = {
  spawn() {
    rideUntil(() => state.t >= 1.5, 3);
    renderer.setCamera("chase", true);
    settle(20);
    return `on the start line behind the start gate, t ${state.t.toFixed(1)} s, lens ${standoff()}`;
  },
  powder() {
    // The start line is on the groomer, so the first powder the run skis is its
    // first drift across the track (R17) — ridden to, for as long as it
    // takes, on a map that has one.
    rideUntil(() => state.t >= 10 && state.skier.packed < 0.4, 150);
    renderer.setCamera("chase", true);
    settle(4);
    return `chase in the first drift, t ${state.t.toFixed(1)} s, packed ${state.skier.packed.toFixed(2)}`;
  },
  "powder-high"() {
    renderer.setCamera("high", true);
    settle(30);
    return "the high boom over the furrows";
  },
  lookback() {
    renderer.setOverride(lookBack());
    still();
    renderer.setOverride(null);
    return "ahead of the skier, looking back down his trail";
  },
  furrow() {
    renderer.setOverride(furrow());
    still();
    renderer.setOverride(null);
    return "close on the furrows behind the skier";
  },
  track() {
    renderer.setCamera("chase", true);
    rideUntil(() => state.t > 16 && state.skier.packed > 0.9 && !state.skier.airborne, 120);
    trackAt = state.t;
    settle(60);
    return `on the groomed track, t ${state.t.toFixed(1)} s, lens ${standoff()}`;
  },
  tips() {
    renderer.setCamera("tips", true);
    settle(2);
    return "the tips camera";
  },
  helmet() {
    renderer.setCamera("helmet", true);
    settle(2);
    return "the helmet camera";
  },
  far() {
    renderer.setCamera("far", true);
    settle(30);
    return `the far boom, lens ${standoff()}`;
  },
  jump() {
    renderer.setCamera("chase", true);
    const found = rideUntil(
      () => state.skier.airborne && state.skier.airTime > 0.25,
      trackAt + 240,
    );
    frame(true);
    return found
      ? `in the air ${state.skier.airTime.toFixed(2)} s, t ${state.t.toFixed(1)} s`
      : "no flight found";
  },
  // Late in a flight, falling fast: where a lens that only trailed the skier
  // lost the skier out of the bottom of the frame.
  drop() {
    renderer.setCamera("chase", true);
    const found = rideUntil(() => state.skier.airborne && state.skier.vy < -8, state.t + 150);
    frame(true);
    return found
      ? `falling at ${(-state.skier.vy).toFixed(1)} m/s, in the air ${state.skier.airTime.toFixed(2)} s`
      : "no drop found";
  },
  landing() {
    rideUntil(() => !state.skier.airborne, state.t + 5);
    for (let i = 0; i < 8; i++) frame(false);
    frame(true);
    return "the landing puff";
  },
  vista() {
    renderer.setOverride(vista());
    still();
    renderer.setOverride(null);
    return "over the mountain from the summit ridge";
  },
  ...Object.fromEntries(
    (
      [
        ["lift", "longest", [0.45, 4, 50, 1.7, 80], "under the rope of the longest lift"],
        ["lift-gondola", "gondola", [0.5, 30, 40, 8, 60], "beside the gondola's line"],
        ["lift-drag", "drag", [0.5, 8, 30, 1.7, 40], "beside the drag's line"],
        ["lift-station", "longest", [0, 20, 30, 1.7, 0], "the longest lift's bottom station"],
        ["lift-far", "longest", [0.5, 180, 0, 30, 0], "the longest lift from across the face"],
        ["lift-top", "chair", [1, 16, 28, 2, 0], "a chair's top station from its pad"],
        ["lift-foot", "chair", [0, 16, 16, 1.8, 6], "a chair's load line and corral"],
        ["lift-door", "gondola", [0, 12, 34, 2, -18], "the gondola station's door"],
      ] as const
    ).map(([name, kind, a, said]) => [
      name,
      () => {
        const pose = liftView(kind, a);
        if (!pose) return "no lift on this map";
        renderer.setOverride(pose);
        still();
        renderer.setOverride(null);
        return said;
      },
    ]),
  ),
  "lift-ring"() {
    const pose = ringView(level);
    if (!pose) return "no chair on this map";
    renderer.setOverride(pose);
    still();
    renderer.setOverride(null);
    return free ? "a chair's boarding ring" : "a chair's foot (no ring: not a free ride)";
  },
  forest() {
    renderer.setOverride(forestView());
    still();
    renderer.setOverride(null);
    return "the edge of the densest wood";
  },
  // THE APPROACH: the forest view's own line walked in toward the wood, so
  // what a shadow does as the lens closes on its tree is four pictures side
  // by side — one that appears between two of them was switched on by the
  // lens coming nearer.
  ...Object.fromEntries(
    APPROACH.map((d) => [
      `approach-${d}`,
      () => {
        renderer.setOverride(forestView(d));
        still();
        renderer.setOverride(null);
        return `the densest wood from ${d} m out`;
      },
    ]),
  ),
  orbit() {
    renderer.setCamera("orbit", true);
    settle(30);
    return "the menus' drone";
  },
  wipeout() {
    // THE WIPEOUT (`crash.ts`): the player stood short of the trunk
    // nearest it and ridden into it flat out, drawn a moment after the
    // skier has left his skis — the burst, and him in the air past it.
    intoTrunk();
    renderer.setCamera("chase", true);
    const pinned = { ...NEUTRAL_INPUT, tuck: 1 };
    const on = (done: () => boolean, limit: number) => {
      while (state.t < limit && !done()) {
        for (let i = 0; i < 2; i++) step(state, pinned);
        renderer.draw(state, 0, FRAME, false);
      }
    };
    on(() => (state.skier.thrown?.t ?? 0) > 0.35, state.t + 6);
    still();
    const off = state.skier.thrown;
    return off ? `thrown (${off.cause}), ${off.t.toFixed(2)} s off` : "no wipeout";
  },
  "wipeout-lie"() {
    // ...and where he came to rest, from beside him: the sprawl and the
    // gouge his slide cut.
    const t0 = state.t;
    while (state.skier.thrown && state.skier.thrown.t < 1.7 && state.t < t0 + 3) {
      for (let i = 0; i < 2; i++) step(state, NEUTRAL_INPUT);
      renderer.draw(state, 0, FRAME, false);
    }
    const off = state.skier.thrown;
    if (!off) return "already stood back up";
    // Close enough to read the body: every limb where the ragdoll left it.
    const across = off.heading + Math.PI / 2;
    const ex = off.x + Math.sin(across) * 2.6;
    const ez = off.z + Math.cos(across) * 2.6;
    renderer.setOverride({
      eye: { x: ex, y: level.groundAt(ex, ez) + 1.6, z: ez },
      target: { x: off.x, y: off.y, z: off.z },
      fov: 55,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    return `lying ${off.t.toFixed(1)} s after, tumbled ${(off.tumble / (2 * Math.PI)).toFixed(1)} turns`;
  },
  cliff() {
    const view = cliffView(false);
    if (!view) return "no cliff on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  "cliff-edge"() {
    const view = cliffView(true);
    if (!view) return "no cliff on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  ...Object.fromEntries(
    (["sign", "sign-tree"] as const).map((name) => [
      name,
      () => {
        const view = signView(level, name === "sign-tree");
        if (!view) return "no sign on this map";
        renderer.setOverride(view.pose);
        still();
        renderer.setOverride(null);
        return view.note;
      },
    ]),
  ),
  ...Object.fromEntries(
    (["gate", "hut", "finish"] as const).map((name) => [
      name,
      () => {
        const view = markView(level, name);
        if (!view) return "no course on this map";
        renderer.setOverride(view.pose);
        still();
        renderer.setOverride(null);
        return view.note;
      },
    ]),
  ),
  herd() {
    const view = herdView();
    if (!view) return "no animal on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  birds() {
    const view = birdView();
    if (!view) return "no bird on this map";
    renderer.setOverride(view.pose);
    still();
    renderer.setOverride(null);
    return view.note;
  },
  deep() {
    // THE SKIER DOWN IN THE POWDER (`--snow`): stood in the nearest open
    // meadow off the loop, ridden a few seconds at a crawl and let stop, so
    // it has sunk as far as the snow lets it, and the cloud its stop threw
    // has drifted off — from the chase lens.
    const spot = meadow();
    if (!spot) return "no open meadow on this map";
    placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: 20 / 3.6 });
    ride({ ...NEUTRAL_INPUT, tuck: 0.5 }, 3);
    ride({ ...NEUTRAL_INPUT, brake: 1 }, 3);
    ride(NEUTRAL_INPUT, 8);
    renderer.setCamera("chase", true);
    for (let i = 0; i < 30; i++) renderer.draw(state, 0, FRAME, false);
    still();
    const s = state.skier;
    return `stopped in a meadow, the tail ${s.sinks[s.sinks.length - 1].toFixed(2)} m down, dial ${state.snowDepth}`;
  },
  "deep-side"() {
    // ...and from beside it, low: how far down in the snow it sits.
    const s = state.skier;
    const across = s.heading + Math.PI / 2;
    const ex = s.x + Math.sin(across) * 4.5;
    const ez = s.z + Math.cos(across) * 4.5;
    const ground = wildGround(level);
    renderer.setOverride({
      eye: { x: ex, y: ground.snowY(ex, ez) + 0.9, z: ez },
      target: { x: s.x, y: s.y - 0.2, z: s.z },
      fov: 50,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    return `beside it, the CoG ${(s.y - level.groundAt(s.x, s.z)).toFixed(2)} m over the untouched snow`;
  },
  tunnel() {
    // THE MOUTH: the player stood just inside the first tunnel, seen from
    // behind its fan, up and off to one side — the cowl, the sign, the
    // arches running away down the lane.
    const at = inTunnel(3, 0);
    if (!at) return "no wind tunnel on this map";
    const back = 24;
    const ex = at.x - Math.sin(at.heading) * back + Math.cos(at.heading) * 5;
    const ez = at.z - Math.cos(at.heading) * back - Math.sin(at.heading) * 5;
    const far = tunnelPointAt(at.tunnel, 30);
    renderer.setOverride({
      eye: { x: ex, y: level.groundAt(ex, ez) + 4.5, z: ez },
      target: { x: far.x, y: far.y + 2.5, z: far.z },
      fov: 55,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    return tunnelNote(`the mouth of ${at.tunnel.id}, ${at.tunnel.speed} m/s`);
  },
  "tunnel-side"() {
    // THE LANE FROM BESIDE IT, the player in it, well down it — clear of
    // the powder the last view's stand may have raised.
    const at = inTunnel(400, 0);
    if (!at) return "no wind tunnel on this map";
    const side = 26;
    const ex = at.x + Math.cos(at.heading) * side - Math.sin(at.heading) * 6;
    const ez = at.z - Math.sin(at.heading) * side - Math.cos(at.heading) * 6;
    renderer.setOverride({
      eye: { x: ex, y: level.groundAt(ex, ez) + 3, z: ez },
      target: { x: at.x, y: at.y + 2, z: at.z },
      fov: 60,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    return tunnelNote(`beside ${at.tunnel.id}, from the right of the way it blows`);
  },
  "tunnel-inside"() {
    // DOWN THE LANE on the chase boom, the streaks overtaking him.
    const at = inTunnel(80, 0);
    if (!at) return "no wind tunnel on this map";
    renderer.setCamera("chase", true);
    for (let i = 0; i < 30; i++) renderer.draw(state, 0, FRAME, false);
    still();
    return tunnelNote(`in ${at.tunnel.id} on the chase boom`);
  },
  prints() {
    // Last night's prints across a meadow: the player stood fifty metres
    // off a fox's round (outside its fright), so the fine trail window is
    // over it, and the lens down on the line.
    const groups = beastPlanFor(level).groups;
    const g =
      groups.find((x) => x.species === "fox") ??
      groups.find((x) => x.species === "reindeer") ??
      groups[0];
    if (!g) return "no animal on this map";
    const p = { x: 0, z: 0, fx: 0, fz: 1 };
    roundAt(g.round, g.round.length * 0.25, p);
    placeRun(state, { x: p.x + p.fz * 50, z: p.z - p.fx * 50, heading: 0, speed: 0 });
    for (let i = 0; i < 6; i++) renderer.draw(state, 0, FRAME, false);
    const ground = wildGround(level);
    const ex = p.x - p.fx * 1.5 + p.fz * 2;
    const ez = p.z - p.fz * 1.5 - p.fx * 2;
    renderer.setOverride({
      eye: { x: ex, y: ground.snowY(ex, ez) + 2.4, z: ez },
      target: { x: p.x + p.fx * 2, y: ground.snowY(p.x, p.z), z: p.z + p.fz * 2 },
      fov: 55,
      roll: 0,
    });
    still();
    renderer.setOverride(null);
    return `${beastById(g.species).name.toLowerCase()}'s prints on its round`;
  },
};

window.__world = {
  ready: renderer.load(state),
  async shoot(name) {
    const chase = /^chase-(\d+)$/.exec(name);
    const fall = /^(fall|yard)-(\d+(?:\.\d+)?)$/.exec(name);
    const net = /^net-(\d+(?:\.\d+)?)$/.exec(name);
    const run = chase
      ? () => chaseAt(Number(chase[1]))
      : fall
        ? () => fallAt(Number(fall[2]), fall[1] === "yard")
        : net
          ? () => netAt(Number(net[1]))
          : shots[name];
    if (!run) throw new Error(`no view "${name}" — known: ${Object.keys(shots).join(", ")}`);
    const note = run();
    label.textContent = `${name.toUpperCase()} · seed ${seed}${region ? ` · ${region}` : ""} · ${note}`;
    return { name, note };
  },
  async frameMs(frames) {
    renderer.setCamera("chase", true);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) frame(true);
    renderer.gl.getContext().finish();
    const ms = (performance.now() - t0) / frames;
    const info = renderer.info();
    return { ms, calls: info.calls, triangles: info.triangles };
  },
};
