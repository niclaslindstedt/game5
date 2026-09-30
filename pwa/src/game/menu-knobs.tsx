// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROWS A SETTINGS PAGE IS BUILT FROM — OPTIONS and OPTIONS ▸ KEYS alike —
// as ONE silhouette: the setting's name on the left, its value on the right
// between two arrows, and under the value a row of pips saying where on its
// ladder the value stands (or, for a fader, the track filled to its level).
//
// One shape for every setting is the whole reason a player can read a page
// of them WITHOUT reading it: every row answers to the same two presses,
// sideways moves the value, and nothing has to be explained twice. A switch
// is a two-stop ladder and a volume is a ladder drawn as a track — the same
// row either way.
//
// THE ROWS CARRY NO SENTENCE OF THEIR OWN. A row that explains itself is
// HEIGHT, and a page of them is a page that scrolls on a phone; the
// explanation goes to ONE caption bar the page owns ({@link Caption}), which
// reads whichever row the pointer or the cursor is on. The bar is fixed to
// the foot of the WINDOW rather than the card, because the card is the
// scroller: a sentence parked at the bottom of a column taller than the
// viewport is a sentence nobody reading a row at the top can see.
//
// Every one of them is a real `<button>` or `<input>`, which is what makes
// `menu-nav.ts` able to walk a page with nothing to register:
// `data-nav-steps` marks the pair of arrows as ONE stop on the cursor's walk,
// and sideways over the row presses them.
//
// Ported from the sibling game's rows — the seed field ({@link NumberRow})
// with the start card that needs it.

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { Glyph, type GlyphName } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

/** One place a ladder can stand. */
export type Stop<T extends string> = { id: T; label: string };

/** WHAT A ROW DOES, as the caption bar reads it back: the row's own NAME and
 * then the sentence — a caption is read out of the corner of the eye, and a
 * sentence with nothing naming what it is about has to be traced back up the
 * column to be used. */
export type Hint = { label: string; text: string };

/** Where a row sends its description when it is looked at — on the pointer
 * entering it, and on the cursor landing on it, so a card is read the same
 * way by a mouse, a thumb and the keys. */
export type OnHint = (hint: Hint | null) => void;

const says = (label: string, text: string | undefined): Hint | null =>
  text === undefined || text === "" ? null : { label, text };

/** The two stops of a switch, stated once so ON and OFF are the same two
 * words everywhere. */
export const ON_OFF: Stop<"off" | "on">[] = [
  { id: "off", label: STRINGS.optOff },
  { id: "on", label: STRINGS.optOn },
];

/** A boolean as a stop id. */
export const onOff = (on: boolean): "off" | "on" => (on ? "on" : "off");

/** A PAGE'S HEAD: the way back, and the title — and, on a page that has
 * one, its way ON standing opposite the way back (`action`). `data-nav-back`
 * is what the cursor's way out (Escape, Backspace) presses — see
 * menu-nav.ts. */
export function MenuHead({
  back,
  backLabel,
  title,
  action,
}: {
  back: () => void;
  backLabel: string;
  title: string;
  action?: ComponentChildren;
}) {
  return (
    <div class={`menu-head${action ? " menu-head-with-action" : ""}`}>
      <button type="button" class="menu-back" data-nav-back onClick={back}>
        ‹ {backLabel}
      </button>
      <div class="menu-title">{title}</div>
      {action}
    </div>
  );
}

/** The name a row leads with, in a box of its own so it can be TRUNCATED
 * rather than run under the arrows: a row is sized by its value and its two
 * targets, and the name is the only part of it that may give. */
function KnobLabel({ label }: { label: string }) {
  return (
    <span class="knob-label">
      <span class="knob-name">{label}</span>
    </span>
  );
}

/**
 * A setting with NAMED answers — a tier, a side, on or off.
 *
 * The arrows WRAP: on the keys an arrow that does nothing at the end of a
 * row reads as a row that has stopped working. `extra` is a value that is
 * not a stop — the PRESET row's CUSTOM — shown in the value's place with no
 * pip lit, and left by the first press onto a real stop.
 */
