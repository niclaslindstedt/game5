// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S WINGS — how much they take before they are torn off
// (`plane-wings.ts`), and the take-off hand that keeps a player flying off
// the strip (`plane-hand.ts`). Kept apart from `PLANE` (`plane.ts`), which
// the Blender model is made from: none of this is the machine's shape.
//
// WHAT A STRUT-BRACED HIGH WING TAKES — the research these numbers stand
// on, restated in our own words (the light-aircraft airworthiness code's
// load factors, accident-investigation reports of wing strikes and of
// wings lost to trees, and ground-handling practice for a tailwheel single):
//   - IN THE AIR a wing is built to its LIMIT load, 3.8 g up and 1.52 g down
//     for a normal-category plane, and to hold an ULTIMATE load 1.5 times
//     that for three seconds without breaking: 5.7 g and 2.28 g. Past the
//     ultimate the wing (the strut's head, the spar at the root) lets go.
//     Each wing carries half the lift, so a side is torn off once its own
//     lift passes half the weight times the ultimate load.
//   - ON THE SNOW a wingtip is a light fairing on the end of a long lever.
//     A wing dropped on the take-off or landing roll (a gust, the torque, a
//     wheel-ski catching) SCRAPES its tip: the fairing scuffed or bent, the
//     nav light broken, the plane slewed toward it — and flown on. Reports
//     of such strikes are mostly "minor damage". What tears a wing off is
//     a tip DUG IN hard at speed (a cartwheel), a ground loop that drives
//     it into a bank, or a TRUNK: a wing meeting a trunk at any flying speed
//     is cut or torn off at the strut's head or the root, and a crown's
//     thick limbs do the same; its twigs only batter it.
//   - The spar's strength in the plane of the wing (fore and aft, against a
//     tip's drag in the snow) is several times its strength up and down.
//   - A WING TORN OFF takes its fuel tank with it: the tank is in the wing,
//     inboard. Torn off in the air or on the roll the fuel streams out
//     behind and away from the engine ahead of it; jet fuel's flash point
//     (≈38 °C) stands far above a winter mountain's air, so a spill on the
//     snow away from a hot surface does not light. A torn wing alone does
//     not burn (the wreck's fire is `defs/plane-wreck.ts`'s).
//   - TAKING OFF A TAILWHEEL SINGLE: full power, the stick held a little
//     forward to raise the tail once the rudder bites, held straight on the
//     rudder against the torque's and the propeller's swing to the left,
//     wings level on the ailerons, and lifted off near 1.1–1.2 times the
//     stall — never hauled off in the three-point attitude at the stall,
//     which is where a wing drops and a tip strikes.

import { PLANE } from "./plane.ts";

const G = 9.81;
/** The working weight with a skier aboard, N (the strength's reference). */
const WEIGHT = (PLANE.mass + 90) * G;

