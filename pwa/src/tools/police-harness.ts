// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE LAB's page (`scripts/police-preview.mjs`): the police on the
// run after a DEATH (`police-plan.ts`, drawn by `rescue-view.ts` and
// `police-view.ts`) at every moment it has, through the game's OWN renderer.
// A run is ended DEAD down the piste — struck at a spot (the point of
// impact, the run's last wipeout), thrown on 22 m to where he lies (his body
// flung onto the snow there by the real engine and drawn until he is dead
// and still, so he is left lying as the game leaves a dead rider —
// `gore-view.ts`' remains — and the recovery is seen to take THAT body),
// blood left on the snow, an arm torn off and both skis gone on — booked as
// the app books it (`rescue-book.ts`), and the next run is drawn with its
// clock posed where a frame wants the scene: the rotor, the wash and the
// gait stepped over the frames between, every sixtieth of a second.
//
// It exposes `window.__police.sheet(group, views)`, which shoots the views
// of one group, lays them out as a contact sheet for the driver to
// photograph, and hands back every frame at full size.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  placeRun,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type LoneSki,
  type RegionId,
  type SkyOverride,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { PHOTO, POLICE } from "../game/police-defs.ts";
import { freshPoliceFrame, planPolice, policeAt, type PolicePlan } from "../game/police-plan.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { bookRun, createRescueBook, noteImpact } from "../game/rescue-book.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { throwAt } from "./gore-scenes.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __police?: {
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
const pts = level.track.points;
const hit = pts[Math.floor(pts.length * share)];
const lay = pts.find((p) => p.s >= hit.s + 22) ?? hit;
/** A place `k` of the way from the impact to him, `off` m to the piste's right. */
const between = (k: number, off: number) => {
  const x = hit.x + (lay.x - hit.x) * k + Math.cos(hit.heading) * off;
  const z = hit.z + (lay.z - hit.z) * k - Math.sin(hit.heading) * off;
  return { x, y: level.groundAt(x, z), z };
};

const fresh = (): GameState =>
  createGame({ level, seed, region, mode: "free", gore: true, crowd: 0, quiet: true });

/** A lone ski lying at `p`, along the way down. */
function skiAt(p: { x: number; y: number; z: number }, side: number): LoneSki {
  const h = hit.heading + side * 0.6;
  const dx = Math.sin(h) * 0.85;
  const dz = Math.cos(h) * 0.85;
  const ends = [p.x + dx, p.y + 0.02, p.z + dz, p.x - dx, p.y + 0.02, p.z - dz];
  return {
    side,
    held: 0,
    mount: 0.45,
    ends,
    last: [...ends],
    kick: [0, 0, 0, 0, 0, 0],
    up: [0, 1, 0],
    spin: 0,
    touching: 3,
    hooked: 0,
    hook: [0, 0, 0, 0, 0, 0],
    tried: 0,
  };
}

/** How he died, for the sheet's header. */
let died = "";

/** HIS BODY flung onto the snow where he lies, by the engine, and drawn
 * every frame until he is dead and has lain still a moment — the frames the
 * renderer leaves him lying from. */
function flung(): GameState {
  const dead = fresh();
  const g0 = level.groundAt(lay.x, lay.z);
  const v = { x: Math.sin(lay.heading) * 5, y: -30, z: Math.cos(lay.heading) * 5 };
  throwAt(dead, lay.x, lay.z, lay.heading + 0.5, "back", v, g0, 0.3);
  const steps = Math.round(FRAME / TUNING.dt);
  for (let f = 0; f < 60 * 14; f++) {
    for (let i = 0; i < steps; i++) step(dead, NEUTRAL_INPUT);
    renderer.draw(dead, 1, FRAME, false);
    const g = dead.gore!;
    if (g.dead >= 0 && dead.t - g.dead > 2.5) break;
  }
  // One frame put on the screen: the skin's bones are posed by a render, and
  // the remains are baked off the bones the last render posed.
  renderer.draw(dead, 1, FRAME);
  const g = dead.gore!;
  died = g.dead >= 0 ? `dead (${g.cause}) at ${g.dead.toFixed(1)} s` : "not dead: marked dead";
  if (g.dead < 0) g.dead = dead.t;
  return dead;
}

