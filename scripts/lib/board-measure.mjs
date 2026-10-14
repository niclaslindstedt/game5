// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S POSE MEASURED — what `make board-metrics` judges a
// moment by and `make board-motion` plots over a whole move: each knee's
// flexion, the hips' and the shoulders' lines against the board's, the eyes
// off his travel, the lower hand over the snow, the hips across the board,
// the spine off the inclined line, the hips' height, the shins against the
// snow — and THE BANDS the project's snowboard research holds each to
// (`board-metrics.mjs`' header says what each one is).

import { GRAB_ASKS } from "./board-trick-moves.mjs";

/** THE BANDS, a moment's own where it differs: [least, most]. */
export const BANDS = {
  knee: [30, 80],
  hips: [0, 20],
  chest: [0, 30],
  head: [0, 45],
  torso: [0, 30],
  hipsH: [0.6, 1],
  shin: [25, 90],
  shinDeck: [42, 90],
  snow: 0,
};
export const OWN = {
  // Cut hard, the eyes go on round to the turn's exit and one hand may
  // reach the snow.
  // On the heels he sits as on a chair: the knees deeper, the hips lower.
  heel: { knee: [60, 105], chest: [0, 40], hipsH: [0.6, 0.85] },
  "heel-cut": {
    knee: [85, 125],
    chest: [0, 45],
    head: [0, 60],
    snow: 1,
    hand: [0, 0.25],
    hipsH: [0.5, 0.75],
    torso: [0, 40],
  },
  tuck: { knee: [60, 125], torso: [20, 75], hipsH: [0.4, 0.8] },
  landing: { knee: [45, 120], torso: [0, 45], hipsH: [0.45, 1] },
  wait: { knee: [10, 50] },
  // The pushing leg straightens through the push.
  skate: { knee: [0, 80], chest: [20, 70], hips: [0, 60] },
  // A grab draws the knees up and folds him to the board; the hand on it.
  ...Object.fromEntries(
    GRAB_ASKS.map(([g]) => [
      g,
      {
        knee: [50, 155],
        chest: [0, 70],
        torso: [0, 75],
        hipsH: [0.3, 1],
        hips: [0, 40],
        grab: [0, 0.05],
        // In the air the knees come up and the shins may lie level — all
        // but a method's, which rise from the knees to the board behind
        // (a few degrees less to the level off a kicker's lip, the whole
        // of him still pitched up from the take-off).
        shin: g === "method" ? [15, 90] : [0, 90],
      },
    ]),
  ),
  // On his toe edge laid over hard the shins come low — never flat.
  // On his toe edge both knees bend deep and down the edge, the rear one
  // never left straight; the shins lie low over the snow, never on it.
  toe: { knee: [65, 100], kneeGap: [0, 20], hipsH: [0.6, 0.85], shin: [5, 90], shinDeck: [45, 90] },
  // Cut hard he is folded: the hips low, the trunk over the knees, the
  // front hand at the snow.
  "toe-cut": {
    knee: [85, 120],
    kneeGap: [0, 20],
    hipsH: [0.45, 0.75],
    torso: [25, 60],
    head: [0, 60],
    snow: 1,
    hand: [0, 0.15],
    shin: [3, 90],
    shinDeck: [50, 90],
  },
  // In the air the legs absorb: the knees pulled up, the board under him.
  air: { knee: [90, 130], hipsH: [0.55, 0.8], torso: [0, 40], shin: [0, 90] },
  // Leaving the snow, the legs drawing up into the air's fold.
  rising: { knee: [30, 130], hipsH: [0.55, 1], torso: [0, 40], shin: [0, 90] },
  spin: { knee: [30, 130], chest: [0, 60], head: [0, 180], shin: [0, 90] },
  windup: { knee: [50, 120], torso: [0, 45] },
  nollie: { knee: [50, 120], torso: [0, 45] },
};

export const deg = (r) => (r * 180) / Math.PI;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
/** The angle between two lines (either way along), in a plane, deg. */
function lineAngle(a, b, n) {
  const flat = (v) => norm(sub(v, { x: n.x * dot(v, n), y: n.y * dot(v, n), z: n.z * dot(v, n) }));
  return deg(Math.acos(Math.min(1, Math.abs(dot(flat(a), flat(b))))));
}

/** The bands a moment (or a move, by its id) is held to. */
export function bandsOf(id) {
  return { ...BANDS, ...(OWN[id] ?? {}) };
}

/** EVERY FIGURE of the pose `bp` taken off the state `c` and its `input`
 * (`board-input.ts`, `boardPose` — `BP` the module). */
