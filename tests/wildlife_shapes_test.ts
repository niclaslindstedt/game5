// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WILDLIFE AND THE MARKS, BUILT (`pwa/src/game/bird-shapes.ts`,
// `beast-shapes.ts`, `mark-shapes.ts`, on the trees' bench `tree-mesh.ts`)
// and WHO EACH ANIMAL IS (`wild-traits.ts`): every species in every form at
// both cuts, each cut lighter than the one before and within its triangle
// budget; every hinge the shader moves marked on the vertices it moves (a
// wing's flag and its hand past the wrist, each leg's phase and hip, the
// head, a rack's root and the age each tine comes at); every species drawn
// at every picture setting, only its forms thinning; and every individual a
// pure function of its group's scatter — the same animal every time, never
// a draw from the engine's stream.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { BEASTS } from "../pwa/src/game/beast-defs.ts";
import { BEAST_STYLES, LEG_PHASE, buildBeast } from "../pwa/src/game/beast-shapes.ts";
import { BIRDS } from "../pwa/src/game/bird-defs.ts";
import { BIRD_STYLES, birdPaint, buildBird } from "../pwa/src/game/bird-shapes.ts";
import {
  archBlower,
  archSkirt,
  archTube,
  edgeBand,
  edgeStake,
  gateMarker,
  gatePanel,
  gatePole,
} from "../pwa/src/game/mark-shapes.ts";
import { FOREST_LOOK } from "../pwa/src/game/settings-video.ts";
import { ARCH, type ArchPlan } from "../pwa/src/game/start-arch.ts";
import {
  BEAST_FORMS,
  BIRD_FORMS,
  TINE_AT,
  beastIndividual,
  birdIndividual,
  drawnForm,
  freshIndividual,
  rackOf,
} from "../pwa/src/game/wild-traits.ts";

const tris = (g: THREE.BufferGeometry): number => g.getAttribute("position").count / 3;
const values = (g: THREE.BufferGeometry, name: string, k = 0): number[] => {
  const a = g.getAttribute(name);
  return Array.from({ length: a.count }, (_, i) => a.getComponent(i, k));
};

/** The budgets, triangles: a near cut and a far one. The modelled roster
 * these replace ran 466–510 a bird and 582–692 an animal. */
const BIRD_BUDGET = { near: 200, far: 70 };
const BEAST_BUDGET = { near: 400, far: 160 };

describe("a bird, built", () => {
  it("is every species in every form, its far cut lighter than its near, in budget", () => {
    for (const spec of BIRDS) {
      for (const form of BIRD_FORMS[spec.id]) {
        const near = tris(buildBird(spec, BIRD_STYLES[spec.id], form, "near"));
        const far = tris(buildBird(spec, BIRD_STYLES[spec.id], form, "far"));
        expect(near, `${spec.id} ${form}`).toBeLessThanOrEqual(BIRD_BUDGET.near);
        expect(far, `${spec.id} ${form}`).toBeLessThanOrEqual(BIRD_BUDGET.far);
        expect(far, `${spec.id} ${form}`).toBeLessThan(near * 0.6);
        expect(far, `${spec.id} ${form}`).toBeGreaterThan(20);
      }
    }
  });

  it("marks its wings for the flap, with a hand past the wrist to fold, at both cuts", () => {
    for (const spec of BIRDS) {
      for (const lod of ["near", "far"] as const) {
        const g = buildBird(spec, BIRD_STYLES[spec.id], BIRD_FORMS[spec.id][0], lod);
        const wing = values(g, "aWing");
        const x = values(g, "position");
        const wrist = (spec.span / 2) * spec.wing.wrist;
        expect(
          wing.some((w) => w === 0),
          spec.id,
        ).toBe(true);
        expect(
          wing.some((w) => w === 1),
          spec.id,
        ).toBe(true);
        // The hand on both sides, and a column of vertices at the wrist.
        const wingX = x.filter((_, i) => wing[i] === 1);
        expect(Math.max(...wingX), spec.id).toBeGreaterThan(wrist * 1.2);
        expect(Math.min(...wingX), spec.id).toBeLessThan(-wrist * 1.2);
        expect(
          wingX.some((v) => Math.abs(Math.abs(v) - wrist) < 1e-6),
          spec.id,
        ).toBe(true);
        // Nothing of the body is marked a wing.
        g.computeBoundingBox();
        expect(g.boundingBox!.max.x, spec.id).toBeCloseTo(spec.span / 2, 1);
        expect(g.boundingBox!.max.z, spec.id).toBeGreaterThan(spec.neck * spec.length * 0.7);
      }
    }
  });

  it("paints every hen and first-winter bird its own way, and keeps no form it cannot paint", () => {
    for (const spec of BIRDS) {
      const style = BIRD_STYLES[spec.id];
      for (const form of BIRD_FORMS[spec.id]) {
        if (form === "female") expect(style.female, spec.id).toBeDefined();
        if (form === "young") expect(style.young, spec.id).toBeDefined();
      }
      if (style.female) {
        expect(BIRD_FORMS[spec.id], spec.id).toContain("female");
        expect(birdPaint(style, "female"), spec.id).not.toEqual(birdPaint(style, "male"));
      }
    }
    // The capercaillie hen is brown, the cock slate.
    expect(birdPaint(BIRD_STYLES.capercaillie, "female").back).not.toBe(
      BIRD_STYLES.capercaillie.back,
    );
  });
});

