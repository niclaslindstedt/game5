// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE'S LOOK — the layout of the largest groomer class as it
// is drawn, laid over `GROOMER`'s measures (`engine/game/defs/groomer.ts`):
// where the belts' idler, sprocket and road wheels stand, the cab's glass
// and roof, the engine's housing behind it, the deck and its rail, the
// blade's sections and its push frame, the tiller's drum, hood and the
// finisher mat trailing behind it, and every LAMP. Traced off side, front
// and rear photographs of current machines of the class (kept local, never
// committed, no make named) and scaled to the class's published overall
// height and length.
//
// ONE LAYOUT, TWO DRAWINGS: the Blender builder (`scripts/blender/
// groomer.py`, handed this table by `scripts/blender/kinds/groomer.mjs`)
// models the machine off it, and the game hangs its lamps' glow, its
// lamps' light and its code-built stand-in (`groomer-build.ts`) on the very
// same points (`groomer-view.ts`, `groomer-scene.ts`) — so a lamp's glare
// sits on the model's lens.
//
// The frame is the engine's: x right, y up, z forward, the origin on the
// snow under the middle of the tracks. Three-free and DOM-free.

import { GROOMER } from "@engine";

const K = GROOMER;

/** Each belt's middle, right of the machine's middle, m. */
const BELT_X = K.tracks.span / 2 - K.tracks.width / 2;
/** The cab roof's top, m: the class's overall height less the lamp bars. */
const ROOF = K.roof - 0.13;

/** One lamp: its lens's middle, its lens's size (w × h, m), the way it
 * faces (`front` +z, `rear` −z, `side` out to its own side), which BAR it
 * belongs to (what the scene lights it with), and its glow's size, m. */
export type GroomerLamp = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  face: "front" | "rear" | "side";
  bar: "roof" | "nose" | "blade" | "rear" | "tiller" | "side";
  glow: number;
};

/** A row of `n` lamps `pitch` apart about `x0`. */
function row(n: number, pitch: number, x0: number, rest: Omit<GroomerLamp, "x">): GroomerLamp[] {
  return Array.from({ length: n }, (_, i) => ({ ...rest, x: x0 + (i - (n - 1) / 2) * pitch }));
}

