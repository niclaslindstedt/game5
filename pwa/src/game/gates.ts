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
//     A race's start house over its course instead (`start-house.ts`), and
//     a SKI CROSS's start gate of four doors (`cross-gate.ts`).
//   * A SKI CROSS's gates are triangular flags and its edges dyed blue
//     (`cross-flags.ts`), and its finish line a red line across the snow.
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
//     at night — each where the engine stands it (`stakePlan`), bent over
//     or snapped as this run has knocked it (`edge-stakes.ts`).
//   * THE SIGNS: a board on a post at the head of every run and where a
//     lane leaves one — its mark, its number, its name, an arrow
//     (`run-signs.ts`).
//   * THE PISTE LIGHTS: a floodlight mast every fifty metres or so down
//     every run, lit with the floods (`piste-lights.ts`).
//   * A SLOPESTYLE COURSE's rails and boxes (`jibs-view.ts`).
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
import { speedSkiLines, stakePlan, type Checkpoint, type GameState, type Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { bannerTexture } from "./banner-texture.ts";
import { glow } from "./glow-sprite.ts";
import { GRADE_LOOK } from "./grade-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createJibs } from "./jibs-view.ts";
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
import { createCrossFlags } from "./cross-flags.ts";
import { createCrossGate } from "./cross-gate.ts";
import { bulgeAt, hasNets, netDents, type NetDent } from "./net-bulge.ts";
import { createPisteLights } from "./piste-lights.ts";
import { createRunSigns } from "./run-signs.ts";
import { createSlalomPoles } from "./slalom-poles.ts";
import { netShape, netStretch, NETS } from "./spectator-plan.ts";
import { createStartHouse } from "./start-house.ts";
import { ARCH, archPlan, type ArchPlan } from "./start-arch.ts";
import { LOOSE } from "./trail-stamp.ts";

/** A PANEL GATE's measure, m: the poles' height and their gap along the
 * line, the panel's height and how far down the poles it hangs. A giant
 * slalom gate is two poles a little over a metre apart with a panel 0.5 m
 * deep at the top. */
const PANEL = { pole: 1.85, gap: 1.05, drop: 0.5, radius: 0.017 };

/** THE START HUT, m: its footprint and height, and where it stands — off
 * the line's left edge. */
const HUT = { width: 2.4, depth: 2.2, height: 2.1, out: 2.5 };

/** THE WAND: two posts either side of the start gate's centre and the bar
 * between them, at a racer's knee. */
const WAND = { gap: 1.2, height: 0.45, post: 0.6 };

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
   * poles and the edge stakes as knocked, its start clock. */
  update(state: GameState): void;
  /** The night's lights at `level` (0 off … 1): the floods' glow, the
   * edge poles' reflectors and the piste lights along every run, with
   * `pixels` the lens's focal length in pixels. */
  setLamps(level: number, pixels: number): void;
  dispose(): void;
};

/** The line dyed across the snow: two squares of the checker, repeated —
 * or a SKI CROSS's straight red line (R35). */
