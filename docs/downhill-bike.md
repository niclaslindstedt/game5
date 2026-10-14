# The downhill bike

This page holds the research for the summer's machine: a DOWNHILL MOUNTAIN BIKE of the class raced on lift-served courses. It has long-travel dual suspension, a slack front end and wide knobbly tyres, it is built only to go down, and the lift carries it back up. Each section gives a measured band, then names the source by kind and author and, where one was used, gives the formula. The table at the end gives the numbers `defs/bike.ts` should be built from. The evals under it are what a physics PR should be held to.

No make or model is named. The geometry comes from published frame charts and independent workshop measurements of current downhill frames, restated as bands.

## The class

A downhill bike is defined by what it carries:

| Item | Band |
| --- | --- |
| Rear wheel travel | 180–250 mm (current frames 190–210 mm) |
| Fork | dual-crown, 180–203 mm of travel, on a 1.5″ steerer |
| Head angle | 63.5° or slacker |
| Wheelbase | over 1.14 m |
| Wheels | 29″ both ends, or a 29″ front with a 27.5″ rear (the "mixed" or "mullet" set-up, chosen for the smaller sizes and the steepest tracks) |
| Tyres | 2.4–2.6″ wide, with downhill casings |
| Brakes | four-piston discs on 200–223 mm rotors |
| Drivetrain | a single chainring on a short seven-speed cassette |
| Seat | low, out of the way; it is never sat on while riding |

## Geometry

These are a medium-to-large frame's numbers, drawn from four current 29″ downhill frames (published charts plus one frame measured in a workshop):

| Measure | Band | Typical |
| --- | --- | --- |
| Head angle | 62.0–63.5° | 62.5° |
| Seat angle (effective) | 76–78° | 77° |
| Reach | 435–495 mm (by size) | 457 mm |
| Stack | 615–655 mm | 630 mm |
| Wheelbase | 1207–1330 mm (by size) | 1290 mm |
| Front centre | 820–860 mm | 833 mm |
| Chainstay | 431–475 mm (size-specific) | 450 mm |
| Bottom-bracket height (static, unsagged) | 345–370 mm | 351 mm |
| Fork offset | 42–52 mm | 48 mm |
| Trail | 125–145 mm | 137 mm |
| Bar width | 780–800 mm | 800 mm |
| Crank length | 160–165 mm | 165 mm |

Trail is `(R·cos ε − d) / sin ε`, where R is the wheel radius, ε the head angle measured from the ground and d the fork offset. For R = 0.375 m, ε = 63° and d = 48 mm it comes out at 137 mm. That much trail is what makes the bike steady in a straight line at 50 km/h and heavy to turn at walking pace.

Under the rider's sag the bike pitches nose-down by about 1° and the bottom bracket drops 30–40 mm. Ridden, the head angle is about a degree STEEPER than the static number on the chart.

## Mass

| Part | Band |
| --- | --- |
| Whole bike | 16–18 kg (a workshop-measured medium frame built up: 16.9 kg; reviews: 17.0–17.5 kg) |
| One wheel with its tyre, insert and rotor | 2.2–2.8 kg; a downhill tyre alone is 1.3–1.5 kg |
| Wheel's moment of inertia about its axle | 0.20–0.26 kg·m² (a 29″ about 0.24, a 27.5″ about 0.21). Worked as Σ m r²: a rim of ~0.6 kg at 0.30 m, a tyre of ~1.4 kg at 0.355 m, spokes and hub small. A bigger wheel carries a lot more: one lab measured a 32″ wheel at 27% over a 29″ |
| Sprung mass | ~13 kg of bike over the springs, the rider on top of that |
| Unsprung mass | ~2.8 kg a wheel end: the wheel, the lower legs or the swing arm's share, the caliper |

The RIDER is most of the system. Rider plus bike is 80–115 kg, so the rider is 80–85% of the mass and moves relative to the bike. The rider's arms and legs are a second suspension with a stroke of 0.2–0.4 m: a standing rider puts 70–90% of their weight through the pedals and the rest through the bars.

## Suspension

