#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GLOVE METRICS LAB (`make glove-metrics`): are the gloves a real
// pair's size? Each glove of the catalog is cut on the game's own loom
// (`dress-gloves.ts`'s `cutGloves`) in the bind pose, every piece of it (the
// hand, each finger, the thumb, the cuff) kept apart, and MEASURED in the
// fist's own frame — along the forearm, toward the back of the hand, up the
// grip — against the bands a real glove sets: a survey's hand (the mean
// adult's hand breadth, circumference, length and wrist, its palm's length)
// with an insulated ski glove's loft laid over it, and a gauntlet's own
// proportions measured off photographs of real ones laid flat (the cuff's
// length against the hand's, its mouth's and wrist's flat widths against
// the palm's; a tube laid flat is half its girth across). And the cuff's
// FIT round the sleeve it is pulled on over: every sleeve point inside the
// gauntlet's mouth must lie inside the cuff, never through it.
//
//   knuckle   the hand's girth round the knuckles, the fingers and thumb
//             left out, cm — a hand's 21 cm (19 a woman's) and the loft
//   breadth   the hand across the knuckles, cm — 8.8 (7.8) and the loft
//   thick     the hand back to palm over the knuckles, cm
//   finger    a finger's breadth and thickness, cm, and the middle's
//             length round its curl, cm (a hand's length less its palm's,
//             and the tip's room)
//   thumb     the thumb's breadth, cm
//   wrist     the cuff's least girth at the wrist, cm
//   mouth     the cuff's girth at its mouth, cm
//   flare     the mouth's girth over the wrist's
//   cuff      the cuff's length from the wrist to the mouth, cm
//   sleeve    the sleeve's girth where the cuff's mouth stands over it, cm
//   through   sleeve points poking OUT through the cuff inside its mouth,
//             over every jacket and build (want 0)
//
//   node scripts/glove-metrics.mjs                  every glove, both bodies
//   node scripts/glove-metrics.mjs --gloves=gauntlet --body=man
//   node scripts/glove-metrics.mjs --json=previews/glove-metrics-before.json
//   node scripts/glove-metrics.mjs --compare=previews/glove-metrics-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    gloves: {
      kind: "string",
      default: "",
      help: "the gloves to measure; every pair when left out",
    },
    body: { kind: "string", default: "", help: "man or woman; both when left out" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    profile: { kind: "flag", help: "print the girth every centimetre along the forearm" },
    where: { kind: "flag", help: "list every sleeve point poking through the cuff" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/glove-metrics.mjs [--gloves=a,b] [--body=man] [--json=file] [--compare=file]",
);

aliasEngine(root);
const L = await import(join(root, "pwa/src/game/dress-loft.ts"));
const G = await import(join(root, "pwa/src/game/dress-gloves.ts"));
const C = await import(join(root, "pwa/src/game/dress-garments.ts"));
const O = await import(join(root, "pwa/src/game/outfit.ts"));

// ---------------------------------------------------------------- the bands
// A HAND, off the survey's means (adults, mm): the man's breadth 88, girth
// round the knuckles 212, length 193, palm 116, wrist 176; the woman's 78,
// 187, 181, 109, 155. A hand's thickness over the knuckles is ~30 (27).
// A SKI GLOVE'S LOFT, over it: the back's insulation the thickest (~12 mm),
// the palm's thin (~5), the sides ~8 — so a gloved hand's girth is the
// hand's and ~6 cm. A GAUNTLET laid flat (photographs of real ones,
// measured against the hand's length): the cuff's length 0.88 of the hand
// part's, its mouth's flat width 1.45 the palm's (thumb in), its wrist's
// 0.92 — so a man's mouth is ~41 cm round and its wrist ~29.
const HAND = {
  man: { breadth: 8.8, girth: 21.2, length: 19.3, palm: 11.6, wrist: 17.6, thick: 3.0 },
  woman: { breadth: 7.8, girth: 18.7, length: 18.1, palm: 10.9, wrist: 15.5, thick: 2.7 },
};
function bandsFor(body, gloves) {
  const h = HAND[body];
  const k = body === "man" ? 1 : 0.9;
  const mitt = gloves === "mitten";
  const middle = h.length - h.palm + 0.8;
  const gauntlet = gloves !== "undercuff";
  return {
    knuckle: [h.girth + 4.5, h.girth + 8],
    breadth: [h.breadth + 1.3, h.breadth + 2.4],
    thick: [h.thick + 1.4, h.thick + 2.4],
    fingerW: mitt ? null : [2.1 * k, 2.7 * k],
    fingerT: mitt ? null : [2.0 * k, 2.6 * k],
    middle: mitt ? null : [middle - 0.6, middle + 0.8],
    thumb: [2.4 * k, (mitt ? 3.4 : 3.0) * k],
    // A knit wristband is thinner over the wrist than a padded strap.
    wrist: gauntlet ? [h.wrist + 8, h.wrist + 13] : [h.wrist + 5, h.wrist + 10],
    mouth: gauntlet
      ? gloves === "race"
        ? [h.wrist + 13, h.wrist + 21]
        : [h.wrist + 19, h.wrist + 26]
      : [h.wrist + 5, h.wrist + 10],
    flare: gauntlet ? (gloves === "race" ? [1.15, 1.5] : [1.3, 1.6]) : [1.0, 1.2],
    cuff: gauntlet ? (gloves === "race" ? [7, 11] : [15.5, 19.5]) : [4, 9],
    through: [0, 0],
  };
}

// ---------------------------------------------------------------- the cut
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** The gloves cut on a loom whose every piece is kept apart. */
function cutPieces(o) {
  const loom = L.createLoom();
  const pieces = [];
  const spy = {
    ...loom,
    tube(spec) {
      const m = loom.mesh();
      const part = spec.hard ? m.hard : m.cloth;
      const from = { v: part.position.length / 3, i: part.index.length };
      loom.tube(spec);
      const p = part.position;
      const at = (k) => ({ x: p[k * 3], y: p[k * 3 + 1], z: p[k * 3 + 2] });
      const pts = [];
      for (let k = from.v; k < p.length / 3; k++) pts.push(at(k));
      const tris = [];
      for (let k = from.i; k < part.index.length; k += 3)
        tris.push([at(part.index[k]), at(part.index[k + 1]), at(part.index[k + 2])]);
      pieces.push({ pts, tris, path: spec.path });
    },
  };
  G.cutGloves(spy, o);
  return pieces;
}

/** The fist's frame of hand `i`, as `cutGloves` lays it. */
function fistFrame(i) {
  const { frames: F, pose: P } = L.bindPose();
  const s = i === 0 ? "l" : "r";
  const d = F[`forearm_${s}`].y;
  const hz = F[`hand_${s}`].z;
  const up = L.norm(L.sub(hz, L.mul(d, dot(hz, d))));
  const across = L.norm(L.cross(d, up));
  const out = across.x * (i === 0 ? 1 : -1) > 0 ? 1 : -1;
  const back = L.mul(across, out);
  const top = P.hands[i];
  return {
    d,
    up,
    back,
    top,
    /** A point as (a along the forearm, b toward the back, u up the grip). */
    local: (p) => {
      const r = L.sub(p, top);
      return { a: dot(r, d), b: dot(r, back), u: dot(r, up) };
    },
  };
}

/** The convex hull of 2D points (monotone chain). */
function hull(pts) {
  const p = [...pts].sort((m, n) => m[0] - n[0] || m[1] - n[1]);
  if (p.length < 3) return p;
  const x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && x(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const hi = [];
  for (const q of [...p].reverse()) {
    while (hi.length >= 2 && x(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
const perimeter = (h) =>
  h.reduce(
    (s, q, k) => s + Math.hypot(q[0] - h[(k + 1) % h.length][0], q[1] - h[(k + 1) % h.length][1]),
    0,
  );
/** Whether a point lies inside a convex hull (counter-clockwise). */
function inside(h, q, slack = 0) {
  for (let k = 0; k < h.length; k++) {
    const a = h[k];
    const b = h[(k + 1) % h.length];
    const e = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if (((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / e < -slack) return false;
  }
  return true;
}

/** A mesh's section by the plane `a` along the forearm, as the (b, u) of
 * where its triangles cross it. */
function slice(tris, a) {
  const out = [];
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const p = t[k];
      const q = t[(k + 1) % 3];
      if ((p.a - a) * (q.a - a) > 0 || p.a === q.a) continue;
      const w = (a - p.a) / (q.a - p.a);
      out.push([p.b + (q.b - p.b) * w, p.u + (q.u - p.u) * w]);
    }
  }
  return out;
}
const localTris = (tris, f) => tris.map((t) => t.map(f.local));
const extent = (xs) => Math.max(...xs) - Math.min(...xs);
const arc = (path) => path.slice(1).reduce((s, p, k) => s + L.len(L.sub(p, path[k])), 0);

function measure(o, show = false) {
  const pieces = cutPieces(o);
  const f = fistFrame(1);
  // Each glove's pieces are laid hand by hand: the second hand's are the
  // latter half.
  const mine = pieces.slice(pieces.length / 2);
  const mitt = o.gloves === "mitten";
  const nFing = mitt ? 1 : 4;
  const [hand, ...rest] = mine;
  const fingers = rest.slice(0, nFing);
  const thumb = rest[nFing];
  const cuff = rest[nFing + 1];
  const H = localTris(hand.tris, f);
  // The knuckles: the hand's widest slice across them — within 3 cm of the
  // grip's top, where the fingers leave the palm (never the wrist).
  const as = H.flat().map((q) => q.a);
  let best = { a: 0, girth: 0, breadth: 0, thick: 0 };
  for (let a = Math.max(Math.min(...as) + 0.01, -0.03); a < Math.max(...as) - 0.004; a += 0.002) {
    const s = slice(H, a);
    if (s.length < 6) continue;
    const g = perimeter(hull(s));
    if (g > best.girth)
      best = {
        a,
        girth: g,
        breadth: extent(s.map((q) => q[1])),
        thick: extent(s.map((q) => q[0])),
      };
  }
  // A finger's breadth (up the grip) and thickness (across its curl) at its
  // middle; the middle finger's length round its curl.
  const fingerDims = fingers.map((fp) => {
    const n = fp.path.length;
    const mid = fp.path[Math.floor(n / 2)];
    const ups = fp.pts.map((p) => dot(L.sub(p, f.top), f.up));
    const near = fp.pts.filter((p) => L.len(L.sub(p, mid)) < 0.016);
    const tangent = L.norm(
      L.sub(fp.path[Math.floor(n / 2) + 1] ?? mid, fp.path[Math.floor(n / 2) - 1]),
    );
    const across = L.norm(L.cross(tangent, f.up));
    const ts = near.map((p) => dot(L.sub(p, mid), across));
    return { w: extent(ups), t: extent(ts), len: arc(fp.path) };
  });
  // The thumb's breadth at its middle, square to its line.
  const tn = thumb.path.length;
  const tMid = L.lerp(
    thumb.path[Math.floor((tn - 1) / 2)],
    thumb.path[Math.ceil((tn - 1) / 2)],
    0.5,
  );
  const tDir = L.norm(L.sub(thumb.path[tn - 1], thumb.path[0]));
  const tRing = thumb.pts.filter((p) => Math.abs(dot(L.sub(p, tMid), tDir)) < 0.004);
  const tSide = L.norm(L.cross(tDir, f.up));
  const thumbW = Math.min(
    extent(tRing.map((p) => dot(L.sub(p, tMid), f.up))),
    extent(tRing.map((p) => dot(L.sub(p, tMid), tSide))),
  );
  // The cuff: its girth along the forearm.
  const K = localTris(cuff.tris, f);
  const ka = K.flat().map((q) => q.a);
  const aMouth = Math.min(...ka);
  const rings = [];
  for (let a = aMouth + 0.001; a < Math.max(...ka) - 0.004; a += 0.003) {
    const s = slice(K, a);
    if (s.length >= 6) rings.push({ a, girth: perimeter(hull(s)), hull: hull(s) });
  }
  const mouth = Math.max(...rings.filter((r) => r.a < aMouth + 0.03).map((r) => r.girth));
  // The wrist: the least girth of the hand and the cuff together, between
  // the mouth's flare and the knuckles.
  const both = [...K, ...H];
  let wristRing = { girth: Infinity, a: 0 };
  for (let a = aMouth + 0.04; a < best.a - 0.03; a += 0.002) {
    const s = slice(both, a);
    if (s.length < 6) continue;
    const g = perimeter(hull(s));
    if (g < wristRing.girth) wristRing = { girth: g, a };
  }
  if (show && args.profile) {
    const line = [];
    for (let a = aMouth; a < best.a + 0.02; a += 0.01) {
      const s = slice(both, a);
      line.push(
        `${(a * 100).toFixed(0)}: ${s.length < 6 ? "-" : (perimeter(hull(s)) * 100).toFixed(1)}`,
      );
    }
    console.log(
      `  girth along the forearm (cm from the grip's top: cm round) ${o.gloves}/${o.body}\n   ${line.join(" ")}`,
    );
  }
  return {
    pieces: { cuff: K, both, rings, aMouth },
    frame: f,
    row: {
      knuckle: best.girth * 100,
      breadth: best.breadth * 100,
      thick: best.thick * 100,
      fingerW: mitt ? null : (fingerDims.reduce((s, x) => s + x.w, 0) / 4) * 100,
      fingerT: mitt ? null : (fingerDims.reduce((s, x) => s + x.t, 0) / 4) * 100,
      middle: mitt ? null : fingerDims[1].len * 100,
      thumb: thumbW * 100,
      wrist: wristRing.girth * 100,
      mouth: mouth * 100,
      flare: mouth / wristRing.girth,
      cuff: (wristRing.a - aMouth) * 100,
    },
  };
}

/** The sleeve under the cuff: its girth at the mouth, and how many of its
 * points inside the mouth poke out through the cuff, over every jacket and
 * build. */
function fit(o, m) {
  let through = 0;
  // An undercuff is tucked up UNDER the sleeve: nothing to pull it over.
  const over = G.overSleeve(o);
  let sleeve = 0;
  for (const jacket of O.JACKETS) {
    for (const weight of O.WEIGHTS) {
      const dressed = { ...o, jacket: jacket.id, weight: weight.id };
      const loom = L.createLoom();
      C.cutClothes(loom, dressed);
      const cloth = loom.mesh().cloth;
      const p = cloth.position;
      const near = (q) =>
        q.a > m.pieces.aMouth - 0.06 && q.a < 0.05 && Math.hypot(q.b, q.u + 0.03) < 0.16;
      const pts = [];
      for (let i = 0; i < p.length; i += 3) {
        const q = m.frame.local({ x: p[i], y: p[i + 1], z: p[i + 2] });
        // Only the forearm's sleeve, round its line.
        if (near(q)) pts.push(q);
      }
      if (jacket.id === o.jacketShown && weight.id === o.weight) {
        const tris = [];
        const v = (k) => m.frame.local({ x: p[k * 3], y: p[k * 3 + 1], z: p[k * 3 + 2] });
        for (let k = 0; k < cloth.index.length; k += 3) {
          const t = [v(cloth.index[k]), v(cloth.index[k + 1]), v(cloth.index[k + 2])];
          if (t.every(near)) tris.push(t);
        }
        const at = slice(tris, m.pieces.aMouth + 0.004);
        if (at.length > 3) sleeve = perimeter(hull(at));
        if (args.profile) {
          const line = [];
          for (let a = m.pieces.aMouth - 0.04; a < m.pieces.aMouth + 0.06; a += 0.005) {
            const sl = slice(tris, a);
            line.push(
              `${(a * 100).toFixed(1)}:${sl.length < 6 ? "-" : (perimeter(hull(sl)) * 100).toFixed(1)}`,
            );
          }
          console.log(`  the sleeve under it (${jacket.id}/${weight.id})\n   ${line.join(" ")}`);
        }
      }
      // The cuff's own gauge differs by the build — re-cut it for this one.
      const cm = weight.id === o.weight ? m : measure(dressed);
      const sections = new Map();
      for (const q of over ? pts : []) {
        // Past the rim, which is laid square to the cuff and so leans across
        // the forearm by a centimetre.
        if (q.a < cm.pieces.aMouth + 0.012) continue;
        const key = Math.round(q.a * 500);
        if (!sections.has(key)) sections.set(key, hull(slice(cm.pieces.both, key / 500)));
        const ring = { hull: sections.get(key) };
        if (ring.hull.length < 3) continue;
        if (!inside(ring.hull, [q.b, q.u], 0.0005)) {
          through++;
          if (args.where)
            console.log(
              `  through ${o.gloves}/${o.body} ${jacket.id}/${weight.id} a=${q.a.toFixed(3)} b=${(q.b * 100).toFixed(1)} u=${(q.u * 100).toFixed(1)} mouth=${(cm.pieces.aMouth * 100).toFixed(1)}`,
            );
        }
      }
    }
  }
  return { sleeve: sleeve * 100, through };
}

// ---------------------------------------------------------------- the table
const COLS = [
  "knuckle",
  "breadth",
  "thick",
  "fingerW",
  "fingerT",
  "middle",
  "thumb",
  "wrist",
  "mouth",
  "flare",
  "cuff",
  "sleeve",
  "through",
];
const gloves = args.gloves ? args.gloves.split(",") : O.GLOVES.map((g) => g.id);
const bodies = args.body ? args.body.split(",") : ["man", "woman"];
const rows = {};
for (const body of bodies) {
  for (const id of gloves) {
    const o = {
      ...O.DEFAULT_OUTFIT,
      body,
      gloves: id,
      weight: "medium",
      jacketShown: O.DEFAULT_OUTFIT.jacket,
    };
    const m = measure(o, true);
    const f = fit(o, m);
    rows[`${id}/${body}`] = { ...m.row, ...f, bands: bandsFor(body, id) };
  }
}

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const fmt = (v) =>
  v === null || v === undefined
    ? "  —  "
    : Number.isInteger(v)
      ? String(v).padStart(5)
      : v.toFixed(2).padStart(5);
console.log(`glove/body        ${COLS.map((c) => c.padStart(7)).join(" ")}`);
let faults = 0;
for (const [key, r] of Object.entries(rows)) {
  const cells = COLS.map((c) => {
    const v = r[c];
    const band = r.bands[c];
    const bad = band && v !== null && (v < band[0] - 1e-9 || v > band[1] + 1e-9);
    if (bad) faults++;
    const was = before?.[key]?.[c];
    const delta =
      was !== undefined && was !== null && v !== null && Math.abs(was - v) > 0.005
        ? `${v > was ? "+" : ""}${(v - was).toFixed(1)}`
        : "";
    return `${fmt(v)}${bad ? "!" : " "}${delta}`.padStart(7);
  });
  console.log(`${key.padEnd(17)} ${cells.join(" ")}`);
  console.log(
    `${"  band".padEnd(17)} ${COLS.map((c) => (r.bands[c] ? `${r.bands[c][0].toFixed(1)}-${r.bands[c][1].toFixed(1)}` : "").padStart(7)).join(" ")}`,
  );
}
console.log(`\n${faults} out of band (marked !)`);
if (args.json) {
  writeFileSync(args.json, JSON.stringify(rows, null, 2));
  console.log(`wrote ${args.json}`);
}
