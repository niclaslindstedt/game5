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
