// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE TRANSCEIVER IN HIS HAND (`beacon-read.ts` decides every
// figure).
//
// THE UNIT — low in the middle of the picture, where a searcher holds his
// out in front of him: a rugged case with a lamp that blinks with every
// beep, and a monochrome display drawn as a real one is — the mode (SEND or
// SEARCH), the signal's bars and how many units it hears, and in the
// middle FIVE ARROW SEGMENTS fanned over the DISTANCE: the segment along the
// flux line lit (a BACK arrow when the way in is behind him); in the signal
// search, a sweep and no number; in the fine search, the number alone
// between brackets. Under it, what to do next with the key that does it.
// On touch, its two presses beside it: BEACON (send / search) and PROBE /
// DIG (pressed a probe, held a dig).

import { useEffect, useMemo, useRef } from "preact/hooks";

import { createHudPress, pressHandlers } from "@niclaslindstedt/oss-game-framework/input/hud-press";
import { createThumbGuard } from "@niclaslindstedt/oss-game-framework/input/thumb-guard";

import type { BeaconRead } from "./beacon-read.ts";
import { capturePointer, stillDown } from "./hud-touch.tsx";
import { STRINGS } from "./strings.ts";

/** The arrow's five segments, rad off straight ahead. */
const FAN = [-0.9, -0.45, 0, 0.45, 0.9] as const;
/** Past this the way in is behind him: the back arrow. */
const BEHIND = 1.75;

/** The segment the arrow lights, or −1 for the back arrow. */
export function segmentOf(arrow: number): number {
  if (Math.abs(arrow) > BEHIND) return -1;
  let best = 0;
  for (let i = 1; i < FAN.length; i++) {
    if (Math.abs(arrow - FAN[i]) < Math.abs(arrow - FAN[best])) best = i;
  }
  return best;
}

/** One arrow segment of the fan, an outlined chevron pointing out along `a`. */
function Segment({ a, lit }: { a: number; lit: boolean }) {
  const r0 = 15;
  const r1 = 27;
  const w = 0.17;
  const pt = (r: number, t: number): string =>
    `${(60 + Math.sin(t) * r).toFixed(1)},${(46 - Math.cos(t) * r).toFixed(1)}`;
  const d = `M${pt(r0, a - w)} L${pt(r1 - 3, a - w * 0.75)} L${pt(r1 + 3, a)} L${pt(
    r1 - 3,
    a + w * 0.75,
  )} L${pt(r0, a + w)} Z`;
  return <path d={d} class={lit ? "hud-beacon-seg hud-beacon-lit" : "hud-beacon-seg"} />;
}

