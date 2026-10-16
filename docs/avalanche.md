# The avalanche

On a **free ride** the snow off the groomed runs can slide. A skier crossing a loaded slope in the release band can set a **slab** off. It breaks, runs down the mountain as a dense flow, and takes him if he does not get out of its way. Caught, he is thrown onto his own ragdoll and carried. Where the flow round him stops, or after a few seconds of it, he is put down in the debris: his head out, or **buried**. Buried, he is gone: the picture follows the snow that took him for a moment, then the **BURIED** card comes up and the run starts again.

The ENGINE half (part A) is the hazard, the trigger, the slab, the flow, the catch, the burial and the clock. The slab, the flow, the powder cloud and the debris as pictures are part B (§ As drawn). The others a slide takes, the player's transceiver search, the probe, the shovel and the ski patrol are part C (§ The search and the patrol).

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
- **Rock walls.** A wall too steep and bare to carry a slab sheds its snow in small sluffs; a slab needs a snowpack lying on a slope it can rest on. In the model, no slab breaks on a rock wall (`rocks.ts`' `rockShare`, a rocky cliff's face) nor within **6 m** of one or of a piste (`keepOff`), and a slab's stauchwall and parcels stop where held snow begins, so no slab ever lies on a groomed run or a wall.
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
   - **Caught.** A running parcel within **5.5 m** (`reach`) coming on faster than **7 m/s** (`catchSpeed`) takes him. Its speed is measured less his own along its way, so broken blocks running faster than he is going its way take him.
   - **Ridden.** A parcel running faster than **9 m/s** (`tumble`) is no block to stand on: within reach of one he is caught even going its speed, unless he is skiing out across its way at `catchSpeed` or more, which is how the flank is outskied.
   - **Skied into.** Snow at least **0.4 m** deep under him (`engulf`, the debris' depth the flow's parcels lay) while he goes faster than **4 m/s** (`plough`) takes him, the flow's body while it runs and the debris it left once it rests: at speed the set blocks stop his skis dead and the snow closes over him. Skiing through it is no way past it.
   - **Escaped.** Within **18 m** (`near`) of the flow he is involved, and once he has been clear of it for **2 s** (`escapeAfter`) he has escaped.
   - **Never on the snowmobile.** He is not caught while riding the snowmobile.
5. **Carried.**
   - **Thrown.** Caught, he is thrown onto his ragdoll (`throwRider`, the `avalanche` crash cause), never upward: the snow takes him down into it. The cause's own spin (`defs/crash.ts`) tumbles him forward and to the side.
   - **Dragged.** His body's points are dragged toward the flow's speed at **6/s** (`drag`) and drawn back into the parcel that took him at **1.5/s** (`hold`). Each point rides IN the snow: it follows the ground down the slope and is pulled toward **half** (`ride`) of the debris' depth over the ground at **6 m/s per m** (`sink`), so nothing he was thrown with carries him up out of it. Caught by debris at rest, he is stopped dead in it.
   - **The blows.** The ragdoll meets the snow and every trunk as it always does, so the blows go through `body.ts` and count as injuries like any fall's.
