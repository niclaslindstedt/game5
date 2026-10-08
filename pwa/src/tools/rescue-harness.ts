// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE LAB's page (`scripts/rescue-preview.mjs`): the air ambulance
// on the run after an INJURED one (`rescue-plan.ts`, `rescue-view.ts`) at
// every moment it has, through the game's OWN renderer (`renderer.ts`).
// A run is ended injured at a spot down the piste (`GoreState.injured` set
// where he stands), the next run is started and drawn, and its clock is
// posed where a frame wants the rescue — the rotor, the wash and the
// gait stepped over the frames between, every sixtieth of a second. The
// PASS view rides instead: the bot skis the next run down past it.
//
// It exposes `window.__rescue.sheet(group, views)`, which shoots the views
// of one group, lays them out on the page as a contact sheet for the
// driver to photograph, and hands back every frame at full size.

import {
  botInput,
  createGame,
  generateLevel,
  placeRun,
  step,
  TUNING,
  type GameState,
  type RegionId,
  type SkyOverride,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { BEARERS, RESCUE, freshRescueFrame, planRescue, rescueAt } from "../game/rescue-plan.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __rescue?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 2);
const share = Number(params.get("at") ?? 0.45);
const region = (params.get("region") || undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 3);
const scale = Number(params.get("scale") ?? 0.5);
const hour = Number(params.get("hour"));
const weather = (params.get("weather") || undefined) as WeatherKind | undefined;
const baseSky: SkyOverride | null =
  Number.isFinite(hour) && params.get("hour") !== null
    ? { hour, ...(weather ? { weather } : {}) }
    : weather
      ? { weather }
      : null;

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

const level = generateLevel(seed, { region });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const pts = level.track.points;
const fell = pts[Math.floor(pts.length * share)];
const plan = planRescue(level, fell);
const A = plan.at;

const fresh = (): GameState =>
  createGame({ level, seed, region, mode: "free", gore: true, crowd: 0, quiet: true });

/** A run ended INJURED where he fell, drawn, then the next one: the
 * rescue's run, its skier stood `back` m up the piste from the spot. */
function nextRun(back: number): GameState {
  const hurt = fresh();
  placeRun(hurt, { x: fell.x, z: fell.z, heading: fell.heading });
  hurt.gore!.injured = 0;
  renderer.draw(hurt, 1, FRAME, false);
  const s = fresh();
  const up = pts.find((p) => p.s >= fell.s - back) ?? pts[0];
  placeRun(s, { x: up.x, z: up.z, heading: up.heading });
  renderer.draw(s, 1, FRAME, false);
  return s;
}

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  if (baseSky) renderer.setSky(baseSky);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  const d = Math.hypot(plan.site.x - plan.spot.x, plan.site.z - plan.spot.z);
  return (
    `fell at s ${fell.s.toFixed(0)} m; machine ${d.toFixed(0)} m off, ` +
    `${(plan.site.y - plan.spot.y).toFixed(1)} m above him; carry ${plan.path.length.toFixed(1)} m; ` +
    `lift-off at ${A.lift.toFixed(1)} s`
  );
})();

let frames: Frame[] = [];
let view = "";
const now = freshRescueFrame();

/** The rescue's clock run on to `t` over frames (the rotor, the wash and
 * the cloud stepped), the player held where he stands. */
function poseAt(s: GameState, t: number, lead = 1.2): void {
  const from = Math.max(t - lead, s.t);
  for (let k = from; k < t; k += FRAME) {
    s.t = k;
    renderer.draw(s, 1, FRAME, false);
  }
  s.t = t;
}

function shoot(s: GameState, label: string, lens: LensPose | "chase"): void {
  if (lens === "chase") {
    if (renderer.camera() !== "chase") renderer.setCamera("chase", true);
    renderer.setOverride(null);
  } else renderer.setOverride(lens);
  renderer.draw(s, 1, 1e-4, true);
  renderer.setOverride(null);
  rescueAt(level, plan, s.t, now);
  frames.push({
    view,
    label,
    caption: `${view} ${label}\nt ${s.t.toFixed(2)} s · ${stage(s.t)}`,
    png: canvas.toDataURL("image/png"),
  });
}

