// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD — the amateurs out on the ski area on a free ride: hundreds of
// people skiing the resort's runs (R27) top to bottom, riding the lifts
// back up, falling over, stopping where they should not, and getting in the
// player's way. What kind of skier each is, and how they come — families,
// friends, ski schools, the lot down from the hut — is `defs/crowd.ts`.
//
// ROUGH AND CHEAP ON PURPOSE. An amateur is not a skier on the snow's
// physics: he is a point sliding along his run's line, kept as how far down
// it he is (`s`) and how far right of it (`d`), with a speed that gravity
// along the run's own pitch feeds and the snow, the air and his turning
// scrub, held to the pace he means to ski at (`cap`). His turns are a wave
// across the piste in the run's own arc — round or sharp, wide or narrow,
// by his style — so he steers for a lateral, never for a point, and a ski
// school's children set to the instructor's wave at their own arc ski in
// his very track. He DECIDES only every `CROWD.think` seconds, staggered
// across the crowd (a stop, a fall, a run off the side, a kicker, room
// from the one ahead, keeping up with his group); between decisions a step
// is a handful of multiplies and one ground sample. Three hundred of them
// cost the step less than one rival does.
//
// THE NETWORK he skis is the resort's runs (`Level.resort`), each with the
// one it merges into: reaching its end he carries on down that one —
// keeping where he is across the snow, so the hand-over is seamless — or,
// at the village, takes a LIFT (`crowd-lift.ts`): skates to its queue at the
// bottom station, rides the carrier that takes him up, and skates off its
// top onto the run his group chose, the leader waiting for the rest. A map
// with no lift to queue at sends him up one unseen until the rest of his
// group is down and the ride (`CROWD.lift`) is over. A map with no resort
// is one run, its piste.
//
// THE PLAYER MEETS THEM as a rival is met (`rivals.ts`): a plan circle each,
// pushed apart by mass with the closing speed traded at
// `CROWD.restitution`, the player's contact reported as a `bump`. Hard
// enough and the amateur goes down; harder and the player does too (a
// `skier` wipeout, `crash.ts`). Amateurs dodge one ahead of them on their
// run, and the player if he is ahead — nobody looks uphill.
//
// THE STREAM is the crowd's own (`CrowdState.rng`, seeded off the run's seed
// with `CROWD_SALT`), so a crowd draws nothing from `state.rng` and a run
// without one is the run it always was.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { PisteGrade } from "../mapgen/grades.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { treesNear } from "./collision.ts";
import {
  dealQueued,
  dealRiding,
  joinQueue,
  onLift,
  stepCrowdLifts,
  type LiftRuns,
} from "./crowd-lift.ts";
import { crashLimit, throwRider } from "./crash.ts";
import {
  CROWD,
  CROWD_GROUPS,
  CROWD_KINDS,
  CROWD_SIZE,
  TURN_STYLES,
  type AmateurKnobs,
  type CrowdBody,
  type CrowdKind,
  type GroupKind,
} from "./defs/crowd.ts";
import { RACE } from "./defs/modes.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import type { Amateur, CrowdGroup, CrowdState, GameEvent, GameState } from "./state.ts";

/** What the crowd's stream is seeded with beside the run's seed. */
const CROWD_SALT = 0x0c40d5;
const G = 9.81;
const dt = TUNING.dt;

/** A run of the network as the crowd skis it. */
export type NetRun = {
  id: string;
  grade: PisteGrade | "road";
  pts: readonly TrackPoint[];
  length: number;
  /** The run it merges into and at what arc of that one; null at the
   * village. */
  into: { run: number; s: number } | null;
  /** Whether it leaves a lift's top station — a run a group can choose —
   * and the lift it leaves the top of. */
  top: boolean;
  from: string;
  /** Every kicker and drop across it: its lip's arc, its lateral, and half
   * its width, m. */
  kickers: { s: number; d: number; half: number }[];
};

export type CrowdNet = { runs: NetRun[] };

const nets = new WeakMap<Level, CrowdNet>();

/** THE NETWORK the crowd skis on a map — its resort's runs, or its piste
 * alone — built once a map. */