export function StepRow<T extends string>({
  label,
  stops,
  value,
  extra,
  hint,
  onPick,
  onHint,
}: {
  label: string;
  stops: readonly Stop<T>[];
  value: T | string;
  /** The word for a value that is on no stop. */
  extra?: string;
  hint?: string;
  onPick: (id: T) => void;
  onHint?: OnHint;
}) {
  const at = stops.findIndex((stop) => stop.id === value);
  const current = at < 0 ? null : stops[at];
  const describe = (): void => onHint?.(says(label, hint));
  const step = (dir: 1 | -1): void => {
    // Off the ladder, the first press lands on an END of it rather than on
    // whatever index arithmetic on −1 happens to produce.
    const to = at < 0 ? (dir > 0 ? 0 : stops.length - 1) : (at + dir + stops.length) % stops.length;
    onPick(stops[to].id);
    describe();
  };
  return (
    <div class="knob" data-nav-steps onPointerEnter={describe} onFocusCapture={describe}>
      <KnobLabel label={label} />
      <div class="knob-ctl">
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="left"
          aria-label={`${label}: ${STRINGS.optPrev}`}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span class="knob-value">
          <span class="knob-word">{current?.label ?? extra ?? STRINGS.optUnset}</span>
          <span class="knob-pips" aria-hidden="true">
            {stops.map((stop, i) => (
              <i key={stop.id} class={`knob-pip${i === at ? " knob-pip-on" : ""}`} />
            ))}
          </span>
        </span>
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="right"
          aria-label={`${label}: ${STRINGS.optNext}`}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * A CONTINUOUS setting — a volume, a thumb's travel — drawn as the thing it
 * is: a track with the level filled along it, the reading standing over it
 * where a ladder's value stands over its pips. The arrows step it one notch,
 * which is what the keys press; the track is a real range input, so a press
 * anywhere along it puts the thumb where the finger landed and carries on
 * into the drag.
 */
export function FadeRow({
  label,
  value,
  min,
  max,
  step,
  read,
  hint,
  onChange,
  onHint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** The travel's grid, and what one press of an arrow moves. */
  step: number;
  read: (value: number) => string;
  hint?: string;
  onChange: (value: number) => void;
  onHint?: OnHint;
}) {
  const describe = (): void => onHint?.(says(label, hint));
  // On the travel's grid, to hundredths: a level stepped from 0.7 is 0.8.
  const snap = (next: number): number =>
    Number((Math.round((Math.min(max, Math.max(min, next)) - min) / step) * step + min).toFixed(2));
  const fill = max > min ? (value - min) / (max - min) : 0;
  return (
    <div class="knob knob-faded" data-nav-steps onPointerEnter={describe} onFocusCapture={describe}>
      <KnobLabel label={label} />
      <div class="knob-ctl">
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="left"
          aria-label={`${label}: ${STRINGS.optLess}`}
          onClick={() => onChange(snap(value - step))}
        >
          ‹
        </button>
        <span class="knob-value knob-fade">
          <span class="knob-word knob-read">{read(value)}</span>
          <input
            class="knob-range"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label={label}
            style={`--fill: ${Math.round(fill * 100)}%`}
            onInput={(e) => onChange(snap(Number((e.target as HTMLInputElement).value)))}
          />
        </span>
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="right"
          aria-label={`${label}: ${STRINGS.optMore}`}
          onClick={() => onChange(snap(value + step))}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * A WHOLE NUMBER, TYPED OR STEPPED — the seed. The arrows stop at either end
 * of the travel and a typed number is clamped into it; an emptied field is a
 * CANCEL, not a zero. The field blurs itself on its way off the page, so a
 * card that goes away under a focused input does not take a phone's
 * keyboard state with it.
 */
export function NumberRow({
  label,
  value,
  min,
  max,
  hint,
  onValue,
  onHint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  onValue: (value: number) => void;
  onHint?: OnHint;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  /** Escape's blur is a cancel, and the blur handler runs before the row
   * renders the draft away — so it is told by a ref. */
  const cancelled = useRef(false);
  useEffect(() => {
    const field = fieldRef.current;
    return () => {
      if (field && document.activeElement === field) field.blur();
    };
  }, []);
  const describe = (): void => onHint?.(says(label, hint));
  const clampTo = (next: number): number => Math.min(max, Math.max(min, next));
  const step = (dir: 1 | -1): void => {
    setDraft(null);
    onValue(clampTo(value + dir));
    describe();
  };
  const commit = (text: string): void => {
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const digits = text.replace(/[^0-9]/g, "");
    if (digits === "") return;
    const next = clampTo(Number(digits));
    if (next !== value) onValue(next);
  };
  return (
    <div class="knob" data-nav-steps onPointerEnter={describe} onFocusCapture={describe}>
      <KnobLabel label={label} />
      <div class="knob-ctl">
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="left"
          aria-label={`${label}: ${STRINGS.optPrev}`}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span class="knob-value">
          <input
            ref={fieldRef}
            class="knob-word knob-field"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellcheck={false}
            aria-label={label}
            value={draft ?? String(value)}
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            onBlur={(e) => commit((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              // The way OUT of a field is the way out of everything else on
              // the card, so Escape hands the keys back to the menu.
              if (e.key === "Escape") {
                cancelled.current = true;
                (e.target as HTMLInputElement).blur();
                e.stopPropagation();
              }
            }}
          />
        </span>
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="right"
          aria-label={`${label}: ${STRINGS.optNext}`}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/** A row that OPENS A PAGE — the keys — with what is behind it summarised
 * where a value would stand, and one arrow pointing on instead of a pair. */
export function LinkRow({
  label,
  value,
  hint,
  onOpen,
  onHint,
}: {
  label: string;
  value: string;
  hint?: string;
  onOpen: () => void;
  onHint?: OnHint;
}) {
  const describe = (): void => onHint?.(says(label, hint));
  return (
    <button
      type="button"
      class="knob knob-link"
      onPointerEnter={describe}
      onFocus={describe}
      onClick={onOpen}
    >
      <KnobLabel label={label} />
      <span class="knob-ctl">
        <span class="knob-value">
          <span class="knob-word">{value}</span>
        </span>
        <span class="knob-arrow knob-arrow-go" aria-hidden="true">
          ›
        </span>
      </span>
    </button>
  );
}

/**
 * ONE REBINDABLE ACTION. The row IS the press: it arms a capture, and the
 * next key becomes the whole binding. `clash` is a key doing two jobs —
 * allowed, and never hidden: the row says which other action shares it.
 */
export function BindRow({
  label,
  bound,
  listening,
  clash,
  hint,
  onListen,
  onHint,
}: {
  label: string;
  /** What is on the action now, as the player reads it off their keyboard. */
  bound: string;
  listening: boolean;
  /** The other actions on the same key, already worded; null where none. */
  clash: string | null;
  hint?: string;
  onListen: () => void;
  onHint?: OnHint;
}) {
  const describe = (): void => onHint?.(says(label, hint));
  return (
    <button
      type="button"
      class={`knob knob-bind${listening ? " knob-bind-listening" : ""}`}
      aria-pressed={listening}
      onPointerEnter={describe}
      onFocus={describe}
      onClick={onListen}
    >
      <KnobLabel label={label} />
      <span class="knob-value">
        <span class="knob-word">{listening ? STRINGS.keysPrompt : bound}</span>
        {/* Under the key rather than beside it: the value column is a fixed
            width so the page's keys stand on one x. */}
        {!listening && clash && <span class="knob-clash">{clash}</span>}
      </span>
    </button>
  );
}

/** A handful of rows under one word AND ONE MARK: a column of identical
 * silhouettes reads as a list to be searched, and the same column under a
 * few headings reads as a few small questions — and the mark is what the eye
 * lands on, the only thing on the page that is not text. */
export function KnobGroup({
  title,
  glyph,
  children,
}: {
  title: string;
  glyph: GlyphName;
  children: ComponentChildren;
}) {
  return (
    <section class="knob-group">
      <h3 class="knob-group-title">
        <Glyph name={glyph} className="knob-group-glyph" />
        <span>{title}</span>
      </h3>
      <div class="knob-rows">{children}</div>
    </section>
  );
}

/** The page's ONE sentence — the row being looked at, named and then
 * explained, or the page's own line while no row is. Written as the card's
 * last child and DRAWN at the foot of the window (`.knob-caption` is fixed),
 * out of flow so it costs the card no height. */
export function Caption({ hint, fallback }: { hint: Hint | null; fallback: string }) {
  return (
    <div class={`knob-caption${hint ? " knob-caption-on" : ""}`} aria-live="polite">
      {hint === null ? (
        fallback
      ) : (
        <>
          <b class="knob-caption-name">{hint.label}</b>
          {hint.text}
        </>
      )}
    </div>
  );
}
