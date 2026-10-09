// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY LAB's page (`scripts/xray-preview.mjs`): a hard blow on a run
// with the INJURIES switch on, run the way the app runs it — the app's own
// X-ray rig (`xray-run.ts`: the read ahead, the director) deciding every
// frame how many steps the run takes and what the lens looks at — and drawn
// through the game's OWN renderer, photographed every `every` wall seconds
// so the whole sequence reads as a strip: the lead in, the bone cracking,
// the pans, the tear, the body, the death.
//
// Nothing reads a wall clock: a frame is a sixtieth of a second by fiat,
// so a seed's sheet is the same sheet twice. It exposes
// `window.__xray.sheet(scene)`.

import {
  botInput,
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  pilotInput,
  placeRun,
  solidsOf,
  step,
  TUNING,
  treesNear,
  type GameState,
  type SkierInput,
} from "@engine";

import { deathOver, diedOf } from "../game/hud-wreck.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";
import { createXrayRun, dying } from "../game/xray-run.ts";
import type { XrayLook, XrayShot } from "../game/xray-shots.ts";
import {
  flatSpot,
  intoTree,
  loneTree,
  ontoSnow,
  ontoTop,
  skiAtTree,
  type Fresh,
  type Stage,
} from "./gore-scenes.ts";

type Frame = { label: string; caption: string; png: string };

declare global {
  interface Window {
    __xray?: {
      ready: Promise<string>;
      scenes: readonly string[];
      sheet(scene: string): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 2);
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.4);
/** Wall seconds between two frames shot, and the most wall seconds run. */
const every = Number(params.get("every") ?? 0.5);
const most = Number(params.get("most") ?? 18);
/** How many times a death is stood up again as the app does it (a new run
 * on the same map, the same renderer and cam) and the scene died again. */
const again = Number(params.get("again") ?? 0);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, "high"),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
renderer.setCamera("chase", true);

const level = generateLevel(seed);
const fresh = (ask: Fresh = false): GameState => {
  const o = typeof ask === "boolean" ? { grimbear: ask } : ask;
  return createGame({
    level,
    seed,
    mode: "free",
    gore: true,
    crowd: 0,
    quiet: true,
    ...(o.grimbear ? { grimbear: "hunt" as const } : {}),
    ...(o.groomer ? { groomer: "on" as const } : {}),
    ...(o.heli ? { heli: true } : {}),
  });
};

/** The gore lab's stagings, borrowed: only `level` and `fresh` are read. */
const stage = { level, fresh } as unknown as Stage;

type Drive = (state: GameState) => SkierInput;
const still: Drive = () => NEUTRAL_INPUT;
/** A run stood up for the cam, and the hands it is ridden on. */
type Scene = { s: GameState; drive?: Drive };

/** Step a run on, undrawn, until `done` or `limit` s. */
function roll(
  s: GameState,
  done: (s: GameState) => boolean,
  limit: number,
  drive = still,
): boolean {
  for (let k = 0; k < limit / TUNING.dt; k++) {
    if (done(s)) return true;
    step(s, drive(s));
  }
  return done(s);
}

const flying =
  (collective: number): Drive =>
  () => ({ ...NEUTRAL_INPUT, heli: { collective, pitch: 0, roll: 0, pedal: 0 } });

/** THE SCENES: a run stood at the moment before a blow — every one a fall
 * he dies of, the only kind the cam is shot for. */
