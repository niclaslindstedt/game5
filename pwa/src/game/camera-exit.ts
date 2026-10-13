// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EXIT CUT — the leap out of the jump plane's door, off the helicopter's
// skid, over the balloon's rim or out of the paramotor's dropped rig shot the way a film shoots it, then handed
// back to the game's own lens. Three-free, so the suite reads it; the
// renderer's machines (`machines.ts`) run it, the app slows the run by it
// (`exitPace`) and the page letterboxes and clears the HUD while it plays
// (`exitHud`, `body.css`'s `exit-cut`).
//
// How the real thing is shot: a skydiving camera flyer goes out just ahead
// of the jumper, often hanging off the outside of the aircraft first, and
// films him coming out at him with the aircraft behind — a film's HALO jump
// "pulls" the actor out of the door toward the lens rather than pushing a
// lens out after him; the jumper's own helmet camera gives the leap and the
// classic look back up at the aircraft going away; and the shot from the
// door down at him shrinking against the ground is the drop. So the cut is
// four shots, cut hard as a film is, each a pure function of the seconds
// since the exit (`ChuteState.since`) and where he and the craft are drawn:
//
//   CLOSE  the leap in slow motion: the camera flyer starts right in his
//          face as he goes, then is pulled back away from him down the
//          line from the craft through him and the scene opens round him —
//          the craft behind him, the sky, the mountain under him;
//   OUT    his own eyes, the horizon tipping up the frame as he dives, the
//          field punched wide, shaken by the slipstream;
//   BACK   his own eyes again, turned up at the craft going away;
//   DROP   from the craft — the door, the skid, the rim, the wing — looking
//          down at him falling away on a long lens zoomed in on him.
//
// Then it cuts back to whatever is next (the camera flyer, his helmet, the
// canopy's ladder), the letterbox opening. It plays only where there is the air for
// it (`EXIT_CUT.least`), and lets go at once if the player pulls, is thrown
// or changes the camera (`ExitCut.skip`).

import {
  BALLOON,
  BALLOON_CENTRE,
  HELI,
  PLANE,
  rotate,
  type ChuteCraft,
  type ChuteState,
  type Quat,
} from "@engine";

import type { LensPose } from "./camera-rigs.ts";

type P = { x: number; y: number; z: number };

/** The shots in order. */
export type ExitShot = "close" | "out" | "back" | "drop";

/** THE CUT'S NUMBERS: each shot's end, s since the exit (the run's own
 * seconds — slowed, they last longer on the wall's clock); the leap's slow
 * motion (the pace, held until `hold` s, back to the run's own by `end` s);
 * the least height over the snow it plays at the exit and goes on playing
 * at, m (under it there is no time for a film before the pull); the
 * letterbox (a bar's share of the screen's height: a 2.39 frame on a wide
 * screen, `tall` on a tall one), how long it takes to close and, the cut
 * over and cut back to the game's lens, to open again, s. */
export const EXIT_CUT = {
  shots: [
    { shot: "close", end: 1.6 },
    { shot: "out", end: 2.6 },
    { shot: "back", end: 3.9 },
    { shot: "drop", end: 5.5 },
  ] as const satisfies readonly { shot: ExitShot; end: number }[],
  slow: { pace: 0.3, hold: 0.6, end: 1.45 },
  least: { start: 180, keep: 110 },
  bars: { scope: 2.39, most: 0.13, tall: 0.07, close: 0.3, open: 0.6 },
  /** The leap through his eyes: the look pitched down off level from `from`
   * to `to`, rad; the field, deg; the roll it ends on, rad; the shake, rad. */
  out: { from: -0.2, to: -0.95, fov: [76, 92], roll: 0.24, shake: 0.016 },
  /** The camera flyer: in his face at the start, m (out of the craft and
   * along the way he faces, that much of it, and down), off him at the end of the pull-back, m (on a 16:9
   * screen), how far off the line from the craft through him as a share of
   * that, how far toward the craft the look ends aimed, m, and the field
   * from start to end, deg. */
  close: { face: 1.3, facing: 0.6, drop: 0.15, far: 8, side: 0.45, toward: 2.4, fov: [46, 64] },
  /** Looking back up at the craft: the field, deg, closing as it goes. */
  back: { fov: [66, 40], roll: -0.08, shake: 0.01 },
  /** From the craft: how much of the frame's height he fills on the long
   * lens, the body's length, m, the field it zooms in from and the share of
   * the shot the zoom takes, the field's bounds, deg, the shake, rad, and
   * the margin kept round him when the look cannot be plumb, deg, and how
   * far the lens may be swung out off a craft right over him, m. */
  drop: {
    fill: 0.2,
    body: 1.9,
    wide: 60,
    zoom: 0.35,
    least: 6,
    most: 55,
    shake: 0.004,
    margin: 6,
    swing: 40,
  },
  /** The steepest a look may be from level, rad: never straight up or down
   * (the lens's up is the world's). */
  steep: 1.38,
} as const;

