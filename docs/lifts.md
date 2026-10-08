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

## As drawn

All of it is built in code, faceted and coloured per vertex, one
instanced mesh a part for the whole resort (`pwa/src/game/lifts.ts`):

| Part | Built by | What it is |
| --- | --- | --- |
| Column | `lift-shapes.ts`'s `columnGeometry` | a 12-sided tapered tube, scaled to the plan's girth (`LiftLook.column`, which a skier meets) and height |
| Ladder | `ladderGeometry` | rails and rungs up the downhill face, leant with the taper, its foot in the snow; drawn near the lens only |
| Tower head | `towerHeadGeometry` | the crossarm and its saddle, a sheave train at each rope (6 wheels on a chair, 8 on a gondola, 4 on a drag's single arm) on bogies inboard, brackets, the catwalk and its railing, lifting frames, the lightning rod and the number plate |
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

## The lab

`make lifts` (`pwa/src/tools/lift-view.ts`, through the world lab's
renderer) draws the sheet by day and at hour 21 —
`previews/world-free-h11-lifts.png`, `previews/world-free-h21-lifts.png` —
and one part a frame (`world-free-h11-lift-tower.png`, `-chair`, `-cabin`,
`-tbar`): a chair's tower from three sides and at chase range, a
gondola's and a drag's towers, a chair from three sides, a cabin from
two, a T-bar on its rope, both lines from a skier's eye, a drag's
bullwheel and the far cuts through a long lens. `SEED=` and `REGION=`
choose the map. `tests/lift_shapes_test.ts` holds every part's budget,
the chair to its seat and the cabin to its bands.
