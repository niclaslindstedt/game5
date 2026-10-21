// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RACE'S FANS ON THE NODE RENDERER (`docs/webgpu.md`, part 11):
// `spectator-shapes.ts`'s `POSE_GLSL` and its paint restated as a figure's
// pose (`figure-tsl.ts`), term for term — the parts a fan's look does not
// keep folded, how lit up he is by the racers near him and the arena's
// roar, the wave along a stand, the body and the head turned to follow, his
// habit at rest and each style's moves lit up, the arms blended to the
// wave, the legs' stamp, the flag's cloth, his size and his heading.
//
// A fan's instance matrix is a translation alone (`spectators.ts`, set
// once), so the twin reads where he stands as an attribute of its own
// (`aHome`, WebGL's `instanceMatrix[3]`) in the place of three's matrix,
// packed with his dealt looks: one program for every stand, whatever its
// count. The bank is walled by the mist as WebGL's is (`PAST_THE_WALL`, the
// twin's mask).

import * as THREE from "three";
import * as TSL from "three/tsl";

import { interleave, ownValue, packed, type FigureSpec } from "./figure-tsl.ts";
import { slot, type N } from "./haze-tsl.ts";
import { FLAG, REF } from "./spectator-shapes.ts";

const {
  If,
  abs,
  atan,
  attribute,
  clamp,
  cos,
  exp,
  float,
  floor,
  fract,
  int,
  length,
  max,
  mix,
  pow,
  select,
  sin,
  smoothstep,
  step,
  uniformArray,
  vec2,
  vec3,
} = TSL as N;

const f3 = (n: number): number => Number(n.toFixed(3));

/** `fanRx`, `fanRy`, `fanRz` (column-major, as the GLSL's `mat3`) times `v`. */
const rx = (a: N, v: N): N => {
  const c = cos(a).toVar();
  const s = sin(a).toVar();
  return vec3(v.x, c.mul(v.y).sub(s.mul(v.z)), s.mul(v.y).add(c.mul(v.z)));
};
const ry = (a: N, v: N): N => {
  const c = cos(a).toVar();
  const s = sin(a).toVar();
  return vec3(c.mul(v.x).add(s.mul(v.z)), v.y, c.mul(v.z).sub(s.mul(v.x)));
};
const rz = (a: N, v: N): N => {
  const c = cos(a).toVar();
  const s = sin(a).toVar();
  return vec3(c.mul(v.x).sub(s.mul(v.y)), s.mul(v.x).add(c.mul(v.y)), v.z);
};

/** GLSL's `mod`. */
const mod = (x: N, y: number): N => x.sub(floor(x.div(y)).mul(y));
const near = (a: N, b: number): N => abs(a.sub(b)).lessThan(0.5);

/** `fanPulse`. */
function pulse(t: N, every: N, width: number): N {
  const at = fract(t.div(every)).mul(every).toVar();
  return smoothstep(0, 0.15, at).mul(float(1).sub(smoothstep(width - 0.15, width, at)));
}

/** `fanKept`: whether a part is kept, by its toggle and the fan's look. */
function kept(keep: N, hat: N, bits: N, style: N): N {
  const on = (b: N): N => select(b, float(1), float(0));
  const rows: [number, N][] = [
    [0.5, float(1)],
    [1.5, on(mod(bits, 2).greaterThan(0.5))],
    [2.5, on(mod(floor(bits.div(2)), 2).greaterThan(0.5))],
    [3.5, on(mod(floor(bits.div(4)), 2).greaterThan(0.5))],
    [10.5, on(hat.lessThan(0.5).or(near(hat, 3)))],
    [11.5, on(near(hat, 1).or(near(hat, 2)).or(near(hat, 5)))],
    [12.5, on(near(hat, 2))],
    [13.5, on(near(hat, 3))],
    [14.5, on(near(hat, 4))],
    [15.5, on(near(hat, 5))],
    [16.5, on(hat.greaterThan(0.5))],
  ];
  const out = on(abs(keep.sub(20).sub(style)).lessThan(0.5)).toVar();
  // The chain's first band below wins: set from the top down.
  for (let k = rows.length - 1; k >= 0; k--) {
    If(keep.lessThan(rows[k][0]), () => {
      out.assign(rows[k][1]);
    });
  }
  return out.greaterThan(0.5);
}

/** An arm's pose as a vec3: its forward raise, its raise out to the side,
 * its elbow's bend (`FanArm`). */
const arm = (p: N | number, o: N | number, b: N | number): N => vec3(p, o, b);

/** `fanPoseArm`. */
function poseArm(p: N, side: number, fore: N, a: N): N {
  const sh = vec3(side * f3(REF.shoulderX), f3(REF.shoulder), 0);
  const q = p.sub(sh).toVar();
  If(fore, () => {
    const el = vec3(0, -f3(REF.upper), 0);
    q.assign(rx(a.z.negate(), q.sub(el)).add(el));
  });
  return rz(a.y.mul(side), rx(a.x.negate(), q)).add(sh);
}

