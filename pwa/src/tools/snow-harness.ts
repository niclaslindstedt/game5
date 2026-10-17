// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW LAB's page (`scripts/snow-preview.mjs`): one spot of a mountain's
// loose snow beside its piste at every AGE of the snow (`snow-age.ts`) — the
// map's own, new, settled, old, wind-packed, sun-crusted, hoar and wet —
// through the game's OWN renderer, one contact sheet a lens, so the kinds
// are judged side by side from the same place under the same sun:
//
//   down   off the piste at eye height, looking down the fall line
//   sun    looking INTO the sun over the snow: the glare and the glints
//   away   the sun at the lens's back: the snow's own colour
//   near   close in at a skier's knee: the grain, the ripples, the cups
//   far    from forty metres up across the face: the aspects (a crust on
//          the sunny side, hoar in the shade) and the snow at range
//
// and two sheets of the PISTE THROUGH THE DAY (`piste-tracks.ts`) — the
// groomer at the spot from the first chair to the last, the other skiers'
// tracks printed on it and churned through the afternoon:
//
//   piste      down the piste at eye height
//   pistenear  close in at the snow
//   pistetop   from fourteen metres over it, looking down (the piste runs
//              up the frame)
//
// The skier stands on the piste at the spot, for scale. It exposes
// `window.__snow.sheet(group, views)`, which shoots one lens's views, lays
// them out as a contact sheet for the driver to photograph, and hands back
// every frame at full size.

import {
  createGame,
  generateLevel,
  pisteDayOf,
  airTempAt,
  slopeAltitudeOf,
  NEUTRAL_INPUT,
  placeRun,
  step,
  sunAtRun,
  trackPointAt,
  TUNING,
  withSky,
  type GameState,
  type RegionId,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { tracksOf } from "../game/piste-tracks.ts";
import { SNOW_AGE_KINDS, snowAgeOf, type SnowAgeKind } from "../game/snow-age.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __snow?: {
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
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.5);
/** How far down the piste the spot is, as a share of its length. */
const at = Number(params.get("at") ?? 0.3);
const weather = (params.get("weather") || "clear") as WeatherKind;
const hourParam = params.get("hour");
const tempParam = params.get("temp");

/** Each tile: the map's own age, then every forced one. */
const AGES: readonly ("map" | SnowAgeKind)[] = ["map", ...SNOW_AGE_KINDS];
const LENSES = ["down", "sun", "away", "near", "far"] as const;
type LensId = (typeof LENSES)[number];
/** THE PISTE THROUGH THE DAY (`piste-tracks.ts`): the groomer at the spot
 * at each of these solar hours, from the first chair to the last. */
const HOURS = [8.5, 9.5, 11, 13, 15, 16.5] as const;
const PISTE_LENSES = ["piste", "pistenear", "pistetop"] as const;
type PisteLens = (typeof PISTE_LENSES)[number];
const GROUPS: Record<string, readonly string[]> = {
  ...Object.fromEntries(LENSES.map((l) => [l, AGES.map((a) => `${l}-${a}`)])),
  ...Object.fromEntries(PISTE_LENSES.map((l) => [l, HOURS.map((h) => `${l}-${h}`)])),
};

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
const hour = hourParam !== null ? Number(hourParam) : level.sun.hour;
const sky = { weather, hour, ...(tempParam !== null ? { temp: Number(tempParam) } : {}) };
const lit = withSky(level, sky);
const sun = sunAtRun(lit);
const spot = trackPointAt(level, level.track.length * at);
// Off the piste: across it past its edge, into the loose snow — the open
// spot either side, a little up or down it, furthest from any trunk.
const { ox, oz } = (() => {
  let best = { ox: spot.x, oz: spot.z, clear: -1 };
  for (const ds of [-30, -15, 0, 15, 30]) {
    const p = trackPointAt(level, spot.s + ds);
    for (const side of [-1, 1]) {
      for (const extra of [10, 16, 24, 34]) {
        const off = side * (p.width * 0.5 + extra);
        const x = p.x - Math.cos(p.heading) * off;
        const z = p.z + Math.sin(p.heading) * off;
        let clear = Infinity;
        for (const t of level.trees) clear = Math.min(clear, Math.hypot(t.x - x, t.z - z));
        if (clear > best.clear) best = { ox: x, oz: z, clear };
      }
    }
  }
  return best;
})();
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);

/** A free ride on the map under the lab's sky, the skier on the piste at the spot. */
function ride(): GameState {
  const s = createGame({
    level,
    seed,
    region,
    mode: "free",
    sky,
    groomer: "off",
    crowd: 0,
    quiet: true,
  });
  s.level = level;
  placeRun(s, { x: spot.x, z: spot.z, heading: spot.heading });
  for (let i = 0; i < STEPS * 3; i++) step(s, NEUTRAL_INPUT);
  return s;
}

