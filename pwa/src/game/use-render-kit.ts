// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RENDER STACK, FETCHED RATHER THAN BUNDLED: `renderer.ts` is the one
// module that reaches three.js, so it arrives as its own chunk behind the
// attract card (`App.tsx`'s header says why). This hook is the fetch: null
// until the chunk has landed, the module after — and nothing set on a
// component that has gone away in between. A build that draws modelled
// machines or skiers (`skis-models.ts`) has them fetched before the kit is
// handed out, so every builder finds them waiting — and the back end asked
// for (`gpu-backend.ts`) has its device, so the renderer is made on it.
//
// THE BACK END IS ASKED FOR ONCE A VISIT: the link's `?renderer=` over the
// stored DEVELOPER ▸ RENDERER over `auto`, read as the page opens. A setting
// moved later is for the next visit — a canvas, once drawn on by one back
// end, cannot be handed to another.

import { useEffect, useState } from "preact/hooks";

import { chooseBackend, setVisitBackend, type BackendAsk } from "./gpu-backend.ts";

export type RenderKit = typeof import("./renderer.ts");

/** The kit, on the back end the link names, else the stored one, else `auto`. */
export function useRenderKit(link: BackendAsk | null, stored: BackendAsk): RenderKit | null {
  const [kit, setKit] = useState<RenderKit | null>(null);
  // Said to the page as the app first draws, before any child's effect can
  // make a renderer of its own (the gear stage's) on another back end.
  const [asked] = useState(() => {
    const ask = chooseBackend(link, stored);
    setVisitBackend(ask);
    return ask;
  });
  useEffect(() => {
    let live = true;
    void import("./renderer.ts").then(async (mod) => {
      await mod.loadModels(asked);
      if (live) setKit(mod);
    });
    return () => {
      live = false;
    };
  }, [asked]); // read once, as the page opens
  return kit;
}
