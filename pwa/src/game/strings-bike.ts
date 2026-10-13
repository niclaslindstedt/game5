// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS A BIKE PARK'S TRAILS ARE NAMED FROM (§39.1) — the names burned on
// the signs at the trail heads (`bike-sign-plan.ts`). A park names a trail
// for what it rides like, the way a ski area names a run for what it is:
// a green's a gentle word, a blue's the flow and the berms, a red's the
// roots and the rocks of the woods it drops through, a black's fearsome;
// the race line is the DOWNHILL. Dealt off a hash of the map's seed and
// the trail's id, never the stream.

import type { TrailGrade } from "@engine";

export const BIKE_TRAIL_NAMES: Readonly<Record<TrailGrade, readonly string[]>> = {
  green: ["EASY FLOW", "MEADOW LINE", "FIRST TURNS", "LAZY BERMS", "VALLEY WAY", "SUNNY SIDE"],
  blue: ["BERM BURNER", "ROLLER LINE", "FLOW STATE", "TABLE SERVICE", "SWOOP", "CORKSCREW"],
  red: ["ROOT CELLAR", "ROCK HOP", "FOREST FLOOR", "LOAM RANGER", "SIDEWINDER", "ANKLE BITER"],
  black: ["NO BRAKES", "THE CHUTE", "GRAVITY", "STEEP SIDE", "WIDOW MAKER", "LAST RITES"],
};

/** The race line's name on its start sign. */
export const BIKE_RACE_NAME = "DOWNHILL";