export function figuresOf(c, input, bp, BP) {
  const p = bp.pose;
  const f = bp.board;
  const knee = [deg(BP.kneeFlex(p, 0)), deg(BP.kneeFlex(p, 1))];
  const hips = lineAngle(sub(p.hipJoints[1], p.hipJoints[0]), f.along, f.normal);
  const chest = lineAngle(sub(p.shoulders[1], p.shoulders[0]), f.along, f.normal);
  const up = norm(input.worldUp);
  const flat = (v) => sub(v, { x: up.x * dot(v, up), y: up.y * dot(v, up), z: up.z * dot(v, up) });
  const look = norm(flat(BP.headForward(p)));
  const way = flat(input.travel);
  const moving = Math.hypot(way.x, way.y, way.z) > 2;
  const head = moving ? deg(Math.acos(Math.max(-1, Math.min(1, dot(look, norm(way)))))) : null;
  // The snow's plane under the deck: its normal is the snow's (the deck's
  // low edge is on it).
  const plane = BP.snowPlane(input, f);
  const over = (q) => dot(sub(q, plane.point), plane.normal);
  const hand = Math.min(over(p.hands[0]), over(p.hands[1]));
  // The shins against the snow's plane, or the level in the air.
  const level = c.airborne ? up : plane.normal;
  const shinOf = (i) =>
    deg(Math.asin(Math.min(1, Math.abs(dot(norm(sub(p.feet[i], p.knees[i])), level)))));
  const shin = Math.min(shinOf(0), shinOf(1));
  const onSnow = c.airborne
    ? 0
    : (over(p.hands[0]) < 0.08 ? 1 : 0) + (over(p.hands[1]) < 0.08 ? 1 : 0);
  // The spine off the inclined line: the body frame's own up is the line
  // the root is rolled onto.
  const spine = norm(sub(p.neck, p.hips));
  const torso = deg(Math.acos(Math.max(-1, Math.min(1, spine.y))));
  // The hips' height over the deck, as a share of it on straight legs.
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const straight =
    dist(p.hipJoints[0], p.knees[0]) +
    dist(p.knees[0], p.feet[0]) +
    dot(sub(p.feet[0], f.centre), f.normal);
  const hipsH = dot(sub(p.hips, f.centre), f.normal) / straight;
  // The hips across the board, toward his toes positive, as seen from
  // above the SNOW (the deck's across laid into the snow's plane): over or
  // beyond the toe edge on a toeside turn, inside the heel edge on a
  // heelside one.
  const face = input.board.lead === "regular" ? 1 : -1;
  const n = plane.normal;
  const flatRight = norm(
    sub(f.right, { x: n.x * dot(f.right, n), y: n.y * dot(f.right, n), z: n.z * dot(f.right, n) }),
  );
  const across = dot(sub(p.hips, f.centre), flatRight) * face;
  // The shins against the DECK: a shin laid toward the deck is a rider
  // kneeling on his board (a soft boot leaves it ~55° or more on the snow).
  const shinDeckOf = (i) =>
    deg(Math.asin(Math.min(1, Math.abs(dot(norm(sub(p.knees[i], p.feet[i])), f.normal)))));
  const shinDeck = c.airborne ? null : Math.min(shinDeckOf(0), shinDeckOf(1));
  const kneeGap = Math.abs(knee[0] - knee[1]);
  const toe = BP.toeShare(input.edge, input.board.lead);
  return {
    knee,
    kneeGap,
    hips,
    chest,
    head,
    hand,
    across,
    torso,
    hipsH,
    shin,
    shinDeck,
    onSnow,
    toe,
  };
}

/** The figures `f` (and the grab's gap, m, or null) held to `bands`: the
 * faults, each a line. */
export function faultsOf(f, bands, grab = null) {
  const faults = [];
  const hold = (name, v, [lo, hi]) => {
    if (v !== null && (v < lo || v > hi)) faults.push(`${name} ${v.toFixed(0)}∉[${lo},${hi}]`);
  };
  hold("knee", f.knee[0], bands.knee);
  hold("knee", f.knee[1], bands.knee);
  hold("hips", f.hips, bands.hips);
  hold("chest", f.chest, bands.chest);
  hold("head", f.head, bands.head);
  hold("torso", f.torso, bands.torso);
  hold("hipsH", f.hipsH, bands.hipsH);
  hold("shin", f.shin, bands.shin);
  if (f.onSnow > bands.snow) faults.push(`${f.onSnow} hand(s) on the snow`);
  if (bands.hand) hold("hand", f.hand, bands.hand);
  if (bands.grab) {
    if (grab === null) faults.push("no grab held");
    else
      hold(
        "grab",
        grab * 100,
        bands.grab.map((v) => v * 100),
      );
  }
  hold("shinDeck", f.shinDeck, bands.shinDeck);
  if (bands.kneeGap) hold("kneeGap", f.kneeGap, bands.kneeGap);
  if (f.toe > 0.3) hold("over", f.across, [0.1, 0.8]);
  if (f.toe < -0.3) hold("over", f.across, [-0.8, -0.1]);
  return faults;
}
