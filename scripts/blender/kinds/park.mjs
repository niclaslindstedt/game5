// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARK RIDER as the Blender lab is handed him: the body's measure, the
// pose he is bound in and every bone's frame in it (`skier-rig.ts`'s
// `STANDING` and `skierBones` — the very frames the dressed skin is cut
// in, `dress-loft.ts`'s `bindPose`), and his bare head as the game's own
// triangles (`helmet-shape.ts`'s `bareHeadParts`: the face, the nose, the
// eyes, the hair under the beanie). The builder (`park.py`) dresses him in
// a terrain park's street kit; the game skins him on its own rig
// (`park-rider.ts`), so he is posed by every pose the game has.
export const kind = {
  ids: async () => ["park"],
  data: async () => {
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { bareHeadParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { bindPose } = await import("../../../pwa/src/game/dress-loft.ts");
    const bind = bindPose();
    return {
      body: BODY,
      rest: { pose: bind.pose, bones: bind.frames },
      head: { game: bareHeadParts(1), fine: bareHeadParts(2) },
    };
  },
  builder: "park.py",
  fallback: "park",
  help: "park, the terrain park rider",
};