/** THE RUN THAT ENDED DEAD: struck at the impact, lying 22 m on, blood on
 * the snow, an arm off and both skis gone on — then the next run, its call
 * booked as the app books it. */
function deathRun(): { next: GameState; plan: PolicePlan } {
  renderer.clearBodies();
  const dead = flung();
  dead.events = [
    { kind: "wipeout", t: 40, cause: "tree", speed: 24, x: hit.x, z: hit.z } as GameEvent,
  ];
  noteImpact(dead);
  const g = dead.gore!;
  const smear = between(0.12, 1.5);
  g.smears.push({
    what: "limb",
    point: 0,
    t: 40,
    x: smear.x,
    y: smear.y,
    z: smear.z,
    nx: 0,
    ny: 1,
    nz: 0,
    cx: smear.x,
    cz: smear.z,
    r: 0,
  });
  const arm = between(0.5, -2.5);
  g.torn.push({ piece: "armL", t: 40, ...arm, vx: 0, vy: 0, vz: 0, pulped: true });
  const lost = [skiAt(between(0.7, 3), -1), skiAt(between(0.85, -1.5), 1)];
  if (dead.skier.thrown) dead.skier.thrown.skis = lost;
  else dead.skier.thrown = fakeThrown(lost);
  const next = fresh();
  const up = pts.find((p) => p.s >= lay.s - 70) ?? pts[0];
  placeRun(next, { x: up.x, z: up.z, heading: up.heading });
  bookRun(createRescueBook(), dead, next);
  const call = next.rescue![0];
  const plan = planPolice(level, {
    x: call.casualties[0].x,
    z: call.casualties[0].z,
    evidence: call.evidence ?? [],
  });
  return { next, plan };
}

/** A thrown body lying at `lay` with `skis` gone on: only what the book
 * reads of one (his hips, the skis). */
function fakeThrown(skis: LoneSki[]): GameState["skier"]["thrown"] {
  const y = level.groundAt(lay.x, lay.z) + 0.15;
  const points: number[] = [];
  for (let i = 0; i < 13; i++) points.push(lay.x, y, lay.z);
  return { points, last: [...points], skis } as unknown as GameState["skier"]["thrown"];
}

let run: { next: GameState; plan: PolicePlan } | null = null;

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  if (baseSky) renderer.setSky(baseSky);
  renderer.draw(first, 1, FRAME);
  run = deathRun();
  renderer.draw(run.next, 1, FRAME, false);
  // The police helicopter's model loaded before any frame wants it.
  await new Promise((done) => setTimeout(done, 4000));
  await renderer.shadeSettled();
  const p = run.plan;
  const d = Math.hypot(p.flight.site.x - lay.x, p.flight.site.z - lay.z);
  const at = Object.entries(p.at)
    .map(([k, v]) => `${k} ${v.toFixed(0)}`)
    .join(" · ");
  return (
    `${died}; ${p.markers.length} markers (${p.markers.map((m) => m.what).join(", ")}), ${p.ring.length} stakes; ` +
    `machine ${d.toFixed(0)} m off; on the snow ${(p.at.lift - p.flight.down).toFixed(0)} s\n${at}`
  );
})();

let frames: Frame[] = [];
let view = "";
const now = freshPoliceFrame();

/** The call's clock run on to `t` over frames (the rotor, the wash, the
 * gait stepped). */
function poseAt(s: GameState, t: number, lead = 1.2): void {
  const from = Math.max(t - lead, s.t);
  for (let k = from; k < t; k += FRAME) {
    s.t = k;
    renderer.draw(s, 1, FRAME, false);
  }
  s.t = t;
}

function stage(plan: PolicePlan, t: number): string {
  const a = plan.at;
  const names: [number, string][] = [
    [a.lift, "lift-off"],
    [a.recover, "recovery"],
    [a.taped, "cordoned"],
    [a.cordon, "taping"],
    [a.survey, "survey"],
    [a.out, "officers out"],
    [plan.flight.down, "down"],
    [-Infinity, "inbound"],
  ];
  return names.find(([at]) => t >= at)![1];
}

