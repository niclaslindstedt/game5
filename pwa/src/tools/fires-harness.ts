// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRES LAB's page (`scripts/fires-preview.mjs`): a free ride's camp
// fires and bonfires (`engine/game/fires.ts`, laid out by `fire-plan.ts`
// and drawn by `fires-view.ts`) through the game's OWN renderer:
//
//   * CAMP — a camp fire by its hut: close, at eye level, from a bench and
//     from above;
//   * BONFIRE — a bonfire close, from 20 m and from 60 m;
//   * NIGHT — both at hour 21: the light on the snow, the benches, the hut
//     and the trees, the sparks;
//   * MAP — each site's bonfire from the air (the base, half way up, the
//     top), the mid and top ones from 20 m, and a hut's fire far off;
//   * PEOPLE — the skiers round them (`civilian-fires.ts`): a camp fire's
//     group close and from above, the view from a bench, a griller's hand,
//     stick and sausage close up, one eating and one warming his hands, a
//     bonfire's ring, and the camp fire and the bonfire at hour 21 lit by
//     the fire (the run's clock carried on to the night's people).
//
// Every frame is captioned with what it cost: the milliseconds, the draw
// calls and the triangles. It exposes `window.__fires.sheet(group, views)`,
// which shoots one group's views, lays them out as a contact sheet and
// hands back every frame.

import {
  cabinsOf,
  createGame,
  firesOf,
  generateLevel,
  NEUTRAL_INPUT,
  SKY_CLOCK,
  step,
  TUNING,
  windAt,
  withSky,
  type Fire,
  type GameState,
  type RegionId,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { snowFloor } from "../game/fire-plan.ts";
import { setSkyClock } from "../game/sky-clock.ts";
import { heldHand, stickTip } from "../game/civilian-fires.ts";
import { CIVILIAN_POSES, civilianDials } from "../game/civilian-moves.ts";
import {
  civilianAt,
  civilianHour,
  civilianPlanFor,
  freshCivilianPose,
  type CivilianPlan,
} from "../game/civilian-plan.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

const GROUPS = {
  camp: ["camp-close", "camp-eye", "camp-bench", "camp-above"],
  bonfire: ["bonfire-close", "bonfire-20", "bonfire-60"],
  night: ["night-camp", "night-bench", "night-bonfire", "night-map"],
  map: ["map-base", "map-mid", "map-top", "mid-20", "top-20", "map-hut"],
  people: [
    "people-camp",
    "people-above",
    "people-bench",
    "people-grill",
    "people-eat",
    "people-bonfire",
    "people-ring",
    "people-night-camp",
    "people-night-bonfire",
  ],
} as const;

declare global {
  interface Window {
    __fires?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
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
const cols = Number(params.get("cols") ?? 2);
const scale = Number(params.get("scale") ?? 0.5);
const hour = params.get("hour") !== null ? Number(params.get("hour")) : 13;
const nightHour = Number(params.get("night") ?? 21);
const weather = (params.get("weather") || "clear") as WeatherKind;

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
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;
const fires = firesOf(level);
const cabins = cabinsOf(level);
const camps = fires.filter((f) => f.kind === "camp");
const bonfires = fires.filter((f) => f.kind === "bonfire");

function fresh(): GameState {
  return createGame({ level, seed, region, mode: "free", crowd: 0, quiet: true });
}

/** The camp fire the camp views are about: one by a hut with the most
 * benches, and the way from its hut to it. */
const camp: Fire | undefined = [...camps].sort((a, b) => b.seats.length - a.seats.length)[0];
const bonfire: Fire | undefined = bonfires.find((f) => f.site === "base") ?? bonfires[0];
/** The bonfires half way up and off the top station, where the map has them. */
const midFire: Fire | undefined = bonfires.find((f) => f.site === "mid");
const topFire: Fire | undefined = bonfires.find((f) => f.site === "top");

/** The bearing from the village to fire `f`, turned round: a lens on it
 * stands below it, looking up the mountain at it. */
function fromBelow(f: Fire): number {
  const v = level.resort?.village ?? f;
  return Math.atan2(f.x - v.x, f.z - v.z) + Math.PI;
}

/** The lift station nearest fire `f`, and how far off it is. */
function stationOf(f: Fire): { x: number; z: number; d: number } {
  let best = { x: f.x, z: f.z + 1 };
  let d = Infinity;
  for (const l of level.resort?.lifts ?? []) {
    for (const p of [l.top, l.bottom]) {
      const e = Math.hypot(p.x - f.x, p.z - f.z);
      if (e < d) [d, best] = [e, p];
    }
  }
  return { x: best.x, z: best.z, d };
}

/** A lens high over the middle between fire `f` and the station nearest
 * it, `up` m over the snow, looking down on both. */
function overStation(f: Fire, up: number): LensPose {
  const st = stationOf(f);
  const mx = (f.x + st.x) / 2;
  const mz = (f.z + st.z) / 2;
  const a = Math.atan2(st.x - f.x, st.z - f.z) + Math.PI / 2;
  const ex = mx + Math.sin(a) * up * 0.5;
  const ez = mz + Math.cos(a) * up * 0.5;
  return {
    eye: { x: ex, y: level.groundAt(mx, mz) + up, z: ez },
    target: { x: mx, y: level.groundAt(mx, mz), z: mz },
    fov: 50,
    roll: 0,
  };
}

function hutWay(f: Fire): number {
  const hut = cabins.find((c) => c.id === f.building);
  return hut ? Math.atan2(f.x - hut.x, f.z - hut.z) : 0;
}

/** A lens `back` m from fire `f` on bearing `a` (0 = +z), `up` m over the
 * snow, looking at a point `look` m over its hearth. */
function round(f: Fire, a: number, back: number, up: number, look: number, fov = 50): LensPose {
  const ex = f.x + Math.sin(a) * back;
  const ez = f.z + Math.cos(a) * back;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + up, z: ez },
    target: { x: f.x, y: f.y + look, z: f.z },
    fov,
    roll: 0,
  };
}

function run(state: GameState, seconds: number): void {
  const n = Math.round(seconds / FRAME);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < STEPS; i++) step(state, NEUTRAL_INPUT);
    renderer.draw(state, 1, FRAME, false);
  }
}

