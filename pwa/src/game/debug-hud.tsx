// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVELOPER OVERLAY: whatever the developer page switched on, in small
// type down the left of the picture — the frame rate, the frame's cost, the
// physics' readouts, the engine's last lines — with the REPRO line at its
// foot: the frame on screen as a URL (`debug-readout.ts`).
//
// The markup over a `DebugSnapshot` and nothing else: every figure is worked
// out DOM-free and refreshed on the HUD's tick, never per frame. It takes no
// presses (`pointer-events: none`) — an instrument over a race must not
// steal the thumb that is riding it — so the REPRO line is there to be read,
// and the developer page's COPY REPRO LINK is the press that puts it on the
// clipboard.

import type { DebugSnapshot } from "./debug-readout.ts";
import { STRINGS } from "./strings.ts";

const ms = (v: number): string => v.toFixed(1);

export function DebugOverlay({ snap }: { snap: DebugSnapshot }) {
  const { cost, physics } = snap;
  return (
    <div class="dev-overlay" aria-hidden="true">
      {snap.fps !== null && (
        <div class="dev-overlay-fps">{STRINGS.devFps(Math.round(snap.fps), ms(snap.frameMs))}</div>
      )}
      {cost && (
        <div class="dev-overlay-block">
          <div>{STRINGS.devCostLine(cost.calls, cost.triangles)}</div>
          <div>
            sim {ms(cost.simMs)} · draw {ms(cost.frameMs)} (pose {ms(cost.poseMs)} · trail{" "}
            {ms(cost.trailMs)} · world {ms(cost.worldMs)} · submit {ms(cost.submitMs)}) ms
          </div>
          <div>
            {cost.programs} programs · {cost.geometries} geometries · {cost.textures} textures
          </div>
        </div>
      )}
      {physics && (
        <div class="dev-overlay-block">
          <div>
            {(physics.speed * 3.6).toFixed(0)} km/h · way {physics.way.toFixed(1)} m/s · edge{" "}
            {physics.edge}° · skid {physics.skid}% · packed {physics.packed}% · snow ×
            {physics.snowDepth.toFixed(2)}
            {physics.airborne ? ` · ${STRINGS.devAir}` : ""}
          </div>
          <table class="dev-probes">
            <tbody>
              <tr>
                <th>{STRINGS.devProbe}</th>
                <th>N</th>
                <th>sink cm</th>
                <th>travel cm</th>
              </tr>
              {physics.probes.map((p) => (
                <tr key={p.name} class={p.touching ? "" : "dev-probe-off"}>
                  <td>{p.name}</td>
                  <td>{p.load}</td>
                  <td>{p.sink.toFixed(1)}</td>
                  <td>{p.travel.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {snap.log && (
        <div class="dev-overlay-block dev-overlay-log">
          {snap.log.length === 0
            ? STRINGS.devLogEmpty
            : snap.log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {snap.freefly && <div class="dev-overlay-block">{STRINGS.devFlyKeys}</div>}
      <div class="dev-overlay-repro">
        {STRINGS.devReproLabel} {snap.repro}
      </div>
    </div>
  );
}
