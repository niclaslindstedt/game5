// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDITION PAGE'S JUMP PLANE AND SKYDIVE (`scripts/audition.mjs`): their
// panels and the scripts that steer their beds (`plane-voice.ts`,
// `chute-voice.ts`) off the panels' sliders, as the page's helicopter and
// balloon are — kept here so the page's own file stays readable. Plain
// strings the page is assembled from; the scripts run in the page, after the
// runtime they name (`planeTargets`, `PLANE_LAYERS`, `chuteTargets`, …) is in
// its scope.

export const PLANE_PANEL = `
  <h2>The jump plane</h2>
  <p class="sub">
    The free ride's single turboprop: <b>prop rpm</b> is the propeller's share of its
    governed speed (the thrum's and the buzz's blade rate), <b>gas gen</b> the turbine's (the
    whine's pitch — it leads on the start), <b>run-up</b> the start's whine, <b>power</b> and
    <b>bite</b> the blades' load (the buzz, and the tips' rasp at full power), <b>airspeed</b>
    with the <b>door</b> open the slipstream, <b>cabin</b> 1 heard from the cockpit or the door
    and 0 from a boom outside, <b>roll</b> and <b>rough</b> the wheel-skis on the snow,
    <b>stall</b> the horn, <b>flaps</b> the motor, and <b>distance</b> and <b>closing</b> the
    plane flying home without him.
  </p>
  <div class="panel">
    <div class="switches"><button id="plane" class="primary" type="button">Start the plane</button></div>
    <div id="planeSliders"></div>
  </div>
  <h2>The skydive</h2>
  <p class="sub">
    The jump out of its door: <b>on his body</b> the freefall's roar at <b>airspeed</b> with his
    <b>attitude</b> (1.57 on the belly, 3.14 head down) and his <b>track</b>, <b>exit</b> the
    plane's blast buffeting him, <b>flog</b> the canopy coming out of its bag, <b>open</b> the
    canopy over him (its rustle, the lines' hum, the <b>brakes</b>' luff), and <b>cut away</b>
    the canopy flapping off up the sky <b>away</b> metres off.
  </p>
  <div class="panel">
    <div class="switches"><button id="chute" class="primary" type="button">Start the skydive</button></div>
    <div id="chuteSliders"></div>
  </div>
`;

