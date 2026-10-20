// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY LAB's page (`scripts/army-preview.mjs`): the army AS DRAWN — the
// military helicopter (`army-heli-view.ts`, its model `make models
// KIND=army`) and the winter infantry (`soldier-shapes.ts`) — stood on a
// real mountain and photographed through the game's OWN renderer, the
// light, the haze and the shadows the game's:
//
//   * HELI — `turntable` (eight bearings round the machine landed on the
//     snow), `close` (the door gun and its gunner, the doorway, the nose,
//     the tail rotor, the skids, the fast-rope bar), `doors` (both doors
//     open, the gunners on their guns, a section sat in the doorways and a
//     man on the rope), `squad` (the machine landed and its section out on
//     the snow round it);
//   * FLIGHT — the machine in the air over the slope, the rotors turning,
//     the doors open and the gunner on his gun: `flight-day` and
//     `flight-dusk` (under `?dusk=`'s hour, the lights on);
//   * HUNT — the army IN THE GAME: a hunted free ride stood up and run on
//     the real engine (`army.ts` flying, `gunfire.ts` firing) with the bot
//     skiing — `hunt-2` (two stars, warning fire), `hunt-4` (four, two
//     machines, aimed fire) — and `hunt-heli`, the man in the stolen air
//     ambulance flown away corner to corner by the bot's hands, chased; each
//     drawn as the run draws it (`army-air-view.ts`), from behind him at
//     the machine after him, from beside the machine's door, and wide;
//   * GROUND — the soldiers IN THE GAME (`army-ground.ts`, drawn by
//     `army-ground-view.ts`): a hunted free ride run on the real engine,
//     him stood still where it found him, stepped to a moment and
//     photographed — `ground-land` (a machine set down, its squad spilling
//     out of the doors and kneeling), `ground-file` (the squad skiing in
//     file after him), `ground-fire` (a soldier knelt on his skis firing),
//     `ground-lift` (a lift's squad on a chair, riding up), `ground-arrest`
//     (SAFE FOR WORK: him face down, held, the squad round him);
//   * SOLDIERS — every pose of every figure (`SOLDIER_POSES`) from the
//     front, the side and behind at the chase camera's range, a row a pose:
//     `ski`, `foot`, `rocket`, and `gunner` (sat at his door gun in the
//     machine); `lods` (the three cuts side by side, near and far).
//
// Every sheet but the hunt stands its pieces itself (`DevRenderer.stage`). It exposes `window.__army.sheet(group, views)`,
// which shoots one group's views, lays them out as a contact sheet and
// hands back every frame.

import * as THREE from "three";
import {
  NEUTRAL_INPUT,
  armyHelis,
  armySleds,
  armyTroops,
  arrestedOf,
  botInput,
  liftPlans,
  createGame,
  generateLevel,
  pilotInput,
  placeRun,
  quarryOf,
  setWanted,
  step,
  trackPointAt,
  withSky,
  type GameState,
  type RegionId,
  type WeatherKind,
} from "@engine";

import {
  benchSeats,
  doorSeats,
  gunnerSeat,
  onRope,
  ropeHook,
  type Seat,
  type Side,
} from "../game/army-heli-plan.ts";
import {
  createArmyHeliView,
  restingPose,
  type ArmyHeliPose,
  type ArmyHeliView,
} from "../game/army-heli-view.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import type { CrowdLod } from "../game/crowd-shapes.ts";
import { hazeMaterial } from "../game/haze.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import {
  GUNNER_AIMS,
  gunnerPosed,
  ROPE_AHEAD,
  SOLDIER_POSES,
  type SoldierKind,
  type SoldierPoseName,
} from "../game/soldier-pose.ts";
import { SoldierView, soldierMaterial, soldierTriangles } from "../game/soldier-shapes.ts";
import { castInLight } from "../game/terrain-shade.ts";

type Frame = { view: string; label: string; caption: string; png: string };

const GROUPS = {
  heli: ["turntable", "close", "doors", "squad"],
  flight: ["flight-day", "flight-dusk"],
  hunt: ["hunt-2", "hunt-4", "hunt-heli"],
  ground: ["ground-land", "ground-file", "ground-fire", "ground-lift", "ground-arrest"],
  soldiers: ["ski", "foot", "rocket", "gunner", "lods"],
  sleds: ["sled-chase", "sled-halt", "sled-arrest"],
} as const;

