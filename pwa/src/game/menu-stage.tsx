// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STAGE BEHIND THE RIDER AND GEAR CARDS: one canvas across the whole
// screen (`gear-stage.ts`), kept while the player goes from the rider card
// to the gear card and back, so the lens moves between them rather than a
// picture being torn down and stood up again. The card stands over it; the
// parts of the card that cover the picture are marked `data-stage-cover`,
// and the skier is framed in what they leave free.
//
// The three.js is a chunk of its own, pulled in once the stage mounts:
// this component is on the app shell's static import chain. Until it lands
// the stage is its CSS sky.
//
// IT IS STOOD UP AHEAD OF ITS CARD (`warmStage`): the free ride's WHERE
// steps and start card ask for it while the skier picks the mountain, so
// the chunk, the models, the backdrop and the shaders are ready when NEXT
// opens the rider card, which takes the canvas over (`claim`). One not
// taken soon after the cards that asked for it close is let go, so no
// second context outlives the menu.
//
// IT GOES FIRST: anything heavy staged behind these cards — the free ride's
// world, a race's — waits for the stage to stand (`stageSettled`), so the
// rider is built and compiled before the mountain is, and is never turned
// round on a frame the mountain is being built on.

import { useEffect, useRef } from "preact/hooks";
import { pairById, type PairId } from "@engine";

import { holdBackdrop, stirHands } from "./backdrop-hold.ts";
import type { GearStage, StageLook, StageShot } from "./gear-stage.ts";
import { freeOf } from "./stage-free.ts";
import type { Outfit } from "./outfit.ts";

/** A stage stood up off the page, its canvas waiting to be taken. */
type Warm = { canvas: HTMLCanvasElement; stage: Promise<GearStage | null>; dropped: boolean };
let warm: Warm | null = null;
let letGo = 0;
/** The stage last asked for, warmed or shown: settled once it stands. */
let settling: Promise<unknown> = Promise.resolve();
/** How long anything waits on a stage that never stands, ms. */
const SETTLE_MOST_MS = 8000;

/** Resolved once the stage asked for last stands, built and compiled — at
 * once where none was asked for. Never rejects. */
export function stageSettled(): Promise<void> {
  const most = new Promise<void>((done) => setTimeout(done, SETTLE_MOST_MS));
  return Promise.race([
    settling.then(
      () => undefined,
      () => undefined,
    ),
    most,
  ]);
}

/** Winter, on the skis: what a stage stands him in unless asked otherwise. */
const WINTER: StageLook = { summer: false, bike: false };

const build = async (canvas: HTMLCanvasElement, skis: PairId, outfit: Outfit, look: StageLook) => {
  const { createGearStage, loadModels } = await import("./gear-stage.ts");
  await loadModels();
  const stage = await createGearStage(canvas);
  stage.look(look);
  stage.set("rider", pairById(skis), outfit);
  return stage;
};

/** Stand the stage up ahead of its card, held off the page, the other
 * kind's pair (`spare`: the board beside the skis, where boards are
 * offered) built with it. Asked again, it keeps the one it has. */
export function warmStage(
  skis: PairId,
  outfit: Outfit,
  spare: PairId | null = null,
  look: StageLook = WINTER,
): void {
  clearTimeout(letGo);
  // A stage already warming takes the season the start card is on now.
  if (warm) {
    void warm.stage.then((stage) => stage?.look(look));
    return;
  }
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.className = "menu-stage-canvas";
  const w: Warm = { canvas, stage: Promise.resolve(null), dropped: false };
  w.stage = build(canvas, skis, outfit, look).then(
    (stage) => {
      if (w.dropped) {
        stage.dispose();
        return null;
      }
      stage.spare(spare === null ? null : pairById(spare));
      stage.hold(true);
      return stage;
    },
    () => null,
  );
  warm = w;
  settling = w.stage;
}

/** The cards that asked for a stage are closing: let it go unless a stage
 * card takes it over in the moment after. */
export function coolStage(): void {
  clearTimeout(letGo);
  letGo = window.setTimeout(() => {
    const w = warm;
    warm = null;
    if (!w) return;
    w.dropped = true;
    void w.stage.then((stage) => stage?.dispose());
  }, 1500);
}

/** The stage waiting off the page, taken by the card that shows it. */
function claim(): Warm | null {
  clearTimeout(letGo);
  const w = warm;
  warm = null;
  return w;
}

export function MenuStage({
  shot,
  skis,
  outfit,
  look = WINTER,
}: {
  shot: StageShot;
  skis: PairId;
  outfit: Outfit;
  /** The season he is stood in, and whether the gear is the bike. */
  look?: StageLook;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<GearStage | null>(null);
  const wanted = useRef({ shot, skis, outfit, look });
  wanted.current = { shot, skis, outfit, look };

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    let disposed = false;
    let covering = false;
    let raf = 0;
    // The covers are measured every frame: a card's height changes with
    // its rows, and a resize event is not the only way a layout moves.
    const measure = (): void => {
      raf = requestAnimationFrame(measure);
      const menu = box.parentElement;
      if (!stageRef.current || !menu) return;
      const covers = Array.from(menu.querySelectorAll("[data-stage-cover]"), (el) =>
        el.getBoundingClientRect(),
      );
      stageRef.current.setFree(freeOf(box.getBoundingClientRect(), covers));
    };
    raf = requestAnimationFrame(measure);
    const taken = claim();
    // The warmed canvas stands where this one did, its listeners with it.
    if (taken) canvas.replaceWith(taken.canvas);
    const fresh = (on: HTMLCanvasElement) =>
      build(on, wanted.current.skis, wanted.current.outfit, wanted.current.look);
    const ready = taken ? taken.stage.then((stage) => stage ?? fresh(taken.canvas)) : fresh(canvas);
    settling = ready;
    void ready.then((stage) => {
      if (!stage) return;
      if (disposed) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;
      const w = wanted.current;
      stage.look(w.look);
      stage.set(w.shot, pairById(w.skis), w.outfit);
      stage.hold(false);
      box.dataset.ready = "1";
      // The stage fills the screen: nothing behind it need be drawn.
      covering = true;
      holdBackdrop(true);
      // The player reaches for him as the card opens: nothing staged
      // behind starts a heavy piece under that first turn.
      stirHands();
    });
    return () => {
      disposed = true;
      if (covering) holdBackdrop(false);
      cancelAnimationFrame(raf);
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, []);

  const { summer, bike } = look;
  useEffect(() => stageRef.current?.look({ summer, bike }), [summer, bike]);
  useEffect(() => stageRef.current?.set(shot, pairById(skis), outfit), [shot, skis, outfit]);

  return (
    <div ref={boxRef} class="menu-stage" role="presentation">
      <canvas ref={canvasRef} class="menu-stage-canvas" />
    </div>
  );
}
