// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL, AS A PROFESSIONAL RIDES IT (`skier-flight.ts`): a kicker's air
// and a flight low over a pitch ridden compact and secure; a drop spotted;
// a cliff windmilled — the fists circled in front of him, forward over the
// top, measured, never flung, the poles trailing back — and
// wound home before the snow, the arms forward and the legs reached long
// for it; nothing jumps on the way; and the snow is seen coming off the
// flight's own ballistics.

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
function fall(height: number, after = 0.6, spin = 0, lean = 0) {
  const s = createSkierSpring();
  const frames: { s: SkierSpring; pose: SkierPose; read: FlightRead | null }[] = [];
  const c = { x: 0, y: height + 1, z: 0, vx: 0, vy: 0, vz: 12 };
  let t = 0;
  const land = Math.sqrt((2 * height) / G);
  for (; t < land + after; t += DT) {
    const airborne = t < land;
    const read = airborne ? flightRead(FLAT, c, 1, G) : null;
    stepSkierSpring(s, 0, airborne, DT, 0, { ...RIDE, airTime: t, wx: spin, lean }, false, {
      read,
      gravity: G,
    });
    const pose = skierPose({
      ...base,
      airborne,
      air: s.air,
      flight: flightShape(s.flight, s.clock, s.air),
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

  it("rides a kicker's air compact: no spot, no windmill, the hands forward", () => {
    const { frames } = fall(1);
    for (const f of frames) {
      expect(f.s.flight.spot).toBeLessThan(0.15);
      expect(f.s.flight.mill).toBe(0);
    }
  });

  it("stays secure on a long flight low over the snow", () => {
    const f = createFlight();
    for (let t = 0; t < 2; t += DT) {
      stepFlight(f, true, { clearance: 0.5, ahead: Number.POSITIVE_INFINITY }, t, 0, DT, G);
    }
    expect(f.t).toBe(0);
    expect(f.spot).toBeLessThan(0.01);
    expect(f.mill).toBeLessThan(0.01);
  });

  it("spots a 3 m drop without windmilling, and reaches for the snow", () => {
    const { frames, land } = fall(3);
    expect(Math.max(...frames.map((f) => f.s.flight.spot))).toBeGreaterThan(0.5);
    expect(Math.max(...frames.map((f) => f.s.flight.mill))).toBeLessThan(0.1);
    expect(frames[land - 1].s.flight.reach).toBeGreaterThan(0.6);
  });

  it("windmills a cliff forward over the top and winds it home before the snow", () => {
    const { frames, land } = fall(18);
    const flight = frames.slice(0, land);
    expect(Math.max(...flight.map((f) => f.s.flight.mill))).toBeGreaterThan(0.7);
    // Forward over the top: the circle's phase (the arms' turning angle)
    // turns DOWN through most of a circle at least, at a measured pace.
    const turned = flight[0].s.flight.arm - Math.min(...flight.map((f) => f.s.flight.arm));
    expect(turned).toBeGreaterThan(1.5 * Math.PI);
    const fastest = Math.max(...flight.map((f) => Math.abs(f.s.flight.armRate)));
    expect(fastest).toBeLessThan(2 * Math.PI * 1.3);
    // At the snow: the windmill done, the arms forward of the shoulders and
    // below them, the legs reached long.
    const last = frames[land - 1];
    expect(last.s.flight.mill).toBeLessThan(0.25);
    expect(last.s.flight.reach).toBeGreaterThan(0.7);
    for (const i of [0, 1]) {
      expect(last.pose.hands[i].z).toBeGreaterThan(last.pose.shoulders[i].z + 0.2);
      expect(last.pose.hands[i].y).toBeLessThan(last.pose.shoulders[i].y);
    }
    const spotted = frames[Math.round(0.5 / DT)].pose.hips.y;
    expect(last.pose.hips.y).toBeGreaterThan(spotted + 0.08);
  });

  it("never windmills a body he is turning on purpose", () => {
    const { frames } = fall(18, 0.6, 4);
    expect(Math.max(...frames.map((f) => f.s.flight.mill))).toBeLessThan(0.01);
  });

  it("never windmills a skier committed to a lean: the arms set forward and still", () => {
    for (const lean of [0.4, -0.4]) {
      const { frames, land } = fall(18, 0.6, 0, lean);
      const flight = frames.slice(0, land);
      expect(Math.max(...flight.map((f) => f.s.flight.mill))).toBeLessThan(0.01);
      const late = flight.slice(Math.round(0.8 / DT));
      const arms = late.map((f) => f.s.flight.arm);
      expect(Math.max(...arms) - Math.min(...arms)).toBeLessThan(0.4);
      for (const f of late) {
        for (const i of [0, 1]) {
          expect(f.pose.hands[i].z).toBeGreaterThan(f.pose.shoulders[i].z + 0.2);
        }
      }
    }
  });

  it("circles the fists in front of him and holds each pole back and out through the windmill", () => {
    const { frames, land } = fall(18);
    let worst = 0;
    let wide = Infinity;
    let ahead = -Infinity;
    let behind = Infinity;
    for (let i = 1; i < land; i++) {
      for (const k of [0, 1]) {
        const dir = (f: (typeof frames)[number]) => {
          const h = f.pose.hands[k];
          const t = f.pose.poles![k];
          const d = Math.hypot(t.x - h.x, t.y - h.y, t.z - h.z);
          return { x: (t.x - h.x) / d, y: (t.y - h.y) / d, z: (t.z - h.z) / d };
        };
        const [a, b] = [dir(frames[i - 1]), dir(frames[i])];
        const turn = Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
        worst = Math.max(worst, turn);
        if (frames[i].s.flight.mill > 0.5) {
          wide = Math.min(wide, (k ? 1 : -1) * b.x);
          ahead = Math.max(ahead, b.z);
          const p = frames[i].pose;
          behind = Math.min(behind, p.hands[k].z - p.shoulders[k].z);
        }
      }
    }
    // Never a flip; always turned out from his body, clear of his skis, and
    // trailing back — a hand cannot aim a pole further back than square to
    // its forearm, so the fists stay ahead of the shoulders.
    expect(worst).toBeLessThan(0.16);
    expect(wide).toBeGreaterThan(0.2);
    expect(ahead).toBeLessThan(0);
    expect(behind).toBeGreaterThan(0.2);
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
