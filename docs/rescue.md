# The rescue on the next run

When a run ends with the skier **injured** (`GameState.gore.injured ≥ 0`, which needs the INJURIES switch), an **air ambulance** is called. The next run starts with it flying in from down the valley and setting down near where he lay. Four of its crew and the ski patrol carry him to it on a stretcher, load him through its door, and the machine lifts off and flies down the valley. Crash again while it is on the snow and it is still there; crash near it and the same machine takes you too. Where there is nowhere near him a helicopter can set down, the **ski patrol** comes on two snowmobiles instead and tows him down in a rescue toboggan — and their machines can be stolen (see *By snowmobile, where nothing can land*).

The machine on its skids is a **solid** the skier can hit (`engine/game/rescue-call.ts`), and its crew can be **knocked over**. The engine reads only where and when the machine sits, handed in with the run (`GameState.rescue`), and draws nothing from `state.rng`, so a run without one moves no digest. The flight is planned in `pwa/src/game/rescue-flight.ts` and each casualty's scoop and carry in `rescue-plan.ts` (both three-free, pure functions of the seconds since the call), posed in `rescue-crew.ts`, kept across runs by `rescue-book.ts` and drawn by `rescue-view.ts`, which `machines.ts` holds beside the machines. `make rescue` is its lab (`--sheet=arrive,second,knock` the arrival, a second casualty, and the crew and the machine met).

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

## The call: flown in, kept, shared

