// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE — the free ride's way up the mountain on the snow itself
// (`RunRules.sled`, `docs/snowmobile.md`): a deep-snow MOUNTAIN sled, the
// class built to climb. Every number carries its unit, and where it came
// from is said beside it: the class's published proportions are kept as the
// BAND they sit in, never as a make and model.
//
// THE CLASS, measured across the current long-track mountain machines:
//   * an 850 cc liquid-cooled two-stroke twin, 165 hp (123 kW) at about
//     8,000 rpm, the drive clutch engaging near 4,000 and idling round
//     1,500, the limiter a few hundred over the peak;
//   * about 200 kg dry (the class is 195–212 kg, 430–466 lb) and some 30 kg
//     of fuel in its 40-litre tank;
//   * a 165-inch belt (4.19 m) 16 in (0.41 m) wide of 3-inch (76 mm)
//     paddles — the tallest made, for bite in bottomless snow — unstudded;
//   * a narrow 36-inch (0.91 m) ski stance on wide, short-keeled skis, so
//     the machine can be rolled onto its side and steered with the body
//     (trail sleds stand at 42–43 in and are steered by the bars);
//   * 9 in (0.23 m) of travel in front and 15 in (0.38 m) behind, a short
//     seat, a tall riser putting the bars at a standing rider's waist, an
//     open, lightened tunnel and running boards cut to shed snow;
//   * some 3.3 m long, 1.1 m wide and 1.3 m tall, topping out at 140–150
//     km/h on the flat — geared for the climb, not the top end.
// The machine here is that band's middle; the drawn one is built to the
// same table (`scripts/blender/sled.py`, `sled-look.ts`).
//
// THE BODY FRAME is the engine's: x to the rider's right, y up, z forward,
// the origin at the centre of gravity of the sled AND its rider together.
// The TRACE frame the model is built in (z forward from the tunnel's end,
// y up from the snow under the belt) is carried onto it by `SLED.trace`.

/** Front or rear suspension, per probe: spring rate N/m, damping N·s/m
 * (`bump` compressing, `rebound` extending), travel m. */
export type SledSuspension = { rate: number; bump: number; rebound: number; travel: number };