function stage(t: number): string {
  const names: [number, string][] = [
    [A.lift, "lift-off"],
    [A.clear, "walking clear"],
    [A.slide, "slide in"],
    [A.climb, "crew aboard"],
    [A.inch, "over the sill"],
    [A.raise, "raised"],
    [A.carry, "carrying"],
    [A.rise, "lifting"],
    [A.scoop.kneel, "at the corners"],
    [A.scoop.step, "to the corners"],
    [A.scoop.stand, "standing"],
    [A.scoop.strap, "strapping"],
    [A.scoop.back, "laid back"],
    [A.scoop.slide, "board slid"],
    [A.scoop.roll, "log-roll"],
    [A.scoop.assess, "straightened"],
    [A.scoop.turn, "turned to it"],
    [A.scoop.down, "board laid"],
    [0, "walking up"],
  ];
  return names.find(([at]) => t >= at)?.[1] ?? "waiting";
}

/** A lens planted `off` m to the side of a point (its heading's right),
 * `back` m behind it and `up` m over the snow, looking at it. */
function planted(
  p: { x: number; y: number; z: number },
  heading: number,
  right: number,
  back: number,
  up: number,
  fov = 45,
  look = 0.9,
): LensPose {
  const ex = p.x + Math.cos(heading) * right - Math.sin(heading) * back;
  const ez = p.z - Math.sin(heading) * right - Math.cos(heading) * back;
  const ey = Math.max(p.y, level.groundAt(ex, ez)) + up;
  return { eye: { x: ex, y: ey, z: ez }, target: { x: p.x, y: p.y + look, z: p.z }, fov, roll: 0 };
}

/** The middle of the scene: between him and the machine. */
const middle = {
  x: (plan.spot.x + plan.site.x) / 2,
  z: (plan.spot.z + plan.site.z) / 2,
  y: (plan.spot.y + plan.site.y) / 2,
};
const across = Math.atan2(plan.site.x - plan.spot.x, plan.site.z - plan.spot.z);

/** THE SCOOP frame by frame: walked up, the board laid down, the log-roll,
 * the board slid under, laid back, strapped, the corners taken, the lift
 * and the first steps — each moment from every lens asked for: from his
 * feet's end (`side`), from overhead (`above`) and from a chase lens's
 * height off his head's end (`chase`). */
function scoopViews(s: GameState, lenses: readonly ("side" | "above" | "chase")[]): void {
  const Q = A.scoop;
  const T = RESCUE.scoop.time;
  const [p0, p1] = plan.path.pts;
  const h = Math.atan2(p1.x - p0.x, p1.z - p0.z);
  const at = { x: plan.spot.x, y: plan.spot.y, z: plan.spot.z };
  const lens = {
    side: planted(at, h, 0.6, 4.4, 2.6, 45, 0.1),
    above: planted(at, h, 0.4, 0.9, 4.6, 48, 0),
    chase: planted(at, h + Math.PI, -2.6, 6.5, 2.4, 45, 0.3),
  };
  const moments: [string, number][] = [
    ["waiting", -1],
    ["walking up", Q.down * 0.85],
    ["arrived", Q.down],
    ["board down", Q.turn],
    ["turned to it", Q.assess],
    ["straightening", Q.assess + T.assess * 0.5],
    ["rolling", Q.roll + T.roll * 0.5],
    ["on his side", Q.slide],
    ["board sliding", Q.slide + T.slide * 0.5],
    ["board under", Q.back],
    ["laid back", Q.back + T.back * 0.6],
    ["strap 1", Q.strap + T.strap * 0.3],
    ["strapped", Q.stand],
    ["standing", Q.step],
    ["to the corners", Q.step + T.step * 0.6],
    ["knelt at them", A.rise],
    ["lifting", A.rise + RESCUE.time.rise * 0.5],
    ["lifted", A.carry],
    ["first step", A.carry + 0.7],
    ["second step", A.carry + 1.4],
  ];
  for (const which of lenses) {
    view = `scoop-${which}`;
    for (const [label, t] of moments) {
      poseAt(s, Math.max(0, t), 0.4);
      shoot(s, label, lens[which]);
    }
  }
}

