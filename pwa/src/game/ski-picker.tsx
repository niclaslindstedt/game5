// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PICKER: the pair itself, turning on its rack, with an arrow
// either side of it. A row of names tells a skier nothing about what they
// are about to take out — the shape does: how long the tail is, how far the
// skis stand apart, how tall the lugs are — so the shape is the control.
//
// The turntable's three.js lives in `skis-turntable.ts` and is pulled in
// dynamically: this component is on the app shell's static import chain.
// Until the chunk lands the pane is the backdrop it will be drawn on, which
// is why the name and the arrows are markup rather than anything the canvas
// paints.

import { useEffect, useRef } from "preact/hooks";
import { SKI_CATALOG, skisById, type SkiId } from "@engine";

import type { Outfit } from "./outfit.ts";
import type { SkisTurntable } from "./ski-turntable.ts";
import { STRINGS } from "./strings.ts";

export function SkisPicker({
  skis,
  outfit,
  onPick,
}: {
  skis: SkiId;
  /** What the skier stood on it wears (`Settings.outfit`). */
  outfit: Outfit;
  onPick: (id: SkiId) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const standRef = useRef<SkisTurntable | null>(null);
  // The outfit rides beside the stand too, for one that lands late.
  const outfitRef = useRef(outfit);
  const spec = skisById(skis);
  const index = Math.max(
    0,
    SKI_CATALOG.findIndex((s) => s.id === spec.id),
  );
  const step = (by: number): void =>
    onPick(SKI_CATALOG[(index + by + SKI_CATALOG.length) % SKI_CATALOG.length].id);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    // The modelled skis, when this build draws them, are fetched before
    // the rack is built, so it turns the same pair the race will draw.
    void import("./ski-turntable.ts").then(async ({ createSkisTurntable, loadModels }) => {
      await loadModels();
      if (disposed) return;
      standRef.current = createSkisTurntable(canvas);
      standRef.current.setSkis(skisById(canvas.dataset.skis ?? spec.id), outfitRef.current);
    });
    const onResize = (): void => standRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      standRef.current?.dispose();
      standRef.current = null;
    };
    // Built once; the chosen pair flows in through the effect below, so a
    // pick swaps the skis on the stand instead of tearing the canvas down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The id also rides on the canvas, so a stand that finishes loading after
  // a pick has already happened picks it up.
  useEffect(() => {
    if (canvasRef.current) canvasRef.current.dataset.skis = spec.id;
    outfitRef.current = outfit;
    standRef.current?.setSkis(spec, outfit);
  }, [spec, outfit]);

  return (
    <div class="skis-pick-row">
      {/* The arrows and the pair between them are ONE stop on a
          controller's walk (`data-nav-steps`, menu-nav.ts): sideways changes
          the skis and leaves the cursor where it is. */}
      <div class="skis-pick" data-nav-steps data-nav-focus>
        <button
          type="button"
          class="skis-pick-step"
          data-nav-step="left"
          data-menu="skis-prev"
          onClick={() => step(-1)}
          aria-label={STRINGS.skisPrev}
        >
          ‹
        </button>
        <div class="skis-pick-stage" role="presentation">
          <canvas ref={canvasRef} class="skis-pick-canvas" />
        </div>
        <button
          type="button"
          class="skis-pick-step"
          data-nav-step="right"
          data-menu="skis-next"
          onClick={() => step(1)}
          aria-label={STRINGS.skisNext}
        >
          ›
        </button>
      </div>
      {/* The name, the class of ski it is, and where it stands in the
          catalog, as ONE plate across the head of the picture: seven pairs
          turning one at a time is a carousel with no edges, and `2 / 7` is
          the whole catalog in five characters. */}
      <div class="skis-pick-id">
        <span class="skis-pick-name">{spec.name.toUpperCase()}</span>
        <span class="skis-pick-kind">{spec.kind.toUpperCase()}</span>
        <span class="skis-pick-count">{STRINGS.skisOf(index + 1, SKI_CATALOG.length)}</span>
      </div>
    </div>
  );
}