describe("an animal, built", () => {
  it("is every species in every form, its far cut lighter than its near, in budget", () => {
    for (const spec of BEASTS) {
      for (const form of BEAST_FORMS[spec.id]) {
        const near = tris(buildBeast(spec, BEAST_STYLES[spec.id], form, "near").geometry);
        const far = tris(buildBeast(spec, BEAST_STYLES[spec.id], form, "far").geometry);
        expect(near, `${spec.id} ${form}`).toBeLessThanOrEqual(BEAST_BUDGET.near);
        expect(far, `${spec.id} ${form}`).toBeLessThanOrEqual(BEAST_BUDGET.far);
        expect(far, `${spec.id} ${form}`).toBeLessThan(near * 0.6);
      }
    }
  });

  it("marks each leg with its phase and hip, the head, and stands on the snow", () => {
    for (const spec of BEASTS) {
      for (const lod of ["near", "far"] as const) {
        const { geometry: g, pivot } = buildBeast(spec, BEAST_STYLES[spec.id], "adult", lod);
        const leg = values(g, "aPart", 0);
        const hip = values(g, "aPart", 1);
        const head = values(g, "aPart", 2);
        for (const p of LEG_PHASE[spec.gait]) {
          expect(
            leg.some((v) => Math.abs(v - (1 + p)) < 1e-6),
            `${spec.id} ${lod} leg ${p}`,
          ).toBe(true);
        }
        leg.forEach((v, i) => {
          if (v > 0.5) expect(hip[i], spec.id).toBeGreaterThan(spec.height * 0.3);
          if (v > 0.5) expect(head[i], spec.id).toBe(0);
        });
        expect(
          head.some((v) => v === 1),
          spec.id,
        ).toBe(true);
        expect(pivot.y, spec.id).toBeGreaterThan(0);
        expect(pivot.z, spec.id).toBeCloseTo(spec.length * 0.4, 5);
        g.computeBoundingBox();
        const box = g.boundingBox!;
        expect(box.min.y, spec.id).toBeGreaterThan(-0.02);
        expect(box.min.y, spec.id).toBeLessThan(0.03);
        expect(box.max.y, spec.id).toBeGreaterThan(spec.height * 0.9);
        expect(box.max.z, spec.id).toBeGreaterThan(spec.length * 0.5);
        expect(box.min.z, spec.id).toBeLessThan(-spec.length * 0.45);
      }
    }
  });

  it("marks a rack's every vertex with its root and the age its tine comes at", () => {
    for (const spec of BEASTS) {
      const style = BEAST_STYLES[spec.id];
      const g = buildBeast(spec, style, "adult", "near").geometry;
      const rung = values(g, "aAntler", 3);
      const racked = rung.filter((w) => w >= 0);
      if (!style.rack) {
        expect(racked.length, spec.id).toBe(0);
        continue;
      }
      expect(racked.length, spec.id).toBeGreaterThan(0);
      for (const w of racked) {
        expect(
          TINE_AT.some((t) => Math.abs(t - w) < 1e-6),
          `${spec.id} rung ${w}`,
        ).toBe(true);
      }
      // Antlers come tine by tine; horns are one horn all their life.
      const tines = new Set(racked.filter((w) => w > 0).map((w) => w.toFixed(4)));
      if (["hooks", "scimitar"].includes(style.rack.form)) expect(tines.size, spec.id).toBe(0);
      else expect(tines.size, spec.id).toBeGreaterThan(1);
      // Every racked vertex is the head's, so the head carries it down.
      const head = values(g, "aPart", 2);
      rung.forEach((w, i) => {
        if (w >= 0) expect(head[i], spec.id).toBe(1);
      });
      // The far cut keeps the beam alone.
      const far = values(buildBeast(spec, style, "adult", "far").geometry, "aAntler", 3);
      expect(
        far.every((w) => w <= 0),
        spec.id,
      ).toBe(true);
    }
  });
});

