# A person run into

What happens when the player, on a free ride, skis (or rides a board, the
snowmobile's boards or the bike) into one of the crowd's amateurs at speed.
Under a brisk cruise it is still the crowd's SHOULDER — the bump, a knock
down past a skill-scaled threshold, the player's shoulder and arm dosed
(`crowd.ts`' `clipCrowd`, `body.ts`' `feelBumps`). Past
`PERSON_HIT.strike` (6.5 m/s closing, some 23 km/h) it is a COLLISION of two
bodies: `engine/game/person-hit.ts` for the exchange and the outcome,
`engine/game/body-person.ts` for the blow on the player's body, the numbers
in `engine/game/defs/person-hit.ts`, held by `tests/body_hits_test.ts` and
printed by `make body-hits`.

## What the research says

Restated in our own words, as the numbers it gave:

- **Two people are two bodies of about the same mass.** An adult amateur
  weighs what the player does (the crowd's bodies are 60–88 kg, a child 32
  kg). Flesh on flesh bounces very little, so the collision is close to
  fully inelastic: each body's change of speed is the closing speed times
  the OTHER body's share of the pair's mass — about half of it each for two
  adults, three quarters of it for a child struck by a grown man. The same
  impulse goes through both; the lighter is hurt more.
- **Crash tests of two instrumented adult dummies**, one skiing square into
  the side of the other standing still, at 30 and 50 km/h: at 30 km/h the
  STRUCK skier's head acceleration was past the line for a serious head
  injury even under a helmet, and the striking one's past 80 g; the neck's
  axial load near its limit. At 50 km/h the striking skier's head, neck,
  chest and pelvis were all past their limits — and the worst loads came
  more and more from the two bodies meeting the snow after the first blow.
  The knees of the striking skier were twisted far enough to tear a
  ligament.
- **Side impacts on the chest and the belly** with a 23 kg flat impactor at
  4.5, 6.7 and 9.4 m/s: serious injury mostly at the top two speeds — nine
  to sixteen broken ribs at 6.7 m/s, the lung and the liver torn at 9.4
  m/s — the chest's tolerance about a 38 % compression.
- **Collisions between skiers on the record** hurt the head (without a
  helmet), the face, the chest and the arms most; the fatal ones were at an
  estimated 60–70 km/h, the dead most often the one struck, of the head or
  of blunt trauma to the chest. Many skiers on a groomed easy run reach
  50 km/h; a fifth top 70.

## What the game makes of it

| Closing speed | The player | The amateur (INJURIES on) | The amateur (INJURIES off) |
| --- | --- | --- | --- |
| under 23 km/h | the shoulder: a bump, the shoulder and the arm | knocked down past his skill's threshold, up again | the same |
| ~23–33 km/h | struck front to front on every part the other body stands against: bruises, a whiplash | INJURED past `injure` (4 m/s of his own change of speed): down for good, alive, to be collected | knocked down, up again |
| ~45 km/h | thrown (`skier`), a cracked neck, a concussion, broken arms and pelvis — down hurt | injured (a child: killed) | knocked down, up again |
| 60 km/h and over | thrown, the chest stove in, the belly torn, the pelvis and the femurs broken, the neck broken — dead | KILLED past `kill` (9 m/s of his own), CRUSHED 0..1 on to `crush` (15 m/s) | knocked down, up again |

- **The exchange** (`strikePerson`): the impulse by the two real masses
  (`totalMass` of the player's pair, `CROWD_SIZE` for the amateur) with
  `restitution` 0.1. The amateur is thrown onto his ragdoll (`crowd-down.ts`)
  with his share, lifted off the snow by `lift` of it; the player keeps what
  it left him and is thrown with THAT (the `skier` cause) past the crowd's
  own threshold (`CROWD.floors` × the shoulder's trunk limit).
- **The player's body** (`personBlows`): a step after the meeting (the crowd
  moves after the player's run), every band of him from the boots up to the
  other's height (`PERSON_HIT.height`, the figure's own heights) is struck
  from the front at the change of speed he took, the trunk whole and the
  limbs, the neck and the head at a share; stopped by the other body's give
  (`personGive`: 5 cm at a slow blow, under a centimetre — both bodies
  crushed through together — by 12 m/s). The doses go through `body.ts`'
  hands, so the ladders (`defs/anatomy.ts`) and the wounds (`gore.ts`) judge
  them with every other blow, up to `blows` × `perBlow` injuries at once. A
  child stands only as high as his chest and weighs half as much: the player
  walks away bruised from the collision that kills the child.
- **Injuries off** (`GameState.gore` undefined): nobody is killed, crushed or
  held down; the amateur gets up, and the player's body is a readout that a
  reset mends, as everywhere else.

## For the rescue and the police

- **`casualtiesOf(state)`** — every body on the snow that needs collecting,
  now: each amateur down for good (killed, injured, or dug out of an
  avalanche dead) and, with INJURIES on, the player dead or hurt too badly
  to ski on. Each `Casualty` says who (`"player"`, id −1, or `"amateur"` and
  his `Amateur.id`), where the body lies (its middle and the ragdoll's
  points), whether dead, how crushed 0..1, the run time it happened (−1
  unknown), where the blow was (`impact`: the meeting's spot, or for the
  player where he was thrown from, `Thrown.from`) and what did it.
  `thrownFar` is how far the body lies from the impact.
- **The `struck` event** — fired the step a person is struck: the amateur,
  the spot between the two at a body's middle height, the closing speed, the
  change of speed in each (`taken`, `given`), his height, whether the player
  was thrown, whether the amateur was killed or injured and how crushed.
  Every meeting is also kept on `CrowdState.struck` (`struckPerson(state,
  id)` the latest with an amateur).

Nothing of it draws from any stream (the amateur's lie-down clock is drawn
off the crowd's own, as a knock-down always was), and there is a crowd only
on a free ride, so no sim or determinism digest moves.
