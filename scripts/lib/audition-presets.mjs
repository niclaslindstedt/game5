// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDITION METER'S PRESETS (`scripts/audition.mjs --meter`): the
// moments every bed is set to and read at — the skier's wind and snow, the
// wind tunnel, the helicopter and the snowmobile — as plain data the page
// is handed one by one. Pure; nothing here touches the page or the synth.

/** The moments the beds are metered at — a ladder from a skier stood in
 * the start gate to the whole mix flat out in a tuck, and the ones the ear
 * finds faults at: the push off into powder, a hockey stop and the air. */
/** The snow as a preset writes it: one kind of snow, every other slider at
 * zero, so a preset never inherits the last one's mix. */
const on = (kind, rest) => ({
  groomed: 0,
  hard: 0,
  soft: 0,
  new: 0,
  wet: 0,
  ice: 0,
  [kind]: 1,
  ski: "Chamois",
  ...rest,
});

/** A helicopter preset: the skier stood still (or carried by it, `aloft`)
 * in `wind` m/s of air, and the machine as `heli` sets it over silence. */
const heliAt = (name, wind, aloft, heli) => ({
  name,
  rush: { wind, crouch: 0, airborne: aloft },
  snow: on("groomed", { pace: 0, edge: 0, skid: 0, airborne: aloft }),
  heli,
});
/** The pilot cruising home, going away. */
const HOME = { spool: 1, collective: 0.6, slap: 0.2, closing: -40 };

export const PRESETS = [
  {
    name: "in the start gate",
    rush: { wind: 0, crouch: 0, airborne: false },
    snow: on("groomed", { pace: 0, edge: 0, skid: 0, airborne: false }),
  },
  {
    name: "pushing off into powder",
    rush: { wind: 3, crouch: 0, airborne: false },
    snow: on("soft", { pace: 0.08, edge: 0, skid: 0, airborne: false }),
  },
  {
    name: "cruising the piste",
    rush: { wind: 18, crouch: 0.2, airborne: false },
    snow: on("groomed", { pace: 0.55, edge: 0.3, skid: 0, airborne: false }),
  },
  {
    name: "flat out in a tuck",
    rush: { wind: 36, crouch: 1, airborne: false },
    snow: on("groomed", { pace: 1, edge: 0.1, skid: 0, airborne: false }),
  },
  {
    name: "carving on ice",
    rush: { wind: 25, crouch: 0.3, airborne: false },
    snow: on("ice", { pace: 0.7, edge: 0.9, skid: 0, airborne: false }),
  },
  {
    name: "hockey stop",
    rush: { wind: 12, crouch: 0, airborne: false },
    snow: on("groomed", { pace: 0.4, edge: 0.4, skid: 1, airborne: false }),
  },
  {
    name: "across the crust",
    rush: { wind: 15, crouch: 0.1, airborne: false },
    snow: on("hard", { pace: 0.45, edge: 0.4, skid: 0.2, airborne: false }),
  },
  {
    name: "deep in new snow",
    rush: { wind: 10, crouch: 0, airborne: false },
    snow: on("new", { pace: 0.3, edge: 0.2, skid: 0, airborne: false, ski: "Marmot" }),
  },
  {
    name: "spring slush",
    rush: { wind: 10, crouch: 0, airborne: false },
    snow: on("wet", { pace: 0.3, edge: 0.3, skid: 0.3, airborne: false }),
  },
  {
    name: "slalom ski on ice",
    rush: { wind: 20, crouch: 0.2, airborne: false },
    snow: on("ice", { pace: 0.8, edge: 1, skid: 0, airborne: false, ski: "Swift" }),
  },
  {
    name: "park ski on ice",
    rush: { wind: 20, crouch: 0.2, airborne: false },
    snow: on("ice", { pace: 0.8, edge: 1, skid: 0, airborne: false, ski: "Hare" }),
  },
  {
    name: "in the air",
    rush: { wind: 30, crouch: 0.4, airborne: true },
    snow: on("groomed", { pace: 0.9, edge: 0, skid: 0, airborne: true }),
  },
  {
    name: "standing in a storm",
    rush: { wind: 22, crouch: 0, airborne: false, side: 0.6 },
    snow: on("new", { pace: 0, edge: 0, skid: 0, airborne: false }),
  },
  {
    name: "a gale in the face, tucked",
    rush: { wind: 56, crouch: 1, airborne: false },
    snow: on("groomed", { pace: 0.85, edge: 0.1, skid: 0, airborne: false }),
  },
  {
    name: "a crosswind at speed",
    rush: { wind: 32, crouch: 0.3, airborne: false, side: -0.8 },
    snow: on("groomed", { pace: 0.75, edge: 0.2, skid: 0, airborne: false }),
  },
  {
    name: "blown down a wind tunnel",
    rush: { wind: 28, crouch: 0.3, airborne: false },
    snow: on("groomed", { pace: 0.75, edge: 0, skid: 0, airborne: false }),
    tunnel: { presence: 1, fan: 0.3 },
  },
  {
    name: "beside a wind tunnel",
    rush: { wind: 8, crouch: 0, airborne: false },
    snow: on("groomed", { pace: 0.2, edge: 0, skid: 0, airborne: false }),
    tunnel: { presence: 0.2, fan: 0 },
  },
  // THE HELICOPTER: on its skid (the skier's own wind as the machine
  // carries him), spooling up beside it, flying home and burning.
  heliAt("spooling up on the pad", 0, false, { spool: 0.35, rise: 1, collective: 0.1, wash: 0.25 }),
  heliAt("on the skid, hovering", 6, true, { spool: 1, collective: 0.65, wash: 0.8 }),
  heliAt("on the skid, diving", 40, true, { spool: 1, collective: 0.4, slap: 0.9 }),
  heliAt("flying home, 300 m off", 2, false, { ...HOME, distance: 300 }),
  heliAt("flying home, 1.5 km off", 2, false, { ...HOME, distance: 1500 }),
  heliAt("beside the burning wreck", 0, false, { distance: 15, fire: 1 }),
  // THE SNOWMOBILE: stood on its boards (the skier's own wind as it
  // carries him), and idling where he left it.
  sledAt("on the sled, idling", 0, { rev: 0, distance: 0 }),
  sledAt("pinned off the line in powder", 4, {
    rev: 0.85,
    throttle: 1,
    load: 1,
    belt: 20,
    slip: 16,
    loose: 1,
  }),
  sledAt("cruising the groomer", 20, { rev: 0.7, throttle: 0.5, load: 0.5, belt: 22, slip: 1 }),
  sledAt("high-marking a face", 8, {
    rev: 0.85,
    throttle: 1,
    load: 1,
    belt: 34,
    slip: 26,
    loose: 1,
  }),
  sledAt("off a crest, revving free", 22, { rev: 1, throttle: 1, load: 0, belt: 40 }),
  sledAt("left idling, 60 m off", 0, { rev: 0, distance: 60 }),
  // THE HOT AIR BALLOON: stood in its basket (drifting with the wind, so
  // no air past him) between burns, burning, venting, alight; and heard
  // from below as it flies on without him.
  balloonAt("in the basket, the pilot lit", {}),
  balloonAt("in the basket, burning", { flame: 1 }),
  balloonAt("in the basket, venting", { vent: 1, heat: 0.7 }),
  balloonAt("the envelope on fire", { fire: 1, pilot: 0 }),
  balloonAt("burning, 150 m off", { flame: 1, distance: 150 }),
];