function bandTexture(red = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const g = canvas.getContext("2d")!;
  g.fillStyle = red ? "#d8262f" : "#1b1f25";
  g.fillRect(0, 0, 2, 2);
  g.fillStyle = red ? "#d8262f" : "#f4f6f8";
  g.fillRect(0, 0, 1, 1);
  g.fillRect(1, 1, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.anisotropy = 8;
  return tex;
}

/** The rows an A-net's sheet is hung in, up its height — enough for a
 * pocket round a body to read. */
const NET_ROWS = 6;

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
  // The A-nets' sheets as hung, and what bulges them (`bulgeNets`).
  const sheets: { geo: THREE.BufferGeometry; base: Float32Array; rows: number }[] = [];
  const dents: NetDent[] = [];
  const push = { by: 0, ux: 0, uz: 0 };
  let netHeight = 0;
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
  // a start house over the course; a SKI CROSS's gates are flags and its
  // start a gate of doors (R35).
  const crossFlags = createCrossFlags(level, haze);
  const crossGate = createCrossGate(level, haze);
  const slalomPoles = crossFlags ? null : createSlalomPoles(level, haze);
  const house = createStartHouse(level, haze);
  if (slalomPoles) group.add(slalomPoles.group);
  if (house) group.add(house.group);
  if (crossFlags) group.add(crossFlags.group);
  if (crossGate) group.add(crossGate.group);

  // A SPEED TRACK's run-out (R34): where its arch and its arena stand.
  const runOut = speedSkiLines(level);

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
    // A ski cross's flags are `cross-flags.ts`'s, a pole gate's poles
    // `slalom-poles.ts`'s; the marker rides over the outside poles, or the
    // turning pole.
    if (cp.flags || cp.pole !== undefined) {
      for (let k = 0; k < 4; k++) poles.setMatrixAt(index * 4 + k, m4.compose(at, q, none));
      for (let k = 0; k < 2; k++) panels.setMatrixAt(index * 2 + k, m4.compose(at, q, none));
      const top = slalomPoles?.top(index);
      tops.push(cp.flags ? (crossFlags?.tops(index) ?? []) : top ? [top] : []);
      return;
    }
    [-1, 1].forEach((side, k) => {
      const cx = cp.x + rx * half * side;
      const cz = cp.z + rz * half * side;
      const y = level.groundAt(cx, cz) - 0.15;
      // The start and the finish carry no panels: the hut and the arch
      // are their marks. A speed track's last gate is its timing zone's
      // bottom line, marked as its top line is — the photocells' posts
      // either side of the track's margin — and its arch is over the
      // run-out's end.
      const scale = first || (last && !runOut) ? none : one;
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
      panels.setColorAt(j, last || runOut ? colour : muted(colour));
      own.push(new THREE.Vector3(cx, y + PANEL.pole + 1.2, cz));
    });
    // A ski cross's start gate is its own mark: no marker over its doors.
    tops.push(first && crossGate ? [] : own);
    if (first && !house && !crossGate) hutAt(cp, rx, rz, fx, fz);
    if (last) {
      const end = runOut?.finish ?? cp;
      finish(end, Math.sin(end.heading), Math.cos(end.heading));
    }
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
    // laid along the piste's edge as it runs, from `NETS.before` up the
    // piste to `NETS.after` past the line.
    const netTex = netTexture();
    texs.push(netTex);
    netHeight = netShape(level).height;
    const netMat = std(
      { map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 },
      "finish-net",
    );
    const pts = level.track.points;
    // On a race course (a slalom, a downhill) the nets line the whole of
    // it, start to finish.
    const { from, to } = netStretch(level, cp);
    // ...and on a downhill they are its A-nets, tall and out at the line a
    // racer is caught on (`netShape`).
    const shape = netShape(level);
    // THE POSTS, one instanced draw for both sides however long the course
    // (a downhill's nets run three kilometres).
    const postEvery = Math.round(NETS.post / 2);
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, shape.height + 0.3, 5);
    postGeo.translate(0, shape.height / 2, 0);
    geos.push(postGeo);
    let postCount = 0;
    for (const p of pts) if (p.s >= from && p.s <= to) postCount += 1;
    const posts = new THREE.InstancedMesh(postGeo, dark, 2 * Math.ceil(postCount / postEvery) + 2);
    let postAt = 0;
    // A downhill's A-nets are hung in rows, so the sheet can bulge round a
    // racer driven into it (`net-bulge.ts`); the B-nets are one strip.
    const rows = hasNets(level) ? NET_ROWS : 1;
    for (const side of [-1, 1]) {
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      let n = 0;
      let run = 0;
      for (const p of pts) {
        if (p.s < from || p.s > to) continue;
        const px = p.x + Math.cos(p.heading) * side * (p.width / 2 + shape.out);
        const pz = p.z - Math.sin(p.heading) * side * (p.width / 2 + shape.out);
        const py = level.groundAt(px, pz);
        for (let r = 0; r <= rows; r++) {
          const h = (r / rows) * (shape.height + 0.05);
          pos.push(px, py - 0.05 + h, pz);
          uv.push(run / 0.5, (h - 0.05) / 0.5);
        }
        const k = (rows + 1) * n;
        if (n > 0) {
          for (let r = 0; r < rows; r++) {
            const a = k - rows - 1 + r;
            idx.push(a, a + 1, k + r, k + r, a + 1, k + r + 1);
          }
        }
        if (n % postEvery === 0 && postAt < posts.count) {
          posts.setMatrixAt(postAt++, m4.compose(at.set(px, py, pz), q.identity(), one));
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
      if (rows > 1) sheets.push({ geo: g, base: Float32Array.from(pos), rows });
    }
    posts.count = postAt;
    posts.instanceMatrix.needsUpdate = true;
    group.add(posts);

    // THE LINE ON THE SNOW: a checkered band dyed across the piste, laid
    // on the snow as it lies, lifted a hair so it never flickers in and
    // out of the snow.
    const bandTex = bandTexture(level.skiCross !== undefined);
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
    // arch's legs instead — but a speed track's last gate keeps its posts'.
    if (!runOut) {
      tops[tops.length - 1] = a.feet.map(
        (f) => new THREE.Vector3(f.x, a.top + ARCH.tube + 1.1, f.z),
      );
    }
  };

  level.checkpoints.forEach(placeGate);
  poles.instanceMatrix.needsUpdate = true;
  panels.instanceMatrix.needsUpdate = true;

  // THE EDGE POLES down both sides of every run on the mountain, each in
  // its own colour (R23, R27), the right-hand ones banded orange at the
  // top — where the engine stands them (`stakePlan`), which a skier knocks
  // over and snaps (`edge-stakes.ts`), tipped here as this run has.
  const plan = stakePlan(level);
  const stakeGeo = edgeStake(plan.height, plan.radius);
  const bandGeo = edgeBand(plan.height, plan.band, plan.radius);
  geos.push(stakeGeo, bandGeo);
  const stakeMat = std({ color: 0xffffff, roughness: 0.55 }, "edge-stake");
  const bandOf = new Int32Array(plan.count).fill(-1);
  let bandCount = 0;
  for (let i = 0; i < plan.count; i++) if (plan.banded[i]) bandOf[i] = bandCount++;
  const stakes = new THREE.InstancedMesh(stakeGeo, stakeMat, Math.max(1, plan.count));
  const bands = new THREE.InstancedMesh(bandGeo, reflectorMat, Math.max(1, bandCount));
  stakes.castShadow = true;
  group.add(stakes, bands);
  const paint = new THREE.Color();
  const stakeAxis = new THREE.Vector3();
  /** Stand stake `i` at its foot, `tilt` rad over toward (dx, dz). */
  const placeStake = (i: number, tilt: number, dx: number, dz: number): void => {
    const p = plan.stakes[i];
    if (tilt === 0) q.identity();
    else q.setFromAxisAngle(stakeAxis.set(dz, 0, -dx).normalize(), tilt);
    m4.compose(at.set(p.x, p.y - 0.1, p.z), q, one);
    stakes.setMatrixAt(i, m4);
    if (bandOf[i] >= 0) bands.setMatrixAt(bandOf[i], m4);
  };
  for (let i = 0; i < plan.count; i++) {
    stakes.setColorAt(i, paint.set(GRADE_LOOK[plan.grade[i]].stake));
    placeStake(i, 0, 1, 0);
  }
  if (plan.count === 0) {
    stakes.setMatrixAt(0, m4.compose(at, q, none));
    bands.setMatrixAt(0, m4.compose(at, q, none));
  }
  stakes.instanceMatrix.needsUpdate = true;
  if (stakes.instanceColor) stakes.instanceColor.needsUpdate = true;
  bands.instanceMatrix.needsUpdate = true;
  /** The tilt each stake is drawn at, so a frame redraws only the ones
   * that moved — and stands them all back up for a run that has touched
   * none. */
  const drawnTilt = new Float32Array(plan.count);
  let anyTipped = false;
  const tipStakes = (state: GameState): void => {
    const own = state.stakes;
    if (!own && !anyTipped) return;
    let moved = false;
    anyTipped = false;
    for (let i = 0; i < plan.count; i++) {
      const tilt = own ? own.tilt[i] : 0;
      if (tilt !== 0) anyTipped = true;
      if (tilt === drawnTilt[i]) continue;
      drawnTilt[i] = tilt;
      placeStake(i, tilt, own ? own.dirX[i] : 1, own ? own.dirZ[i] : 0);
      moved = true;
    }
    if (moved) {
      stakes.instanceMatrix.needsUpdate = true;
      bands.instanceMatrix.needsUpdate = true;
    }
  };

  // THE SIGNS at the head of every run and where a lane leaves one.
  const signs = createRunSigns(level, haze);
  group.add(signs.group);

  // THE PISTE LIGHTS: the floodlight masts down every run.
  const lights = createPisteLights(level, haze);
  group.add(lights.group);

  // A SLOPESTYLE COURSE'S RAILS AND BOXES (`jibs-view.ts`).
  const jibs = createJibs(level, std);
  if (jibs) group.add(jibs.group);

  const breathing = new THREE.Color();
  let lit = -1;
  let bulged = false;
  /** THE A-NETS BULGING round whatever of the skier is in them, and
   * back flat once nothing is. */
  const bulgeNets = (state: GameState): void => {
    netDents(state, dents);
    if (dents.length === 0 && !bulged) return;
    for (const sheet of sheets) {
      const attr = sheet.geo.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      arr.set(sheet.base);
      if (dents.length > 0) {
        const stride = sheet.rows + 1;
        for (let v = 0; v < arr.length / 3; v++) {
          const j = 3 * v;
          const foot = sheet.base[3 * (v - (v % stride)) + 1] + 0.05;
          const up = arr[j + 1] - foot;
          bulgeAt(arr[j], arr[j + 1], arr[j + 2], up, netHeight, dents, push);
          if (push.by <= 0) continue;
          arr[j] += push.ux * push.by;
          arr[j + 2] += push.uz * push.by;
        }
      }
      attr.needsUpdate = true;
      sheet.geo.computeVertexNormals();
    }
    bulged = dents.length > 0;
  };
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
      if (crossFlags) crossFlags.group.visible = raced;
      const next = state.progress.nextCheckpoint;
      const t = state.t;
      slalomPoles?.update(state);
      house?.update(state);
      tipStakes(state);
      crossGate?.update(state);
      if (sheets.length > 0) bulgeNets(state);
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
      crossFlags?.update(state, next);
      const owed = level.checkpoints[lit];
      if (tops[lit] && owed?.pole === undefined && !owed?.flags) {
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
      crossFlags?.dispose();
      crossGate?.dispose();
      jibs?.dispose();
      for (const t of texs) t.dispose();
    },
  };
}
