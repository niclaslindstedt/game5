// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW UNDER A SKI — how far it lets the ski sink, what it costs to
// push through, and how hard it can be gripped. A groomed piste is a hard
// surface with a centimetre of corduroy pressed into it, and untouched
// powder is a medium the ski floats on only while it is going fast enough.
//
// THE SINK is the planing hull's draft carried straight over. Snow under a
// moving ski has less time to yield the faster it is crossed, so the
// support rises with speed: at rest the skis are buried to the boot tops
// (`snow.powderSink`), and they come up as exp(−(v / planeSpeed)²) — a third
// of that at the planing speed and a few centimetres by 30 km/h, which is
// the moment a skier feels the tips come up onto the top of the snow. The
// sink is the SUPPORT's depth under the untouched surface: the legs' springs
// push against `groundAt − sink`, and the trail the renderer stamps is that
// deep.
//
// THE RESISTANCE is three terms, all along the ski's line of travel: the
// base's friction as a share of the load (the groomer's surface, or the
// powder's), the PLOUGH — snow shoved aside by a sunk tip, growing with the
// square of the speed and with the depth it is sunk, the bow wave of a
// displacement hull — and POWDER DRAG, the cost of compacting fresh snow,
// linear in speed. The plough is why a skier bogged in powder wants
// momentum and the sink falling away with speed is why it gets easier once
// he has some.
//
// DEEP SNOW — past the ordinary depth, up to a metre of fresh (`SNOW_DIAL`,
// a maritime winter's usual by March) — is a different medium, and skiers
// say so in the same three sentences: KEEP IT MOVING (stop and you sink to
// the knees), KEEP THE TIPS UP (a buried tip is a plough), and TURN WITH
// YOUR WEIGHT (the edges are buried, the snow under them is soft, and it is
// the skier's weight that turns and holds him up). The ordinary snow has a
// settled base under it that the skis press down to; deep snow has none in
// reach, so its model grows by the BOTTOMLESS share (`bottomlessOf`: none at
// the ordinary depth, where every race is skied and nothing below changes
// by a bit, all of it at a metre):
//   - THE SNOW GIVES UNDER LOAD: the support a ski finds sinks further the
//     more it carries, (L / L₀)^give — the pressure–sinkage curve of a snow
//     with no base in reach (Bekker's, whose exponent for fresh snow is
//     near one). So the loaded ski of a skier rolled over sinks further
//     than the other and rolls him further: a buried edge holds nothing,
//     and the balance is the skier's;
//   - IT STAYS PRESSED: snow a stopped ski has compacted does not spring
//     back when the load comes off it — only a ski moving onto new snow
//     rises (`settleShare`) — so a skier who has sunk stays sunk;
//   - IT PLANES LATER: the deeper the loose layer, the more of it a ski
//     must press into a ramp before the ramp carries it, so the planing
//     speed grows with the depth (`deepPlane`);
//   - THE BODY PLOUGHS: once a skier has sunk past his boots, his shins and
//     his knees shove snow as the tips do (`bodyPlough`, applied by
//     `skier.ts` off the knees' own depth under the untouched surface).

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import { groomedFresh } from "./groomed.ts";
import { keptAt } from "./kept-ground.ts";
import { machineSnowAt } from "./snow-guns.ts";
import type { GameState } from "./state.ts";

const S = TUNING.snow;
const G = TUNING.grip;

/** The support depth a station settles toward, m: `packed` 0..1 is the
 * surface's share of groomed piste, `speed` the skier's, `scale` the
 * station's own share of the reference ski's sink (a wide ski sinks less,
 * a tip or a tail less again) and `plane` its planing speed as a multiple
 * of `snow.planeSpeed` (`footprint.ts`). `depth` is the run's SNOW DIAL
 * (`GameState.snowDepth`, `SNOW_DIAL`): the powder's own sink scaled, the
 * groomer's cut left alone. In DEEP snow (`deep`, the dial's
 * `bottomlessOf`) the sink grows with `load`, the station's load over its
 * rest load, and the planing speed with the depth. */
export function sinkTarget(
  packed: number,
  speed: number,
  scale: number,
  plane = 1,
  depth = 1,
  load = 1,
  deep = 0,
): number {
  const r = speed / (S.planeSpeed * plane * (deep > 0 ? deepPlaneOf(depth) : 1));
  let powder = S.powderSink * depth * scale * Math.exp(-r * r);
  // THE SNOW GIVES: `load` is the probe's load over its rest load — down to
  // the depth the whole loose layer compacts to, and never past it.
  if (deep > 0) {
    const gave = powder * Math.pow(clamp(load, 0, S.deep.loadMax), S.deep.give * deep);
    powder = Math.min(gave, Math.max(powder, S.deep.compact * S.cover * depth));
  }
  return powder * (1 - packed) + S.packedSink * packed;
}

