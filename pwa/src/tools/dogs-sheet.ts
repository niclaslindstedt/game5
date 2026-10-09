// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOGS' SHEET and VIEWS for the civilians lab (`civilians-harness.ts`,
// `?sheet=dogs`, and the resort's `dogs`, `dogpoop`, `piles` and `street`
// views): every kind from the side and three quarters in its coats, the
// walk and the trot strobed over a stride, the squat to poop frame by
// frame, every pose, the pile and the yellow patch close, a walker with a
// dog on a slack lead and a taut one, and the cuts.

import * as THREE from "three";
import {
  freshVehiclePose,
  trafficOf,
  vehicleAt,
  villageBuildingsOf,
  type GameState,
} from "@engine";

import {
  DOG_COATS,
  DOG_COLLARS,
  DOG_GAIT,
  DOG_KINDS,
  DOG_SPECS,
  type DogKind,
} from "../game/dog-defs.ts";
import {
  DOG_POSES,
  collarOf,
  dogDials,
  dogSkel,
  leadCurve,
  type DogTarget,
  type V3,
} from "../game/dog-pose.ts";
import {
  buildDogFigure,
  dogMaterial,
  dogTriangles,
  packColour,
  type DogLod,
} from "../game/dog-shapes.ts";
import { dogPlanFor, householdOut, messAt, walkAt, type Mess } from "../game/dog-walk.ts";
import { inHouse } from "../game/dog-walk-net.ts";
import {
  dogAt,
  dogWalkerAt,
  freshDogPose,
  type DogAct,
  type DogPose,
} from "../game/dog-walk-pose.ts";
import { civilianKit, kitParts } from "../game/civilian-dress.ts";
import { CIVILIAN_POSES, civilianDials, leadHand } from "../game/civilian-moves.ts";
import { freshCivilianPose, type Civilian } from "../game/civilian-plan.ts";
import { BOOT_GAIT } from "../game/civilian-roles.ts";
import { buildCivilianFigure, civilianMaterial } from "../game/civilian-shapes.ts";
import { patchGeometry, pileGeometry } from "../game/dogs-view.ts";
import type { HazeUniforms } from "../game/haze.ts";

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };
type Stage = (
  scene: THREE.Scene,
  w: number,
  cy: number,
  azimuth?: number,
  elev?: number,
) => THREE.Camera;

/** The lab's dog walker: a man with the lead in his hand (at `walk` of his
 * stride, or stood), at (x, z) facing `heading`, as the game draws him. */