describe("who each animal is", () => {
  const who = freshIndividual();

  it("is a pure function of its group's scatter and its place in it", () => {
    for (const spec of BEASTS) {
      const a = { ...beastIndividual(spec.id, 1234567, 3, 8, who) };
      a.shade = [...who.shade];
      const b = beastIndividual(spec.id, 1234567, 3, 8, freshIndividual());
      expect(b, spec.id).toEqual(a);
    }
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      seen.add(JSON.stringify(birdIndividual("raven", 99, i, who)));
    }
    expect(seen.size).toBe(12);
  });

  it("deals a lone animal and a group's leader grown, and young only among the rest", () => {
    for (const spec of BEASTS) {
      for (let scatter = 1; scatter < 40; scatter++) {
        expect(beastIndividual(spec.id, scatter, 0, 6, who).form, spec.id).toBe(0);
        expect(beastIndividual(spec.id, scatter, 2, 1, who).form, spec.id).toBe(0);
      }
    }
    let young = 0;
    for (let scatter = 1; scatter < 200; scatter++) {
      for (let i = 1; i < 6; i++) {
        const r = beastIndividual("reindeer", scatter, i, 6, who);
        if (BEAST_FORMS.reindeer[r.form] === "young") {
          young++;
          expect(r.scale).toBeLessThan(0.75);
        } else {
          expect(r.scale).toBeGreaterThan(0.85);
        }
      }
    }
    expect(young).toBeGreaterThan(150);
    expect(young).toBeLessThan(450);
  });

  it("grows antlers on bulls alone where only bulls carry them, and with age", () => {
    expect(rackOf("elk", false, false, 1)).toBe(0);
    expect(rackOf("moose", false, false, 0.5)).toBe(0);
    expect(rackOf("elk", true, false, 0)).toBeLessThan(TINE_AT[1]);
    expect(rackOf("elk", true, false, 1)).toBeGreaterThanOrEqual(TINE_AT[TINE_AT.length - 1]);
    expect(rackOf("elk", true, false, 0.8)).toBeGreaterThan(rackOf("elk", true, false, 0.2));
    // A reindeer cow keeps hers, smaller; a chamois nanny her hooks.
    expect(rackOf("reindeer", false, false, 0.5)).toBeGreaterThan(0);
    expect(rackOf("reindeer", false, false, 1)).toBeLessThan(rackOf("reindeer", true, false, 1));
    expect(rackOf("chamois", false, false, 0.5)).toBeGreaterThan(0.4);
    expect(rackOf("fox", true, false, 1)).toBe(0);
  });

  it("deals hens and cocks, a hen her own form where the species has one", () => {
    let hens = 0;
    for (let i = 0; i < 200; i++) {
      const b = birdIndividual("capercaillie", 4242, i, who);
      if (!b.male) {
        hens++;
        expect(BIRD_FORMS.capercaillie[b.form]).toBe("female");
        expect(b.scale).toBeLessThan(0.85);
      } else {
        expect(BIRD_FORMS.capercaillie[b.form]).toBe("male");
      }
    }
    expect(hens).toBeGreaterThan(60);
    expect(hens).toBeLessThan(140);
  });

  it("keeps a white coat white", () => {
    for (let i = 0; i < 50; i++) {
      const h = beastIndividual("hare", 7, i, 1, who);
      expect(Math.min(...h.shade)).toBeGreaterThan(0.95);
    }
  });
});

