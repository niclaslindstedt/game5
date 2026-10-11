// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING STADIUM AS DRAWN (R43): what of the arena round the
// out-run `ski-jump-arena-plan.ts` places that the finish arena's builders
// do not carry — the COUNTER-SLOPE rising past the back boards to the back
// terraces, the BANNERS down the landing hill's walls into the out-run,
// and the FLAGS on their poles along every stand's back, streaming with the
// hill's air (`wind-flags.ts`). The stands, the boards, the leader's box
// and the video wall are `finish-arena.ts`'s; the masts are lit with the
// hill's (`piste-lights.ts`). Hung by `ski-jump-view.ts`; presentation only.

import * as THREE from "three";
import type { Level } from "@engine";

import { FacadeKit } from "./facade-kit.ts";
import { FACADE } from "./facade-paint.ts";
import { facadeGeometry, facadeMaterial } from "./facade-mesh.ts";
import type { HazeUniforms } from "./haze.ts";
import { jumpArenaPlan, SJ_ARENA, type JumpArenaPlan } from "./ski-jump-arena-plan.ts";
import { hillPoint, landingWidth } from "./ski-jump-frame.ts";
import { SJ_LOOK } from "./ski-jump-plan.ts";
import { createFlagSheet } from "./wind-flags.ts";

type Paint = (p: THREE.MeshStandardMaterialParameters, name: string) => THREE.Material;

export type JumpArenaView = {
  group: THREE.Group;
  /** Stream the flags downwind along (wx, wz) at `speed` m/s. */
  stream(t: number, wx: number, wz: number, speed: number): void;
  dispose(): void;
};

const POLE = 0xdfe3e6;
const SNOW = 0xf4f7fa;

/** The snow under (d, a) of the hill's frame. */
function groundOf(level: Level, plan: JumpArenaPlan, d: number, a: number): number {
  const p = hillPoint(plan.frame, d, a);
  return level.groundAt(p.x, p.z);
}

/** THE COUNTER-SLOPE: a bank of snow from the out-run's floor past the back
 * boards up to the flat the back terraces stand on, its ends and its back
 * spilling down to the snow round it as a pushed-up bank does, never a wall
 * — the ground falls away past the out-run's end. */
function buildBank(kit: FacadeKit, level: Level, plan: JumpArenaPlan): void {
  const b = plan.bank;
  const hill = plan.frame.hill;
  const floor = hill.yAt(hill.outrun);
  const S = SJ_ARENA.bank;
  const lift = (d: number): number => {
    if (d <= b.d0) return 0;
    if (d >= b.d1) return b.rise;
    // Eased in and out, as a pushed-up bank of snow lies.
    const k = (d - b.d0) / (b.d1 - b.d0);
    return b.rise * k * k * (3 - 2 * k);
  };
  const ds: number[] = [];
  for (let d = b.d0 - 0.5; d < b.d2 + S.reach; d += 1) ds.push(d);
  ds.push(b.d2 + S.reach);
  const as: number[] = [];
  for (let a = -b.half - S.reach; a < b.half + S.reach; a += 2) as.push(a);
  as.push(b.half + S.reach);
  // The bank's own height, spilling off its flanks and its back, and the
  // snow under it where the bank is lower than the snow.
  const own = (d: number, a: number) =>
    floor + lift(d) - S.spill * (Math.max(0, Math.abs(a) - b.half) + Math.max(0, d - b.d2));
  const top = (d: number, a: number) =>
    Math.max(own(d, a), groundOf(level, plan, d, a) - 0.3) + 0.04;
  const buried = (d: number, a: number) => own(d, a) < groundOf(level, plan, d, a) - 0.25;
  for (let i = 0; i + 1 < ds.length; i++) {
    for (let j = 0; j + 1 < as.length; j++) {
      const [d0, d1] = [ds[i], ds[i + 1]];
      const [a0, a1] = [as[j], as[j + 1]];
      if (buried(d0, a0) && buried(d0, a1) && buried(d1, a0) && buried(d1, a1)) continue;
      kit.quad(
        [a1, top(d0, a1), d0],
        [a0, top(d0, a0), d0],
        [a0, top(d1, a0), d1],
        [a1, top(d1, a1), d1],
        FACADE.snow,
        SNOW,
      );
    }
  }
}

/** THE BANNERS on the walls' inner faces into the out-run: a colour, a
 * band of another along it, laid a hand proud of the boards. */
function buildBanners(kit: FacadeKit, level: Level, plan: JumpArenaPlan): void {
  const hill = plan.frame.hill;
  const high = SJ_LOOK.rail.high - 0.2;
  for (const bn of plan.banners) {
    const side = bn.side;
    const a = (d: number) => (side * landingWidth(hill, d)) / 2 - side * 0.03;
    const ds: number[] = [];
    for (let d = bn.d0; d < bn.d1; d += 2) ds.push(d);
    ds.push(bn.d1);
    for (let i = 0; i + 1 < ds.length; i++) {
      const [p, q] = side > 0 ? [ds[i], ds[i + 1]] : [ds[i + 1], ds[i]];
      const gp = groundOf(level, plan, p, a(p));
      const gq = groundOf(level, plan, q, a(q));
      const band = (lo: number, hi: number, tint: number) =>
        kit.quad(
          [a(p), gp + lo, p],
          [a(q), gq + lo, q],
          [a(q), gq + hi, q],
          [a(p), gp + hi, p],
          FACADE.plain,
          tint,
        );
      band(0.02, high * 0.42, bn.colour);
      band(high * 0.42, high * 0.58, bn.stripe);
      band(high * 0.58, high, bn.colour);
    }
  }
}

/** THE STADIUM'S DRAWN PIECES round `level`'s hill, or null on a map with
 * none. */
export function createJumpArena(
  level: Level,
  haze: HazeUniforms,
  paint: Paint,
): JumpArenaView | null {
  const plan = jumpArenaPlan(level);
  if (!plan) return null;
  const f = plan.frame;
  const group = new THREE.Group();
  group.name = "ski-jump-arena";
  const kit = new FacadeKit();
  kit.at(f.x, 0, f.z, f.heading);
  buildBank(kit, level, plan);
  buildBanners(kit, level, plan);
  // The flagpoles, in the world's frame.
  kit.at(0, 0, 0, 0);
  for (const fl of plan.flags)
    kit.column(fl.x, fl.z, fl.y - 0.1, fl.y + fl.pole, 0.04, FACADE.steel, POLE, 5);
  const geometry = facadeGeometry(kit.out);
  const material = facadeMaterial(haze, "ski-jump-arena");
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const F = SJ_ARENA.flag;
  const flagMat = paint(
    { vertexColors: true, roughness: 0.8, side: THREE.DoubleSide },
    "arena-flags",
  );
  const flags = createFlagSheet(
    plan.flags.map((fl, i) => ({
      x: fl.x,
      y: fl.y + fl.pole - 0.1,
      z: fl.z,
      phase: i * 1.37,
      stripes: fl.stripes,
    })),
    { long: F.long, deep: F.deep, segs: 6 },
    flagMat,
  );
  group.add(flags.mesh);

  return {
    group,
    stream: flags.stream,
    dispose() {
      geometry.dispose();
      material.dispose();
      flags.geometry.dispose();
    },
  };
}