const SCENES: Record<string, () => Scene> = {
  /** Skied at a lone trunk at 108 km/h: the limbs go. */
  "trunk-fast": () => ({ s: skiAtTree(stage, 30, 30).s }),
  /** Flown head first into a trunk at 90 km/h: the head torn off. */
  head: () => ({ s: intoTree(stage, "head", 25).s }),
  /** Thrown flat on his side at 100 km/h, sliding on: the limbs torn off
   * and the trunk burst. */
  slam: () => ({ s: ontoSnow(stage, "left", 28, 8).s }),
  /** FALLEN 200 M: off a cliff on his skis, 200 m over the snow at 15 m/s,
   * and let fall (some 60 m/s when he meets it). */
  fall: () => {
    const s = fresh();
    const p = flatSpot(level);
    placeRun(s, { x: p.x, z: p.z, heading: p.heading, speed: 15, height: 200, vy: 0 });
    const over = (q: GameState) => q.skier.y - level.groundAt(q.skier.x, q.skier.z);
    roll(s, (q) => over(q) < 40, 10);
    return { s };
  },
  /** RUN THROUGH: fallen on his back onto a tree's bare top. */
  spike: () => {
    const t = loneTree(level, 6);
    return { s: ontoTop(stage, t, "back", 6, 4) };
  },
  /** Onto a steel post's top — a mast's or a snow gun's lance. */
  "spike-post": () => {
    const post = solidsOf(level).find(
      (u) => u.stuff === "steel" && u.radius <= 0.16 && u.height < 20,
    );
    return { s: post ? ontoTop(stage, post, "face", 6, 4) : fresh() };
  },
  /** UNDER A PISTE MACHINE: stood in front of a working groomer, run over
   * by its belts and its tiller. */
  groomer: () => {
    const s = fresh({ groomer: true });
    const g = s.groomers![0];
    roll(s, () => false, 0.5);
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    placeRun(s, { x: g.x + fx * 8, z: g.z + fz * 8, heading: g.heading + Math.PI, speed: 4 });
    return { s };
  },
  /** THE GRIMBEAR'S CATCH: skied through his woods until he breaks cover. */
  maul: () => {
    const s = fresh(true);
    s.grimbear!.rng.chance = () => false;
    const pts = level.track.points;
    let from = pts[0];
    const near: number[] = [];
    for (const p of pts)
      if (p.s > 150 && treesNear(level, p.x, p.z, 25, near).length >= 4) {
        from = pts.find((q) => q.s >= p.s - 90) ?? pts[0];
        break;
      }
    placeRun(s, { x: from.x, z: from.z, heading: from.heading, speed: 14 });
    s.grimbear!.wait = 0;
    roll(s, (q) => q.grimbear?.phase === "run", 60, botInput);
    return { s, drive: botInput };
  },
  /** THE HELICOPTER'S BLAST: on its skid, flown up and then let down into
   * the snow — blown apart. */
  heli: () => {
    const s = fresh({ heli: true });
    roll(s, () => false, 6, flying(0.95));
    roll(s, (q) => !!q.heli && q.heli.y - level.groundAt(q.heli.x, q.heli.z) < 12, 40, flying(0.1));
    return { s, drive: flying(0.1) };
  },
  /** INTO THE ROTOR: on the skid, flown up and looped over the top until
   * his grip goes over the disc. */
  rotor: () => {
    const s = fresh({ heli: true });
    const aim = { x: s.heli!.x, z: s.heli!.z, height: 150 };
    roll(
      s,
      () => false,
      30,
      (q) => pilotInput(q, aim),
    );
    const loop: Drive = () => ({
      ...NEUTRAL_INPUT,
      heli: { collective: 0.8, pitch: -1, roll: 0, pedal: 0 },
    });
    roll(s, (q) => (q.heli?.grip ?? 1) < 0.5, 12, loop);
    return { s, drive: loop };
  },
};

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  renderer.draw(first, 1, 1 / 60);
  await renderer.shadeSettled();
  return `${level.trees.length} trees`;
})();

const lookLine = (l: XrayLook | null): string =>
  !l || !l.active
    ? "x-ray off"
    : `${l.kind} · ${l.shot?.kind === "bone" ? `bone ${l.shot.bone}` : (l.shot?.kind ?? "-")} #${l.index} · rate ${l.rate.toFixed(2)} · glass ${l.xray.toFixed(2)}`;

/** THE ANATOMY STILLS: no blow — he stands on his skis, the run held still,
 * the glass all the way in and the lens on one bone after another, circling
 * it, so the skeleton and the organs are seen whole from every side. */
const ANATOMY: readonly XrayShot[] = [
  { kind: "bone", bone: "ribs" },
  { kind: "bone", bone: "thoracic" },
  { kind: "bone", bone: "skull" },
  { kind: "bone", bone: "pelvis" },
  { kind: "body" },
];

