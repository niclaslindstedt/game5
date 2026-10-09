// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS LAB's KNOCKS SHEET (`?sheet=knocks`): a person on foot met
// by something that moves — a skier at a crawl and at speed, from behind,
// from the front and from the side, the snowmobile, a piste machine, a car,
// a child sat on the snow, and one person knocked into the next — each a
// row, strobed frame by frame as the blow lands, the steps he takes to
// catch himself or the fall or the flight, the body lying, the get-up, and
// a last cell with the whole of it in one wide frame. The person is a real
// civilian of `?seed=`'s free ride stood where he lives, on that snow; the
// hitter is driven straight through him and the blow is the game's own
// (`civilian-hits.ts`'s `collide`), every step after it the game's
// (`stepKnocks`), so what the sheet shows is what the game does.

import * as THREE from "three";
import { TUNING, createGame, type CrowdBody, type GameState } from "@engine";

import { civilianKit, kitParts, type CivilianKit } from "../game/civilian-dress.ts";
import {
  collide,
  createKnocks,
  stepKnocks,
  type Hitter,
  type Knocks,
  type Person,
} from "../game/civilian-hits.ts";
import { knockOf, type Knock } from "../game/civilian-knock.ts";
import { knockedPose } from "../game/civilian-knock-pose.ts";
import { civilianPlanFor, freshCivilianPose, type CivilianPose } from "../game/civilian-plan.ts";
import {
  buildCivilianFigure,
  civilianMaterial,
  poseCivilianFigure,
} from "../game/civilian-shapes.ts";
import type { Posed } from "../game/crowd-rig.ts";
import type { HazeUniforms } from "../game/haze.ts";

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };

const dt = TUNING.dt;

type Kind = "skier" | "sled" | "groomer" | "car" | "person";

/** One row: who stands, sat or stood, what hits him, how fast, from where
 * (rad round from his front: 0 met head on, π from behind), and how wide
 * a frame his knock wants, m. */
type Row = {
  name: string;
  body: CrowdBody;
  sat?: "snow";
  kind: Kind;
  speed: number;
  from: number;
  wide: number;
};

export const KNOCK_ROWS: readonly Row[] = [
  { name: "skier 1 m/s from behind", body: "man", kind: "skier", speed: 1, from: Math.PI, wide: 3 },
  {
    name: "skier 2 m/s from behind",
    body: "woman",
    kind: "skier",
    speed: 2,
    from: Math.PI,
    wide: 3.5,
  },
  { name: "skier 2.5 m/s, front", body: "man", kind: "skier", speed: 2.5, from: 0, wide: 4 },
  { name: "skier 2 m/s, side", body: "teen", kind: "skier", speed: 2, from: Math.PI / 2, wide: 4 },
  {
    name: "skier 4 m/s, side",
    body: "oldWoman",
    kind: "skier",
    speed: 4,
    from: -Math.PI / 2,
    wide: 5,
  },
  { name: "skier 8 m/s", body: "man", kind: "skier", speed: 8, from: Math.PI, wide: 9 },
  {
    name: "sat on the snow, skier 2 m/s",
    body: "child",
    sat: "snow",
    kind: "skier",
    speed: 2,
    from: Math.PI / 2,
    wide: 3,
  },
  { name: "snowmobile 12 m/s", body: "man", kind: "sled", speed: 12, from: 0, wide: 18 },
  { name: "piste machine 3.3 m/s", body: "oldMan", kind: "groomer", speed: 3.3, from: 0, wide: 9 },
  { name: "car 9 m/s", body: "woman", kind: "car", speed: 9, from: Math.PI / 2, wide: 14 },
  {
    name: "knocked into the next",
    body: "man",
    kind: "person",
    speed: 2.6,
    from: Math.PI,
    wide: 5,
  },
];

/** The moments strobed, s after the blow, then the get-up's. */
const AT = [0.05, 0.2, 0.4, 0.65, 0.95, 1.4, 2.2] as const;
export const KNOCK_COLS = AT.length + 4;

