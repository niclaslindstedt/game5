// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S WEAPONS (`gunfire.ts`): what each one fires, how fast, how
// often, how far it carries and how wide it throws — the numbers every
// shooter the army sends fires through (the door gunners, the soldiers on
// skis, the snowmobile gunners, the riflemen on paramotors, the rocketeers
// in a balloon's basket, the tanks). No weapon here is any maker's: each
// row is a CLASS, and its numbers are the band the service weapons of that
// class sit in, restated from the open references (the field manuals'
// tables, the ammunition data sheets, the marksmanship studies) in our own
// words.
//
// THE ROUND'S FLIGHT. A bullet leaves at its muzzle speed and is slowed by
// the air as v' = −k·v², so its speed falls off with the distance flown as
// v(x) = v₀·e^(−k·x); `k` is fitted to two points of each class's range
// table (the speed it still carries at its effective range). Gravity
// pulls it down the whole way (the shooter aims up for it). A rocket is
// pushed off the launcher at its eject speed, its motor lights a few
// metres out and drives it up to its top speed, and it carries on under
// gravity and a lighter drag.
//
// WHERE THE ROUNDS GO. Three spreads, each the standard deviation of an
// angle in MILS (a thousandth of the distance — 1 mil is 1 m at 1 km):
//   - `dispersion`: the weapon and its ammunition fired from a rest — a
//     service rifle with ball ammunition groups in 2–4 minutes of angle
//     (0.6–1.2 mil across, ~0.4 mil a standard deviation); a machine gun's
//     cone of fire on its mount is wider (2–3 mil);
//   - `hold`: the shooter's own aim, drawn once a BURST — the sight on the
//     target wanders with his breath, his heart, the ground or the machine
//     under him, and the stress of being in a fight. Range studies put a
//     trained soldier at half his rounds on a man-sized target at 300 m on
//     a range and about a tenth in the field, which is a hold of ~2 mil;
//   - `climb`: what each round of a burst adds to the muzzle's walk off
//     the aim (the recoil lifting it), so the third round of a rifle's
//     burst lands well over the first and a door gun's long burst wanders;
//   and `lead`: the share of the lead he gets wrong, drawn once a burst —
//   a man judging a target's crossing speed misjudges it by a quarter or so.
//
// WHAT A ROUND CARRIES INTO WHAT IT HITS is its kinetic energy, ½mv², at the
// speed it still has there: what `body.ts`' `pierce` ladders read.

/** The weapons there are. */
export type WeaponKind = "rifle" | "lmg" | "doorGun" | "heavyGun" | "rocket" | "tankGun";

/** A GUN that fires bullets. */
export type GunDef = {
  kind: "gun";
  /** The bullet: its mass, kg, its speed leaving the muzzle, m/s, and its
   * drag constant, 1/m (v(x) = v₀·e^(−k·x)). */
  mass: number;
  muzzle: number;
  drag: number;
  /** The cyclic rate, rounds a minute: how fast it fires inside a burst. */
  rpm: number;
  /** A burst's rounds, fewest and most (one is a single aimed shot), and
   * the pause between bursts, s (fewest, most) — the aim taken again. */
  burst: readonly [number, number];
  pause: readonly [number, number];
  /** Every `tracer`th round of the belt glows (0: none in it). */
  tracer: number;
  /** The range it is aimed at a man out to, m (its effective range against
   * a point target), and the farthest a round is followed, m. */
  range: number;
  reach: number;
  /** The spreads, mil (1σ) — see the header — and the lead's share. */
  dispersion: number;
  hold: number;
  climb: number;
  lead: number;
};

/** A LAUNCHER that fires a rocket or a shell that bursts. */
export type BlastDef = {
  kind: "blast";
  /** The projectile's mass, kg; its speed leaving the tube, m/s; the
   * metres it flies before its motor lights (0: a shell, no motor); the
   * speed the motor drives it to, m/s, at `push` m/s²; its drag
   * constant, 1/m. */
  mass: number;
  muzzle: number;
  light: number;
  top: number;
  push: number;
  drag: number;
  /** Whether it trails smoke the whole way (a rocket does). */
  smoke: boolean;
  /** Seconds between shots (the reload), fewest and most. */
  reload: readonly [number, number];
  /** The range it is aimed at a man out to, and the farthest it flies, m. */
  range: number;
  reach: number;
  /** The spreads, mil (1σ), and the lead's share. */
  dispersion: number;
  hold: number;
  lead: number;
  /** THE BURST, m: within `kill` of it a man is torn apart (the blast and
   * the fragments at their densest), within `wound` the fragments still
   * strike him, and within `throw` its blast knocks him off his feet. The
   * fragments' energy at a part, J, at the burst's edge of `kill`. */
  kill: number;
  wound: number;
  throw: number;
  /** The blast's push on a body at the burst, m/s, falling off as 1/d
   * to nothing at `throw`. */
  shove: number;
  frag: number;
  /** THE BACKBLAST behind the launcher: its depth, m, and its half angle,
   * rad. Nothing in it is hurt by this part — the drawing's flash and
   * dust. 0 for a gun. */
  backblast: number;
  cone: number;
  /** THE CRATER it leaves in the snow, m: its radius and its depth at the
   * middle — what the drawing presses into the snow where it burst. A
   * burst on snow throws the snow out rather than the ground under it: a
   * shoulder rocket's warhead leaves a bowl a metre or two across, a tank's
   * high-explosive shell one three or four metres across and some half a
   * metre deep. */
  crater: { radius: number; depth: number };
};

