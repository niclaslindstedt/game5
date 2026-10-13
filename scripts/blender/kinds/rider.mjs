// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S RIDER, as the Blender lab is handed him (`scripts/
// blender.mjs --kind=rider`): the pose the game's dressed figure is bound in
// and every bone's frame in it (`dress-loft.ts`'s `bindPose` — the same
// bind, so the game lays his skin on its own skeleton), his body's measure
// (`BODY`), and every clip's bones off the bike's own clips (`bike-rig.ts`'s
// `bikeClips`: the rider's bones in the bike's centre of mass's frame), so
// he and the bike are animated together off the game's one pose.
export const kind = {
  ids: async () => ["rider"],
  data: async () => {
    const { bindPose } = await import("../../../pwa/src/game/dress-loft.ts");
    const { BODY } = await import("../../../pwa/src/game/skier-pose.ts");
    const { bikeClips } = await import("../../../pwa/src/game/bike-rig.ts");
    const bind = bindPose();
    const clips = bikeClips(15);
    // THE GRIP in each hand's own frame, off the bike's riding pose: the
    // bar's line through the fist, and the world's up and ahead there — so
    // the glove is closed round the bar the game puts in his hand.
    const ride = clips[0].frames[0].bones;
    const local = (h, d) => ({
      x: h.x.x * d.x + h.x.y * d.y + h.x.z * d.z,
      y: h.y.x * d.x + h.y.y * d.y + h.y.z * d.z,
      z: h.z.x * d.x + h.z.y * d.y + h.z.z * d.z,
    });
    const grip = Object.fromEntries(
      ["l", "r"].map((s) => {
        const h = ride[`hand_${s}`];
        return [
          s,
          {
            axis: local(h, { x: s === "l" ? -1 : 1, y: 0, z: 0 }),
            up: local(h, { x: 0, y: 1, z: 0 }),
            ahead: local(h, { x: 0, y: 0, z: 1 }),
          },
        ];
      }),
    );
    return {
      grip,
      body: BODY,
      rest: { pose: bind.pose, bones: bind.frames },
      clips: clips.map((c) => ({
        name: c.name,
        seconds: c.seconds,
        frames: c.frames.map((f) => f.bones),
      })),
    };
  },
  builder: "rider.py",
  fallback: "rider",
  help: "the downhill bike's rider",
};