/** The racers' array, one node a material's array: a node made for each
 * build names its buffer anew, and writes a program for every stand. */
const skierArrays = new WeakMap<THREE.Vector4[], N>();
function skierArray(value: THREE.Vector4[]): N {
  let node = skierArrays.get(value);
  if (!node) skierArrays.set(value, (node = uniformArray(value, "vec4")));
  return node;
}

/** `fanPose` of `pos`, for a fan standing at `home`. */
function fanPose(m: THREE.Material, pos: N, home: N): N {
  const time = slot(ownValue(m, "uFanTime"), "float");
  const skiers = skierArray(ownValue(m, "uFanSkier").value as THREE.Vector4[]);
  const arenaU = slot(ownValue(m, "uFanArena"), "float");
  const waveU = slot(ownValue(m, "uFanWave"), "vec4");
  const aBone = attribute("aBone", "vec4");
  const aLook = packed("aLook", "vec4");
  const aAct = packed("aAct", "vec4");
  const aMood = packed("aMood", "vec4");
  const out = vec3(0, 1, 0).toVar();
  const bone = aBone.x;
  const style = aAct.w;
  If(kept(aBone.w, aLook.z, aLook.w, style), () => {
    const t = time.mul(aAct.y.mul(0.3).add(0.85)).add(aAct.y.mul(37)).toVar();

    // HOW LIT UP HE IS, and where the racers are from him.
    const e = float(0).toVar();
    const look = vec2(0).toVar();
    for (let i = 0; i < 4; i++) {
      const sk = skiers.element(int(i)).toVar();
      If(sk.w.greaterThan(0), () => {
        const d = sk.xz.sub(home.xz).toVar();
        const dist = length(d).toVar();
        const ei = float(1)
          .sub(smoothstep(aMood.x.mul(0.22), aMood.x, dist))
          .mul(sk.w)
          .toVar();
        e.assign(max(e, ei));
        look.addAssign(d.div(max(dist, 0.01)).mul(ei.mul(ei).add(ei.mul(1e-4))));
      });
    }
    const lively = aAct.z.mul(0.45).add(0.55).toVar();
    const arena = aMood.y.mul(arenaU).toVar();
    const wave = aMood.w
      .mul(waveU.y)
      .mul(exp(pow(aMood.z.sub(waveU.x).div(2.2), 2).negate()))
      .toVar();
    const go = clamp(max(e, arena.mul(aAct.z.mul(0.4).add(0.35))), 0, 1);
    const hot = smoothstep(0.08, 0.7, go).toVar();

    // TURNED TO FOLLOW: the body as far as it goes, the head the rest.
    const glance = sin(t.mul(0.31).add(aAct.y.mul(9)))
      .mul(0.32)
      .mul(step(0.55, sin(t.mul(0.17).add(aAct.y.mul(3)))));
    const turn = atan(look.x, look.y).sub(aAct.x);
    const rel = select(length(look).greaterThan(1e-5), atan(sin(turn), cos(turn)), 0).toVar();
    const follow = smoothstep(0.03, 0.3, e).toVar();
    const turnMax = select(style.greaterThan(6.5), float(1.6), float(1.05));
    const bodyTurn = clamp(rel, turnMax.negate(), turnMax).mul(follow).toVar();
    const headTurn = clamp(rel.sub(bodyTurn), -1, 1)
      .mul(follow)
      .add(glance.mul(float(1).sub(follow)))
      .toVar();
    const nod = sin(t.mul(1.3)).mul(0.05).mul(float(1).sub(hot)).sub(follow.mul(0.12)).toVar();

    // AT REST: his habit for his hands, his weight from foot to foot, the
    // cold stamped off now and then.
    const habit = fract(aAct.y.mul(7.13)).toVar();
    const restL = arm(0.06, 0.12, 0.25).toVar();
    If(habit.greaterThan(0.82), () => {
      restL.assign(arm(-0.15, 0.75, 2.1));
    })
      .ElseIf(habit.greaterThan(0.6), () => {
        restL.assign(arm(0.55, -0.3, 1.95));
      })
      .ElseIf(habit.greaterThan(0.35), () => {
        restL.assign(arm(0.3, 0.02, 1.3));
      });
    const restR = restL.toVar();
    If(habit.greaterThan(0.82), () => {
      restR.assign(arm(0.06, 0.12, 0.25));
    });
    const stamp = pulse(t.add(aAct.y.mul(13)), aAct.y.mul(4).add(9), 1.6).toVar();
    const clapIdle = pulse(t.add(aAct.y.mul(29)), aAct.y.mul(6).add(14), 1.4).toVar();
    const clapPose = arm(1.1, sin(t.mul(18)).mul(0.5).add(0.5).mul(0.32).sub(0.1), 0.75);
    If(style.lessThan(0.5), () => {
      restL.assign(mix(restL, clapPose, clapIdle));
      restR.assign(mix(restR, clapPose, clapIdle));
    })
      .ElseIf(style.lessThan(2.5).and(style.greaterThan(1.5)), () => {
        restR.assign(
          arm(
            0.05,
            0.14,
            stamp
              .mul(0.25)
              .mul(sin(t.mul(30)))
              .add(0.2),
          ),
        );
      })
      .ElseIf(style.lessThan(3.5), () => {
        restR.assign(arm(0.35, 0.18, 1.35));
      })
      .ElseIf(style.lessThan(5.5).and(style.greaterThan(4.5)), () => {
        restL.assign(arm(0.12, -0.05, 0.35));
        restR.assign(restL);
      });
    const sway = sin(t.mul(0.8)).mul(0.045);

    // LIT UP: what each style does, the arms first.
    const beat = t.mul(6.2832).toVar();
    const hotL = restL.toVar();
    const hotR = restR.toVar();
    const hop = float(0).toVar();
    const lean = float(0.1).toVar();
    const roll = float(0).toVar();
    const sb = (k: number, add = 0): N => sin(beat.mul(k).add(add));
    If(style.lessThan(0.5), () => {
      // clap, over the head, quickening with the racer
      const c = sin(beat.mul(mix(2.2, 3.4, e)))
        .mul(0.5)
        .add(0.5);
      hotL.assign(arm(2.0, c.mul(0.48).sub(0.28), 0.55));
      hotR.assign(hotL);
      hop.assign(abs(sb(1.6)).mul(0.03));
    })
      .ElseIf(style.lessThan(1.5), () => {
        // wave both arms
        hotL.assign(arm(0.3, sb(1.5).mul(0.4).add(2.45), sb(1.5, 1.0).mul(0.35).add(0.35)));
        hotR.assign(arm(0.3, sb(1.5, 3.1).mul(0.4).add(2.45), sb(1.5, 4.1).mul(0.35).add(0.35)));
      })
      .ElseIf(style.lessThan(2.5), () => {
        // the cowbell, shaken hard over the fence; the other fist pumping
        hotR.assign(arm(1.75, 0.35, sb(5.5).mul(0.5).add(0.55)));
        hotL.assign(arm(0.2, 2.3, sb(2.0).mul(0.6).add(0.7)));
        hop.assign(abs(sb(2.75)).mul(0.025));
      })
      .ElseIf(style.lessThan(3.5), () => {
        // the flag, swept in great arcs over the head
        const sw = sb(0.85).toVar();
        hotR.assign(arm(cos(beat.mul(0.85)).mul(0.35).add(0.25), sw.mul(0.6).add(2.5), 0.15));
        hotL.assign(arm(1.0, 0.3, 1.2));
        roll.assign(sw.mul(0.1));
      })
      .ElseIf(style.lessThan(4.5), () => {
        // jumping on the spot, both fists going
        hop.assign(max(0, sb(1.7)).mul(0.26));
        hotL.assign(arm(0.4, 2.7, sb(3.4).mul(0.6).add(0.5)));
        hotR.assign(arm(0.4, 2.7, sb(3.4, 1.6).mul(0.6).add(0.5)));
      })
      .ElseIf(style.lessThan(5.5), () => {
        // the board, up over the head and bounced
        hotL.assign(arm(2.75, 0.22, sb(2.0).mul(0.15).add(0.45)));
        hotR.assign(hotL);
        hop.assign(abs(sb(2.0)).mul(0.05));
        roll.assign(sb(1.0).mul(0.08));
      })
      .ElseIf(style.lessThan(6.5), () => {
        // the horn to his lips, the other arm waving
        hotR.assign(arm(1.25, 0.12, 2.15));
        hotL.assign(arm(0.3, sb(1.4).mul(0.4).add(2.4), 0.4));
        lean.assign(-0.08);
      })
      .Else(() => {
        // the phone held out at the racer
        hotR.assign(arm(1.5, -0.12, 0.2));
        lean.assign(0.06);
      });
    // THE WAVE, where it is: up on his toes with both arms high; each fan's
    // arms snap across a threshold of his own.
    const upArm = arm(0.2, 2.95, 0.1);
    const th = fract(aAct.y.mul(3.71)).mul(0.35).add(0.3).toVar();
    const armsHot = smoothstep(th.sub(0.06), th.add(0.06), hot).toVar();
    const armsUp = smoothstep(0.3, 0.45, wave).toVar();
    const armL = mix(mix(restL, hotL, armsHot), upArm, armsUp).toVar();
    const armR = mix(mix(restR, hotR, armsHot), upArm, armsUp).toVar();
    hop.assign(
      hop
        .mul(hot)
        .mul(lively)
        .add(wave.mul(0.12))
        .add(arena.mul(0.015).mul(max(0, sin(beat.mul(2))))),
    );
    lean.assign(lean.mul(hot).add(0.03));
    roll.assign(roll.mul(hot).add(sway.mul(float(1).sub(hot))));

    // THE LEGS: the stamp, the weight shifted, tucked a little off the ground.
    const legSwing = stamp
      .mul(0.2)
      .mul(sin(t.mul(9)))
      .mul(float(1).sub(hot))
      .toVar();
    const tuck = smoothstep(0.05, 0.25, hop).mul(0.22).toVar();

    const p = pos.toVar();
    If(bone.lessThan(0.5), () => {
      // the trunk
    })
      .ElseIf(bone.lessThan(2.5), () => {
        const side = select(bone.lessThan(1.5), float(-1), float(1)).toVar();
        const hip = vec3(side.mul(f3(REF.hipX)), f3(REF.hip), 0).toVar();
        p.assign(rx(side.mul(legSwing).add(tuck).negate(), p.sub(hip)).add(hip));
      })
      .ElseIf(bone.lessThan(3.5), () => {
        const neck = vec3(0, f3(REF.neck), 0);
        p.assign(ry(headTurn, rx(nod, p.sub(neck))).add(neck));
      })
      .ElseIf(bone.lessThan(5.5), () => {
        p.assign(poseArm(p, -1, bone.greaterThan(4.5), armL));
      })
      .Else(() => {
        // the flag's cloth flies
        const cloth = aBone.z;
        If(cloth.greaterThan(0), () => {
          const flies = vec3(0, f3(Math.sin(FLAG.slant)), f3(Math.cos(FLAG.slant)));
          const swing = sin(t.mul(11).sub(cloth.mul(6)))
            .mul(0.1)
            .mul(cloth)
            .mul(hot.add(0.35));
          p.addAssign(flies.mul(swing));
        });
        p.assign(poseArm(p, 1, bone.greaterThan(6.5), armR));
      });
    If(bone.lessThan(0.5).or(bone.greaterThan(2.5)), () => {
      const hips = vec3(0, f3(REF.hip), 0);
      p.assign(rz(roll, rx(lean, p.sub(hips))).add(hips));
    });
    // HIS SIZE AND HIS HEADING, and the hop.
    const hs = aLook.x;
    const gs = select(bone.greaterThan(2.5).and(bone.lessThan(3.5)), float(1), aLook.y);
    p.mulAssign(vec3(hs.mul(gs), hs, hs.mul(gs)));
    p.assign(ry(aAct.x.add(bodyTurn), p));
    p.addAssign(vec3(0, hop.mul(hs), 0));
    out.assign(p);
  });
  return out;
}

