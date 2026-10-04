// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S SCENARIOS — each a map, a moment to stand the skier at
// (`placeRun`), a scripted input and the numbers that say how it went.
// Staged on the SYNTHETIC maps (`tests/support/synthetic.ts`), so what is
// measured is the skier and nothing the generator happened to build: a drag
// strip of packed snow or of powder, flat or falling at a grade, and the
// slope with its kicker, its hills and its lone tree.
//
// A scenario is:
//   id, title       the name on the command line and over the picture
//   level(S)        the map, off the synthetic module `S`
//   place(S)        the moment (`RunMoment`)
//   seconds         how long it is skied
//   input(t, st)    the controls at run time t, s since the start
//   view            "profile" (distance along the way against height) or
//                   "plan" (the path from above)
//   measure(run)    the scenario's own numbers, as [label, value] pairs,
//                   off the recorded run (see `ride-lab.mjs`'s `record`)
//   mode            optional: the mode whose rules the run is dealt — the
//                   trick scenarios ride "tricks", so the strokes are read
//   technique       optional: how the skier works the ski (`technique.ts`)
//                   over the mode's own — the slalom scenarios ride
//                   "slalom"
//   snow            optional: the run's snow dial (`SNOW_DIAL`) — the deep
//                   scenarios ski a metre of fresh snow (2.5)

import {
  TUCK,
  IDLE,
  hold,
  tail,
  fmt,
  schuss,
  turn,
  flight,
  wipeout,
  jumped,
  landed,
  rock,
  dug,
  trench,
  tricked,
  DEEP,
  planedAfter,
  deepSchuss,
  cruise,
  balance,
  stopped,
  worstSlip,
  atKicker,
  trick,
  schussStrip,
  TOP,
  onPitch,
  rhythmOf,
} from "./ride-helpers.mjs";

/** A RHYTHM OF TURNS, read after the first two seconds: how long a turn
 * is (the edge from one side to the other), its peak edge, the radius a
 * tenth of the frames turn tighter than, the most yaw, the mean speed, and
 * the skid angle — the skis' line off the way — on the mean and at its
 * most. */
function rhythm(run) {
  const r = rhythmOf(run.frames.filter((f) => f.t >= 2));
  return [
    ["turn s", fmt(r.turnS)],
    ["edge peak deg", fmt((r.edgePeak ?? 0) * 57.3, 0)],
    ["radius m", r.radius === null ? "—" : fmt(r.radius, 1)],
    ["yaw most rad/s", fmt(r.yawMost, 2)],
    ["speed km/h", fmt(r.speed * 3.6, 1)],
    ["skid deg", fmt(r.skid * 57.3, 1)],
    ["skid most deg", fmt(r.skidMost * 57.3, 1)],
    ["thrown", r.thrown ? "yes" : "no"],
  ];
}

/** The fastest the snow slid across the skis over a run, m/s. */
const maxSideSlip = (run) => run.frames.reduce((m, f) => Math.max(m, f.sideSlip), 0);

