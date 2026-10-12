// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S PEOPLE (`make jolt ARGS=--family=crowd,people`): the free
// ride's people on foot as THE GAME DRAWS THEM. The crowd on its skis is
// `jolt-crowd.mjs`'s; here are the civilians (`civilian-plan.ts`), the dog
// walkers and their dogs (`dog-walk-pose.ts`), a civilian knocked over by a
// skier (`civilian-hits.ts`, `civilian-knock.ts`) and the rescue crew on the
// next run (`rescue-plan.ts`).
//
// Every one of them but the knocked is a PURE FUNCTION OF THE CLOCK, so no
// ride is skied: a frame's pose is asked of the plan at the frame's time and
// posed exactly as the views pose it — `civilians-view.ts`' yaw and
// `civilianDials` (a skater's: the crowd's `dialsOf` on the snow's slope),
// `dogs-view.ts`' yaw and scale and `dogDials`, `rescue-view.ts`' bearers
// turned to their heading and the casualty laid through `lyingMatrix` —
// with the joints blended off the same skeletons the figures are built at.
// The scenes are FOUND in the plan: the first person of a role seen going
// from one thing to the next, a window round it.
//
// The knocked civilian is the game's own knock, as the knocks sheet stages
// it: a skier driven through a person in his routine (`collide`), every
// step after it `stepKnocks`, drawn on the ragdoll (`knockedPose`) while he
// is on it, walking back to his place after, and handed back to his routine
// once home — the view's three ways of drawing him and its two hand-offs.
// In the WORLD frame: a walker is a metre or two a second, a few m/s² of
// his own.

import { join } from "node:path";

import { blendPoints, freeLevel, moved, posedPoints, throughMatrix, yawed } from "./jolt-posed.mjs";

export { crowdFamily } from "./jolt-crowd.mjs";

/** How long a person's routine is searched for a scene, s, and how finely. */
const SEARCH = 600;
const LOOK = 0.25;
/** The hour the terraces' afterski dances at (the map's own is midday). */
const AFTERSKI = 17;
/** A skater's stride (`civilians-view.ts`' `SKATE_STRIDE`), m. */
const SKATE_STRIDE = 2.4;
/** The skier the knocked civilian is struck by (the knocks sheet's): his
 * reach, height, mass, where on the body he strikes and how much he lifts;
 * coming at this speed, m/s, and pulling up this long after the blow, s. */
const SKIER = { r: 0.36, height: 1.6, mass: 86, high: 1.05, lift: 0.22 };
const KNOCK_SPEED = 5;
const KNOCK_PULL = 0.6;
/** A knock is followed this long, s — the fall, the get-up, the walk back
 * and a few seconds of his routine again. */
const KNOCK_FOR = 30;

/** A person on foot's joints: his skeleton without the skis and poles the
 * crowd's shares with him (a civilian has neither). */
function footPoints(p) {
  const out = posedPoints(p);
  for (const k of Object.keys(out))
    if (k.startsWith("ski_") || k.startsWith("basket_")) delete out[k];
  return out;
}

/** A dog's skeleton (`DogSkel`) as named points: the body front, middle
 * and back, the neck, the skull, each leg's joints and the tail. */
function dogPoints(s) {
  const out = {};
  const r = s.rings;
  out.chest = r[0].c;
  out.belly = r[Math.floor(r.length / 2)].c;
  out.rump = r[r.length - 1].c;
  out.neck = s.neck[0];
  out.poll = s.neck[1];
  out.skull = s.head.at;
  ["fore_l", "fore_r", "hind_l", "hind_r"].forEach((name, k) => {
    const g = s.legs[k];
    out[`${name}.top`] = g.top;
    out[`${name}.mid`] = g.mid;
    out[`${name}.low`] = g.low;
    out[`${name}.paw`] = g.paw;
  });
  out.tail_root = s.tail[0];
  out.tail_tip = s.tail[s.tail.length - 1];
  return out;
}

/** Joints renamed `who.name`, for a scene of several figures. */
function prefixed(who, joints, into) {
  for (const [k, v] of Object.entries(joints)) into[`${who}.${k}`] = v;
  return into;
}

