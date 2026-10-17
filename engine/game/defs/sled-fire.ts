// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWMOBILE RIDDEN INTO A FIRE (`sled-fire.ts`) — the numbers it catches,
// goes up and burns out by. Every number is metres, seconds, kilograms or
// m/s.
//
// What it is modelled on, in our own words:
//   - A snowmobile's fuel tank is moulded polyethylene under the seat, its
//     lines rubber and its hood, belly pan and seat plastics and foam — all
//     of it fuel. Vehicle fires begin where a flame meets a fuel line, a
//     carburettor's or injector's leak or a melted tank, and a vehicle in
//     an open flame of a hundred-odd kW/m² (a bonfire's bed, `defs/fires.ts`)
//     has its belly pan and lines alight within a couple of seconds.
//   - A tank that SPLITS in a fire throws its petrol out as a spray that
//     lights at once: a FIREBALL, a deflagration whose blast does little and
//     whose HEAT does the harm (`heli-wreck.ts` says why), sized off the fuel
//     it burns by the same law (5.8 M^⅓ m across, 0.45 M^⅓ s long). The rest
//     pools under the wreck and burns there, and the plastics after it — a
//     burnt-out vehicle burns for some minutes and smoulders after.
//   - The game's one liberty is the FUSE: a real tank may soften and leak
//     rather than split. Here it always goes up, `fuse` s after the machine
//     met the flames, wherever it has got to by then.

export const SLED_FIRE = {
  /** The footprint the hearth is met with: circles at these shares of the
   * machine's half-length along it, of `radius` m — its skis, its engine
   * bay and the tunnel under the seat. */
  circles: [0.75, 0, -0.75] as readonly number[],
  radius: 0.5,
  /** How far its belly must be over a fire's flames to pass over it
   * untouched, m (a jump clears a camp fire as a skier's does). */
  over: 0.5,
  /** THE BED: the share of its way the logs and embers ploughed through
   * leave it — the bonfire scattered under its skis. */
  bed: 0.72,
  /** How long it burns before the tank goes, s. */
  fuse: 1.6,
  /** THE FIREBALL: the share of the tank's fuel (`SLED.fuel`, 30 kg) thrown
   * out and burnt in the ball — a split plastic tank's, more of it than a
   * crashed airframe's — some 13 m across for a second. */
  ball: 0.45,
  /** THE BLAST on the machine: thrown up off the snow, m/s, and over on its
   * side, rad/s. */
  kick: { up: 3.5, roll: 2.2 },
  /** THE BLAST on its rider, stood over the tank: thrown up, m/s, back off
   * the seat, m/s, and a share of the machine's way kept. */
  rider: { up: 7.5, back: 4, way: 0.6 },
  /** A skier on his skis beside it: within `reach` m of the tank he is
   * knocked down, pushed `push` m/s at the tank, less as he stands off. */
  near: { reach: 7, push: 8 },
  /** THE WRECK BURNING: its fire's whole life, s, until a fresh machine is
   * stood on the spot at the bottom — and no sooner than the skier is
   * `clear` m from it, stood up. */
  wreck: { lasts: 90, clear: 25 },
} as const;
