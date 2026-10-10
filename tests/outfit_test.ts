// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S GEAR — the catalog (`outfit.ts`), the pick the game keeps
// (`Settings.outfit`), and the dress every outfit is cut into (`dress.ts`:
// the loom's garments skinned on the rig), held to what the figure and the
// card assume: every slot a handful of pieces each sold in its own colours,
// nothing stored but a real piece, every rival in his slot's colour; and
// every outfit cut into a skin whose weights are whole, whose bones are the
// rig's, whose colours are its pieces' own, whose jacket stays over the
// pants through a tuck, and whose triangles fit the budget the modelled
// skier had.

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { dressOutfit } from "../pwa/src/game/dress.ts";
import { bindPose, createLoom, linear, type DressPart } from "../pwa/src/game/dress-loft.ts";
import { cutClothes } from "../pwa/src/game/dress-garments.ts";
import {
  BODIES,
  coloursOf,
  DEFAULT_OUTFIT,
  GEAR,
  GEAR_SLOTS,
  gearOf,
  outfitOf,
  RIVAL_OUTFITS,
  stepGear,
  type Outfit,
} from "../pwa/src/game/outfit.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { SKIER_BODY } from "../pwa/src/game/skier-colours.ts";
import { skierPose } from "../pwa/src/game/skier-pose.ts";
import { SKIER_BONES, STANDING, skierBones, type BoneFrame } from "../pwa/src/game/skier-rig.ts";

/** Every outfit worth cutting: each piece of every slot over the default
 * kit, and every rival's. */
const OUTFITS: Outfit[] = [
  DEFAULT_OUTFIT,
  ...RIVAL_OUTFITS.map(({ tone: _tone, ...o }) => o),
  ...GEAR_SLOTS.flatMap((slot) =>
    (GEAR[slot] as readonly { id: string }[]).map((g) => ({ ...DEFAULT_OUTFIT, [slot]: g.id })),
  ),
];

describe("the gear", () => {
  it("is a handful of pieces a slot, each named once", () => {
    for (const slot of GEAR_SLOTS) {
      const list = GEAR[slot] as readonly { id: string; name: string }[];
      expect(list.length, slot).toBeGreaterThanOrEqual(2);
      expect(new Set(list.map((g) => g.id)).size).toBe(list.length);
      expect(new Set(list.map((g) => g.name)).size).toBe(list.length);
    }
    expect(BODIES.map((b) => b.female)).toEqual([false, true]);
  });

  it("dresses each rival in his slot's colour, so his dot is his jacket", () => {
    RIVAL_OUTFITS.forEach((o, i) => {
      expect(gearOf("jacket", o.jacket).main, `rival ${i + 1}`).toBe(SKIER_BODY[i + 1]);
    });
    expect(gearOf("jacket", DEFAULT_OUTFIT.jacket).main).toBe(0xc92a1c);
  });

  it("keeps the player's outfit, and nothing but real pieces", () => {
    expect(freshSettings().outfit).toEqual(DEFAULT_OUTFIT);
    const worn: Outfit = { ...DEFAULT_OUTFIT, body: "woman", jacket: "anorak", poles: "speed" };
    expect(mergeSettings(JSON.parse(JSON.stringify({ outfit: worn }))).outfit).toEqual(worn);
    expect(outfitOf({ body: "yeti", jacket: 3, pants: "cargo" })).toEqual({
      ...DEFAULT_OUTFIT,
      pants: "cargo",
    });
    expect(outfitOf(null)).toEqual(DEFAULT_OUTFIT);
  });

  it("steps a slot round its catalog, wrapping both ways", () => {
    const n = GEAR.jacket.length;
    let o = DEFAULT_OUTFIT;
    for (let i = 0; i < n; i++) o = stepGear(o, "jacket", 1);
    expect(o).toEqual(DEFAULT_OUTFIT);
    expect(stepGear(DEFAULT_OUTFIT, "jacket", -1).jacket).toBe(GEAR.jacket[n - 1].id);
  });

  it("hands a modelled skier the outfit's colours", () => {
    const c = coloursOf(RIVAL_OUTFITS[1], RIVAL_OUTFITS[1].tone);
    expect(c.jacket).toBe(gearOf("jacket", RIVAL_OUTFITS[1].jacket).main);
    expect(c.helmet).toBe(gearOf("helmet", RIVAL_OUTFITS[1].helmet).shell);
    expect(c.skin).toBe(RIVAL_OUTFITS[1].tone);
  });
});

/** Every colour a piece of the outfit is sold in, and the few the kit
 * shares (the liners and the knit, the rubber trim, the skin, the hair). */
function palette(o: Outfit): Set<string> {
  const out = new Set<number>([
    0x26282c,
    0x101114,
    gearOf("body", o.body).skin,
    gearOf("body", o.body).hair,
    gearOf("body", o.body).plait,
  ]);
  for (const slot of ["jacket", "pants", "gloves"] as const) {
    const g = gearOf(slot, o[slot]);
    for (const c of [g.main, g.second, g.third]) out.add(c);
  }
  const h = gearOf("helmet", o.helmet);
  for (const c of [h.shell, h.trim, h.lens]) out.add(c);
  return new Set(
    [...out].map((c) =>
      linear(c)
        .map((k) => k.toFixed(4))
        .join(","),
    ),
  );
}

function each(part: DressPart, f: (i: number) => void): void {
  for (let i = 0; i < part.position.length / 3; i++) f(i);
}

