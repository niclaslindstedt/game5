// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK EVAL LAB's REPORT (`scripts/rock-eval.mjs` reads the numbers,
// this writes them down): one scene's line, the totals a candidate is
// weighed by, the table, the comparison with a run written before (round
// 1's JSON included — a reading it lacks prints as n/a), and the two index
// pages: every scene by GROUP (a map and a sky a row) and by SCENE (the
// same lens on every map side by side).

const cm = (m) => (m * 100).toFixed(0);
const fx = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "n/a" : v.toFixed(d));
export const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/** The ground's ms of a scene's frame (what hiding the ground saved). */
const groundMs = (c) => (c.msNoGround === undefined ? null : c.ms - c.msNoGround);
/** The ground's own rock's ms, where the build can turn it off. */
const groundRockMs = (c) =>
  c.msGroundRockOff === null || c.msGroundRockOff === undefined ? null : c.ms - c.msGroundRockOff;

/** One scene's numbers on a line. */
export function line(r) {
  const c = r.cost;
  const calls = c.calls - c.callsBare;
  const tris = (c.triangles - c.trianglesBare) / 1000;
  const g = r.gap;
  const gap = g
    ? `gap ${cm(g.mean)}/${cm(g.p95)} cm` +
      (g.near ? ` near ${cm(g.near.p95)}/${cm(g.near.worst)} cm` : " near n/a")
    : "gap n/a";
  const ground = groundMs(c);
  const gr = groundRockMs(c);
  return (
    `rock ${String(calls).padStart(3)} calls ${tris.toFixed(1).padStart(5)}k tris ` +
    `(${(c.rockTriangles / 1000).toFixed(1)}k in view) · ` +
    `frame ${c.ms.toFixed(0)} ms (rock ${(c.ms - c.msBare).toFixed(0)}` +
    (ground !== null ? `, ground ${ground.toFixed(0)}` : "") +
    (gr !== null ? `, ground rock ${gr.toFixed(0)}` : "") +
    `) · world ${(c.worldMs - c.worldMsBare).toFixed(2)} ms · settle ${r.settleMs.toFixed(0)} ms · ` +
    `held ${((r.held?.triangles ?? 0) / 1000).toFixed(1)}k tris ${((r.held?.bytes ?? 0) / 1048576).toFixed(2)} MB · ${gap}`
  );
}

/** A card's caption, shorter than the table's line. */
function caption(r) {
  if (!r.cost) return "";
  const c = r.cost;
  const ground = groundMs(c);
  const g = r.gap;
  return (
    `${c.calls - c.callsBare} calls · ${((c.triangles - c.trianglesBare) / 1000).toFixed(1)}k tris · ` +
    `${c.ms.toFixed(0)} ms (rock ${(c.ms - c.msBare).toFixed(0)}${ground !== null ? `, ground ${ground.toFixed(0)}` : ""}) · ` +
    `held ${((r.held?.bytes ?? 0) / 1048576).toFixed(2)} MB` +
    (g ? ` · gap p95 ${cm(g.p95)}${g.near ? ` near ${cm(g.near.p95)}` : ""} cm` : "")
  );
}