describe("the wildlife at every picture setting", () => {
  it("draws every species, only fewer forms on a cheaper picture", () => {
    const tiers = ["low", "medium", "high"] as const;
    for (const tier of tiers) {
      const { forms, near } = FOREST_LOOK[tier].wild;
      expect(forms, tier).toBeGreaterThanOrEqual(1);
      expect(near, tier).toBeGreaterThan(0);
      const who = freshIndividual();
      for (const spec of BEASTS) {
        const drawn = Math.min(forms, BEAST_FORMS[spec.id].length);
        expect(drawn, `${tier} ${spec.id}`).toBeGreaterThan(0);
        for (let i = 0; i < 20; i++) {
          const f = drawnForm(beastIndividual(spec.id, 31, i, 8, who).form, drawn);
          expect(f, `${tier} ${spec.id}`).toBeLessThan(drawn);
        }
      }
      for (const spec of BIRDS) {
        const drawn = Math.min(forms, BIRD_FORMS[spec.id].length);
        for (let i = 0; i < 20; i++) {
          expect(drawnForm(birdIndividual(spec.id, 31, i, who).form, drawn)).toBeLessThan(drawn);
        }
      }
    }
    // Up the ladder, never fewer forms and never a nearer hand-over.
    for (let k = 1; k < tiers.length; k++) {
      expect(FOREST_LOOK[tiers[k]].wild.forms).toBeGreaterThanOrEqual(
        FOREST_LOOK[tiers[k - 1]].wild.forms,
      );
      expect(FOREST_LOOK[tiers[k]].wild.near).toBeGreaterThanOrEqual(
        FOREST_LOOK[tiers[k - 1]].wild.near,
      );
    }
    // The top of the ladder draws every form any species has.
    const most = Math.max(
      ...Object.values(BIRD_FORMS).map((f) => f.length),
      ...Object.values(BEAST_FORMS).map((f) => f.length),
    );
    expect(FOREST_LOOK.high.wild.forms).toBeGreaterThanOrEqual(most);
  });
});

describe("the course's marks, built", () => {
  const plan: ArchPlan = {
    x: 0,
    z: 0,
    rx: 1,
    rz: 0,
    reach: 6,
    feet: [
      { x: -6, z: 0, y: -ARCH.sink },
      { x: 6, z: 0, y: -ARCH.sink },
    ],
    top: ARCH.top,
  };
  const path = (): THREE.CurvePath<THREE.Vector3> => {
    const p = new THREE.CurvePath<THREE.Vector3>();
    const c = ARCH.corner;
    const v = (x: number, y: number) => new THREE.Vector3(x, y, 0);
    p.add(new THREE.LineCurve3(v(-6, -ARCH.sink), v(-6, ARCH.top - c)));
    p.add(
      new THREE.QuadraticBezierCurve3(v(-6, ARCH.top - c), v(-6, ARCH.top), v(-6 + c, ARCH.top)),
    );
    p.add(new THREE.LineCurve3(v(-6 + c, ARCH.top), v(6 - c, ARCH.top)));
    p.add(new THREE.QuadraticBezierCurve3(v(6 - c, ARCH.top), v(6, ARCH.top), v(6, ARCH.top - c)));
    p.add(new THREE.LineCurve3(v(6, ARCH.top - c), v(6, -ARCH.sink)));
    return p;
  };

  it("are faceted and light: every mark within its budget", () => {
    const budget: [string, THREE.BufferGeometry, number][] = [
      ["pole", gatePole(1.85, 0.017), 40],
      ["panel", gatePanel(1.05, 0.5, 1.85), 30],
      ["stake", edgeStake(2.2, 0.02), 20],
      ["band", edgeBand(2.2, 0.45, 0.02), 25],
      ["marker", gateMarker(), 20],
      ["arch", archTube(plan, path()), 600],
      ["skirt", archSkirt(), 30],
      ["blower", archBlower(), 12],
    ];
    for (const [name, g, most] of budget) {
      expect(tris(g), name).toBeLessThanOrEqual(most);
      expect(tris(g), name).toBeGreaterThan(0);
      expect(g.getAttribute("color"), name).toBeDefined();
    }
  });

  it("builds the arch round the line's own plan, piped white at every seam", () => {
    const g = archTube(plan, path());
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.x).toBeCloseTo(6 + ARCH.tube, 1);
    expect(box.min.x).toBeCloseTo(-6 - ARCH.tube, 1);
    expect(box.max.y).toBeCloseTo(ARCH.top + ARCH.tube, 1);
    const col = g.getAttribute("color");
    let white = 0;
    for (let i = 0; i < col.count; i++) if (col.getX(i) > 0.99 && col.getZ(i) > 0.99) white++;
    // Five seams (two each shoulder's ends, one mid-span), eight panels a ring.
    expect(white / 6).toBe(5 * 8);
  });
});
