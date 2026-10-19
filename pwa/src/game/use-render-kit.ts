// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RENDER STACK, FETCHED RATHER THAN BUNDLED: `renderer.ts` is the one
// module that reaches three.js, so it arrives as its own chunk behind the
// attract card (`App.tsx`'s header says why). This hook is the fetch: null
// until the chunk has landed, the module after — and nothing set on a
// component that has gone away in between. A build that draws modelled
// machines or skiers (`skis-models.ts`) has them fetched before the kit is
// handed out, so every builder finds them waiting — and the back end asked
// for (`gpu-backend.ts`) has its device, so the renderer is made on it.

import { useEffect, useState } from "preact/hooks";

import { chooseBackend, type Backend } from "./gpu-backend.ts";

export type RenderKit = typeof import("./renderer.ts");

/** The kit, on the back end a link names (`?renderer=`) or the default. */
export function useRenderKit(asked: Backend | null): RenderKit | null {
  const [kit, setKit] = useState<RenderKit | null>(null);
  useEffect(() => {
    let live = true;
    void import("./renderer.ts").then(async (mod) => {
      await mod.loadModels(chooseBackend(asked));
      if (live) setKit(mod);
    });
    return () => {
      live = false;
    };
  }, [asked]); // a visit's link, so it never changes
  return kit;
}
