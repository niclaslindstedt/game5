// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDITION PAGE'S HOT AIR BALLOON (`scripts/audition.mjs`): its panel
// and the script that steers its bed (`balloon-voice.ts`) off the panel's
// sliders, as the page's helicopter and snowmobile are — kept here so the
// page's own file stays readable. Plain strings the page is assembled from;
// the script runs in the page, after the runtime it names
// (`balloonTargets`, `BALLOON_LAYERS`, `crackleAt`, …) is in its scope.

export const BALLOON_PANEL = `
  <h2>The hot air balloon</h2>
  <p class="sub">
    The free ride's balloon: <b>flame</b> is the burner (the blast valve held open — the
    roar, the rumble and the jet's hiss; moving it up from nothing raises the valve's clack
    and whoomp, down to nothing the clack shut), <b>pilot</b> the pilot light's hiss between
    burns, <b>vent</b> the parachute valve pulled with the envelope <b>hot</b> over the air,
    <b>fire</b> the envelope alight. <b>Distance</b> is from the ear to the burner — 2.4 m is
    stood in the basket.
  </p>
  <div class="panel">
    <div class="switches"><button id="balloon" class="primary" type="button">Start the balloon</button></div>
    <div id="balloonSliders"></div>
  </div>
`;

export const BALLOON_SCRIPT = `
// ── The hot air balloon ────────────────────────────────────────────────────
const balloon = {};
window.__ear.balloon = balloon;
const balloonSliders = document.getElementById("balloonSliders");
sliderRow(balloonSliders, balloon, "flame", "Flame", 0);
sliderRow(balloonSliders, balloon, "pilot", "Pilot", 1);
sliderRow(balloonSliders, balloon, "vent", "Vent", 0);
sliderRow(balloonSliders, balloon, "heat", "Hot", 0.6);
sliderRow(balloonSliders, balloon, "fire", "Fire", 0);
sliderRow(balloonSliders, balloon, "distance", "Distance", 2.4, 0, 2000, " m");
let balloonRack = null;
let balloonSlot = 0;
let balloonLit = false;
const balloonBtn = document.getElementById("balloon");
balloonBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (balloonRack !== null) {
    clearInterval(balloonRack.timer);
    balloonRack.rack.stop();
    balloonRack = null;
    balloonBtn.className = "primary";
    balloonBtn.textContent = "Start the balloon";
    return;
  }
  balloonBtn.className = "primary on";
  balloonBtn.textContent = "Stop the balloon";
  const rack = createRack(synth, BALLOON_LAYERS, BALLOON_GLIDE);
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    const t = performance.now() / 1000;
    const voice = { ...balloon, t };
    rack.apply(balloonTargets(voice, { machine: ear.machine }));
    const heard = heliHeard(Math.max(0, balloon.distance - BALLOON_REF) * 2.5);
    const lit = balloon.flame > 0.05;
    if (lit !== balloonLit) {
      playDef(synth, DATA.bank[lit ? "balloon_valve" : "balloon_shut"], {
        gain: heard.gain * ear.machine * ear.events,
      });
      balloonLit = lit;
    }
    const now = Math.floor(t * CRACKLE_SLOTS);
    for (let s = Math.max(balloonSlot + 1, now - 4); s <= now; s++) {
      const pop = crackleAt(s * 7 + 3, balloon.fire);
      if (pop) {
        playDef(synth, DATA.bank.heli_crackle, {
          gain: pop.size * heard.gain * ear.machine * ear.events,
          pitch: pop.pitch * (0.6 + 0.4 * heard.bright),
        });
      }
    }
    balloonSlot = now;
  }, 33);
  balloonRack = { timer, rack };
});
`;
