// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WRECK — what a crashed helicopter does to a body near it: the stop
// the skid gear gives the skier sat on it, and the FIREBALL its fuel goes
// up in. Kept apart from `heli.ts`' table, which the Blender model is made
// from: none of this is the machine's shape.
//
// WHAT A HELICOPTER CRASH DOES TO THE PEOPLE IN IT — the research these
// numbers stand on, in our own words:
//   - A helicopter comes down mostly VERTICALLY, and the vertical load is
//     the one the body bears worst: belted in, the forward and sideways
//     loads of a survivable crash are borne, the headward one is not — it
//     goes up the seat into the spine. The military crashworthiness rules
//     are built round it: a survivable crash is a vertical change of speed
//     of about 12.8 m/s (42 ft/s), and a crashworthy seat strokes at about
//     12–14.5 g so the lumbar spine is never handed more. Without that
//     stroke the load goes straight up the column and the hallmark injury is
//     a COMPRESSION or BURST FRACTURE of the thoracolumbar spine, often
//     with the pelvis and the lower legs (the floor driven up into them).
//   - The rest is blunt trauma from being thrown: in autopsy series of air
//     crash victims the ribs are broken in some four in five, the skull in
//     three in four, the pelvis in three in five and the spine in half; the
//     organs torn are the lungs, the heart, the liver, the aorta and the
//     spleen — the liver and the spleen most often beside broken ribs over
//     them. That is the ragdoll's work here (`body.ts`' `ragdollBlows`), the
//     body flung off the skid and meeting the snow.
//   - THE FIRE kills as many as the impact in a crash that is otherwise
//     survivable: a fuel tank burst lights a FIREBALL, then a pool fire.
//     An unconfined fuel fireball is a DEFLAGRATION, not a detonation: its
//     overpressure is a few kPa where an eardrum needs some 35 and a lung
//     70 or more, so the blast wave itself does little — the HEAT does the
//     harm. Thermal harm goes as the THERMAL DOSE, (kW/m²)^4/3 · s on bare
//     skin: about 105 for a first-degree burn, 290 for a second-degree
//     (partial-thickness) one and about 1,000 for a full-thickness one (the
//     process-safety literature's burn thresholds); a hydrocarbon
//     fireball's surface radiates 150–350 kW/m², so a body ENGULFED in one
//     for half a second is burnt through bare skin and through all but good
//     clothing, and breathing it in burns the airway. Out of the ball the
//     flux falls as a sphere's view of him, (r / d)².
//   - THE ANGLE IT COMES DOWN AT decides which of those it is. The seat's
//     stroke and the spine's load are the VERTICAL ones, along the
//     airframe's own up; a helicopter that comes down rolled or nose-low
//     (a dynamic rollover off a skid caught on landing is the commonest
//     way a light one goes over) hands the people in it the stop ACROSS
//     the body instead, and the injuries of a side impact follow it: the
//     ribs and the shoulder on the struck side, the organ under them (the
//     liver on the right, the spleen on the left), the pelvis squeezed
//     side to side and the head against the structure — and little up the
//     spine. Rolled onto the occupant's own side, the airframe comes down
//     ON him.
// A body on the RIGHT SKID — outside the cabin, on a tube, unbelted — has
// none of the cabin's protection: no stroking seat, no airframe round him,
// nothing between him and the fire.

