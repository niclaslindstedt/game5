// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE IN THE RENDERER — the one hand the renderer holds it by:
// the machine (`sled-view.ts`), the skier stood on its boards as his figure
// is posed (`skier-sled.ts`), THE TRACKS it leaves — the belt's wide,
// paddled trench and the two skis' grooves either side of it, stamped
// into the trail map the skiers' furrows are (`trail-stamp.ts`), so a
// climb up a powder face stays written on it — and THE ROOST: a mountain
// sled's paddles throwing the powder they cannot bite back off the belt's
// end, high and long behind it when the belt spins, the heavy clumps into
// the spray and the fine snow into the snow cloud, where it hangs and
// drifts; with the skis' powder off their tips, the bow wave off a nose
// buried in deep snow, and the burst of a landing. Built per map with the
// rest of the world, on a free ride only.

import * as THREE from "three";
import { SLED, type GameState, type SledState } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import { createSledView, type SledView } from "./sled-view.ts";
import { SLED_LOOK, sledFrame } from "./sled-look.ts";
import type { SledStand } from "./skis-body.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { SnowProps } from "./snowpack.ts";
import type { Spray } from "./spray.ts";
import { TRAIL, type SnowSampler, type Stamp } from "./trail-stamp.ts";

export type SledScene = {
  group: THREE.Group;
  /** One frame: the machine drawn, the roost thrown, the tracks stamped
   * into `stamps` (when the trails are drawn), for the run at `state`. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    simDt: number,
    player: { x: number; z: number },
    effects: {
      spray: Spray | null;
      cloud: SnowCloud | null;
      snowAt: SnowSampler;
      stamps: Stamp[] | null;
    },
  ): void;
  /** The skier stood on the boards (`SkisModel.setSled`), or null off it. */
  stand(state: GameState): SledStand | null;
  /** Dress the racked pair in the rider's topsheet colours. */
  dressRack(body: number, trim: number): void;
  dispose(): void;
};

/** THE ROOST, per second: the most puffs a belt spinning flat out in deep
 * powder throws, and how much the belt's slip over the snow it needs for
 * all of it, m/s. */
const ROOST_RATE = 90;
const ROOST_SLIP = 10;
/** THE SKIS' POWDER and THE BOW WAVE, per second at full. */
const SKI_RATE = 50;
const BOW_RATE = 60;
/** The trench a belt drawn on powder at the least, m — its own sink is the
 * physics'; this is what its paddles chew out round it. */
const TRENCH = 0.22;
/** The belt's two edge probes at each station: their stamped half width. */
const BELT_HALF = SLED.treadWidth / 2;

/** Body-frame points off the trace: the belt's end (the rear idler on the
 * snow) and the drive. */
const IDLER = sledFrame(SLED_LOOK.idler.at);
const SPIN = 2.2;

