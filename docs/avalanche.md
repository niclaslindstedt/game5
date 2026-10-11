# The avalanche

On a **free ride** the snow off the groomed runs can slide. A skier crossing a loaded slope in the release band can set a **slab** off. It breaks, runs down the mountain as a dense flow, and takes him if he does not get out of its way. Caught, he is thrown onto his own ragdoll and carried. Where the flow round him stops, he is put down in the debris: his head out, or **buried**, with a dealt time to live off the survival curve.

This is the ENGINE half (part A): the hazard, the trigger, the slab, the flow, the catch, the burial and the clock. Nothing is drawn yet beyond what the skier's own ragdoll already draws. The slab, the flow, the powder cloud and the debris as pictures are part B; the transceiver search and the patrol are part C.

- `engine/game/avalanche.ts` is the model.
- `engine/game/avalanche-state.ts` holds its state and its event.
- `engine/game/defs/avalanche.ts` (`AVALANCHE`) holds every number, with its unit and where it comes from.
- `make avalanche-flow` is its lab; `tests/avalanche_test.ts` holds it.

## Off by default for everything but a free ride

- **Only a free ride** carries avalanches. The bit is `RunRules.avalanche` (set in `freeRules`), and the app asks for it with `CreateGameOptions.avalanche`. The free ride's start card asks for it (`freeGameOptions`), and a link turns it off with `?avalanche=0`.
- **Off, nothing exists.** `GameState.avalanche` is absent and `step` never calls into the module.
- **Its own stream.** Every draw is off the avalanches' own stream (`AVALANCHE_SALT` over the run's seed), never `state.rng`. So a race, a tricks run, the labs and the sim are unmoved, and `make sim`'s digests do not change.

## What a slab avalanche is

The research below is restated in our own words, with the numbers the model uses.

### The snowpack and the weak layer

- **Most avalanches that kill skiers are dry slab avalanches.** A cohesive slab of snow lies over a weak layer (buried surface hoar, facets, a crust with loose grains on it). The slab releases as a unit when the weak layer fails and a crack runs through it.
- **A skier's weight starts the failure** in the weak layer under him. The crack then propagates far faster than any skier. Past a few metres it runs faster than the shear wave in the slab. So the skier is on the slab when it goes, and the crown usually breaks **a few to tens of metres above him**.
- **In the model:** the crown is dealt **5–30 m** above the skier, up the fall line (`crownAbove`).

### Where slabs release: steepness

- **The broken weak layer** has a friction angle of about **30°**. Below that, a broken slab stays put.
- **Most skier-triggered slabs** start between **35° and 45°**, and the commonest is about **38°**.
- **Past about 50°** the snow sloughs off in small loose slides before a slab can build.
- **In the model:** the release chance rises from **29°**, is whole from **35°** to **46°** and is gone by **55°** (`steep`).

### What holds a slope

- **Groomed runs.** A groomed piste is packed through to the ground and controlled by the patrol before it opens, so the danger lies off it. In the model, a map's packed share at or past **0.5** holds (`packedHolds`).
- **Dense woods.** A dense forest anchors the snowpack; a few trees in a glade do not. In the model, **four trunks** within **9 m** hold a point (`anchorTrees`, `anchorReach`).

### The load: new snow and wind

- **New snow.** The danger scales are built round a critical new-snow depth of **20–50 cm** in a storm.
- **Wind.** Snow drifts once the air at 10 m blows past its transport threshold, about **5 m/s** for loose dry snow (5–10 m/s, depending on the snow). Cornices start to grow at that threshold and grow fastest about **40 % past it**. The wind lays the drifted snow on the **lee** side of what it crossed, often several times as deep as the snowfall.
- **In the model, the run's LOAD (0..1)** is:
  - **0.12** for a settled snowpack;
  - **+2.5 per metre** of new snow the run has laid;
  - **+0.18** for each step of the snow dial past the ordinary;
  - **+0.35 ×** the sky's snowfall.
- **In the model, the slab on a slope** is the load × (**0.35** + **1.6** × lee × blow):
  - **0.35** is the storm slab's share, which lies on every aspect.
  - **lee** is how far the slope faces down the wind.
  - **blow** is the wind ramped from **5 m/s** to **13 m/s** (`wind`).
- **The hazard** is the steepness share × the slab, at most 1 (`avalancheHazard`).

### The slab's size

