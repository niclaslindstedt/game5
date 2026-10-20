# Gunfire

The army hunting a wanted skier ([`wanted.md`](wanted.md)) shoots at him, and all of it goes through one shared layer: the door gunners, the soldiers on skis, the snowmobile gunners, the riflemen on paramotors, the rocketeers in a balloon's basket and the tanks. **This page is that layer.** The shooters themselves are built on top of it, one at a time, and none of them fires any other way.

Nothing in it runs without a shooter. `GameState.gunfire` is absent until a gun is armed, so a run that never arms one moves no digest. Everything random-looking in it is drawn off a seeded stream of its own, `GunfireState.stream` (seeded off the run's seed), and never off `state.rng`.

| Piece | Where |
| --- | --- |
| The weapons' numbers, the hit tests' sizes, what a machine takes | `engine/game/defs/weapons.ts` (`WEAPONS`, `GUNFIRE`) |
| The wounds a round leaves, part by part | `engine/game/defs/wounds.ts` (`WOUNDS`, spread into `INJURIES`) |
| Arming, aiming, firing, flying the rounds, the hits | `engine/game/gunfire.ts` |
| THE BLAST LAYER: one burst at a point — the event, the machines it damages, the throw, the fragments and the tearing apart | `engine/game/blast.ts` (`blastAt`, `BlastSpec`) |
| The state and the event | `engine/game/gunfire-state.ts` (`GunfireState`, `Gun`, `Round`, `GunfireEvent`), `GameState.gunfire` |
| The body as a target (bone by bone, as capsules) | `engine/game/gunfire-body.ts` |
| The machines as targets, and what their damage does | `engine/game/gunfire-machine.ts` |
| The log the drawing reads | `engine/game/gunfire-log.ts` |
| As drawn | `pwa/src/game/gunfire-view.ts` (held by `machines.ts`) |
| As heard | `pwa/src/game/audio/gunfire-bank.ts`, `audio/route.ts` |
| The labs | `make gunfire` (`scripts/gunfire-preview.mjs`, `pwa/src/tools/gunfire-harness.ts`), `make gunfire-table` (`scripts/gunfire-table.mjs`) |
| The tests | `tests/gunfire_test.ts` |

## The weapons

Each row is a CLASS of weapon, never a model. Its numbers sit in the band the service weapons of that class share, restated from open references (field manuals' range tables, ammunition data sheets, marksmanship studies) in our own words. `defs/weapons.ts` carries the reasoning beside every number.

| Weapon | Round | Muzzle speed | Rate | Fired as | Effective |
| --- | --- | --- | --- | --- | --- |
| `rifle`, a 5.56 mm-class assault rifle | 4 g | 930 m/s (~650 at 300 m) | 800 a minute | 1–3 round bursts | 300–500 m |
| `lmg`, a 5.56 mm-class light machine gun, belt-fed, fired off a snowmobile's pillion | 4 g, a tracer every 4th | 915 m/s | 850 a minute | bursts of 3–6 | ~600 m |
| `doorGun`, a 7.62 mm-class general-purpose machine gun on a door mount | 9.5 g, a tracer every 4th | 840 m/s | 750 a minute | bursts of 6–9 | ~800 m |
| `heavyGun`, a 12.7 mm-class heavy machine gun on a vehicle | 43 g, a tracer every 5th | 890 m/s | 550 a minute | bursts of 5–7 | ~1.2–1.8 km |
| `rocket`, a shoulder-fired rocket launcher | 2.5 kg | thrown out at 115 m/s, its motor lit 11 m out and driving it to 290 m/s | one, 5–8 s to reload | — | a man to ~300 m |
| `tankGun`, a tank's main gun firing high explosive | 20 kg | 900 m/s | one, 6–10 s to reload | — | ~1.5 km |

**A round's flight.** A bullet is slowed by the air as v' = −k·v², so its speed falls with distance as v(x) = v₀·e^(−k·x). Each class's `k` is fitted to two points of its range table. Gravity pulls the round down the whole way. A rocket is thrown out of its tube, its motor lights a few metres out and pushes it along its way up to its top speed, and gravity bends that way as it goes. A shell is a heavy bullet with a small drag.

**The aim.** A burst is aimed once. The aim LEADS the target by its velocity over the round's time of flight (three passes, so the lead and the time agree), and holds over for the drop: a bullet's ½gt², or for a rocket, the elevation read off its own flight, `rocketSight` (the graduation a launcher's sight is marked in). A launcher at a man on his skis is laid on the snow at his feet, because a burst there does its work and one a metre over him flies on. The aim takes the machine he rides when he rides one. A round leaves with its shooter's way (a door gun in a circling helicopter), so the lead is taken on the target's way RELATIVE to the gun's, as an aerial gunner allows for his own speed; a shooter standing still leads on the target's alone.

**Where the rounds go.** Three spreads, each the standard deviation of an angle in mils (1 mil is 1 m at 1 km):

- `dispersion` is the weapon's own, drawn every round. A service rifle from a rest is about 0.4 mil; a machine gun's cone of fire is 2–3.
- `hold` is the shooter's aim, drawn once a burst. Range studies put a trained soldier at half his rounds on a man-sized target at 300 m on a range, and about a tenth in the field, which is a hold of about 2 mil.
- `climb` is the muzzle walking off the aim with each round of a burst, as the recoil lifts it.

He also misjudges the lead by `lead`, about a quarter, drawn once a burst.

## What a hit does

Every step, each round is flown along its path. The first thing that path crosses stops it:

- **The snow:** the crossing is found by halving the step. The event is `impact`, on `snow`.
- **A trunk or a post:** upright cylinders (`posts.ts`' `solidsNear`). The event is `impact`, on `trunk`, `steel` or `rock`.
- **The machine he rides** (helicopter, plane, snowmobile, balloon): capsules round its hull. A helicopter's or the plane's round through the CABIN reaches him `GUNFIRE.cabin` of the time (a wound to the parts a seated man shows); the rest of its energy goes into the machine.
- **His body:** each bone of the ragdoll's wire (`bodyThrown`, standing or thrown) is a capsule of a clothed limb's radius. The part struck is read off the bone and where along it the round crossed: the trunk's upper half is the chest, or the back from behind; its lower half is the abdomen; the top of an arm is the shoulder and the foot of a thigh is the knee. A round is tested against his body only when the rules are to aim at him, the run is lethal (below) and he is not sat in a cabin.

**A WOUND** is a penetrating injury on the part struck. Its dose is the round's kinetic energy there (½mv² at the speed it still has), read by `body.ts` against the `pierce` rungs of that part's ladder (`defs/wounds.ts`): a graze, a wound through the muscle, a bone broken, an organ hit, a great vessel opened. The rungs are set so that WHERE a round strikes decides the wound: any service round through the trunk is a serious wound (AIS 3) at once, and one carrying a rifle round's energy has an even chance of the severe one under it (the chest filling with blood). Through the head a round is critical (AIS 5). A spent round or a fragment's edge may only graze a limb. From there it is the body's machinery like any other blow (`pierceBody`): the injury score, the bleeding (`gore.ts`' `bleedsOf`, every penetrating wound OPEN), the hurt skiing (`hurt.ts`) and, with the INJURIES switch on, death. A run that dies of rounds dies `"shot"` (`DeathCause`); the card reads SHOT DEAD.

**A BURST** (a rocket or a shell going off where it struck) is the event `blast`. It goes off through the BLAST LAYER, `blastAt(state, stream, def, x, y, z, weapon, key, events)` in `engine/game/blast.ts`: one call for a burst at a point, whatever fired it, so a tank's shell and a rocket share it and a later weapon calls it the same way. Its numbers are the weapon's `BlastDef`, with the CRATER it leaves (`crater`: a bowl `radius` m across and `depth` m deep — a rocket's 0.9 by 0.3, a tank shell's 1.8 by 0.55), which the app presses into the snow:

- inside `kill` metres, with the INJURIES switch on, he is TORN APART: pieces are dealt off a hash with a chance that grows nearer the burst, and `gore.ts`' `sever` takes them, the trunk opened;
- inside `wound`, fragments strike him (a `pierce` dose falling with the distance);
- inside `throw`, the blast knocks him off his skis: the `blast` wipeout, thrown away from the burst at up to `shove` m/s;
- a machine within reach takes `GUNFIRE.machine.rocket` of what brings it down, at once.

**A MACHINE** keeps the energy its hull has taken (`GunfireState.damage`), against what brings it down (`GUNFIRE.machine`). Each stage is said once, as the event `machine` with its `stage`:

1. `smoke`, at 0.35: the machine trails smoke.
2. `fail`, at 0.6: its engine fails, its fault forced on. A helicopter's or the plane's engine coughs and runs down; a snowmobile's dies.
3. `lost`, at 1: a helicopter's gearbox seizes and its rotor runs down (`GUNFIRE.seize`), so it comes down and crashes through the helicopter's own crash (`heli.ts`, the wreck). A snowmobile's tank lights (the sled's own fire, with fires on). A balloon's envelope burns (a bullet's hole lets out next to nothing; a rocket's burst sets it alight).

A **supersonic round** that passes within `GUNFIRE.snap` m of him says `snap`: the crack of its shock wave going by.

## The rules of fire, and SAFE FOR WORK

A burst is fired under one of three rules: `hold` (not fired at all), `warn` or `aim`. They come off the wanted level's roster (`rosterOf(stars).fire`), or are given by the caller.

A run is LETHAL when the army is on him with `WantedState.lethal` (SAFE FOR WORK off), or, with no hunt, when SAFE FOR WORK is off. On a run that is not lethal, every `aim` becomes `warn`. **WARNING FIRE** is put down in the snow 6–14 m to a side of him or ahead, and none of it is ever tested against his body. A launcher's warning is its rocket at the machine he rides, and with no machine under him it does not fire at all. With SAFE FOR WORK on the army ARRESTS him rather than kill him (`wanted.ts`' `arrestSkier`). Nothing of a wound or a burst on his body is drawn without the INJURIES switch.

## The API

```ts
const gun = armGun(state, id, "doorGun", x, y, z); // a shooter's gun, at its muzzle
// ...the shooter moves it every step: gun.x/y/z, gun.vx/vy/vz
fireAt(state, gun, { kind: "quarry" });              // a burst at him (or what he rides); false if not fired
fireAt(state, gun, { kind: "point", x, y, z });      // at a point
disarmGun(state, id);
```

`stepGunfire(state, events)` runs inside `step` after the wanted level, only on a run that has armed a gun. It fires each burst's rounds at the cyclic rate, waits the pause (or the reload), flies every round and keeps the machines' damage. A gun is busy until its burst and its pause are over (`gunReady`), so a shooter may call `fireAt` every step. The ballistics are exported for the shooters and the labs: `flightTime`, `speedAt`, `energyAt`, `aimPoint`.

**The events** are one kind, `gunfire`, by `phase`: `shot` (the muzzle, its way, whether a tracer), `impact` (a round stopped by the snow, a trunk, steel or rock), `hit` (a round in him: the part, the joules), `snap`, `blast`, and `machine` (a stage of a machine's damage). The app hears them (`route.ts`) and draws them off the state's LOG (`GunfireState.log`, a ring of the last 96, each numbered), because the renderer is handed the state, not the events.

## As drawn

`gunfire-view.ts`, built the first time a run arms a gun:

- **The muzzle flash:** a white-yellow star for a frame or two, a fist's size on a rifle, a head's on a machine gun, a forearm's on the heavy gun, with a flame ahead of it along the bore and a wisp of smoke left hanging. After dark, its light on the snow.
- **Tracers:** a red-orange streak about twenty metres long (the eye's hold of a dot going by at 800 m/s) with a bright line at its heart. By day, the flash's and the tracer's hot cores are laid over the snow rather than added to it, or white on white they would not be seen.
- **The rocket:** its body, the motor's flame and a trail of white-grey smoke; the backblast's fan of dust and the snow thrown up behind the tube.
- **Strikes:** a puff of snow in the snow (the snow's own cloud), bark chips and snow shaken off a trunk, sparks off steel and rock.
- **A burst:** the game's explosion (`explosion.ts`), small and short (a tank's shell bigger). Its light is a blink beside a fuel tank's (`ExplosionLook.flash`), the snow round it is thrown up, the snow under it is scorched, and its crater is pressed into the trail map (a bowl with its rim thrown up round it).
- **A round in him:** a puff of red mist, only with the INJURIES switch on.

## As heard

`gunfire-bank.ts`, routed by `route.ts`:

- **A report** for each weapon (`gun_rifle`, `gun_mg`, `gun_heavy`, `rocket_launch`, `tank_gun`), heard from where it fired, far. Each is a white crack with no attack, a driven bark pitched by the calibre and a pink tail through the echo.
- **The crack of a round going by close** (`gun_snap`).
- **What a round strikes:** a soft puff into the snow (`gun_puff`), a woody knock into a trunk (`gun_wood`), a ringing ping off steel, rock or the skin of his machine (`gun_ping`), a dull thud into him (`gun_hit`).
- **A burst:** the helicopter's explosion, higher and shorter.

## The labs

`make gunfire-table` is pure Node and takes seconds. For every weapon at 50–800 m it prints the round's time of flight, the speed and energy it keeps and its drop. Then a stand-in shooter fires a burst at a skier crossing in front of him, `--trials` times off different seeds on a flat drag strip with the INJURIES switch on. The table gives the share of rounds and of bursts that hit him, the share that killed him, and the median miss (how near the rounds that missed came). `--up=40` fires from the air. Run it before and after any change to a weapon's numbers, the aim or the wounds (`--json` for the before).

A run of `make gunfire-table ARGS=--trials=20`, abridged (a skier crossing at 12 m/s, the shooter on the snow, the door gun 30 m up):

| Weapon | Range | Rounds hit | Bursts hit | Killed | Median miss |
| --- | --- | --- | --- | --- | --- |
| rifle | 100 m | 48% | 70% | 50% | 2.4 m |
| rifle | 300 m | 14% | 30% | 0% | 2.1 m |
| door gun | 100 m | 21% | 60% | 50% | 2.9 m |
| door gun | 400 m | 4% | 30% | 10% | 3.9 m |
| rocket | 100 m | 85% | 85% | 25% | 8.6 m |
| rocket | 300 m | 20% | 20% | 0% | 31 m |
| rocket from 40 m up | 300 m | 85% | 85% | 20% | 9.5 m |
| tank gun | 400 m | 60% | 60% | 20% | 25 m |

A rocket from the snow at a man at range mostly misses, as it does in life: at that grazing angle a few mils of error is tens of metres along the ground. From above, it is the weapon to fear.

`make gunfire` photographs it through the game's own renderer: a stand-in shooter (a point, no soldier drawn) by a skier on seed 38's piste, with the INJURIES switch on. The `day` sheet has the rifle's flash over the shooter's shoulder and its strikes; the door gun 130 m off in the air, its tracers from behind him and over the gun, the rounds coming in and their strikes; the rocket in flight over the shooter's shoulder, the burst and the smoke after. The `dusk` sheet is the same under the evening's sky (`--dusk=h`), and the `sfw` sheet is the warning fire. Every frame is captioned with the time since the first shot, the rounds, the hits and its cost.
