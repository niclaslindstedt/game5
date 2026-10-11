# The jump plane

A free ride can start in the open door of a jump plane. Pick **PLANE** on the start card's START row (the stop after the helicopter), or follow a `?start=free&plane=1` link. You stand on your skis in the sliding door of a single-turboprop utility plane parked on its own strip below the village, the rig of a sport skydiver on your back, the engine running — and the plane is yours to fly, by hand, nothing assisting. Climb as high as you like, loop it, roll it, and press **Enter** to jump out of the door ([the skydive](skydive.md) takes it from there). The pilot then flies it home and lands it.

The engine side is `engine/game/plane.ts` (the step: the flight, the skis on the snow, boarding, the jump, the crash and the restart), `plane-aero.ts` (the air on every surface), `plane-state.ts` (its state, controls and events), `plane-pilot.ts` (the bot's hands), `airstrip.ts` (where the strip lies), `airstrip-corridor.ts` (its approach and climb-out), `airstrip-site.ts` (its markers and buildings), `airstrip-solids.ts` (what a skier meets there), `defs/plane.ts` (`PLANE`, every number), `defs/plane-wreck.ts` (`PLANE_WRECK`, the fire) and `defs/air-bounds.ts` (`AIR_BOUNDS`, the edge every craft in the air shares). All of it is exported through `plane-api.ts`. The app side is `pwa/src/game/plane-view.ts` (the model posed, its lamps), `plane-standin.ts` (the code's stand-in), `plane-scene.ts` (hung on the rider's line, the crash lens, the wreck), `plane-cockpit*.ts` (the cockpit), `plane-shatter.ts` and `plane-wreck-view.ts` (the crash), `strip-*.ts` (the strip as drawn), `camera-plane.ts` (the ladder), `input-plane.ts` and `settings-plane-keys.ts` (the hands and the keys), `plane-hud.ts` / `hud-plane.tsx` (the strip on the HUD), `audio/plane-*.ts` (the sound) and `strings-plane.ts`.

## The machine

The class mountain drop zones and glacier operators fly: a single turboprop of about 410 kW (550 shp, flat-rated so it keeps its power high), a strut-braced constant-chord **high wing** of 15.87 m and 30.15 m² (aspect ratio 8.35), a long nose over the engine, a conventional tail, a tailwheel, **wheel-skis** on a 3 m track, a three-blade 2.56 m propeller at 2,200 rpm, and big **sliding cabin doors**, the jumpers' on the right. 11.0 m long; 2,450 kg working weight (empty about 1,290 kg, the pilot, the fuel for two lifts and a load of jumpers) plus the skier in the door; 200 kg of fuel in the wing tanks.

Every number and every point of the geometry is in `PLANE`, in the skier's frame (x right, y up, z forward, the origin the snow under the main skis with the fuselage held level). The Blender model is built off that table whole, never numbers of its own. The engine's right is the picture's mirror image (three.js's view from behind mirrors the map, as the helicopter's cockpit plan says), so the jump door — on the right as a pilot sees it — and the left seat are stated at the engine's −x and +x.

## The flight

A real six-degree-of-freedom rigid body at 120 Hz, nothing scripted. Every loop, roll, stall and spin comes out of the forces:

- **The wing** is four sections a side, each with its own angle of attack off the body's velocity and rotation. The lift slope is Helmbold's for the aspect ratio (4.96 a radian), cambered to zero lift at −0.052 rad, stalling 0.335 rad past it (C_Lmax ≈ 1.67 clean, ≈ 2.08 with full flap) into a flat plate's 1.05·sin 2α over 0.07 rad, its drag rising to 1.25·sin²α. The tip is washed out 2°, so the root stalls first; the inboard flaps shift their sections' zero lift and stall.
- **The tail and fin** are surfaces of their own, in the wing's downwash and in 0.6 of the propeller's slipstream; the fuselage, the gear and the struts are drag areas along the body's axes behind the CoG.
- **The engine and propeller**: thrust is the shaft power times the propeller's efficiency over the airspeed, capped by the static thrust off momentum theory (10.5 kN), the power following the lever with a turbine's 1.1 s spool. Its **torque** rolls the airframe and its **swirl** yaws the fin. The plane is **rigged** against both as a single is: the ailerons set a touch apart and the fin offset (`aero.rig`) so they cancel at 50 m/s on three-quarter power — slow on full power the left-turning pull comes back, about 30° of heading over a loop's top with no rudder.
- **The trim**: the tail's incidence trims it at 45 m/s on climb power with the stick centred, the trim a pilot winds in for the jump run and for aerobatics, which a held stick then pulls and pushes about.
- **On the snow** the main skis and the tail ski are springs and dampers (`PLANE.ground`) with a ski's friction along their run (0.07 packed, 0.18 loose) and much more across; the tail ski steers with the rudder; the brakes are a ski's claws and the propeller's reverse.

## The controls

The plane is flown on a key table of its own (`settings-plane-keys.ts`, rebound under OPTIONS ▸ KEYS ▸ PLANE): the helicopter's hands, so a pilot of one flies the other.

| Key | What it does |
| --- | --- |
| W S | The STICK fore and aft: forward the nose down, back the nose up. |
| A D | The STICK side to side: the ailerons. |
| Q E (or ← →) | The RUDDER pedals; on the snow they steer the tail ski. |
| ↑ ↓ (or Shift Z) | The POWER lever: it moves while held and stays where it is left. |
| F V | The FLAP lever down a notch, up a notch. |
| Space | The brakes on the snow. |
| Enter (a double tap) | Out of the door in the air (the jump); off it onto the snow when stopped. |

On touch the left thumb is the stick pad and the right the power and the rudder (the helicopter's `StickZone`s), with ▲ / ▼ for the flaps.

The player's hand (`input-plane.ts`'s `samplePlane`) is the honest stick a keyboard can give: a held key eases the stick over rather than snapping it, and its **reach** scales with the airspeed — less travel fast, full travel slow — so a held key is a pull, not a snap into the stall. The ailerons reach all the way up to 60 m/s and less with the speed past it, never under 0.6 of their throw. **The hand pulls to the buffet**: the back stick eases off while more than 8 % of the wing is stalled, pushed or pulled; back stick with full rudder is a deliberate spin entry and pulls through. So a key held back from 120 kt at full power flies a whole loop over the top at 50–60 kt, a held roll is an aileron roll of about 62°/s, and the hammerhead, inverted flight and a three-turn spin with its recovery are all there.

## The strip, the jump and the pilot

**The strip** (`airstrip.ts`'s `airstripOf`, cached) lies on the valley floor on the valley side of the village — below town — along the valley. It is 20 m wide and as long as the plane needs: its own measured take-off roll at the working weight with the skier aboard (225 m on a generated map's strip) times 1.5, plus a 60 m overrun — about 400 m. It is searched as a rectangle no steeper than 3 % along and 4 % across, no bump over 1.2 m off a straight line, clear of the streets, the buildings, the lifts, the runs, the pads and the trees by 14 m, and with its circuit inside `PLANE.pilot.edge` of the map's edge. Every bearing is tried and scored against an **obstacle-clearance surface** off each end (`airstrip-corridor.ts`: 900 m out, 45 m half-wide growing 12 % a metre, 40 m under the 6° glide path) checked against every lift rope (3 m clear, every 15 m) and the helipad; the landing is laid the clearer way.

**NOTHING ELSE AVOIDS THE STRIP.** The cabins, the village, the lifts and every other placement are dealt before it and never read it. Adding the strip to any keep-off list would move every map's digest, so the strip fits round the world, never the other way. The same holds for its site (`airstrip-site.ts`): the edge boards every 50 m 1.2 m outside the packed edge with a bough between each pair, a row of six threshold boards at each end, a hangar (22 × 15 m, its door 18 × 4.8 m — or a lean-to on a tight floor), a fuel shed, a hut and a windsock abeam the landing threshold. All of it is a pure function of the level, cached.

**What a skier meets there** (`airstrip-solids.ts`): the buildings, the mast and the parked or grounded plane (oriented boxes off `planePoint`) push him out and reflect his speed as a trunk does; a hard run is a wipeout. Free ride only, so no race moves.

**Boarding.** Stopped within 5 m of the parked plane's door at under 4 m/s, the machine press puts him aboard (`planeWithin`).

**The jump** is the machine press in the air (`jump()`): he leaves the door with the plane's velocity plus a push of 1.4 m/s out and 0.4 m/s up, and the plane's mode goes to `home`. Stopped on the snow, the same press steps him off.

**The pilot** (`plane-pilot.ts`): `planeInput` is the bot in the door — the take-off (the tail let fly at 15 m/s, lifted off at 28), the climb straight ahead to 60 m, a climbing circuit at 40 m/s, the jump run at 37 m/s with a quarter flap at 2,000 m over the summit (2,500–2,800 m over the snow under the door — 40–50 s of freefall, ten and a half minutes of climb). It never jumps by itself, so a pre-roll stays aboard. `homeControls` flies home after the jump: a stadium circuit on the side with more room, the final on a 6° path aimed 80 m short, the flare at 5 m and the rollout on the centre line; it holds its circuit over rope tops. It recovers a stall, reads the angle of attack ahead on the pitch rate and never pulls past a 57° bank. `planeHold(run, want)` is a steady hand for the labs and the suite.

## The airborne edge

**Every craft in the air** — the plane, the helicopter, the paramotor, the balloon, the skydiver on his body and under his canopy — is turned back from the map's edge by one rule (`collision.ts`'s `airBounds` / `airBoundsAt`, the numbers `AIR_BOUNDS`). Inside a band along the edge a **wind** blows it back in (16 m/s at the edge, growing as the square of the depth, and on past the edge), and its pilot's hand is turned toward the map's middle. Nothing is a wall. It fades in between 40 and 140 m over the snow, so a strip or a pad near the edge is never touched by it.