let frames: Frame[] = [];
let view = "";
let sky = "";

function shoot(state: GameState, label: string, lens: LensPose): void {
  renderer.setOverride(lens);
  // Once to deal the lens's own nearest fires their lamp slots, once to see.
  renderer.draw(state, 1, STILL, true);
  const info = gl.info;
  info.autoReset = false;
  info.reset();
  const t0 = performance.now();
  renderer.draw(state, 1, STILL, true);
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
      `${view} ${label} — ${sky}\n` +
      `${ms.toFixed(1)} ms · ${calls} draws · ${(tris / 1000).toFixed(0)}k tris · ` +
      `wind ${windAt(level, state.t).speed.toFixed(1)} m/s`,
    png: canvas.toDataURL("image/png"),
  });
}

async function under(h: number): Promise<void> {
  renderer.setSky({ hour: h, weather });
  await renderer.shadeSettled();
  sky = `h${h} ${weather}`;
}

const need = (f: Fire | undefined, what: string): Fire => {
  if (!f) throw new Error(`seed ${seed} has no ${what}`);
  return f;
};

/** THE PEOPLE: the plan of the run's map, and who of it is at fire `f`
 * and out at `t`. */
function fireside(state: GameState, f: Fire): { plan: CivilianPlan; at: number[] } {
  const plan = civilianPlanFor(state.level);
  const hour = civilianHour(state.level, state.t);
  const pose = freshCivilianPose();
  const at: number[] = [];
  plan.people.forEach((c, i) => {
    if (c.fire?.id === f.id && civilianAt(plan, i, state.t, hour, pose).shown) at.push(i);
  });
  return { plan, at };
}

