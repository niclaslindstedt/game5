// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH SOUND AN EVENT MAKES, and how big it is.
//
// Split out from the front door so it can be reasoned about — and tested —
// as what it is: a pure function from a `GameEvent` to a bank id and a
// scale. Nothing here touches the synth, so the whole opinion about what a
// race sounds like is one table a reader can check against the bank.
//
// WHAT AN EVENT DECIDES, AND WHAT IT ONLY SCALES. Some events pick a
// different SOUND — a landing the legs took and one they could not are two
// different things happening to a skier. Most only scale the one they have
// (`PlayShape`: louder, lower, longer).
//
// AND WHAT WAS MET, AND WHAT IT CAME DOWN INTO (`Contact`). The engine's
// event says a trunk was met and how fast; the app knows WHICH trunk (the
// map's own, found by where) and what snow lay under the skis (the bed's
// snowpack reading), and both change the sound rather than the news: a
// sapling brushed is the boughs' swish, a fat old trunk a deep crack, a dead
// snag a dry hollow knock with no snow on it to shake down; a landing in
// deep powder is a whumpf, on ice the skis' slap. Left out, every contact
// is the groomer's and every trunk a middling living one — the sound the
// bank had before it knew.

import type { GameEvent, Level } from "@engine";

import type { PlayShape } from "@niclaslindstedt/oss-game-framework/audio/types";

import { heliHeard } from "./heli-voice.ts";
import type { SnowUnder } from "./snow-voice.ts";

/** What the app knows about a contact that the event does not say. */
export type Contact = {
  /** What lay under the skis — what a body or a pair comes down into. */
  ground?: SnowUnder;
  /** The trunk a `hit` met: its radius, m, and whether it is dead wood. */
  trunk?: Trunk;
  /** Where the ear is — the player's skier — for a sound made somewhere
   * else on the mountain (the helicopter's): heard by its distance. */
  ear?: { x: number; y: number; z: number };
  /** HOW THE RUN STARTS, for the starter's sounds: out of a ski cross's
   * START GATE (`gate`, R35) — its doors the GO — and whether it is a HEAT,
   * four racers out of it on the starter's word with no lights to beep. */
  start?: { gate: boolean; heat: boolean };
};

export type Trunk = { radius: number; snag: boolean };

/** How far from a hit's point a trunk may stand and still be the one met,
 * m: the skier's footprint circle and the fattest trunk, with room. */
const TRUNK_REACH = 2.5;

/** THE TRUNK AT A HIT: the map's nearest within reach of where the engine
 * said the skier met one, or null (a synthetic map with no forest). */
export function trunkAt(level: Pick<Level, "trees">, x: number, z: number): Trunk | null {
  let best = TRUNK_REACH * TRUNK_REACH;
  let found: Trunk | null = null;
  for (const tree of level.trees) {
    const dx = tree.x - x;
    const dz = tree.z - z;
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      found = { radius: tree.radius, snag: tree.kind === "snag" };
    }
  }
  return found;
}

/** A trunk's size as heard, 0 (a sapling at the tree line) … 1 (an old
 * trunk half a metre through): trunk radii run 0.15–0.6 m (`forest.ts`'s
 * `trunk` rule off a tree's height). */
function girth(trunk: Trunk | undefined): number {
  return trunk ? ramp(trunk.radius, 0.15, 0.6) : 0.4;
}

/** How deep and loose the snow is under a contact, 0..1, and how icy. */
function looseOf(ground: SnowUnder | undefined): number {
  return ground ? Math.min(1, Math.max(0, ground.soft + ground.new + 0.5 * ground.wet)) : 0;
}
function iceOf(ground: SnowUnder | undefined): number {
  return ground ? Math.min(1, Math.max(0, ground.ice + 0.4 * ground.hard)) : 0;
}

/** THE SNOW A BODY COMES DOWN INTO, as a shape: deep loose snow swallows
 * the top of it (lower, longer, a little quieter), ice leaves it bare. */
