// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE AS MARKED — the course furniture a skier reads the run by:
//
//   * THE GATES: every checkpoint but the first and the last is a pair of
//     PANEL GATES, one at each edge of the line — two hinged poles a metre
//     apart with a panel hung between them — red or blue as the engine
//     dealt the gate (`Checkpoint.colour`: they alternate down the piste,
//     R11), so the skier passes BETWEEN the two panels of one colour.
//   * THE START: a START HUT at the top of the piste, off the line's left
//     edge, and the WAND across the start gate — two posts and a bar at
//     the knee, the thing a racer's shins push through to start the clock.
//   * THE FINISH: an inflatable ARCH over the last gate carrying the word,
//     the line dyed checkered across the snow under it (`start-arch.ts`
//     says where and how big), safety NETS fencing the last stretch either
//     side, and two FLOODLIGHT masts at the arch's feet, aimed back up the
//     piste — two of the lamps that light the snow after dark
//     (`snow-glsl.ts`'s lamp slots).
//   * THE EDGE POLES: a stake every twenty-five metres along both edges of every
//     run on the mountain (R27), painted in ITS GRADE (R23, `grade-look.ts`
//     — green, blue, red or black, as a piste is marked), the right-hand ones banded
//     orange at the top (the convention that tells a skier in fog which
//     side he is on), with a reflector that catches the floods and the moon
//     at night.
//   * THE SIGNS: a board on a post at the head of every run and where a
//     lane leaves one — its mark, its number, its name, an arrow
//     (`run-signs.ts`).
//   * THE PISTE LIGHTS: a floodlight mast every fifty metres or so down
//     every run, lit with the floods (`piste-lights.ts`).
//
// THE NEXT GATE IS THE ONE THAT MATTERS, so it is the one that is loud:
// its panels are their colour at full strength and breathe a little light,
// and a tall marker stands over each so it reads over a crest before the
// panels themselves do. Every other gate's panels are muted — present,
// countable, but not asking for the eye.
//
// EVERY MARK IS BUILT IN CODE, in the woods' chunky, faceted, low-poly look
// (`mark-shapes.ts`: the poles and their panels, the stakes, the marker, the
// hut, the arch's tube, skirts and blowers); the wand, the nets, the masts,
// the banner, the guy lines and the line dyed on the snow are strung and
// laid on this map's own ground here.

import * as THREE from "three";
import { gradeOf, type Checkpoint, type GameState, type Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { bannerTexture } from "./banner-texture.ts";
import { glow } from "./glow-sprite.ts";
import { GRADE_LOOK } from "./grade-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import {
  archBlower,
  archSkirt,
  archTube,
  edgeBand,
  edgeStake,
  gateMarker,
  gatePanel,
  gatePole,
  startHut,
} from "./mark-shapes.ts";
import { createPisteLights } from "./piste-lights.ts";
import { createRunSigns } from "./run-signs.ts";
import { createSlalomPoles } from "./slalom-poles.ts";
import { createStartHouse } from "./start-house.ts";
import { ARCH, archPlan, type ArchPlan } from "./start-arch.ts";
import { LOOSE } from "./trail-stamp.ts";

/** A PANEL GATE's measure, m: the poles' height and their gap along the
 * line, the panel's height and how far down the poles it hangs. A giant
 * slalom gate is two poles a little over a metre apart with a panel 0.5 m
 * deep at the top. */
const PANEL = { pole: 1.85, gap: 1.05, drop: 0.5, radius: 0.017 };

/** THE EDGE POLES, m: their spacing down the piste, their height, the
 * orange band's height at the top of a right-hand one, and how far outside
 * the piste's edge they stand. */
const EDGE = { every: 25, height: 2.2, band: 0.45, out: 1.5, radius: 0.02 };

/** THE START HUT, m: its footprint and height, and where it stands — off
 * the line's left edge. */
const HUT = { width: 2.4, depth: 2.2, height: 2.1, out: 2.5 };

/** THE WAND: two posts either side of the start gate's centre and the bar
 * between them, at a racer's knee. */
