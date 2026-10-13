// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABLE GRIND'S SHAPE (`cable.ts`), stated beside `state.ts` — which
// re-exports it — so the state's file stays under its cap.

/** A LIFT'S ROPE BEING GROUND (`cable.ts`, `SkierState.grind`): which lift
 * (its index in `liftPlans`), which rope (0 the up rope, 1 the down), how
 * far up its line he is, m of plan, and how fast he slides along it, m/s
 * along the rope (up the line positive); his skis' turn off the way he
 * slides, rad (0 a 50-50, ±π/2 a slide, π switch), clockwise from above,
 * and the turn they are going to; the press he holds, whether the edge was
 * over last step (a swap is a TAP) and the jump held last step (a pop is
 * its RELEASE), and how long he has been on, s. */
export type CableRide = {
  lift: number;
  side: 0 | 1;
  u: number;
  v: number;
  yaw: number;
  target: number;
  press: "nose" | "tail" | null;
  tapped: boolean;
  loaded: boolean;
  time: number;
};
