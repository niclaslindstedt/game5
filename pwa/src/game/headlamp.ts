// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HEADLAMP — the lamp strapped to the front of every skier's helmet,
// lit when the light goes; and THE LAMP SLOTS, every lamp in the world
// dealt to the uniforms the snow, the woods, the falling snow and the snow
// cloud are lit by (`haze.ts`'s `lampReach`).
//
// RESEARCHED, not guessed — what a night descent asks of a helmet lamp:
//   * ON THE HELMET, not the forehead: it turns with the head, so it lights
//     where the skier looks — a little into the turn — and bobs and rolls
//     with him. It is hung on the head's own frame, so it is wherever the
//     helmet is, the code's or the model's (both are the one shell,
//     `helmet-shape.ts`).
//   * TWO OPTICS: a narrow SPOT, some 15–20° across, that throws far
//     enough for the speed, and a WIDE FLOOD round it — the widest are
//     120° across — for the snow at the tips and the piste's edges; a
//     descent wants both at once. The flood is what makes the pool WIDE.
//   * BRIGHT: 600 lm and up for a descent, where a skin track does with
//     200–400 — so a skier's pool reads beside the finish's floods.
//   * NEUTRAL WHITE, 4000–5500 K: a cold blue LED glares off snow, and
//     the warm halogen is the floods' (`FLOOD_COLOUR`), so the two read
//     apart on the snow.
//
// THE LAMPS COME ON WITH THE DARK (`SkyLook.lamps`): nothing under a noon
// sun, everything at night, some in a storm's gloom — the floods and every
// headlamp alike. The lens glows by day too, faintly, as a switched-on LED
// does; its halo shows only from ahead, as a lens that shines one way.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { glow } from "./glow-sprite.ts";
import { LAMP_SLOTS, type HazeUniforms } from "./haze.ts";
import { helmetReach } from "./helmet-shape.ts";

/** Where the lamp is strapped, on the shell (`helmet-shape.ts`): dead
 * ahead on the brow, `e` rad up — over the brim and its vents — on an
 * elastic band round the crown from `band[0]` to `band[1]` rad up, `lift`
 * m proud of the shell. */
const MOUNT = { e: 0.62, band: [0.58, 0.66] as const, lift: 0.003 };

/** The lamp's housing, m: across, tall and deep — a palm-sized body — and
 * its two lenses (the spot's and the flood's), side by side, their radius
 * and how far apart. */
const HOUSING = { w: 0.058, h: 0.03, d: 0.03, lens: 0.0095, apart: 0.026 };

/** How far the lamp is tipped down on its mount from the head's own
 * forward, rad: a skier
 * carries his head tipped at the snow ahead, so along it the spot falls
 * some fifteen to twenty metres off — about a second at speed. */
export const HEADLAMP_DIP = 0;

/** THE BEAM, as `lampReach` reads it (`uLampBeam`): the spot's cosine from
 * its edge to its full (20° to 8° off the axis — some 16–25° across), where
 * the wide flood starts (70° off — 140° across at its last glimmer) and
 * how much of the spot the flood carries. The floods' own: a tight cone
 * with a little spill. */
export const HEADLAMP_BEAM = [0.94, 0.99, 0.34, 0.35] as const;
const FLOOD_BEAM = [0.86, 0.975, 0.35, 0.1] as const;

/** THE LIGHT'S COLOUR, linear: the headlamp's neutral-white LED (about
 * 5500 K) and the floods' warm halogen. */
export const HEADLAMP_COLOUR = [1.0, 0.89, 0.8] as const;
const FLOOD_COLOUR = [1.0, 0.86, 0.66] as const;

/** How bright a headlamp is against a flood at full night (`uLampOn`). */
const POWER = 0.75;

/** THE LENS, lit: its glow by day and what the dark adds (emissive
 * intensity), and the halo round it seen from ahead at night, m across. */
const LIT = { day: 0.4, night: 4, halo: 0.6 };

/** How far from the lens a rival's lamp still lights the world, m: past
 * it his pool is a few pixels, and the slot is better left dark. */
const FIELD_REACH = 220;

