// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOTHS ON THE NODE RENDERER (`docs/webgpu.md`, part 12): the grafts
// that paint a canopy, a balloon's envelope and a lit line, restated in
// nodes over the same uniforms (`nodeGraft(material, "cloth", kind)`;
// finished on three's own copy by `model-grafts-tsl.ts`).
//
//   sky-canopy    a skydiver's main, his reserve and a BASE canopy, off
//                 each vertex's place on the wing (`chute-canopy.ts`'s
//                 `skyPaintGlsl`)
//   para-canopy   the paramotor's wing, the free ride's or the army's
//                 (`para-canopy.ts`'s `paintGlsl`)
//   line-light    a line lit as a Lambert surface turned every way
//                 (`para-motor.ts`'s `litLine`)
//   envelope      the balloon's envelope: the colourway's panels, the
//                 tapes, the scorch, the fire's char and holes, the
//                 burner's light through the cloth (`balloon-envelope.ts`)
//
// A material's own uniforms (one balloon's palette, its fire) are read off
// the material drawn (`graftOwn`, `userData.graftOwn`).

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { SPREAD } from "./balloon-fire-plan.ts";
import { ENVELOPE_LOOK, EQUATOR_ROW, ventArc } from "./balloon-look.ts";
import { SKY_PAINT, SKY_WING, type SkyPaint } from "./chute-canopy.ts";
import { graftOwn } from "./figure-tsl.ts";
import type { N } from "./haze-tsl.ts";
import { CANOPY, CANOPY_PAINT, type CanopyPaint, type WingShape } from "./para-canopy.ts";

const {
  Discard,
  Fn,
  If,
  abs,
  attribute,
  clamp,
  exp,
  float,
  floor,
  fract,
  frontFacing,
  fwidth,
  int,
  length,
  materialColor,
  max,
  min,
  mix,
  pow,
  property,
  select,
  smoothstep,
  vec3,
  vec4,
} = TSL as N;

const c3 = (c: readonly number[]): N => vec3(c[0], c[1], c[2]);
/** A number as the GLSL writes it, `toFixed(k)`. */
const fx = (x: number, k: number): number => Number(x.toFixed(k));

// ---------------------------------------------------------------- canopies

/** A sport canopy's paint at `p` (`skyPaintGlsl`, branch for branch). */
function skyPaint(w: WingShape, P: SkyPaint, p: N): N {
  const sub = w.sub ?? 1;
  const u = p.x.toVar();
  const s = p.y.toVar();
  const under = p.z.lessThan(0).toVar();
  const out = vec3(0).toVar();
  If(under.and(s.lessThan(fx(w.mouth[1], 3))), () => {
    out.assign(c3(P.mouth));
  }).Else(() => {
    const across = u
      .add(1)
      .mul(fx(w.cells / 2, 1))
      .toVar();
    const cell = floor(across).toVar();
    const c = select(
      cell.lessThan(0.5).or(cell.greaterThan(fx(w.cells - 1.5, 1))),
      c3(P.ends),
      select(abs(cell.sub(fx((w.cells - 1) / 2, 1))).lessThan(0.5), c3(P.centre), c3(P.body)),
    ).toVar();
    If(under.not().and(s.lessThan(0.07)), () => {
      c.assign(c3(P.nose));
    });
    const v = fract(across).toVar();
    If(v.lessThan(0.012).or(v.greaterThan(0.988)), () => {
      c.mulAssign(0.75);
    });
    if (sub > 1) {
      If(
        v
          .greaterThanEqual(0.012)
          .and(v.lessThanEqual(0.988))
          .and(abs(v.sub(0.5)).lessThan(0.01)),
        () => {
          c.mulAssign(0.88);
        },
      );
    }
    out.assign(select(under, c.mul(fx(P.under, 2)), c));
  });
  return out;
}