/** A balloon preset over silence: the skier stood still in no wind, and
 * the balloon as `balloon` sets it. */
function balloonAt(name, balloon) {
  return {
    name,
    rush: { wind: 0, crouch: 0, airborne: true },
    snow: on("groomed", { pace: 0, edge: 0, skid: 0, airborne: true }),
    balloon: { pilot: 1, distance: 2.4, ...balloon },
  };
}

/** A preset that says nothing of the balloon has it far off and cold. */
export const NO_BALLOON = { flame: 0, pilot: 0, vent: 0, heat: 0, fire: 0, distance: 2000 };

/** A snowmobile preset over silence: the skier in `wind` m/s of air, and the
 * machine as `sled` sets it. */
function sledAt(name, wind, sled) {
  return {
    name,
    rush: { wind, crouch: 0, airborne: false },
    snow: on("groomed", { pace: 0, edge: 0, skid: 0, airborne: false }),
    sled: { distance: 0, ...sled },
  };
}

/** A preset that says nothing of the snowmobile has its engine off. */
export const NO_SLED = {
  rev: 0,
  throttle: 0,
  load: 0,
  belt: 0,
  slip: 0,
  loose: 0,
  distance: 400,
};

/** A preset that says nothing of the helicopter has none. */
export const NO_HELI = {
  spool: 0,
  rise: 0,
  collective: 0,
  slap: 0,
  wash: 0,
  distance: 3,
  closing: 0,
  fire: 0,
};
