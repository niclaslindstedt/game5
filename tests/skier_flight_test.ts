// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL, AS A PROFESSIONAL RIDES IT (`skier-flight.ts`): a kicker's air
// and a flight low over a pitch ridden compact and secure; a drop and a
// cliff spotted with the hands forward and STILL — never circled, flung or
// swung — and the arms forward and the legs reached long for the snow;
// nothing jumps on the way; and the snow is seen coming off the flight's
// own ballistics.

import { describe, expect, it } from "vitest";

import {
  createFlight,
  flightRead,
  flightShape,
  stepFlight,
  type FlightRead,
} from "../pwa/src/game/skier-flight.ts";
import {
  createSkierSpring,
  skierPose,
  stepSkierSpring,
  type SkierPose,
  type SkierSpring,
} from "../pwa/src/game/skier-pose.ts";

const G = 14.7;
const DT = 1 / 60;
const FLAT = { groundAt: () => 0 };

const base = { hipRight: 0, hipAft: 0, lean: 0, steer: 0, crouch: 0, landing: 5 };

/** A fall off a ledge `height` m over flat snow, its base `height` m up,
 * skied by the view at 60 Hz and on for `after` s on the snow — each
 * frame's spring and pose. The legs' spring is handed no climb: a fall
 * this hard stopped dead in a step is not one the engine lets him ride
 * (`crash.ts`), and the landing's own kick is the legs' case. */
function fall(height: number, after = 0.6, lean = 0) {
  const s = createSkierSpring();
  const frames: { s: SkierSpring; pose: SkierPose; read: FlightRead | null }[] = [];
  const c = { x: 0, y: height + 1, z: 0, vx: 0, vy: 0, vz: 12 };
  let t = 0;
  const land = Math.sqrt((2 * height) / G);
  for (; t < land + after; t += DT) {
    const airborne = t < land;
    const read = airborne ? flightRead(FLAT, c, 1, G) : null;
    stepSkierSpring(s, 0, airborne, DT, 0, { ...RIDE, airTime: t, lean }, false, {
      read,
      gravity: G,
    });
    const pose = skierPose({
      ...base,
      airborne,
      air: s.air,
      flight: flightShape(s.flight, s.air),
      poles: true,
    });
    frames.push({ s: structuredClone(s), pose, read });
    if (airborne) {
      c.vy -= G * DT;
      c.y += c.vy * DT;
      c.z += c.vz * DT;
    } else c.vy = 0;
  }
  return { frames, land: Math.round(land / DT) };
}

const RIDE = { edge: 0, speed: 12, crouch: 0, drive: 0, hipRight: 0, roll: 0 };

describe("the fall", () => {
  it("sees the snow coming off the flight's own ballistics", () => {
    const r = flightRead(FLAT, { x: 0, y: 6, z: 0, vx: 0, vy: 0, vz: 10 }, 1, G);
    expect(r.clearance).toBeCloseTo(5, 6);
    expect(r.ahead).toBeCloseTo(Math.sqrt((2 * 5) / G), 1);
  });

  it("rides a kicker's air compact: no spot, the hands forward", () => {
    const { frames } = fall(1);
    for (const f of frames) expect(f.s.flight.spot).toBeLessThan(0.15);
  });

  it("stays secure on a long flight low over the snow", () => {
    const f = createFlight();
    for (let t = 0; t < 2; t += DT) {
      stepFlight(f, true, { clearance: 0.5, ahead: Number.POSITIVE_INFINITY }, t, DT, G);
    }
    expect(f.t).toBe(0);
    expect(f.spot).toBeLessThan(0.01);
  });

  it("spots a 3 m drop, and reaches for the snow", () => {
    const { frames, land } = fall(3);
    expect(Math.max(...frames.map((f) => f.s.flight.spot))).toBeGreaterThan(0.5);
    expect(frames[land - 1].s.flight.reach).toBeGreaterThan(0.6);
  });

  it("rides a cliff secure: the hands forward, still and alike, and reached for the snow", () => {
    const { frames, land } = fall(18);
    const spotted = frames.slice(Math.round(0.5 / DT), land - Math.round(0.6 / DT));
    expect(spotted.length).toBeGreaterThan(20);
    for (const f of spotted) {
      for (const i of [0, 1]) {
        // Forward of the shoulders and never up over them.
        expect(f.pose.hands[i].z).toBeGreaterThan(f.pose.shoulders[i].z + 0.2);
        expect(f.pose.hands[i].y).toBeLessThan(f.pose.shoulders[i].y);
      }
      // Both arms alike: mirrored across him.
      expect(Math.abs(f.pose.hands[0].x + f.pose.hands[1].x)).toBeLessThan(0.02);
      expect(Math.abs(f.pose.hands[0].y - f.pose.hands[1].y)).toBeLessThan(0.02);
    }
    // Still: the fists hardly move against the shoulders while he spots.
    const rel = (f: (typeof frames)[number], i: number) => ({
      y: f.pose.hands[i].y - f.pose.shoulders[i].y,
      z: f.pose.hands[i].z - f.pose.shoulders[i].z,
    });
    for (const i of [0, 1]) {
      const ys = spotted.map((f) => rel(f, i).y);
      const zs = spotted.map((f) => rel(f, i).z);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.05);
      expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(0.05);
    }
    // At the snow: the arms forward of the shoulders and below them, the
    // legs reached long.
    const last = frames[land - 1];
    expect(last.s.flight.reach).toBeGreaterThan(0.7);
    for (const i of [0, 1]) {
      expect(last.pose.hands[i].z).toBeGreaterThan(last.pose.shoulders[i].z + 0.2);
      expect(last.pose.hands[i].y).toBeLessThan(last.pose.shoulders[i].y);
    }
    const mid = frames[Math.round(0.5 / DT)].pose.hips.y;
    expect(last.pose.hips.y).toBeGreaterThan(mid + 0.08);
  });

  it("sets the arms forward and still for a skier committed to a lean", () => {
    for (const lean of [0.4, -0.4]) {
      const { frames, land } = fall(18, 0.6, lean);
      const late = frames.slice(Math.round(0.8 / DT), land);
      expect(late.every((f) => f.s.flight.commit > 0.9)).toBe(true);
      for (const f of late) {
        for (const i of [0, 1]) {
          expect(f.pose.hands[i].z).toBeGreaterThan(f.pose.shoulders[i].z + 0.2);
        }
      }
    }
  });

  it("moves every joint smoothly through the fall and the landing", () => {
    for (const h of [1, 3, 18]) {
      const { frames } = fall(h);
      const joints = (p: SkierPose) => [
        p.hips,
        p.neck,
        p.head,
        ...p.knees,
        ...p.shoulders,
        ...p.elbows,
        ...p.hands,
      ];
      let worst = 0;
      for (let i = 2; i < frames.length; i++) {
        const [a, b, c] = [frames[i - 2], frames[i - 1], frames[i]].map((f) => joints(f.pose));
        for (let k = 0; k < a.length; k++) {
          const d = Math.hypot(
            c[k].x - 2 * b[k].x + a[k].x,
            c[k].y - 2 * b[k].y + a[k].y,
            c[k].z - 2 * b[k].z + a[k].z,
          );
          worst = Math.max(worst, d);
        }
      }
      expect(worst, `a ${h} m fall`).toBeLessThan(0.03);
    }
  });
});