export function crowdNet(level: Level): CrowdNet {
  const cached = nets.get(level);
  if (cached) return cached;
  const resort = level.resort;
  const runs: NetRun[] = [];
  if (resort && resort.runs.length > 0) {
    const index = new Map(resort.runs.map((r, i) => [r.id, i]));
    for (const r of resort.runs) {
      if (r.points.length < 2) continue;
      runs.push({
        id: r.id,
        grade: r.kind === "road" ? "road" : r.grade,
        pts: r.points,
        length: r.length,
        into: r.into ? { run: index.get(r.into.run) ?? -1, s: r.into.s } : null,
        top: !r.branch && !r.to,
        from: r.from,
        kickers: [],
      });
    }
    // The ids were indexed before any run was skipped; read them again.
    const kept = new Map(runs.map((r, i) => [r.id, i]));
    for (const r of runs) {
      if (!r.into) continue;
      const target = resort.runs[r.into.run]?.id;
      const at = target === undefined ? undefined : kept.get(target);
      r.into = at === undefined ? null : { run: at, s: r.into.s };
    }
  } else if (level.track.points.length >= 2) {
    runs.push({
      id: "1",
      grade: level.grade ?? "blue",
      pts: level.track.points,
      length: level.track.length,
      into: null,
      top: true,
      from: "",
      kickers: [],
    });
  }
  // Every lip laid across a run: the kickers on it, and the drops.
  const lips = [
    ...(level.kickers ?? []).map((k) => ({ x: k.x, z: k.z, half: k.width / 2 })),
    ...(level.cliffs ?? [])
      .filter((c) => c.onTrack)
      .map((c) => ({ x: c.x, z: c.z, half: c.width / 2 })),
  ];
  for (const lip of lips) {
    for (const r of runs) {
      let best = Infinity;
      let at = -1;
      for (let i = 0; i < r.pts.length; i += 2) {
        const p = r.pts[i];
        const d = hypot(p.x - lip.x, p.z - lip.z);
        if (d < best) {
          best = d;
          at = i;
        }
      }
      if (at < 0 || best > r.pts[at].width / 2) continue;
      const p = r.pts[at];
      r.kickers.push({ s: p.s, d: lateralOf(p, lip.x, lip.z), half: lip.half });
    }
  }
  for (const r of runs) r.kickers.sort((a, b) => a.s - b.s);
  const net = { runs };
  nets.set(level, net);
  return net;
}

/** How far right of a station's line a point is, m. */
function lateralOf(p: TrackPoint, x: number, z: number): number {
  return (x - p.x) * Math.cos(p.heading) - (z - p.z) * Math.sin(p.heading);
}

/** A run read at an arc: its line's point and heading, its width, its pitch
 * (the fall along it, a rise over a run, positive down) and how fast its
 * heading turns, rad/m. */
type Along = { x: number; z: number; heading: number; width: number; pitch: number; bend: number };

function sampleRun(r: NetRun, s: number, out: Along): Along {
  const pts = r.pts;
  const n = pts.length;
  const spacing = r.length / (n - 1);
  let i = clamp(Math.floor(s / spacing), 0, n - 2);
  while (i > 0 && pts[i].s > s) i--;
  while (i < n - 2 && pts[i + 1].s < s) i++;
  const a = pts[i];
  const b = pts[i + 1];
  const span = Math.max(1e-6, b.s - a.s);
  const t = clamp((s - a.s) / span, 0, 1);
  const turn = angleDiff(a.heading, b.heading);
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.heading = a.heading + turn * t;
  out.width = a.width + (b.width - a.width) * t;
  out.pitch = (a.y - b.y) / span;
  out.bend = turn / span;
  return out;
}

const here: Along = { x: 0, z: 0, heading: 0, width: 0, pitch: 0, bend: 0 };
const above: Along = { x: 0, z: 0, heading: 0, width: 0, pitch: 0, bend: 0 };
const trunks: number[] = [];
/** The amateurs on each run this step, by run — scratch, rebuilt a step. */
const onRun: Amateur[][] = [];

const band = (rng: Rng, b: readonly [number, number]): number => rng.range(b[0], b[1]);

/** His knobs, dealt from his kind's bands. */
function dealKnobs(rng: Rng, kind: CrowdKind): AmateurKnobs {
  const k = CROWD_KINDS[kind];
  const style = rng.pick(k.styles);
  return {
    skill: band(rng, k.skill),
    aggression: band(rng, k.aggression),
    offPiste: band(rng, k.offPiste),
    width: band(rng, k.width),
    wobble: band(rng, k.wobble),
    stopper: band(rng, k.stopper),
    jumper: band(rng, k.jumper),
    style,
    turn: band(rng, TURN_STYLES[style].len),
  };
}

function freshAmateur(
  id: number,
  group: number,
  rank: number,
  kind: CrowdKind,
  body: CrowdBody,
  knobs: AmateurKnobs,
  rng: Rng,
): Amateur {
  return {
    id,
    group,
    rank,
    body,
    kind,
    knobs,
    mode: "ski",
    run: 0,
    s: 0,
    d: 0,
    speed: 0,
    yaw: 0,
    centre: 0,
    phase: rng.range(0, Math.PI * 2),
    wander: 0,
    wanderTo: 0,
    kickerAt: NaN,
    kickerD: 0,
    cap: 0,
    timer: 0,
    think: rng.range(0, CROWD.think),
    airT: 0,
    airH: 0,
    airAt: 0,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    lean: 0,
    crouch: 0.3,
    plough: 0,
    across: 0,
    fall: 0,
    fallSide: 1,
    lift: -1,
    carrier: -1,
    seat: 0,
    tx: 0,
    tz: 0,
    ts: 0,
    // His own place in the stroke, off his id rather than the stream: the
    // whole crowd pushes off at once, and at one phase it poles in step.
    pole: id * 2.39996,
    push: 0,
    turnSide: 0,
    turnT: 0,
    turnHeld: 0,
  };
}