/** The paramotor's wing's paint at `p` (`paintGlsl`, branch for branch). */
function paraPaint(P: CanopyPaint, p: N): N {
  const u = p.x.toVar();
  const s = p.y.toVar();
  const under = p.z.lessThan(0).toVar();
  const open = abs(p.z).greaterThan(1.5);
  const out = vec3(0).toVar();
  const mouth = under
    .and(open)
    .and(s.greaterThan(fx(CANOPY.mouth[0], 3)))
    .and(s.lessThan(fx(CANOPY.mouth[1], 3)));
  If(mouth, () => {
    out.assign(c3(P.mouth));
  }).Else(() => {
    const au = abs(u).toVar();
    const off = abs(s.sub(au.mul(0.95).add(0.15))).toVar();
    const c = select(
      au.greaterThan(0.8),
      c3(P.tips),
      select(off.lessThan(0.13), c3(P.swoosh), c3(P.base)),
    ).toVar();
    If(au.lessThanEqual(0.8).and(abs(off.sub(0.13)).lessThan(0.012)), () => {
      c.assign(c3(P.tips));
    });
    const v = fract(u.add(1).mul(fx(CANOPY.cells / 2, 1)));
    If(v.lessThan(0.015).or(v.greaterThan(0.985)), () => {
      c.mulAssign(0.82);
    });
    out.assign(select(under, c.mul(fx(P.under, 2)), c));
  });
  return out;
}

/** The paint's colour node, made once a wing and a scheme. */
const paints = new WeakMap<object, WeakMap<object, N>>();
function painted(wing: object, paint: object, make: () => N): N {
  let byPaint = paints.get(wing);
  if (!byPaint) paints.set(wing, (byPaint = new WeakMap()));
  let node = byPaint.get(paint);
  if (!node) byPaint.set(paint, (node = materialColor.mul(vec4(Fn(make)(), 1))));
  return node;
}

// ---------------------------------------------------------------- envelope

const L = ENVELOPE_LOOK;

const bHash = (q: N): N => {
  const p = fract(q.mul(0.3183099).add(0.1)).mul(17).toVar();
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
};

/** The envelope's value noise (`bNoise`). */
const bNoise = Fn(([x]: N[]) => {
  const i = floor(x).toVar();
  const f0 = fract(x);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar();
  const h = (dx: number, dy: number, dz: number): N => bHash(i.add(vec3(dx, dy, dz)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y),
    f.z,
  );
}).setLayout({ name: "balloonNoise", type: "float", inputs: [{ name: "x", type: "vec3" }] });

const bFbm = (p: N): N =>
  bNoise(p)
    .mul(0.55)
    .add(bNoise(p.mul(2.13)).mul(0.3))
    .add(bNoise(p.mul(4.37)).mul(0.15));

/** `paintSlot` (`balloon-look.ts`'s `PAINT_GLSL`): the palette slot a
 * scheme paints at gore `gf`, row `rowf`, (u, v) on its panel. */
