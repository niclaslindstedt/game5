// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPTIONS ▸ KEYS — every action the skis and the race can be given, and the
// key on each. One page behind one row rather than ten rows on the options
// card: a binding is the one setting a player goes looking for
// deliberately, and ten of them would be longer than everything else on
// that card put together.
//
// THE ROW IS THE PRESS. Pressing one arms a capture-phase listener on the
// window; the next key becomes the whole binding for that action and the
// capture ends. There is no confirm step: the shortest path from "I want the
// brake on B" to the brake being on B is pressing the row and then B.
//
// ESCAPE BACKS OUT WITHOUT CHANGING ANYTHING, which makes it the one key
// this page cannot bind — deliberately: it is the way out of every card in
// the game, and a page that could take it away could leave a skier holding a
// race they cannot pause.
//
// WHICH IS WHY THE CURSOR'S OWN KEYS ARE HANDED OVER while a row listens
// (`holdNav` in menu-nav.ts): the card walker sits in the capture phase and
// was registered before this card existed, so it would otherwise eat the
// arrows and Escape on their way here — and the arrows are the edge,
// which is exactly what somebody on this page is most likely to be binding.
//
// THE HELICOPTER HAS A TABLE OF ITS OWN (`settings-heli-keys.ts`), its rows
// under their own heading: flying it is another game on the same keyboard,
// read only while he sits on the skid, so a key may serve the skier and the
// helicopter both without a clash.
//
// A KEY MAY SERVE TWO ACTIONS, and the manager applies every action a code
// carries — but a key quietly doing two jobs is the one thing this page must
// not hide, so the row says ALSO and the caption says what it means.

import { useLayoutEffect, useState } from "preact/hooks";

import { BindRow, Caption, MenuBody, MenuHead, type Hint } from "./menu-knobs.tsx";
import { holdNav } from "./menu-nav.ts";
import type { Settings } from "./settings.ts";
import {
  KEY_ACTIONS,
  bindKey,
  boundLabel,
  clashesWith,
  freshKeys,
  type KeyAction,
} from "./settings-input.ts";
import {
  HELI_KEY_ACTIONS,
  bindHeliKey,
  freshHeliKeys,
  heliClashesWith,
  type HeliAction,
} from "./settings-heli-keys.ts";
import { STRINGS } from "./strings.ts";

/** What each action is called, for the note on a row that shares its key. */
const LABELS = new Map(KEY_ACTIONS.map((entry) => [entry.id, entry.label]));
const HELI_LABELS = new Map(HELI_KEY_ACTIONS.map((entry) => [entry.id, entry.label]));

/** The row listening for its key: one of the skier's, or the helicopter's. */
type Listening = { table: "ski"; id: KeyAction } | { table: "heli"; id: HeliAction };

export function KeysPage({
  settings,
  onSettings,
  onBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
}) {
  const [listening, setListening] = useState<Listening | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);

  // A LAYOUT effect, so the capture is armed in the same commit that draws
  // the row as listening: an ordinary effect waits for the next paint, and a
  // key pressed in between would go to the manager as a press of whatever it
  // is bound to now.
  useLayoutEffect(() => {
    if (!listening) return;
    holdNav(true);
    const onKey = (e: KeyboardEvent): void => {
      // Capture phase, and the propagation stops here: the input manager
      // listens on this same window and would otherwise take the very key
      // being bound as a press of whatever it is bound to now.
      e.preventDefault();
      e.stopPropagation();
      setListening(null);
      if (e.code === "Escape") return;
      if (listening.table === "ski")
        onSettings({ ...settings, keys: bindKey(settings.keys, listening.id, e.code) });
      else
        onSettings({
          ...settings,
          heliKeys: bindHeliKey(settings.heliKeys, listening.id, e.code),
        });
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      holdNav(false);
    };
  }, [listening, settings, onSettings]);

  return (
    <div class="menu-card menu-card-keys" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuOptions} title={STRINGS.keysTitle} />
      <MenuBody>
        <div class="knob-binds">
          {KEY_ACTIONS.map((entry) => {
            const clash = clashesWith(settings.keys, entry.id);
            const others = clash.map((id) => LABELS.get(id) ?? id).join(", ");
            return (
              <BindRow
                key={entry.id}
                label={entry.label}
                bound={boundLabel(settings.keys[entry.id])}
                listening={listening?.table === "ski" && listening.id === entry.id}
                clash={clash.length > 0 ? `${STRINGS.keysClash} ${others}` : null}
                hint={
                  clash.length > 0
                    ? STRINGS.keysClashHint(entry.label, others)
                    : STRINGS.keysRowHint(entry.label)
                }
                // A second press on a row that is already listening is how a
                // player who changed their mind says so, with no key bound.
                onListen={() =>
                  setListening(
                    listening?.table === "ski" && listening.id === entry.id
                      ? null
                      : { table: "ski", id: entry.id },
                  )
                }
                onHint={setHint}
              />
            );
          })}
        </div>
        <h3 class="knob-section">{STRINGS.keysHeliTitle}</h3>
        <div class="knob-binds">
          {HELI_KEY_ACTIONS.map((entry) => {
            const clash = heliClashesWith(settings.heliKeys, entry.id);
            const others = clash.map((id) => HELI_LABELS.get(id) ?? id).join(", ");
            const on = listening?.table === "heli" && listening.id === entry.id;
            return (
              <BindRow
                key={entry.id}
                label={entry.label}
                bound={boundLabel(settings.heliKeys[entry.id])}
                listening={on}
                clash={clash.length > 0 ? `${STRINGS.keysClash} ${others}` : null}
                hint={
                  clash.length > 0
                    ? STRINGS.keysClashHint(entry.label, others)
                    : STRINGS.keysRowHint(entry.label)
                }
                onListen={() => setListening(on ? null : { table: "heli", id: entry.id })}
                onHint={setHint}
              />
            );
          })}
        </div>
        {/* THE SNOWMOBILE has no table of its own: the skier's keys ride it. */}
        <h3 class="knob-section">{STRINGS.keysSledTitle}</h3>
        <p class="knob-note">{STRINGS.sledKeysNote}</p>
        {/* ...and neither has the paramotor: the same keys fly the wing. */}
        <h3 class="knob-section">{STRINGS.keysParaTitle}</h3>
        <p class="knob-note">{STRINGS.paraKeysNote}</p>
        {/* ...nor the balloon: the same keys burn, vent and walk the basket. */}
        <h3 class="knob-section">{STRINGS.keysBalloonTitle}</h3>
        <p class="knob-note">{STRINGS.balloonKeysNote}</p>
        {/* The page's own restore: a skier who has made a mess of the keys
          wants the keys back, not the whole options page thrown away. */}
        <button
          type="button"
          class="opt-reset"
          onClick={() => onSettings({ ...settings, keys: freshKeys(), heliKeys: freshHeliKeys() })}
        >
          {STRINGS.keysRestore}
        </button>
      </MenuBody>
      <Caption hint={hint} fallback={STRINGS.keysCaption} />
    </div>
  );
}
