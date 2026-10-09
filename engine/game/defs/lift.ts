// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT RIDE — the block of `TUNING` that answers to `lift-ride.ts` and
// `lift-board.ts`. It lives beside `tuning.ts` and is folded in as
// `TUNING.lift`, which is how the whole repo spells it.

/** THE LIFT RIDE (`lift-ride.ts`; the lifts' own measure is `LIFT_LOOK`).
 * The rope's slowing into the top terminal, m/s², and its pick-up off
 * the load line, m/s²; how far down the hanger from the grip a chair's
 * rider (`seat`) and a cabin's (`cabin`) has his body's origin, m, and
 * each hanger's swinging length, m; the least a chair carries its rider's
 * origin over the snow, m (`sit`: sat with his skis just on it, where the
 * chair comes down to the ramp — his CoG's height over his skis); the swing's damping, 1/s, the most
 * it swings, rad, and the kick a tower's bend in the rope gives it, rad/s
 * per unit of slope change read `bend` m either side (to `kickMost`
 * rad/s — a lurch of a few degrees); how long a chair
 * scoops a rider up, s, and how long he takes to stand up off it at the
 * unload, s (`rise`: his skis on the ramp, pushing off the seat and
 * sliding on ahead of it); the way a chair stands him up with on the ramp,
 * turned `ramp` rad off the line to the up rope's side (a step out of
 * the chair's way into the lane straight on off the ramp, `chairLane`),
 * a cabin walks him out with, m/s, and how far short of the top the
 * cabin's door lets him out, m. THE FREE RIDE'S ARRIVAL: the ride
 * starts `arrive` s of carrying short of where the carrier lets him go —
 * the last of the climb, over the last tower and down onto the top
 * station's rail ahead (`LiftLook.in`) — on the chair whose
 * run passes nearest the spot picked among those a rider stood off its
 * top can ski onto (`runsOffTop`: down a ramp, or on a map from before
 * the ramps the run's nearest point `drop` m or more under the top
 * within `joinFar` m), a metres-off-the-spot penalty `noJoin` on any
 * other. Stood off it, the skis are his: nothing leads him off a top.
 * A cabin's rider sits `cabinBack` m behind its grip, on the bench along
 * its back wall; a T-bar's stands `tee` m right of the bar's stem, on
 * its right arm. BOARDING (`board`): taken by a lift's load zone or its
 * boarding ring he SKATES to the carrier — up the queue's lane, `past`
 * m right of the queue — at `pace` m/s and at `drive` of his push,
 * checked down to it at `brake` m/s² from however fast he came in and
 * coming to the load line at `end` m/s, slowing at `stop` m/s²; he
 * looks `ahead` m along the way and turns to it at `turn` rad/s at the
 * most. Carried, the machine press lets go of the lift wherever he is —
 * out of a gondola's door `jumpOut` m clear of its cabin — and the tuck
 * held `skip.hold` s skips him up it behind a fade of `skip.fade` s.
 *
 * SETTING OFF FOR THE CARRIER (`board`), a skier taken facing off the
 * way he has to go turns to it the way a skier does, never swivelled
 * round on the spot as he slides: within `square` rad of it he simply
 * skates off; coming in faster than a crawl (`crawl` m/s) and turned
 * more than `halt.off` rad from it he first STOPS, the skis thrown across
 * and scraped to a stand at `halt.decel` m/s²; at a crawl he STEPS HIS
 * SKIS ROUND on the spot (`poles.pivot`'s pairs, `steps` of them a
 * second — the quick steps of a skier with somewhere to be); and rolling
 * and turned less than that he SKATES ROUND to it, a stride's step turned
 * in each push, at `arc` rad/s.
 *
 * A GONDOLA BOARDED (`gondola`): skated up the lane, he stops `walkIn` m
 * short of the door at the back of the hall, steps out of his skis and
 * shoulders them (`town.ts`'s beats), and walks the rest on foot — the
 * picture black `inset` m short of the wall, before the pair's tips are at
 * its glass. Through the hall he comes out onto the platform beside the
 * bullwheel, `platform` m out from the side of his cabin's way, `load` m up
 * the line from the wheel on its up side, and waits there in his boots,
 * the pair on his shoulder. His cabin comes round the
 * wheel to him on the station's rail from `from` m back along it,
 * slowing at `come` m/s² to the station's crawl of `creep` m/s — detached
 * from the rope, the doors sliding open — and as it comes alongside he
 * turns to it and stands the pair in the rack on its back door leaf over
 * `rack` s, then steps in through the door, turned to sit on the bench
 * along its back wall, over `stepIn` s, while it creeps on; its doors
 * shut over `shut` s and it is taken back onto the rope and away. Through
 * the station its grip runs on a RAIL, `rail` m over the wheel's foot (the
 * cabin's floor at the platform's), and climbs to the rope over `climb` m
 * once out of it. At the top he is let out of its door, the pair off the
 * rack and on his shoulder, and walks on out onto the pad under the lift's
 * hand for `out` s — the picture coming back in on him there, the
 * station's hall a cut behind its fade — where he lays the pair down and
 * steps back into it.
 *
 * A CHAIR'S BOTTOM TERMINAL (`chair`, `lift-line.ts`'s `gripAt`): its grip
 * runs on the station's rail `rail` m over the bottom wheel's foot — the
 * seat's top (`CHAIR_SEAT` under the grip) at the back of a standing
 * skier's knees on the load line — and climbs back up to the rope over
 * `climb` m past the load line. A skier waiting on the load line is
 * scooped by the chair whose grip comes to `take` m behind his boots
 * (`lift-board.ts`'s `stepChairWait`), and sat on it over `scoop` s. */
export const LIFT = {
  chair: { rail: 2.95, climb: 12, take: 0.7 },
  cabinBack: 0.65,
  jumpOut: 1.3,
  skip: { hold: 3, fade: 0.5 },
  tee: 0.3,
  board: {
    pace: 3,
    drive: 0.75,
    brake: 2.5,
    stop: 1.2,
    end: 0.6,
    ahead: 1.6,
    turn: 3,
    past: 0.8,
    square: 0.2,
    crawl: 0.5,
    halt: { off: 1.6, decel: 6 },
    steps: 1.8,
    arc: 1.4,
  },
  gondola: {
    platform: 0.75,
    load: 2,
    from: 2,
    come: 0.55,
    creep: 0.3,
    walkIn: 4.5,
    inset: 1.1,
    rack: 2,
    stepIn: 2.4,
    shut: 1.2,
    out: 1.25,
    rail: 4.3,
    climb: 6,
  },
  decel: 0.8,
  accel: 1.2,
  seat: 1.85,
  cabin: 3.2,
  chairHang: 2.4,
  cabinHang: 4.0,
  sit: 1.0,
  damp: 0.45,
  swingMost: 0.3,
  kick: 1.5,
  kickMost: 0.2,
  bend: 3,
  scoop: 0.8,
  standUp: 2.2,
  rise: 0.9,
  ramp: 0.3,
  walkOut: 1.5,
  door: 10,
  arrive: 8,
  drop: 2,
  joinFar: 120,
  noJoin: 2000,
} as const;