const paintSlot = Fn(([scheme, gf, rowf, u, v]: N[]) => {
  const rows = L.rows;
  const eq = EQUATOR_ROW;
  const g = int(gf.add(0.5)).toVar();
  const row = int(floor(rowf.add(0.5))).toVar();
  const odd = g.sub(g.div(2).mul(2)).toVar();
  const out = int(0).toVar();
  const oddPick = (a: number, b: number): N => select(odd.equal(1), int(a), int(b));
  If(row.lessThan(0), () => {
    out.assign(4);
  })
    .ElseIf(row.greaterThanEqual(rows), () => {
      out.assign(select(scheme.equal(6), int(1), oddPick(2, 0)));
    })
    .ElseIf(row.equal(0), () => {
      out.assign(3);
    })
    .ElseIf(scheme.equal(0), () => {
      out.assign(select(row.greaterThanEqual(rows - 2), int(2), odd));
    })
    .ElseIf(scheme.equal(1), () => {
      If(row.greaterThanEqual(rows - 3), () => {
        out.assign(0);
      })
        .ElseIf(row.greaterThanEqual(eq - 1).and(row.lessThanEqual(eq + 1)), () => {
          out.assign(select(row.equal(eq), int(2), int(3)));
        })
        .Else(() => {
          out.assign(select(row.greaterThan(eq), int(1), int(0)));
        });
    })
    .ElseIf(scheme.equal(2), () => {
      If(row.equal(eq).or(row.equal(eq + 1)), () => {
        const k = float(row.sub(eq)).add(v).div(2);
        out.assign(select(k.lessThan(float(1).sub(abs(u.mul(2).sub(1)).mul(0.5))), int(2), int(3)));
      }).Else(() => {
        out.assign(select(row.greaterThan(eq), int(0), int(1)));
      });
    })
    .ElseIf(scheme.equal(3), () => {
      If(row.greaterThanEqual(eq - 1).and(row.lessThanEqual(eq)), () => {
        const vv = float(row.sub(eq - 1))
          .add(v)
          .div(2);
        out.assign(
          select(
            abs(u.sub(0.5))
              .add(abs(vv.sub(0.5)))
              .lessThan(0.5),
            oddPick(2, 1),
            int(3),
          ),
        );
      }).Else(() => {
        out.assign(0);
      });
    })
    .ElseIf(scheme.equal(4), () => {
      const k = int(floor(gf.add(u).div(2).add(float(row)).add(v))).toVar();
      out.assign(k.sub(k.div(3).mul(3)));
    })
    .ElseIf(scheme.equal(5), () => {
      out.assign(g.sub(g.div(6).mul(6)).add(5));
    })
    .ElseIf(scheme.equal(6), () => {
      const from = rows - 6;
      If(row.greaterThanEqual(from), () => {
        const t = float(row.sub(from)).add(v).div(6);
        out.assign(select(t.greaterThan(abs(u.mul(2).sub(1)).mul(0.85)), oddPick(1, 2), int(0)));
      }).Else(() => {
        out.assign(select(row.equal(from - 1), int(3), int(0)));
      });
    });
  return out;
}).setLayout({
  name: "balloonPaintSlot",
  type: "int",
  inputs: [
    { name: "scheme", type: "int" },
    { name: "gf", type: "float" },
    { name: "rowf", type: "float" },
    { name: "u", type: "float" },
    { name: "v", type: "float" },
  ],
});

const FIRE_EDGE = fx(SPREAD.edge, 3);
const FIRE_CHAR = fx(SPREAD.char, 3);
const FIRE_STREAMER = fx(SPREAD.streamer, 3);

/** How far the fire's front has to come to reach `p` (`fireKey`). */
function fireKey(p: N, n: N): N {
  const d = p.sub(graftOwn("uBalCatch", "vec3")).toVar();
  const climb = select(
    d.y.greaterThan(0),
    d.y.mul(fx(SPREAD.up, 3)),
    d.y.negate().mul(fx(SPREAD.down, 3)),
  );
  return length(vec3(d.x, climb, d.z)).add(n.sub(0.5).mul(fx(SPREAD.noise, 3)));
}

/** The front's flames at `p` (`fireFlicker`). */
function fireFlicker(p: N, behind: N): N {
  const time = graftOwn("uBalTime", "float");
  const f = bFbm(vec3(p.x.mul(1.3), p.y.mul(0.7).sub(time.mul(2.6)), p.z.mul(1.3)));
  const band = smoothstep(-0.3, 0.1, behind).mul(
    float(1).sub(smoothstep(FIRE_EDGE * 0.45, FIRE_EDGE, behind)),
  );
  const patchy = bNoise(p.mul(0.9).add(vec3(0, time.mul(-0.8), 0)));
  return band.mul(smoothstep(0.4, 0.7, f.add(band.mul(0.12)))).mul(smoothstep(0.25, 0.6, patchy));
}

/** The fire's own light (`fireGlow`). */
const fireGlow = (a: N): N =>
  mix(vec3(1.5, 0.3, 0.04), vec3(3.0, 1.55, 0.4), a.mul(a))
    .mul(a)
    .mul(2);