export type WeaponDef = GunDef | BlastDef;

/** THE WEAPONS. */
export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  // A SERVICE ASSAULT RIFLE, 5.56 mm class: a 4 g bullet at 920–950 m/s,
  // still ~650 m/s at 300 m and ~510 at 500 (k fitted there); 700–950
  // rounds a minute cyclic, fired in short bursts or single shots;
  // effective against a man to 300–500 m. Ball ammunition groups in 2–4
  // MOA; a man aiming off his feet at a moving target holds ~2 mil, and
  // the rifle's muzzle climbs 3–4 mil a round of a burst fired off the
  // shoulder.
  rifle: {
    kind: "gun",
    mass: 0.004,
    muzzle: 930,
    drag: 0.00123,
    rpm: 800,
    burst: [1, 3],
    pause: [0.6, 1.4],
    tracer: 0,
    range: 400,
    reach: 900,
    dispersion: 0.4,
    hold: 2,
    climb: 3.5,
    lead: 0.25,
  },
  // A LIGHT MACHINE GUN, 5.56 mm class: a section's belt-fed automatic
  // weapon, the rifle's 4 g round; 700–1000 rounds a minute, fired in
  // bursts of three to six; a tracer every 4th or 5th round of the belt;
  // effective against a man to ~600 m off its bipod. Its cone of fire is
  // ~2 mil. Fired off a sling from the pillion of a halted snowmobile —
  // no bipod, the seat rocking on the idling engine and the soft snow, a
  // man at the end of a fast ride — the gunner holds ~5 mil, twice a
  // rifleman stood on his skis, and the heavier gun climbs ~1.5 mil a
  // round.
  lmg: {
    kind: "gun",
    mass: 0.004,
    muzzle: 915,
    drag: 0.00123,
    rpm: 850,
    burst: [3, 6],
    pause: [0.8, 1.6],
    tracer: 4,
    range: 600,
    reach: 1000,
    dispersion: 2,
    hold: 5,
    climb: 1.5,
    lead: 0.3,
  },
  // A DOOR-MOUNTED GENERAL-PURPOSE MACHINE GUN, 7.62 mm class: a 9.5 g
  // bullet at ~840 m/s, ~600 m/s at 500 m; 650–950 rounds a minute,
  // fired in bursts of six to nine; a tracer every 4th or 5th round of the
  // belt; effective to ~800 m on its mount. Its cone of fire is ~2.5 mil,
  // and the gunner's hold on a pintle in a moving helicopter ~3 mil.
  doorGun: {
    kind: "gun",
    mass: 0.0095,
    muzzle: 840,
    drag: 0.00067,
    rpm: 750,
    burst: [6, 9],
    pause: [0.8, 1.8],
    tracer: 4,
    range: 800,
    reach: 1600,
    dispersion: 2.5,
    hold: 3,
    climb: 0.6,
    lead: 0.25,
  },
  // A HEAVY MACHINE GUN on a vehicle or a tank's turret, 12.7 mm class: a
  // 43 g bullet at ~890 m/s, ~650 m/s at 1 km; 450–600 rounds a minute,
  // bursts of five to seven; a tracer every 5th; effective to ~1.8 km. On
  // its cradle it throws ~1.5 mil, the gunner's hold on a moving vehicle
  // ~2.5.
  heavyGun: {
    kind: "gun",
    mass: 0.043,
    muzzle: 890,
    drag: 0.00031,
    rpm: 550,
    burst: [5, 7],
    pause: [1, 2],
    tracer: 5,
    range: 1200,
    reach: 2400,
    dispersion: 1.5,
    hold: 2.5,
    climb: 0.4,
    lead: 0.2,
  },
  // A SHOULDER-FIRED ROCKET LAUNCHER: a ~2.5 kg rocket thrown out of the
  // tube at ~115 m/s by its launch charge, its motor lighting ~10 m out and
  // driving it to ~290 m/s, so 300 m takes it about a second and a half; a
  // man is aimed at to ~300 m, a vehicle further. Its fragmenting warhead
  // kills inside ~5 m and wounds out to ~15–20; the blast knocks a man
  // down nearer than that. Behind the tube a cone of flame and gas about
  // 30 m deep (the backblast's danger area), some 45° each side. A rocket
  // is unguided and weathercocks into a cross wind: ~3 mil of its own
  // spread, and a man's hold on a tube on his shoulder ~2.5.
  rocket: {
    kind: "blast",
    mass: 2.5,
    muzzle: 115,
    light: 11,
    top: 290,
    push: 260,
    drag: 0.0006,
    smoke: true,
    reload: [5, 8],
    range: 300,
    reach: 900,
    dispersion: 3,
    hold: 2.5,
    lead: 0.3,
    kill: 4,
    wound: 16,
    throw: 12,
    shove: 18,
    frag: 900,
    backblast: 30,
    cone: Math.PI / 4,
    crater: { radius: 0.9, depth: 0.3 },
  },
  // A TANK'S MAIN GUN firing a HIGH-EXPLOSIVE shell, 105–120 mm class: a
  // ~20 kg shell at ~900 m/s (the high-explosive and the multi-purpose
  // rounds are slower than the armour-piercing ones), no motor, a heavy
  // shell's small drag. Its burst kills inside ~10 m and throws fragments
  // to ~40; the blast flattens a man at 25. The gun on its stabilised
  // mount throws ~0.3 mil, the fire control's lay ~0.8. A shot a reload
  // of 6–10 s.
  tankGun: {
    kind: "blast",
    mass: 20,
    muzzle: 900,
    light: 0,
    top: 900,
    push: 0,
    drag: 0.00008,
    smoke: false,
    reload: [6, 10],
    range: 1500,
    reach: 3000,
    dispersion: 0.3,
    hold: 0.8,
    lead: 0.1,
    kill: 10,
    wound: 40,
    throw: 25,
    shove: 26,
    frag: 1400,
    backblast: 0,
    cone: 0,
    crater: { radius: 1.8, depth: 0.55 },
  },
};

