# The lifts' hardware

What a real lift's moving and standing steel looks like, and how the game
draws it. The stations' buildings are [buildings.md](buildings.md)'s; where
a lift ends and the way off it is [summit-stations.md](summit-stations.md)'s.
The plan every part stands on — where each tower is, how high the rope
hangs, where every carrier is at a moment — is the engine's
(`engine/game/lift-line.ts`: `planLift`, `ropeAt`, `carrierAt`), and
nothing here moves it.

The figures below are the bands a ski area's lifts fall in, restated from
operators' descriptions, construction notes, enthusiasts' surveys and the
ropeway standards' summaries; no maker, model or ski area is named.

## The real thing

### Towers

- **The column** is a round steel tube, galvanised or painted, tapered
  toward its head, standing on a concrete footing. A chair's towers run
  about 8–20 m to the rope, a gondola's taller (15–35 m), a drag's 5–12 m.
  A chair's column is roughly 0.5–1 m across at its foot.
- **The crossarm** across the head is a box girder. On a two-rope lift it
  carries a **sheave train** at each end: a row of wheels on a balanced
  beam (pairs of wheels on bogies, the bogies on a main beam, the beam on
  a pivot), the rope riding over them in a groove. A train has 2 to 16
  wheels; 4–8 is usual on a chair, 6–12 on a gondola. The wheels are
  about 0.4–0.5 m across, steel hubs with **rubber liners** in which the
  rope runs. A tower that holds the rope up (support) has the wheels
  under the rope; one that holds it down (depression) has them over it.
- **The train hangs inboard** of the rope: the carriers' grips clamp the
  rope from the outboard side, so a grip runs over the wheels with its
  hanger clear of the train and the crossarm.
- **A catwalk** with a railing about a metre high runs along the crossarm
  (on cheaper lines only rails to clip on to), reached by a **ladder** up
  the column's face on stand-off brackets.
- **Lifting frames** stand over each train — a beam the train is lowered
  from for maintenance — and a **lightning rod** or a small antenna stands
  over the head. Each tower carries its **number** on a plate.
