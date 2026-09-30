// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER in a start-line slot's kit, as the Blender lab is handed him:
// his body, the pose he is bound in, the helmet's measured shell sampled on
// a grid, and every clip sampled off the game's own pose (`skier-rig.ts`).
export const kind = {
  ids: async () =>
    (await import("../../../pwa/src/game/skis-body.ts")).SKI_STYLES.map((_, i) => `skier${i}`),
  data: async (id) => {
    const { SKI_STYLES, mountsOf } = await import("../../../pwa/src/game/skis-body.ts");
    const { SKIS } = await import("../../../engine/index.ts");
    const { BODY, skierPose } = await import("../../../pwa/src/game/skier-pose.ts");
    const helmet = await import("../../../pwa/src/game/skier-helmet.ts");
    const { STANDING, skierBones, skierClips } = await import("../../../pwa/src/game/skier-rig.ts");
    const rest = skierPose({ ...STANDING, mounts: mountsOf(SKIS) });
    // Fine enough that the port's and the cap's edges read clean in a
    // still; the game quality takes every other point.
    const [na, ne] = [144, 96];
    const around = (i) => -Math.PI + (2 * Math.PI * i) / na;
    const up = (j) => -Math.PI / 2 + (Math.PI * j) / ne;
    return {
      style: SKI_STYLES[Number(id.slice(5))].skier,
      body: BODY,
      rest: { pose: rest, bones: skierBones(rest) },
      helmet: {
        tilt: helmet.HELMET_TILT,
        sit: helmet.HELMET_SIT,
        around: na,
        up: ne,
        // The reach at every grid point (round from dead behind), and what
        // the shell is in every cell.
        reach: Array.from({ length: ne + 1 }, (_, j) =>
          Array.from({ length: na }, (_, i) => helmet.helmetReach(around(i), up(j))),
        ),
        part: Array.from({ length: ne }, (_, j) =>
          Array.from({ length: na }, (_, i) => helmet.helmetPart(around(i + 0.5), up(j + 0.5))),
        ),
      },
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