export const GROOMER_LOOK = {
  /** THE BELTS: the idler forward and low, the drive sprocket aft and a
   * little higher, the road wheels between, m (z along, y up, r); each
   * belt's rubber's thickness, the cleats' pitch round the loop, their
   * height off the rubber and their depth along it, and how many rubber
   * bands make up a belt's width (the cleats bolted across them). */
  belt: {
    x: BELT_X,
    width: K.tracks.width,
    idler: { z: 2.17, y: 0.535, r: 0.5 },
    sprocket: { z: -2.15, y: 0.56, r: 0.52 },
    wheels: { z: [-1.42, -0.71, 0, 0.71, 1.42], y: 0.355, r: 0.32 },
    rubber: 0.035,
    pitch: 0.22,
    cleat: { height: 0.055, depth: 0.05 },
    bands: 6,
  },
  /** THE HULL: its keel between the belts (the gap between them is 0.9 m),
   * its belly over the snow (the ground clearance), and over the belts'
   * top run the deck plate the cab and the hood stand on — the class's
   * 2.5 m width without its tracks — from `top` to `plate`, and its ends, m. */
  hull: { keel: 0.42, half: 1.25, belly: 0.35, top: 1.2, plate: 1.3, front: 2.45, back: -2.4 },
  /** THE CAB, forward on the hull: its half width, the lower panel's top
   * (the glass's sill) at its front and back, the windscreen's foot and
   * head (raked back), the back wall, and the roof — its top and its
   * overhang ahead of the screen, m. */
  cab: {
    half: 1.06,
    floor: 1.3,
    sill: { front: 1.62, back: 1.8 },
    screen: { foot: 2.42, head: 2.2 },
    back: 0.62,
    roof: ROOF,
    lip: 0.14,
  },
  /** THE ENGINE'S HOUSING behind the cab: from the cab's back wall aft,
   * its crown's height and its half width, m — a tall rounded hood. */
  hood: { front: 0.6, back: -1.15, crown: K.roof - 0.1, half: 0.98, shoulder: 1.7 },
  /** THE DECK aft of the hood, its floor and its rail's height, m. */
  deck: { front: -1.15, back: -2.35, floor: 1.55, rail: 0.55 },
  /** THE BLADE: the hinge its push frame turns about (a node of its own),
   * its wings' tips (`GROOMER.blade.ahead` — the middle section stands back
   * of them by the wings' swing), its middle section's width, its wings
   * swung forward by `wing` rad, its height, the snow guard at its top and
   * the moldboard's depth, m. */
  blade: {
    hinge: { y: 0.62, z: 1.7 },
    face: K.blade.ahead,
    middle: 3.2,
    wing: 0.38,
    height: K.blade.height,
    guard: 0.3,
    depth: 0.42,
  },
  /** THE TILLER: the hitch it hangs from (a node of its own), its drum's
   * middle and radius and its cutting width, the hood over it, the
   * finisher mat trailing to `GROOMER.tiller.behind`, its width with the
   * side finishers out, m. */
  tiller: {
    hitch: { y: 0.95, z: -2.45 },
    drum: { y: 0.36, z: -3.55, r: 0.34, width: 4.6 },
    hood: { r: 0.62 },
    mat: { from: -3.95, to: -K.tiller.behind, width: K.tiller.width },
  },
  /** THE BEACON: an amber dome on the roof's back corner, its middle, m. */
  beacon: { x: -0.62, y: ROOF + 0.1, z: 0.95 },
  /** THE LAMPS: the roof's front bar (two pods of four over the screen),
   * the nose's four headlights low on the cab's front, the blade's pair on
   * its guard, the roof's rear bar over the tiller and the tiller's pair
   * on its hood, the side lamps on the cab's flanks. */
  lamps: [
    ...row(4, 0.17, -0.55, {
      y: ROOF + 0.07,
      z: 2.3,
      w: 0.14,
      h: 0.12,
      face: "front",
      bar: "roof",
      glow: 1.5,
    }),
    ...row(4, 0.17, 0.55, {
      y: ROOF + 0.07,
      z: 2.3,
      w: 0.14,
      h: 0.12,
      face: "front",
      bar: "roof",
      glow: 1.5,
    }),
    ...[-0.86, -0.62, 0.62, 0.86].map((x): GroomerLamp => ({
      x,
      y: 1.36,
      z: 2.47,
      w: 0.2,
      h: 0.12,
      face: "front",
      bar: "nose",
      glow: 1.7,
    })),
    ...[-1.9, 1.9].map((x): GroomerLamp => ({
      x,
      y: K.blade.height + 0.14,
      z: K.blade.ahead - 0.42,
      w: 0.2,
      h: 0.14,
      face: "front",
      bar: "blade",
      glow: 1.3,
    })),
    ...row(4, 0.42, 0, {
      y: ROOF + 0.05,
      z: 0.52,
      w: 0.16,
      h: 0.12,
      face: "rear",
      bar: "rear",
      glow: 1.4,
    }),
    ...[-1.6, 1.6].map((x): GroomerLamp => ({
      x,
      y: 0.98,
      z: -3.75,
      w: 0.16,
      h: 0.1,
      face: "rear",
      bar: "tiller",
      glow: 1.1,
    })),
    ...[-1, 1].map((s): GroomerLamp => ({
      x: s * 1.08,
      y: ROOF - 0.12,
      z: 1.7,
      w: 0.14,
      h: 0.1,
      face: "side",
      bar: "side",
      glow: 1.0,
    })),
  ] as readonly GroomerLamp[],
  /** The tail lights low on the deck's back corners, m. */
  tail: { x: 0.95, y: 1.4, z: -2.37 },
} as const;

/** WHERE THE LIGHT COMES FROM, the machine's frame — what the scene deals
 * to the lamp slots (`groomer-scene.ts`): the roof's front bar's middle,
 * aimed ahead and down at the snow before the blade; the rear bar's, aimed
 * back and down at the tiller and the swath; the beacon's, turning. */
export const GROOMER_LAMPS = {
  front: { y: ROOF + 0.07, z: 2.3, down: 0.42 },
  rear: { y: ROOF + 0.05, z: 0.52, down: 0.55 },
  beacon: { x: GROOMER_LOOK.beacon.x, y: GROOMER_LOOK.beacon.y, z: GROOMER_LOOK.beacon.z },
} as const;
