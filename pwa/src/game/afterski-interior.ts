// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// INSIDE THE AFTERSKI LODGE — the scene the picture cuts to while the
// player is in (`GameState.afterski.inside`): a log room full of people in
// their ski boots, built PROCEDURALLY like everything else, and the player's
// own dressed skier in the middle of it, dancing and drinking his beers on
// the engine's clock (`stepAfterski`: a beer every so often, each drunk over
// `AFTERSKI.beers.sip` s).
//
// WHAT IS IN THE ROOM: log walls and a plank floor, the beams across the
// ceiling with string lights swagged between them, a BAR along the back
// wall with its taps and the shelves of bottles behind it, a stone
// FIREPLACE with its fire, the dusk blue in the windows, tables with their
// glasses, a turning MIRROR BALL with three coloured spots sweeping the
// floor — and the CROWD, a dozen skiers dressed off the catalog, dancing
// their own dances (`party-pose.ts`) round him, a couple drinking at the
// tables and the barman behind the bar. The lens circles him, closing in
// for each beer.
//
// Presentation only: nothing here reads `state.rng` or writes the state;
// every dancer's dance, place and kit is dealt off his own index.

import * as THREE from "three";

import { AFTERSKI, type GameState } from "@engine";

import { CABIN_PAINT as P, cabinBench, logBar } from "./cabin-parts.ts";
import { GEAR, type Outfit } from "./outfit.ts";
import { handAt, movePoints, type BodyMove } from "./party-pose.ts";
import { createSkier, type SkierFigure } from "./skier-figure.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import type { Shape, V3 } from "./tree-mesh.ts";

/** The room: its width (x), depth (z) and height to the beams, m. */
const ROOM = { w: 16, d: 11, h: 4.2 };
/** The lens: how far from him it stands, how high, how far round him it
 * swings either way, rad, and how fast, rad/s — and how near it comes in
 * for a beer. It swings through the gap the dancers leave it. */
const LENS = { far: 3.0, near: 1.9, high: 1.55, swing: 0.6, turn: 0.21 };

export type Interior = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Dress the player's figure in `outfit` (rebuilt only when it changes). */
  dress(outfit: Outfit, key: string): void;
  /** Pose the room for `state` at the canvas's `aspect`. */
  update(state: GameState, aspect: number): void;
  dispose(): void;
};

const identity = <M extends THREE.Material>(m: M): M => m;