/** Where each of a stand's fans stands: his instance matrix's translation
 * (see the header). */
function homes(mesh: THREE.InstancedMesh): THREE.InstancedBufferAttribute {
  const n = mesh.instanceMatrix.count;
  const m = mesh.instanceMatrix.array;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) out.set([m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]], i * 3);
  return new THREE.InstancedBufferAttribute(out, 3);
}

/** THE FANS (`fanMaterial`). */
export function fanSpec(m: THREE.Material): FigureSpec {
  const colours = uniformArray(ownValue(m, "uFanPalette").value as THREE.Color[], "color");
  return {
    pose: {
      // The five dealt looks an instance, with three's own and the bones:
      // nine buffers, read as five.
      prepare(g, object) {
        if (!g.hasAttribute("aHome")) g.setAttribute("aHome", homes(object as THREE.InstancedMesh));
        interleave(g, ["aHome", "aLook", "aAct", "aMood", "aDress", "aDress2"]);
      },
      instance(p) {
        const home = packed("aHome", "vec3");
        return fanPose(m, p, home).add(home);
      },
      paint(colour, tint) {
        const aBone = attribute("aBone", "vec4");
        const d = packed("aDress", "vec4");
        const d2 = packed("aDress2", "vec4");
        const c = colour.mul(tint).toVar();
        If(aBone.y.greaterThan(0.5), () => {
          const slots = [d.x, d.y, d.z, d.w, d2.x, d2.y, d2.z, d2.w];
          const k = slots[0].toVar();
          for (let i = 1; i < slots.length; i++) {
            If(aBone.y.greaterThanEqual(i + 0.5), () => {
              k.assign(slots[i]);
            });
          }
          c.assign(colours.element(int(k.add(0.5))).mul(colour));
        });
        return c;
      },
    },
  };
}
