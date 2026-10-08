# Civilians: the people on foot

A ski area on a good day is not only the people skiing it. Round the lifts'
feet, the lodges and the huts there are as many people again off their skis:
the staff at work and the guests walking, resting, eating, drinking and
partying. The free ride's CIVILIANS are those people — presentation only,
dealt over the map's buildings and stood off the skiing, so the base area and
the terraces read as a real resort's.

This page is the research the look and the behaviour come off, restated as
facts and numbers, and the design built on it. The code is
`pwa/src/game/civilian-roles.ts` (who), `civilian-spots.ts` (where) and
`civilian-plan.ts` (when, and what each one is doing); `tests/civilians_test.ts`
holds it.

## What the research says

### The staff

- **The lift crew.** Every lift has an operator at the top and attendants at
  the foot. Their work is the load: directing riders onto the load line,
  watching each chair in, checking the restraint bar is down, slowing or
  stopping the lift on a misload, and checking tickets. Between chairs they
  keep the load and unload ramps in order — SHOVELLING snow onto a ramp worn
  thin, SWEEPING the boards and the load line clear of new snow, raking the
  maze — and the job asks a person who can stand on cold ground for hours at a
  time and lift 20–25 kg. A crew member stands by the booth beside the load
  line, facing the line, and works it in short bursts.
- **How the crew is dressed.** A ski area dresses its staff in its own shell,
  one colour for everybody, so a guest picks them out across a base area. The
  lift crew commonly wears a high-visibility bib or vest over it, since they
  stand where machines and skiers move.
- **The patrol.** Patrollers wear RED jackets with a WHITE CROSS (front, back
  or both) over dark pants; the reversed first-aid cross reads against snow
  from a long way off, which is the point of it (another tradition is rust
  and blue with a yellow cross). They stand at the tops of the lifts, at their
  huts, looking over the runs, and sweep the runs at the close.
- **The ski school** gathers its classes at the base in a colour of its own:
  an instructor talking and pointing, the class in a ring or an arc before him,
  children holding their skis.
- **Workers** clear the decks, paths and steps of the lodges and huts with
  shovels before the first chair and through the day.

### The guests off their skis

- **Walking in ski boots.** The stiff shell holds the ankle, so the knee bends
  less and the hip more; the step is short, the foot set down flat with a heel
  and roll, the arms swing little. A comfortable boot pace is about 0.8–1.1 m/s
  with a step of about half a metre (a stride, two steps, about a metre).
  Families walk at the child's pace; the old at the slow end.
- **Carrying skis.** The usual carry is on one shoulder: the pair clipped
  together by its brakes, laid on the shoulder topsheet down with the bindings
  BEHIND the shoulder and the tips forward, a hand forward on them to hold them
  down, the poles in the other hand. (Tails forward with the tips up behind is
  the other school.) Children are often seen dragging or hugging theirs.
- **Lunch and the terrace.** A base lodge is planned for its seating to turn
  over about one and a half times through a lunch of two to three hours; on a
  sunny day the deck outside carries as many again as the room inside, and a
  good share of the seats are held all day by people not skiing at all. People
  sit at a terrace for an hour or more, and lie in deck chairs facing the sun.
- **The afterski.** The lifts close between about half past three and five; a
  terrace's music starts from about three, and the party runs on into the
  evening — a terrace session lasts one to three hours, often to the sunset
  and past it.

## The design

### Presentation only

Like the wildlife (`beast-plan.ts`, `bird-plan.ts`), the civilians are a PLAN
dealt off the map's seed on a salt of their own (`CIVILIAN_SALT`), never
`state.rng`, and nothing is written to the game's state, so no digest moves.
Where a person is and what he is doing at a moment is a PURE FUNCTION of the
plan, the engine's clock and the map's hour (`civilianAt`). They are a free
ride's only (`hasCivilians`: a run with the ski area's crowd on it) and are not
solid to the skier — they stand where no skier is meant to be.

### Where: the places and their sources