const HITTER: Record<Exclude<Kind, "person">, Partial<Hitter>> = {
  skier: { r: 0.36, height: 1.6, mass: 86, high: 1.05, lift: 0.22 },
  sled: { front: 1.65, back: 1.65, half: 0.58, height: 1.3, mass: 385, high: 0.6, lift: 0.4 },
  groomer: { front: 4, back: 4.9, half: 2.75, height: 2.9, mass: 12000, high: 0.8, lift: 0.18 },
  car: { front: 2.03, back: 2.03, half: 0.88, height: 1.47, mass: 1150, high: 0.55, lift: 0.32 },
};

type Frame = { name: string; pose: Posed; hitter: Hitter | null; centre: THREE.Vector3 };

let game: GameState | null = null;

/** One row skied: the person stood, the hitter driven through him, the
 * frames caught. */
function runRow(
  row: Row,
  seed: number,
): { frames: Frame[]; kit: CivilianKit; at: THREE.Vector3; way: number; second: Frame[] } {
  game ??= createGame({ seed, mode: "free", quiet: true });
  const state = game;
  state.t = 0;
  const plan = civilianPlanFor(state.level);
  // Where a person of that body lives, on his own snow.
  const c =
    plan.people.find((p) => p.body === row.body && !p.leg && p.home.seat === null) ??
    plan.people[0];
  const kit = civilianKit(c, seed);
  const x = c.home.x;
  const z = c.home.z;
  const y = state.level.groundAt(x, z);
  const heading = c.home.heading;
  const stood = (px: number, pz: number): CivilianPose => ({
    ...freshCivilianPose(),
    x: px,
    y: state.level.groundAt(px, pz),
    z: pz,
    heading,
    activity: row.sat ? "sit" : "stand",
    seat: row.sat ? 0 : null,
    shown: true,
  });
  const people: Person[] = [
    {
      key: 0,
      body: row.body,
      skis: false,
      rx: x,
      rz: z,
      rr: 1,
      at: (_t, o) => Object.assign(o, stood(x, z)),
    },
  ];
  // The way the hitter comes from, and goes.
  const dir = heading + row.from + Math.PI;
  const ux = Math.sin(dir);
  const uz = Math.cos(dir);
  // Knocked into the next: a second person stood a metre and a half on.
  if (row.kind === "person") {
    const sx = x + ux * 1.3;
    const sz = z + uz * 1.3;
    people.push({
      key: 1,
      body: "woman",
      skis: false,
      rx: sx,
      rz: sz,
      rr: 1,
      at: (_t, o) => Object.assign(o, stood(sx, sz)),
    });
  }
  const knocks: Knocks = createKnocks();
  knocks.t = 0;
  const base = row.kind === "person" ? HITTER.skier : HITTER[row.kind];
  const length = (base.front ?? 0) + (base.r ?? 0);
  // From two metres short of him plus its own nose.
  const start = 2 + length;
  let hx = x - ux * start;
  let hz = z - uz * start;
  const frames: Frame[] = [];
  const second: Frame[] = [];
  const want = [...AT];
  let blow = -1;
  const caught = new Set<string>();
  const snap = (k: Knock, name: string, h: Hitter | null, into: Frame[]): void => {
    const b = k.rag;
    into.push({
      name,
      pose: knockedPose(b.points, k.body, [b.x, b.y, b.z]),
      hitter: h,
      centre: new THREE.Vector3(b.x, b.y, b.z),
    });
  };
  for (let s = 0; s < 120 * 25; s++) {
    const t = s * dt;
    state.t = t;
    const moving = blow < 0 || t - blow < 0.6 || row.kind !== "skier";
    const h: Hitter = {
      x: hx,
      y: y - 0.2,
      z: hz,
      vx: moving ? ux * row.speed : 0,
      vz: moving ? uz * row.speed : 0,
      heading: dir,
      r: 0,
      front: 0,
      back: 0,
      half: 0,
      height: 1,
      mass: 80,
      high: 1,
      lift: 0,
      from: -1,
      ...base,
    };
    collide(knocks, state, people, [h], dt);
    stepKnocks(knocks, state, people, 1);
    hx += h.vx * dt;
    hz += h.vz * dt;
    const k = knocks.map.get(0);
    if (k && blow < 0) blow = t;
    if (!k) {
      if (blow >= 0) break;
      continue;
    }
    const since = t - blow;
    // The skier pulls up once he has struck; drawn while he moves.
    const shown = moving && Math.hypot(hx - k.rag.x, hz - k.rag.z) < 12 ? h : null;
    if (want.length && since >= want[0]) {
      snap(k, `${want.shift()!.toFixed(2)} s · ${k.phase}`, shown, frames);
      if (row.kind === "person") {
        // The one ahead stood as she stands until he reaches her.
        const o =
          knocks.map.get(1) ??
          knockOf(state, people[1].rx, people[1].rz, heading, "stand", false, "woman");
        snap(o, "", null, second);
      }
    }
    if (k.phase === "down" && !caught.has("lie") && k.rest > 0.3) {
      caught.add("lie");
      snap(k, `lying, ${since.toFixed(1)} s`, null, frames);
    }
    if (k.phase === "rise" && !caught.has("rise") && k.t > 1.3) {
      caught.add("rise");
      snap(k, "getting up", null, frames);
    }
    if (k.phase === "back" && !caught.has("back")) {
      caught.add("back");
      snap(k, `${k.how}, ${k.steps} step${k.steps === 1 ? "" : "s"}`, null, frames);
    }
  }
  return { frames, kit, at: new THREE.Vector3(x, y, z), way: dir, second };
}