- **Flown in** (`rescue-flight.ts`, `RESCUE.flight`): the call is made the moment a run ends injured, so the next run starts with the machine still on its way. It comes in from down the valley along its own departure flown backwards (`heliArriving`), slows into a hover over the site, flares and sets down **32 s** into the call. The wash is thrown up as it comes in low.
- **The crew out:** 2.2 s after it is down the four climb out of the door with the board, gather (2.4 s) and walk the **lead** to his scoop's start: out of the door, past him on the door's side, round behind him in a turn of 4.5 m radius and in on the walk-up's line. Each walks his own line beside the lead (never swung round it as a rigid frame), so the outside man is never faster than a brisk walk. The two carriers hold the board between them.
- **Round the nose:** where he lies ahead of the machine or on its far side, the carry back to the door goes round a point clear of the nose, never under the tail.
- **Kept from run to run** (`rescue-book.ts`): the app keeps one book of calls on the map with a clock that runs on through every run. A restart hands the new run every call still under way in its own clock (`GameState.rescue`, a `RescueCall`: the call's start, its site, when it is down and when it lifts, and the casualties). A crash during the arrival meets it landed on the next run; a call is dropped once its machine has flown off, and every call when the map changes.
- **A second casualty:** a run that ends injured while a machine is still on the snow, within **110 m** of it and with a stretcher's room aboard (**two** a machine — a light single in an air-ambulance fit takes one or two), is taken by that machine. Once the first is slid in, the four come back out and walk the lead to him; it lifts after the last is loaded. Any other casualty calls a machine of its own.
- **A solid** (`engine/game/rescue-call.ts`): a machine on its skids is boxes to the engine (the cabin, the engine deck, the boom, the fin, the tail rotor's disc and the two skids, off `HELI`), held exactly as the airstrip's plane is: met at a crawl the skier is held off, met at speed it is a `hit` on steel that throws him, and a thrown body is held out of it too. It is no solid before it touches down or after it lifts. A run with no call never reaches it, so no digest moves; a replay carries its calls in its recipe.
- **The crew knocked over** (`rescue-view.ts`): the four are people on foot to `civilian-hits.ts`, struck by the skier or his thrown body like anyone in the village. A man struck staggers, falls or is flown on the ragdoll, lies, gets up and walks back to where the work has him. Presentation only, as every knock is.

## Stolen

A machine on its skids can be TAKEN by the player (`engine/game/steal.ts`). Rescue crews often load a casualty "hot", the rotor turning and the engine running, to save the minutes a shut-down and a restart cost on the ground; the landed machine here keeps its rotor at speed while the crew work, so there is nobody at the controls and nothing to stop a skier who walks up to it.

- **The press:** stood within `HELI.board.reach` (6 m) of its seat skid, on his skis and slower than `HELI.board.fastest` (12 m/s), the machine press (ENTER, a double tap, or a tap on the machine or on the HUD's call, which reads AIR AMBULANCE · TAP TO STEAL) takes it — never before it touches down or after it lifts, and never while his own helicopter is the one at hand.
- **What he gets:** the run's own helicopter becomes the one on the snow, at its site and attitude, its rotor at speed, in the ambulance's livery (`HeliState.livery`, drawn off the rescue model by `heli-scene.ts`), and he is sat on its skid. It flies exactly as his own does. The free ride's pad stands empty until it is wrecked, when a fresh machine waits there again.
- **Nobody else flies it:** let go in the air, it has no pilot to fly it home — the collective drops and it comes down where it is, crashing if it lands hard; set down gently, it parks wherever it lands and takes him back on the same press.
- **The crew left behind:** the call keeps the run's clock it was stolen at (`RescueCall.stolen`): its machine is no longer a solid, and the four and the casualty stand where they were as it went (`rescue-view.ts`). On the next run the book calls ANOTHER machine for every casualty it came for, sent from the moment of the theft (`rescue-book.ts`).

## How it is triggered and cleared

- **Triggered:** `App.tsx`'s new run goes through `rescueAgain`, which books a call when the run before ended with `gore.injured ≥ 0`, at where he lay (his ragdoll's hips, or else where he stood). `rescue-view.ts` draws every call the run carries.
- **Cleared:** a call lasts until its machine is gone, whatever runs come after.

## The model

The machine is `heli-view.ts` drawing the rescue model. `rescue-view.ts`'s `MODEL_URL` is the one line that names it (`rescueModelUrl()`, the air-ambulance livery with the hoist over its right door). Its pad is not drawn.

## By snowmobile, where nothing can land

Where no patch near him passes the landing search (`rescue-plan.ts`'s `fitToLand`: a steep face, the woods), the **ski patrol** comes for him on two snowmobiles instead (`engine/game/rescue-sled-route.ts`, `rescue-sled.ts`, the numbers `RESCUE_SLEDS` in `engine/game/defs/rescue-sleds.ts`). A call the patrol cannot reach either (no way up a machine can drive) falls back to the air ambulance, set down wherever it can.

### What a snowmobile rescue looks like

The research below is restated in our own words, with the numbers the scene uses.

- **The toboggan.** A rescue toboggan is a long boat-shaped pan on runners, of fibreglass or aluminium, its ends turned up and forked handles at the front. A current patrol toboggan is about **2.3 m** long and **0.56 m** wide and weighs some 23 kg. It carries a chain brake for a controlled descent and a tail rope. Patrols tow one behind a snowmobile on a short rigid bar (a folding tow bar is about **1 m** long) from a hitch on the machine.
- **The patrol's machine.** A ski area's patrol machine carries a flashing or rotating **amber light**, a red fluorescent **flag** on a whip, a siren and a headlight. Patrol machines and patrollers wear **red with a white cross** (the older uniform rust with a yellow cross), red for being seen against the snow.
- **Driving one.** One area's patrol protocol: drive slowly, in a low gear, alarm on, to one side of the run; set the parking brake before stepping off; and **point the machine for a clean departure before tending the patient**.
- **Towing a patient.** The usual practice is faster on smooth, flat stretches and slow on the steeps and uneven snow. The attendant splints and slings the injuries before loading, straps the skis alongside the patient and keeps the base told by radio.
- **In the scene:**
  - **Two machines, two patrollers on each.** They set out from the nearest **patrol post** (a lift's top or bottom station, or the snowmobile's spot at the bottom), the first towing the empty toboggan. Each drives up at most **10 m/s** (36 km/h), slower up a grade and round a bend (2.5 m/s² across), speeding up at 1.6 m/s² and slowing at 2.2.
  - **Where they stop.** The toboggan is left **6 m** ahead of him along the way down and **2.6 m** out to his side; the first machine stands on its tow bar ahead of it, **pointed down the way it will leave**, driven in on a 12 m straight; the second **3.2 m** out beside it, having left the first one's tracks 16 m short.
  - **The work** (`RESCUE_SLEDS.work`, **62 s** from the machines stopped to the convoy leaving): off the machines, the board fetched from the toboggan, the scoop as the air ambulance's crew do it, the carry to the toboggan, laid in it and strapped, back on the machines (`pwa/src/game/rescue-sleds-crew.ts`, `sledCrewAt`, a pure function of the call's clock). The two who carry the board ride the first machine, the two who tend him the second, each on the same seat both ways. Off the seats in **1.5 s**; the carriers take the board out of the toboggan (**1.6 s**; it rides up in it head end first) and walk it at **1.3 m/s** up past him, round behind him in a turn of at least **1.2 m** radius and down onto the scoop's walk-up, so he is scooped from behind as the air crew scoop him; the tenders walk round the toboggan and the machines to his far side at **1.4 m/s** and wait. Then the scoop and the carry on the air ambulance's own code, the carry an S from him along the toboggan's heading out to its side and **1.8 m** straight in over it; lowered into its bed (the floor **0.25 m** over the snow) in **1.6 s**, its three straps done up in **3.6 s**, stood up in **1 s**, and back to the machines and on them in **1.5 s**. On seed 38 at 45 % of the piste it is all done **54 s** after the second machine stopped, of the 62. Every walk keeps **0.25 m** off a machine, the toboggan and him (`route`: the shortest way past their corners). A machine stolen while it stands, the work goes on; its two walk clear **3.5 m** back from where it stood and watch, and with both gone all four stand by the toboggan.
  - **Down.** The first machine tows him down to the snowmobile's spot at the bottom at most **5 m/s** (18 km/h), slower on any grade (1.8 m/s at the least), speeding up and slowing at 0.8 and 1.0 m/s²; the second follows **5 s** behind on the same tracks. The call is over **6 s** after the convoy reaches the bottom.

### The way, searched

A grid of **8 m** cells over the map (`gridOf`, kept per map): a cell is open where no trunk, post, wall or rock column stands within **2.4 m** (**1.2 m** when the woods leave no other way), an edge between two cells is driven where its grade is at most **0.65** (about 33°), and its cost is its length, raised by the grade squared (× 4) and lowered by up to **35 %** on a groomed run, so the patrol drives the pistes where it can. The cheapest way (Dijkstra) to the nearest post, and from him to the bottom, is pulled straight wherever the line stays open and on a grade a machine drives, laid out every 2 m and smoothed into a machine's curve. Each point carries the clock it is passed at (`SledRoute`), so where each machine is at a moment is a pure function of the plan (`onRoute`).

### Stolen

A patrol machine left standing while the patrol works is the player's for the taking: stood within **5 m** of it on his skis, no faster than 12 m/s, the machine press (ENTER, a double tap on touch) takes it — a source of `steal.ts`'s like the air ambulance (`PATROL_SOURCE`, taken by `sled.ts`'s `takeSled`), never while his own stands nearer. It is his snowmobile from then on, in the patrol's colours (`SledState.livery`), and the one he had stays where he left it (`GameState.sledsLeft`, at most three kept), to be taken back the same way (`leftSledWithin`). A machine is only taken stood still, never on the move.

What it does to the rescue is a pure function of when it was taken (`RescueCall.sledsTaken`, the call's clock, which the engine writes and the book keeps from run to run): with the first machine gone, the second drives round onto the first one's straight, takes the toboggan and tows him down itself; with both gone, the toboggan stays where it is and the patrol with it. The engine and the drawing read the same function (`rescueSledsAt`), so the machines are solid where they are drawn: the skier is held off one at a crawl and thrown by one met at speed, as by the air ambulance on its skids.

### As drawn

`pwa/src/game/rescue-sleds-view.ts` draws every call by snowmobile each frame off `sledCrewAt` (built with the air ambulance's scene in `machines.ts`, so only with INJURIES on): the two machines are the player's snowmobile model in the patrol's livery (`sled-livery.ts`: the model's paint in a signal red, a white cross on each side of the hood and on the back of the tail pack, an amber beacon turning on a short mast over the pack and an orange pennant on a whip off the tunnel's end), each stood on the snow under its belt and skis; the toboggan is procedural (`rescue-toboggan.ts`: an orange pan with its nose swept up, runners, side rails, tail handles and a chain brake) with its A-frame tow bar drawn from the nose to the towing machine's hitch while hitched and laid on the snow ahead of the nose while not, and the three lashings done up over him one by one. The four ride sat astride, driver and passenger (`rescue-sleds-ride.ts`, two poses added to the air crew's on the same civilian bodies), in the patrol's red with the white cross, and on foot can be knocked over by a skier as the air crew can. After dark each machine's headlight lights the snow ahead of it and the nearest beacon sweeps amber round it. A machine he has stolen is drawn by his own snowmobile's view in the same livery and kit (`sled-view.ts`), and the machines he has left standing (`sledsLeft`) are drawn where they stand, each in its own livery.

The lab's sheets for it are `make rescue ARGS="--sheet=sleds-arrive,sleds-scene,sleds-load,sleds-tow,sleds-night,sleds-stolen"` (`pwa/src/tools/rescue-sleds-views.ts` finds a spot near `--at` where only the patrol can come and books the call as the game does).

## Sources

- High-altitude helicopter EMS operations (crew make-up, the rescue specialist): heliopsmag.com — *High Altitude HEMS*
- What a helicopter emergency medical service is and who flies in one: lionheli.aero — *HEMS* glossary entry; PMC7164232 (a survey of European services, physicians on board)
- The vacuum mattress and the scoop stretcher, their use and the lift: Wikipedia — *Vacuum mattress*, *Scoop stretcher*; a regional ambulance service's guideline for the vacuum mattress and scoop (2018)
- Landing zones (size, approach, bystanders): the landing zone guidelines of an air medical provider, a county fire service and a hospital flight program
- Slope landings (across the slope, upslope skid first, never facing downhill, the limits): copters.com — *Slope landing*; the federal helicopter flying handbook's slope operations, as discussed and taught (backcountrypilot.org, cfinotebook.net)
- High-visibility colours for responders: Cranfield University's work on conspicuity
- Hot loading (a casualty loaded with the rotor turning and the engine running, to cut the time on the ground, and its hazards): a state EMS curriculum's definitions of hot and cold loading; a fire service's generic risk assessment for working with helicopters; an air medical pilot's article on whether hot loading saves time
- The rescue toboggan (its shape, the akja, its materials): Wikipedia — *Rescue toboggan*; a current patrol toboggan's listing (length, width, weight, chain brake, tail rope)
- Towing a toboggan behind a snowmobile (the folding tow bar's size): a rescue equipment maker's listing for a snowmobile tow device
- Driving a patrol snowmobile and responding to an incident (low gear, the alarm, the parking brake, parked for departure, the attendant's work): a nordic centre's emergency response protocol and its first aid response guide
- Towing speed by the terrain: a ski patroller's published diary
- The patrol machine's light, flag and siren: a state bill draft on snowmobiles at ski areas
- Patrol uniforms (red with a white cross, rust with a yellow one): a ski area's patrol page and an article on what patrollers are