A PLACE (`Spot`) is a building's or a station's own patch: an origin and a
heading, a rectangle in that frame where people may stand, a POST where staff
works, and SEATS where it has them. Every place comes out of one list,
`SPOT_SOURCES`, one function a kind of building:

| Kind | Where | Source |
| --- | --- | --- |
| `liftFoot` | the crew's post by the booth over the load line (a gondola's at its door, a drag's at its hut) | `liftSpots` |
| `base` | open snow about a lift's foot station, at 4, 10 and 18 m from its house | `liftSpots` |
| `liftTop` | the top operator's post at his booth (chairs only) | `liftSpots` |
| `summit` | open snow beside a chair's or a gondola's top station | `liftSpots` |
| `terrace` | an afterski lodge's deck, its tables kept out of and their benches the seats | `lodgeSpots` |
| `yard` | the snow before a lodge's terrace, past its racks and steps | `lodgeSpots` |
| `porch` | the open yard before a hut's, a cabin's or a chalet's porch | `cabinSpots` |
| `base` | open snow about the village on the valley floor | `villageSpots` |

A NEW KIND OF BUILDING (a ticket office, a restaurant, a ski school's hut, a
patrol hut) is one source added to `SPOT_SOURCES`, returning places of the
kinds above (or a new kind the roles then name). The roles never name a
building.

### Off the skiing

`civilianClear` is the one test every foot is held to: on the map, off the
ice; 2.5 m outside every run, lane and course's edge; clear of the wind
tunnels, every lift's line and station houses, its queue lane and boarding
ring, the helicopter's pad and the parked snowmobile; 1.1 m off every trunk;
outside every cabin's walls and a lodge's terrace, steps and racks; on ground
no steeper than about 23°. The hub on the valley floor is the base area
itself, so it may be crossed, held off its run lines like everywhere else.
The crew at a lift's post is the one exception: it stands beside the load line,
inside the lift's own clearance. A walker's whole line is held to the same
test, sampled every metre with half a metre more kept off everything, so the
snow between two samples is clear too.

### Who: the roles

| Role | Where | Count | Does | Holds | Out |
| --- | --- | --- | --- | --- | --- |
| lift attendant | `liftFoot` post | 1–2 | stands watching the line, sweeps, waves a rider on, shovels the ramp | broom, shovel | lift hours; half the crew after dark (the lifts always run) |
| top operator | `liftTop` post | 1 | stands, waves, sweeps | broom | lift hours |
| patrol | `summit` | 1–2 | stands looking over the runs, talks, waves | — | 08:20–16:30, a tenth after |
| worker | `yard`, `porch`, `base` | 1 | shovels, rests on the shovel | shovel | early morning heaviest |
| instructor + class | `base` | 1 + 3–5 children on an arc | talks, points; the class stands holding skis | skis (class) | a morning and an afternoon class |
| guest desk | `base` | 1 | stands, talks, waves | — | 08:30–16:30 |
| walker (+ children) | `base`, `yard`, `porch` | 1–2 (+1–2) | walks a leg to another place and back, pausing at each end | skis on a shoulder (six in ten), else nothing | daytime; the odd one at night |
| partier | `terrace` | 8–14 | dances on one beat, drinks, holds a beer up, talks | beer | from half past three, the whole evening |
| terrace sitter | `terrace` seats | 8–14 | sits at a table, drinks, talks | beer | the lunch crowd from about half past eleven, then the afterski and the evening |
| terrace knot | `terrace` | a ring of 3–5 | stands talking with mugs, sips, raises one | mug | the same |
| lounger | `yard`, `terrace` (a deck chair) | 2–5 | lies back in the sun, sips | mug | 11:00–16:30 |
| cocoa | `yard`, `porch`, `base` | a ring of 2–3 | stands, sips, talks | mug | lunch, from mid-morning |
| rester | `yard`, `porch`, `base` | 1–2 | sits in the snow, talks | — | lunch |
| snowball fight | `yard`, `base` | 2–3 children on a wide ring | throws, ducks | — | 10:00–17:00 |
| snowman | `yard`, `porch`, `base` | 2+ children round a snowman | packs it | — | 10:00–17:00 |

