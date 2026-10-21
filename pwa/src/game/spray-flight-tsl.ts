// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A WEIGHED PARCEL'S FLIGHT ON THE NODE RENDERER (`docs/webgpu.md`, part 9):
// `spray-flight.ts`'s `SPRAY_FLIGHT_GLSL` restated in TSL, line for line —
// the ring's five attributes (`aL0`…`aL4`) flown off the clock `uNow` on the
// parcel's own graded grid, the pool's lag and its first look laid on, down
// where the path meets the snow's plane and run on down it. `flyLaunch` in
// TypeScript is the authority both are held to; this reads it through the
// GLSL, so the three say one thing.
//
// Called inside the spray twin's vertex function (`spray-tsl.ts`): every
// statement lands on its stack, and what it hands back are variables.

import * as TSL from "three/tsl";

import type { N } from "./haze-tsl.ts";
import { FLIGHT } from "./spray-flight.ts";
import { MASS } from "./spray-mass.ts";

const {
  Break,
  If,
  Loop,
  attribute,
  bool,
  ceil,
  exp,
  float,
  fract,
  instanceIndex,
  length,
  max,
  min,
  normalize,
  pow,
  select,
  sqrt,
  vec3,
} = TSL as N;

/** What a parcel is this frame (`sprayParcel`'s outs), as variables. */
export type Parcel = {
  ok: N;
  world: N;
  move: N;
  size: N;
  alpha: N;
  hard: N;
  glint: N;
  seed: N;
};

const G = FLIGHT.g;
const FIRST = FLIGHT.first;
const TOUCH = FLIGHT.touch;
const AIR = MASS.air.rho * MASS.carried * 4.19;

/** THE CPU POOL'S GRAINS (`spray.ts`'s `CPU_SOURCE`): read as they were
 * packed, every one alive. */
export function poolParcel(): Parcel {
  const spot = attribute("aSpot", "vec4");
  const move = attribute("aMove", "vec4");
  const kind = attribute("aKind", "vec3");
  return {
    ok: bool(true),
    world: spot.xyz,
    move: move.xyz,
    size: spot.w,
    alpha: move.w,
    hard: kind.x,
    glint: kind.y,
    seed: kind.z,
  };
}

/** THE GPU RING'S PARCEL (`SPRAY_FLIGHT_GLSL`'s `sprayParcel`), flown to
 * `now` and cut before `oldest`. */
