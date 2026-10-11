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

import { useEffect, useRef } from "preact/hooks";
import { pairById, type PairId } from "@engine";

import type { GearStage, StageShot } from "./gear-stage.ts";
import { freeOf } from "./stage-free.ts";
import type { Outfit } from "./outfit.ts";

export function MenuStage({
  shot,
  skis,
  outfit,
}: {
  shot: StageShot;
  skis: PairId;
  outfit: Outfit;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<GearStage | null>(null);
  const wanted = useRef({ shot, skis, outfit });
  wanted.current = { shot, skis, outfit };

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    let disposed = false;
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
    void import("./gear-stage.ts").then(async ({ createGearStage, loadModels }) => {
      await loadModels();
      if (disposed) return;
      const stage = createGearStage(canvas);
      stageRef.current = stage;
      const w = wanted.current;
      stage.set(w.shot, pairById(w.skis), w.outfit);
      box.dataset.ready = "1";
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => stageRef.current?.set(shot, pairById(skis), outfit), [shot, skis, outfit]);

  return (
    <div ref={boxRef} class="menu-stage" role="presentation">
      <canvas ref={canvasRef} class="menu-stage-canvas" />
    </div>
  );
}
