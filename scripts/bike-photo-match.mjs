#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PHOTO-MATCH SCORE (`make bike-photo`): how close the downhill rider
// on his bike comes to the riders in the reference photographs, clip by
// clip. Every clip of `pwa/src/tools/bike-clips.ts` is ridden on the real
// engine (the same windows `make bike-motion` measures) and the game's own
// pose of him is read every frame (`skier-bike.ts`'s `riderPoints`) into
// the figures the photographs were traced into (`bike-photo-refs.ts`): the
// knees, the elbows, the trunk, the hips over and behind the cranks, the
// hips' travel, the deepest knee, the bike's turn and lean at a trick's
// peak. Each figure's miss is read in its tolerance (a figure one
// tolerance off reads wrong at chase range), capped at 3; a clip's SCORE
// is the mean of its misses and its MATCH the share of figures inside
// one tolerance. Lower scores, higher matches.
//
//   node scripts/bike-photo-match.mjs                   every clip
//   node scripts/bike-photo-match.mjs --before          the pose with no
//                                                       photographs' track
//   node scripts/bike-photo-match.mjs --clip=jump,whip  those clips
//   node scripts/bike-photo-match.mjs --json=a.json     the table as JSON

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    clip: { kind: "string", default: "", help: "the clips, by id; every one traced when left out" },
    before: { kind: "flag", help: "score the pose with the photographs' track taken off" },
    json: { kind: "string", default: "", help: "write the table out as JSON" },
  },
  "usage: node scripts/bike-photo-match.mjs [--clip=a,b] [--before] [--json=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const C = await import(join(root, "pwa/src/tools/bike-clips.ts"));
const SB = await import(join(root, "pwa/src/game/skier-bike.ts"));
const BL = await import(join(root, "pwa/src/game/bike-look.ts"));
const ST = await import(join(root, "pwa/src/game/bike-ride-style.ts"));
const REF = await import(join(root, "pwa/src/tools/bike-photo-refs.ts"));

const R = E.RAGDOLL;
const DEG = 180 / Math.PI;
const want = args.clip
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ids = Object.keys(REF.PHOTO_REFS).filter((id) => !want.length || want.includes(id));

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a) => Math.hypot(a.x, a.y, a.z);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const angle = (a, b, c) => {
  const u = sub(a, b);
  const w = sub(c, b);
  const d = (u.x * w.x + u.y * w.y + u.z * w.z) / (len(u) * len(w) || 1);
  return Math.acos(Math.max(-1, Math.min(1, d))) * DEG;
};
const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const pct = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const rows = [];
for (const id of ids) {
  const clip = C.CLIPS.find((c) => c.id === id);
  const win = clip && C.clipWindow(clip);
  if (!win) continue;
  const f = { knee: [], elbow: [], trunk: [], hips: [], back: [], yaw: [0], roll: [0] };
  await C.rideClip(clip, win, (s) => {
    const b = s.bike;
    if (!b.onIt || s.skier.thrown || b.mode !== "ridden") return;
    const pose = E.bikePose(b);
    const style = ST.rideStyleOf(b, s.level, s.t);
    if (args.before) delete style.shown;
    const p = SB.riderPoints(pose, style);
    const at = (i) => ({ x: p[3 * i], y: p[3 * i + 1], z: p[3 * i + 2] });
    const bb = BL.bracketFromRider(pose);
    const hip = mid(at(R.hipL), at(R.hipR));
    const neck = mid(at(R.shoulderL), at(R.shoulderR));
    const spine = sub(neck, hip);
    const out =
      (style.shown?.footOut ?? style.footOut) > 0.2 ? (style.shown?.foot ?? style.foot) : -1;
    [
      [R.hipL, R.kneeL, R.footL],
      [R.hipR, R.kneeR, R.footR],
    ].forEach(([h, k, a], i) => {
      if (i !== out) f.knee.push(angle(at(h), at(k), at(a)));
    });
    f.elbow.push(angle(at(R.shoulderL), at(R.elbowL), at(R.handL)));
    f.elbow.push(angle(at(R.shoulderR), at(R.elbowR), at(R.handR)));
    f.trunk.push(Math.atan2(spine.z, spine.y) * DEG);
    f.hips.push((hip.y - bb.y) * 100);
    f.back.push((bb.z - hip.z) * 100);
    f.yaw.push(Math.abs(style.yaw) * DEG);
    f.roll.push(Math.abs(style.roll) * DEG);
  });
  const game = {
    knee: median(f.knee),
    elbow: median(f.elbow),
    trunk: median(f.trunk),
    hips: median(f.hips),
    back: median(f.back),
    travel: f.hips.length ? Math.max(...f.hips) - Math.min(...f.hips) : NaN,
    least: pct(f.knee, 0.05),
    yaw: Math.max(...f.yaw),
    roll: Math.max(...f.roll),
  };
  const ref = REF.PHOTO_REFS[id];
  const misses = {};
  for (const [k, tol] of Object.entries(REF.PHOTO_TOLERANCE)) {
    if (ref[k] === undefined || !Number.isFinite(game[k])) continue;
    misses[k] = Math.min(3, Math.abs(game[k] - ref[k]) / tol);
  }
  const m = Object.values(misses);
  rows.push({
    id,
    game,
    ref,
    misses,
    score: m.reduce((a, x) => a + x, 0) / (m.length || 1),
    match: m.filter((x) => x <= 1).length / (m.length || 1),
  });
}

const pad = (s, n) => String(s).padStart(n);
const fig = (g, r) => (r === undefined ? pad("·", 11) : pad(`${Math.round(g)}/${r}`, 11));
const keys = Object.keys(REF.PHOTO_TOLERANCE);
console.log(
  `bike photo-match · ${args.before ? "BEFORE (no photographs' track)" : "the photographs' track"} · game/reference\n`,
);
console.log(`clip     ${keys.map((k) => pad(k, 11)).join("")}    score  match`);
for (const r of rows)
  console.log(
    `${r.id.padEnd(8)} ${keys.map((k) => fig(r.game[k], r.ref[k])).join("")}    ${r.score.toFixed(2).padStart(5)}  ${pad(Math.round(r.match * 100) + "%", 5)}`,
  );
const all = rows.flatMap((r) => Object.values(r.misses));
const score = all.reduce((a, x) => a + x, 0) / (all.length || 1);
const match = all.filter((x) => x <= 1).length / (all.length || 1);
console.log(
  `\nall      ${pad("", 11 * keys.length)}    ${score.toFixed(2).padStart(5)}  ${pad(Math.round(match * 100) + "%", 5)}`,
);
console.log(
  `tolerance: ${Object.entries(REF.PHOTO_TOLERANCE)
    .map(([k, v]) => `${k} ${v}`)
    .join("  ")} · a miss is capped at 3 tolerances`,
);
if (args.json) {
  mkdirSync(dirname(resolve(root, args.json)), { recursive: true });
  writeFileSync(resolve(root, args.json), JSON.stringify({ rows, score, match }, null, 1));
}
