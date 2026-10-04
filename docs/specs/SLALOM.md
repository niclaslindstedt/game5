# Slalom — the working spec

The state of the race disciplines work: what is built, what is decided, and
what is still to do before the slalom is finished. It is the document a
session reads first to pick the work up — keep it current as the work moves
(tick the boxes, move a line from *to do* to *built*). It describes the
design in this game's own words; nothing here is copied from any governing
body's rulebook, and no real event, venue, product or person is named.

Branch: `feat/slalom-mode` (PR #60).

**This file is temporary. DELETE IT when the slalom is finished** — the last
commit of the work removes `docs/specs/SLALOM.md` (and `docs/specs/` if it is
empty), once everything below has landed in the code, the tests and the
standing docs (`getting-started.md`, `configuration.md`, `architecture.md`,
`level-generator.md`).

## The ask

- Replace the single RACE mode with real disciplines: **slalom**, giant
  slalom, super G, downhill, skicross, speed skiing. This round drops the race
  and builds the SLALOM; the other five are placeholders (named, listed, not
  playable — `DISCIPLINES` in `engine/game/defs/modes.ts`).
- Real rules, and a race that FEELS real: a start house as television shows
  it, the countdown inside it, the camera handing over to the player's own
  camera once he goes.
- Gates with collision physics: flex poles that are knocked down and spring
  back.
- One racer on the course at a time. The field is NOT skied while the player
  races — only its times, the standings, the scoring and the start order have
  to be right.
- A realistic audience along a slalom (behind the nets, densest at the
  finish).

## Decisions

- **One rule book entry, R31** — `engine/mapgen/discipline-rules.ts`
  (`DISCIPLINE_RULES.slalom`), prose mirrored verbatim in
  `docs/level-generator.md` (`tests/docs_rules_test.ts` reads it). A slalom
  is SET over an already built map (`setSlalom`), so no generator digest and
  no pinned campaign map moves.
- **The rules are the sport's facts restated**, not a rulebook copied:
  140–220 m of vertical, gates every ~10.5–12.5 m, open and closed gates,
  hairpins, verticals and delays, two runs (the second in reverse order of the
  first's top 30), a start window, feet through every gate, a miss or a
  straddle disqualifies, a fall that ends the run is a DNF.
- **The field is a deterministic BOARD**, dealt off the seed about the
  course's PAR (`engine/game/par.ts`'s `slalomPar`): each racer a skill and a
  grit, a time near par with a spread, a share of DSQs and DNFs. Never skied,
  never on the course with the player.
- **Interval start**: the clock waits for the wand (`run.ts`), so a slow
  start costs nothing until the racer goes; leave it past the window
  (`SLALOM.window`, 10 s after GO) and it is a DSQ.
- **Strict gates** (`engine/game/strict.ts`): the feet (the mid contacts)
  must pass inside a gate's line; the turning pole on the wrong side or
  between the feet is a straddle. A run that takes the next gate while owing
  one has missed it.
- **No skating or poling on an interval start** — the start push is the
  only drive (`start-push.ts`): the racer is held in the house after GO; the
  tuck (≥ 0.5) launches ONE push (0.35 s to 4.2 m/s plus a 0.9 m/s hop), and
  then he just skis.
- **A slalom is never on an easy hill**: a slalom off a bare seed is
  built to a RED piste (`createGame`; a red's steepest pitch is a slalom
  hill's 33–45 %, and a black's drops across the piste are what no slalom
  may cross). The course setter cuts a START DROP out of the house's door
  (`slalom.drop`: level for the boots, then ~75 % at its steepest over 8 m,
  eased back over 40 m), so the racer leaves at ~20 km/h within a second.
- **The skis**: a slalom is skied on the slalom pair (`SLALOM.skis`,
  "swift").
- **The physics' honest limit**: the edge's turn radius and yaw rate today
  hold the bot to ~20–35 km/h through a slalom, so runs take ~80–110 s
  where a real one is ~50 s. The board is calibrated to that par so the
  standings are fair; speeding the slalom up is a `ski-physics` retune, out
  of this round's scope.

## The technique (researched)

What a slalom racer's body does, for the poses and the clips. Numbers are
the research's; *(est.)* marks an estimate rather than a measurement.

The start (to be drawn as ONE short **slalom start clip**, the same for every
racer, driven by `SkierState.launch`):

1. **Held**: boots just behind the wand, skis parallel about hip-width,
   both pole tips planted beyond the wand, a little outside its posts; the
   shafts lean forward, the hands over or ahead of the wand; crouched, the
   weight back over the feet, the arms loaded on the poles.
2. **Rise and fall forward**: up out of the crouch with no hop, the feet
   still behind the wand; the chest goes out past the wand (a racer may rock
   back first, then fire forward).
3. **Kick**: with the body past the wand, both heels kicked back and up
   (the body pitches further forward), then both skis fired forward
   together through the wand — a two-footed jump, the feet barely off the
   snow, the shins opening the wand. The feet are the LAST thing out of the
   house; the body does not rise.
4. **Push**: the arms finish a hard double-pole push past the hips.
5. Out of it: the research has 1–3 skate steps with double poles; this game
   skips them by the player's choice (he leaves already at speed, ~15–25
   km/h *(est.)*, turning at the first gate within ~2 s).