/** A lens at the spot off the piste. */
function lensOf(id: LensId): LensPose {
  const g = level.groundAt;
  const ground = (x: number, z: number) => ({ x, y: g(x, z), z });
  // The fall line here, off the ground's own slope.
  const e = 2;
  const gx = (g(ox + e, oz) - g(ox - e, oz)) / (2 * e);
  const gz = (g(ox, oz + e) - g(ox, oz - e)) / (2 * e);
  const gl = Math.hypot(gx, gz) || 1;
  const fall = { x: -gx / gl, z: -gz / gl };
  const toSun = { x: Math.sin(sun.azimuth), z: Math.cos(sun.azimuth) };
  const eyeAt = (h: number) => ({ x: ox, y: g(ox, oz) + h, z: oz });
  const ahead = (d: { x: number; z: number }, m: number) => ground(ox + d.x * m, oz + d.z * m);
  switch (id) {
    case "down":
      return { eye: eyeAt(1.7), target: ahead(fall, 22), fov: 55, roll: 0 };
    case "sun":
      // Low over the snow toward the sun, so the field before it grazes.
      return { eye: eyeAt(1.7), target: ahead(toSun, 45), fov: 60, roll: 0 };
    case "away":
      return { eye: eyeAt(1.7), target: ahead({ x: -toSun.x, z: -toSun.z }, 16), fov: 55, roll: 0 };
    case "near": {
      const d = { x: -fall.z, z: fall.x };
      return {
        eye: { x: ox - d.x * 1.2, y: g(ox - d.x * 1.2, oz - d.z * 1.2) + 1.1, z: oz - d.z * 1.2 },
        target: ahead(d, 2.2),
        fov: 50,
        roll: 0,
      };
    }
    case "far": {
      const back = { x: -fall.x * 70, z: -fall.z * 70 };
      const ex = ox + back.x + fall.z * 30;
      const ez = oz + back.z - fall.x * 30;
      return {
        eye: { x: ex, y: g(ex, ez) + 40, z: ez },
        target: ahead(fall, 60),
        fov: 60,
        roll: 0,
      };
    }
  }
}

/** A lens on the piste at the spot: down it at eye height, or close in. */
function pisteLens(id: PisteLens): LensPose {
  const g = level.groundAt;
  const at = (ds: number, side: number, h: number) => {
    const p = trackPointAt(level, spot.s + ds);
    const x = p.x - Math.cos(p.heading) * side;
    const z = p.z + Math.sin(p.heading) * side;
    return { x, y: g(x, z) + h, z };
  };
  if (id === "pistetop") return { eye: at(-1, 0, 14), target: at(0, 0, 0), fov: 60, roll: 0 };
  return id === "piste"
    ? { eye: at(-8, 4, 1.7), target: at(22, -1, 0), fov: 55, roll: 0 }
    : { eye: at(-1, 2.5, 1.2), target: at(3.5, 0, 0), fov: 55, roll: 0 };
}

/** The piste's tracks at an hour, for the caption. */
function trackLine(h: number): string {
  const day = pisteDayOf(withSky(level, { ...sky, hour: h }));
  const t = tracksOf(day.skied);
  return `${day.skied.toFixed(1)} h skied  lines ${t.many.toFixed(2)} churn ${t.churn.toFixed(2)}`;
}

const ready = (async () => {
  const first = ride();
  await renderer.load(first);
  renderer.setSky(sky);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  const own = snowAgeOf(lit);
  return (
    `${weather} at ${hour.toFixed(1)} h, sun ${((sun.elevation * 180) / Math.PI).toFixed(0)}° up, ` +
    `day ${level.sun.dayOfYear}, lat ${level.sun.latitude.toFixed(1)}, ` +
    `air ${airTempAt(lit, undefined, slopeAltitudeOf(lit)).toFixed(1)} °C on the slopes — ` +
    `the map's own snow: ${own.days.toFixed(1)} days since the fall`
  );
})();

/** The figures an age stands at, for the caption. */
function line(age: "map" | SnowAgeKind): string {
  const a = snowAgeOf(lit, { force: age === "map" ? null : age });
  const f = (n: number) => n.toFixed(2);
  return (
    `${a.days.toFixed(1)} d  new ${f(a.fresh)} old ${f(a.old)} wind ${f(a.wind)}\n` +
    `crust ${f(a.crust)} hoar ${f(a.hoar)} wet ${f(a.wet)}`
  );
}

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  const frames: Frame[] = [];
  const s = ride();
  if ((PISTE_LENSES as readonly string[]).includes(group)) {
    for (const view of views) {
      const h = Number(view.slice(group.length + 1));
      renderer.setSky({ ...sky, hour: h });
      renderer.setOverride(pisteLens(group as PisteLens));
      renderer.draw(s, 1, FRAME, true);
      renderer.draw(s, 1, FRAME, true);
      renderer.setOverride(null);
      frames.push({
        view,
        label: `${h} h`,
        caption: `${h.toFixed(1)} h [${group}]\n${trackLine(h)}`,
        png: canvas.toDataURL("image/png"),
      });
    }
    renderer.setSky(sky);
    return lay(group, note, frames);
  }
  const lens = group as LensId;
  if (!LENSES.includes(lens)) throw new Error(`no sheet "${group}"`);
  for (const view of views) {
    const age = view.slice(group.length + 1) as "map" | SnowAgeKind;
    renderer.setSnow(null, age === "map" ? null : age);
    renderer.setOverride(lensOf(lens));
    renderer.draw(s, 1, FRAME, true);
    renderer.draw(s, 1, FRAME, true);
    renderer.setOverride(null);
    frames.push({
      view,
      label: age,
      caption: `${age.toUpperCase()} [${lens}]\n${line(age)}`,
      png: canvas.toDataURL("image/png"),
    });
  }
  renderer.setSnow(null, null);
  return lay(lens, note, frames);
}

/** Lays the frames out as a contact sheet. */
async function lay(lens: string, note: string, frames: Frame[]): Promise<{ frames: Frame[] }> {
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `SNOW — ${lens} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__snow = { ready, groups: GROUPS, sheet };
