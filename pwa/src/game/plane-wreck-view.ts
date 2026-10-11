// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S CRASH AS DRAWN — everything a plane going into the snow
// leaves (`plane.ts`'s `crash`, `defs/plane-wreck.ts`): the airframe TORN
// APART by the kind of crash it was (`plane-shatter.ts`), the FIREBALL its
// fuel goes up in when it struck hard enough to mist it — sized off the
// fuel it had left by the helicopter's law — or the pool lighting with a
// whoomp when it did not, the sparks, embers and shards (`explosion.ts`),
// the POOL FIRE at the wing roots burning down for a minute and more under
// a black column leaning on the wind and the hulk smouldering after it,
// charring black and then to grey ash; the torn wings' spilt tanks burning
// where they lie; the GOUGE the hulk ploughs along its way and the snow it
// throws; the snow round the fire SCORCHED and melted to slush; after dark
// the fire LIGHTING the snow, the trees and the wreck (a lamp slot); and
// THE CRASH'S LENS (`camera-crash.ts`), planted well back off it, cut to
// on the impact and holding on the fire, clear of the trunks.
//
// The wreck is the drawing's own: it stays burning where it came down
// after the ride is begun again on the strip, until its fire is out. Its
// clock is the run's (`GameState.t` since the crash), so a frame stepped on
// without being drawn catches up. Presentation only.

import * as THREE from "three";
import {
  planeFireOf,
  poolHeat,
  windAt,
  type GameState,
  type PlaneFire,
  type PlaneWreck,
  type Wind,
} from "@engine";

import { frameCrash, startCrashCam, wooded, type CrashCam } from "./camera-crash.ts";
import type { LensPose } from "./camera-rigs.ts";
import { createExplosion, type Explosion } from "./explosion.ts";
import type { Flood } from "./headlamp.ts";
import { createPlaneShatter, type ShatterHooks, type WreckParts } from "./plane-shatter.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { SnowSampler } from "./trail-stamp.ts";

/** HOW THE WRECK READS: how long the hulk takes to char black, s, and how
 * black (`hot`); how far the thrown pieces char, and over how long; how
 * long after the fuel is gone the hottest has burnt to grey ash, s; the
 * scorch against the pool's radius; the gouge's width, m; the fire's
 * light after dark (a flood's power at its full blaze, its colour, how far
 * over the pool it stands, m); how long the drawing outlives the fire, s. */
export const WRECK_LOOK = {
  charTime: 14,
  hot: 0.97,
  cool: 0.4,
  coolTime: 30,
  ashTime: 40,
  scorch: 3.2,
  gouge: 3.4,
  light: { power: 4.5, colour: [1.0, 0.46, 0.14] as const, up: 3 },
  linger: 10,
} as const;

export type PlaneWreckView = {
  group: THREE.Group;
  /** It goes in: `machine` drawn at the wreck's pose, `parts` the airframe
   * under it, at the run's clock `t`. */
  burst(
    state: GameState,
    machine: THREE.Object3D,
    parts: WreckParts,
    wreck: PlaneWreck,
    lens: LensPose | null,
  ): void;
  /** One frame: the pieces, the fire and the snow, for an eye at `eye`. */
  frame(
    state: GameState,
    dt: number,
    eye: { x: number; y: number; z: number },
    cloud: SnowCloud | null,
    snowAt: SnowSampler | null,
  ): void;
  /** THE CRASH'S LENS this frame while it holds the picture, else null. */
  lens(state: GameState, dt: number): LensPose | null;
  /** After dark, the fire's light into `out`. */
  lamps(lit: number, out: Flood[]): void;
  /** Whether a wreck is drawn. */
  live(): boolean;
  /** Where the hulk lies this frame (the fire's heart), or null. */
  heart(): THREE.Vector3 | null;
  clear(): void;
  dispose(): void;
};

/** The gouge's mark: churned snow, its ploughed walls throwing blue
 * shadow, streaked along the way, sooted toward the end it stopped at. */
