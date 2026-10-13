// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=bike`): the drawn bike's numbers (`pwa/src/game/bike-look.ts`'s
// `BIKE_LOOK`) and every point the game hangs a part on — the steer axis,
// the head tube, the crowns, the bars and grips, both axles, the main pivot,
// the shock's eyes, the saddle — the wheels' sizes off the engine's `BIKE`,
// where each node stands at rest (`bike-rig.ts`'s `BIKE_REST`) and the
// clips' every node transform (`bikeClips`), so the model is built on the
// nodes the game moves and its clips are the game's own pose played.
export const kind = {
  ids: async () => ["bike"],
  data: async () => {
    const look = await import("../../../pwa/src/game/bike-look.ts");
    const rig = await import("../../../pwa/src/game/bike-rig.ts");
    const { BIKE, BIKE_BB } = await import("../../../engine/index.ts");
    return {
      look: look.BIKE_LOOK,
      points: {
        bb: BIKE_BB,
        steerAt: look.STEER_AT,
        steerAxis: look.STEER_AXIS,
        headTop: look.HEAD_TOP,
        headBottom: look.HEAD_BOTTOM,
        crownTop: look.CROWN_TOP,
        crownBottom: look.CROWN_BOTTOM,
        barMiddle: look.BAR_MIDDLE,
        grips: look.GRIPS,
        axleF: look.frontAxle(0, 0),
        axleR: look.REAR_REST,
        shock: look.shockAt(0),
        saddleTop: look.SADDLE_TOP,
      },
      wheels: { front: BIKE.front.radius, rear: BIKE.rear.radius },
      drive: look.DRIVE,
      nodes: rig.BIKE_NODES,
      rest: rig.BIKE_REST,
      shockRest: rig.SHOCK_REST,
      // The clips at fifteen frames a second: the game poses the nodes live,
      // so these are for the lab's sheets and any host that plays them.
      clips: rig.bikeClips(15).map((c) => ({
        name: c.name,
        seconds: c.seconds,
        frames: c.frames.map((f) => ({ nodes: f.nodes, root: f.root })),
      })),
    };
  },
  builder: "bike.py",
  fallback: "bike",
  help: "the summer's downhill bike",
};
