// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE ON THE SNOW: THE NUMBERS AND SHAPES — what the scene's geometry
// (`police-scene.ts`: the evidence, the cordon, the ways walked) and its
// timeline (`police-plan.ts`: who does what when) both read. Three-free.
// The research behind every number is `docs/police.md`.

import type { CrowdBody, Evidence } from "@engine";

import type { CrewPose } from "./rescue-defs.ts";

/** The scene's numbers, m, s, m/s. */
export const POLICE = {
  /** Walking about the scene in boots, m/s; walking it slowly from the
   * impact to the body, looking (the survey), m/s; and running the tape
   * out stake to stake, m/s. */
  pace: 1.3,
  survey: 0.8,
  tape: 1.1,
  /** THE CORDON: how far past the hull of the evidence it runs, m; the
   * most between two stakes, m, and the least (nearer ones are one stake);
   * a stake's height and the tape's on it, m, and its sag between them as a
   * share of the span (at most `sagMost` m); the time a stake takes to
   * drive in and the time the tape takes to tie off at the last, s. */
  cordon: {
    margin: 4,
    gapMost: 9,
    gapLeast: 2,
    stake: 1.05,
    tape: 0.92,
    sag: 0.012,
    sagMost: 0.12,
    plant: 1.8,
    tie: 2.0,
  },
  /** THE MARKERS: knelt at for `kneel` s (the tent stood at its middle),
   * the officer `off` m from it; a tent's base and its height, m; the body's
   * marker `head` m past his middle, beyond his head. */
  marker: { kneel: 4.5, off: 0.7, base: 0.2, height: 0.17, head: 1.45 },
  /** THE PHOTOGRAPHS: the camera raised (`raise` s), two exposures (at
   * `flashes` s into it), lowered by `hold` s; the overall shots taken
   * `corner` m outside the cordon's box at its four corners, the mid-range
   * `mid` m from a marker stood, the close-up `close` m from it crouched. */
  shot: { raise: 0.6, flashes: [0.9, 1.7] as readonly number[], hold: 2.4 },
  corner: 2.5,
  mid: 3.0,
  close: 1.0,
  /** A flash: how fast it dies away (s, its e-folding) and how long it is
   * drawn at all, s. */
  flash: { decay: 0.05, life: 0.3 },
  /** How long the two stand at the body after the survey, s; how long
   * the photographer waits by the door before boarding, s; how long the
   * four stand gathered before the recovery starts, s. */
  brief: 4,
  board: 0.6,
  gather: 3,
  /** Where the two patrollers come from for the recovery: up the hill from
   * the door, m. */
  patrol: 40,
  /** THE BODY as an obstacle: half his length (his middle to his head or
   * his heels), m, and the room every officer keeps from his line, m (his
   * own half-width and a boot's room). */
  body: { half: 0.95, room: 0.85 },
  /** Evidence nearer the body than `near` m is set `near` m off it; two
   * items nearer each other than `merge` m are one marker; an item more
   * than `far` m from him is left out of the cordon; at most `most`
   * markers. */
  evidence: { near: 1.45, merge: 1.0, far: 80, most: 14 },
  /** The room kept from the machine's cabin past its skin, m, and from its
   * boom's line, m (the boom's taking in the tail rotor). */
  machine: { cabin: 1.0, boom: 1.4 },
} as const;

/** WHO WORKS THE SCENE: the scene lead and the marker officer (who carry
 * the bag out at the end with the two patrollers, as the ambulance's
 * doctor and paramedic do, `BEARERS` 0 and 1), and the photographer. */
export type Officer = { role: "lead" | "marker" | "photo"; body: CrowdBody };
export const OFFICERS: readonly Officer[] = [
  { role: "lead", body: "woman" },
  { role: "marker", body: "man" },
  { role: "photo", body: "man" },
];

/** The photographer's slot in a police frame's crew: after the four
 * bearers (the lead, the marker officer and the two patrollers). */
export const PHOTO = 4;

export type P2 = { x: number; z: number };
export type Path = { pts: P2[]; s: number[]; length: number };

/** ONE STRETCH OF AN OFFICER'S WORK, from `t0` to `t1` (the call's clock):
 * a WALK along a path, or STILL at a place doing one thing — stood,
 * knelt at a marker, bent over a stake, the camera up (stood or crouched),
 * or gone aboard. A still stretch eases from the heading he came in on
 * (`from`) to the one it faces. `walked` is how far he had walked when it
 * began, m (his stride's count). */
export type Act =
  | {
      kind: "walk";
      t0: number;
      t1: number;
      path: Path;
      walked: number;
      /** Stepping down out of the cabin: the floor's height he starts at. */
      fromY?: number;
    }
  | {
      kind: "still";
      t0: number;
      t1: number;
      x: number;
      z: number;
      heading: number;
      from: number;
      walked: number;
      doing: "stand" | "kneel" | "bend" | "shoot" | "shootLow" | "gone";
    };

/** A marker on the snow: its number (from 1), what it marks, where it
 * stands, the way its face looks, and the call's clock it is stood at. */
export type Marker = Evidence & { n: number; facing: number; placed: number };

/** THE SCENE AT A MOMENT, beside the crew (`police-plan.ts`'s
 * `PoliceFrame`): whether the cordon and the markers are up at all, how
 * many stakes are in and which, how far along each span the tape is run (0 … 1),
 * how many markers stand, and the flash — its share of full (0 dark) and
 * where the camera is. */
export type SceneFrame = {
  up: boolean;
  stakes: number;
  planted: boolean[];
  tape: number[];
  markers: number;
  flash: { power: number; x: number; y: number; z: number };
};

export function freshSceneFrame(): SceneFrame {
  return {
    up: false,
    stakes: 0,
    planted: [],
    tape: [],
    markers: 0,
    flash: { power: 0, x: 0, y: 0, z: 0 },
  };
}

/** A pose for a fifth man (the photographer), as `freshRescueFrame`'s. */
export function freshCrewPose(): CrewPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    shown: false,
    move: { rise: 1, stride: 0, walking: 0, hand: null, raise: 0 },
  };
}