export const WRECK = {
  /** THE SKID GEAR's crush under the crash, m: the cross tubes yield and
   * the skids spread flat — the only stroke there is under a skier sat on
   * the tube. The snow's own give is added (`body.ts`' `snowGive`). */
  stroke: 0.3,
  /** Of the seat's stop, the share that reaches his feet and shins down on
   * the snow under the skid (his skis rest on it on the ground, his legs
   * folded): the legs are driven up into him. */
  legs: 0.6,
  /** THE AIRFRAME'S SIDE, m: the crush of the cabin's door and frame, or
   * of the skid's cross tube, a body is stopped against. */
  side: 0.15,
  /** ROLLED ONTO HIS SIDE: he is pitched out face first onto the snow and
   * the airframe's side comes down on his back — its crush and the snow's
   * give the stop, these the shares of it each part takes (the trunk
   * caught between, the head and the limbs less). */
  pinned: { back: 1, chest: 0.9, abdomen: 0.8, pelvis: 0.7, shoulder: 0.7, head: 0.5, thigh: 0.4 },
  /** ROLLED AWAY FROM HIM: his skid goes up and over and he is thrown back
   * against the cabin's side behind him. */
  thrown: { back: 1, pelvis: 0.6, shoulder: 0.7, head: 0.5 },
  /** THE FIREBALL off the fuel aboard: a light turbine helicopter carries
   * some 450 litres of kerosene, 360 kg (`fuel`). Filmed fuel impacts burn
   * a tenth to a quarter of it in the fireball, held at `share` here; the
   * rest spills and burns as a pool. A hydrocarbon fireball reaches a
   * diameter of about 5.8 M^⅓ m and lives about 0.45 M^⅓ s (M the fuel it
   * burns, kg — the fireball correlations of the process-safety
   * literature): some 28 m across for two seconds here. It reaches its
   * size in the first third of its life (`grow`), a dome on the snow, LIFTS
   * OFF then (`lift`) and rises at 15–20 m/s as it burns out (`rise`,
   * reached at `riseRate` m/s²). Its skin radiates `emissive` kW/m² at
   * its first white heat — a sooty kerosene ball's, at the low end of the
   * 150–350 measured — which is the flux on a body inside it, and less as
   * it burns down to soot (`fireballAt`'s `glow`, the drawing's heat). */
  fire: {
    fuel: 360,
    share: 0.3,
    grow: 0.33,
    lift: 0.33,
    rise: 17,
    riseRate: 22,
    emissive: 200,
  },
} as const;

/** The fireball's diameter, m, and its life, s, off its fuel, kg. */
export function fireballOf(fuel: number): { diameter: number; life: number } {
  const m = Math.cbrt(Math.max(1, fuel));
  return { diameter: 5.8 * m, life: 0.45 * m };
}

/** THE BALL'S SIZE at `age` s of a `life` s life, as a share of its full
 * radius: a quarter at once, swelling to the whole in the first third of
 * its life, and a little more as it burns out — what the drawing
 * (`fireball.ts`) swells it by and the heat on a body is read off. */
export function fireballGrowth(age: number, life: number): number {
  const k = age / life;
  const grown = 1 - Math.exp(-age / (life * WRECK.fire.grow * 0.45));
  return (0.25 + 0.75 * grown) * (1 + 0.25 * Math.max(0, k - 0.5));
}

/** THE WRECK'S FIREBALL at `age` s after the crash: its radius, m, how
 * far its centre stands over the snow it rose from, m, its life, s, and
 * its GLOW — 1 at its first white heat, burning down to 0 as it goes out
 * to soot. */
export function fireballAt(age: number): {
  radius: number;
  height: number;
  life: number;
  glow: number;
} {
  const F = WRECK.fire;
  const full = fireballOf(F.fuel * F.share);
  const radius = (full.diameter / 2) * fireballGrowth(age, full.life);
  // Lifted off at `lift` of its life, it climbs at `riseRate` up to `rise`.
  const up = Math.max(0, age - F.lift * full.life);
  const reach = F.rise / F.riseRate;
  const risen =
    up < reach
      ? 0.5 * F.riseRate * up * up
      : 0.5 * F.riseRate * reach * reach + F.rise * (up - reach);
  const glow = Math.max(0, 1 - age / full.life);
  return { radius, height: risen + radius * 0.55, life: full.life, glow };
}

/** THE FIRE'S HEAT on a body `d` m from the centre of a ball of radius
 * `r` burning at `glow`, kW/m²: the ball's own skin inside it, and its
 * view from outside — a sphere of radius `r` seen from `d` — out of it. */
export function fireFlux(d: number, r: number, glow: number): number {
  const E = WRECK.fire.emissive * glow;
  return d <= r ? E : E * (r / d) ** 2;
}
