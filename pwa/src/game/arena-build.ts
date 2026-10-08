// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FINISH ARENA'S STRUCTURES, BUILT — the temporary event structures a
// race's finish is put up in for a week (`docs/buildings.md`), on the facade
// kit (`facade-kit.ts`) in what they are really made of: galvanised
// SCAFFOLD TUBE (`FACADE.steel`), timber DECKS (`FACADE.boards`) and white
// composite PANELS (`FACADE.panel`), as `spectator-plan.ts` lays them out.
//
//   * A GRANDSTAND: standing terraces on a scaffold — a timber tread a row,
//     each `rise` over the one in front, its riser dressed in the arch's red
//     and white; under them the standards in bays of about two and a half
//     metres, a line of them every second row, a ledger along each line under
//     its deck, the back and the ends braced on the diagonal; a guard rail
//     round the back and up both ends.
//   * THE LEADER'S PLATFORM: a timber deck on scaffold legs, a valance in
//     the race's red, steps up its side, the board at its back on two tubes
//     and the leader's white chair in front of it.
//   * THE VIDEO WALL'S TOWER: a scaffold tower two bays high and one deep
//     behind the screen, braced, a working deck under the screen, the
//     screen's dark steel frame, white side wings and a white roof over it
//     under snow. The screen itself is `finish-arena.ts`'s.
//
// Three-free: the arrays are made a mesh by `facade-mesh.ts`.

