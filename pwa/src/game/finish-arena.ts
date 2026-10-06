// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FINISH ARENA'S FURNITURE — what a crowd stands on, behind and looks
// at, as `spectator-plan.ts` lays it out (the arch, the line and the nets
// down the last stretch are `gates.ts`'s):
//
//   * THE GRANDSTANDS: tiered standing terraces either side of the line,
//     grey treads on scaffolding down to the snow, the risers dressed in
//     the arch's red and white, a rail along the back.
//   * THE FENCES: orange spectator netting on posts in front of every bank
//     on the mountain, and the PADDED BOARDS round the finish circle — the
//     outrun a racer stops in — with the EXIT GATE in the back: an
//     inflatable in two halves, 3.5 m between them.
//   * THE LEADER'S PLATFORM behind the exit gate: 3.5 m square, the board
//     standing at its back and the leader's chair in front of it.
//   * THE VIDEO WALL: a screen on scaffolding with a white roof and sides
//     over it, facing up the piste so the stands can see it — showing the
//     run's clock, live.
//
// Built in code in the marks' chunky look; reads the `Level` and the plan
// and writes neither.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GameState, Level } from "@engine";
import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";

import { PALETTE } from "../identity.ts";
import { netLook, netTexture } from "./gates.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { Fence, Grandstand, SpectatorPlan } from "./spectator-plan.ts";

export type FinishArena = {
  group: THREE.Group;
  /** The video wall's clock off `state`. */
  update(state: GameState): void;
  dispose(): void;
};

const GREY = new THREE.Color(0x9aa1a8);
const DARK = new THREE.Color(0x3a3f45);
const WHITE = new THREE.Color(0xf2f4f5);
const RED = new THREE.Color(PALETTE.flag);
const BLUE = new THREE.Color(PALETTE.gateBlue);

