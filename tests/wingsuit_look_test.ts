// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT AS DRAWN: the flyer's body in every stage of the jump
// (`skier-wingsuit.ts`), the suit's wings lofted off it
// (`wingsuit-cloth.ts`) held to the class's measured bands (`docs/wingsuit.md`
// — a large three-wing suit on a 1.80 m flyer), the suit's paint and body
// (`wingsuit-look.ts`, `wingsuit-dress.ts`), the hover exit's helicopter
// (`wingsuit-hover.ts`) — and NOTHING OF A PAIR OF SKIS drawn on a
// wingsuit's run: no ski, no binding, no boot and no pole.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CHUTE,
  createGame,
  freshChute,
  generateLevel,
  skydiveAt,
  type ChuteState,
  type GameState,
} from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import { movePose } from "../pwa/src/game/party-pose.ts";
import type { BodyFrame } from "../pwa/src/game/skier-ragdoll.ts";
import {
  wingsuitPose,
  wingsuitShapeOf,
  wingsuitTilt,
  type WingsuitShape,
} from "../pwa/src/game/skier-wingsuit.ts";
import type { SkierPose, V3 } from "../pwa/src/game/skier-pose.ts";
import {
  armWing,
  legWing,
  shapeSuit,
  suitLayout,
  suitMeasures,
} from "../pwa/src/game/wingsuit-cloth.ts";
import {
  colourwayOf,
  SUIT_COLOURWAYS,
  suitOf,
  suitPaintGlsl,
} from "../pwa/src/game/wingsuit-look.ts";
import { suitDress, suitOutfit } from "../pwa/src/game/wingsuit-dress.ts";
import { DEFAULT_OUTFIT } from "../pwa/src/game/outfit.ts";
import { createSkisModel, pairStyle } from "../pwa/src/game/skis-body.ts";
import { hoverAt, HOVER } from "../pwa/src/game/wingsuit-hover.ts";

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const angle = (a: V3, b: V3): number => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));
const deg = (r: number): number => (r * 180) / Math.PI;

/** A flyer stood up in a wingsuit in `mode` on the flat. */
function suitState(mode: ChuteState["mode"]): GameState {
  const s = createGame({ level: flatLevel(), seed: 1, mode: "free" });
  skydiveAt(s, { x: 0, z: 0, agl: 900, mode: "freefall", suit: "wingsuit" });
  s.chute!.mode = mode;
  return s;
}

/** The body posed in `shape`, as `wingsuit-body.ts` lays it. */
function posed(shape: WingsuitShape): SkierPose {
  const frame: BodyFrame = {
    origin: { x: 0, y: 0, z: 0 },
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
  };
  const walking = shape.foot === "walk";
  const base = movePose(
    { kind: "walk", t: shape.strides, pace: walking ? shape.pace : 0 },
    -0.95,
    frame,
  );
  return wingsuitPose(base, shape);
}

const flyingShape = (): WingsuitShape => wingsuitShapeOf(suitState("freefall").chute, false)!;

