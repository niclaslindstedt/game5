// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S SHARED PIECES — the inputs, the strips, the moments and
// the readings every scenario in `ride-scenarios.mjs` is built from: kept
// apart so the scenario list stays a list.

export const TUCK = { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false };
export const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** THE REFERENCE PITCH, m/m: the 20° groomed schuss the top speeds are
 * quoted on (`TOP_SPEED_PITCH`) — and the one the carves are measured on
 * too: a bend held on an edge scrubs speed (`steer.scrub`, the skid past
 * what the edge holds), and a gentler pitch cannot pay it back. */
export const PITCH = Math.tan(Math.PI / 9);

/** The first time a recorded run reached `kmh`, s, or null. */
export function timeTo(run, kmh) {
  const f = run.frames.find((f) => f.speed * 3.6 >= kmh);
  return f ? f.t : null;
}

/** THE GOVERNOR: the tuck and the brake that hold a skier at `kmh` down a
 * pitch — folded into the tuck to gather speed, stood up to shed it, the
 * snowplough only for a real overshoot. A turn measured at "60 km/h" on a
 * fixed tuck drifts to whatever speed that tuck finds in the bend, and the
 * radius goes as the speed squared, so a figure taken without it is a
 * figure about the tuck. */
export function hold(st, kmh) {
  const err = kmh / 3.6 - st.skier.speed;
  return {
    tuck: Math.min(1, Math.max(0, 0.5 + 0.5 * err)),
    brake: Math.min(1, Math.max(0, -0.5 * err - 0.4)),
  };
}

/** The mean of `f` over the frames from `from` s to the end. */
export function tail(run, from, f) {
  const fs = run.frames.filter((x) => x.t >= from);
  return fs.reduce((s, x) => s + f(x), 0) / Math.max(1, fs.length);
}

export const fmt = (v, d = 2) => (v === null || v === undefined ? "—" : Number(v).toFixed(d));

/** THE SKID ANGLE: the skis' line off the way a skier `c` is going, rad,
 * signed — what a recorded frame carries as `slide`. */
