// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The modelled racer's cloth: the clock it moves on, how free each point of
// the suit and the bib is, and the bib's swing answering what he does.
import { describe, expect, it } from "vitest";
import { bindPose } from "../pwa/src/game/dress-loft.ts";
import {
  RACER_SWING,
  bibFreedom,
  createSwing,
  racerTime,
  setRacerClock,
  suitFreedom,
} from "../pwa/src/game/racer-wind.ts";

const F = bindPose().frames;
const along = (bone: keyof typeof F, t: number, off = 0) => {
  const f = F[bone];
  return {
    x: f.head.x + f.y.x * f.length * t + f.x.x * off,
    y: f.head.y + f.y.y * f.length * t + f.x.y * off,
    z: f.head.z + f.y.z * f.length * t + f.x.z * off,
  };
};

describe("racer cloth", () => {
  it("moves on the run's clock while one is handed, the wall's after", () => {
    setRacerClock(12.5, 1000);
    expect(racerTime(1200)).toBe(12.5);
    expect(racerTime(2000)).toBe(2);
  });

  it("frees the arms and the crooks more than the shins and nothing above the collar", () => {
    const shin = suitFreedom(along("shin_l", 0.6, 0.05), F);
    const arm = suitFreedom(along("upperarm_l", 0.5, 0.04), F);
    const elbow = suitFreedom(along("upperarm_l", 1, 0.04), F);
    expect(shin).toBeLessThan(0.15);
    expect(arm).toBeGreaterThan(shin * 3);
    expect(elbow).toBeGreaterThanOrEqual(arm * 0.9);
    const crown = along("chest", 1);
    expect(suitFreedom({ ...crown, y: crown.y + 0.1 }, F)).toBe(0);
    for (const b of Object.keys(F) as (keyof typeof F)[]) {
      const v = suitFreedom(along(b, 0.5, 0.05), F);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("pins the bib at the shoulders and frees its hem", () => {
    const top = along("chest", 0.9, 0);
    const hem = { ...along("pelvis", 0, 0), x: 0.15 };
    expect(bibFreedom(top, F.chest, F.pelvis)).toBeLessThan(0.05);
    expect(bibFreedom(hem, F.chest, F.pelvis)).toBeGreaterThan(0.6);
  });

  it("swings the bib against a landing's slap, holds still at rest and stays in bounds", () => {
    const rest = { x: 0, y: RACER_SWING.g, z: 0 };
    const s = createSwing();
    for (let i = 0; i < 120; i++) s.step(rest, rest, 1 / 60);
    expect(Math.hypot(s.at.x, s.at.y, s.at.z)).toBe(0);
    // A landing: four g up through him for a tenth of a second — the cloth
    // keeps on down, then rings out.
    s.step({ x: 0, y: 4 * RACER_SWING.g, z: 0 }, rest, 0.1);
    expect(s.at.y).toBeLessThan(-0.005);
    let most = 0;
    for (let i = 0; i < 300; i++) {
      s.step(rest, rest, 1 / 60);
      most = Math.max(most, Math.hypot(s.at.x, s.at.y, s.at.z));
    }
    expect(most).toBeLessThanOrEqual(RACER_SWING.most + 1e-9);
    expect(Math.hypot(s.at.x, s.at.y, s.at.z)).toBeLessThan(0.002);
    // A turn swings it out to the side, away from the turn's pull.
    s.settle();
    for (let i = 0; i < 12; i++) s.step({ x: 8, y: RACER_SWING.g, z: 0 }, rest, 1 / 60);
    expect(s.at.x).toBeLessThan(0);
  });
});