/** A small deterministic hash, 0..1. */
function dealt(i: number, k: number): number {
  let h = Math.imul(i * 374761393 + k * 668265263, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** A dancer's kit, dealt off the catalog. */
function kitOf(i: number): Outfit & { tone: number } {
  const pick = <T extends { id: string }>(list: readonly T[], k: number): T["id"] =>
    list[Math.floor(dealt(i, k) * list.length)].id;
  const tones = [0xf0c8a8, 0xe8b896, 0xc89070, 0xb07650, 0x8a5a3c, 0x6a4430];
  return {
    body: dealt(i, 1) < 0.5 ? "woman" : "man",
    weight: pick(GEAR.weight, 2),
    jacket: pick(GEAR.jacket, 3),
    pants: pick(GEAR.pants, 4),
    helmet: pick(GEAR.helmet, 5),
    gloves: pick(GEAR.gloves, 6),
    poles: pick(GEAR.poles, 7),
    tone: tones[Math.floor(dealt(i, 8) * tones.length)],
  } as Outfit & { tone: number };
}

/** THE ROOM's fixed parts, one shape: the walls, floor, ceiling, bar,
 * shelves, fireplace and tables. */
function buildRoom(s: Shape): void {
  const { w, d, h } = ROOM;
  const r = 0.17;
  const pitch = r * 1.732 + 0.03;
  // The log walls, faced inward: x along the back and front, z the ends.
  const walls: [V3, V3][] = [
    [
      [-w / 2, 0, -d / 2],
      [w / 2, 0, -d / 2],
    ],
    [
      [-w / 2, 0, d / 2],
      [w / 2, 0, d / 2],
    ],
    [
      [-w / 2, 0, -d / 2],
      [-w / 2, 0, d / 2],
    ],
    [
      [w / 2, 0, -d / 2],
      [w / 2, 0, d / 2],
    ],
  ];
  walls.forEach(([a, b], wi) => {
    for (let k = 0; ; k++) {
      const y = r + k * pitch + (wi > 1 ? pitch / 2 : 0);
      if (y > h + 0.4) break;
      const tone = k === 0 ? P.logLow : P.log[(k + wi) % 3];
      logBar(s, [a[0], y, a[2]], [b[0], y, b[2]], r, tone, false, false);
    }
  });
  // The floor's planks.
  const plank = [new THREE.Color(0x6e4b2e), new THREE.Color(0x7a5534), new THREE.Color(0x62422a)];
  for (let i = 0; i * 0.22 < w; i++) {
    const x0 = -w / 2 + i * 0.22;
    s.quad(
      [x0, 0, d / 2],
      [x0 + 0.21, 0, d / 2],
      [x0 + 0.21, 0, -d / 2],
      [x0, 0, -d / 2],
      plank[i % 3],
      [0, 1, 0],
    );
  }
  // The ceiling's boards over the beams, and the beams across.
  s.quad(
    [-w / 2, h + 0.6, -d / 2],
    [w / 2, h + 0.6, -d / 2],
    [w / 2, h + 0.6, d / 2],
    [-w / 2, h + 0.6, d / 2],
    P.soffit,
    [0, -1, 0],
  );
  for (const z of [-3.6, -1.2, 1.2, 3.6]) {
    logBar(s, [-w / 2, h, z], [w / 2, h, z], 0.16, P.log[1], false, false);
  }
  // THE BAR along the back wall: its front panelled, its top, a brass rail.
  const bz = -d / 2 + 1.6;
  box(s, -4.5, 0, bz - 0.35, 4.5, 1.08, bz + 0.35, P.door[0]);
  box(s, -4.65, 1.08, bz - 0.45, 4.65, 1.15, bz + 0.45, new THREE.Color(0x4a2e1c));
  for (let x = -4.2; x < 4.3; x += 0.9)
    box(s, x, 0.12, bz + 0.35, x + 0.7, 0.95, bz + 0.37, P.door[1]);
  // The shelves behind it and the bottles on them.
  const glass = [0x2f6b3a, 0x7a3a1c, 0xc9a24a, 0x3a4f7a, 0xe8e2d0].map((c) => new THREE.Color(c));
  for (const y of [1.5, 2.05, 2.6]) {
    box(s, -4.2, y, -d / 2 + 0.17, 4.2, y + 0.05, -d / 2 + 0.45, P.board[0]);
    for (let i = 0; i < 26; i++) {
      const x = -4.0 + i * 0.31 + dealt(i, Math.round(y * 10)) * 0.08;
      const tall = 0.24 + dealt(i, 3 + Math.round(y * 10)) * 0.12;
      box(
        s,
        x,
        y + 0.05,
        -d / 2 + 0.26,
        x + 0.08,
        y + 0.05 + tall,
        -d / 2 + 0.34,
        glass[(i + Math.round(y * 3)) % 5],
      );
    }
  }
  // THE FIREPLACE on the left end: its stone breast and hearth.
  box(s, -w / 2 + 0.17, 0, -1.3, -w / 2 + 0.9, 3.2, 1.3, P.stone[1]);
  box(s, -w / 2 + 0.17, 3.2, -0.7, -w / 2 + 0.7, h + 0.6, 0.7, P.stone[0]);
  box(s, -w / 2 + 0.9, 0, -1.5, -w / 2 + 1.6, 0.12, 1.5, P.stone[3]);
  // THE TABLES along the front and the right end, with their benches.
  const tops = new THREE.Color(0x9c7a55);
  for (const [x, z] of TABLES) {
    box(s, x - 1.0, 0.72, z - 0.42, x + 1.0, 0.78, z + 0.42, tops);
    for (const dz of [-0.78, 0.78])
      box(s, x - 1.0, 0.43, z + dz - 0.17, x + 1.0, 0.48, z + dz + 0.17, P.board[0]);
    for (const dx of [-0.8, 0.8])
      box(s, x + dx - 0.05, 0, z - 0.3, x + dx + 0.05, 0.72, z + 0.3, P.board[1]);
  }
}

/** Where the tables stand, (x, z). */
const TABLES: [number, number][] = [
  [-5.6, 3.9],
  [5.4, 3.9],
  [5.8, -0.9],
  [-5.0, -3.3],
];

/** A box, all faces one colour. */
function box(
  s: Shape,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  c: THREE.Color,
): void {
  const q = (a: V3, b: V3, cc: V3, dd: V3, n: V3): void => s.quad(a, b, cc, dd, c, n);
  q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
  q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
}

/** One person in the room: where he stands and faces, what he does, his
 * figure and his glass. */
type Person = {
  holder: THREE.Group;
  figure: SkierFigure;
  glass: THREE.Group | null;
  move: (t: number) => BodyMove;
};

/** A BEER GLASS: a half-litre stein drawn a size up so it reads across
 * the room — the glass, the amber beer in it (scaled by how full), its
 * white head standing proud of the rim, and the handle. Its origin is the
 * HANDLE, where the hand holds it; the glass stands to the handle's left
 * (his body's side of his right hand). */
const STEIN = { r: 0.058, h: 0.2, wall: 0.006, handle: 0.075 };
function beerGlass(mats: {
  beer: THREE.Material;
  foam: THREE.Material;
  glass: THREE.Material;
}): THREE.Group {
  const S = STEIN;
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.set(-S.handle, -S.h / 2, 0);
  const beer = new THREE.Mesh(
    new THREE.CylinderGeometry(S.r - S.wall, S.r - S.wall - 0.004, 1, 14),
    mats.beer,
  );
  beer.name = "beer";
  const foam = new THREE.Mesh(
    new THREE.CylinderGeometry(S.r + 0.004, S.r - S.wall, 0.04, 14),
    mats.foam,
  );
  foam.name = "foam";
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(S.r, S.r - 0.004, S.h, 14, 1, true),
    mats.glass,
  );
  shell.position.y = S.h / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(S.r, S.r, 0.012, 14), mats.glass);
  base.position.y = 0.006;
  body.add(beer, foam, shell, base);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(S.handle * 0.55, 0.012, 6, 10, Math.PI),
    mats.glass,
  );
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(-S.handle + S.r - 0.004, 0, 0);
  g.add(body, handle);
  return g;
}