/** The totals over every priced scene. */
export function totals(result) {
  const rows = Object.entries(result.scenes).filter(([, r]) => r.cost);
  if (!rows.length) return null;
  const mean = (f) => rows.reduce((a, [, r]) => a + f(r), 0) / rows.length;
  const gapped = rows.filter(([, r]) => r.gap);
  const near = gapped.filter(([, r]) => r.gap.near);
  const grounded = rows.filter(([, r]) => groundMs(r.cost) !== null);
  const groundRock = rows.filter(([, r]) => groundRockMs(r.cost) !== null);
  return {
    scenes: rows.length,
    rockCalls: mean((r) => r.cost.calls - r.cost.callsBare),
    rockTriangles: mean((r) => r.cost.triangles - r.cost.trianglesBare),
    worstTriangles: Math.max(...rows.map(([, r]) => r.cost.triangles - r.cost.trianglesBare)),
    rockMs: mean((r) => r.cost.ms - r.cost.msBare),
    frameMs: mean((r) => r.cost.ms),
    groundMs: grounded.length
      ? grounded.reduce((a, [, r]) => a + groundMs(r.cost), 0) / grounded.length
      : null,
    groundRockMs: groundRock.length
      ? groundRock.reduce((a, [, r]) => a + groundRockMs(r.cost), 0) / groundRock.length
      : null,
    worldMs: mean((r) => r.cost.worldMs - r.cost.worldMsBare),
    settleMs: mean((r) => r.settleMs),
    heldTriangles: mean((r) => r.held?.triangles ?? 0),
    heldBytes: mean((r) => r.held?.bytes ?? 0),
    gapMean: gapped.length ? gapped.reduce((a, [, r]) => a + r.gap.mean, 0) / gapped.length : null,
    gapP95: gapped.length ? Math.max(...gapped.map(([, r]) => r.gap.p95)) : null,
    gapNearP95: near.length ? Math.max(...near.map(([, r]) => r.gap.near.p95)) : null,
    gapNearWorst: near.length ? Math.max(...near.map(([, r]) => r.gap.near.worst)) : null,
  };
}

/** The table as text. */
export function table(result, args) {
  const rows = Object.entries(result.scenes).filter(([, r]) => r.cost);
  const t = result.totals;
  const sh = result.shimmer ?? {};
  const o = result.orderCheck;
  return [
    `rock eval — ${args.quality} preset, ${args.width}×${args.height}, software rasterizer (compare builds, not machines); every scene read from nothing`,
    "",
    ...Object.entries(result.maps).map(
      ([n, m]) =>
        `${n.padEnd(12)} ${m.rockCells} rock cells · ${m.cliffs} cliffs · load ${(m.loadMs / 1000).toFixed(1)} s` +
        ` · hooks: rockReset ${m.rockReset ? "yes" : "no"}, rockGround ${m.rockGround ? "yes" : "no"}, rockDrawnAt ${m.rockDrawnAt ? "yes" : "no"}`,
    ),
    "",
    ...rows.map(([id, r]) => `${id.padEnd(26)} ${line(r)}`),
    ...Object.entries(result.scenes)
      .filter(([, r]) => !r.cost)
      .map(([id, r]) => `${id.padEnd(26)} ${r.note}`),
    ...(t
      ? [
          "",
          `MEAN over ${t.scenes} scenes: rock ${t.rockCalls.toFixed(1)} calls, ${(t.rockTriangles / 1000).toFixed(1)}k tris (worst ${(t.worstTriangles / 1000).toFixed(1)}k), ` +
            `${t.rockMs.toFixed(0)} ms of a ${t.frameMs.toFixed(0)} ms frame` +
            (t.groundMs !== null ? `, ground ${t.groundMs.toFixed(0)} ms` : "") +
            (t.groundRockMs !== null ? `, ground rock ${t.groundRockMs.toFixed(0)} ms` : "") +
            `, ${t.worldMs.toFixed(2)} ms of the world's CPU, settle ${t.settleMs.toFixed(0)} ms, ` +
            `held ${(t.heldTriangles / 1000).toFixed(1)}k tris ${(t.heldBytes / 1048576).toFixed(2)} MB`,
          `PHYSICS GAP: 250 m mean ${t.gapMean !== null ? cm(t.gapMean) : "n/a"} cm, worst p95 ${t.gapP95 !== null ? cm(t.gapP95) : "n/a"} cm; ` +
            `within 50 m worst p95 ${t.gapNearP95 !== null ? cm(t.gapNearP95) : "n/a"} cm, worst ${t.gapNearWorst !== null ? cm(t.gapNearWorst) : "n/a"} cm`,
        ]
      : []),
    ...(Object.keys(sh).length
      ? [
          `SHIMMER ${Object.entries(sh)
            .map(([k, v]) => `${k} ${fx(v)}`)
            .join(", ")} (×1000, settled first)`,
        ]
      : []),
    ...(result.approach
      ? [
          `APPROACH 800→20 m: median ${fx(result.approach.median)}, worst ${fx(result.approach.worst)} at ${result.approach.at} m, pop ${fx(result.approach.pop, 1)}×`,
        ]
      : []),
    ...(result.flicker
      ? [
          `FLICKER (make shimmer, seed ${result.flicker.seed} ${result.flicker.grade}): ` +
            result.flicker.rows
              .map(
                (r) => `${r.shot} ${fx(r.flicker)} (hot ${fx(r.hot)} %, crag ${fx(r.crag, 1)} %)`,
              )
              .join(", "),
        ]
      : []),
    ...(o
      ? [
          `ORDER CHECK ${o.scene}: read first and again after ${o.between.join(", ")} — picture change ${fx(o.change, 3)} (0..255), ` +
            `rock in view ${o.rockTriangles.join(" → ")} tris, held ${o.heldTriangles.join(" → ")} tris; ` +
            `shimmer first ${fx(o.shimmerFirst)} / last ${fx(o.shimmerLast)} (settled) — round 1's way, unsettled after ${o.between.at(-1)}: ${fx(o.shimmerUnsettled)}`,
        ]
      : []),
  ].join("\n");
}

