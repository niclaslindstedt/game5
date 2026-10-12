// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING HILL AS DRAWN (R43): the hill's furniture hung on the
// map off `ski-jump-plan.ts` — every structure in one facade mesh
// (`ski-jump-build.ts`), and over it what the facade kit cannot carry:
//
//   * THE TRACKS: two glazed ice grooves down the in-run's floor, their
//     lips either side, laid on the profile the engine guides the jumper
//     down (`Level.skiJump.yAt`), so his skis run IN them;
//   * THE LINES dyed across the landing hill (the P line blue, K red, HS
//     orange, the fall line, blue dye and spruce twigs between) and the
//     coloured bands down both sides — one draw;
//   * THE DISTANCE BOARDS and the gates' numbers, painted once into an
//     atlas — one draw;
//   * THE WIND FLAGS streaming with the hill's own air along it and across
//     it (`windAlong`), the START LIGHT beside the jury's gate (red on the
//     lights, green once he may go), and the LEADER'S LINE to beat laid
//     across the snow in green (`leaderOf`).
//
// Presentation only: nothing here is read back.

import * as THREE from "three";
import { windAlong, type GameState, type Level } from "@engine";

import { FacadeKit } from "./facade-kit.ts";
import { facadeGeometry, facadeMaterial } from "./facade-mesh.ts";
import type { HazeUniforms } from "./haze.ts";
import { hillPoint } from "./ski-jump-frame.ts";
import { buildSkiJump } from "./ski-jump-build.ts";
import {
  landingWidth,
  planOfDistance,
  SJ_LOOK,
  skiJumpPlan,
  type SkiJumpPlan,
} from "./ski-jump-plan.ts";
import { leaderOf } from "./ski-jump-run.ts";
import type { PisteMast } from "./piste-light-plan.ts";
import { createJumpArena } from "./ski-jump-arena.ts";
import { createFlagSheet, type FlagTop } from "./wind-flags.ts";

type Paint = (p: THREE.MeshStandardMaterialParameters, name: string) => THREE.Material;

export type SkiJumpView = {
  group: THREE.Group;
  update(state: GameState): void;
  dispose(): void;
};

/** The floodlight masts of `level`'s hill, for the light the snow is lit
 * by after dark (`piste-lights.ts`'s bake), or none. */
export function skiJumpMasts(level: Level): readonly PisteMast[] {
  return skiJumpPlan(level)?.masts ?? [];
}

const LINE_COLOUR: Record<string, number> = {
  p: 0x1d5fd0,
  k: 0xd0202a,
  hs: 0xf07a12,
  fall: 0x22262b,
  dye: 0x4f86d8,
  twig: 0x2c4a2a,
};

/** A strip of quads across the hill at `d`, `width` m along, from `a0` to
 * `a1`, `lift` m over the profile, coloured `c` — pushed into the arrays. */
function pushAcross(
  plan: SkiJumpPlan,
  d: number,
  width: number,
  a0: number,
  a1: number,
  lift: number,
  c: THREE.Color,
  pos: number[],
  col: number[],
): void {
  const f = plan.frame;
  const corners = [
    hillPoint(f, d - width / 2, a0, lift),
    hillPoint(f, d - width / 2, a1, lift),
    hillPoint(f, d + width / 2, a1, lift),
    hillPoint(f, d + width / 2, a0, lift),
  ];
  for (const i of [0, 2, 1, 0, 3, 2]) {
    const p = corners[i];
    pos.push(p.x, p.y, p.z);
    col.push(c.r, c.g, c.b);
  }
}

/** The atlas the boards and the gates' numbers are painted in: a cell a
 * number (`cellOf`), white boards with black figures, a coloured edge by
 * the zone the distance falls in. */
