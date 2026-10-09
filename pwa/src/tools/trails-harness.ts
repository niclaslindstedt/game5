// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRAILS LAB's page (`scripts/trails-preview.mjs`): the furrow a skier
// cuts, by HOW DEEP THE SNOW IS, through the game's OWN renderer over a
// free ride this page steps itself, every sixtieth of a second:
//
//   bands   one sheet a row a depth — the groomer (a carve's pencil lines),
//           settled powder at the ordinary dial (a soft trough a boot
//           deep), and a metre of fresh (a trench) — each track cut by the
//           same scripted turns and seen from behind it, from above it and
//           close at a skier's knee;
//   low     the same three under a low sun, where a trough's walls read or
//           do not;
//   night   the deep trench under the headlamp.
//
// A track is cut by the engine itself (`step` under a scripted steer, so
// the stations, the sink, the edge and the skid are the physics' own) on a
// stretch of the map the page picks: on the piste for the groomer, and off
// it on an open, treeless slope for the powder. Nothing reads a wall clock,
// so a seed's sheet is the same sheet twice.
//
// It exposes `window.__trails.sheet(group, views)`, which shoots the views
// of one group, lays them out as a contact sheet for the driver to
// photograph, and hands back every frame at full size.

import {
  createGame,
  generateLevel,
  nearestTrackPoint,
  placeRun,
  step,
  trackPointAt,
  TUNING,
  type GameState,
  type RegionId,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };
type Vec = { x: number; y: number; z: number };

/** THE BANDS: where a track is cut and at which snow dial. */
const BANDS = {
  groomed: { dial: 1, piste: true, word: "the groomer" },
  powder: { dial: 1, piste: false, word: "settled powder, the ordinary dial" },
  deep: { dial: 2.5, piste: false, word: "a metre of fresh, dial 2.5" },
} as const;
type Band = keyof typeof BANDS;

const GROUPS: Record<string, readonly string[]> = {
  bands: ["groomed", "powder", "deep"],
  low: ["groomed-low", "powder-low", "deep-low"],
  night: ["deep-night"],
};