function gougeTexture(): THREE.Texture {
  const w = 64;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  let s = 0x60c6e;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  // The trough's shadowed floor, ragged at its edges.
  for (let y = 0; y < h; y += 2) {
    const edge = 8 + rand() * 7;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(70,90,120,0)");
    g.addColorStop(edge / w, "rgba(70,90,120,0.42)");
    g.addColorStop(0.5, "rgba(95,110,135,0.28)");
    g.addColorStop(1 - edge / w, "rgba(70,90,120,0.42)");
    g.addColorStop(1, "rgba(70,90,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, 2);
  }
  // Furrows along it and torn clods.
  for (let i = 0; i < 26; i++) {
    const x = 6 + rand() * (w - 12);
    ctx.strokeStyle = `rgba(50,62,85,${0.15 + rand() * 0.25})`;
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rand() - 0.5) * 8, h);
    ctx.stroke();
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(${40 + rand() * 30},${50 + rand() * 30},${70 + rand() * 30},${0.2 + rand() * 0.4})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
  }
  // Soot and oil toward the end it came to rest at (the top of the map).
  const soot = ctx.createLinearGradient(0, 0, 0, h * 0.4);
  soot.addColorStop(0, "rgba(20,16,12,0.55)");
  soot.addColorStop(1, "rgba(20,16,12,0)");
  ctx.fillStyle = soot;
  ctx.fillRect(0, 0, w, h * 0.4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlaneWreckView(): PlaneWreckView {
  const group = new THREE.Group();
  group.name = "plane-wreck";
  const shatter = createPlaneShatter();
  group.add(shatter.group);
  let boom: Explosion | null = null;
  let fire: PlaneFire | null = null;
  let wreck: PlaneWreck | null = null;
  let since = 0;
  let crash: CrashCam | null = null;
  /** The run the wreck belongs to: a new run clears it. */
  let owner: GameState | null = null;
  const heart = new THREE.Vector3();
  const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
  const flood: Flood = {
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: -1,
    dz: 0,
    colour: WRECK_LOOK.light.colour,
    beam: [-2, -1.5, -3, 0],
    power: 0,
  };
  let blaze = 0;
  let clock = 0;
  // THE GOUGE: a strip draped over the snow from where it struck to where
  // the hulk stopped.
  const gougeTex = gougeTexture();
  const gougeGeo = new THREE.PlaneGeometry(1, 1, 1, 24);
  const gougeMat = new THREE.MeshBasicMaterial({
    map: gougeTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    side: THREE.DoubleSide,
    fog: false,
  });
  const gouge = new THREE.Mesh(gougeGeo, gougeMat);
  gouge.visible = false;
  gouge.renderOrder = 1;
  group.add(gouge);
  let hooks: ShatterHooks = { flame() {}, strike() {}, plough() {} };
  // A stream of its own for the snow it throws, so a lab's frame is the
  // same frame twice.
  let seed = 0x9e3779b9;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function clear(): void {
    wreck = null;
    fire = null;
    crash = null;
    owner = null;
    shatter.clear();
    boom?.clear();
    gouge.visible = false;
    flood.power = 0;
  }

  function layGouge(state: GameState, w: PlaneWreck): void {
    const end = shatter.rest();
    const dx = end.x - w.x;
    const dz = end.z - w.z;
    const len = Math.max(5, Math.hypot(dx, dz) + 4);
    const fx =
      Math.hypot(dx, dz) > 0.5 ? dx / Math.hypot(dx, dz) : Math.sin(Math.atan2(w.vx, w.vz));
    const fz =
      Math.hypot(dx, dz) > 0.5 ? dz / Math.hypot(dx, dz) : Math.cos(Math.atan2(w.vx, w.vz));
    const pos = gougeGeo.getAttribute("position") as THREE.BufferAttribute;
    const half = WRECK_LOOK.gouge / 2;
    for (let i = 0; i < pos.count; i++) {
      // The plane's own (u across, v along from the far end): laid from
      // just short of the impact to just past the rest.
      const across = pos.getX(i) * 2 * half;
      const along = (pos.getY(i) + 0.5) * len - 2;
      const x = w.x + fx * along - fz * across;
      const z = w.z + fz * along + fx * across;
      pos.setXYZ(i, x - w.x, state.level.groundAt(x, z) + 0.08 - w.y, z - w.z);
    }
    pos.needsUpdate = true;
    gougeGeo.computeBoundingSphere();
    gouge.position.set(w.x, w.y, w.z);
    gouge.visible = true;
  }

  return {
    group,
    burst(state, machine, parts, w, lens) {
      owner = state;
      wreck = w;
      seed = 0x9e3779b9;
      since = state.t;
      fire = planeFireOf(w.fuel, w.speed, w.kind);
      const groundAt = (x: number, z: number) => state.level.groundAt(x, z);
      shatter.burst(machine, parts, w, groundAt);
      boom?.dispose();
      if (boom) group.remove(boom.group);
      boom = createExplosion({
        pool: {
          radius: fire.radius,
          flame: fire.flame,
          flames: 40 * (fire.radius / 2.6) ** 0.7,
          girth: 0.8,
          core: 0.6,
          smoke: 10 * (fire.radius / 2.6) ** 2,
          embers: 14 * (fire.radius / 2.6),
          plume: 11,
        },
        scorch: fire.radius * WRECK_LOOK.scorch,
        melt: true,
      });
      group.add(boom.group);
      const g = groundAt(w.x, w.z);
      boom.burst(w.x, Math.max(g, w.y - 0.5), w.z, w.speed, w.vx, w.vz, {
        diameter: fire.diameter,
        life: fire.life,
      });
      layGouge(state, w);
      // THE CRASH'S LENS: only when he went in with it — planted off where
      // the hulk will lie.
      const rest = shatter.rest();
      const at = { x: rest.x, y: groundAt(rest.x, rest.z), z: rest.z };
      crash =
        w.aboard && lens
          ? startCrashCam(lens, at, groundAt, (e, a) => wooded(state.level, e, a), {
              ball: fire.diameter,
              ballAt: { x: w.x, y: g, z: w.z },
            })
          : null;
      clock = 0;
    },
    frame(state, dt, eye, cloud, snowAt) {
      if (!wreck || !fire || !boom) return;
      if (state !== owner) {
        clear();
        return;
      }
      const age = state.t - since;
      if (age > fire.out + WRECK_LOOK.linger) {
        clear();
        return;
      }
      clock += dt;
      const groundAt = (x: number, z: number) => state.level.groundAt(x, z);
      const b = boom;
      const snow = (x: number, z: number) => (snowAt ? snowAt(x, z) : null);
      hooks = {
        flame: (x, y, z, heat, step) => b.flame(x, y, z, heat, step),
        strike: (x, y, z, speed) => {
          b.strike(x, y, z, speed);
          const s = snow(x, z);
          if (s) cloud?.burst(x, y + 0.3, z, 0, 0, Math.min(1.1, speed / 18), s);
        },
        plough: (x, y, z, speed, dx, dz) => {
          // Thinned: the bow wave reads as a spray along the slide, never a
          // wall of white over the fire behind it.
          if (!cloud || speed < 4 || random() > 0.07) return;
          // The bow wave of snow off the hulk ploughing on, out to both sides.
          const side = random() < 0.5 ? -1 : 1;
          cloud.blow(
            x + dx * 3 - dz * side * 1.5,
            y + 0.6,
            z + dz * 3 + dx * side * 1.5,
            dx * speed * 0.6 - dz * side * speed * 0.3,
            2 + speed * 0.15,
            dz * speed * 0.6 + dx * side * speed * 0.3,
            1.2 + speed * 0.03,
          );
        },
      };
      shatter.update(age, groundAt, hooks);
      shatter.heart(heart);
      const L = WRECK_LOOK;
      const burnt = Math.max(0, (age - fire.burns * 0.7) / L.ashTime);
      shatter.char(
        L.hot * Math.min(1, age / L.charTime),
        L.cool * Math.min(1, age / L.coolTime),
        Math.min(1, burnt),
      );
      blaze = poolHeat(fire, age);
      const ground = groundAt(heart.x, heart.z);
      b.burning(blaze > 0, heart.x, ground, heart.z, blaze);
      windAt(state.level, state.t, wind);
      b.wind(wind.x * 0.8, wind.z * 0.8);
      b.update(dt, groundAt, eye);
      // The fire's light: the flash and the ball, then the pool's flicker.
      const flick = 0.82 + 0.12 * Math.sin(clock * 9.3) + 0.06 * Math.sin(clock * 23.1);
      const flash = Math.min(3, b.light().power / 6);
      flood.x = heart.x;
      flood.y = ground + L.light.up;
      flood.z = heart.z;
      flood.power = L.light.power * Math.max(flash, Math.sqrt(blaze) * flick);
    },
    lens(state, dt) {
      if (!crash || !wreck || !state.plane || state.plane.mode !== "wreck") {
        crash = null;
        return null;
      }
      const groundAt = (x: number, z: number) => state.level.groundAt(x, z);
      const at = { x: heart.x, y: groundAt(heart.x, heart.z), z: heart.z };
      return frameCrash(crash, at, dt, groundAt, (e, a) => wooded(state.level, e, a));
    },
    lamps(lit, out) {
      if (!wreck || lit <= 0 || (flood.power ?? 0) < 0.01) return;
      out.push({ ...flood, power: (flood.power ?? 0) * lit });
    },
    live: () => wreck !== null,
    heart: () => (wreck ? heart : null),
    clear,
    dispose() {
      shatter.dispose();
      boom?.dispose();
      gougeTex.dispose();
      gougeGeo.dispose();
      gougeMat.dispose();
    },
  };
}