/** A group kind, by weight. */
function pickGroup(rng: Rng): GroupKind {
  const kinds = Object.keys(CROWD_GROUPS) as GroupKind[];
  let total = 0;
  for (const k of kinds) total += CROWD_GROUPS[k].weight;
  let at = rng.next() * total;
  for (const k of kinds) {
    at -= CROWD_GROUPS[k].weight;
    if (at <= 0) return k;
  }
  return "solo";
}

/** The body a member of a group wears: a family's second member is the
 * other parent, and a child is a child. */
function bodyFor(rng: Rng, kind: CrowdKind, group: GroupKind, rank: number): CrowdBody {
  if (group === "family" && kind !== "kid") return rng.pick(["man", "woman", "retro"] as const);
  if (group === "school" && rank > 0) return "child";
  return rng.pick(CROWD_KINDS[kind].bodies);
}

/** How much a group would rather ski a run: the colour's crowd per metre of
 * it, and the skill it asks of the group's least skilled — a family goes
 * where the children can. `lengthy` weighs it by its length (where people
 * stand at any moment) rather than by its root (which run they pick). */
function runWeight(r: NetRun, skill: number, lengthy: boolean): number {
  const fits = skill >= CROWD.needs[r.grade] ? 1 : CROWD.lost;
  return CROWD.share[r.grade] * fits * (lengthy ? r.length : Math.sqrt(r.length));
}

/** The network as the lifts read it (`crowd-lift.ts`), once a network. */
const liftRuns = new WeakMap<CrowdNet, LiftRuns>();
function liftRunsOf(net: CrowdNet): LiftRuns {
  let out = liftRuns.get(net);
  if (!out) {
    out = { runs: net.runs, weight: (k, skill) => runWeight(net.runs[k], skill, false) };
    liftRuns.set(net, out);
  }
  return out;
}

function pickRun(rng: Rng, net: CrowdNet, skill: number, anywhere: boolean): number {
  let total = 0;
  for (const r of net.runs) if (anywhere || r.top) total += runWeight(r, skill, anywhere);
  if (total <= 0) return 0;
  let at = rng.next() * total;
  for (let i = 0; i < net.runs.length; i++) {
    const r = net.runs[i];
    if (!anywhere && !r.top) continue;
    at -= runWeight(r, skill, anywhere);
    if (at <= 0) return i;
  }
  return 0;
}

/** Stand a group on a run: the leader furthest down, the rest behind him at
 * the group's gap, each on a line of his own about the piste. */
function launchGroup(crowd: CrowdState, net: CrowdNet, g: CrowdGroup, anywhere: boolean): void {
  const rng = crowd.rng;
  let skill = 1;
  for (const m of g.members) skill = Math.min(skill, crowd.amateurs[m].knobs.skill);
  const run = pickRun(rng, net, skill, anywhere);
  const r = net.runs[run];
  const span = g.gap * (g.members.length - 1);
  const s0 = anywhere ? rng.range(0, Math.max(1, r.length - span - 20)) : 2;
  sampleRun(r, s0 + span, here);
  const half = here.width / 2;
  const centre = rng.range(-0.4, 0.4) * half;
  g.members.forEach((m, k) => {
    const a = crowd.amateurs[m];
    a.mode = "ski";
    a.run = run;
    a.s = s0 + span - k * g.gap;
    a.centre = clamp(
      centre + (g.keep === "loose" ? (k % 2 ? -2.5 : 2.5) * Math.ceil(k / 2) : 0),
      -half + 1,
      half - 1,
    );
    a.d = a.centre;
    a.speed = anywhere ? rng.range(1, 4) : 0;
    a.yaw = 0;
    a.wander = 0;
    a.kickerAt = NaN;
    a.fall = 0;
    a.timer = 0;
    place(a, r, null);
  });
}

/** DEAL THE CROWD: `count` amateurs in their groups, onto the network's
 * runs — most of them on the snow, a share up a lift. Called once, from
 * `createGame`, for a run whose rules ask for a crowd. */