describe("the dress", () => {
  it("cuts every outfit into a whole skin on the rig's bones", () => {
    for (const o of OUTFITS) {
      const m = dressOutfit(o);
      for (const part of [m.cloth, m.hard]) {
        expect(part.index.length % 3).toBe(0);
        expect(Math.max(...part.index)).toBeLessThan(part.position.length / 3);
        each(part, (i) => {
          let sum = 0;
          for (let k = 0; k < 4; k++) {
            sum += part.skinWeight[i * 4 + k];
            expect(part.skinIndex[i * 4 + k]).toBeLessThan(SKIER_BONES.length);
          }
          expect(sum).toBeCloseTo(1, 4);
        });
        expect(part.position.every(Number.isFinite)).toBe(true);
        expect(part.normal.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("paints every face in its pieces' own colours, and no other", () => {
    for (const o of OUTFITS) {
      const allowed = palette(o);
      const m = dressOutfit(o);
      for (const part of [m.cloth, m.hard]) {
        each(part, (i) => {
          const c = part.color
            .slice(i * 3, i * 3 + 3)
            .map((k) => k.toFixed(4))
            .join(",");
          expect(allowed.has(c), `${JSON.stringify(o)}: ${c}`).toBe(true);
        });
      }
    }
  });

  it("fits the budget the modelled skier had — the body is never drawn under the kit", () => {
    for (const o of OUTFITS) {
      const m = dressOutfit(o);
      const tris = (m.cloth.index.length + m.hard.index.length) / 3;
      // The Blender skier's game cut was 9,920 triangles, 3,360 of them the
      // helmet's; the dressed skier spends no more.
      expect(tris, JSON.stringify(o)).toBeLessThan(11_000);
    }
  });

  it("dresses a woman to her measure: a narrower waist and shoulders", () => {
    const width = (o: Outfit, y0: number, y1: number) => {
      const m = dressOutfit(o).cloth;
      let w = 0;
      each(m, (i) => {
        const y = m.position[i * 3 + 1];
        const x = Math.abs(m.position[i * 3]);
        if (y > y0 && y < y1 && x < 0.22) w = Math.max(w, x);
      });
      return w;
    };
    const { pose } = bindPose();
    const waist = [pose.waist.y - 0.02, pose.waist.y + 0.04] as const;
    expect(width({ ...DEFAULT_OUTFIT, body: "woman" }, ...waist)).toBeLessThan(
      width(DEFAULT_OUTFIT, ...waist),
    );
  });

  it("keeps the jacket over the pants as the hips fold into a tuck", () => {
    // Every pant's vertex near the seat, posed into the full tuck the way
    // the GPU skins it, must lie inside the jacket's posed hull there:
    // measured as its distance from the spine's line against the jacket's
    // furthest vertex at the same height and bearing.
    const mat = (f: BoneFrame) =>
      new THREE.Matrix4()
        .makeBasis(
          new THREE.Vector3(f.x.x, f.x.y, f.x.z),
          new THREE.Vector3(f.y.x, f.y.y, f.y.z),
          new THREE.Vector3(f.z.x, f.z.y, f.z.z),
        )
        .setPosition(f.head.x, f.head.y, f.head.z);
    const bind = bindPose().frames;
    const tuck = skierBones(skierPose({ ...STANDING, crouch: 1 }));
    const M = SKIER_BONES.map((n) => mat(tuck[n]).multiply(mat(bind[n]).clone().invert()));
    const pelvisInv = mat(tuck.pelvis).invert();
    for (const pants of ["insulated", "baggy"] as const) {
      for (const jacket of ["race", "puffer", "shell"] as const) {
        const o = { ...DEFAULT_OUTFIT, pants, jacket };
        const loom = createLoom();
        cutClothes(loom, o);
        const part = loom.mesh().cloth;
        const pantsColour = linear(gearOf("pants", pants).main)
          .map((k) => k.toFixed(4))
          .join(",");
        // In the pelvis's posed frame: y up the back, bearing round it.
        const local: { y: number; a: number; r: number; pants: boolean }[] = [];
        each(part, (i) => {
          const v = new THREE.Vector3(...part.position.slice(i * 3, i * 3 + 3));
          const r = new THREE.Vector3();
          for (let k = 0; k < 4; k++) {
            const w = part.skinWeight[i * 4 + k];
            if (w) r.addScaledVector(v.clone().applyMatrix4(M[part.skinIndex[i * 4 + k]]), w);
          }
          r.applyMatrix4(pelvisInv);
          const c = part.color
            .slice(i * 3, i * 3 + 3)
            .map((k) => k.toFixed(4))
            .join(",");
          local.push({
            y: r.y,
            a: Math.atan2(r.x, r.z),
            r: Math.hypot(r.x, r.z),
            pants: c === pantsColour,
          });
        });
        const jacketHull = local.filter((p) => !p.pants);
        let out = 0;
        let seen = 0;
        let worst = 0;
        for (const p of local) {
          // The seat, behind and beside: between the jacket's hem and the
          // waist, and not the legs below it.
          if (!p.pants || p.y < 0.02 || p.y > 0.22 || Math.cos(p.a) > 0.3) continue;
          const near = jacketHull.filter(
            (q) =>
              Math.abs(q.y - p.y) < 0.03 &&
              Math.abs(Math.atan2(Math.sin(q.a - p.a), Math.cos(q.a - p.a))) < 0.3,
          );
          if (!near.length) continue;
          seen++;
          const over = p.r - Math.max(...near.map((q) => q.r));
          if (over > 0.004) {
            out++;
            worst = Math.max(worst, over);
          }
        }
        expect(seen, `${pants} under ${jacket}`).toBeGreaterThan(20);
        expect(
          out / seen,
          `${pants} pierce ${jacket} in the tuck by ${worst.toFixed(3)} m`,
        ).toBeLessThan(0.02);
      }
    }
  });
});
