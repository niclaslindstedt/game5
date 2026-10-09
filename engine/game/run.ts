// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE SKIER'S STEP — the helicopter he rides (`heli.ts`), the snowmobile
// (`sled.ts`), the lift that carries him, if any (`lift-ride.ts`),
// the wind tunnel he rides (`wind-tunnel.ts`),
// the skier (and, on a run that lets him trick the mountain, the strokes
// thrown in the air, `strokes.ts`), the trees and the edge, the wipeout (or his own
// tumble once he is thrown, `crash.ts` — or what he nearly fell to and
// rode out), the damage it cost (`damage.ts`) and what his body took
// (`body.ts`),
// the air record, the clock and the odometer, the buzzer
// (`RunRules.limit`), the course (when the rules count one — a free ride
// does not, and notes the runs it skies instead) and the automatic reset, in that order, for ONE run: the
// player's, or one of the rivals' (`rivals.ts`), which is a run of its own
// over the same map. The field is stepped by this same function — a rival
// that skied a different step would be a rival in a different game.
//
// The phase gates everything else: under the lights (`countdown`) the
// skier stands in the gate with the skis held across the slope and nothing
// is steered, and a finished run coasts with the controls let go.

import { TUNING } from "./defs/tuning.ts";
import { collideTrees, keepInBounds } from "./collision.ts";
import { stepStakes } from "./edge-stakes.ts";
import { outRun, resetSkier, standSkier, stepCourse } from "./course.ts";
import { derive, stepSkier } from "./skier.ts";
import { stepPipeAir } from "./pipe-air.ts";
import { flightGravity } from "./limits.ts";
import {
  crashOver,
  mayGetUp,
  noteSave,
  quietClocks,
  stepThrown,
  throwRider,
  wipeoutCause,
} from "./crash.ts";
import { takeDamage } from "./damage.ts";
import { followSkis } from "./lone-skis.ts";
import { stepBody } from "./body.ts";
import { holdsHim, stepGore } from "./gore.ts";
import { callRescue } from "./rescue.ts";
import { poseInput, stepStrokes } from "./strokes.ts";
import { aerialInput, stepAerial } from "./aerial-flight.ts";
import { stepKicker } from "./aerial-kicker.ts";
import { chairStrike, stepLift } from "./lift-ride.ts";
import { stepTunnel } from "./wind-tunnel.ts";
import { heliDown, stepHeli } from "./heli.ts";
import { rotorStrike } from "./heli-grip.ts";
import { stepSled } from "./sled.ts";
import { paraHeld, paraPress, paraRigged, stepPara } from "./para.ts";
import { balloonAboard, balloonDown, stepBalloon } from "./balloon.ts";
import { stepAfterski } from "./afterski.ts";
import { buzzOf, drunkInput, fetchesSkis, getUp, soberUp, stepFetch } from "./buzz.ts";
import { groomerStrike, stepGroomers } from "./groomer.ts";
import { trafficStrike } from "./traffic-contact.ts";
import { stepGatePoles } from "./gate-poles.ts";
import { catchInNets, stepNets } from "./nets.ts";
import { stepTrap } from "./speed-trap.ts";
import { forgetRun, noteSkied } from "./skied.ts";
import { stepHurt } from "./hurt.ts";
import { heldInHouse, stepStartPush } from "./start-push.ts";
import { inRunInput } from "./in-run.ts";
import { hockeyStop, stopMade } from "./hockey-stop.ts";
import { stepJib } from "./jib.ts";
import { NEUTRAL_INPUT, type GameEvent, type GameState, type SkierInput } from "./state.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { DISCIPLINE_RULES } from "../mapgen/index.ts";

/** What the skier holds under the lights: the skis across the slope, and
 * nothing else. */
const HOLD: SkierInput = { ...NEUTRAL_INPUT, brake: 1 };
/** ...and behind a ski cross's start gate (R35): stood square to the doors
 * on the ramp's lip, his hands on the handles — the doors hold him. */
const AT_THE_DOORS: SkierInput = { ...NEUTRAL_INPUT };
/** What a finished skier does: checks his speed down to a stop in the
 * arena — a skier left to himself would go on working (`poles.ts`). */