export function slideOf(c) {
  const d = Math.atan2(c.vx, c.vz) - c.heading;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** The edge past which a ski counts as on one side or the other when the
 * turns are counted, rad (10°): a flat ski between two turns flips nothing. */
export const TURN_EDGE = 0.17;

/** THE TURNS in recorded `frames` (each carrying `t` and `edge`): every
 * stretch from one flip of the edge past `TURN_EDGE` to the next — `from`
 * and `to` the frames' indices (the next flip's frame not in it), `t0` and
 * `t1` their times, `side` +1 a right turn (the edge positive), `peak` its
 * most edge (rad) on `peakAt`. The stretch before the first flip is not a
 * turn. The rhythm below and the technique lab's turn shapes count turns
 * by it. */
export function turnsOf(frames) {
  const turns = [];
  let side = 0;
  let start = -1;
  let peak = 0;
  let peakAt = -1;
  frames.forEach((f, i) => {
    const now = f.edge > TURN_EDGE ? 1 : f.edge < -TURN_EDGE ? -1 : 0;
    if (Math.abs(f.edge) > peak) {
      peak = Math.abs(f.edge);
      peakAt = i;
    }
    if (now !== 0 && now !== side) {
      if (side !== 0) {
        turns.push({ from: start, to: i, t0: frames[start].t, t1: f.t, side, peak, peakAt });
      }
      side = now;
      start = i;
      peak = 0;
      peakAt = i;
    }
  });
  return turns;
}

/** A RHYTHM OF TURNS as numbers, over recorded `frames` (each carrying
 * `t`, `edge`, `wy`, `speed`, `slide` and `thrown`): how long a turn is —
 * the edge from one side past `TURN_EDGE` to the other, between the first
 * flip and the last — the mean of each turn's peak edge (rad), the radius a
 * tenth of the turning frames turn tighter than (m; speed over yaw where
 * the yaw is over 0.3 rad/s), the most yaw (rad/s), the mean speed (m/s),
 * the skid angle on the mean and at its most (rad), the turns counted and
 * whether he was thrown. Null where there is too little to say. The ride
 * lab's `slalom-rhythm` and the technique lab both read it. */
export function rhythmOf(frames) {
  const turns = turnsOf(frames);
  const flips = turns.map((t) => t.t1);
  const peaks = turns.map((t) => t.peak);
  const radii = frames
    .filter((f) => Math.abs(f.wy) > 0.3)
    .map((f) => f.speed / Math.abs(f.wy))
    .sort((a, b) => a - b);
  const n = Math.max(1, frames.length);
  const mean = (g) => frames.reduce((sum, f) => sum + g(f), 0) / n;
  const most = (g) => frames.reduce((m, f) => Math.max(m, g(f)), 0);
  return {
    turnS: flips.length > 1 ? (flips[flips.length - 1] - flips[0]) / (flips.length - 1) : null,
    turns: Math.max(0, flips.length - 1),
    edgePeak: peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : null,
    radius: radii.length ? radii[Math.floor(radii.length * 0.1)] : null,
    yawMost: most((f) => Math.abs(f.wy)),
    speed: mean((f) => f.speed),
    skid: mean((f) => Math.abs(f.slide)),
    skidMost: most((f) => Math.abs(f.slide)),
    thrown: frames.some((f) => f.thrown),
  };
}

export function schuss(run) {
  const top = Math.max(...run.frames.map((f) => f.speed));
  const t100 = timeTo(run, 100);
  const at100 = run.frames.find((f) => f.speed * 3.6 >= 100);
  return [
    ["0-50 km/h s", fmt(timeTo(run, 50))],
    ["0-100 km/h s", fmt(t100)],
    ["to 100 m", at100 ? fmt(at100.dist, 0) : "—"],
    ["top km/h", fmt(top * 3.6, 1)],
    ["sink at top m", fmt(run.frames[run.frames.length - 1].sink, 3)],
  ];
}

/** A BEND'S NUMBERS, read over the second and a half after the edge has
 * gone on (t = 0.5..2 s): the radius the yaw rate and the speed make, the
 * lateral g, the edge and the roll. Read early and not settled, because a
 * skier cannot hold a governed circle on a slope — an edge held turns him
 * across the pitch and up it, and the bend's own scrub takes the speed —
 * so a carve is a thing measured at the speed he came in with. */
export function turn(run) {
  const fs = run.frames.filter((f) => f.t >= 0.5 && f.t < 2);
  const mean = (g) => fs.reduce((sum, f) => sum + g(f), 0) / Math.max(1, fs.length);
  const v = mean((f) => f.speed);
  const wy = Math.abs(mean((f) => f.wy));
  const radius = wy > 1e-3 ? v / wy : Infinity;
  return [
    ["radius m", fmt(radius, 1)],
    ["speed km/h", fmt(v * 3.6, 1)],
    ["lateral g", fmt((v * wy) / 9.81, 2)],
    ["edge deg", fmt(mean((f) => Math.abs(f.edge)) * 57.3, 0)],
    ["roll deg", fmt(mean((f) => f.roll) * 57.3, 1)],
    ["resets", run.events.filter((e) => e.kind === "reset").length],
  ];
}

export function flight(run) {
  const lands = run.events.filter((e) => e.kind === "land");
  const air = run.events.find((e) => e.kind === "air");
  const first = lands[0];
  const launch = run.frames.find((f) => f.airborne);
  const touch = launch ? run.frames.find((f) => f.t > launch.t && !f.airborne) : null;
  const peak = run.frames.reduce((m, f) => Math.max(m, f.y - f.ground), 0);
  return [
    ["launch km/h", air ? fmt(air.speed * 3.6, 1) : "—"],
    ["air s", first ? fmt(first.airTime) : "—"],
    ["carry m", launch && touch ? fmt(touch.dist - launch.dist, 1) : "—"],
    ["peak m", fmt(peak - 1, 2)],
    ["impact m/s", first ? fmt(first.impact) : "—"],
    ["harsh", first ? (first.harsh ? `yes -${Math.round(first.lost * 100)}%` : "no") : "—"],
    ["land pitch deg", touch ? fmt(touch.pitch * 57.3, 1) : "—"],
    ["out km/h", fmt(run.frames[run.frames.length - 1].speed * 3.6, 1)],
    ...hurt(run),
  ];
}

/** THE WIPEOUT's numbers: what put him off and when, how fast he was
 * going, how far his body slid from where he left the skis, how many turns
 * it took, and when the reset stood him up — and the nearest thing he
 * SAVED before it (`crash.ts`'s `noteSave`): which, how near, when. */
export function wipeout(run) {
  return [...thrownRows(run), ...saved(run), ...hurt(run)];
}

/** THE BODY (`body.ts`): the run's hardest blow and every injury taken,
 * in the engine's own names with their AIS rank. */
export function hurt(run) {
  const last = run.frames[run.frames.length - 1];
  const taken = run.events.filter((e) => e.kind === "injury");
  return [
    ["hardest g", last ? fmt(last.peakG, 0) : "—"],
    [
      "injuries",
      taken.length ? taken.map((e) => `${e.part}:${e.injury}(${e.ais})`).join(" ") : "none",
    ],
  ];
}

/** THE SAVE: the nearest fall he rode out — its kind, how near it came
 * (0..1) and when. */
export function saved(run) {
  let best = null;
  for (const e of run.events) if (e.kind === "save" && (!best || e.size > best.size)) best = e;
  return [["saved", best ? `${best.save} ${fmt(best.size)} at ${fmt(best.t)} s` : "—"]];
}

function thrownRows(run) {
  const off = run.events.find((e) => e.kind === "wipeout");
  const reset = run.events.find((e) => e.kind === "reset" && (!off || e.t > off.t));
  const lying = off ? run.frames.filter((f) => f.t > off.t && f.thrown) : [];
  const last = lying[lying.length - 1];
  return [
    ["wipeout", off ? `${off.cause} at ${fmt(off.t)} s` : "no"],
    ["at km/h", off ? fmt(off.speed * 3.6, 1) : "—"],
    ["body slid m", last ? fmt(Math.hypot(last.rx - off.x, last.rz - off.z), 1) : "—"],
    ["tumbled turns", last ? fmt(Math.abs(last.tumble) / (2 * Math.PI), 1) : "—"],
    ["reset at s", reset ? fmt(reset.t) : "—"],
  ];
}

/** THE POP's numbers: how hard he sprang and how long it was loaded. */
export function jumped(run) {
  const j = run.events.find((e) => e.kind === "jump");
  return [
    ["pop m/s", j ? fmt(j.pop) : "—"],
    ["loaded s", j ? fmt(j.held) : "—"],
  ];
}

/** THE LANDING'S LOAD: the equivalent fall height, the load in g, how far
 * off true the skis came down as a share of what that load forgives. */
export function landed(run) {
  const land = run.events.find((e) => e.kind === "land");
  return [
    ["impact m/s", land ? fmt(land.impact) : "—"],
    ["EFH m", land ? fmt((land.impact * land.impact) / (2 * 9.81)) : "—"],
    ["load g", land ? fmt(land.g, 1) : "—"],
    ["off true", land ? fmt(land.off) : "—"],
    ...hurt(run),
  ];
}

/** A skier rocking: the weight thrown fore and aft and side to side, `hz`
 * times a second, on `tuck` (the poles). */
export function rock(t, hz, tuck) {
  const s = Math.sin(2 * Math.PI * hz * t) >= 0 ? 1 : -1;
  return { steer: s, tuck, brake: 0, lean: s, reset: false };
}

/** Which phase of the rocking scenario a run is in, per run. */
export const dug = new WeakMap();

/** BOGGED's numbers: when he was bogged, how deep he sank, when he was out
 * and moving again, and whether the engine had to reset him. */
export function trench(run) {
  const stuck = run.events.find((e) => e.kind === "stuck");
  const deepest = run.frames.reduce((m, f) => Math.max(m, f.trench), 0);
  // Two moments, because they are two different things: the hole PACKED
  // BACK by the rocking (the trench's own mechanic), and the skier SKIED
  // OFF — which also asks whether the bank he stopped against lets him
  // turn away.
  const packed = stuck ? run.frames.find((f) => f.t > stuck.t && f.trench === 0) : null;
  const out = stuck ? run.frames.find((f) => f.t > stuck.t && f.trench === 0 && f.speed > 2) : null;
  return [
    ["bogged at s", stuck ? fmt(stuck.t) : "—"],
    ["deepest m", fmt(deepest, 3)],
    ["packed back at s", packed ? fmt(packed.t) : "—"],
    ["skied off at s", out ? fmt(out.t) : "—"],
    ["resets", run.events.filter((e) => e.kind === "reset").length],
  ];
}

/** THE SCORE's numbers (`tricks.ts`): what was won, how the flight ended,
 * and what the combo came to. */
export function tricked(run) {
  const land = run.events.find((e) => e.kind === "land");
  const won = run.events.filter((e) => e.kind === "trick").map((e) => e.trick);
  const combo = run.events.find((e) => e.kind === "combo");
  const bail = run.events.find((e) => e.kind === "bail");
  const touch = land ? run.frames.find((f) => f.t >= land.t) : null;
  return [
    ["air s", land ? fmt(land.airTime) : "—"],
    ["won", won.length ? won.join("+") : "nothing"],
    ["land pitch deg", touch ? fmt(touch.pitch * 57.3, 1) : "—"],
    ["impact m/s", land ? `${fmt(land.impact)}${land.harsh ? " harsh" : ""}` : "—"],
    [
      "combo",
      bail
        ? `lost ${bail.lost} (${bail.cause})`
        : combo
          ? `${combo.base} × ${combo.mult} = ${combo.points}${combo.sketchy ? " sketchy" : ""}`
          : "—",
    ],
  ];
}

/** A METRE OF FRESH SNOW: the snow dial at its deepest (`SNOW_DIAL.max`,
 * `snow.deep.full`), where the powder is bottomless. */
export const DEEP = 2.5;

/** The first time after `from` s that the boot's station came up under
 * `under` m of sink — the moment the skis climbed onto the top of the
 * snow — as [time, speed], or null. */
export function planedAfter(run, from, under = 0.05) {
  const f = run.frames.find((x) => x.t >= from && x.sink < under);
  return f ? [f.t, f.speed] : null;
}

/** A deep run's numbers: the speed at 10 s and at the end, when he came up
 * onto the top, and the deepest he sank on the way. */
export function deepSchuss(run) {
  const at = (t) => run.frames.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b));
  const planed = planedAfter(run, 0);
  return [
    ["at 10 s km/h", fmt(at(10).speed * 3.6, 0)],
    ["at end km/h", fmt(run.frames[run.frames.length - 1].speed * 3.6, 0)],
    ["planed at s", planed ? fmt(planed[0], 1) : "—"],
    ["planed km/h", planed ? fmt(planed[1] * 3.6, 0) : "—"],
  ];
}

