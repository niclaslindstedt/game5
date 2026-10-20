# The police on the run after a death

When a run ends with the skier **dead** (`GameState.gore.dead ≥ 0`, which needs the INJURIES switch), no air ambulance comes. A **police helicopter** is sent instead, and its officers work the place as the scene of a fatal accident: they walk it, **cordon** it from the point of impact to where the body came to rest, stand a **numbered marker** at every item of evidence, **photograph** it all with a flash, and only then recover the body in a bag and fly it off. A run that ends only injured still gets the air ambulance ([rescue.md](rescue.md)).

The machine on its skids is the same **solid** the ambulance is (`engine/game/rescue-call.ts`: a `RescueCall` with `kind: "police"`), and the officers can be **knocked over** like the ambulance's crew — past a brisk cruise as bodies the engine meets off each man's sampled track (`rescue-tracks.ts`, `RescueCall.crew`, [body-hits.md](body-hits.md)). The engine reads where and when the machine sits and where its people walk; the call's `evidence` is the app's to draw. Nothing is drawn from `state.rng`, so a run without a call moves no digest. The scene is laid out in `pwa/src/game/police-scene.ts` and timed in `police-plan.ts` (both three-free, pure functions of the seconds since the call), booked by `rescue-book.ts`, and drawn by `rescue-view.ts` (the machine and the people) and `police-view.ts` (the stakes, the tape, the markers, the camera and its flash, the bag). `make police` is its lab.

## What the research says

Restated in our own words, with the numbers the scene uses.

### Who comes

- **In the alpine countries** the police record every accident in a ski area that ends in a death, or where someone else may be to blame, and a prosecutor opens an investigation.
- **Police helicopters** fly mountain search and recovery. Where a machine cannot land, alpine-trained officers are winched or long-lined down.
- **The body** is recovered by the helicopter's crew with rescue technicians, after the scene has been documented.
- **In the scene:** the police machine lands as the ambulance does. Three officers climb out: the **scene lead**, the **marker officer** and the **photographer**, in dark blue with fluorescent yellow vests and dark blue helmets. Two **ski patrollers** come down the hill later for the recovery.

### The cordon

