---
name: bot-improvement
description: "Use when improving the BOT SKIER (engine/sim/bot.ts) — how the bot reads the piste and skis it: the aim point down the centreline, the edge it asks for, the skid for the bends it cannot carve and the kickers it can see coming, the tuck on the straights, the push out of the start gate, levelling to the landing slope in the air, dodging a trunk, asking for a reset — and the RIVALS, which are the same bot under a dealt pace. Measured with `make sim`. Drives the iterate loop: reproduce the bad behaviour at a known seed, form a hypothesis from the map and the report's counts, edit the decision code, re-measure. The target is HUMAN capability — a competent skier, never a superhuman one and never a handicapped one."
---

# Bot improvement

The bot in `engine/sim/bot.ts` is one source of truth: the headless simulator
(`engine/sim/simulate.ts`), the balance CLI (`make sim`), the sim tests, the
front door's attract run, the world lab AND every rival in a race all ski
the SAME `botInput(state, profile) → SkierInput`. Improving the bot means
improving that function so a botted run skis like a **competent human**.
The bot is also the balance instrument: if it stops taking kickers, landing
regressions stop showing in the sim table, so its competence is load-bearing
for the whole measuring workflow — and since the field IS the bot, a bot fix
is also a change to how hard the player's race is.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons bot-improvement --list`. Load
**`skill-reflection`** at both ends of the session.

## The target: human capability, no handicaps

- **Do** read the piste ahead the way a skier does, skid for the bend it can
  see coming at the grip an edge has, carry speed onto a kicker it can land,
  level the body to the slope it will land on, steer round a trunk, tuck on
  a straight and stand up for a bend, and get off the start line onto the
  piste skiing DOWN it.
- **Don't** add artificial imperfection (edge jitter, reaction delay, rubber
  banding). We want the bot to STOP doing dumb things, not to fake being
  bad. Difficulty in the field is the dealt PACE (`Rival.pace`, the tuck it
  is allowed), never a worse decision.
- **Don't** let it do what a human never would: brake with the grip a ski
  does not have, see through a crest, edge in the air as though the skis
  still bit, carve tighter than the pair's sidecut can.

If a competent skier wouldn't do it, the bot shouldn't. That is the whole
spec.

## Determinism is non-negotiable

The bot is a PURE consumer of `GameState`: it never mutates it and never
draws from the state's RNG, so a botted run is exactly as reproducible as a
human's (`tests/simulation_test.ts`, `determinism_test.ts`).

- No `Math.random()`, no wall clock, no reads of the state's RNG.
- Everything it knows is in the `GameState` and the level. A memory it needs
  (a kicker's flown speed) is cached per LEVEL or per state in a module-level
  `WeakMap` — never a field on `GameState`.
- It **never reaches into physics internals** — it reads the state the HUD
  reads and produces the input a thumb produces; what the skier CAN do it
  asks `engine/game/limits.ts` (`cornerGrip`, `brakeDecel`, `edgeLockAt`,
  `carveCurvature`, `terminalSpeed`), the same numbers the physics applies.
  A bot planning off a number that only resembles the physics' is a skier
  on a different pair.
- Where it is on the piste is `nearestTrackPoint` (`mapgen/query.ts`) — the
  one answer, never a second walk.

## The current skiing model (so you don't re-derive it)

`docs/simulation.md` ("The bot") is the long-form account; in short:

1. **Where it is**: the nearest point of the piste, restricted to the stretch
   between the last gate taken and the one owed — so a traverse's other leg
   is never mistaken for its own.
2. **What it steers at**: a point `lookBase` + `lookPerSpeed`·v down the
   centreline — or down the LANE it is handed (`botInput`'s third argument:
   a rival's own slot's offset, `Rival.lane`, held in from the edge by
   `LANE_MARGIN` + `LANE_DRIFT`·v, so four skiers off one line do not funnel
   into single file on the player) — against the heading its yaw rate is carrying it to
   (`yawLead`), turned into an EDGE through the pair's own curvature; in
   powder it reads further ahead and asks for less (`powderLead`,
   `powderEase`), because a ski turns there off its base and the roll.
3. **Off the start line**: poles out of the gate (the tuck held under
   `poles.speed`), aims onto the piste SHORT of the start gate (`entryShare`,
   `entryMin`, `entryMax`).
4. **How fast**: for every bend within braking reach, the speed its curvature
   allows at `cornerShare` of the corner grip, less what a skid at
   `brakeShare` can take off; for every piste kicker, the fastest it can
   leave the lip and still land on the landing under `kickerMargin` of the
   harsh speed (flown once per kicker over the real snow); never under
   `crawl`. Over that it skids; near it it stands up; under it, tucked.
5. **In the air**: levels the pitch to the slope ahead with the lean
   (`airGain`, `airDamp`).
6. **Trees**: moves its aim `dodge` off a trunk inside `treeCorridor` within
   `treeLook`.
7. **Giving up**: asks for a reset after `giveUpAfter` s without a gate.

Every number is a field of `BotProfile`, with its unit; `SKIER_BOT` is the
one profile. A second profile is data handed to `botInput`, never a fork of
the decision function.

## The iterate loop

1. **Reproduce.** `make sim SEEDS=<N>` at the failing seed — read the row
   (fin, time, trees, resets, missed, harsh).
2. **Look at the geometry.** `make level SEED=<N>` — what the bot fought (a
   kicker after a bend? a trunk near the line? a headwall into a traverse?)
   before hypothesising. A failure on legal geometry is a bot bug; illegal
   geometry is the generator's (`mapgen-improvement` — and its analyzer
   should have caught it; say so).
3. **Watch it** when the question is style rather than survival:
   `make world SEED=<N>` photographs the bot's own run (the world lab skis
   the player's pair with the bot), and `simulateRun(seed, { keepEvents: true
   })` lists every event with its time.
4. **Hypothesise, then edit** `engine/sim/bot.ts`.
5. **Re-measure.** The failing seed first, then the full sweep (`--count 20`),
   and `--rivals 3` if the field is touched. One lucky seed proves nothing. A
   "bot fix" that moves the balance is retuning the instrument mid-experiment
   — say so in the PR.
6. **Run the sim tests** — `npx vitest run tests/simulation_test.ts
   tests/determinism_test.ts tests/rivals_test.ts`.

## The traps

- **The grip it plans with is the physics' grip.** Plan a bend off a
  friction the snow does not have and the bot overcooks every bend on the
  groomer and crawls in powder. `cornerGrip` and `brakeDecel` blend by
  `packed` exactly as the physics does, and the radius it can hold is the
  pair's (`carveCurvature`) — a downhill ski on a slalom's line skids.
- **A kicker is planned by FLYING it, not by a formula.** The landing's
  harshness depends on the real snow past the lip; a closed-form range
  ignores the landing's own slope.
- **Levelling in the air is what keeps `hrsh` near zero.** A bot that stops
  levelling reads as a landing-model regression that is not one.
- **The tuck is the throttle, and it is not free.** A bot tucked into a bend
  has a higher CoG's worth of roll to lose and no angulation; it must stand
  up before the edge goes over, or a good bend reads as a grip bug.
- **The field is the bot.** A change here changes how every rival skis the
  player's race; the pace band is the dial for how hard they are.

## After a change

- The sim tests green; the `make sim` table in the PR (before/after).
- A bot change is a changelog call, not a `no-changelog` reflex: the bot
  skis every rival the player races, so a change a player would notice in
  the field gets a fragment.
- `docs/simulation.md`'s bot section; keep it in step.
- Load **`skill-reflection`** before committing.