const WAND = { gap: 1.2, height: 0.45, post: 0.6 };

/** THE FINISH ARENA'S NETS, m: how far up the piste from the line they
 * fence, how far past it, their height and how far outside the edge. */
const NET = { before: 60, after: 30, height: 1.3, out: 1.2, post: 8 };

/** THE FLOODLIGHTS: the masts' height, m, how far the lamp head is dipped
 * below level aiming up the piste, rad, and each lamp's glow at night, m
 * across. */
const FLOOD = { mast: 8, dip: 0.28, glow: 2.6, night: 4, day: 0.15 };

/** One floodlight: where its lamp is and which way it shines, unit. */
export type Flood = { x: number; y: number; z: number; dx: number; dy: number; dz: number };

export type Gates = {
  group: THREE.Group;
  /** The finish arena's floodlights, for the snow shader's lamp slots. */
  floods: Flood[];
  /** The run's moment: the owed gate highlighted and breathing, a slalom's
   * poles as knocked, its start clock. */
  update(state: GameState): void;
  /** The night's lights at `level` (0 off … 1): the floods' glow, the
   * edge poles' reflectors and the piste lights along every run, with
   * `pixels` the lens's focal length in pixels. */
  setLamps(level: number, pixels: number): void;
  dispose(): void;
};

/** The line dyed across the snow: two squares of the checker, repeated. */
function bandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#1b1f25";
  g.fillRect(0, 0, 2, 2);
  g.fillStyle = "#f4f6f8";
  g.fillRect(0, 0, 1, 1);
  g.fillRect(1, 1, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.anisotropy = 8;
  return tex;
}

/** A safety net's mesh: an orange grid on a translucent sheet — the
 * spectators' fences are hung with it too (`finish-arena.ts`). */
export function netTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = "#f07a1a";
  g.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 64);
    g.moveTo(0, i);
    g.lineTo(64, i);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** The arch's tube: up one leg, round the shoulder, across, round, down. */
function archPath(a: ArchPlan): THREE.CurvePath<THREE.Vector3> {
  const [l, r] = a.feet;
  const c = ARCH.corner;
  const across = (d: number, y: number) => new THREE.Vector3(a.x + a.rx * d, y, a.z + a.rz * d);
  const path = new THREE.CurvePath<THREE.Vector3>();
  const p0 = new THREE.Vector3(l.x, l.y, l.z);
  const p1 = across(-a.reach, a.top - c);
  const p2 = across(-a.reach + c, a.top);
  const p3 = across(a.reach - c, a.top);
  const p4 = across(a.reach, a.top - c);
  const p5 = new THREE.Vector3(r.x, r.y, r.z);
  path.add(new THREE.LineCurve3(p0, p1));
  path.add(new THREE.QuadraticBezierCurve3(p1, across(-a.reach, a.top), p2));
  path.add(new THREE.LineCurve3(p2, p3));
  path.add(new THREE.QuadraticBezierCurve3(p3, across(a.reach, a.top), p4));
  path.add(new THREE.LineCurve3(p4, p5));
  return path;
}