declare global {
  interface Window {
    __army?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      cols: Record<string, number>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = (params.get("region") || undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const scale = Number(params.get("scale") ?? 0.5);
const hour = params.get("hour") !== null ? Number(params.get("hour")) : 13;
const duskHour = Number(params.get("dusk") ?? 17.2);
const weather = (params.get("weather") || "clear") as WeatherKind;
const smock = params.get("smock") === "whites" ? "whites" : "camo";
/** Only these poses on the soldiers' sheets (every one when left out). */
const only = (params.get("poses") ?? "").split(",").filter(Boolean);
const shown = (name: string): boolean => !only.length || only.includes(name);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const gl = renderer.gl;

const level = withSky(generateLevel(seed, { region }), { weather, hour });
const STILL = 1e-4;

/** THE FLATTEST PLACE on the piste between a third and nine tenths of the
 * way down — where the lab stands everything. */
const spot = (() => {
  let best = trackPointAt(level, level.track.length * 0.5);
  let flat = -1;
  for (let k = 0.3; k <= 0.9; k += 0.01) {
    const p = trackPointAt(level, level.track.length * k);
    const n = { x: 0, y: 0, z: 0 };
    level.normalAt(p.x, p.z, n);
    if (n.y > flat) {
      flat = n.y;
      best = p;
    }
  }
  return best;
})();
const H = spot.heading;
const fwd = { x: Math.sin(H), z: Math.cos(H) };
const right = { x: Math.cos(H), z: -Math.sin(H) };
const ground = (x: number, z: number): number => level.groundAt(x, z);

/** A free ride with the player stood well down the piste, out of the way. */
function ride(): GameState {
  const state = createGame({ level, seed, region, mode: "free", crowd: 0, quiet: true });
  const away = trackPointAt(level, Math.min(level.track.length, spot.s + 140));
  placeRun(state, { x: away.x, z: away.z, heading: away.heading, speed: 0 });
  return state;
}
const state = ride();

// ── what the lab stands ──────────────────────────────────────────────────
const root = new THREE.Group();
root.name = "army-lab";
renderer.stage(root);
const haze = renderer.labHaze();
const material = soldierMaterial(haze);

const heli: ArmyHeliView = createArmyHeliView(haze);
root.add(heli.group);

/** A soldier of a figure at a cut, made once and reused. */
const made = new Map<string, SoldierView>();
function soldier(kind: SoldierKind, lod: CrowdLod = "near", k = 0): SoldierView {
  const key = `${kind}:${lod}:${k}`;
  let s = made.get(key);
  if (!s) {
    s = new SoldierView(kind, lod, material, smock);
    castInLight(s.mesh, haze);
    made.set(key, s);
  }
  return s;
}

/** A FAST ROPE hung from the right bar's hook, 20 m of it (the lab's own;
 * nothing in the game drops one yet). */
const rope = (() => {
  const hook = ropeHook(1);
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 20, 6),
    hazeMaterial(new THREE.MeshLambertMaterial({ color: 0x2c2a26 }), haze, "army-rope"),
  );
  m.position.set(hook.x, hook.y - 10, hook.z);
  return m;
})();

/** Everything off but what a view stands. */
function clear(): void {
  rope.visible = false;
  heli.group.visible = false;
  for (const s of made.values()) {
    s.mesh.visible = false;
    s.mesh.removeFromParent();
  }
}

/** Stand a soldier on the snow at `a` m ahead and `b` m right of the spot,
 * turned `turn` rad from the piste's heading. */
function standOnSnow(s: SoldierView, a: number, b: number, turn = 0): THREE.Vector3 {
  const x = spot.x + fwd.x * a + right.x * b;
  const z = spot.z + fwd.z * a + right.z * b;
  s.mesh.position.set(x, ground(x, z), z);
  s.mesh.rotation.set(0, H + turn, 0);
  s.mesh.visible = true;
  root.add(s.mesh);
  return s.mesh.position;
}

/** Sit a soldier in the machine at a seat (body frame). */
function seat(s: SoldierView, at: Seat, y: number): void {
  s.mesh.position.set(at.x, y, at.z);
  s.mesh.rotation.set(0, at.facing, 0);
  s.mesh.visible = true;
  heli.body.add(s.mesh);
}

/** The machine landed at the spot, `a` m ahead and `b` right, turned
 * `turn` from the piste. */
function landed(a = 0, b = 0, turn = Math.PI / 2, open = 0): ArmyHeliPose {
  const x = spot.x + fwd.x * a + right.x * b;
  const z = spot.z + fwd.z * a + right.z * b;
  const p = restingPose(x, ground(x, z), z, H + turn);
  p.doors = { r: open, l: open };
  return p;
}

/** Draw the machine in a pose, its eye settled over a few frames. */
function poseHeli(p: ArmyHeliPose, frames = 1): void {
  heli.group.visible = true;
  for (let i = 0; i < frames; i++) heli.pose(p, 1 / 60);
}

/** A point of the machine's body frame in the world. */
const onHeli = (x: number, y: number, z: number): THREE.Vector3 => heli.toWorld({ x, y, z });

// ── lenses ───────────────────────────────────────────────────────────────

/** A lens at `eye` looking at `at`. */
const look = (eye: THREE.Vector3, at: THREE.Vector3, fov = 45): LensPose => ({
  eye: { x: eye.x, y: Math.max(ground(eye.x, eye.z) + 0.3, eye.y), z: eye.z },
  target: { x: at.x, y: at.y, z: at.z },
  fov,
  roll: 0,
});

/** A lens round `c`, `bearing` rad from the way `facing` points
 * (0 in front, π behind), `d` m off and `up` m over `c`. */
function round(
  c: THREE.Vector3,
  facing: number,
  bearing: number,
  d: number,
  up: number,
  fov = 45,
): LensPose {
  const h = facing + bearing;
  const eye = new THREE.Vector3(c.x + Math.sin(h) * d, c.y + up, c.z + Math.cos(h) * d);
  return look(eye, c, fov);
}

// ── shooting ─────────────────────────────────────────────────────────────

let frames: Frame[] = [];
let view = "";
let sky = "";

function shoot(label: string, pose: LensPose, note = "", of: GameState = state): void {
  renderer.setOverride(pose);
  renderer.draw(of, 1, STILL, true);
  const info = gl.info;
  info.autoReset = false;
  info.reset();
  const t0 = performance.now();
  renderer.draw(of, 1, STILL, true);
  gl.getContext().finish();
  const ms = performance.now() - t0;
  const calls = info.render.calls;
  const tris = info.render.triangles;
  info.autoReset = true;
  renderer.setOverride(null);
  frames.push({
    view,
    label,
    caption:
      `${view} ${label}${note ? ` — ${note}` : ""} — ${sky}\n` +
      `${ms.toFixed(1)} ms · ${calls} draws · ${(tris / 1000).toFixed(0)}k tris`,
    png: canvas.toDataURL("image/png"),
  });
}

async function under(h: number): Promise<void> {
  renderer.setSky({ hour: h, weather });
  await renderer.shadeSettled();
  sky = `h${h} ${weather}`;
}

// ── the helicopter ───────────────────────────────────────────────────────

function turntable(): void {
  clear();
  const p = landed();
  poseHeli(p);
  const c = onHeli(0, 1.6, -1.5);
  const names = [
    "nose",
    "nose right",
    "right",
    "tail right",
    "tail",
    "tail left",
    "left",
    "nose left",
  ];
  for (let i = 0; i < 8; i++) {
    shoot(names[i], round(c, H + Math.PI / 2, (i * Math.PI) / 4, 13, 2.2, 50));
  }
}

/** The right gunner sat at his gun, at an aim. */
function gunnerAt(side: Side, yaw: number, pitch: number): SoldierView {
  const s = soldier("gunner", "near", side === 1 ? 0 : 1);
  seat(s, gunnerSeat(side), 0.7);
  s.posed(gunnerPosed(side, yaw, pitch));
  return s;
}

function close(): void {
  clear();
  const p = landed(0, 0, Math.PI / 2, 1);
  p.guns.r = { yaw: 0.25, pitch: -0.15 };
  poseHeli(p);
  gunnerAt(1, 0.25, -0.15);
  const out = (x: number, y: number, z: number) => onHeli(x, y, z);
  shoot("door gun", look(out(4.2, 2.3, 2.8), out(1.3, 1.5, 0.9), 45));
  shoot("doorway", look(out(5.5, 1.9, 0.2), out(1.0, 1.4, 0.3), 45));
  shoot("nose", look(out(2.6, 1.8, 8.5), out(0, 1.4, 2.5), 40));
  shoot("tail rotor", look(out(4.5, 3.2, -10.5), out(0.3, 2.6, -7.4), 40));
  shoot("skids", look(out(3.5, 0.5, 4.2), out(1.2, 0.3, 0.2), 45));
  shoot("rope bar", look(out(3.6, 3.5, 2.4), out(2.0, 2.5, 0.4), 45));
}

function doors(): void {
  clear();
  const p = landed(0, 0, Math.PI / 2, 1);
  p.guns.r = GUNNER_AIMS.fireDown;
  p.guns.l = { yaw: 0.4, pitch: -0.3 };
  poseHeli(p);
  gunnerAt(1, GUNNER_AIMS.fireDown.yaw, GUNNER_AIMS.fireDown.pitch);
  gunnerAt(-1, 0.4, -0.3);
  // A section: two in each doorway, the rest on the bench.
  let k = 0;
  for (const side of [1, -1] as const) {
    for (const at of doorSeats(side).slice(1)) {
      const s = soldier("foot", "near", 10 + k++);
      s.pose<"foot">("doorSit");
      seat(s, at, 0.7);
    }
  }
  for (const at of benchSeats().slice(1, 3)) {
    const s = soldier("foot", "near", 10 + k++);
    s.pose<"foot">("doorSit");
    seat(s, at, 0.7 + 0.42);
  }
  const c = onHeli(0, 1.5, 0);
  shoot("right", round(c, H + Math.PI / 2, Math.PI / 2 - 0.25, 11, 0.6, 50));
  shoot("left", round(c, H + Math.PI / 2, -Math.PI / 2 + 0.3, 11, 0.6, 50));
  shoot("right door", look(onHeli(4.6, 2.2, 1.6), onHeli(1.0, 1.3, 0.3), 45));
  shoot("from above", round(c, H + Math.PI / 2, Math.PI / 2 + 0.6, 9, 6, 50));
}

function squad(): void {
  clear();
  const p = landed(14, 4, Math.PI / 2 + 0.3, 1);
  p.guns.r = { yaw: 0.2, pitch: -0.2 };
  poseHeli(p);
  gunnerAt(1, 0.2, -0.2);
  const stood: [SoldierKind, string, number, number, number][] = [
    ["foot", "aim", 2, -3, 0.3],
    ["foot", "kneel", 0, -1, -0.2],
    ["rocketeer", "kneelLaunch", -1, 2, 0.1],
    ["foot", "ready", 5, 1, 2.6],
    ["skier", "skiAim", 4, -6, -0.4],
    ["skier", "ski", 8, -4, 0],
    ["foot", "walkA", 9, 3, 2.9],
  ];
  stood.forEach(([kind, name, a, b, turn], i) => {
    const s = soldier(kind, "near", 50 + i);
    s.pose(name as SoldierPoseName);
    standOnSnow(s, a, b, turn);
  });
  const c = new THREE.Vector3(spot.x + fwd.x * 6, ground(spot.x, spot.z) + 1.2, spot.z + fwd.z * 6);
  shoot("behind", round(c, H, Math.PI - 0.35, 16, 3.5, 55));
  shoot("front", round(c, H, 0.4, 17, 3.0, 55));
}

// ── in flight ────────────────────────────────────────────────────────────

/** The machine `up` m over the spot, `ahead` m down the piste, nose
 * pitched down `pitch` and banked `roll`, the doors open, the right gunner
 * on his gun at it. */
function flying(ahead: number, up: number, pitch: number, roll: number): ArmyHeliPose {
  const x = spot.x + fwd.x * ahead;
  const z = spot.z + fwd.z * ahead;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, H, roll, "YXZ"));
  return {
    x,
    y: ground(x, z) + up,
    z,
    q: { x: q.x, y: q.y, z: q.z, w: q.w },
    spool: 1,
    doors: { r: 1, l: 0 },
    guns: { r: { yaw: 0.3, pitch: -0.5 }, l: { yaw: 0, pitch: 0 } },
  };
}

