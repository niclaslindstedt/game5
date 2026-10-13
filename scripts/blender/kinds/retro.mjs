// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RETRO SKIER — a rider of the late eighties in a one-piece suit, a
// knit bobble hat, mirrored wraparound shades and a long knit scarf — as
// the Blender lab is handed him: the body, the pose the game's dressed skin
// is bound in (`dress-loft.ts`'s `bindPose`, so the model drops onto the
// game's own rig and every pose the game has drives it unchanged), where
// each arm's skin is cut for a break (`skier-broken.ts`'s `BREAK`), and his
// face as the game's own triangles (`dress-face.ts`, cut on the loom).
// The scarf's tails and the hat's bobble get bones of their own, which the
// game swings in the wind (`retro-wind.ts`).
export const kind = {
  ids: async () => ["retro0", "retro1", "retro2"],
  data: async (id) => {
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { bindPose, createLoom } = await import("../../../pwa/src/game/dress-loft.ts");
    const { cutFace } = await import("../../../pwa/src/game/dress-face.ts");
    const { BREAK } = await import("../../../pwa/src/game/skier-broken.ts");
    const { RETRO_COLOURWAYS } = await import("../../../pwa/src/game/retro-look.ts");
    const rest = bindPose();
    const look = RETRO_COLOURWAYS[Number(id.slice(5))] ?? RETRO_COLOURWAYS[0];
    const loom = createLoom();
    cutFace(loom, look.skin, false);
    const face = loom.mesh().cloth;
    return {
      look,
      body: BODY,
      broken: BREAK,
      rest: { pose: rest.pose, bones: rest.frames },
      face: { position: face.position, color: face.color, index: face.index },
    };
  },
  builder: "retro.py",
  fallback: "retro0",
  help: "retro0…2, an eighties one-piece in each of its colourways",
};