function boardAtlas(plan: SkiJumpPlan): {
  tex: THREE.CanvasTexture;
  cellOf: (key: string) => [number, number, number, number];
} {
  const hill = plan.frame.hill;
  const keys: string[] = [];
  for (const b of plan.boards)
    if (!b.tick && !keys.includes(`d${b.distance}`)) keys.push(`d${b.distance}`);
  for (const g of plan.gates) keys.push(`g${g.number}`);
  keys.push("tick", "back");
  const cols = 8;
  const cw = 128;
  const ch = 80;
  const rows = Math.ceil(keys.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const g = canvas.getContext("2d")!;
  keys.forEach((key, i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    if (key === "back") {
      g.fillStyle = "#c9cdd2";
      g.fillRect(x, y, cw, ch);
      return;
    }
    if (key === "tick") {
      g.fillStyle = "#f4f6f8";
      g.fillRect(x, y, cw, ch);
      g.fillStyle = "#1c2026";
      g.fillRect(x + cw * 0.42, y + 6, cw * 0.16, ch - 12);
      return;
    }
    const n = Number(key.slice(1));
    const gate = key[0] === "g";
    const zone = gate
      ? "#1c2026"
      : n >= hill.hs
        ? "#f07a12"
        : n >= hill.w
          ? "#d0202a"
          : n >= hill.distanceAt(hill.p)
            ? "#1d5fd0"
            : "#1c2026";
    g.fillStyle = gate ? "#e8c21c" : "#f6f8fa";
    g.fillRect(x, y, cw, ch);
    g.fillStyle = zone;
    g.fillRect(x, y, cw, 9);
    g.fillRect(x, y + ch - 9, cw, 9);
    g.fillStyle = "#14171b";
    g.font = `800 ${Math.round(ch * 0.66)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), x + cw / 2, y + ch / 2 + 2);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const cellOf = (key: string): [number, number, number, number] => {
    const i = Math.max(0, keys.indexOf(key));
    const u0 = ((i % cols) * cw) / canvas.width;
    const v1 = 1 - (Math.floor(i / cols) * ch) / canvas.height;
    return [u0, v1 - ch / canvas.height, u0 + cw / canvas.width, v1];
  };
  return { tex, cellOf };
}

/** THE HILL'S VIEW on `level`, or null on a map with none. */
export function createSkiJump(level: Level, haze: HazeUniforms, paint: Paint): SkiJumpView | null {
  const plan = skiJumpPlan(level);
  if (!plan) return null;
  const f = plan.frame;
  const hill = f.hill;
  const L = SJ_LOOK;
  const group = new THREE.Group();
  group.name = "ski-jump";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];

  // THE STRUCTURES: one facade mesh.
  const kit = new FacadeKit();
  buildSkiJump(kit, level, plan);
  const built = facadeGeometry(kit.out);
  geos.push(built);
  const builtMat = facadeMaterial(haze, "ski-jump");
  mats.push(builtMat);
  const structures = new THREE.Mesh(built, builtMat);
  structures.castShadow = true;
  structures.receiveShadow = true;
  group.add(structures);
  // THE STADIUM round the out-run: the counter-slope, the banners, the
  // flags (`ski-jump-arena.ts`).
  const arena = createJumpArena(level, haze, paint);
  if (arena) group.add(arena.group);

  // THE TRACKS: each groove a glazed strip on the profile, its two lips a
  // hand higher, down the in-run from the deck to the edge.
  const ir = plan.inRun;
  const tPos: number[] = [];
  const lPos: number[] = [];
  const ds: number[] = [];
  for (let d = ir.from; d < ir.to; d += 0.5) ds.push(d);
  ds.push(ir.to);
  const quadAlong = (out: number[], a0: number, a1: number, h0: number, h1: number) => {
    for (let i = 0; i + 1 < ds.length; i++) {
      const p = [
        hillPoint(f, ds[i], a0, h0),
        hillPoint(f, ds[i], a1, h1),
        hillPoint(f, ds[i + 1], a1, h1),
        hillPoint(f, ds[i + 1], a0, h0),
      ];
      for (const k of [0, 2, 1, 0, 3, 2]) out.push(p[k].x, p[k].y, p[k].z);
    }
  };
  for (const side of [-1, 1]) {
    const c = side * ir.track;
    const g = ir.groove;
    quadAlong(tPos, c - g, c + g, L.track.over - 0.012, L.track.over - 0.012);
    quadAlong(lPos, c - g - 0.04, c - g, L.track.over + L.track.lip, L.track.over + L.track.lip);
    quadAlong(lPos, c + g, c + g + 0.04, L.track.over + L.track.lip, L.track.over + L.track.lip);
    quadAlong(lPos, c - g, c - g, L.track.over + L.track.lip, L.track.over - 0.012);
    quadAlong(lPos, c + g, c + g, L.track.over - 0.012, L.track.over + L.track.lip);
  }
  const asGeo = (pos: number[]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    geos.push(geo);
    return geo;
  };
  const ice = paint({ color: 0xcfe4f2, roughness: 0.08, metalness: 0.1 }, "jump-ice");
  const lips = paint(
    { color: 0xe9eef2, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide },
    "jump-lips",
  );
  const tracks = new THREE.Mesh(asGeo(tPos), ice);
  tracks.receiveShadow = true;
  group.add(tracks, new THREE.Mesh(asGeo(lPos), lips));

  // THE LINES across the landing hill and the bands down its sides.
  const dPos: number[] = [];
  const dCol: number[] = [];
  const c = new THREE.Color();
  for (const line of plan.lines) {
    const half = landingWidth(hill, line.d) / 2;
    c.set(LINE_COLOUR[line.kind]);
    pushAcross(plan, line.d, line.width, -half, half, 0.035, c, dPos, dCol);
  }
  const band = (from: number, to: number, colour: number) => {
    c.set(colour);
    for (let d = from; d < to; d += 1) {
      const e = Math.min(to, d + 1);
      for (const side of [-1, 1]) {
        const w0 = landingWidth(hill, (d + e) / 2) / 2;
        const a0 = side * (w0 - L.line.side - 0.1);
        const a1 = side * (w0 - 0.1);
        pushAcross(
          plan,
          (d + e) / 2,
          e - d,
          Math.min(a0, a1),
          Math.max(a0, a1),
          0.035,
          c,
          dPos,
          dCol,
        );
      }
    }
  };
  band(plan.bands.blue[0], plan.bands.blue[1], LINE_COLOUR.p);
  band(plan.bands.red[0], plan.bands.red[1], LINE_COLOUR.k);
  const dyeGeo = new THREE.BufferGeometry();
  dyeGeo.setAttribute("position", new THREE.Float32BufferAttribute(dPos, 3));
  dyeGeo.setAttribute("color", new THREE.Float32BufferAttribute(dCol, 3));
  dyeGeo.computeVertexNormals();
  geos.push(dyeGeo);
  const dyeMat = paint(
    {
      vertexColors: true,
      roughness: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    },
    "jump-dye",
  );
  const dye = new THREE.Mesh(dyeGeo, dyeMat);
  dye.receiveShadow = true;
  group.add(dye);

  // THE BOARDS and the gates' numbers: one atlas, one draw.
  const atlas = boardAtlas(plan);
  texs.push(atlas.tex);
  const bPos: number[] = [];
  const bUv: number[] = [];
  const B = L.board;
  const face = (
    cx: number,
    cy: number,
    cz: number,
    ux: number,
    uz: number,
    w: number,
    h: number,
    cell: [number, number, number, number],
    back?: [[number, number], [number, number]],
  ) => {
    // A board w wide along (ux, uz), h tall, its centre (cx, cy, cz).
    const p = [
      [cx - (ux * w) / 2, cy - h / 2, cz - (uz * w) / 2],
      [cx + (ux * w) / 2, cy - h / 2, cz + (uz * w) / 2],
      [cx + (ux * w) / 2, cy + h / 2, cz + (uz * w) / 2],
      [cx - (ux * w) / 2, cy + h / 2, cz - (uz * w) / 2],
    ];
    const uv = [
      [cell[0], cell[1]],
      [cell[2], cell[1]],
      [cell[2], cell[3]],
      [cell[0], cell[3]],
    ];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      bPos.push(...p[k]);
      bUv.push(...uv[k]);
    }
    // Its back, wound the other way: a bare panel, never the number seen
    // through from behind.
    if (!back) return;
    for (const k of [0, 2, 1, 0, 3, 2]) {
      bPos.push(...p[k]);
      bUv.push(...back[k % 2 === 0 ? 0 : 1]);
    }
  };
  const blank = atlas.cellOf("back");
  const mid: [number, number] = [(blank[0] + blank[2]) / 2, (blank[1] + blank[3]) / 2];
  const bare: [[number, number], [number, number]] = [mid, mid];
  for (const b of plan.boards) {
    const a = b.side * (landingWidth(hill, b.d) / 2 + B.out);
    const at = hillPoint(f, b.d, a);
    const g = level.groundAt(at.x, at.z);
    const w = b.tick ? B.w * 0.35 : B.w;
    const h = b.tick ? B.h * 0.5 : B.h;
    // Facing across the hill toward its axis: along the board runs the
    // way that reads left to right from the axis — a viewer looking out to
    // the right (+r) has the hill's downhill (+f) on his right, three's
    // world being right-handed.
    const ux = b.side * f.fx;
    const uz = b.side * f.fz;
    const ox = -b.side * f.rx * 0.05;
    const oz = -b.side * f.rz * 0.05;
    face(
      at.x + ox,
      g + B.lift + h / 2 - 0.1,
      at.z + oz,
      ux,
      uz,
      w,
      h,
      atlas.cellOf(b.tick ? "tick" : `d${b.distance}`),
      bare,
    );
  }
  // The gates' numbers on the right wall's inner face, read from the bar.
  for (const gt of plan.gates) {
    const a = ir.half - 0.01;
    const at = hillPoint(f, gt.d, a, L.wall.high * 0.5);
    face(at.x, at.y, at.z, f.fx, f.fz, 0.42, 0.26, atlas.cellOf(`g${gt.number}`));
  }
  const boardGeo = new THREE.BufferGeometry();
  boardGeo.setAttribute("position", new THREE.Float32BufferAttribute(bPos, 3));
  boardGeo.setAttribute("uv", new THREE.Float32BufferAttribute(bUv, 2));
  boardGeo.computeVertexNormals();
  geos.push(boardGeo);
  const boardMat = paint({ map: atlas.tex, roughness: 0.7 }, "jump-boards");
  group.add(new THREE.Mesh(boardGeo, boardMat));

  // THE WIND FLAGS, streaming with the hill's air (`wind-flags.ts`).
  const flagColours = [0xd8232a, 0xf3f4f6, 0x1d5fd0];
  const flagTops: FlagTop[] = plan.flags.map((fl, i) => {
    const a = fl.side * (landingWidth(hill, fl.d) / 2 + L.flag.out);
    const at = hillPoint(f, fl.d, a);
    return {
      x: at.x,
      y: level.groundAt(at.x, at.z) + L.flag.pole - 0.05,
      z: at.z,
      phase: fl.d * 0.37,
      stripes: [flagColours[i % flagColours.length]],
    };
  });
  const flagMat = paint(
    { vertexColors: true, roughness: 0.8, side: THREE.DoubleSide },
    "jump-flags",
  );
  const flags = createFlagSheet(flagTops, { long: 1.2, deep: 0.7, segs: 4 }, flagMat);
  geos.push(flags.geometry);
  group.add(flags.mesh);
  // The air blows UP the hill on a head wind: the flags stream toward the
  // tower, or down it in a tail; across with the crosswind.
  const downwind = (head: number, across: number) => {
    const wx = -f.fx * head + f.rx * across;
    const wz = -f.fz * head + f.rz * across;
    const speed = Math.hypot(wx, wz);
    return speed < 0.05 ? { wx: f.rx, wz: f.rz, speed } : { wx: wx / speed, wz: wz / speed, speed };
  };
  const streamFlags = (t: number, head: number, across: number) => {
    const w = downwind(head, across);
    flags.stream(t, w.wx, w.wz, w.speed);
    arena?.stream(t, w.wx, w.wz, w.speed);
  };

  // THE START LIGHT on its post by the jury's gate: red, yellow, green.
  const lightMats = [0xff2a1e, 0xffc41a, 0x2fe05a].map((col, i) => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: col,
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    mats.push(m);
    return { m, col, i };
  });
  const lamp = new THREE.BoxGeometry(0.16, 0.16, 0.06);
  geos.push(lamp);
  const lightGroup = new THREE.Group();
  for (const l of lightMats) {
    const mesh = new THREE.Mesh(lamp, l.m);
    mesh.position.set(0, 1.55 - l.i * 0.2, 0);
    lightGroup.add(mesh);
  }
  group.add(lightGroup);
  let litGate = -1;
  const placeLight = (gate: number) => {
    const g = plan.gates[Math.min(plan.gates.length - 1, Math.max(0, gate))];
    const at = hillPoint(f, g.d + 1.2, ir.half + L.wall.thick + 0.6, 0);
    lightGroup.position.set(at.x, at.y, at.z);
    lightGroup.rotation.y = f.heading + Math.PI;
    litGate = gate;
  };
  placeLight(hill.design);

  // THE LINE TO BEAT: green across the landing hill, where the leader's
  // margin puts it.
  const beatPos = new Float32Array(6 * 3);
  const beatGeo = new THREE.BufferGeometry();
  beatGeo.setAttribute("position", new THREE.BufferAttribute(beatPos, 3));
  geos.push(beatGeo);
  const beatMat = new THREE.MeshBasicMaterial({
    color: 0x2fe05a,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -6,
  });
  mats.push(beatMat);
  const beat = new THREE.Mesh(beatGeo, beatMat);
  beat.frustumCulled = false;
  beat.visible = false;
  group.add(beat);
  let beatAt = -1;
  const layBeat = (distance: number) => {
    const d = planOfDistance(hill, distance);
    const half = landingWidth(hill, d) / 2;
    const p: number[] = [];
    const col: number[] = [];
    pushAcross(plan, d, L.line.beat, -half, half, 0.05, c, p, col);
    beatPos.set(p);
    beatGeo.getAttribute("position").needsUpdate = true;
    beatGeo.computeBoundingSphere();
    beatAt = distance;
  };

  return {
    group,
    update(state) {
      const j = state.jump;
      const wind = j ? windAlong(state, j, 0) : { head: 0, across: 0 };
      streamFlags(state.t, wind.head, wind.across);
      if (j && j.gate !== litGate) placeLight(j.gate);
      const onBar = j?.stage === "bar";
      const counting = state.phase === "countdown";
      for (const l of lightMats) {
        const on = onBar && (counting ? l.i === 0 : l.i === 2);
        l.m.emissiveIntensity = on ? 2.4 : 0;
      }
      const leader = state.skiJumpContest ? leaderOf(state.skiJumpContest) : null;
      beat.visible = leader !== null && j !== undefined;
      if (leader && leader.toBeat !== beatAt) layBeat(leader.toBeat);
    },
    dispose() {
      arena?.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
    },
  };
}
