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
- **In the scene** (`ringOf`, `POLICE.cordon`): one cordon, round the hull of every item with **4 m** to spare (the body's taking in his length). Its stakes stand at the hull's corners, no closer than **2 m** and no further apart than **9 m**. The tape runs at **0.92 m** on stakes **1.05 m** tall and sags **1.2 %** of each span (at most 12 cm). The machine is set down so its rotor disc clears the cordon by 3 m (`planRescue`'s `avoid`).

### The markers

- **Numbered tents**, usually yellow with black numerals (1, 2, 3 …), one at each item. Many carry an L-shaped metric scale for the close-up.
- **They are laid before** the photographs that show them.
- **In the scene** (`evidenceOf`): a marker at the **point of impact** (the run's last wipeout), at **blood** a smash left on a solid (on the snow just off its face), at every **piece torn off** him (where its flight comes down; a crushed one where it was crushed), at each **ski** that went on without him, and the **body** last, beyond his head. They are numbered from the impact down to the body. Items within **1 m** of each other are one marker; one within **1.45 m** of him is set that far off; one more than **80 m** away is left out; at most **14** markers. A tent is 20 cm across and 17 cm tall, with its number on both faces.

### The photographs

- **Least intrusive first.** First **overall** shots at eye level from the scene's corners (the four-corner method). Then **mid-range** shots relating each item to the next or to a landmark. Then **close-ups**, filling the frame with one item, square to it, first without and then with the scale and its marker in frame.
- **A flash** is used for fill even in daylight.
- **In the scene:** the photographer shoots the scene whole from the four corners of the cordon's box, **2.5 m** outside it. Then, as each marker is stood, a **mid-range** shot standing **3 m** from it and a **close-up** crouched **1 m** from it. Each shot is **two exposures**, each with a flash: a bright light at the camera that dies away in **0.05 s** (e-folding) and is gone after **0.3 s** (`flashAt`).

### Marks on the ground

- **Collision investigators** mark the point of impact and the resting positions on the surface, so the scene can be reconstructed.
- **In the scene:** the impact's marker is number 1 and the body's is the last.

## What happens, in order

Seconds from the call (`plan.at`); the machine sets down at 32 s, as the ambulance does.

1. **Out of the door** (`at.out`, 2.2 s after it is down): the three climb out one behind the other.
2. **The survey** (`at.survey`): the lead and the marker officer walk to the impact, stand there a moment, then walk the line down to the body slowly (**0.8 m/s**) and stand at him (**4 s**).
3. **The cordon** (`at.cordon` → `at.taped`): the lead walks to the stake nearest her, drives it in (**1.8 s**), and runs the tape stake to stake round the scene at **1.1 m/s**, the tape appearing behind her as she walks. She ties it off at the first stake (**2 s**).
4. **The markers** (until `at.marked`): the marker officer walks to each item in its number's order, kneels **0.7 m** from it for **4.5 s** and stands the tent at the middle of it.
5. **The photographs** (from the officers' coming out until `at.shot`): the four corners, then each marker's mid-range and close-up once it is stood. The photographer then boards.
6. **The recovery** (`at.recover`): the lead, the marker officer and the two patrollers gather where the ambulance's crew start their scoop, 7 m off his feet. The body is rolled onto the open bag on the stretcher and the bag is closed over him (where the ambulance's crew would strap him). It is carried to the machine and loaded exactly as the ambulance's casualty is (`rescue-plan.ts`'s trip). The two officers board, the patrollers walk clear.
7. **Lift-off** (`at.lift`): the machine leaves as the ambulance does. The cordon and the markers go with it.

On the seeds the suite plans, the scene keeps the machine on the snow **4–6 minutes** (the scene itself about three, then the carry, whose length is how far off it could land). Everybody walks at **1.3 m/s** between jobs, and every way walked is routed round the body (**0.85 m** from his line) and the machine (its cabin **1 m** past the skin, its boom and tail rotor **1.4 m**) (`route`).

## The call

- **Booked** (`rescue-book.ts`): `App.tsx` notes each step's `wipeout` as the run's point of impact (`noteImpact`). When a run ends dead, `bookRun` reads the evidence off it (`evidenceOf`: the impact, `gore.smears`, `gore.torn`, the skis in `skier.thrown`) and books a police call at where he lay. That call carries `kind: "police"` and the evidence.
- **Its own machine:** a police call never takes a second casualty, and an injury near it calls an ambulance of its own.
- **Stolen** (`engine/game/steal.ts`): a landed police machine is offered to the machine press at its door exactly as the ambulance is, and taken in its own livery (`HeliLivery` `"police"`, drawn by `heli-scene.ts` off the same look). Its officers freeze where they stood, and the next run sends another police machine to the same scene with the same evidence.
- **Kept and cleared** as the ambulance's calls are: from run to run on the book's clock, until its machine has gone, and every call when the map changes. A replay carries it in its recipe.

## The livery

The machine is the air ambulance's model re-coloured in code (`police-livery.ts`, through `heli-view.ts`'s `HeliLook.livery`):

- **The skin** dark blue.
- **The cowling, the fins and the blade tips** white, with a white cheat line.
- **A chequer of blue and fluorescent yellow** along the band low on the cabin and up the boom. The model has no texture coordinates, so the chequer is cut in the shader off the model's own frame.

The police machine's own Blender model is a later part.

## Sources

- Which piste accidents the police record: a statistics release of an alpine safety board with the police (2022); a parliamentary answer of an interior ministry on alpine police accident records (2017).
- Police and prosecutor investigations of skier deaths, and helicopter long-line recovery: news reports from several mountain regions.
- Cordons: a national policing body's guidance on scene management and cordons; a police service's policy on serious crime scenes; a fire chiefs' council's guidance on securing a scene.
- Photography: crime-scene photography training handouts (a state police's, a corrections department's policy, a peace-officer study guide).
- Markers: forensic suppliers' specification sheets for numbered and L-scale evidence tents.
- Collision scenes: a sheriff's course on the scene protocol of traffic collision reconstruction.