function shoot(s: GameState, label: string, lens: LensPose): void {
  renderer.setOverride(lens);
  renderer.draw(s, 1, 1e-4, true);
  renderer.setOverride(null);
  policeAt(level, run!.plan, s.t, now);
  const fl = now.scene.flash.power > 0.05 ? ` · flash ${now.scene.flash.power.toFixed(2)}` : "";
  frames.push({
    view,
    label,
    caption: `${view} ${label}\nt ${s.t.toFixed(2)} s · ${stage(run!.plan, s.t)}${fl}`,
    png: canvas.toDataURL("image/png"),
  });
}

/** A lens at `eye` looking at `at` (`look` m over its snow). */
function lens(
  eye: { x: number; z: number; up: number },
  at: { x: number; z: number },
  look = 0.9,
  fov = 50,
): LensPose {
  const ey = Math.max(level.groundAt(eye.x, eye.z), level.groundAt(at.x, at.z)) + eye.up;
  return {
    eye: { x: eye.x, y: ey, z: eye.z },
    target: { x: at.x, y: level.groundAt(at.x, at.z) + look, z: at.z },
    fov,
    roll: 0,
  };
}

/** A point `d` m from `p` along heading `h`. */
const off = (p: { x: number; z: number }, h: number, d: number) => ({
  x: p.x + Math.sin(h) * d,
  z: p.z + Math.cos(h) * d,
});