async function anatomy(): Promise<Frame[]> {
  const state = fresh();
  const at = (wall: number, index: number): XrayLook => ({
    active: true,
    kind: "xray",
    rate: 0,
    xray: 1,
    back: 0,
    shot: ANATOMY[index],
    age: wall,
    index,
  });
  // A frame under the glass and a moment let by, so the skeleton's chunk is in.
  renderer.setXray(at(0, 0));
  renderer.draw(state, 1, 1 / 60);
  await new Promise((r) => setTimeout(r, 600));
  const frames: Frame[] = [];
  const WALL = 1 / 60;
  const per = most / ANATOMY.length;
  let next = 0;
  for (let wall = 0; wall < most; wall += WALL) {
    const index = Math.min(ANATOMY.length - 1, Math.floor(wall / per));
    const look = at(wall - index * per, index);
    renderer.setXray(look);
    const shoot = wall >= next && wall - index * per > 0.9;
    renderer.draw(state, 1, WALL, shoot);
    if (shoot) {
      next = wall + every;
      frames.push({
        label: `${wall.toFixed(1)}s`,
        caption: `anatomy wall ${wall.toFixed(2)} s\n${lookLine(look)}`,
        png: canvas.toDataURL("image/png"),
      });
    }
  }
  renderer.setXray(null);
  return frames;
}

async function sheet(name: string): Promise<{ frames: Frame[] }> {
  const note = await ready;
  if (name === "anatomy") return lay(name, note, await anatomy());
  const make = SCENES[name];
  if (!make) throw new Error(`no scene "${name}"`);
  let { s: state, drive = still } = make();
  let left = again;
  // One frame drawn and a moment let by, so the skeleton's chunk is in.
  renderer.draw(state, 1, 1 / 60);
  await new Promise((r) => setTimeout(r, 300));
  let look: XrayLook | null = null;
  const xray = createXrayRun((l) => {
    look = l;
    renderer.setXray(l);
  });
  const frames: Frame[] = [];
  const WALL = 1 / 60;
  let acc = 0;
  let wall = 0;
  let next = 0;
  let started = -1;
  for (let f = 0; wall < most; f++) {
    // DIED and its dark run out: a new run, as `App.tsx`'s restart.
    if (left > 0 && deathOver(state)) {
      left--;
      ({ s: state, drive = still } = make());
      started = -1;
    }
    renderer.setDeathCam(dying(state));
    const rate = xray.frame(state, WALL, true);
    // Drawn as the app draws it: on the run's time, at its pace.
    renderer.setPace(rate);
    acc += WALL * rate;
    while (acc >= TUNING.dt) {
      acc -= TUNING.dt;
      step(state, drive(state));
      xray.step(state);
    }
    wall += WALL;
    const l = look as XrayLook | null;
    if (started < 0 && l?.active) started = wall;
    const shoot = wall >= next;
    renderer.draw(state, 1, WALL * rate, shoot);
    if (shoot) {
      next += every;
      // Before the cam takes the run, a frame a second is plenty.
      if (started < 0) next += every;
      const died = diedOf(state);
      frames.push({
        label: `${wall.toFixed(1)}s`,
        caption:
          `${name} wall ${wall.toFixed(2)} s · run ${state.t.toFixed(2)} s\n${lookLine(l)}` +
          `${state.skier.thrown ? " · thrown" : ""}${died !== null ? ` · DIED ${died.toFixed(1)}` : ""}`,
        png: canvas.toDataURL("image/png"),
      });
    }
    // Long after the cam let go, nothing more to see.
    if (started >= 0 && !l?.active && wall > started + 2 && diedOf(state) === null) break;
  }
  renderer.setXray(null);
  return lay(name, note, frames);
}

/** The frames laid out as the page's sheet. */
async function lay(name: string, note: string, frames: Frame[]): Promise<{ frames: Frame[] }> {
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `X-RAY — ${name} — seed ${seed} — every ${every} s of wall\n${note}`;
  header.style.whiteSpace = "pre-wrap";
  const cells: HTMLElement[] = [header];
  for (const fr of frames) {
    const cell = document.createElement("figure");
    const caption = document.createElement("figcaption");
    caption.textContent = fr.caption;
    const img = document.createElement("img");
    img.src = fr.png;
    img.width = tw;
    img.height = th;
    await img.decode();
    cell.append(img, caption);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  return { frames };
}

window.__xray = { ready, scenes: [...Object.keys(SCENES), "anatomy"], sheet };
