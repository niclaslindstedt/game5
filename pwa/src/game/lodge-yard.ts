// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LODGE'S YARD — what stands on the SNOW before an afterski lodge
// rather than on its floor, so it follows the ground (`level.groundAt`) and
// is built in the world frame, once a map: the STEPS from the terrace down
// to the snow, and the SKI RACKS along the terrace's foot either side of
// them — two posts and a rail with a pair of skis or a pair of poles
// leaning in nearly every slot, the skis in the catalog's own topsheets,
// dealt off the lodge's place (presentation only, never `state.rng`). The
// skier going in leaves his own here too (`afterski.ts`: he stops at the
// door between the racks).

import * as THREE from "three";

import { CABINS, type Cabin, type Level } from "@engine";

import { CABIN_PAINT as P, cabinBench } from "./cabin-parts.ts";
import { DECK, GAP, TERRACE } from "./lodge-shapes.ts";
import { TOPSHEETS } from "./ski-topsheets.ts";
import type { Shape, V3 } from "./tree-mesh.ts";

/** The racks: how far out past the terrace's front they stand, m, where
 * along the front they start and end (from the middle), the rail's height,
 * the slot's width, how far out a ski's tail stands from the rail, and how
 * long a ski and a pole are. */
const RACK = {
  out: 0.9,
  from: GAP + 0.5,
  to: 6.3,
  rail: 1.15,
  slot: 0.55,
  foot: 0.42,
  ski: 1.72,
  pole: 1.25,
};
/** The steps: a rise and a tread, m, and how wide. */
const STEP = { rise: 0.19, tread: 0.32, half: GAP - 0.1 };

const SHEETS = Object.values(TOPSHEETS);
const DARK = new THREE.Color(0x17191c);

/** A box about `c`: `a` half its length, `b` half its width, `n` half its
 * thickness (the three at right angles), one colour. */
function slab(s: Shape, c: V3, a: V3, b: V3, n: V3, col: THREE.Color): void {
  const p = (i: number, j: number, k: number): V3 => [
    c[0] + a[0] * i + b[0] * j + n[0] * k,
    c[1] + a[1] * i + b[1] * j + n[1] * k,
    c[2] + a[2] * i + b[2] * j + n[2] * k,
  ];
  const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];
  s.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), col, n);
  s.quad(p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1), p(-1, -1, -1), col, neg(n));
  s.quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), col, b);
  s.quad(p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), p(-1, -1, -1), col, neg(b));
  s.quad(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1), col, a);
  s.quad(p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), p(-1, -1, -1), col, neg(a));
}

const sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const mid = (p: V3, q: V3): V3 => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const unit = (v: V3): V3 => scale(v, 1 / (Math.hypot(v[0], v[1], v[2]) || 1));
const cross = (p: V3, q: V3): V3 => [
  p[1] * q[2] - p[2] * q[1],
  p[2] * q[0] - p[0] * q[2],
  p[0] * q[1] - p[1] * q[0],
];

/** A board from `p` to `q`, `w` wide across `side` and `t` thick. */
function board(s: Shape, p: V3, q: V3, side: V3, w: number, t: number, col: THREE.Color): void {
  const a = scale(sub(q, p), 0.5);
  const b = scale(unit(side), w / 2);
  const n = scale(unit(cross(a, b)), t / 2);
  slab(s, mid(p, q), a, b, n, col);
}