/** A box laid into a world-space mesh: the faces' colour baked in. */
class Kit {
  pos: number[] = [];
  col: number[] = [];
  box(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    yaw: number,
    colour: THREE.Color,
  ): void {
    if (h <= 0.001) return;
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(cx, cy, cz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      const shade = i < 12 ? 0.86 : i >= 24 ? 0.93 : 1;
      this.col.push(colour.r * shade, colour.g * shade, colour.b * shade);
    }
    g.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** A grandstand's terraces, scaffold and rail. */
function buildStand(kit: Kit, level: Level, s: Grandstand): void {
  // The stand's own frame: `f` along it, `b` back away from the piste.
  const yaw = s.facing + Math.PI;
  const bx = Math.sin(yaw);
  const bz = Math.cos(yaw);
  const fx = Math.cos(yaw);
  const fz = -Math.sin(yaw);
  const at = (a: number, back: number) => ({
    x: s.x + fx * a + bx * back,
    z: s.z + fz * a + bz * back,
  });
  const floor = s.y - 0.5;
  for (let r = 0; r < s.rows; r++) {
    const top = s.y + r * s.rise;
    const c = at(0, (r + 0.5) * s.tread);
    // The tread and the step's body under it, down to the deck.
    kit.box(c.x, top - 0.06, c.z, s.width, 0.12, s.tread, yaw, GREY);
    // The riser at its front: banner panels, red and white.
    const panels = Math.round(s.width / 4);
    for (let k = 0; k < panels; k++) {
      const a = -s.width / 2 + (k + 0.5) * (s.width / panels);
      const p = at(a, r * s.tread + 0.02);
      const h = r === 0 ? top - 0.12 - (floor - 0.4) : s.rise;
      kit.box(
        p.x,
        top - 0.12 - h / 2,
        p.z,
        s.width / panels,
        h,
        0.04,
        yaw,
        (k + r) % 2 ? WHITE : RED,
      );
    }
  }
  // The scaffold: legs every four metres along and every two back, down to
  // the snow from under each tread, a beam along each line of them.
  for (let a = -s.width / 2; a <= s.width / 2 + 0.01; a += 4) {
    for (let r = 0; r <= s.rows; r += 2) {
      const p = at(a, Math.min(r, s.rows - 0.05) * s.tread);
      const top = s.y + Math.min(r, s.rows - 1) * s.rise - 0.12;
      const g = level.groundAt(p.x, p.z) - 0.3;
      kit.box(p.x, (top + g) / 2, p.z, 0.09, top - g, 0.09, yaw, DARK);
    }
  }
  // The back: a rail on posts at the top step's edge.
  const backTop = s.y + (s.rows - 1) * s.rise;
  const rail = at(0, s.rows * s.tread - 0.05);
  kit.box(rail.x, backTop + 1.05, rail.z, s.width, 0.06, 0.06, yaw, DARK);
  for (let a = -s.width / 2; a <= s.width / 2 + 0.01; a += 2) {
    const p = at(a, s.rows * s.tread - 0.05);
    kit.box(p.x, backTop + 0.55, p.z, 0.05, 1.05, 0.05, yaw, DARK);
  }
  // Its two ends: a stair of the treads' own grey, a rail up it.
  for (const side of [-1, 1]) {
    for (let r = 0; r < s.rows; r++) {
      const p = at((side * s.width) / 2, (r + 0.5) * s.tread);
      const top = s.y + r * s.rise;
      kit.box(p.x, (top + floor) / 2, p.z, 0.08, top - floor, s.tread, yaw, DARK);
      kit.box(p.x, top + 0.55, p.z, 0.05, 1.0, 0.05, yaw, DARK);
    }
  }
}

/** The finish circle's padded boards: a box a span, blue and white. */
function buildBoards(kit: Kit, level: Level, fence: Fence): void {
  const pts = fence.points;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    const g = level.groundAt(cx, cz);
    kit.box(
      cx,
      g + fence.height / 2 - 0.1,
      cz,
      len + 0.02,
      fence.height + 0.2,
      0.35,
      yaw,
      i % 2 ? WHITE : BLUE,
    );
  }
}

/** A net fence on posts: one strip of mesh along its points. */
function netStrip(
  level: Level,
  fence: Fence,
): { mesh: THREE.BufferGeometry; posts: THREE.BufferGeometry[] } {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const posts: THREE.BufferGeometry[] = [];
  let run = 0;
  fence.points.forEach((p, n) => {
    if (n > 0) run += Math.hypot(p.x - fence.points[n - 1].x, p.z - fence.points[n - 1].z);
    const y = level.groundAt(p.x, p.z);
    pos.push(p.x, y - 0.05, p.z, p.x, y + fence.height, p.z);
    uv.push(run / 0.5, 0, run / 0.5, fence.height / 0.5);
    if (n > 0) idx.push(2 * n - 2, 2 * n - 1, 2 * n, 2 * n, 2 * n - 1, 2 * n + 1);
    if (n % 2 === 0) {
      const post = new THREE.CylinderGeometry(0.025, 0.025, fence.height + 0.2, 5);
      post.translate(p.x, y + fence.height / 2, p.z);
      posts.push(post);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { mesh: g, posts };
}

/** The video wall's picture: the run's clock, big, on the night-blue of a
 * screen, a red rule under it. */
function drawScreen(g: CanvasRenderingContext2D, time: string): void {
  const { width: w, height: h } = g.canvas;
  g.fillStyle = "#0b1626";
  g.fillRect(0, 0, w, h);
  g.fillStyle = PALETTE.flag;
  g.fillRect(0, h * 0.78, w, h * 0.06);
  g.fillStyle = "#f6f8fa";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `800 ${Math.round(h * 0.42)}px sans-serif`;
  g.fillText(time, w / 2, h * 0.44);
}

export function createFinishArena(
  level: Level,
  plan: SpectatorPlan,
  haze: HazeUniforms,
): FinishArena {
  const group = new THREE.Group();
  group.name = "finish-arena";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name);
    mats.push(m);
    return m;
  };
  const painted = std({ vertexColors: true, roughness: 0.75 }, "arena-painted");
  const kit = new Kit();
  for (const s of plan.stands) buildStand(kit, level, s);
  const netTex = netTexture();
  texs.push(netTex);
  // Seen from both sides, and drawn as three draws a see-through two-sided
  // sheet — its back faces, then its front — but as two meshes with a
  // side each: one two-sided material has its program re-derived for
  // each half on every frame.
  const netMat = {
    back: std({ ...netLook(netTex), side: THREE.BackSide }, "fan-net"),
    front: std({ ...netLook(netTex), side: THREE.FrontSide }, "fan-net"),
  };
  const postMat = std({ color: 0x2b3036, roughness: 0.8 }, "fan-post");
  const postGeos: THREE.BufferGeometry[] = [];
  const netGeos: THREE.BufferGeometry[] = [];
  for (const f of plan.fences) {
    if (f.kind === "board") {
      buildBoards(kit, level, f);
      continue;
    }
    const { mesh, posts } = netStrip(level, f);
    netGeos.push(mesh);
    postGeos.push(...posts);
  }
  // Every bank's net is one mesh, and every post another: two draws.
  if (netGeos.length) {
    const nets = mergeGeometries(netGeos)!;
    for (const g of netGeos) g.dispose();
    geos.push(nets);
    group.add(new THREE.Mesh(nets, netMat.back), new THREE.Mesh(nets, netMat.front));
  }
  if (postGeos.length) {
    const merged = mergeAll(postGeos);
    geos.push(merged);
    group.add(new THREE.Mesh(merged, postMat));
  }

  let screenCtx: CanvasRenderingContext2D | null = null;
  let screenTex: THREE.CanvasTexture | null = null;
  const a = plan.arena;
  if (a) {
    // THE EXIT GATE: two inflatable halves either side of the gap.
    const rx = Math.cos(a.heading);
    const rz = -Math.sin(a.heading);
    for (const side of [-1, 1]) {
      const x = a.exit.x + rx * side * 2.25;
      const z = a.exit.z + rz * side * 2.25;
      kit.box(x, level.groundAt(x, z) + 1.1, z, 1.0, 2.4, 0.9, a.heading, RED);
    }
    // THE LEADER'S PLATFORM: the deck, the board at its back, the chair.
    // Its deck at least the line's height, on a box down to the snow.
    const under = level.groundAt(a.leader.x, a.leader.z);
    const lg = Math.max(under, a.y - 0.2);
    const back = a.leader.facing + Math.PI;
    const bx = Math.sin(back);
    const bz = Math.cos(back);
    kit.box(
      a.leader.x,
      (lg + 0.3 + under - 0.3) / 2,
      a.leader.z,
      3.5,
      lg + 0.6 - under,
      3.5,
      a.heading,
      DARK,
    );
    const bdx = a.leader.x + bx * 1.5;
    const bdz = a.leader.z + bz * 1.5;
    kit.box(bdx, lg + 0.3 + 1.2, bdz, 1.8, 2.4, 0.07, a.heading, RED);
    kit.box(bdx, lg + 0.3 + 1.9, bdz, 1.5, 0.3, 0.09, a.heading, WHITE);
    kit.box(bdx, lg + 0.3 + 0.5, bdz, 1.5, 0.12, 0.09, a.heading, WHITE);
    const cx = a.leader.x + bx * 0.3;
    const cz = a.leader.z + bz * 0.3;
    kit.box(cx, lg + 0.3 + 0.45, cz, 0.6, 0.12, 0.6, a.heading, WHITE);
    kit.box(cx + bx * 0.27, lg + 0.3 + 0.8, cz + bz * 0.27, 0.6, 0.6, 0.08, a.heading, WHITE);
    for (const [u, v] of [
      [-0.25, -0.25],
      [0.25, -0.25],
      [-0.25, 0.25],
      [0.25, 0.25],
    ]) {
      kit.box(
        cx + rx * u + bx * v,
        lg + 0.3 + 0.2,
        cz + rz * u + bz * v,
        0.05,
        0.4,
        0.05,
        a.heading,
        DARK,
      );
    }
    // THE VIDEO WALL: scaffold legs, the screen's frame, a white roof and
    // sides, and the screen itself — lit, so it reads in any light.
    const s = a.screen;
    const sx = Math.cos(s.facing);
    const sz = -Math.sin(s.facing);
    const fwdx = Math.sin(s.facing);
    const fwdz = Math.cos(s.facing);
    const top = s.y + s.height / 2;
    for (const u of [-1, 1]) {
      for (const v of [-0.6, 0.6]) {
        const x = s.x + sx * u * (s.width / 2 - 0.2) - fwdx * (v + 0.7);
        const z = s.z + sz * u * (s.width / 2 - 0.2) - fwdz * (v + 0.7);
        const g = level.groundAt(x, z) - 0.3;
        kit.box(x, (top + g) / 2, z, 0.12, top - g, 0.12, s.facing, DARK);
      }
    }
    kit.box(
      s.x - fwdx * 0.12,
      s.y,
      s.z - fwdz * 0.12,
      s.width + 0.4,
      s.height + 0.4,
      0.2,
      s.facing,
      DARK,
    );
    kit.box(
      s.x - fwdx * 0.7,
      top + 0.45,
      s.z - fwdz * 0.7,
      s.width + 1.2,
      0.1,
      2.6,
      s.facing,
      WHITE,
    );
    for (const u of [-1, 1]) {
      const x = s.x + sx * u * (s.width / 2 + 0.55) - fwdx * 0.7;
      const z = s.z + sz * u * (s.width / 2 + 0.55) - fwdz * 0.7;
      kit.box(x, s.y + 0.2, z, 0.08, s.height + 0.9, 2.6, s.facing, WHITE);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 284;
    screenCtx = canvas.getContext("2d");
    if (screenCtx) drawScreen(screenCtx, formatTime(0));
    screenTex = new THREE.CanvasTexture(canvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    texs.push(screenTex);
    // THE SCREEN IS LIGHT, NOT PAINT — unlit, so the sun, the shade and the
    // night leave it bright — but it stands in the same air as the stand it
    // hangs over: the haze, the mist and a storm's or a fog's closed view
    // fade it with everything else at its distance. And it goes
    // through the same tone curve as the rest of the frame, because the
    // haze it fades into is tone-mapped (`HAZE_FRAGMENT`): a screen kept off
    // the curve would fade into a brighter grey than the air round it.
    const glass = hazeMaterial(new THREE.MeshBasicMaterial({ map: screenTex }), haze, "video-wall");
    mats.push(glass);
    const plane = new THREE.PlaneGeometry(s.width, s.height);
    geos.push(plane);
    const screen = new THREE.Mesh(plane, glass);
    screen.position.set(s.x, s.y, s.z);
    screen.rotation.y = s.facing;
    screen.name = "video-wall";
    group.add(screen);
  }

  const body = kit.geometry();
  geos.push(body);
  const mesh = new THREE.Mesh(body, painted);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  let shown = "";
  return {
    group,
    update(state) {
      if (!screenCtx || !screenTex) return;
      // Tenths, so the canvas is redrawn ten times a second at most.
      const time = formatTime(Math.floor(state.progress.time * 10) / 10);
      if (time === shown) return;
      shown = time;
      drawScreen(screenCtx, time);
      screenTex.needsUpdate = true;
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
    },
  };
}

/** Many small geometries as one. */
function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const p of parts) {
    const flat = p.index ? p.toNonIndexed() : p;
    pos.push(...(flat.getAttribute("position").array as Float32Array));
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
