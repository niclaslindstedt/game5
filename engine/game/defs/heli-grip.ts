// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S HOLD ON THE HELICOPTER'S SKID, AND THE ROTOR THROUGH HIM —
// the numbers `heli-grip.ts` reads. Kept beside `heli.ts`'s `HELI` rather
// than in it, because that table is what the Blender model is built from
// and nothing here changes how the machine looks.

/** THE GRIP (`heli-grip.ts`): the skier on the skid is sat on its tube,
 * his back to the cabin, holding on with his hands — nothing straps him
 * in. The seat carries what presses him into it and the cabin's side what
 * pushes him back against it, each holding `friction` of the load along
 * them; the rest is HIS HANDS' — judged against his weight as gravity
 * pulls it (an arcade rule: the rotor's own pull, which in a steady
 * inverted push would press him into the seat, is left out, so a machine
 * turned over sheds him). Up to `hold` of his weight he holds for as long
 * as he likes (a firm two-handed hold on a tube); past it the hold drains,
 * all of it in `endure` s at his whole weight hung off his hands (the
 * dead hang of a gloved grip on a cold tube, rounded down for a body
 * being shaken), slower under less, and comes back in `recover` s once
 * the load is under `hold` again. A bank of 45° toward his side is
 * held; turned over, or banked or pitched past some 60°, he goes.
 *
 * THE HANG: as his hands take more of him he comes off the seat and
 * hangs from them on the tube — all of him at `hang.full` of his weight
 * on them, none under `hang.from` — slid off it in `hang.on` s and
 * pulled back onto it in `hang.off` s. Hung, he is a PENDULUM: his
 * middle (the body's origin) `hang.reach` m under his hands, his arms
 * up over his head, swung by gravity and the airframe's every move and
 * damped by `hang.damp` /s against its way (his arms and the air);
 * slid off forward, his middle starts out `hang.slid` (out, down) of the
 * tube, and the cabin keeps him out of it — his middle `hang.clear` m
 * off its side and its floor, so he hangs down its side, or in under its
 * belly between the skids. */
export const HELI_GRIP = {
  friction: 0.5,
  hold: 0.45,
  endure: 2.2,
  recover: 3,
  hang: {
    from: 0.3,
    full: 0.6,
    on: 0.4,
    off: 0.8,
    reach: 1.1,
    damp: 1.2,
    slid: { out: 0.5, down: 0.87 },
    clear: 0.15,
  },
};

/** INTO THE ROTOR (`heli-grip.ts`): a skier let go of the skid over the
 * disc falls by gravity alone — never faster — and for `carry` s at most,
 * while his fall runs through the disc, the machine is flown with its
 * collective dumped and its cyclic centred (an inverted rotor under thrust
 * drives the airframe down faster than he falls, away from him) and he is
 * carried along with its level way, so the disc it slows onto under the
 * air's drag is what he falls into. A
 * point of his body crossing the disc between `mast` m and its radius of
 * the mast with the rotor over `spool` of its rpm is struck by a blade:
 * the blade's speed there (Ω·r: some 45 m/s a metre out, 220 at the
 * tip), of which a piece torn off takes `fling` (at most `flingMost`
 * m/s) and the body it leaves `kick`, along the blade's way, and the
 * downwash's `wash` m/s down through the disc. */
export const HELI_BLADES = {
  carry: 3,
  mast: 0.3,
  spool: 0.4,
  fling: 0.3,
  flingMost: 34,
  kick: 0.04,
  wash: 9,
};