async function flight(dusk: boolean): Promise<void> {
  if (dusk) await under(duskHour);
  clear();
  heli.shade(dusk ? 0.45 : 1);
  const p = flying(30, 28, 0.1, 0.18);
  poseHeli(p, 40);
  gunnerAt(1, 0.3, -0.5);
  // The right fast rope out and a man on it, eight metres down.
  heli.body.add(rope);
  rope.visible = true;
  const roper = soldier("foot", "near", 30);
  roper.pose<"foot">("rope");
  const r = onRope(1, 8);
  roper.mesh.position.set(r.x + ROPE_AHEAD, r.y - 1.82, r.z);
  roper.mesh.rotation.set(0, -Math.PI / 2, 0);
  roper.mesh.visible = true;
  heli.body.add(roper.mesh);
  const c = onHeli(0, 1.6, -1);
  const g = new THREE.Vector3(spot.x, ground(spot.x, spot.z) + 1.7, spot.z);
  shoot("from the snow", look(g, c, 40));
  shoot("alongside", round(c, H, Math.PI / 2 + 0.2, 22, 0, 45));
  shoot("chasing", round(c, H, Math.PI - 0.25, 26, 6, 45));
  shoot("over the slope", round(c, H, -0.9, 55, 18, 55));
}

// ── the soldiers ─────────────────────────────────────────────────────────