/** This run beside one written before, line by line. */
export function compare(before, result) {
  const out = [
    "",
    "BEFORE → AFTER (rock calls, rock k tris, rock ms, ground ms, gap p95 cm, near p95 cm)",
  ];
  const f = (r) => [
    r.cost.calls - r.cost.callsBare,
    (r.cost.triangles - r.cost.trianglesBare) / 1000,
    r.cost.ms - r.cost.msBare,
    groundMs(r.cost),
    r.gap ? r.gap.p95 * 100 : null,
    r.gap?.near ? r.gap.near.p95 * 100 : null,
  ];
  const n = (v, d = 0, w = 5) => (v === null || Number.isNaN(v) ? "n/a" : v.toFixed(d)).padStart(w);
  for (const [id, r] of Object.entries(result.scenes)) {
    const b = before.scenes?.[id];
    if (!b?.cost || !r.cost) continue;
    const [bc, bt, bm, bg, bp, bn] = f(b);
    const [ac, at, am, ag, ap, an] = f(r);
    out.push(
      `${id.padEnd(26)} ${n(bc, 0, 3)} → ${n(ac, 0, 3)}  ${n(bt, 1)} → ${n(at, 1)}  ${n(bm)} → ${n(am)}  ` +
        `${n(bg)} → ${n(ag)}  ${n(bp, 0, 4)} → ${n(ap, 0, 4)}  ${n(bn, 0, 4)} → ${n(an, 0, 4)}`,
    );
  }
  const bt = before.totals;
  const t = result.totals;
  if (bt && t)
    out.push(
      `MEAN${" ".repeat(22)} ${n(bt.rockCalls, 1, 4)} → ${n(t.rockCalls, 1, 4)}  ${n(bt.rockTriangles / 1000, 1)} → ${n(t.rockTriangles / 1000, 1)}  ` +
        `${n(bt.rockMs)} → ${n(t.rockMs)}  ${n(bt.groundMs ?? null)} → ${n(t.groundMs)}  frame ${n(bt.frameMs, 0, 0)} → ${n(t.frameMs, 0, 0)} ms  ` +
        `settle ${n(bt.settleMs, 0, 0)} → ${n(t.settleMs, 0, 0)} ms  held ${n(bt.heldBytes / 1048576, 2, 0)} → ${n(t.heldBytes / 1048576, 2, 0)} MB`,
    );
  for (const [k, v] of Object.entries(result.shimmer ?? {}))
    out.push(`shimmer ${k} ${fx(before.shimmer?.[k])} → ${fx(v)}`);
  for (const r of result.flicker?.rows ?? []) {
    const b = before.flicker?.rows?.find((x) => x.shot === r.shot);
    out.push(`flicker ${r.shot} ${fx(b?.flicker)} → ${fx(r.flicker)}`);
  }
  if (result.approach)
    out.push(
      `pop ${fx(before.approach?.pop, 1)}× → ${fx(result.approach.pop, 1)}×  (median ${fx(before.approach?.median)} → ${fx(result.approach.median)})`,
    );
  return out.join("\n");
}