export const SLED = {
  /** Machine dry and its fuel, kg. The rider is the skier on it, his skis
   * and poles racked (`totalSledMass`). */
  dryMass: 200,
  fuel: 30,
  /** The envelope, m: bumper to the tunnel's end, ski tip to ski tip, snow
   * to the top of the riser. */
  length: 3.3,
  width: 1.08,
  height: 1.3,
  /** Centre of gravity over the snow at rest, sled and rider, m — a
   * standing rider carries it high. */
  cogHeight: 0.66,
  /** The skis: their stance centre to centre, how far ahead of the CoG
   * their contact centre stands, their running width and length, m. */
  skiStance: 0.91,
  skiForward: 1.09,
  skiWidth: 0.17,
  skiLength: 1.05,
  /** THE TREAD: belt length (the catalogue's figure), width, and its run
   * on the snow from `treadFront` ahead of the CoG to `treadRear` behind
   * it, m; the paddles' height, m. */
  treadLength: 4.19,
  treadWidth: 0.41,
  treadFront: 0.17,
  treadRear: -1.36,
  lugHeight: 0.076,
  /** THE SUSPENSION, per probe — two ski probes, six on the tread (three
   * stations along each edge of the belt). The rest loads come off the
   * geometry (`restLoads`): about a third of the weight on the skis, the
   * sag a third of the travel, a little under 2 Hz in heave and half
   * critical damping — a machine that settles in one bob. */
  front: { rate: 7000, bump: 400, rebound: 880, travel: 0.23 } as SledSuspension,
  rear: { rate: 2700, bump: 210, rebound: 440, travel: 0.38 } as SledSuspension,
  /** THE ENGINE: peak power, kW, at `peakRpm`; the limiter; the idle; the
   * drive clutch's engagement, rpm. */
  powerKw: 123,
  peakRpm: 8000,
  maxRpm: 8300,
  idleRpm: 1500,
  engageRpm: 4000,
  /** The power curve's shape under the peak — a two-stroke's: little down
   * low and a rush onto the pipe (`sled-drive.ts`). */
  curve: 2,
  /** Engine braking shut, N per m/s of belt: a two-stroke freewheels. */
  engineBrake: 45,
  /** THE CVT: the belt speed at the redline in its top ratio, m/s, and the
   * ratio span to its lowest — a mountain machine geared short, for the
   * climb. */
  gearTop: 42,
  gearSpan: 3.8,
  /** The crank's power that reaches the belt: the CVT belt, the chaincase
   * and the drivers. */
  driveline: 0.8,
  /** Drag area, sled and standing rider nose on, m². */
  cdA: 1.0,
  /** Full ski lock at a standstill, rad (a mountain machine's ~32°). */
  skiLock: 0.56,
  /** The brake's most on the belt, N. */
  brakeForce: 3200,
  /** THE RIDER on the boards: how far his weight can be moved across, m
   * (a mountain rider hangs off the side to hold a sidehill), and fore
   * and aft, m; the lag his body follows the bars and the lean with, s. */
  riderReach: 0.42,
  aftReach: 0.35,
  riderLag: 0.16,
  /** Documented expectations — held by `tests/sled_test.ts`, never inputs:
   * km/h flat out on packed snow, and the steepest packed or powder face
   * it climbs at a steady speed, rad. */
  topSpeed: 140,
  climb: 0.55,
  /** THE GRIP, as coefficients on a probe's load: the tread driving and
   * holding sideways on the groomer — rubber and folded paddles, no studs —
   * and in powder, where the 3-inch paddles bite and the belt drives a
   * mountain machine up faces a trail sled bogs on; the skis' keels
   * sideways. The belt's shear saturates with its slip (`slipRef` m/s of
   * belt over the snow) and its slide (`sideRef` m/s across). */
  grip: {
    treadPacked: 0.72,
    treadPowder: 0.85,
    sidePacked: 0.8,
    sidePowder: 0.5,
    skiPacked: 0.85,
    skiPowder: 0.35,
    /** THE SNOW'S COHESION the paddles shear over the belt's footprint,
     * N in all — c·A in Janosi and Hanamoto's thrust, some 0.75 kPa of
     * settled powder over the 0.6 m² the belt lays on the snow. In powder
     * alone: on the groomer the paddles fold. */
    cohesion: 450,
    slipRef: 1.6,
    sideRef: 0.5,
    /** THE SIDEWAYS HOLD stops growing past this multiple of a probe's
     * rest load: under a landing's load the groomer's crust shears and the
     * belt and skis slide, rather than trip the machine over its low side
     * (a sideways hold of 0.8 under a 3 g landing is 2.4 g at the snow,
     * 0.66 m under the CoG — far past the 0.69 g its stance can stand). */
    sideLoad: 2.5,
    /** BARE ICE leaves this share of each. */
    ice: 0.35,
  },
  /** THE SNOW under it, as multiples of the skier's (`snow.ts`): a belt at
   * 4–5 kPa sinks further at rest than a pair of skis and planes later; a
   * sled ski a little less. And how much of the powder drag the belt pays,
   * a multiple of a ski's. */
  sink: { tread: 1.35, ski: 0.9, plane: 1.7, drag: 2.5 },
  /** THE BELT and the drive (`sled-drive.ts`): the belt, drivers and driven
   * clutch as a mass, kg; its rails' and idlers' losses, N per (m/s)² and
   * per m/s; the throttle's and the rpm's lags, 1/s; the belt speed the
   * force is divided by at the least, m/s — the clutch slipping at a
   * standstill. */
  belt: {
    mass: 26,
    lossQuad: 0.34,
    lossLin: 6,
    throttleRate: 8,
    rpmRate: 9,
    launchFloor: 2.5,
  },
  /** STEERING: how the lock falls with speed (halved by `fadeSpeed` m/s),
   * how fast the skis swing, rad/s; the ski-to-tread base, m; and the
   * arcade's hand on the yaw (models nothing, says so — the sibling sled
   * game's): the yaw rate held toward the one the skis ask, no faster than
   * `pathShare` of the grip turns the way, N·m per rad/s, and the nose held
   * to the way it goes, N·m per rad of slide, both capped; in powder the
   * grip it may turn on is `reachPowder` g — a sled rolled onto its edge
   * and carved, more than its belt and skis hold sideways flat. Tuned so
   * full lock turns a circle of about 5.5 m at 21 km/h, 11 m at 33 and 32 m
   * at 56 on the groomer (`make sled-turn`). */
  steer: {
    fadeSpeed: 20,
    rate: 2.8,
    base: 1.75,
    yawHold: 10000,
    slipHold: 1200,
    yawHoldMax: 6000,
    pathShare: 1,
    reachPowder: 0.7,
    slipFrom: 3,
    scrub: 0.3,
  },
  /** THE LEAN INTO A TURN, and RIDE IT LIKE A BIKE in powder (the sibling
   * game's model): the roll the chassis settles at with the bars over —
   * small on the groomer, and in powder the whole of how a mountain sled
   * turns — taken there no faster than `leanRate` rad/s (a rider rolls a
   * sled from one edge to the other in about a second); the righting the
   * rider and the springs hold it with, N·m per rad, its damping past the
   * lean's own rate, N·m·s, and the most of each, N·m; THE CARVE, a share
   * of the belt's load per radian of roll that pulls a sled rolled onto
   * its edge toward its low side once it has `carveSpeed` m/s on; in deep
   * snow the hold the buried skis lose (`deepHold`), the SOFT SIDE GIVING
   * as a share of the weight at the CoG per radian (`deepTip`) and the
   * share left planing on top — and the rider's BALANCE against that give,
   * N·m (the bars countered and his weight hung uphill: `balanceCrawl` of
   * it at a standstill, all of it from `balanceSpeed` m/s). THE TIP: past
   * the angle its CoG passes over the low edge of what it stands on — the
   * skis' 0.91 m stance on firm snow (about 35° off the way its weight and
   * the turn's pull hang), the 0.41 m belt as the low ski sinks into loose
   * (about 17°) — and `hang` rad more for the rider hung off the high
   * side, the righting fades out over `tipBand` rad and the weight takes
   * it over (`docs/snowmobile.md` § Rollover). */
  roll: {
    packed: 0.1,
    powder: 0.5,
    stiff: 7000,
    damp: 1200,
    most: 2700,
    carve: 1.6,
    carveSpeed: 5,
    deepHold: 0.75,
    deepTip: 2.2,
    deepPlaning: 0.5,
    leanRate: 1,
    hang: 0.35,
    tipBand: 0.35,
    balance: 3000,
    balanceCrawl: 0.25,
    balanceSpeed: 8,
  },
  /** THE AIR: the lean's pitch, N·m at full lean (back is nose up); the
   * belt's gyro — the throttle lifting the nose, the brake dropping it,
   * N·m; the bars' yaw, N·m; the damping, N·m·s; the rider levelling the
   * roll, N·m per rad, its damping and the most his body lends it, N·m
   * (a lip tipped a little is levelled in the air, one tipped hard
   * comes down on its side); the nose SET for the landing
   * (`assist.air`) — toward the pitch of the snow it will come down on,
   * `setNose` rad high: N·m per rad, N·m·s, the most it lends, N·m. */
  air: {
    lean: 520,
    throttle: 110,
    brake: 460,
    steer: 90,
    damping: 60,
    rollLevel: 1600,
    rollDamp: 300,
    rollMost: 300,
    setStiff: 5300,
    setDamp: 2400,
    setMost: 3000,
    setNose: 0.06,
  },
  /** THE PARKING SPOT on the valley floor (`sled-pad.ts`): the room kept
   * clear round it, m, and the steepest the snow under it may lean
   * (rise over run). */
  pad: { radius: 4.5, slope: 0.14 },
  /** How long the engine is left idling with nobody on it before it is
   * shut off, s. */
  idleFor: 25,
  /** BOARDING: within `reach` m of the boards' middle, no faster than
   * `fastest` m/s — ridden up to and taken at a skier's cruise (about
   * 43 km/h), never asked to stop dead beside it. */
  board: { reach: 5, fastest: 12 },
  /** THE HOP OFF the boards (the jump's press): out to the left of the
   * machine, m/s, and a little up. */
  hop: { out: 1.6, up: 1.4 },
  /** WHAT PUTS THE RIDER OFF — and nothing else does, on snow: a trunk met
   * harder than `tree` m/s; the machine past `over` rad of roll or pitch
   * off the snow for `overFor` s — rolled, or looped; a landing coming
   * down into the snow harder than `landing` m/s on the groomer, up to
   * `landingPowder` m/s in deep powder (a drop of some 7.6 m and 12 m at
   * the flight's gravity), or set down `tilt` rad off its belt any harder
   * than `tiltFrom` m/s; and the way it was going stopped `wall` m/s in a
   * step — a cliff band ridden into.
   * Off, the machine lies where it came to rest until he rides back to it
   * (boarding stands it back on its belt). */
  crash: {
    tree: 7,
    over: 1.25,
    overFor: 0.6,
    landing: 15,
    landingPowder: 19,
    tilt: 0.7,
    tiltFrom: 4,
    wall: 8,
  },
  /** THE BODY'S POINTS that meet the snow and the trunks when the springs
   * run out — the hull, nose to tunnel, belly to riser — body frame, m. */
  hull: [
    { x: -0.32, y: -0.3, z: 1.75 },
    { x: 0.32, y: -0.3, z: 1.75 },
    { x: 0, y: -0.15, z: 2.05 },
    { x: -0.25, y: -0.38, z: -1.5 },
    { x: 0.25, y: -0.38, z: -1.5 },
    { x: -0.45, y: 0.15, z: 0.6 },
    { x: 0.45, y: 0.15, z: 0.6 },
    { x: -0.3, y: 0.55, z: 0.95 },
    { x: 0.3, y: 0.55, z: 0.95 },
    { x: 0, y: 0.65, z: -0.4 },
  ],
  /** Where the rider's feet stand on the boards, body frame, m — the boards'
   * middle (what boarding reaches for), and the grips. */
  boards: { x: 0.335, y: -0.315, z: 0.12 },
  grips: { x: 0.37, y: 0.475, z: 0.534 },
  /** How far behind the CoG the trace's zero (the tunnel's end) stands, m,
   * and how far over the snow under the belt the CoG stands in it — the
   * shift that carries the trace onto the body frame. */
  trace: { z: 1.444, y: 0.66 },
} as const;