/** Every pose of a figure, a row each, front, side and behind at the chase
 * camera's range. */
function poses(kind: Exclude<SoldierKind, "gunner">): void {
  clear();
  const s = soldier(kind);
  const pos = standOnSnow(s, 0, 0, 0);
  const c = new THREE.Vector3(pos.x, pos.y + 0.95, pos.z);
  for (const name of (SOLDIER_POSES[kind] as readonly string[]).filter(shown)) {
    s.pose(name as SoldierPoseName);
    const low = name === "kneel" || name === "kneelLaunch" || name === "tuck";
    const at = low ? new THREE.Vector3(c.x, c.y - 0.3, c.z) : c;
    shoot(`${name} front`, round(at, H, 0.35, 4.6, 0.65, 45));
    shoot(`${name} side`, round(at, H, Math.PI / 2, 4.6, 0.65, 45));
    shoot(`${name} behind`, round(at, H, Math.PI - 0.2, 4.6, 0.8, 45));
  }
}

function gunner(): void {
  clear();
  const p = landed(0, 0, Math.PI / 2, 1);
  for (const name of SOLDIER_POSES.gunner.filter(shown)) {
    const aim = name === "sit" ? { yaw: 0, pitch: 0 } : GUNNER_AIMS[name];
    p.guns.r = aim;
    poseHeli(p);
    const s = soldier("gunner");
    seat(s, gunnerSeat(1), 0.7);
    if (name === "sit") s.pose<"gunner">("sit");
    else s.posed(gunnerPosed(1, aim.yaw, aim.pitch));
    shoot(`${name} door`, look(onHeli(4.6, 1.9, 1.2), onHeli(0.9, 1.45, 1.1), 40));
    shoot(`${name} fore`, look(onHeli(5.2, 1.9, 3.8), onHeli(0.9, 1.4, 1.0), 40));
    shoot(`${name} aft`, look(onHeli(3.6, 2.0, -2.6), onHeli(0.9, 1.4, 1.1), 40));
  }
}