export const PLANE_SCRIPT = `
// ── The jump plane ─────────────────────────────────────────────────────────
const plane = {};
window.__ear.plane = plane;
const planeSliders = document.getElementById("planeSliders");
sliderRow(planeSliders, plane, "rpm", "Prop rpm", 1);
sliderRow(planeSliders, plane, "ng", "Gas gen", 1);
sliderRow(planeSliders, plane, "rise", "Run-up", 0);
sliderRow(planeSliders, plane, "power", "Power", 0.8);
sliderRow(planeSliders, plane, "load", "Bite", 0.5);
sliderRow(planeSliders, plane, "airspeed", "Airspeed", 45, 0, 90, " m/s");
sliderRow(planeSliders, plane, "door", "Door", 1);
sliderRow(planeSliders, plane, "cabin", "Cabin", 1);
sliderRow(planeSliders, plane, "roll", "Roll", 0, 0, 40, " m/s");
sliderRow(planeSliders, plane, "rough", "Rough", 0);
sliderRow(planeSliders, plane, "warn", "Stall", 0);
sliderRow(planeSliders, plane, "flapRun", "Flaps", 0);
sliderRow(planeSliders, plane, "distance", "Distance", 4, 0, 2500, " m");
sliderRow(planeSliders, plane, "closing", "Closing", 0, -80, 80, " m/s");
sliderRow(planeSliders, plane, "fire", "Fire", 0);
let planeRack = null;
let planeSlot = 0;
const planeBtn = document.getElementById("plane");
planeBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (planeRack !== null) {
    clearInterval(planeRack.timer);
    planeRack.rack.stop();
    planeRack = null;
    planeBtn.className = "primary";
    planeBtn.textContent = "Start the plane";
    return;
  }
  planeBtn.className = "primary on";
  planeBtn.textContent = "Stop the plane";
  const rack = createRack(synth, PLANE_LAYERS, PLANE_GLIDE);
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    const t = performance.now() / 1000;
    const voice = { ...plane, doppler: dopplerOf(plane.closing), pan: 0, t };
    rack.apply(planeTargets(voice, DATA.prop, { machine: ear.machine }));
    const now = Math.floor(t * CRACKLE_SLOTS);
    const heard = heliHeard(plane.distance);
    for (let s = Math.max(planeSlot + 1, now - 4); s <= now; s++) {
      const pop = crackleAt(s * 3 + 5, plane.fire);
      if (pop) {
        playDef(synth, DATA.bank.heli_crackle, {
          gain: pop.size * heard.gain * ear.machine * ear.events,
          pitch: pop.pitch * (0.6 + 0.4 * heard.bright),
        });
      }
    }
    planeSlot = now;
  }, 33);
  planeRack = { timer, rack };
});

// ── The skydive ────────────────────────────────────────────────────────────
const chute = {};
window.__ear.chute = chute;
const chuteSliders = document.getElementById("chuteSliders");
sliderRow(chuteSliders, chute, "body", "On his body", 1);
sliderRow(chuteSliders, chute, "exit", "Exit", 0);
sliderRow(chuteSliders, chute, "airspeed", "Airspeed", 55, 0, 90, " m/s");
sliderRow(chuteSliders, chute, "attitude", "Attitude", 1.57, 0, 3.14);
sliderRow(chuteSliders, chute, "track", "Track", 0);
sliderRow(chuteSliders, chute, "flog", "Flog", 0);
sliderRow(chuteSliders, chute, "open", "Open", 0);
sliderRow(chuteSliders, chute, "brake", "Brakes", 0);
sliderRow(chuteSliders, chute, "turn", "Turn", 0);
sliderRow(chuteSliders, chute, "riser", "Risers", 0);
sliderRow(chuteSliders, chute, "pull", "Hands on the toggles", 0);
sliderRow(chuteSliders, chute, "piece", "Cut away", 0, 0, 20, " m/s");
sliderRow(chuteSliders, chute, "pieceDistance", "Away", 10, 0, 500, " m");
sliderRow(chuteSliders, chute, "suit", "Wingsuit full", 0);
let chuteRack = null;
const chuteBtn = document.getElementById("chute");
chuteBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (chuteRack !== null) {
    clearInterval(chuteRack.timer);
    chuteRack.rack.stop();
    chuteRack = null;
    chuteBtn.className = "primary";
    chuteBtn.textContent = "Start the skydive";
    return;
  }
  chuteBtn.className = "primary on";
  chuteBtn.textContent = "Stop the skydive";
  const rack = createRack(synth, CHUTE_LAYERS, CHUTE_GLIDE);
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    const voice = { ...chute, stalled: false, t: performance.now() / 1000 };
    rack.apply(chuteTargets(voice, { wind: ear.wind, machine: ear.machine }));
  }, 33);
  chuteRack = { timer, rack };
});
`;

/** A plane preset over silence: the skier carried in its door (his own
 * wind the plane's bed — `rideShares`), the plane as `plane` sets it. */
export function planeAt(name, plane) {
  return {
    name,
    rush: { wind: 0, crouch: 0, airborne: true },
    snow: SILENT_SNOW,
    plane: { ...PLANE_ON, ...plane },
  };
}

/** A skydive preset over silence: the jumper as `chute` sets him, and the
 * ride bed's wind as it is heard at the same time (none in freefall; the
 * canopy's glide under it). */
export function chuteAt(name, wind, chute) {
  return {
    name,
    rush: { wind, crouch: 0, airborne: true },
    snow: SILENT_SNOW,
    chute: { ...NO_CHUTE, ...chute },
  };
}

const SILENT_SNOW = {
  groomed: 1,
  hard: 0,
  soft: 0,
  new: 0,
  wet: 0,
  ice: 0,
  ski: "Chamois",
  pace: 0,
  edge: 0,
  skid: 0,
  airborne: true,
};