- **McClung's measurements** of dry slab avalanches give dimensions that are spread **log-normally**. Widths and lengths are about equal. Thicknesses are mostly **0.3–1 m**, with a median near **half a metre**.
- **Skier-triggered slabs** are tens of metres to a hundred metres across.
- **In the model:**
  - **Thickness:** **0.25–1.4 m** about a **0.5 m** median, deepened by the load.
  - **Width:** **25–90 m**, grown by the hazard. Each flank is cut short where the slope stops being steep, open and loaded.
  - **Bottom edge:** the **stauchwall** comes where the pitch first drops under **26°**, or **220 m** below the crown at the most.

### The size classes

| Class | Mass | Path | Impact pressure |
| --- | --- | --- | --- |
| Size 2 | about 10² t | about 100 m | about 10 kPa |
| Size 3 | about 10³ t | about 1000 m | about 100 kPa |

On the international scale, a size 2 runs **50–200 m** with about **1000 m³** of snow. That is enough to bury, injure or kill a person, and it is the size most skier-triggered slabs are. The bench's slabs come out at **2,000–22,000 m³** (sizes 2 and 3).

### The flow

- **A dense flow** runs about **1–3 m** deep at about **300 kg/m³** of broken blocks. It reaches **20–30 m/s** in a size 2–3 path and up to about **60 m/s** in very large avalanches.
- **The powder cloud** over a big one runs **60–80 m/s** or more, **20–100 m** deep, at **1–30 kg/m³**. That is part B's picture; the model carries only the dense flow.
- **Voellmy's friction** is the standard model of a dense flow's resistance. It has two parts:
  - **A Coulomb part, μ × the normal load.** It brings the flow to rest: a flow stops where the slope is flatter than atan μ.
  - **A turbulent drag, g·v²/(ξ·h).** It holds the flow's speed down while it runs.
- **The calibration tables** take μ **0.15–0.40** and ξ **1000–2500 m/s²** on open slopes, and ξ about **400** in forest. Small avalanches (well under 10,000 m³) take μ **0.2–0.3**.
- **In the model:** μ **0.24** and ξ **2000** (`mu`, `xi`). The flow height is the slab's thickness × **3** as it breaks up and takes in the snow it runs over, **3 m** at most.

### The debris

- **The deposit** is blocky and hard. Blocks run to a few cubic metres.
- **Density** settles from the slab's **150–250 kg/m³** to **300–500 kg/m³**.
- **The toe.** It builds back up the path from where the front stopped, as the tail runs into the snow already lying.
- **In the model:** a parcel's volume settles to **0.55** of the slab's (`settle`), laid over a cone **9 m** across round where it stopped (`spread`).

### Burial and survival

- **Mean burial depth.** A complete burial (the head under the snow) is about **1 m** deep on average.
- **Mortality.** A complete burial kills about half its victims, against about **4 %** with the head free.
- **Cause of death.** About **three in four** die of **asphyxia** and about **one in four** of **trauma** (trees, rocks, the fall).
- **The survival curve of complete burials** (a national case series of several hundred):
  - about **91 % alive at 18 minutes**;
  - a steep fall to about **34 % by 35 minutes**, as those with no air pocket asphyxiate;
  - a slow fall after that (those with an air pocket), to about a quarter at **90 minutes**;
  - next to none past **two hours**, as the cold takes them.
  - A series from a snowier, maritime climate falls faster still, with a median burial of about 18 minutes.
- **Depth** is the strongest single predictor of survival: the deeper, the slower the dig and the less air.
- **In the model:**
  - **Depth.** He lies at **0.45–1** of the debris' depth where he stopped (`under`). Under **0.3 m** his head is out and he gets up as from any fall (`headFree`).
  - **Time to live.** A buried skier is dealt his time off the curve above (`survival`), shortened by **30 %** for every metre past the mean depth (`deeper`).
  - **Play time.** The clock is compressed **30 ×** for play (`timeScale`), so the 18 good minutes are 36 s of the run.
  - **Out of air.** Once his air is out he lies **6 s** (`lostFor`) and the run takes him back.

## The model as built

### Each step (`stepAvalanche`, after the grimbear's step)

