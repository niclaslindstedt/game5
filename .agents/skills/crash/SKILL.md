---
name: crash
description: "Use when working on the skier PAST SAVING and OFF HIS SKIS — the ways he is thrown (a trunk met hard, a landing over the tips, the body slammed down on the snow, a fall at speed, the legs folded, a caught edge — the high-side) and only those — a professional rides out the rest, the near fall kept as a SAVE the figure plays — and the RESILIENCE knob each skier carries (the player a professional, each rival dealt his own), his body tumbling on the snow until the reset while the skis go on without him (the yard sale), the skier BOGGED in deep powder and poled and rocked back out, and what a blow costs when damage is on (a dulled edge, hurt legs) — and THE BODY: every blow's g off the stop the body and the snow give it, the injuries it does part by part (a ladder per part on the Abbreviated Injury Scale, a risk curve drawn off a hash), the injury severity score, and the HUD's body and g meter that read it. Owns `engine/game/crash.ts`, `trench.ts`, `damage.ts`, `body.ts` and `defs/anatomy.ts`, the `TUNING.crash` / `.trench` / `.damage` / `.injury` blocks, the `wipeout` / `save` / `stuck` / `damage` / `injury` events, `SkierState.body`, `SkierState.save` / `.resilience` and the figure's `skier-save.ts`, and the ride lab's `tree`, `tree-glance`, `shoulder`, `nose-save`, `nose-in`, `drop-side`, `rollover`, `catch`, `catch-held`, `stuck` and `stuck-held` scenarios (`--resilience` skis any of them as a club skier). Not the contact that STARTS a crash (`collision` — the trunk, the rival, the edge of the map) and not the fall's own physics (`ski-physics` — the body carries a skier over)."
---

# The crash

This skill owns **one question**: what happens to the skier and his skis
once a mistake is past saving — and how he gets going again?

Three modules answer it, and the split matters:

