// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE LAB'S HUD FRAME (`gore-hud.html`): one frame the lab shot,
// as its picture with the HUD laid over it by the game's own components and
// stylesheets — the readouts, the body's plate and the g meter, the glass
// jolted, the readouts falling off it and the death card
// (`hud-wreck.ts`, `hud-glass.tsx`). An iframe of the sheet at the frame's
// own size, so the HUD's vmin is the frame's; the frame is read off the
// sheet's page (`parent.__gore.hud`).

import "../styles.css";
import "../body.css";
import "../wreck.css";

import { render, type JSX } from "preact";

import { BodyPanel } from "../game/hud-body.tsx";
import { GForce } from "../game/hud-gforce.tsx";
import { DeathCard } from "../game/hud-glass.tsx";
import { wreckOf } from "../game/hud-wreck.ts";
import { STRINGS } from "../game/strings.ts";
import type { HudFrame } from "./gore-harness.ts";

const params = new URLSearchParams(location.search);
const index = Number(params.get("hud") ?? 0);
const frame = (parent as unknown as { __gore?: { hud: HudFrame[] } }).__gore?.hud[index];

function Page({ f }: { f: HudFrame }): JSX.Element {
  const tile = f.tile;
  const wreck = wreckOf(tile.blow, f.died?.since ?? null);
  return (
    <div style={{ position: "fixed", inset: 0, background: `center / cover url(${f.png})` }}>
      {/* The jolt is an animation: held at its furthest for the still. */}
      <style>{".hud[data-jolt]{animation-play-state:paused;animation-delay:-0.07s}"}</style>
      <div
        class="hud"
        data-wreck="1"
        data-jolt={wreck.jolt > 0 ? String(wreck.joltId % 2) : undefined}
        style={{
          "--hud-dark": "0",
          "--hud-jolt": wreck.jolt.toFixed(3),
          "--hud-bend": wreck.bend.toFixed(2),
          "--hud-fall": wreck.fall.toFixed(3),
        }}
      >
        <div class="hud-top">
          <div class="hud-top-row">
            <div class="hud-chip hud-seed">
              <span>{STRINGS.stage(f.seed)}</span>
            </div>
          </div>
        </div>
        <div class="hud-speed">
          <div class="hud-cluster">
            <span class="hud-speed-num">{Math.round(f.kmh)}</span>
            <span class="hud-speed-unit">{STRINGS.speedUnit}</span>
          </div>
        </div>
        <BodyPanel tile={tile} />
        {tile.blow && <GForce blow={tile.blow} />}
        {f.died && <DeathCard wreck={wreck} cause={f.died.cause} />}
      </div>
    </div>
  );
}

document.body.style.margin = "0";
const root = document.getElementById("hud")!;
if (frame) render(<Page f={frame} />, root);
(window as unknown as { __drawn: boolean }).__drawn = true;