declare global {
  interface Window {
    __trails?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = (params.get("region") || undefined) as RegionId | undefined;
const hour = Number(params.get("hour") ?? 11);
const lowHour = Number(params.get("low") ?? 15.5);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 3);
const scale = Number(params.get("scale") ?? 0.5);

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

const map = generateLevel(seed, { region });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;

function fresh(dial: number): GameState {
  return createGame({
    level: map,
    seed,
    region,
    mode: "free",
    snowDepth: dial,
    crowd: 0,
    groomer: "off",
    quiet: true,
  });
}

/** Where a track starts and which way it runs. */
type Start = { x: number; z: number; heading: number };

/** ON THE PISTE: a third of the way down, down its heading. */
function pisteStart(s: GameState): Start {
  const p = trackPointAt(s.level, s.level.track.length * 0.35);
  return { x: p.x, z: p.z, heading: p.heading };
}

/** OFF IT: an open slope of 12–25° clear of the piste and of every trunk
 * for some way, down its fall line. */
function powderStart(s: GameState): Start {
  const lv = s.level;
  const n = { x: 0, y: 1, z: 0 };
  let best: Start | null = null;
  let score = -Infinity;
  for (let gx = 80; gx < lv.size - 80; gx += 9) {
    for (let gz = 80; gz < lv.size - 80; gz += 9) {
      if (lv.packedAt(gx, gz) > 0.02) continue;
      lv.normalAt(gx, gz, n);
      const slope = Math.atan(Math.hypot(n.x, n.z) / n.y);
      if (slope < 0.2 || slope > 0.42) continue;
      const near = nearestTrackPoint(lv, gx, gz);
      if (Math.hypot(near.x - gx, near.z - gz) < 35) continue;
      const fall = Math.atan2(n.x, n.z);
      // Clear of trunks along the 50 m it is skied, and the lens beside it.
      let clear = true;
      for (const t of lv.trees) {
        const dx = t.x - gx;
        const dz = t.z - gz;
        const along = dx * Math.sin(fall) + dz * Math.cos(fall);
        const across = dx * Math.cos(fall) - dz * Math.sin(fall);
        if (along > -16 && along < 62 && Math.abs(across) < 16) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      // Packed nowhere along it either.
      let packed = 0;
      for (let k = 0; k < 60; k += 6) {
        packed = Math.max(packed, lv.packedAt(gx + Math.sin(fall) * k, gz + Math.cos(fall) * k));
      }
      if (packed > 0.02) continue;
      const sc = -Math.abs(slope - 0.3) - Math.hypot(gx - lv.size / 2, gz - lv.size / 2) * 1e-4;
      if (sc > score) {
        score = sc;
        best = { x: gx, z: gz, heading: fall };
      }
    }
  }
  if (!best) throw new Error("no open powder slope on this map");
  return best;
}

/** THE TRACK: placed at speed and skied by the engine under a slow
 * sine of a steer — linked turns — for `seconds`, every frame drawn so the
 * renderer stamps what the stations touch. Returns where he went. */
function cut(s: GameState, at: Start, seconds: number): Vec[] {
  placeRun(s, { x: at.x, z: at.z, heading: at.heading, speed: 11 });
  const path: Vec[] = [];
  const n = Math.round(seconds / FRAME);
  for (let k = 0; k < n; k++) {
    const t = k * FRAME;
    const steer = 0.75 * Math.sin((t * Math.PI * 2) / 2.6);
    for (let i = 0; i < STEPS; i++) {
      step(s, { steer, tuck: 0.2, brake: 0.25, lean: 0, reset: false });
    }
    renderer.draw(s, 1, FRAME, false);
    path.push({ x: s.skier.x, y: s.skier.y, z: s.skier.z });
  }
  return path;
}

function lens(eye: Vec, target: Vec, fov = 50): LensPose {
  return { eye, target, fov, roll: 0 };
}

let frames: Frame[] = [];
let view = "";
const notes: string[] = [];

function shoot(s: GameState, label: string, pose: LensPose, extra = "", hero = false): void {
  // The skier and what he threw are out of the way of his own track.
  renderer.setHidden(hero ? [] : ["field", "hero", "cloud", "spray"]);
  renderer.setOverride(pose);
  renderer.draw(s, 1, STILL, true);
  renderer.setOverride(null);
  renderer.setHidden([]);
  frames.push({
    view,
    label,
    caption: `${view} ${label}${extra ? `\n${extra}` : ""}`,
    png: canvas.toDataURL("image/png"),
  });
}

/** A band's track cut and photographed three ways under the sky set. */
async function band(b: Band, night = false): Promise<void> {
  const def = BANDS[b];
  const s = fresh(def.dial);
  await renderer.load(s);
  const at = def.piste ? pisteStart(s) : powderStart(s);
  const path = cut(s, at, 4.5);
  const last = path[path.length - 1];
  const mid = path[Math.floor(path.length * 0.55)];
  const early = path[Math.floor(path.length * 0.2)];
  const fx = Math.sin(at.heading);
  const fz = Math.cos(at.heading);
  const g = (x: number, z: number) => s.level.groundAt(x, z);
  const sink = Math.max(...s.skier.contacts.map((c) => c.sink));
  const extra = `${def.word} — sink ${sink.toFixed(2)} m at the end, ${s.skier.speed.toFixed(1)} m/s`;
  if (night) {
    placeRun(s, { x: mid.x - fx * 3, z: mid.z - fz * 3, heading: at.heading });
    shoot(s, "the headlamp on it", chase(s), extra, true);
    return;
  }
  // From below, looking back up the track.
  const below = { x: last.x + fx * 4, z: last.z + fz * 4 };
  shoot(
    s,
    "from below, looking back up it",
    lens(
      { ...below, y: g(below.x, below.z) + 1.7 },
      { x: early.x, y: g(early.x, early.z), z: early.z },
    ),
    extra,
  );
  // Steeply from above and to the side.
  const side = { x: mid.x - fz * 6 - fx * 2, z: mid.z + fx * 6 - fz * 2 };
  shoot(
    s,
    "from above, to the side",
    lens({ ...side, y: g(side.x, side.z) + 6 }, { x: mid.x, y: g(mid.x, mid.z), z: mid.z }, 55),
  );
  // Close, at a skier's knee beside it.
  const knee = { x: mid.x - fz * 1.6 + fx * 2.5, z: mid.z + fx * 1.6 + fz * 2.5 };
  shoot(
    s,
    "close, at a skier's knee",
    lens(
      { ...knee, y: g(knee.x, knee.z) + 0.55 },
      { x: mid.x - fx * 1.5, y: g(mid.x, mid.z) - 0.1, z: mid.z - fz * 1.5 },
      60,
    ),
  );
  notes.push(`${b}: start ${at.x.toFixed(0)}, ${at.z.toFixed(0)}`);
}

/** The chase lens's pose stood behind the skier where he stands now. */
function chase(s: GameState): LensPose {
  const k = s.skier;
  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  const eye = {
    x: k.x - fx * 4,
    y: s.level.groundAt(k.x - fx * 4, k.z - fz * 4) + 2,
    z: k.z - fz * 4,
  };
  return lens(eye, {
    x: k.x + fx * 6,
    y: s.level.groundAt(k.x + fx * 6, k.z + fz * 6),
    z: k.z + fz * 6,
  });
}

const VIEWS: Record<string, () => Promise<void>> = {
  groomed: () => band("groomed"),
  powder: () => band("powder"),
  deep: () => band("deep"),
  "groomed-low": () => withHour(lowHour, () => band("groomed")),
  "powder-low": () => withHour(lowHour, () => band("powder")),
  "deep-low": () => withHour(lowHour, () => band("deep")),
  "deep-night": () => withHour(21, () => band("deep", true)),
};

async function withHour(h: number, work: () => Promise<void>): Promise<void> {
  renderer.setSky({ hour: h });
  await renderer.shadeSettled();
  await work();
  renderer.setSky({ hour });
  await renderer.shadeSettled();
}

const ready = (async () => {
  const first = fresh(1);
  await renderer.load(first);
  renderer.setSky({ hour });
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  return `seed ${seed}, hour ${hour} (low ${lowHour})`;
})();

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  notes.length = 0;
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent =
    `TRAILS — ${group} (${views.join(", ")}) — ${region ?? "alpine"} — ${tier}\n${note}` +
    (notes.length ? `\n${notes.join("; ")}` : "");
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

window.__trails = { ready, groups: GROUPS, sheet };