/** The point on the helmet's shell `lift` m proud of it, at `a` rad round
 * (0 dead ahead, clockwise from above) and `e` rad up, in the head's
 * frame — the one shell both the code's helmet and the model's are. */
function onShell(a: number, e: number, lift: number): [number, number, number] {
  const r = helmetReach(a, e, lift);
  return [Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, Math.cos(a) * Math.cos(e) * r];
}

/** The band round the crown, laid on the shell from `e0` to `e1` up. */
function band(e0: number, e1: number, lift: number, around = 36): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= 1; j++) {
    for (let i = 0; i <= around; i++) {
      pos.push(...onShell(-Math.PI + (2 * Math.PI * i) / around, j ? e1 : e0, lift));
    }
  }
  for (let i = 0; i < around; i++) {
    idx.push(i, i + 1, i + around + 1, i + 1, i + around + 2, i + around + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type Headlamp = {
  /** Where the lens is and the way it points, world — as of the last
   * `setLit`. */
  readonly at: THREE.Vector3;
  readonly way: THREE.Vector3;
  /** Light it at `level` (0 off … 1 full night), seen from `eye`. */
  setLit(level: number, eye: THREE.Vector3): void;
};

const toEye = new THREE.Vector3();

/**
 * THE LAMP, strapped to the helmet on `head` (the head's frame: z forward,
 * y up). `mat` makes (and keeps) a material, `keep` every geometry made,
 * for the caller to dispose. Never merged into the skier's one draw: its
 * lens is a lamp, not paint.
 */
export function buildHeadlamp(
  head: THREE.Object3D,
  mat: (params: THREE.MeshStandardMaterialParameters, name: string) => THREE.Material,
  keep: <G extends THREE.BufferGeometry>(g: G) => G,
): Headlamp {
  const housing = mat({ color: 0x1b1d21, roughness: 0.6, metalness: 0.1 }, "headlamp");
  const lens = mat(
    { color: 0xe9edf2, emissive: 0xfff3e6, emissiveIntensity: LIT.day, roughness: 0.1 },
    "headlamp-lens",
  ) as THREE.MeshStandardMaterial;

  // THE BAND round the crown and the housing on it at the brow, one draw;
  // the two lenses, the spot's and the flood's, another.
  const [, y, z] = onShell(0, MOUNT.e, MOUNT.lift);
  const box = new THREE.BoxGeometry(HOUSING.w, HOUSING.h, HOUSING.d).deleteAttribute("uv");
  box.translate(0, y, z + HOUSING.d / 2);
  const front = z + HOUSING.d;
  const discs = [-1, 1].map((side) =>
    new THREE.CylinderGeometry(HOUSING.lens, HOUSING.lens, 0.004, 14)
      .deleteAttribute("uv")
      .rotateX(Math.PI / 2)
      .translate((side * HOUSING.apart) / 2, y, front + 0.001),
  );
  const strapped = [band(MOUNT.band[0], MOUNT.band[1], MOUNT.lift), box];
  head.add(new THREE.Mesh(keep(mergeGeometries(strapped)!), housing));
  head.add(new THREE.Mesh(keep(mergeGeometries(discs)!), lens));
  for (const g of [...strapped, ...discs]) g.dispose();

  // THE BEAM leaves the lens tipped down by the dip; the halo stands a
  // little ahead of it, so the peak and the housing never clip it.
  const anchor = new THREE.Object3D();
  anchor.position.set(0, y, front);
  anchor.rotation.x = HEADLAMP_DIP;
  head.add(anchor);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow(),
      color: 0xfff6ec,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    }),
  );
  halo.position.set(0, 0, 0.03);
  halo.scale.setScalar(LIT.halo);
  halo.visible = false;
  anchor.add(halo);

  const at = new THREE.Vector3();
  const way = new THREE.Vector3();
  return {
    at,
    way,
    setLit(level, eye) {
      anchor.updateWorldMatrix(true, false);
      at.setFromMatrixPosition(anchor.matrixWorld);
      way.set(0, 0, 1).transformDirection(anchor.matrixWorld);
      const on = Math.min(1, Math.max(0, level));
      lens.emissiveIntensity = LIT.day + LIT.night * on;
      // Seen from ahead it blazes; from beside, less; from behind, not at all.
      const facing = way.dot(toEye.subVectors(eye, at).normalize());
      const o = on * THREE.MathUtils.smoothstep(facing, -0.1, 0.7);
      halo.visible = o > 0.02;
      (halo.material as THREE.SpriteMaterial).opacity = o;
    },
  };
}