1. **The trigger.** While no slab is running and the last one released at least **25 s** ago (`again`), the skier is probed every **2 m** of his way (`trigger.probe`).
   - **The chance** is 1 − exp(−h × **0.006** × 2 × weight), off the avalanches' stream.
   - **Weight** is 1 on skis and **3** on the snowmobile (`trigger.sled`).
   - **A landing** on a slope adds **0.25** × the hazard × its impact over **6 m/s** (`trigger.landing`).
   - **No probe** is made while he is thrown, on a lift, in a tunnel, on a rail, in the air or flying a machine.
   - **A bed** already slid does not slide again: the last **4** are remembered (`beds`).
2. **The release** (`release`, exported for the lab and the suite). The crown is dealt up the fall line. The flanks are grown across while the slope is "slabby" (steep, open and loaded), and the stauchwall is found down it. The slab is cut into **parcels** about **7 × 9 m** apart: at most **20 × 16** and **256** in all (`cell`, `cellsAcross`, `cellsAlong`, `cells`). Each parcel carries its share of the volume. The `release` event fires.
3. **The flow.** Each running parcel steps on Voellmy's friction over the map's own normal and is fanned out sideways at its flank by **0.12** of its speed (`fan`).
   - **At rest.** A parcel rests below **0.4 m/s** on a slope flatter than atan μ (`rest`).
   - **The pile-up.** A running parcel within **5 m** of one already at rest ploughs into it at **10 m/s²** and rests on it under **2.5 m/s**. The rested ones are found through a plan hash of **6 m** buckets (`pile`).
   - **The end.** The flow is over when every parcel rests, or after **60 s** (`runMost`).
4. **The skier against the flow.**
   - **Caught.** A running parcel within **5.5 m** (`reach`) coming on faster than **7 m/s** (`catchSpeed`) takes him. Its speed is measured less his own along its way, so a slab sliding as a block can be ridden and skied off, while broken blocks running faster than he is going its way take him.
   - **Escaped.** Within **18 m** (`near`) of the flow he is involved, and once he has been clear of it for **2 s** (`escapeAfter`) he has escaped.
   - **Never on the snowmobile.** He is not caught while riding the snowmobile.
5. **Carried.**
   - **Thrown.** Caught, he is thrown onto his ragdoll (`throwRider`, the `avalanche` crash cause). The cause's own spin (`defs/crash.ts`) tumbles him forward and to the side.
   - **Dragged.** His body's points are dragged toward the flow's speed at **6/s** (`drag`) and held up at **0.6 m/s** (`lift`), and he is drawn back into the parcel that took him at **1.5/s** (`hold`).
   - **The blows.** The ragdoll meets the snow and every trunk as it always does, so the blows go through `body.ts` and count as injuries like any fall's.
6. **Buried.** **0.6 s** (`settleFor`) after his parcel rests, he is put down at his share of the debris' depth there.
   - **Surfaced.** Under the head-free depth he has surfaced and the ordinary reset takes him.
   - **Buried.** Otherwise he is buried and held (`avalancheHolds` stops the run's automatic reset) until his air runs out, then lost.
   - **A reset** pressed by the player frees him at any time.

### The event

`{ kind: "avalanche", phase, id, x, z, size, depth }`. Its phases are:

| Phase | What happened |
| --- | --- |
| `release` | A slab broke. |
| `caught` | The flow took him. |
| `buried` | He was put down under the debris. |
| `surfaced` | He was put down with his head out. |
| `escaped` | He got out of its way. |
| `stopped` | The flow came to rest. |
| `lost` | His air ran out. |
| `freed` | He was taken back by a reset. |

The news line reads `release`, `caught`, `buried`, `surfaced`, `escaped` and `lost` (`run-news.ts`, `strings.ts`). The sound bank answers `release` with the slab's whumpf, crack and rumble (`bank.ts`'s `slab`), heard from where it broke.

### What it costs

| On the bench (seeds 1–8) | Cost |
| --- | --- |
| Parcels | 64–192, at 9 doubles each plus a link word |
| Memory | **4–13 KB** a slide, allocated only when a slab releases |
| Flow time | **0.02–0.05 ms** a step, timed in Node apart from the skier's step |
| Flow at rest, or none | a counter and a probe every 2 m |

The plan hash is a `Map` of only the parcels at rest. A run with avalanches off costs nothing.

### The bench (`make avalanche-flow`)

`tests/support/avalanche-scenes.ts` builds a **38°** unpacked, treeless lee face falling along +z under a **12 m/s** wind down it and a steady fall, easing onto a flat run-out. The lab (`scripts/avalanche-lab.mjs`, pure Node; `--json` and `--compare`) prints three tables:

