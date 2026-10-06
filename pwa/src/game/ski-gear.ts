// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS AS DRAWN — everything under the skier that moves with the snow:
// each ski on its leg, the binding on it and the boot clamped in the
// binding. Built in the body frame off the pair's own spec (`defs/skis.ts`:
// the length, the waist, the tip and the tail, the sidecut, the stance, the
// mount — where the physics' three stations stand) and its class's traced
// look (`ski-looks.ts`: the shovel's rise, the tail's shape, the camber,
// the binding and the boot), and posed each frame off the engine's own
// readings: each leg's compression (`skiCompression`), the skid's pivot
// (`skiAngle`) and the EDGE the skis stand on (`edge`).
//
// A SKI IS A BEAM WITH A SIDECUT: its top is the topsheet, its sides are
// the sidewalls over the steel edges, its base runs on the snow. The mesh is
// lofted station by station down the ski — the base's height off
// `baseHeight` (the shovel, the tail, the camber), the half-width off
// `halfWidth` (the sidecut's arc, the tip's point), the thickness off
// `thickness` — so a slalom ski's waist and a powder ski's shovel fall out
// of the spec rather than being drawn. The TOPSHEET's graphic is laid over
// the top face as decals in the trim (`ski-topsheets.ts`), each a mesh of
// its own so the merged draw keeps its colour.
//
// THE POSE. Each ski's group stands at its boot centre and is LIFTED by its
// leg's compression less the rest sag (`gearLift` — a folded knee brings
// the ski up toward the body's origin, which is the centre of gravity), and
// raised by the tuck's drop (the engine lowers the body's origin toward
// the snow as he crouches), and turned two ways: about the body's up by
// the skid's pivot, then about its own length by the edge it stands on
// beyond the body's own roll — the angulation, which is what a skier's
// knees add to his lean (`skiTilt`). On the snow both are taken against
// the snow he inclines to (`ski-stand.ts`): the inside ski lifted toward
// him and the outside let down, so a body inclined into a turn stands
// both bases on the snow.
// The boot is clamped to the binding, so it goes with the ski; the figure's
// shin comes down to its cuff.

import * as THREE from "three";
import type { SkiSpec, SkierState } from "@engine";

import { baseHeight, halfWidth, lookFrame, thickness, type SkiLook } from "./ski-looks.ts";
import type { Stand } from "./ski-stand.ts";
import { PATTERNS, type Pattern } from "./ski-topsheets.ts";
import { gaitOf } from "./skier-pose.ts";

/** Rest compression of a leg, m — the sag the drawn skis sit at when the
 * engine reports it (a skier's stance settles a few centimetres under his
 * own weight, `LegSpec`). */
export const REST_SAG = 0.06;

/** How far the drawn skis move off their rest, m: the legs stretched
 * (negative — hanging in the air) and folded (a landing), whatever the
 * engine reports. A modelled pair's clips run the same travel
 * (`make blender`). */
export const KNEE_TRAVEL: readonly [number, number] = [-0.08, 0.32];

/** How much of the drawn furrow's extra depth the skis are drawn sunk into
 * it. */
export const SINK_SHARE = 0.75;

/** The most a drawn ski is tipped off the body's own roll, rad — the
 * angulation the knees add to the lean. The Blender clips run to it. */
export const EDGE_TILT = 0.95;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Each ski's lift off the rest, m, as drawn: the engine's compression less
 * the rest sag, held to the drawn travel. */
export function gearLift(skier: SkierState): [number, number] {
  return [
    clamp(skier.skiCompression[0] - REST_SAG, KNEE_TRAVEL[0], KNEE_TRAVEL[1]),
    clamp(skier.skiCompression[1] - REST_SAG, KNEE_TRAVEL[0], KNEE_TRAVEL[1]),
  ];
}

/** THE EDGE AS DRAWN AT A WALK: the speeds, m/s, under which the skis are
 * drawn flat on their bases and by which they are drawn on the whole of
 * the engine's edge. The engine steers a crawling skier on the edge its
 * turn asks for, but a man shuffling out of the start gate or skating off
 * a standstill turns his skis on their bases — drawn on a 40° edge at
 * walking pace, with no speed to lean against, he stands tipped over
 * sideways off his own boots. */
const WALK_TILT = { from: 1.5, to: 7 };

/** How far the skis are tipped about their own length IN THE BODY FRAME,
 * rad, right edges down positive: the edge the engine has them on less the
 * roll the whole body already stands at, clamped to what knees can add —
 * and laid flat at a walk (`WALK_TILT`). */
export function skiTilt(skier: Pick<SkierState, "edge" | "roll" | "speed">): number {
  const k = clamp((skier.speed - WALK_TILT.from) / (WALK_TILT.to - WALK_TILT.from), 0, 1);
  return clamp(skier.edge - skier.roll, -EDGE_TILT, EDGE_TILT) * k * k * (3 - 2 * k);
}

/** THE SKI'S MESH in its own frame — x across, y up from the base, z from
 * the tail (0) to the tip (`spec.length`) — lofted station by station, the
 * top and the base flat across, the sidewalls vertical. */