/** A small hash of a lodge's place and a slot: 0..1. */
function dealt(c: Cabin, k: number): number {
  let h = (Math.round(c.x * 7) * 73856093) ^ (Math.round(c.z * 7) * 19349663) ^ (k * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** THE YARD of every lodge of `level` in the world frame, one geometry. */
export function lodgeYardGeometry(level: Level, lodges: readonly Cabin[]): THREE.BufferGeometry {
  const s = cabinBench();
  const d = CABINS.afterski;
  for (const c of lodges) {
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    // The building's frame to the world's: x across its front, z out of it.
    const at = (x: number, z: number, y?: number): V3 => {
      const wx = c.x + x * fz + z * fx;
      const wz = c.z - x * fx + z * fz;
      return [wx, y ?? level.groundAt(wx, wz), wz];
    };
    const across: V3 = [fz, 0, -fx];
    const out: V3 = [fx, 0, fz];
    const front = d.depth / 2 + TERRACE;
    const deck = c.y + DECK.top;
    // THE STEPS down from the deck to the snow, as many as its fall needs.
    const foot = at(0, front + 0.6)[1];
    const n = Math.min(14, Math.ceil((deck - foot) / STEP.rise));
    for (let k = 0; k < n; k++) {
      const top = deck - (k + 1) * STEP.rise;
      const z0 = front + k * STEP.tread;
      const lo =
        Math.min(at(-STEP.half, z0 + STEP.tread)[1], at(STEP.half, z0 + STEP.tread)[1]) - 0.4;
      if (top < lo + 0.4) break;
      const cz = z0 + STEP.tread / 2;
      const centre = at(0, cz, (top + lo) / 2);
      slab(
        s,
        centre,
        scale(across, STEP.half),
        scale(out, STEP.tread / 2),
        [0, (top - lo) / 2, 0],
        k % 2 ? P.board[0] : P.board[1],
      );
    }
    // THE RACKS, either side of the steps.
    let slotK = 0;
    for (const side of [-1, 1]) {
      const ux = (u: number): number => side * u;
      const z = front + RACK.out;
      const ends = [at(ux(RACK.from), z), at(ux(RACK.to), z)];
      for (const e of ends) {
        board(
          s,
          [e[0], e[1] - 0.5, e[2]],
          [e[0], e[1] + RACK.rail + 0.08, e[2]],
          across,
          0.12,
          0.12,
          P.log[0],
        );
      }
      const railAt = (t: number): V3 => {
        const p = ends[0];
        const q = ends[1];
        return [
          p[0] + (q[0] - p[0]) * t,
          p[1] + (q[1] - p[1]) * t + RACK.rail,
          p[2] + (q[2] - p[2]) * t,
        ];
      };
      board(s, railAt(0), railAt(1), out, 0.1, 0.1, P.log[1]);
      // A lower rail the tails knock against, and snow along the top one.
      board(
        s,
        [railAt(0)[0], railAt(0)[1] - RACK.rail + 0.3, railAt(0)[2]],
        [railAt(1)[0], railAt(1)[1] - RACK.rail + 0.3, railAt(1)[2]],
        out,
        0.08,
        0.08,
        P.log[2],
      );
      board(
        s,
        [railAt(0)[0], railAt(0)[1] + 0.065, railAt(0)[2]],
        [railAt(1)[0], railAt(1)[1] + 0.065, railAt(1)[2]],
        out,
        0.1,
        0.035,
        P.snow,
      );
      const slots = Math.floor((RACK.to - RACK.from) / RACK.slot);
      for (let i = 0; i < slots; i++) {
        const k = slotK++;
        const r = dealt(c, k);
        if (r < 0.18) continue;
        const t = (i + 0.5) / slots;
        const top = railAt(t);
        const u = RACK.from + (RACK.to - RACK.from) * t;
        if (r < 0.32) {
          // A pair of poles, crossed a little, their baskets in the snow.
          for (const du of [-0.06, 0.06]) {
            const base = at(ux(u + du * 2), z + RACK.foot * 0.8);
            const tip: V3 = [top[0] + across[0] * du, top[1] + 0.05, top[2] + across[2] * du];
            const shaft = unit(sub(tip, base));
            const head: V3 = [
              base[0] + shaft[0] * RACK.pole,
              base[1] + shaft[1] * RACK.pole,
              base[2] + shaft[2] * RACK.pole,
            ];
            s.tube(base, head, 0.011, 0.011, 4, P.iron);
            s.tube(
              head,
              [head[0] + shaft[0] * 0.16, head[1] + shaft[1] * 0.16, head[2] + shaft[2] * 0.16],
              0.02,
              0.018,
              4,
              DARK,
            );
          }
          continue;
        }
        // A pair of skis on their tails, bases together, leaning on the rail.
        const sheet = SHEETS[Math.floor(dealt(c, k + 101) * SHEETS.length)];
        const paint = new THREE.Color(sheet.body);
        const trim = new THREE.Color(sheet.trim);
        for (const du of [-0.055, 0.055]) {
          const base = at(ux(u + du), z + RACK.foot);
          base[1] -= 0.05;
          const lean = unit(
            sub([top[0] + across[0] * ux(du), top[1], top[2] + across[2] * ux(du)], base),
          );
          const tip: V3 = [
            base[0] + lean[0] * RACK.ski,
            base[1] + lean[1] * RACK.ski,
            base[2] + lean[2] * RACK.ski,
          ];
          board(s, base, tip, across, 0.085, 0.03, paint);
          // The tip in the trim, the binding dark at the middle.
          const tipStart: V3 = [
            base[0] + lean[0] * (RACK.ski - 0.28),
            base[1] + lean[1] * (RACK.ski - 0.28),
            base[2] + lean[2] * (RACK.ski - 0.28),
          ];
          board(s, tipStart, tip, across, 0.09, 0.034, trim);
          const b0: V3 = [
            base[0] + lean[0] * 0.62,
            base[1] + lean[1] * 0.62,
            base[2] + lean[2] * 0.62,
          ];
          const b1: V3 = [
            base[0] + lean[0] * 0.98,
            base[1] + lean[1] * 0.98,
            base[2] + lean[2] * 0.98,
          ];
          board(s, b0, b1, across, 0.07, 0.07, DARK);
        }
      }
    }
  }
  return s.geometry();
}
