// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Walking a menu on the keys, and on a controller the day one is bound. A
// menu that can only be reached with a pointer is a menu a player on a
// handheld running this as an installed PWA cannot reach at all, and the
// game is already raced entirely from the keyboard.
//
// It is deliberately GENERIC rather than a cursor each card carries: every
// menu surface in this app is already built out of real `<button>`s laid out
// by CSS, so the cursor reads the layout that is actually on screen and moves
// to the nearest thing in the direction asked for. A page added tomorrow is
// navigable the day it is written, with nothing to remember.
//
// Four things ARE authored, because guessing them would be worse than
// asking: which containers are menus (ROOTS, most modal first), which
// control is a surface's way BACK (`data-nav-back`), which is its way ON
// (`data-nav-next` — what START presses), and where the cursor should be
// standing when the surface comes up (`data-nav-focus`, defaulting to the
// way on). The last two are what make a pad able to start a run by holding
// one button down: every surface names its own most likely press, and START
// takes it without the cursor having to be walked there first.
//
// Where the cursor GOES is the framework's `input/menu-cursor` — a pure function over
// rectangles, DOM-free so the tests can read it. This file is the half that
// has to ask a browser what is on screen.

import {
  pickNeighbour,
  type NavDir,
  type NavRect,
} from "@niclaslindstedt/oss-game-framework/input/menu-cursor";

/** The menu surfaces, MOST MODAL FIRST. The first one on screen owns the
 * cursor — a menu page or the pause card over the race, then a plate the HUD
 * puts up (the finish plate), and the attract card last because it is the
 * one surface that is never up at the same time as anything else. */
const ROOTS = [".menu-card", ".hud-card", ".splash"];

/** What the cursor may land on. Everything the menus are built from is a
 * button; the rest of the list is there so a surface that grows a real
 * control of another kind is not silently skipped. */
const ITEMS =
  "button:not([disabled]), [role='button']:not([aria-disabled='true']), a[href], input[type='range']:not([disabled])";

/** Where the cursor stands when a surface comes up. Falls back to the way
 * ON, and then to the first row that is not the way OUT — a cursor parked
 * on BACK is a cursor sitting on the one press nobody came here for. */
const FOCUS = "[data-nav-focus]";

/** The surface's way ON: the press a player who wants nothing else off this
 * screen would make. START takes it wherever the cursor happens to be, so
 * one press walks the attract card → the front door → the water. A surface
 * with no obvious next step marks none, and START does nothing there rather
 * than pressing something at random. */
const NEXT = "[data-nav-next]";

/** A VALUE CYCLED IN PLACE — an arrow either side of a value being picked.
 * The pair is one stop on the cursor's walk rather than two: sideways moves
 * the value and leaves the cursor where it is, which is what an arrow
 * either side of something means to a thumb. `data-nav-steps` marks the
 * group, `data-nav-step="left" / "right"` the two arrows. */
const STEPS = "[data-nav-steps]";

const arrowIn = (group: Element, dir: NavDir): HTMLElement | null =>
  group.querySelector<HTMLElement>(`[data-nav-step="${dir}"]`);

const isRange = (el: Element): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === "range";

/** A slider, moved one notch — sideways over a fader is the fader moving,
 * which is the same rule a stepper follows.
 *
 * The value has to go in through the PROTOTYPE's setter. React keeps its own
 * record of what an input last held, and it keeps it by replacing the
 * element's own `value` setter — so writing `el.value` updates that record
 * as a side effect, and the input event that follows looks to it like
 * nothing changed and is dropped on the floor. */