/** The crafts the cut plays out of: every one he jumps from. */
export const EXIT_CRAFTS: readonly ChuteCraft[] = ["plane", "heli", "balloon", "para"];

/** When the cut is over, s since the exit. */
export const EXIT_END = EXIT_CUT.shots[EXIT_CUT.shots.length - 1].end;

/** The shot `since` s after the exit falls in and how far through it 0..1 —
 * or null once the cut is over. */
export function exitShotAt(since: number, skip?: ExitShot): { shot: ExitShot; k: number } | null {
  // A skipped shot's time goes to the shot after it.
  let start = 0;
  for (const s of EXIT_CUT.shots) {
    if (s.shot === skip) continue;
    if (since < s.end) return { shot: s.shot, k: Math.max(0, (since - start) / (s.end - start)) };
    start = s.end;
  }
  return null;
}

/** The shot a craft's cut goes without: the paramotor's rig falls with him,
 * so there is nothing overhead to look back up at; out of the plane, three
 * kilometres up, his eyes on the dive see only the haze between him and the
 * snow, so the plane's cut goes from his face to the look back at it. */
export const exitSkipOf = (from: ChuteCraft): ExitShot | undefined =>
  from === "para" ? "back" : from === "plane" ? "out" : undefined;

/** WHETHER THE CUT HAS HIM: out of any craft into the skydive, falling free
 * (not pulled yet), not thrown, the shots not over, with the air for them. */
export function exitCutOn(ch: ChuteState | null | undefined, thrown: boolean): boolean {
  if (!ch || thrown || ch.done || ch.fell || !EXIT_CRAFTS.includes(ch.from)) return false;
  if (ch.mode !== "exit" && ch.mode !== "freefall") return false;
  if (ch.since >= EXIT_END) return false;
  return ch.agl >= EXIT_CUT.least.keep;
}

/** Whether a jump at `agl` m over the snow is high enough to be filmed. */
export const exitTall = (agl: number): boolean => agl >= EXIT_CUT.least.start;