export const SCENARIOS = [
  {
    id: "rest",
    title: "at rest on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      return [
        ["CoG over snow m", fmt(f.y - f.ground, 3)],
        ["knees bent m", fmt(f.skiComp, 3)],
        ["sink m", fmt(f.sink, 3)],
        ["pitch deg", fmt(f.pitch * 57.3, 2)],
        ["drift m/s", fmt(f.speed, 3)],
      ];
    },
  },
  {
    id: "rest-powder",
    title: "at rest in powder",
    level: (S) => S.flatLevel({ packed: 0 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      return [
        ["CoG over snow m", fmt(f.y - f.ground, 3)],
        ["sink m", fmt(f.sink, 3)],
        ["pitch deg", fmt(f.pitch * 57.3, 2)],
      ];
    },
  },
  {
    id: "poles",
    title: "poling from rest across the flat, the tuck held",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 150, heading: 0 }),
    seconds: 10,
    view: "profile",
    input: () => TUCK,
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      return [
        ["at 5 s km/h", fmt(run.frames.find((x) => x.t >= 5).speed * 3.6, 1)],
        ["at 10 s km/h", fmt(f.speed * 3.6, 1)],
        ["metres", fmt(f.dist, 1)],
      ];
    },
  },
  {
    id: "pivot",
    title: "stood still on the flat, only the right key held for 3 s: stepped round on the spot",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 300, heading: 0 }),
    seconds: 4,
    view: "plan",
    input: (t) => ({ ...IDLE, steer: t < 3 ? 1 : 0 }),
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      const turned = (until) => {
        const fs = run.frames.filter((x) => x.t <= until);
        let a = 0;
        for (let i = 1; i < fs.length; i++) {
          const d = fs[i].heading - fs[i - 1].heading;
          a += Math.atan2(Math.sin(d), Math.cos(d));
        }
        return a * (180 / Math.PI);
      };
      return [
        ["at 1 s deg", fmt(turned(1), 0)],
        ["at 3 s deg", fmt(turned(3), 0)],
        ["let go deg", fmt(turned(Infinity), 0)],
        ["moved m", fmt(f.dist, 2)],
      ];
    },
  },
  {
    id: "skate",
    title: "hands off from a shuffle across the flat: skating, then double-poling",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 150, heading: 0, speed: 1 }),
    seconds: 12,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const at = (t) => run.frames.find((x) => x.t >= t) ?? run.frames[run.frames.length - 1];
      const f = run.frames[run.frames.length - 1];
      return [
        ["at 1 s km/h", fmt(at(1).speed * 3.6, 1)],
        ["at 3 s km/h", fmt(at(3).speed * 3.6, 1)],
        ["at 6 s km/h", fmt(at(6).speed * 3.6, 1)],
        ["at 12 s km/h", fmt(f.speed * 3.6, 1)],
        ["metres", fmt(f.dist, 1)],
      ];
    },
  },
  {
    id: "schuss",
    title: "a tuck down the 20° groomed pitch from a push-off",
    level: (S) => schussStrip(S, 1),
    place: () => TOP,
    seconds: 30,
    view: "profile",
    input: () => TUCK,
    measure: schuss,
  },
  {
    id: "schuss-tall",
    title: "standing tall down the 20° groomed pitch from a push-off",
    level: (S) => schussStrip(S, 1),
    place: () => TOP,
    seconds: 30,
    view: "profile",
    input: () => IDLE,
    measure: schuss,
  },
  {
    id: "powder",
    title: "a tuck down the 20° pitch in powder",
    level: (S) => schussStrip(S, 0),
    place: () => TOP,
    seconds: 30,
    view: "profile",
    input: () => TUCK,
    measure: (run) => {
      const rows = schuss(run);
      const planed = run.frames.find((f) => f.sink < 0.05);
      rows.push(["planed at km/h", planed ? fmt(planed.speed * 3.6, 0) : "—"]);
      return rows;
    },
  },
  {
    id: "brake",
    title: "a snowplough from 80 km/h on flat packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 80 / 3.6 }),
    seconds: 20,
    view: "profile",
    input: () => ({ ...IDLE, brake: 1 }),
    measure: (run) => stopped(run, 80),
  },
  {
    id: "plough",
    title: "a snowplough held down the 20° groomed pitch from 60 km/h",
    level: (S) => schussStrip(S, 1),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 60 / 3.6 }),
    seconds: 12,
    view: "profile",
    input: () => ({ ...IDLE, brake: 1 }),
    measure: (run) => {
      const at = (t) =>
        run.frames.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b));
      return [
        ["at 4 s km/h", fmt(at(4).speed * 3.6, 0)],
        ["at 12 s km/h", fmt(at(12).speed * 3.6, 0)],
        ["pitch deg", fmt(tail(run, 8, (f) => f.pitch) * 57.3, 1)],
      ];
    },
  },
  {
    id: "hockey-stop",
    title: "a hockey stop from 60 km/h on flat packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 60 / 3.6 }),
    seconds: 6,
    view: "plan",
    input: () => ({ ...IDLE, brake: 1, steer: 1 }),
    measure: (run) => [
      ...stopped(run, 60),
      ["skis across deg", fmt(worstSlip(run) * 57.3, 0)],
      ["roll deg", fmt(run.frames.reduce((m, f) => Math.max(m, Math.abs(f.roll)), 0) * 57.3, 0)],
      ...wipeout(run).slice(0, 1),
    ],
  },
  {
    id: "carve",
    title: "a 0.6 edge held at 60 km/h down the 20° groomed pitch",
    level: (S) => schussStrip(S),
    place: () => onPitch(60),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: 0.6, ...hold(st, 60) }),
    measure: turn,
  },
  {
    id: "carve-fast",
    title: "a 0.4 edge held at 100 km/h down the 20° groomed pitch",
    level: (S) => schussStrip(S),
    place: () => onPitch(100),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: 0.4, ...hold(st, 100) }),
    measure: turn,
  },
  {
    id: "carve-hard",
    title: "full edge cut hard (the back key after the edge) at 80 km/h down the pitch",
    level: (S) => schussStrip(S),
    place: () => onPitch(80),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: 1, carve: true, ...hold(st, 80) }),
    measure: turn,
  },
  {
    id: "carve-full",
    title: "the same full edge at 80 km/h, not cut hard",
    level: (S) => schussStrip(S),
    place: () => onPitch(80),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: 1, ...hold(st, 80) }),
    measure: turn,
  },
  {
    id: "slalom-cut",
    title: "full edge cut hard at 45 km/h down the 20° pitch, the slalom racer's technique",
    level: (S) => schussStrip(S),
    place: () => onPitch(45),
    seconds: 3,
    view: "plan",
    technique: "slalom",
    input: (t) => ({ ...TUCK, tuck: 0.3, steer: t >= 0.3 ? 1 : 0, carve: t >= 0.3 }),
    measure: turn,
  },
  {
    id: "slalom-rhythm",
    title:
      "a turn every 0.9 s cut hard from 40 km/h down the 20° pitch, the slalom racer's technique",
    level: (S) => schussStrip(S),
    place: () => onPitch(40),
    seconds: 9,
    view: "plan",
    technique: "slalom",
    // Full edge one way, then the other, every 0.9 s — and back toward the
    // fall line whenever he has come more than 50° off it.
    input: (t, st) => {
      const side = Math.floor(t / 0.9) % 2 === 0 ? 1 : -1;
      const h = st.skier.heading;
      return { ...TUCK, tuck: 0.3, steer: Math.abs(h) > 0.9 ? -Math.sign(h) : side, carve: true };
    },
    measure: rhythm,
  },
  {
    id: "jump-tap",
    title: "the jump tapped at 50 km/h on flat packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 50 / 3.6 }),
    seconds: 3,
    view: "profile",
    input: (t) => ({ ...IDLE, jump: t >= 0.5 && t < 0.55 }),
    measure: (run) => [...jumped(run), ...flight(run).slice(1, 6)],
  },
  {
    id: "jump-full",
    title: "the jump loaded for 2.5 s at 50 km/h on flat packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 50 / 3.6 }),
    seconds: 5,
    view: "profile",
    input: (t) => ({ ...IDLE, jump: t >= 0.5 && t < 3 }),
    measure: (run) => [...jumped(run), ...flight(run).slice(1, 6)],
  },
  {
    id: "turn-in",
    title: "the skis thrown onto full edge at 80 km/h down the 20° pitch",
    level: (S) => schussStrip(S),
    place: () => onPitch(80),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: t >= 0.5 ? 1 : 0, ...hold(st, 80) }),
    // HOW QUICKLY HE ANSWERS THE EDGE: the time from the edge going over to
    // nine tenths of the yaw rate he holds, how far round he has come a
    // second after, and the lateral g over the second after the turn-in
    // (a full edge at 80 asks more than the edges hold, and the skid past
    // it scrubs the speed, so the bend is read at the speed he came in
    // with rather than settled) — the three numbers that separate a pair
    // that darts from one that runs wide.
    measure: (run) => {
      const window = (f) => f.t >= 1 && f.t < 2;
      const held = tail({ frames: run.frames.filter(window) }, 0, (f) => f.wy);
      const at = run.frames.find((f) => f.t >= 0.5 && Math.abs(f.wy) >= 0.9 * Math.abs(held));
      const h0 = run.frames.find((f) => f.t >= 0.5).heading;
      const h1 = run.frames.find((f) => f.t >= 1.5).heading;
      let turned = h1 - h0;
      turned = Math.atan2(Math.sin(turned), Math.cos(turned));
      const v = tail({ frames: run.frames.filter(window) }, 0, (f) => f.speed);
      return [
        ["to 90% yaw s", at ? fmt(at.t - 0.5) : "—"],
        ["turned in 1 s deg", fmt(Math.abs(turned) * 57.3, 0)],
        ["settled g", fmt((v * Math.abs(held)) / 9.81, 2)],
        ["radius m", fmt(v / Math.abs(held), 1)],
        ["roll deg", fmt(tail({ frames: run.frames.filter(window) }, 0, (f) => f.roll) * 57.3, 1)],
      ];
    },
  },
  ...[
    ["turn-lean", "the weight thrown forward", { lean: -1 }],
    ["turn-back", "the weight thrown back", { lean: 1 }],
    ["turn-brake", "the skid put on", { tuck: 0, brake: 1 }],
  ].map(([id, what, lever]) => ({
    id,
    title: `settled in a 70 km/h bend at 0.5 edge, then ${what}`,
    level: (S) => schussStrip(S),
    place: () => onPitch(70),
    seconds: 5,
    view: "plan",
    // THE LEVER IN A BEND: three seconds settled at a governed speed, then
    // the lever for a second and a half. The weight forward loads the tips
    // and tightens the carve, back lets it run, and the skid puts the skis
    // across the way. What moved is read at the end of the lever against
    // the settled bend.
    input: (t, st) => ({ ...TUCK, steer: 0.5, ...(t < 3 ? hold(st, 70) : lever) }),
    measure: (run) => {
      const before = run.frames.filter((f) => f.t > 2.5 && f.t <= 3);
      const after = run.frames.filter((f) => f.t > 3 && f.t <= 4.5);
      const mean = (fs, g) => fs.reduce((sum, f) => sum + g(f), 0) / Math.max(1, fs.length);
      let slip = 0;
      for (let i = 1; i < after.length; i++) {
        const a = after[i - 1];
        const b = after[i];
        const way = Math.atan2(b.x - a.x, b.z - a.z);
        const d = Math.atan2(Math.sin(b.heading - way), Math.cos(b.heading - way));
        if (Math.abs(d) > Math.abs(slip)) slip = d;
      }
      const tip0 = mean(before, (f) => f.tipLoad);
      const tip1 = mean(after.slice(-60), (f) => f.tipLoad);
      const yaw0 = mean(before, (f) => f.wy);
      const yaw1 = mean(after.slice(-60), (f) => f.wy);
      const v1 = mean(after.slice(-60), (f) => f.speed);
      return [
        ["tips' load %", `${fmt(tip0 * 100, 0)}→${fmt(tip1 * 100, 0)}`],
        ["yaw deg/s", `${fmt(yaw0 * 57.3, 0)}→${fmt(yaw1 * 57.3, 0)}`],
        ["radius m", `${fmt(70 / 3.6 / Math.abs(yaw0), 0)}→${fmt(v1 / Math.abs(yaw1), 0)}`],
        ["worst slip deg", fmt(slip * 57.3, 0)],
        ["speed km/h", fmt(v1 * 3.6, 0)],
      ];
    },
  })),
  {
    id: "brake-turn",
    title: "the skid thrown into a turn from 100 km/h",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 100 / 3.6 }),
    seconds: 5,
    view: "plan",
    input: (t) => ({ ...IDLE, brake: 1, steer: t > 0.3 ? 0.6 : 0 }),
    measure: (run) => {
      const slip = worstSlip(run);
      const stop = run.frames.find((f) => f.speed < 0.3);
      return [
        ["worst slip deg", fmt(slip * 57.3, 0)],
        ["spun", slip > Math.PI / 3 ? "YES" : "no"],
        ["stop m", stop ? fmt(stop.dist, 1) : "—"],
        ...wipeout(run).slice(0, 1),
      ];
    },
  },
  {
    id: "catch",
    title: "an edge caught: slid sideways at 45 km/h with the skis stood up on their edge",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 300, heading: Math.PI / 2, speed: 0 }),
    // Facing across the strip and sliding down it: the snow crosses the
    // skis at the whole of the speed, and the edge is already over.
    prepare: (st) => {
      st.skier.vx = 0;
      st.skier.vz = 45 / 3.6;
      st.skier.edge = 1;
    },
    seconds: 4,
    view: "plan",
    input: () => ({ ...IDLE, steer: 1 }),
    measure: (run) => [["worst side slip m/s", fmt(maxSideSlip(run), 1)], ...wipeout(run)],
  },
  {
    id: "catch-held",
    title: "a hockey stop let go at 70 km/h onto full edge — the edge bites and is held",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 300, heading: 0, speed: 70 / 3.6 }),
    seconds: 6,
    view: "plan",
    // Half a second of hockey stop puts the skis across the way at speed;
    // the brake let go with the edge still full is a ski stood over while
    // the snow slides across it — a save, short of a high-side.
    input: (t) => ({ ...IDLE, steer: 1, brake: t < 0.5 ? 1 : 0 }),
    measure: (run) => [["worst side slip m/s", fmt(maxSideSlip(run), 1)], ...wipeout(run)],
  },
  {
    id: "carve-powder",
    title: "a 0.6 edge held at 50 km/h down the 20° pitch in powder",
    level: (S) => schussStrip(S, 0),
    place: () => onPitch(50),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: 0.6, ...hold(st, 50) }),
    measure: turn,
  },
  {
    id: "kicker",
    title: "the slope's kicker at 75 km/h",
    level: (S) => S.syntheticLevel(),
    place: (S) => atKicker(S, 70, 75),
    seconds: 6,
    view: "profile",
    input: () => TUCK,
    measure: flight,
  },
  {
    id: "kicker-slow",
    title: "the slope's kicker at 45 km/h",
    level: (S) => S.syntheticLevel(),
    place: (S) => atKicker(S, 50, 45),
    seconds: 6,
    view: "profile",
    input: (t, st) => ({ ...TUCK, ...hold(st, 45) }),
    measure: flight,
  },
  {
    id: "drop",
    title: "dropped from 3 m at 70 km/h onto flat packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 4 }),
    seconds: 4,
    view: "profile",
    input: () => TUCK,
    measure: flight,
  },
  {
    id: "drop-true",
    title: "dropped 1.5 m at 70 km/h, skis true, onto the groomer",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 2.5, roll: 0, pitch: 0 }),
    seconds: 4,
    view: "profile",
    input: () => TUCK,
    measure: (run) => [...landed(run), ...wipeout(run).slice(0, 1)],
  },
  {
    id: "drop-rolled",
    title: "dropped 1.5 m at 70 km/h rolled 20°, onto the groomer",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({
      x: 1500,
      z: 200,
      heading: 0,
      speed: 70 / 3.6,
      height: 2.5,
      roll: 0.35,
      pitch: 0,
    }),
    seconds: 4,
    view: "profile",
    input: () => TUCK,
    measure: (run) => [...landed(run), ...wipeout(run).slice(0, 1)],
  },
  {
    id: "drop-big",
    title: "dropped 8 m at 70 km/h, skis true, onto the groomer",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 9, roll: 0, pitch: 0 }),
    seconds: 4,
    view: "profile",
    input: () => TUCK,
    measure: (run) => [...landed(run), ...wipeout(run).slice(0, 1)],
  },
  {
    id: "drop-big-powder",
    title: "dropped 8 m at 70 km/h, skis true, into a metre of powder",
    level: (S) => S.flatLevel({ packed: 0 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 9, roll: 0, pitch: 0 }),
    snow: 2.5,
    seconds: 4,
    view: "profile",
    input: () => TUCK,
    measure: (run) => [...landed(run), ...wipeout(run).slice(0, 1)],
  },
  {
    id: "drop-big-tilted",
    title: "dropped 8 m at 70 km/h tips 15° down, into a metre of powder",
    level: (S) => S.flatLevel({ packed: 0 }),
    place: () => ({
      x: 1500,
      z: 200,
      heading: 0,
      speed: 70 / 3.6,
      height: 9,
      roll: 0,
      pitch: -0.26,
    }),
    snow: 2.5,
    seconds: 4,
    view: "profile",
    input: () => TUCK,
    measure: (run) => [...landed(run), ...wipeout(run).slice(0, 1)],
  },
  {
    id: "climb",
    title: "a 30-degree powder slope run at uphill from 70 km/h, poling",
    level: (S) => S.flatLevel({ packed: 0, grade: 0.58, slopeFrom: 400 }),
    // The strip falls along +z past 400: facing −z from below is facing up
    // the face, 150 m of it, out onto the flat at its top.
    place: () => ({ x: 1500, z: 550, heading: Math.PI, speed: 70 / 3.6 }),
    seconds: 12,
    view: "profile",
    input: () => TUCK,
    measure: (run) => {
      const top = run.frames.reduce((b, f) => (f.y > b.y ? f : b));
      return [
        ["climbed m", fmt(top.ground - run.frames[0].ground, 1)],
        ["stalled at s", fmt(run.frames.find((f) => f.t > 1 && f.speed < 1)?.t ?? null)],
        ["slid back to km/h", fmt(-run.frames[run.frames.length - 1].way * 3.6, 0)],
        ["resets", run.events.filter((e) => e.kind === "reset").length],
      ];
    },
  },
  {
    id: "wall",
    title: "a 45-degree powder face run at uphill from 90 km/h",
    level: (S) => S.flatLevel({ packed: 0, grade: 1, slopeFrom: 400 }),
    place: () => ({ x: 1500, z: 550, heading: Math.PI, speed: 90 / 3.6 }),
    seconds: 10,
    view: "profile",
    input: () => TUCK,
    measure: (run) => {
      const top = run.frames.reduce((b, f) => (f.y > b.y ? f : b));
      return [
        ["climbed m", fmt(top.ground - run.frames[0].ground, 1)],
        ["stalled at s", fmt(run.frames.find((f) => f.t > 1 && f.speed < 1)?.t ?? null)],
        ["resets", run.events.filter((e) => e.kind === "reset").length],
        ...wipeout(run).slice(0, 1),
      ];
    },
  },
  {
    id: "sidehill",
    title: "across a 40-degree groomed slope at 40 km/h",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.84, slopeFrom: 400 }),
    place: () => ({ x: 1400, z: 440, heading: Math.PI / 2, speed: 40 / 3.6 }),
    seconds: 6,
    view: "plan",
    input: () => ({ ...TUCK, tuck: 0.5 }),
    measure: (run) => {
      const worst = run.frames.reduce((m, f) => Math.max(m, Math.abs(f.roll)), 0);
      return [
        ["worst roll deg", fmt(worst * 57.3, 0)],
        ["over", worst > 1.4 ? "yes" : "no"],
        ["slid down m", fmt(run.frames[run.frames.length - 1].z - 440, 1)],
      ];
    },
  },
  {
    id: "tree",
    title: "a trunk met at 50 km/h",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({ x: S.LONE_TREE.x + 0.4, z: S.LONE_TREE.z - 40, heading: 0, speed: 50 / 3.6 }),
    seconds: 7,
    view: "plan",
    input: () => TUCK,
    measure: (run) => {
      const hit = run.events.find((e) => e.kind === "hit");
      const after = hit ? run.frames.find((f) => f.t > hit.t + 0.05) : null;
      return [
        ["hit km/h", hit ? fmt(hit.speed * 3.6, 1) : "—"],
        ["after km/h", after ? fmt(after.speed * 3.6, 1) : "—"],
        ["yaw after deg", after ? fmt(after.heading * 57.3, 1) : "—"],
        ...wipeout(run).filter(([k]) => k !== "at km/h"),
      ];
    },
  },
  {
    id: "tree-glance",
    title: "a trunk clipped at a crawl in a snowplough — skied on through",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({ x: S.LONE_TREE.x + 0.5, z: S.LONE_TREE.z - 12, heading: 0, speed: 16 / 3.6 }),
    seconds: 5,
    view: "plan",
    input: () => ({ ...IDLE, brake: 0.7 }),
    measure: (run) => {
      const hit = run.events.find((e) => e.kind === "hit");
      return [["hit km/h", hit ? fmt(hit.speed * 3.6, 1) : "—"], ...wipeout(run)];
    },
  },
  {
    id: "shoulder",
    title: "a trunk taken on the shoulder: slid into it sideways at 18 km/h, skiing past at 50",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({ x: S.LONE_TREE.x - 0.8, z: S.LONE_TREE.z, heading: 0, speed: 14 }),
    prepare: (st) => {
      st.skier.vx = 5;
    },
    seconds: 4,
    view: "plan",
    input: () => TUCK,
    measure: (run) => {
      const hit = run.events.find((e) => e.kind === "hit");
      return [["hit km/h", hit ? fmt(hit.speed * 3.6, 1) : "—"], ...wipeout(run)];
    },
  },
  {
    id: "nose-save",
    title: "a landing taken 40 degrees over the tips at 60 km/h — slapped down and saved",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({
      x: 1500,
      z: 200,
      heading: 0,
      speed: 60 / 3.6,
      height: 2.5,
      vy: -3,
      pitch: -0.7,
    }),
    seconds: 6,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const land = run.events.find((e) => e.kind === "land");
      return [["impact m/s", land ? fmt(land.impact) : "—"], ...wipeout(run)];
    },
  },
  {
    id: "nose-in",
    title: "a landing taken 57 degrees over the tips at 60 km/h — the tips spear the snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({
      x: 1500,
      z: 200,
      heading: 0,
      speed: 60 / 3.6,
      height: 2.5,
      vy: -3,
      pitch: -1,
    }),
    seconds: 6,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const land = run.events.find((e) => e.kind === "land");
      return [["impact m/s", land ? fmt(land.impact) : "—"], ...wipeout(run)];
    },
  },
  {
    id: "drop-side",
    title: "dropped 1.5 m at 70 km/h onto his side",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 2.5, roll: 1.5 }),
    seconds: 6,
    view: "profile",
    input: () => TUCK,
    measure: (run) => [...landed(run), ...wipeout(run)],
  },
  {
    id: "rollover",
    title: "thrown onto his side at 70 km/h",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 1.6, roll: 1.35 }),
    seconds: 6,
    view: "plan",
    input: () => TUCK,
    measure: wipeout,
  },
  {
    id: "stuck",
    title: "poling from rest in a metre of fresh snow, bogged, then rocked out",
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 300, heading: 0 }),
    seconds: 12,
    view: "profile",
    // The poles pushed until he has sunk 15 cm in, then rocked on a light
    // push until the hole is packed back, then turned away and skied off.
    input: (t, st) => {
      const c = st.skier;
      if (!dug.has(st) && c.trench >= 0.15) dug.set(st, "rock");
      if (dug.get(st) === "rock" && c.trench === 0) dug.set(st, "away");
      const phase = dug.get(st);
      return phase === "rock"
        ? rock(t, 1.2, 0.35)
        : phase === "away"
          ? { ...TUCK, steer: 1 }
          : TUCK;
    },
    measure: trench,
  },
  {
    id: "stuck-held",
    title: "poling from rest in a metre of fresh snow, the push held",
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 300, heading: 0 }),
    seconds: 14,
    view: "profile",
    input: () => TUCK,
    measure: trench,
  },
  {
    id: "rest-deep",
    title: "at rest in a metre of fresh snow",
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      return [
        ["CoG over snow m", fmt(f.y - f.ground, 3)],
        ["sink m", fmt(f.sink, 3)],
        ["pitch deg", fmt(f.pitch * 57.3, 2)],
      ];
    },
  },
  {
    id: "schuss-deep",
    title: "a tuck down the 20° pitch in a metre of fresh snow",
    level: (S) => schussStrip(S, 0),
    snow: DEEP,
    place: () => TOP,
    seconds: 20,
    view: "profile",
    input: () => TUCK,
    measure: deepSchuss,
  },
  {
    id: "schuss-deep-back",
    title: "a tuck down the 20° pitch in a metre, leaning back to lift the tips",
    level: (S) => schussStrip(S, 0),
    snow: DEEP,
    place: () => TOP,
    seconds: 20,
    view: "profile",
    input: () => ({ ...TUCK, lean: 1 }),
    measure: deepSchuss,
  },
  {
    id: "bog-deep",
    title: "planing through a metre at 70 km/h, stood up 4 s, then tucked again",
    level: (S) => schussStrip(S, 0),
    snow: DEEP,
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 70 / 3.6 }),
    seconds: 16,
    view: "profile",
    input: (t) => (t >= 2 && t < 6 ? IDLE : TUCK),
    measure: (run) => {
      const low = run.frames.filter((f) => f.t >= 6).reduce((b, f) => (f.speed < b.speed ? f : b));
      const deepest = run.frames.reduce((m, f) => Math.max(m, f.sink), 0);
      const planed = planedAfter(run, 6);
      return [
        ["slowest km/h", fmt(low.speed * 3.6, 0)],
        ["deepest sink m", fmt(deepest, 2)],
        ["back on top at s", planed ? fmt(planed[0], 1) : "—"],
        ["at end km/h", fmt(run.frames[run.frames.length - 1].speed * 3.6, 0)],
      ];
    },
  },
  {
    id: "sidehill-deep",
    title: "across a 10-degree slope in a metre at 20 km/h, hands off",
    level: (S) => S.flatLevel({ packed: 0, grade: 0.18, slopeFrom: 400 }),
    snow: DEEP,
    place: () => ({ x: 1400, z: 440, heading: Math.PI / 2, speed: 20 / 3.6 }),
    seconds: 8,
    view: "plan",
    input: (t, st) => cruise(st, 20),
    measure: balance,
  },
  {
    id: "sidehill-deep-held",
    title: "the same traverse, the weight hung on the uphill ski",
    level: (S) => S.flatLevel({ packed: 0, grade: 0.18, slopeFrom: 400 }),
    snow: DEEP,
    place: () => ({ x: 1400, z: 440, heading: Math.PI / 2, speed: 20 / 3.6 }),
    seconds: 8,
    view: "plan",
    // Heading +x the slope rises to the left, and a skier rolled right is
    // rolled downhill: he hangs his weight uphill (the edge toward it) as
    // far as he is leaning over, to stay level.
    input: (t, st) => ({
      ...cruise(st, 20),
      steer: Math.max(-1, Math.min(1, -3 * st.skier.roll - 0.3 * st.skier.wz)),
    }),
    measure: balance,
  },
  trick("backflip", "a backflip off a staged launch over flat snow", (t) => ({
    lean: t < 1.2 ? 1 : 0,
  })),
  trick("frontflip", "a front flip over flat snow: the weight thrown forward", (t) => ({
    lean: t < 1.2 ? -1 : 0,
  })),
  trick("spin", "a 360 over flat snow: the edge thrown over", (t) => ({ steer: t < 0.4 ? 1 : 0 })),
  trick("pose", "a spread over flat snow, let go before the landing", (t) => ({
    trick: t < 0.8,
    lean: t < 0.8 ? 1 : 0,
  })),
  {
    id: "kicker-flip",
    title: "the slope's kicker at 75 km/h, a backflip off it",
    mode: "tricks",
    level: (S) => S.syntheticLevel(),
    place: (S) => atKicker(S, 70, 75),
    seconds: 6,
    view: "profile",
    // The lean held from the foot of the ramp — one stroke at the lip — and
    // let go past half a turn; the weight forward checks the last quarter.
    input: (t, st) => {
      const turned = st.tricks.rotation;
      return { ...TUCK, lean: turned < 3.5 && t < 3.2 ? 1 : turned > 5 ? -1 : 0 };
    },
    measure: tricked,
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);