/** How BOTTOMLESS the powder is at a run's snow dial (`GameState.
 * snowDepth`), 0..1: none at or under the ordinary snow, where the skis
 * press down to a settled base, all of it at `deep.full`. The dial's
 * alone: what a fall lays during a run is centimetres on top of the snow
 * it had (`depthUnder` sinks a skier by them), never enough to lose a base
 * — and a race snowed on stays the race it was. */
export function bottomlessOf(depth: number): number {
  return depth <= 1 ? 0 : Math.min(1, (depth - 1) / (S.deep.full - 1));
}

/** The planing speed's multiple at a snow dial `depth`: 1 at the ordinary
 * snow, growing as the depth's `deep.plane` power past it. */
export function deepPlaneOf(depth: number): number {
  return depth <= 1 ? 1 : Math.pow(depth, S.deep.plane);
}

/** IT STAYS PRESSED: the share of the way back up a station's sink may
 * come this step when the support asks for less than it has — all of it on
 * the ordinary snow, and in snow `deep` bottomless (`bottomlessOf`) only as
 * fast as the ski moves onto snow nobody has pressed (`deep.settle` m/s
 * along it is all of it). */
export function settleShare(deep: number, speed: number): number {
  return deep > 0 ? 1 - deep * (1 - clamp(Math.abs(speed) / S.deep.settle, 0, 1)) : 1;
}

/** THE BODY PLOUGH, N, as a magnitude: a shin `width` m wide buried
 * `under` m below the untouched surface of powder `packed` 0..1 at `speed`
 * m/s, in snow `deep` bottomless (`bottomlessOf`) — the plough's own law
 * (`snow.plough`), over the shin's width, by that share. */
export function bodyPlough(
  packed: number,
  under: number,
  width: number,
  speed: number,
  deep: number,
): number {
  if (deep <= 0 || under <= 0) return 0;
  const buried = Math.min(under, S.deep.bellyMax);
  return S.plough * S.deep.belly * deep * width * buried * speed * speed * (1 - packed);
}

/** The deepest a skier can sink here — a standing one's — m, for skis
 * that sink `scale` times the reference's (`Footprint.sink`). What the hull
 * contacts read as the bottom of the snow (`chassis.ts`): deep powder does
 * not hold a body up, it is pushed aside by it — down to the base the
 * skier's own skis have pressed, and no further. `depth` is the run's snow
 * dial, as `sinkTarget` takes it. */
export function powderFloor(packed: number, scale = 1, depth = 1): number {
  return S.powderSink * depth * Math.max(1, scale) * (1 - packed) + S.packedSink * packed;
}

/** THE NEW SNOW over the groomer (`GameState.fresh`, `snowfall.ts`): the
 * share of a surface `packed` 0..1 that still skis as packed under `fresh`
 * m of new fall — the whole of it under none, none of it once
 * `snow.freshBury` has fallen — and with `loose` 0..1 of it skied up or
 * softened to loose snow over its base by the day (`piste-day.ts`). Every station, the hull, a stood skier and
 * a thrown body read the surface through this, so the sink, the drag, the
 * grip and the hiss (`SkierState.packed`) all feel the same layer. */
export function packedUnder(packed: number, fresh: number, loose = 0): number {
  // THE DAY'S PISTE (`piste-day.ts`): a share of a skied-up or sun-softened
  // groomer is loose snow over its base, and reads as such.
  const p = loose > 0 ? packed * (1 - loose) : packed;
  return fresh > 0 ? p * Math.max(0, 1 - fresh / S.freshBury) : p;
}

/** THE LOOSE SHARE of the groomer on a run (`PisteDay.loose`): 0 on a run
 * that was not dealt the day's piste. */
export function looseOf(state: Pick<GameState, "piste">): number {
  return state.piste ? state.piste.loose : 0;
}

/** THE REFROZEN PISTE under a station standing on `packed` 0..1 of
 * groomer: the share of bare ice's grip it stands at (`onIce`), 0 on a run
 * that was not dealt the day's piste, in a cell the machines have groomed
 * since (`groomed.ts` — milled snow is not ice) and on the ground the lift
 * staff keep (`kept-ground.ts`). */
export function pisteIce(
  state: Pick<GameState, "level" | "groomed" | "piste">,
  x: number,
  z: number,
  packed: number,
): number {
  const ice = state.piste ? state.piste.ice : 0;
  if (ice <= 0 || packed <= 0) return 0;
  if (state.groomed && groomedFresh(state.groomed, x, z) !== undefined) return 0;
  return keptAt(state.level, x, z) ? 0 : ice * packed;
}

/** THE PACKED SHARE UNDER A PLAN POINT on a run, the new snow over it
 * reckoned in: a cell the piste machines have groomed (`groomed.ts`) is
 * packed through and carries only what has fallen since; so, on a run
 * dealt the day's piste, is the ground round the lifts the staff keep clear
 * (`kept-ground.ts`), under only what has fallen since the ride began;
 * anywhere else it is the map's own packed field under the whole fall, as
 * skied up as the day has made it (`packedUnder`, `PisteDay.loose`). */