/** Embers winking on the charred streamers (`fireEmbers`). */
function fireEmbers(p: N, behind: N): N {
  const time = graftOwn("uBalTime", "float");
  const e = bNoise(p.mul(6).add(vec3(0, time.mul(0.7), 0)));
  const live = exp(max(0, behind.sub(FIRE_EDGE)).negate().div(3));
  return vec3(2.2, 0.6, 0.1)
    .mul(smoothstep(0.78, 0.95, e))
    .mul(live);
}

/** What the envelope's colour hands its light (GLSL's globals). */
const B_PAINT: N = property("vec3", "bPaint");
const B_TAPE: N = property("float", "bTape");
const B_ALIGHT: N = property("float", "bAlight");
const B_STREAMER: N = property("float", "bStreamer");

/** THE ENVELOPE'S COLOUR (its `color_fragment`). */
const envelopeColour: N = Fn(() => {
  const panel = attribute("aPanel", "vec4");
  const width = attribute("aWidth", "float");
  const rest = attribute("aRest", "vec3").toVar();
  const row = panel.y.toVar();
  const u = panel.z.toVar();
  const v = panel.w.toVar();
  const palette = graftOwn("uBalPalette", "color");
  const scheme = graftOwn("uBalScheme", "int");
  const burnt = graftOwn("uBalBurnt", "float");
  const front = graftOwn("uBalFront", "float");
  const scorch = graftOwn("uBalScorch", "float");
  const across = min(u, u.oneMinus()).mul(width).toVar();
  const panelM = select(
    row.lessThan(-0.5),
    float(fx(L.skirt / L.skirtRows, 3)),
    select(row.greaterThan(L.rows - 0.5), float(1.2), float(fx(ventArc() / L.rows, 3))),
  );
  const up = min(v, v.oneMinus()).mul(panelM).toVar();
  // The footprints, in uniform control flow before the discard.
  const aa = max(fwidth(across), 1e-4).toVar();
  const aav = max(fwidth(up), 1e-4).toVar();
  const slot = paintSlot(scheme, panel.x, row, u, v);
  const paint = vec3(palette.element(slot)).toVar();
  const n = bFbm(rest.mul(0.42)).toVar();
  const behind = select(burnt.greaterThan(0), front.sub(fireKey(rest, n)), float(-99)).toVar();
  B_ALIGHT.assign(0);
  B_STREAMER.assign(0);
  If(behind.greaterThan(FIRE_EDGE), () => {
    If(n.lessThan(FIRE_STREAMER), () => {
      Discard();
    });
    B_STREAMER.assign(1);
  });
  const halfTape = fx(L.tape / 2, 3);
  const halfBand = fx(L.band / 2, 3);
  const tapeV = float(1).sub(smoothstep(aa.negate().add(halfTape), aa.add(halfTape), across));
  const tapeH = select(
    row.lessThan(-0.5),
    float(0),
    float(1).sub(smoothstep(aav.negate().add(halfBand), aav.add(halfBand), up)),
  ).toVar();
  const pale = vec3(0.92, 0.9, 0.86);
  paint.assign(mix(paint, mix(paint, pale, fx(L.bandTone, 2)), tapeH));
  paint.assign(mix(paint, mix(paint, pale, fx(L.tapeTone, 2)), tapeV));
  B_TAPE.assign(max(tapeV, tapeH.mul(0.6)));
  const stitch = float(1).sub(
    smoothstep(aa.negate().add(0.004), aa.add(0.004), abs(across.sub(halfTape))),
  );
  paint.mulAssign(float(1).sub(stitch.mul(0.25)));
  If(row.greaterThan(L.rows - 0.5), () => {
    paint.assign(mix(paint, vec3(palette.element(4)), float(1).sub(smoothstep(0.03, 0.05, v))));
  });
  const near = float(1).sub(smoothstep(0, 5.5, length(rest.sub(graftOwn("uBalCatch", "vec3")))));
  const lick = scorch.mul(near).mul(smoothstep(0.25, 0.75, n).mul(0.45).add(0.55));
  paint.assign(mix(paint, vec3(0.16, 0.08, 0.04), clamp(lick.mul(1.2), 0, 0.92)));
  const heat = smoothstep(-FIRE_CHAR, 0, behind);
  paint.assign(mix(paint, vec3(0.22, 0.1, 0.04), heat.mul(0.6)));
  const char = max(smoothstep(-0.4, 0.15, behind), B_STREAMER);
  paint.assign(mix(paint, vec3(0.045, 0.032, 0.028), char));
  If(behind.greaterThan(-0.3).and(behind.lessThan(FIRE_EDGE)), () => {
    B_ALIGHT.assign(fireFlicker(rest, behind));
  });
  B_PAINT.assign(paint);
  return vec4(paint, 1);
})();