function walker(
  haze: HazeUniforms,
  scene: THREE.Scene,
  x: number,
  z: number,
  heading: number,
  walk: number | null,
): void {
  const geometry = buildCivilianFigure("man", "near").clone();
  const stand = { role: "dogWalker", body: "man", dress: "guest", tint: 0.37 } as Civilian;
  const kit = civilianKit(stand, 38);
  const pose = {
    ...freshCivilianPose(),
    carry: "lead" as const,
    activity: walk === null ? ("stand" as const) : ("walk" as const),
    walked: (walk ?? 0) * 2 * BOOT_GAIT.step,
    shown: true,
  };
  const parts = kitParts(kit, pose, [0, 0, 0, 0]);
  const attr = (v: number[]) => new THREE.InstancedBufferAttribute(new Float32Array(v), 4);
  geometry.setAttribute("aDress", attr(kit.colours.slice(0, 4)));
  geometry.setAttribute("aDress2", attr(kit.colours.slice(4, 8)));
  geometry.setAttribute("aKit", attr(parts));
  const mesh = new THREE.InstancedMesh(geometry, civilianMaterial(haze), 1);
  const w = new Float32Array(CIVILIAN_POSES.length);
  civilianDials(pose, 0, 0, w);
  mesh.morphTargetInfluences = Array.from(w);
  mesh.setMorphAt(0, mesh);
  mesh.morphTexture!.needsUpdate = true;
  mesh.setMatrixAt(
    0,
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  mesh.frustumCulled = false;
  scene.add(mesh);
}

const TARGETS = DOG_POSES.length;

/** One dog as the game draws it: an instanced mesh of one. */
function dogMesh(
  haze: HazeUniforms,
  kind: DogKind,
  lod: DogLod,
  weights: ArrayLike<number>,
  look: { coat: number; collar: number; garment: number; dressed: boolean },
  x: number,
  z: number,
  heading: number,
): THREE.InstancedMesh {
  const geometry = buildDogFigure(kind, lod).clone();
  const c = DOG_SPECS[kind].coats[look.coat % DOG_SPECS[kind].coats.length];
  const attr = (v: number[]) => new THREE.InstancedBufferAttribute(new Float32Array(v), 4);
  geometry.setAttribute("aCoat", attr([c.main, c.under, c.back, c.mask].map(packColour)));
  geometry.setAttribute(
    "aCoat2",
    attr([
      packColour(DOG_COLLARS[look.collar]),
      packColour(DOG_COATS[look.garment]),
      look.dressed ? 1 : 0,
      0,
    ]),
  );
  const mesh = new THREE.InstancedMesh(geometry, dogMaterial(haze), 1);
  mesh.morphTargetInfluences = Array.from(weights);
  mesh.setMorphAt(0, mesh);
  mesh.morphTexture!.needsUpdate = true;
  mesh.setMatrixAt(
    0,
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  mesh.frustumCulled = false;
  return mesh;
}

/** The weights of a dog doing `act` `clock` s into `span`, at `stride`. */
function weightsOf(
  act: DogAct,
  clock: number,
  span: number,
  extra: Partial<DogPose> = {},
): Float32Array {
  const p: DogPose = { ...freshDogPose(), shown: true, act, clock, span, ...extra };
  const w = new Float32Array(TARGETS);
  dogDials(p, 0.11, 0, w);
  return w;
}
const only = (t: DogTarget): Float32Array => {
  const w = new Float32Array(TARGETS);
  w[DOG_POSES.indexOf(t)] = 1;
  return w;
};

const LOOK = { coat: 0, collar: 0, garment: 0, dressed: false };

/** THE DOGS' SHEET, eight cells a row. */
export function dogCells(haze: HazeUniforms, stage: Stage): Cell[] {
  const cells: Cell[] = [];
  const side =
    (kind: DogKind, w: ArrayLike<number>, look = LOOK, az = Math.PI / 2, wide = 1.2) =>
    (scene: THREE.Scene) => {
      scene.add(dogMesh(haze, kind, "near", w, look, 0, 0, 0));
      const H = DOG_SPECS[kind].height;
      return stage(scene, Math.max(0.7, DOG_SPECS[kind].length * 2.2) * wide, H * 0.55, az, 0.12);
    };
  const stand = new Float32Array(TARGETS);
  // THE KINDS from the side, then three quarters, in their coats.
  for (const kind of DOG_KINDS) {
    const s = DOG_SPECS[kind];
    cells.push({
      name: kind,
      foot: `${(s.height * 100).toFixed(0)} cm, ${s.mass} kg`,
      draw: side(kind, stand),
    });
  }
  cells.push({
    name: "husky, black",
    foot: "coat 2",
    draw: side("husky", stand, { ...LOOK, coat: 1 }),
  });
  cells.push({
    name: "shepherd, black",
    foot: "coat 2",
    draw: side("shepherd", stand, { ...LOOK, coat: 1 }),
  });
  cells.push({
    name: "terrier in a coat",
    foot: "dressed",
    draw: side("terrier", stand, { coat: 2, collar: 1, garment: 0, dressed: true }),
  });
  for (const kind of DOG_KINDS) {
    cells.push({
      name: `${kind} ¾`,
      foot: "",
      draw: side(kind, stand, { ...LOOK, coat: 1, collar: 2 }, 0.7),
    });
  }
  cells.push({
    name: "dachshund in a coat",
    foot: "dressed ¾",
    draw: side("dachshund", stand, { coat: 1, collar: 3, garment: 1, dressed: true }, 0.7),
  });
  cells.push({
    name: "retriever, black",
    foot: "¾",
    draw: side("retriever", stand, { ...LOOK, coat: 2 }, 0.7),
  });
  cells.push({
    name: "husky, red",
    foot: "¾",
    draw: side("husky", stand, { ...LOOK, coat: 2 }, 0.7),
  });

  // THE WALK and THE TROT strobed over a stride, from the side.
  for (const [kind, trot, speed] of [
    ["retriever", 0, 1.2],
    ["terrier", 1, 1.3],
  ] as const) {
    for (let f = 0; f < 8; f++) {
      const u = f / 8;
      cells.push({
        name: f === 0 ? `${kind} ${trot ? "trot" : "walk"}` : "",
        foot: `${u.toFixed(3)} stride`,
        draw: side(kind, weightsOf("walk", 0, 1, { stride: u, trot, speed })),
      });
    }
  }
  // THE SQUAT TO POOP, frame by frame over the stop (the circling before
  // it is the walk's), from the side.
  const span = 12;
  for (let f = 0; f < 8; f++) {
    const clock = (f / 7) * span;
    cells.push({
      name: f === 0 ? "shepherd squats" : "",
      foot: `${clock.toFixed(1)} of ${span} s`,
      draw: side("shepherd", weightsOf("poop", clock, span)),
    });
  }
  // EVERY POSE, held.
  const held: [string, DogKind, Float32Array, number][] = [
    ["sit", "retriever", only("sit"), Math.PI / 2],
    ["sniff", "retriever", only("sniff"), Math.PI / 2],
    ["mark left", "retriever", only("markL"), Math.PI + 0.4],
    ["mark right", "husky", only("markR"), -0.5],
    ["pee", "shepherd", only("pee"), Math.PI / 2],
    ["poop, behind", "retriever", only("poop"), Math.PI + 0.5],
    ["husky poop", "husky", only("poop"), Math.PI / 2],
    ["terrier poop", "terrier", only("poop"), Math.PI / 2],
    ["dachshund poop", "dachshund", only("poop"), Math.PI / 2],
    ["dachshund sit", "dachshund", only("sit"), 0.9],
    ["terrier sit", "terrier", only("sit"), 0.9],
    ["husky sniff", "husky", only("sniff"), 0.9],
    ["wag right", "retriever", only("wagR"), Math.PI + 0.01],
    ["wag left", "husky", only("wagL"), Math.PI + 0.01],
  ];
  for (const [name, kind, w, az] of held) {
    cells.push({ name, foot: kind, draw: side(kind, w, LOOK, az) });
  }
  // THE PILE AND THE PATCH, close, on the sidewalk.
  cells.push({
    name: "a pile",
    foot: "a retriever's, 0.3 m across",
    draw(scene) {
      const pile = new THREE.Mesh(
        pileGeometry(),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(0.2, 0.1, 0.05),
          flatShading: true,
        }),
      );
      scene.add(pile);
      return stage(scene, 0.3, 0.04, 0.6, 0.35);
    },
  });
  cells.push({
    name: "yellow snow",
    foot: "a mark, 1 m across",
    draw(scene) {
      const patch = new THREE.Mesh(
        patchGeometry(),
        new THREE.MeshLambertMaterial({
          color: 0xd8b13c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.62,
        }),
      );
      patch.position.y = 0.004;
      patch.scale.set(0.4, 1, 0.34);
      scene.add(patch);
      return stage(scene, 1.2, 0.05, 0.6, 0.7);
    },
  });
  // A WALKER WITH HIS DOG: on a slack lead, and pulling it taut.
  for (const [name, ahead, act] of [
    ["slack lead", 0.7, "walk"],
    ["taut lead", 1.75, "walk"],
    ["waiting, sat", 0.55, "sit"],
    ["sniffing", 1.2, "sniff"],
  ] as const) {
    cells.push({
      name,
      foot: "1.6 m lead",
      draw(scene) {
        const heading = -Math.PI / 2;
        walker(haze, scene, 0.6, 0, heading, act === "walk" ? 0.25 : null);
        const w = act === "walk" ? weightsOf("walk", 0, 1, { stride: 0.3, speed: 1.2 }) : only(act);
        // The dog ahead along his heading (−x), a little to his right.
        const dx = 0.6 - ahead;
        scene.add(dogMesh(haze, "retriever", "near", w, LOOK, dx, -0.25, heading));
        const hand = leadHand("man", 0);
        const hw: V3 = [
          0.6 + hand[2] * Math.sin(heading) + hand[0] * Math.cos(heading),
          hand[1],
          -hand[0] * Math.sin(heading) + hand[2] * Math.cos(heading),
        ];
        const skel = dogSkel("retriever", act === "walk" ? "walk1" : act);
        const c = collarOf(skel);
        const cw: V3 = [
          dx + c[2] * Math.sin(heading) + c[0] * Math.cos(heading),
          c[1],
          -0.25 - c[0] * Math.sin(heading) + c[2] * Math.cos(heading),
        ];
        const pts = leadCurve(hw, cw, 1.6, 0, 16).map((p) => new THREE.Vector3(...p));
        scene.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x8a1a1e }),
          ),
        );
        return stage(scene, 3.2, 0.7, Math.PI * 0.12, 0.15);
      },
    });
  }
  // THE CUTS.
  for (const lod of ["near", "far"] as const) {
    cells.push({
      name: `retriever ${lod}`,
      foot: `${dogTriangles("retriever", lod)} tris`,
      draw(scene) {
        scene.add(dogMesh(haze, "retriever", lod, stand, LOOK, 0, 0, 0));
        return stage(scene, 1.4, 0.3, 0.7, 0.15);
      },
    });
  }
  cells.push({
    name: "far at 30 m",
    foot: "the game's pixels",
    draw(scene) {
      scene.add(
        dogMesh(
          haze,
          "retriever",
          "far",
          weightsOf("walk", 0, 1, { stride: 0.3, speed: 1.2 }),
          LOOK,
          0,
          0,
          0.7,
        ),
      );
      // A 50° lens at 30 m: the cell's height is 28 m of view.
      return stage(scene, (28 * 200) / 240, 0.3);
    },
  });
  void DOG_GAIT;
  return cells;
}

