// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWMOBILE ON FIRE AS DRAWN (`engine/game/sled-fire.ts`): the machine
// that ploughed through a bonfire coming out of it ALIGHT — flames off its
// belly pan, its engine bay under the hood, its tank under the seat and the
// tunnel, licking higher as its fuse burns down, black smoke streaming off
// it on the way it goes — then the TANK GOING UP: the fireball (sized off
// the fuel it burns by the helicopter's law, `fireballOf`), the flash, the
// sparks and embers, the snow round it thrown up and out by the shock; and
// the WRECK left burning as a pool fire under a black column, the machine
// charred to soot with embers glowing in it, burning down over its
// minutes, its light on the snow after dark. A fresh machine at the bottom
// wipes it.
//
// And THE BLAST THROUGH HIS OWN EYES (`camera-blast.ts`): a rider who saw
// it go from the cockpit is left in his own head as it throws him, and the
// picture takes the fire's heat, flash and smoke (`blaze`, the grade
// pass's). Safe for work nothing here is ever built: the engine lets no
// machine catch.
//
// Its clock is the run's (`GameState.t`). Presentation only.

import * as THREE from "three";
import { SLED, SLED_FIRE, fireballOf, windAt, type GameState, type Wind } from "@engine";

import { blastHolds, blastLens, blazeOf, type Blaze } from "./camera-blast.ts";
import type { LensPose } from "./camera-rigs.ts";
import { createExplosion, type Explosion, type ExplosionLook } from "./explosion.ts";
import type { Flood } from "./headlamp.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { SnowSampler } from "./trail-stamp.ts";

/** HOW IT READS: the pool the wreck burns in (`ExplosionLook`); the
 * points of the machine that burn, body frame (x right, y up, z forward,
 * m, its centre of mass the origin) and each one's share of the fire; how
 * long the pool takes to burn down to a smoulder after the blast, s, and
 * how long it keeps its full heat, s; how far its paint chars before the
 * blast and how long the char takes after it, s; the fire's light after
 * dark (a flood's power at its full blaze, its colour, how far up it
 * stands, m). */
export const SLED_FIRE_LOOK = {
  pool: {
    radius: 1.5,
    flame: 4.5,
    flames: 34,
    smoke: 16,
    embers: 12,
    plume: 7,
    girth: 0.55,
    core: 0.75,
  },
  scorch: 5,
  points: [
    { x: 0, y: -0.38, z: 0.4, share: 1 },
    { x: 0, y: 0.05, z: 1.05, share: 0.8 },
    { x: 0, y: 0.15, z: -0.25, share: 0.9 },
    { x: 0.4, y: -0.3, z: 0.6, share: 0.6 },
    { x: -0.4, y: -0.3, z: 0.6, share: 0.6 },
    { x: 0, y: -0.1, z: -1.2, share: 0.5 },
  ],
  full: 6,
  burns: SLED_FIRE.wreck.lasts * 0.85,
  charBefore: 0.35,
  charTime: 10,
  light: { power: 3.5, colour: [1.0, 0.46, 0.14] as const, up: 2 },
} as const;

/** The pool's heat `age` s after the blast, 0..1. */
export function wreckHeat(age: number): number {
  const L = SLED_FIRE_LOOK;
  if (age < 0) return 0;
  if (age < L.full) return 1;
  const k = Math.max(0, 1 - (age - L.full) / (L.burns - L.full));
  return k ** 0.7;
}

export type SledFireView = {
  group: THREE.Group;
  /** One frame: the machine `at` as drawn (null with none), `char` the
   * hook its paint is burnt by, `eyes` whether the lens is his own eyes
   * (TIPS, HELMET) this frame, `alpha` how far between two steps. */
  frame(
    state: GameState,
    dt: number,
    alpha: number,
    at: { x: number; y: number; z: number; q: THREE.Quaternion } | null,
    eyes: boolean,
    char: (k: number, ember: number) => void,
    cloud: SnowCloud | null,
    snowAt: SnowSampler,
  ): void;
  /** THE LENS IN HIS HEAD while the blast holds it, else null. */
  lens(): LensPose | null;
  /** The picture's heat, flash and smoke, or null: `own` whether the lens
   * that has the picture is this view's or his own eyes. */
  blaze(own: boolean): Blaze | null;
  /** After dark, the fire's light into `out`; the fire and smoke sorted
   * and stepped for an eye at `eye`. */
  lamps(lit: number, eye: { x: number; y: number; z: number }, out: Flood[]): void;
  dispose(): void;
};

const look = (): Partial<ExplosionLook> => ({
  pool: { ...SLED_FIRE_LOOK.pool },
  scorch: SLED_FIRE_LOOK.scorch,
  melt: true,
});