/** One slot of the haze's lamps: where, which way, how far on, its
 * colour and its beam. */
function fill(
  u: HazeUniforms,
  i: number,
  at: { x: number; y: number; z: number },
  way: { x: number; y: number; z: number },
  on: number,
  colour: readonly number[],
  beam: readonly number[],
): void {
  u.uLampPos.value[i].set(at.x, at.y, at.z);
  u.uLampDir.value[i].set(way.x, way.y, way.z);
  u.uLampOn.value[i] = on;
  u.uLampCol.value[i].set(colour[0], colour[1], colour[2]);
  u.uLampBeam.value[i].set(beam[0], beam[1], beam[2], beam[3]);
}

/** A FLOOD dealt a slot: where it is and the way it points, and — for one
 * that is not the arena's warm halogen (a piste machine's LED work lamps,
 * its beacon, `groomer-scene.ts`) — its own colour, beam and power over
 * the dark's. */
export type Flood = {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  colour?: readonly number[];
  beam?: readonly number[];
  power?: number;
};

/** A lamp waiting for a slot, and how far it is from the eye. */
type Waiting = { far: number; deal(): void };
const waiting: Waiting[] = [];

/**
 * THE NIGHT'S LIGHTS at `level` (0 off … 1, `SkyLook.lamps`): every
 * skier's headlamp lit and seen from `eye`, and `most` of the slots dealt
 * (the LAMPS row, `settings-video.ts`'s `LAMP_COUNT`) — the player's lamp
 * first (`skiers[0]`: it lights what he skis into), then the finish
 * arena's floods, then the field's lamps within reach of the lens, as far
 * as the slots go; with fewer slots than lamps, the NEAREST of the rest to
 * the eye, since a lamp lights what is round it and the eye sees most of
 * what is near. The floods' own glow is `gates.ts`'s.
 * Every slot dealt is lit (its power over 0) and comes before every empty
 * one: the shaders' lamp loops stop at the first empty slot (`haze.ts`).
 */
export function dealLamps(
  u: HazeUniforms,
  level: number,
  skiers: readonly { model: { lamp: Headlamp } }[],
  floods: readonly Flood[],
  eye: THREE.Vector3,
  most: number = LAMP_SLOTS,
): void {
  for (let i = 0; i < LAMP_SLOTS; i++) u.uLampOn.value[i] = 0;
  for (const s of skiers) s.model.lamp.setLit(level, eye);
  if (level <= 0) return;
  const slots = Math.min(most, LAMP_SLOTS);
  let n = 0;
  const head = (lamp: Headlamp) =>
    fill(u, n++, lamp.at, lamp.way, level * POWER, HEADLAMP_COLOUR, HEADLAMP_BEAM);
  const flood = (f: Flood) =>
    fill(
      u,
      n++,
      f,
      { x: f.dx, y: f.dy, z: f.dz },
      level * (f.power ?? 1),
      f.colour ?? FLOOD_COLOUR,
      f.beam ?? FLOOD_BEAM,
    );
  if (skiers.length > 0 && slots > 0) head(skiers[0].model.lamp);
  waiting.length = 0;
  for (const f of floods) {
    waiting.push({ far: Math.hypot(f.x - eye.x, f.y - eye.y, f.z - eye.z), deal: () => flood(f) });
  }
  for (let i = 1; i < skiers.length; i++) {
    const lamp = skiers[i].model.lamp;
    const far = lamp.at.distanceTo(eye);
    if (far <= FIELD_REACH) waiting.push({ far, deal: () => head(lamp) });
  }
  // Every lamp has a slot: dealt in the order the lamps were named.
  if (n + waiting.length > slots) waiting.sort((a, b) => a.far - b.far);
  for (const w of waiting) {
    if (n >= slots) break;
    w.deal();
  }
}
