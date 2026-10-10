// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EDGE STAKES' OWN NUMBERS, stated beside `TUNING` (which carries them
// as `TUNING.stakes`): where the marker stakes stand down both sides of
// every run, and what one does when a skier runs into it
// (`edge-stakes.ts`) — every number with its unit.
//
// A piste's marker is a light pole of plastic or bamboo some two metres
// long and three or four centimetres thick, under a kilogram, pushed into
// the snow: it gives. Met slowly it bends over and whips back up; met fast
// it snaps or is torn out and flung, and it lies where it fell. Either way
// it takes next to nothing off a skier's speed — but a stake caught on a
// ski's tip, a boot or a pole's basket at speed snatches that limb back
// and turns him, and a racer who runs into one fast enough loses his
// balance and goes down.

export const STAKES = {
  /** THE LAYOUT, m: a stake every `every` m down both edges of a run (a
   * speed track's timing zone every `zone` m), `out` past the piste's
   * edge, `height` over the snow, `radius` thick, the right-hand ones
   * banded orange over their top `band`. */
  every: 25,
  zone: 15,
  out: 1.5,
  height: 2.2,
  radius: 0.02,
  band: 0.45,
  /** A SKI ROUTE'S STAKES (R42) stand thicker and taller than a piste's,
   * m: the orange posts a skier picks his way down an ungroomed line by,
   * each read from the last at a glance across a steep face. Nobody trims
   * them to a line: each stands up to `shift` m in or out of its edge and
   * leans up to `lean` rad off plumb, which way off a hash of the map. */
  route: { height: 2.8, radius: 0.042, shift: 0.35, lean: 0.09 },
  /** THE STAKE BENT: its foot in the snow a hinge, the stake a damped
   * spring on its tilt — stiffness, 1/s² (a stake whipping back up at
   * about 1.7 Hz), and damping, 1/s — lying no further over than `most`
   * rad. The skier is met at `knee` m up it, where his shins and boots
   * sweep it over. */
  stiff: 120,
  damp: 6,
  most: 1.4,
  knee: 0.5,
  /** THE STAKE SNAPPED (or torn out): met at `snap` m/s closing (29 km/h)
   * or more it breaks, and lies `broken` rad over the way it was struck —
   * on the snow, for good. */
  snap: 8,
  broken: 1.52,
  /** What it costs him: a stake bent takes `share` of the speed he drives
   * into it, never more than `loss` m/s; one snapped `snapLoss` more on
   * top — the force it takes to break it over a hand's breadth. And the
   * blow on a ski or a boot off his middle TURNS him: `twist` rad/s of yaw
   * for every m/s taken off at his tips, less as the blow is nearer his
   * CoG. */
  share: 0.03,
  loss: 0.3,
  snapLoss: 0.35,
  twist: 2.2,
  /** A blow is reported at this closing speed, m/s. */
  knock: 0.5,
} as const;