/** THE GUNFIRE'S OWN NUMBERS: the rules of fire, the hit tests, what a hit
 * does to the machines. */
export const GUNFIRE = {
  /** THE BODY a round is tested against: each bone a capsule of this
   * radius, m, round the ragdoll's points (`gunfire-body.ts`) — the head a
   * ball, the trunk a thick one, the limbs a clothed limb's. */
  body: {
    head: 0.11,
    neck: 0.06,
    trunk: 0.17,
    pelvis: 0.15,
    upperArm: 0.06,
    forearm: 0.05,
    hand: 0.05,
    thigh: 0.09,
    shin: 0.065,
    foot: 0.07,
  },
  /** WARNING FIRE (the `warn` rules, and every burst with SAFE FOR WORK
   * on): aimed off him, at least `near` and at most `far` m to a side of
   * him or into the snow ahead, never at him, and none of it tested
   * against his body. */
  warn: { near: 6, far: 14, ahead: 8 },
  /** A ROUND THROUGH THE CABIN of a machine he flies (a helicopter, the
   * plane) reaches him this share of the time; the rest go through the
   * airframe round him. */
  cabin: 0.18,
  /** WHAT A MACHINE TAKES, J of the rounds' energy to bring it down: a
   * light turbine helicopter's engine, gearbox and tail rotor drive are
   * all a rifle round's reach from the skin, and some forty rifle-class
   * hits (fewer of a heavier calibre) have stopped one; a snowmobile's
   * engine and tank under a thin hood; a plane's engine. At `smoke` of it
   * the machine trails smoke, at `fail` its engine is failing, at 1 it
   * is lost: the helicopter's gearbox seizes and its rotor runs down, the
   * snowmobile's tank lights. A rocket's burst on a machine is `rocket`
   * of it at once. */
  machine: { heli: 70000, plane: 60000, sled: 18000, smoke: 0.35, fail: 0.6, rocket: 1.2 },
  /** THE SEIZED GEARBOX: the rotor's rpm share it loses a second once a
   * helicopter is lost. */
  seize: 0.5,
  /** THE BALLOON'S ENVELOPE: a bullet's hole lets out next to nothing (a
   * few rounds through 2,500 m³ of hot air is a leak the burner makes up),
   * but a rocket's burst in it sets it alight. Its hit volume: a ball of
   * this share of its diameter round its equator. */
  envelope: 0.45,
  /** A ROUND STRUCK INTO A TRUNK or a post stops in it; into the snow, it
   * stops under it. Rounds are followed no longer than this, s. */
  life: 4,
  /** The most rounds in flight at once (the oldest is dropped past it). */
  most: 400,
  /** A round that passes him this near, m, is heard as its crack going
   * by (the supersonic snap) — the `snap` event. */
  snap: 6,
} as const;
