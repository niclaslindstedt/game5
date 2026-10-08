// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE'S NUMBERS AND SHAPES — what `rescue-plan.ts` (where it lands,
// the carry and the loading) and `rescue-scoop.ts` (the casualty scooped
// onto the board) both read: the numbers, the four who carry, the plan and
// the moment they fill in, and the little geometry they share. Three-free.
// The research behind every number is `docs/rescue.md`.

import { HELI, type CrowdBody, type Vec3 } from "@engine";

import type { CrewMove, Hand } from "./rescue-crew.ts";

export const R = HELI.rotor.radius;

/** The rescue's numbers, m, s, m/s. */
export const RESCUE = {
  /** How near the player first comes before it starts, m. */
  reach: 180,
  site: {
    /** The rings searched round him, nearest the middle first, m. */
    radii: [30, 26, 34, 22, 38, 42],
    /** The steepest the skids are set on (a flight manual's 6–10°), as a
     * gradient, and the steepest taken when nothing flatter is clear. */
    slope: 0.15,
    slopeMost: 0.24,
    /** The room the disc keeps from a trunk and a lift's line, m past its
     * radius; the room the carry keeps from a trunk, m. */
    trees: 2.5,
    lift: 22,
    path: 1.6,
    /** The gap kept under the disc's rim, m. */
    rim: 1.4,
  },
  /** THE STRETCHER: a vacuum mattress on a frame, m — its length, its
   * width, and where the bearers' hands hold its rails (across and along
   * from its middle). */
  stretcher: { length: 2.0, width: 0.56, rail: 0.31, along: 0.72 },
  /** The walking pace with a stretcher between four, m/s. */
  walk: 0.8,
  /** THE CABIN DOOR on the side he is loaded through: how far aft of the
   * skid datum's middle its middle is, and how far outboard the skin, m. */
  door: { z: 1.4, skin: HELI.body.width / 2 },
  /** Seconds each part of it takes. */
  time: {
    rise: 2.2,
    raise: 1.0,
    inch: 0.9,
    climb: 1.8,
    slide: 2.8,
    turn: 1.0,
    clear: 11,
    spool: 1.6,
    hover: 4.0,
    away: 40,
  },
  /** THE SCOOP (`rescue-scoop.ts`) — how he is got onto the board: the
   * crew walk up with it from `approach` m off at `pace`; it is laid down
   * `beside` him (its middle off his, m) and he is LOG-ROLLED onto his side
   * toward the two knelt at his other side (`roll`, rad), the board slid
   * under his back, and he is laid back onto it, strapped (`straps`), and
   * the four take their corners. Where the two who roll him kneel (`tend`)
   * and the two who slide the board (`push`): out from his middle and along
   * him, m. His middle on the snow, off the board's last place (`lies`),
   * m; how far past it the board is pushed against his back (`under`) and
   * how far its pushers shuffle forward on their knees doing it
   * (`shuffle`), m. Seconds each part takes. */
  scoop: {
    approach: 7,
    pace: 1.2,
    beside: 0.6,
    under: -0.15,
    shuffle: 0.2,
    lies: -0.12,
    roll: 1.38,
    straps: 3,
    tend: { out: 0.9, along: [0.5, -0.25] },
    push: { out: 0.62, along: [0.6, -0.6] },
    time: {
      down: 1.2,
      turn: 0.8,
      assess: 2.0,
      roll: 1.6,
      slide: 2.0,
      back: 1.6,
      strap: 3.6,
      stand: 1.0,
      step: 1.6,
      kneel: 1.0,
    },
  },
  /** His body on the board: its middle over the board's, up and along, m;
   * half his depth, m. */
  lies: { up: 0.17, along: 0.02, depth: 0.12 },
  /** How far the stretcher's front end is carried short of the skin before
   * it is raised, then over the floor's edge, m. */
  short: 0.42,
  over: 0.06,
  /** The hover, m over the snow, and the climb-out: the acceleration, the
   * cruise and the climb, m/s², m/s, m/s. */
  hover: 4.5,
  accel: 2.4,
  cruise: 38,
  climb: 2.2,
} as const;

/** Who carries, at his corner: across (+ his right) and along (+ ahead)
 * of the stretcher's middle, the hand on its rail, and what he is. */