export function createCrowd(state: GameState, count: number): void {
  const net = crowdNet(state.level);
  const rng = createRng((state.seed ^ CROWD_SALT) >>> 0);
  const crowd: CrowdState = { rng, amateurs: [], groups: [], queues: [] };
  state.crowd = crowd;
  if (net.runs.length === 0) return;
  const total = Math.min(CROWD.most, Math.max(0, Math.round(count)));
  while (crowd.amateurs.length < total) {
    const kind = pickGroup(rng);
    const def = CROWD_GROUPS[kind];
    const follow = Math.min(rng.int(def.count[0], def.count[1]), total - crowd.amateurs.length - 1);
    const g: CrowdGroup = {
      kind,
      members: [],
      keep: def.keep,
      gap: def.gap,
      lift: 0,
      queue: -1,
      next: -1,
    };
    const index = crowd.groups.length;
    const lead = rng.pick(def.lead);
    for (let k = 0; k <= follow; k++) {
      // A family's children come first after the parent, so there is one.
      const who = k === 0 ? lead : kind === "family" && k === 1 ? "kid" : rng.pick(def.follow);
      const a = freshAmateur(
        crowd.amateurs.length,
        index,
        k,
        who,
        bodyFor(rng, who, kind, k),
        dealKnobs(rng, who),
        rng,
      );
      if (def.keep === "track" && k > 0) {
        // The snake: the instructor's turns, at the children's own skill.
        const l = crowd.amateurs[crowd.amateurs.length - k].knobs;
        a.knobs = { ...a.knobs, style: l.style, turn: l.turn, width: l.width };
      }
      g.members.push(a.id);
      crowd.amateurs.push(a);
    }
    crowd.groups.push(g);
    if (rng.chance(CROWD.ride.riding) && dealRiding(state, crowd, liftRunsOf(net), g.members)) {
      // Riding a lift already, part-way up.
    } else if (rng.chance(CROWD.lifted)) {
      // In a lift's queue at its foot — or, with none, up one unseen.
      if (!dealQueued(state, crowd, liftRunsOf(net), g.members)) {
        for (const m of g.members) crowd.amateurs[m].mode = "lift";
        g.lift = band(rng, CROWD.lift);
      }
    } else {
      launchGroup(crowd, net, g, true);
    }
  }
}

/** Where (`run`, `s`, `d`) and an air's rise put him on the mountain — on
 * the snow under him, or at the run's top station's height with no map to
 * sample (`level` null, while a crowd is being dealt). */
function place(a: Amateur, r: NetRun, level: Level | null): void {
  sampleRun(r, a.s, here);
  const cx = Math.cos(here.heading);
  const sz = Math.sin(here.heading);
  a.x = here.x + cx * a.d;
  a.z = here.z - sz * a.d;
  const lift = a.mode === "air" ? 4 * a.airH * (a.airAt / a.airT) * (1 - a.airAt / a.airT) : 0;
  a.y = (level ? level.groundAt(a.x, a.z) : r.pts[0].y) + lift;
  a.heading = here.heading + a.yaw;
  a.vx = a.speed * Math.sin(a.heading);
  a.vz = a.speed * Math.cos(a.heading);
}

/** The lateral his turns sweep through now: his line, the wave of his
 * style, an excursion off the side, and a drunk's wander. */
function targetOf(a: Amateur, half: number, t: number): number {
  const k = a.knobs;
  const style = TURN_STYLES[k.style];
  const amp = style.metres ? style.amp * (0.5 + k.width) : style.amp * k.width * half;
  const p = a.phase;
  const wave = style.sharp ? (2 / Math.PI) * Math.asin(Math.sin(p)) : Math.sin(p);
  const sway = k.wobble * (3 * Math.sin(t * 0.7 + a.id) + 1.5 * Math.sin(t * 1.9 + a.id * 3));
  let aim = a.centre + a.wander + amp * wave + sway;
  if (!Number.isNaN(a.kickerAt) && a.kickerAt - a.s < 30) aim = a.kickerD;
  const room = a.wander !== 0 ? half + Math.abs(a.wander) + 6 : half - 0.8;
  return clamp(aim, -room, room);
}

/** The speed he means to ski at: his skill's, as much of it as he dares,
 * his style's, and a slow one on a colour past him. */
function capOf(a: Amateur, grade: PisteGrade | "road"): number {
  const k = a.knobs;
  const S = CROWD.speed;
  if (k.style === "slip") return S.slip;
  let cap = S.base + S.span * Math.pow(k.skill, 1.2) * (0.55 + 0.45 * k.aggression);
  if (k.style === "line") cap *= S.line;
  if (k.skill < CROWD.needs[grade]) cap = Math.min(cap, 2.5 + 5 * k.skill);
  return cap;
}

/** A FALL: down in the snow, sliding, for a few seconds. */
function fallDown(a: Amateur, rng: Rng, side: number): void {
  a.mode = "down";
  a.timer = band(rng, CROWD.fall.lie);
  a.fallSide = side;
  a.kickerAt = NaN;
}