const STYLE = `body{margin:0;background:#11161b;color:#dde;font:12px/1.35 monospace;padding:10px}
nav a{color:#7cf;margin-right:12px}h2{margin:18px 0 6px;font-size:14px;color:#fff}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:10px}
figure{margin:0}img{width:100%;display:block}img.ref{margin-top:4px}
figure.wide{grid-column:1/-1}svg{width:100%;height:90px;background:#0b0f13}
pre{white-space:pre-wrap}figcaption{color:#bcc}`;

/** One scene's card. */
function card(id, r, ext, refs) {
  const scene = id.split("-").slice(1).join("-");
  const mine = refs.filter((f) => f.startsWith(`${id}`) || f.startsWith(`${scene}`));
  const img = r.note === "none on this map" ? "" : `<img src="${esc(id)}.${ext}">`;
  return `<figure id="${esc(id)}">${img}<figcaption><b>${esc(id)}</b> · ${esc(r.note)}<br>${esc(caption(r))}</figcaption>${mine.map((f) => `<img class="ref" src="refs/${esc(f)}">`).join("")}</figure>`;
}

/** The approach's curve. */
function curve(a) {
  if (!a) return "";
  return `<figure class="wide"><svg viewBox="0 0 ${a.steps.length} 100" preserveAspectRatio="none"><polyline fill="none" stroke="#7cf" stroke-width="0.6" vector-effect="non-scaling-stroke" points="${a.steps
    .map((v, i) => `${i},${100 - (100 * v) / (a.worst || 1)}`)
    .join(
      " ",
    )}"/></svg><figcaption><b>approach</b> 800 m → 20 m at the rockiest face, each 10 m step's change off the last (a spike is a pop): median ${fx(a.median)}, worst ${fx(a.worst)} at ${a.at} m, pop ${fx(a.pop, 1)}×</figcaption></figure>`;
}

/** The two index pages: by group (`index.html`) and by scene
 * (`scenes.html`), each with the table on top. */
export function pages(result, text, ext, refs, groups) {
  const ids = Object.keys(result.scenes);
  const nav = `<nav><a href="index.html">by group</a><a href="scenes.html">by scene</a>${result.flicker ? `<a href="${esc(result.flicker.sheet)}">flicker sheet</a>` : ""}</nav>`;
  const head = `<!doctype html><meta charset="utf-8"><title>Rock eval</title><style>${STYLE}</style>${nav}<pre>${esc(text)}</pre>`;
  const byGroup = groups
    .map((g) => {
      const mine = ids.filter((id) => id.startsWith(`${g}-`));
      if (!mine.length) return "";
      return `<h2>${esc(g)} · ${esc(result.groupNotes?.[g] ?? "")}</h2><div class="row">${mine.map((id) => card(id, result.scenes[id], ext, refs)).join("")}${g === "alpine" ? curve(result.approach) : ""}</div>`;
    })
    .join("\n");
  const sceneNames = [];
  for (const id of ids) {
    const g = groups.find((x) => id.startsWith(`${x}-`));
    const s = g ? id.slice(g.length + 1) : id;
    if (!sceneNames.includes(s)) sceneNames.push(s);
  }
  const byScene = sceneNames
    .map((s) => {
      const mine = ids.filter((id) => groups.some((g) => id === `${g}-${s}`));
      return `<h2>${esc(s)}</h2><div class="row">${mine.map((id) => card(id, result.scenes[id], ext, refs)).join("")}</div>`;
    })
    .join("\n");
  const flick = result.flicker
    ? `<h2>flicker (make shimmer)</h2><img src="${esc(result.flicker.sheet)}" style="max-width:100%">`
    : "";
  return {
    "index.html": `${head}${byGroup}${flick}`,
    "scenes.html": `${head}${byScene}${curve(result.approach)}${flick}`,
  };
}