function nudgeRange(el: HTMLInputElement, by: number): void {
  const step = Number(el.step) || 1;
  const min = el.min === "" ? 0 : Number(el.min);
  const max = el.max === "" ? 100 : Number(el.max);
  const was = Number(el.value);
  const next = Math.min(max, Math.max(min, was + step * by));
  if (next === was) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(el, String(next));
  else el.value = String(next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * A surface that answers the directions ITSELF, marked with `data-nav-own`.
 *
 * Almost every card is a list of buttons and a cursor walking them, but a
 * surface where up and down mean something of its OWN — a value being typed,
 * a list being scrubbed — would have a ring on its first button arguing with
 * its own caret. Such a surface gets each direction as a cancelable
 * `menu-nav` event on its own element, and cancelling it is how it says it
 * has dealt with the press. Anything it leaves alone falls through to the
 * cursor, so a card can own up and down and still have its buttons walked.
 */
const OWNED = "[data-nav-own]";

/** The event an owning surface listens for, and what rides on it. */
export const NAV_EVENT = "menu-nav";
export type MenuNavEvent = CustomEvent<{ dir: NavDir | "confirm" }>;

/** Hand a press to the surface. True when the surface took it. */
function offer(host: HTMLElement, dir: NavDir | "confirm"): boolean {
  if (!host.matches(OWNED)) return false;
  const sent = new CustomEvent(NAV_EVENT, { detail: { dir }, cancelable: true });
  host.dispatchEvent(sent);
  return sent.defaultPrevented;
}

export type MenuNav = {
  /** Move the cursor. Does nothing when no menu is on screen. */
  move: (dir: NavDir) => void;
  /** Press what the cursor is on. */
  confirm: () => void;
  /** Take the surface's way ON — its `data-nav-next` control — whatever the
   * cursor is sitting on. Silent on a surface that has no next step. */
  next: () => void;
  /** The surface's own way back — its `data-nav-back` control. Silent on a
   * surface that has none, which is a card the player has to answer. */
  back: () => void;
  /** Whether a menu surface is on screen at all. Cheap; called every frame. */
  active: () => boolean;
  /** Put the cursor somewhere sensible if a new surface has come up, and
   * take it away when the last one goes. Called every frame while a pad is
   * connected — it does nothing at all until the surface CHANGES, because a
   * focus ring that reappears under the mouse is somebody else's cursor
   * moving on its own. */
  sync: () => void;
};

/**
 * THE KEYS HANDED OVER. While OPTIONS ▸ KEYS is listening for the key to
 * bind, the next press is the page's — the arrows and Escape included, and
 * the arrows are exactly what a skier on that page is most likely to be
 * rebinding. The walker below sits upstream of every card in the capture
 * phase, so the page cannot get in front of it; instead it says so here and
 * the walker stands aside.
 */
let handed = false;

export function holdNav(on: boolean): void {
  handed = on;
}

/** A card being walked on the keys, as the frame loop sees it. */
export type CardWalk = {
  /** True once a card has actually been walked with the keys — what
   * `sync()` waits for, because a focus ring that appeared under the mouse
   * would be a second cursor moving on its own. */
  walked: () => boolean;
  /** Take the listener off again. */
  stop: () => void;
};

/**
 * WALKING A CARD ON THE KEYS — the DIRECTIONS only, and BACK.
 *
 * CONFIRM is deliberately absent: every control on every card is a real
 * `<button>`, so Enter and Space on a focused one already activate it — and
 * a `confirm` here would press it a second time, which on RACE is a load
 * started twice.
 *
 * On `window` in the CAPTURE phase, upstream of the input manager, so a key
 * walking a menu never also rides the skis behind it. That is also why it
 * is registered once for the life of the loop rather than by whichever card
 * is up: a listener a card added later could not get in front of this one.
 *
 * `overACard` is the caller's, because only it knows which surface is up.
 */
export function walkCardsOnKeys(nav: MenuNav, overACard: () => boolean): CardWalk {
  const KEYS: Record<string, NavDir> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
  };
  let walked = false;
  const onKey = (e: KeyboardEvent): void => {
    if (handed || !overACard() || !nav.active()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEYS[e.code];
    if (dir) {
      e.preventDefault();
      e.stopPropagation();
      walked = true;
      nav.move(dir);
      return;
    }
    // The way out of a page, which is the same key that holds a race — so
    // one press means "back" wherever the player happens to be.
    if (e.code === "Escape" || e.code === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      nav.back();
    }
  };
  window.addEventListener("keydown", onKey, true);
  return {
    walked: () => walked,
    stop: () => window.removeEventListener("keydown", onKey, true),
  };
}

export function createMenuNav(): MenuNav {
  /** The surface the cursor was last put into, so `sync` can tell a new card
   * from the same card re-rendering. */
  let seen: Element | null = null;

  const root = (): HTMLElement | null => {
    if (typeof document === "undefined") return null;
    for (const selector of ROOTS) {
      const found = document.querySelector<HTMLElement>(selector);
      if (found && visible(found)) return found;
    }
    return null;
  };

  /** The cursor's stops on this surface, in reading order. A stepper group
   * collapses to ONE stop — its forward arrow, so a press on it means the
   * next value rather than the last one. */
  const items = (host: HTMLElement): HTMLElement[] => {
    const list: HTMLElement[] = [];
    const groups = new Set<Element>();
    for (const el of host.querySelectorAll<HTMLElement>(ITEMS)) {
      if (!visible(el)) continue;
      const group = el.closest<HTMLElement>(STEPS);
      if (!group) {
        list.push(el);
        continue;
      }
      if (groups.has(group)) continue;
      groups.add(group);
      list.push(arrowIn(group, "right") ?? el);
    }
    return list;
  };

  /** Where a surface puts the cursor when it comes up. */
  const landing = (host: HTMLElement): HTMLElement | undefined => {
    const list = items(host);
    // `contains` as well as identity, so a page can mark a whole control —
    // a stepper, say — rather than having to know which of its buttons the
    // cursor collapses onto.
    const aim = host.querySelector<HTMLElement>(FOCUS) ?? host.querySelector<HTMLElement>(NEXT);
    const marked = aim ? list.find((item) => item === aim || aim.contains(item)) : undefined;
    return marked ?? list.find((item) => !item.hasAttribute("data-nav-back")) ?? list[0];
  };

  /** Where the cursor is, as an index into `list` — −1 when it is nowhere,
   * which is what a fresh card and a click on the backdrop both look like. */
  const at = (list: HTMLElement[]): number => list.indexOf(document.activeElement as HTMLElement);

  /** The ring is a CLASS this module owns rather than `:focus-visible`.
   * Browsers decide that one from how the last press ARRIVED, and a
   * controller arrives as nothing at all — the ring would come and go by
   * heuristic on the one input that has nowhere else to look. */
  const put = (item: HTMLElement | undefined): void => {
    if (!item) return;
    clearRing();
    // The ring goes round the whole stepper where there is one: a glow on
    // the right-hand arrow alone says the arrow is selected, when what is
    // selected is the value between the two of them.
    (item.closest<HTMLElement>(STEPS) ?? item).classList.add(CURSOR);
    item.focus({ preventScroll: true });
    // A card taller than a phone held sideways has to follow the cursor, or
    // it walks off the bottom of the screen and out of sight.
    item.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return {
    active: () => root() !== null,
    sync: () => {
      const host = root();
      if (host === seen) return;
      seen = host;
      if (!host) {
        // The card is gone. Drop the ring with it: a race ridden with a
        // cursor still glowing on a button nobody can see is a bug report.
        clearRing();
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }
      // A surface that owns the directions draws its own place. Putting a
      // ring on its first button as well would be two cursors on one card.
      if (host.matches(OWNED)) return clearRing();
      put(landing(host));
    },
    move: (dir) => {
      const host = root();
      if (!host) return;
      if (offer(host, dir)) return;
      const list = items(host);
      if (list.length === 0) return;
      const from = at(list);
      // Off the card entirely — the first press brings the cursor back
      // rather than jumping somewhere the player never put it.
      if (from < 0) return put(landing(host));
      // A stepper answers sideways itself, and the cursor stays on it: left
      // and right over a stepped value are the previous and the next value,
      // not a walk onto whatever is beside it.
      const sideways = dir === "left" || dir === "right";
      const group = list[from].closest<HTMLElement>(STEPS);
      const arrow = group && sideways ? arrowIn(group, dir) : null;
      if (arrow) {
        arrow.click();
        return;
      }
      // A fader is the same idea with no arrows drawn on it.
      if (sideways && isRange(list[from])) {
        nudgeRange(list[from], dir === "right" ? 1 : -1);
        return;
      }
      const next = pickNeighbour(list.map(rectOf), from, dir);
      if (next !== null && next !== from) put(list[next]);
    },
    confirm: () => {
      const host = root();
      if (!host) return;
      if (offer(host, "confirm")) return;
      const list = items(host);
      const from = at(list);
      if (from >= 0) list[from].click();
      // A card with nothing to land on is still a card that has to be got
      // past — the attract card is a whole screen that answers to any press.
      else if (list.length === 0) host.click();
      else put(landing(host));
    },
    next: () => {
      const host = root();
      if (!host) return;
      const on = host.querySelector<HTMLElement>(NEXT);
      if (on) on.click();
      // Same rule confirm follows, for the same card: the attract cover has
      // no way on to mark and answers to any press at all, START included.
      else if (items(host).length === 0) host.click();
    },
    back: () => {
      const host = root();
      const out = host?.querySelector<HTMLElement>("[data-nav-back]");
      if (out) out.click();
    },
  };
}

/** The class the cursor wears, and the one styles.css draws the ring on. */
const CURSOR = "nav-cursor";

function clearRing(): void {
  for (const worn of document.querySelectorAll(`.${CURSOR}`)) worn.classList.remove(CURSOR);
}

/** Laid out and on screen. `getClientRects` is the honest test: it is empty
 * for anything `display: none`, and for anything with no box at all. */
function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/** A stop's box, as the player reads it: a stepper is measured across the
 * whole group, so DOWN off it leaves from under the value and not from under
 * the arrow on its right. */
function rectOf(el: HTMLElement): NavRect {
  const box = (el.closest<HTMLElement>(STEPS) ?? el).getBoundingClientRect();
  return { x: box.left, y: box.top, w: box.width, h: box.height };
}