describe("the flyer's body", () => {
  it("is a wingsuit's shape in every stage, and no skydiver's", () => {
    for (const mode of ["ready", "exit", "freefall", "deploying", "open", "landed"] as const) {
      const s = suitState(mode);
      if (mode === "deploying") {
        const d = freshChute(s, "freefall", "wingsuit");
        s.chute!.deploy = {
          stage: "pilot",
          share: 0,
          t: 0.2,
          pilot: { x: 0, y: 0, z: 0 },
          bag: { x: 0, y: 0, z: 0 },
          lines: 0,
          slider: 1,
          spread: 0,
        };
        expect(d.suit).toBe("wingsuit");
      }
      const shape = wingsuitShapeOf(s.chute, false);
      expect(shape, mode).not.toBeNull();
    }
    // A box jump is not a wingsuit's.
    const box = createGame({ level: flatLevel(), seed: 1, mode: "free" });
    skydiveAt(box, { x: 0, z: 0, agl: 900 });
    expect(wingsuitShapeOf(box.chute!, false)).toBeNull();
  });

  it("flies with the arms out 70–90° from his sides and the legs spread 25–40°", () => {
    const p = posed(flyingShape());
    const spine = sub(p.neck, p.hips);
    for (let i = 0; i < 2; i++) {
      const arm = sub(p.hands[i], p.shoulders[i]);
      const out = deg(angle(arm, { x: -spine.x, y: -spine.y, z: -spine.z }));
      expect(out, `arm ${i} from his side`).toBeGreaterThan(70);
      expect(out, `arm ${i} from his side`).toBeLessThan(100);
      // ...nearly straight: the elbow within a few degrees of the line.
      const bend = angle(sub(p.elbows[i], p.shoulders[i]), sub(p.hands[i], p.elbows[i]));
      expect(deg(bend)).toBeLessThan(15);
    }
    const legs = deg(angle(sub(p.knees[0], p.hipJoints[0]), sub(p.knees[1], p.hipJoints[1])));
    expect(legs).toBeGreaterThan(22);
    expect(legs).toBeLessThan(42);
  });

  it("sweeps the arms back to dive and spreads them to flare", () => {
    const fly = flyingShape();
    const p = posed(fly);
    const dive = posed({ ...fly, sweep: 1, lean: -1 });
    const flare = posed({ ...fly, spread: 1, lean: 1 });
    const down = sub(p.hips, p.neck);
    const sweptOf = (q: SkierPose) => deg(angle(sub(q.hands[1], q.shoulders[1]), down));
    expect(sweptOf(dive)).toBeLessThan(sweptOf(p) - 30);
    expect(sweptOf(flare)).toBeGreaterThan(sweptOf(dive));
    expect(posed({ ...fly, spread: 1 }).hands[1].x).toBeGreaterThan(0.6);
  });

  it("stands on the exit with his arms down, and pulls with his right hand", () => {
    const stood = posed(wingsuitShapeOf(suitState("ready").chute, false)!);
    for (let i = 0; i < 2; i++) expect(stood.hands[i].y).toBeLessThan(stood.shoulders[i].y - 0.3);
    const fly = flyingShape();
    const reach = posed({ ...fly, reach: 1 });
    const hips = reach.hips;
    // The right hand back at the pouch at the foot of the container.
    expect(
      len(sub(reach.hands[1], { x: hips.x + 0.1, y: hips.y - 0.06, z: hips.z - 0.2 })),
    ).toBeLessThan(0.2);
    expect(reach.poles).toBeNull();
  });

  it("is turned to the engine's attitude and banked about his length", () => {
    const s = suitState("freefall");
    s.chute!.attitude = Math.PI / 2;
    s.chute!.wing!.bank = 0.4;
    const t = wingsuitTilt(wingsuitShapeOf(s.chute, false)!);
    expect(t.pitch).toBeCloseTo(Math.PI / 2 - CHUTE.freefall.pitchMost, 6);
    expect(t.bank).toBeCloseTo(0.4, 6);
    expect(wingsuitTilt(wingsuitShapeOf(suitState("ready").chute, false)!).pitch).toBe(0);
  });
});

describe("the suit's wings", () => {
  const p = posed(flyingShape());
  const m = suitMeasures(p);

  it("measure as a large suit's", () => {
    expect(m.span).toBeGreaterThan(1.6);
    expect(m.span).toBeLessThan(1.85);
    expect(m.tipChord).toBeGreaterThan(0.2);
    expect(m.tipChord).toBeLessThan(0.42);
    expect(m.rootChord).toBeGreaterThan(0.75);
    expect(m.rootChord).toBeLessThan(1.25);
    expect(m.legLength).toBeGreaterThan(0.85);
    expect(m.legLength).toBeLessThan(1.15);
    expect(m.legWidth).toBeGreaterThan(0.5);
    expect(m.legWidth).toBeLessThan(0.85);
  });

  it("span the right bones: wrist to armpit to knee, crotch to past the heels", () => {
    for (let i = 0; i < 2; i++) {
      const w = armWing(p, i);
      expect(len(sub(w.base(1, 0), p.hands[i]))).toBeLessThan(0.1);
      expect(len(sub(w.base(0, 1), p.knees[i]))).toBeLessThan(0.16);
      expect(len(sub(w.base(0, 0.15), p.shoulders[i]))).toBeLessThan(0.3);
    }
    const leg = legWing(p);
    for (let i = 0; i < 2; i++) {
      const tail = leg.base(i, 1);
      // Past the feet, on each one's side.
      expect(dot(sub(tail, p.feet[i]), sub(p.feet[i], p.knees[i]))).toBeGreaterThan(0);
    }
  });

  it("are inflated 8–15 cm thick on the arm and 6–12 on the legs, slack at rest", () => {
    const at = (w: ReturnType<typeof armWing>, pressure: number, u: number) =>
      Math.max(...Array.from({ length: 21 }, (_, k) => 2 * w.half(u, 0.15 + k * 0.02, pressure)));
    const arm = armWing(p, 1);
    const full = at(arm, 1, 0.3);
    expect(full).toBeGreaterThan(0.08);
    expect(full).toBeLessThan(0.16);
    const leg = legWing(p);
    const legFull = Math.max(...[0.2, 0.25, 0.3, 0.35].map((v) => 2 * leg.half(0.5, v, 1)));
    expect(legFull).toBeGreaterThan(0.06);
    expect(legFull).toBeLessThan(0.13);
    // Slack, the cloth between the arm and the body lies flat.
    expect(2 * arm.half(0.3, 0.6, 0)).toBeLessThan(0.01);
  });

  it("are lofted into one buffer of finite points", () => {
    const layout = suitLayout();
    const out = new Float32Array(layout.vertices * 3);
    shapeSuit(out, layout, p, { pressure: 1, unzip: 0, t: 0 });
    expect(out.every(Number.isFinite)).toBe(true);
    expect(Math.max(...layout.index)).toBeLessThan(layout.vertices);
    shapeSuit(out, layout, posed({ ...flyingShape(), hang: 1, fly: 0 }), {
      pressure: 0.25,
      unzip: 1,
      t: 3,
    });
    expect(out.every(Number.isFinite)).toBe(true);
  });
});

