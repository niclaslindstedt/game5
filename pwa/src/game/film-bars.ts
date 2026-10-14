// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM'S LETTERBOX — the black bars over and under the picture while it
// is cut as a film: under the front door (`cinema-run.ts`) and on a
// replay's FILM angle (`replay-run.ts`). A wide screen is cropped to the
// 2.39 frame a film is shot in; a tall one gets a thin bar each end, never
// the frame a phone held upright would lose two thirds of its picture to.
//
// The bars close in over `close` s and open again at once, as the exit cut's
// do (`camera-exit.ts`). They are drawn by the page (`styles.css`'s
// `#root::before`, `--film-bar`): over the picture and UNDER every card,
// readout and press, so nothing a player reads is ever covered. Each of the
// two callers says whether it wants them; the bars stand while either does.
// The sums are pure (`filmBar`); `filmBars` is the one place the page is
// touched, and does nothing where there is no page (the suite, a lab).

/** The bars, as numbers: the frame they crop a wide screen to, the most a
 * bar may take of the height, a tall screen's bar, and the seconds they
 * take to close. */
export const FILM_BARS = { scope: 2.39, most: 0.13, tall: 0.045, close: 0.8 } as const;

/** A bar's share of the screen's height on a screen `aspect` wide to its
 * height, closed `on` 0..1 of the way. */
export function filmBar(aspect: number, on: number): number {
  const B = FILM_BARS;
  const scope = aspect >= 1 ? Math.max(0, (1 - aspect / B.scope) / 2) : B.tall;
  const k = Math.min(1, Math.max(0, on));
  return Math.min(B.most, scope) * k * k * (3 - 2 * k);
}

export type FilmWant = "menu" | "replay";

const wants: Record<FilmWant, boolean> = { menu: false, replay: false };
let shown = 0;
let at = 0;
let written = "";

/** `who` wants the bars this frame, or does not: eased in, cut out. */
export function filmBars(who: FilmWant, on: boolean): void {
  wants[who] = on;
  if (typeof document === "undefined") return;
  const now = performance.now() / 1000;
  const dt = at > 0 ? Math.min(0.1, Math.max(0, now - at)) : 0;
  at = now;
  shown = wants.menu || wants.replay ? Math.min(1, shown + dt / FILM_BARS.close) : 0;
  const bar = filmBar(innerWidth / Math.max(1, innerHeight), shown);
  const css = `${(bar * 100).toFixed(2)}%`;
  if (css === written) return;
  written = css;
  const root = document.documentElement;
  root.classList.toggle("film-bars", bar > 0.001);
  root.style.setProperty("--film-bar", css);
}