/** The sled and its rider together, kg, for a rider of `rider` kg. */
export function sledMass(rider: number): number {
  return SLED.dryMass + SLED.fuel + rider;
}

/** The principal moments of inertia about the body's right (pitch), up
 * (yaw) and forward (roll) axes, kg·m²: a solid box of the envelope. */
export function sledInertia(m: number): { x: number; y: number; z: number } {
  const L = SLED.length;
  const W = SLED.width;
  const H = SLED.height;
  return {
    x: (m * (L * L + H * H)) / 12,
    y: (m * (L * L + W * W)) / 12,
    z: (m * (W * W + H * H)) / 12,
  };
}

/** One suspension probe: where its strut hangs, body frame, at full
 * extension; which end; its side (−1 left, +1 right; 0 the middle); its
 * rest load, N per kg of the whole; how wide it ploughs, m. */
export type SledProbe = {
  kind: "ski" | "tread";
  station: "ski" | "front" | "mid" | "rear";
  side: number;
  bx: number;
  by: number;
  bz: number;
  susp: SledSuspension;
  /** The share of the whole weight it carries at rest. */
  share: number;
  width: number;
};

/** THE PROBES: one under each ski, and three stations along each edge of
 * the belt. The rest shares come off the moment balance of the ski line and
 * the belt's centroid about the CoG; each strut hangs so it sits at a third
 * of its travel under that share of a rider's weight. */
export const SLED_PROBES: readonly SledProbe[] = (() => {
  const S = SLED;
  const treadMid = (S.treadFront + S.treadRear) / 2;
  const front = -treadMid / (S.skiForward - treadMid);
  const probes: SledProbe[] = [];
  const ride = -S.cogHeight;
  for (const side of [-1, 1]) {
    const share = front / 2;
    const susp = S.front;
    probes.push({
      kind: "ski",
      station: "ski",
      side,
      bx: (side * S.skiStance) / 2,
      by: ride + susp.travel * (2 / 3),
      bz: S.skiForward,
      susp,
      share,
      width: S.skiWidth,
    });
  }
  const stations: ["front" | "mid" | "rear", number][] = [
    ["front", S.treadFront],
    ["mid", treadMid],
    ["rear", S.treadRear],
  ];
  for (const [station, z] of stations) {
    for (const side of [-1, 1]) {
      const susp = S.rear;
      probes.push({
        kind: "tread",
        station,
        side,
        bx: side * S.treadWidth * 0.4,
        by: ride + susp.travel * (2 / 3),
        bz: z,
        susp,
        share: (1 - front) / 6,
        width: S.treadWidth / 2,
      });
    }
  }
  return probes;
})();