const smooth = (t: number): number => {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return k * k * (3 - 2 * k);
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** THE PACE the run goes at `since` s after the exit while the cut has him,
 * game seconds a wall second: the leap in slow motion, eased back. */
export function exitPace(since: number): number {
  const S = EXIT_CUT.slow;
  if (since <= S.hold) return S.pace;
  return mix(S.pace, 1, smooth((since - S.hold) / (S.end - S.hold)));
}

/** The craft as the cut frames it, world frame: its middle (what he looks
 * back at), the point a lens on it stands at (the door, the skid, the rim)
 * and which way is out of it there (a unit, level). */
export type ExitCraft = { middle: P; mount: P; out: P };

/** THE CRAFT AS THE CUT FRAMES IT off its pose as drawn (`x`, `y`, `z` its
 * datum — the plane's and the helicopter's ground datum, the balloon's
 * basket floor — and `q` its attitude): the plane's middle and its jump
 * door, the helicopter's cabin and the skid he sat on, the balloon's
 * envelope and the rim he went over. */
export function exitCraftOf(from: ChuteCraft, pose: P & { q: Quat }): ExitCraft {
  const on = (x: number, y: number, z: number): P => {
    const r = rotate(pose.q, { x, y, z });
    return { x: pose.x + r.x, y: pose.y + r.y, z: pose.z + r.z };
  };
  const level = (x: number): P => {
    const r = rotate(pose.q, { x, y: 0, z: 0 });
    const n = Math.hypot(r.x, r.z) || 1;
    return { x: r.x / n, y: 0, z: r.z / n };
  };
  if (from === "plane") {
    const d = PLANE.door;
    return {
      middle: on(0, PLANE.cog.y, PLANE.cog.z),
      mount: on(d.x, (d.bottom + d.top) / 2, (d.front + d.back) / 2),
      out: level(Math.sign(d.x)),
    };
  }
  if (from === "heli") {
    const b = HELI.body;
    const seat = HELI.seat;
    return {
      middle: on(0, (b.floor + b.roof) / 2, 0),
      mount: on(seat.x, seat.y + 0.5, seat.z),
      out: level(1),
    };
  }
  const k = BALLOON.basket;
  return {
    middle: on(0, BALLOON_CENTRE, 0),
    mount: on(k.width / 2, k.wall + 0.3, 0),
    out: level(1),
  };
}

/** THE PARAMOTOR'S WING as the cut frames it, dropped off him and falling
 * as cloth (`para-scene.ts`'s `wing`): its middle, a lens hung just under
 * it, out along his way. */
export function exitWingOf(wing: P, heading: number): ExitCraft {
  return {
    middle: { ...wing },
    mount: { x: wing.x, y: wing.y - 1.5, z: wing.z },
    out: { x: Math.sin(heading), y: 0, z: Math.cos(heading) },
  };
}

/** His eyes as drawn (`chute-scene.ts`'s `eyes`), or null. */
export type ExitEyes = { at: P; face: P } | null;

/** A slipstream's shake, rad: a few sines off the clock, never a draw. */
function shake(since: number, size: number): { yaw: number; pitch: number } {
  return {
    yaw: size * (Math.sin(since * 41.3) * 0.6 + Math.sin(since * 23.7 + 1.3) * 0.4),
    pitch: size * (Math.sin(since * 37.1 + 0.7) * 0.6 + Math.sin(since * 19.9 + 2.1) * 0.4),
  };
}

const clampPitch = (p: number): number => Math.max(-EXIT_CUT.steep, Math.min(EXIT_CUT.steep, p));

/** A look from `eye` along a heading and a pitch, `dist` m out. */
function along(eye: P, heading: number, pitch: number, dist = 10): P {
  const c = Math.cos(pitch);
  return {
    x: eye.x + Math.sin(heading) * c * dist,
    y: eye.y + Math.sin(pitch) * dist,
    z: eye.z + Math.cos(heading) * c * dist,
  };
}

/** `target` pulled off straight up or down from `eye` (`EXIT_CUT.steep`),
 * leaning the look `toward` the way of a heading. */
export function keepLevelish(eye: P, target: P, heading: number): P {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  const flat = Math.hypot(dx, dz);
  const most = Math.tan(EXIT_CUT.steep);
  if (flat * most >= Math.abs(dy)) return target;
  const need = Math.abs(dy) / most;
  const ux = flat > 1e-3 ? dx / flat : Math.sin(heading);
  const uz = flat > 1e-3 ? dz / flat : Math.cos(heading);
  return { x: eye.x + ux * need, y: target.y, z: eye.z + uz * need };
}

/** THE LENS for `shot`, `k` through it, `since` s after the exit: `ch` the
 * jump, `at` his middle as drawn, `eyes` his eyes as posed, `craft` the
 * craft as drawn (or null, when it is not), `ground` the snow's height,
 * `aspect` the screen's width to its height. */
export function exitLens(
  shot: ExitShot,
  k: number,
  since: number,
  ch: ChuteState,
  at: P,
  eyes: ExitEyes,
  craft: ExitCraft | null,
  ground: (x: number, z: number) => number,
  aspect = 16 / 9,
): LensPose {
  const h = ch.heading;
  const head: P = eyes
    ? { ...eyes.at }
    : { x: at.x + Math.sin(h) * 0.4, y: at.y + 0.3, z: at.z + Math.cos(h) * 0.4 };
  const keepUp = (e: P): P => ({ ...e, y: Math.max(e.y, ground(e.x, e.z) + 2) });
  // A tall screen narrows the lens across: the flyer stands further off,
  // the long lens is opened.
  const wide = Math.pow(Math.max(1, 16 / 9 / aspect), 0.6);
  if (shot === "out" || (shot === "back" && !craft)) {
    const O = EXIT_CUT.out;
    const e = smooth(k);
    const s = shake(since, O.shake * (1 - 0.5 * e));
    const pitch = mix(O.from, O.to, e) + s.pitch;
    return {
      eye: head,
      target: along(head, h + s.yaw, pitch),
      fov: mix(O.fov[0], O.fov[1], smooth(k * 1.6)) * Math.min(1.25, wide),
      roll: O.roll * Math.sin(e * Math.PI * 0.8),
    };
  }
  if (shot === "back" && craft) {
    const B = EXIT_CUT.back;
    const s = shake(since, B.shake);
    const to = keepLevelish(head, craft.middle, h);
    const d = Math.hypot(to.x - head.x, to.y - head.y, to.z - head.z);
    const yaw = Math.atan2(to.x - head.x, to.z - head.z) + s.yaw;
    const pitch = Math.asin(Math.max(-1, Math.min(1, (to.y - head.y) / Math.max(d, 1e-3))));
    return {
      eye: head,
      target: along(head, yaw, clampPitch(pitch + s.pitch), d),
      fov: mix(B.fov[0], B.fov[1], smooth(k)) * Math.min(1.25, wide),
      roll: B.roll * smooth(k),
    };
  }
  if (shot === "close") {
    const C = EXIT_CUT.close;
    // The way back out: down the line from the craft through him and a
    // little off it — so the craft ends right behind him in the frame;
    // with no craft drawn, out ahead of him and under him.
    let u = { x: -Math.sin(h) * 0.6, y: 0.8, z: -Math.cos(h) * 0.6 };
    if (craft) {
      const cx = craft.middle.x - at.x;
      const cy = craft.middle.y - at.y;
      const cz = craft.middle.z - at.z;
      const n = Math.hypot(cx, cy, cz);
      if (n > 1e-3) u = { x: cx / n, y: cy / n, z: cz / n };
    }
    // Off the line, level and square to it (his right when it is plumb).
    const fl = Math.hypot(u.x, u.z);
    const sx = fl > 0.2 ? u.z / fl : Math.cos(h);
    const sz = fl > 0.2 ? -u.x / fl : -Math.sin(h);
    const d = C.far * wide;
    const far = {
      x: at.x + (-u.x + sx * C.side) * d,
      y: at.y - u.y * d,
      z: at.z + (-u.z + sz * C.side) * d,
    };
    // In his face: out along the way he looks and away from the craft (out
    // of the door, off the skid, over the rim), so the lens is never in it.
    let fx = eyes ? eyes.face.x : Math.sin(h);
    let fz = eyes ? eyes.face.z : Math.cos(h);
    const fn = Math.hypot(fx, fz) || 1;
    let ax = craft ? craft.out.x : fx / fn;
    let az = craft ? craft.out.z : fz / fn;
    if (craft) {
      const dx = head.x - craft.middle.x;
      const dz = head.z - craft.middle.z;
      const dn = Math.hypot(dx, dz);
      if (dn > 0.5) {
        ax = ax * 0.5 + (dx / dn) * 0.5;
        az = az * 0.5 + (dz / dn) * 0.5;
      }
    }
    fx = (fx / fn) * C.facing + ax;
    fz = (fz / fn) * C.facing + az;
    const wn = Math.hypot(fx, fz) || 1;
    const near = {
      x: head.x + (fx / wn) * C.face,
      y: head.y - C.drop,
      z: head.z + (fz / wn) * C.face,
    };
    const e = smooth(k);
    // The pull-back eased out: fast off his face, settling wide.
    const back = 1 - (1 - e) * (1 - e);
    const eye = keepUp({
      x: mix(near.x, far.x, back),
      y: mix(near.y, far.y, back),
      z: mix(near.z, far.z, back),
    });
    const aim = { x: at.x + u.x * C.toward, y: at.y + u.y * C.toward, z: at.z + u.z * C.toward };
    const target = {
      x: mix(head.x, aim.x, back),
      y: mix(head.y, aim.y, back),
      z: mix(head.z, aim.z, back),
    };
    return {
      eye,
      target: keepLevelish(eye, target, h),
      fov: mix(C.fov[0], C.fov[1], e) * Math.min(1.25, wide),
      roll: 0,
    };
  }
  // DROP: from the craft down at him on the long lens.
  const D = EXIT_CUT.drop;
  const mount = craft
    ? {
        x: craft.mount.x + craft.out.x * 0.6,
        y: craft.mount.y,
        z: craft.mount.z + craft.out.z * 0.6,
      }
    : { x: at.x - Math.sin(h) * 30, y: at.y + 40, z: at.z - Math.cos(h) * 30 };
  if (craft) {
    // Right over him (the skid, the basket), the lens is swung out along
    // the craft's side on its boom until the look down at him is one the
    // lens can hold, rather than kept short of him and opened wide.
    const fall = mount.y - at.y;
    const wantOff = fall / Math.tan(EXIT_CUT.steep - 0.08);
    let ox = mount.x - at.x;
    let oz = mount.z - at.z;
    const off = Math.hypot(ox, oz);
    if (off > 0.5) {
      ox /= off;
      oz /= off;
    } else {
      ox = craft.out.x;
      oz = craft.out.z;
    }
    const push = Math.min(D.swing, Math.max(0, wantOff - off));
    mount.x += ox * push;
    mount.z += oz * push;
  }
  const dist = Math.hypot(at.x - mount.x, at.y - mount.y, at.z - mount.z);
  const tight = (2 * Math.atan(D.body / D.fill / 2 / Math.max(dist, 1)) * 180) / Math.PI;
  const lens = Math.max(D.least, Math.min(D.most, tight * wide));
  const s = shake(since, D.shake);
  const target = keepLevelish(mount, at, h);
  const dd = Math.hypot(target.x - mount.x, target.y - mount.y, target.z - mount.z);
  const yaw = Math.atan2(target.x - mount.x, target.z - mount.z) + s.yaw;
  const pitch = Math.asin(Math.max(-1, Math.min(1, (target.y - mount.y) / Math.max(dd, 1e-3))));
  // Kept off plumb, the look misses him by the difference: the field opened
  // to hold him in it still.
  const plumb = Math.asin(Math.max(-1, Math.min(1, (at.y - mount.y) / Math.max(dist, 1e-3))));
  const missed = ((Math.abs(plumb - pitch) * 180) / Math.PI) * 2 + D.margin;
  return {
    eye: mount,
    target: along(mount, yaw, clampPitch(pitch + s.pitch), dd),
    fov: mix(D.wide, Math.max(lens, missed), smooth(k / D.zoom)),
    roll: 0,
  };
}

/** Whether `shot` is through his own eyes (his figure hidden). */
export const exitOwnEyes = (shot: ExitShot | null, craft: boolean): boolean =>
  shot === "out" || (shot === "back" && craft);

/** A letterbox bar's share of the screen's height on a screen `aspect`
 * wide to its height, at the cut's share `on` 0..1. */
export function exitBar(aspect: number, on: number): number {
  const B = EXIT_CUT.bars;
  const scope = aspect >= 1 ? Math.max(0, (1 - aspect / B.scope) / 2) : B.tall;
  return Math.min(B.most, scope) * smooth(on);
}

/** THE CUT AS THE MACHINES RUN IT: asked every frame what the jump wants,
 * and it hands back the lens — cut in hard and cut back hard to whatever is
 * under it — the pace to run at and how far the letterbox is closed. */
export type ExitCut = {
  /** This frame: the jump (or none), whether he is thrown, the camera's
   * rung, and the lens the shot wants (null while none). */
  want(
    ch: ChuteState | null | undefined,
    thrown: boolean,
    rung: string,
  ): { shot: ExitShot; k: number } | null;
  frame(lens: LensPose | null): void;
  /** The lens on screen over `next`, the one under it, or null. */
  lens(next: LensPose, dt: number): LensPose | null;
  /** The pace the run is to go at this frame. */
  pace(): number;
  /** How far the cut is on screen, 0..1 (the letterbox). */
  share(): number;
};

export function createExitCut(): ExitCut {
  // The jump this cut is of, whether it is let go of (a rung changed, a
  // pull, too low, thrown) and the rung it began on.
  let jump: ChuteState | null = null;
  let gone = false;
  let rung = "";
  let since = 0;
  let own: LensPose | null = null;
  let bars = 0;
  let on = false;
  return {
    want(ch, thrown, nowRung) {
      if (!ch || !EXIT_CRAFTS.includes(ch.from)) {
        jump = null;
        on = false;
        return null;
      }
      // A new jump (a craft's exit makes a fresh one): taken from its door.
      if (ch !== jump || ch.since < since - 0.05) {
        jump = ch;
        gone = ch.mode !== "exit" || !exitTall(ch.agl);
        rung = nowRung;
      }
      since = ch.since;
      if (!gone && (nowRung !== rung || !exitCutOn(ch, thrown))) gone = true;
      on = !gone;
      return on ? exitShotAt(ch.since, exitSkipOf(ch.from)) : null;
    },
    frame(lens) {
      own = on ? lens : null;
    },
    lens(_next, dt) {
      // Cut in hard and cut back hard, as a film cuts; only the letterbox
      // eases in and out.
      if (own) bars = Math.min(1, bars + dt / EXIT_CUT.bars.close);
      else bars = Math.max(0, bars - dt / EXIT_CUT.bars.open);
      return own;
    },
    pace: () => (on ? exitPace(since) : 1),
    share: () => bars,
  };
}

/** THE PAGE while the cut plays: the `exit-cut` class (the HUD's readouts
 * cleared off the glass) and the letterbox's bar as `--exit-bar`. */
export function exitHud(bar: number): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("exit-cut", bar > 0.001);
  root.style.setProperty("--exit-bar", `${(bar * 100).toFixed(2)}vh`);
}