| Craft | Band, m |
| --- | --- |
| Plane | 900 — a turn's diameter at 50 m/s and a 30° bank |
| Helicopter | 160, plus 6 s × the speed carried outward |
| Paramotor | 120 |
| Balloon | 160 |
| Skydiver on his body | 320 |
| Canopy | 100 |

The plane's hand is full within about 60° of straight out, along the edge only past 60 % of the band, never when heading back in, only upright (fading out past 80° of roll or 52° of pitch), and it never weakens the player's own pull — so a loop near the edge is still the player's loop. The skier on his skis and every race keep `keepInBounds`, untouched. The wind tunnels, likewise, take a skier only within `TUNING.tunnel.roof` (8 m) of the snow, so a canopy flown over one is never caught.

## The crash

Into the snow too hard (a sink past 3.6 m/s, a leg pressed past 0.42 m, a sideways skid past 7 m/s), a wingtip, the nose, the belly, the tail or the propeller's disc into the snow, or a tree: `struck()` names what hit and `crash()` files a rich `PlaneWreck` — where, how fast, its attitude and rates, its power and fuel, and its **kind**: `nose`, `cart` (cartwheeled off a wingtip), `belly`, `spin` or `tree`. The skier in the door is flung clear by the blast (6 m/s out, 5 up; the `plane` crash cause) as the helicopter's rider is. Ten seconds later the ride begins again in the door on the strip.