import type { Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { FACADE } from "./facade-paint.ts";
import type { FacadeKit, V3 } from "./facade-kit.ts";
import { strut } from "./race-build.ts";
import type { Arena, Grandstand } from "./spectator-plan.ts";

/** The tints, sRGB. */
const T = {
  as: 0xffffff,
  red: Number.parseInt(PALETTE.flag.slice(1), 16),
  white: 0xf2f4f5,
  /** A deck's boards, fresh plywood-pale. */
  deck: 0xf0ece4,
  /** The screen's frame, dark steel. */
  frame: 0x2a2e33,
} as const;

/** A scaffold tube's half-width, m (a 48 mm tube, drawn a shade fat so it
 * holds at the stands' distance), and a bay's length. */
const TUBE = 0.035;
const BAY = 2.5;

/** The snow under a point of the kit's frame, in that frame's y. */
const groundOf = (kit: FacadeKit, level: Level) => (x: number, z: number) => {
  const w = kit.world([x, 0, z]);
  return level.groundAt(w[0], w[2]);
};

/** A GRANDSTAND into `kit`, in world metres: its front edge's centre at
 * (s.x, s.z), the crowd facing `s.facing`, the row `r` tread's top at
 * `s.y + r · s.rise` (where `spectator-plan.ts` stands its fans). */
export function buildGrandstand(kit: FacadeKit, level: Level, s: Grandstand): void {
  // The frame: +z toward what the crowd watches, x along the stand.
  kit.at(s.x, 0, s.z, s.facing);
  const g = groundOf(kit, level);
  const hw = s.width / 2;
  const deep = s.rows * s.tread;
  const top = (r: number) => s.y + r * s.rise;
  const DECK = 0.1;
  // THE TREADS: a timber deck a row, the riser in front of it in the arch's
  // red and white panels, the first down to the snow.
  const panels = Math.max(1, Math.round(s.width / 4));
  for (let r = 0; r < s.rows; r++) {
    const z0 = -(r + 1) * s.tread;
    const z1 = -r * s.tread;
    kit.box(-hw, top(r) - DECK, z0, hw, top(r), z1, FACADE.boards, T.deck, {
      layer: FACADE.boards,
      tint: T.deck,
    });
    for (let k = 0; k < panels; k++) {
      const x0 = -hw + (k * s.width) / panels;
      const x1 = -hw + ((k + 1) * s.width) / panels;
      const y0 = r === 0 ? Math.min(g(x0, z1), g(x1, z1)) - 0.2 : top(r - 1);
      kit.wall(
        x0,
        z1 + 0.01,
        x1,
        z1 + 0.01,
        y0,
        top(r) - DECK,
        FACADE.plain,
        (k + r) % 2 ? T.white : T.red,
      );
    }
  }
  // THE SCAFFOLD: standards in bays along, a line every second row and one
  // at the back; under each line's deck a ledger along it.
  const bays = Math.max(1, Math.round(s.width / BAY));
  const lines: number[] = [];
  for (let r = 0; r < s.rows; r += 2) lines.push(r);
  lines.push(s.rows);
  for (const r of lines) {
    const z = -Math.min(r * s.tread + 0.05, deep - 0.05);
    const under = top(Math.min(r, s.rows - 1)) - DECK;
    for (let k = 0; k <= bays; k++) {
      const x = -hw + (k * s.width) / bays;
      strut(kit, [x, g(x, z) - 0.25, z], [x, under, z], TUBE);
    }
    strut(kit, [-hw, under - 0.08, z], [hw, under - 0.08, z], TUBE * 0.9);
    // A second ledger near the snow where the line stands tall.
    const low = Math.max(g(-hw, z), g(hw, z)) + 0.4;
    if (under - low > 1.4) strut(kit, [-hw, low, z], [hw, low, z], TUBE * 0.9);
  }
  // The transoms front to back under the decks, at every standard.
  for (let k = 0; k <= bays; k++) {
    const x = -hw + (k * s.width) / bays;
    for (let i = 0; i + 1 < lines.length; i++) {
      const za = -Math.min(lines[i] * s.tread + 0.05, deep - 0.05);
      const zb = -Math.min(lines[i + 1] * s.tread + 0.05, deep - 0.05);
      const y = top(lines[i]) - DECK - 0.08;
      strut(kit, [x, y, za], [x, y, zb], TUBE * 0.9);
    }
  }
  // THE BRACING: the back face on the diagonal, bay by bay, zig-zagging;
  // each end the same, front to back.
  const zBack = -deep + 0.05;
  const backUnder = top(s.rows - 1) - DECK;
  for (let k = 0; k < bays; k++) {
    const xa = -hw + (k * s.width) / bays;
    const xb = -hw + ((k + 1) * s.width) / bays;
    const up = k % 2 === 0;
    strut(
      kit,
      [xa, up ? g(xa, zBack) + 0.3 : backUnder - 0.15, zBack],
      [xb, up ? backUnder - 0.15 : g(xb, zBack) + 0.3, zBack],
      TUBE * 0.85,
    );
  }
  for (const x of [-hw, hw]) {
    for (let i = 0; i + 1 < lines.length; i++) {
      const za = -Math.min(lines[i] * s.tread + 0.05, deep - 0.05);
      const zb = -Math.min(lines[i + 1] * s.tread + 0.05, deep - 0.05);
      strut(
        kit,
        [x, g(x, za) + 0.3, za],
        [x, top(lines[i + 1] - 1) - DECK - 0.15, zb],
        TUBE * 0.85,
      );
    }
  }
  // THE GUARD RAIL round the back, a post a bay, and up both ends.
  const railY = top(s.rows - 1) + 1.05;
  const zr = -deep + 0.04;
  strut(kit, [-hw, railY, zr], [hw, railY, zr], 0.03);
  strut(kit, [-hw, railY - 0.5, zr], [hw, railY - 0.5, zr], 0.025);
  for (let k = 0; k <= bays; k++) {
    const x = -hw + (k * s.width) / bays;
    strut(kit, [x, top(s.rows - 1), zr], [x, railY + 0.02, zr], 0.03);
  }
  for (const x of [-hw + 0.04, hw - 0.04]) {
    const front: V3 = [x, top(0) + 1.0, -0.1];
    const back: V3 = [x, railY, zr];
    strut(kit, front, back, 0.03);
    strut(kit, [x, top(0), -0.1], front, 0.03);
  }
}

/** THE LEADER'S PLATFORM into `kit`, in world metres: its deck's top at
 * `deck`, square, facing up the piste. */
export function buildLeaderPlatform(kit: FacadeKit, level: Level, a: Arena, deck: number): void {
  kit.at(a.leader.x, 0, a.leader.z, a.leader.facing);
  const g = groundOf(kit, level);
  const h = 1.75;
  // The deck on scaffold legs, a valance of the race's red hung round its
  // edge on three sides (the steps' side open), braced under it.
  kit.box(-h, deck - 0.12, -h, h, deck, h, FACADE.plain, T.white, {
    layer: FACADE.boards,
    tint: T.deck,
  });
  const valance = (x0: number, z0: number, x1: number, z1: number) =>
    kit.wall(x0, z0, x1, z1, deck - 0.55, deck - 0.12, FACADE.plain, T.red);
  valance(-h, h, h, h);
  valance(h, h, h, -h);
  valance(h, -h, -h, -h);
  const legs: [number, number][] = [
    [-h + 0.1, -h + 0.1],
    [h - 0.1, -h + 0.1],
    [h - 0.1, h - 0.1],
    [-h + 0.1, h - 0.1],
  ];
  for (const [x, z] of legs) strut(kit, [x, g(x, z) - 0.25, z], [x, deck - 0.12, z], TUBE);
  legs.forEach(([x, z], k) => {
    const [nx, nz] = legs[(k + 1) % 4];
    strut(kit, [x, deck - 0.2, z], [nx, deck - 0.2, nz], TUBE * 0.9);
    const lo = Math.max(g(x, z), g(nx, nz)) + 0.2;
    if (deck - 0.3 - lo > 0.5) strut(kit, [x, lo, z], [nx, deck - 0.3, nz], TUBE * 0.85);
  });
  // THE STEPS up its open side (−x), timber treads on their stringers.
  const foot = g(-h - 1, h - 0.6);
  const steps = Math.max(1, Math.min(5, Math.round((deck - foot) / 0.2)));
  for (let k = 0; k < steps; k++) {
    const y = foot + ((k + 1) * (deck - foot)) / (steps + 1);
    const x = -h - (steps - k) * 0.28;
    kit.box(x, y - 0.05, h - 1.1, x + 0.28, y, h - 0.1, FACADE.boards, T.deck, {
      layer: FACADE.boards,
      tint: T.deck,
    });
  }
  // THE BOARD at its back on two tubes: red, two white bands; the leader's
  // white chair before it.
  const bz = -1.5;
  for (const x of [-0.75, 0.75]) strut(kit, [x, deck, bz - 0.06], [x, deck + 2.5, bz - 0.06], TUBE);
  kit.box(-0.9, deck + 0.1, bz - 0.03, 0.9, deck + 2.5, bz + 0.03, FACADE.plain, T.red);
  kit.box(-0.75, deck + 1.9, bz + 0.03, 0.75, deck + 2.2, bz + 0.05, FACADE.plain, T.white);
  kit.box(-0.75, deck + 0.45, bz + 0.03, 0.75, deck + 0.57, bz + 0.05, FACADE.plain, T.white);
  const cz = -0.3;
  kit.box(-0.3, deck + 0.39, cz - 0.3, 0.3, deck + 0.51, cz + 0.3, FACADE.panel, T.white, {
    layer: FACADE.panel,
    tint: T.white,
  });
  kit.box(-0.3, deck + 0.51, cz - 0.34, 0.3, deck + 1.1, cz - 0.26, FACADE.panel, T.white);
  for (const [x, z] of [
    [-0.25, cz - 0.25],
    [0.25, cz - 0.25],
    [-0.25, cz + 0.25],
    [0.25, cz + 0.25],
  ])
    strut(kit, [x, deck, z], [x, deck + 0.39, z], 0.025, FACADE.steel, 0x6a7076);
}

/** THE VIDEO WALL'S TOWER into `kit`, in world metres: the scaffold, the
 * deck, the frame, the wings and the roof round the screen `s` (its
 * centre, its size, the way it faces). */
export function buildVideoTower(kit: FacadeKit, level: Level, s: Arena["screen"]): void {
  kit.at(s.x, 0, s.z, s.facing);
  const g = groundOf(kit, level);
  const hw = s.width / 2;
  const top = s.y + s.height / 2;
  const foot = s.y - s.height / 2;
  const zf = -0.35;
  const zb = -1.75;
  // THE TOWER: standards at the screen's ends and its middle, front and
  // back; ledgers every two metres up, the sides and the back braced.
  const xs = [-hw + 0.2, 0, hw - 0.2];
  for (const x of xs)
    for (const z of [zf, zb]) strut(kit, [x, g(x, z) - 0.3, z], [x, top + 0.35, z], TUBE * 1.2);
  const low = Math.min(...xs.flatMap((x) => [g(x, zf), g(x, zb)]));
  const lifts: number[] = [];
  for (let y = low + 1.8; y < top; y += 2) lifts.push(y);
  lifts.push(top + 0.3);
  for (const y of lifts) {
    for (const z of [zf, zb]) strut(kit, [xs[0], y, z], [xs[2], y, z], TUBE);
    for (const x of [xs[0], xs[2]]) strut(kit, [x, y, zf], [x, y, zb], TUBE);
  }
  let from = Math.max(...xs.map((x) => g(x, zb))) + 0.2;
  lifts.forEach((y, i) => {
    for (const x of [xs[0], xs[2]]) {
      const forward = i % 2 === 0;
      strut(kit, [x, from, forward ? zb : zf], [x, y, forward ? zf : zb], TUBE * 0.9);
    }
    for (let k = 0; k < 2; k++) {
      const a = xs[k];
      const b = xs[k + 1];
      const up = (i + k) % 2 === 0;
      strut(kit, [up ? a : b, from, zb], [up ? b : a, y, zb], TUBE * 0.9);
    }
    from = y;
  });
  // THE WORKING DECK under the screen, timber on the ledgers.
  const deck = foot - 0.35;
  kit.box(-hw - 0.3, deck - 0.08, zb - 0.2, hw + 0.3, deck, 0.25, FACADE.plain, T.frame, {
    layer: FACADE.boards,
    tint: T.deck,
  });
  // THE SCREEN'S FRAME: dark steel round and behind it.
  kit.box(-hw - 0.2, foot - 0.2, -0.32, hw + 0.2, top + 0.2, -0.02, FACADE.plain, T.frame, {
    layer: FACADE.plain,
    tint: T.frame,
  });
  // THE WINGS: white panels either side, out past the frame.
  for (const x of [-hw - 0.55, hw + 0.47]) {
    kit.box(x, deck - 0.6, zb - 0.3, x + 0.08, top + 0.55, 0.45, FACADE.panel, T.white, {
      layer: FACADE.panel,
      tint: T.white,
    });
  }
  // THE ROOF over the screen and its tower: white panels on a flat slab,
  // run out over the screen's face, snow on it.
  const mid = (zb - 0.3 + 0.7) / 2;
  const w = kit.world([0, 0, mid]);
  kit.at(w[0], 0, w[2], s.facing);
  kit.flatRoof(
    hw + 0.55,
    (0.7 - (zb - 0.3)) / 2,
    top + 0.55,
    0.18,
    0.05,
    { layer: FACADE.panel, tint: T.white },
    0.2,
  );
}
