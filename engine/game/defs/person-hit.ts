// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON RUN INTO (`person-hit.ts`, `body-person.ts`): the numbers of the
// player meeting an amateur of the crowd at speed — two bodies of their
// real masses, flesh on flesh. `docs/body-hits.md` carries the research
// these are read off; in short:
//   - two people who collide are two bodies of nearly the same mass, so
//     each takes about half the closing speed as his own change of speed
//     (all of it shared, almost none bounced back), and BOTH are hurt by
//     the same impulse — the lighter more;
//   - crash tests of two instrumented dummies, one skiing square into the
//     other's side, put the struck skier's head past the serious-injury
//     line at 30 km/h even under a helmet, and the striking one's at 50,
//     with the chest and the pelvis past theirs at 50, mostly where the
//     two meet the snow after;
//   - side impacts on the chest at 4.5, 6.7 and 9.4 m/s (a 23 kg flat
//     impactor) break ribs from the middle speed — nine to sixteen of them
//     at 6.7 m/s — and tear the lung and the liver at the top one;
//   - the fatal collisions between skiers on record are at some 60 to
//     70 km/h, the dead the struck one, of the head or the chest.

import type { CrowdBody } from "./crowd.ts";

export const PERSON_HIT = {
  /** The closing speed, m/s, from which a meeting is a COLLISION of two
   * bodies rather than a shoulder: under it the crowd's shoulder and knock
   * stand as they were (`CROWD.knock`, `feelBumps`); from it the whole of
   * each body meets the other (some 23 km/h: a brisk cruise into a man
   * stood still — past the hardest knock a good skier stands up to). */
  strike: 6.5,
  /** The bounce between two bodies of flesh, 0..1: next to none. */
  restitution: 0.1,
  /** THE STRUCK AMATEUR, by the change of speed the blow gave HIM, m/s
   * (half the closing speed between two adults, three quarters of it for
   * a child against a grown man): INJURED past `injure` — he stays down,
   * alive, until someone collects him (the head past the line at 30 km/h
   * closing) — KILLED past `kill` (some 60 km/h closing between adults,
   * the fatal cases' speed), and CRUSHED 0..1 from `kill` to `crush` (the
   * body burst at some 100 km/h). With the INJURIES switch off nobody is
   * hurt: he is knocked down and gets up as before. */
  injure: 4,
  kill: 9,
  crush: 15,
  /** ...and he leaves the snow by this share of what the blow gave him. */
  lift: 0.2,
  /** WHAT A PERSON'S BODY GIVES a part of the player driven into it, m, by
   * the speed the blow took off him: met slowly the other's flesh, clothes
   * and ribcage give as a body does (`soft`); met hard both are crushed
   * through together in a few centimetres (`hard`, by `at` m/s, in a
   * straight line between) — the two-body crush, about a trunk's bark. */
  give: { soft: 0.05, hard: 0.006, at: 12 },
  /** His height standing, m, by body — the band of the player he meets.
   * The figure's own heights (`pwa/src/game/crowd-rig.ts`' `CROWD_LOOKS`)
   * restate these; `tests/body_hits_test.ts` holds the two together. */
  height: {
    man: 1.8,
    woman: 1.68,
    teen: 1.66,
    child: 1.18,
    oldMan: 1.75,
    oldWoman: 1.62,
    freerider: 1.82,
    retro: 1.72,
  } satisfies Record<CrowdBody, number>,
  /** The most injuries one collision does the player, as many blows'
   * worth as this — a body met with every part at once. */
  blows: 3,
} as const;