/** WHAT HE DOES NEXT — every `CROWD.think` seconds. */
function decide(state: GameState, crowd: CrowdState, net: CrowdNet, a: Amateur): void {
  const rng = crowd.rng;
  const r = net.runs[a.run];
  sampleRun(r, a.s, here);
  const half = here.width / 2;
  const k = a.knobs;
  const g = crowd.groups[a.group];
  const think = CROWD.think;
  a.cap = capOf(a, r.grade);
  if (a.mode === "down" || a.mode === "air") return;

  // KEEPING UP WITH THE GROUP: a follower skis off his leader.
  const leader = crowd.amateurs[g.members[0]];
  if (a.rank > 0 && leader.mode !== "lift" && leader.run === a.run) {
    const behind = leader.s - a.s;
    const want = a.rank * g.gap;
    if ((leader.mode === "stop" || leader.mode === "down") && behind < want + 8) {
      if (a.mode !== "stop") {
        a.mode = "stop";
        a.timer = 1;
      } else a.timer = Math.max(a.timer, 1);
      a.centre = clamp(leader.d + (a.rank % 2 ? -2 : 2), -half + 1, half - 1);
      return;
    }
    a.cap *= clamp(1 + (behind - want) / 30, 0.6, 1.35);
    if (g.keep === "track") {
      a.centre = leader.centre;
      a.wander = leader.wander;
      a.phase = leader.phase - (Math.PI * behind) / k.turn;
    } else {
      a.wander = leader.wander;
      if (Math.abs(a.centre - leader.centre) > half * 0.6)
        a.centre += (leader.centre - a.centre) * 0.3;
    }
  }

  // THE LEADER WAITS for the last of his group to come down to him — and a
  // parent or an instructor skis at the slowest child's pace to begin with.
  if (a.rank === 0 && g.members.length > 1) {
    if (g.kind === "family" || g.kind === "school") {
      for (const m of g.members) {
        const o = crowd.amateurs[m];
        if (o !== a) a.cap = Math.min(a.cap, capOf(o, r.grade) * 1.1);
      }
    }
    let far = 0;
    for (const m of g.members) {
      const o = crowd.amateurs[m];
      if (o === a || o.mode === "lift") continue;
      // One still on the lift (`crowd-lift.ts`) is waited for at the top,
      // just off it — never from further down, where he only went on ahead.
      if (onLift(o)) {
        if (a.s < CROWD.regroup.top) far = Math.max(far, CROWD.regroup.far + 1);
        continue;
      }
      // How far he has dropped back past his own place in the line.
      const lag = o.run === a.run ? a.s - o.s - o.rank * g.gap : o.mode === "down" ? Infinity : 0;
      far = Math.max(far, lag);
    }
    if (a.mode === "stop" && far > CROWD.regroup.near) {
      a.timer = Math.max(a.timer, 1);
      return;
    }
    if (a.mode === "ski" && far > CROWD.regroup.far) {
      a.mode = "stop";
      a.timer = 2;
      // ...at the side of the piste, as a parent does.
      a.centre = (a.d >= 0 ? 1 : -1) * (half - 2.5);
      return;
    }
  }
  if (a.mode !== "ski") return;

  // A FALL, for nothing: the less skill, the steeper past it, the drunker.
  const past = Math.max(0, CROWD.needs[r.grade] - k.skill);
  const wild = a.speed > a.cap * 1.3 ? 2 : 1;
  const rate =
    CROWD.fall.rate *
    Math.pow(1 - k.skill, 2) *
    (1 + CROWD.fall.steep * past * 4) *
    (1 + CROWD.fall.wobble * k.wobble * 3) *
    wild;
  if (rng.chance((rate / 60) * think)) {
    fallDown(a, rng, rng.chance(0.5) ? 1 : -1);
    return;
  }

  // A STOP — and, the worse he is, the likelier just below a crest.
  if (a.rank === 0 && k.stopper > 0) {
    sampleRun(r, Math.max(0, a.s - CROWD.stop.crestBack), above);
    const crest = here.pitch - above.pitch > CROWD.stop.crestPitch ? CROWD.stop.crest : 1;
    if (rng.chance(((CROWD.stop.rate * k.stopper * crest) / 60) * think)) {
      a.mode = "stop";
      a.timer = band(rng, CROWD.stop.hold);
      // The considerate ones pull over; the stopper stops where he is.
      if (k.stopper < 0.6) a.centre = (a.d >= 0 ? 1 : -1) * (half - 2.5);
      return;
    }
  }

  // OFF THE SIDE into the powder, and back.
  if (a.wander === 0 && k.offPiste > 0 && a.rank === 0) {
    if (rng.chance(((CROWD.wander.rate * k.offPiste) / 60) * think)) {
      const side = rng.chance(0.5) ? 1 : -1;
      a.wander = side * (half + band(rng, CROWD.wander.reach)) - a.centre;
      a.wanderTo = a.s + band(rng, CROWD.wander.run);
    }
  } else if (a.wander !== 0 && (a.s > a.wanderTo || (a.rank > 0 && leader.wander === 0))) {
    a.wander = 0;
  }
  // ...and round the trunks out there: the line ahead blocked, he turns
  // back toward the piste.
  if (Math.abs(a.d) > half - 1) {
    const ax = a.x + Math.sin(a.heading) * 6;
    const az = a.z + Math.cos(a.heading) * 6;
    if (treesNear(state.level, ax, az, CROWD.wander.trunk, trunks).length > 0) {
      const back = a.wander !== 0 ? Math.sign(a.wander) : Math.sign(a.d);
      a.wander -= back * 5;
      if (Math.sign(a.wander) !== back) a.wander = 0;
      a.yaw *= 0.5;
    }
  }

  // A KICKER coming up: the jumper lines up for it.
  if (Number.isNaN(a.kickerAt) && k.jumper > 0) {
    for (const kk of r.kickers) {
      const ahead = kk.s - a.s;
      if (ahead < 8) continue;
      if (ahead > CROWD.kicker.see) break;
      if (rng.chance(k.jumper)) {
        a.kickerAt = kk.s;
        a.kickerD = kk.d;
      } else a.kickerAt = -1;
      break;
    }
    if (a.kickerAt === -1) a.kickerAt = NaN;
  }

  // ROOM: the one ahead on his run, or the player — he gives them a berth
  // and, unless he is the kind that does not, their pace.
  const look = CROWD.room.ahead + a.speed * CROWD.room.time;
  const fx = Math.sin(a.heading);
  const fz = Math.cos(a.heading);
  let dodge = 0;
  let pace = Infinity;
  for (const o of onRun[a.run]) {
    if (o === a || o.mode === "lift" || o.group === a.group) continue;
    const ahead = o.s - a.s;
    if (ahead <= 0 || ahead > look || Math.abs(o.d - a.d) > CROWD.room.berth) continue;
    dodge = o.d >= a.d ? -1 : 1;
    pace = Math.min(pace, o.speed);
  }
  const me = state.skier;
  const px = me.x - a.x;
  const pz = me.z - a.z;
  const pAhead = px * fx + pz * fz;
  const pSide = px * fz - pz * fx;
  if (pAhead > 0 && pAhead < look && Math.abs(pSide) < CROWD.room.berth + 0.6) {
    dodge = pSide >= 0 ? -1 : 1;
    pace = Math.min(pace, me.speed);
  }
  if (dodge !== 0) {
    a.centre = clamp(a.centre + dodge * (CROWD.room.berth + 0.5), -half + 1, half - 1);
    if (k.aggression < 0.6) a.cap = Math.min(a.cap, pace);
  }
}