/** The snow under the frame, `size` m square round `at`, laid off the map. */
function snowPatch(state: GameState, at: THREE.Vector3, size: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(size, size, 32, 32);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + at.x;
    const z = p.getZ(i) + at.z;
    p.setY(i, state.level.groundAt(x, z) - at.y);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(
    g,
    new THREE.MeshLambertMaterial({ color: 0xeef3f8, side: THREE.DoubleSide }),
  );
}

/** A person's figure posed at `pose` (about `centre`), dressed. */
function figureOf(
  haze: HazeUniforms,
  body: CrowdBody,
  kit: CivilianKit,
  pose: Posed,
  at: THREE.Vector3,
): THREE.InstancedMesh {
  const g = buildCivilianFigure(body, "near").clone();
  g.morphAttributes = {};
  const attr = (v: ArrayLike<number>) =>
    new THREE.InstancedBufferAttribute(new Float32Array(Array.from(v)), 4);
  g.setAttribute("aDress", attr(kit.colours.slice(0, 4)));
  g.setAttribute("aDress2", attr(kit.colours.slice(4, 8)));
  g.setAttribute("aKit", attr(kitParts(kit, freshCivilianPose(), [0, 0, 0, 0])));
  poseCivilianFigure(body, "near", pose, g);
  const mesh = new THREE.InstancedMesh(g, civilianMaterial(haze), 1);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(at.x, at.y, at.z));
  mesh.frustumCulled = false;
  return mesh;
}

/** The hitter, a translucent block or post where it stands. */
function hitterOf(h: Hitter, origin: THREE.Vector3): THREE.Mesh {
  const box = h.front > 0;
  const g = box
    ? new THREE.BoxGeometry(h.half * 2, h.height, h.front + h.back)
    : new THREE.CylinderGeometry(h.r, h.r, h.height, 16);
  const mesh = new THREE.Mesh(
    g,
    new THREE.MeshLambertMaterial({ color: 0xd8432f, transparent: true, opacity: 0.45 }),
  );
  const off = box ? (h.front - h.back) / 2 : 0;
  mesh.position.set(
    h.x + Math.sin(h.heading) * off - origin.x,
    h.y + h.height / 2 - origin.y,
    h.z + Math.cos(h.heading) * off - origin.z,
  );
  mesh.rotation.y = h.heading;
  return mesh;
}

