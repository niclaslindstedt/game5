// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE, as the Blender lab is handed it (`scripts/blender.mjs
// --kind=title`, built by `title.py`): the key art the title stage
// composites live (`pwa/src/title/`, published by `scripts/title-plates.mjs`).
//
// Nothing in it is typed for the picture that the game already says:
//   palette   the app's own (`identity.ts`) — the sky, the snow, the shadow,
//             the alpenglow and the red of the carve are the logo's
//   outfit    the player's kit before he has dressed (`DEFAULT_OUTFIT`'s
//             colours, `coloursOf`), as the Blender skier is dressed
//   pair      the reference pair (`SKIS`) and where its model stands under
//             the skier's boots (`lookFrame`'s tail, the CoG's height)
//   pose      a CARVE SKIED BY THE ENGINE: the skier lab's `carve` move
//             (a full edge down a 20° pitch at 70 km/h, then cut hard), turned
//             to the right, run
//             at 120 Hz, posed the way the game poses him every frame
//             (`traceMove`: the spring, the stand, `poseInputOf`,
//             `skierPose`) as a giant-slalom racer carries himself, and
//             the frame he is laid furthest over taken — every bone's
//             frame (`skierBones`) beside the bound pose's, the hands,
//             the pole tips, his turn in the world and the slope's
//   spruce    the game's spruce variants (`TREE_VARIANTS`), the woods'
//             tiers, sides, taper and load
//   mark      the logo's two carved tracks (`MARK_TRAILS`), which the
//             scene cuts into the face as the tracks he left
export const kind = {
  ids: async () => ["title"],
  data: async () => {
    const E = await import("../../../engine/index.ts");
    const S = await import("../../../tests/support/synthetic.ts");
    const P = await import("../../../pwa/src/game/skier-pose.ts");
    const G = await import("../../../pwa/src/game/skis-body.ts");
    const ST = await import("../../../pwa/src/game/ski-stand.ts");
    const FL = await import("../../../pwa/src/game/skier-flight.ts");
    const { PALETTE } = await import("../../../pwa/src/identity.ts");
    const { DEFAULT_OUTFIT, coloursOf } = await import("../../../pwa/src/game/outfit.ts");
    const { lookFrame } = await import("../../../pwa/src/game/ski-looks.ts");
    const { GIANT_SLALOM_POSE } = await import("../../../pwa/src/game/technique-pose.ts");
    const { STANDING, skierBones } = await import("../../../pwa/src/game/skier-rig.ts");
    const { MARK_TRAILS, MARK_TRAIL_VIEWBOX } = await import("../../../pwa/src/game/app-mark.ts");
    const { TREE_VARIANTS } = await import("../../../pwa/src/game/tree-variants.ts");
    const { MOVES } = await import("../../lib/skier-moves.mjs");
    const { traceMove } = await import("../../lib/skier-trace.mjs");

    const spec = E.SKIS;
    // The lab's carve, a left turn: seen from the lens his outside ski
    // throws its spray out to the frame's right, into the low sun.
    const move = MOVES.find((m) => m.id === "carve");
    const frames = traceMove({ E, S, P, G, ST, FL }, move, spec);
    // The frame he is laid furthest over with his trunk still square over
    // his feet (the body not tipped forward past them — the moment before
    // the cut, not the lunge into it), posed as a giant-slalom racer.
    const square = frames.filter((f) => f.input.body.tilt >= 0.1);
    const hero = square.reduce((a, b) => (Math.abs(b.c.incline) > Math.abs(a.c.incline) ? b : a));
    const pose = P.skierPose({ ...hero.input, style: GIANT_SLALOM_POSE });
    const rest = P.skierPose({ ...STANDING, mounts: G.mountsOf(spec) });
    const F = lookFrame(spec);
    const c = hero.c;
    return {
      palette: PALETTE,
      outfit: coloursOf(DEFAULT_OUTFIT),
      pair: { id: spec.id, tail: F.z(0), cog: spec.cogHeight, length: spec.length },
      pose: {
        t: hero.t,
        incline: c.incline,
        edge: hero.input.edge,
        speed: c.speed,
        q: c.q,
        hero: skierBones(pose),
        rest: skierBones(rest),
        hands: pose.hands,
        poles: pose.poles,
        // The pitch the move is skied down, rad, falling along +z.
        grade: Math.PI / 9,
      },
      // The game's spruces, variant by variant: the tiers, sides, taper,
      // load of snow and droop the woods are cut to (`tree-shapes.ts`).
      spruce: TREE_VARIANTS.spruce
        .filter((v) => v.shape.form === "conifer" && !v.shape.twin)
        .map((v) => ({
          width: v.width,
          tiers: v.shape.tiers,
          sides: v.shape.sides,
          taper: v.taper,
          snow: v.shape.snow,
          droop: v.shape.droop,
        })),
      mark: { trails: MARK_TRAILS, viewBox: MARK_TRAIL_VIEWBOX },
    };
  },
  builder: "title.py",
  fallback: "title",
  help: "title, the title scene's plates",
};