export function skiGeometry(spec: SkiSpec, look: SkiLook, stations = 40): THREE.BufferGeometry {
  const L = spec.length;
  const pos: number[] = [];
  const idx: number[] = [];
  // Each station is a ring of six: base left, base right, edge right, top
  // right, top left, edge left.
  for (let i = 0; i <= stations; i++) {
    const u = i / stations;
    // Finer at the ends, where the shovel bends.
    const s = L * (0.5 - 0.5 * Math.cos(Math.PI * u));
    const w = halfWidth(spec, look, s);
    const h = baseHeight(spec, look, s);
    const t = thickness(spec, look, s);
    pos.push(
      -w,
      h,
      s,
      w,
      h,
      s,
      w,
      h + t * 0.35,
      s,
      w * 0.92,
      h + t,
      s,
      -w * 0.92,
      h + t,
      s,
      -w,
      h + t * 0.35,
      s,
    );
  }
  const R = 6;
  for (let i = 0; i < stations; i++) {
    const a = i * R;
    const b = a + R;
    for (let j = 0; j < R; j++) {
      const k = (j + 1) % R;
      idx.push(a + j, b + j, b + k, a + j, b + k, a + k);
    }
  }
  // The tail's end cap.
  idx.push(0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** ONE DECAL of the topsheet's pattern, laid a hair over the top face:
 * the outline's (u, v) points on the ski's real top at that station. */
export function decalGeometry(
  spec: SkiSpec,
  look: SkiLook,
  outline: readonly (readonly [number, number])[],
): THREE.BufferGeometry {
  const at = (u: number, v: number): [number, number, number] => {
    const s = u * spec.length;
    const w = halfWidth(spec, look, s) * 0.9;
    return [v * w, baseHeight(spec, look, s) + thickness(spec, look, s) + 0.0015, s];
  };
  const pos: number[] = [];
  const idx: number[] = [];
  // Every edge of the outline is split into a few so the decal follows the
  // shovel's curve.
  const ring: [number, number, number][] = [];
  for (let i = 0; i < outline.length; i++) {
    const [u0, v0] = outline[i];
    const [u1, v1] = outline[(i + 1) % outline.length];
    for (let k = 0; k < 4; k++) {
      const f = k / 4;
      ring.push(at(u0 + (u1 - u0) * f, v0 + (v1 - v0) * f));
    }
  }
  let cu = 0;
  let cv = 0;
  for (const p of outline) {
    cu += p[0];
    cv += p[1];
  }
  const c = at(cu / outline.length, cv / outline.length);
  pos.push(...c);
  for (const p of ring) pos.push(...p);
  for (let i = 0; i < ring.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % ring.length));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The topsheet forward of the split, as one decal over the whole top. */
function splitOutline(split: number): [number, number][] {
  return [
    [split, -0.98],
    [split, 0.98],
    [0.995, 0.98],
    [0.995, -0.98],
  ];
}

export type GearParts = {
  add: (g: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D) => THREE.Mesh;
  keep: (g: THREE.BufferGeometry) => void;
  paint: THREE.Material;
  trim: THREE.Material;
  black: THREE.Material;
  boot: THREE.Material;
  alloy: THREE.Material;
  base: THREE.Material;
};

export type Gear = {
  /** The two skis' groups, left then right — the figure's feet stand on
   * their boots. */
  skis: [THREE.Group, THREE.Group];
  /** Posed off the engine's state, the skid's pivot drawn at `angle` rad
   * (the view's eased one, `drawnSkiAngle`; the engine's when left out),
   * each ski where `stand` puts it on the snow (`ski-stand.ts`; the legs'
   * compression and the edge against the body's own roll when left out). */
  pose(skier: SkierState, sink: number, angle?: number, stand?: Stand): void;
};

/** Where a boot's cuff top stands over the ski's base, m — the ankle the
 * figure's shin comes down to. */
export function cuffHeight(look: SkiLook): number {
  return look.binding.height + look.boot.height;
}

export function buildGear(
  spec: SkiSpec,
  look: SkiLook,
  root: THREE.Group,
  parts: GearParts,
  pattern: Pattern = PATTERNS.stripe,
): Gear {
  const { add, keep, paint, trim, black, boot, alloy, base } = parts;
  const F = lookFrame(spec, look);
  const ground = -spec.cogHeight;
  const skiGeo = skiGeometry(spec, look);
  keep(skiGeo);
  // The top's decals, the base's dark sheet and the edges.
  const decals = (pattern.split ? [splitOutline(pattern.split)] : []).concat(pattern.top);
  const decalGeos = decals.map((d) => {
    const g = decalGeometry(spec, look, d);
    keep(g);
    return g;
  });
  const plate = pattern.plates
    ? decalGeometry(spec, look, [
        [0.86, -0.7],
        [0.86, 0.7],
        [0.93, 0.7],
        [0.93, -0.7],
      ])
    : null;
  if (plate) keep(plate);
  const bootZ = F.boot - F.tail;
  const B = look.binding;
  const H = B.height;
  const skis: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set((side * spec.stance) / 2, ground, 0);
    root.add(group);
    // The ski, stood with its boot centre at the group's origin.
    const body = new THREE.Group();
    body.position.set(0, 0, -bootZ);
    group.add(body);
    const ski = new THREE.Mesh(skiGeo, paint);
    ski.castShadow = true;
    ski.receiveShadow = true;
    body.add(ski);
    for (const g of decalGeos) add(g, trim, body);
    if (plate) add(plate, base, body);
    // The base: a dark sheet a hair under the ski, so the underside reads
    // as a base and not the paint when a ski shows it in the air.
    const under = add(skiGeo, base, body);
    under.scale.set(1.001, 0.05, 1);
    under.position.y = -0.0005;
    // THE BINDING: the toe and the heel piece on a plate (a race ski's a
    // tall one), the brake arms either side, the boot's sole stood on both.
    if (B.plate) {
      const p = add(
        new THREE.BoxGeometry(spec.waist * 0.9, H * 0.55, B.length + 0.06),
        black,
        group,
      );
      p.position.set(0, H * 0.28 + look.thick.boot, 0);
    }
    const toe = add(new THREE.BoxGeometry(spec.waist * 0.95, H, 0.09), black, group);
    toe.position.set(0, look.thick.boot + H / 2, B.length / 2 - 0.045);
    const heel = add(new THREE.BoxGeometry(spec.waist * 0.95, H * 1.3, 0.1), black, group);
    heel.position.set(0, look.thick.boot + H * 0.65, -B.length / 2 + 0.05);
    const lever = add(new THREE.BoxGeometry(spec.waist * 0.8, 0.02, 0.05), alloy, group);
    lever.position.set(0, look.thick.boot + H * 1.3, -B.length / 2 - 0.01);
    for (const s of [-1, 1]) {
      const arm = add(new THREE.BoxGeometry(0.008, 0.012, 0.16), alloy, group);
      arm.position.set((s * spec.waist) / 2, look.thick.boot + 0.012, 0);
    }
    // THE BOOT, clamped toe and heel: the shell over the sole, its cuff
    // tipped forward as a ski boot's is, the buckles across the front.
    const sole = look.thick.boot + H;
    const shell = add(new THREE.BoxGeometry(0.1, 0.09, look.boot.length), boot, group);
    shell.position.set(0, sole + 0.045, 0.01);
    const toeBox = add(new THREE.BoxGeometry(0.08, 0.06, 0.05), boot, group);
    toeBox.position.set(0, sole + 0.03, look.boot.length / 2 + 0.02);
    const cuff = add(
      new THREE.CylinderGeometry(0.058, 0.066, look.boot.height - 0.07, 10),
      boot,
      group,
    );
    cuff.position.set(0, sole + 0.07 + (look.boot.height - 0.07) / 2, -0.01);
    cuff.rotation.x = 0.22;
    for (let k = 0; k < 3; k++) {
      const buckle = add(new THREE.BoxGeometry(0.06, 0.012, 0.02), alloy, group);
      buckle.position.set(0, sole + 0.05 + k * 0.06, 0.05 - k * 0.012);
    }
    skis.push(group);
  }

  const e = new THREE.Euler();
  const roll = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  return {
    skis: [skis[0], skis[1]],
    pose(skier, sink, angle = skier.skiAngle, stand) {
      const lifts = stand?.lift ?? gearLift(skier);
      const tilt = stand?.tilt ?? skiTilt(skier);
      // THE GAIT (`skier-pose.ts`'s `gaitOf`): skating, each ski opened
      // into the V, the pushing one out on its inside edge and then lifted
      // back in.
      const gait = gaitOf(skier);
      for (let i = 0; i < 2; i++) {
        const g = skis[i];
        // The tuck LOWERS the body toward the skis (the engine drops the
        // origin by `crouchDrop` at a full tuck), so the skis rise in the
        // body frame by as much.
        g.position.x = ((i === 0 ? -1 : 1) * spec.stance) / 2 + (stand?.out[i] ?? 0) + gait.out[i];
        g.position.z = (stand?.fore[i] ?? 0) + gait.fore[i];
        g.position.y =
          ground +
          lifts[i] +
          gait.lift[i] +
          sink * SINK_SHARE +
          skier.spec.crouchDrop * skier.crouch;
        // Clockwise from above is a positive turn about +y (the framework's
        // `core/quat`); right edges down is a negative turn about the ski's
        // own length, taken after the skid's pivot. Both are the SNOW's —
        // the pivot about its normal, the edge against it — rolled into a
        // body inclined `incline` to it, so a ski thrown across under an
        // inclined skier lies on the snow (`ski-stand.ts`).
        const r = stand?.incline ?? 0;
        g.quaternion
          .setFromEuler(e.set(0, angle + gait.splay[i], -(tilt + gait.tilt[i] + r), "YZX"))
          .premultiply(roll.setFromAxisAngle(Z, r));
      }
    },
  };
}