export const PLANE_WINGS = {
  /** THE LOAD FACTORS the wing is built to, g: the limit up and down and the
   * ultimate's factor over it (the airworthiness code's normal category). */
  limit: { up: 3.8, down: 1.52, ultimate: 1.5 },
  /** A SIDE'S STRENGTH in the air, N of its own lift: half the weight at
   * the ultimate load, up (`up`) and down (`down`), times the margin a
   * built wing breaks at past the ultimate it is certified to (`reserve`:
   * static tests to destruction run on past the ultimate by a tenth to a
   * half; we take a quarter) — 7.1 g up and 2.85 g down. */
  air: {
    up: (WEIGHT / 2) * 3.8 * 1.5 * 1.25,
    down: (WEIGHT / 2) * 1.52 * 1.5 * 1.25,
  },
  /** THE TIP ON THE SNOW: the snow's spring under it, N/m, and its give
   * (a plastic crush more than a damper), N·s/m; the friction along the
   * snow it scrapes, the most the tip may be pressed in before the fairing
   * is buried, m, and the snow it PLOUGHS once dug in (½ρ times the tip's
   * thickness: wind-packed snow of 400 kg/m³ against a 0.3 m tip, a drag of
   * that × its depth × the speed squared — a scuff at the take-off's speed
   * and a few centimetres, a wing torn off dug in at a landing's 45 m/s). */
  tip: { spring: 40e3, damping: 1500, friction: 0.35, buried: 0.6, plough: 0.5 * 400 * 0.3 },
  /** THE TIP FORCE THAT TEARS A SOUND WING OFF, N: the ultimate bending
   * moment at the root (5.7 g of half the weight about the lift's centre at
   * 0.42 of the semi-span) over the tip's lever from the root; the wing's
   * strength fore and aft (`inPlane`: the spar's depth there is its chord,
   * the strut and the drag bracing a share of it) twice that; a battered wing
   * gives at `weak` of it at no health left. */
  tear: {
    force: ((WEIGHT / 2) * 3.8 * 1.5 * 0.42 * (PLANE.wing.span / 2)) / (PLANE.wing.span / 2 - 0.62),
    inPlane: 2,
    weak: 0.5,
  },
  /** HOW A SCRAPE WEARS IT: health (1 sound … 0 torn) lost a second at the
   * tearing force (by its square under it), and a metre of tip scraped
   * along the snow; the least force a touch must press to be a scrape, N. */
  scrape: { rate: 1.5, perMetre: 0.004, least: 600 },
  /** INTO THE TREES: a trunk met faster than `trunk` m/s tears the wing off
   * (slower, a dent), the crown's limbs (inside `core` of its spread) faster
   * than `limbs` m/s; the twigs (inside `twigs` of its spread) batter it,
   * health a second at 30 m/s. */
  trees: { trunk: 5, limbs: 15, core: 0.3, twigs: 0.7, batter: 1.6 },
  /** A TORN WING'S FLIGHT (`stepLooseWings`): its mass, kg (the structure;
   * its fuel spilt), its tumbling drag area, m² (a flat plate turning end
   * over end, half its 15 m² a side on average), how much of the airframe's
   * way it keeps when a trunk or the snow tears it off and when the air
   * folds it, the kick up it is flung with, m/s, the snow's bounce and its
   * friction under it, the speed it comes to rest under, m/s, and how fast
   * it falls over flat once on the snow, rad/s a rad of lean. */
  loose: {
    mass: 110,
    drag: 7,
    keep: { tree: 0.25, tip: 0.45, load: 0.9 },
    kick: 2.5,
    bounce: 0.2,
    friction: 0.7,
    rest: 0.4,
    settle: 3,
  },
} as const;

/** THE TAKE-OFF HAND (`plane-hand.ts`) — the player's controls helped on
 * the snow and the first tens of metres off it, the way a flying school's
 * hands help: the share of it by the height over the snow (all of it on the
 * snow, none by `high` m, faded from `low`); the stall guard (the stick
 * — held on higher, all of it to `high` and none by `guardHigh` m, so a
 * climb-out hauled back on does not stall as the rest lets go —
 * eased forward past `aoa` rad of attack, `flaps` more with full flap, read
 * `lead` s ahead on the pitch's rate, at `guard` of stick a rad over, and
 * on the snow only from `guardSpeed` m/s); the nose-over guard on the snow
 * (the pitch off the snow's own lean kept over `floor` rad, the stick eased
 * back `back` a rad under it, the push let off over `ease` rad above it);
 * — the tail let up no further than a few degrees nose-up, which keeps
 * the propeller's tips clear over a bump on the strip —
 * the heading held on the roll when the pedals are let go (`yaw` of pedal
 * a rad off, `yawRate` a rad/s of turn, at most `yawMost`); and the wings
 * held level near the snow when the stick is not over (`roll` a rad of
 * bank, `rollRate` a rad/s, at most `rollMost`). Scaled by the run's
 * `Assist` (how much the skis help): the heading by its `yaw`, the rest by
 * its `air`. */
export const TAKEOFF_HAND = {
  low: 10,
  high: 40,
  guardHigh: 150,
  aoa: 0.17,
  flaps: 0.05,
  lead: 0.25,
  guard: 6,
  guardSpeed: 17,
  floor: 0.06,
  back: 4,
  ease: 0.06,
  yaw: 2.5,
  yawRate: 1.2,
  yawMost: 0.7,
  roll: 2.2,
  rollRate: 0.9,
  rollMost: 0.8,
} as const;