describe("the suit's look", () => {
  it("is dealt a colourway off the outfit, the same every jump", () => {
    const i = suitOf(DEFAULT_OUTFIT);
    expect(i).toBe(suitOf(DEFAULT_OUTFIT));
    expect(colourwayOf(i)).toBe(SUIT_COLOURWAYS[i]);
    for (const c of SUIT_COLOURWAYS) expect(suitPaintGlsl(c)).toContain("vec3 suitPaint(vec4 w)");
  });

  it("dresses the body in the suit's colours with no poles", () => {
    expect(suitOutfit(DEFAULT_OUTFIT).poles).toBe("none");
    const mesh = suitDress(DEFAULT_OUTFIT, 0);
    expect(mesh.cloth.position.length).toBeGreaterThan(0);
    expect(mesh.cloth.color.length).toBe(mesh.cloth.position.length);
  });
});

describe("a wingsuit run", () => {
  it("draws nothing of a pair of skis: no ski, binding, boot or pole", () => {
    const s = suitState("freefall");
    const spec = s.skier.spec;
    const model = createSkisModel(
      spec,
      pairStyle(spec, { outfit: DEFAULT_OUTFIT, suit: 0 }),
      named,
    );
    model.setRun(s);
    model.setWingsuit?.(wingsuitShapeOf(s.chute, false));
    const c = s.skier;
    model.pose(c, { x: c.x, y: c.y, z: c.z, q: c.q }, 0, null, 1 / 60);
    const shown = (o: THREE.Object3D): boolean => {
      for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
      return true;
    };
    let wings = 0;
    model.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !shown(o)) return;
      if (o.name === "wingsuit") wings++;
      // What is drawn is the dressed skin, the wings, the lamp and the one
      // merged draw: every part of the pair under it hidden.
      const ok =
        o instanceof THREE.SkinnedMesh ||
        o.name === "wingsuit" ||
        o.name.startsWith("skis-merged") ||
        (o.material as THREE.Material).name === "skis-merged" ||
        isLamp(o);
      expect(ok, `${o.name || o.type} drawn`).toBe(true);
    });
    expect(wings).toBe(1);
    model.dispose();
  });
});

/** The game's wrap, as far as a name: each material named for its part. */
function named<M extends THREE.Material>(m: M, name: string): M {
  m.name = name;
  return m;
}

function isLamp(o: THREE.Object3D): boolean {
  if (o instanceof THREE.Mesh && /lamp/i.test((o.material as THREE.Material).name)) return true;
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (/lamp/i.test(n.name)) return true;
  return false;
}

describe("the hover exit", () => {
  it("holds the helicopter's right skid under his boots, then flies away", () => {
    const level = generateLevel(38);
    const s = createGame({ level, seed: 38, mode: "free", wingsuit: true });
    const hover = s.wingsuit?.hover ?? 0;
    expect(hover).toBeGreaterThan(0);
    const h = { x: 0, y: 0, z: 0 } as Parameters<typeof hoverAt>[3];
    const ex = { x: s.skier.x, z: s.skier.z, heading: s.chute!.heading, hover };
    hoverAt(level, ex, 0, h);
    const right = { x: Math.cos(ex.heading), z: -Math.sin(ex.heading) };
    const skidX = h.x + right.x * 1.1;
    const skidZ = h.z + right.z * 1.1;
    expect(Math.hypot(skidX - s.skier.x, skidZ - s.skier.z)).toBeLessThan(HOVER.fore + 0.05);
    hoverAt(level, ex, HOVER.hold + 20, h);
    expect(h.y).toBeGreaterThan(level.groundAt(ex.x, ex.z) + hover + 30);
    expect(Math.hypot(h.x - ex.x, h.z - ex.z)).toBeGreaterThan(150);
  });
});