export function createSledScene(haze: HazeUniforms): SledScene {
  const view: SledView = createSledView(haze);
  const group = new THREE.Group();
  group.name = "snowmobile-scene";
  group.add(view.group);
  // The pens: where each stamp line last was — the belt's centre line and
  // each ski's — so the tracks run continuous from frame to frame.
  const pens = [
    { x: 0, z: 0, down: false },
    { x: 0, z: 0, down: false },
    { x: 0, z: 0, down: false },
  ];
  const owed = { roost: 0, ski: 0, bow: 0 };
  let seed = 0x51ed;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let wasAir = false;
  let airTime = 0;
  let lastVy = 0;

  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const world = (s: SledState, x: number, y: number, z: number): THREE.Vector3 =>
    v
      .set(x, y, z)
      .applyQuaternion(q.set(s.q.x, s.q.y, s.q.z, s.q.w))
      .add(new THREE.Vector3(s.x, s.y, s.z));

  /** One stamp line from where its pen was to (x, z). */
  const line = (
    i: number,
    x: number,
    z: number,
    half: number,
    depth: number,
    snow: SnowProps,
    out: Stamp[],
  ): void => {
    const pen = pens[i];
    const ax = pen.down ? pen.x : x;
    const az = pen.down ? pen.z : z;
    pen.x = x;
    pen.z = z;
    pen.down = true;
    if (Math.hypot(x - ax, z - az) > TRAIL.jump) return;
    const d = Math.min(TRAIL.maxDepth, depth);
    out.push({
      ax,
      az,
      bx: x,
      bz: z,
      half,
      depth: d,
      berm: Math.min(TRAIL.maxBerm, d * snow.berm * 1.4),
      wall: snow.wall,
    });
  };

  return {
    group,
    frame(state, alpha, dt, simDt, player, fx) {
      const s = state.sled;
      if (!s) return;
      view.update(state, alpha, dt, player);
      if (simDt <= 0) return;
      const level = state.level;
      // ── THE TRACKS ────────────────────────────────────────────────────
      if (fx.stamps) {
        // The belt: one wide line down its centre where any of its probes
        // bears, as deep as the deepest of them sinks, or its paddles chew.
        let bearing = false;
        let sink = 0;
        let cx = 0;
        let cz = 0;
        let n = 0;
        for (const c of s.contacts) {
          if (c.kind !== "tread" || !c.touching) continue;
          bearing = true;
          sink = Math.max(sink, c.sink);
          if (c.station === "rear") {
            cx += c.x;
            cz += c.z;
            n++;
          }
        }
        if (bearing && n > 0) {
          const snow = fx.snowAt(cx / n, cz / n);
          const chewed = TRENCH * snow.give + Math.min(1, s.slip / ROOST_SLIP) * 0.08 * snow.loose;
          line(
            0,
            cx / n,
            cz / n,
            BELT_HALF,
            Math.max(sink, chewed, TRAIL.packedDepth),
            snow,
            fx.stamps,
          );
        } else pens[0].down = false;
        // The skis: each its own groove.
        let k = 1;
        for (const c of s.contacts) {
          if (c.kind !== "ski") continue;
          if (!c.touching) pens[k].down = false;
          else {
            const snow = fx.snowAt(c.x, c.z);
            const drawn = Math.max(c.sink, TRAIL.powderSki * snow.give, TRAIL.packedDepth);
            line(k, c.x, c.z, SLED.skiWidth / 2, drawn, snow, fx.stamps);
          }
          k++;
        }
      }
      // ── THE ROOST off the paddles ─────────────────────────────────────
      const bears = s.contacts.some((c) => c.kind === "tread" && c.touching);
      const end = world(s, 0, IDLER[1] + 0.05, IDLER[0] - 0.1);
      const ex = end.x;
      const ey = end.y;
      const ez = end.z;
      const back = new THREE.Vector3(0, 0, -1).applyQuaternion(q.set(s.q.x, s.q.y, s.q.z, s.q.w));
      const snow = fx.snowAt(ex, ez);
      const loose = Math.min(1, snow.loose * 4) * (1 - s.packed * 0.85);
      // The belt over the snow: its spin, and the drive's work at speed.
      const spin = Math.min(1, Math.max(0, s.slip) / ROOST_SLIP);
      const work = s.controls.throttle * Math.min(1, s.speed / 8);
      const roost = bears ? (0.25 * work + spin) * loose : 0;
      owed.roost += ROOST_RATE * roost * simDt;
      const belt = Math.max(s.treadSpeed, s.way);
      while (owed.roost >= 1) {
        owed.roost -= 1;
        // Thrown back off the paddles at a share of the belt's speed over
        // the snow, and UP, a fan spread across its width.
        const thrown = 3 + (belt - s.way) * 0.45 + random() * 4;
        const up = 2.5 + random() * (3 + SPIN * spin * 3);
        const side = (random() - 0.5) * 2.4;
        const vx = s.vx * 0.55 + back.x * thrown + back.z * side;
        const vy = up + Math.max(0, s.vy) * 0.3;
        const vz = s.vz * 0.55 + back.z * thrown - back.x * side;
        const px = ex + (random() - 0.5) * 0.35;
        const pz = ez + (random() - 0.5) * 0.35;
        if (random() < 0.55) {
          fx.spray?.fling(
            px,
            ey,
            pz,
            vx,
            vy,
            vz,
            0.6 + random() * 0.7,
            (0.1 + random() * 0.16) * (1 + snow.clumps),
            snow.clumps * random(),
          );
        } else {
          fx.cloud?.blow(px, ey + 0.2, pz, vx * 0.8, vy * 0.6, vz * 0.8, 0.35 + random() * 0.5);
        }
      }
      // ── THE SKIS' POWDER and THE BOW WAVE ─────────────────────────────
      const skiDeep = Math.max(
        ...s.contacts.filter((c) => c.kind === "ski" && c.touching).map((c) => c.sink),
        0,
      );
      owed.ski +=
        SKI_RATE * Math.min(1, skiDeep / 0.15) * Math.min(1, s.speed / 10) * loose * simDt;
      while (owed.ski >= 1) {
        owed.ski -= 1;
        const c = s.contacts[random() < 0.5 ? 0 : 1];
        const kick = 2 + random() * 3;
        fx.spray?.fling(
          c.x,
          c.y + 0.1,
          c.z,
          s.vx * 0.6 + (random() - 0.5) * 2,
          kick,
          s.vz * 0.6 + (random() - 0.5) * 2,
          0.5 + random() * 0.4,
          0.1 + random() * 0.12,
          snow.clumps * random(),
        );
      }
      // The nose ploughing deep snow: a wave off the cowl's belly.
      const front = s.contacts.filter((c) => c.kind === "tread" && c.station === "front");
      const nose = front.reduce((a, c) => Math.max(a, c.touching ? c.sink : 0), 0);
      owed.bow += BOW_RATE * Math.min(1, nose / 0.25) * Math.min(1, s.speed / 6) * loose * simDt;
      while (owed.bow >= 1) {
        owed.bow -= 1;
        const at = world(s, (random() - 0.5) * 0.7, -0.3, 1.5);
        fx.cloud?.blow(
          at.x,
          at.y,
          at.z,
          s.vx * 0.7 + (random() - 0.5) * 3,
          1 + random() * 2.5,
          s.vz * 0.7 + (random() - 0.5) * 3,
          0.4 + random() * 0.4,
        );
      }
      // ── THE LANDING ───────────────────────────────────────────────────
      if (wasAir && !s.airborne && airTime > 0.25) {
        const hit = Math.abs(lastVy) + airTime * 2;
        const at = level.groundAt(s.x, s.z);
        const size = Math.min(1.6, 0.4 + hit * 0.12);
        fx.cloud?.burst(s.x, at + 0.3, s.z, s.vx, s.vz, size, snow);
        fx.spray?.burst(s.x, at + 0.2, s.z, s.vx, s.vz, size, snow);
      }
      if (s.airborne) {
        airTime = s.airTime;
        lastVy = s.vy;
      } else if (!wasAir) airTime = 0;
      wasAir = s.airborne;
    },
    stand(state) {
      const s = state.sled;
      if (!s?.rider || state.skier.thrown) return null;
      const c = state.skier;
      // His origin in the sled's frame (`riderFrame`): his boots stand on
      // the boards' middle and his weight where he has moved it.
      const ox = s.riderRight * 0.5;
      const oy = SLED.boards.y + c.spec.cogHeight;
      const oz = SLED.boards.z - s.riderAft * 0.5;
      // The grips turned with the bars about the post.
      const post = sledFrame(SLED_LOOK.post);
      const a = s.skiAngle * 0.8;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const grip = (side: number) => {
        const gx = side * SLED.grips.x;
        const gz = SLED.grips.z - post[0];
        return {
          x: gx * ca + gz * sa - ox,
          y: SLED.grips.y - oy,
          z: post[0] + gz * ca - gx * sa - oz,
        };
      };
      const half = c.spec.stance / 2;
      return {
        out: [-(SLED.boards.x - half) - ox, SLED.boards.x - half - ox],
        fore: s.riderAft * 0.5,
        board: {
          grips: [grip(-1), grip(1)],
          lean: 0.42 - 0.3 * s.controls.lean + 0.15 * s.controls.throttle,
        },
      };
    },
    dressRack(body, trim) {
      view.dressRack(body, trim);
    },
    dispose() {
      view.dispose();
    },
  };
}