const VIEWS: Record<string, (s: GameState) => void> = {
  overview(s) {
    const lens = planted(middle, across, 34, 12, 24, 50, 0);
    for (const [label, t] of [
      ["waiting", -1],
      ["walking up", A.scoop.down * 0.6],
      ["scooping", A.scoop.slide + 1],
      ["lifting", A.rise + 1],
      ["carrying", (A.carry + A.raise) / 2],
      ["at the door", A.raise + 0.5],
      ["loading", A.slide + 1.2],
      ["crew clear", A.lift - 0.5],
      ["hover", A.lift + RESCUE.time.spool + 2.5],
      ["away", A.lift + RESCUE.time.spool + RESCUE.time.hover + 6],
    ] as const) {
      poseAt(s, Math.max(0, t), 2);
      shoot(s, label, lens);
    }
  },
  scoop(s) {
    scoopViews(s, ["side", "above", "chase"]);
  },
  carry(s) {
    const t0 = A.carry + (A.raise - A.carry) * 0.35;
    const stride = 1.1 / RESCUE.walk;
    poseAt(s, t0);
    rescueAt(level, plan, t0, now);
    const st = { ...now.stretcher };
    for (let k = 0; k < 8; k++) {
      const t = t0 + (k / 8) * stride;
      poseAt(s, t, 0.2);
      rescueAt(level, plan, t, now);
      const p = now.stretcher;
      shoot(
        s,
        `stride ${k}/8`,
        planted({ x: p.x, y: p.y - 0.4, z: p.z }, st.heading, 5.5, 0, 0.9, 42, 0.1),
      );
    }
  },
  "carry-front"(s) {
    const t0 = A.carry + (A.raise - A.carry) * 0.5;
    const stride = 1.1 / RESCUE.walk;
    for (let k = 0; k < 4; k++) {
      const t = t0 + (k / 4) * stride;
      poseAt(s, t, 0.3);
      rescueAt(level, plan, t, now);
      const p = now.stretcher;
      shoot(s, `ahead ${k}/4`, planted({ x: p.x, y: p.y - 0.4, z: p.z }, p.heading, 1.5, -6, 1.6));
      shoot(s, `behind ${k}/4`, planted({ x: p.x, y: p.y - 0.4, z: p.z }, p.heading, -2, 6.5, 2));
    }
  },
  load(s) {
    const door = { x: plan.end.x, y: plan.floor, z: plan.end.z };
    const h = Math.atan2(-plan.out.x, -plan.out.z);
    for (const [label, t] of [
      ["at the door", A.raise + 0.2],
      ["raised", A.inch],
      ["over the sill", A.climb],
      ["stepping up", A.climb + RESCUE.time.climb * 0.6],
      ["sliding in", A.slide + RESCUE.time.slide * 0.4],
      ["let go", A.slide + RESCUE.time.slide * 0.7],
      ["in", A.clear + 0.5],
      ["walking clear", A.clear + 4],
      ["watching", A.lift - 0.2],
    ] as const) {
      poseAt(s, t, 0.6);
      shoot(s, label, planted(door, h, 5, 6, 2.2, 50, -0.2));
    }
  },
  lift(s) {
    const lens = planted(plan.site, plan.site.heading, 22, 8, 6, 50, 2);
    for (const [label, t] of [
      ["spooling", A.lift + 0.8],
      ["up", A.lift + RESCUE.time.spool + 1],
      ["hover", A.lift + RESCUE.time.spool + 2.5],
      ["turned", A.lift + RESCUE.time.spool + RESCUE.time.hover],
      ["going", A.lift + RESCUE.time.spool + RESCUE.time.hover + 3],
      ["away", A.lift + RESCUE.time.spool + RESCUE.time.hover + 8],
    ] as const) {
      poseAt(s, t, 1.5);
      shoot(s, label, lens);
    }
  },
};

/** THE PASS: the bot skis the next run down past the rescue, the chase
 * lens behind him, a frame every two seconds. */
function pass(s: GameState): void {
  for (let k = 0; k < 9; k++) {
    for (let f = 0; f < 120; f++) {
      for (let i = 0; i < STEPS; i++) step(s, botInput(s));
      renderer.draw(s, 1, FRAME, false);
    }
    shoot(s, `${s.t.toFixed(0)} s`, "chase");
  }
}

const GROUPS: Record<string, readonly string[]> = {
  site: ["overview"],
  scoop: ["scoop"],
  carry: ["carry", "carry-front"],
  load: ["load"],
  lift: ["lift"],
  pass: ["pass"],
  night: ["night"],
};

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    view = v;
    if (v === "pass") {
      pass(nextRun(RESCUE.reach + 120));
    } else if (v === "night") {
      renderer.setSky({ ...(baseSky ?? {}), hour: 21 });
      await renderer.shadeSettled();
      VIEWS.overview(nextRun(60));
      VIEWS.carry(nextRun(60));
      renderer.setSky(baseSky);
      await renderer.shadeSettled();
    } else {
      VIEWS[v](nextRun(60));
    }
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent =
    `RESCUE — ${group} (${views.join(", ")}) — seed ${seed}${region ? ` ${region}` : ""} at ${share}` +
    `${baseSky ? ` sky ${JSON.stringify(baseSky)}` : ""} — ${tier} — ${BEARERS.length} crew\n${note}`;
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

window.__rescue = { ready, groups: GROUPS, sheet };