- **RELEASES:** each run seed's slab and flow.
- **LINES:** a skier on each of six lines, held to what a skier on it should come out as. Any line that does not exits non-zero.
- **TRIGGER:** the metres a traverse takes to set the face off.

What it measured when it was built:

| Measure | Value |
| --- | --- |
| Slab width | 25–85 m |
| Slab length | 195–216 m |
| Volume | 1,900–22,400 m³ |
| Front at 2 / 5 / 10 s | about 21 / 46–51 / 67–91 km/h |
| Top speed | 72–105 km/h |
| Run-out from the crown | 274–397 m |
| Run time | 19–25 s |
| Traverse to set the face off | 4–275 m, mean 143 m |

What came of each line:

| Line | Outcome |
| --- | --- |
| Straight down, tucked | Outran it |
| Out of the flank at 60 km/h | Escaped |
| Across at 15 km/h | Buried, about 0.9 m |
| Stopped | Buried, about 1.0 m |
| Below in its path | Escaped |
| Beside it | Untouched |

## As drawn

The engine knows a slab as a frame (the crown's middle, its fall line, its flanks, its length and depth) and a cloud of parcels. Nothing it steps is a picture, and nothing drawn moves a digest: the look is the app's alone (`pwa/src/game/avalanche-plan.ts`, three-free; `avalanche-glsl.ts`; `avalanche-view.ts`, held by `machines.ts`).

### What a slab avalanche looks like

What the field photographs and the observation guidelines agree on, restated as the numbers the drawing is held to:

- **The crown** is a clean fracture across the slope, square to the bed, about **0.3–1 m** tall in a slide of this size. It runs fairly straight, stepping where it jogged between weak spots. Its face shows the slab's layers in bands, the harder ones whiter, with the weak layer a darker, sugary line at its foot.
- **The flanks** run down the slope from the crown's ends, roughly along the fall line. They are lower than the crown and more ragged, and sometimes only a shear scarp.
- **The bed surface** is the old snow the slab slid off: smooth, planar and harder than the slab, often a greyer or bluer tone, and glazed in patches. Little debris stays on it, but blocks leave slide marks scored down the fall line.
- **The stauchwall** at the slab's foot, where it pushed into the snow below, is indistinct and usually overrun.
- **The slab breaks up** within seconds and metres: first into plates metres across and the slab's own thickness thick, opening along cracks; then the plates tip, break and tumble into angular blocks; down the track the blocks round off into **snowballs** of a few decimetres, and fines boil between them.
- **The front** is the fastest and most churned part, a low wall of tumbling blocks and snow.
- **A powder cloud** rides a fast dry flow. In a size 2 it is a few metres to tens of metres high, boiling up off the front, and it hangs and drifts on the wind for tens of seconds after the flow stops.
- **The debris** lies in a lobed tongue, typically **1–3 m** deep, rougher and whiter than the old surface: blocks and snowballs **10 cm to 1–2 m** across, with fines packed between them. Every gap holds a blue-grey shade, so it reads lumpy from afar and as a jumble of chunks close up. Levees along its sides hold the scoured track between them. Dirt, bark and broken branches fleck it where it ran through trees.

### How it is drawn

- **The crown, the flanks and the bed** are cut into the terrain's own shader. The vertex half lowers the snow over the slab's footprint by `slideBed`: the slab's whole depth at once under a crown line that jogs on two waves (`SLIDE_LOOK.crown`), ragged flanks lower than the crown (`flank`), a bed that thins down the slope and fades into the snow at the stauchwall (`bed`). Because the step is a pure function, the crown is as sharp as the clipmap's finest ring (25 cm at HIGH). The fragment half scores the bed down the fall line, colours it a greyer blue, and paints the walls in the slab's layers. `bedDepth` in the plan is the same function in TypeScript, held equal by `tests/avalanche_look_test.ts`.
- **The debris** is the engine's own `debrisDepth`: every rested parcel's cone, splatted into a small half-float map in the slab's frame (`splatDebris`, 2 m texels). The map starts with room round the slab and grows to wherever the flow got to (`debrisBoxOf`), coarsening its texel rather than passing **160 × 360** texels. The vertex half raises the snow by it. The fragment half lays a field of rounded blocks and snowballs on it with a shade in every gap, whiter than the old snow, flecked dark here and there. It is laid as the parcels come to rest, a quarter-second at a time, and stays for the rest of the run.
- **The blocks** are two instanced meshes, each one draw call. Up to **1,024 plates** are cut from the slab in rows, the blocks of each row of their own widths (`plateGrid`), each carried by the parcel nearest it. The cracks between them open as they move; each plate tips and breaks up within **6–24 m** of its run. Up to **1,536 chunks** are faceted lumps, each parcel owning up to sixteen. They break off over its first **2–16 m**, bounce and roll in the flow, and round off from **0.7–1.7 m** blocks towards **0.22–0.75 m** snowballs, halving the difference every **60 m** (`chunkSize`). Each block's faces are shaded by which way they look: the top as white as the snow it was, the broken sides and underside the blue-grey of snow in its own shade. Every chunk's numbers are dealt once a slide (`chunkTraits`), and a parcel at rest is not posed again until the debris under it is laid anew.
- **The powder cloud** reuses the skier's snow cloud (`snow-cloud.ts`'s `billow`: the same sorted, self-shadowed puffs, lit by the sky and the lamps). Each running parcel throws billows by its speed, from **7 m/s** to whole at **24 m/s**, so the front throws the most (`cloudShare`). They rise **1.2–4.5 m/s**, swell to two and a half times their size and hang **10–24 s**. A low saltation dust trails every fast parcel. The whumpf throws a faint line of dust along the crown.
- **The ground shakes.** A skier within **90 m** of the running flow, or near the crown as it breaks, feels the chase lens tremble (`quakeAt`, `camera-rigs.ts`'s `quake`). The hands feel the release, the flow taking him (the longest pulse there is) and being put down (`rumble.ts`). The drawn skier stands on the drawn bed and debris, lifted by the same function the shader reads (`liftAt`).
- **Nothing is built before the first slab.** The meshes, the material and the map are made at the first release. A run with avalanches off, or none released, pays nothing. The view's scatter is its own xorshift, seeded off the slab, so a lab sheet is the same sheet twice and the run's stream is never touched.

### What it costs

Measured on the lab's sheets (seed 12, HIGH) and on the bench's lee face in Node:

| What | Cost |
| --- | --- |
| Draw calls | **+2** (the plates and the chunks; the cloud rides the skier's own ring) |
| Triangles | **+25–30 k**: 12 a plate, 20 a chunk slot (a chunk not yet broken off is drawn at nought) |
| GPU memory | **235–245 KB**: 2,560 instances at 76 B (matrix and colour) and the debris map, at most 160 × 360 half floats (115 KB) |
| Memory in all | **0.63–0.68 MB**, the GPU's copies and the CPU's (the map as floats, the chunks' numbers, the parcels' notes) — far under the 4 MB budget |
| Processor, flowing | **0.36–0.54 ms** a frame for the view, beside **0.16–0.36 ms** for the engine's two steps (Node, this container) |
| Processor, at rest | nothing: once every parcel rests and the map is laid, the view returns at once |
| The release's frame | **2–23 ms** once: the meshes and the material built at the first slab, the plates cut |
| Off, or no slab yet | nothing is built |

The terrain's shader pays a few branches a pixel everywhere (`uSlideOn`), and the bed's and the debris' terms only over the slide's footprint within 400 m of the lens.

### The lab (`make avalanche`)

`scripts/avalanche-preview.mjs` builds `pwa/avalanche-preview.html` (`pwa/src/tools/avalanche-harness.ts`) into a one-off bundle. It finds the generated map's widest sunlit, loaded lee face with a run-out in sight (or `--at=x,z`), lets a slab go there, and photographs it through the game's own renderer. The sheets are:

- **release:** the crown cracking and the slab breaking into blocks, 0–2 s, with the same lens on the map with no slide as the cost's baseline.
- **flow:** the front and its cloud from beside and from below, at 3, 6, 10 and 15 s.
- **debris:** the deposit close, from its toe and from far, and the bed and the crown from below.
- **caught:** a skier crossing the slab when it goes, from the chase.
- **night:** the flow and the debris at hour 21, under the headlamp.

Each frame's draw time, draw calls and triangles are printed under its sheet.

## Not yet built

- **The hole dug** in the debris (part C's), and the debris drawn round trees: the flow's pile on a trunk's uphill side and its eddy behind.
- **The search (part C):** the transceiver search, the probe, the shovel and the patrol's response.
- **Amateurs caught.**
- **The woods' ξ.** The flow does not yet lower ξ to the woods' **400** as it runs through trees (`xiForest` is stated, unused).
