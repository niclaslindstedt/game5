// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S RIDES (`make jolt ARGS=--family=ride`): the player's own
// figure on and off every ride and in every special state the game draws
// him in — a chair, a T-bar and a gondola from the skate up to the load
// line to the stand-up at the top (the lift labs' own stages,
// `pwa/src/tools/lift-stage.ts`); the snowmobile got on, ridden and got
// off; the helicopter's skid boarded, flown and pushed off; the paramotor
// launched, flown and dropped; the balloon's basket walked and jumped out
// of; the jump plane's door, the freefall, the opening, the canopy, the
// cut-away and the landing; the wingsuit off its hover, pulled and landed
// on his boots; a ski jump off the bar; a buzzed fall got up from; the
// afterski's door; the town's walk; a building's door.
//
// Each scene is skied by the real engine on the bot's own hands where it
// has them (`sledPilot`, `pilotInput`, `paraPilot`, `balloonPilot`,
// `chutePilot`, `wingsuitInput`, `botInput`) and the machine press where
// the player's would be, and the figure is handed what the renderer hands
// it a frame (`machines.ts`'s `seat`): the skid's or the harness's perch,
// the snowmobile's stand, the basket's walk, the skydive's and the
// wingsuit's shapes — the very reckonings, out of `ride-perch.ts`. A
// scene's `game()` steps the run on to the moment it is about (stepping is
// cheap; only the drawn frames cost), so the generated map (seed 38, built
// once and kept by the engine) is the one wait.

import { join } from "node:path";

/** The generated map every scene on one is ridden on. */
const SEED = 38;

