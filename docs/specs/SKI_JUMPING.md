# Ski jumping — draft spec

**The hill (R43), the jump, its wind, its scorer and its contest are built (engine); the app and the drawing are not.**
Ski jumping REPLACES BIG AIR as the first
format on the tricks card, and is to be the game's most important mode
beside the free ride: a real jumping hill cut into the mountain, an in-run
ridden in its tracks at 94 km/h, a take-off timed to a fraction of a
second, four to five seconds of flight held on the air the body and a V of
skis make, a telemark into a full arena — scored to the half metre with the
wind and the gate compensated, a field of fifty, the best thirty jumping
again in reverse order. "Realistic and epic" is the bar: every number below
comes from the research or is marked *(est.)*, and the hill as drawn is as
much the feature as the flight. Delete this file when ski jumping is
finished (`README.md`); the shared trick pieces are `TRICK_MODES.md`'s, but
ski jumping uses few of them (no strokes, no grabs, no impression panel).

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, then read
   `TRICK_MODES.md` and — the closest thing built — `AERIALS.md`: a site
   cut straight down the face (`engine/mapgen/aerials.ts` over
   `straight-venue.ts`), an analytic surface laid over the grid
   (`withMoguls` with no mogul line), a curve RIDDEN AS A WIRE
   (`engine/game/aerial-kicker.ts`), a FLIGHT OF ITS OWN
   (`aerial-flight.ts`), a FORMAL SCORER (`aerials-judge.ts`) and a
   CONTEST dealt off a stream of its own (`aerials-contest.ts`,
   `contest-state.ts`), the app's `aerials-run.ts` and `hud-aerials.tsx`.
   Ski jumping is that pattern again, with a jumping hill's numbers.
2. The research is `docs/freestyle.md` § *Ski jumping*: the hill classes,
   the construction norm's formulas element by element, two real hills'
   certificates, the jump's speeds and forces, the aerodynamics, the
   landing, the scoring tables (metre values, style deductions, gate and
   wind factors), the format, the equipment rules, the jumpers' build and
   the broadcast's cameras. Nothing below restates a number it does not
   need.
3. The course rule is **R43** (R42 is the ski routes, `resort-rules.ts`):
   stated in `engine/mapgen/trick-rules.ts` beside R37–R41 and mirrored in
   `docs/level-generator.md` (`tests/docs_rules_test.ts`).
4. Build the measuring tool FIRST (`make skijump-flight`, below) and hold
   every phase to it, before and after — the lesson every discipline has
   relearned.

## Watch out