/** Carry on down the run he merges into — where he is across the snow kept
 * — or, at the village, up a lift. */
function runOut(state: GameState, crowd: CrowdState, net: CrowdNet, a: Amateur): void {
  const r = net.runs[a.run];
  if (r.into && r.into.run >= 0) {
    const next = net.runs[r.into.run];
    sampleRun(next, r.into.s, here);
    a.run = r.into.run;
    a.s = r.into.s + Math.max(0, a.s - r.length);
    a.d = (a.x - here.x) * Math.cos(here.heading) - (a.z - here.z) * Math.sin(here.heading);
    a.centre = clamp(a.d, -here.width / 2 + 1, here.width / 2 - 1);
    a.wander = 0;
    a.kickerAt = NaN;
    return;
  }
  // At the foot of the mountain: into a real lift's queue (`crowd-lift.ts`),
  // or — a map with no lift to queue at — up one unseen.
  if (joinQueue(state, crowd, liftRunsOf(net), a)) return;
  a.mode = "lift";
  const g = crowd.groups[a.group];
  if (g.members.every((m) => crowd.amateurs[m].mode === "lift")) {
    g.lift = band(crowd.rng, CROWD.lift);
  }
}

/** One amateur's step on the snow. */
function move(state: GameState, crowd: CrowdState, net: CrowdNet, a: Amateur): void {
  const r = net.runs[a.run];
  sampleRun(r, a.s, here);
  const half = here.width / 2;
  const k = a.knobs;
  const style = TURN_STYLES[k.style];
  const C = CROWD;
  const yaw0 = a.yaw;
  let v = a.speed;
  let braking = 0;
  a.push = 0;

  if (a.mode === "down") {
    // Sliding to a stop in the snow, then lying there.
    v = Math.max(0, v - C.fall.slide * dt);
    a.fall = 1;
    if (v < 0.2) {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.mode = "ski";
        a.yaw = 0;
        v = 0;
      }
    }
  } else {
    // THE LINE: steer for the lateral his turns sweep through now.
    const stopping = a.mode === "stop";
    const aim = stopping ? a.centre : targetOf(a, half, state.t);
    const lookAhead = Math.max(3, v * 0.9 + 2);
    const want = clamp(Math.atan2(aim - a.d, lookAhead), -style.maxYaw, style.maxYaw);
    const rate = C.yawRate[0] + (C.yawRate[1] - C.yawRate[0]) * k.skill;
    const jitter = k.wobble * 0.6 * Math.sin(state.t * 3.1 + a.id * 1.7);
    a.yaw += clamp(want + jitter - a.yaw, -rate * dt, rate * dt);
    // THE SPEED: the fall along his line, less the snow, the air and the
    // scrub of his skis turned off the way he goes.
    const cap = stopping ? 0 : a.cap;
    let acc =
      G * here.pitch * Math.cos(a.yaw) -
      C.drag.snow -
      C.drag.air * v * v -
      C.drag.scrub * Math.abs(a.yaw) * (1 - k.skill * 0.6);
    if (v > cap) {
      braking = clamp((v - cap) / 2, 0, 1);
      acc -= C.brake * braking;
    }
    if (!stopping && v < C.crawl.speed && acc < C.crawl.push) {
      // At a crawl he works: skating, poling.
      a.push = 1 - v / C.crawl.speed;
      acc = Math.max(acc, C.crawl.push * a.push);
      a.pole += dt * (2.2 + v);
    }
    if (a.mode === "air") acc = -C.drag.air * v * v;
    v = Math.max(0, v + acc * dt);
    if (stopping && v < 0.3) {
      a.timer -= dt;
      if (a.timer <= 0) a.mode = "ski";
    }
  }
  a.speed = v;

  // THE WAY HE GOES: down the run and across it.
  const s0 = a.s;
  const ds = v * Math.cos(a.yaw) * dt;
  a.s += ds;
  a.d += v * Math.sin(a.yaw) * dt;
  a.phase += (Math.PI * ds) / k.turn;
  const room = a.wander !== 0 ? half + Math.abs(a.wander) + 8 : half - 0.4;
  a.d = clamp(a.d, -room, room);

  // A KICKER'S LIP crossed: off it, if he lined up and has the speed.
  if (!Number.isNaN(a.kickerAt) && s0 < a.kickerAt && a.s >= a.kickerAt) {
    if (a.mode === "ski" && v >= C.kicker.speed) {
      a.mode = "air";
      a.airT = Math.min(C.kicker.most, C.kicker.air + C.kicker.perSpeed * v);
      a.airH = (G * a.airT * a.airT) / 8;
      a.airAt = 0;
    }
    a.kickerAt = NaN;
  } else if (!Number.isNaN(a.kickerAt) && a.s > a.kickerAt) a.kickerAt = NaN;
  if (a.mode === "air") {
    a.airAt += dt;
    if (a.airAt >= a.airT) {
      a.mode = "ski";
      // The landing: the less skill and the longer the hang, the likelier
      // it is on his back.
      const p = (1 - k.skill) * 0.5 * a.airT + k.wobble * 0.3;
      if (crowd.rng.chance(p)) fallDown(a, crowd.rng, crowd.rng.chance(0.5) ? 1 : -1);
    }
  }

  if (a.s >= r.length) {
    runOut(state, crowd, net, a);
    if (onLift(a)) return;
  }
  place(a, net.runs[a.run], state.level);

  // THE FIGURE: leaned into the turn by its pull, low by his speed and his
  // nerve, the wedge, the skis across in a stop.
  const omega = (a.yaw - yaw0) / dt + here.bend * v;
  const sway = k.wobble * 0.25 * Math.sin(state.t * 2.3 + a.id);
  const lean = clamp(Math.atan2(v * omega, G) * (0.45 + 0.55 * k.skill) + sway, -0.9, 0.9);
  const ease = 1 - Math.exp(-dt * 6);
  a.lean += ((a.mode === "down" ? 0 : lean) - a.lean) * ease;
  // A NEW TURN is begun when the lean goes over past `turnOn` on the other
  // side — not when it passes level between two.
  a.turnT += dt;
  const side = a.lean > C.turnOn ? 1 : a.lean < -C.turnOn ? -1 : 0;
  if (side !== 0 && side !== a.turnSide) {
    a.turnHeld = a.turnT;
    a.turnT = 0;
    a.turnSide = side;
  }
  const tuck = k.style === "line" ? clamp(v / 16, 0, 1) * 0.9 : 0;
  const crouch =
    a.mode === "air"
      ? 0.55
      : Math.max(tuck, 0.2 + 0.3 * k.aggression * clamp(v / 12, 0, 1) + 0.25 * (1 - k.skill));
  a.crouch += (crouch - a.crouch) * ease;
  const wedge =
    k.style === "plough" || (k.skill < 0.3 && (braking > 0 || a.mode === "stop")) ? 0.9 : 0;
  a.plough += (wedge - a.plough) * ease;
  const across =
    k.style === "slip"
      ? 0.85
      : a.mode === "stop"
        ? v > 0.5
          ? k.skill >= 0.3
            ? 1
            : 0.2
          : 0.35
        : k.skill >= 0.3
          ? braking * 0.6
          : 0;
  a.across += (across - a.across) * ease;
  a.fall += ((a.mode === "down" ? 1 : 0) - a.fall) * (1 - Math.exp(-dt * 3));
}

