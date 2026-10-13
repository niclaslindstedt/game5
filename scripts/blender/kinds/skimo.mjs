// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIMO RACER, as the Blender lab is handed him: a ski mountaineering
// racer's kit (`skimo.py`) over the skier's own body, bound in the very
// pose the dressed skier is bound in (`dress-loft.ts`'s `bindPose`), so the
// game poses him bone for bone as it poses the dressed one — his head, its
// face and hair, as the game's own triangles (`helmet-shape.ts`'s
// `bareHeadParts`), the race helmet and the wrap glasses laid over them in
// the builder — and where an arm breaks (`skier-broken.ts`'s `BREAK`), so
// the skin past a break rides the bone that hangs from it.
export const kind = {
  ids: async () => ["skimo"],
  data: async () => {
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { bareHeadParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { bindPose } = await import("../../../pwa/src/game/dress-loft.ts");
    const { BREAK } = await import("../../../pwa/src/game/skier-broken.ts");
    const { pose, frames } = bindPose();
    return {
      body: BODY,
      rest: { pose, bones: frames },
      head: { game: bareHeadParts(1), fine: bareHeadParts(2) },
      breaks: { upper: BREAK.upper, fore: BREAK.fore, cut: 0.03 },
    };
  },
  builder: "skimo.py",
  fallback: "skimo",
  help: "skimo, the ski mountaineering racer's kit",
};
