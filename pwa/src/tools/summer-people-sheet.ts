// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER PEOPLE'S SHEET and VIEWS for the civilians lab
// (`civilians-harness.ts`, `?sheet=summer`, and the resort's summer views
// with `?summer=1`): the people on foot about a ski area in midsummer
// (`civilian-summer.ts`), dressed off `civilian-dress.ts`'s summer kit and
// drawn by `civilian-summer-shapes.ts` — every body (a row) as a hiker with
// a pack and poles, a hiker walking, a guest in a t-shirt and shorts, a
// rider in his full-face helmet, a terrace sitter, a picnic on its blanket,
// the lift crew and the patrol; then the cuts.

import * as THREE from "three";
import { CROWD_BODIES, type CrowdBody, type GameState } from "@engine";

import { PART, civilianKit, kitParts, type Head } from "../game/civilian-dress.ts";
import { CIVILIAN_POSES, type CivilianTarget } from "../game/civilian-moves.ts";
import {
  civilianAt,
  freshCivilianPose,
  type Civilian,
  type CivilianPlan,
  type CivilianPose,
} from "../game/civilian-plan.ts";
import type { Carry, Dress, RoleId } from "../game/civilian-roles.ts";
import {
  buildCivilianFigure,
  buildCivilianProps,
  civilianMaterial,
  civilianTriangles,
} from "../game/civilian-shapes.ts";
import type { CrowdLod } from "../game/crowd-shapes.ts";
import type { HazeUniforms } from "../game/haze.ts";

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };
type Stage = (
  scene: THREE.Scene,
  w: number,
  cy: number,
  azimuth?: number,
  elev?: number,
) => THREE.Camera;

/** One column of the sheet: who, doing what, in which hat. */
type Kind = {
  name: string;
  role: RoleId;
  dress: Dress;
  dials: Partial<Record<CivilianTarget, number>>;
  carry: Carry;
  head?: Head;
  pack?: boolean;
  seat?: "bench" | "blanket";
  az: number;
};

const KINDS: readonly Kind[] = [
  {
    name: "hiker",
    role: "hiker",
    dress: "guest",
    dials: { idle: 1 },
    carry: "poles",
    head: "sunhat",
    pack: true,
    az: 0.5,
  },
  {
    name: "hiker, walking",
    role: "hiker",
    dress: "guest",
    dials: { walk1: 1 },
    carry: "poles",
    head: "cap",
    pack: true,
    az: -1.2,
  },
  {
    name: "guest, walking",
    role: "walker",
    dress: "guest",
    dials: { walk2: 1 },
    carry: "none",
    az: 0.9,
  },
  {
    name: "rider",
    role: "biker",
    dress: "guest",
    dials: { talk0: 1 },
    carry: "none",
    head: "fullface",
    az: 0.4,
  },
  {
    name: "terrace, a drink",
    role: "terraceSitter",
    dress: "guest",
    dials: { benchDrink: 1 },
    carry: "beer",
    seat: "bench",
    az: 0.7,
  },
  {
    name: "picnic",
    role: "picnic",
    dress: "guest",
    dials: { snowTalk: 1 },
    carry: "none",
    seat: "blanket",
    az: 0.6,
  },
  {
    name: "lift crew",
    role: "liftAttendant",
    dress: "lift",
    dials: { idleAway: 1 },
    carry: "none",
    az: 0.5,
  },
  {
    name: "patrol",
    role: "patrol",
    dress: "patrol",
    dials: { talk1: 1 },
    carry: "none",
    az: -2.4,
  },
];

/** A stand-in civilian for the kit. */
function standIn(body: CrowdBody, dress: Dress, tint: number, role: RoleId): Civilian {
  return {
    id: "lab",
    role,
    body,
    dress,
    tint,
    keen: 0,
    spot: "lab",
    home: { x: 0, y: 0, z: 0, heading: 0, seat: null },
    deck: false,
    leg: null,
    skis: false,
    routine: [],
    total: 1,
    offset: 0,
  };
}

/** One summer figure as the game draws it: an instanced mesh of one. */
function summerFigure(
  material: THREE.Material,
  body: CrowdBody,
  lod: CrowdLod,
  weights: ArrayLike<number>,
  colours: number[],
  parts: number[],
  x: number,
  heading: number,
): THREE.InstancedMesh {
  const geometry = buildCivilianFigure(body, lod, true).clone();
  const attr = (name: string, v: number[]) =>
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(v), 4));
  attr("aDress", colours.slice(0, 4));
  attr("aDress2", colours.slice(4, 8));
  attr("aKit", parts);
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.morphTargetInfluences = Array.from(weights);
  mesh.setMorphAt(0, mesh);
  mesh.morphTexture!.needsUpdate = true;
  mesh.setMatrixAt(
    0,
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  mesh.frustumCulled = false;
  return mesh;
}

/** A patch of summer grass over the lab's snow. */
function grass(scene: THREE.Scene): void {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshLambertMaterial({ color: 0x7f9a52 }),
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.004;
  scene.add(g);
}