/** THE ENVELOPE'S OWN LIGHT (its `emissivemap_fragment`): the burner
 * through the cloth, the throat lit by the jet, the daylight through it
 * from under the mouth, the fire on it and its embers. */
const envelopeGlow: N = Fn(() => {
  const rest = attribute("aRest", "vec3");
  const glow = graftOwn("uBalGlow", "float");
  const glowColour = graftOwn("uBalGlowColour", "color");
  const through = graftOwn("uBalThrough", "color");
  const h = rest.y.toVar();
  const fall = exp(pow(h.sub(5).div(6), 2).negate())
    .mul(0.9)
    .add(0.05)
    .toVar();
  const inside = select(frontFacing, float(0.45), float(1.25));
  const shade = float(1).sub(B_TAPE.mul(0.7));
  const lit = mix(B_PAINT, vec3(0.9, 0.7, 0.45), fall.mul(0.3));
  const out = lit.mul(glowColour).mul(glow).mul(fall).mul(inside).mul(shade).mul(1.2).toVar();
  const throat = float(1).sub(smoothstep(-0.6, 1.6, h));
  out.addAssign(
    mix(B_PAINT, vec3(1), 0.2)
      .mul(glowColour)
      .mul(min(glow, 1.6))
      .mul(throat)
      .mul(select(frontFacing, float(0.05), float(1.1))),
  );
  out.addAssign(select(frontFacing, vec3(0), B_PAINT.mul(through)));
  out.addAssign(fireGlow(B_ALIGHT));
  If(B_STREAMER.greaterThan(0), () => {
    const front = graftOwn("uBalFront", "float");
    out.addAssign(fireEmbers(rest, front.sub(fireKey(rest, bFbm(rest.mul(0.42))))));
  });
  return out;
})();

// ---------------------------------------------------------------- the hook

/** Finish the copy of a cloth's `material` (graft `kind`); false for a kind
 * not a cloth's. */
export function finishCloth(copy: NodeMaterial, material: THREE.Material, kind: string): boolean {
  const data = material.userData;
  switch (kind) {
    case "sky-canopy": {
      const wing = (data.wing as WingShape | undefined) ?? SKY_WING;
      const paint = (data.paint as SkyPaint | undefined) ?? SKY_PAINT;
      copy.colorNode = painted(wing, paint, () =>
        skyPaint(wing, paint, attribute("aPaint", "vec3")),
      );
      return true;
    }
    case "para-canopy": {
      const paint = (data.paint as CanopyPaint | undefined) ?? CANOPY_PAINT;
      copy.colorNode = painted(CANOPY, paint, () => paraPaint(paint, attribute("aPaint", "vec3")));
      return true;
    }
    case "line-light":
      copy.colorNode = materialColor.mul(vec4(graftOwn("uLineLight", "color"), 1));
      return true;
    case "envelope":
      copy.colorNode = envelopeColour;
      (copy as NodeMaterial & { emissiveNode: N }).emissiveNode = envelopeGlow;
      return true;
    default:
      return false;
  }
}