/** Stakes every metre along the way the blow went, from where he stood. */
function stakes(
  scene: THREE.Scene,
  state: GameState,
  at: THREE.Vector3,
  way: number,
  origin: THREE.Vector3,
  n: number,
): void {
  for (let m = -2; m <= n; m++) {
    const x = at.x + Math.sin(way) * m;
    const z = at.z + Math.cos(way) * m;
    const y = state.level.groundAt(x, z);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, m === 0 ? 0.5 : 0.25, 0.03),
      new THREE.MeshBasicMaterial({ color: m === 0 ? 0x1b6fd1 : 0x11181d }),
    );
    post.position.set(x - origin.x, y - origin.y + (m === 0 ? 0.25 : 0.125), z - origin.z);
    scene.add(post);
  }
}

const CELL_W = 200;
const CELL_H = 240;

/** A side-on camera across the blow's way, `w` m wide, round `cy` up. */
function side(scene: THREE.Scene, way: number, w: number, cy: number): THREE.Camera {
  scene.add(new THREE.HemisphereLight(0xdfeaf6, 0x9aa8b8, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.9);
  key.position.set(-0.55, 0.72, -0.42);
  scene.add(key);
  const h = (w * CELL_H) / CELL_W;
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
  // From the side and a little ahead, so what is struck stands before what struck him.
  const az = way + Math.PI / 2 - 0.35;
  const el = 0.22;
  const d = 40;
  camera.position.set(
    Math.sin(az) * Math.cos(el) * d,
    cy + Math.sin(el) * d,
    Math.cos(az) * Math.cos(el) * d,
  );
  camera.lookAt(0, cy, 0);
  return camera;
}

export function knockCells(haze: HazeUniforms, seed: number): Cell[] {
  return KNOCK_ROWS.flatMap((row) => {
    const { frames, kit, at, way, second } = runRow(row, seed);
    const state = game!;
    const near = Math.min(row.wide, 4.5);
    // The one he is knocked into wears a kit of her own.
    const other = civilianPlanFor(state.level).people.find((p) => p.body === "woman");
    const second2 = row.kind === "person" && other ? civilianKit(other, seed + 1) : null;
    const cells: Cell[] = frames.slice(0, KNOCK_COLS - 1).map((f, i) => ({
      name: i === 0 ? row.name : "",
      foot: f.name,
      draw(scene) {
        const o = f.centre.clone();
        o.y = state.level.groundAt(o.x, o.z);
        scene.add(
          figureOf(
            haze,
            row.body,
            kit,
            f.pose,
            new THREE.Vector3(f.centre.x - o.x, f.centre.y - o.y, f.centre.z - o.z),
          ),
        );
        const s2 = second[i];
        if (s2 && second2 && i < AT.length) {
          scene.add(figureOf(haze, "woman", second2, s2.pose, s2.centre.clone().sub(o)));
        }
        if (f.hitter) scene.add(hitterOf(f.hitter, o));
        scene.add(snowPatch(state, o, near * 3));
        stakes(scene, state, at, way, o, Math.ceil(row.wide));
        return side(scene, way, near, 0.85);
      },
    }));
    while (cells.length < KNOCK_COLS - 1)
      cells.push({ name: "", foot: "", draw: (s) => side(s, 0, 1, 0) });
    // The whole of it in one wide frame: every strobed moment at once.
    cells.push({
      name: "",
      foot: "all of it",
      draw(scene) {
        const o = at.clone();
        const mid = o
          .clone()
          .add(new THREE.Vector3(Math.sin(way), 0, Math.cos(way)).multiplyScalar(row.wide * 0.3));
        for (const f of frames.slice(0, AT.length)) {
          scene.add(figureOf(haze, row.body, kit, f.pose, f.centre.clone().sub(mid)));
        }
        scene.add(snowPatch(state, mid, row.wide * 3));
        stakes(scene, state, at, way, mid, Math.ceil(row.wide));
        return side(scene, way, row.wide, Math.min(1.5, row.wide * 0.15));
      },
    });
    return cells;
  });
}