/** Held at `kmh` on the tuck and the brake, as a skier would on a traverse. */
export function cruise(st, kmh) {
  return { ...TUCK, ...hold(st, kmh) };
}

/** The balance's numbers: the worst roll off the snow's plane, whether he
 * went over and when, and how far he got. */
export function balance(run) {
  const over = run.frames.find((f) => Math.abs(f.roll) > 1.2);
  const upright = over ? run.frames.filter((f) => f.t < over.t) : run.frames;
  const worst = upright.reduce((m, f) => Math.max(m, Math.abs(f.roll)), 0);
  const last = (over ?? run.frames[run.frames.length - 1]).dist;
  return [
    ["worst roll deg", fmt(worst * 57.3, 0)],
    ["over at s", over ? fmt(over.t, 1) : "no"],
    ["skied m", fmt(last, 0)],
  ];
}

/** A stop's numbers: when and where he stopped from the speed he was
 * placed at, and the mean deceleration. */
export function stopped(run, kmh) {
  const stop = run.frames.find((f) => f.t > 0.2 && f.speed < 0.3);
  return [
    ["stop s", stop ? fmt(stop.t) : "—"],
    ["stop m", stop ? fmt(stop.dist, 1) : "—"],
    ["mean g", stop ? fmt(kmh / 3.6 / stop.t / 9.81, 2) : "—"],
  ];
}

