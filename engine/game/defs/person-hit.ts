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
  /** THE BODIES THAT MEET at a strike — a person on foot (`foot.ts`: the
   * civilians, the rescue's and the police's crews) always, an amateur of
   * the crowd once the two close past `strike`: each an upright body of a
   * torso's half-width round his middle, m — a grown man's 1.8 m (`radius`;
   * a smaller body's by the root of his height) and the skier's own on his
   * skis (`reach`). Nothing wider: at speed the skis pass under and beside
   * a person, and only when the two BODIES touch is it a blow (the crowd's
   * shoulder under `strike` keeps its wide circles, `RACE.bump`). And how
   * long a person knocked and not hurt is no body to
   * the engine, s — he lies, gets up and walks back to his routine
   * (`pwa/src/game/civilian-knock.ts`) — before he stands where his plan
   * has him again. The player THROWN is a low round body of `thrown` m
   * round his middle, tumbling into them. A MACHINE the player is not on
   * his skis for — a piste machine, a car, the bus, a bicycle — strikes
   * when the change of speed it gives the person reaches `blow`, m/s:
   * what a skier at the strike speed gives a grown man (half of it, and
   * the little bounce), so twelve tonnes of steel at a walking pace is a
   * collision where a skier at that pace is only a shove. The machines
   * meet them every `every` steps — a thirtieth of a second, in which a
   * car on the road out goes half a metre, an eighth of its own length, so
   * none goes through a person between two looks. */
  foot: { radius: 0.26, reach: 0.22, back: 60, thrown: 0.5, blow: 3.4, every: 4 },
  /** A BODY LYING ON THE SNOW gone over (`lying.ts`) — an amateur down, a
   * person on foot struck — by the player's skis, board or bike, his
   * snowmobile, a piste machine or a car. `docs/body-hits.md` carries the
   * research; in short: a person lying is a low hump, an adult's trunk
   * some 22–25 cm deep; skis ride up over a trunk, but a tip that meets an
   * arm or a leg lying across it hooks under it and the skier goes over
   * his tips; a tracked machine on snow presses some 4–5.5 kPa on the
   * ground (a loaded snowmobile and a working piste machine alike — a
   * walker's foot is 60–80 kPa), but over a hump its track is held off the
   * snow either side and the body carries the stretch of it it holds up;
   * and a body run over by a wheel is hurt by the weight on the wheel far
   * more than by the speed (most children killed under a car were run over
   * at a crawl). */
  lying: {
    /** The body's top off the snow, m: the band of the rider's legs a pass
     * strikes (`body-person.ts`), the shins and the knees. */
    top: 0.3,
    /** The skis' (or the board's, or the bike's) footprint round the
     * boots, m: the tips ahead, the tails behind, half the stance across. */
    skis: { front: 0.95, back: 0.8, half: 0.2 },
    /** A TIP CAUGHT: a limb lying across the ski (its line at least
     * `across` of square to it, as a sine) met in the front `tip` m of the
     * footprint at `catchAt` m/s closing (a brisk cruise, 25 km/h) or more
     * hooks the tip and throws him over it (the `skier` cause) — under it
     * the ski shoves the limb aside and he rides on. */
    tip: 0.3,
    across: 0.6,
    catchAt: 7,
    /** RIDDEN OVER: the share of the mass under its footprint's path the
     * thing going over carries along as its front rides up the hump —
     * pushed ahead and dragged, never all of it (the rest passes under);
     * an arcade dial, set so a skier at 90 km/h over a man loses some
     * 10 km/h. The two share the impulse by their masses. */
    ride: 0.4,
    /** ...and the HOP it gives the rider: up at `share` of the closing
     * speed, m/s, to at most `skis` on his skis and `sled` on the
     * snowmobile (the legs and the springs swallow the rest — 1.8 m/s is
     * the climb's own lift over a 17 cm hump). */
    hop: { share: 0.08, skis: 1.8, sled: 0.8 },
    /** Slower than this, m/s closing, he steps or rolls over it and no
     * more; a pass is one until nothing of that kind has touched the body
     * for `gap` s; the body pushed is stepped on for `settle` s after. */
    slow: 1,
    gap: 0.25,
    settle: 1.5,
    /** THE WEIGHT ON HIM, kg, as the thing goes over (INJURIES on): a
     * skier's own weight on his edges; a tracked machine's ground pressure,
     * kPa, over the width of its track (`tracks`, m) and the stretch the
     * hump holds off the snow (`bridge`, m), to at most its own weight; a
     * car's on one of its wheels (`Hitter.wheels`). Under `hold` kg it is
     * nothing a body is hurt by (a man knelt on him); past it each 100 kg
     * is `press` m/s of the blow on the struck person's ladder (`injure`,
     * `kill`, `crush`, on top of the change of speed the push gave him),
     * a lighter body's by the root of how much lighter. */
    hold: 30,
    press: 2.2,
    tracks: { sled: { kpa: 5, width: 0.38 }, groomer: { kpa: 5.4, width: 1.4 } },
    bridge: 1.2,
  },
} as const;
