# The rescue on the next run

When a run ends with the skier **injured** (`GameState.gore.injured ≥ 0`, which needs the INJURIES switch), the run after it shows how he left the mountain. An **air ambulance** has set down near where he lay. Four of its crew and the ski patrol carry him to it on a stretcher, load him through its door, and the machine lifts off and flies down the valley. The scene starts the first time the player comes within **180 m** of the spot, so he skis past it while it happens.

This is **presentation only**. Nothing in `engine/` reads it, and it draws nothing from `state.rng`, so no digest moves. It is planned in `pwa/src/game/rescue-plan.ts` (three-free, a pure function of the seconds since it started) and posed in `rescue-crew.ts`. `rescue-view.ts` draws it, and `machines.ts` holds it beside the machines. `make rescue` is its lab.

## What a mountain rescue by helicopter looks like

The research below is restated in our own words, with the numbers the scene uses.

### The crew

- **The crew of a helicopter emergency medical service** is usually three: a pilot, an emergency physician and a paramedic (or a crew member trained for the role).
- **In the mountains** a rescue specialist often flies too, for terrain where the machine cannot land.
- **Physicians** fly in about three services in four.
- **In the scene:** a doctor and a paramedic come off the machine. Two patrollers join them, the ski area's first responders, and the four of them get him onto the board together. The doctor and the paramedic fly with him; the patrollers stay.

### The stretcher

- **A suspected spine or pelvis injury** (which a hard fall on skis always is until proven otherwise) is immobilised on a **vacuum mattress**: a bag of small beads moulded round the body and pumped hard. It is often laid on a scoop stretcher or a frame so it can be carried.
- **Moving him onto it** takes four lifters plus one person holding the head.
- **The mattress** stays clear of the face. Its valve is at the feet.
- **Straps** hold him across the chest, the hips and the legs.
- **In the scene:** a 2.0 m frame with rails 0.62 m apart and a low orange mattress on it, with blocks either side of his head and three straps buckled over his chest, hips and legs. He lies on it face up and uncovered, in the player's own colours (his jacket, pants and helmet, on the crowd's lying figure) with his helmet still on, as a patient with a suspected head injury is brought in.
- **The carry:** four bearers, one at each corner on the outside, each holding the rail with his inner hand. They walk at **0.8 m/s** in step pairs a quarter of a stride apart, on boot steps of **0.55 m**. On a slope the uphill bearers lower their corner and the downhill ones raise theirs (up to 1.6 × 15 cm) to keep the stretcher level.

### Getting him onto the board

- **The log-roll:** a casualty with a suspected spine injury is turned as one piece. One rescuer holds the head in line and calls the moves; the others kneel along his side, reach over him to the far shoulder, hip and knee and roll him toward themselves onto his side. The board is slid in against his back, and he is rolled back down onto it. A scoop stretcher is the other way in (two halves slid under him from both sides and clipped together); the scene uses the log-roll, which reads at a distance.
- **Straps** go on before he is lifted: the chest, the hips and the legs.
- **The lift:** the bearers stand at the handles, outside the board, and lift on a call, together.
- **In the scene** (`rescue-scoop.ts`, `RESCUE.scoop`, about 25 s before the lift):
  - **He lies** where he fell, face up, a little sprawled. The four walk up from 7 m off at 1.2 m/s, the two patrollers carrying the board between them.
  - **They kneel** (1.2 s): the doctor and a patroller on his left, the two with the board on his right. The board is laid down 0.6 m off his middle, alongside him.
  - **Assess** (2 s): he is straightened, his arms and legs drawn in.
  - **Roll** (1.6 s): the two on his left roll him about his left edge onto his side, toward themselves, about 80°.
  - **Slide** (2 s): the two on his right push the board in against his back.
  - **Back** (1.6 s): he is laid back onto it as it settles under him.
  - **Strap** (3.6 s): three straps, one after another.
  - **To the corners** (1 s up, 1.6 s walking, 1 s down): the four stand, step round to the handles outside the board and kneel with a hand on the rail. Then they rise together.
  - **No clipping:** `tests/rescue_plan_test.ts` holds every posed hand, knee, foot and hip of the crew outside the board's box at every moment, and him on its top from the strap to the door.

### The landing zone

