// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER in a start-line slot's kit, as the Blender lab is handed him:
// his body, the pose he is bound in, the head in its helmet as the game's
// own triangles, and every clip sampled off the game's own pose (`skier-rig.ts`).
export const kind = {
  ids: async () =>
    (await import("../../../pwa/src/game/skis-body.ts")).SKI_STYLES.map((_, i) => `skier${i}`),
  data: async (id) => {
    const { SKI_STYLES, mountsOf } = await import("../../../pwa/src/game/skis-body.ts");
    const { SKIS } = await import("../../../engine/index.ts");
    const { BODY, skierPose } = await import("../../../pwa/src/game/skier-pose.ts");
    const { helmetParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { STANDING, skierBones, skierClips } = await import("../../../pwa/src/game/skier-rig.ts");
    const rest = skierPose({ ...STANDING, mounts: mountsOf(SKIS) });
    return {
      style: SKI_STYLES[Number(id.slice(5))].skier,
      body: BODY,
      rest: { pose: rest, bones: skierBones(rest) },
      // The head in its helmet as the game's own triangles: its game cut
      // and a still's finer one.
      helmet: { game: helmetParts(1), fine: helmetParts(2) },
      clips: skierClips().map((c) => ({
        name: c.name,
        seconds: c.seconds,
        frames: c.poses.map(skierBones),
      })),
    };
  },
  builder: "skier.py",
  fallback: "skier0",
  help: "skier0…3, a start-line slot's kit",
};