- **Two rings:** an **inner cordon** round the evidence itself (the body, what it struck, what was thrown off), and often an **outer cordon** that keeps the public back.
- **Nobody goes inside the inner cordon** until the investigators have processed it, and everyone who does is logged.
- **At a collision** the investigators walk the scene with the first officer, decide how far it reaches and find every item of evidence before anything is moved.
- **In the scene** (`ringOf`, `POLICE.cordon`): one cordon, round the hull of every item with **4 m** to spare (the body's taking in his length). Its stakes stand at the hull's corners, no closer than **2 m** and no further apart than **11 m**. The tape runs at **0.92 m** on stakes **1.05 m** tall and sags **1.2 %** of each span (at most 12 cm). It is **7.5 cm** wide (drawn wider past about 14 m from the lens, by 5.5 mm a metre and at most six times, so it reads from a machine 70 m up as a line about four pixels wide; up close it is the tape's own width) and twists as real tape hangs: leaned **0.8 rad** off its edge, give or take **0.6 rad**, a turn every **2.6 m**, so it shows its face (and casts a shadow) from above as well as from the side. The machine is set down so its rotor disc clears the cordon by 3 m (`planRescue`'s `avoid`), and as near him as that allows: off a cordon the patch nearest him wins (rings from **14 m**), and a patch on the relaxed slope limit is taken over a flat one about 20 m further off — the carry is the longest part of the scene.

### The tape, broken

- **The film.** Barrier tape is a non-adhesive polyethylene film, 7–8 cm wide and some 50 µm thick: a few grams a metre. It is tied off round each stake.
- **How it parts.** Something running into it bows it into a V; the film stretches and parts where it is loaded. Struck fast, the strain has no time to spread along it and it snaps at the contact. Pushed slowly, the pull spreads down the span until its weakest place lets go, usually a knot slipping off a stake.
- **What the halves do.** The stretched film springs back, so the loose ends whip toward the stakes, and the end it parted at is dragged a little way along with whatever broke it. It weighs so little that the air holds it up: a ribbon falls at about a metre a second, fluttering and turning over. Then it lies limp on the snow along its surface, the stretched end crumpled and a twist here and there, never sunk into the snow, and still tied to its stake. What hangs off a stake leans in a steady wind.
- **In the scene** (`police-tape.ts`): **anything that goes through a span breaks it** — the player on the next run (on his skis, his body thrown, or on a machine, so long as his body is over the tape's height there and he is not in the air above it), the rivals, an amateur of the crowd, the snowmobile, the bike and the piste machines, faster than **0.4 m/s**. Through it faster than **2.5 m/s**, it **snaps** at the contact after bowing **0.22 m**; slower, it bows **0.6 m** and **tears off the nearer stake**. A span breaks once, and only as far as the tape has been run along it. The break is decided after every step of a run (`cutTape`, from `stepRun`) off the run's own state and written onto the call (`RescueCall.tape`), so a replay or a seek finds the same breaks and the book carries them into the runs after; nothing is drawn from any stream and no digest moves. The people on foot and the officers never break it (the patrollers' carry lifts it over them).
- **The halves** are each broken span as a rope of points two to a stripe, stepped by Verlet at **120 Hz** from its break: gravity; the air's drag (across the film 7 and along it 1.4, as a share of |v|·v — a terminal fall of about 1.2 m/s) against the wind at 0.7 of the 10 m wind; a flutter as it falls that dies away over **1.6 s**; links that hold their length but not a shape, and a weak hold against folding back flat; the snow under every point, **6 mm** at least (Coulomb's friction once on it, 0.7, and stuck below **0.06 m/s**). At the break the film springs back at **6 m/s** at the loose end, dying over 2.2 m, the end dragged on at 0.45 of the breaker's speed (at most 5 m/s); the links within 0.6 m of the break are 12 % longer, stretched before they parted. It turns over as it falls (2.4 rad a metre of air across it), settles onto its face on the snow, lying along the slope with a curl of up to **0.45 rad** off flat every 0.85 m, both its edges on the snow. It **stops being stepped** once no point has moved faster than **0.03 m/s** for **0.5 s** (some 5–8 s after the break), and in any case 15 s after it: only a broken span costs anything, and only while it moves. Its state at any moment is a pure function of the break and the clock, so a seek back steps it again from the break.

### The markers

- **Numbered tents**, usually yellow with black numerals (1, 2, 3 …), one at each item. Many carry an L-shaped metric scale for the close-up.
- **They are laid before** the photographs that show them.
- **In the scene** (`evidenceOf`): a marker at the **point of impact** (the run's last wipeout), at **blood** a smash left on a solid (on the snow just off its face), at every **piece torn off** him (where its flight comes down; a crushed one where it was crushed), at each **ski** that went on without him, and the **body** last, beyond his head. They are numbered from the impact down to the body. Items within **1 m** of each other are one marker; one within **1.45 m** of him is set that far off; one more than **80 m** away is left out; at most **14** markers. A tent is 20 cm across and 17 cm tall, with its number on both faces, in a bright signal yellow (`#ffd60a`) with black numerals. Its faces are lit as the snow under it is (their normals bent toward the sky), so the face turned from the sun reads yellow in the light thrown up off the snow rather than olive.

### The photographs

- **Least intrusive first.** First **overall** shots at eye level from the scene's corners (the four-corner method). Then **mid-range** shots relating each item to the next or to a landmark. Then **close-ups**, filling the frame with one item, square to it, first without and then with the scale and its marker in frame.
- **A flash** is used for fill even in daylight.
- **In the scene:** the photographer shoots the scene whole from the four corners of the cordon's box, **2.5 m** outside it, walking briskly (**1.55 m/s**) outside the tape. Then, as the markers are stood, a **mid-range** shot standing **3 m** from each pair (a marker and the next, relating the one to the other) and a **close-up** crouched **1 m** from each. Each shot is **two exposures** (at 0.5 s and 1.0 s of a 1.5 s hold), each with a flash: a bright light at the camera that dies away in **0.05 s** (e-folding) and is gone after **0.3 s** (`flashAt`).

### Marks on the ground

- **Collision investigators** mark the point of impact and the resting positions on the surface, so the scene can be reconstructed.
- **In the scene:** the impact's marker is number 1 and the body's is the last.

## What happens, in order

Seconds from the call (`plan.at`); the machine sets down at 32 s, as the ambulance does.

1. **Out of the door** (`at.out`, 2.2 s after it is down): the three climb out one behind the other.
2. **The survey** (`at.survey`): the lead and the marker officer walk to whichever end of the line between the impact and the body is the nearer walk from the door, stand there a moment (**2 s**), then walk the line to the other end slowly (**1.1 m/s**) and stand there looking back along it (**2 s**).
3. **The cordon** (`at.cordon` → `at.taped`): the lead walks to the first stake — the one that is the shortest walk from her and, tied off, to where the recovery will start — drives it in (**0.9 s**), and runs the tape stake to stake round the scene at **1.45 m/s**, the tape appearing behind her as she walks. She ties it off at the first stake (**1.5 s**) and waits there.
4. **The markers** (until `at.marked`): the marker officer walks to each item in its number's order, kneels **0.7 m** from it for **3 s** and stands the tent at the middle of it.
5. **The photographs** (from the officers' coming out until `at.shot`, his last exposure): the four corners, then the markers' mid-range shots and close-ups as they are stood. The photographer then walks back aboard while the recovery begins.
6. **The recovery** (`at.recover`): the lead and the marker officer gather where the ambulance's crew start their scoop, 7 m off his feet. The two patrollers **carry the bag in** down the hill on its frame (`police-carry.ts`), one at the front on its left rail and one at the back on its right, along the scoop's own line for the last 3.5 m, and arrive **2 s** before the recovery starts. Where their way, or the scoop's walk-up after it, crosses the cordon, that span of tape is **lifted** over them, its middle 1.2 m up at the crossing and its ends still on the stakes, from 1 s before the frame's front comes to it until its back is 1.2 m through (`liftAt`, a morph target on the span). The marker officer, waiting at its front right, **takes the front** half a second later and the front patroller steps round to his own place. From then the ambulance's scoop runs (`rescue-plan.ts`'s trip): the bag is laid down beside him and its **lid swung open** flat onto the snow beyond the outer rail (**1.2 s**, as the two turn to it); he is log-rolled onto it, his body turned onto its line as he goes; the lid comes back over him (where the ambulance's crew would strap him) and **fills** to his shape as it comes down; zipped, it is lifted, carried at **1.0 m/s** (a body bag, with no spine to guard — the ambulance's stretcher goes at 0.8) and loaded exactly as the ambulance's casualty is. The two officers board, the patrollers walk clear.
7. **Lift-off** (`at.lift`): the machine leaves as the ambulance does. The cordon and the markers go with it.

On the seeds the suite plans, the scene keeps the machine on the snow **2.5–4 minutes** (`tests/police_plan_test.ts` holds it under 240 s): about 190 s where it could land within 20 m of him, about 240 s where the slope round him sent it 60 m off. Everybody walks at **1.3 m/s** between jobs, and every way walked is routed round the body (**0.85 m** from his line) and the machine (its cabin **1 m** past the skin, its boom and tail rotor **1.4 m**) (`route`).

## The body and the bag

- **The body is the one he was left as.** A dead rider is left lying where he died, in the pose he came to rest in (`gore-view.ts`' remains, a statue of his last frame). The call never draws its own lying figure beside it (`police-remains.ts`): while the officers work, the remains are the body. When the scoop rolls the casualty onto the bag, the part of the statue that is HIM (his dressed skin and what lies on him — not his skis or poles) is moved exactly as the casualty is moved (`statueDelta` in `police-bag.ts`: from where the scoop found him to where it has him, turned from his own line onto the bag's as he is rolled), so nothing is swapped in the open. The ragdoll comes to rest with its joints at the ground, in a dent the run's snow drew round him; the next run's snow is drawn whole, so the part that is him is stood back on the drawn snow (his hips 0.12 m over it, over the loose cover where it is powder) for as long as he lies there, police or no police. Once the lid is down over him he goes out of sight for good, and the bag is him. His blood and what was torn off him stay on the snow, and so do his skis and poles where they lie clear of the bag. Where no remains lie at the spot (the dead were cleared), the call's own lying figure is drawn until the lid is down.
- **His kit in the bag's way** (`police-kit.ts`, `plan.kit`): evidence is photographed where it lies and only then collected. Once the last photograph is taken, the photographer walks to where the bag will be laid, kneels **0.35 m** past its outer edge for **2.2 s**, gathers up every piece of kit any part of which lies within **0.2 m** of the bag's footprint (a modelled pair of skis is one mesh, so it is split into its skis and only the one in the way is taken), and carries it aboard upright at his side as he goes back to the machine. It is done about four seconds before the bag is set down, and moves nothing else on the clock.
- **The bag** (`police-bag.ts`): a heavy dark grey-black coated bag with a sheen, cut to a body's outline on the frame's rails — 0.4 m across at the feet, 0.72 m across the shoulders, 0.5 m at the head, the ends rounded off — its lid zipped round three sides (the far side and both ends, the zip's tape a lighter grey) and hinged along the fourth, three webbing handles down each side. Carried in it is shut and empty, flat on the frame. It is laid down 1.0 m off his middle (`RESCUE.bagBeside`, against the board's 0.6 m), clear of limbs that lie where they came to rest and are never straightened. Open, it shows its lighter grey inside. Shut over him the lid takes the shape of a body under it: the head, the shoulders, the chest, the hips, the legs and the feet (a morph from the flat lid), rounded across the whole width of the bag so it reads as a body's bag and not a box from 30 to 80 m.

## The call

- **Booked** (`rescue-book.ts`): `App.tsx` notes each step's `wipeout` as the run's point of impact (`noteImpact`). When a run ends dead, `bookRun` reads the evidence off it (`evidenceOf`: the impact, `gore.smears`, `gore.torn`, the skis in `skier.thrown`) and books a police call at where he lay. That call carries `kind: "police"` and the evidence.
- **Its own machine:** a police call never takes a second casualty, and an injury near it calls an ambulance of its own.
- **Stolen** (`engine/game/steal.ts`): a landed police machine is offered to the machine press at its door exactly as the ambulance is, and taken in its own livery (`HeliLivery` `"police"`, drawn by `heli-scene.ts` off the police model). Its officers freeze where they stood, and the next run sends another police machine to the same scene with the same evidence.
- **Kept and cleared** as the ambulance's calls are: from run to run on the book's clock, until its machine has gone, and every call when the map changes. A replay carries it in its recipe.

## The machine

The police helicopter is a Blender model of its own, `pwa/models/police.glb`: the heli-ski machine's airframe and nodes (`scripts/blender/police.py` runs `heli.py`'s builder whole, as the air ambulance's `rescue.py` does), dressed and equipped as a police air unit's machine. `rescue-view.ts` (the call) and `heli-scene.ts` (the machine stolen) both draw it through `policeModelUrl()`; with the helicopter models switched off (`VITE_MODEL_HELI=0`) every machine is the code's stand-in.

What the research says police machines of the light single- and twin-engine classes look like, in Europe and North America:

- **Colours for being seen and known.** The bodies are dark blue, white, or yellow and dark blue, with POLICE (or the word in the country's language) large on the sides and often across the belly, to be read from the ground. Many carry the blue and fluorescent yellow high-visibility chequer the forces' cars carry, in a band along the lower cabin and the boom.
- **The camera turret.** A gyro-stabilised ball under the nose or the chin, turning a full circle, carrying a daylight camera with a long zoom and a thermal imager behind small flat windows.
- **The searchlight.** A high-powered steerable searchlight, low on the airframe; on the smaller classes under the right rear seat, so that a bank to the left does not put the skid in its beam. It can be slaved to the camera.
- **The loudspeaker.** A speaker on the belly to talk to people on the ground.
- **The lights.** Blue strobes or beacons on the belly and the tail beside the red anti-collision lights.

The model, after it (the generic word only — no force's name, crest or registration):

- **The skin** dark navy; **the cowling, the fins and the blade tips** white; **a white cheat line** over the band.
- **The band** low along the cabin and sweeping up onto the boom, ending square short of the nose: two rows of blue and fluorescent yellow cells, 0.27 m long and 0.15 m tall, from behind the chin to where the boom grows too slim for them. The cells are fields on the skin traced into the mesh, so they are crisp at any distance and need no texture.
- **POLICE** in white, 0.27 m tall on each side of the cabin's back above the band (reading towards the nose from either side), and 0.5 m tall along the belly, reading from below — Blender's built-in face, laid onto the skin.
- **The camera turret** under the chin, right of the lower wire cutter: a ball 0.32 m across on a stub, two windows looking ahead and a little down.
- **The searchlight** low on the right under the rear seat, its lens not lit, so the drawer can switch it on.
- **Two blue beacons** (`beacon_blue`), on the belly behind the cabin and on the boom's top ahead of the fin, not lit in the model; `heli-view.ts` double-flashes them while the rotor turns.
- **The loudspeaker** on the belly, left of the centre line, behind the cabin's floor.
- **The wire cutters** as the air ambulance's. No hoist, no ski basket.

It is 15,806 triangles at LOD0 (the heli's budget is 16,000) and 6,400 at LOD1.

## Sources

- The police machine's equipment and look: a light helicopter maker's police-version brochure (the camera turret, the searchlight's place under the right rear seat, the belly speaker); a trade magazine's survey of police mission equipment; a national police air service's published photographs of its fleet.

- Which piste accidents the police record: a statistics release of an alpine safety board with the police (2022); a parliamentary answer of an interior ministry on alpine police accident records (2017).
- Police and prosecutor investigations of skier deaths, and helicopter long-line recovery: news reports from several mountain regions.
- Cordons: a national policing body's guidance on scene management and cordons; a police service's policy on serious crime scenes; a fire chiefs' council's guidance on securing a scene.
- Photography: crime-scene photography training handouts (a state police's, a corrections department's policy, a peace-officer study guide).
- Markers: forensic suppliers' specification sheets for numbered and L-scale evidence tents.
- Collision scenes: a sheriff's course on the scene protocol of traffic collision reconstruction.
