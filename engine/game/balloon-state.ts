// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON'S STATE (`balloon.ts`) — what the balloon is doing,
// its envelope's heat, the burner and the valve, the fire, where the skier
// stands in its basket and what its events say — beside `state.ts`, which
// re-exports every one of them.

/** WHAT THE BALLOON IS DOING: `tethered` — stood up inflated on the valley
 * floor, held by its tether until it is light; `flown` — free, the skier
 * aboard flying it (in the air or set down on the snow, `grounded`);
 * `adrift` — flying on alone after he jumped; `down` — on the snow for
 * good, its envelope lying down (landed alone, left after he stepped out,
 * or crashed). */
export type BalloonMode = "tethered" | "flown" | "adrift" | "down";

/** What a `balloon` event says (`balloon.ts`): let go off its tether
 * (`launch`), the basket off the snow (`liftoff`) and back on it softly
 * (`touch`), the envelope past its working limit (`hot`), the fabric
 * alight (`fire`), the basket into the snow or a crown too fast (`crash`),
 * the skier over the side (`jump`) or out onto the snow (`step`), the
 * empty balloon down (`down`), or the ride begun again (`restart`). */
export type BalloonPhaseEvent =
  "launch" | "liftoff" | "touch" | "hot" | "fire" | "crash" | "jump" | "step" | "down" | "restart";

/** A `balloon` event (`GameEvent`): where the basket is, and how hard — the
 * speed into the snow (a touch, a crash), the balloon's speed otherwise,
 * m/s. */
export type BalloonEvent = {
  kind: "balloon";
  t: number;
  phase: BalloonPhaseEvent;
  x: number;
  y: number;
  z: number;
  speed: number;
};

/** THE FREE RIDE'S HOT AIR BALLOON (`balloon.ts`) — on a free ride begun in
 * it (`CreateGameOptions.balloon`), absent everywhere else. Drawn off this,
 * heard off this; nothing in it draws from the stream. */
export type BalloonState = {
  mode: BalloonMode;
  /** Whether the skier is in the basket. */
  aboard: boolean;
  /** The basket's FLOOR CENTRE, world frame, m, and its velocity, m/s. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The way the basket faces, rad (it is stood up facing the summit, and
   * a balloon has nothing to turn it). */
  heading: number;
  /** THE BASKET'S LEAN, rad, about its own axes: `pitch` nose (its +z
   * side) up positive, `roll` right side down positive — his weight off the
   * floor's middle, and on the snow the envelope's pull tipping it. */
  pitch: number;
  roll: number;
  /** THE ENVELOPE PUSHED OVER by the air past it, rad from the vertical
   * (0 hanging straight over the basket), and the heading it leans toward
   * — what the drawing leans it by. */
  lean: number;
  leanTo: number;
  /** THE AIR: its temperature at the basket, °C; the envelope's air
   * inside, °C; and the share of its own weight in the outside air the
   * envelope's air weighs (the density ratio, 1 cold). */
  ambient: number;
  temp: number;
  density: number;
  /** THE BURNER: the blast valve open (the input), the flame as it stands
   * after its lag 0..1 (what is drawn and heard roaring), the pilot light
   * lit, and the propane left, kg. */
  valve: boolean;
  flame: number;
  pilot: boolean;
  fuel: number;
  /** THE PARACHUTE VALVE: how far open, 0 (sealed) … 1 (the cord all the
   * way down). */
  vent: number;
  /** THE WIND at the envelope's centre, world frame, m/s, and its speed —
   * the up-valley wind a balloon ride is flown in (`balloon-air.ts`); and
   * the air past the envelope (the wind less the balloon's own way), m/s:
   * what pushes it over and what lights it. */
  windX: number;
  windZ: number;
  wind: number;
  shear: number;
  /** The air's own rise where it is, m/s (the up-valley flow following
   * the slope it climbs, `balloonRiseAt`). */
  rise: number;
  /** The net lift, N (the buoyancy less the weight), the climb, m/s, and
   * the height of the basket's floor over the snow under it, m. */
  lift: number;
  climb: number;
  agl: number;
  /** Whether the basket stands on the snow, and whether it is being
   * dragged along it. */
  grounded: boolean;
  dragging: boolean;
  /** THE FIRE: the fabric scorched toward alight, 0..1, and once alight how
   * much of it has burnt away, 0..1 (0 sound). */
  scorch: number;
  burning: boolean;
  burnt: number;
  /** THE ENVELOPE ON THE SNOW: how far it has lain down, 0 (standing) … 1
   * (flat). */
  deflate: number;
  /** WHERE THE SKIER STANDS IN THE BASKET: his boots' place off the floor's
   * centre, m, in the basket's own frame (x to its right, z forward,
   * inside `basket.width/2 − walk.wall` and `basket.length/2 − walk.wall`),
   * and the way he faces, rad off the basket's heading — he turns to face
   * the way he walks. */
  walkX: number;
  walkZ: number;
  face: number;
  /** Seconds in this mode; seconds off the snow. */
  t: number;
  airTime: number;
  /** Whether a crash threw the skier out of it (the ride starts again
   * from the site once he has lain `crash.lieFor`). */
  wreck: boolean;
  /** Where it was stood up (the ride's restart). */
  start: { x: number; z: number; heading: number };
};