/** A thin cylinder from `a` to `b` — a guy line, a wand's bar. */
function strand(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 5, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

export function createGates(level: Level, haze: HazeUniforms): Gates {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name);
    mats.push(m);
    return m;
  };
  const markerMat = std(
    { vertexColors: true, emissive: PALETTE.flag, emissiveIntensity: 0.35, roughness: 0.6 },
    "gate-marker",
  );
  const markerGeo = gateMarker();
  geos.push(markerGeo);
  const red = new THREE.Color(PALETTE.flag);
  const blue = new THREE.Color(PALETTE.gateBlue);
  const muted = (c: THREE.Color) => c.clone().lerp(new THREE.Color(0x9aa4ad), 0.4);
  const dark = std({ color: 0x23282e, roughness: 0.8 }, "gate-dark");
  /** The built marks' own paint, a face at a time. */
  const painted = std({ vertexColors: true, roughness: 0.75 }, "gate-painted");
  const alloy = std({ color: 0xb8bec4, roughness: 0.35, metalness: 0.6 }, "gate-alloy");
  const rope = std({ color: 0xe8ecef, roughness: 0.9 }, "gate-rope");

  // THE PANEL GATES: every pole and every panel is one instance of one of
  // two meshes, coloured per instance — a course is a hundred of them, and
  // one draw each would be most of a frame's draw calls. The panels are
  // double-sided cloth; the poles a hinged plastic.
  const poleGeo = gatePole(PANEL.pole, PANEL.radius);
  const panelGeo = gatePanel(PANEL.gap, PANEL.drop, PANEL.pole);
  geos.push(poleGeo, panelGeo);
  const poleMat = std({ vertexColors: true, roughness: 0.5 }, "gate-pole");
  const panelMat = std(
    { vertexColors: true, roughness: 0.8, side: THREE.DoubleSide },
    "gate-panel",
  );
  const gates = level.checkpoints.length;
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, gates * 4);
  const panels = new THREE.InstancedMesh(panelGeo, panelMat, gates * 2);
  poles.castShadow = true;
  panels.castShadow = true;
  group.add(poles, panels);
  const markers = [0, 1].map(() => {
    const m = new THREE.Mesh(markerGeo, markerMat);
    m.visible = false;
    group.add(m);
    return m;
  });
  /** Where each gate's two panel tops are, for the markers, and its
   * colour, for the breathing. */
  const tops: THREE.Vector3[][] = [];
  const colours: THREE.Color[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const none = new THREE.Vector3(0, 0, 0);

  const floods: Flood[] = [];
  const floodHeads: THREE.MeshStandardMaterial[] = [];
  const floodGlows: THREE.Sprite[] = [];
  const reflectorMat = std(
    { color: 0xf07a1a, emissive: 0xf07a1a, emissiveIntensity: 0.2, roughness: 0.4 },
    "edge-reflector",
  );

  // A SLALOM's pole gates (R31) are flex poles of their own, and its start
  // a start house over the course.
  const slalomPoles = createSlalomPoles(level, haze);
  const house = createStartHouse(level, haze);
  if (slalomPoles) group.add(slalomPoles.group);
  if (house) group.add(house.group);

  const placeGate = (cp: Checkpoint, index: number) => {
    const fx = Math.sin(cp.heading);
    const fz = Math.cos(cp.heading);
    // The skier's right: forward turned clockwise a quarter.
    const rx = fz;
    const rz = -fx;
    const half = cp.width / 2 + 1;
    const colour = cp.colour === "blue" ? blue : red;
    colours.push(colour);
    const own: THREE.Vector3[] = [];
    const first = index === 0;
    const last = index === gates - 1;
    // A pole gate's poles are `slalom-poles.ts`'s; its marker rides over
    // its turning pole.
    if (cp.pole !== undefined) {
      for (let k = 0; k < 4; k++) poles.setMatrixAt(index * 4 + k, m4.compose(at, q, none));
      for (let k = 0; k < 2; k++) panels.setMatrixAt(index * 2 + k, m4.compose(at, q, none));
      const top = slalomPoles?.top(index);
      tops.push(top ? [top] : []);
      return;
    }
    [-1, 1].forEach((side, k) => {
      const cx = cp.x + rx * half * side;
      const cz = cp.z + rz * half * side;
      const y = level.groundAt(cx, cz) - 0.15;
      // The start and the finish carry no panels: the hut and the arch
      // are their marks.
      const scale = first || last ? none : one;
      for (const along of [-1, 1]) {
        const x = cx + rx * along * (PANEL.gap / 2);
        const z = cz + rz * along * (PANEL.gap / 2);
        const i = (index * 2 + k) * 2 + (along < 0 ? 0 : 1);
        poles.setMatrixAt(i, m4.compose(at.set(x, y, z), q.identity(), scale));
        poles.setColorAt(i, colour);
      }
      // The panel faces along the piste, so a skier coming down reads it
      // square on.
      const j = index * 2 + k;
      panels.setMatrixAt(
        j,
        m4.compose(at.set(cx, y, cz), q.setFromAxisAngle(up, cp.heading), scale),
      );
      panels.setColorAt(j, last ? colour : muted(colour));
      own.push(new THREE.Vector3(cx, y + PANEL.pole + 1.2, cz));
    });
    tops.push(own);
    if (first && !house) hutAt(cp, rx, rz, fx, fz);
    if (last) finish(cp, fx, fz);
  };

  // THE START HUT off the line's left edge, a timber box under a gabled
  // roof, its window to the piste; and the wand across the gate.
  const hutAt = (cp: Checkpoint, rx: number, rz: number, fx: number, fz: number) => {
    const half = cp.width / 2 + 1;
    const hx = cp.x - rx * (half + HUT.out) + fx * 1.5;
    const hz = cp.z - rz * (half + HUT.out) + fz * 1.5;
    const hy = level.groundAt(hx, hz);
    const hutGeo = startHut(HUT.width, HUT.depth, HUT.height);
    geos.push(hutGeo);
    const hut = new THREE.Mesh(hutGeo, painted);
    hut.position.set(hx, hy, hz);
    hut.rotation.y = cp.heading;
    hut.castShadow = true;
    group.add(hut);
    // The wand: two posts a racer's shins go between, the bar at the knee.
    for (const side of [-1, 1]) {
      const px = cp.x + rx * side * (WAND.gap / 2);
      const pz = cp.z + rz * side * (WAND.gap / 2);
      const py = level.groundAt(px, pz) - 0.1;
      const post = new THREE.CylinderGeometry(0.02, 0.02, WAND.post, 6);
      post.translate(px, py + WAND.post / 2, pz);
      geos.push(post);
      group.add(new THREE.Mesh(post, alloy));
    }
    const bar = strand(
      new THREE.Vector3(
        cp.x - rx * (WAND.gap / 2),
        level.groundAt(cp.x, cp.z) + WAND.height,
        cp.z - rz * (WAND.gap / 2),
      ),
      new THREE.Vector3(
        cp.x + rx * (WAND.gap / 2),
        level.groundAt(cp.x, cp.z) + WAND.height,
        cp.z + rz * (WAND.gap / 2),
      ),
      0.012,
    );
    geos.push(bar);
    group.add(new THREE.Mesh(bar, alloy));
  };

  // THE FINISH: the arch, its banner and the line dyed under it; the nets
  // fencing the last stretch; the floodlights on their masts.
  const finish = (cp: Checkpoint, fx: number, fz: number) => {
    const a = archPlan(level, cp);
    const fabric = std({ vertexColors: true, roughness: 0.45 }, "arch-fabric");
    const tube = archTube(a, archPath(a));
    geos.push(tube);
    const body = new THREE.Mesh(tube, fabric);
    body.castShadow = true;
    group.add(body);

    // The banner across the span's face. ONE-SIDED, and hung twice back
    // to back: a plane drawn from behind reads its lettering mirrored.
    const width = 2 * (a.reach - ARCH.corner * 0.6);
    const tex = bannerTexture(width / ARCH.panel);
    texs.push(tex);
    const print = std({ map: tex, roughness: 0.6 }, "arch-banner");
    const plane = new THREE.PlaneGeometry(width, ARCH.panel);
    geos.push(plane);
    for (const turn of [Math.PI, 0]) {
      const out = (turn === 0 ? 1 : -1) * (ARCH.tube + 0.03);
      const b = new THREE.Mesh(plane, print);
      b.position.set(a.x + fx * out, a.top, a.z + fz * out);
      b.rotation.y = cp.heading + turn;
      group.add(b);
    }

    // At each foot the skirt it is weighted down with and the blower that
    // keeps it up, a guy line fore and aft to a stake — and the FLOODLIGHT
    // MAST, its lamp head aimed back up the piste at the last stretch.
    const skirt = archSkirt();
    const blower = archBlower();
    geos.push(skirt, blower);
    a.feet.forEach((f, k) => {
      const side = k === 0 ? -1 : 1;
      const s = new THREE.Mesh(skirt, painted);
      s.position.set(f.x, f.y + ARCH.sink - 0.2, f.z);
      s.castShadow = true;
      const bx = f.x + a.rx * side * 1.3;
      const bz = f.z + a.rz * side * 1.3;
      const box = new THREE.Mesh(blower, painted);
      box.position.set(bx, level.groundAt(bx, bz) - 0.05, bz);
      // The grille faces the leg it feeds.
      box.rotation.y = cp.heading + (side < 0 ? Math.PI / 2 : -Math.PI / 2);
      box.castShadow = true;
      group.add(s, box);
      const shoulder = new THREE.Vector3(f.x, a.top - ARCH.corner * 0.3, f.z);
      for (const along of [-1, 1]) {
        const gx = f.x + a.rx * side * 1.5 + fx * along * 4.2;
        const gz = f.z + a.rz * side * 1.5 + fz * along * 4.2;
        const line = strand(shoulder, new THREE.Vector3(gx, level.groundAt(gx, gz), gz), 0.012);
        geos.push(line);
        group.add(new THREE.Mesh(line, rope));
      }
      // The mast, outside the foot, and the lamp head on it.
      const mx = f.x + a.rx * side * 2.6;
      const mz = f.z + a.rz * side * 2.6;
      const my = level.groundAt(mx, mz);
      const mast = new THREE.CylinderGeometry(0.06, 0.09, FLOOD.mast, 8);
      mast.translate(mx, my + FLOOD.mast / 2, mz);
      geos.push(mast);
      const pole = new THREE.Mesh(mast, alloy);
      pole.castShadow = true;
      group.add(pole);
      const head = std(
        { color: 0xdde3ea, emissive: 0xfff2d6, emissiveIntensity: FLOOD.day, roughness: 0.4 },
        "flood-head",
      );
      floodHeads.push(head);
      const lampGeo = new THREE.BoxGeometry(0.7, 0.45, 0.35);
      geos.push(lampGeo);
      const lamp = new THREE.Mesh(lampGeo, head);
      // Aimed back UP the piste — against the heading — and dipped.
      const dx = -fx * Math.cos(FLOOD.dip);
      const dz = -fz * Math.cos(FLOOD.dip);
      const dy = -Math.sin(FLOOD.dip);
      lamp.position.set(mx, my + FLOOD.mast, mz);
      lamp.lookAt(mx + dx, my + FLOOD.mast + dy, mz + dz);
      group.add(lamp);
      floods.push({ x: mx, y: my + FLOOD.mast, z: mz, dx, dy, dz });
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow(),
          color: 0xfff0d0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        }),
      );
      mats.push(sprite.material);
      sprite.scale.setScalar(FLOOD.glow);
      sprite.position.set(mx + dx * 0.3, my + FLOOD.mast + dy * 0.3, mz + dz * 0.3);
      sprite.visible = false;
      sprite.renderOrder = 7;
      group.add(sprite);
      floodGlows.push(sprite);
    });

    // THE NETS either side of the last stretch: orange mesh on posts,
    // laid along the piste's edge as it runs, from `NET.before` up the
    // piste to `NET.after` past the line.
    const netTex = netTexture();
    texs.push(netTex);
    const netMat = std(
      { map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 },
      "finish-net",
    );
    const pts = level.track.points;
    // On a slalom the nets line the whole course, start to finish.
    const from = level.slalom ? level.slalom.from - 2 : Math.max(0, cp.s - NET.before);
    const to = Math.min(level.track.length, cp.s + NET.after);
    for (const side of [-1, 1]) {
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      let n = 0;
      let run = 0;
      for (const p of pts) {
        if (p.s < from || p.s > to) continue;
        const px = p.x + Math.cos(p.heading) * side * (p.width / 2 + NET.out);
        const pz = p.z - Math.sin(p.heading) * side * (p.width / 2 + NET.out);
        const py = level.groundAt(px, pz);
        pos.push(px, py - 0.05, pz, px, py + NET.height, pz);
        uv.push(run / 0.5, 0, run / 0.5, NET.height / 0.5);
        if (n > 0) idx.push(2 * n - 2, 2 * n - 1, 2 * n, 2 * n, 2 * n - 1, 2 * n + 1);
        if (n % Math.round(NET.post / 2) === 0) {
          const post = new THREE.CylinderGeometry(0.03, 0.03, NET.height + 0.3, 5);
          post.translate(px, py + NET.height / 2, pz);
          geos.push(post);
          group.add(new THREE.Mesh(post, dark));
        }
        n++;
        run += 2;
      }
      if (n < 2) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      geos.push(g);
      group.add(new THREE.Mesh(g, netMat));
    }

    // THE LINE ON THE SNOW: a checkered band dyed across the piste, laid
    // on the snow as it lies, lifted a hair so it never flickers in and
    // out of the snow.
    const bandTex = bandTexture();
    texs.push(bandTex);
    const dye = std(
      {
        map: bandTex,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      },
      "arch-band",
    );
    const half = cp.width / 2 + 1;
    const nx = Math.ceil((2 * half) / 0.5);
    const nz = 4;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const sq = ARCH.band / 3;
    for (let j = 0; j <= nz; j++) {
      const along = (j / nz - 0.5) * ARCH.band;
      for (let i = 0; i <= nx; i++) {
        const across = (i / nx - 0.5) * 2 * half;
        const x = a.x + a.rx * across + fx * along;
        const z = a.z + a.rz * across + fz * along;
        pos.push(x, level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z)) + 0.04, z);
        uv.push(across / sq, along / sq + 1);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const p = j * (nx + 1) + i;
        const q2 = p + nx + 1;
        idx.push(p, q2, p + 1, p + 1, q2, q2 + 1);
      }
    }
    const bandGeo = new THREE.BufferGeometry();
    bandGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    bandGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    bandGeo.setIndex(idx);
    bandGeo.computeVertexNormals();
    geos.push(bandGeo);
    const band = new THREE.Mesh(bandGeo, dye);
    band.receiveShadow = true;
    group.add(band);

    // The finish has no panels of its own: its markers ride over the
    // arch's legs instead.
    tops[tops.length - 1] = a.feet.map((f) => new THREE.Vector3(f.x, a.top + ARCH.tube + 1.1, f.z));
  };

  level.checkpoints.forEach(placeGate);
  poles.instanceMatrix.needsUpdate = true;
  panels.instanceMatrix.needsUpdate = true;

  // THE EDGE POLES down both sides of every run on the mountain, each in
  // its own colour (R23, R27) — on a map of a resort the other runs are
  // marked as the raced one is — the right-hand ones banded orange at the
  // top. A pole that would stand on another run's groomed snow (a junction,
  // a lane across a piste) is left out.
  const stakeGeo = edgeStake(EDGE.height, EDGE.radius);
  const bandGeo = edgeBand(EDGE.height, EDGE.band, EDGE.radius);
  geos.push(stakeGeo, bandGeo);
  const stakeMat = std({ color: 0xffffff, roughness: 0.55 }, "edge-stake");
  const lines = level.resort
    ? level.resort.runs
    : [{ points: level.track.points, length: level.track.length, grade: gradeOf(level) }];
  const edgeCount = lines.reduce((sum, r) => sum + Math.ceil(r.length / EDGE.every) + 1, 0);
  const stakes = new THREE.InstancedMesh(stakeGeo, stakeMat, edgeCount * 2);
  const bands = new THREE.InstancedMesh(bandGeo, reflectorMat, edgeCount);
  stakes.castShadow = true;
  group.add(stakes, bands);
  let si = 0;
  let bi = 0;
  const paint = new THREE.Color();
  for (const run of lines) {
    paint.set(GRADE_LOOK[run.grade].stake);
    let nextS = 0;
    for (const p of run.points) {
      if (p.s < nextS) continue;
      nextS += EDGE.every;
      for (const side of [-1, 1]) {
        const x = p.x + Math.cos(p.heading) * side * (p.width / 2 + EDGE.out);
        const z = p.z - Math.sin(p.heading) * side * (p.width / 2 + EDGE.out);
        if (lines.length > 1 && level.packedAt(x, z) > 0.5) continue;
        const y = level.groundAt(x, z) - 0.1;
        if (si < stakes.count) {
          stakes.setColorAt(si, paint);
          stakes.setMatrixAt(si++, m4.compose(at.set(x, y, z), q.identity(), one));
        }
        // The skier's right going down AS DRAWN is the engine's left: the
        // renderer's frame mirrors the map (`input-model.ts`).
        if (side < 0 && bi < bands.count) {
          bands.setMatrixAt(bi++, m4.compose(at.set(x, y, z), q.identity(), one));
        }
      }
    }
  }
  for (let i = si; i < stakes.count; i++) stakes.setMatrixAt(i, m4.compose(at, q, none));
  for (let i = bi; i < bands.count; i++) bands.setMatrixAt(i, m4.compose(at, q, none));
  stakes.instanceMatrix.needsUpdate = true;
  if (stakes.instanceColor) stakes.instanceColor.needsUpdate = true;
  bands.instanceMatrix.needsUpdate = true;

  // THE SIGNS at the head of every run and where a lane leaves one.
  const signs = createRunSigns(level, haze);
  group.add(signs.group);

  // THE PISTE LIGHTS: the floodlight masts down every run.
  const lights = createPisteLights(level, haze);
  group.add(lights.group);

  const breathing = new THREE.Color();
  let lit = -1;
  return {
    group,
    floods,
    update(state) {
      // A FREE RIDE races no course: its red and blue gates — the panels, a
      // slalom's flex poles and the markers over the owed gate — are left
      // off the mountain; the start, the finish, the edge poles, the signs
      // and the lights stay, as a ski area keeps them. Asked of the state
      // every frame, because a map standing is reused by the next run on it
      // whatever its mode.
      const raced = state.rules.course || state.rules.tricks;
      poles.visible = raced;
      panels.visible = raced;
      markers.forEach((m, k) => (m.visible = raced && tops[lit]?.[k] !== undefined));
      if (slalomPoles) slalomPoles.group.visible = raced;
      const next = state.progress.nextCheckpoint;
      const t = state.t;
      slalomPoles?.update(state);
      house?.update(state);
      if (next !== lit) {
        if (lit >= 0 && tops[lit]) {
          panels.setColorAt(lit * 2, muted(colours[lit]));
          panels.setColorAt(lit * 2 + 1, muted(colours[lit]));
        }
        lit = next;
        markers.forEach((m, k) => {
          const top = tops[lit]?.[k];
          m.visible = raced && top !== undefined;
          if (top) m.position.copy(top);
        });
      }
      if (tops[lit] && level.checkpoints[lit]?.pole === undefined) {
        breathing.copy(colours[lit]).multiplyScalar(1 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4)));
        panels.setColorAt(lit * 2, breathing);
        panels.setColorAt(lit * 2 + 1, breathing);
      }
      for (const m of markers) m.rotation.y = t * 1.5;
      if (panels.instanceColor) panels.instanceColor.needsUpdate = true;
    },
    setLamps(level, pixels) {
      const on = Math.min(1, Math.max(0, level));
      lights.setLamps(on, pixels);
      for (const h of floodHeads) h.emissiveIntensity = FLOOD.day + FLOOD.night * on;
      for (const s of floodGlows) {
        s.visible = on > 0.02;
        (s.material as THREE.SpriteMaterial).opacity = on;
      }
      reflectorMat.emissiveIntensity = 0.2 + 1.6 * on;
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      poles.dispose();
      panels.dispose();
      stakes.dispose();
      bands.dispose();
      signs.dispose();
      lights.dispose();
      slalomPoles?.dispose();
      house?.dispose();
      for (const t of texs) t.dispose();
    },
  };
}