/** The hour the people views' people are out at: the map's own, or the
 * night's for the night views — the run's clock carried on until the sky's
 * clock (`civilianHour`) reaches it, the people being a pure function of
 * that clock. */
let peopleHour: number | null = null;

/** A fresh run a second in, its clock carried on to `peopleHour`. */
function settle(state: GameState): void {
  run(state, 1);
  if (peopleHour === null) return;
  const t0 = state.t;
  for (let k = 0; k < 24 * 3600; k += 5) {
    const h = civilianHour(state.level, t0 + k);
    if (Math.abs(h - peopleHour) < 0.05) {
      state.t = t0 + k;
      return;
    }
  }
}

/** `shots` with the people of the night hour, at its busiest fires. */
async function atNight(shots: () => Promise<void>): Promise<void> {
  const [camp0, bonfire0] = [campPeople, bonfirePeople];
  peopleHour = nightHour;
  // The lab's sky clock stands (`sky-clock.ts`): run it at the game's rate
  // for the people to be at the night's hour — the sky itself is held by
  // `under`.
  setSkyClock(SKY_CLOCK.rate);
  campPeople = busiest("camp") ?? camp0;
  bonfirePeople = busiest("bonfire") ?? bonfire0;
  try {
    await shots();
  } finally {
    peopleHour = null;
    setSkyClock(0);
    campPeople = camp0;
    bonfirePeople = bonfire0;
  }
}

/** The fire of `kind` with the most people out at it at the map's hour. */
function busiest(kind: Fire["kind"]): Fire | undefined {
  const s = fresh();
  settle(s);
  let best: Fire | undefined;
  let most = -1;
  for (const f of fires.filter((g) => g.kind === kind)) {
    const n = fireside(s, f).at.length;
    if (n > most) {
      most = n;
      best = f;
    }
  }
  return best;
}

/** A lens from (ex, ey, ez) at (tx, ty, tz). */
const lens = (e: number[], t: number[], fov = 50): LensPose => ({
  eye: { x: e[0], y: e[1], z: e[2] },
  target: { x: t[0], y: t[1], z: t[2] },
  fov,
  roll: 0,
});

let campPeople: Fire | undefined;
let bonfirePeople: Fire | undefined;