export function BeaconUnit({
  read,
  touch,
  beaconKey,
  rescueKey,
  onBeacon,
  onRescue,
}: {
  read: BeaconRead;
  touch: boolean;
  beaconKey: string;
  rescueKey: string;
  onBeacon: () => void;
  onRescue: (down: boolean) => void;
}) {
  const searching = read.mode !== "send";
  const seg = read.arrow === null ? null : segmentOf(read.arrow);
  const prompt =
    read.mode === "send"
      ? STRINGS.beaconSwitch(touch ? STRINGS.touchBeacon : beaconKey)
      : read.prompt === "slow"
        ? STRINGS.beaconSlow
        : read.prompt === "stop"
          ? STRINGS.beaconStop
          : read.prompt === "probe"
            ? STRINGS.beaconProbe(touch ? STRINGS.touchProbe : rescueKey)
            : read.prompt === "dig"
              ? STRINGS.beaconDig(touch ? STRINGS.touchDig : rescueKey)
              : read.prompt === "digging"
                ? STRINGS.beaconDigging
                : null;
  return (
    <div class={`hud-beacon hud-beacon-${read.mode}`} role="status">
      <div class="hud-beacon-case">
        <span
          class={read.beep > 0 ? "hud-beacon-led hud-beacon-blink" : "hud-beacon-led"}
          style={{ animationDuration: `${read.beep.toFixed(2)}s` }}
          aria-hidden="true"
        />
        <svg class="hud-beacon-lcd" viewBox="0 0 120 84" aria-hidden="true">
          <text x="5" y="11" class="hud-beacon-small">
            {searching ? STRINGS.beaconSearch : STRINGS.beaconSend}
          </text>
          {searching &&
            [0, 1, 2, 3, 4].map((i) => (
              <rect
                key={i}
                x={52 + i * 4}
                y={11 - (i + 1) * 1.6}
                width="2.6"
                height={(i + 1) * 1.6}
                class={i < read.bars ? "hud-beacon-bar hud-beacon-lit" : "hud-beacon-bar"}
              />
            ))}
          {searching && read.count > 0 && (
            <g>
              {Array.from({ length: Math.min(3, read.count) }, (_, i) => (
                <g key={i} transform={`translate(${103 - i * 7} 2)`}>
                  <circle cx="2.5" cy="2" r="1.6" class="hud-beacon-ink" />
                  <path d="M0.4 9.5 L1 4.6 H4 L4.6 9.5 Z" class="hud-beacon-ink" />
                </g>
              ))}
            </g>
          )}
          {read.mode === "coarse" && FAN.map((a, i) => <Segment key={i} a={a} lit={seg === i} />)}
          {read.mode === "coarse" && seg === -1 && (
            <g>
              <path d="M68 44 V30 a8 8 0 0 0 -16 0 V38" class="hud-beacon-ink-line" />
              <path d="M46 36 L52 46 L58 36 Z" class="hud-beacon-ink" />
            </g>
          )}
          {read.mode === "signal" && (
            <g class="hud-beacon-sweep">
              <path d="M30 40 Q60 6 90 40" class="hud-beacon-scan" />
              <text x="60" y="66" class="hud-beacon-mid">
                {STRINGS.beaconNoSignal}
              </text>
            </g>
          )}
          {read.mode === "send" && (
            <g>
              <path d="M44 44 q16 -18 32 0 M50 50 q10 -11 20 0" class="hud-beacon-scan" />
              <circle cx="60" cy="56" r="2.6" class="hud-beacon-ink" />
            </g>
          )}
          {read.metres !== null && (
            <text
              x="60"
              y={read.mode === "fine" ? 58 : 78}
              class={read.mode === "fine" ? "hud-beacon-big hud-beacon-fine" : "hud-beacon-big"}
            >
              {STRINGS.beaconMetres(read.metres)}
              <tspan class="hud-beacon-unit">{STRINGS.beaconUnit}</tspan>
            </text>
          )}
          {read.mode === "fine" && (
            <g class="hud-beacon-ink-line">
              <path d="M18 28 h-8 v40 h8 M102 28 h8 v40 h-8" />
            </g>
          )}
          {read.struck && (
            <text x="60" y="80" class="hud-beacon-small hud-beacon-mid">
              {STRINGS.beaconStrike}
            </text>
          )}
        </svg>
        {read.prompt === "digging" || read.prompt === "dig" ? (
          <span class="hud-beacon-dug" aria-hidden="true">
            <span style={{ width: `${Math.round(read.dug * 100)}%` }} />
          </span>
        ) : null}
      </div>
      {prompt && <span class="hud-beacon-prompt">{prompt}</span>}
      {touch && (
        <div class="hud-beacon-presses">
          <TapPress label={STRINGS.touchBeacon} onPress={onBeacon} />
          {searching && (
            <HoldPress
              label={
                read.prompt === "dig" || read.prompt === "digging"
                  ? STRINGS.touchDig
                  : STRINGS.touchProbe
              }
              on={onRescue}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TapPress({ label, onPress }: { label: string; onPress: () => void }) {
  const press = useMemo(createHudPress, []);
  return (
    <button type="button" class="hud-beacon-press" {...pressHandlers(press, onPress)}>
      {label}
    </button>
  );
}

/** The PROBE / DIG press: down writes `on(true)`, the lift (or the thumb
 * guard ending the grip) `on(false)`. */
function HoldPress({ label, on }: { label: string; on: (down: boolean) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const onRef = useRef(on);
  onRef.current = on;
  const guard = useMemo(
    () =>
      createThumbGuard(() => {
        onRef.current(false);
        ref.current?.classList.remove("hud-beacon-held");
      }, window),
    [],
  );
  useEffect(() => () => guard.dispose(), [guard]);
  return (
    <button
      ref={ref}
      type="button"
      class="hud-beacon-press hud-beacon-hold"
      data-touch="rescue"
      onPointerDown={(e) => {
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        ref.current?.classList.add("hud-beacon-held");
        onRef.current(true);
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      {label}
    </button>
  );
}