function intoSnow(shape: PlayShape, ground: SnowUnder | undefined): PlayShape {
  const loose = looseOf(ground);
  const ice = iceOf(ground);
  return {
    gain: (shape.gain ?? 1) * (1 - 0.15 * loose + 0.1 * ice),
    pitch: (shape.pitch ?? 1) * (1 - 0.14 * loose + 0.1 * ice),
    stretch: (shape.stretch ?? 1) * (1 + 0.25 * loose - 0.15 * ice),
  };
}

/** A contact under this speed, m/s, is a brush with a trunk rather than a
 * blow: the shoulder through the boughs and a knock on the bark. */
const BRUSH_UNDER = 4;

/** Loose snow deep enough that a landing is a whumpf into it, and ice
 * bare enough that it is the skis' slap on it. */
const POWDER_LANDING = 0.6;
const ICE_LANDING = 0.5;

/** The speed INTO the slope at which a landing is as big as it gets, m/s,
 * and the share of that the gentlest touchdown is still worth — a small
 * hop still has to sound like ninety kilos of skier and skis arriving. */
const LAND_FULL = 12;
const LAND_FLOOR = 0.3;

/** A flight shorter than this, s, is a skier skipping over a bump rather
 * than a landing: the snow bed has it, and a thump on every mogul would
 * bury the wind. */
const LAND_HEARD = 0.25;

/** The distance the skid's own sounds are heard at full size from, m: the
 * ear sat on it. */
const HEARD_NEAR = 4;

/** Closing speeds that separate a brush with a trunk from a wreck, m/s. */
const HIT_FULL = 20;

/** THE CRASH'S CLOSING SPEED at which the blast is as big as it gets,
 * m/s, and the share of it the gentlest crash is still worth — a helicopter
 * that only tips into the snow still blows up. */
const CRASH_FULL = 25;
const CRASH_FLOOR = 0.75;

/** The distance an explosion is heard at full size from, m — a blast is
 * louder than a rotor, so it carries on its own reference — and the
 * quietest a far one gets, where it is still a thud down the valley. */
const BLAST_REF = 20;
const BLAST_FLOOR = 0.05;

/** A sound made at the event's point as heard from the ear: the inverse of
 * the distance from `ref` m (and none nearer), the air taking its top off
 * (`heliHeard`'s brightness, as a pitch) and smearing it longer. Without
 * an ear it is heard where it happened. */
