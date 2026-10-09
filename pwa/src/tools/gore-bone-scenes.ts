// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE LAB'S BONES SHEET (`gore-scenes.ts`): the long bones broken
// through and out of the skin (`gore-bones.ts`), looked at close on the
// skier — lying on the snow with his arms broken, skiing on with them
// hanging from their breaks (`skier-broken.ts`) and lying with his legs
// broken out, at the three grades (a simple break, a wedge, shattered —
// `FRACTURE_GRADE`). The bones themselves, close at every grade, are
// `make bones`'.

import { NEUTRAL_INPUT, botInput, centreOf, placeRun, type GameState, type Injury } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { flatSpot, ontoSnow, type Drive, type Lens, type Stage } from "./gore-scenes.ts";

const still: Drive = () => NEUTRAL_INPUT;
const bot: Drive = (s) => botInput(s);

/** The energies over each break's even chance a grade is dealt at
 * (`injury.comminute`: a wedge from 1.6, shattered from 2.3). */
const ENERGY = { simple: 1.2, wedge: 1.9, shatter: 2.8 } as const;
type Grade = keyof typeof ENERGY;

/** A skier stood still on the snow with `breaks` on his body. */
function standing(st: Stage, breaks: Injury[]): GameState {
  const s = st.fresh();
  const p = flatSpot(st.level);
  placeRun(s, { x: p.x, z: p.z, heading: p.heading, speed: 0 });
  for (const b of breaks) s.skier.body.injuries.push(b);
  return s;
}

const arm = (
  side: "L" | "R",
  kind: "brokenArm" | "brokenForearm" | "brokenWrist",
  g: Grade,
): Injury => ({
  part: `${kind === "brokenWrist" ? "hand" : "arm"}${side}`,
  kind,
  ais: 2,
  t: 0,
  energy: ENERGY[g],
});

/** A lens on him `dist` m out at `yaw` off his heading (0 ahead of him, a
 * quarter turn his left), `up` m over a point `high` m over his feet and
 * `aside` m to his right. */
function onSkier(yaw: number, dist: number, up: number, high: number, aside = 0, fov = 30): Lens {
  return (s: GameState): LensPose => {
    const h = s.skier.heading;
    const rx = Math.cos(h);
    const rz = -Math.sin(h);
    const b = s.skier.thrown;
    const c = b ? centreOf(b.points) : { x: s.skier.x, y: s.skier.y, z: s.skier.z };
    const at = { x: c.x + rx * aside, y: c.y + high, z: c.z + rz * aside };
    const a = h + yaw;
    return {
      eye: { x: at.x + Math.sin(a) * dist, y: at.y + up, z: at.z + Math.cos(a) * dist },
      target: at,
      fov,
      roll: 0,
    };
  };
}

/** Laid on his back on the snow, a little hard, with `breaks` on him. */
function lying(st: Stage, breaks: Injury[]): GameState {
  const { s } = ontoSnow(st, "back", 4);
  for (const b of breaks) s.skier.body.injuries.push(b);
  st.run(s, 2.5, still);
  return s;
}

/** Round the body lying, close, from six sides and from above. */
function around6(st: Stage, s: GameState): void {
  for (let i = 0; i < 6; i++)
    st.shoot(s, `${i * 60}deg`, onSkier((i / 6) * Math.PI * 2, 1.1, 0.6, 0, 0, 40));
  st.shoot(s, "above", onSkier(0.3, 0.4, 1.8, 0, 0, 45));
}

/** Skiing on behind the bot, the lens close beside and behind him. */
function skiing(st: Stage, breaks: Injury[]): void {
  const s = standing(st, breaks);
  st.run(s, 4, bot);
  st.shoot(s, "chase", "chase");
  st.shoot(s, "behind", onSkier(Math.PI, 1.8, 0.4, 0.2, 0, 35));
  st.shoot(s, "left", onSkier(-1.7, 0.8, 0.15, 0.15, -0.15, 35));
  st.shoot(s, "right", onSkier(1.7, 0.8, 0.0, 0.0, 0.15, 35));
  st.shoot(s, "left-back", onSkier(-2.4, 0.8, 0.3, 0.15, -0.15, 35));
  st.shoot(s, "right-back", onSkier(2.4, 0.8, 0.1, 0.0, 0.15, 35));
}

/** A femur broken out in a wedge and a tibia simply. */
const LEGS: Injury[] = [
  { part: "thighL", kind: "brokenFemur", ais: 3, t: 0, energy: ENERGY.wedge },
  { part: "shinR", kind: "brokenShin", ais: 2, t: 0, energy: ENERGY.simple },
];

export const BONE_VIEWS: Record<string, (st: Stage) => void> = {
  /** Lying with the left upper arm and the right forearm broken out. */
  "open-arms"(st) {
    around6(st, lying(st, [arm("L", "brokenArm", "simple"), arm("R", "brokenForearm", "wedge")]));
  },
  /** Skiing on with the left upper arm broken out, then the right forearm. */
  "open-arms-ski"(st) {
    skiing(st, [arm("L", "brokenArm", "wedge"), arm("R", "brokenForearm", "simple")]);
  },
  /** Skiing on with both wrists broken out. */
  "open-wrists-ski"(st) {
    skiing(st, [arm("L", "brokenWrist", "simple"), arm("R", "brokenWrist", "shatter")]);
  },
  /** Skiing on with the legs broken out (a femur and a tibia): he goes down
   * on them at once and lies where he fell. */
  "open-legs-ski"(st) {
    skiing(st, LEGS);
  },
  /** Lying with the legs broken out: a femur and a tibia. */
  "open-legs"(st) {
    around6(st, lying(st, LEGS));
  },
};

export const BONE_GROUPS: Record<string, readonly string[]> = {
  bones: ["open-arms", "open-arms-ski", "open-wrists-ski", "open-legs-ski", "open-legs"],
};