export async function rideFamily(ctx, rider) {
  const { E, S, root } = ctx;
  const R = await import(join(root, "pwa/src/game/ride-perch.ts"));
  const SD = await import(join(root, "pwa/src/game/skier-skydive.ts"));
  const WS = await import(join(root, "pwa/src/game/skier-wingsuit.ts"));
  const WL = await import(join(root, "pwa/src/game/wingsuit-look.ts"));
  const LS = await import(join(root, "pwa/src/tools/lift-stage.ts"));
  const N = E.NEUTRAL_INPUT;
  const hz = E.TUNING.physicsHz;
  // One map object for every scene: the generator keeps its build, but a
  // map handed back fresh loses all a run works out once a map and keeps.
  let built = null;
  const level = () => (built ??= E.levelFor({ seed: SEED, mode: "free" }));
  const free = (o = {}) =>
    E.createGame({ level: level(), mode: "free", crowd: 0, quiet: true, ...o });
  /** Step `s` for `seconds` on `hands(s)`, or until `done(s)`. */
  const run = (s, seconds, hands = () => N, done = () => false) => {
    for (let i = 0; i < Math.round(seconds * hz) && !done(s); i++) E.step(s, hands(s));
    return s;
  };
  /** The machine press, once a ride: true the first time `t` passes each
   * of `times` (kept on the state, so a scene ridden twice presses twice). */
  const pressed = new WeakMap();
  const pressAt = (s, t, ...times) => {
    const k = pressed.get(s) ?? 0;
    if (k < times.length && t >= times[k]) {
      pressed.set(s, k + 1);
      return true;
    }
    return false;
  };
  const with_ = (hands, press) => (press ? { ...hands, machine: true } : hands);

  /** THE MACHINES' HAND ON THE FIGURE (`machines.ts`'s `seat`), a frame:
   * the helicopter's skid and the paramotor's harness (each scene built
   * only where the run's rules carry it), the snowmobile's boards, the
   * skydive's or the wingsuit's shapes, the basket's walk. */
  const seatOf = () => {
    const heli = R.createHeliPerch();
    const para = R.createParaPerch();
    const walk = R.createBasketWalk();
    let paraBuilt = false;
    return (model, s, dt) => {
      const machines = !!s.rules.heli;
      if (machines && s.para) paraBuilt = true;
      model.setPerch((machines ? heli(s) : null) ?? (paraBuilt ? para(s) : null) ?? null);
      model.setSled(s.rules.sled ? R.sledStandOf(s) : null);
      const suit = !!s.wingsuit;
      model.setSkydive(
        machines && !suit ? SD.skydiveShapeOf(s.chute ?? null, !!s.plane?.rider) : null,
      );
      model.setWingsuit?.(
        suit
          ? WS.wingsuitShapeOf(s.chute ?? null, !!s.plane?.rider, (s.wingsuit?.hover ?? 0) > 0)
          : null,
      );
      const walked = walk(s.balloon, dt);
      if (walked) model.setBasket(true, walked);
      else model.setBasket(false);
    };
  };
  /** A scene with the machines' hand on him: a fresh one a ride (it
   * keeps the seat's smoothing and the walk's strides). */
  const scene = (o) => {
    const game = o.game;
    let seat = null;
    o.game = () => {
      seat = seatOf();
      return game();
    };
    o.seat = (model, s, dt) => seat(model, s, dt);
    return o;
  };

  // ── THE LIFTS: the lift labs' six stages, from a little before the
  // carrier takes him (the skate up the lane and the wait with it) or
  // stands him off, to a while after.
  const stage = (id, title, after) => {
    const { top } = LS.stageOf(id);
    // Ridden from where the stage stands him up (a lift's foot rolling in,
    // or carried the last seconds to its top) until `after` s past its key
    // moment — the carrier taking him, or stood off — read off the events.
    let end = Infinity;
    let walked = false;
    return scene({
      id,
      title,
      get seconds() {
        return Math.min(end, 120);
      },
      game() {
        end = Infinity;
        walked = false;
        return LS.stageState(id, SEED, undefined, 0);
      },
      input(t, s) {
        for (const e of s.events) {
          if (e.kind === "lift" && e.phase === (top ? "off" : "take")) end = t + after;
        }
        // Walked out of a gondola, he clicks back in and skates off on the
        // tuck, as the lift flow lab's rider does.
        if (s.skier.town) walked = true;
        return walked && !s.skier.town && !s.skier.lift ? { ...N, tuck: 1 } : N;
      },
    });
  };
  const lifts = [
    stage("chair-load", "skated up the lane, scooped up by the chair and carried", 8),
    stage("chair-unload", "carried to the top, stood off and down the ramp", 5),
    stage("tbar-pick", "onto the track, the bar coming round and the pull", 8),
    stage("tbar-release", "towed to the let-go and skiing away", 5),
    stage("gondola-in", "through the door, the cabin come round and stepped into", 8),
    stage("gondola-out", "out of the cabin, the walk with the pair and clicked in", 16),
  ];

  // ── THE SNOWMOBILE.
  const sled = [
    scene({
      id: "sled-on",
      title: "stood beside the snowmobile, on on the press, ridden away",
      seconds: 6,
      game() {
        const s = free();
        const k = s.sled;
        E.standSkier(s, k.x + 1.6, k.z, k.heading);
        return s;
      },
      input: (t, s) => (s.sled.rider ? E.sledPilot(s) : with_(N, pressAt(s, t, 1))),
    }),
    scene({
      id: "sled-ride",
      title: "riding it up the hill on the bot's hands",
      seconds: 10,
      game: () => run(free({ sled: true }), 1, (s) => E.sledPilot(s)),
      input: (_t, s) => E.sledPilot(s),
    }),
    scene({
      id: "sled-off",
      title: "braked to a stop and hopped off on the press",
      seconds: 6,
      game: () => run(free({ sled: true }), 4, (s) => E.sledPilot(s)),
      input: (t, s) => (t < 2.5 ? { ...N, brake: 1 } : with_(N, pressAt(s, t, 2.5))),
    }),
  ];

  // ── THE HELICOPTER.
  const heliHands = (aim) => (s) => E.pilotInput(s, aim(s));
  const heli = [
    scene({
      id: "heli-on",
      title: "stood beside the skid, sat on it on the press, lifted off",
      seconds: 6,
      game() {
        const s = free();
        const h = s.heli;
        E.standSkier(
          s,
          h.x - Math.cos(h.heading) * 2.2,
          h.z + Math.sin(h.heading) * 2.2,
          h.heading,
        );
        return s;
      },
      input: (t, s) =>
        s.heli.rider
          ? E.pilotInput(s, { x: s.heli.x, z: s.heli.z, height: 20 })
          : with_(N, pressAt(s, t, 0.8)),
    }),
    scene({
      id: "heli-flight",
      title: "sat on the skid, flown out and up",
      seconds: 10,
      game: () => free({ heli: true }),
      input: (_t, s) => E.pilotInput(s),
    }),
    (() => {
      let aim = null;
      return scene({
        id: "heli-drop",
        title: "hovering 8 m up and pushed off onto the snow",
        seconds: 5,
        game() {
          const s = free({ heli: true });
          aim = { x: s.heli.x, z: s.heli.z - 60, height: 8 };
          return run(
            s,
            12,
            heliHands(() => aim),
          );
        },
        input: (t, s) => (s.heli.rider ? with_(E.pilotInput(s, aim), pressAt(s, t, 1)) : N),
      });
    })(),
    scene({
      id: "heli-off",
      title: "on the skid on the pad, stepped off on the press",
      seconds: 4,
      game: () => free({ heli: true }),
      input: (t, s) =>
        with_({ ...N, heli: { collective: 0, pitch: 0, roll: 0, pedal: 0 } }, pressAt(s, t, 1)),
    }),
  ];

  // ── THE PARAMOTOR.
  const para = [
    scene({
      id: "para-launch",
      title: "skied off the summit under the wing and lifted off",
      seconds: 16,
      game: () => free({ para: true }),
      input: (_t, s) => E.paraPilot(s),
    }),
    scene({
      id: "para-flight",
      title: "flown in the harness on the bot's hands",
      seconds: 12,
      game: () => run(free({ para: true }), 25, (s) => E.paraPilot(s)),
      input: (_t, s) => E.paraPilot(s),
    }),
    scene({
      id: "para-drop",
      title: "the rig dropped low over the snow, skied on",
      seconds: 6,
      game: () =>
        run(
          free({ para: true }),
          120,
          (s) => E.paraPilot(s),
          (s) => s.t > 20 && s.para.flying && s.para.agl < 6,
        ),
      input: (t, s) => with_(E.paraPilot(s), pressAt(s, t, 0.5)),
    }),
  ];

  // ── THE HOT AIR BALLOON.
  const balloon = [
    scene({
      id: "basket-walk",
      title: "walked about the basket and turned on the spot",
      seconds: 9,
      game: () => free({ balloon: true }),
      input: (t) =>
        t < 2
          ? { ...N, lean: 1 }
          : t < 4
            ? { ...N, steer: 1 }
            : t < 6
              ? { ...N, lean: -1 }
              : t < 7.5
                ? { ...N, steer: -1, lean: 0.5 }
                : N,
    }),
    scene({
      id: "basket-out",
      title: "stood in the tethered basket, stepped out on the press",
      seconds: 4,
      game: () => run(free({ balloon: true }), 1),
      input: (t, s) => with_(N, pressAt(s, t, 1)),
    }),
    scene({
      id: "basket-jump",
      title: "over the side 600 m up, the freefall",
      seconds: 6,
      game() {
        const s = E.createGame({
          level: S.flatLevel({ size: 4000 }),
          mode: "free",
          balloon: true,
          crowd: 0,
          quiet: true,
        });
        const b = s.balloon;
        b.mode = "flown";
        b.grounded = false;
        b.y = s.level.groundAt(b.x, b.z) + 600;
        b.vx = b.vy = b.vz = 0;
        return run(s, 0.5);
      },
      input: (t, s) => with_(N, pressAt(s, t, 1)),
    }),
  ];

  // ── THE JUMP PLANE AND THE SKYDIVE, over the flat map.
  const SIZE = 4000;
  const sky = (o = {}) =>
    E.createGame({
      level: S.flatLevel({ size: SIZE }),
      mode: "free",
      plane: true,
      crowd: 0,
      quiet: true,
      ...o,
    });
  const dive = (at) => {
    const s = sky();
    E.skydiveAt(s, { x: SIZE / 2, z: SIZE / 2 - 1000, ...at });
    return s;
  };
  const chute = [
    scene({
      id: "plane-door",
      title: "stood in the door on the jump run, out, into the freefall",
      seconds: 8,
      game() {
        const s = sky();
        E.planeAloft(s, {
          x: SIZE / 2,
          y: 2500,
          z: 800,
          heading: 0,
          speed: E.PLANE.pilot.jumpRun,
          power: 0.5,
        });
        return s;
      },
      input: (t, s) => with_(s.plane?.rider ? E.botInput(s) : N, pressAt(s, t, 2)),
    }),
    scene({
      id: "chute-open",
      title: "pulled at 1,000 m: the opening to the canopy",
      seconds: 9,
      game: () =>
        run(
          dive({ agl: 1150, fall: 55 }),
          10,
          () => N,
          (s) => s.chute.agl <= 1000,
        ),
      input: (t, s) => with_(N, pressAt(s, t, 0.5)),
    }),
    scene({
      id: "chute-cutaway",
      title: "the main cut away, the reserve pulled",
      seconds: 9,
      game: () => run(dive({ agl: 900, mode: "open" }), 1),
      input: (t, s) => with_(N, pressAt(s, t, 1.5, 3.5)),
    }),
    scene({
      id: "chute-land",
      title: "flown down onto the snow and the canopy let go",
      seconds: 14,
      game: () =>
        run(
          dive({ agl: 300, mode: "open" }),
          120,
          (s) => E.chutePilot(s),
          (s) => s.chute.agl < 25,
        ),
      input: (_t, s) => E.chutePilot(s),
    }),
  ];

  // ── THE WINGSUIT, off the hover on the generated map.
  const suitDress = (G) => {
    const outfit = G.SLOT_DRESS[0].outfit;
    return { outfit, suit: WL.suitOf(outfit) };
  };
  const suitRun = () => free({ wingsuit: true });
  const hands = (s) => E.wingsuitInput(s);
  const wingsuit = [
    scene({
      id: "suit-exit",
      title: "on the hover's skid, the jump and the glide",
      seconds: 12,
      dress: suitDress,
      game: suitRun,
      input: (_t, s) => hands(s),
    }),
    scene({
      id: "suit-pull",
      title: "the pull and the BASE canopy opening",
      seconds: 10,
      dress: suitDress,
      game: () =>
        run(suitRun(), 300, hands, (s) =>
          s.chute &&
          s.chute.mode !== "ready" &&
          s.chute.mode !== "exit" &&
          s.chute.mode !== "freefall"
            ? true
            : false,
        ),
      input: (_t, s) => hands(s),
    }),
    scene({
      id: "suit-land",
      title: "landed on his boots under the canopy, walking",
      seconds: 12,
      dress: suitDress,
      game: () => run(suitRun(), 400, hands, (s) => s.chute?.mode === "open" && s.chute.agl < 20),
      input: (_t, s) => hands(s),
    }),
  ];

  // ── THE SKI JUMP, sat on the bar to the out-run.
  const jump = [
    scene({
      id: "ski-jump",
      title: "on the bar, the in-run, the take-off, the flight, the telemark",
      seconds: 18,
      game: () =>
        E.createGame({
          level: level(),
          mode: "skiJump",
          spec: E.skisById("albatross"),
          quiet: true,
        }),
      input: (_t, s) => E.botInput(s),
    }),
  ];

  // ── ON FOOT: a buzzed fall got up from, the afterski's door, the town,
  // a building's door.
  const PITCH = S.flatLevel({ packed: 1, grade: 0.2, slopeFrom: 150, size: 3000 });
  const foot = [
    scene({
      id: "fetch",
      title: "a buzzed fall: lain, got up, walked to the skis, clicked in",
      seconds: 30,
      game() {
        const s = E.createGame({ level: PITCH, rivals: 0, countdown: 0, quiet: true });
        s.rules = { ...s.rules, afterski: true, course: false };
        E.placeRun(s, { x: PITCH.size / 2, z: 400, heading: 0, speed: 10 });
        s.skier.buzz = 0.8;
        run(s, 0.2);
        E.throwRider(s, "roll", { x: 0, y: 0, z: 10 }, []);
        return s;
      },
      input: () => N,
    }),
    scene({
      id: "afterski",
      title: "in at the lodge's door, a beer and a dance, out again",
      seconds: 12,
      game() {
        const s = free();
        const door = E.doorOf(E.lodgesOf(s.level)[0]);
        E.standSkier(s, door.x, door.z, door.heading);
        return s;
      },
      input: (t, s) => with_(N, pressAt(s, t, 0.5, 9)),
    }),
    scene({
      id: "town",
      title: "stopped on a street, out of the bindings, the pair shouldered, walked",
      seconds: 4 + E.TOWN.out + E.TOWN.pick + 4,
      game() {
        const s = free();
        const v = E.villageOf(s.level);
        const st = [...v.streets].sort((a, b) => b.points.length - a.points.length)[0];
        const i = Math.floor(st.points.length * 0.35);
        const [a, b] = [st.points[i], st.points[i + 3]];
        const heading = Math.atan2(b.x - a.x, b.z - a.z);
        E.placeRun(s, {
          x: a.x - Math.sin(heading) * 14,
          z: a.z - Math.cos(heading) * 14,
          heading,
          speed: 7,
        });
        return s;
      },
      input: (t) => (t > 4 + E.TOWN.out + E.TOWN.pick ? { ...N, tuck: 1 } : N),
    }),
    scene({
      id: "door",
      title: "a building's door: reached for, opened, walked through",
      seconds: 8,
      game() {
        const s = free();
        const door = E.buildingDoors(s.level)[0];
        const f = E.doorFrame(door);
        const p = E.doorPoint(f, 0, 2);
        E.placeRun(s, { x: p.x, z: p.z, heading: Math.atan2(f.x - p.x, f.z - p.z) });
        s.skier.vx = s.skier.vy = s.skier.vz = 0;
        return s;
      },
      input: (t, s) => with_(N, pressAt(s, t, 0.3)),
    }),
  ];

  return {
    id: "ride",
    // Read in the world: getting on and off, the engine puts him where the
    // craft or the cabin has him in a step, and the drawing walks him there.
    say: "the player on and off every ride and on foot, as the model draws him (in the world)",
    scenes: [
      ...lifts,
      ...sled,
      ...heli,
      ...para,
      ...balloon,
      ...chute,
      ...wingsuit,
      ...jump,
      ...foot,
    ].map((scene) => Object.assign(scene, { world: true })),
    ride: rider,
  };
}