/** The resort's dog views, over the lab's lens helpers: each lens stood
 * where nothing stands between it and what it looks at (no house, no
 * trunk, no car), the bearing asked for first and then round from it. */
export function dogShots(ctx: {
  state: GameState;
  hour: number;
  from: (
    at: { x: number; y: number; z: number },
    bearing: number,
    back: number,
    up: number,
    fov?: number,
    lookUp?: number,
  ) => void;
  until: <T>(find: () => T | undefined, most?: number) => T | undefined;
}): Record<string, () => string> {
  const { state, hour, from, until } = ctx;
  const level = state.level;
  const plan = dogPlanFor(level);
  const houses = villageBuildingsOf(level);
  const dog = freshDogPose();
  const walker = freshCivilianPose();
  const car = freshVehiclePose();
  const traffic = trafficOf(level);
  /** Whether a lens at (ex, ez) sees (x, z) clear, with a body's width
   * of room either side of the line. */
  const clear = (x: number, z: number, ex: number, ez: number): boolean => {
    const l = Math.hypot(ex - x, ez - z) || 1;
    const n = Math.ceil(l / 0.3);
    for (const off of [-1.2, 0, 1.2]) {
      const ox = ((ez - z) / l) * off;
      const oz = (-(ex - x) / l) * off;
      for (let i = 3; i <= n; i++) {
        const px = x + ((ex - x) * i) / n + ox * (i / n);
        const pz = z + ((ez - z) * i) / n + oz * (i / n);
        if (inHouse(houses, px, pz)) return false;
        if (level.trees.some((t) => Math.hypot(t.x - px, t.z - pz) < 0.8)) return false;
      }
    }
    for (let k = 0; traffic && k < traffic.vehicles.length; k++) {
      vehicleAt(traffic, k, state.t, car);
      if (car.shown && Math.hypot(car.x - ex, car.z - ez) < 4) return false;
    }
    return true;
  };
  const aim = (
    at: { x: number; y: number; z: number },
    bearing: number,
    back: number,
    up: number,
    fov = 45,
    lookUp = 0.5,
  ): void => {
    for (let k = 0; k < 24; k++) {
      const b = bearing + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      if (clear(at.x, at.z, at.x + Math.sin(b) * back, at.z + Math.cos(b) * back)) {
        from(at, b, back, up, fov, lookUp);
        return;
      }
    }
    from(at, bearing, back, up, fov, lookUp);
  };
  /** The first dog out doing `act`, with its owner out too. */
  const find = (act: DogAct | null, test: () => boolean = () => true) =>
    until(() => {
      if (!plan) return undefined;
      for (const hh of plan.households) {
        for (let d = 0; d < hh.dogs.length; d++) {
          dogAt(plan, hh.id, d, state.t, hour, dog);
          if (dog.shown && (act === null || dog.act === act) && test()) return { h: hh.id, d };
        }
      }
      return undefined;
    }, 120 * 600);
  const mess: Mess[] = [];
  return {
    dogs() {
      const hit = find("walk", () => dog.speed > 0.8);
      if (!hit || !plan) return "no dog out walking";
      dogAt(plan, hit.h, hit.d, state.t, hour, dog);
      aim(dog, dog.heading + 1.3, 4.5, 1.4, 45, 0.4);
      const hh = plan.households[hit.h];
      return `${hh.walker} walking a ${hh.dogs.map((g) => g.kind).join(" and a ")}`;
    },
    dogpoop() {
      const hit = find("poop", () => dog.clock > 3);
      if (!hit || !plan) return "no dog squatting";
      dogAt(plan, hit.h, hit.d, state.t, hour, dog);
      aim(dog, dog.heading + 1.6, 3.2, 1.0, 45, 0.25);
      dogWalkerAt(plan, hit.h, 0, state.t, hour, walker);
      const kind = plan.households[hit.h].dogs[hit.d].kind;
      return `a ${kind} squatting, ${dog.clock.toFixed(1)} of ${dog.span.toFixed(1)} s; owner ${walker.activity}`;
    },
    piles() {
      if (!plan) return "no village";
      const enough = () =>
        messAt(plan, state.t, hour, mess).filter((m) => m.kind === "poop" && state.t - m.at > 20)
          .length >= 2
          ? true
          : undefined;
      if (!until(enough, 120 * 900)) return "nothing left on the sidewalks";
      const piles = mess.filter((m) => m.kind === "poop" && state.t - m.at > 20);
      const p = piles[piles.length - 1];
      aim(p, p.heading + 0.8, 1.5, 0.8, 40, 0);
      return `${piles.length} piles and ${mess.length - piles.length} patches left on the sidewalks, this one ${(state.t - p.at).toFixed(0)} s old`;
    },
    street() {
      // A walker and his dog from well back along the street, a little up.
      const hit = find("walk", () => dog.speed > 0.8);
      if (!hit || !plan) return "no dog out";
      dogAt(plan, hit.h, hit.d, state.t, hour, dog);
      aim(dog, dog.heading + Math.PI - 0.3, 14, 4, 50, 0.6);
      const out = plan.households.filter(
        (hh) => householdOut(plan, hh.id, hour) && walkAt(plan, hh.id, state.t) !== null,
      ).length;
      return `a village street, ${out} of ${plan.households.length} households out walking`;
    },
  };
}
