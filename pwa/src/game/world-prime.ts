// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD'S PLANS AND FIGURES, WORKED OUT A PIECE AT A TIME ahead of the
// builders that ask for them. Every one is kept once worked out (a plan per
// map, a figure per page), so the builder that follows finds it done — and
// the world's renderer (`renderer.ts`'s `load`) takes a breath between any
// two of them. Built behind the free ride's rider and gear cards
// (`free-stage.ts`), a builder that did all of it in one go held the
// page's thread for seconds on a phone and froze the cards over it.

import {
  CROWD_BODIES,
  firesOf,
  trafficOf,
  type CrowdBody,
  type Level,
  type RunRules,
} from "@engine";

import { beastPlanFor } from "./beast-plan.ts";
import { createCabins } from "./cabins-view.ts";
import type { HazeUniforms } from "./haze.ts";
import type { LiftParts } from "./lifts.ts";
import { createVillageBuildings } from "./village-cuts.ts";
import { createWindTunnels } from "./wind-tunnels.ts";
import { birdPlanFor } from "./bird-plan.ts";
import { civilianPlanFor, hasCivilians } from "./civilian-plan.ts";
import { buildCivilianFigure } from "./civilian-shapes.ts";
import { buildCrowdFigure, CROWD_LODS } from "./crowd-shapes.ts";
import { dogPlanFor } from "./dog-walk.ts";
import { signPlan } from "./run-sign-plan.ts";

/** A piece of work, kept by what it builds once it has run. */
export type Prime = () => void;

/** Run `pieces`, `rest` before the first and after each; false (the rest of them left) once a
 * rest says the build it is part of has been superseded. */
export async function primed(pieces: Prime[], rest: () => Promise<boolean>): Promise<boolean> {
  if (!(await rest())) return false; // a breath after what came before, too
  for (const piece of pieces) {
    piece();
    if (!(await rest())) return false;
  }
  return true;
}

/** THE LIFTS' HEAVIEST PIECES (`createLifts`' `made`) — the wind tunnels,
 * the cabins and the village — each built in a moment of its own, `rest`
 * after each; null (and what was built let go) once superseded. */
export async function liftParts(
  level: Level,
  haze: HazeUniforms,
  share: number,
  rest: () => Promise<boolean>,
): Promise<LiftParts | null> {
  const made: LiftParts = {};
  const steps = [
    () => (made.tunnels = createWindTunnels(level, haze, share)),
    () => (made.houses = createCabins(level, haze)),
    () => (made.village = createVillageBuildings(level, haze)),
  ];
  for (const step of steps) {
    step();
    if (await rest()) continue;
    made.tunnels?.dispose();
    made.houses?.dispose();
    made.village?.dispose();
    return null;
  }
  return made;
}

/** What the course's marks ask for (`createGates`). */
export function gatePrimes(level: Level): Prime[] {
  return [() => void signPlan(level), () => void firesOf(level)];
}

/** What the wildlife asks for (`createWildlife`). */
export function wildPrimes(level: Level): Prime[] {
  return [() => void birdPlanFor(level), () => void beastPlanFor(level)];
}

/** What the people on foot ask for (`createPeopleView`): their plans, then
 * every body's figure at every cut, one a piece — as the view builds them. */
export function peoplePrimes(level: Level, rules: RunRules, summer: boolean): Prime[] {
  if (!hasCivilians(rules)) return [];
  const out: Prime[] = [];
  const bodies = new Set<CrowdBody>();
  const skiers = new Set<CrowdBody>();
  out.push(() => {
    for (const c of civilianPlanFor(level, summer).people) (c.skis ? skiers : bodies).add(c.body);
  });
  out.push(() => {
    for (const h of dogPlanFor(level, summer)?.households ?? []) {
      bodies.add(h.walker);
      if (h.child) bodies.add(h.child);
    }
  });
  for (const body of CROWD_BODIES) {
    for (const lod of CROWD_LODS) {
      out.push(() => {
        if (bodies.has(body)) buildCivilianFigure(body, lod, summer);
        if (skiers.has(body)) buildCrowdFigure(body, lod);
      });
    }
  }
  return out;
}

/** What the machines ask for (`createMachines`): the village's traffic. */
export function machinePrimes(level: Level): Prime[] {
  return [() => void trafficOf(level)];
}
