// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FURNITURE, BUILT — every `Item` of `interior-plan.ts` as a handful of
// boxes on the facade kit (`facade-kit.ts`) in the painted stack's
// materials: the wood's grain, the stove's tiles, the cloth's weave, the
// shelves' goods, the steel. Each piece is built in its own frame — x
// across it (`w`), z from its back to its front (`d`, +z the way it faces),
// y up from its foot — the kit already set down on it. Sized off the
// measures furniture is made to: a table's top at 0.76 m, a seat at
// 0.45 m, a counter at 0.9–1.1 m, a shelf's boards 0.35–0.45 m apart.
//
// Three-free.

import { FACADE, type FacadeLayer } from "./facade-paint.ts";
import type { FacadeKit } from "./facade-kit.ts";
import type { Piece } from "./interior-plan.ts";

type Top = { layer: FacadeLayer; tint: number } | null;

/** A shade a share darker (k < 1) or lighter (k > 1). */
export function shade(c: number, k: number): number {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}

/** A small hash of a piece's seed and an index, 0..1. */
function dealt(seed: number, i: number): number {
  let h = Math.imul(Math.floor(seed * 4294967296) ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const STEEL = 0x8a9096;
const DARK = 0x2a2a2c;
const PACKS = [0xc0392b, 0x2e6da4, 0xf2c14e, 0x2f6a46, 0x1d1f24, 0xe07b39, 0x7a4b8c, 0xeeeeea];

/** Builds pieces onto a kit set down on each. */
class Bench {
  constructor(private readonly kit: FacadeKit) {}

  /** A box from (x0, y0, z0) to (x1, y1, z1) in `layer`, its top in `top`
   * (its own skin unless given; none when null). */
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    layer: FacadeLayer,
    tint: number,
    top: Top | undefined = undefined,
  ): void {
    this.kit.box(
      Math.min(x0, x1),
      y0,
      Math.min(z0, z1),
      Math.max(x0, x1),
      y1,
      Math.max(z0, z1),
      layer,
      tint,
      top === undefined ? { layer, tint } : top,
    );
  }

  /** Four legs under a top `w` × `d` at `h`, `t` square, `inset` in. */
  legs(
    w: number,
    d: number,
    h: number,
    t: number,
    tint: number,
    inset = 0.04,
    layer: FacadeLayer = FACADE.timber,
  ): void {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - inset - t / 2);
        const z = sz * (d / 2 - inset - t / 2);
        this.box(x - t / 2, 0, z - t / 2, x + t / 2, h, z + t / 2, layer, tint, null);
      }
  }

  /** A face toward +z (the piece's front) from x0..x1, y0..y1 at z. */
  front(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    layer: FacadeLayer,
    tint: number,
  ): void {
    this.kit.wall(x0, z, x1, z, y0, y1, layer, tint);
  }

  /** A face lit after dark (a lamp's shade), `glow` its mark. */
  lit(fn: () => void, glow = 1): void {
    const was = this.kit.glow;
    this.kit.glow = glow;
    fn();
    this.kit.glow = was;
  }
}