const VIEWS: Record<string, () => Promise<void>> = {
  async "camp-close"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    // With the hut behind it.
    shoot(s, "close", round(f, hutWay(f), 3.2, 1.3, 0.45, 55));
  },
  async "camp-eye"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    shoot(s, "eye", round(f, hutWay(f) + 0.6, 7, 1.7, 0.8, 50));
  },
  async "camp-bench"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    const b = f.seats[0];
    const a = Math.atan2(b.x - f.x, b.z - f.z);
    shoot(s, "bench", round(f, a, Math.hypot(b.x - f.x, b.z - f.z) + 0.3, 1.15, 0.3, 60));
  },
  async "camp-above"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    shoot(s, "above", round(f, hutWay(f) + 0.3, 5, 9, 0, 50));
  },
  async "bonfire-close"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "close", round(f, 0.4, 8, 1.7, 1.8, 60));
  },
  async "bonfire-20"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "20m", round(f, 1.2, 20, 1.8, 2.5, 50));
  },
  async "bonfire-60"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "60m", round(f, 2.2, 60, 3, 3, 45));
  },
  async "night-camp"() {
    await under(nightHour);
    await VIEWS["camp-close"]();
    await VIEWS["camp-eye"]();
  },
  async "night-bench"() {
    await under(nightHour);
    await VIEWS["camp-bench"]();
  },
  async "night-bonfire"() {
    await under(nightHour);
    await VIEWS["bonfire-close"]();
    await VIEWS["bonfire-20"]();
  },
  async "night-map"() {
    await under(nightHour);
    await VIEWS["map-base"]();
    await under(hour);
  },
  async "map-base"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "base", round(f, fromBelow(f), 140, 70, 0, 55));
  },
  async "map-mid"() {
    const f = need(midFire, "mid-mountain bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "mid", overStation(f, Math.max(90, stationOf(f).d * 1.6)));
  },
  async "map-top"() {
    const f = need(topFire, "top bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "top", overStation(f, Math.max(90, stationOf(f).d * 1.6)));
  },
  async "mid-20"() {
    const f = need(midFire, "mid-mountain bonfire");
    const s = fresh();
    run(s, 1);
    shoot(
      s,
      "mid 20m",
      round(f, Math.atan2(stationOf(f).x - f.x, stationOf(f).z - f.z) + 0.6, 8, 24, 0, 55),
    );
  },
  async "top-20"() {
    const f = need(topFire, "top bonfire");
    const s = fresh();
    run(s, 1);
    shoot(
      s,
      "top 20m",
      round(f, Math.atan2(stationOf(f).x - f.x, stationOf(f).z - f.z) + 0.6, 20, 3, 2.5, 50),
    );
  },
  async "people-camp"() {
    const f = need(campPeople, "camp fire with people");
    const s = fresh();
    settle(s);
    shoot(s, "group", round(f, hutWay(f) + 2.4, 5.5, 1.6, 0.7, 50));
  },
  async "people-above"() {
    const f = need(campPeople, "camp fire with people");
    const s = fresh();
    settle(s);
    shoot(s, "above", round(f, hutWay(f) + 0.3, 3.5, 7, 0, 55));
  },
  async "people-bench"() {
    // From where a sitter's eyes are, on the bench furthest round from
    // anyone at the fire, looking across it at the others.
    const f = need(campPeople, "camp fire with people");
    const s = fresh();
    settle(s);
    const { plan, at } = fireside(s, f);
    const pose = freshCivilianPose();
    const hour = civilianHour(s.level, s.t);
    const off = (a: number): number => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    const bearings = at.map((i) => {
      civilianAt(plan, i, s.t, hour, pose);
      return Math.atan2(pose.x - f.x, pose.z - f.z);
    });
    let best = f.seats[0];
    let room = -1;
    for (const b of f.seats) {
      const a = Math.atan2(b.x - f.x, b.z - f.z);
      const gap = Math.min(Math.PI, ...bearings.map((q) => off(q - a)));
      if (gap > room) {
        room = gap;
        best = b;
      }
    }
    const a = Math.atan2(best.x - f.x, best.z - f.z);
    const r = Math.hypot(best.x - f.x, best.z - f.z) + 0.15;
    const ex = f.x + Math.sin(a) * r;
    const ez = f.z + Math.cos(a) * r;
    const ey = snowFloor(s.level, best.x, best.z) + 1.2;
    shoot(s, "bench", lens([ex, ey, ez], [f.x, f.y + 0.6, f.z], 70));
  },
  async "people-eat"() {
    // One eating his sausage in its bread and one warming his hands, each
    // seen from the fire's side of him.
    const f = need(campPeople, "camp fire with people");
    const s = fresh();
    settle(s);
    const plan = civilianPlanFor(s.level);
    const pose = freshCivilianPose();
    const t0 = s.t;
    for (const want of ["eat", "warm"] as const) {
      let found = -1;
      let when = t0;
      for (const g of [f, ...fires.filter((q) => q !== f)]) {
        for (let k = 0; k < 600 && found < 0; k++) {
          const t = t0 + k * 2;
          const hour = civilianHour(s.level, t);
          plan.people.forEach((c, i) => {
            if (found >= 0 || c.fire?.id !== g.id) return;
            const p = civilianAt(plan, i, t, hour, pose);
            if (p.shown && p.activity === want) {
              found = i;
              when = t;
            }
          });
        }
        if (found >= 0) break;
      }
      if (found < 0) throw new Error(`nobody at a fire to ${want}`);
      s.t = when;
      civilianAt(plan, found, when, civilianHour(s.level, when), pose);
      const ch = Math.cos(pose.heading);
      const sh = Math.sin(pose.heading);
      const seated = plan.people[found].home.seat !== null;
      const hy = pose.y + (seated ? 0.85 : 1.1);
      // In front of him, out to his right, a little over his hands.
      const ex = pose.x + sh * 1.5 + ch * 0.9;
      const ez = pose.z + ch * 1.5 - sh * 0.9;
      shoot(
        s,
        want,
        lens([ex, hy + 0.15, ez], [pose.x + sh * 0.2, hy - 0.1, pose.z + ch * 0.2], 45),
      );
    }
  },
  async "people-grill"() {
    // A griller's hand, stick and sausage, from his side.
    const f = need(campPeople, "camp fire with people");
    const s = fresh();
    settle(s);
    const { plan, at } = fireside(s, f);
    const hour = civilianHour(s.level, s.t);
    const pose = freshCivilianPose();
    const w = new Float32Array(CIVILIAN_POSES.length);
    const hand: [number, number, number] = [0, 0, 0];
    const i = at.find((k) => civilianAt(plan, k, s.t, hour, pose).activity === "grill");
    if (i === undefined) throw new Error(`nobody grilling at ${f.id}`);
    civilianAt(plan, i, s.t, hour, pose);
    civilianDials(pose, s.t, i, w);
    heldHand(plan.people[i].body, w, hand);
    const ch = Math.cos(pose.heading);
    const sh = Math.sin(pose.heading);
    const hx = pose.x + hand[0] * ch + hand[2] * sh;
    const hy = pose.y + hand[1];
    const hz = pose.z - hand[0] * sh + hand[2] * ch;
    const tip = stickTip({ x: hx, y: hy, z: hz }, f.kind, f.x, f.y, f.z, { x: 0, y: 0, z: 0 });
    const mx = (hx + tip.x) / 2;
    const mz = (hz + tip.z) / 2;
    // Square to the stick, on his right, a little above.
    const ex = mx + ch * 1.4 - sh * 0.3;
    const ez = mz - sh * 1.4 - ch * 0.3;
    shoot(s, "grill", lens([ex, (hy + tip.y) / 2 + 0.35, ez], [mx, (hy + tip.y) / 2, mz], 50));
    // And the sausage itself, close.
    shoot(
      s,
      "sausage",
      lens([tip.x + ch * 0.55, tip.y + 0.25, tip.z - sh * 0.55], [tip.x, tip.y, tip.z], 40),
    );
  },
  async "people-bonfire"() {
    const f = need(bonfirePeople, "bonfire with people");
    const s = fresh();
    settle(s);
    shoot(s, "ring", round(f, 0.9, 8.5, 1.8, 1.2, 58));
  },
  async "people-ring"() {
    const f = need(bonfirePeople, "bonfire with people");
    const s = fresh();
    settle(s);
    shoot(s, "above", round(f, 2.0, 7, 10, 0, 60));
  },
  async "people-night-camp"() {
    await under(nightHour);
    await atNight(async () => {
      await VIEWS["people-camp"]();
      await VIEWS["people-bench"]();
    });
  },
  async "people-night-bonfire"() {
    await under(nightHour);
    await atNight(() => VIEWS["people-bonfire"]());
  },
  async "map-hut"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    shoot(s, "hut", round(f, hutWay(f) + 0.2, 40, 22, 0.5, 45));
  },
};

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  await under(hour);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  campPeople = busiest("camp");
  bonfirePeople = busiest("bonfire");
  const kinds = new Map<string, number>();
  for (const f of camps) {
    const kind = cabins.find((c) => c.id === f.building)?.kind ?? "?";
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  return (
    `${camps.length} camp fires (${[...kinds].map(([k, n]) => `${n} ${k}`).join(", ")}), ` +
    `${bonfires.length} bonfires; the camp views' ${camp?.id ?? "-"} by ${camp?.building ?? "-"}; ` +
    `people at ${campPeople?.id ?? "-"} and ${bonfirePeople?.id ?? "-"}`
  );
})();

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    if (!v.startsWith("night")) await under(hour);
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `FIRES — ${group} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__fires = { ready, groups: GROUPS, sheet };
