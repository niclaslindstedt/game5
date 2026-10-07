# Halfpipe — working spec

**BUILT IN PART (R39).** The pipe, riding a wall, the hit's air, the mode,
the judge, the contest, the bot, the cards, the HUD and the plate are
built; what is left is unticked below. Delete this file when the halfpipe
is finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s.

## What was built

- **The pipe** (`engine/mapgen/halfpipe.ts`, `pipe.ts`, R39 in
  `trick-rules.ts`): a venue graded straight down a built map's face over
  the straight-venue module, the pipe's section (`pipeSection`: a flat, a
  circular transition, the vert at 83° over its top 0.2 m, a deck) cut
  into a COPY of the ground. The engine reads the section itself inside
  the pipe's footprint (`groundAt`, `normalAt` and `normalNear`, the
  normal at the surface point nearest the skier); the 2 m grid is cut
  below it for the renderer, which lays the true surface over it
  (`pwa/src/game/pipe-view.ts`).
- **Riding a wall**: the legs' raycast is bracketed and bisected on a
  pipe map (`leg-ray.ts`) — the Newton step ran away up a near-vertical
  wall; the snow's normal is the nearest surface point's (`snow-normal.ts`)
  everywhere a station, the hull, the incline, the crash or the body asks
  for it; the skis' hull tips and tails are left out on a pipe map (a
  1.8 m ski bows onto a 7.4 m transition).
- **The hit's air** (`pipe-air.ts`): off the vert he is pushed across at
  most 2.5 m/s, so the flight comes down about 1.2 m under the coping on
  the wall it left, and his body is turned round over the flight to meet
  the wall square, travelling the way it sends him — never counted as a
  spin, and never while a stroke is still turning him; the landing is
  judged against the wall's plane. Every hit is filed with its wall, its
  height over the coping and where it came down (`PipeHit`).
- **Mode, judge, contest**: `HALFPIPE` / `halfpipeRules`, the Raven at the
  medium build; `halfpipe-judge.ts` (the run's impression: difficulty with
  the alley-oop's extra, amplitude over the coping, execution, variety,
  pipe use; a flat or deck landing and a sketchy one taken off; a fall
  scored low), six judges; `halfpipe-contest.ts` (two qualification runs,
  the best 12 of 25 to a final of three, the best run counting, the field
  dealt off its own stream).
- **The bot** (`sim/halfpipe-steer.ts`): wall to wall at 64° off the
  pipe's line, folded on the flat and stood up through the transitions to
  pump, a plan of six hits (a grab, 360s both ways, an alley-oop 360, 720s).