/** THE SLIP ANGLE over a run: how far the skis have come round off the
 * way he is actually going, while he is still going anywhere, rad. */
export function worstSlip(run) {
  let slip = 0;
  for (let i = 1; i < run.frames.length; i++) {
    const a = run.frames[i - 1];
    const b = run.frames[i];
    if (b.speed < 3) continue;
    const way = Math.atan2(b.x - a.x, b.z - a.z);
    let d = Math.abs(b.heading - way) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > slip) slip = d;
  }
  return slip;
}

/** The kicker on the slope's piste (`SLOPE.kickerZ`), approached from
 * `back` m up the piste at `kmh`. */
export function atKicker(S, back, kmh) {
  const z = S.SLOPE.kickerZ - back;
  return { x: S.pisteX(z), z, heading: 0, speed: kmh / 3.6 };
}

/** A flight a kicker would have thrown, staged in the air over packed snow:
 * 1.2 m up, climbing 8.5 m/s, at 80 km/h — about 1.9 s up. */
export const LAUNCH = { x: 1500, z: 200, heading: 0, speed: 22, height: 1.2, vy: 8.5 };

/** A trick scenario: the staged launch, skied in a tricks run. */
export function trick(id, title, input) {
  return {
    id,
    title,
    mode: "tricks",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => LAUNCH,
    seconds: 4,
    view: "profile",
    input: (t) => ({ ...TUCK, ...input(t) }),
    measure: tricked,
  };
}

/** The pitch's strips: a 20° groomed schuss and the same in powder — each
 * 4 km long, falling past z = 200. */
export const schussStrip = (S, packed = 1) =>
  S.flatLevel({ packed, grade: PITCH, slopeFrom: 200, size: 4000 });
/** Pushed off at 3 m/s at the top of the pitch. */
export const TOP = { x: 2000, z: 210, heading: 0, speed: 3 };
/** Down the pitch already, at `kmh`. */
export const onPitch = (kmh) => ({ x: 2000, z: 600, heading: 0, speed: kmh / 3.6 });
