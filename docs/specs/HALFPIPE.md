# Halfpipe — draft spec

**Draft. Researched, not built.** Delete this file when the halfpipe is
finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s.

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

- [ ] **The pipe (the next free R-rule)**: cut into a built map's steady
      fall line of ~18° for 170 m+ (a seed's slope, or built on a
      scaffold of the ski area's — open question): two walls 6.7 m from
      the floor to the coping, 19–22 m coping to coping, a transition of
      ~5–6 m radius rising to 82–83° over its top 0.2 m, a flat bottom
      ~5–7 m and decks ~3–5 m *(est.)*, a drop-in at its top, a finish at
      its foot; the snow groomed hard. A surface the physics and the
      renderer both read (a profile across, extruded down the line).
- [ ] **Riding a wall**: the stations, the legs and the edge on a
      transition and up a near-vertical wall; the launch off the vert; the
      pump that keeps the speed.
- [ ] **The pipe's tricks**: the ALLEY-OOP (rotating uphill against the
      travel), spins and corks off both walls in both directions, switch
      hits, flips, grabs — the reader telling a wall's direction (frontside
      or backside of the pipe's walls, *research*) and the run's order.
- [ ] **Mode and rules**: a `GameMode` row; one rider; ceilings raised to
      a 1620 and double corks.
- [ ] **The judge**: the shared panel, plus PIPE USE — the height kept
      from the first hit to the last, landing high on the wall, every hit
      used; a flat or deck landing a mistake.
- [ ] **The format**: qualification (two runs, the best), final (two or
      three, the best); the field dealt about par.
- [ ] **The bot**: rides the pipe, pumps, launches on the vert, picks a
      trick for each hit it can land, alternates directions.
- [ ] **HUD**: the hit count, the height over the coping, the trick named,
      the scores, the board.
- [ ] **Cameras**: down the pipe from its foot, a follow along the deck,
      side-on across it.
- [ ] **Audience**: along both decks and at the bottom.
- [ ] **Sound**: the carve up the wall, the air, the landing on the
      transition.
- [ ] **Its maps** (or venues), **labs** (a pipe in `make ride`: one hit,
      a run of six, the height kept; `make sim ARGS="--mode halfpipe"`),
      **tests**, **docs**; delete this spec.
- [ ] **The pair and the build preset** (`TRICK_MODES.md` § *Research, the
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

- [ ] **The rules and the conditions**, in full: the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [ ] **The skis**: a pipe's twin-tip — stiffer than a jib ski, holding an
      edge up an icy wall (*research the class*: is it the Raven, or a pair
      of its own?).
- [ ] **The default player weight**: the pipe's athletes (the big air
      study's freeskiers, ~72 kg and ~179 cm for men, are a start; the
      pipe's own may differ) — which of the four builds (`RIDERS`), argued
      from what the format pays weight for.

- [x] The pipe's dimensions, the format, the judging, pipe use.
- [ ] The transition radius, the flat bottom, the deck — sourced (now an
      estimate).
- [ ] Speeds across the bottom, the run's time and the amplitude of a top
      run — sourced (now estimates: 45–60 km/h, 25–40 s, 4–6 m).
- [ ] Biomechanics of the pump (how much speed a hit costs, how a skier
      regains it).
- [ ] How a skier names a wall (the pipe's frontside and backside walls
      for a skier, who has no stance like a snowboarder's).

## Open questions for the user

- The pipe cut into the mountain, or a built pipe in the ski area's base?
- A full 22-foot pipe, or a smaller one first (the 15- or 18-foot sizes)?
