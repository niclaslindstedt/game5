// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S MORPHED FIGURES (`make jolt`): what the crowd, the people
// on foot, their dogs and the rescue crew are drawn as, read back as joints.
// Every one of them is a MORPH: a skeleton built once at its stance and once
// at each target (`crowdTargets`, `civilianTargets`, `dogSkel`, …), and the
// GPU blends the targets per instance by the weights the view hands it — the
// targets are RELATIVE (`morphTargetsRelative`), so a vertex is the stance's
// plus each target's difference times its weight. A joint is blended the
// same way off the same skeletons: what the shader does to the vertices hung
// on it, near enough (the builder lays its rings off the joints, so a ring
// blended is a ring off blended joints within the bend's own error).
//
// And the free ride's map they are all drawn on, built once a process: every
// family here reads the same mountain.

/** The seed of the mountain the crowd, the people and the wildlife are
 * read on: a ski area with a village, a crowd on every colour, dog walkers
 * and terraces at midday. */
export const FREE_SEED = 38;

let level = null;

/** The free ride's map, built once and shared by every family. */
export function freeLevel(ctx) {
  level ??= ctx.E.generateLevel(FREE_SEED);
  return level;
}

/** A crowd skeleton's (`Posed`) joints as named points `[x, y, z]`, in its
 * own frame: the skis' (or the board's) tips and tails, then every joint. */
export function posedPoints(p) {
  const out = {};
  for (const [key, side] of [
    ["skiL", "l"],
    ["skiR", "r"],
  ]) {
    out[`ski_${side}.tip`] = p[key].tip;
    out[`ski_${side}.tail`] = p[key].tail;
  }
  const named = {
    ankleL: "ankle_l",
    ankleR: "ankle_r",
    kneeL: "knee_l",
    kneeR: "knee_r",
    hipL: "hip_l",
    hipR: "hip_r",
    pelvis: "pelvis",
    waist: "waist",
    neck: "neck",
    head: "head",
    shoulderL: "shoulder_l",
    shoulderR: "shoulder_r",
    elbowL: "elbow_l",
    elbowR: "elbow_r",
    handL: "hand_l",
    handR: "hand_r",
    basketL: "basket_l",
    basketR: "basket_r",
  };
  for (const [k, name] of Object.entries(named)) out[name] = p[k];
  return out;
}

/** Targets as point sets (`[stance, target 1, …]`, each `{ name: [x,y,z] }`)
 * blended by `weights` (one a target past the stance) as the relative morph
 * does it: the stance plus each target's difference times its weight. */
export function blendPoints(targets, weights) {
  const base = targets[0];
  const out = {};
  for (const [name, b] of Object.entries(base)) {
    let x = b[0];
    let y = b[1];
    let z = b[2];
    for (let k = 0; k < weights.length; k++) {
      const w = weights[k];
      if (!w) continue;
      const q = targets[k + 1][name];
      x += w * (q[0] - b[0]);
      y += w * (q[1] - b[1]);
      z += w * (q[2] - b[2]);
    }
    out[name] = [x, y, z];
  }
  return out;
}

/** Points in a figure's frame stood at (`x`, `y`, `z`) turned `heading` about
 * the vertical (three's `setFromAxisAngle` on +y: 0 faces +z, a quarter turn
 * faces +x) and scaled by `scale`, as `{ name: {x, y, z} }`. */
export function yawed(points, x, y, z, heading, scale = 1) {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const out = {};
  for (const [name, p] of Object.entries(points)) {
    const px = p[0] * scale;
    const pz = p[2] * scale;
    out[name] = { x: x + px * c + pz * s, y: y + p[1] * scale, z: z - px * s + pz * c };
  }
  return out;
}

/** Points carried through a column-major 4×4 (three's `Matrix4.elements`). */
export function throughMatrix(points, e) {
  const out = {};
  for (const [name, p] of Object.entries(points)) {
    const [x, y, z] = p;
    out[name] = {
      x: e[0] * x + e[4] * y + e[8] * z + e[12],
      y: e[1] * x + e[5] * y + e[9] * z + e[13],
      z: e[2] * x + e[6] * y + e[10] * z + e[14],
    };
  }
  return out;
}

/** Points moved by (`x`, `y`, `z`), as `{ name: {x, y, z} }`. */
export function moved(points, x, y, z) {
  const out = {};
  for (const [name, p] of Object.entries(points))
    out[name] = { x: p[0] + x, y: p[1] + y, z: p[2] + z };
  return out;
}

/** The steps a frame at `hz` is apart, counted on the engine's own rate. */
export function stepsPerFrame(ctx) {
  return Math.max(1, Math.round(ctx.E.TUNING.physicsHz / ctx.hz));
}
