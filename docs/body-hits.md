# A person run into

What happens when the player, on a free ride, skis (or rides a board, the
snowmobile's boards or the bike) into one of the crowd's amateurs at speed —
or into a PERSON ON FOOT: a civilian of the ski area, a dog walker of its
village, a man of the air ambulance's, the police's or the ski patrol's
crew — and what his body thrown, a piste machine or a car does to one of
them (below, *People on foot*) — and what going over one of them already
lying on the snow does (*A body lying on the snow*).
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

## What it looks, sounds and feels like

The app's half (`pwa/src/game/crowd-broken.ts`, `crowd-gore.ts`,
`audio/person-bank.ts`, `rumble.ts`), judged with `make gore
ARGS=--sheet=person` (30, 60 and 90 km/h into a grown man with INJURIES on,
60 and 90 with them off). What the research on blunt trauma and the sound
of a body hit says, in our own words:

- **A body broken by blunt force lies wrong where it broke.** A broken
  thigh lies shorter than the other leg with the foot turned out onto its
  outside edge (the thigh's muscles pull the ends past each other); a
  broken shin or forearm is bent where no joint is; a broken neck lets the
  head lie at an angle a neck never turns to; a stove-in chest lies flatter
  than a living one.
- **Most of a blunt blow bleeds inside.** The deaths on record are of the
  head and the chest, often with little to see outside; the blood on the
  snow is a face cut and a nose and mouth bleeding at a hurt man, and only a
  body torn open by a far worse blow sheds litres.
- **A hit to the body sounds deep and hollow** — mostly thud, little crack,
  built in layers that play as one: a low boom for the weight, a short
  transient for the meeting, the breath knocked out of a chest, and only for
  a bad blow the snap and crunch of bone, kept sparing.

What the game makes of it, INJURIES on (with them off, none of it: he is
knocked down and gets up):

| | Hurt (alive) | Killed | Crushed (`crush` past 0.45, some 80 km/h) |
| --- | --- | --- | --- |
| How he lies (`breakPose`) | on his ragdoll, never getting up: one shin off its knee, his skis off his boots; he stirs — a hand drawn to his chest, his head lifting | both legs broken (a shin across the snow, a thigh short with its foot turned out), both forearms off their elbows, an arm off its shoulder, the head off the neck; still | the same, the trunk drawn flatter (`flatOf`, to 58 % at the full) |
| His clothes (`bloodOf`) | his face and hair bloodied | soaked in patches | soaked through |
| The snow (`crowd-gore.ts`, `bleedOf`) | a spatter at the blow; a cupful by his face | a spray along his fling and back at the player, a red smear down his slide, a pool growing to half a litre and more | litres, with his flesh and splintered ribs thrown out at the blow |
| Heard (`route.ts`) | `struck_body` — a deep thud of a man's weight, a fleshy slap, the nylon, the breath knocked out | `struck_crush` — lower and longer, three snaps of ribs and a crunch, a wet settle, no breath | the same, fuller |
| Felt (`rumble.ts`) | a body's blow, harder than a shoulder by the speed it took off the player | a beat longer | the same |

The breaks are dealt off a hash of the amateur and come on over the blow's
first fifth of a second, so a replay lies him the same; everything thrown is
dealt off the meeting's own seed.

**The impact cam cuts to a hard one** — with INJURIES on and the X-ray cam
off, live and in a replay — as it does to a body crushed on a solid
(`pwa/src/game/impact-people.ts` under `impact-forecast.ts`, held by
`tests/impact_people_test.ts`, photographed by `node
scripts/xray-preview.mjs --impact --scene=person-60,person-90`). Its read
ahead steps a copy of the player with the people on foot in it, so a
meeting with one of them comes out of the copy's own step; the crowd is not
copied (four hundred amateurs stepped five times a frame is a frame's
budget) but each amateur near the player's path is DEAD-RECKONED off where
he goes as the read begins and met on `clipCrowd`'s own geometry, the
outcome off `exchangeOf`. A meeting is the cam's when it kills or injures
the person or closes past 12.5 m/s (45 km/h, `PERSON_AHEAD.hard`): with the
injuries on that is every strike of a grown man from some 24 km/h. The
lens (`camera-impact.ts`) stands wider for it and a little ahead of the
meeting, its aim halfway between the strike and the player, so the one he
strikes, thrown on down his way, and the player are both in the frame.
Nothing is written to the run or the copy, so no digest moves. An amateur
who turns hard inside the read's second is met where he would have gone
straight: the cam may then cut to a meeting that does not come, and lets
go when it is late (`XRAY.late`), as for any strike that does not land.

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

## People on foot

The free ride's CIVILIANS ([civilians.md](civilians.md): the lift crew, the
patrol, the guests walking the base in ski boots, the terrace, the children
at play, and the village's DOG WALKERS) and the CREWS of the air ambulance,
the police and the ski patrol on its snowmobiles ([rescue.md](rescue.md),
[police.md](police.md)) are the same bodies to the skier as an amateur:
`engine/game/foot.ts`, held by `tests/civilian_body_hits_test.ts` and
`tests/foot_hitters_test.ts` and printed by `make body-hits` (`--who=`
amateur, civilian, crew, walker, patrol, sled, thrown, groomer, car).

- **Where they stand is the app's plan, handed in as DATA.** The civilians'
  plan is a few thousand lines of the app's (the places off every building,
  the roles, the routes round the base, the fires, the summer's cast); what
  the engine needs of it is small and closed-form, so the app hands it in
  before the first step, the way the rescue's calls are handed in
  (`foot-call.ts`' `peopled` → `withFoot`, `CreateGameOptions.foot`,
  `GameState.foot`): each person's place or the ROUTE he walks
  (`engine/game/foot-route.ts`, the engine's, which the app's plan walks
  too), his role's share out by the hour and his own keenness, and the sky
  clock's rate the hour runs at. `footAt` is where he stands at a moment —
  exactly where `civilianAt` draws him.
- **A dog walker** (the owner, and the child out with him) is a TRACK
  knotted off his walks (`dog-foot.ts`, `FootTrack`, `trackAt`): a knot at
  every change of leg — a stop, a kerb, a chat, set off again — and wherever
  the line he walks turns, so the owner read in straight lines between them
  is exactly where `dogWalkerAt` draws him (the child, eased round a corner
  beside the line, within a few centimetres, and swapping sides across a
  hairpin in a fifth of a second), with a gap while the household is at
  home and out by the hour as drawn (`DOG_HOURS`). A walk is dealt only as
  the clock comes to it (it waits at the kerbs on the traffic), so the
  tracks are knotted a couple of minutes ahead of the clock by the one door
  every host steps a run through (`crowd-calls.ts`' `stepRun` →
  `walkersAhead`) — each a prefix of the one way the plan has him on, so a
  replay meets the same walker whichever run knotted it further.
- **A crew member** is a TRACK sampled off his call's own plan every
  quarter second (`rescue-tracks.ts`' `crewTracks`, `RescueCall.crew`,
  `crewAt`), handed in with the call at a run's start (`rescue-book.ts`) and
  when a call is made or joined mid-run (`crowd-calls.ts`). The SKI PATROL
  on snowmobiles is sampled the same way off its scene's plan
  (`patrolTracks`, `sledCrewAt`), each man only while he is on foot — sat on
  a machine he is the machine's. A machine the skier takes changes the way
  back to it, which nothing sampled can know, so each patrolman's track
  names his machine and the moment the work no longer goes the same
  whichever is taken (`CrewTrack.sled`): past it the engine meets him only
  while his machine is as it was sampled. A replay's recipe carries the call
  (`recipeOf`), so a replay meets the same people at the same places.
- **The collision** past `PERSON_HIT.strike` is the amateur's: the exchange at
  the two real masses (`exchangeOf`, the person's mass `CROWD_SIZE`'s), the
  player slowed — or thrown past the crowd's own threshold — and struck on his
  body a step later (`personBlows` reads `GameState.foot.struck` beside the
  crowd's), the person thrown onto a ragdoll of his own the engine steps
  (`FootDown`) and, with INJURIES on, injured, killed and crushed on the same
  ladder. Under the strike speed the app's knock is the whole of it, as
  before. A person on foot is narrower than a skier (`PERSON_HIT.foot`), so
  he is met inside a skier's own reach of him.
- **What strikes them** is everything that moves among them and is the
  engine's (`foot.ts`' hitters):
  - the player on his skis (above);
  - HIS BODY THROWN, tumbling into them as a low round body of his own
    weight (`PERSON_HIT.foot.thrown`), past the same strike speed: slowed
    by what the blow took (every point of the ragdoll at once) and struck
    on his body by it, as on his skis;
  - his SNOWMOBILE: its mass with its rider's (`sledMass`), some 320 kg into
    a man of 85 — he takes nine tenths of the closing speed (killed from
    about 40 km/h, crushed at 60), the machine a fifth of it and keeps
    going, the rider not thrown and his body not dosed (the hood and the
    bars take it);
  - a PISTE MACHINE (`GROOMER.mass`, its footprint's box) and the TRAFFIC's
    cars, bus and bicycles (`VEHICLE_MASS`, each class's box), which never
    notice. A machine strikes past the blow a skier gives a grown man at the
    strike speed (`PERSON_HIT.foot.blow`, 3.4 m/s of his own change of
    speed), so twelve tonnes of steel at a walking pace knock a man down
    where a skier at that pace only shoves him. The player's body is not
    dosed — not even in the cab he drives — and a meeting he had nothing to
    do with (`StruckPerson.away`) is not felt and is heard from where it
    happened.
  The amateurs on the snow are met as before (`crowd.ts`); a struck event
  says what struck him (`by`: `thrown`, `groomer`, `car`).
- **After the blow** a person not hurt lies until his body is still, then is
  the app's knock again — he gets up and walks back (`civilian-knock.ts`) —
  and is no body to the engine for `PERSON_HIT.foot.back` (60 s) before he
  stands where his plan has him again. A hurt or dead one stays down for
  good, one of `casualtiesOf`'s (`who`: `civilian` — a dog walker too — or
  `crew`, `id` his key, the meeting's spot as `impact`, `cause` what struck
  him: `skier`, `sled`, `groomer`, `car`), for the rescue and the police to
  collect.
- **As drawn**: the view's knock is launched with the engine's exchange
  (`civilian-hits.ts`' `fromEngine`: the engine's body copied each frame), so
  the engine and the picture agree; with INJURIES on he lies broken and a
  crushed one flatter (`crowd-broken.ts`' `footHurtOf`, `breakPose`, drawn by
  `civilians-view.ts` — the dog walkers too — and, for a crew member,
  `rescue-view.ts` and `rescue-sleds-view.ts`), and the snow is the crowd's
  (`crowd-gore.ts` reads every meeting, `allStruck`). The civilians' clothes
  do not carry the blood the amateurs' do. `make gore ARGS=--sheet=civilian`
  photographs it.

| Run into at | A civilian, a dog walker or a crew member (INJURIES on) | The player | By the snowmobile |
| --- | --- | --- | --- |
| 30 km/h | injured, down for good | bruised: whiplash, ribs, shoulders | injured |
| 45 km/h | injured (a child killed) | down hurt: a broken neck, a concussion, a cracked pelvis | killed |
| 60 km/h | killed | thrown and dead: the neck, a flail chest, the belly torn | killed, crushed (0.9) |
| 90 km/h | killed and crushed (0.84) | thrown and dead | killed, crushed through |

| Struck by | A grown man (INJURIES on) | A child | The player |
| --- | --- | --- | --- |
| His body thrown at 30 km/h | knocked, up again | injured | the fall's own bruises |
| ... at 45 km/h | injured | injured | a sprained neck, a cracked pelvis |
| ... at 60 km/h | injured | killed | dead (the throw and the blow) |
| ... at 90 km/h | killed, crushed (0.38) | killed, crushed through | dead |
| A piste machine at 9 km/h | the app's shove | the app's shove | untouched |
| ... at 12 km/h (working) | knocked, up again | knocked, up again | untouched |
| ... at 22 km/h (driven) | injured | injured | untouched |
| A car at 15 km/h | injured | injured | untouched |
| ... at 25 km/h (the village) | injured | injured | untouched |
| ... at 45 km/h (the road out) | killed, crushed (0.70) | killed, crushed (0.78) | untouched |

With INJURIES off every one of them is knocked down and gets up.

**Not bodies to the engine yet:** the dogs themselves (a dog the skier
meets is the view's, and goes on walking on its lead), a dog walker on a
run stepped past `stepRun` (the engine stepped bare, as the suite and the
sim do, meets the walkers only as far as their tracks were knotted), a
patrolman past the work's end whose machine was taken after his track was
sampled (the view's alone till the call is booked again), and an amateur
stood on the snow met by a piste machine or the traffic (the crowd's own;
lying, he is met — below). A crew member struck leaves his call's work to
the others as its plan has it: the scoop and the carry go on with the men
still standing.

## A body lying on the snow

A person ALREADY DOWN — an amateur on his ragdoll (knocked and about to
get up, hurt, killed), a civilian, a dog walker, a crew member or a
soldier the engine has down (`FootDown`) — is a low, solid body to
everything that goes over him: the player on his skis, his board or the
bike, the snowmobile he rides, a piste machine and the traffic
(`engine/game/lying.ts`, the numbers in `PERSON_HIT.lying`, held by
`tests/lying_bodies_test.ts`, printed by `make body-hits ARGS=--who=lying`).
What the research says, restated in our own words:

- **A person lying is a low hump**: an adult's trunk lies some 22–25 cm
  deep, the limbs half that.
- **Skis ride up over a trunk; a tip hooks a limb.** A ski's front rides
  up a hump; what throws a skier is a tip caught under something lying
  across it — the forward fall over the tips any caught tip gives.
- **A tracked machine on snow presses about as lightly as another**: a
  loaded snowmobile some 5 kPa on its track, a working piste machine some
  5.4 kPa (a walker's foot is 60–80 kPa). Over a hump the track is held off
  the snow either side, and the body carries the stretch it holds up. Riders
  run over by a snowmobile on record came away with broken bones and head
  injuries, some critical, a few dead; a foot caught in a moving track was
  torn off.
- **Run over by a wheel, the weight on the wheel does the harm** more than
  the speed: the chest, the belly and the pelvis are crushed, and most of
  the children killed under a car were run over at a crawl.

What the game makes of it: the body is its ragdoll's thirteen points, each
a sphere of its own radius with the limbs' middles between them (a low
capsule set), against the footprint of what goes over it — the skis' round
the boots (`skis`), a machine's box. Once a PASS (nothing of that kind
touching him for `gap` s before):

- **Ridden over**: the thing going over carries along `ride` (0.4) of the
  mass under its path and the two share that impulse by their masses — the
  rider slowed by it and hopped up off it (`hop`), the body pushed and
  dragged on its points under the path. Along his length a body slows a
  skier twice what it does across it.
- **A tip caught**: on skis, a limb lying across them (`across`) met in
  their front `tip` m at `catchAt` (7 m/s, 25 km/h) or more throws him over
  it (the `skier` cause); slower, the ski shoves it aside.
- **The weight on him** (INJURIES on): the push's change of speed in him
  plus `press` m/s for every 100 kg he bears past `hold` (30 kg: a man knelt
  on him) — a skier's own weight on his edges, a tracked machine's ground
  pressure over its track's width and the stretch the hump holds up (some
  230 kg under the snowmobile, 925 under a piste machine), a car's on one
  wheel — on `person-hit.ts`' ladder: a dead one crushed further, an
  injured one killed past `kill`, a knocked one injured past `injure` (he
  stays down for good, `casualtiesOf`'s). With them off nobody is hurt: the
  bump and the push are all of it.
- **What is felt and heard**: the rider's shins are struck through
  `body-person.ts` (the body lies under `top`); the snowmobile's rider and a
  machine's driver are not. Every pass is filed beside the meetings with
  people stood (`CrowdState.struck`, `FootState.struck`, marked `lying`)
  and is a `struck` event marked `lying`, so the sound (a thud by the speed
  it took, `route.ts`), the rumble and the impact cam take it as any
  meeting. An amateur lying is no longer shouldered as a man stood
  (`clipCrowd` leaves him to `lying.ts`).

`make body-hits ARGS=--who=lying` (a grown civilian on seed 3, over him 4 m
down the line):

| Gone over by | Lying | At | Thrown | Speed taken | Pushed | INJURIES on |
| --- | --- | --- | --- | --- | --- | --- |
| skis | across, his middle on the line | 20 / 45 / 90 km/h | no | 2.8 / 5.3 / 10.5 km/h | 0.2 / 0.5 / 1.5 m | a knocked man injured at 90 |
| skis | along the line | 20 / 45 / 90 km/h | no | 5.4 / 11.0 / 21.9 km/h | 0.3 / 1.3 / 4.3 m | a knocked man injured from 45 |
| skis | across, his legs under the tips | 20 / 45 / 90 km/h | from 45 | 1.1 / 2.0 / 4.1 km/h | 0.1–0.3 m | — |
| the snowmobile | across | 20 / 45 / 90 km/h | never | 1.6 / 3.7 / 7.5 km/h | 0.4 / 1.9 / 5.4 m | a knocked man injured at any speed; an injured one killed, a dead one crushed (0.54), at 90 |
| a piste machine | across | 9 / 22 km/h | — | — | 0.1 / 0.8 m | killed and crushed through at either |

With INJURIES off every row is the same bump and push, and nobody is hurt.
`make gore ARGS=--sheet=lying` photographs a dead man gone over at 60 km/h
on skis and on the snowmobile. Still passed through: the player's own body
thrown (his ragdoll meets the people stood, not the ones lying), an
amateur lying met by another amateur or a rival, and in the impact cam's
read ahead an amateur lying (the crowd is not copied; the people on foot
are).