/** The beer in a stein `full` of the way to its rim, and its head on it. */
function fill(glass: THREE.Group, full: number): void {
  const f = Math.max(0.06, Math.min(1, full));
  const beer = glass.getObjectByName("beer")!;
  const foam = glass.getObjectByName("foam")!;
  const deep = (STEIN.h - 0.03) * f;
  beer.scale.y = deep;
  beer.position.y = 0.012 + deep / 2;
  foam.position.y = 0.012 + deep + 0.012;
}

export function createInterior(): Interior {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1210);
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 60);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => {
    if (x instanceof THREE.Material) mats.push(x);
    else geos.push(x);
    return x;
  };

  const room = cabinBench();
  buildRoom(room);
  const roomMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
  scene.add(new THREE.Mesh(keep(room.geometry()), roomMat));

  // THE GLOWING THINGS: the windows' dusk, the fire, the bulbs, the taps.
  const glowMat = (c: number, k = 1): THREE.MeshBasicMaterial =>
    keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }));
  const dusk = glowMat(0x2b4a7a, 0.9);
  for (const z of [-2.6, 2.6]) {
    const pane = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.4, 1.5)), dusk);
    pane.position.set(ROOM.w / 2 - 0.1, 1.8, z);
    pane.rotation.y = -Math.PI / 2;
    scene.add(pane);
  }
  for (const x of [-6, 6]) {
    const pane = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.6, 1.5)), dusk);
    pane.position.set(x, 1.8, ROOM.d / 2 - 0.1);
    pane.rotation.y = Math.PI;
    scene.add(pane);
  }
  const fire = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.4, 0.9)), glowMat(0xff7a22, 2.2));
  fire.position.set(-ROOM.w / 2 + 0.92, 0.6, 0);
  fire.rotation.y = Math.PI / 2;
  scene.add(fire);
  // The bulbs swagged between the beams: one instanced draw.
  const bulbs: THREE.Vector3[] = [];
  for (const z of [-3.6, -1.2, 1.2, 3.6]) {
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const x = -ROOM.w / 2 + 0.4 + t * (ROOM.w - 0.8);
      const sag = 0.35 * Math.abs(Math.sin(t * Math.PI * 4));
      bulbs.push(new THREE.Vector3(x, ROOM.h - 0.2 - sag, z + 0.0));
    }
  }
  const bulbGeo = keep(new THREE.SphereGeometry(0.045, 6, 4));
  const bulbMesh = new THREE.InstancedMesh(bulbGeo, glowMat(0xffffff), bulbs.length);
  const warm = [0xffc56a, 0xff9a4a, 0xfff0b8, 0xff6a6a, 0x8ad0ff].map((c) =>
    new THREE.Color(c).multiplyScalar(1.6),
  );
  const m4 = new THREE.Matrix4();
  bulbs.forEach((p, i) => {
    bulbMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    bulbMesh.setColorAt(i, warm[i % warm.length]);
  });
  scene.add(bulbMesh);
  // The taps on the bar.
  const chrome = keep(
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.25 }),
  );
  const handles = [0xb3302a, 0xe2a72e, 0x2f5a3c, 0xf1ece0];
  for (let i = 0; i < 4; i++) {
    const x = -0.9 + i * 0.6;
    const tap = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8)), chrome);
    tap.position.set(x, 1.36, -ROOM.d / 2 + 1.5);
    const handle = new THREE.Mesh(
      keep(new THREE.BoxGeometry(0.05, 0.22, 0.05)),
      glowMat(handles[i], 0.7),
    );
    handle.position.set(x, 1.68, -ROOM.d / 2 + 1.5);
    scene.add(tap, handle);
  }

  // THE LIGHT: a warm low fill, lamps over the bar and the tables, the
  // fire's flicker, and the MIRROR BALL's three coloured spots.
  scene.add(new THREE.HemisphereLight(0xffd2a0, 0x2a1810, 0.55));
  const lamps: THREE.PointLight[] = [];
  for (const [x, y, z, i] of [
    [-3, 3.4, -3.4, 14],
    [3, 3.4, -3.4, 14],
    [-3.4, 3.4, 3, 10],
    [4.6, 3.4, 1.6, 10],
  ] as const) {
    const l = new THREE.PointLight(0xffb066, i, 14, 1.6);
    l.position.set(x, y, z);
    lamps.push(l);
    scene.add(l);
  }
  const hearth = new THREE.PointLight(0xff6a1a, 10, 9, 1.8);
  hearth.position.set(-ROOM.w / 2 + 1.6, 0.9, 0);
  scene.add(hearth);
  const ball = new THREE.Mesh(
    keep(new THREE.IcosahedronGeometry(0.32, 1)),
    keep(
      new THREE.MeshStandardMaterial({
        color: 0xe8e8f0,
        metalness: 1,
        roughness: 0.15,
        flatShading: true,
      }),
    ),
  );
  ball.position.set(0, ROOM.h - 0.5, 0.4);
  const wire = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, 0.9, 3)), chrome);
  wire.position.set(0, ROOM.h + 0.15, 0.4);
  scene.add(ball, wire);
  const spots: THREE.SpotLight[] = [];
  for (const c of [0xff3fa8, 0x3fd4ff, 0xffd23f]) {
    const sp = new THREE.SpotLight(c, 40, 12, 0.32, 0.5, 1.4);
    sp.position.copy(ball.position);
    scene.add(sp, sp.target);
    spots.push(sp);
  }

  // THE CROWD.
  const beerMats = {
    beer: glowMat(0xe2a02a, 0.95),
    foam: keep(new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.9 })),
    glass: keep(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.05,
        transparent: true,
        opacity: 0.38,
      }),
    ),
  };
  const people: Person[] = [];
  const frame: BodyFrame = {
    origin: { x: 0, y: 0, z: 0 },
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
  };
  const trunk = new THREE.Matrix4();
  const ax = new THREE.Vector3();
  const ay = new THREE.Vector3();
  const az = new THREE.Vector3();
  const add = (
    outfit: Outfit & { tone?: number },
    x: number,
    z: number,
    face: number,
    move: (t: number) => BodyMove,
    glass: boolean,
  ): Person => {
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = face;
    // Indoors nobody wears a helmet or goggles: hair or a beanie, faces bare.
    const figure = createSkier({ outfit, tone: outfit.tone, bare: true }, identity);
    holder.add(figure.group);
    const g = glass ? beerGlass(beerMats) : null;
    if (g) holder.add(g);
    scene.add(holder);
    const p = { holder, figure, glass: g, move };
    people.push(p);
    return p;
  };
  // A ring of dancers round the middle of the floor, facing in — open on
  // the side toward the room's front, where the lens stands.
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * (0.42 + (1.16 * i) / 9) + (dealt(i, 20) - 0.5) * 0.25;
    const rr = 1.5 + dealt(i, 21) * 1.9;
    const x = Math.sin(a) * rr;
    const z = 0.4 + Math.cos(a) * rr * 0.8;
    const style = Math.floor(dealt(i, 22) * 4);
    const phase = dealt(i, 23) * 2;
    const sway = dealt(i, 24) * 0.8;
    const held = dealt(i, 26) < 0.4;
    add(
      kitOf(i),
      x,
      z,
      a + Math.PI + (dealt(i, 25) - 0.5) * 0.8,
      (t) => ({ kind: "dance", t: t + phase, style, sway, glass: held }),
      held,
    );
  }
  // Two at the tables, drinking; the barman behind the bar.
  for (const [i, [x, z]] of TABLES.slice(0, 2).entries()) {
    add(
      kitOf(20 + i),
      x + 0.3,
      z + 1.2,
      Math.PI,
      (t) => ({ kind: "drink", t, k: ((t + i * 3) % 6) / 3, style: 2 }),
      true,
    );
  }
  add(
    kitOf(30),
    1.2,
    -ROOM.d / 2 + 0.85,
    0,
    (t) => ({ kind: "dance", t: t * 0.5, style: 2, sway: 0 }),
    false,
  );

  // HIM, in the middle, facing the room's front: dressed by `dress`.
  let me: Person | null = null;
  let dressed = "";
  const centre = new THREE.Vector3(0, 0, 0.6);

  /** Lay a person's figure in his move at `t` and his glass in his hand. */
  const lay = (p: Person, t: number, full = 1): void => {
    const pts = movePoints(p.move(t), 0);
    const pose = ragdollPose(pts, frame);
    p.figure.group.position.set(frame.origin.x, frame.origin.y, frame.origin.z);
    trunk.makeBasis(
      ax.set(frame.x.x, frame.x.y, frame.x.z),
      ay.set(frame.y.x, frame.y.y, frame.y.z),
      az.set(frame.z.x, frame.z.y, frame.z.z),
    );
    p.figure.group.quaternion.setFromRotationMatrix(trunk);
    p.figure.sprawl(pose);
    if (p.glass) {
      const h = handAt(pts);
      // Held by the handle in his right fist; tipped to his lips on a drink
      // (the hand near his mouth), upright in a toast.
      const m = p.move(t);
      const sip = m.kind === "drink" ? Math.max(0, Math.min(1, (h.y - 1.15) / 0.3)) : 0;
      p.glass.position.set(h.x, h.y, h.z + 0.02);
      // From the side of his mouth: the rim in to his lips, the foot up
      // and out.
      // The stein's body turned to his middle, whichever side the hand is.
      const turn = h.x < 0 ? Math.PI : 0;
      p.glass.rotation.set(-0.35 * sip, turn, 0.1 + 1.2 * sip);
      fill(p.glass, full);
    }
  };

  return {
    scene,
    camera,
    dress(outfit, key) {
      if (key === dressed) return;
      dressed = key;
      if (me) {
        scene.remove(me.holder);
        me.figure.dispose();
        people.splice(people.indexOf(me), 1);
      }
      me = add(outfit, centre.x, centre.z, 0, () => ({ kind: "dance", t: 0 }), true);
    },
    update(state, aspect) {
      const a = state.afterski;
      const t = a?.t ?? 0;
      const buzz = state.skier.buzz ?? 0;
      const B = AFTERSKI.beers;
      const sip = a && a.sip >= 0 ? a.sip / B.sip : -1;
      if (me) {
        const style = (a?.beers ?? 0) % 4;
        const held = t > B.first - B.sip;
        me.move = () =>
          sip >= 0
            ? { kind: "drink", t, k: sip, sway: buzz }
            : { kind: "dance", t, style, sway: buzz, glass: held };
        me.glass!.visible = held;
      }
      for (const p of people)
        lay(p, t, p === me && sip >= 0 ? 1 - 0.85 * Math.min(1, sip * 1.3) : 1);
      // The ball turning, its spots sweeping the floor; the fire and the
      // lamps breathing.
      ball.rotation.y = t * 0.9;
      spots.forEach((sp, i) => {
        const w = t * (0.5 + i * 0.17) + i * 2.1;
        sp.target.position.set(Math.sin(w) * 4.5, 0, 0.4 + Math.cos(w * 1.3) * 3.2);
      });
      hearth.intensity = 9 + 2.5 * Math.sin(t * 13) * Math.sin(t * 7.3);
      // THE LENS swinging round him through the crowd's gap, nearer for a
      // beer.
      const near = sip >= 0 ? Math.sin(Math.PI * Math.min(1, sip)) : 0;
      const r = LENS.far + (LENS.near - LENS.far) * near;
      const ang = LENS.swing * Math.sin(t * LENS.turn + 0.5);
      camera.position.set(
        centre.x + Math.sin(ang) * r,
        LENS.high + 0.2 * Math.sin(t * 0.4),
        centre.z + Math.cos(ang) * r,
      );
      camera.lookAt(centre.x, 1.25 + 0.2 * near, centre.z);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    dispose() {
      for (const p of people) p.figure.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const p of people) p.glass?.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      bulbMesh.dispose();
    },
  };
}