The wand: one bar on one post, at 35–50 cm, swinging open forward and
downhill; the clock trips at a fixed angle 10–30° open.

Through the gates:

- A turn is ~0.8–1.0 s (giant slalom ~1.5 s); gates 9–11 m apart.
- Edge ~5° at the transition, rising to 65–70° at or just after the gate;
  the body's mass ~45–55° inclined with 10–20° hip angulation *(est.)*; the
  outside leg long (knee flexed ~40–95°), the inside leg short (~75–110°),
  the inside hip held up; load ~80:20 outside, ~60:40 late in the turn.
- Transition: both legs flex (knee, hip, trunk toward ~90°), the skis cross
  under a level body, then extend onto the new edge above the fall line.
- Upper body quiet, square to the fall line, countered 15–25° (to ~45° late
  in the turn); hands up, forward, wider than the hips, never across the
  zipper.
- Pole plant: short and firm, down the hill by the boot at the edge
  release, the arm kept forward after.
- **Cross-block**: the OUTSIDE hand punches forward and down at chest
  height at the gate and knocks the pole over with the guard on the grip,
  the feet passing outside it, the shin brushing it; an upright skier clears
  with the inside hand. Not reaching across the body.
- Hairpins and verticals: the feet flick side to side under level, square
  shoulders.
- The finish: a short tuck, then a LUNGE at the line — one boot shot
  forward, the arms thrown forward — then up and a hockey stop.
- Speed ~40 km/h average, 54–60 km/h peak; a run ~45–60 s.

## Built

Engine:

- [x] `GameMode` = `slalom | timeTrial | free | tricks`; the old race is
      `fieldRules` (the default with no mode — benches, labs). `SLALOM`
      (field 29, countdown 4, window 10, runs 2, qualify 30, skis swift).
      `RunRules.start` (`line | interval`), `.gates` (`arcade | strict`),
      `.window`.
- [x] `setSlalom(level, run)` (`engine/mapgen/slalom.ts`): the stretch
      search, kickers on it levelled out of a copy of the ground, the trees
      cleared, the gates laid in combos and fitted to what a ski can turn,
      the racing line baked (`slalomLineAt` / `slalomLineFast`), run 2 set
      again on another salt. `Checkpoint.pole` / `.turn`, `Level.slalom`.
- [x] Strict gates, DSQ/DNF (`Progress.out`, the `out` event), the start
      window.
- [x] The board (`engine/game/field.ts`): start list, run-1 order (top seeds
      shuffled, the player last), run-2 order (top 30 reversed), `fieldPlace`,
      `fieldOrderOf`; `CreateGameOptions.heat` carries run 1 into run 2.
- [x] Flex poles (`engine/game/gate-poles.ts`): two hinged springs a gate,
      knocked by the line from the feet to the shoulders, a small speed loss,
      the `pole` event; `GameState.gatePoles`.
- [x] The bot skis a slalom (a short planner over a model of the carve,
      speed held to what the line allows) and finishes the seeds `make sim`
      sweeps.
- [x] The start push (`engine/game/start-push.ts`, `TUNING.start`,
      `SkierState.launch`).

App:

- [x] Every "race" in the app, the campaign, the ghosts, the records, the
      URL (`?start=slalom`), the replay (it carries the heat) moved to
      "slalom". Audio: `out` and `pole` sounds.