function lods(): void {
  clear();
  const cuts: CrowdLod[] = ["near", "mid", "far"];
  const counts: string[] = [];
  cuts.forEach((lod, i) => {
    const s = soldier("foot", lod, 70);
    s.pose<"foot">("ready");
    standOnSnow(s, 0, (i - 1) * 1.4, 0);
    counts.push(`${lod} ${soldierTriangles("foot", lod)}`);
  });
  const c = new THREE.Vector3(spot.x, ground(spot.x, spot.z) + 0.95, spot.z);
  const note = counts.join(" · ");
  shoot("near, mid, far at 6 m", round(c, H, 0.15, 6, 0.6, 45), note);
  shoot("at 40 m", round(c, H, 0.15, 40, 3, 45), note);
}

// ── the hunt ─────────────────────────────────────────────────────────────

/** THE CORNERS of the map the stolen machine is flown through. */
const corners = (() => {
  const m = level.size * 0.2;
  const s = level.size - m;
  return [
    { x: m, z: m },
    { x: s, z: m },
    { x: s, z: s },
    { x: m, z: s },
  ];
})();

/** A HUNTED FREE RIDE run on the real engine: `stars` raised at the
 * start (in the stolen air ambulance, lifted off its pad first, with
 * `heli`), the bot skiing or flying him away, stepped to each of `at` s
 * and photographed there — the frame before drawn a fifth of a second
 * earlier, so the muzzles' flashes and the tracers since are in it. */
async function hunt(stars: number, heli: boolean, at: number[]): Promise<void> {
  clear();
  const run = createGame({
    level,
    seed,
    region,
    mode: "free",
    crowd: 0,
    quiet: true,
    gore: true,
    heli,
  });
  let leg = 0;
  const drive = () => {
    const h = run.heli;
    if (heli && h?.rider && h.mode !== "wreck") {
      const c = corners[leg % corners.length];
      if (Math.hypot(c.x - h.x, c.z - h.z) < 150) leg++;
      return pilotInput(run, { x: c.x, z: c.z, height: 200 });
    }
    return botInput(run);
  };
  if (heli) {
    run.heli!.livery = "rescue";
    for (let i = 0; i < 6 * 120; i++)
      step(run, pilotInput(run, { x: run.heli!.x, z: run.heli!.z, height: 90 }));
  }
  setWanted(run, stars);
  const t0 = run.t;
  await renderer.load(run);
  for (const t of at) {
    while (run.t - t0 < t - 0.2) step(run, drive());
    renderer.draw(run, 1, STILL);
    // The machines' models come in over the loader: a moment for them.
    if (t === at[0]) await new Promise((r) => setTimeout(r, 2500));
    while (run.t - t0 < t) step(run, drive());
    const q = quarryOf(run);
    const machines = armyHelis(run).filter((h) => h.phase === "hunt" || h.phase === "fall");
    const g = run.gunfire;
    const note = `${(run.t - t0).toFixed(0)} s · ${run.wanted?.stars ?? 0}★ · ${machines.length} up · ${g?.fired ?? 0} rounds, ${g?.hits ?? 0} in him`;
    const me = new THREE.Vector3(q.x, q.y + (heli ? 2 : 1.4), q.z);
    if (!machines.length) {
      shoot(`${t} s`, round(me, run.skier.heading, Math.PI, 9, 3, 55), note, run);
      continue;
    }
    // The nearest machine after him.
    let h = machines[0];
    for (const m of machines)
      if (Math.hypot(m.x - q.x, m.z - q.z) < Math.hypot(h.x - q.x, h.z - q.z)) h = m;
    const hm = new THREE.Vector3(h.x, h.y + 2, h.z);
    const way = new THREE.Vector3().subVectors(hm, me);
    const flat = Math.max(1, Math.hypot(way.x, way.z));
    // Behind him, looking past him up at it — the chase camera turned on it.
    const toward = way.clone().normalize();
    const back = new THREE.Vector3(
      me.x - (way.x / flat) * 9,
      me.y + 1.2,
      me.z - (way.z / flat) * 9,
    );
    shoot(
      `${t} s, behind him at it`,
      look(back, me.clone().addScaledVector(toward, 30), 62),
      note,
      run,
    );
    // Beside the machine, its inward door and gunner toward the lens.
    const side = h.dir;
    const rx = Math.cos(h.heading) * side;
    const rz = -Math.sin(h.heading) * side;
    const door = new THREE.Vector3(
      h.x + rx * 20 - Math.sin(h.heading) * 6,
      h.y + 4,
      h.z + rz * 20 - Math.cos(h.heading) * 6,
    );
    shoot(
      `${t} s, its door`,
      look(door, new THREE.Vector3(h.x + rx * 1.2, h.y + 1.4, h.z + rz * 1.2), 45),
      note,
      run,
    );
    // Wide: him and every machine.
    const mid = me.clone().lerp(hm, 0.5);
    const wide = new THREE.Vector3(
      mid.x - (way.z / flat) * flat * 0.9,
      mid.y + flat * 0.25,
      mid.z + (way.x / flat) * flat * 0.9,
    );
    shoot(`${t} s, wide`, look(wide, mid, 50), note, run);
  }
}