- **Pads**: a tower standing in or beside a run is wrapped in foam to over
  head height (the engine's `TOWER_PAD`).

### Chairs (a detachable quad)

- **The grip** clamps the rope with spring-loaded jaws; over it a carriage
  with rollers runs on the terminal's rail once the grip opens, and a
  plate the station's tyres drive it by.
- **The hanger** is a steel tube of 2–3 m from the grip to the chair,
  swept back so it comes down behind the backrest to the seat's frame.
- **The seat** is 2.2–2.4 m across for four, about 0.5–0.55 m a rider:
  four padded seat cushions and four padded backrests about 0.6 m tall on
  a steel frame, armrests at the ends.
- **The safety bar** pivots off the top of the back at each end and comes
  down over the riders' laps, about 0.4–0.5 m above the seat; from it
  hangs the **footrest**, a rail or a grid about half a metre under the
  seat, one for each pair of riders on many chairs.
- Detachable chairs run at about 5 m/s on the line and creep through the
  stations; carriers are spaced every few seconds (the engine: every 24 m
  at 5 m/s).

### Gondola cabins (eight seats, monocable)

- About 2 m across, 2.1–2.2 m along and 2.1–2.4 m tall outside the
  hanger, 700–900 kg empty. The body is rounded at its corners, with a
  **window band** right round it between corner pillars and a few
  mullions, the roof domed, the floor tapered into a skirt.
- **Sliding doors** in one flank (the platform side) part in the middle;
  **ski racks** hang outside, on the ends or beside the doors.
- **The hanger** comes straight down from the grip to a suspension frame
  spread across the roof; the cabin hangs about 2 m under the rope.

### T-bars

- A single rope at 3–8 m over the track, often on towers with an arm to
  one side. From each grip on the rope hangs a **spring box** — a housing
  round a reel the cord is wound on, which pays out as a skier pulls the
  bar down and reels it back in when he lets go.
- **The bar** is a T about a metre wide on a short stem, its arms often
  bent down a little and padded where they sit behind a skier's thighs.
  The rope runs at up to about 3 m/s.

### Bullwheels

- The wheel the rope turns round at each end, 3–6 m across on a chair or
  a gondola (inside the terminal's hood there), smaller and in the open
  on a drag: a lined rim, spokes and a hub on a vertical shaft.

### The turn round the wheel

- **A detachable chair or gondola** lets go of the rope as it comes into
  a terminal and is carried on the station's RAIL by rows of tyres, slowed
  from the rope's 5–6 m/s to a creep (about 1 m/s for a chair, a walk or
  less for a gondola's cabin). The rail runs on in a HORSESHOE round the
  back of the bullwheel, so the chairs come round it nose to tail, a few
  metres apart, at that creep, and are taken back up to speed and onto
  the rope on the other side. Under a chair's hood the rail, the tyres and
  the wheel are hidden in its skirt; the hood's back end is rounded round
  the wheel, and the whole terminal stands on a central steel pedestal
  inside the horseshoe, the chairs running round outside it. A hung
  carrier leans OUT of the turn (`atan(v²/(g·r))`, a few degrees at a
  creep).
- **A fixed grip** — a drag's — never lets go: its bars go round the wheel
  on the rope at the rope's speed, flung out on their cords. A T-bar's
  bottom wheel stands flat on a central post, the rope going up one side
  of the line and the empty bars coming back down the other, on towers
  that are a T with a sheave train at each end of the arm.

## As drawn

All of it is built in code, faceted and coloured per vertex, one
instanced mesh a part for the whole resort (`pwa/src/game/lifts.ts`):

| Part | Built by | What it is |
| --- | --- | --- |
| Column | `lift-shapes.ts`'s `columnGeometry` | a 12-sided tapered tube, scaled to the plan's girth (`LiftLook.column`, which a skier meets) and height |
| Ladder | `ladderGeometry` | rails and rungs up the downhill face, leant with the taper, its foot in the snow; drawn near the lens only |
| Tower head | `towerHeadGeometry` | the crossarm and its saddle, a sheave train at each rope (6 wheels on a chair, 8 on a gondola, 4 at each end of a drag's T) on bogies inboard, brackets, the catwalk and its railing, lifting frames, the lightning rod and the number plate |
| Chair | `lift-carriers.ts`'s `chairGeometry` | the grip and carriage, the swept hanger, the frames, four seat cushions and four backrests, armrests, the lowered safety bar and two footrests — built round `CHAIR_SEAT` and `CHAIR_BACK`, where the seated rider's pose sits |
| Cabin | `cabinGeometry` | the grip, hanger and roof frame; the body lofted through rounded rings (`CABIN_Y`, `CABIN_HALF`), its window band with pillars, mullions and a sky-lit upper half, the door's seams on the right flank, a ski rack on each end; the rider's own cabin (`own-cabin.ts`) wears the same grip, hanger and roof |
| T-bar | `springBoxGeometry`, `teeGeometry` | the grip and the spring box's housing, the padded bar on its stem |
| Bullwheel | `bullwheelGeometry` | a lined rim, six spokes and the hub, scaled to its station |

**Two cuts** (`lift-cuts.ts`): every chair, cabin, T-bar and tower head
has a far cut of a few boxes, and each instance is handed to one or the
other by its distance from the lens (`CHAIR_REACH`, `CABIN_REACH`,
`HEAD_REACH`, `TEE_REACH` in `lifts.ts`); the standing parts are handed
out again only once the lens has moved ten metres. The detail is paid
only within a few dozen metres, so the whole set costs fewer triangles a
frame than the plain boxes it replaced.

**Round the wheels.** Every carrier's loop is up the line, half a circle
round the top wheel, back down and half a circle round the bottom one
(`lift-line.ts`'s `carrierLoop`, `carrierPlace`) — the circle's radius is
half the ropes' gauge, so the rope drawn round the wheel and the carriers
on it are one curve. A detachable's carriers creep round at the
terminal's speed on the station's rail (`station-build.ts`'s `turnRail`,
under a chair's hood and a gondola's platform roof), a drag's bars at the
rope's speed; each leans out of the turn (`carrier-swing.ts`'s
`carrierRollAt`, eased in and out over the first and last quarter of the
half circle), and the house behind a wheel stands past where they swing
(`HOUSE_CLEAR`).

## The lab

`make lifts` (`pwa/src/tools/lift-view.ts`, through the world lab's
renderer) draws the sheet by day and at hour 21 —
`previews/world-free-h11-lifts.png`, `previews/world-free-h21-lifts.png` —
and one part a frame (`world-free-h11-lift-tower.png`, `-chair`, `-cabin`,
`-tbar`) and the TURNS (`world-free-h11-lift-turns.png`, drawn at 1920 × 1080): every station's wheel from beside it
under the hood at two moments two seconds apart and from a skier's eye —
a chair's foot and top, a drag's foot and top, a gondola's foot; and the
parts: a chair's tower from three sides and at chase range, a
gondola's and a drag's towers, a chair from three sides, a cabin from
two, a T-bar on its rope, both lines from a skier's eye, a drag's
bullwheel and the far cuts through a long lens. `SEED=` and `REGION=`
choose the map. `tests/lift_shapes_test.ts` holds every part's budget,
the chair to its seat and the cabin to its bands.

## Getting on and off

### The real thing

What a rider does at each lift, in the order he does it, with the numbers
the ride is built to:

- **A detachable chair.** The grip lets go of the rope in the bottom
  terminal and the chair runs round the wheel on a rail at a walking pace
  — about 1 m/s past the load line against some 5 m/s on the rope. The
  riders wait on the load line, skis pointed up the lift, and look back
  over the INSIDE shoulder for the chair coming round behind them; the
  seat meets the back of the knees and they sit as it scoops them. The
  chair is taken back up to the rope's speed on the acceleration rail
  over a few metres, the hanger leaning back as it is pulled away and
  forward as it is slowed again at the top. The SAFETY BAR is lowered
  once the chair is clear of the load and raised again at the sign before
  the unload. At the top the rail brings the chair down level with the
  unload ramp at about 1.3–1.5 m/s: tips up, skis on the ramp, the rider
  stands at the unload point and lets the ramp carry him on and off the
  chair's way.
- **Over a tower** the rope bends over the sheaves and the grip's way
  turns with it: a chair or a cabin on its hanger is kicked into a swing
  of a few degrees that dies away over a few swings.
- **A gondola.** Its cabin is slowed to a crawl in the station — 0.2–0.3
  m/s — detached and its doors opened; the rider racks his skis on the
  door and steps in while it creeps, the doors shut, and it is taken back
  onto the rope. At the top he steps out of the open door onto the
  platform the same way.
- **A T-bar.** The rope runs at up to about 3 m/s. The rider stands in
  the track, the bar's stem to his side, and the bar is pulled down off
  its spring box and set under the seat; he is towed standing, never
  sat. At the top he lets go, the bar is pulled from under him and its
  cord is REELED BACK into the spring box, the empty bar riding back down
  the line high and short.

### As built

- **One chair, the clock's.** The chair a rider sits on is the clock's
  own carrier (`LiftRide.carrier`, read through `carrierAt`), so the rider
  and the chair the view hangs are one thing: no chair of his own is
  drawn. Its grip runs the station rails at both ends
  (`carrierGripAt` — the top's rail laid over `LiftPlan.ramp`, the snow
  under the unload, so the seat comes down to a stood skier's knees) and
  it swings by `carrier-swing.ts`'s `carrierSwingAt`, a pure function of
  where on its loop it is: the lean off the grip's slowing and pick-up
  (`atan(−a / g)`) and the lurch off the last two towers, damped. The
  rider's own chair and every other one agree to the figure, and nothing
  is stepped or stored.
- **The wait and the look back.** On a chair's load line or a drag's
  track the engine knows how long till his carrier comes
  (`LiftRide.due`); `skier-seat.ts`'s `lookBack` turns his head and
  shoulders over the inside shoulder as it nears and back to the front as
  it meets him, and the sit blends out of the stance he waits in.
- **The safety bar** is a part of its own (`lift-carriers.ts`'s
  `chairBarGeometry`), turned about its pivot on every chair by where the
  chair is: down 8–16 m past the load, up 26–34 m before the unload.
  Raised, it stops short of the hanger curving over the riders' heads
  (`CHAIR_BAR.up` against `CHAIR_HANGER`), as a real bar comes up against
  its stop, with the footrests out ahead over them.
- **The stand-up.** At the unload the chair lets go of him over
  `TUNING.lift.rise` s (`LiftRide.stand`): the seat share eases out while
  he slides on ahead of it down the ramp, turned off the chair's way, the
  lift letting him go once he is up. The crowd stands up the same way,
  stood off where he sat.
- **The T-bar's reel.** Every bar's cord is kept by the view and moved
  at a reel's rates — paid out as a rider's weight comes on, reeled in
  after he lets go — so a bar is never cut from long to short; one coming
  round to a waiting rider is pulled down to him before it takes him.
- **The gondola.** He WALKS ABOARD with his skis (`lift-skis.ts`): he
  stops short of the foot station's door, steps out of his bindings and
  shoulders the pair as he does in town (`town.ts`), walks in through
  the door and the hall to the platform in his boots, and when his cabin
  comes alongside turns to it, takes the pair off his shoulder and stands
  it in the rack on its back door leaf (`gondola.rack` s), then steps in
  on foot (`gondola.stepIn`). The pair rides in the rack, placed where
  the leaf has it every step as the doors shut and the cabin swings. At
  the top he takes it back onto his shoulder behind the fade, walks out
  of the door onto the pad for `gondola.out` s, and once the lift lets
  him go lays it down and clicks back in. Nothing of him, and no ski,
  passes through a station's wall or his cabin's while the picture shows
  him. His own cabin is the clock's cabin lofted band for band
  (`own-cabin.ts`), opened on its right flank for the door, its glass
  clear and its inside lined, floored and benched.

### The labs

`make lift-flow` is pure Node: it rides each moment — `chair-load`,
`chair-unload`, `tbar-pick`, `tbar-release`, `gondola-in`, `gondola-out`
— with the engine and draws it through the game's own pose, and prints
the worst speed of the drawn body, the biggest pop of any joint between
two frames, the fastest swivel, how far a boot sinks into or floats off
the snow and how long the picture is dark, with how long each part
(the wait, the sit, the stand, the walk out) lasts. Keep a `--json=FILE`
before and a `--compare=FILE` after. `make lift-board` photographs the
same six moments as filmstrips through the game's renderer, from
several lenses (`previews/lift-strip-<stage>-<seed>.png`). `make
lift-path` is pure Node too: it traces a gondola's rider in plan through
both stations from every approach — the houses, the furniture, the rail,
his cabin's box and his skis every quarter second — and counts the
seconds any of him shows through a station's wall or his cabin's
(`previews/lift-path.png`; `--json` before, `--compare` after).
