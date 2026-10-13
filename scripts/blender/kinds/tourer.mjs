// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NORDIC SKI TOURER, as the Blender lab is handed him: an arctic
// tourer's kit (`tourer.py`) over the skier's own body, bound in the very
// pose the dressed skier is bound in (`dress-loft.ts`'s `bindPose`), so the
// game poses him bone for bone as it poses the dressed one — the arm's
// halves below a break included (`skier-broken.ts`'s `BREAK`, eased over
// the dress's own cut) — and his head, its face and hair, as the game's own
// triangles (`helmet-shape.ts`'s `bareHeadParts`), the beanie and the
// sunglasses laid over them in the builder.
export const kind = {
  ids: async () => ["tourer"],
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
      broken: { at: BREAK, cut: 0.03 },
    };
  },
  builder: "tourer.py",
  fallback: "tourer",
  help: "tourer, the Nordic ski tourer's kit (the rider card's TOURER body)",
};