- **Size:** a helicopter landing zone is a cleared patch of about **18–30 m** square (60–110 ft for a light single-engine machine), clear of wires, lifts, trees and loose debris. Bystanders are kept **30 m** or more back.
- **The approach:** the crew go to the machine from the **front or the sides**, in the pilot's sight, and **never past the tail**, because of the tail rotor.
- **Slope:** a flight manual's slope limit for a light helicopter is about **6–10°**. A slope landing is made **across the slope**, so the skids lie along the contour. The **uphill skid is set down first** and the downhill one lowered after. A machine is never landed facing downhill, where the tail rotor would come near the snow.
- **In the scene** (`pickSite`):
  - **Where it searches:** rings 22–42 m from him for a patch whose skids sit inside a gradient of **0.15** (8.5°). A relaxed pass allows **0.24** (13.5°) and reaches out to 60 m. When nothing passes, it takes the flattest seat found.
  - **What it keeps clear of:** the rotor disc (radius 5.35 m) stays **2.5 m** clear of every trunk and **22 m** past its radius from a lift's line. The disc's rim keeps 1.4 m under the snow round it, and the carry's path keeps 1.6 m from every trunk.
  - **What it prefers:** a patch off the groomed run, level with him or below him (a load is carried down, not up), near the middle ring.
  - **How it sits:** with its nose along the contour, turned so that he lies **ahead and to its right**, the side its hoist hangs over and its sliding door is on. The crew therefore come from the front quarter.
  - **Its attitude:** fitted from the four skid ends, with the uphill skid resting where it touched first.

### Loading and leaving

- **Loading:** the stretcher goes in through the side door feet or head first, depending on the cabin. The crew lift it to the cabin floor and slide it in on its rails, and the medical crew climb in after it.
- **Wash and lift-off:** the rotor's wash on take-off throws loose snow up into a cloud. Crews stamp the landing zone down before a landing for that reason.
- **The timeline** (`plan.at`, seconds from the start):
  - **0 → rise (about 25 s):** the scoop above.
  - **rise → carry (2.2 s):** they lift together.
  - **carry → raise:** the carry, path length ÷ 0.8 m/s, on a curve that ends square to the door.
  - **raise (1 s):** the stretcher is raised to the floor.
  - **inch (0.9 s):** it is inched over the sill.
  - **climb (1.8 s):** the front two climb in.
  - **slide (2.8 s):** it is slid in. The rear two let go and walk clear for 11 s, then turn to watch.
  - **spool (1.6 s):** the rotor spools up.
  - **hover (4 s):** a hover at 4.5 m, turning down the valley.
  - **gone (40 s after lift-off):** it flies away, accelerating at 2.4 m/s² to 38 m/s and climbing at 2.2 m/s.
- **In the scene:** the wash raised only once it pulls (a third of the player's own wash), its lights lit after dark with a landing lamp on the snow.

## How it is triggered and cleared

- **Triggered:** `machines.ts` hands every frame's `GameState` to `rescue-view.ts`. When the state object changes (a new run) and the run before ended with `gore.injured ≥ 0`, it plans a rescue at where he lay: his ragdoll's hips, or else where he stood.
- **Cleared:** any other new run clears it, so it shows on the **one run after** an injured one and never again. Its clock (`watchRescue`) starts the first time the player comes within `RESCUE.reach`.

## The model

The machine is `heli-view.ts` drawing the rescue model. `rescue-view.ts`'s `MODEL_URL` is the one line that names it (`rescueModelUrl()`, the air-ambulance livery with the hoist over its right door). Its pad is not drawn.

## Sources

- High-altitude helicopter EMS operations (crew make-up, the rescue specialist): heliopsmag.com — *High Altitude HEMS*
- What a helicopter emergency medical service is and who flies in one: lionheli.aero — *HEMS* glossary entry; PMC7164232 (a survey of European services, physicians on board)
- The vacuum mattress and the scoop stretcher, their use and the lift: Wikipedia — *Vacuum mattress*, *Scoop stretcher*; a regional ambulance service's guideline for the vacuum mattress and scoop (2018)
- Landing zones (size, approach, bystanders): the landing zone guidelines of an air medical provider, a county fire service and a hospital flight program
- Slope landings (across the slope, upslope skid first, never facing downhill, the limits): copters.com — *Slope landing*; the federal helicopter flying handbook's slope operations, as discussed and taught (backcountrypilot.org, cfinotebook.net)
- High-visibility colours for responders: Cranfield University's work on conspicuity