export function createSledFireView(): SledFireView {
  const group = new THREE.Group();
  group.name = "sled-fire";
  const boom: Explosion = createExplosion(look());
  boom.clear();
  group.add(boom.group);
  const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
  const flood: Flood = {
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: -1,
    dz: 0,
    colour: SLED_FIRE_LOOK.light.colour,
    beam: [-2, -1.5, -3, 0],
    power: 0,
  };
  const p = new THREE.Vector3();
  let owner: GameState | null = null;
  /** The blast this view has shown (its run time), −1 none yet. */
  let shownBoom = -1;
  let live = false;
  let clock = 0;
  let lastDt = 0;
  let groundAt = (_x: number, _z: number): number => 0;
  // THE BLAST LENS: begun on the frame the tank went up under a rider
  // watching through his own eyes.
  let blast: LensPose | null = null;
  let blastOn = false;
  let blazeNow: Blaze | null = null;
  let eyesNow = false;

  function clear(char?: (k: number, ember: number) => void): void {
    boom.clear();
    live = false;
    shownBoom = -1;
    blast = null;
    blastOn = false;
    blazeNow = null;
    flood.power = 0;
    char?.(0, 0);
  }

  return {
    group,
    frame(state, dt, alpha, at, eyes, char, cloud, snowAt) {
      eyesNow = eyes;
      lastDt = dt;
      groundAt = (x, z) => state.level.groundAt(x, z);
      if (state !== owner) {
        owner = state;
        clear(char);
      }
      const b = state.sled?.burn;
      if (!b) {
        if (live) clear(char);
        return;
      }
      live = true;
      clock += dt;
      const L = SLED_FIRE_LOOK;
      const fuse = Math.min(1, (state.t - b.t) / SLED_FIRE.fuse);
      const since = b.boom >= 0 ? state.t - b.boom : -1;
      // IT GOES UP: the ball, the flash, the snow thrown out by the shock.
      if (b.boom >= 0 && shownBoom !== b.boom) {
        shownBoom = b.boom;
        const s = state.sled!;
        const g = groundAt(b.x, b.z);
        const way = Math.hypot(s.vx, s.vz) > 0.5 ? { x: s.vx, z: s.vz } : { x: 0, z: 0 };
        boom.burst(
          b.x,
          g + 0.3,
          b.z,
          b.speed,
          way.x,
          way.z,
          fireballOf(SLED.fuel * SLED_FIRE.ball),
        );
        const snow = snowAt(b.x, b.z);
        for (let i = 0; i < 3; i++)
          cloud?.burst(b.x, g + 0.4, b.z, way.x * 0.2, way.z * 0.2, 1.8, snow);
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const sx = Math.sin(a);
          const sz = Math.cos(a);
          cloud?.blow(b.x + sx * 2.5, g + 0.6, b.z + sz * 2.5, sx * 16, 2, sz * 16, 1.8);
        }
        blastOn = eyes && state.skier.thrown?.cause === "blast";
      }
      // The machine's own flames off its points as drawn.
      const heat = since < 0 ? 0.25 + 0.5 * fuse : wreckHeat(since);
      // Through his own eyes over the bars the flames under the hood are
      // half an arm's length off: drawn thinner, or they are all he sees.
      const close = eyes && !!state.sled?.rider ? 0.4 : 1;
      if (at) {
        for (const pt of L.points) {
          p.set(pt.x, pt.y, pt.z).applyQuaternion(at.q);
          const h = heat * pt.share * (since < 0 ? close : 0.7);
          if (h > 0.05) boom.flame(at.x + p.x, at.y + p.y, at.z + p.z, h, dt);
        }
      }
      // The wreck's pool under it, once the tank has split.
      const wx = at?.x ?? b.x;
      const wz = at?.z ?? b.z;
      const wy = groundAt(wx, wz);
      boom.burning(since >= 0 && heat > 0.02, wx, wy, wz, heat);
      windAt(state.level, state.t, wind);
      boom.wind(wind.x * 0.8, wind.z * 0.8);
      char(
        since < 0 ? L.charBefore * fuse : Math.min(1, L.charBefore + since / L.charTime),
        since < 0 ? 0.4 * fuse : heat,
      );
      const flick = 0.82 + 0.12 * Math.sin(clock * 9.3) + 0.06 * Math.sin(clock * 23.1);
      const flash = Math.min(3, boom.light().power / 6);
      flood.x = wx;
      flood.y = wy + L.light.up;
      flood.z = wz;
      flood.power = L.light.power * Math.max(flash, Math.sqrt(heat) * flick);
      // THE BLAST THROUGH HIS EYES while it holds.
      const t = state.skier.thrown;
      if (blastOn && t && t.cause === "blast" && blastHolds(since, t.still)) {
        blast = blastLens(t.points, t.last, alpha, since, groundAt);
      } else {
        blastOn = false;
        blast = null;
      }
      // The picture's blaze: on the cockpit before the blast, in his head
      // after it, and while he lies burning with his own eyes on.
      const riding = !!state.sled?.rider;
      const near = riding || blastOn || (eyes && since >= 0 && since < 3 && t?.cause === "blast");
      blazeNow = near ? blazeOf(fuse, since, !!state.burn?.burning) : null;
    },
    lens: () => blast,
    blaze(own) {
      if (!blazeNow) return null;
      return own || eyesNow ? blazeNow : null;
    },
    lamps(lit, eye, out) {
      boom.dusk(lit);
      if (live || boom.light().power > 0) boom.update(lastDt, groundAt, eye);
      if (!live || lit <= 0 || (flood.power ?? 0) < 0.01) return;
      out.push({ ...flood, power: (flood.power ?? 0) * lit });
    },
    dispose() {
      boom.dispose();
    },
  };
}
