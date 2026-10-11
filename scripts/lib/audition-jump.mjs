// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDITION PAGE'S SKI JUMP (`scripts/audition.mjs`): its panel, the
// script that steers its bed (`jump-voice.ts`) off the panel's sliders, and
// the meter's presets — kept here so the page's own file stays readable.
// Plain strings and data the page is assembled from; the script runs in the
// page, after the runtime it names (`jumpTargets`, `JUMP_LAYERS`,
// `JUMP_GLIDE`) is in its scope.

export const JUMP_PANEL = `
  <h2>The ski jump</h2>
  <p class="sub">
    A ski jump's own beds: <b>tracks</b> is the skis in the in-run's grooves (the hiss, the
    rumble and the edges' whir), <b>air</b> the flight (the rush, the skis' flutter and the
    V's whistle), <b>speed</b> his speed along the tracks or through the air, <b>V</b> how far
    the skis are spread, <b>lay</b> how far he is laid over them. The crowd round the out-run:
    <b>near</b> how near the stadium the ear is (0.3 is on the bar, 1 in the out-run),
    <b>roar</b> how hard it roars, <b>groan</b> a fall's. The start signal, off the bar, the
    take-off, the slap and the telemark are in the bank below.
  </p>
  <div class="panel">
    <div class="switches"><button id="jump" class="primary" type="button">Start the jump</button></div>
    <div id="jumpSliders"></div>
  </div>
`;

export const JUMP_SCRIPT = `
// ── The ski jump ───────────────────────────────────────────────────────────
const jump = {};
window.__ear.jump = jump;
const jumpSliders = document.getElementById("jumpSliders");
sliderRow(jumpSliders, jump, "tracks", "Tracks", 1);
sliderRow(jumpSliders, jump, "air", "Air", 0);
sliderRow(jumpSliders, jump, "speed", "Speed", 24, 0, 35, " m/s");
sliderRow(jumpSliders, jump, "vee", "V", 0);
sliderRow(jumpSliders, jump, "lay", "Lay", 0);
sliderRow(jumpSliders, jump, "near", "Near", 0.3);
sliderRow(jumpSliders, jump, "roar", "Roar", 0);
sliderRow(jumpSliders, jump, "groan", "Groan", 0);
let jumpRack = null;
const jumpBtn = document.getElementById("jump");
jumpBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (jumpRack !== null) {
    clearInterval(jumpRack.timer);
    jumpRack.rack.stop();
    jumpRack = null;
    jumpBtn.className = "primary";
    jumpBtn.textContent = "Start the jump";
    return;
  }
  jumpBtn.className = "primary on";
  jumpBtn.textContent = "Stop the jump";
  const rack = createRack(synth, JUMP_LAYERS, JUMP_GLIDE);
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    const t = performance.now() / 1000;
    rack.apply(jumpTargets({ ...jump, t }, { wind: ear.wind, snow: ear.snow, events: ear.events }));
  }, 33);
  jumpRack = { timer, rack };
});
`;

/** A preset that says nothing of the ski jump has none. */
export const NO_JUMP = {
  tracks: 0,
  air: 0,
  speed: 0,
  vee: 0,
  lay: 0,
  near: 0,
  roar: 0,
  groan: 0,
};

const SNOW_OFF = {
  groomed: 1,
  hard: 0,
  soft: 0,
  new: 0,
  wet: 0,
  ice: 0,
  ski: "Albatross",
  pace: 0,
  edge: 0,
  skid: 0,
  airborne: true,
};

/** A jump preset: the skier's own wind as the ride bed has it on a jump
 * (`rideShares`: his on the tracks, the jump bed's in the air), the snow
 * bed silent (the tracks are the jump bed's), and the jump as `jump` sets
 * it. */
function jumpAt(name, wind, jump) {
  return {
    name,
    rush: { wind, crouch: wind > 0 ? 1 : 0, airborne: wind === 0 },
    snow: SNOW_OFF,
    jump: { ...NO_JUMP, ...jump },
  };
}

/** THE SKI JUMP'S METER PRESETS: on the bar under the crowd's murmur, down
 * the tracks slow and at the edge, in the air with the skis together and in
 * the V, the crowd rising past K, and the roar of a landing short of K, at
 * K and past HS, and the groan at a fall — heard from the out-run. */
export const JUMP_PRESETS = [
  jumpAt("jump: on the bar", 0, { near: 0.3 }),
  jumpAt("jump: the tracks, 15 m/s", 15, { tracks: 1, speed: 15, near: 0.32 }),
  jumpAt("jump: the tracks, at the edge", 26, { tracks: 1, speed: 26, near: 0.4 }),
  jumpAt("jump: off the edge, skis together", 0, { air: 1, speed: 26, lay: 0.3, near: 0.42 }),
  jumpAt("jump: flying the V", 0, { air: 1, speed: 28, vee: 1, lay: 1, near: 0.6 }),
  jumpAt("jump: flying past K", 0, {
    air: 1,
    speed: 30,
    vee: 1,
    lay: 1,
    near: 0.8,
    roar: 0.3,
  }),
  jumpAt("jump: landed short of K", 20, { near: 1, roar: 0.4 }),
  jumpAt("jump: landed at K", 20, { near: 1, roar: 0.65 }),
  jumpAt("jump: landed past HS", 20, { near: 1, roar: 1 }),
  jumpAt("jump: a fall at K", 10, { near: 1, roar: 0.36, groan: 1 }),
];