/** A bench under a sitter: a plank on two legs, 0.47 m high. */
export function bench(scene: THREE.Scene, x: number, z: number, heading: number): void {
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.3), wood);
  top.position.set(0, 0.445, -0.04);
  g.add(top);
  for (const sx of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.26), wood);
    leg.position.set(sx, 0.21, -0.04);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = heading;
  scene.add(g);
}

/** A picnic blanket under a sitter, as the game builds it. */
function blanket(scene: THREE.Scene, x: number, heading: number): void {
  const plan = {
    props: [{ kind: "blanket" as const, x, y: 0.006, z: 0.3, heading }],
  } as unknown as CivilianPlan;
  scene.add(
    new THREE.Mesh(
      buildCivilianProps(plan, [0, 0, 0]),
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    ),
  );
}

const weightsOf = (dials: Partial<Record<CivilianTarget, number>>): number[] =>
  CIVILIAN_POSES.map((k) => dials[k] ?? 0);

/** The kit a kind is dressed in: the summer kit dealt to the stand-in, its
 * hat and pack set where the column asks. */
function kitOf(kind: Kind, c: Civilian, seed: number): { colours: number[]; parts: number[] } {
  const kit = civilianKit(c, seed, true);
  if (kind.head) kit.head = kind.head;
  if (kind.pack !== undefined && c.body !== "freerider") kit.mark = kind.pack ? PART.pack : 0;
  const pose: CivilianPose = { ...freshCivilianPose(), carry: kind.carry };
  return { colours: kit.colours, parts: kitParts(kit, pose, [0, 0, 0, 0]) };
}

/** THE SUMMER SHEET: a row a body, a column a kind, each twice (three
 * quarters and side on); then the three cuts of a hiker with their
 * triangles. */
export function summerCells(haze: HazeUniforms, stage: Stage, seed: number): Cell[] {
  const material = civilianMaterial(haze);
  const cells: Cell[] = [];
  CROWD_BODIES.forEach((body, row) => {
    KINDS.forEach((kind, k) => {
      cells.push({
        name: k === 0 ? `${body} — ${kind.name}` : kind.name,
        foot: k === 0 ? `${civilianTriangles(body, "near", true)} tris near` : "",
        draw(scene) {
          grass(scene);
          const c = standIn(body, kind.dress, (row * 17 + k * 11) / 97 + 0.03, kind.role);
          const { colours, parts } = kitOf(kind, c, seed + row * 3 + k);
          const w = weightsOf(kind.dials);
          const turn = -Math.PI / 2 - 0.5;
          for (const [x, h] of [
            [-0.55, 0],
            [0.6, turn],
          ] as const) {
            scene.add(summerFigure(material, body, "near", w, colours, parts, x, h));
            if (kind.seat === "bench") bench(scene, x, 0, h);
            if (kind.seat === "blanket") blanket(scene, x, h);
          }
          return stage(scene, 2.6, 0.9, kind.az, 0.22);
        },
      });
    });
  });
  for (const lod of ["near", "mid", "far"] as const) {
    cells.push({
      name: `hiker, ${lod} cut`,
      foot: `${civilianTriangles("woman", lod, true)} tris`,
      draw(scene) {
        grass(scene);
        const c = standIn("woman", "guest", 0.41, "hiker");
        const { colours, parts } = kitOf(KINDS[1], c, seed);
        scene.add(
          summerFigure(material, "woman", lod, weightsOf({ walk1: 1 }), colours, parts, 0, -1.2),
        );
        return stage(scene, 1.6, 0.9, 0.6, 0.2);
      },
    });
  }
  return cells;
}

/** The lab's resort helpers the summer views use. */
type Ctx = {
  state: GameState;
  plan: CivilianPlan;
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
};

/** THE SUMMER VIEWS: a hiking party on a cat track, the summit's hikers,
 * the riders at a lift's foot, a picnic. */
export function summerShots(ctx: Ctx): Record<string, () => string> {
  const { state, plan, hour, from, until } = ctx;
  /** The first of `role` out (skiing the clock on until one is), framed. */
  const first = (
    pick: (c: Civilian) => boolean,
    bearing: number,
    back: number,
    up: number,
    lookUp = 0.9,
  ): string => {
    const p = freshCivilianPose();
    const who = plan.people.map((c, i) => ({ c, i })).filter(({ c }) => pick(c));
    if (who.length === 0) return "nobody of that kind on this map";
    const found = until(() =>
      who.find(({ i }) => {
        civilianAt(plan, i, state.t, hour, p);
        return p.shown;
      }),
    );
    if (!found) return "none out";
    civilianAt(plan, found.i, state.t, hour, p);
    from(p, p.heading + bearing, back, up, 45, lookUp);
    return `${found.c.role} at ${found.c.spot}, ${p.activity}`;
  };
  return {
    trackHikers: () => first((c) => c.spot.startsWith("track-"), 0.7, 9, 2.6),
    summitHikers: () => first((c) => c.role === "hiker" && !c.spot.startsWith("track-"), 2.4, 8, 3),
    riders: () => first((c) => c.role === "biker", 0.4, 9, 3),
    picnic: () => first((c) => c.role === "picnic", 0.5, 7, 3, 0.4),
  };
}