export function packedSnow(
  state: Pick<GameState, "level" | "fresh" | "groomed" | "piste" | "machineSnow">,
  x: number,
  z: number,
): number {
  // A WHALE of machine snow (`snow-guns.ts`) is heavy loose snow heaped on
  // whatever lies under it, and reads as new snow over it.
  const heap = state.machineSnow ? machineSnowAt(state.machineSnow, x, z) : 0;
  const at = state.groomed ? groomedFresh(state.groomed, x, z) : undefined;
  if (at !== undefined) return packedUnder(1, Math.max(0, state.fresh - at) + heap);
  if (state.piste && keptAt(state.level, x, z)) {
    return packedUnder(1, Math.max(0, state.fresh - state.piste.fresh) + heap);
  }
  return packedUnder(state.level.packedAt(x, z), state.fresh + heap, looseOf(state));
}

/** The run's snow dial with `fresh` m of new snow laid over the powder: a
 * dial is a multiple of `snow.powderSink`, and the new snow deepens it by
 * its own depth. */
export function depthUnder(depth: number, fresh: number): number {
  return depth + Math.max(0, fresh) / S.powderSink;
}

/** How deep a standing skier sinks into untouched powder at a run's snow
 * dial, m. */
export function restSinkOf(depth: number): number {
  return S.powderSink * depth;
}

/** How deep the loose snow IS at a run's snow dial, m — the figure the
 * start card reads the dial back as (`snow.cover` at the ordinary snow). */
export function snowCoverOf(depth: number): number {
  return S.cover * depth;
}

/** The resistance along a station's line of travel, N, as a magnitude
 * (the caller gives it the sign against the motion): the base's friction,
 * the plough off a tip `width` m wide sunk `sink` m into powder, and
 * powder drag, at `speed` m/s with `load` N on it. A groomed piste's
 * centimetre of corduroy is friction and nothing else: there is no powder
 * to shove. `compact` scales the powder drag for the ski pressing it: the
 * work of compacting snow goes as how far it is pressed down (Bekker's
 * compaction resistance), so a ski that sinks less pays less
 * (`Footprint.sink`). */
export function snowDrag(
  packed: number,
  sink: number,
  width: number,
  load: number,
  speed: number,
  compact = 1,
): number {
  const v = Math.abs(speed);
  const crr = S.crrPacked * packed + S.crrPowder * (1 - packed);
  const plough = S.plough * width * sink * v * v * (1 - packed);
  const powder = S.powderDrag * compact * load * v * (1 - packed);
  return crr * load + plough + powder;
}

/** The sideways grip a ski has: on its EDGE on packed snow, and on its
 * BASE in powder, each a coefficient on the load. */
export type Grip = { edge: number; base: number };

/** What BARE ICE leaves of a grip already read (`gripAt`), `ice` 0..1 of
 * the station's footprint on it (a frozen tarn's, `Level.iceAt`): each
 * coefficient eased toward its share of `grip.ice`. The ice is packed —
 * the level folds it into `packedAt` as hard as the groomer — so the sink,
 * the drag and the friction are the groomer's already, and the grip is the
 * one thing ice takes away. */
export function onIce(out: Grip, ice: number): Grip {
  const I = G.ice;
  out.edge *= 1 - ice * (1 - I.edge);
  out.base *= 1 - ice * (1 - I.base);
  return out;
}

/** The friction coefficients at `packed` 0..1, into `out`, for a pair
 * whose footprint (`footprint.ts`) is `fit`: an edge worth `edge` of the
 * reference's on the groomer (the flex and the rocker), a base worth `base`
 * of its hold in powder (the waist). The reference's footprint is 1 on
 * both. What share of the edge a ski standing FLAT keeps is `skier.ts`'s
 * (`grip.flatShare`, off the edge angle). */
export function gripAt(packed: number, out: Grip, fit: GripFit = UNIT_FIT): Grip {
  const p = 1 - packed;
  out.edge = G.edgePacked * fit.edge * packed;
  out.base = G.basePowder * fit.base * p;
  return out;
}

/** THE PLATFORM under an edge stood `edge` rad over, as a multiple of the
 * edge's own bite added to it (`grip.platform`), for a skier who stands
 * `on` 0..1 of it (`Technique.platform` — the racer's angulation):
 * nothing up to `from`, then `share` of tan θ's growth past it — the
 * snow's reaction square to a base stood on the shelf it has cut. Zero on
 * a flat or a moderate edge and for a skier who does not stand on it, so
 * he holds exactly what the edge's bite does. Read by the physics'
 * stations and by `limits.ts`'s `cornerGrip`. */
export function platformOf(edge: number, on: number): number {
  const P = G.platform;
  const e = Math.min(Math.abs(edge), 1.45);
  return on > 0 && e > P.from ? on * P.share * (Math.tan(e) - Math.tan(P.from)) : 0;
}

/** The share of a footprint the grip reads (`Footprint` carries it). */
export type GripFit = { edge: number; base: number };

const UNIT_FIT: GripFit = { edge: 1, base: 1 };