6. **Buried.** **0.6 s** (`settleFor`) after his parcel rests (or after he ploughed into debris at rest), or **5 s** (`carryMost`) after he was caught, whichever comes first, he is put down at his share of the debris' depth there.
   - **Surfaced.** Under the head-free depth he has surfaced and the ordinary reset takes him.
   - **Buried.** Otherwise he is under, at least **0.6 m** deep (`buriedLeast`), and gone (`lost` at once): the `buried` event fires and, with INJURIES on, the death flow too (the `smothered` cause). His body goes on with the debris while it runs and is no longer drawn.
   - **The card.** The HUD's wreck comes up on it whatever the INJURIES switch says: **BURIED** in place of DIED, the picture going dark, and the app's restart after its own wait (OPTIONS' 2–10 s). `avalancheHolds` keeps the automatic reset off for **10 s** (`lostFor`), past the longest of those waits.
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
- **The slab breaks up** within seconds and metres. The fracture runs out from where it was triggered at tens of metres a second, so the slab cracks from that point outward rather than all at once. It breaks into irregular plates of very different sizes, a metre to several metres across, with jagged cracks between them. The plates heave, tip, ride up onto one another and break into angular blocks. Down the track the blocks round off into **snowballs** of a few decimetres, and fines boil between them.
- **The moving body** is continuous, not a scatter of lumps: a churning tongue of white snow, deepest and roughest at the front. The front is the fastest and most churned part, a low wall of tumbling blocks and snow.
- **A powder cloud** rides a fast dry flow. In a size 2 at 50–90 km/h it is tens of metres tall, billowing over and ahead of the front in rounded heads. The base is opaque and the edges are blown thin. It is bright on the sunlit side and blue-grey on the shaded side and underneath, so it reads against the snow from hundreds of metres away. It hangs and drifts on the wind for tens of seconds after the flow stops.
- **The debris** lies in a lobed tongue, typically **1–3 m** deep, rougher and whiter than the old surface: blocks and snowballs **10 cm to 1–2 m** across, with fines packed between them. Every gap holds a blue-grey shade, so it reads lumpy from afar and as a jumble of chunks close up. Levees along its sides hold the scoured track between them. Dirt, bark and broken branches fleck it where it ran through trees.

### How it is drawn

- **The crown, the flanks and the bed** are cut into the terrain's own shader. The vertex half lowers the snow over the slab's footprint by `slideBed`: the slab's whole depth at once under a crown line that jogs on two waves (`SLIDE_LOOK.crown`), ragged flanks lower than the crown (`flank`), a bed that thins down the slope and fades into the snow at the stauchwall (`bed`). The bed goes only as the crack reaches it (`uSlabCrack`, below). The fragment half scores the bed down the fall line, colours it a greyer blue, and paints the steep step a shaded blue in the slab's layers. The ground's mesh steps down over a vertex's spacing, not at once, so **the walls** are also drawn as a mesh of their own (`avalanche-plates.ts`'s `wallGeometry`). It is a vertical strip along the crown and down both flanks, banded from the old surface's white to the weak layer's dark line at its foot, and shaded as a face in its own shadow. Its vertices are drawn up to 2.5 m nearer the lens so the mesh's ramp never buries the step. A stretch of wall the crack has not reached is folded up under the snow. `bedDepth` in the plan is the same function in TypeScript, held equal by `tests/avalanche_look_test.ts`.
- **The debris** is the engine's own `debrisDepth`: every rested parcel's cone, splatted into a small half-float map in the slab's frame (`splatDebris`, 2 m texels). The map starts with room round the slab and grows to wherever the flow got to (`debrisBoxOf`), coarsening its texel rather than passing **160 × 360** texels. The vertex half raises the snow by it. The fragment half lays a field of rounded blocks and snowballs on it with a shade in every gap, whiter than the old snow, flecked dark here and there. It is laid as the parcels come to rest, a quarter-second at a time, and stays for the rest of the run.
- **The crack** runs out from a trigger point on the slab, at most **18 m** below the crown (15 % of a short slab's length) and dealt across it off the slab, at **45 m/s**, or faster on a big slab, so that it reaches the far corner within **1.6 s** (`avalanche-crack.ts`'s `crackFront`). The bed, the walls and the plates all wait for it.
- **The plates** are the slab cracked like the real thing (`crackSlab`). Points are jittered on a grid about **4.6 m** apart, a quarter of them left out so their neighbours grow into big plates, and some split in two so a small fragment lies beside a big one. Each plate is that point's Voronoi cell, clipped to the crown's line and the flanks', and kept to eight corners. Its thickness is dealt between **0.75 and 1.2** times the bed's depth. Up to **1,024** are drawn as one instanced prism, its outline carried in four instanced attributes and read by its vertex shader. Each plate is carried by the three parcels nearest it, weighted by distance, so neighbours pull apart and pile into each other. A plate appears when the crack reaches it. The crack then opens over half a second. The plate heaves, turns and tips, one edge digging in while the other rides up, and breaks up within **5–16 m** of its run.
- **The chunks:** up to **2,560** faceted lumps, each parcel owning up to sixteen. They break off over its first **2–16 m**, bounce and roll in the flow, and round off from **0.5–1.3 m** blocks towards **0.25–0.6 m** snowballs, halving the difference every **60 m** (`chunkSize`).
- **The body:** four rounded heaps a parcel, up to **1,024**, lit smooth rather than faceted, so the moving snow is one churning tongue rather than a scatter of lumps. Each is **5–8 m** across and **6–11 m** along. They grow in over a parcel's first **2–12 m** of run, heave and turn as they go, and are half again as big and taller within **40 m** of the front. They fade into the debris over **1.6 s** once the parcel rests. Each block's faces are shaded by which way they look: the top as white as the snow it was, the broken sides and underside the blue-grey of snow in its own shade. Every chunk's numbers are dealt once a slide (`chunkTraits`), and a parcel at rest is not posed again until the debris under it is laid anew.
- **The powder cloud** reuses the skier's snow cloud (`snow-cloud.ts`'s `billow`: the same sorted, self-shadowed puffs, lit by the sky and the lamps). The running flow throws **34 billows a second**, three quarters of them off its head. Each parcel throws them by its speed, from **4 m/s** to whole at **17 m/s** (`cloudShare`). They are **3–6.5 m** across, now and then half again as big, and scaled by the slab's depth. They start a little ahead of the parcel at nearly its speed, rise **2.5–6.5 m/s**, swell to two and a half times their size and hang **14–26 s**. A billow shades itself more deeply than a skier's puff (`snow-cloud.ts`'s `BILLOW_DENSE`): it is lit round, a cauliflower head with a bright crown and a blue-grey flank and foot. A big puff lays a disc of shadow on the cloud behind it as wide as itself. A low, nearly opaque saltation dust, **1.2–2.4 m** puffs, trails every fast parcel, so the base reads solid. The whumpf throws a faint line of dust along the crown.
- **The ground shakes.** A skier within **90 m** of the running flow, or near the crown as it breaks, feels the chase lens tremble (`quakeAt`, `camera-rigs.ts`'s `quake`). The hands feel the release, the flow taking him (the longest pulse there is) and being put down (`rumble.ts`). The drawn skier stands on the drawn bed and debris, lifted by the same function the shader reads (`liftAt`).
- **Nothing is built before the first slab.** The meshes, the material and the map are made at the first release. A run with avalanches off, or none released, pays nothing. The view's scatter is its own xorshift, seeded off the slab, so a lab sheet is the same sheet twice and the run's stream is never touched.

### What it costs

Measured on the lab's sheets (seed 7, HIGH; the triangles against the same lens with no slide), with the memory counted at the budgets' limits:

| What | Cost |
| --- | --- |
| Draw calls | **+4** (the plates, the chunks, the body and the walls; the cloud rides the skier's own ring) |
| Triangles | **+30–70 k** while it runs: 32 a plate, 20 a chunk slot (a chunk not yet broken off is drawn at nought), 80 a heap, the walls' strips |
| GPU memory | **0.9 MB at most**: 4,608 instances at 76 B (matrix and colour), the plates' outlines (64 KB), the walls (40 B a vertex, up to about 370 KB on the biggest slab) and the debris map, at most 160 × 360 half floats (115 KB) |
| Memory in all | **2.2 MB at most**, the GPU's copies and the CPU's (the map as floats, the chunks' numbers, the parcels' notes) — under the 4 MB budget |
| Processor, flowing | **0.36–0.54 ms** a frame for the view before the plates and the body were added (Node, this container), plus four heaps a running parcel posed a frame; not re-measured |
| Processor, at rest | nothing: once every parcel rests and the map is laid, the view returns at once |
| The release's frame | **2–23 ms** once: the meshes and the material built at the first slab, the plates cut |
| Off, or no slab yet | nothing is built |

The terrain's shader pays a few branches a pixel everywhere (`uSlideOn`), and the bed's and the debris' terms only over the slide's footprint within 400 m of the lens.

### The lab (`make avalanche`)

`scripts/avalanche-preview.mjs` builds `pwa/avalanche-preview.html` (`pwa/src/tools/avalanche-harness.ts`) into a one-off bundle. It finds the generated map's widest sunlit, loaded lee faces with a run-out in sight, runs a slide off each of the best eight headless, and keeps the one that stops in sight on open snow (or `--at=x,z`). The run's seed is picked so the slab is near `--depth` (0.6 m) and wide. It then lets a slab go there and photographs it through the game's own renderer. The sheets are:

- **release:** the crown cracking and the slab breaking into plates, 0–2 s, with the same lens on the map with no slide as the cost's baseline, and the crown's wall from the bed at 7 s.
- **flow:** the front and its cloud from beside and from below, at 3, 6, 10 and 15 s, the lenses set off the head along the way it is going.
- **debris:** the deposit close, from its toe and from far, and the bed and the crown from below.
- **caught:** a skier crossing the slab when it goes, from the chase: caught, carried a few seconds, buried, and the BURIED card over the frames after it going dark.
- **plough:** a skier coming down the fall line at 70 km/h into a slab let go below him, from the chase: taken as he meets it, carried down in the snow, and buried.
- **night:** the flow and the debris at hour 21, under the headlamp.

Each frame's draw time, draw calls and triangles are printed under its sheet.

## The search and the patrol

A slide that buries somebody starts a search. The player can search for others with his transceiver, a probe and a shovel; the ski patrol comes for the player himself, and for anybody nobody else digs out.

- `engine/game/avalanche-rescue.ts` is the model: the others caught, the player's transceiver, probe and shovel, and the patrol. Its state (`Burial`, `Beacon`, `Patrol`) is in `avalanche-state.ts`.
- `engine/game/defs/avalanche-rescue.ts` (`AVALANCHE_RESCUE`) holds every number, with its unit and its source.
- `pwa/src/game/beacon-read.ts` is what the HUD reads (DOM-free). `hud-beacon.tsx` draws the transceiver.
- `patrol-view.ts` and `patrol-crew.ts` draw the patrol. `dig-pit.ts` shapes the hole. `camera-buried.ts` says when the player is under and not drawn.
- `audio/rescue-bank.ts` and `audio/rescue-bed.ts` are the sound.
- `tests/avalanche_rescue_test.ts` and `tests/dig_pit_test.ts` hold it.

### What a real rescue does

- **The transceiver.** Every member of a party wears one, sending on 457 kHz. To search, a rescuer switches it to receive.
- **The signal search.** Nothing heard yet: the searcher sweeps the debris quickly in strips 20–40 m wide, from the last-seen point down the flow line.
- **The coarse search.** A digital unit picks a signal up at about 40–70 m. It then gives a distance and an arrow. The arrow follows the curved **flux line** of the buried unit's dipole field, so the searcher's path curves in. He slows down at about **10 m**.
- **The fine search.** Within about **3 m**, the unit is held low on the snow and moved in a cross ("bracketing") to find the lowest number. The lowest number stands over the body.
- **The probe.** A collapsible pole of 2.4–3.2 m is pushed in a spiral out from the lowest number, about 25 cm apart. A strike is a soft give, unlike the hard bed. The probe is left in as the marker.
- **The dig.** Strategic shovelling starts **downhill** of the probe, about 1–1.5 × the burial depth away, and cuts in from the side. Shovelling clears 13–25 cm of depth a minute. A lone rescuer reaches 1.5 m in about 18 minutes; a team on a conveyor works at the top of the range.
- **The patrol.** A team of two reaches a slide inside the ski area in about **10–20 minutes**. A practised searcher finds a single burial in under four minutes; digging out a metre-deep victim takes most of the time.

### In the model

- **The others caught.** A running parcel takes any amateur of the crowd standing in its way, and any of the night's keen skiers. They are thrown onto the same ragdoll the player is, carried, put down, and buried or surfaced by the same rules.
  - Each burial is dealt its own air off the survival curve. The draws come off the avalanche's own stream, never `state.rng`.
  - Up to **8** burials are kept (`burials`).
  - Nobody is shouldered by the player while buried, so a searcher can stand over him.
  - Left past his air, he is dug out dead.
- **The transceiver** (`stepBeacon`, read by `beaconRead`).
  - **It switches itself.** It sends by default. When somebody is buried within **220 m** of the player (`watch`), it switches itself to search. **T** (or the BEACON press on touch) switches it either way.
  - **The reading.** A burial is heard within **50 m** (`range`). The number is the field's strength read as if on the aerial's axis: the straight distance × ∛(2 / √(1 + 3 cos² θ)), where θ is the angle to the aerial. It is longer across the aerial (up to 1.26 ×) and shortens as the flux line swings in.
  - **The arrow** points along the flux line, the way in. Followed, it takes him in on a curve.
  - **The jitter.** Both jitter about three times a second, off a hash of the clock: a few per cent on the number and a few degrees on the arrow. Past three fifths of the range it gets worse, and the signal drops out now and then.
  - **The fine search.** Under **3 m** of straight distance (the depth included), the arrow goes out and only the number is left.
  - **The beep** quickens as the number falls: from about once a second to eight a second. The unit shows how many burials it hears.
  - **The prompts:** SLOW DOWN under 10 m; STOP on the lowest number; PROBE stopped over it; DIG once struck.
- **The probe.** A press of **G** (the PROBE press on touch), stopped (under **1.5 m/s**) with somebody under, pushes a probe in where he stands.
  - **A strike** is within **0.6 m** of the body (`reach`, a dial for a spiral of a few strokes) and no deeper than the probe's **3 m**.
  - **The pace.** The next stroke comes **0.6 s** later. The last **24** holes are kept.
- **The dig.** **G** held within **3 m** of a struck body digs, at **0.05 m a second** of play — the lone rescuer's 8 cm a minute at the clock's 30 ×.
  - A man digging stands in his hole: the slope does not slide him off it.
  - A metre-deep burial takes about 20 s, two metres about 40.
  - Dug out, he comes out alive or dead by his own clock.
- **The patrol** (`stepPatrol`; where each patroller is at a moment is `patrolMan`, a pure function of the patrol's state).
  - **The call.** It is called the moment a burial is seen. A team of two arrives **13–27 s** later, dealt off the avalanche's stream. That is the real 10–20 minutes at 30 ×, cut by a further 1.5 × for play, so the whole rescue lands where the survival curve is falling: most come out alive, and one buried deep or unlucky dies.
  - **The run in.** It skis in from **160 m** up the slope off the slab's flank, at **11 m/s**, to **14 m** short of the burial.
  - **The work.** It searches on foot for **6 s** (three minutes), probes for **3 s** (a minute and a half), and digs at the team's **0.1 m/s** from downhill. It stands by **25 s**, then goes on to the next burial or skis off.
  - **Who first.** The player comes first, then the oldest still under.
- **The player buried.**
  - **He is gone.** No patrol is called for him and no air is dealt: the lens follows the snow that took him, the **BURIED** card comes up and the run starts again (see *Buried* above). The world outside is muffled to almost nothing meanwhile.
  - **No new slab** releases while anybody is still under.
- **The events.** The `avalanche` event gains a `who` (`player`, `amateur` or `keen`) and the phases `beacon` (the unit switched; `alive` carries search or send), `probe`, `strike`, `dug` (`alive` how he came out) and `patrol` (the team arriving). The news line reads them (`run-news.ts`). The sound bank answers `probe` and a `strike` (`probe_in`, `probe_strike`).

### As drawn and heard

- **The transceiver** is drawn as a rugged orange unit low in the middle of the picture, with a monochrome display:
  - a fan of five direction segments and an arrow behind for a turn round;
  - signal bars and the count of burials heard;
  - the search pattern with no signal;
  - the number, with brackets round it in the fine search;
  - a strike mark and the dig's progress bar;
  - a lamp that flashes with the beep.
  - The next step is written under it. On touch, it has two presses: BEACON (a tap) and PROBE / DIG (a tap probes, a hold digs).
- **The patrol** is two patrollers on the civilians' bodies, in the patrol's red with a white cross and helmets. They are posed by morph weights (`patrol-crew.ts`): skiing in on their skis, walking, searching with the unit low, probing with a 2.6 m probe in both hands, and digging with a shovel.
- **The marks.** A probe is left standing with a red flag over every body struck. It goes down with the hole's floor.
- **The hole** (`dig-pit.ts`) is a slot **1.5 m** wide:
  - a steep wall **0.7 m** uphill of the body;
  - a level floor **0.5 m** past it;
  - a ramp running out downhill as the dig goes down (about 30°).
  - It goes down through the drawn debris by the share dug, to where the body lies once he is out.
  - Its walls and floor are drawn in snow's own shade, the deeper the bluer. The ground's shader cuts the snow out of the same rectangle (`room-cuts.ts`'s `setHoleCuts`, sharing the rooms' eight slots).
- **The spoil heap** beside the ramp grows with the snow dug out: a lumpy ball, flattened onto the slope.
- **The sound.** The unit's beep (a short square pip at 2.35 kHz, pitched up in the fine search, every `beep` seconds), the probe's rasp and the tap of the hard bed or the soft thud of a strike, and the shovel's bite. Buried, he hears the outside at **6 %**.

### The keys

- **T** — the transceiver, send or search (`beacon`).
- **G** — the probe; held beside a strike, the shovel (`rescue`).
- Both are rebindable on OPTIONS ▸ KEYS.

### What it costs

| What | Cost |
| --- | --- |
| A run with avalanches off | nothing: no state, no view, no sound |
| The engine's step, the patrol at work and the slide at rest | **≈ 5 µs** (Node, this container) |
| The HUD's read | **0.1–0.5 µs** a frame (`beaconRead`) |
| Draw calls, the patrol at work | **+2 to +8** over the same lens: a figure each (its bare or its shovel copy), their skis and probe, a marker's pole and flag, a heap and a pit a burial |
| Triangles | **+6–9 k**: about 700 a figure, 20 a pit, 320 a heap |
| Memory, the patrol | about **1.4 MB**: the two figures' geometry, built the first time a patrol shows or a body is struck (2,061 and 2,097 vertices with twelve morph targets, about 670 KB each). Each dressed copy shares that geometry and adds only its colours |
| Memory, the marks | eight pits of 60 vertices, eight heaps sharing one 320-face ball, eight markers |
| Before the first patrol or strike | nothing: the view is built lazily |

### The lab (`make avalanche`, the rescue sheets)

`pwa/src/tools/avalanche-rescue-lab.ts` adds three sheets to the avalanche lab. Each frame's cost is printed as the others are.

- **search:** the transceiver at every phase over the game's own frame, with the HUD drawn in: sending, the signal search, the coarse search at 30 m and at 8 m, the fine search over him, a strike and the dig. Then a probe that misses, one that strikes, and the probe left in.
- **hole:** the hole dug to an amateur at a third, two thirds and out.
- **patrol:** skiing in, searching, bracketing, the probe spiral, digging from downhill, almost down to him, and standing by.

The amateur is placed in the slide's way and buried; the player is stood and held where each frame wants him; the clock runs headless between frames.

## Not yet built

- **The debris drawn round trees:** the flow's pile on a trunk's uphill side and its eddy behind.
- **The woods' ξ.** The flow does not yet lower ξ to the woods' **400** as it runs through trees (`xiForest` is stated, unused).
- **The player's own pose while searching:** he stands on his skis while he probes and digs. The patrol's figures probe and dig; his do not.
- **Control work at dawn:** the patrol's hand charges and ski cutting on the slopes before the lifts open.
- **The evacuation:** the casualty taken out by toboggan, or by the air ambulance `docs/rescue.md` already draws.