export function ringParcel(now: N, oldest: N): Parcel {
  const L0 = attribute("aL0", "vec4");
  const L1 = attribute("aL1", "vec4");
  const L2 = attribute("aL2", "vec4");
  const L3 = attribute("aL3", "vec4");
  const L4 = attribute("aL4", "vec4");
  const plane = (p: N): N => L4.x.add(L4.y.mul(p.x.sub(L0.x))).add(L4.z.mul(p.z.sub(L0.z)));
  const drag = (t: N, term: N): N => {
    const r = L2.z.add(
      sqrt(
        float(2 * MASS.sheet)
          .mul(L2.w)
          .mul(t),
      ),
    );
    const phi = select(L3.x.greaterThan(0), L2.x.div(r.mul(r).mul(r).mul(AIR)), float(0));
    const p1 = phi.add(1);
    return float(G).div(term.mul(term)).div(p1.mul(p1));
  };
  const flown = (t: N, term: N): N => {
    const v = sqrt(float(G).div(drag(t, term)));
    const gF = G * FIRST;
    const u = sqrt(
      v
        .mul(v)
        .mul(4)
        .add(gF * gF),
    )
      .add(gF)
      .mul(0.5);
    return float(G).div(u.mul(u));
  };
  /** `flyStep`: one step of `h` from `t`, `p` and `v` variables. */
  const step = (t: N, h: N, term: N, p: N, v: N): void => {
    const c = drag(t.add(h.mul(0.5)), term).toVar();
    const g = float(G)
      .mul(c)
      .div(flown(t.add(h.mul(0.5)), term))
      .toVar();
    const w = vec3(L3.y, 0, L3.z);
    const r = v.sub(w).toVar();
    const s0 = length(r).toVar();
    const pass = (k: N) => {
      const x = k.mul(h).toVar();
      const e = exp(x.negate()).toVar();
      const small = x.lessThan(0.01);
      const q = select(
        small,
        h.mul(float(1).sub(x.div(2)).add(x.mul(x).div(6))),
        float(1).sub(e).div(k),
      ).toVar();
      const m = select(
        small,
        h.mul(h).mul(float(0.5).sub(x.div(6)).add(x.mul(x).div(24))),
        h.sub(q).div(k),
      ).toVar();
      return { e, q, m };
    };
    const k0 = max(1e-4, c.mul(s0)).toVar();
    const a = pass(k0);
    const k1 = max(
      1e-4,
      c
        .mul(0.5)
        .mul(s0.add(length(vec3(r.x.mul(a.e), r.y.mul(a.e).sub(g.mul(a.q)), r.z.mul(a.e))))),
    ).toVar();
    const { e, q, m } = pass(k1);
    p.addAssign(
      vec3(w.x.mul(h).add(r.x.mul(q)), r.y.mul(q).sub(g.mul(m)), w.z.mul(h).add(r.z.mul(q))),
    );
    v.assign(vec3(w.x.add(r.x.mul(e)), r.y.mul(e).sub(g.mul(q)), w.z.add(r.z.mul(e))));
  };
  /** `flySlide`: the run down the snow's plane for `time` s. */
  const slide = (time: N, p: N, v: N): void => {
    const n = normalize(vec3(L4.y.negate(), 1, L4.z.negate())).toVar();
    const h = max(0, time).div(FLIGHT.slide).toVar();
    const u0 = v.xz.toVar();
    Loop(FLIGHT.slide, () => {
      const u = v.xz.add(n.xz.mul(n.y).mul(h).mul(G)).toVar();
      const sp = length(u).toVar();
      const brake = n.y
        .mul(h)
        .mul(MASS.roll.mu * G)
        .toVar();
      If(sp.greaterThan(brake), () => {
        const w = u.mul(sp.sub(brake).div(sp)).toVar();
        const dp = v.xz.add(w).mul(h).mul(0.5);
        p.assign(vec3(p.x.add(dp.x), p.y, p.z.add(dp.y)));
        v.assign(vec3(w.x, v.y, w.y));
      }).Else(() => {
        const dp = v.xz.add(u).mul(h).mul(sp.div(brake)).mul(0.25);
        p.assign(vec3(p.x.add(dp.x), p.y, p.z.add(dp.y)));
        v.assign(vec3(0, v.y, 0));
      });
    });
    const back = u0.sub(v.xz).mul(0.5 * FIRST);
    p.assign(vec3(p.x.sub(back.x), p.y, p.z.sub(back.y)));
    p.assign(vec3(p.x, plane(p).add(TOUCH), p.z));
    v.assign(vec3(v.x, 0, v.z));
  };
  const roll = select(L3.x.greaterThan(0), float(MASS.roll.time), float(MASS.roll.clump));

  const age = now.sub(L0.w).toVar();
  const life = L1.w.toVar();
  const out: Parcel = {
    ok: bool(false).toVar(),
    world: L0.xyz.toVar(),
    move: vec3(0).toVar(),
    size: float(0).toVar(),
    alpha: float(0).toVar(),
    hard: L3.w,
    glint: L4.w,
    seed: fract(float(instanceIndex).mul(0.618034)),
  };
  const alive = age.greaterThanEqual(0).and(age.lessThan(life)).and(L0.w.greaterThanEqual(oldest));
  If(alive, () => {
    const term = L2.y.abs().toVar();
    const p = L0.xyz.toVar();
    const v = L1.xyz.toVar();
    If(L2.y.lessThan(0), () => {
      slide(min(age, life), p, v);
    }).Else(() => {
      const t = float(0).toVar();
      const over = p.y.sub(plane(p)).toVar();
      // The pool's lag: its first frame's loss, then half a frame's of
      // what it loses after.
      const p1 = p.toVar();
      const v1 = v.toVar();
      step(float(0), float(FIRST), term, p1, v1);
      // The pool's own first frame, and its first look a frame on.
      const w1 = vec3(L3.y, 0, L3.z);
      const rel = v.sub(w1);
      const cv0 = w1.add(rel.div(drag(float(FIRST), term).mul(length(rel)).mul(FIRST).add(1)));
      const cv = vec3(cv0.x, cv0.y.sub(G * FIRST), cv0.z).toVar();
      const d1 = p1.sub(p).sub(cv.mul(FIRST)).toVar();
      const c1 = p.add(cv.mul(FIRST)).toVar();
      const sunk = c1.y.sub(plane(c1)).lessThan(TOUCH).toVar();
      If(sunk.and(age.lessThan(FIRST)), () => {
        p.addAssign(cv.mul(age));
      }).ElseIf(sunk, () => {
        p.assign(c1);
        life.assign(min(life, roll.add(FIRST)));
        v.assign(vec3(cv.x.mul(MASS.roll.keep), 0, cv.z.mul(MASS.roll.keep)));
        slide(min(age, life).sub(FIRST), p, v);
      });
      const q = p.toVar();
      const lag = (at: N): N =>
        select(
          at.greaterThanEqual(FIRST),
          d1.add(v1.sub(v).mul(0.5 * FIRST)),
          d1.mul(at).div(FIRST),
        );
      If(sunk.not(), () => {
        Loop(
          { start: 1, end: FLIGHT.steps + 1, type: "int", condition: "<" },
          ({ i }: { i: N }) => {
            const t1 = life.mul(pow(float(i).div(FLIGHT.steps), FLIGHT.power)).toVar();
            const h = t1.sub(t).toVar();
            const p0 = p.toVar();
            const v0 = v.toVar();
            step(t, h, term, p, v);
            const c = p.sub(lag(t1)).toVar();
            const now1 = c.y.sub(plane(c)).toVar();
            // The whole step, always: whether it comes down in it is the grid's.
            const down = now1
              .lessThan(TOUCH)
              .and(v.y.sub(L4.y.mul(v.x)).sub(L4.z.mul(v.z)).lessThan(0))
              .toVar();
            const f = select(
              down.not(),
              float(1),
              select(over.greaterThan(TOUCH), over.sub(TOUCH).div(over.sub(now1)), float(0)),
            ).toVar();
            const tl = ceil(t.add(f.mul(h)).div(FIRST).sub(1e-6))
              .mul(FIRST)
              .toVar();
            const g = min(1, max(f, tl.sub(t).div(h)));
            If(down.and(tl.lessThanEqual(age)), () => {
              p.assign(q.add(c.sub(q).mul(g)));
              life.assign(min(life, tl.add(roll)));
              v.assign(vec3(v.x.mul(MASS.roll.keep), 0, v.z.mul(MASS.roll.keep)));
              slide(min(age, life).sub(tl), p, v);
              Break();
            });
            If(t1.greaterThanEqual(age), () => {
              // Still up at age, inside this step: the step again, to age.
              p.assign(p0);
              v.assign(v0);
              step(t, age.sub(t), term, p, v);
              p.subAssign(lag(age));
              If(down, () => {
                p.assign(vec3(p.x, max(p.y, plane(p).add(TOUCH)), p.z));
              });
              Break();
            });
            over.assign(now1);
            q.assign(c);
            t.assign(t1);
          },
        );
      });
    });
    If(age.lessThan(life), () => {
      const r = L2.z.add(sqrt(L2.w.mul(age).mul(2))).toVar();
      out.size.assign(r.mul(2));
      const u = age.div(life);
      const fade = min(1, age.mul(40)).mul(
        select(u.greaterThan(0.8), max(0, float(1).sub(u)).div(0.2), float(1)),
      );
      out.alpha.assign(
        select(
          L3.x.greaterThan(0),
          float(1)
            .sub(exp(L2.x.mul(L3.x).mul(-MASS.optics).div(r.mul(r).mul(3.14159265))))
            .mul(fade),
          fade,
        ),
      );
      out.world.assign(p);
      out.move.assign(v);
      out.ok.assign(true);
    });
  });
  return out;
}
