// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP RACER as the Blender lab is handed him (`racer.py`): the
// body, the pose he is bound in and every bone's frame in it, the head in
// its helmet as the game's own triangles, every clip sampled off the
// game's own pose (`skier-rig.ts`) — the skier kind's data — and the
// break lengths the arms' lower bones take over at (`skier-broken.ts`),
// so the model's skin is weighted as the game's own dress is. His kit is
// his own (a printed one-piece suit, the bib, the guards), so no slot's
// colours are handed in: the colours are the builder's.
export const kind = {
  ids: async () => ["racer"],
  data: async () => {
    const { BODY, skierPose } = await import("../../../pwa/src/game/skier-pose.ts");
    const { helmetParts } = await import("../../../pwa/src/game/helmet-shape.ts");
    const { BREAK } = await import("../../../pwa/src/game/skier-broken.ts");
    const { STANDING, skierBones, skierClips } = await import("../../../pwa/src/game/skier-rig.ts");
    // Bound as the game's dress is (`dress-loft.ts`' `bindPose`), so his skin lies on the
    // very bind the game skins it on.
    const rest = skierPose(STANDING);
    return {
      body: BODY,
      rest: { pose: rest, bones: skierBones(rest) },
      breaks: { upper: BREAK.upper, fore: BREAK.fore },
      helmet: { game: helmetParts(1), fine: helmetParts(2) },
      clips: skierClips().map((c) => ({
        name: c.name,
        seconds: c.seconds,
        frames: c.poses.map(skierBones),
      })),
    };
  },
  builder: "racer.py",
  fallback: "racer",
  help: "racer, the speed-suit racer in his printed suit, bib and guards",
};