- **`engine/game/crash.ts`** — THE WIPEOUT. `wipeoutCause` reads the step
  just taken (the `hit` and `land` events, the body's attitude against the
  snow, the sideways slip at the stations) and names a cause or none; the
  throw puts the skier off onto a body of his own (`SkierState.thrown`, a
  `Thrown`); `stepThrown` moves that body — a RAGDOLL
  (`engine/game/ragdoll.ts`): thirteen jointed points, each meeting the snow
  (the floor, friction, the powder's plough) and the trunks on its own — and
  `crashOver` says when the reset may stand him back up. Knobs in
  `TUNING.crash` (`.body` is the skier's measures, the same bones
  `skier-pose.ts`'s `BODY` draws — `tests/crash_test.ts` holds them
  together; `.tone` the muscles; `.over` which way each cause throws him;
  `tests/ragdoll_test.ts` holds the body to its joints and its laws).
- **`engine/game/trench.ts`** — BOGGED IN DEEP POWDER. `stepTrench` sinks a
  skier stopped in powder who is poling going nowhere
  (`SkierState.trench`, m — how far the hole under his skis is pressed past
  the snow's own sink) and packs it back as he rocks or moves out;
  `skier.ts` adds the trench to the skis' support and takes a share of the
  poles' push with it (`trenchGrip`). Knobs in `TUNING.trench`.
- **`engine/game/damage.ts`** — WHAT A BLOW COSTS, only on a run that asked
  for it (`GameState.damage`). `takeDamage` charges this step's blows to the
  two skis' edges and the legs (`SkierState.damage`); `skier.ts` reads five
  shares off it (`skiPull`, `skiBite`, `springShare`, `dampShare`,
  `harshShare`). Knobs in `TUNING.damage`.

- **`engine/game/body.ts`** — WHAT HIS BODY TAKES, on every run, as a
  readout nothing in the physics reads. Every blow the step already
  measured — a landing's load, a trunk's closing speed, `bodyHit`, every
  ragdoll point meeting the snow or a trunk (`Thrown.impacts`, `.struck`,
  written by `stepRagdoll`), a rival's bump (`feelBumps`) — is a STOP over
  the part's own give and the snow's (`blowOf`, `snowGive`), in g; each of
  the twenty parts reads its LADDER (`defs/anatomy.ts`'s `INJURIES`) against
  the doses of each mechanism (`blunt`, `load`, `drawer`, `twist`, `bend`)
  on a log-logistic risk curve (`riskOf`) drawn off a hash; `severityOf`
  sums the whole body. Every fracture names its BONES (`BONES`,
  `bonesOf`) and whether it is a hairline or a break (`fracturesOf`) — a
  break graded simple, wedge or shattered by the ENERGY that did it over
  its even chance's (`Injury.energy`, `energyOver`, `injury.comminute`),
  raised by every harder blow on the part after it;
  `saidOf` keeps a fracture out of the HUD's words, since the figure shows
  it on the bone. An injury to an ORGAN names it (`InjuryDef.organs`, a
  paired one on the side the blow came from, `Injury.side`) and paints
  that organ in the figure (`organsOf`); the trunk's organs take a
  landing's deceleration too (`load` on the chest and the abdomen). A reset MENDS the body (`mendBody`, from `resetSkier`).
  The HUD's half is `body-tile.ts` (DOM-free), `body-figure.ts` and the
  generated `body-model.ts`, `hud-body.tsx` and `hud-gforce.tsx` — judged
  with `make damage`, the figure made again from the 3D body with
  `make hud-body`.
  Knobs in `TUNING.injury`.

`run.ts` is where they meet the step: with the skier off, the skis are
stepped under the neutral input, his body under `stepThrown`, the course
takes nothing, and the reset comes off `crashOver`; a bogged skier's
automatic reset waits `trench.holdFor` instead of `reset.stuckFor`.

The design came from the rally game's (`game2`) `crash` skill and its
`roll.ts`, by way of the snowmobile game (`game4`): a crash is judged on a
bench, one mechanism at a time, and a fall is the far end of the handling
model rather than its own system. What is ours alone is the caught edge, the
skis going on without their skier, and the snow he lands in — and the bog,
which is snow's own way of stopping a skier.

**Read this skill's lessons first** —
`npx ogf-skill-lessons crash --list`.

| Load beside this one | For |
| --- | --- |
| `ski-physics` | the fall itself, the caught edge's slip, the landing's cost, the sink the bog deepens |
| `collision` | the trunk and the rival that start a crash, the reset that ends one |
| `skier` | the figure thrown: `ragdollPose` off `Thrown.points` and how `skis-body.ts` lays him |
| `visual-effects` | the burst, the puffs and the gouge a body leaves, the pulse |
| `test-scenario` | staging a crash on the synthetic maps with `placeRun` |

## The instrument: `make ride`

A crash is over in two seconds and in the game it is mostly snow in the air.
So stage it and read the numbers:

```sh
make ride SCENARIO=tree          # a trunk at 50 km/h: thrown, how far, when stood up
make ride SCENARIO=tree-glance   # a trunk clipped slowly: a hit held on through
make ride SCENARIO=nose-in       # a landing 40 degrees over the tips at 60 km/h
make ride SCENARIO=rollover      # thrown onto his side at 70 km/h — a fall at speed
make ride SCENARIO=catch         # an edge caught: the skis flung across at 70 km/h, then stood on their edge — the high-side
make ride SCENARIO=stuck         # poling from rest in a metre of fresh snow: bogged, rocked out, skied off
make ride SCENARIO=stuck-held    # the same with the push held: the reset
```

Every wipeout scenario prints the same line — the cause and when, the speed,
how far the skier slid from his skis, how many turns he tumbled, when the
reset came, the run's HARDEST blow in g and every INJURY taken (the
engine's names with their AIS rank) — and every flight and landing
scenario the last two as well. The bog's prints when he sank, how deep, when he was out and
whether the engine had to reset him. Then look: `make world
ARGS=--views=wipeout,wipeout-lie` puts the player into the nearest trunk
through the game's own renderer and photographs the skier in the air and
where he came to rest, with the gouge his slide cut and the skis lying where
they stopped.

**`make sim` is the no-regression check, and its `wipe` column must read
0** (seed 10's battering spot aside, a trap on the map that predates the
professional thresholds). The bot on every seed on every pair lands at most a few degrees
tips-down and well under the impact that throws him, never goes past half
over, never catches an edge and meets no trunk — the thresholds sit well
beyond all of it (`TUNING.crash`'s comment says by how much). A wipeout in
the solo table is a threshold that has come down into clean skiing, or a bot
that has got worse. In a race (`--rivals 3`) the field shoulders skiers into
the woods and a wipeout there is honest.

### The injury lab: `make injuries`

The body's own instrument. Every scenario in
`tests/support/injury-scenarios.ts` stages the skier at the moment before a
blow on a flat bench (`tests/support/injury-stage.ts`): THROWN and posed —
head first, on his back, a side, his hands, a shoulder, his seat, feet
first — and driven into the snow by its kind (powder, soft, the groomer,
ice) or into a solid by what it is made of (a trunk, a lift tower's bare
steel or its pad, a cabin's log wall); or ON HIS SKIS off a cliff onto the
flat, in the back seat, over the tips, an edge caught, into a solid. Each
is drawn `TRIALS` times (each a run seed of its own) and its rates held to
the groups it EXPECTS (half the trials or more), the injuries it must
NEVER do (an eighth at most), the bones it must leave SHATTERED and the
median worst AIS. `tests/injury_lab_test.ts` holds the same rows, and the
lab's last line lists the injuries no scenario expects yet — a new rung on
a ladder owes a moment that does it.

```sh
make injuries                                # the table; exits non-zero on a miss
make injuries ARGS="--only=head-ice --list"  # every injury's rate, the cause, the landing's g
make injuries ARGS=--json                    # previews/injuries.json, the before
make injuries ARGS="--compare previews/injuries.json"
```

When a moment misses, read its `--list` row before touching a number: a
miss is as often the MOMENT staged wrong (the body not meeting what it was
meant to, a flight too short to count as one) as the model wrong. Fix the
model where a real body would be hurt otherwise, and say which research
row it answers to.

## The rules

- **A WIPEOUT IS A THRESHOLD ON WHAT THE STEP ALREADY MEASURED.** The trunk's
  closing speed is the `hit` event's, the landing's impact the `land`
  event's, the attitude the body's own quaternion against the snow's normal,
  the caught edge the `sideSlip` the grip already computed. Nothing here
  re-measures a contact; a cause that needs a new measurement belongs in the
  module that makes the contact.
- **NO CLEAN RUN CROSSES A THRESHOLD.** Before moving one, run the bot over
  the corpus on every pair and print the distribution of what it meets (the
  tips' angle and the impact at every landing, the worst attitude, the worst
  slip at full edge, every trunk). The margin between that and the
  threshold is the point of the number.
- **OVER IS OVER AGAINST THE SNOW, ON THE SNOW, AND HELD.** A skier
  traversing a steep face stands far off vertical while perfectly upright on
  the slope: read his up against the ground's normal, never against the
  sky, and only while he is ON the snow (`rolledFor`, not `overFor`) for
  `crash.rollHold`. A skier turning over in the air has not fallen — the
  landing decides — and one who clips a hip on the way round and comes back
  onto his skis skis away.
- **JUDGE THE LANDING THAT ENDS A FLIGHT, NEVER ITS REBOUND.** A hard
  touchdown hands the skier back up for a fraction of a second and the
  `land` event fires again when he comes down; that second contact is the
  same landing, and its tips' angle is the slap of the legs, not a dive.
  `crash.noseAir` keeps the over-the-tips to flights that were flights.
  Before shipping a threshold, ski the stock `kicker` on every pair (`make
  ride SCENARIO=kicker ARGS="--skis all"`, `crash_test`'s kicker case): an
  ordinary jump overshot must be skied out.
- **A FALL IS WHAT THE BODY CANNOT STAND UP OUT OF.** The skier goes down
  when his hips, shoulders or helmet hit the snow (`bodyHit`, off the hull's
  own contacts), when he lies over on it at speed, when a landing's load is
  past what legs hold, when a trunk is square in front of his skis, when the
  tips spear the snow, or when an edge bites while the snow slides across
  it — never because a landing on his skis was crooked. Short of a fall,
  `noteSave` keeps how near it came for the figure (`skier-save.ts`) — sized
  against the skier's OWN thresholds, so a club skier's saves come nearer.
- **RESILIENCE IS ONE KNOB, AND 1 IS THE PRO'S NUMBER TO THE BIT.** Every
  threshold is read through `crashLimit` (the professional's `TUNING.crash`
  row at 1, `crash.club` at 0); the player is 1, each rival is dealt his own
  off a stream of its own (`rivals.ts`' `GRIT_SALT`) so no other draw moves.
  A new threshold gets a club row beside it, and an easier one.
- **THE CAUGHT EDGE NEEDS BOTH: THE EDGE OVER AND THE SNOW SLIDING ACROSS
  IT.** A flat ski slides sideways all day — a snowplough is exactly that —
  and a ski well over on its edge holds; it is the two together past
  `crash.catchSlip` and `crash.catchEdge` that is a high-side (the bot
  stands its edge down from `skier.slipSpeed` / `.slipEdge`, well short). A threshold on
  the slip alone throws every skier who skids; on the edge alone every skier
  who carves.
- **WHAT CATCHES A BODY KEEPS IT.** A downhill's A-net (`nets.ts`) is the
  one thing on the mountain that catches a thrown skier rather than
  stopping him: a drive past `crash.netSpeed` across it is the `net`
  wipeout, and `catchInNets` (run after `stepThrown`, so its correction is
  the step's last word) takes every ragdoll point and ski end past the line
  into the mesh — a spring and damper over the course's `nets.give`, a drag
  along it and UP it, nothing down it (the throw already dropped his fall
  down the slope, so a drag on the vertical floats him level while the
  ground falls away), a sag back no further than `pocket`. A ski gets ONE
  hook chance, by the end that reaches the mesh first (`LoneSki.hooked`,
  `lone-skis.ts` holds that end and swings the other); both ends hooked
  freezes it flat in mid-air. LOOK with `make world ARGS="--downhill
  --views=net-0.4,net-1,net-3"`.
- **THE SKIER CARRIES THE WAY HE HAD BEFORE THE BLOW.** A trunk stops the
  skis in one step; the velocity the skier leaves with is the one from
  before that step (`run.ts` keeps it), times `keep`. Read after the trunk,
  he would drop off stopped skis.
- **A BODY FALLS, A SACK DROPS.** The ragdoll's limbs are driven by
  muscle (`crash.tone`): braced in the air — the arms thrown out ahead,
  the legs spread, held in the TRUNK'S frame — and slack once he is down.
  The drive is internal: whatever push and twist it would put on the
  whole body is taken back off (`drive`), so no muscle ever turns the man
  in the air, and a limb planted in the snow yields. Never tuck the brace
  (a body drawn in spins up like a diver) and never aim it at the world's
  down (the hands chase it round and windmill the trunk the other way).
- **THE SOLVER GIVES NO ENERGY, THE SNOW IS A PATCH.** A joint limit put
  right without velocity and then held at the bones' length is a kick out
  of nowhere — `calm` takes back whatever a joint pass added. And the
  snow's friction and plough are a patch of back or side, not points to
  pivot over (`crash.patch`, `spinDrag`): a body that cartwheels down a
  face is snow acting at a point. Watch the fall frame by frame (`make
  world ARGS=--views=fall-0.2,fall-0.5,fall-1,fall-2`) on a steep powder
  face, not only on the synthetic slope — seed 38's trunk is the case.
- **A CRASH DRAWS NOTHING FROM THE STREAM.** The tumble, the throw and the
  slide are functions of the moment, so a crash replays exactly and the sim's
  digests do not move when one is added. Anything random-looking in the
  picture is the renderer's, off its own seed.
- **WITH THE SKIER OFF, THE SKIS ARE LET GO AND TAKE NOTHING.** No gate,
  the automatic reset's clocks quiet; and no PAIR any more — each ski is a
  body of its own (`lone-skis.ts`, `Thrown.skis`), the one under him held
  in its binding a moment longer, the two wrenched apart off a hash, never
  the stream (a landing over the tips gives them the tip-over the digging
  tips would, `skiKick`). A ski SLIDES, never bounces (the way into the
  snow taken whole), never sinks (it is built to rise: no end and not its
  middle under the snow, and the app lays it on the drawn loose cover),
  and rights itself onto its base; `make world ARGS=--views=yard-0.4,yard-3`
  frames him and both skis from over the fall; the reset is `crashOver`'s — `lieMin`
  off and `lieStill` lain still (`Thrown.still`), the beat the app's death
  cam (`camera-death.ts`) rises over him on; cut it and the camera has
  nothing to rise into. A skier who presses reset gets it at once.
- **THE BOG DIGS ONLY WHEN STUCK, AND IS PACKED BY MOVING WEIGHT.** It grows
  while the skier is poling (the tuck held) at a crawl in powder, for
  `trench.after` s first — so no push off out of a powder start ever gets
  there; it shrinks by the metre his weight moves (`hipAft`, `hipRight` —
  the lean and the edge thrown about) and by the way made good past
  `creep`. A skier rocking with the poles pinned is sinking as fast as he
  packs: that is the lesson the mechanic teaches.
- **A SOUND PAIR READS EXACTLY 0 AND EXACTLY 1.** Every damage share is
  `1 - k · d`, every pull `k · (dR - dL)`, and the bog's grip and sink terms
  the same, so a run without damage and out of any hole is the same
  arithmetic to the last bit — which is why no digest moved when they landed.
  Keep it so: a share written as `(1 - d) ** k` or a clamp with a floor is a
  digest that moves for no reason.
- **A BLOW IS A STOP, AND THE SNOW IS HALF OF IT.** The g of a blow is
  v² / 2s peaked, `s` the part's give plus what it met — never the solver's
  one-step change of velocity, which is a hundred g for anything the snow
  puts back on its surface. The snow's give is fitted to the measured head
  drops on snow (`tests/body_test.ts` holds the fit); keep the fit when a
  give moves, and let the snow's depth reach an injury THROUGH the give,
  never through a rule of its own.
- **NO CLEAN LANDING HURTS, AND THE LOTTERY IS CAPPED.** Under half an
  injury's dose there is no chance at all (`injury.floor`), so a landing a
  pro calls clean (`landing.clean`, square on the skis) hurts nothing on any
  pair (`body_test`'s kicker case); and of all a step's draws only the worst
  `perBlow` are taken — a body thrown into a trunk meets it with every point
  at once, and fourteen breaks from one blow is a lottery, not a body. Run
  the bot over the corpus (`previews/` probe over `simulateRun` with
  `keepEvents`) before moving a threshold: injuries there should come only
  from a harsh landing or seed 10's battering spot.
- **A LIMB'S WHIP IS NOT A BLOW ON THE BODY.** The g meter bills the head
  and the trunk; a ragdoll's hand or elbow flung into a trunk at twice his
  speed is a broken bone on its own ladder, not a 900 g headline. Limbs
  carry their joints' fold in their give.
- **THE BODY DRAWS NOTHING FROM THE STREAM.** Every chance is a hash of the
  step, the part and the map, so a run replays injury for injury, a ghost
  and a replay hurt where the skier did, and `make sim`'s digests do not move
  — a body change that moves a digest has reached into the physics.
- **DAMAGE IS THE PLAYER'S AND NEVER A RIVAL'S.** `createRivals` deals every
  rival `damage: false`; the field is never slowed by a setting the player
  chose.

## Workflow

1. **Take the baseline first.** `make injuries ARGS=--json` for anything
   the body reads, `make ride` on the crash and bog scenarios
   and `kicker --skis all` (an ordinary overshot jump must be skied out), and
   `make sim`, before the first edit.
2. **Find WHICH STEP decided it.** Print every step's cause candidate —
   impact, the tips' angle against the snow, up against the normal,
   `sideSlip` against the edge, `overFor`, the trench and its clock — around
   the moment; a crash that fired where it should not is one threshold met
   on one step.
3. **Tune defs, with the bot's distribution beside the number.**
4. **Re-run the lab, then the tests** —
   `npx vitest run tests/crash_test.ts tests/ragdoll_test.ts tests/body_test.ts tests/injury_lab_test.ts tests/collision_test.ts tests/course_test.ts tests/simulation_test.ts tests/determinism_test.ts tests/hud_test.ts tests/rumble_test.ts`.
5. **LOOK.** `make world ARGS=--views=wipeout,wipeout-lie`, and the fall
   as frames — `ARGS=--views=fall-0.2,fall-0.4,fall-0.8,fall-1.3,fall-2`,
   one lens beside him — against the same views on `main`.
6. Docs: `docs/riding.md` ("The wipeout", "Stuck in powder", "Damage",
   "The body").

## Skill self-improvement

Record lessons under `.agents/skills/crash/.lessons/` via the
**`skill-reflection`** skill: a threshold a clean run crossed and the
measurement that showed it, a crash that moved a digest, a bog a push-off
fell into — the class of failure, not the one-off.