function heardAt(
  at: { x: number; y: number; z: number },
  ear: Contact["ear"],
  ref: number,
  floor = 0,
): PlayShape {
  if (!ear) return { gain: 1, pitch: 1, stretch: 1 };
  const d = Math.hypot(at.x - ear.x, at.y - ear.y, at.z - ear.z);
  const air = heliHeard(d);
  return {
    gain: Math.max(floor, ref / Math.max(ref, d)),
    pitch: 0.75 + 0.25 * air.bright,
    stretch: 1 + 0.4 * (1 - air.bright),
  };
}

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** What one event sounds like. Null means the event is silent. */
export function soundForEvent(
  event: GameEvent,
  contact: Contact = {},
): { id: string; shape?: PlayShape } | null {
  const ground = contact.ground;
  switch (event.kind) {
    // A LANDING is the legs taking it — and what they take it ON: a harsh
    // one is the hard thud whatever the snow; a clean one is a whumpf into
    // deep powder, the skis' flat slap on ice, the soft thump elsewhere.
    case "land": {
      if (!event.harsh && event.airTime < LAND_HEARD) return null;
      const big = LAND_FLOOR + (1 - LAND_FLOOR) * ramp(event.impact, 0, LAND_FULL);
      const id = event.harsh
        ? "land_hard"
        : looseOf(ground) >= POWDER_LANDING
          ? "land_powder"
          : iceOf(ground) >= ICE_LANDING
            ? "land_ice"
            : "land_soft";
      return {
        id,
        shape: intoSnow(
          { gain: 0.55 + 0.75 * big, pitch: 1.12 - 0.28 * big, stretch: 0.85 + 0.5 * big },
          ground,
        ),
      };
    }

    // THE POP: the skis leaving the snow off straightened legs — the soft
    // landing's whump run backwards in the ear: short, bright, and bigger
    // the longer the jump was loaded.
    case "jump": {
      const big = ramp(event.pop, 2, 5.5);
      return { id: "land_soft", shape: { gain: 0.4 + 0.4 * big, pitch: 1.35, stretch: 0.6 } };
    }

    // A TRUNK: brushed or met — and which. A fat trunk cracks deeper and
    // longer, a sapling higher and shorter; dead wood is its own sound.
    case "hit": {
      const size = girth(contact.trunk);
      const pitch = 1.15 - 0.3 * size;
      const stretch = 0.85 + 0.35 * size;
      if (event.speed < BRUSH_UNDER) {
        const soft = ramp(event.speed, 0, BRUSH_UNDER);
        return {
          id: "brush_tree",
          shape: { gain: 0.6 + 0.5 * soft, pitch, stretch },
        };
      }
      const hard = ramp(event.speed, 2, HIT_FULL);
      return {
        id: contact.trunk?.snag ? "hit_snag" : "hit_tree",
        shape: {
          gain: (0.6 + 0.7 * hard) * (0.85 + 0.3 * size),
          pitch: pitch - 0.25 * hard,
          stretch: stretch + 0.5 * hard,
        },
      };
    }

    // THE WIPEOUT: a man and his skis arriving in the snow separately, and
    // HOW is the sound — into a trunk's foot with its load coming down on
    // him, over the tips with the skis levered off, tumbling end over end,
    // or the high-side off an edge caught. What bent (the `damage` event)
    // and a skier bogged (`stuck`) are the blow's and the snow's own sounds
    // already, and say nothing of their own.
    case "wipeout": {
      const hard = ramp(event.speed, 6, HIT_FULL);
      return {
        // A stake's fall is a balance lost: the high-side's sound; a chair
        // run into him a padded body knocked down, the shoulder's. A fall
        // into the A-nets is the mesh's own (the `net` event's, beside
        // this one) and a body going over into it.
        id:
          event.cause === "stake"
            ? "wipeout_catch"
            : event.cause === "chair" || event.cause === "maul"
              ? "wipeout_skier"
              : event.cause === "net"
                ? "wipeout_roll"
                : `wipeout_${event.cause}`,
        shape: intoSnow(
          { gain: 0.9 + 0.4 * hard, pitch: 1 - 0.15 * hard, stretch: 1 + 0.35 * hard },
          ground,
        ),
      };
    }

    case "bump": {
      const hard = ramp(event.speed, 1, HIT_FULL);
      return {
        id: "bump",
        shape: { gain: 0.55 + 0.7 * hard, pitch: 1.1 - 0.25 * hard, stretch: 0.9 + 0.4 * hard },
      };
    }

    // A GATE PASSED: the panel slapped past on its pole. The start gate's
    // own crossing, which opens the run, is the wand's beep (`go`) already
    // and says nothing of its own.
    case "checkpoint":
      return event.index === 0 ? null : { id: "checkpoint" };

    case "lap":
      return { id: "lap" };

    case "missed":
      return { id: "missed" };

    // OUT OF THE RACE (R31): the board's verdict and the arena's groan.
    case "out":
      return { id: "out" };

    // A FLEX POLE KNOCKED: the guard's clack, harder the harder the knock.
    case "pole": {
      const hard = ramp(event.speed, 0.5, 4);
      return { id: "pole", shape: { gain: 0.6 + 0.6 * hard, pitch: 1.05 - 0.15 * hard } };
    }

    // AN EDGE STAKE (`edge-stakes.ts`): the same clack off a plastic pole,
    // louder and lower where it snapped.
    case "stake": {
      const hard = ramp(event.speed, 0.5, 8);
      const snap = event.broke ? 1 : 0;
      return {
        id: "pole",
        shape: { gain: 0.5 + 0.5 * hard + 0.4 * snap, pitch: 1.15 - 0.15 * hard - 0.2 * snap },
      };
    }

    // A DOWNHILL'S SPEED TRAP (R32): the photocells' chirp.
    case "trap":
      return { id: "trap" };

    // THE GRIMBEAR (`grimbear.ts`): his roar out of the trees, over the
    // skier he took, and pulled up short — heard from where he stands.
    case "grimbear":
      return event.phase === "gone"
        ? null
        : {
            id: "roar",
            shape: {
              ...heardAt({ x: event.x, y: contact.ear?.y ?? 0, z: event.z }, contact.ear, 25, 0.2),
              ...(event.phase === "halt" ? { pitch: 0.85 } : {}),
            },
          };

    // INTO THE A-NETS (R32): the mesh taking him, bigger the harder.
    case "net": {
      const hard = ramp(event.speed, 1, 12);
      return { id: "net", shape: { gain: 0.6 + 0.6 * hard, stretch: 0.85 + 0.4 * hard } };
    }

    case "reset":
      return { id: "reset" };

    // THE FINISH: the horn, and the arena's cowbells under it.
    case "finish":
      return { id: "finish" };

    // THE START HUT'S BEEPS: one a count, and the last of them — GO, the
    // wand's — an octave up and held, so the ear knows which one it was
    // without counting. A ski cross's GO is its gate's doors dropping, and
    // its heats are started on the starter's word, the drop's moment never
    // told: no beeps to count it down.
    case "count":
      return contact.start?.heat ? null : { id: "count" };
    case "go":
      return { id: contact.start?.gate ? "gate_drop" : "go" };

    // THE SCORE (`tricks.ts`): an element won is the gate's slap,
    // pitched up a step for every step of multiplier the combo now stands
    // at, so a combo climbing is heard climbing; the air's own rung is the
    // element beside it and says nothing of its own. A combo banked is the
    // lap's phrase — a sketchy one, banked at its base, gets none — and a
    // combo lost is the missed gate's fall.
    case "trick":
      if (event.trick === "air") return null;
      return { id: "checkpoint", shape: { pitch: 1 + 0.06 * Math.min(event.mult - 1, 10) } };
    case "combo":
      return event.sketchy ? null : { id: "lap" };
    case "bail":
      return { id: "missed" };

    // A JIB (`jib.ts`): the skis' bases met by the steel or the plastic —
    // the pole's clack pitched down to a rail's ring or a box's knock — and
    // the same note, softer, as he leaves it.
    case "jib":
      return {
        id: "pole",
        shape: {
          gain: event.phase === "on" ? 0.9 : 0.5,
          pitch: event.jib === "rail" ? 0.7 : 0.55,
        },
      };

    // A WIND TUNNEL'S MOUTH: sucked in, and let go at the far end
    // (`tunnel-voice.ts`'s two sweeps); the gale between is the bed's.
    case "tunnel":
      return { id: event.phase === "in" ? "tunnel_in" : "tunnel_out" };

    // A LIFT RIDDEN (`lift-voice.ts`): the chair taking him, the grip over
    // each tower's sheaves, and his skis set down at the top. A cabin's
    // towers are heard inside it as a chair's are; a drag's is a pull on
    // the snow, and the handing back of the controls says nothing.
    case "lift":
      if (event.phase === "take") return event.lift === "drag" ? null : { id: "lift_board" };
      if (event.phase === "tower") return event.lift === "drag" ? null : { id: "lift_tower" };
      if (event.phase === "off") return { id: "lift_off" };
      return null;

    // THE SNOWMOBILE (`sled-bank.ts`), heard from where the ear is: the
    // boots on the boards and the engine starting, the boots off them, the
    // machine heaved back up, and the crash of it going over.
    case "sled": {
      const heard = heardAt(event, contact.ear, HEARD_NEAR);
      switch (event.phase) {
        case "board":
        case "restart":
          return { id: "sled_board", shape: heard };
        case "hop":
          return { id: "sled_hop", shape: heard };
        case "right":
          return { id: "sled_right", shape: heard };
        case "crash":
          return {
            id: "sled_crash",
            shape: { ...heard, gain: heard.gain! * (0.7 + 0.5 * ramp(event.speed, 0, 20)) },
          };
        default:
          return null;
      }
    }

    // A PISTE MACHINE (`groomer.ts`), heard as the snowmobile's are: the
    // boots up into the cab and the engine caught, the boots back down on
    // the snow, and a skier met by twelve tonnes of steel — the machine's
    // crash, as loud as he came in hard. Its diesel is no bed of its own.
    case "groomer": {
      const heard = heardAt(
        { x: event.x, y: contact.ear?.y ?? 0, z: event.z },
        contact.ear,
        HEARD_NEAR,
      );
      if (event.phase === "board") return { id: "sled_board", shape: heard };
      if (event.phase === "hop") return { id: "sled_hop", shape: heard };
      return {
        id: "sled_crash",
        shape: { ...heard, gain: heard.gain! * (0.6 + 0.6 * ramp(event.speed, 2, 15)) },
      };
    }

    // THE HELICOPTER (`heli-bank.ts`), heard from where the ear is: the
    // boots on the skid, the skids lifting and landing, the drop's clack
    // and rush — and the CRASH, the biggest sound in the game, carrying a
    // long way down the valley. The pilot shutting down on the pad and the
    // ride stood up again say nothing: the rotor's bed winds down and up
    // on its own, and the skier stood on the pad is the reset's news.
    case "heli": {
      const heard = heardAt(event, contact.ear, HEARD_NEAR);
      switch (event.phase) {
        case "board":
          return { id: "heli_board", shape: heard };
        case "liftoff":
          return { id: "heli_liftoff", shape: heard };
        case "land":
          return { id: "heli_land", shape: heard };
        case "drop":
          return { id: "heli_drop", shape: heard };
        case "crash": {
          const blast = heardAt(event, contact.ear, BLAST_REF, BLAST_FLOOR);
          const big = CRASH_FLOOR + (1 - CRASH_FLOOR) * ramp(event.speed, 0, CRASH_FULL);
          return {
            id: "heli_crash",
            shape: {
              gain: blast.gain! * (0.85 + 0.45 * big),
              pitch: blast.pitch! * (1.08 - 0.12 * big),
              stretch: blast.stretch! * (0.9 + 0.2 * big),
            },
          };
        }
        default:
          return null;
      }
    }

    // THE PARAMOTOR, on his back: the rig let go is the drop's clack and
    // rush of the helicopter's skid, the buckles and the cloth away; the
    // rest of a flight is its engine's bed and the wind.
    case "para": {
      const heard = heardAt(event, contact.ear, HEARD_NEAR);
      return event.phase === "drop" || event.phase === "collapse"
        ? { id: "heli_drop", shape: heard }
        : null;
    }

    // THE AFTERSKI (`afterski-bank.ts`): always the player's own, heard
    // where he is — the lodge's door in and out, a beer; and a buzzed
    // skier's fall worked off on foot: up, a ski picked up, back in.
    case "afterski":
      return { id: `afterski_${event.phase}` };
    case "fetch":
      return {
        id: event.phase === "up" ? "fetch_up" : event.phase === "ski" ? "fetch_ski" : "fetch_in",
      };

    default:
      return null;
  }
}

/** The sounds a step's events make, in order, deduplicated: everything in a
 * step is simultaneous, so two events that make the same sound in one step
 * would be one sound at twice the level. And the flag outranks the lap it
 * closes — the last lap's chime under the finish phrase is the same news
 * said twice. */
export function soundsForStep(
  list: readonly GameEvent[],
  contactOf: (event: GameEvent) => Contact = () => ({}),
): { id: string; shape?: PlayShape }[] {
  const finishing = list.some((e) => e.kind === "finish");
  const played = new Set<string>();
  const out: { id: string; shape?: PlayShape }[] = [];
  for (const event of list) {
    if (finishing && event.kind === "lap") continue;
    const hit = soundForEvent(event, contactOf(event));
    if (!hit || played.has(hit.id)) continue;
    played.add(hit.id);
    out.push(hit);
  }
  return out;
}

/** A play, as heard from a seat: the listener's gain on every one-shot and
 * its muffle on the pitch, which moves every filter with it. */
export function heardFrom(
  shape: PlayShape | undefined,
  ear: { events: number; muffle: number },
): PlayShape {
  return {
    ...shape,
    gain: (shape?.gain ?? 1) * ear.events,
    pitch: (shape?.pitch ?? 1) * ear.muffle,
  };
}