**The fire** (`PLANE_WRECK`): the fuel burns in the air at 70 kg/h idle to 200 kg/h full. A share of it (0.3, ramped in from 14 m/s to all of it at 45 m/s, at least 6 kg) goes up as a fireball sized by the helicopter's law, D = 5.8·m^⅓; how open each kind tears the tanks (`torn`: nose and cartwheel 1, tree 0.9, spin 0.85, belly 0.35) sets the rest; the rest is a **pool fire** of 45 m² burning 0.04 kg/m²·s with Heskestad's flame height, slower in slush, smouldering 120 s. At 200 kg aboard and 50 m/s a nose-in throws a 22.7 m ball for 1.76 s and leaves a pool 3.7 m across burning 103 s under 10.6 m flames; a slow crash only whoomps.

**As drawn**: `plane-shatter.ts` cuts the model into its pieces (the door, the engine, the prop's blades in three pieces each, the tail, the wings in and out, the struts, the gear, the cabin in panels) and breaks them by the kind's plan — folded, torn, thrown or dropped, the blades bent back at idle and curled forward under power — the thrown pieces flown, bounced and slid to rest, the hulk laid into the snow. Its materials char in three heat sets over 14 s to soot, then ash. `plane-wreck-view.ts` lays the burst, the fireball, the pool fire licking up from its middle, the gouge, the smoke leaning with the wind and an orange flickering lamp, and outlives the restart until the fire is out. The crash lens (`camera-crash.ts`, shared with the helicopter) is cut to on the impact and planted well back, clear of trunks, out of where the ball went up and turned out of a low sun's glare.

## The look

**The model** (`make blender KIND=plane`, then `make models KIND=plane`; `scripts/blender/plane.py`, `plane_skin.py`, `plane_studio.py`, `kinds/plane.mjs`): the fuselage one traced skin with its windows, door, seams and livery laid in as fields, the cowling, intake, exhausts and spinner, a tapered wing with dihedral, struts and jury struts, the tail with its fillets, wheel-skis and a tail ski, a cabin inside, the jump step and handle, antennas and lamps. Nodes for the propeller, the elevator, the rudder, both ailerons and flaps and the door; LOD0 about 16.5k triangles, LOD1 about 7k; byte-stable. `VITE_MODEL_PLANE=0` builds the code's stand-in (`plane-standin.ts`) instead. `plane-view.ts` poses it: the propeller under the helicopter's smear disc (`rotor-disc.ts`), the surfaces off the controls, the door, the navigation lights, beacons and strobes, and a landing light after dark.

**The cockpit** (`plane-cockpit-plan.ts`, three-free, and its `-glass`, `-paint`, `-shroud`, `-parts` and `-pilot` builders): the left seat's eye over the long nose, a glareshield, two live glass displays (the flight display and the engine page with a dotted terrain map) painted off `planeGaugesOf`, the standbys and warning lights, the sticks, pedals, power lever, flap lever and trim wheel moved by the controls, the overhead, the compass, and the pilot posed onto them by IK, seen through the glass from outside. Its lettering is backlit after dark. `plane-scene.ts`'s `seen(eye)` decides inside off the settled eye, keeps the falling snow out and shows the cockpit within 60 m.

**The cameras** (`camera-plane.ts`, three-free):

| Rung | Aboard the plane |
| --- | --- |
| TIPS | THE COCKPIT: the pilot's eye bolted at `PLANE.pilotEye`, rolled with the airframe, looking down and turned into a turn — the airframe's own lens, as the helicopter's TIPS is its nose lens. |
| HELMET | HIS OWN EYES IN THE DOOR, looking out — the same eyes the skydive gives HELMET once he jumps; his figure is hidden on this rung. |
| CHASE, FAR | Behind the airframe, rolled with it and offset to the door's side. |
| HIGH, ORBIT | Over and round the airframe. |

A change of rung is flown round the airframe, at least 10 m from its middle; every boom is kept 2.5 m over the snow; on a tall screen the field of view opens until the span fits.

**The strip as drawn** (`strip-ground.ts`, `strip-build.ts`, `strip-view.ts`): the runway and apron packed and combed into the ground's own textures with windrows broken at the apron, dyed threshold bars, the boards and boughs, the hangar (clad, an orange band, four door leaves, one ajar on a dark hall), the fuel shed with its drums and pump, the hut with its stovepipe, the windsock posed off the wind (full at 15 kt), edge lamps after dark (white along, green at the ends) and the hangar's floods. The minimap and the start card's chart bake the runway grey with its roofs.

**The HUD** (`plane-hud.ts`, `hud-plane.tsx`): a horizon, the airspeed in knots, the height over the snow with the climb and the altitude, the power, the flaps, the load past 2.2 g, a stall chip and the next press. The skier's own speed, edge bar and wind meter are put away.

**The sound** (`audio/plane-voice.ts`, `plane-bed.ts`, `plane-bank.ts`): sixteen layers over the one instrument — the propeller's tones at the blade-passage rate (110 Hz at full rpm) and its harmonics, the rasp as the tips near Mach 0.9 on the take-off, the swish, the turbine's whine leading on the start, the exhaust, the slipstream through the open door (a third as loud in the cockpit as in the door — the listener's `doorway` column), the skis' rumble and hiss, the stall horn, the flap motor and the wreck's fire, heard at its own distance until it is out. One-shots for boarding and the start, the lift-off, the landing, the stall's buffet, the jump, stepping off and the crash.

## Determinism

Nothing in the plane, the strip or the wreck draws from `state.rng`. The plane is an option of a free ride (`CreateGameOptions.plane`, `GameState.plane`), never a `RunRule`, so no race and no `make sim` digest can see it.

## Measuring it

- `make plane-flight` (pure Node, seconds): the class's numbers off the engine, each beside its band — the take-off roll (219.6 m on the flat, 200–300), the climb (6.2 m/s), the top speed low (113.9 kt) and high (122.0 kt at 2,500 m, 115–125), the stall clean (53.6 kt, 52–58) and with flaps (49.4 kt) and its recovery, a loop, the roll rate (61.5°/s), the glide (9.8), the map's edge turned back with 115.6 m to spare — and the **aerobatic rows** flown on the player's own hand (`samplePlane`): `p-loop` on the flat and over seed 38's strip low and high (360° each), `p-aroll` (7.7 s), `p-barrel`, `p-hammer` (≈180° reversal), `p-invert` (10 s on its back) and `p-spin` (three turns and the recovery). `SEED=` flies the roll on a map's own strip; `ARGS=--json=FILE` before a change and `--compare=FILE` after.
- `make plane` (browser, its own bundle from `pwa/plane-preview.html`): one contact sheet a group in `previews/plane-<group>.png` — `model` (parked from eight sides, by day and after dark), `strip` (the take-off roll and lift-off), `flight` (on the pilot's hands from six sides, the surfaces held over), `door` (the skier crouched in the door), `lenses` (every rung aloft), `cockpit` (the eye on the strip, climbing, banked, over a loop's top and at night; the panel, the displays, the quadrant, the overhead, the pedals, the controls thrown, the pilot from outside), `crash` (the fireball and the wreck burning on at 5, 30 and 90 s, day and night), `crash-kinds` (each kind frame by frame through the crash's lens; `--cols=4`) and `airstrip` (the strip from the approach, overhead and the village, down the runway, the apron, the buildings and the sock, day and night; `--face=<id>` on a real face). `ARGS=--sheet=model,door` a few; `SEED=` / `REGION=` another map.
- `make build`, then `make screenshots ARGS="--surface plane-strip,plane,plane-door"` (`--timeout 150` on a cold browser).
- The suite: `tests/plane_test.ts`, `input_plane_test.ts`, `airstrip_test.ts`, `air_bounds_test.ts`, `camera_plane_test.ts`, `plane_cockpit_test.ts`, `plane_hud_test.ts`, `plane_card_test.ts`, `plane_wreck_test.ts`, `plane_audio_test.ts`, `facade_test.ts` and `minimap_test.ts`.

## Known gaps

- The spin is steep and fast — airspeed builds to about 130 kt at an angle of attack near 20°, more a spiral than a flat spin; honest for a spin-resistant utility single, but a real developed spin is near 60 kt.
- A barrel roll on a naive held stick comes out nose-low; a pilot modulates it.
- The 900 m plane band covers most strips; the strip's own approach is under the bounds' fade height.
- Seed 3 keeps a little corridor intrusion (no clear room on that valley floor).
- The loose skis, the crowd, the civilians and the other machines do not meet the strip's solids; only the skier and his ragdoll do.
- The cockpit's coaming is flat-shaded low poly.
- The crash lens's planted shots on a nose-in still show the sky's blue in the shadows.