const COAST: SkierInput = { ...NEUTRAL_INPUT, brake: 0.6 };
const RUN_OUT: SkierInput = { ...NEUTRAL_INPUT };

/** PAST A SPEED TRACK'S TIMING ZONE (R34): a racer home at 200 km/h does not
 * skid — he UNTUCKS, slowly, over the first `speedSki.untuck` metres past
 * the zone's bottom line, so the wind's 1 g on his chest comes on him a
 * little at a time; then he rides stood up into it, the arms in, and only
 * past the BRAKING LINE, slow, does he skid to a stop. */
function runOut(run: GameState): SkierInput {
  if (run.rules.hockeyStop && !run.skier.thrown) return hockeyStop(run);
  const sk = run.level.speedSki;
  if (!sk) return COAST;
  const c = run.skier;
  const head = run.level.track.points[0];
  const along = (c.x - head.x) * Math.sin(head.heading) + (c.z - head.z) * Math.cos(head.heading);
  const R = DISCIPLINE_RULES.speedSki.runOut;
  // Below the line he skids it all off, the skis right across.
  // A racer out of it stands up and stops wherever he is.
  const past = run.progress.out ? Infinity : along - sk.zone.to;
  RUN_OUT.tuck = Math.max(0, Math.min(1, 1 - past / R.untuck));
  RUN_OUT.brake = past > R.brake && c.speed < R.below ? 1 : 0;
  return RUN_OUT;
}

/** Advance one skier's run by the step the world has just taken. `events`
 * is the run's own list, already cleared for this step. `player` is the
 * player's own run, whose fall is held longer than a rival's (`crash.getUp`,
 * `.lieFor`). */