| Measure | Band | Source |
| --- | --- | --- |
| Rear travel at the wheel | 190–210 mm | frame charts |
| Rear shock stroke | 70–75 mm on a 225–250 mm eye-to-eye | frame charts |
| Average leverage ratio (wheel ÷ shock travel) | 2.6–2.9 | derived from the two rows above |
| Progression | 15–30% fall in leverage ratio over the travel, e.g. 3.2 → 2.6 is 19% | builders' convention |
| Sag, rear | 30–35% of travel (35% advised for downhill) | suspension makers' set-up guides |
| Sag, front | 20–30% of travel | set-up guides |
| Coil rate at the shock | 400–450 lb/in (70–79 N/mm) for a 70–85 kg rider | spring-rate charts |
| Fork coil rate | 40–50 lb/in (7.0–8.8 N/mm) for 64–82 kg | fork spring charts |
| Wheel rate, rear | 9–12 N/mm (shock rate ÷ LR²) | derived |
| Wheel rate, front | 7–9 N/mm | derived |
| Natural frequency, sprung | ~2.0–2.2 Hz rear, ~2.2–2.5 Hz front | derived (√(k/m)/2π with the rider's share) |
| Damping ratio | 0.2–0.4 rebound; compression softer on the fast stroke | our estimate, from vehicle practice |

Two points matter for the model:

- **Progression** keeps a big landing from bottoming. The rate at the end of the stroke is 1.4–1.7 times the rate at sag, and a bump stop takes the last 10–15 mm.
- **Rear-wheel paths** of downhill frames move rearward over the first part of the travel. That is why the rear eats square edges better than the fork does. A game can leave it out.

## Tyres on dirt

**Pressure.** Downhill riders run 22–23 psi (1.5–1.6 bar) front and 26–27 psi (1.8–1.9 bar) rear on downhill casings, 2–3 psi lower on the newest casings. The tyre maker's generic chart says 35–60 psi for a 2.5″ tyre, which is NOT what downhill riders use. At ~1.6 bar a 500 N wheel load needs a contact patch of about 30 cm². The tyre's vertical stiffness is around 80–150 N/mm (our estimate).

**Grip.** Coulomb friction is only an approximation on loose ground. Measured all-terrain-vehicle tyres on dirt and gravel showed effective peaks up to about 1.9, because the knobs dig in and shear the ground (an SAE paper on off-road friction, 1996). For a game, a friction band per surface is the honest model. Asphalt-and-gravel values come from vehicle reconstruction tables; the rest are our bands, built from those tables and the off-road reports.

| Surface | μ peak | μ sliding | Rolling resistance Crr (downhill knobbly) |
| --- | --- | --- | --- |
| Hardpack, dry | 0.8–1.0 | 0.65–0.8 | 0.025–0.04 |
| Tacky loam | 0.9–1.2 | 0.75–0.9 | 0.05–0.08 |
| Loose gravel over hardpack | 0.5–0.7 | 0.45–0.55 | 0.03–0.05 |
| Dry rock | 0.9–1.1 | 0.7–0.9 | 0.02–0.03 |
| Wet rock | 0.4–0.6 | 0.3–0.45 | 0.02–0.03 |
| Roots, wet | 0.2–0.35 | 0.15–0.25 | — |
| Grass, dry | 0.5–0.7 | 0.4–0.55 | 0.04–0.08 |
| Grass, wet | 0.25–0.4 | 0.2–0.3 | 0.05–0.10 |
| Mud, peat | 0.3–0.5 | 0.25–0.4 | 0.08–0.15 |
| Snow patch, packed | ~0.2 | 0.15 | 0.03–0.06 |

For comparison, vehicle tables give gravel 0.60/0.55, dry dirt 0.68/0.65 and wet dirt 0.55/0.40–0.50. Measured off-road rolling resistance of cross-country tyres is about 0.020–0.024, ranging up to 0.03 (a virtual-elevation study of 29″ tyres). Knobbly tyres roll about 21% worse than smooth ones, and downhill tyres are heavier and softer again, hence the bands above.

**Cornering stiffness.** A survey of fourteen bicycle tyres measured cornering stiffness, normalised by vertical load, at 0.15–0.35 per degree (9–20 per radian). Camber stiffness, the side force from lean alone, was 0.0075–0.015 per degree. A bicycle turns mostly on CAMBER: the lean makes most of the side force and the slip angle only trims it. One measured heavy tyre gave 94 N per degree at 411 N.

## Bicycle dynamics

- **Lean in a steady turn:** `tan φ = v² / (g·r)`. At 30 km/h on a 10 m radius that is 35°.
- **Grip limit on flat ground:** `tan φ ≤ μ`, so about 39° on hardpack (μ 0.8) and 27° on dry grass (μ 0.5).
- **On a berm** banked at β, the fastest a turn of radius r can be held without sliding is `v² = g·r·(sin β + μ cos β) / (cos β − μ sin β)`. A 40° berm with μ 0.8 lifts the limit to roughly three times the flat corner's v².
- **Self-stability.** The benchmark bicycle model (Meijaard, Papadopoulos, Ruina and Schwab, 2007) is self-stable, with no rider control, between its weave speed (~4.3 m/s) and its capsize speed (~6.0 m/s). Below that band it weaves and falls; above it, a slow capsize the rider corrects without noticing. Downhill speeds lie well above the band, so in a game a bicycle model with a rider's hand on the bars holds itself up at speed and needs a rider's balance below ~4 m/s.
- **Countersteer:** a lean is started by a brief steer AWAY from the turn. At speed the steer angle that holds a turn is small (a few degrees); at a crawl the bars turn far.
- **Wheels' spin:** two wheels of ~0.24 kg·m² at 15 m/s (about 40 rad/s) carry angular momentum that resists a quick lean change in the air and steadies the bike. It is a real effect, but small next to the trail's.

## Braking and the endo

The front wheel lifts (the bike goes over its nose, an ENDO) when the deceleration a, as a fraction of g, reaches `b / h`. Here b is the horizontal distance from the combined centre of mass to the front contact, and h is the centre of mass's height above the ground.

- A trekking bike with an average rider goes over at about 0.71 g (a 2017 study).
- On a downhill bike with the rider standing neutral (b ≈ 0.83 m, h ≈ 1.05 m) it is about 0.79 g. With the rider back and low (b ≈ 0.98, h ≈ 0.90) it is about 1.09 g. Getting low and back is how a downhill rider brakes hard.
- **On a slope** of angle θ the limit falls to `a_max = g (cos θ · b/h − sin θ)`. On a 14° pitch with the rider neutral that is about 5.2 m/s². On steep track the endo, not the tyre, is the limit on the FRONT brake.
- **Rear brake alone:** `a = μ g b / (L + μ h)`, about 0.3 g. Measured bicycle braking on dry asphalt was 0.40–0.71 g with both brakes and 0.25–0.37 g with the rear alone (SAE). Motorcycles go over the bars at 0.8–0.98 g.
- **Stopping distance** from 40 km/h: about 8.4 m at 0.75 g, 10.5 m at 0.6 g. On loose ground the tyre's μ (table above) caps the front first.

A locked rear skids and steers the tail out. A locked front washes out, and the rider goes down.

## Pedalling

Downhill is mostly NOT pedalled. A rider pedals out of the start gate, out of slow corners and on flat sections only.

- **Field power** (a study of downhill riders on course, Hurst and Atkins): peak 834 ± 129 W and mean 75 ± 26 W over a run, with the heart rate at 168 beats a minute on average.
- **Lab peak anaerobic power:** downhill riders reached 1138 ± 136 W, cross-country riders 1114 W.
- **Gearing:** a single 34–36 tooth ring over a seven-speed 11–24 range, cranks 160–165 mm, cadence 80–120 rpm. At 120 rpm in top gear on a 29″ wheel (2.35 m of roll-out) the bike makes about 55 km/h. Past that the rider tucks and coasts.

## Speed and the air

- **Drag area (CdA):** 0.35–0.45 m² for a mountain biker riding seated; in the downhill "attack" stance, standing with elbows out, 0.45–0.6 m² (our band, 0.5 typical). Air density at a ski area's height is 1.0–1.1 kg/m³.
- **Coasting speed** (drag balancing gravity less rolling resistance), with m = 97 kg, CdA 0.5, ρ 1.06 and Crr 0.03: about 100 km/h on a 25% straight, about 57 km/h on a 10% one. Real speeds stay well under these because a course is not straight.
- **Measured race speeds** (a GPS study of six elite riders on 202 mm bikes, Hurst et al., Journal of Science and Cycling, 2013):

  | Course | Length | Vertical | Mean grade | Time | Mean speed | Peak speed | Most time spent at |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Natural | 1363 m | 431 m | 29.2% | 192 s | 24.9 km/h | 52.7 km/h | 20–30 km/h |
  | Man-made | 2182 m | 473 m | 22.9% | 253 s | 29.6 km/h | 49.1 km/h | 30–40 km/h |

  The peak came on the steepest straight shot.
- **Race courses:** 1.5–3.5 km long, 2–5 minutes, with current top-level courses 1.6–2.4 km. Top speeds on the fastest open courses reach 60–80 km/h (our estimate from the coast speeds).

## In the air

- **Bunny hop:** one skilled rider analysed cleared a 33 cm obstacle at 4.6 m/s. Typical riders lift 30–60 cm, experts 80–100 cm and more. The pop is a push down and a lift through the legs and arms; there is no spring to release.
- **Projectile:** off a lip at angle α and speed v the flight is a projectile, `d = v² sin 2α / g` on level ground. A 3 m table at 25° needs 22 km/h, a 6 m one at 30° 30 km/h, a 10 m at 30° 38 km/h and a 15 m at 35° 45 km/h.
- **In the air** the rider controls pitch by pushing or pulling the bike under them and by braking the rear wheel (the wheels' spin, braked, pitches the bike nose-down). Yaw comes by twisting the bike under the body: a "whip" or a "scrub" kept low.
- **Landing loads.** A force-plate study of drops (Phillips, Kilgas and Jensen, ISBS 2015) used 8 riders on a 130 mm bike at 28 psi. Summed peak forces from drops of 29, 48 and 67 cm were 5442, 6800 and 7878 N: 6.1, 7.6 and 8.9 times the weight of bike plus rider. The REAR tyre took the larger peak (3358–4425 N against 2084–3453 N at the front).
- **A 2 m drop to flat** arrives at 6.3 m/s. Absorbed over a 0.55 m stroke (the suspension plus the rider's legs) the mean deceleration is about 4.6 g; taken stiff over 0.25 m, about 8.8 g. Landing on a DOWNSLOPE turns most of that into speed instead. When hopping, a human leg is a spring of roughly 10–30 kN/m (Farley et al., 1991).

## Crashes and injuries

- **How riders come off** (a 2025 systematic review): over the bars 55%, sideways ejection 12%, the rest falls and collisions.
- **Lift-served bike parks** (two parks, 2023–24, 274 injured riders):
  - 98% wore a helmet;
  - causes: rider error 77%, jump landings 21%;
  - where: shoulder and collarbone 34%, the rest of the arm 26%, head and face 17%;
  - kind: fractures 52%, concussions 13%; 81% of the fractures were in the shoulder or arm;
  - rates: 4.1 injuries per 1000 visits, 6.3 per 10,000 downhill runs.
- **A season of downhill racing** (a survey of 249 riders): 494 injuries over 29,401 hours. The lower leg took 27% and the forearm 25%; abrasions were 64% of injuries and contusions 56%; riding errors caused 72%. In an older bike-park cohort the commonest single injury was a broken collarbone (13%).

The body this game already has (`body.ts`, `defs/anatomy.ts`) carries the ladders. A crash over the bars should load the hands, wrists, collarbones, shoulders and head first; a slide sideways, the hip, the thigh and the shoulder.

## What the game needs

### Numbers for `defs/bike.ts`

| Number | Band | Pick | Source |
| --- | --- | --- | --- |
| Wheel radius (29″, tyre on) | 0.37–0.38 m | 0.375 m | tyre size |
| Wheel radius (27.5″ rear, mixed) | 0.355–0.365 m | — | tyre size |
| Wheelbase | 1.25–1.33 m | 1.29 m | frame charts |
| Head angle (static) | 62–63.5° | 62.5° | frame charts |
| Fork offset | 42–52 mm | 48 mm | frame charts |
| Trail | 125–145 mm | 137 mm | derived |
| Bottom-bracket height (static) | 0.345–0.37 m | 0.355 m | frame charts |
| Chainstay | 0.43–0.46 m | 0.45 m | frame charts |
| Reach / stack | 0.435–0.495 / 0.615–0.655 m | 0.46 / 0.63 m | frame charts |
| Bar width | 0.78–0.80 m | 0.80 m | reviews |
| Bike mass | 16–18 kg | 17 kg | measured builds |
| Wheel mass (each, tyre on) | 2.2–2.8 kg | 2.5 kg | parts weights |
| Wheel inertia | 0.20–0.26 kg·m² | 0.24 kg·m² | derived Σ m r² |
| Rear travel | 0.19–0.21 m | 0.20 m | frame charts |
| Front travel | 0.18–0.203 m | 0.20 m | fork class |
| Sag rear / front | 30–35% / 20–30% | 33% / 25% | set-up guides |
| Wheel rate rear / front | 9–12 / 7–9 N/mm | from sag | derived |
| Progression (end rate ÷ sag rate) | 1.4–1.7 | 1.5 | builders' convention |
| Sprung frequency | 2.0–2.5 Hz | — | derived; a check, not an input |
| Damping ratio | 0.2–0.4 | 0.3 | our estimate |
| Tyre pressure | 1.5–1.9 bar | 1.6 front / 1.8 rear | rider reports |
| Tyre vertical stiffness | 80–150 N/mm | 110 N/mm | our estimate |
| Cornering stiffness ÷ load | 9–20 /rad | 14 /rad | tyre survey |
| Camber stiffness ÷ load | 0.43–0.86 /rad | 0.6 /rad | tyre survey |
| μ peak / sliding by surface | (table above) | — | vehicle tables, off-road reports, our bands |
| Crr by surface | 0.02–0.15 (table above) | — | rolling studies, our bands |
| CdA, attack stance | 0.45–0.60 m² | 0.50 m² | pacing-tool bands, our estimate |
| CdA, tucked | 0.35–0.45 m² | 0.40 m² | pacing-tool bands |
| Rider's CoM above the ground, standing | 0.95–1.10 m | 1.05 m | derived from the stance |
| Rider's CoM, low and back | 0.85–0.95 m | 0.90 m | derived |
| Rider's legs and arms as a stroke | 0.2–0.4 m | 0.3 m | stance |
| Endo threshold `b/h` | 0.75–1.10 | from the CoM | Klug 2017; derived |
| Braking, both brakes, dry | 0.6–0.9 g | — | SAE bicycle tests; capped by μ and `b/h` |
| Braking, rear only | 0.25–0.37 g | — | SAE bicycle tests |
| Peak pedal power | 800–1100 W (a few seconds) | 900 W | field and lab studies |
| Mean pedal power over a run | 50–100 W | — | field study |
| Gear roll-out (top) | 7.5–8 m per crank turn | 7.7 m | 36/11 on a 29″ |
| Cadence | 80–120 rpm | — | — |
| Bunny hop | 0.3–0.6 m (expert to 1 m) | 0.45 m | analysed hops |
| Landing peak (0.3–0.7 m drops) | 6–9 × weight | — | force-plate study |

### Evals

Each eval is a lab row before and after (`make bike-ride`). The bike is held to:

1. **Coast speed:** in an attack stance on a straight 25% grade of hardpack, the bike settles at 90–110 km/h. On 10%, 50–60 km/h.
2. **Stopping:** both brakes from 40 km/h on dry hardpack stop it in 8–12 m without an endo, rider neutral on flat ground.
3. **Endo:** the front brake alone, hard, on a 15° pitch with the rider neutral lifts the rear wheel. The same with the rider back does not.
4. **Rear brake alone:** at most 0.37 g on dry hardpack; locked, the rear slides.
5. **Lean:** a steady turn of 10 m at 30 km/h on flat hardpack holds about 35° of lean (±3°). On dry grass the same turn slides out.
6. **Berm:** a 40° berm holds the speed the bank formula gives, ±10%.
7. **Sag:** at rest, rider standing on the pedals, the rear sits at 30–35% of its travel and the front at 20–30%.
8. **Drops:** off 0.3, 0.5 and 0.7 m to flat at a walking speed, the summed tyre-plus-rider peak is 6–9 times the weight, and the rear peak exceeds the front's.
9. **Big drop:** a 2 m drop to flat, absorbed, peaks under 5 g at the body. Taken stiff, it reaches the injury ladder's bands.
10. **Pop:** a bunny hop from 4–5 m/s clears 0.3–0.6 m.
11. **Jumps:** a 6 m table at 30° is cleared at 28–32 km/h and cased under 26 km/h.
12. **Pedalled top speed** on flat ground: 45–55 km/h.
13. **Bot on a course:** down a course of the man-made profile (2.2 km, 473 m, 23%) the bot's mean speed is 25–33 km/h and its peak 45–55 km/h, in 230–290 s.
14. **Surface:** coasting down the same 10% pitch, grass is slower than hardpack, and mud slower still, in the Crr order above.
15. **Low speed:** below ~4 m/s with no balance input the bike falls; with the rider's hand on the bars it is held up.
16. **Determinism:** two runs on one seed and input tape give the same digest, and no existing mode's digest moves.

## What is built

The bike is built in the engine (part C1): the bodies, the game's handling of it, the bot and the lab. It is ridden in the app too (part C2, *As drawn, heard and played* below): the start card's row, the drawing, the rider, the lens, the HUD and the sound.

- **The numbers** — `engine/game/defs/bike.ts` (`BIKE`), every one from the table above, each with its unit. The geometry they make (the axles, the steer axis, the trail, the rear axle's path) is `bike-geometry.ts`.
- **The bodies** (`bike-body.ts`'s `rideBike`, over `bike-tyre.ts` and `bike-frame.ts`). A rigid frame, the bars and fork turning on the steer axis, two wheels on rising-rate springs and digressive dampers (bump stop, tyre and rim past the travel), and the RIDER as a second body on his legs and arms — four-fifths of the mass. The steps are split into `BIKE.substeps` substeps.
  - **The tyre** gives one grip budget along and across the wheel, off the summer ground's surface under each patch (`summer-ground.ts`): the cornering and camber stiffness, the peak and sliding μ, the rolling resistance.
  - **The steering.** The front's force about the steer axis turns the bars, against the rider's hands and with the wheel's gyroscope. The hands ask a LEAN; the bars countersteer into it, and the rider's BODY lays the bike over too (`hands.body`): the outside foot weighted and the inside bar pressed down. A rider leaning the bike under him needs far less of a countersteer's swing the wrong way, so the turn bites about 0.2–0.3 s after the bars move. The throw maps onto the lean asked (`bikeTurnAsked`). Up to `hands.knee` (three quarters of the throw) the lean stays inside `hands.grip` of what the tyres hold, which covers every turn a rider makes. Past the knee, held for more than `hands.past.after` s, it reaches on past the tyres' grip (`hands.over`, or `hands.reach` with the assist off). The tyres then slide out from under him and he goes down. At a crawl the knee turns a 2.5 m radius and a full lock tighter. The assist's hands (`GameState.assist`) help: its yaw hold keeps the lean inside the grip short of the knee, holds him up at a crawl and eases a brake that would lock, and its air hold levels him in the air. `make bike-steer` measures all of it: how fast the turn bites at every speed and throw, the radius and lean it settles at, and the flip map of which turns throw him.
  - **Weight** is shared between the axles by where the rider stands. Leaning back holds an endo off; the crouch and its release are the pop.
  - **The brakes** are capped by each tyre's grip; a wheel locks and skids, and the front alone pitches him over the bars past `b/h`.
  - **Pedalling** is power-limited (`BIKE.pedal`), with aero drag on the rider's stance.
  - **In the air** his body English pitches and yaws the bike; a brake stops a spinning wheel and pitches it. The assist's hands square it up for the landing only within `air.reach` (1 rad) of the ground's line: further off, it comes down on whatever is down.
- **Landings judged** (`bike-judge.ts`): clean, cased (the rear short of the landing), nosed (front first, past a pitch), overshot (past the landing onto the flat) or flat. A landing past what the legs take, a washout, a lowside, a trip over the bars, a trunk, post or rock hit, or the body put on the ground THROWS him — the `bike` crash cause on the skier's own ragdoll, his injuries the body's like any fall's. The bike goes on as a loose body sliding on its side and lies where it stops.
- **In the game** (`bike.ts`; `CreateGameOptions.bike` / `.bikeTrail`, `GameState.bike`). Only a SUMMER FREE RIDE that asks for it carries one; every other run has no `bike` field and moves no digest. The ride begins on the bike at rest at a trail head on a lift's top (`bikeTrail`, else the easiest).
  - **The keys** are read in one place, `bikeControls`: the tuck the pedals, the back key both brakes, the trick key the rear alone (a skid), the edge the bars, the lean his weight fore and aft, the jump a crouch and pop. `bikeInput` is its inverse, for the bot.
  - **The machine press** steps him off onto his feet; he WALKS, the bike lying where he left it (`BikeState.afoot`). Within `BIKE.board.reach` of it, the same press puts him back on.
  - **Ridden into a chair's or a gondola's load zone**, the lift takes him as it takes a skier, and the bike rides up with him (mode `lift`); he is back on it at the top. The drags stand still in summer.
  - **The restart, as the snowmobile's.** Stood up after a fall, he is back on the bike on the trail he was riding (kept by `bike-trail.ts`; a crossing is ridden through on its own trail), at its nearest point within `BIKE.board.back` m that is clear of a feature, with a run-up before it. Off every trail, he is stood up where the bike lies.
  - **Events:** `board`, `hop`, `crash` (with `how`), `right`, `restart`, `lift` and `land` (with `landing`, `g` and `air`).
  - **Nothing here draws from the stream.**
- **The trails underfoot.** On a bike trail's tread the rock skin is not stood on (`rock-ground.ts`), as on a groomed run: the trail is the tread. Two trails' crossings are levelled to one height ([bike parks](bike-park.md)).
- **The pose the drawing reads** — `bike-pose.ts`'s `bikePose`. This is a plain, three-free and DOM-free record a frame: the frame's place and attitude, each wheel's turn, the bars' steer, each end's compression and share of its travel, the cranks, and the rider's body on the frame.
- **The bot** (`engine/sim/bike-pilot.ts`, `BIKE_PILOT`). It rides a trail from its head to its foot on the same keys a player has:
  - **Speed.** It takes each bend at a share of the tread's grip (more on a berm's bank), braked to in time. It reckons its brakes weaker on a steep pitch, where they also fight the fall line.
  - **Jumps.** It holds a jump's approach speed (`featureSpeed`, off the projectile and the landing), crouches and pops at the lip, pitches to the landing's slope in the air, and rolls a drop off slowly, its weight back.
  - **Steering.** It asks the bend half a breath ahead and reads its heading and offset errors where they will be once the lean it asks has come (`line.predict`).
  - **Wariness.** After a fall it rides the same stretch slower each time (`BikeAim.wary`), as a rider takes a section that threw him.
- **The lab** — `make bike-ride` (`scripts/bike-ride-lab.mjs`) rides every eval above as a row against its band, on synthetic ground (`tests/support/bike-rides.ts`, `bike-worlds.ts`). `ARGS=--bot` adds the bot down every trail of seeds 38 and 7's parks (`tests/support/bike-bot.ts`). A bot row is in band when it gets home with its falls a km at most `BOT_FALLS` for its grade: green 2, blue 3, red 5, black 8, the race line 8. `tests/bike_test.ts` holds every bench row, and `tests/bike_ride_test.ts` the game's handling of it.

### The bot measured

`make bike-ride ARGS=--bot` (round 3) gets the bot home on all ten trails of seeds 38 and 7:

| Seed | Trail | Grade | Length m | Time s | Mean km/h | Top km/h | Falls a km |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 38 | DH | race | 4663 | 917 | 18.3 | 67.5 | 8.0 |
| 38 | B1 | green | 6340 | 1365 | 16.7 | 27.0 | 1.4 |
| 38 | B2 | blue | 4436 | 933 | 17.1 | 52.8 | 8.4 |
| 38 | B3 | red | 3175 | 654 | 17.4 | 40.0 | 11.4 |
| 38 | B4 | black | 2476 | 1383 | 6.4 | 55.3 | 38.9 |
| 7 | B1 | green | 4944 | 1025 | 17.3 | 28.6 | 1.6 |
| 7 | B2 | blue | 3457 | 749 | 16.6 | 30.8 | 7.8 |
| 7 | B3 | red | 2781 | 636 | 15.7 | 38.6 | 11.6 |
| 7 | B4 | blue | 7923 | 1497 | 19.0 | 31.6 | 7.2 |
| 7 | B6 | black | 3899 | 887 | 15.8 | 66.5 | 10.0 |

**Still open (the bot, not the bike):**

- **It falls far more often than a real rider.** Most of its falls are its body put on the ground off a narrow tread's edge, or lowsides. They come where:
  - rock gardens of half-metre boulders lie across the line, since it rides one centre line with no line choice through the rocks;
  - steep, tight switchbacks run on treads a metre wide;
  - a table is built into a bend.
- **Its mean speed is low.** It averages 16–19 km/h, under eval 13's 25–33 km/h; the parks' trails are longer, narrower and twistier than that profile.

## As drawn, heard and played

Part C2 puts the engine's bike in the player's hands on a summer free ride.

- **The start.** BIKE is the summer START row's first stop and its default (`free-ride.ts`'s `BIKE_RUN`, `SUMMER_STARTS`); `?bike=1` asks for it on a link, and a summer link that names no start gets it. The spot tapped on the start card's chart picks the trail: the ride begins at the trail head nearest it (`nearestBikeHead`). A snowboard picked on the gear card is swapped for skis under a bike ride, since the board's figure has no seated or riding pose.
- **The bike as drawn** (`bike-look.ts`, three-free; `bike-view.ts`). A code-built PLACEHOLDER that reads as a downhill bike at chase range: a long, low frame, a dual-crown fork, a single-pivot swingarm with a coil shock in the front triangle, a wide flat bar, flat pedals, big rotors and two knobbly wheels. Its places are decided off the engine's own geometry (`BIKE`, `bike-geometry.ts`): the front axle is `bikeFrontAxleAt`; the rear swings on an arc through the engine's straight path, within two centimetres of it at full travel. A modelled bike is to be built later by a separate lab; the drawing is keyed on NAMED NODES so a model can take its place:
  - `bike_frame` — rigid, its origin the bottom bracket;
  - `bike_bars` — the steered side (crowns, stanchions, stem, bar, grips), its origin on the steer axis (`STEER_AT`), turned about `STEER_AXIS` by `BikePose.steer`;
  - `bike_fork` — the lowers, a child of the bars, slid up the steer axis by `BikePose.fork`;
  - `bike_wheel_f` — a child of the fork at the extended front axle, turned about +x by `frontSpin`;
  - `bike_swingarm` — its origin the main pivot, turned about +x by `swingAt(BikePose.shock)`;
  - `bike_wheel_r` — a child of the swingarm at the extended rear axle, turned by `rearSpin`;
  - `bike_shock` — its origin the front eye, its +z aimed at the rear eye and stretched to the eyes' length (`shockAt`);
  - `bike_cranks` — about +x through the bottom bracket by `crank`, with `bike_pedal_l` and `bike_pedal_r` at the arms' ends, kept level. Coasting, the cranks come round LEVEL (left foot leading), and in a hard flat turn the outside pedal drops toward the bottom (`BIKE.coast`, `coastCrank`), as a rider stands on the outside foot; nothing physical reads the crank.

  The frame is the engine's body frame (x the engine's right, y up, z forward, metres) with its origin at the bottom bracket, carried onto the bike's centre of mass by `BIKE_BB`. The drive side stands on −x.
- **The rider on it** (`skier-bike.ts`). His dressed figure is laid on the bike with the keys a body off its skis is laid with (`party-pose.ts`, `ragdollPose`): his hands round the grips (`gripsAt`), the balls of his feet on the pedals (`pedalsAt`), his hips back and his trunk bent in the ATTACK STANCE, moved where the engine's rider body moves — back, down for a pop, across into a turn — his trunk nearer upright than the bike he lays over. The stance follows the downhill coaching: knees about 60° and elbows about 70° bent and out, the legs never locked (a pedal carried further than 94% of the leg off the hip brings his hips down along the line to it), and the head raised so his eyes are on the trail ahead rather than the front wheel. His body is HELD BETWEEN STEPS (`holdRider`): the engine's crouch, shift, roll and steer each come on through a critically damped spring, so a pop's crouch, which the engine hands over as a step, folds him over a few frames; and his head is kept near level in the world, the neck taking most of the bike's quick pitch in the air. Getting back on is a MOUNT stepped over 0.6 s (`mountKey`): the body blends from the walking key to the riding one, the hands reach the grips, the near foot finds its pedal and the far leg swings over the saddle, his knees and elbows let out as he comes over the frame. In the freeride look the animator (`bike-anim.ts`) carries his body in place of `holdRider`; the mount and the walk are the same for both looks. His skis and poles are put away (`setBiking`). Off it he walks PUSHING IT (a gait with a smooth foot path: the heel rising and the knees soft through the whole stride, `gaitKey`) (`walkingPose`): the bike rolls at his left hand, a little ahead of him (`BIKE.walk.push`), his near hand on its grip, his trunk turned to it and leant over the push; on a lift he is seated as a skier is; thrown, he is the skier's ragdoll and the bike lies loose on its side where it stopped.
- **On a lift.** On a chair the bike hangs off the back of his chair by its front wheel (`LIFT_HOOK`), in a gondola it is out of sight, and in the queue it stands beside him on its wheels.
- **The lens** (`camera-bike.ts`'s `BIKE_RIGS`). While he rides, the ladder is framed off the bike, not his body: TIPS a wide bar-cam on the stem's cap, 0.2 m behind the bar's middle and 0.1 m over it, the bar and both grips across the foot of the frame (on a screen on its side; a portrait phone keeps the bar's middle), HELMET his own eyes over the bars, CHASE a close chase a few metres behind and just over his helmet (the rung a ride starts on), FAR, HIGH and ORBIT further out. Off it, the skier's own ladder.
- **The HUD** (`bike-hud.ts`, DOM-free; `hud-bike.tsx`; words in `strings-bike.ts`). Top centre, in the air clock's place: the trail's grade mark and the name on its head's sign, how far is left of it, and his falls this ride. Off it on foot, the call back to it and how far; stood beside it, the machine press. A landing's verdict and a crash's cause are the news line's (`run-news.ts`). Touch is the skier's own thumbs: the lever's full throw is the pedals, dragged down the brakes.
- **The sound** (`audio/bike-voice.ts`, `bike-bed.ts`, `bike-bank.ts`). Seven layers that never stop while he rides: the tyres' roar in a band set by the summer ground under them (`summerGroundAt`: a hum on tarmac, a hush on grass, a crunch on gravel and scree, a rattle on rock and roots), the knobs' buzz on hard ground, the grit thrown, the FREEHUB ticking at 54 points a turn while he coasts and silent under the pedals, the chain slapping as the ground works the rear, a locked or sliding tyre's skid, and the rotors' squeal under a hard pull at a trot. One-shots on the `bike` event: getting on and off, the bike picked up, hooked on a chair, a landing's thunk on the suspension (bottoming out past 3 g, cased or flat) and the crash. On the bike the snow bed is silent.
- **The lab** — `make bike` (`scripts/bike-preview.mjs`, `pwa/src/tools/bike-harness.ts`): the bot down a trail through the game's own renderer, photographed on every rung of the ladder, close beside and ahead of him, in the air, thrown with the bike loose, ridden into a trunk beside the trail (`tree`), afoot pushing it (`afoot`, and `push` from beside him), rolled into the map's first chair's load zone at a walking pace (`queue`) and up the lift. `tests/bike_look_test.ts` holds the drawing's geometry to the engine's, the rider's reach, the lens and the HUD; `tests/bike_audio_test.ts` the voice.

### The freeride look

A second look for the bike and its rider, a candidate of the bike eval lab, swapped in with `?bikelook=freeride` (or `VITE_BIKE_LOOK=freeride`; `bike-variant.ts`) and never stored. Presentation only: the engine, its digests and the physics are untouched.

- **The bike** (`bike-freeride.ts`). A big-mountain FREERIDE bike built in code on the same named nodes (`BIKE_NODES`, posed by `poseBike`), drawn off the same geometry (`bike-look.ts`): a mixed-wheel build (29-inch front, 27.5-inch rear, as `BIKE`), a long, slack frame with an oval down tube and gusseted head, a single-crown 180 mm fork with a lock-on riser bar, a boxed swingarm driving a coil shock, a chain guide, flat pedals with pins, fat knobbly tyres on wide rims with 2-cross spokes and slotted rotors. Painted teal and black with orange accents (`FREERIDE_PAINT`).
- **The style** (`bike-ride-style.ts`'s `rideStyleOf`, a pure function of the engine's bike, its map and the clock). What a freerider does that the physics never asks for: off a jump with a flight of 0.4 s or more a WHIP (the bike turned 50–60° and laid 55° over under him, `RIDE_STYLE.whip`) or a TABLE (laid flat with little yaw), dealt off the take-off moment, thrown over the flight's first part and unwound before the ground; in a sliding lean on the ground the inside FOOT OUT forward over the dirt; under the levers his weight further back and down. The bike as drawn is turned about the rider's centre of mass (`bike-view.ts`), his hands and feet go round with it and his hips follow a share (`skier-bike.ts`'s `freerideKey`, `underHim`); the lens follows the engine's unturned bike.
- **The stance.** The attack stance ridden wider and lower: knees and elbows out (`party-pose.ts`'s `Key.kneesOut` and `.elbowsOut`), hips back and down, chest over the stem (`FREERIDE`).
- **The kit** (`outfit.ts`' `rideKit` and `RIDE_KIT`, `dress-bike.ts`). His own body, build and gloves, the rest a freerider's: a loose long-sleeved jersey (the race shell's panels, cut as `JERSEY`), baggy shorts to just past the knee over long KNEE PADS with ribbed caps, long striped socks, flat-pedal shoes on gum soles, and a FULL-FACE helmet with a chin bar and goggles; no poles.
- **The lab.** `make bike ARGS="--look=freeride"` adds the views `closeup`, `whip`, `table`, `footout` and `brake` (the last four ridden by the bot until the style shows the moment); `tests/bike_freeride_test.ts` holds the nodes, the style and the kit.

## Against the world: collisions and crashes

Part F set the bike against everything a summer mountain stands in its way. It is measured by `make bike-hit` (`scripts/bike-hit-lab.mjs` over `tests/support/bike-hits.ts`, held by `tests/bike_hit_test.ts`).

**What it meets** (`bike-solids.ts`):
- **The frame.** Its plan is a capsule 2.1 m long and 0.3 m across, pushed out of every trunk, lift tower, mast, gun, a building's wall posts and a street lamp (`solidsOf`). The closing speed into one past `crash.hit` (3.5 m/s) throws him (`hit`).
- **The bar ends.** The bar is 0.8 m wide, and each end is read beside the line. An end hooked 2 cm or more into a solid snatches the bar: the bike's way is cut to 55% and it is yawed and steered toward that side. Past `crash.hit` it throws him; under it, he is turned off the trunk and rides on.
- **A bike thrown** against a solid lies against it, its way into it gone.
- **A parked or moving car** is the village traffic's own (`trafficStrike`): knocked down, it is the `car` crash cause. The bike park's level is a copy of the map it was laid on, so the village is read off the base map (`villageOf`). Before, a summer bike ride had no village to meet.
- **Not modelled.** A rock garden's rocks are the trail's ground, never solids. The race line's tape and its stakes are drawn only. Water is a surface (Crr 0.5), never deep.

**The sweep** (seed 38 in midsummer; the trunk rows on a 4% meadow). "Before" is the engine as Part C left it:

| Meeting | Thrown | Peak g (part) | ISS | What came of it | Before |
| --- | --- | --- | --- | --- | --- |
| 30 cm trunk head-on, 10 km/h | no | 11 (shoulder) | 0 | stopped against it | same |
| 30 cm trunk head-on, 20 km/h | over the bars | 67 (head) | 8 | broken collarbone, neck sprain, thumb ligament | same |
| 30 cm trunk head-on, 35 km/h | over the bars | 251 (head) | 43 | skull, neck, ribs and pelvis broken | same |
| bar end clips the trunk, 10 km/h | no | 0 | 0 | turned off it, rides on | passed through |
| bar end clips the trunk, 20 km/h | thrown | 55 (shoulder) | 4 | broken collarbone | passed through |
| bar end clips the trunk, 35 km/h | thrown | 178 (shoulder) | 22 | collarbone, arm, lung | passed through |
| a trunk beside a trail, 25 km/h | over the bars | 187 (head) | 33 | lies against it, stood up clear | bike pinned |
| a black's rock garden, the bot's line | lowside | 27 | 1 | — | down |
| the same coasted in at 25 km/h | lowside | 62 (head) | 6 | concussion | same |
| a lift tower, 25 km/h | over the bars | 187 (head) | 33 | stood up clear | same |
| a mast, 25 km/h | over the bars | 150 (head) | 33 | — | same |
| a building's wall, 20 km/h | over the bars | 95 (head) | 29 | — | no village found |
| a parked car's side, 20 km/h | `car` | 30 (shoulder) | 1 | bruises, a sprained wrist | no traffic |
| the race line's taped edge, 30 km/h | no | 0 | 0 | 24 m clean | — |
| into a bench's cut, or off its fill, 15 km/h | no | 0 | 0 | stopped on the bank | same |
| across a 32–39° meadow, 15 km/h | down | 5 | 0 | slid out | same |
| into a pond, 20 km/h | no | 0 | 0 | stopped 3 m in | same |

No row has the bike or the rider standing inside a solid, and every restart stands clear.

**Against the research** (*Crashes and injuries* above). Over all the throws the injuries fall:

| Region | Throws | Lift-served parks |
| --- | --- | --- |
| Arm, wrist and hand | 29% | 26% |
| Shoulder and collarbone | 23% | 34% |
| Trunk | 16% | — |
| Leg and knee | 12% | — |
| Head and face | 11% | 17% |
| Neck and spine | 10% | — |

The broken collarbone is the commonest single break, as the cohorts have it. Riders go over the bars into anything square from about 20 km/h.

**The chair that never boarded.** On seed 38 a bike rolled into the first chair's load zone ran 133 m past it, for two reasons:
1. The staging moved the bike's `x` and `z` and not its height, so the bike fell from the trail head's height. A bike is stood with `placeBike`.
2. At a walking pace the balance steering, whose gain grows as 1/v², flopped the bars to lock. At a crawl the rider's knees and a dabbed foot hold it up, so the hands hold the bars to the turn asked (`bike-body.ts`'s `crawlHeld`). Once it is laid over past 0.3 rad (`hands.crawlLean`) the hands steer it up again, or a slow, steep traverse falls into its own turn. That traverse is the black on seed 38 where the bot once fell 171 times on one spot.

Every chair and gondola on seeds 38 and 7 now boards, rolled in at 1.5 m/s from 8 m short of its zone (`tests/bike_ride_test.ts`).

**Afoot**, the machine press steps him off on the bike's right. He walks pushing it at his left hand, 0.55 m across and 0.25 m ahead (`BIKE.walk.push`). It rolls with him, is pushed off solids and turns with him. The press puts him back on it, rolling at the pace he walked. Taken by a lift or thrown, he lets go of it.

**In the crash cams.** With INJURIES on, a bike's blow is read ahead by the X-ray cam's forecast like any other. The trunk at 35 km/h is forecast fatal 0.57 s out, a `trauma` death that the X-ray and death cams take. The restart word names the bike: "A NEW RIDER ON THE BIKE AT THE TRAIL'S HEAD" (`free-ride.ts`'s `againAt`, `"trail"`). The news line says OFF THE BIKE!.

**Still open:**
- **Neck and spine are too often hurt.** Head-first into a trunk, tower or mast at 25 km/h is an AIS-5 broken neck in the lab's dealt rows. The cohorts name no such share. The ladder is the body's (`defs/anatomy.ts`), shared with skiing, and is left as it is.
- **The rocks and roots are ground.** A wheel is stopped by their height, never by their face, so a rock garden is ridden up rather than struck.
- **The tape and its stakes** are drawn only; the line can be ridden through.
- **Water is a sticky surface.** A pond stops the bike within a few metres; nobody sinks in it.
- **The thrown body slides on grass** as on the groomer (μ 0.45), near a body's on grass and under its on dirt (0.6–0.8).
- **The bot** still falls in rock gardens: a lowside on a black's garden on its own line.
- **The model.** The code's bike is a placeholder until the modelled bike and rider are built.
