---
name: crowd
description: "Use when working on THE CROWD — the free ride's amateur skiers out on the ski area: who is out there and in what groups (families, friends, ski schools, the lot down from the hut), the knobs that make each one himself (skill, aggression, off-piste, turn style and width, wobble, the stopper, the jumper), how they ski the resort's runs and ride the lifts, how crowded each colour is, how the player meets them (the bump, the knock-down, the `skier` wipeout), and how they are DRAWN — eight procedural bodies at three cuts, posed by morph targets solved from the player's own pose, dressed per instance. Owns `engine/game/crowd.ts`, `engine/game/defs/crowd.ts`, `pwa/src/game/crowd-rig.ts`, `crowd-shapes.ts`, `crowd-dress.ts`, `crowd-view.ts`, and `make crowd`."
---

# The crowd: the free ride's amateurs

A resort on a good day is hundreds of people, and the free ride's ski area
(R25–R30) is a resort. The crowd is them: rough, cheap, deterministic, and
there to make the mountain feel alive — not rivals, not a field, never
skied by the skier's physics.

**Read this skill's lessons first** — `npx ogf-skill-lessons crowd --list`.
Load **`skill-reflection`** at both ends and **`write-code`** beside this one.

## Where it lives

| Piece | File |
| --- | --- |
| Who is out there: the bodies, the kinds and their knob bands, the turn styles, the group kinds, the crowd's numbers (how many, how crowded each colour, the lift, the speeds, falls, stops, off-piste, kickers, the knock) | `engine/game/defs/crowd.ts` (`CROWD`, `CROWD_KINDS`, `CROWD_GROUPS`, `TURN_STYLES`, `CROWD_SIZE`) |
| The network they ski (`crowdNet`), dealing them (`createCrowd`), their step and their decisions (`stepCrowd`), the player against them (`clipCrowd`) | `engine/game/crowd.ts` |
| What a run asks for | `RunRules.crowd` (`freeRules` deals `CROWD.count`; every measured run 0), `createGame`'s `crowd` |
| The state | `Amateur`, `CrowdGroup`, `CrowdState`, `GameState.crowd` in `state.ts`; the `bump` event's `amateur`, the `skier` crash cause |
| The skeleton in every pose — the PLAYER'S `skierPose`, sized to each body — and the weights an amateur is drawn at (`dialsOf`) | `pwa/src/game/crowd-rig.ts` (three-free) |
| The figures: eight bodies × three cuts, the poses as relative morph targets, the palette graft | `pwa/src/game/crowd-shapes.ts` |
| The kit each is dealt | `pwa/src/game/crowd-dress.ts` (three-free) |
| The instanced draw | `pwa/src/game/crowd-view.ts`, hung on `renderer.ts` |

## The rules

- **ROUGH ON PURPOSE.** An amateur is `(run, s, d)` — how far down his run
  and how far right of its line — with a speed gravity along the run's pitch
  feeds and the snow, the air and the scrub take. He steers for a LATERAL
  (his style's wave across the piste, as a function of his arc, so a ski
  school's children in the instructor's wave ski in his track) and decides
  only every `CROWD.think` s. Keep it so: a few hundred of them must cost
  the step less than one rival. Measure the step with and without a crowd
  (`tests/crowd_test.ts` rides one; a probe timing `step` is ten lines).
- **HIS OWN STREAM.** Everything the crowd draws comes off
  `CrowdState.rng` (`CROWD_SALT`), never `state.rng` — a crowd moves no
  digest, and `tests/crowd_test.ts` holds the run's stream untouched.
- **ONE POSE IN THE GAME.** Every figure target is the player's
  `skierPose` at that moment, sized to the body (`crowd-rig.ts`); a change
  to the player's stance, tuck or angulation moves the crowd with it, and
  `tests/crowd_figure_test.ts` holds the joints to the player's. Never
  hand-pose a target. The one shape the player has no pose for — lying in
  the snow — is his half-crouch laid over.
- **HIS ANIMATIONS ON THE PLAYER'S TIMING.** A stance blended alone is a
  statue gliding. What the player's body does on its own clock is a target
  pair too — the turn's pole plant at its touch and its trail (either pole),
  the wait leant and looking one way and the other — and `dialsOf` runs an
  amateur through them by the player's own rule: `PLANT` / `plantLength`
  from `skier-spring.ts` against the turn clock the engine keeps
  (`Amateur.turnSide`, `turnT`, `turnHeld`, begun past `CROWD.turnOn`).
  Never a second timing.
- **A MORPH IS LINEAR.** A weight below zero extrapolates the target
  backwards (a body run "anti-lean" stretches upward), so a turn each way
  is a target of its own (`lean`, `leanLeft`) and every weight is ≥ 0.
  Every target must be the same mesh in the same order — `buildCrowdFigure`
  throws if one is not — so a part's presence never depends on the pose.
- **A LIMB IS BUILT ROUND THE BODY'S RIGHT**, not its own direction, or its
  rings flip as it swings past level and the blend twists it.
- **THE BUDGET**: NEAR ≤ 300 triangles, MID under it, FAR ≤ 110 (no boots, no
  gloves, no poles). `tests/crowd_figure_test.ts` holds it.
- **THE INSTANCE MORPH TEXTURE MUST BE FLAGGED** (`morphTexture.needsUpdate`)
  after every write, or every vertex reads a base influence of 0 and the
  figure collapses to a point — invisible, with no error.

## The loop

1. `make crowd` (every sheet) before the change; keep the PNGs.
   `ARGS=--sheet=figures,lods,moments` for the figures,
   `ARGS="--sheet=slope --seed=7 --t=90"` for the crowd on a mountain,
   `--sheet=dress` for the kit. Browser-driven: `CHROMIUM_PATH=…` and
   `npm i --no-save playwright-core`.
2. Change it. Behaviour: the knobs and bands in `defs/crowd.ts` first.
3. `npx vitest run tests/crowd_test.ts tests/crowd_figure_test.ts`.
4. `make crowd` after; LOOK — a pose at every cut, the busy green, a ski
   school's snake, a kicker.
5. A behaviour change that touches the player (`clipCrowd`, the knock)
   owes `tests/crowd_test.ts`'s meeting cases.

## Skill self-improvement

Load **`skill-reflection`** before committing. Worth a fragment: a crowd
behaviour that read wrong only on the slope sheet, a pose that blended
badly, a cost that crept up.