/** Bring a group whose ride is over off the top of a lift. */
function liftGroups(crowd: CrowdState, net: CrowdNet): void {
  for (const g of crowd.groups) {
    if (g.lift <= 0) continue;
    let up = true;
    for (const m of g.members) if (crowd.amateurs[m].mode !== "lift") up = false;
    if (!up) continue;
    g.lift -= dt;
    if (g.lift <= 0) launchGroup(crowd, net, g, false);
  }
}

/** Step the crowd by the step the world has just taken: the lifts, every
 * amateur's decision when it falls due, every amateur's way down. */
export function stepCrowd(state: GameState): void {
  const crowd = state.crowd;
  if (!crowd || crowd.amateurs.length === 0) return;
  const net = crowdNet(state.level);
  liftGroups(crowd, net);
  stepCrowdLifts(state, crowd, liftRunsOf(net));
  // Who is on each run, for the room each one keeps.
  while (onRun.length < net.runs.length) onRun.push([]);
  for (const list of onRun) list.length = 0;
  for (const a of crowd.amateurs) if (!onLift(a)) onRun[a.run].push(a);
  for (const a of crowd.amateurs) {
    if (onLift(a)) continue;
    a.think -= dt;
    if (a.think <= 0) {
      a.think += CROWD.think;
      decide(state, crowd, net, a);
    }
    move(state, crowd, net, a);
  }
}