export function stepRun(
  run: GameState,
  input: SkierInput,
  events: GameEvent[],
  player = false,
): void {
  const racing = run.phase === "racing";
  // What his injuries leave him this step (`hurt.ts`), on a run that
  // carries them.
  if (player) stepHurt(run);
  // Carried by any of the machines below, the place he last left a run is
  // forgotten: a reset never sends him back to where he was before.
  // In a lodge he is stood at its door: the machine press is the lodge's
  // (out again), never a machine's that happens to pass it.
  // In a balloon's basket the press is the balloon's (over the side, or
  // out), never a machine's that happens to stand by its site.
  const out = run.afterski?.inside || balloonAboard(run) ? { ...input, machine: false } : input;
  // THE PISTE MACHINES (`groomer.ts`): at their work, left, or driven —
  // and while he drives one the step is its own.
  if (stepGroomers(run, out, events)) return forgetRun(run);
  // THE HELICOPTER (`heli.ts`): flown, flying home or burning — and while
  // the skier sits on its skid the step is its own.
  if (stepHeli(run, out, events)) return forgetRun(run);
  // THE SNOWMOBILE (`sled.ts`): ridden, left, or lying where it threw him
  // — and while he stands on its boards the step is its own.
  if (stepSled(run, out, events)) return forgetRun(run);
  // THE LIFT (`lift-ride.ts`): while one carries him the step is its own.
  if (stepLift(run, out, events)) return forgetRun(run);
  // THE HOT AIR BALLOON (`balloon.ts`): flown, adrift without him or down
  // — and while he stands in its basket the step is its own.
  if (stepBalloon(run, input, events)) return forgetRun(run);
  // THE PARAMOTOR (`para.ts`): the rig released, or the ride begun again on
  // the summit — which takes the step.
  if (paraPress(run, out, events)) return;
  // THE AFTERSKI (`afterski.ts`): in through a lodge's door, and out.
  if (stepAfterski(run, input, events)) return;
  // Down too hurt to get up (`rescue.ts`): found so, and held.
  if (player) callRescue(run, events);
  // Thrown, the player's own press waits out `crash.getUp` (`mayGetUp`).
  if (input.reset && racing && (!player || mayGetUp(run.skier.thrown)) && !holdsHim(run)) {
    standUp(run, events, false);
    return;
  }
  const c = run.skier;
  // ON FOOT after a buzzed fall, fetching his skis (`buzz.ts`).
  if (c.fetch) {
    stepFetch(run, input, events);
    return;
  }
  const drunk = buzzOf(c) > 0;
  if (drunk) soberUp(c);
  const x0 = c.x;
  const z0 = c.z;
  const v0 = { x: c.vx, y: c.vy, z: c.vz };
  const speed0 = c.speed;
  // THE WIPEOUT (`crash.ts`): with the skier thrown, the skis go on with
  // the controls let go, and he tumbles on his own.
  const off = c.thrown;
  const asked = off
    ? NEUTRAL_INPUT
    : !racing
      ? run.phase === "countdown"
        ? run.rules.start === "gate"
          ? AT_THE_DOORS
          : HOLD
        : runOut(run)
      : input;
  const rigged = paraRigged(run);
  const stunts = run.rules.stunts && asked === input && !rigged;
  // THE IN-RUN (`in-run.ts`): a big air jump's ridden tucked to the lip;
  // hung under a paramotor's wing, his skis do nothing (`para.ts`).
  // ...and off an aerials kicker the body is the flight's (`aerial-flight.ts`).
  const held = off ? asked : aerialInput(run, paraHeld(run, inRunInput(run, asked)));
  // THE WIND TUNNEL (`wind-tunnel.ts`): taken in, carried, or let go.
  stepTunnel(run, events);
  // HELD IN THE START HOUSE after GO, and thrown out of it (`start-push.ts`).
  const housed = heldInHouse(run);
  stepStartPush(run, input);
  // ON A JIB (`jib.ts`): a bead on a wire, and the snow's step is not his.
  // ...or up an aerials kicker, a bead on a wire too (`aerial-kicker.ts`).
  const railed = !off && (stepJib(run, held, events) || stepKicker(run));
  // Thrown, there is no pair on legs to step: the skis are each their own
  // (`lone-skis.ts`), stepped with his body below.
  if (!off && !railed) {
    // THE BUZZ (`buzz.ts`): the hands late and wrong.
    const ridden = drunk && !rigged ? drunkInput(run, held) : held;
    stepSkier(run, stunts ? poseInput(run, ridden) : ridden, events);
  }
  // IN THE GATE: under the lights his poles are planted over the wand and
  // hold him where he stands, however steep the pitch below the hut — only
  // his legs settle. ...and so does a freestyle skier whose HOCKEY STOP is
  // made (`hockey-stop.ts`).
  if ((run.phase === "countdown" || (housed && c.launch < 0) || stopMade(run, speed0)) && !off) {
    c.x = x0;
    c.z = z0;
    c.vx = 0;
    c.vz = 0;
    derive(c, run.level);
  }
  // THE PARAMOTOR'S WING on its lines over him (`para.ts`), and its pieces
  // once released.
  if (run.para) stepPara(run, asked, events);
  // THE STROKES (`strokes.ts`), on a skier whose flight is now current.
  if (stunts && !railed) stepStrokes(run, input);
  // THE AERIALS FLIGHT (`aerial-flight.ts`): flips and twists flown together.
  if (run.aerial) stepAerial(run, input);
  // OFF A PIPE'S WALL (`pipe-air.ts`): the lip's push and the turn round.
  if (!off && !railed) stepPipeAir(run, flightGravity(run.rules));
  if (!off) collideTrees(run, events, x0, z0);
  // THE FLEX POLES (`gate-poles.ts`): knocked over, standing back up.
  stepGatePoles(run, events, off !== null);
  // THE EDGE STAKES (`edge-stakes.ts`): bent over, snapped, whipping back.
  stepStakes(run, events, off !== null);
  keepInBounds(run);
  // THE A-NETS beside a downhill (`nets.ts`): held on them, or out.
  stepNets(run, events);
  if (off) {
    stepThrown(run, off);
    // ...and through a helicopter's turning rotor (`heli-grip.ts`).
    if (player && run.heli) rotorStrike(run, off, events);
    // ...and what of him and his skis has gone into an A-net, held in it.
    catchInNets(run, off);
    followSkis(run, c, off.skis);
    derive(c, run.level);
    quietClocks(c);
  } else if (!railed) {
    // THE EMPTY CHAIR behind him off a lift (`lift-ride.ts`), if he stood
    // in its way; else whatever else threw him.
    const swept = chairStrike(run);
    // ...or a piste machine he rode into, or whose blade met him.
    const struck = swept ? null : groomerStrike(run, events);
    // ...or a car, the ski bus or a bicycle in the village (`traffic-contact.ts`).
    const hit = swept || struck ? null : trafficStrike(run, events);
    const cause = swept || struck || hit ? null : wipeoutCause(run, events, speed0);
    if (swept) throwRider(run, "chair", { x: c.vx + swept.x, y: c.vy, z: c.vz + swept.z }, events);
    else if (struck) throwRider(run, "groomer", struck, events);
    else if (hit) throwRider(run, "car", hit.v, events);
    else if (cause) throwRider(run, cause, v0, events);
    else noteSave(run, events);
  }
  takeDamage(run, events);
  // THE BODY (`body.ts`): what the blows of this step did to him.
  stepBody(run, events, off);
  // ...and on a run that asked for them, the wounds it does not survive.
  if (player) stepGore(run, events);
  // THE RUN'S AIR RECORD, off the landing the skier has just reported.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // ...never a flight under a paramotor's wing, which is not a jump.
    if (e.kind === "land" && !rigged && e.airTime > run.progress.bestAir) {
      run.progress.bestAir = e.airTime;
    }
  }
  if (!racing) return;
  const p = run.progress;
  if (p.finished) return;
  // On an interval start the clock waits for the wand.
  if (p.started || run.rules.start !== "interval") p.time += TUNING.dt;
  p.distance += hypot(c.x - x0, c.z - z0);
  // THE BUZZER (`RunRules.limit`): the run is over wherever it stands.
  if (run.rules.limit > 0 && p.time >= run.rules.limit) {
    p.finished = true;
    p.missed = null;
    run.phase = "finished";
    events.push({ kind: "finish", t: run.t, time: p.time, place: 1 });
    return;
  }
  if (off) {
    // A thrown skier takes no gate; he is stood back up once he has lain
    // long enough — the player longer — unless a helicopter he rode down is
    // burning, which stands him up on its pad when it is done (`heli.ts`).
    // Buzzed on a free ride, he gets up where he lies and fetches his skis
    // instead (`buzz.ts`).
    if (crashOver(off, player) && !heliDown(run) && !balloonDown(run) && !holdsHim(run)) {
      if (player && fetchesSkis(run)) getUp(run, off, events);
      else standUp(run, events, true);
    }
    return;
  }
  if (run.rules.course) {
    stepCourse(run, x0, z0, events);
    stepTrap(run, x0, z0, events);
    // Where he leaves the piste, for a reset that stands him back up hurt
    // (`resetPose`) — only on a run that carries its injuries.
    if (run.gore) noteSkied(run);
  }
  // A FREE RIDE remembers the runs it skies instead (`skied.ts`) — never
  // the ones flown over under the paramotor's wing.
  else if (run.para?.flying) forgetRun(run);
  else noteSkied(run);
  if (p.finished) return;
  const R = TUNING.reset;
  // Bogged, the skier is input the time to work out (`trench.ts`).
  const stuck = c.trench > 0 ? c.trenchFor >= TUNING.trench.holdFor : c.stuckFor >= R.stuckFor;
  if (c.overFor >= R.overFor || stuck) {
    // ...buzzed, stood up where he sat down rather than sent back.
    if (player && fetchesSkis(run)) standSkier(run, c.x, c.z, c.heading);
    else standUp(run, events, true);
  }
}

/** THE RESET — or, under the strict gates (R31), where nobody is stood
 * back on the course, the end of the run: a racer stopped is out. */
function standUp(run: GameState, events: GameEvent[], auto: boolean): void {
  if (run.rules.gates === "strict" && run.rules.course && !run.progress.finished) {
    outRun(run, events, { status: "dnf", why: "fall", gate: run.progress.nextCheckpoint });
    return;
  }
  resetSkier(run, events, auto);
}