const VIEWS: Record<string, (s: GameState, plan: PolicePlan) => void> = {
  /** THE MACHINE FLOWN IN and the three out of its door. */
  arrive(s, plan) {
    const site = plan.flight.site;
    const mid = { x: (site.x + lay.x) / 2, z: (site.z + lay.z) / 2 };
    const h = Math.atan2(site.x - lay.x, site.z - lay.z) + Math.PI / 2;
    const eye = { ...off(mid, h, 34), up: 9 };
    for (const [label, t] of [
      ["inbound", plan.flight.down - 10],
      ["hover", plan.flight.down - 3],
      ["down", plan.flight.down + 0.5],
      ["out of the door", plan.at.out + 2.5],
      ["to the impact", plan.at.out + 8],
    ] as const) {
      poseAt(s, t, 1.5);
      shoot(s, label, lens(eye, mid, 2));
    }
    const near = { ...off(site, site.heading + Math.PI / 2 + 0.5, 11), up: 2.2 };
    poseAt(s, plan.at.out + 3, 0.5);
    shoot(s, "livery, near", lens(near, site, 1.4, 55));
  },
  /** THE SURVEY: the two walking from the impact down to him. */
  survey(s, plan) {
    const h = hit.heading + Math.PI / 2;
    const mid = { x: (hit.x + lay.x) / 2, z: (hit.z + lay.z) / 2 };
    const eye = { ...off(mid, h, 16), up: 4 };
    for (const k of [0.1, 0.5, 0.95]) {
      const t = plan.at.survey + k * (plan.at.cordon - plan.at.survey);
      poseAt(s, t, 0.8);
      shoot(s, `${(k * 100).toFixed(0)} %`, lens(eye, mid, 0.6, 55));
    }
  },
  /** THE CORDON going up, wide, from outside it. */
  cordon(s, plan) {
    const mid = { x: (hit.x + lay.x) / 2, z: (hit.z + lay.z) / 2 };
    const eye = { ...off(mid, hit.heading + 2.3, 30), up: 7 };
    for (const k of [0.05, 0.3, 0.55, 0.8, 1.02]) {
      const t = plan.at.cordon + k * (plan.at.taped - plan.at.cordon);
      poseAt(s, t, 0.8);
      shoot(s, `${(k * 100).toFixed(0)} %`, lens(eye, mid, 0.5, 52));
    }
    // A stake and its tape close up.
    const p = plan.ring[1];
    poseAt(s, plan.at.taped + 2, 0.4);
    const out = Math.atan2(p.x - mid.x, p.z - mid.z);
    shoot(s, "a stake, close", lens({ ...off(p, out + 0.8, 3.2), up: 1.3 }, p, 0.85, 50));
  },
  /** THE MARKERS: knelt at, and a tent close up with its number. */
  markers(s, plan) {
    const ms = plan.markers;
    for (const m of [ms[0], ms[Math.floor(ms.length / 2)], ms[ms.length - 1]]) {
      poseAt(s, m.placed + 0.5, 0.6);
      const eye = { ...off(m, m.facing + 0.9, 4.5), up: 1.8 };
      shoot(s, `#${m.n} ${m.what}, knelt`, lens(eye, m, 0.3, 45));
    }
    poseAt(s, plan.at.recover - 3, 0.4);
    for (const m of [ms[0], ms[1]]) {
      const eye = { ...off(m, m.facing, 0.75), up: 0.32 };
      shoot(s, `#${m.n} close`, lens(eye, m, 0.08, 40));
    }
    const mid = { x: (hit.x + lay.x) / 2, z: (hit.z + lay.z) / 2 };
    shoot(s, "every marker", lens({ ...off(mid, hit.heading + 1.9, 13), up: 2.4 }, mid, 0, 50));
  },
  /** THE PHOTOGRAPHS and their flashes: a corner's overall, a close-up. */
  flash(s, plan) {
    const fl = plan.flashes;
    const picks = [fl[0], fl[3], fl[8], fl[fl.length - 1]];
    for (const f of picks) {
      poseAt(s, f.t - 0.5, 0.6);
      const k = policeAt(level, plan, f.t, freshPoliceFrame()).crew[PHOTO];
      const eye = { ...off(k, k.heading + 2.2, 5), up: 2.2 };
      s.t = f.t + 0.012;
      shoot(s, `flash at ${f.t.toFixed(1)} s`, lens(eye, k, 1.2, 50));
      s.t = f.t - 0.25;
      shoot(s, `just before`, lens(eye, k, 1.2, 50));
    }
  },
  /** THE RECOVERY: the bag carried in, taken over, laid beside him and
   * opened, him rolled onto it, the lid over him, carried, loaded, gone —
   * wide, then close on him. */
  recover(s, plan) {
    const trip = plan.flight.trips[0];
    const A = trip.plan.at;
    const T = trip.offset;
    const c = plan.carry;
    const arrive = c.t1;
    const mid = { x: (plan.flight.site.x + lay.x) / 2, z: (plan.flight.site.z + lay.z) / 2 };
    const eye = { ...off(mid, hit.heading - 1.9, 24), up: 7 };
    for (const [label, t] of [
      ["bag carried in", c.t0 + (c.t1 - c.t0) * 0.6],
      ["taken over", arrive + 0.6],
      ["carried", (T + A.carry + T + A.raise) / 2],
      ["loading", T + A.slide + 1],
      ["lift-off", plan.at.lift + 5],
    ] as const) {
      poseAt(s, t, 1.2);
      shoot(s, label, lens(eye, mid, 0.5, 55));
    }
    // Close on him: the same lens from the board's far side, a little up.
    const sp = trip.plan.spot;
    const h = Math.atan2(trip.plan.path.pts[1].x - sp.x, trip.plan.path.pts[1].z - sp.z);
    const near = { ...off(sp, h + 1.25, 4.4), up: 2.5 };
    const ca = {
      x: sp.x + Math.sin(h + Math.PI / 2) * 0.3,
      z: sp.z + Math.cos(h + Math.PI / 2) * 0.3,
    };
    for (const [label, t] of [
      ["close: carried in", arrive - 2.5],
      ["close: taken over", arrive + 1.2],
      ["close: kit gathered", plan.kit.t0 + 1.4],
      ["close: kit carried off", plan.kit.t1 + 1.6],
      ["close: lying, crew up", T + A.scoop.turn - 0.3],
      ["close: bag open beside", T + A.scoop.assess + 1],
      ["close: rolled", T + A.scoop.slide + 0.6],
      ["close: onto the bag", T + A.scoop.back + 1.2],
      ["close: lid coming over", T + A.scoop.strap + 1.3],
      ["close: lid down", T + A.scoop.strap + 2.6],
      ["close: zipped", T + A.scoop.stand + 0.3],
      ["close: lifted", T + A.carry + 0.5],
    ] as const) {
      poseAt(s, t, 0.4);
      shoot(s, label, lens(near, ca, 0.2, 48));
    }
    // Under the tape: each span lifted over the bag where it is carried in.
    for (const g of plan.carry.gates) {
      const n = plan.ring.length;
      const [p, q] = [plan.ring[g.span], plan.ring[(g.span + 1) % n]];
      const at = { x: p.x + (q.x - p.x) * g.u, z: p.z + (q.z - p.z) * g.u };
      const across = Math.atan2(q.x - p.x, q.z - p.z);
      poseAt(s, g.t, 0.3);
      shoot(
        s,
        `under the tape`,
        lens({ ...off(at, across + Math.PI / 2, 7), up: 1.6 }, at, 1.1, 55),
      );
    }
    poseAt(s, T + A.scoop.stand + 0.5, 0.3);
    const b = { x: sp.x, z: sp.z };
    shoot(s, "the bag, close", lens({ ...off(b, h + 2.2, 2.6), up: 1.3 }, b, 0.1, 50));
  },
  /** THE WHOLE SCENE FROM ABOVE, laid out: straight down over the
   * cordon's middle, and oblique. */
  above(s, plan) {
    const n = plan.ring.length;
    const mid = plan.ring.reduce((a, p) => ({ x: a.x + p.x / n, z: a.z + p.z / n }), {
      x: 0,
      z: 0,
    });
    let reach = 0;
    for (const p of plan.ring) reach = Math.max(reach, Math.hypot(p.x - mid.x, p.z - mid.z));
    const up = Math.max(24, reach * 1.6);
    for (const [label, t] of [
      ["taping", (plan.at.cordon + plan.at.taped) / 2],
      ["laid out", plan.at.recover - 2],
    ] as const) {
      poseAt(s, t, 0.8);
      shoot(s, label, lens({ ...off(mid, hit.heading + 0.4, 2), up }, mid, 0, 55));
      shoot(
        s,
        `${label}, oblique`,
        lens({ ...off(mid, hit.heading + 2.4, reach * 1.4), up: reach * 0.9 }, mid, 0, 55),
      );
    }
    // From high up, as before: the scene and the machine.
    const site = plan.flight.site;
    const all = { x: (mid.x * 2 + site.x) / 3, z: (mid.z * 2 + site.z) / 3 };
    shoot(
      s,
      "laid out, from 70 m",
      lens({ ...off(all, hit.heading + 0.4, 6), up: 70 }, all, 0, 55),
    );
  },
};

const GROUPS: Record<string, readonly string[]> = {
  arrive: ["arrive"],
  survey: ["survey"],
  cordon: ["cordon"],
  markers: ["markers"],
  flash: ["flash"],
  recover: ["recover"],
  above: ["above"],
  night: ["night"],
};

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    view = v;
    run = deathRun();
    renderer.draw(run.next, 1, FRAME, false);
    if (v === "night") {
      renderer.setSky({ ...(baseSky ?? {}), hour: 21 });
      await renderer.shadeSettled();
      VIEWS.flash(run.next, run.plan);
      run = deathRun();
      VIEWS.above(run.next, run.plan);
      renderer.setSky(baseSky);
      await renderer.shadeSettled();
    } else VIEWS[v](run.next, run.plan);
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent =
    `POLICE — ${group} (${views.join(", ")}) — seed ${seed}${region ? ` ${region}` : ""} at ${share}` +
    `${baseSky ? ` sky ${JSON.stringify(baseSky)}` : ""} — ${tier} — margin ${POLICE.cordon.margin} m\n${note}`;
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

window.__police = { ready, groups: GROUPS, sheet };