export async function peopleFamily(ctx) {
  const { E, THREE } = ctx;
  const R = (m) => import(join(ctx.root, `pwa/src/game/${m}.ts`));
  const [
    plans,
    moves,
    shapes,
    rig,
    walk,
    walkPose,
    dogPose,
    hits,
    knockMod,
    knockPose,
    rescue,
    crewMod,
  ] = await Promise.all([
    R("civilian-plan"),
    R("civilian-moves"),
    R("civilian-shapes"),
    R("crowd-rig"),
    R("dog-walk"),
    R("dog-walk-pose"),
    R("dog-pose"),
    R("civilian-hits"),
    R("civilian-knock"),
    R("civilian-knock-pose"),
    R("rescue-plan"),
    R("rescue-crew"),
  ]);
  const level = freeLevel(ctx);
  const plan = plans.civilianPlanFor(level);
  const hour = plans.civilianHour(level);
  const dogs = walk.dogPlanFor(level);
  const frame = 1 / ctx.hz;

  // --- the skeletons, built once a body ---------------------------------
  const footTargets = new Map();
  const civilianSkel = (body) => {
    if (!footTargets.has(body))
      footTargets.set(
        body,
        shapes.civilianTargets(body).map((t) => footPoints(t.posed)),
      );
    return footTargets.get(body);
  };
  const skiTargets = new Map();
  const skaterSkel = (body) => {
    if (!skiTargets.has(body))
      skiTargets.set(body, rig.crowdTargets(rig.CROWD_LOOKS[body]).map(posedPoints));
    return skiTargets.get(body);
  };
  const dogTargets = new Map();
  const dogSkel = (kind) => {
    if (!dogTargets.has(kind)) {
      dogTargets.set(kind, [
        dogPoints(dogPose.dogSkel(kind, "stand")),
        ...dogPose.DOG_POSES.map((t) => dogPoints(dogPose.dogSkel(kind, t))),
      ]);
    }
    return dogTargets.get(kind);
  };
  const crewSkel = new Map();
  const bearerSkel = (body) => {
    if (!crewSkel.has(body))
      crewSkel.set(
        body,
        crewMod.crewTargets(body).map((t) => footPoints(t.posed)),
      );
    return crewSkel.get(body);
  };

  // --- a civilian drawn as `civilians-view.ts` draws him ------------------
  const dials = new Float32Array(moves.CIVILIAN_POSES.length);
  const skiDials = new Float32Array(rig.CROWD_POSES.length);
  const skater = {
    id: 0,
    body: "man",
    crouch: 0.2,
    lean: 0,
    plough: 0,
    across: 0,
    fall: 0,
    fallSide: 1,
    push: 0,
    pole: 0,
    mode: "ski",
    airAt: 0,
    airT: 0,
    speed: 0,
    turnSide: 0,
    turnT: 0,
    turnHeld: 0,
  };
  const normal = { x: 0, y: 1, z: 0 };
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  /** A civilian's joints off his pose at `t` (`id` his dials' phase). */
  const drawCivilian = (c, i, pose, t, id) => {
    if (c.skis) {
      // On his skis: the crowd's figure on the snow's slope.
      const moving = pose.activity === "skate";
      skater.id = 50000 + i;
      skater.body = c.body;
      skater.speed = moving ? c.leg.speed : 0;
      skater.push = moving ? 1 : 0;
      skater.pole = pose.walked / SKATE_STRIDE;
      rig.dialsOf(skater, skiDials, t, 0);
      level.normalAt(pose.x, pose.z, normal);
      up.set(normal.x, normal.y, normal.z);
      fwd.set(Math.sin(pose.heading), 0, Math.cos(pose.heading));
      right.crossVectors(up, fwd).normalize();
      fwd.crossVectors(right, up).normalize();
      basis.makeBasis(right, up, fwd);
      quat.setFromRotationMatrix(basis);
      m.compose(pos.set(pose.x, level.groundAt(pose.x, pose.z), pose.z), quat, one);
      return throughMatrix(blendPoints(skaterSkel(c.body), skiDials), m.elements);
    }
    moves.civilianDials(pose, t, id, dials);
    return yawed(blendPoints(civilianSkel(c.body), dials), pose.x, pose.y, pose.z, pose.heading);
  };

  // --- the scenes, found in the plans -----------------------------------
  const scenes = [];
  const pose = plans.freshCivilianPose();
  /** The first civilian of `role` (and `ok`) seen going from `from` to
   * `to` (null: anything), at `at` the hour, with a window round it. */
  const civilian = (id, title, role, from, to, lead, tail, { ok = () => true, at = hour } = {}) => {
    for (let i = 0; i < plan.people.length; i++) {
      const c = plan.people[i];
      if (c.role !== role || !ok(c)) continue;
      let was = null;
      for (let t = 0; t < SEARCH; t += LOOK) {
        plans.civilianAt(plan, i, t, at, pose);
        if (!pose.shown) {
          was = null;
          continue;
        }
        const now = pose.activity;
        if (
          was !== null &&
          now !== was &&
          (from === null || was === from) &&
          (to === null || now === to) &&
          t - lead > 0
        ) {
          scenes.push({
            id,
            title,
            seconds: lead + tail,
            draw: () => {
              const out = [];
              for (let u = t - lead; u <= t + tail; u += frame) {
                plans.civilianAt(plan, i, u, at, pose);
                if (!pose.shown) continue;
                out.push({
                  t: u - (t - lead),
                  joints: drawCivilian(c, i, pose, u, i),
                  phase: pose.activity,
                });
              }
              return out;
            },
          });
          return;
        }
        was = now;
      }
    }
  };
  civilian(
    "lift-sweep",
    "the lift crew taking up the broom",
    "liftAttendant",
    "stand",
    "sweep",
    2,
    6,
  );
  civilian(
    "lift-wave",
    "the lift crew waving, then to the shovel",
    "liftAttendant",
    "wave",
    "shovel",
    4,
    6,
  );
  civilian("patrol-talk", "a patroller turning to talk", "patrol", "stand", "talk", 2, 6);
  civilian("worker", "a worker taking up his shovel", "worker", "stand", "shovel", 2, 6);
  civilian("snowball", "a snowball thrown", "snowballer", "stand", "throw", 2, 5);
  civilian("roller", "a child's ball rolled to the snowman", "roller", "roll", "build", 3, 6);
  civilian("roller-back", "the child walking back for the next", "roller", "build", "walk", 3, 5);
  civilian("walker-stop", "a walker stopping on his round", "walker", "walk", "stand", 3, 5);
  civilian("walker-go", "a walker setting off again", "walker", null, "walk", 3, 5);
  civilian("stroller", "a stroller stopping to wave", "stroller", "walk", "wave", 3, 5);
  civilian("terrace", "a terrace sitter lifting his drink", "terraceSitter", "sit", "drink", 2, 6);
  civilian("lounger", "a lounger in a deck chair drinking", "lounger", "lounge", "drink", 2, 6);
  civilian("rester", "sat in the snow, turning to talk", "rester", "sit", "talk", 2, 6);
  civilian("cocoa", "a guest with a cocoa", "cocoa", "drink", "stand", 2, 6);
  civilian("dancer", "a partier dancing, then drinking", "partier", "dance", "drink", 6, 4, {
    at: AFTERSKI,
  });
  civilian(
    "dancer-cheer",
    "a partier cheering, then dancing again",
    "partier",
    "cheer",
    "dance",
    3,
    6,
    { at: AFTERSKI },
  );
  civilian("skater-stop", "a skier on the base pulling up", "baseSkier", "skate", "stand", 3, 5, {
    ok: (c) => c.skis,
  });
  civilian("skater-go", "a skier on the base skating off", "baseSkier", "stand", "skate", 3, 5, {
    ok: (c) => c.skis,
  });

  // The dog walkers and their dogs.
  if (dogs) {
    const dpose = walkPose.freshDogPose();
    const dogDials = new Float32Array(dogPose.DOG_POSES.length);
    const drawDog = (h, d, t) => {
      walkPose.dogAt(dogs, h, d, t, hour, dpose);
      if (!dpose.shown) return null;
      const dog = dogs.households[h].dogs[d];
      dogPose.dogDials(dpose, t, dog.id, dogDials);
      return yawed(
        blendPoints(dogSkel(dog.kind), dogDials),
        dpose.x,
        dpose.y,
        dpose.z,
        dpose.heading,
        dog.scale,
      );
    };
    const drawWalker = (h, t) => {
      walkPose.dogWalkerAt(dogs, h, 0, t, hour, pose);
      if (!pose.shown) return null;
      // The owner is drawn as a civilian of his household's body.
      moves.civilianDials(pose, t, 9000 + h * 2, dials);
      return yawed(
        blendPoints(civilianSkel(dogs.households[h].walker), dials),
        pose.x,
        pose.y,
        pose.z,
        pose.heading,
      );
    };
    /** The first dog seen going into `act`, with its owner in the frame. */
    const dogScene = (id, title, act, lead, tail) => {
      for (let h = 0; h < dogs.households.length; h++) {
        let was = null;
        for (let t = 0; t < SEARCH * 2; t += LOOK) {
          walkPose.dogAt(dogs, h, 0, t, hour, dpose);
          if (!dpose.shown) {
            was = null;
            continue;
          }
          if (was !== null && was !== act && dpose.act === act && t - lead > 0) {
            scenes.push({
              id,
              title,
              seconds: lead + tail,
              draw: () => {
                const out = [];
                for (let u = t - lead; u <= t + tail; u += frame) {
                  const dog = drawDog(h, 0, u);
                  if (!dog) continue;
                  const joints = prefixed("dog", dog, {});
                  const owner = drawWalker(h, u);
                  if (owner) prefixed("owner", owner, joints);
                  out.push({ t: u - (t - lead), joints, phase: `${dpose.act}/${pose.activity}` });
                }
                return out;
              },
            });
            return;
          }
          was = dpose.act;
        }
      }
    };
    dogScene("dog-sit", "a dog sitting at the kerb", "sit", 3, 6);
    dogScene("dog-sniff", "a dog stopping to sniff", "sniff", 3, 6);
    dogScene("dog-poop", "a dog squatting, the owner stooping to bag it", "poop", 3, 14);
    dogScene("dog-mark", "a dog lifting a leg", "mark", 3, 6);
    dogScene("dog-walk", "a dog setting off on its walk again", "walk", 3, 6);
  }

  // A civilian knocked over by a skier and walking back to his place.
  const knock = (id, title, pick) => {
    const i = plan.people.findIndex(pick);
    if (i < 0) return;
    scenes.push({ id, title, seconds: KNOCK_FOR, draw: () => knocked(i) });
  };
  const knocked = (i) => {
    const c = plan.people[i];
    const state = E.createGame({ level, seed: level.seed, mode: "free", quiet: true, crowd: 0 });
    const people = hits.peopleOf(level, hour);
    const knocks = hits.createKnocks();
    const dt = E.TUNING.dt;
    // Struck a few seconds into the routine, from his left.
    const hitAt = 6;
    plans.civilianAt(plan, i, hitAt, hour, pose);
    const dir = pose.heading - Math.PI / 2;
    const ux = Math.sin(dir);
    const uz = Math.cos(dir);
    const y = level.groundAt(pose.x, pose.z);
    let hx = pose.x - ux * KNOCK_SPEED * 1;
    let hz = pose.z - uz * KNOCK_SPEED * 1;
    const t0 = hitAt - 1;
    const steps = Math.round(KNOCK_FOR / dt);
    const every = Math.max(1, Math.round(frame / dt));
    knocks.t = t0;
    let blow = -1;
    const out = [];
    for (let s = 0; s <= steps; s++) {
      const t = t0 + s * dt;
      state.t = t;
      const moving = blow < 0 || t - blow < KNOCK_PULL;
      const h = {
        x: hx,
        y: y - 0.2,
        z: hz,
        vx: moving ? ux * KNOCK_SPEED : 0,
        vz: moving ? uz * KNOCK_SPEED : 0,
        heading: dir,
        front: 0,
        back: 0,
        half: 0,
        from: -1,
        ...SKIER,
      };
      if (s > 0) {
        hits.collide(knocks, state, people, [h], dt);
        hits.stepKnocks(knocks, state, people, 1);
        hx += h.vx * dt;
        hz += h.vz * dt;
      }
      const k = knocks.map.get(i);
      if (k && blow < 0) blow = t;
      if (s % every) continue;
      let joints;
      let phase;
      if (k && knockMod.onRagdoll(k)) {
        const b = k.rag;
        joints = moved(
          footPoints(knockPose.knockedPose(b.points, c.body, [b.x, b.y, b.z])),
          b.x,
          b.y,
          b.z,
        );
        phase = k.phase;
      } else {
        plans.civilianAt(plan, i, t, hour, pose);
        if (k) walkBack(k, pose);
        if (!pose.shown) continue;
        joints = drawCivilian(c, i, pose, t, i);
        phase = k ? "back" : pose.activity;
      }
      out.push({ t: t - t0, joints, phase });
    }
    return out;
  };
  /** Walking back to his routine (`civilians-view.ts`' `walkBack`). */
  const walkBack = (k, out) => {
    out.x = k.bx;
    out.z = k.bz;
    out.y = level.groundAt(k.bx, k.bz);
    out.heading = k.heading;
    out.activity = "walk";
    out.walked = k.walked;
    out.clock = k.walked;
    out.span = 1;
    out.carry = "none";
    out.seat = null;
    out.bag = false;
    out.shown = true;
  };
  knock(
    "knock-stood",
    "a patroller knocked down by a skier",
    (c) => c.role === "patrol" && !c.leg && c.home.seat === null,
  );
  knock(
    "knock-walker",
    "a walker knocked down on his round",
    (c) => c.role === "walker" && !!c.leg && !c.skis,
  );

  // The rescue crew on the next run: the scoop, the carry, the loading.
  const pts = level.track.points;
  const spot = pts[Math.floor(pts.length * 0.45)];
  const rp = rescue.planRescue(level, spot);
  const rframe = rescue.freshRescueFrame();
  const crewDials = new Float32Array(crewMod.CREW_POSES.length);
  const casualtyBody = "man";
  const casualtySkel = crewMod.casualtyTargets(casualtyBody).map((t) => footPoints(t.posed));
  const height = rig.CROWD_LOOKS[casualtyBody].height;
  const lying = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
  );
  lying.setPosition(0, 0, -height / 2);
  const euler = new THREE.Euler();
  const placed = new THREE.Matrix4();
  const names = rescue.BEARERS.map((b, j) =>
    b.role === "patrol" ? `patrol_${j === 2 ? "l" : "r"}` : b.role,
  );
  const drawRescue = (t) => {
    rescue.rescueAt(level, rp, t, rframe);
    const joints = {};
    rescue.BEARERS.forEach((b, j) => {
      const c = rframe.crew[j];
      if (!c.shown) return;
      crewMod.crewDials(c.move, crewDials);
      prefixed(
        names[j],
        yawed(blendPoints(bearerSkel(b.body), crewDials), c.x, c.y, c.z, c.heading),
        joints,
      );
    });
    const v = rframe.casualty;
    if (v.shown) {
      euler.set(-v.pitch, v.heading, -v.roll, "YXZ");
      quat.setFromEuler(euler);
      placed.compose(pos.set(v.x, v.y, v.z), quat, one).multiply(lying);
      prefixed(
        "casualty",
        throughMatrix(blendPoints(casualtySkel, [v.sprawl]), placed.elements),
        joints,
      );
    }
    return joints;
  };
  const rescueScene = (id, title, from, to) =>
    scenes.push({
      id,
      title,
      seconds: to - from,
      draw: () => {
        const out = [];
        for (let u = from; u <= to; u += frame)
          out.push({ t: u - from, joints: drawRescue(u), phase: rescuePhase(rp.at, u) });
        return out;
      },
    });
  const A = rp.at;
  rescueScene("rescue-scoop", "the crew getting him onto the board", A.scoop.down - 2, A.rise + 1);
  rescueScene(
    "rescue-carry",
    "the crew lifting the stretcher and setting off",
    A.rise - 1,
    A.carry + 8,
  );
  rescueScene(
    "rescue-load",
    "the stretcher loaded and the crew climbing in",
    A.raise - 4,
    A.clear + 4,
  );

  const drawn = new Map();
  return {
    id: "people",
    say: "the people on foot, the dog walkers and their dogs, a civilian knocked over and the rescue crew, posed off their plans as the views pose them (world frame)",
    scenes: scenes.map((s) => ({ id: s.id, title: s.title, seconds: s.seconds })),
    ride(scene) {
      if (!drawn.has(scene.id))
        drawn.set(scene.id, scenes.find((s) => s.id === scene.id)?.draw() ?? []);
      return drawn.get(scene.id);
    },
  };
}

/** Which part of the rescue a moment is in, for the table. */
function rescuePhase(at, t) {
  const order = [
    ["walk up", 0],
    ["scoop", at.scoop.down],
    ["rise", at.rise],
    ["carry", at.carry],
    ["raise", at.raise],
    ["inch", at.inch],
    ["climb", at.climb],
    ["slide", at.slide],
    ["clear", at.clear],
    ["lift", at.lift],
  ];
  let now = order[0][0];
  for (const [name, from] of order) if (t >= from) now = name;
  return now;
}
