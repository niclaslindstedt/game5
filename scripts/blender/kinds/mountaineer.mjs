// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOUNTAIN GUIDE, as the Blender lab is handed him: a backcountry
// guide's kit (`mountaineer.py`) over the skier's own body, bound in the very pose
// the dressed skier is bound in (`dress-loft.ts`'s `bindPose`), so the game
// poses him bone for bone as it poses the dressed one — and his head, its
// face and hair, as the game's own triangles (`helmet-shape.ts`'s
// `bareHeadParts`), the helmet and the goggles laid
// over them in the builder.
export const kind = {
  ids: async () => ["mountaineer"],
  data: async () => {
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { bareHeadParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { bindPose } = await import("../../../pwa/src/game/dress-loft.ts");
    const { pose, frames } = bindPose();
    return {
      body: BODY,
      rest: { pose, bones: frames },
      head: { game: bareHeadParts(1), fine: bareHeadParts(2) },
    };
  },
  builder: "mountaineer.py",
  fallback: "mountaineer",
  help: "mountaineer, the backcountry guide's kit",
};