- **The app**: the tricks card's box, the trick map card, the HUD's run
  and hits (`halfpipe-run.ts`), the plate with every hit named
  (`hud-halfpipe.tsx`), `?start=halfpipe`, `--halfpipe` in the
  screenshots.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` first.
2. The research is `docs/freestyle.md` § *Halfpipe* and § *What every
   judged park format shares*: the 22-foot pipe (walls 6.7 m, 170 m long,
   18° down its centre, 19–22 m coping to coping, the top 0.2 m vertical at
   82–83°), the format (the best run counting), the panel, PIPE USE, the
   alley-oop.
3. Nothing like it is built. It is a new TERRAIN (a U cut down the slope)
   and a new way of riding (up a wall, straight up off the vert, back down
   the same wall), so build the pipe on a synthetic slope and ride it in
   `make ride` before any judging.

## Watch out

- **The vert sends him straight up.** Off an 83° lip the skier leaves
  nearly vertically and must come back down onto the SAME wall; drift
  across the pipe and he lands on the flat bottom or the deck. The flight
  is the engine's own (`flight.ts`) — check it holds a skier over the
  transition to the decimal, as the speed track was checked at 250 km/h.
- **The stations on a wall.** The six probes raycast down; on a wall
  standing at 80°+ "down" is not the snow's normal. The legs, the sink and
  the edge (`suspension.ts`, `snow.ts`) were written for slopes a skier can
  stand on; a transition from flat to vertical is a case none of them has
  met. Expect the wipeout logic (`crash.ts`) to call riding up a wall a
  fall.
- **Speed is pumped.** A pipe skier keeps his speed by pumping the
  transitions (extending up the wall, absorbing at the top) — five or six
  hits each as high as the first. The legs' spring is where it lives.
- **Fine terrain.** A 6.7 m wall on a transition of ~5–6 m radius is far
  finer than the 2 m grid the heightfield is baked on (check
  `compile.ts`): the pipe may need a surface of its own rather than the
  heightfield, as the jibs do.

## What it is

A U-shaped channel cut down the slope. The skier drops in, rides up one
wall, launches off its vert, turns a trick in the air and lands back on the
same wall, then rides across to the other: five or six hits a run,
alternating, judged as one run on amplitude, difficulty, execution,
variety, progression and PIPE USE. Qualification best of two runs, a final
of two or three, the single best run counting.

## What the game already has to reuse

- The strokes, grabs, switch, the landing graded (`TRICK_MODES.md`).
- The legs' spring (`suspension.ts`) — the pump.
- The course preparation's ground copy (`course-prep.ts`) — the pipe is
  cut into a copy of the slope.
- The audience (along both decks) and the finish arena.

## What it needs to be complete

- [x] **The pipe (the next free R-rule)**: cut into a built map's steady
      fall line of ~18° for 170 m+ (a seed's slope, or built on a
      scaffold of the ski area's — open question): two walls 6.7 m from
      the floor to the coping, 19–22 m coping to coping, a transition of
      ~5–6 m radius rising to 82–83° over its top 0.2 m, a flat bottom
      ~5–7 m and decks ~3–5 m *(est.)*, a drop-in at its top, a finish at
      its foot; the snow groomed hard. A surface the physics and the
      renderer both read (a profile across, extruded down the line).
- [x] **Riding a wall**: the stations, the legs and the edge on a
      transition and up a near-vertical wall; the launch off the vert; the
      pump that keeps the speed.
- [x] **The pipe's tricks**: the ALLEY-OOP (rotating uphill against the
      travel), spins and corks off both walls in both directions, switch
      hits, flips, grabs — the reader telling a wall's direction (frontside
      or backside of the pipe's walls, *research*) and the run's order.
- [x] **Mode and rules**: a `GameMode` row; one rider; ceilings raised to
      a 1620 and double corks.
- [x] **The judge**: the shared panel, plus PIPE USE — the height kept
      from the first hit to the last, landing high on the wall, every hit
      used; a flat or deck landing a mistake.
- [x] **The format**: qualification (two runs, the best), final (two or
      three, the best); the field dealt about par.
- [x] **The bot**: rides the pipe, pumps, launches on the vert, picks a
      trick for each hit it can land, alternates directions.
- [x] **HUD**: the hit count, the height over the coping, the trick named,
      the scores, the board.
- [ ] **The pipe as drawn**: the snow shader's glitter and corduroy and
      the trail map's grooves on the pipe's own mesh (it is plain groomed
      snow now); the coping's edge marked.
- [ ] **Cameras**: down the pipe from its foot, a follow along the deck,
      side-on across it.
- [ ] **Audience**: along both decks and at the bottom.
- [ ] **Sound**: the carve up the wall, the air, the landing on the
      transition.
- [x] **Its maps** (the trick maps, the pipe cut into each), **tests**
      (`halfpipe_test.ts` rides the synthetic pipe, `halfpipe_hud_test.ts`),
      **docs**, `make sim ARGS="--mode halfpipe"`.
- [ ] **Labs**: a pipe in `make ride` (one hit, a run of six, the height
      kept) — the tests ride the synthetic pipe (`pipeLevel`) instead.
- [ ] **The pump in the legs**: the bot pumps with the tuck (folded on the
      flat, stood up in the transitions); a pump of the legs' own spring,
      and how much speed a hit really costs, is not modelled.
- [ ] **Corks and doubles in the pipe**: the strokes throw flat spins,
      flips and grabs; a double cork off a wall is the strokes' (shared
      with big air), and the bot throws none.
- [x] **The pair and the build preset** (`TRICK_MODES.md` § *Research, the
      pair and the build*): a pipe's twin-tip — stiffer than a jib ski,
      holding an edge up an icy wall (*research the class*: is it the Raven,
      or a pair of its own?), and the default build off the pipe's athletes
      (the big air study's freeskiers, ~72 kg and ~179 cm for men, are a
      start; the pipe's own may differ) — rows in `RACE_SKIS` and
      `RACE_RIDERS`, so picking the format opens the ski card on its pair
      and the dress card on its build.

## Research to-do

Research EXTENSIVELY before building (`TRICK_MODES.md` § *Research, the
pair and the build*): several sources for every number that shapes the
build, written into `docs/freestyle.md`.

- [x] **The rules and the conditions**, in full: the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [x] **The skis**: a pipe's twin-tip — stiffer than a jib ski, holding an
      edge up an icy wall (*research the class*: is it the Raven, or a pair
      of its own?).
- [x] **The default player weight**: the pipe's athletes (the big air
      study's freeskiers, ~72 kg and ~179 cm for men, are a start; the
      pipe's own may differ) — which of the four builds (`RIDERS`), argued
      from what the format pays weight for.

- [x] The pipe's dimensions, the format, the judging, pipe use.
- [ ] The transition radius, the flat bottom, the deck — sourced (the
      cutter's shape is; the 22 ft numbers are still an estimate).
- [ ] Speeds across the bottom, the run's time and the amplitude of a top
      run — sourced (now estimates: 45–60 km/h, 25–40 s, 4–6 m).
- [x] The speed out of the lip and the transition's load (a kinematic
      study, `docs/freestyle.md` [48]).
- [ ] Biomechanics of the pump (how much speed a hit costs, how a skier
      regains it).
- [ ] How a skier names a wall (the pipe's frontside and backside walls
      for a skier, who has no stance like a snowboarder's) — the game
      names them right and left facing down the pipe.

## Open questions — the defaults taken

- The pipe cut into the mountain, or a built pipe in the ski area's base?
  **Cut into the mountain**, down a built map's face, as the other trick
  venues are; a pipe at the base is open.
- A full 22-foot pipe, or a smaller one first (the 15- or 18-foot sizes)?
  **The full 22-foot pipe**; the smaller sizes are a rule row away.