The bodies are the crowd's eight (`CROWD_BODIES`); the staff wear their
uniforms (`STAFF_DRESS`), the guests their own colours dealt off `tint`.
A map carries at most `CIVILIAN_MOST` (160); a five-lift map with two lodges
and ten cabins deals about 120–160, about 100–150 of them out at midday.

### When: routines and hours

A person is a ROUTINE, not a state: a list of activities each held a dealt
while, repeated from a dealt offset, so what he does at `t` is closed-form. A
walker's LEG is closed-form too: out at his pace, a pause, back, a pause; the
distance walked (`walked`) is what his steps are drawn off. Each role has a
SHARE by the hour and each person a dealt keenness; he is out while his
keenness is under the share. A party shares its leader's keenness, so a family
or a class comes and goes together; the first of the crew at a lift's post is
always out. The map's hour is fixed for the run (the sun stands at it), so the
cast is fixed for the run too.

### The pose handed to a view

`civilianAt(plan, i, t, hour, out)` fills a `CivilianPose`: `x`, `y` (his
feet: the drawn snow, or a deck's boards), `z`, `heading`, `activity`, `clock`
(seconds into it — a dance's is the run's own clock, so a terrace keeps one
beat), `span` (how long it lasts), `walked` (metres in all), `carry`, `seat`
(the seat's height under him, 0 sat on the snow, `null` stood) and `shown`.
The plan's `props` are what a place holds besides people: the deck chairs and
the snowmen.

## How they are drawn

Each person is one instance of a figure built in code on the crowd's bench
(`civilian-shapes.ts`): the crowd's eight bodies with the legs, trunk and arms
the amateurs are cut with (`crowd-shapes.ts`), SKI BOOTS instead of skis (a
sole of a mid-size shell's 300–330 mm, barely wider than the shin, a high heel
block, a low toe box, the cuff up to the pants' hem with its strap in a darker
band), no poles, a bare head under a helmet, a beanie or the person's own hair,
and every prop he may hold — a PAIR of skis over the left shoulder (two skis
side by side a finger apart, turned half onto their edges so both and the gap
read from behind and a topsheet from the side, each with its tip curled up and
a dark toe and heel piece), a mug, a beer, a
snowball, a shovel and a broom — built into the same mesh and folded away in
the vertex shader unless his kit shows it. A patrol's jacket carries a white
cross; the staff wear their post's colours (`civilian-dress.ts`).

The poses are morph targets of that one mesh, each the afterski's own key
(`party-pose.ts`'s `keyPoints`) solved onto the body (`civilian-moves.ts`):
two stances, four walk keys a stride apart, the skis carried, a sip, two talk
gestures, two of a wave, two of a cheer, two dances of four keys each (the
arms-up sway and a step-touch side to side with the fists pumping), a
shovel's scoop and toss and the rest leant on it with the blade on the snow
in front (so the tool never jumps upright between loads), a broom's two strokes, a throw's wind-up and
release, a snowman's two pats, and sat on a bench, in the snow and in a deck
chair (each with a sip and a word). `civilianDials` turns a `CivilianPose`
into the weights of a moment — a walk stepped off the metres walked, a dance
on the run's clock so a terrace keeps one beat, a cycle per chore.

`civilians-view.ts` draws them instanced, one mesh a body and a cut (near to
35 m, mid to 120 m, far to 600 m and culled past it), every buffer sized once
off the plan; the deck chairs and snowmen are one static mesh. The view is
built only where `hasCivilians` says so — a free ride by day, and its lodges'
terraces after dark — and goes with the map. `make civilians` is the lab.

## Sources

- Lift attendant and operator job descriptions from several ski areas, and a
  state tramway board's safety bulletin on loading.
- A study of walking in ski boots (knee range down, hip range up) and one of
  gait in mountain boots (longer single support).
- Guides to carrying skis on the shoulder.
- A ski area's base-lodge master planning paper (seat turnover, deck use,
  non-skiers' share of seating).
- Guides to the afterski's hours.