// ── on the ground ────────────────────────────────────────────────────────

/** THE MODELS' FIRST LOAD: a moment for them the first time a hunt draws. */
let modelsIn = false;

/** A HUNTED FREE RIDE at `stars`, him stood still where it found him (the
 * INJURIES on, or SAFE FOR WORK with `sfw`), stepped until `until` says
 * so (at most `most` s); null when it never did. */
async function groundRun(
  stars: number,
  sfw: boolean,
  until: (run: GameState) => boolean,
  most = 240,
  at?: { x: number; z: number; heading: number },
): Promise<GameState | null> {
  clear();
  const run = createGame({
    level,
    seed,
    region,
    mode: "free",
    crowd: 0,
    quiet: true,
    gore: !sfw,
    sfw,
  });
  if (at) placeRun(run, { ...at, speed: 0 });
  setWanted(run, stars);
  const t0 = run.t;
  while (!until(run)) {
    if (run.t - t0 > most) return null;
    step(run, NEUTRAL_INPUT);
  }
  await renderer.load(run);
  if (!modelsIn) {
    renderer.draw(run, 1, STILL);
    await new Promise((r) => setTimeout(r, 2500));
    modelsIn = true;
  }
  return run;
}

/** The note under a ground frame: the run's clock, the stars, the men. */
function groundNote(run: GameState): string {
  const men = armyTroops(run);
  const by = (m: string) => men.filter((s) => s.mode === m).length;
  return `${run.t.toFixed(0)} s · ${run.wanted?.stars ?? 0}★ · ${men.length} men (${by("chase")} chasing, ${by("aim")} aiming, ${by("ride")} riding)`;
}

/** Draw the frame a fifth of a second back first, so the muzzles' flashes
 * and the tracers since are in the one shot. */
function settleGround(run: GameState): void {
  renderer.draw(run, 1, STILL);
  for (let i = 0; i < 24; i++) step(run, NEUTRAL_INPUT);
}

/** A LENS ROUND `c` with nothing in the way: the first of a few bearings
 * either side of `bearing` whose sight line passes clear of every tree's
 * boughs. */
function clearRound(
  c: THREE.Vector3,
  facing: number,
  bearing: number,
  d: number,
  up: number,
  fov = 50,
): LensPose {
  for (const turn of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.6, -1.6]) {
    const h = facing + bearing + turn;
    const ex = c.x + Math.sin(h) * d;
    const ez = c.z + Math.cos(h) * d;
    const blocked = level.trees.some((t) => {
      const vx = c.x - ex;
      const vz = c.z - ez;
      const k = Math.max(0, Math.min(1, ((t.x - ex) * vx + (t.z - ez) * vz) / (vx * vx + vz * vz)));
      // A crown's boughs reach about a quarter of the tree's height out.
      return Math.hypot(ex + vx * k - t.x, ez + vz * k - t.z) < 1 + 0.25 * t.height;
    });
    if (!blocked) return round(c, facing, bearing + turn, d, up, fov);
  }
  return round(c, facing, bearing, d, up, fov);
}

const centre = (men: readonly { x: number; y: number; z: number }[]): THREE.Vector3 => {
  const c = new THREE.Vector3();
  for (const m of men) c.add(new THREE.Vector3(m.x, m.y, m.z));
  return c.multiplyScalar(1 / Math.max(1, men.length));
};

async function groundLand(): Promise<void> {
  const run = await groundRun(3, false, (r) =>
    armyHelis(r).some(
      (h) => h.phase === "set" && armyTroops(r).filter((m) => m.squad === h.id).length >= 4,
    ),
  );
  if (!run) return;
  settleGround(run);
  const h = armyHelis(run).find((m) => m.phase === "set") ?? armyHelis(run)[0];
  const c = new THREE.Vector3(h.x, h.y + 1.4, h.z);
  const note = groundNote(run);
  shoot("beside its doors", clearRound(c, h.heading, Math.PI / 2 + 0.35, 15, 2.5, 55), note, run);
  shoot("from the nose", round(c, h.heading, 0.5, 18, 4, 55), note, run);
  shoot("from above", round(c, h.heading, -Math.PI / 2 - 0.4, 22, 13, 55), note, run);
}

