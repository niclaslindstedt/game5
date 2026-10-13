// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK'S SHAPE (R44, R45) — what `setBikePark` lays over a built
// map and every reader (the surface, the summer ground, the analyzer, the
// lab, the renderer and the bike) asks of it.

import type { TrailGrade } from "./bike-park-rules.ts";
import type { Level } from "./types.ts";

export type { TrailGrade };

/** What a feature on a trail is (R44). */
export type BikeFeatureKind =
  /** A turn banked up on its outside. */
  | "berm"
  /** A smooth hump across the tread, ridden without leaving it. */
  | "roller"
  /** A grade reversal dug across the tread (a red's water bar). */
  | "dip"
  /** A take-off, a flat deck and a landing: ridden over or jumped. */
  | "table"
  /** A take-off and a landing with the ground open between. */
  | "gap"
  /** A ledge: the tread falls away under its edge. */
  | "drop"
  /** A kicked lip onto a landing a step below it. */
  | "stepdown"
  /** Rocks set in the tread. */
  | "rocks"
  /** Roots across the tread. */
  | "roots";

/** A rock or a root in a garden, in the trail's frame: `u` m down the
 * trail from the feature's start, `a` m right of the centre line, `r` m
 * its radius (a root's half-thickness), `h` m tall, `ang` a root's angle
 * off square across the tread, rad, and `len` its length, m. */
export type BikePiece = { u: number; a: number; r: number; h: number; ang?: number; len?: number };

/** A FEATURE on a trail, from arc `from` to arc `to` (m along its trail).
 * `height` is its size: a berm's height at its outer edge, a roller's, a
 * dip's depth, a table's or a gap's lip over the bench, a drop's or a
 * step-down's fall, a garden's tallest rock or root. */
export interface BikeFeature {
  /** Its label on the lab's plan: the trail's id, a letter, a number. */
  id: string;
  kind: BikeFeatureKind;
  from: number;
  to: number;
  height: number;
  /** A table's, a gap's or a step-down's take-off angle, a berm's bank
   * where it is ridden, degrees. */
  angle?: number;
  /** A landing's angle, degrees. */
  land?: number;
  /** The LIP's arc (a table, a gap, a step-down, a drop's edge). */
  lip?: number;
  /** A table's deck, a gap's open length, m. */
  length?: number;
  /** The KNUCKLE's arc: where a table's deck or a gap's open ground meets
   * the landing; past it the landing falls to the bench. */
  knuckle?: number;
  /** A berm: +1 when the turn bends right (its bank on the left), -1 left. */
  side?: 1 | -1;
  /** A berm's radius, m. */
  radius?: number;
  /** A garden's rocks or roots. */
  pieces?: BikePiece[];
}

/** A station on a trail's line: where it is, the BENCH's height (the
 * tread's centre before any feature), `s` its arc from the head, the way
 * it runs (heading 0 = +z, clockwise), the tread's width, and which way
 * the hillside falls across it (+1 the right of the way it runs is
 * downhill, -1 the left). */
export interface BikeTrailPoint {
  x: number;
  z: number;
  y: number;
  s: number;
  heading: number;
  width: number;
  downhill: 1 | -1;
  /** The natural ground under the centre line, m: the bench's cut (above)
   * or fill (below) is `y` against it. */
  ground: number;
}

/** A TRAIL of the park (R44) or its RACE LINE (R45). */
export interface BikeTrail {
  /** "B1"…, or "DH" for the race line. */
  id: string;
  grade: TrailGrade;
  /** A park trail, or the race line. */
  kind: "trail" | "race";
  /** What its tread is: a flow trail's machine-built pale gravel, or a
   * technical trail's (and the race line's) natural dirt. */
  tread: "gravel" | "dirt";
  /** The lift whose top it leaves. */
  lift: string;
  points: BikeTrailPoint[];
  length: number;
  /** Its bench's fall from head to end, m. */
  vertical: number;
  features: BikeFeature[];
  /** The lift whose bottom station it ends beside. */
  end: string;
  /** The race line's start, m along it (0 for a trail). */
  start: number;
}

/** A TRAIL HEAD: where a trail leaves its apron, the way it leaves, and
 * the sign that stands beside it. */
export interface BikeTrailHead {
  trail: string;
  grade: TrailGrade;
  x: number;
  z: number;
  y: number;
  heading: number;
  /** The sign's post, m: beside the head on the apron's side. */
  sign: { x: number; z: number };
}

/** A lift's STAGING APRON in summer (R44): its top's pad, and its heads. */
export interface BikeApron {
  lift: string;
  x: number;
  z: number;
  y: number;
  radius: number;
  heads: BikeTrailHead[];
}

/** Where two trails cross or meet: a junction a rider may switch at. */
export interface BikeJunction {
  x: number;
  z: number;
  /** The two trails, and each one's arc there. */
  a: { trail: string; s: number };
  b: { trail: string; s: number };
}

/** THE BIKE PARK a summer map carries (`setBikePark`). */
export interface BikePark {
  /** The map it was laid on: what the cabins and anything else that must
   * not move with it are read off. */
  base: Level;
  trails: BikeTrail[];
  aprons: BikeApron[];
  junctions: BikeJunction[];
  /** The race line's id, when the park has one. */
  race: string | null;
}

/** Where a point is on a trail (`bikeTrailAt`): the trail, the arc, the
 * signed offset right of the centre line, the tread's half-width there,
 * and how much of the trail's surface it stands on (1 on the tread, 0 at
 * the shoulder's outer edge). */
export interface BikeTrailHit {
  trail: BikeTrail;
  index: number;
  s: number;
  lateral: number;
  half: number;
  weight: number;
}