/** THE PLAYER AGAINST THE CROWD, once a step after everyone has moved: the
 * player's two circles against each amateur's one, pushed apart by mass,
 * the closing speed traded — and an amateur hit hard enough goes down, a
 * player hitting one hard enough too. */
export function clipCrowd(state: GameState, events: GameEvent[]): void {
  const crowd = state.crowd;
  const c = state.skier;
  if (!crowd || c.thrown) return;
  const net = crowdNet(state.level);
  const B = RACE.bump;
  const mp = totalMass(c.spec);
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const feet = c.y - c.spec.cogHeight;
  for (const a of crowd.amateurs) {
    if (onLift(a)) continue;
    if (Math.abs(a.x - c.x) > 3 || Math.abs(a.z - c.z) > 3 || Math.abs(a.y - feet) > 1.6) continue;
    const size = CROWD_SIZE[a.body];
    for (const side of [-1, 1]) {
      const cx = c.x + fx * B.offset * side;
      const cz = c.z + fz * B.offset * side;
      const dx = a.x - cx;
      const dz = a.z - cz;
      const dist = hypot(dx, dz);
      const pen = size.radius + B.radius - dist;
      if (pen <= 0) continue;
      const nx = dist > 1e-6 ? dx / dist : 1;
      const nz = dist > 1e-6 ? dz / dist : 0;
      const ma = size.mass;
      const share = ma / (mp + ma);
      c.x -= nx * pen * share;
      c.z -= nz * pen * share;
      // The amateur's share of the push, into his run's frame.
      sampleRun(net.runs[a.run], a.s, here);
      const px = nx * pen * (1 - share);
      const pz = nz * pen * (1 - share);
      a.s += px * Math.sin(here.heading) + pz * Math.cos(here.heading);
      a.d += px * Math.cos(here.heading) - pz * Math.sin(here.heading);
      a.x += px;
      a.z += pz;
      const closing = (c.vx - a.vx) * nx + (c.vz - a.vz) * nz;
      if (closing <= 0) continue;
      const j = ((1 + CROWD.restitution) * closing) / (1 / mp + 1 / ma);
      const v0 = { x: c.vx, y: c.vy, z: c.vz };
      c.vx -= (j / mp) * nx;
      c.vz -= (j / mp) * nz;
      const vx = a.vx + (j / ma) * nx;
      const vz = a.vz + (j / ma) * nz;
      a.speed = hypot(vx, vz);
      a.yaw = angleDiff(here.heading, Math.atan2(vx, vz));
      const knock = CROWD.knock[0] + (CROWD.knock[1] - CROWD.knock[0]) * a.knobs.skill;
      if (closing >= knock && a.mode !== "down") {
        const right = nx * Math.cos(a.heading) - nz * Math.sin(a.heading);
        fallDown(a, crowd.rng, right >= 0 ? 1 : -1);
      }
      if (closing >= B.speed && c.bumpCooldown <= 0) {
        c.bumpCooldown = B.cooldown;
        events.push({ kind: "bump", t: state.t, rival: -1, speed: closing, amateur: a.id });
      }
      if (closing >= CROWD.floors * crashLimit(c, "treeShoulder")) {
        throwRider(state, "skier", v0, events);
        return;
      }
    }
  }
}
