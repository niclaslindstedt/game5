// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BLOWS OFF STEEL (`body.ts`'s, stated here to keep it under its cap):
// come down astride a lift's rope, and thrown into his own downhill bike
// (`bike-tangle.ts`) — a point met by one of its parts, a bar end's spear
// into the belly, the stem up into the groin, a caught limb's yank. Each
// is struck through the body's own hands (`BodyHands`), so the doses land
// where every other blow's do and are judged with them.

import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { BIKE_TANGLE } from "./defs/bike-tangle.ts";
import { TUNING } from "./defs/tuning.ts";
import { facingOf } from "./body-torso.ts";
import { RAGDOLL as R } from "./ragdoll-points.ts";
import type { BodyPart, Facing, Mechanism } from "./defs/anatomy.ts";
import { MISHAPS } from "./defs/mishaps.ts";
import type { GameState, ImpactSource, Thrown } from "./state.ts";

const I = TUNING.injury;

/** What `body.ts` lends: a blow on a part, its g against a give, a stop's g, the g
 * meter's offer, and one ragdoll point's blow. */
export type BodyHands = {
  strike(part: BodyPart, g: number, face?: Facing | null): void;
  /** A dose of a mechanism (not a blow) on a part. */
  charge(part: BodyPart, mech: Mechanism, d: number): void;
  blow(part: BodyPart, v: number, against: number, tree: boolean, share?: number): number;
  /** The g of a stop at `v` m/s over `give` m (`body.ts`' `blowOf`). */
  blowOf(v: number, give: number): number;
  offer(g: number, part: BodyPart, source: ImpactSource, rival?: number, amateur?: number): void;
  pointBlow(
    i: number,
    v: number,
    against: number,
    tree: boolean,
    face: Facing,
    n: Vec3,
    points: readonly number[],
    source?: ImpactSource,
  ): void;
};

const sided = (base: string, side: number): BodyPart =>
  `${base}${side < 0 ? "L" : "R"}` as BodyPart;

/** COME DOWN ASTRIDE A LIFT'S ROPE (`cable.ts`) at `v` m/s: the steel
 * square up into the crotch — the front of the pelvis' ring and the bladder
 * behind it, the inside of both thighs, the belly over it and the spine
 * jarred — against the rope's next to nothing. */
export function astride(h: BodyHands, v: number): void {
  const give = I.solid.steel;
  const g = h.blow("pelvis", v, give, true);
  h.strike("pelvis", g, "front");
  for (const s of [-1, 1])
    h.strike(sided("thigh", s), h.blow(sided("thigh", s), v, give, true, 0.6));
  h.strike("abdomen", h.blow("abdomen", v, give, true, I.share.trunk), "front");
  h.strike("back", h.blow("back", v, give, true, I.share.trunk * 0.5));
  h.offer(g, "pelvis", "cable");
}

/** THE TEAR PART a caught point's yank lands on (`gore.ts`' `TEAR`): a hand
 * the forearm's, an elbow the arm's, a foot the shin's, a knee the leg's,
 * the head the neck's. Null for the trunk's points, which are not caught. */
export function yankPart(i: number): BodyPart | null {
  switch (i) {
    case R.handL:
      return "handL";
    case R.handR:
      return "handR";
    case R.elbowL:
      return "armL";
    case R.elbowR:
      return "armR";
    case R.footL:
      return "kneeL";
    case R.footR:
      return "kneeR";
    case R.kneeL:
      return "thighL";
    case R.kneeR:
      return "thighR";
    case R.head:
      return "neck";
    default:
      return null;
  }
}

const way: Vec3 = { x: 0, y: 1, z: 0 };

/** THROWN INTO HIS OWN BIKE (`bike-tangle.ts`): each blow off it this
 * step, from the tangle's list. */
export function bikeBlows(h: BodyHands, state: GameState, b: Thrown): void {
  const blows = state.bike?.tangle?.blows;
  if (!blows?.length) return;
  const G = BIKE_TANGLE.give;
  for (const k of blows) {
    if (k.kind === "yank") {
      // Snatched to the part's speed over the catch's give: on the part a
      // tear reads (`gore.ts`' `TEAR`).
      const part = yankPart(k.point);
      if (!part) continue;
      const g = h.blowOf(k.v, BIKE_TANGLE.yank.give);
      h.strike(part, g);
      h.offer(g, part, "bike");
    } else if (k.kind === "spear") {
      // The bar's end square into the belly — the liver, the spleen, the
      // pancreas and the bowel behind it — the hips jarred.
      const g = h.blow("abdomen", k.v, G.spear, true, BIKE_TANGLE.spear);
      h.strike("abdomen", g, "front");
      h.strike("pelvis", h.blow("pelvis", k.v, G.spear, true, I.share.trunk), "front");
      h.offer(g, "abdomen", "bike");
    } else if (k.kind === "groin") {
      const g = h.blow("pelvis", k.v, G.groin, true);
      h.strike("pelvis", g, "front");
      for (const s of [-1, 1])
        h.strike(sided("thigh", s), h.blow(sided("thigh", s), k.v, G.groin, true, 0.5));
      h.strike("abdomen", h.blow("abdomen", k.v, G.groin, true, I.share.trunk), "front");
      h.offer(g, "pelvis", "bike");
    } else {
      way.x = k.nx;
      way.y = k.ny;
      way.z = k.nz;
      const give =
        k.part === "front" || k.part === "rear"
          ? G.wheel
          : k.part === "ring"
            ? G.ring
            : k.part === "bars"
              ? G.bars
              : G.tube;
      h.pointBlow(k.point, k.v, give, true, facingOf(k.nx, k.ny, k.nz), way, b.points, "bike");
    }
  }
}

/** A HARD OPENING (`mishaps.ts`): the canopy's load at `g` through the
 * harness — the head whipped on the neck and a load down the spine, past
 * `MISHAPS.hard.hurt`. */
export function hardOpening(h: BodyHands, g: number): void {
  const H = MISHAPS.hard;
  if (g <= H.hurt) return;
  h.strike("neck", g * H.neck);
  h.charge("back", "load", g * H.back);
  h.offer(g, "neck", "snow");
}