export type Bearer = {
  role: "doctor" | "paramedic" | "patrol";
  body: CrowdBody;
  across: number;
  along: number;
  hand: Exclude<Hand, null>;
  /** Whether he flies with the casualty. */
  boards: boolean;
};

export const S = RESCUE.stretcher;
export const BEARERS: readonly Bearer[] = [
  { role: "doctor", body: "woman", across: -1, along: 1, hand: "R", boards: true },
  { role: "paramedic", body: "man", across: 1, along: 1, hand: "L", boards: true },
  { role: "patrol", body: "man", across: -1, along: -1, hand: "R", boards: false },
  { role: "patrol", body: "freerider", across: 1, along: -1, hand: "L", boards: false },
];

export type P2 = { x: number; z: number };

export type RescuePlan = {
  /** Where he lay (the stretcher's middle at the start), the snow there. */
  spot: Vec3;
  /** THE MACHINE as it sits: its skid datum, heading, and the attitude the
   * snow under its skids leaves it at; the side its door is on (+1 its
   * right), the heading it leaves on. */
  site: Vec3 & { heading: number; pitch: number; roll: number; side: 1 };
  away: number;
  /** The way out of the door (horizontal), and the floor's height in the
   * door, m. */
  out: P2;
  floor: number;
  /** THE CARRY: the path's points and their arc lengths, m. */
  path: { pts: P2[]; s: number[]; length: number };
  /** Where the stretcher's middle stops: carried (`end`), and in the cabin. */
  end: P2;
  cabin: P2;
  /** The moments each part starts, s from the start. */
  at: {
    /** The scoop's parts: walked up, the board laid down, turned to the
     * work, him straightened, rolled, the board slid, laid back, strapped,
     * stood, stepped to the corners, knelt at them. */
    scoop: {
      down: number;
      turn: number;
      assess: number;
      roll: number;
      slide: number;
      back: number;
      strap: number;
      stand: number;
      step: number;
      kneel: number;
    };
    rise: number;
    carry: number;
    raise: number;
    inch: number;
    climb: number;
    slide: number;
    clear: number;
    lift: number;
    gone: number;
  };
};

export const hy = (x: number, z: number): number => Math.hypot(x, z);
export const fwdOf = (h: number): P2 => ({ x: Math.sin(h), z: Math.cos(h) });
export const rightOf = (h: number): P2 => ({ x: Math.cos(h), z: -Math.sin(h) });
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const ease = (u: number): number => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};
export const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** One bearer at a moment: where he stands, which way he faces, how he
 * is posed and whether he is drawn. */
export type CrewPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  move: CrewMove;
  shown: boolean;
};

/** How many spans of `RAISE` a bearer raises or lowers his corner to hold
 * the stretcher level on a slope: past it (a steep face) it tilts. */
export const LEVEL_MOST = 2;

/** THE MOMENT: the machine, the stretcher (the middle of its rails and its
 * attitude) and the four. */
export type RescueFrame = {
  heli: {
    x: number;
    y: number;
    z: number;
    heading: number;
    pitch: number;
    roll: number;
    /** The rotor's share of its rpm, the thrust as a share of the weight,
     * and whether it is gone from sight. */
    spool: number;
    thrust: number;
    shown: boolean;
  };
  stretcher: {
    x: number;
    y: number;
    z: number;
    heading: number;
    pitch: number;
    roll: number;
    shown: boolean;
    /** How many of its straps are done up. */
    straps: number;
  };
  /** HIM: the middle of his body (half way along him, half way through
   * him), the way his head points, his attitude (rolled onto his left side
   * negative), and how sprawled he still lies (1 as found, 0 straight). */
  casualty: {
    x: number;
    y: number;
    z: number;
    heading: number;
    pitch: number;
    roll: number;
    sprawl: number;
    shown: boolean;
  };
  crew: CrewPose[];
};

export function freshRescueFrame(): RescueFrame {
  const crew = BEARERS.map(() => ({
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    shown: true,
    move: { rise: 0, stride: 0, walking: 0, hand: null, raise: 0 } as CrewMove,
  }));
  return {
    heli: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, spool: 1, thrust: 0.15, shown: true },
    stretcher: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, shown: true, straps: 0 },
    casualty: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, sprawl: 1, shown: true },
    crew,
  };
}
