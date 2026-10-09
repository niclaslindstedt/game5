// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S COCKPIT AS DRAWN — what the rider sees over the bars on
// the HELMET rung (`camera-sled.ts`): the bars, every control on them, the
// display and his own gloved hands, built in code at the detail a lens a
// metre off them asks for (the model's bars are built for a lens metres
// away, and are hidden while this stands in for them). Where each part
// stands and how far it moves is `sled-cockpit-plan.ts`'s; this builds it
// in the machine's body frame and moves it:
//
//   the BARS, their riser, the strap loop, the padded crossbar, the post,
//   the grips, the hand guards and every control and cable on them turned
//   about the post with the skis (the model's own linkage);
//   the THUMB THROTTLE pushed back toward the grip by the throttle, and the
//   right thumb on it; the BRAKE LEVER pulled to the grip by the brake, two
//   fingers of the left hand on it;
//   the DISPLAY read off the engine (`gaugeOf`) and painted on a canvas a
//   few times a second, lit, under a low smoked deflector, the safety
//   tether clipped in beside it;
//   his FOREARMS run back from the gloves to the elbows of a standing
//   rider, in his jacket's colour, the gauntlets' cuffs over them.
//
// Presentation only, and built the first time it is shown.

import * as THREE from "three";
import { type GameState, type SledState } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { gearOf, type Outfit } from "./outfit.ts";
import {
  COCKPIT,
  cockpitPose,
  freshGauge,
  gaugeOf,
  type GaugeReading,
  LEFT,
  RIGHT,
  type V3,
} from "./sled-cockpit-plan.ts";

export type SledCockpit = {
  group: THREE.Group;
  /** One frame: shown or not; the controls moved, the display read. */
  update(state: GameState, s: SledState, dt: number, shown: boolean): void;
  /** Dress the hands and sleeves in the rider's kit. */
  dress(outfit: Outfit): void;
  dispose(): void;
};

/** How often the display is repainted, Hz — a sled's own refresh. */
const PAINT_HZ = 12;
/** The share of the bars' turn his elbows and shoulders follow. */
const BODY_FOLLOW = 0.55;
/** The display's canvas, px. */
const SCREEN_W = 512;
const SCREEN_H = 290;

const v = (p: V3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);

/** The bar's centre line at `x` (its traced points, read across). */
function barAt(x: number): THREE.Vector3 {
  const pts = COCKPIT.bar;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (x <= b.x || i === pts.length - 1) {
      const t = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x)));
      return new THREE.Vector3(x, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
  }
  return v(pts[0]);
}

/** A ribbed rubber grip along +y, `len` m long (turned onto the bar). */
function gripGeometry(len: number, r: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0), new THREE.Vector2(r + 0.006, 0)];
  pts.push(new THREE.Vector2(r + 0.006, 0.008), new THREE.Vector2(r + 0.001, 0.01));
  const ribs = 14;
  for (let i = 0; i <= ribs * 2; i++) {
    const y = 0.012 + ((len - 0.016) * i) / (ribs * 2);
    pts.push(new THREE.Vector2(r + (i % 2 === 0 ? 0.0012 : -0.0008), y));
  }
  pts.push(new THREE.Vector2(r, len), new THREE.Vector2(0.001, len));
  return new THREE.LatheGeometry(pts, 16);
}

