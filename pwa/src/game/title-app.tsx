// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE'S HALF OF THE APP: which backdrop the front door stands over
// (`shell.ts`'s `Backdrop`), the title scene's stage while it is the title,
// and the attract card that reveals it — kept out of `App.tsx`, which owns
// only the moments they change: a surface coming up (`shellIs`) and the
// first return to the door from a run (`toRace`).
//
// THE TWO BACKDROPS. A visit opens over the TITLE SCENE: no map is built
// into the world's renderer until the first run is stood up, so the first
// door costs a picture rather than a mountain. The live RACE the bot rides
// comes back the first time the player leaves a run for the door, and
// stays. The loop asks through a ref (`raced`), as it reads the shell,
// never through state.

import { useEffect, useRef, useState } from "preact/hooks";

import { presetOf, type VideoSettings } from "./settings-video.ts";
import { initialBackdrop, titleUp, type Backdrop, type Shell } from "./shell.ts";
import { SplashScreen } from "./splash-screen.tsx";
import { TitleStage } from "./title-stage.tsx";

export function useTitle(
  params: { rides: boolean; bench: boolean; titleT: number | null },
  firstShell: Shell,
) {
  const [backdrop, setBackdrop] = useState<Backdrop>(() =>
    initialBackdrop(location.search, params.rides || params.bench),
  );
  const ref = useRef(backdrop);
  /** The scene's first frame is drawn — what the attract card waits on. */
  const [ready, setReady] = useState(false);
  /** The reveal has begun (at once when the card is skipped). */
  const [lit, setLit] = useState(firstShell !== "splash");
  /** A run has been skied: the title is never drawn again this visit. */
  const [spent, setSpent] = useState(false);
  /** The attract card is up — through its flight into the door, too. */
  const [splashUp, setSplashUp] = useState(firstShell === "splash");
  return {
    /** Whether the door is over the live race (the loop asks, every frame). */
    raced: (): boolean => ref.current === "race",
    /** The first return to the door from a run: the live race from here. */
    toRace: (): void => {
      ref.current = "race";
      setBackdrop("race");
    },
    /** A surface came up; a run (or a replay, or the benchmark) spends it. */
    shellIs: (next: Shell): void => {
      if (next === "run" || next === "replay" || next === "bench") setSpent(true);
    },
    /** The stage, while the title is the backdrop under this surface —
     * and the cards' chrome told which backdrop they stand over. */
    stage: (shell: Shell, video: VideoSettings) => (
      <>
        <MenuChrome backdrop={backdrop} flat={flatGlass(backdrop, video)} />
        {titleUp(backdrop, shell, spent) && (
          <TitleStage
            lit={lit}
            menuOpen={shell === "menu"}
            frozenT={params.titleT}
            onReady={() => setReady(true)}
          />
        )}
      </>
    ),
    /** The attract card: over the title it waits on the scene's first
     * frame AND the app's boot (`worldWarm` — the map the door will ride
     * generated, the heavy main-thread work, done behind beat one rather
     * than under the reveal); over the race, on the world's first frame.
     * Its press hands the screen to the door (`enter`). */
    splash: (worldWarm: boolean, enter: () => void) =>
      splashUp && (
        <SplashScreen
          warm={backdrop === "title" ? ready && worldWarm : worldWarm}
          onReveal={() => setLit(true)}
          onPress={enter}
          onDone={() => setSplashUp(false)}
          frozenMs={params.titleT === null ? null : params.titleT * 1000}
        />
      ),
  };
}

/**
 * THE GLASS'S PRICE. A frosted card is a full-screen blur of whatever is
 * under it, every frame it changes: over the title scene that is cheap, and
 * over a held race it is paid once — but over the LIVE race on a machine
 * already told to draw a LOW picture, or on a phone (a coarse pointer), it is
 * a second render pass the race's frame rate pays for. There the cards wear a
 * darker solid tint instead (`menu.css`'s `[data-glass="flat"]`).
 */
function flatGlass(backdrop: Backdrop, video: VideoSettings): boolean {
  if (presetOf(video) === "low") return true;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return backdrop === "race" && coarse;
}

/** The backdrop and the glass, as attributes on the document's root, so
 * every card (`.menu`) and the pause card read one answer from `menu.css`
 * however deep they sit. Renders nothing. */
function MenuChrome({ backdrop, flat }: { backdrop: Backdrop; flat: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.backdrop = backdrop;
    root.dataset.glass = flat ? "flat" : "frost";
  }, [backdrop, flat]);
  return null;
}
