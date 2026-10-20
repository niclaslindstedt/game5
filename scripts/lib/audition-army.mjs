// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDITION PAGE'S ARMY VEHICLES (`scripts/audition.mjs`): the panel,
// the script that steers one wave vehicle's diesel and tracks
// (`army-vehicle-voice.ts`) off the panel's sliders, and the meter's
// presets — kept here so the page's own file stays readable. Plain strings
// and data the page is assembled from; the script runs in the page, after
// the runtime it names (`vehicleTargets`, `vehicleHeard`, `VEHICLE_LAYERS`,
// `VEHICLE_GLIDE`) is in its scope.

export const ARMY_PANEL = `
  <h2>The army's vehicles</h2>
  <p class="sub">
    A ground wave's vehicle, heard from the skier: <b>kind</b> 0 the tracked carrier, 1 the
    truck, 2 the tank; <b>revs</b> the diesel's share of its band, <b>load</b> how hard it
    works (a climb, pulling away), <b>pace</b> its speed over the snow (the tracks' clatter
    and squeal, a truck's chains), <b>distance</b> from the ear. The tank's gun and its burst
    are in the bank below.
  </p>
  <div class="panel">
    <div class="switches"><button id="vehicle" class="primary" type="button">Start the vehicle</button></div>
    <div id="vehicleSliders"></div>
  </div>
`;

export const ARMY_SCRIPT = `
// ── The army's vehicles ────────────────────────────────────────────────────
const vehicle = {};
window.__ear.vehicle = vehicle;
const vehicleSliders = document.getElementById("vehicleSliders");
sliderRow(vehicleSliders, vehicle, "kind", "Kind", 2, 0, 2);
sliderRow(vehicleSliders, vehicle, "rev", "Revs", 0.4);
sliderRow(vehicleSliders, vehicle, "load", "Load", 0.4);
sliderRow(vehicleSliders, vehicle, "pace", "Pace", 6, 0, 16, " m/s");
sliderRow(vehicleSliders, vehicle, "distance", "Distance", 30, 0, 800, " m");
let vehicleRack = null;
const vehicleBtn = document.getElementById("vehicle");
vehicleBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (vehicleRack !== null) {
    clearInterval(vehicleRack.timer);
    vehicleRack.rack.stop();
    vehicleRack = null;
    vehicleBtn.className = "primary";
    vehicleBtn.textContent = "Start the vehicle";
    return;
  }
  vehicleBtn.className = "primary on";
  vehicleBtn.textContent = "Stop the vehicle";
  const rack = createRack(synth, VEHICLE_LAYERS, VEHICLE_GLIDE);
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    const heard = vehicleHeard(vehicle.distance);
    const kind = ["carrier", "truck", "tank"][Math.round(vehicle.kind)] ?? "tank";
    rack.apply(
      vehicleTargets(
        { kind, rev: vehicle.rev, load: vehicle.load, pace: vehicle.pace },
        { gain: heard.gain * ear.machine, tone: heard.tone },
      ),
    );
  }, 33);
  vehicleRack = { timer, rack };
});
`;

/** A preset that says nothing of the army's vehicles has none near. */
export const NO_VEHICLE = { kind: 2, rev: 0, load: 0, pace: 0, distance: 5000 };

const SNOW_OFF = {
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
  airborne: false,
};

/** A vehicle preset over silence: the skier stood still, and one vehicle
 * as `vehicle` sets it. */
function vehicleAt(name, vehicle) {
  return {
    name,
    rush: { wind: 0, crouch: 0, airborne: false },
    snow: SNOW_OFF,
    vehicle: { ...NO_VEHICLE, ...vehicle },
  };
}

/** THE ARMY'S VEHICLES' METER PRESETS: a tank idling near, grinding up a
 * slope past him and heard far off; a carrier at cruise; a truck on its
 * chains. */
export const ARMY_PRESETS = [
  vehicleAt("tank idling, 25 m off", { kind: 2, rev: 0.05, load: 0.08, pace: 0, distance: 25 }),
  vehicleAt("tank climbing past, 20 m", { kind: 2, rev: 0.8, load: 0.9, pace: 6, distance: 20 }),
  vehicleAt("tank climbing, 400 m off", { kind: 2, rev: 0.8, load: 0.9, pace: 6, distance: 400 }),
  vehicleAt("carrier at cruise, 30 m", { kind: 0, rev: 0.75, load: 0.4, pace: 11, distance: 30 }),
  vehicleAt("truck on chains, 30 m", { kind: 1, rev: 0.7, load: 0.5, pace: 9, distance: 30 }),
];