/** A ribbon between two parallel lines of points (a hand guard's shell). */
function ribbon(lo: THREE.Vector3[], hi: THREE.Vector3[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < lo.length; i++) {
    pos.push(lo[i].x, lo[i].y, lo[i].z, hi[i].x, hi[i].y, hi[i].z);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A coiled cord from `a` to `b`: `turns` loops of radius `r`. */
class Coil extends THREE.Curve<THREE.Vector3> {
  private readonly u = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  constructor(
    private readonly a: THREE.Vector3,
    private readonly b: THREE.Vector3,
    private readonly turns: number,
    private readonly r: number,
  ) {
    super();
    const d = b.clone().sub(a).normalize();
    this.u.set(0, 1, 0).cross(d).normalize();
    this.w.copy(d).cross(this.u).normalize();
  }
  override getPoint(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const ang = t * this.turns * Math.PI * 2;
    const sag = Math.sin(t * Math.PI) * 0.05;
    return out
      .copy(this.a)
      .lerp(this.b, t)
      .addScaledVector(this.u, Math.cos(ang) * this.r)
      .addScaledVector(this.w, Math.sin(ang) * this.r)
      .add(new THREE.Vector3(0, -sag, 0));
  }
}

/** Paint the display: the speed, the tach, the coolant, the fuel, the
 * altitude, the clock and the tell-tales. */
function paintScreen(c: CanvasRenderingContext2D, r: GaugeReading, night: boolean): void {
  const W = SCREEN_W;
  const H = SCREEN_H;
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1118");
  bg.addColorStop(1, "#03060a");
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  const ink = night ? "#e8f1ff" : "#ffffff";
  const dim = "#7d90a4";
  c.textBaseline = "alphabetic";
  // THE TACH: segments across the top, growing taller, red past the red line.
  const segs = 36;
  const x0 = 16;
  const x1 = W - 16;
  const sw = (x1 - x0) / segs;
  for (let i = 0; i < segs; i++) {
    const at = (i + 0.5) / segs;
    const lit = at <= r.rpmShare;
    const red = at >= r.redShare;
    const h = 12 + 26 * Math.pow(at, 1.5);
    c.fillStyle = lit
      ? red
        ? "#ff3b30"
        : at > 0.62
          ? "#ffd23f"
          : "#36c9ff"
      : red
        ? "#4a1414"
        : "#17232f";
    c.fillRect(x0 + i * sw + 1.5, 46 - h, sw - 3, h);
  }
  c.font = "700 18px sans-serif";
  c.textAlign = "left";
  c.fillStyle = dim;
  c.fillText("RPM", 52, 70);
  c.textAlign = "right";
  c.fillStyle = ink;
  c.font = "800 24px sans-serif";
  c.fillText(String(r.rpm), W - 52, 72);
  // THE ALTITUDE and THE CLOCK.
  c.font = "700 22px sans-serif";
  c.textAlign = "left";
  c.fillStyle = ink;
  c.fillText(r.altitude === null ? "ALT ---" : `▲ ${r.altitude} m`, 52, 106);
  c.textAlign = "right";
  c.fillText(r.clock, W - 52, 106);
  // THE SPEED, big in the middle.
  c.textAlign = "center";
  c.fillStyle = ink;
  c.font = "800 112px sans-serif";
  c.fillText(String(r.speed), W / 2, 214);
  c.fillStyle = dim;
  c.font = "700 20px sans-serif";
  c.fillText("km/h", W / 2, 240);
  // THE COOLANT (left) and THE FUEL (right), as upright bars, read under.
  const bar = (x: number, share: number, colour: string, value: string) => {
    const top = 84;
    const bottom = 244;
    c.fillStyle = "#17232f";
    c.fillRect(x, top, 22, bottom - top);
    c.fillStyle = colour;
    const h = (bottom - top) * Math.max(0, Math.min(1, share));
    c.fillRect(x, bottom - h, 22, h);
    c.fillStyle = ink;
    c.font = "800 17px sans-serif";
    c.textAlign = "center";
    c.fillText(value, x + 11, bottom + 22);
  };
  bar(14, r.coolantShare, r.hot ? "#ff3b30" : "#36c9ff", `${r.coolant}°`);
  bar(W - 36, r.fuel, r.lowFuel ? "#ffb020" : "#4cd964", `${Math.round(r.fuel * 100)}%`);
  // THE TELL-TALES along the foot.
  const tell = (x: number, on: boolean, colour: string, text: string) => {
    c.fillStyle = on ? colour : "#1b2631";
    c.beginPath();
    c.roundRect(x - 24, H - 32, 48, 24, 6);
    c.fill();
    c.fillStyle = on ? "#05080b" : "#3a4a5a";
    c.font = "800 14px sans-serif";
    c.textAlign = "center";
    c.fillText(text, x, H - 15);
  };
  tell(W / 2 - 108, true, "#4cd964", "FWD");
  tell(W / 2 - 54, night, "#3a8bff", "HI");
  tell(W / 2, r.lowFuel, "#ffb020", "FUEL");
  tell(W / 2 + 54, r.hot, "#ff3b30", "TEMP");
  tell(W / 2 + 108, true, "#ff9f1a", "♨ 3");
}

/** The left switch cluster's face: the warmers' up and down, MODE, the
 * reverse and the beam toggle, white on black. */
function paintCluster(c: CanvasRenderingContext2D): void {
  c.fillStyle = "#111215";
  c.fillRect(0, 0, 128, 128);
  const button = (x: number, y: number, w: number, h: number, fill: string, text: string) => {
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(x, y, w, h, 8);
    c.fill();
    c.fillStyle = "#f2f2f2";
    c.font = "800 15px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, x + w / 2, y + h / 2 + 1);
  };
  button(8, 8, 52, 34, "#c8571b", "▲ ♨");
  button(68, 8, 52, 34, "#c8571b", "▼ ♨");
  button(8, 50, 52, 30, "#2b2f36", "MODE");
  button(68, 50, 52, 30, "#7a1d16", "R");
  button(8, 88, 112, 32, "#2b2f36", "≡D  ≣D");
}

export function createSledCockpit(haze: HazeUniforms): SledCockpit {
  const group = new THREE.Group();
  group.name = "sled-cockpit";
  group.visible = false;
  const made: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let built = false;

  const std = (
    colour: number,
    rough: number,
    metal = 0,
    extra?: THREE.MeshStandardMaterialParameters,
  ) => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({
        color: colour,
        roughness: rough,
        metalness: metal,
        ...extra,
      }),
      haze,
      "sled",
    );
    made.push(m);
    return m;
  };
  const paint = new THREE.Color().setRGB(0.62, 0.035, 0.02);
  const mats = {
    alu: std(0xc9ccd1, 0.3, 0.85),
    black: std(0x161719, 0.45),
    matte: std(0x0c0c0d, 0.85),
    rubber: std(0x101011, 0.9),
    paint: std(paint.getHex(), 0.32, 0, { side: THREE.DoubleSide }),
    red: std(0xd8160f, 0.35, 0, { emissive: 0x300000 }),
    yellow: std(0xf0c419, 0.4),
    bolt: std(0x8c8f94, 0.25, 0.9),
    glass: std(0xc98a1a, 0.15, 0, { transparent: true, opacity: 0.85 }),
    foam: std(0x1b1c1f, 0.95),
    glove: std(0x17191d, 0.55),
    glove2: std(0x2c2f35, 0.5),
    sleeve: std(0xc92a1c, 0.6),
    smoke: std(0x10141a, 0.05, 0, {
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  // THE BARS turn about the post's axis through the riser.
  const riser = v(COCKPIT.riser);
  const axis = riser.clone().sub(v(COCKPIT.post)).normalize();
  const bars = new THREE.Group();
  bars.position.copy(riser);
  group.add(bars);
  /** A point in the machine's frame, as the bars' group has it. */
  const inBars = (p: THREE.Vector3): THREE.Vector3 => p.clone().sub(riser);

  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = bars) => {
    const o = new THREE.Mesh(g, m);
    parent.add(o);
    return o;
  };
  const tube = (points: THREE.Vector3[], r: number, m: THREE.Material, parent = bars, seg = 24) =>
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(parent === bars ? points.map(inBars) : points),
        seg,
        r,
        10,
      ),
      m,
      parent,
    );
  const box = (
    at: THREE.Vector3,
    size: [number, number, number],
    m: THREE.Material,
    rot?: THREE.Euler,
    parent: THREE.Object3D = bars,
  ) => {
    const o = mesh(new THREE.BoxGeometry(...size), m, parent);
    o.position.copy(parent === bars ? inBars(at) : at);
    if (rot) o.rotation.copy(rot);
    return o;
  };
  /** A cylinder from `a` to `b` (radius `r` at `a`, `r2` at `b`). */
  const cyl = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    r: number,
    m: THREE.Material,
    r2 = r,
    parent: THREE.Object3D = bars,
    seg = 14,
  ) => {
    const d = b.clone().sub(a);
    const o = mesh(new THREE.CylinderGeometry(r2, r, d.length(), seg), m, parent);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    o.position.copy(parent === bars ? inBars(mid) : mid);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return o;
  };

  // The controls that move, and the hands' parts that follow them.
  let throttle: THREE.Group | null = null;
  let brake: THREE.Group | null = null;
  let thumb: THREE.Mesh | null = null;
  const fingers: THREE.Mesh[] = [];
  const arms: {
    wrist: THREE.Vector3;
    elbow: THREE.Vector3;
    shoulder: THREE.Vector3;
    fore: THREE.Mesh;
    upper: THREE.Mesh;
    cuff: THREE.Mesh;
  }[] = [];
  let screen: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } | null = null;

  const build = (): void => {
    built = true;
    const B = COCKPIT;
    const half = B.halfBar;
    // ── THE BAR, the riser and its clamp, the post ──────────────────────
    tube(B.bar.map(v), 0.0125, mats.alu, bars, 48);
    const top = barAt(0);
    box(top.clone().add(new THREE.Vector3(0, -0.012, 0.004)), [0.085, 0.05, 0.05], mats.black);
    box(top.clone().add(new THREE.Vector3(0, 0.016, 0)), [0.07, 0.014, 0.036], mats.alu);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        cyl(
          top.clone().add(new THREE.Vector3(sx * 0.024, 0.022, sz * 0.011)),
          top.clone().add(new THREE.Vector3(sx * 0.024, 0.028, sz * 0.011)),
          0.0045,
          mats.bolt,
        );
    cyl(v(B.post), riser.clone().add(new THREE.Vector3(0, -0.02, 0)), 0.042, mats.black, 0.03);
    // ── THE MOUNTAIN STRAP's loop and the padded crossbar ───────────────
    const sh = B.strap.half;
    const sy = top.y - 0.03;
    const sz = top.z + 0.012;
    tube(
      [
        new THREE.Vector3(-sh, sy, sz),
        new THREE.Vector3(-sh * 0.85, sy + B.strap.height * 0.8, sz + 0.012),
        new THREE.Vector3(0, sy + B.strap.height, sz + 0.016),
        new THREE.Vector3(sh * 0.85, sy + B.strap.height * 0.8, sz + 0.012),
        new THREE.Vector3(sh, sy, sz),
      ],
      0.011,
      mats.alu,
    );
    const padY = barAt(half * 0.38).y + 0.012;
    const padZ = barAt(half * 0.38).z + 0.03;
    cyl(
      new THREE.Vector3(-half * 0.42, padY, padZ),
      new THREE.Vector3(half * 0.42, padY, padZ),
      0.024,
      mats.foam,
    );
    cyl(
      new THREE.Vector3(-0.03, padY, padZ),
      new THREE.Vector3(0.03, padY, padZ),
      0.0245,
      mats.paint,
    );
    // The strap itself: a nylon loop hanging off the bar's middle.
    tube(
      [
        top.clone().add(new THREE.Vector3(-0.025, 0.02, 0.01)),
        top.clone().add(new THREE.Vector3(-0.03, 0.05, -0.05)),
        top.clone().add(new THREE.Vector3(0, 0.06, -0.075)),
        top.clone().add(new THREE.Vector3(0.03, 0.05, -0.05)),
        top.clone().add(new THREE.Vector3(0.025, 0.02, 0.01)),
      ],
      0.006,
      mats.matte,
    );
    // ── THE GRIPS, the bar ends and the hand guards ─────────────────────
    const grip = gripGeometry(B.grip.to - B.grip.from, B.grip.r);
    for (const sx of [-1, 1]) {
      const a = barAt(sx * B.grip.from);
      const b = barAt(sx * B.grip.to);
      const g = mesh(grip, mats.rubber);
      g.position.copy(inBars(a));
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      const end = b.clone().add(new THREE.Vector3(sx * 0.004, 0, 0));
      cyl(end, end.clone().add(new THREE.Vector3(sx * 0.02, 0, 0)), 0.02, mats.alu);
      // The guard wraps from the bar end forward and round in front of the
      // grip, open at the back.
      const path = new THREE.CatmullRomCurve3([
        end.clone().add(new THREE.Vector3(sx * 0.024, 0, 0)),
        end.clone().add(new THREE.Vector3(sx * 0.036, 0, 0.06)),
        end.clone().add(new THREE.Vector3(-sx * 0.03, 0.0, 0.095)),
        end.clone().add(new THREE.Vector3(-sx * 0.1, -0.006, 0.082)),
        end.clone().add(new THREE.Vector3(-sx * 0.135, -0.014, 0.05)),
      ]).getPoints(20);
      const lo = path.map((p, i) =>
        inBars(
          p.clone().add(new THREE.Vector3(0, -0.016 - 0.004 * Math.sin((i / 20) * Math.PI), 0)),
        ),
      );
      const hi = path.map((p, i) =>
        inBars(
          p.clone().add(new THREE.Vector3(0, 0.03 + 0.008 * Math.sin((i / 20) * Math.PI), -0.006)),
        ),
      );
      mesh(ribbon(lo, hi), mats.paint);
      // Its rim, a black edge round the top.
      tube(
        hi.map((p) => p.clone().add(riser)),
        0.0035,
        mats.black,
        bars,
        24,
      );
    }
    // ── THE RIGHT: the throttle's housing, the stop button, the paddle ──
    const rh = barAt(RIGHT * B.housing);
    box(rh.clone().add(new THREE.Vector3(-0, 0.004, 0.006)), [0.034, 0.05, 0.056], mats.black);
    cyl(
      rh.clone().add(new THREE.Vector3(0.002, 0.03, -0.006)),
      rh.clone().add(new THREE.Vector3(0.002, 0.036, -0.006)),
      0.015,
      mats.yellow,
    );
    cyl(
      rh.clone().add(new THREE.Vector3(0.002, 0.036, -0.006)),
      rh.clone().add(new THREE.Vector3(0.002, 0.047, -0.006)),
      0.0125,
      mats.red,
      0.0135,
    );
    throttle = new THREE.Group();
    throttle.position.copy(inBars(rh.clone().add(new THREE.Vector3(-0.012, -0.004, 0.04))));
    bars.add(throttle);
    {
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.03, 0.007), mats.black);
      paddle.position.set(-0.03, 0, 0);
      throttle.add(paddle);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.004), mats.rubber);
      pad.position.set(-0.04, 0, -0.005);
      throttle.add(pad);
    }
    // The throttle's cable down to the post.
    tube(
      [
        rh.clone().add(new THREE.Vector3(0.01, -0.02, 0.02)),
        rh.clone().add(new THREE.Vector3(0.08, -0.07, 0.05)),
        v(B.post).add(new THREE.Vector3(-0.05, 0.06, -0.01)),
        v(B.post).add(new THREE.Vector3(-0.02, 0.0, 0.02)),
      ],
      0.0045,
      mats.matte,
    );
    // ── THE LEFT: the master cylinder, the brake lever, the cluster ─────
    const lh = barAt(LEFT * B.housing);
    box(lh.clone().add(new THREE.Vector3(-0, 0.0, 0.01)), [0.036, 0.038, 0.05], mats.black);
    box(lh.clone().add(new THREE.Vector3(-0, 0.03, 0.004)), [0.05, 0.026, 0.036], mats.black);
    box(lh.clone().add(new THREE.Vector3(-0, 0.044, 0.004)), [0.052, 0.004, 0.038], mats.alu);
    const sight = cyl(
      lh.clone().add(new THREE.Vector3(-0, 0.03, -0.0145)),
      lh.clone().add(new THREE.Vector3(-0, 0.03, -0.0175)),
      0.007,
      mats.glass,
    );
    sight.rotation.x = Math.PI / 2;
    box(lh.clone().add(new THREE.Vector3(0.022, -0.016, 0.03)), [0.012, 0.01, 0.022], mats.paint);
    brake = new THREE.Group();
    brake.position.copy(inBars(lh.clone().add(new THREE.Vector3(0.016, -0.004, 0.044))));
    bars.add(brake);
    {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.007), mats.black);
      arm.position.set(0.075, -0.002, 0);
      brake.add(arm);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), mats.black);
      tip.position.set(0.146, -0.002, 0);
      tip.scale.set(1, 0.9, 0.6);
      brake.add(tip);
    }
    // The brake's hose down to the post.
    tube(
      [
        lh.clone().add(new THREE.Vector3(-0.006, -0.02, 0.025)),
        lh.clone().add(new THREE.Vector3(-0.07, -0.08, 0.06)),
        v(B.post).add(new THREE.Vector3(0.05, 0.06, -0.01)),
        v(B.post).add(new THREE.Vector3(0.02, 0.0, 0.02)),
      ],
      0.005,
      mats.matte,
    );
    // The switch cluster inboard of it, its face to the rider.
    const sc = barAt(LEFT * (B.housing - 0.045));
    box(sc.clone().add(new THREE.Vector3(-0, 0.006, 0.004)), [0.044, 0.05, 0.05], mats.black);
    {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintCluster(ctx);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.push(tex);
        const m = std(0xffffff, 0.5, 0, { map: tex });
        const face = mesh(new THREE.PlaneGeometry(0.04, 0.042), m);
        face.position.copy(inBars(sc.clone().add(new THREE.Vector3(-0, 0.008, -0.0215))));
        face.rotation.set(-0.35, Math.PI, 0);
      }
    }
    tube(
      [
        sc.clone().add(new THREE.Vector3(-0.01, -0.02, 0.02)),
        sc.clone().add(new THREE.Vector3(-0.09, -0.08, 0.05)),
        v(B.post).add(new THREE.Vector3(0.03, 0.04, 0)),
      ],
      0.004,
      mats.matte,
    );

    // ── THE HANDS on the grips, turning with the bars ───────────────────
    // Each a gloved hand closed round its grip: the back of the hand over
    // it, the heel of the palm under its back, the knuckles' armour, the
    // fingers curled round its front and under it — on the left the index
    // and middle fingers out on the brake lever instead (`fingers`, moved
    // with it) — and the thumb: the right one out on the throttle's paddle
    // (`thumb`), the left one wrapped under the grip.
    const R = B.grip.r + 0.0105;
    for (const sx of [-1, 1]) {
      const at = (x: number, y: number, z: number) => barAt(sx * x).add(new THREE.Vector3(0, y, z));
      const blob = (c: THREE.Vector3, r: [number, number, number], m: THREE.Material, tilt = 0) => {
        const o = mesh(new THREE.SphereGeometry(1, 18, 12), m);
        o.position.copy(inBars(c));
        o.scale.set(...r);
        o.rotation.x = tilt;
        return o;
      };
      const hand = (B.grip.from + B.grip.to) / 2;
      blob(at(hand, 0.016, -0.016), [0.048, 0.017, 0.034], mats.glove, -0.45);
      blob(at(hand + 0.004, -0.006, -0.022), [0.044, 0.017, 0.017], mats.glove);
      const knuckle = mesh(new THREE.CapsuleGeometry(0.0095, 0.062, 4, 10), mats.glove2);
      knuckle.position.copy(inBars(at(hand + 0.002, 0.033, -0.004)));
      knuckle.rotation.z = Math.PI / 2;
      for (let f = 0; f < 4; f++) {
        if (sx === LEFT && f < 2) continue;
        const x = B.grip.from + 0.016 + f * 0.022;
        const arc = [at(x, 0.03, -0.006)];
        for (const th of [0.45, 1.05, 1.65, 2.25, 2.7])
          arc.push(at(x, Math.cos(th) * R, Math.sin(th) * R));
        tube(arc, 0.0098, mats.glove, bars, 12);
        const tip = mesh(new THREE.SphereGeometry(0.0098, 10, 8), mats.glove);
        tip.position.copy(inBars(arc[arc.length - 1]));
      }
      if (sx === LEFT) {
        tube(
          [
            at(B.grip.from + 0.006, 0.012, -0.03),
            at(B.grip.from + 0.004, -0.014, -0.02),
            at(B.grip.from + 0.016, -0.026, 0.0),
            at(B.grip.from + 0.034, -0.022, 0.014),
          ],
          0.011,
          mats.glove,
          bars,
          10,
        );
      }
      // The wrist, behind the back of the hand.
      const wrist = at(hand - 0.016, 0.012, -0.078);
      const elbow = v(B.elbow);
      elbow.x *= sx;
      const shoulder = new THREE.Vector3(sx * 0.21, B.elbow.y + 0.38, B.elbow.z - 0.25);
      const unit = (r1: number, r2: number, m: THREE.Material) => {
        const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, 1, 16, 1, true), m);
        group.add(o);
        return o;
      };
      arms.push({
        wrist,
        elbow,
        shoulder,
        cuff: unit(0.033, 0.043, mats.glove2),
        fore: unit(0.044, 0.056, mats.sleeve),
        upper: unit(0.056, 0.064, mats.sleeve),
      });
    }
    // The right thumb on the paddle; two fingers of the left on the lever.
    thumb = mesh(new THREE.CapsuleGeometry(0.0115, 1, 4, 10), mats.glove);
    for (let i = 0; i < 2; i++)
      fingers.push(mesh(new THREE.CapsuleGeometry(0.0098, 1, 4, 10), mats.glove));

    // ── THE DISPLAY on its bracket ahead of the clamp, turning with the
    // bars: the bezel, the sun shade over it, the lit face. ─────────────
    const D = B.display;
    const dash = new THREE.Group();
    dash.position.copy(inBars(v(D.at)));
    dash.rotation.set(D.tilt, Math.PI, 0);
    bars.add(dash);
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(D.w + 0.022, D.h + 0.022, 0.018),
      mats.black,
    );
    bezel.position.z = -0.0095;
    dash.add(bezel);
    const shade = new THREE.Mesh(new THREE.BoxGeometry(D.w + 0.02, 0.004, 0.022), mats.black);
    shade.position.set(0, D.h / 2 + 0.012, 0.008);
    shade.rotation.x = -0.2;
    dash.add(shade);
    cyl(
      top.clone().add(new THREE.Vector3(0, -0.02, 0.02)),
      v(D.at).add(new THREE.Vector3(0, -0.03, 0.01)),
      0.012,
      mats.black,
    );
    const canvas = document.createElement("canvas");
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      textures.push(tex);
      const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      made.push(m);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(D.w, D.h), m);
      face.position.z = 0.0005;
      dash.add(face);
      screen = { ctx, tex };
    }
    // ── THE LOW SMOKED DEFLECTOR on the hood ahead, curved round it ─────
    {
      const F = B.deflector;
      const g = new THREE.PlaneGeometry(F.w, F.h, 12, 2);
      g.translate(0, F.h / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / (F.w / 2);
        p.setZ(i, -0.07 * x * x);
      }
      g.computeVertexNormals();
      const o = new THREE.Mesh(g, mats.smoke);
      o.position.set(0, F.y, F.z);
      o.rotation.set(-F.lean, 0, 0);
      o.renderOrder = 2;
      group.add(o);
      const rim = new THREE.CatmullRomCurve3(
        Array.from({ length: 13 }, (_, i) => {
          const x = (i / 12 - 0.5) * F.w;
          const u = x / (F.w / 2);
          return new THREE.Vector3(x, F.h, -0.07 * u * u).applyEuler(o.rotation).add(o.position);
        }),
      );
      mesh(new THREE.TubeGeometry(rim, 24, 0.004, 6), mats.black, group);
    }
    // THE SAFETY TETHER clipped in on the hood, its coiled cord running
    // back to the rider.
    const post = v(B.tether);
    cyl(post, post.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.012, mats.black, 0.012, group);
    cyl(
      post.clone().add(new THREE.Vector3(0, 0.02, 0)),
      post.clone().add(new THREE.Vector3(0, 0.034, -0.006)),
      0.011,
      mats.red,
      0.009,
      group,
    );
    mesh(
      new THREE.TubeGeometry(
        new Coil(
          post.clone().add(new THREE.Vector3(0, 0.03, -0.012)),
          post.clone().add(new THREE.Vector3(RIGHT * 0.06, -0.12, -0.3)),
          12,
          0.008,
        ),
        240,
        0.0028,
        6,
      ),
      mats.red,
      group,
    );
  };

  const mem = freshGauge();
  let since = Infinity;
  let worn: Outfit | null = null;
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  /** A unit cylinder stretched from `a` to `b`. */
  const span = (o: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
    tmp.copy(b).sub(a);
    const len = tmp.length();
    o.position.copy(a).addScaledVector(tmp, 0.5);
    o.quaternion.setFromUnitVectors(up, tmp.divideScalar(len));
    o.scale.set(1, len, 1);
  };
  /** A point of the bars' group in the machine's frame. */
  const onBars = (p: THREE.Vector3, out: THREE.Vector3) =>
    out.copy(p).sub(riser).applyQuaternion(bars.quaternion).add(riser);

  return {
    group,
    update(state, s, dt, shown) {
      group.visible = shown;
      if (!shown) {
        since = Infinity;
        return;
      }
      if (!built) build();
      const p = cockpitPose(s);
      bars.quaternion.setFromAxisAngle(axis, p.bars);
      // The throttle's paddle swings back toward the grip about the
      // housing's upright; the brake lever toward its grip.
      if (throttle) throttle.rotation.y = RIGHT * (p.throttle - 0.62);
      if (brake) brake.rotation.y = LEFT * (p.brake - 0.3);
      // The thumb from the hand onto the paddle's pad; the two fingers from
      // their knuckles onto the lever.
      const reach = (o: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) => {
        tmp.copy(to).sub(from);
        const len = tmp.length();
        o.position.copy(from).addScaledVector(tmp, 0.5);
        o.quaternion.setFromUnitVectors(up, tmp.divideScalar(len));
        o.scale.set(1, Math.max(0.001, len - 0.01), 1);
      };
      if (thumb && throttle) {
        throttle.updateMatrix();
        const pad = new THREE.Vector3(RIGHT * 0.036, 0.002, -0.012).applyMatrix4(throttle.matrix);
        reach(
          thumb,
          inBars(barAt(RIGHT * (COCKPIT.grip.from + 0.006))).add(
            new THREE.Vector3(0, 0.018, -0.022),
          ),
          pad,
        );
      }
      if (brake) {
        brake.updateMatrix();
        fingers.forEach((f, i) => {
          const tip = new THREE.Vector3(LEFT * (0.022 + i * 0.022), 0.004, 0.004).applyMatrix4(
            brake!.matrix,
          );
          const root = inBars(barAt(LEFT * (COCKPIT.grip.from + 0.016 + i * 0.022))).add(
            new THREE.Vector3(0, 0.03, -0.004),
          );
          reach(f, root, tip);
        });
      }
      // The forearms from the turned wrists back to the elbows.
      const wrist = new THREE.Vector3();
      const cuffEnd = new THREE.Vector3();
      const elbow = new THREE.Vector3();
      const shoulder = new THREE.Vector3();
      const body = new THREE.Quaternion();
      // His shoulders and elbows go a share of the way round with the bars,
      // as a rider's body follows his hands into a turn.
      body.setFromAxisAngle(axis, p.bars * BODY_FOLLOW);
      for (const arm of arms) {
        onBars(arm.wrist, wrist);
        elbow.copy(arm.elbow).sub(riser).applyQuaternion(body).add(riser);
        shoulder.copy(arm.shoulder).sub(riser).applyQuaternion(body).add(riser);
        cuffEnd.copy(elbow).sub(wrist).setLength(0.06).add(wrist);
        span(arm.cuff, wrist, cuffEnd);
        span(arm.fore, cuffEnd, elbow);
        span(arm.upper, elbow, shoulder);
      }
      // The display, a few times a second.
      since += dt;
      if (screen && since >= 1 / PAINT_HZ) {
        const level = state.level;
        const sea = level.mountain?.sea;
        const hour = level.sun.hour + state.t / 3600;
        const r = gaugeOf(s, mem, Math.min(since, 1), sea === undefined ? null : s.y - sea, hour);
        paintScreen(screen.ctx, r, level.sun.hour >= 18 || level.sun.hour < 7);
        screen.tex.needsUpdate = true;
        since = 0;
      }
      void worn;
    },
    dress(outfit) {
      if (outfit === worn) return;
      worn = outfit;
      const g = gearOf("gloves", outfit.gloves);
      const j = gearOf("jacket", outfit.jacket);
      mats.glove.color.setHex(g.main);
      mats.glove2.color.setHex(g.second);
      mats.sleeve.color.setHex(j.main);
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of made) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