- [x] The poles drawn (`slalom-poles.ts`): red and blue flex poles, tilting
      as the engine says, the owed gate breathing, the marker over its
      turning pole.
- [x] The start house (`start-house-plan.ts`, `start-house.ts`): the tall
      flat billboard front, the narrow dark doorway, white boards flanking
      it, the band along its top, the start clock inside the jamb, the wand's
      posts, the two pole holes trodden into the snow outside the posts.
- [x] The start as television shows it (`camera-start.ts`): OVERHEAD at an
      angle for the first 2 s of the starter's word, then BEHIND him inside
      the house looking out the door; on the wand the lens follows him out
      (0.7 s) and flies onto the player's camera (1.4 s).
- [x] The house pose in the gate (`skier-pose.ts`'s `HOUSE_GATE`: sunk,
      weight forward, the poles' baskets out beyond the posts);
      `inStartGate` answers `"house"`; `launchGait` (the push drawn) in
      `skier-gait.ts`.
- [x] Tests: `tests/slalom_test.ts` (course rules, strict gates, the board,
      the flex poles).

## To do

The start (in progress):

- [x] The house pose and the launch gait wired through `skis-body.ts`.
- [x] The WAND: one bar hinged on the left post, swung forward by his shins
      and left standing out down the course (`start-house.ts`'s
      `wandOpen`).
- [x] The SLALOM START CLIP (`slalom-start.ts`, keyed by
      `SkierState.launch`): held crouch, weight back → chest past the wand
      → the kick on the poles' push → into the racing stance.
- [ ] The clip's heel kick drawn in the feet (the boots lifted back behind
      him for a moment) — today the kick is the body's pitch and the
      engine's hop.
- [x] The START DROP cut below the door; the behind shot held nearly level
      so the drop falls away out of the door.
- [ ] The campaign's slalom rungs: today they stand on the shelves' own
      grades (green and blue among them). They want RED or steeper maps —
      a re-pin with `make rate CAMPAIGN=1` (the campaign skill), which
      changes the shelves; ask the user how.
- [ ] The cross-block (the outside hand at the gate), the finish lunge.
- [ ] Screenshots of seed 38 at t = 1, 3, 4.6, 5, 6 to see it.

The HUD and the plate:

- [ ] The board: bib, name-less rows, times (and run-1 + run-2 totals),
      gaps to the leader, DSQ / DNF rows last. `snapshot.ts`'s standings
      read the field, not `state.rivals`.
- [ ] An out run is not a finish: a DSQ / DNF plate with the reason.
- [ ] The countdown small and out of the TV shot (no big centre digits).
- [ ] Intermediate splits against the leader (green ahead, red behind).
- [ ] RUN 1 / RUN 2 on the HUD.

The second run:

- [ ] The plate's SECOND RUN press; a restart keeps the heat (a DOM-free
      helper for the heat after run 1); run 2 on the reversed order.
- [ ] Records and ghosts keyed per slalom run.

The shell:

- [ ] Front door: the SLALOM tile, and the five other disciplines as
      disabled placeholder tiles off `DISCIPLINES`.
- [ ] The campaign's slalom rungs' blurbs rewritten.
- [ ] News lines (`run-news.ts`) for a knocked pole, a DSQ, a DNF; a rumble
      for a pole knocked.

The audience:

- [ ] `spectator-plan.ts` for a slalom: both sides behind the nets along the
      course, densest at the finish arena, thin at the start.

Closing:

- [ ] Docs: `getting-started.md` (the mode, the controls at the start),
      `configuration.md` (`?start=slalom`, the stored campaign key v5),
      `architecture.md` (the new engine files), `riding.md` / `simulation.md`
      as needed.
- [ ] The changeset fragment refreshed; skill lessons (float operation order
      moves a digest; the start push).
- [ ] `make sim` before / after in the PR; `make fmt`, `make lint`, the
      typecheck; PR #60 green.
- [ ] **Delete this spec** (`docs/specs/SLALOM.md`) in the closing commit.

## How to look at it

```sh
make build
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/screenshot.mjs \
  --seed 38 --t 3 --viewport desktop     # previews/shot-race-t3-desktop.png
npx vitest run tests/slalom_test.ts
```