/** The plane running, in its door: a preset's starting point. */
const PLANE_ON = {
  rpm: 1,
  ng: 1,
  rise: 0,
  power: 0.8,
  load: 0.5,
  airspeed: 45,
  door: 1,
  cabin: 1,
  roll: 0,
  rough: 0,
  warn: 0,
  flapRun: 0,
  distance: 4,
  closing: 0,
  fire: 0,
};

/** A preset that says nothing of the plane has none. */
export const NO_PLANE = {
  ...PLANE_ON,
  rpm: 0,
  ng: 0,
  power: 0,
  load: 0,
  airspeed: 0,
  door: 0,
  distance: 2500,
};

/** A preset that says nothing of the skydive has none. */
export const NO_CHUTE = {
  body: 0,
  exit: 0,
  airspeed: 0,
  attitude: 1.57,
  track: 0,
  flog: 0,
  open: 0,
  brake: 0,
  turn: 0,
  riser: 0,
  pull: 0,
  piece: 0,
  pieceDistance: 500,
  suit: 0,
};

/** THE PLANE AND THE SKYDIVE'S METER PRESETS: the start in the door, the
 * take-off roll at full power, the climb from the cockpit and from the
 * boom, the stall, the plane flying home 300 m and 1.5 km off; out of the
 * door, the freefall on the belly and head down, the canopy flogging open,
 * the quiet under it, the flare, the toggles worked, and the cut-away flapping off;
 * and the wingsuit filling off its exit, gliding and diving. */
export const PLANE_PRESETS = [
  planeAt("the plane starting, in the door", {
    rpm: 0.4,
    ng: 0.65,
    rise: 1,
    power: 0.04,
    load: 0.05,
    airspeed: 0,
  }),
  planeAt("the take-off roll, flat out", { power: 1, load: 1, airspeed: 22, roll: 22, rough: 0.4 }),
  planeAt("climbing, in the door", { power: 1, load: 0.6, airspeed: 40 }),
  planeAt("climbing, from the boom", { power: 1, load: 0.6, airspeed: 40, cabin: 0 }),
  planeAt("the jump run, 60 m/s", { power: 0.5, load: 0.25, airspeed: 60 }),
  planeAt("stalling, the horn", { power: 0.3, load: 0.4, airspeed: 26, warn: 1 }),
  planeAt("flying home, 300 m off", {
    cabin: 0,
    power: 0.5,
    load: 0.3,
    distance: 300,
    closing: -50,
  }),
  planeAt("flying home, 1.5 km off", {
    cabin: 0,
    power: 0.5,
    load: 0.3,
    distance: 1500,
    closing: -50,
  }),
  planeAt("beside the burning wreck", {
    ...NO_PLANE,
    distance: 20,
    fire: 1,
  }),
  chuteAt("out of the door", 0, { body: 1, exit: 1, airspeed: 45, attitude: 0.4 }),
  chuteAt("freefall, belly, terminal", 0, { body: 1, airspeed: 55 }),
  chuteAt("freefall, head down", 0, { body: 1, airspeed: 88, attitude: 3.1 }),
  chuteAt("freefall, tracking", 0, { body: 1, airspeed: 62, track: 1 }),
  chuteAt("the canopy flogging open", 0, { body: 0.5, airspeed: 35, flog: 1 }),
  chuteAt("under the canopy", 12, { open: 1, airspeed: 12 }),
  chuteAt("the flare", 6, { open: 1, airspeed: 7, brake: 1 }),
  chuteAt("working the toggles", 12, { open: 1, airspeed: 11, turn: 0.6, pull: 0.8 }),
  chuteAt("cut away, the canopy off", 0, { piece: 15, pieceDistance: 15 }),
  chuteAt("wingsuit, filling off the exit", 0, { body: 1, exit: 1, airspeed: 20, suit: 0.4 }),
  chuteAt("wingsuit, gliding 150 km/h", 0, { body: 1, airspeed: 44, suit: 1 }),
  chuteAt("wingsuit, diving 250 km/h", 0, { body: 1, airspeed: 70, suit: 1 }),
];