- **The flight is the mode, and a point mass with fixed areas cannot fly
  it.** A quick point-mass study on the HS 140 profile below (72 kg, sea
  air ×1.15, v⊥ 2.5 m/s) reached K at the norm's 26.2 m/s only with a
  lift area near 0.8 m² and a drag area near 0.6 m² (L/D ≈ 1.3) — and
  with FIXED areas a head wind SHORTENED the jump, where the published
  factors say a head wind is worth 4 m a m/s on a normal hill and 6 on a
  large one. The areas must be functions of the ANGLE OF ATTACK the body
  and skis meet the air at (the polar), so a head wind — faster, steeper
  air — is lift; and the jumper's attitude must be held against the air's
  pitching moment, not set. Fit the polar in the flight lab to the norm's
  own checks (K reached at v₀ in calm air, the flight's peak 3–4 m over the
  slope about half way, ~4.5–5 s to K on a large hill, the gate and wind
  factors measured the norm's way) before any picture is drawn.
- **The in-run is a guided curve, not the snow's step.** The tracks hold
  the skis; the transition (r₁ ≈ 100 m) loads 0.7 g at most; the springs
  of `suspension.ts` tuned for a piste must not ride it, nor the hull's
  friction scrub it (`aerial-kicker.ts`'s lesson). Ride it as a bead on a
  wire from the gate to the edge: gravity, the tracks' friction angle (1°
  ice or ceramic, 3° snow) and the crouch's drag in the air where he is.
- **The take-off decides the jump.** +1 m/s at the edge is worth ~16 m and
  +0.5 m/s of push ~10 m on the large hill *(the same study)*; the push
  lasts ~0.3 s, which at 26 m/s is the whole 6.8 m table. The press must
  be TIMED to the edge, read to the fraction of a step
  (`course.ts`'s `crossingShare` is the precedent), and its window wide
  enough to hit at 60 Hz on a phone.
- **The surface is analytic and finer than the grid.** The edge, the knoll
  (a cubic parabola) and the r_L arc must be the profile itself inside the
  hill's width, the grid cut below it — as the aerials site does.
- **A digest must not move.** The hill is set over a built map
  (`setSkiJump`, its rule in `trick-rules.ts`), pure, drawing nothing from
  any stream; the field is dealt off a stream of the contest's own; no
  draw is added to `step`. `make sim` (every other mode) before and after.
- **A jump must not cost a skier's body.** A K-point landing is under a
  metre of equivalent fall height; the landing load is 1.5–3 g. If the
  engine's `landingLoad`, the legs and the body (`body.ts`) read a clean
  telemark as a blow, the injuries and the HUD's plate will light up on
  every jump. Land it on the profile's true slope, and hold `make injuries`
  unmoved for a clean jump.
- **No real hill, venue, maker or person is named** — not a hill by its
  town, not a jumper by his record. A hill is named for what it is like.

## What it is

One jumper at a time on a jumping hill: sat on the starting bar at the gate
the jury set, he waits for the light and the wind, pushes off, crouches in
the tracks down a 35° in-run, springs off the 11° table at the edge, lays
out over his skis spread in a V and flies the landing hill for 4–5 s, 3–4 m
over the snow, and lands in a telemark at ~30 m/s. His score is DISTANCE
(60 at K, the metre value a metre either way) + STYLE (five judges' marks
out of 20, the high and low dropped) + the GATE and WIND compensation. A
TRIAL round (optional, counting nothing), a FIRST ROUND of 50, the best 30
to the FINAL ROUND in reverse order, the total of both jumps winning.

## Decided (the defaults this spec builds; open questions at the foot)

### The hills (R43)

Two hills of the norm, the same rule a row each, the LARGE hill first:

| | LARGE (built first) | NORMAL (second) |
| --- | --- | --- |
| HS / w (K) | 140 / 126 | 106 / 95.4 (K 95) |
| In-run γ | 35° | 35° |
| Table α (the norm's band) | 11.2° (11.1–12.1) — the low end, the higher flight | 10.6° (10.1–11.1) |
| h/n (band) | 0.58 (0.557–0.606) | 0.55 (0.519–0.575) |
| h, n | 62.9 m, 108.5 m | 45.7 m, 83.2 m |
| v₀ at the edge, calm (design) | 26.2 m/s (94 km/h) | 24.6 m/s (88.6 km/h) |
| r₁, t, s | 103 m, 6.8 m, 3.15 m | 91 m, 6.4 m, 2.4 m |
| In-run e₁ (top gate), e₂ (gate 1) | 98.8 m, 80.6 m | 84.4 m, 69.3 m |
| Gates | ~26, 0.40 m of height apart (0.70 m along) | ~22 |
| β (at K), β_P, β₀, β_L | 33.9°, 37.0°, 6.2°, 31.3° | 34.0°, 36.8°, 6.1°, 31.3° |
| r_L, v_K | 300 m, 30.3 m/s | 210 m, 29.2 m/s |
| P, K, L (HS) along the slope | ~110, 126, 140 m | ~85, 95, 106 m |
| r₂ (L→U) | 100–150 m (r₂L,min 93 m) | 90–140 m (86 m) |
| Out-run a (level) | 83 m (at least 45) | 81 m |
| Widths: in-run, knoll's foot, K, U | 2.5, 7.6, 25, 28 m | 2.5, 5.7, 19, 21 m |
| Take-off to U | ≤ 88 m of drop | — |
| Judges' tower | 76–101 m along, 32–63 m off the axis | 57–76 m, 24–48 m |
| Metre value; gate; wind head / tail | 1.8; 7.67 pts/m; 10.80 / 13.07 pts per m/s (est. until measured) | 2.0; 7.00; 8.00 / 9.68 |

*(Our arithmetic off the norm's formulas, `docs/freestyle.md`; the
compensation factors are the published sheets' until the flight lab
measures this hill's own, the norm's way — then the measured ones.)* A
FLYING hill (HS 200+, 120 points at K, 1.2 a metre) is open.

- **The profile** is DESIGNED off the norm's formulas (the in-run's straight
  part, the cubic-parabola transition to r₁, the table; the knoll's cubic
  parabola from s under the edge to P; the r_L arc P→K→L; the parabolic
  transition L→U; the level out-run) — a pure function of the rule, the
  same on every map — then FITTED: dropped onto the face where it cuts and
  fills least (`straight-venue.ts`'s line search and `gradeVenue`), as the
  aerials site is. Where the in-run stands more than ~3 m over the ground
  *(est.)* it is a STRUCTURE — the in-run bridge on trestles up to a START
  TOWER — drawn, not filled; the engine reads the profile either way.
- **Published as `Level.skiJump`** (`SkiJumpHill`): the hill's class, the
  profile (`yAt` along the axis), the gates' positions along the in-run,
  the edge, the knoll, P, K, L, U, the fall line, the out-run's end, the
  widths, the judges' tower's and the coaches' platforms' places, the wind
  stations; `distanceAt(x)` (the distance a landing point is credited —
  along the profile from the edge, the way the markings are taped); its
  checkpoints the start gate and the finish (the fall line, past which the
  style is no longer judged); its spawn the bar of the jury's gate.
- **The analytic surface** inside the hill's width (the aerials site's
  field with no mogul line), the grid cut beneath it; the tracks are not
  geometry the engine reads (the wire holds him), only drawn.
- **The site search** prefers a face whose own fall matches the landing
  hill's 30–37° and whose top can carry the in-run; it is held by the
  analyzer like R41's (the drop to U, the widths clear of trees, lifts and
  runs, the arena's level ground).

### The ski and the build

- **A new pair, the ALBATROSS** *(name open)* — the jumping ski, built to
  the class's rule: 2.55 m (145 % of the rule's 1.78 m jumper, less 2 %
  for a BMI of 20.5), 105 / 100 / 102 mm (tip and tail within 5 mm, the
  sidecut straight lines — a sidecut radius past any turn, *est.* 400 m),
  no steel edges (it tracks on its grooves: `edgeMax` near nothing), the
  boot's toe 57 % back from the tip (`mount` ≈ 0.37 from the tail), stiff,
  heavy (2.75 kg a ski with its binding), the tip turned up 40 mm, a flat
  tail; the HEEL FREE in the binding (the drawing hinges the boot at the
  toe; the rear unit's rods limit the ski's hang). Its in-run crouch's drag
  area ~0.20–0.25 m² *(derived)*, held by the in-run lab to v₀. It skis
  badly anywhere else and is offered only by the mode (`RACE_SKIS`).
- **The build: LIGHT** (`RACE_RIDERS`) — the field's measured mean is
  178 cm and ~66 kg, BMI ~20.5; the light build (60 kg in kit) is the
  nearest of the four, and the format pays lightness (a 1 % lighter BMI is
  worth ~2 % of ski area). The flight's lift and drag areas are fitted at
  the build the mode rides, so the K point is reached at v₀ on it.
- **The suit**: a jumping suit cut to the body (nine panels, the crotch at
  the body's), a helmet and goggles, soft low boots — an outfit row of its
  own (`outfit.ts`), the race's colour on the bib.

### The in-run and the take-off

- **On the bar.** The run starts SEATED on the bar of the jury's gate,
  facing down the tracks, the coach's platform beside the table; a start
  LIGHT (red, then green and a 10 s window to leave — `RunRules.window`);
  the jury HOLDS him on red while the wind is outside its window (below).
  The press to leave is the tuck (or the jump key); leaving late is a no
  start.
- **Down the tracks as a wire** (`engine/game/jump-inrun.ts`): the skis in
  the tracks from the gate to the edge, his speed the energy's — the drop,
  the tracks' friction angle (1° ice/ceramic, 3° snow; the hill's tracks are
  ice), the crouch's drag in the air where he is (`airAt`) — the crouch held
  for him (`RunRules.inRun`); the edge and steer mean nothing in the tracks;
  standing up out of the crouch costs speed (the drag area grows) *(est.:
  ~1 km/h a second stood)*. The speed at the edge is read through the
  photocells' 8 m, ending 10 m before the edge, and shown.
- **The TAKE-OFF is the JUMP key, TIMED.** The push lasts ~0.28 s *(est.,
  in the research's 0.25–0.30)*; the press STARTS it. Ended at the edge,
  it adds the full v⊥ (2.5 m/s at the build's strength; `RiderSpec.strength`
  scales it, *est.* 2.2–2.9 across the builds) at right angles to the table
  and the forward rotation the body needs to lie out over the skis. EARLY,
  the push is spent on the table: v⊥ ×(the share of the push done in the
  last 0.28 s), and the rotation too little — he flies sat up, slow into
  the V. LATE, the share left on the table only, and the rotation too much
  — the tips drop. NO PRESS: he rolls off the edge with nothing (~25–30 m
  short *(est.)*). A sweet spot of ±0.03 s *(est.)* is a perfect take-off;
  the HUD's take-off rating names it (perfect / early / late by tenths).
  The edge is crossed at the fraction of a step; the release is along the
  table's tangent at the edge's own height.

### The flight (`engine/game/jump-flight.ts`, a flight of its own)

- **The state**: the body's PITCH (the skis' angle of attack to the air,
  the body's angle over the skis), the V's opening, the ROLL, the yaw;
  the centre of mass's position and velocity; the take-off's angular
  momentum decaying into the attitude the jumper holds.
- **The forces**: gravity at the real g; LIFT and DRAG off the relative air
  (the map's wind at the hill, `airAt` — never a new draw) through areas
  that are functions of the angle of attack, the body-ski angle and the V
  (the polar: a smooth fit with its best L/D near 25–30° of attack, a body
  angle of 0–20°, a V of ~30° *(the studies)*; lift 0.2 → ~0.75 m² and
  drag ~0.22 → ~0.6 m² over the first ~0.6 s as he lays out and the V
  opens, the late-flight L/D ~1.2–1.3 *(fitted in the lab)*), the
  aerodynamic PITCHING MOMENT that stabilises a good attitude and turns a
  bad one over; the GROUND EFFECT is open.
- **The controls** (the skier's own keys, read as a jumper's hands; the
  phone's thumbs the same axes):
  - the LEAN: forward lies him out flatter over the skis (more lift, less
    drag, toward the stall's other side — too far and the tips go down
    and he is turned over: a fall), back sits him up (more drag, sinks);
    the ideal moves through the flight (steeper early, flatter late);
  - the TUCK key held: the V OPEN (released, the skis close toward
    parallel — less lift; the V opened late costs distance, early
    nothing);
  - the EDGE: the ROLL held level against the gusts (a crosswind and
    asymmetric skis roll him; an asymmetric V is a flight deduction);
  - the ASSIST (`GameState.assist`) holds the roll level and eases the
    pitch toward the polar's best — every hand on by default, as the field.
- **The LANDING** (the trick key, which means nothing else here, is the
  TELEMARK): pressed in the last ~0.5 s *(est.)* before the snow, the legs
  split and the knees bend as the tails touch — a telemark; held through
  10–15 m of the out-run. Not pressed, a two-footed landing (≥ 2 points
  off a judge); too late, a telemark set on the snow (a landing fault);
  the skis not parallel, the arms not out — faults. A fall: a landing past
  the e.LH the legs take (`landingLoad` against the profile's true slope),
  the tips caught nose down, the body turned over in the air, a hand on
  the snow (a touch), a fall before the fall line. Past HS the slope
  flattens and the landing grows hard — the jury lowers the gate (below).
- **The DISTANCE**: where both feet are on the snow (the middle between
  them), along the profile from the edge (`distanceAt`), to the HALF METRE
  *(est.: the mark the feet have reached, read down)*; in a fall, where the
  body first touched.
- **The flight is filed** (a `JumpRecord`: the gate, the in-run speed, the
  take-off's timing and v⊥, the wind measured, the peak height, the flight
  time, the distance, the landing's kind and load, every fault) for the
  judges, the HUD, the replay and the sim.

### The wind and the gate

- **The wind is the map's** (`windAt`, `airAt` at the hill), never a new
  draw: its component along the hill's axis measured at five stations
  along the flight (the edge, ~25, 50, 75 and ~100 % of K *(est.)*) as he
  passes them and averaged — what the scoreboard shows as head (+) or
  tail (−) and what is compensated: head × the hill's head factor off,
  tail × the tail factor (1.21 × the head's) on.
- **The jury** (`JURY`-like row of its own): holds a jumper on the bar while
  the wind at the edge is outside its window *(est.: tail past 3 m/s, a
  gust past 40 km/h)*, and, before a round, picks the GATE that brings the
  dealt field's best to about 0.95·HS in the day's wind (its par measured
  in the lab); a round whose jumps pass HS is restarted from a lower gate
  *(open: in the game, one gate a round)*. The gate's compensation: the
  factor × the metres of in-run below the round's reference gate on, above
  it off.
- **A jury's day** like the races' (`juryDay`): a storm or a whiteout eased
  to what a jumping contest is held in *(est.: no more than a steady fall)*.

### The scorer (`engine/game/ski-jump-judge.ts`, pure)

- DISTANCE points: 60 + metre value × (distance − K), never below zero.
- STYLE: five judges, each 20 less his deductions in half points — the
  FLIGHT (up to 5: the take-off's error, an unstable or asymmetric flight,
  the V late or uneven, the legs bent, read off the flight's record), the
  LANDING (up to 5; no telemark at least 2; a stiff or deep landing, the
  skis apart or not parallel), the OUT-RUN to the fall line (up to 7:
  unsteady 0.5–3, a hand on the snow 4–5, a fall 7) — each judge's EYE a
  half point either way dealt off a hash of the contest's seed and the
  jump; the high and the low dropped, the three summed.
- GATE and WIND points as above, each to one decimal *(est.)*.
- The jump's points = distance + style + gate + wind, ≥ 0; held to worked
  examples in its test (a 126 m clean telemark on the large hill at the
  reference gate in calm air: 60 + 3 × 18.5 = 115.5).

### The contest (`engine/game/ski-jump-contest.ts`, pure; `ContestState.skiJumpContest`)

- A TRIAL round the player may jump or skip (it counts nothing); the FIRST
  ROUND of 50 (the player and 49 dealt), the start order the field's level
  *(the best last; the player's place in it dealt by his book)*; the best 30
  to the FINAL ROUND in reverse order of the first round's points, the
  leader last; the total of both; a tie shared (places displaced). The 95 %
  rule (a faller past 95 % of the round's longest goes through) is kept.
- THE FIELD is dealt, never jumped, off a stream of its own: each rival's
  level about the bot's PAR (the par jumper's distance at the round's gate
  in its wind, measured once per hill), his distance, his style, his wind
  (the day's own at his moment — the field jumps in the same wind field
  the player does, at its own clock times) and his fall (a few in a
  hundred *(est.)*), revealed as far as the player has jumped.
- The contest rides the runs as `ContestState.skiJumpContest`
  (`CreateGameOptions.skiJumpContest`), as aerials' does.

### The mode

- `GameMode` "skiJump", `SKI_JUMP` and `skiJumpRules` in
  `engine/game/defs/ski-jump.ts` (re-exported by `modes.ts`): one jumper,
  no course gates but the start and the fall line, the strict finish (a
  fall is a fall, never stood up mid-jump), the real g, no strokes or grabs
  (`stunts: false`), `inRun: true`, a new `RunRules.skiJump` (the wire and
  the flight), the start window, the jury. `FREESTYLE`'s first row
  (`defs/formats.ts`): `{ id: "skiJump", mode: "skiJump" }`, so the tricks
  card lists it first.

### The bot (`engine/sim/ski-jump-steer.ts`)

Takes off with a timing error and a strength dealt to its skill (the
player's stand-in: ±0.04 s *(est.)*), holds the polar's best attitude with
a hand's lag, opens the V on time, holds the roll, telemarks. Its clean
jump at a gate is the PAR the field is dealt about. `make sim ARGS="--mode
skiJump --skis albatross --rider light --count 16"`: every seed's hill
jumped, every jump landed, none past HS at the jury's gate, the `dist`,
`style` and `points` columns.

### The app

- **The tricks card** (`menu-freestyle.tsx`): SKI JUMPING first, billed
  with its field and finalists; big air's box gone. The trick map card
  carries a HILL row (LARGE, NORMAL) for it *(and later its own hills)*.
- **The HUD** (`hud-skijump.tsx` over the DOM-free `ski-jump-run.ts`): on
  the bar the gate, the wind (an arrow and m/s, green head, red tail, as the
  broadcast shows it), the light and its countdown; in the in-run nothing
  but the speed; after the take-off the in-run SPEED and the take-off's
  rating; in flight a small ATTITUDE gauge (the body's angle against the
  ideal band, the V) *(assist-dependent; open)*; 2–3 s after the landing
  the DISTANCE. The LEADER'S LINE — a green line across the landing hill at
  the distance to lead — drawn in the world, as the broadcast lays it.
- **The plate**: the distance and its points, the five style marks with the
  high and low struck through, the gate and wind points, the jump's total,
  the rank; the BOARD (50, then the final 30) with every jumper's two
  distances; the next round's press.
- **Words**: `strings-skijump.ts` — the take-off ratings, the faults, the
  board's columns, a jump called as a commentator calls it (a distance, a
  telemark, a hill record).
- **The URL**: `?start=skijump` boots onto the bar of the first round;
  `?hill=normal`; `?round=2`.
- **Records**: the book keeps the longest jump and the best total per hill
  and seed (`recordId` with the hill).
- **The replay** (`replay-shots.ts`): the take-off filed as the moment, the
  flight slowed, the landing; the broadcast plan below.

### The cameras (`pwa/src/game/camera-skijump.ts`, three-free, its own rows)

As a balloon ride swaps the ladder for its own (`camera-balloon.ts`), a
jump has its own, and the default rung is the broadcast's SIDE:

| Rung | On a jump |
| --- | --- |
| TIPS | his own eye: the tips and the V in front, the in-run's tracks rushing, the landing hill opening below |
| HELMET | over his shoulder, the skis' V and the slope beneath |
| CHASE | behind and above, the crane behind the tower: the in-run, the edge, the whole flight and the landing |
| FAR (default) | THE MAIN SIDE-ON CAMERA: ~2/3 of the way to K, 12–20 m off the slope, the lens at his flight's height, panning from the take-off to the landing with every marking on the snow in frame |
| HIGH | the crane 20 m over the tower, the hill laid out ahead |
| ORBIT | round him in flight, slow |

The start: a close-up on the bar (the `camera-start.ts` pattern), the
coach's flag, the light; down the in-run the PROFILE camera beside the
table (5–7 m off it, over it) holding him in full profile through the
push, cutting to the rung at the edge. The replay's broadcast: the
take-off profile in slow motion, the side-on main, a low camera on the
landing hill for the last third, the out-run crane for the reaction; a
CABLE camera flying down the hill beside him *(a replay lens)*.

### The hill as drawn (a later visual phase models every piece)

`ski-jump-plan.ts` (three-free: where every piece stands, off
`Level.skiJump`) and its builders, low-poly and faceted, in the facade kit
(`buildings`):

- THE START TOWER over the in-run's top (a steel or concrete tower, its
  stair and lift, the warming room at the top), the numbered GATES — a
  crossbar each over the tracks, the STARTING BAR the jumper sits on, the
  start LIGHT (red, yellow, green) and the countdown;
- THE IN-RUN: the ramp or the trestle bridge, its 50 cm guard rails, the two
  ICE TRACKS (grooves glazed blue-white, or ceramic profiles) and the snow
  between, the photocells, the TABLE and its EDGE (a sharp line), a
  pole-mounted camera;
- THE LANDING HILL: the groomed snow, the knoll falling from under the
  edge, the GUARD RAILS (70 cm) down both sides from 0.1·w, the DISTANCE
  BOARDS every metre from 0.5·w to HS + 5 with their numbers *(est.: every
  5 m large)*, the BLUE P line, the RED K line, the HS line, the coloured
  lines and spruce branches across the slope, banners in the arena's
  colours, the WIND FLAGS (eight a side at flight height on
  poles) and the three wind instruments, the leader's green line;
- THE JUDGES' TOWER beside the landing hill (five cabins stepped to follow
  the flight, the jury's room), the two COACHES' PLATFORMS (one over the
  take-off, one over the landing, coaches on them), the TV crane;
- THE OUT-RUN and the ARENA: the 1 m boards, the fall line, the exit gate,
  the leader's box, the stands and terraces round the out-run (the
  audience's plan — `spectator-plan.ts` grows a jumping arena: the crowd
  thickest at the out-run, lining the landing hill's rails, flags, horns,
  cowbells), the video wall with the distance;
- THE LIGHTS: floodlight masts down both sides of the in-run and the
  landing hill and round the arena for an evening contest (the piste lights'
  design, `piste-light-plan.ts`, retyped for a hill); the hill lit like a
  stage in the night;
- THE CHAIRLIFT up beside the hill (a lift of the ski area's own kind,
  `lift-shapes.ts`).

### The jumper as drawn (poses, `skier`)

A technique row "skiJump" (`technique-pose.ts`) and the flight's own pose
off the engine's attitude: SEATED on the bar; the IN-RUN CROUCH (the
trunk flat on the thighs, the arms back along the body, the knees deep);
the TAKE-OFF extension frame by frame; the V-STYLE (the body laid over the
skis at the flight's angle, the hips ~160°, the arms back, the skis spread
in a V from the heels, the heels lifted off them, the tips up); the
landing preparation; the TELEMARK (one foot forward a foot's length, the
back knee deep, the arms out forward); the fall. The skis hinge at the toe
(the heel free); the suit is tight; the helmet and goggles. The skier
lab's moves and `skier-metrics` bands grow rows for each.

### The sound (`sound-effects`)

The bar's clack and the push off; the in-run's tracks — a rising hiss and
the ice's hum, the clatter over the track's joints *(est.)*; the take-off's
snap; in flight the wind's roar rising with the air speed and the suit and
skis' flutter, a gust's buffet; the landing's slap and the telemark's
carve; the crowd — a hush on the bar, a rising roar as he passes K, the
horns and cowbells, the arena's chime with the distance; the coach's
whistle *(est.)*. Synthesized, as everything is.

### The labs

- **`make skijump-flight`** (pure Node, `scripts/skijump-flight-lab.mjs`,
  `--json` / `--compare`): every hill's profile table (the norm's elements
  against the designed ones); rows of jumps — the gate × the wind (−3 … +4
  m/s) × the take-off's timing (−0.15 … +0.15 s) × the attitude held (the
  bot's, a sat-up one, a flat one) — each the speed at the edge, v⊥, the
  peak height and where, the flight time, the distance, the landing speed
  and normal velocity, the e.LH against the norm's comfortable and limit
  values, the fault the engine read; and the hill's own GATE and WIND
  FACTORS measured the norm's way (3 m of in-run, ±3 m/s at (w + HS)/2),
  beside the published ones. THE loop for the in-run, the take-off, the
  polar and the landing: run before and after every change.
- **`make skijump`** (the picture lab, `pwa/skijump-preview.html`): sheets
  `hill` (side-on, from the out-run, from the tower, from the air, by day
  and at hour 21), `parts` (the tower and bar, the tracks, the table and
  edge, the knoll, the boards and lines, the judges' tower, the flags, the
  platforms, the arena, the masts), `poses` (every pose from front, side,
  top and behind), `flight` (a jump strobed on the side-on main camera over
  the profile, the leader's line), `lenses` (every rung and the broadcast's
  shots at the take-off, the peak, the landing), `crowd`, `night`.
- `make sim ARGS="--mode skiJump …"`, `screenshots ARGS="--skijump --t 6"`
  (the bar at `--t 1`, the edge, the flight, the plate), `level`/`analyze`
  for R43, `injuries` (a clean jump hurts no one), `audition`.

## What the game already has to reuse

- The straight venue (`straight-venue.ts`: the pen, the line search, the fit,
  the grading, `jumpHeightAt`, the landing shaped to an equivalent fall
  height) and `lipSpeed`'s way of sizing an in-run with the engine's loss.
- The aerials site's analytic surface, its wire up the kicker, its flight of
  its own, its formal scorer, its contest and its dealt field, its app
  modules — the pattern, not the code.
- The real g in flight; the wind as a pure field (`windAt`, `airAt`) and the
  jury (`jury.ts`); `crossingShare` for the edge read inside a step.
- The landing graded (`landingLoad`, `landingGrade`), the ragdoll and the
  body (`crash.ts`, `body.ts`) for the falls.
- The start house's television start (`camera-start.ts`), the replay's
  broadcast (`replay-shots.ts`, `camera-replay.ts`), the audience and the
  finish arena (`spectator-plan.ts`, `finish-arena.ts`), the piste lights.

## Big air leaves the tricks card

The owner's decision: ski jumping REPLACES big air. Big air's MODE is
retired; what slopestyle, the halfpipe, moguls and aerials share stays.

**Stays (moved where needed):**

- `straight-venue.ts` whole; `lipSpeed`, `JumpProfile`, `jumpHeightAt` and
  `JumpRule`/`VenueRule` move out of `big-air.ts` into it (aerials imports
  `lipSpeed` from `big-air.ts` today).
- `judge.ts` whole (`readTrick`, `trickKind`, `impressionOf`, `panelScore`,
  `difficultyOf` — slopestyle, the halfpipe and moguls read them).
- `in-run.ts` (aerials' in-run, and ski jumping's); the RAVEN (slopestyle
  and the halfpipe ride it — its "big-air ski" words change); the six trick
  maps; `RunRules.spinMost` / `.flipMost` (slopestyle's).
- **R37** — slopestyle (R38), moguls (R40) and aerials (R41) are each
  written "BUILT as R37's jump is": R37 is REWRITTEN as the rule of the
  straight venue they share (the line searched, the fit, the grading, the
  landing shaped to its fall height, the in-run sized to its speed), its
  big-air jump's own profile leaving with the mode, so the R-numbers stay
  contiguous and every cite still reads; R43 says "built as R37 states".

**Removed:**

- Engine: `GameMode` "bigAir", `BIG_AIR`, `bigAirRules` and their rows in
  `MODE_RULES`, `RACE_SKIS`, `RACE_RIDERS` and `FREESTYLE`;
  `engine/mapgen/big-air.ts`'s `setBigAir` and `jumpProfile` (after the
  move), `TRICK_RULES.bigAir`'s jump numbers, `Level.bigAir` /
  `BigAirCourse` and their readers (`straight-venue.ts`, `cabins.ts`,
  `enthusiasts.ts`, `in-run.ts`, `speed-ski-steer.ts`, `step.ts`);
  `big-air-contest.ts`, `ContestState.bigAir`, the `index.ts` exports.
- App: `big-air-run.ts`, `hud-bigair.tsx`, `strings-bigair.ts` and the
  big-air branches of `snapshot.ts`, `hud.tsx`, `hud-result.tsx`,
  `contest-board.ts`, `pinned-run.ts`, `menu-pages.tsx`, `menu-tricks.tsx`,
  `menu-freestyle.tsx`, `records.ts`, `replay.ts`, `url-params.ts`
  (`?start=bigair` dropped), `slopestyle-run.ts`'s comment,
  `strings.ts`, `strings-replay.ts`, `strings-stats.ts`, `ski-topsheets.ts`'s
  words. A stored pick or record naming the retired mode is dropped on the
  way in (`mergeSettings`, the book's checker), never a crash.
- Tools and tests: `simulate-run.mjs`'s `bigAir` mode; `tests/big_air_hud_test.ts`;
  `tests/big_air_test.ts`'s venue cases moved to a straight-venue test, the
  rest removed; the big-air rows of `catalog_test`, `race_riders_test`,
  `race_skis_test`, `records_test`, `ski_card_test`, `tricks_test`,
  `hockey_stop_test`, `halfpipe_hud_test`, `slopestyle_*_test`.
- Docs: `docs/specs/BIG_AIR.md` (its open boxes folded into ski jumping's or
  dropped); `CLAUDE.md`'s big air paragraph and labs row (replaced by ski
  jumping's); `docs/architecture.md`, `getting-started.md`,
  `level-generator.md`, `simulation.md`; `docs/freestyle.md`'s big air
  section KEPT as research (slopestyle's jumps cite it), its row marked
  retired.

## Build phases

Each phase lands green and with its lab's before and after in the PR.

- [x] **0. Research and this spec** (`docs/freestyle.md` § *Ski jumping*).
- [x] **1. The hill (R43)**: `SKI_JUMP_RULE` (both classes) in
      `trick-rules.ts`, the norm's elements (`hillOf`) and the profile
      (`skiJumpProfile`, `skiJumpHeightAt`), `setSkiJump` over the
      straight venue, the analytic surface (`withMoguls` with no line),
      `Level.skiJump` (`SkiJumpHill`, `ski-jump-types.ts`) with
      `distanceAt` (`jumpDistanceAt`, `measuredDistance`), the gates and
      the design gate off a point mass (`edgeSpeed`, `designGate`), the
      rule's mirror; `tests/ski_jump_test.ts` (every element against the
      norm's formulas, the hill graded into two seeds' maps — not 24: a map
      costs ~12 s to generate; the venues have no analyzer check, the tests
      hold them). **Left:** `make skijump-flight`'s profile table (phase 2
      builds the lab), `make level` drawing the hill, the structure (the
      in-run on trestles where it stands over the ground).
- [x] **2. The in-run and the take-off**: the BAR (`seatOnBar`: sat on
      the jury's gate, `juryGate` — the lowest reaching the design speed
      at the hill's own density, `hillDensity`; left on the tuck or the
      jump key once racing, a shove of 1.2 m/s, `startStrict` starting the
      clock — the `dsq start@0` is gone), the WIRE (`jump-inrun.ts`'s
      `stepTracks`: guided along the profile under gravity, the tracks'
      friction 0.007 and the crouch's 0.15 m² — `SKI_JUMP_RULE.skier`, the
      same sum the generator's `edgeSpeed` does), the photocells, the
      timed press (`pushShare`: a half-sine push of 0.28 s, 2.5 m/s at
      right angles to the table at the light build, the share kept falling
      as (1 + cos(πΔ/0.28))/2; `record.timing`, `.share`, `.push`) and the
      edge crossed within the step. **Left:** the start light's phases
      (the app's), the jury moving the gate (phase 5).
- [x] **3. The flight and the landing**: `jump-flight.ts` — lift and drag
      AREAS off a polar against the angle of attack to the air
      (`JUMP.polar`, its shape the V-style studies', its size fitted), the
      air the hill's density and the wind along the hill FOLLOWING ITS
      SLOPE (a head wind's updraft up the landing hill, a tail wind's
      downdraft); the transition (laid out in 0.55 s, the V opened over
      0.35 s on the tuck or the assist), the attitude (a sat-up trim of
      44°, the assist easing it to the ideal 30→38°, the lean ±12° under
      the hand and ±26° without; under 6° the moment turns him over, past
      the polar's peak the lift goes), the roll on the edge and the
      crosswind; the telemark on the trick key (the assist's at 2.2 m),
      two-footed, late, the falls (over, rolled past 0.4 rad, sat back
      past 56°: `faceplant`, `roll`, `slam`); the distance to the half
      metre (`measuredDistance`) and the `JumpRecord`; handed to the
      engine's skier just over the snow, its legs taking the load
      (`land`), ridden to the fall line. The bot (`sim/ski-jump-steer.ts`:
      presses the push at a timing dealt ±0.04 s off its seed, flies on
      the assist, steers the out-run). `make skijump-flight`;
      `tests/ski_jump_flight_test.ts`. No injury on a clean jump (the
      design gate, the top gate, the top gate in a 3 m/s head wind).
      **Left:** the tail wind's factor is the head wind's (the physics is
      near symmetric; the norm's tail factor 1.21× is a rule of
      compensation, phase 5's); the polar's drag is under the studies'
      (see below); the "excellent" jump is the top gate's (139.5 m) — at
      the jury's gate the ideal flown on time IS the best (127 m), the
      lean's optimum being within a metre of the assist's.
- [x] **4. The ski, the build, the mode**: the ALBATROSS row
      (`defs/skis.ts`, off the card's rack: `MODE_SKIS`, `ALL_SKIS` — no
      Blender model yet, drawn by the code off a first-cut `SKI_LOOKS`
      row and a topsheet), the LIGHT build, `SKI_JUMP` and
      `skiJumpRules` (`defs/ski-jump.ts`), `RunRules.skiJump`, the
      `FREESTYLE` row first, `RACE_SKIS`/`RACE_RIDERS`, `createGame`'s
      `mode: "skiJump"` and `hill` (stood on the top gate; the in-run held
      in the crouch, straight and unbraked to the edge by `in-run.ts`;
      the existing physics rides it and leaves the edge with no take-off).
      `make sim ARGS="--mode skiJump"` runs. **Placeholders the app phase
      owns:** the words `SKI JUMPING` in `strings-replay.ts` and
      `strings-stats.ts`; the tricks card lists the format through
      `FREESTYLE` with no box, HUD or plate of its own yet.
- [x] **5. The wind, the jury, the scorer, the contest, the field, the par,
      the bot**: the hill's own air (`jump-wind.ts`, head and tail both),
      the five stations and their mean (`JumpRecord.stations`,
      `.measured`), the jury's gate a round and its lowering, the hold on
      the bar for a tail wind (the dealt field's moments), the scorer
      (`ski-jump-judge.ts`), the contest and its dealt field
      (`ski-jump-contest.ts`, `GameState.skiJumpContest`), the par
      (`SKI_JUMP_PAR`), `make sim --mode skiJump` scoring points and a
      place; `tests/ski_jump_judge_test.ts`, `tests/ski_jump_contest_test.ts`.
      **Left:** the jury holding the PLAYER on the bar (the app's light:
      `windAlong(state, state.jump, 0)` against `HILL_AIR.holdTail`), a
      coach's request to lower his gate (`createGame`'s `gate` with the
      contest; the reference stays the round's), the start order dealt by
      the player's book (`SkiJumpContest.level`, 0.5 today), a round
      restarted when it passes HS, the normal hill's par re-measured once
      its design gate is under its top gate.
- [ ] **6. Big air retired** (the list above), R37 rewritten.
- [ ] **7. The app**: the tricks card, the hill row, the HUD, the plate and
      the board, the words, the URL, the records, the replay recipe;
      `tests/ski_jump_hud_test.ts`; `screenshots --surface freestyle`.
- [ ] **8. The hill as drawn**: every piece above; `make skijump`'s
      `hill`, `parts` and `night` sheets.
- [ ] **9. The jumper as drawn**: the poses, the suit, the skis and the free
      heel; `make skijump`'s `poses`, `skier-metrics`.
- [ ] **10. The cameras and the replay**: the rows, the start, the profile
      camera, the broadcast; `lenses`.
- [ ] **11. The audience, the arena, the floodlights**: `crowd`, `night`.
- [ ] **12. The sound**: `audition` and `--meter`.
- [ ] **13. Its hills**: the trick maps first; then its own pinned hills
      (`RACE_MAPS.md`'s pattern) chosen for the hill they cut; docs,
      `CLAUDE.md`'s paragraph and labs rows, the changelog; delete this
      spec.

## Research to-do

- [x] The hill classes, the norm's profile formulas and limits, two real
      hills' certificates, the measuring devices, the platforms and tower.
- [x] The scoring: metre values, style deductions, compensation and its
      definition, published factors; the format; the equipment; the build.
- [x] The jump's speeds, the take-off, the flight's angles and L/D, the
      landing's speed and load, the broadcast's cameras.
- [ ] The polar itself as a table (lift and drag areas against the angle of
      attack, the body angle and the V) from a wind-tunnel source — the
      flight lab fits one meanwhile, marked *(est.)*.
- [ ] The current wind-window and gate practice (how often the jury moves
      the gate; the wind limits a jury holds a jumper for).
- [ ] The flying hill's numbers (the air's density matters; the norm leaves
      it out), if a flying hill is wanted.
- [ ] The cross lines' and the HS line's colours, the distance boards'
      numbering, the start light's phases on a modern hill.

## Settled (phase 1 and 4)

- The LARGE hill (HS 140) first, and the NORMAL hill (HS 106) as a second
  row of the same rule, since it cost nothing more (`hill: "normal"`).
- The LIGHT build is the rider; no fifth build. The light build's 60 kg in
  kit is ~6 kg under the field's ~66 kg — near enough for the flight to be
  fitted at it (phase 3).
- The pair is the ALBATROSS. The trial round is kept (`SKI_JUMP.trial`).

### What the hill measures (the large hill, `tests/ski_jump_test.ts`)

h 62.90 m, n 108.45 m (h/n 0.58), v_K 30.26 m/s, r_L 300 m, r₁ 103.2 m,
t 6.79 m, s 3.15 m, β_P 37.0°, β₀ 6.17°, β_L 31.25°, e₁ 98.8 m, e₂ 80.6 m,
a 82.6 m, l₁ 16.2 m, l₂ 13.9 m — the norm's, and the profile's slopes at
the knoll's foot, P, K and L within 0.05° of them (the foot within 0.3°).
The in-run's curve (curvature growing evenly to 1/r₁) is 85.7 m, so the
straight at 35° is only ~8 m and the gates stand on 34.5–35°. U is 87.8 m
below the edge (the norm's 88 at most). The distance read along the
profile from the knoll's foot is 125.2 m at K, 0.6 % short of the norm's
1.005 × chord: it is SCALED (×1.0063) so K reads 126 — L then reads 139.97
and P 109.7. 28 gates 0.39 m of height apart; a 72 kg point mass in a
0.15 m² crouch on 1° ice tracks reaches 26.96 m/s off the top gate,
23.7 off the lowest, and the design 26.2 off gate 22. The crouch's 0.15 m²
is below the ~0.2 the research reads off a simulation, because at 0.22 the
top gate falls short of v₀; the norm's top gate is meant to give ~27.6
(K in a 3 m/s tail). Phase 2 fits it to the engine's own in-run. The
NORMAL hill's design gate is its top gate (24.7 m/s off it): its row's
v₀ 24.6 is near what its e₁ carries — the in-run lab should look at it.

### What the next phases must know

- `Level.skiJump`'s places are m of PLAN along the line (the track's `s`),
  the deck at 0; `distanceAt(planX)` credits a landing; the edge is a
  one-sample wall `s` m high (`p.dx` = 0.05 m); `takeOff` is the table's
  angle at the edge (down positive).
- The engine's skier is the ordinary one: in the in-run `in-run.ts` holds
  the crouch; nothing guides him in the tracks, and he leaves the edge on
  the snow's own step (`RunRules.skiJump` is read by nothing yet).
- The kicker `SJ` is the take-off (height `s`, ramp the table).
- `RunRules.jury` eases the day to gusts under 40 km/h and a steady fall.
- `make sim ARGS="--mode skiJump --skis albatross --rider light --count 4"`
  runs (~110 km/h top, 0.9 s of air, no wipeout) but every seed reads
  `dsq start@0`: the strict gates judge the start gate at the spawn before
  any push or take-off exists. Phases 2 and 5 own the start (the bar, the
  push, the window) and the bot.

## Settled (phases 2 and 3)

- The in-run's numbers are the hill rule's (`SKI_JUMP_RULE.skier`): 67.5 kg
  (the light build and the jumping kit), a 0.15 m² crouch — at the low end
  of the measures; any more and the normal hill's top gate falls short of
  its v₀ — tracks' friction 0.007, air 1.24 kg/m³. The large hill's design
  gate is now gate 22–23 of 28; the normal hill's is still its top gate.
- THE POLAR as fitted (`JUMP.polar`): at 38° 0.55 m² of lift and 0.32 m²
  of drag, L/D ~1.7 — the studies' lift, under their drag (0.4–0.6 m²).
  With the studies' drag the design gate's jump falls 15 m short of K: a
  point mass with no pitch through the flight loses what a real body's
  attitude gains. A source's table (Research to-do) should replace it and
  move the attitude with it.
- THE WIND is read LEVEL along the hill's line, as the stations read it,
  and the air keeps that speed over the plan while following the slope:
  head wind +5.5 m a m/s, tail −5.5 (the lab's head and tail rows). Held
  against the air (not the slope) a head wind SHORTENED the jump. The
  map's own wind is always down the mountain (`downhillFrom`), so a
  played jump meets a tail wind; the labs and tests stage one
  (`SkiJumpState.staged`).
- The jumper holds his attitude against his path over the snow
  (`attitude.wind` 1); against the air it makes no measurable difference
  near the slope.
- Never pressed, he clears no more than the knoll (39 m): a take-off is
  the jump. 0.1 s off, 105–114 m; 0.2 s early, 55 m.

### The flight lab (`make skijump-flight`, seed 38, the large hill, the light build, ρ 1.243)

```
THE IN-RUN — the speed over the edge in calm air, km/h
1: 85.6  4: 86.9  7: 88.2  10: 89.5  13: 90.8  16: 92.0  19: 93.2  22: 94.4  25: 95.6  28: 96.7
the jury's gate 22 (design 94.3 km/h); the generator's 23

row          gate timing  wind   edge  cells  push  time  peak     @    dist   land  into  load  how       end      err
design         22   0.00   0.0   94.4   92.3  2.50  4.28   4.3   56.2  127.0  127.6  4.64  2.77  telemark  clean     0.4
top            28   0.00   0.0   96.7   94.8  2.50  4.60   5.2   77.3  139.5  130.7  6.11  4.20  telemark  clean     0.4
low             1   0.00   0.0   85.5   82.8  2.50  2.52   3.8    5.3   63.5  105.4  2.58  1.56  telemark  clean     0.7
gate+4         26   0.01   0.0   96.0   94.0  2.49  4.50   4.9   70.7  135.5  129.9  5.66  3.62  telemark  clean     0.4
gate-4         18   0.01   0.0   92.8   90.6  2.50  4.01   3.9   39.5  116.0  124.5  3.31  1.92  telemark  clean     0.4
early-.05      22  -0.05   0.0   94.4   92.3  2.33  4.19   4.0   51.0  123.5  126.7  4.17  2.44  telemark  clean     0.3
early-.1       22  -0.09   0.0   94.4   92.3  1.94  3.91   3.7    0.3  114.0  124.0  2.76  1.64  telemark  clean     0.3
early-.2       22  -0.19   0.0   94.4   92.3  0.61  2.06   3.7    0.3   55.5  106.1  1.57  1.22  telemark  clean     0.0
late+.05       22   0.05   0.0   94.4   92.3  2.28  4.14   3.8   47.2  122.0  126.6  3.93  2.28  telemark  clean     0.6
late+.1        22   0.10   0.0   94.4   92.3  1.75  3.61   3.7    0.3  105.0  122.1  1.78  1.25  telemark  clean     0.9
none           22      -   0.0   94.4   92.3  0.00  1.47   3.7    0.3   39.0  101.9  1.98  1.36  telemark  clean     0.0
tail-3         22   0.01  -3.0   96.2   93.8  2.49  3.69   4.0   40.6  110.5  129.8  3.17  1.85  telemark  clean     0.5
tail-2         22   0.00  -2.0   95.6   93.3  2.50  3.88   4.1   45.2  116.0  129.3  3.76  2.18  telemark  clean     0.5
tail-1         22   0.00  -1.0   95.0   92.8  2.50  4.08   4.1   50.1  121.5  128.6  4.23  2.48  telemark  clean     0.4
head+1         22   0.01   1.0   93.7   91.8  2.49  4.50   4.5   62.9  132.0  126.3  4.99  3.05  telemark  clean     0.4
head+2         22   0.01   2.0   93.1   91.2  2.50  4.73   4.7   71.7  138.0  124.9  5.34  3.34  telemark  clean     0.4
head+3         22   0.01   3.0   92.4   90.6  2.49  4.98   5.1   82.0  143.5  123.2  6.29  4.39  telemark  clean     0.4
flat           22   0.00   0.0   94.4   92.3  2.50  3.86   3.8   30.9  115.5  128.4  2.87  1.70  telemark  clean     5.5
flatter        22   0.00   0.0   94.4   92.3  2.50  3.41   3.8   11.4  100.5  125.2  1.77  1.25  telemark  clean     7.9
steep          22   0.00   0.0   94.4   92.3  2.50  3.97   4.4   49.3  112.5  120.0  3.51  2.02  telemark  clean     5.4
bare           22   0.00   0.0   94.4   92.3  2.50  4.00   4.4   48.9  113.5  119.8  3.65  2.11  twoFooted clean     6.0
bare-flat      22   0.00   0.0   94.4   92.3  2.50  2.59   3.8   10.9   74.0  123.0  3.40  1.95  twoFooted clean    19.9
bare-back      22   0.00   0.0   94.4   92.3  2.50  2.23   3.9   17.2   57.0   99.0  4.40  0.00  fall      fall     31.8
top-head+3     28   0.01   3.0   94.6   93.0  2.50  5.23   6.7  104.3  153.0  124.8  8.95  7.68  telemark  clean     0.4
bot            22  -0.02   0.0   94.4   92.3  2.46  4.27   4.2   55.2  126.0  127.4  4.54  2.70  telemark  clean     0.4
bot-map        22  -0.02  -1.9   95.3   93.1  2.46  3.87   4.0   44.3  115.5  128.8  3.65  2.11  telemark  clean     0.5

THE FACTORS — points; the hill's sheets beside them
  gate  6.49  (7.67 a metre of in-run)
  head  9.90  (10.8 a m/s)
  tail  9.90  (13.07 a m/s)
```

`make sim ARGS="--mode skiJump --skis albatross --rider light --count 8"`:
8/8 finished, none out (was 0/8, `dsq start@0`), 105–126.5 m in the map's
own tail wind, 3.5–4.3 s of air, no wipeout; the default and the aerials
sims' digests unmoved.

### What the next phases must know (phases 2 and 3)

- `GameState.jump` (`SkiJumpState`, `ski-jump-state.ts`): `stage`
  (`bar | tracks | air | down`), `gate` (an index, 0 the lowest),
  `density`, the hill frame's `along`/`across`/`y`, the tracks' `speed`
  and `left`, the air's `va`/`vw`/`vy`, `aoa`, `lay`, `vee`, `roll`,
  `prepAt`, and `record` (`JumpRecord`: gate, inRunSpeed, edgeSpeed,
  timing, share, push, flightTime, peak, peakAt, wind, attitude, roll,
  veeAt, lost, distance, reach, landingSpeed, into, load, landing,
  outcome). `staged` stands a wind for the labs; a played run never
  sets it.
- The `skiJump` event: `stage` `go` (off the bar), `takeOff` (with the
  `timing`), `touch` (with the `distance`); the take-off also pushes the
  engine's `air`, the landing its `land` (the audio's).
- `createGame`'s `gate` (an index; the jury's when left out); `juryGate`,
  `gateSpeed`, `hillDensity`, `timeToEdge` (`ski-jump-api.ts`);
  `startStrict` (`strict.ts`) starts a strict run's clock off the bar.
- The record's `outcome` settles at the fall line (`clean`), on a hand
  down (`touch`) or a fall; the phase 5 scorer reads it with `landing`
  for the style marks, `wind` and `gate` for the compensation.
- The bot's timing is `ski-jump-steer.ts`'s `botTiming(seed)`; a field's
  jumpers dealt later should deal theirs the same way, off a stream of
  their own.

## Settled (phase 5)

- THE HILL'S AIR is its own (`jump-wind.ts`), never the map's folded wind:
  a day's mean along the hill dealt off the contest's seed about a small
  head wind (+0.2 m/s), its spread 0.45 m/s + 0.05 × the map's 10 m wind,
  swinging over periods of 15 min to 1¾ h (so one round may be a head-wind
  round and the next a tail-wind one), gusts of 4–23 s blown along the
  hill at 8 m/s, a swing across it. Over 200 contests on seed 38 the
  rounds' means run −2.1 … +2.6 m/s, a third of them tail. A jump with no
  contest flies the map's own hill's air, dealt off the map's seed (seed
  38: +0.9 m/s head, where the folded map wind was −1.9 tail).
- THE STATIONS stand at the edge and at 25, 50, 75 and 100 % of K; each is
  read as the jumper passes it, and the mean of those he passed is the
  wind compensated (a jump short of K reads four).
- THE SCORING NUMBERS are the hill's own, measured by the flight lab the
  norm's way: the large hill 6.5 points a metre of in-run, 9.9 a m/s of
  head wind and 11.98 of tail (1.21 ×); the normal hill 6.2, 6.2 and 7.5.
- THE STYLE: 20 a judge less 0.5 for any flight, the take-off's error ×8
  (most 2; never pressed 2), the attitude's mean error × 0.12 a degree
  (most 1.5), the roll past 4° × 0.1 (most 1.5), the V late past 0.8 s
  (most 1; never 1.5), turned over 5; the landing 0.5 a telemark, 1.5
  late, 2 two-footed, 4.5 a fall, + 0.5 a g of load past 3.2 (most 1.5);
  the out-run 4.5 a hand down, 7 a fall, 0.5 unsteady past 4.5 g; each
  judge's eye ±0.4 before the half point. The bot's clean telemark reads
  18.5–19 a judge (~56), a fall ~8 a judge.
- THE PAR (`SKI_JUMP_PAR`, the lab's bot at the calm jury gate): the large
  hill 126 m, 3.6 m a metre of in-run, 5.5 m a m/s either way; the normal
  hill 99.5 m, 3.1, 3.2 head and 3.0 tail.
- THE JURY picks the round's gate off the forecast mean at its start: the
  highest whose par + 8 m stays under 0.97 × HS; for the rest of the round
  it lowers it whenever the wind would carry the best past HS, the
  round's first gate staying its reference. A jumper is held on the bar
  15 s at a time (8 at most) while the tail at the edge is past 3 m/s.
- THE DAY: the trial at 0 s, the first round at 2,400 s, the final at
  6,600 s, a jumper every 70 s, 8 s from his run's start to the edge.
- THE FIELD (`SKI_JUMP_FIELD`): a level each; his distance par + 3 −
  22 × (1 − level)^1.3, ± a 2.5 m bell, a botched take-off one jump in
  twenty (8–24 m short), a fall 1.2 % (+4 % a metre past HS); his marks
  16.7 + 1.9 × level ± 0.5 (a botch and past HS a mark off; a fall 8.5).
  Seed 1's large hill over contests 1–6: the best 127–135 m, the tenth
  118–128, the thirtieth 109–117; points the winner's 104–117 a round, the
  thirtieth's 74–91 (the head winds' compensation keeps them under a
  real round's).
- `make sim ARGS="--mode skiJump --skis albatross --rider light --count 8"`:
  8/8 home, no wipeout, the bot's points 102–129 and its place 1st–11th of
  fifty (on the default pair and build, `--count 8`: 96–123, 5th–18th); the
  default and the aerials sims' digests unmoved.

### What the app phase must know (phase 5)

- A contest: `freshSkiJumpContest(seed, level, { trial })` (the level with
  its hill set); the next jump `skiJumpRoundOf(c)` (null: over, or out of
  the final), `skipTrial(c)`, `skiJumpSetup(c)` (the round, the gate, the
  reference, the moment, the air). Stand the run up with
  `createGame({ mode: "skiJump", level, skiJumpContest: c })` — the gate
  and the air are read off it. Once `judgeSkiJumpRun(state)` answers (the
  outcome settled, or a no start), `skiJumpContestAfter(state)` is the
  contest with the jump filed (its record kept) and the final opened when
  it put him in the thirty.
- The boards: `skiJumpBoard(c, round)` (rows with shared places),
  `skiJumpPlace`, `finalists`, `startList`, `roundPlan` (every jumper's
  moment and gate), `skiJumpStandings(c)` (totals, finalists first). A
  jump's points part by part are `JumpScore` (`distancePoints`, `marks`,
  `style`, `gatePoints`, `wind`, `windPoints`, `points`).
- The wind the HUD shows on the bar: `windAlong(state, state.jump!, 0)`;
  the stations' readings `record.stations`, their mean `record.measured`.

## Open questions for the user

- The NORMAL hill as well as the large (default: yes, the large first), and
  a FLYING hill later?
- The flight's input: the lean, the V on the tuck and the roll on the edge,
  with the assist on by default (as proposed) — or fewer hands (the V and
  the roll automatic, the lean and the timing the player's)?
- The telemark on the trick key (proposed) or automatic with a timing
  window on the jump key?
- A fifth, jumper's BUILD (~66 kg, BMI 20.5) instead of the light one?
- The trial round and a qualification (the championship's 50 out of a
  larger entry), or round 1 and the final only?
- The pair's name (ALBATROSS proposed).
- Team events (four jumpers a team) — later or never?