/** Build one piece onto `kit`, the kit already set down on its frame. */
export function buildPiece(kit: FacadeKit, p: Piece): void {
  const b = new Bench(kit);
  const { w, d, h, tint, alt } = p;
  const hw = w / 2;
  const hd = d / 2;
  const wood = FACADE.timber;
  switch (p.item) {
    case "table":
    case "desk": {
      const t = 0.045;
      b.box(-hw, h - t, -hd, hw, h, hd, wood, tint);
      b.legs(w, d, h - t, 0.06, shade(tint, 0.8));
      if (p.item === "desk")
        b.box(
          -hw + 0.05,
          h - 0.32,
          -hd + 0.05,
          -hw + 0.5,
          h - t,
          hd - 0.05,
          wood,
          shade(tint, 0.9),
        );
      return;
    }
    case "roundTable": {
      kit.column(0, 0, h - 0.04, h, hw, wood, tint, 10);
      kit.column(0, 0, 0, h - 0.04, 0.05, FACADE.steel, DARK, 6);
      return;
    }
    case "chair": {
      const s = 0.45;
      b.box(-hw, s - 0.04, -hd, hw, s, hd, wood, tint);
      b.legs(w, d, s - 0.04, 0.04, shade(tint, 0.85));
      // The back: two posts and a broad rail.
      b.box(-hw + 0.02, s, -hd, -hw + 0.06, h, -hd + 0.04, wood, tint);
      b.box(hw - 0.06, s, -hd, hw - 0.02, h, -hd + 0.04, wood, tint);
      b.box(-hw + 0.02, h - 0.22, -hd, hw - 0.02, h - 0.02, -hd + 0.035, wood, tint);
      return;
    }
    case "stool": {
      kit.column(
        0,
        0,
        h - 0.05,
        h,
        hw * 0.8,
        FACADE.fabric,
        tint === DARK ? 0x4a4a4c : shade(tint, 1.2),
        8,
      );
      kit.column(0, 0, 0, h - 0.05, 0.03, FACADE.steel, STEEL, 5);
      kit.column(0, 0, 0, 0.03, hw * 0.7, FACADE.steel, STEEL, 8);
      return;
    }
    case "bench": {
      b.box(-hw, h - 0.05, -hd, hw, h, hd, wood, tint);
      for (const sx of [-1, 1])
        b.box(
          sx * (hw - 0.12) - 0.03,
          0,
          -hd + 0.04,
          sx * (hw - 0.12) + 0.03,
          h - 0.05,
          hd - 0.04,
          wood,
          shade(tint, 0.85),
        );
      return;
    }
    case "wallBench": {
      // A seat on a boxed front, its back panelled against the wall.
      const s = 0.46;
      b.box(-hw, 0, -hd + 0.08, hw, s - 0.05, hd - 0.04, FACADE.panelling, shade(tint, 1.05), null);
      b.box(-hw, s - 0.05, -hd, hw, s, hd, wood, tint);
      b.box(-hw, s, -hd, hw, h, -hd + 0.08, FACADE.panelling, tint);
      // A cushion strip in its cloth.
      b.box(-hw + 0.05, s, -hd + 0.1, hw - 0.05, s + 0.05, hd - 0.04, FACADE.fabric, alt);
      return;
    }
    case "stove": {
      // A tiled stove: a plinth, the tiled body, a cornice, a crown.
      b.box(-hw, 0, -hd, hw, 0.18, hd, FACADE.plain, shade(tint, 0.7));
      b.box(-hw + 0.03, 0.18, -hd + 0.03, hw - 0.03, h - 0.3, hd - 0.03, FACADE.tile, alt, null);
      b.box(-hw - 0.03, h - 0.3, -hd - 0.03, hw + 0.03, h - 0.22, hd + 0.03, FACADE.plain, tint);
      b.box(-hw + 0.08, h - 0.22, -hd + 0.08, hw - 0.08, h, hd - 0.08, FACADE.tile, alt);
      // The fire door, cast iron.
      b.front(-0.18, 0.35, 0.18, 0.7, hd - 0.02, FACADE.plain, DARK);
      return;
    }
    case "ironStove": {
      b.box(-hw, 0.12, -hd, hw, h, hd, FACADE.steel, tint);
      b.legs(w, d, 0.12, 0.05, tint, 0.02, FACADE.steel);
      b.lit(() => b.front(-hw * 0.6, 0.3, hw * 0.6, 0.6, hd + 0.005, FACADE.plain, 0xe0702a));
      kit.column(0, -hd + 0.15, h, 2.6, 0.07, FACADE.steel, tint, 6);
      return;
    }
    case "fireplace": {
      // A stone breast to the ceiling, its hearth and fire.
      b.box(-hw, 0, -hd, hw, h, hd, FACADE.stone, tint, null);
      b.box(-hw - 0.08, 1.15, -hd, hw + 0.08, 1.25, hd + 0.08, wood, 0x6a4a32);
      b.box(-hw - 0.2, 0, hd - 0.02, hw + 0.2, 0.12, hd + 0.4, FACADE.stone, shade(tint, 0.8));
      b.front(-0.5, 0.12, 0.5, 0.95, hd + 0.01, FACADE.plain, 0x141210);
      b.lit(() => b.front(-0.32, 0.14, 0.32, 0.42, hd + 0.02, FACADE.woodpile, 0xff8a3a));
      return;
    }
    case "counter":
    case "bar": {
      b.box(
        -hw,
        0,
        -hd + 0.05,
        hw,
        h - 0.05,
        hd - 0.04,
        p.item === "bar" ? FACADE.panelling : FACADE.boards,
        tint,
        null,
      );
      b.box(
        -hw - 0.03,
        h - 0.05,
        -hd,
        hw + 0.03,
        h,
        hd + 0.04,
        wood,
        alt === 0xffffff ? shade(tint, 1.2) : alt,
      );
      if (p.item === "bar") {
        // The taps on the top, the back bar of bottles on the wall behind.
        for (let i = 0; i < 3; i++)
          kit.column(-0.4 + i * 0.4, -hd + 0.2, h, h + 0.35, 0.03, FACADE.steel, 0xd8d8d4, 5);
        b.box(-hw + 0.2, 1.3, -hd - 0.35, hw - 0.2, 1.33, -hd - 0.05, wood, tint);
        b.front(-hw + 0.2, 1.33, hw - 0.2, 1.73, -hd - 0.3, FACADE.goods, 0xffffff);
        b.box(-hw + 0.2, 1.8, -hd - 0.35, hw - 0.2, 1.83, -hd - 0.05, wood, tint);
        b.front(-hw + 0.2, 1.83, hw - 0.2, 2.23, -hd - 0.3, FACADE.goods, 0xffffff);
      }
      return;
    }
    case "servery": {
      // The counter, the tray rail before it, a glazed hood over the hot
      // food, the stainless top.
      const top = 0.9;
      b.box(-hw, 0, -hd, hw, top - 0.04, -hd + 0.75, FACADE.panelling, tint, null);
      b.box(-hw, top - 0.04, -hd, hw, top, -hd + 0.8, FACADE.steel, alt);
      b.box(-hw, top - 0.1, -hd + 0.85, hw, top - 0.06, hd, FACADE.steel, STEEL);
      for (let x = -hw + 0.2; x <= hw - 0.1; x += 1.6)
        b.box(x - 0.02, 0, hd - 0.1, x + 0.02, top - 0.1, hd - 0.06, FACADE.steel, STEEL, null);
      b.box(-hw + 0.1, 1.28, -hd + 0.05, hw - 0.1, 1.3, -hd + 0.45, FACADE.plain, 0xb8d0dc);
      for (let x = -hw + 0.1; x <= hw; x += 1.4)
        b.box(x, top, -hd + 0.42, x + 0.03, 1.28, -hd + 0.45, FACADE.steel, STEEL, null);
      for (let i = 0; i < Math.floor(w / 0.5); i++)
        b.box(
          -hw + 0.1 + i * 0.5,
          top,
          -hd + 0.15,
          -hw + 0.45 + i * 0.5,
          top + 0.06,
          -hd + 0.4,
          FACADE.plain,
          PACKS[i % PACKS.length],
        );
      return;
    }
    case "trays": {
      b.box(-hw, 0, -hd, hw, 0.8, hd, FACADE.steel, tint);
      b.box(-hw + 0.05, 0.8, -hd + 0.05, hw - 0.05, h, hd - 0.05, FACADE.plain, alt);
      return;
    }
    case "shelf":
    case "goodsShelf":
    case "bootWall": {
      // Uprights, boards, and on every board its goods (or boots).
      const n = Math.max(2, Math.round(h / 0.42));
      const twoSided = p.alt === 1;
      for (const sx of [-1, 1]) b.box(sx * hw - 0.02, 0, -hd, sx * hw + 0.02, h, hd, wood, tint);
      if (!twoSided) b.front(-hw, 0, hw, h, -hd + 0.01, FACADE.plain, shade(tint, 0.6));
      for (let i = 0; i < n; i++) {
        const y = 0.08 + (i * (h - 0.1)) / n;
        b.box(-hw, y, -hd, hw, y + 0.025, hd, wood, tint);
        const gap = (h - 0.1) / n;
        if (p.item === "bootWall") {
          for (let k = 0; k < Math.floor(w / 0.32); k++) {
            const x = -hw + 0.08 + k * 0.32;
            const c = PACKS[Math.floor(dealt(p.seed, i * 17 + k) * PACKS.length)];
            b.box(
              x,
              y + 0.025,
              -hd * 0.6,
              x + 0.11,
              y + 0.025 + gap * 0.6,
              hd * 0.8,
              FACADE.plain,
              c,
            );
            b.box(
              x + 0.12,
              y + 0.025,
              -hd * 0.6,
              x + 0.23,
              y + 0.025 + gap * 0.6,
              hd * 0.8,
              FACADE.plain,
              c,
            );
          }
        } else if (p.item === "goodsShelf") {
          b.front(
            -hw + 0.02,
            y + 0.025,
            hw - 0.02,
            y + gap,
            hd * (twoSided ? 0.9 : 0.5),
            FACADE.goods,
            0xffffff,
          );
          if (twoSided)
            kit.wall(
              hw - 0.02,
              -hd * 0.9,
              -hw + 0.02,
              -hd * 0.9,
              y + 0.025,
              y + gap,
              FACADE.goods,
              0xffffff,
            );
        } else {
          // Books and boxes in their colours.
          for (let k = 0; k < Math.floor(w / 0.16); k++) {
            const x = -hw + 0.04 + k * 0.16;
            if (dealt(p.seed, i * 31 + k) < 0.25) continue;
            const c = shade(PACKS[Math.floor(dealt(p.seed, i * 31 + k + 7) * PACKS.length)], 0.75);
            b.box(
              x,
              y + 0.025,
              -hd + 0.04,
              x + 0.13,
              y + 0.025 + gap * (0.55 + dealt(p.seed, k) * 0.3),
              hd - 0.04,
              FACADE.plain,
              c,
            );
          }
        }
      }
      b.box(-hw, h - 0.025, -hd, hw, h, hd, wood, tint);
      return;
    }
    case "clothesRack": {
      for (const sx of [-1, 1])
        b.box(sx * hw - 0.02, 0, -0.02, sx * hw + 0.02, h, 0.02, FACADE.steel, tint, null);
      b.box(-hw, h - 0.04, -0.02, hw, h, 0.02, FACADE.steel, tint);
      const n = Math.floor(w / 0.11);
      for (let i = 0; i < n; i++) {
        const x = -hw + 0.08 + i * 0.11;
        const c = PACKS[Math.floor(dealt(p.seed, i) * 7)];
        b.box(x - 0.025, h - 0.85, -hd * 0.8, x + 0.025, h - 0.06, hd * 0.8, FACADE.fabric, c);
      }
      return;
    }
    case "skiRack": {
      // A rail at hip height, skis stood up in pairs against it.
      b.box(-hw, 0, -hd, hw, 0.08, hd, FACADE.steel, tint);
      b.box(-hw, 1.0, -hd, hw, 1.06, -hd + 0.06, FACADE.steel, tint);
      const n = Math.floor(w / 0.16);
      for (let i = 0; i < n; i++) {
        const x = -hw + 0.08 + i * 0.16;
        const c = dealt(p.seed, i) < 0.5 ? alt : PACKS[Math.floor(dealt(p.seed, i + 40) * 7)];
        const top = h - dealt(p.seed, i + 80) * 0.35;
        for (const o of [0, 0.075])
          b.box(x + o, 0.08, -hd + 0.07, x + o + 0.06, top, -hd + 0.1, FACADE.plain, c);
      }
      return;
    }
    case "sofa":
    case "armchair": {
      b.box(-hw, 0.08, -hd, hw, 0.42, hd, FACADE.fabric, tint);
      b.box(
        -hw + 0.15,
        0.42,
        -hd + 0.25,
        hw - 0.15,
        0.5,
        hd - 0.02,
        FACADE.fabric,
        shade(tint, 1.1),
      );
      b.box(-hw, 0.42, -hd, hw, h, -hd + 0.25, FACADE.fabric, tint);
      for (const sx of [-1, 1])
        b.box(
          sx * hw - (sx > 0 ? 0.15 : 0),
          0.42,
          -hd,
          sx * hw + (sx < 0 ? 0.15 : 0),
          0.65,
          hd,
          FACADE.fabric,
          tint,
        );
      b.legs(w, d, 0.08, 0.05, DARK, 0.06);
      return;
    }
    case "bed":
    case "bunk": {
      const decks = p.item === "bunk" ? [0.25, 1.25] : [0.25];
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          b.box(
            sx * hw - (sx > 0 ? 0.07 : 0),
            0,
            sz * hd - (sz > 0 ? 0.07 : 0),
            sx * hw + (sx < 0 ? 0.07 : 0),
            h,
            sz * hd + (sz < 0 ? 0.07 : 0),
            wood,
            tint,
          );
      for (const y of decks) {
        b.box(-hw, y, -hd, hw, y + 0.12, hd, wood, tint, null);
        b.box(
          -hw + 0.07,
          y + 0.12,
          -hd + 0.07,
          hw - 0.07,
          y + 0.26,
          hd - 0.07,
          FACADE.fabric,
          0xeeeae2,
        );
        b.box(-hw + 0.5, y + 0.26, -hd + 0.07, hw - 0.07, y + 0.32, hd - 0.07, FACADE.fabric, alt);
        b.box(
          -hw + 0.1,
          y + 0.26,
          -hd + 0.15,
          -hw + 0.45,
          y + 0.36,
          hd - 0.15,
          FACADE.fabric,
          0xf4f2ee,
        );
      }
      return;
    }
    case "cabinet":
    case "lockers":
    case "switchboard": {
      const layer = p.item === "cabinet" ? FACADE.plain : FACADE.steel;
      b.box(-hw, 0, -hd, hw, h, hd, layer, tint);
      const doors =
        p.item === "lockers" ? Math.max(1, Math.round(w / 0.4)) : Math.max(1, Math.round(w / 0.5));
      for (let i = 0; i < doors; i++) {
        const x = -hw + (w * (i + 0.5)) / doors;
        b.box(
          x - 0.006 + w / doors / 2 - 0.006,
          0.05,
          hd,
          x + w / doors / 2,
          h - 0.05,
          hd + 0.005,
          FACADE.plain,
          shade(tint, 0.6),
          null,
        );
        b.box(
          x + w / doors / 2 - 0.08,
          h * 0.5,
          hd,
          x + w / doors / 2 - 0.05,
          h * 0.5 + 0.12,
          hd + 0.02,
          FACADE.steel,
          0xd8d8d4,
          null,
        );
        if (p.item === "lockers")
          for (const y of [h * 0.75, h * 0.25])
            b.box(
              x - 0.08,
              y,
              hd,
              x + 0.08,
              y + 0.02,
              hd + 0.004,
              FACADE.plain,
              shade(tint, 0.5),
              null,
            );
        if (p.item === "switchboard")
          b.lit(() =>
            b.box(
              x - 0.1,
              h * 0.7,
              hd,
              x - 0.06,
              h * 0.7 + 0.04,
              hd + 0.01,
              FACADE.plain,
              i % 2 ? 0x40e060 : 0xe04030,
              null,
            ),
          );
      }
      return;
    }
    case "rug": {
      b.box(-hw, 0, -hd, hw, h, hd, FACADE.fabric, tint);
      b.box(
        -hw + 0.15,
        h,
        -hd + 0.15,
        hw - 0.15,
        h + 0.002,
        hd - 0.15,
        FACADE.fabric,
        shade(tint, 1.25),
        null,
      );
      return;
    }
    case "plant": {
      kit.frustum(
        [
          [-0.2, -0.2],
          [0.2, -0.2],
          [0.2, 0.2],
          [-0.2, 0.2],
        ],
        [
          [-0.25, -0.25],
          [0.25, -0.25],
          [0.25, 0.25],
          [-0.25, 0.25],
        ],
        0,
        0.45,
        FACADE.plain,
        tint,
        { layer: FACADE.plain, tint: 0x3a2a1e },
      );
      for (let i = 0; i < 3; i++) {
        const r = hw * (1 - i * 0.25);
        const y = 0.45 + (i * (h - 0.45)) / 3;
        const ring = [0, 1, 2, 3, 4, 5].map((k): [number, number] => [
          Math.cos((k / 6) * Math.PI * 2 + i) * r,
          Math.sin((k / 6) * Math.PI * 2 + i) * r,
        ]);
        const head = ring.map(([x, z]): [number, number] => [x * 0.2, z * 0.2]);
        kit.frustum(
          ring,
          head,
          y,
          y + (h - 0.45) / 2.2,
          FACADE.plain,
          shade(alt, 1 - i * 0.08),
          null,
        );
      }
      return;
    }
    case "pendant": {
      // A cord from the ceiling, the shade lit.
      b.box(-0.008, 0.25, -0.008, 0.008, h, 0.008, FACADE.plain, DARK, null);
      b.lit(() =>
        kit.frustum(
          [
            [-hw, -hd],
            [hw, -hd],
            [hw, hd],
            [-hw, hd],
          ].map(([x, z]): [number, number] => [x * 0.5, z * 0.5]),
          [
            [-hw, -hd],
            [hw, -hd],
            [hw, hd],
            [-hw, hd],
          ].map(([x, z]): [number, number] => [x * 0.2, z * 0.2]),
          0,
          0.25,
          FACADE.plain,
          tint,
          { layer: FACADE.plain, tint },
        ),
      );
      return;
    }
    case "kitchen": {
      b.box(-hw, 0.1, -hd, hw, h - 0.04, hd - 0.02, FACADE.plain, tint, null);
      b.box(-hw, 0, -hd, hw, 0.1, hd - 0.06, FACADE.plain, DARK, null);
      b.box(-hw, h - 0.04, -hd, hw, h, hd, wood, 0x8a6a4a);
      const n = Math.max(1, Math.round(w / 0.6));
      for (let i = 1; i < n; i++)
        b.box(
          -hw + (w * i) / n - 0.004,
          0.12,
          hd - 0.02,
          -hw + (w * i) / n + 0.004,
          h - 0.08,
          hd - 0.01,
          FACADE.plain,
          shade(tint, 0.6),
          null,
        );
      b.box(-0.6, h, -hd + 0.1, 0.0, h + 0.005, hd - 0.1, FACADE.steel, 0xd8d8d4, null);
      b.box(0.2, h, -hd + 0.1, 0.8, h + 0.01, hd - 0.1, FACADE.plain, DARK, null);
      // The tiles up the wall and the cupboards over it.
      b.front(-hw, h, hw, h + 0.6, -hd + 0.01, FACADE.tile, 0xeeeeea);
      b.box(-hw, h + 0.6, -hd, hw, h + 1.3, -hd + 0.35, FACADE.plain, tint);
      return;
    }
    case "fridge": {
      b.box(-hw, 0, -hd, hw, h, hd, FACADE.plain, tint);
      b.lit(
        () => b.front(-hw + 0.05, 0.1, hw - 0.05, h - 0.1, hd + 0.003, FACADE.goods, 0xffffff),
        tint === 0xeeeeea ? 0 : 1,
      );
      return;
    }
    case "screen": {
      b.box(-0.04, 0, -0.04, 0.04, 0.1, 0.04, FACADE.plain, DARK);
      b.box(-hw, 0.1, -0.03, hw, h, 0.0, FACADE.plain, tint);
      b.lit(() => b.front(-hw + 0.02, 0.12, hw - 0.02, h - 0.02, 0.002, FACADE.plain, 0x6a9ac8));
      return;
    }
    case "couch": {
      b.box(-hw, 0.6, -hd, hw, 0.72, hd, FACADE.fabric, alt);
      b.box(-hw + 0.05, 0.55, -hd + 0.05, hw - 0.05, 0.6, hd - 0.05, FACADE.steel, tint, null);
      b.legs(w, d, 0.55, 0.04, tint, 0.08, FACADE.steel);
      b.box(-hw + 0.08, 0.72, -hd + 0.08, hw - 0.08, 0.8, -hd + 0.45, FACADE.fabric, 0xf4f2ee);
      return;
    }
    case "akja": {
      // The rescue sled: a red hull, its handles.
      kit.frustum(
        [
          [-hw * 0.7, -hd],
          [hw * 0.7, -hd],
          [hw * 0.7, hd * 0.85],
          [-hw * 0.7, hd * 0.85],
        ],
        [
          [-hw, -hd],
          [hw, -hd],
          [hw, hd],
          [-hw, hd],
        ],
        0,
        h * 0.7,
        FACADE.plain,
        tint,
        null,
      );
      b.box(
        -hw + 0.06,
        h * 0.3,
        -hd + 0.06,
        hw - 0.06,
        h * 0.32,
        hd - 0.06,
        FACADE.fabric,
        0x2a2e33,
        null,
      );
      for (const sz of [-1, 1])
        b.box(-hw * 0.6, h * 0.7, sz * hd - 0.04, hw * 0.6, h, sz * hd + 0.04, FACADE.steel, STEEL);
      return;
    }
    case "workbench": {
      b.box(-hw, h - 0.06, -hd, hw, h, hd, wood, 0xb08a62);
      b.legs(w, d, h - 0.06, 0.06, tint, 0.03, FACADE.steel);
      b.box(-hw + 0.05, 0.15, -hd + 0.05, hw - 0.05, 0.18, hd - 0.05, FACADE.steel, tint, null);
      b.box(hw - 0.4, h, -hd + 0.1, hw - 0.1, h + 0.18, -hd + 0.3, FACADE.steel, 0x2e6da4);
      return;
    }
    case "toolboard": {
      b.box(-hw, 0, -hd, hw, h, hd, FACADE.plain, tint);
      for (let i = 0; i < 9; i++) {
        const x = -hw + 0.15 + (i * (w - 0.3)) / 8;
        const len = 0.18 + dealt(p.seed, i) * 0.25;
        const y = 0.2 + dealt(p.seed, i + 9) * (h - len - 0.3);
        b.box(
          x - 0.02,
          y,
          hd,
          x + 0.02,
          y + len,
          hd + 0.03,
          FACADE.steel,
          i % 3 ? 0xc0392b : DARK,
          null,
        );
      }
      return;
    }
    case "drum": {
      kit.column(0, 0, 0, h, hw, FACADE.steel, tint, 10);
      return;
    }
    case "tyres": {
      for (let i = 0; i < 4; i++) {
        kit.column(0, 0, i * 0.26, i * 0.26 + 0.24, hw, FACADE.plain, tint, 10);
      }
      return;
    }
    case "pump": {
      // A pump and its motor on a plinth, the pipes up from it.
      b.box(-hw, 0, -hd, hw, 0.2, hd, FACADE.concrete, 0xd8d8d4);
      b.box(-hw * 0.7, 0.2, -hd * 0.8, hw * 0.7, 0.85, 0.1, FACADE.steel, tint);
      b.box(-hw * 0.55, 0.25, 0.1, hw * 0.55, 0.8, hd * 0.85, FACADE.steel, alt);
      kit.column(0, -hd * 0.6, 0.85, 4.0, 0.12, FACADE.steel, STEEL, 8);
      return;
    }
    case "tank": {
      b.box(-hw + 0.1, 0, -hd, -hw + 0.3, 0.4, hd, FACADE.steel, DARK, null);
      b.box(hw - 0.3, 0, -hd, hw - 0.1, 0.4, hd, FACADE.steel, DARK, null);
      b.box(-hw, 0.4, -hd, hw, h, hd, FACADE.steel, tint);
      return;
    }
    case "pew": {
      const s = 0.45;
      b.box(-hw, s - 0.05, -hd + 0.1, hw, s, hd, wood, tint);
      b.box(-hw, s, -hd + 0.1, hw, h, -hd + 0.15, wood, tint);
      for (const sx of [-1, 1])
        b.box(sx * hw - 0.03, 0, -hd, sx * hw + 0.03, h, hd, wood, shade(tint, 0.85));
      // The kneeler and the book rest on the pew in front's back.
      b.box(-hw, 0.12, -hd, hw, 0.18, -hd + 0.1, wood, shade(tint, 0.9), null);
      return;
    }
    case "altar": {
      b.box(-hw - 0.6, 0, -hd - 0.4, hw + 0.6, 0.18, hd + 0.8, FACADE.stone, 0xd8d0c4);
      b.box(-hw, 0.18, -hd, hw, h, hd, FACADE.stone, tint);
      b.box(-hw - 0.05, h, -hd - 0.05, hw + 0.05, h + 0.02, hd + 0.05, FACADE.fabric, 0xf8f6f0);
      b.front(-hw - 0.05, h - 0.4, hw + 0.05, h, hd + 0.06, FACADE.fabric, alt);
      return;
    }
    case "lectern": {
      b.box(-0.15, 0, -0.15, 0.15, h - 0.15, 0.15, wood, tint);
      b.box(-hw, h - 0.15, -hd, hw, h, hd, wood, tint);
      return;
    }
    case "candles": {
      kit.column(0, 0, 0, h - 0.3, 0.06, FACADE.steel, tint, 6);
      kit.column(0, 0, h - 0.3, h - 0.28, hw, FACADE.steel, tint, 8);
      b.lit(() => kit.column(0, 0, h - 0.28, h, 0.03, FACADE.plain, 0xf8f0e0, 6));
      return;
    }
    case "cross": {
      b.box(-0.06, 0, -hd, 0.06, h, hd, wood, tint);
      b.box(-hw, h * 0.62, -hd, hw, h * 0.72, hd, wood, tint);
      return;
    }
    case "picture": {
      b.box(-hw, 0, -hd, hw, h, hd, wood, tint);
      b.front(-hw + 0.05, 0.05, hw - 0.05, h * 0.55, hd + 0.003, FACADE.plain, alt);
      b.front(
        -hw + 0.05,
        h * 0.55,
        hw - 0.05,
        h - 0.05,
        hd + 0.003,
        FACADE.plain,
        shade(0x8ab0d0, 0.9 + dealt(p.seed, 1) * 0.2),
      );
      // A peak against the sky.
      kit.tri(
        [-hw * 0.6, h * 0.5, hd + 0.005],
        [hw * 0.5, h * 0.5, hd + 0.005],
        [0, h * 0.85, hd + 0.005],
        [0, 0],
        [1, 0],
        [0.5, 1],
        FACADE.plain,
        0xf4f6f8,
      );
      return;
    }
    case "hooks": {
      b.box(-hw, h - 0.08, -hd, hw, h, hd, wood, 0x8a603e);
      const n = Math.floor(w / 0.32);
      for (let i = 0; i < n; i++) {
        const x = -hw + 0.16 + i * 0.32;
        if (dealt(p.seed, i) < 0.3) continue;
        const c = i % 2 ? alt : PACKS[Math.floor(dealt(p.seed, i + 5) * 7)];
        b.box(x - 0.15, -0.55, hd, x + 0.15, h - 0.1, hd + 0.18, FACADE.fabric, c);
      }
      return;
    }
    case "bootDryer": {
      b.box(-hw, 0, -hd, hw, 0.3, hd, FACADE.steel, tint);
      const n = Math.floor(w / 0.2);
      for (let i = 0; i < n; i++) {
        const x = -hw + 0.1 + i * 0.2;
        kit.column(x, 0, 0.3, 0.75, 0.015, FACADE.steel, STEEL, 4);
        if (dealt(p.seed, i) < 0.6)
          b.box(
            x - 0.06,
            0.62,
            -0.13,
            x + 0.06,
            0.95,
            0.13,
            FACADE.plain,
            PACKS[Math.floor(dealt(p.seed, i + 30) * 7)],
          );
      }
      return;
    }
    case "mailboxes": {
      b.box(-hw, 0, -hd, hw, h, hd, FACADE.steel, tint);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
          const x = -hw + (w * (i + 0.5)) / 4;
          const y = (h * (j + 0.5)) / 3;
          b.box(
            x - 0.13,
            y - 0.1,
            hd,
            x + 0.13,
            y + 0.1,
            hd + 0.01,
            FACADE.plain,
            shade(tint, 1.3),
            null,
          );
          b.box(
            x - 0.08,
            y + 0.04,
            hd + 0.01,
            x + 0.08,
            y + 0.06,
            hd + 0.015,
            FACADE.plain,
            DARK,
            null,
          );
        }
      return;
    }
    case "stairs": {
      // A straight flight up along x from its left end, its stringer.
      const n = Math.round(h / 0.18);
      const run = w / n;
      for (let i = 0; i < n; i++)
        b.box(
          -hw + i * run,
          0,
          -hd,
          -hw + (i + 1) * run,
          (i + 1) * (h / n),
          hd,
          FACADE.timber,
          tint,
          { layer: FACADE.timber, tint: shade(tint, 1.1) },
        );
      b.box(-hw, 0.9, hd - 0.04, hw, 0.95, hd, FACADE.steel, DARK, null);
      return;
    }
    case "board": {
      b.box(-hw, 0, -hd, hw, h, hd, FACADE.plain, tint);
      for (let i = 0; i < 5; i++)
        b.box(
          -hw + 0.1,
          h - 0.15 - (i * (h - 0.2)) / 5,
          hd,
          -hw + 0.1 + (w - 0.3) * (0.4 + dealt(p.seed, i) * 0.5),
          h - 0.12 - (i * (h - 0.2)) / 5,
          hd + 0.003,
          FACADE.plain,
          i === 0 ? 0xf2c14e : 0xeeeeea,
          null,
        );
      return;
    }
    default:
      return;
  }
}
