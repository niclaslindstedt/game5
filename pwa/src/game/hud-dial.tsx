// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EDGE BAR — the instrument that is DRAWN rather than printed, in the
// corner the speed is read from. A skier has no revs to read: what he has
// is an EDGE — how far the skis are tipped off flat, and to which side —
// and a TUCK. So the bar is centred: flat in the middle, the fill running
// LEFT or RIGHT from the centre as the skis go over, and the last stretch
// either way is red, because an edge stood past there at speed is the one
// that catches. Under it a thin SPEED LINE fills with the tuck — a skier
// folded out of the wind is a skier going faster. Nothing here reads the
// game: it is handed two shares and paints them.

/** The bar's box, in its own hundred-unit space. */
const BAR_W = 100;
const BAR_H = 14;
/** Where the red band starts, as a share of the full edge either side. */
const RED_FROM = 0.85;
/** The speed line's height under the bar, in the same units. */
const LINE_H = 3;

/** `edge` is the skis' edge as a share of the pair's full edge, -1..1,
 * positive to the player's right; `tuck` the crouch, 0..1. `braking`
 * paints the fill in the alarm colour — the one the touch lever's skid
 * throw fills with — because on the keys the skid has no lever of its own
 * to light. */
export function EdgeBar({ edge, tuck, braking }: { edge: number; tuck: number; braking: boolean }) {
  const share = Math.max(-1, Math.min(1, edge));
  const half = BAR_W / 2;
  const hot = Math.abs(share) >= RED_FROM;
  const redW = (1 - RED_FROM) * half;
  return (
    <svg
      class={`hud-revs ${hot ? "hud-revs-hot" : ""} ${braking ? "hud-revs-brake" : ""}`}
      viewBox={`0 0 ${BAR_W} ${BAR_H + LINE_H + 1}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect class="hud-revs-track" x="0" y="0" width={BAR_W} height={BAR_H} rx="2" />
      <rect class="hud-revs-red" x="0" y="0" width={redW} height={BAR_H} rx="2" />
      <rect class="hud-revs-red" x={BAR_W - redW} y="0" width={redW} height={BAR_H} rx="2" />
      {/* The fill is scaled rather than re-sized so the browser can tween it
          between HUD snapshots and the bar reads smooth at 12 Hz: a half-bar
          anchored at the centre, scaled out toward the side the edge is
          on. */}
      <rect
        class="hud-revs-fill"
        x={half}
        y="1.5"
        width={half}
        height={BAR_H - 3}
        rx="1.5"
        style={{
          transform: `scaleX(${share.toFixed(3)})`,
          transformOrigin: `${half}px 0`,
        }}
      />
      {[0.25, 0.5, 0.75].map((tick) => (
        <path
          key={tick}
          class="hud-revs-tick"
          d={`M ${tick * BAR_W} 0 L ${tick * BAR_W} ${BAR_H}`}
        />
      ))}
      <path class="hud-revs-centre" d={`M ${half} 0 L ${half} ${BAR_H}`} />
      <rect class="hud-revs-track" x="0" y={BAR_H + 1} width={BAR_W} height={LINE_H} rx="1" />
      <rect
        class="hud-revs-tuck"
        x="0"
        y={BAR_H + 1}
        width={BAR_W}
        height={LINE_H}
        rx="1"
        style={{ transform: `scaleX(${Math.max(0, Math.min(1, tuck)).toFixed(3)})` }}
      />
    </svg>
  );
}
