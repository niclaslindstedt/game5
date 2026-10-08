// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE STAGE: the key art the attract card reveals and the first front
// door stands over — the path-traced plate (`pwa/src/title/`) brought to life
// by `title-renderer.ts` on a canvas of its own, between the world's canvas
// and the cards.
//
// It fetches its own renderer chunk and its plates (content-hashed by the
// build, so a release replaces them and the service worker keeps them),
// decodes them with no premultiply and no colour conversion, draws a first
// frame — dark, the reveal not begun — and reports `onReady`, which is what
// the attract card's first beat waits on. It runs its own animation frame:
// the app's fixed-step clock is the engine's, and the title has no physics.
//
// THE TITLE CLOCK starts when `lit` first turns true (the reveal), or is
// held at a lab's `?titleT=` (`frozenT`) — a frozen frame also holds the
// resolution, the framing and the grain still, so two captures of one time
// are one picture. Without WebGL2, or if anything fails, the stage shows
// the colour plate as a still poster and reports ready all the same: a boot
// is never held on a picture.

import { useEffect, useRef, useState } from "preact/hooks";

import colourUrl from "../title/title-colour.webp?url";
import auxUrl from "../title/title-aux.webp?url";
import plateUrl from "../title/title-plate.json?url";
import type { TitlePlate } from "../title/plates.ts";
import type { TitleRenderer } from "./title-renderer.ts";

async function bitmapOf(url: string): Promise<ImageBitmap> {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
}

export function TitleStage({
  lit,
  menuOpen,
  frozenT,
  onReady,
}: {
  /** The reveal has begun: the title clock runs from here. */
  lit: boolean;
  /** The front door is up: the lens eases to its framing. */
  menuOpen: boolean;
  /** A lab's frozen title time, s, or null for the live clock. */
  frozenT: number | null;
  onReady: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const litAt = useRef<number | null>(null);
  useEffect(() => {
    if (lit && litAt.current === null) litAt.current = performance.now();
  }, [lit]);
  const menuRef = useRef(menuOpen);
  menuRef.current = menuOpen;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let renderer: TitleRenderer | null = null;
    let raf = 0;
    let last = performance.now();
    const still = matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // The pointer leans the lens — a mouse only: a thumb resting on a phone
    // is not somebody looking around.
    const pointer: [number, number] = [0, 0];
    const fine = matchMedia?.("(pointer: fine)").matches ?? false;
    const onMove = (e: PointerEvent): void => {
      pointer[0] = (e.clientX / innerWidth) * 2 - 1;
      pointer[1] = (e.clientY / innerHeight) * 2 - 1;
    };
    if (fine && !still) addEventListener("pointermove", onMove, { passive: true });
    const fit = (): void => {
      const box = canvas.getBoundingClientRect();
      renderer?.resize(box.width, box.height, devicePixelRatio || 1);
    };
    const observer = new ResizeObserver(fit);
    const fail = (e: unknown): void => {
      if (!alive) return;
      console.warn(`title stage: ${e instanceof Error ? e.message : String(e)}`);
      setFailed(true);
      readyRef.current();
    };
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      if (document.hidden || !renderer) return;
      const t =
        frozenT ?? (litAt.current === null ? -1 : (performance.now() - litAt.current) / 1000);
      renderer.draw(t, dt, pointer, menuRef.current);
    };
    Promise.all([
      import("./title-renderer.ts"),
      bitmapOf(colourUrl),
      bitmapOf(auxUrl),
      fetch(plateUrl).then((r) => r.json() as Promise<TitlePlate>),
    ])
      .then(([mod, colour, aux, plate]) => {
        if (!alive) return;
        renderer = mod.createTitleRenderer(
          canvas,
          { colour, aux, plate },
          { still, fixedScale: frozenT !== null },
        );
        colour.close();
        aux.close();
        observer.observe(canvas);
        fit();
        const t = frozenT ?? -1;
        renderer.draw(t, 0, pointer, menuRef.current);
        // Reported once the first frame is on the screen, not merely asked for.
        requestAnimationFrame(() => {
          if (!alive) return;
          canvas.dataset.drawn = "1";
          readyRef.current();
        });
        raf = requestAnimationFrame(frame);
        canvas.addEventListener("webglcontextlost", () => fail("the context was lost"));
      })
      .catch(fail);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      removeEventListener("pointermove", onMove);
      renderer?.dispose();
    };
    // Mounted once; the props it reads per frame go through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      class="title-stage"
      data-lit={lit || frozenT !== null ? "1" : undefined}
      aria-hidden="true"
    >
      {failed && <img class="title-poster" src={colourUrl} alt="" />}
      {!failed && <canvas class="title-canvas" ref={canvasRef} />}
    </div>
  );
}