async function groundFile(): Promise<void> {
  const moving = (r: GameState) =>
    armyTroops(r).filter((m) => m.mode === "chase" && m.speed > 2.5 && m.role === "rifle");
  const run = await groundRun(3, false, (r) => moving(r).length >= 3);
  if (!run) return;
  for (let i = 0; i < 120; i++) step(run, NEUTRAL_INPUT);
  settleGround(run);
  const men = moving(run).length ? moving(run) : armyTroops(run);
  const c = centre(men).add(new THREE.Vector3(0, 1.2, 0));
  const lead = men[0];
  const note = groundNote(run);
  shoot("beside the file", round(c, lead.heading, Math.PI / 2 + 0.2, 18, 3, 55), note, run);
  shoot("ahead of them", round(c, lead.heading, 0.25, 20, 4, 55), note, run);
  shoot("behind them", round(c, lead.heading, Math.PI - 0.2, 16, 4, 55), note, run);
}

async function groundFire(): Promise<void> {
  // A rifleman stopped to fire out in the open, where a lens can see him.
  const open = (m: { x: number; z: number }) =>
    !level.trees.some((t) => Math.hypot(t.x - m.x, t.z - m.z) < 9);
  const firing = (r: GameState) =>
    armyTroops(r).find((m) => m.mode === "aim" && m.role === "rifle" && m.t > 0.8 && open(m));
  // SAFE FOR WORK: the door guns never kill him before a squad is near.
  const run = await groundRun(3, true, (r) => !!firing(r));
  if (!run) return;
  renderer.draw(run, 1, STILL);
  // To the moment a round leaves his muzzle.
  for (let i = 0; i < 600; i++) {
    step(run, NEUTRAL_INPUT);
    if (run.events.some((e) => e.kind === "gunfire" && e.phase === "shot")) break;
  }
  step(run, NEUTRAL_INPUT);
  const m = firing(run) ?? armyTroops(run).find((s) => s.mode === "aim") ?? armyTroops(run)[0];
  const c = new THREE.Vector3(m.x, m.y + 0.9, m.z);
  const note = groundNote(run);
  shoot("from his right", clearRound(c, m.aimH, Math.PI / 2 + 0.5, 5, 0.6, 50), note, run);
  shoot("from his left", clearRound(c, m.aimH, -Math.PI / 2 - 0.3, 6, 1, 50), note, run);
  shoot("down his aim", clearRound(c, m.aimH, Math.PI - 0.25, 4.5, 1, 55), note, run);
}

async function groundLift(): Promise<void> {
  const riding = (r: GameState) =>
    armyTroops(r).filter(
      (m) => m.mode === "ride" && m.y - level.groundAt(m.x, m.z) > 3 && m.from === "lift",
    );
  // Stood beside a chairlift two thirds of the way up it, so its top is the
  // one above him the squads are sent up.
  const chair = liftPlans(level).find((p) => p.lift.kind === "chair");
  const at = chair
    ? {
        x: chair.lift.bottom.x + chair.dx * chair.length * 0.6 + chair.dz * 30,
        z: chair.lift.bottom.z + chair.dz * chair.length * 0.6 - chair.dx * 30,
        heading: chair.heading + Math.PI,
      }
    : undefined;
  const run = await groundRun(4, true, (r) => riding(r).length >= 2, 300, at);
  if (!run) return;
  settleGround(run);
  const men = riding(run).length ? riding(run) : armyTroops(run);
  const c = centre(men).add(new THREE.Vector3(0, 0.4, 0));
  const h = men[0].heading;
  const note = groundNote(run);
  shoot("beside the chair", round(c, h, Math.PI / 2 + 0.4, 9, 1.5, 50), note, run);
  shoot("from below", round(c, h, Math.PI / 2, 14, -7, 55), note, run);
  shoot("behind", round(c, h, Math.PI - 0.3, 10, 2, 55), note, run);
}

async function groundArrest(): Promise<void> {
  const run = await groundRun(3, true, (r) => (arrestedOf(r) ?? 0) > 4);
  if (!run) return;
  renderer.draw(run, 1, STILL);
  const q = quarryOf(run);
  const by = armyTroops(run).find((m) => m.mode === "arrest");
  const c = new THREE.Vector3(q.x, q.y + 0.4, q.z);
  const face = by ? Math.atan2(q.x - by.x, q.z - by.z) : run.skier.heading;
  const note = `${groundNote(run)} · arrested ${(arrestedOf(run) ?? 0).toFixed(0)} s`;
  shoot("held", clearRound(c, face, Math.PI / 2 + 0.3, 4.5, 1.6, 50), note, run);
  shoot("from above", round(c, face, 0.6, 5, 4, 55), note, run);
  shoot("the ring", clearRound(c, face, -Math.PI / 2 - 0.4, 14, 5, 55), note, run);
}

/** THE ARMY'S SNOWMOBILES (`army-sled.ts`): one out in the open at `stars`
 * stepped until `until` finds it, then three lenses round it. */
