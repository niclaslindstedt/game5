// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BACKCOUNTRY FREERIDER, as the Blender lab is handed him: a big-
// mountain skier's kit (a long, loose hardshell over baggy bibs, an
// avalanche airbag pack, leather gloves, a helmet and goggles) on the
// game's own body, bound in the very pose the dressed skin is bound in
// (`dress-loft.ts`'s `bindPose`, so the game can skin him onto the rig
// it poses every frame — `rider-model.ts`), with the head in its helmet as
// the game's own triangles and every clip sampled off the game's own pose.
export const kind = {
  ids: async () => ["freerider"],
  data: async () => {
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { bindPose } = await import("../../../pwa/src/game/dress-loft.ts");
    const { BREAK } = await import("../../../pwa/src/game/skier-broken.ts");
    const { helmetParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { skierBones, skierClips } = await import("../../../pwa/src/game/skier-rig.ts");
    const { RIDER_KIT } = await import("../../../pwa/src/game/rider-kit.ts");
    const rest = bindPose();
    return {
      style: RIDER_KIT,
      body: BODY,
      breaks: BREAK,
      rest: { pose: rest.pose, bones: rest.frames },
      helmet: { game: helmetParts(1), fine: helmetParts(2) },
      clips: skierClips().map((c) => ({
        name: c.name,
        seconds: c.seconds,
        frames: c.poses.map(skierBones),
      })),
    };
  },
  builder: "freerider.py",
  fallback: "freerider",
  help: "freerider, the backcountry kit",
};