async function sledScene(
  stars: number,
  sfw: boolean,
  until: (m: ReturnType<typeof armySleds>[number], r: GameState) => boolean,
  lenses: readonly (readonly [string, number, number, number, number])[],
  fire = false,
): Promise<void> {
  const open = (b: { x: number; z: number }) =>
    !level.trees.some((t) => Math.hypot(t.x - b.x, t.z - b.z) < 5);
  const pick = (r: GameState) => armySleds(r).find((m) => open(m.body) && until(m, r));
  const run = await groundRun(stars, sfw, (r) => !!pick(r), 300);
  if (!run) return;
  // The army's view is built on the first draw a machine is out in, and the
  // fleet's model lands on a promise after it: a moment for it.
  renderer.draw(run, 1, STILL);
  await new Promise((r) => setTimeout(r, 400));
  const id = pick(run)!.id;
  // On a few steps, so a burst's muzzle flash and tracers are in the shot.
  for (let i = 0; i < (fire ? 3 : 24); i++) step(run, NEUTRAL_INPUT);
  const m = armySleds(run).find((s) => s.id === id) ?? armySleds(run)[0];
  const b = m.body;
  const c = new THREE.Vector3(b.x, b.y + 1, b.z);
  const note = `${groundNote(run)} · sled ${m.mode} ${b.speed.toFixed(1)} m/s`;
  for (const [label, bearing, d, up, fov] of lenses)
    shoot(label, clearRound(c, b.heading, bearing, d, up, fov), note, run);
}

const VIEWS: Record<string, () => void | Promise<void>> = {
  "sled-chase": () =>
    sledScene(4, true, (m) => m.mode === "drive" && m.body.speed > 8 && m.driver && m.gunner, [
      ["beside", Math.PI / 2 + 0.3, 7, 1.6, 50],
      ["ahead", 0.35, 9, 2.2, 50],
      ["behind", Math.PI - 0.3, 8, 2.5, 50],
      ["the crew", -Math.PI / 2 - 0.25, 3.4, 0.9, 50],
    ]),
  "sled-halt": () =>
    sledScene(
      3,
      true,
      (m, r) =>
        m.mode === "halt" &&
        r.events.some((e) => e.kind === "gunfire" && e.phase === "shot" && e.weapon === "lmg"),
      [
        ["the gunner", -Math.PI / 2 - 0.5, 3.6, 0.8, 50],
        ["broadside", Math.PI / 2, 7, 1.2, 50],
        ["down his aim", Math.PI - 0.6, 4, 1.4, 55],
      ],
      true,
    ),
  "sled-arrest": () =>
    sledScene(3, true, (m, r) => m.mode === "empty" && (arrestedOf(r) ?? 0) > 3, [
      ["the empty sled", Math.PI / 2 + 0.4, 5, 1.4, 50],
      ["from above", 0.6, 9, 6, 55],
      ["wide", -Math.PI / 2 - 0.4, 22, 7, 55],
    ]),
  "ground-land": groundLand,
  "ground-file": groundFile,
  "ground-fire": groundFire,
  "ground-lift": groundLift,
  "ground-arrest": groundArrest,
  "hunt-2": () => hunt(2, false, [32, 40, 50]),
  "hunt-4": () => hunt(4, false, [32, 40, 50]),
  "hunt-heli": () => hunt(3, true, [26, 32, 38]),
  turntable,
  close,
  doors,
  squad,
  "flight-day": () => flight(false),
  "flight-dusk": () => flight(true),
  ski: () => poses("skier"),
  foot: () => poses("foot"),
  rocket: () => poses("rocketeer"),
  gunner,
  lods,
};

/** Tiles a row a view's sheet is laid out in. */
const COLS: Record<string, number> = {
  turntable: 4,
  close: 3,
  doors: 2,
  squad: 2,
  "flight-day": 2,
  "flight-dusk": 2,
  "hunt-2": 3,
  "hunt-4": 3,
  "hunt-heli": 3,
  "ground-land": 3,
  "ground-file": 3,
  "ground-fire": 3,
  "ground-lift": 3,
  "ground-arrest": 3,
  ski: 3,
  foot: 3,
  rocket: 3,
  gunner: 3,
  lods: 2,
  "sled-chase": 3,
  "sled-halt": 3,
  "sled-arrest": 3,
};

const ready = (async () => {
  await renderer.load(state);
  await heli.ready;
  await under(hour);
  renderer.draw(state, 1, STILL);
  await renderer.shadeSettled();
  return `stood at ${(spot.s / level.track.length).toFixed(2)} of the piste (its flattest), smock ${smock}`;
})();

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    if (!v.endsWith("dusk")) {
      await under(hour);
      heli.shade(1);
    }
    await scene();
  }
  const cols = Math.max(...views.map((v) => COLS[v] ?? 2));
  const tw = Math.round((width * scale * 2) / Math.max(2, cols));
  const th = Math.round((tw * height) / width);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `ARMY — ${group} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
  header.style.whiteSpace = "pre-wrap";
  const cells: HTMLElement[] = [header];
  for (const f of frames) {
    const cell = document.createElement("figure");
    const img = document.createElement("img");
    img.src = f.png;
    img.width = tw;
    img.height = th;
    await img.decode();
    const caption = document.createElement("figcaption");
    caption.textContent = f.caption;
    cell.append(img, caption);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  return { frames };
}

window.__army = { ready, groups: GROUPS, cols: COLS, sheet };
