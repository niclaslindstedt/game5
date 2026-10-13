// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44, R45 — THE BIKE PARK, held on the finished map: read off what the
// park publishes (`Level.bikePark`: its trails' stations, widths and
// features, its aprons) and the ground the map answers with, never off the
// walk that laid it. Every number is the rule book's (`BIKE_PARK_RULES`);
// nothing here is shared with the generator but that.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { BIKE_PARK_RULES as B } from "../mapgen/bike-park-rules.ts";
import type { BikeFeature, BikeTrail } from "../mapgen/bike-park-types.ts";
import type { Level } from "../mapgen/types.ts";
import type { Finding, Severity } from "./index.ts";

/** A trail's measures as the analyzer reads them. */
export type TrailMeasure = {
  id: string;
  grade: string;
  kind: "trail" | "race";
  length: number;
  vertical: number;
  /** The bench's mean grade (the race line's from its start), m/m. */
  mean: number;
  /** Its steepest over `pitch` m, m/m. */
  steepest: number;
  /** The most it rises over `climb.window` m, m. */
  climb: number;
  /** The deepest cut or highest fill at its centre line, m. */
  cut: number;
  /** Its narrowest and widest tread, m. */
  narrowest: number;
  widest: number;
  /** Its features by kind. */
  features: Record<string, number>;
  /** The share of its stations among trees. */
  woods: number;
};

export type BikeParkAnalysis = {
  ok: boolean;
  findings: Finding[];
  trails: TrailMeasure[];
};

const EPS = 1e-6;

/** THE PARK on `level` held to R44 and R45. A map with no park has no
 * findings. */
export function analyzeBikePark(level: Level): BikeParkAnalysis {
  const findings: Finding[] = [];
  const add = (rule: string, severity: Severity, message: string) =>
    findings.push({ rule, severity, message });
  const park = level.bikePark;
  if (!park) return { ok: true, findings, trails: [] };
  const lifts = park.base.resort?.lifts ?? [];
  const trails: TrailMeasure[] = [];
  const grades = new Set(park.trails.filter((t) => t.kind === "trail").map((t) => t.grade));
  for (const g of ["green", "blue", "red"] as const) {
    if (!grades.has(g)) add("R44", "warn", `the park carries no ${g} trail`);
  }
  if (park.trails.filter((t) => t.kind === "trail").length > B.park.most) {
    add("R44", "error", `${park.trails.length} trails (most ${B.park.most})`);
  }
  const trees = treeIndex(level);
  for (const t of park.trails) {
    const m = measure(t, trees);
    trails.push(m);
    const rule = t.kind === "race" ? "R45" : "R44";
    const row = B.grades[t.grade];
    const mean = t.kind === "race" ? B.race.mean : row.mean;
    const steepest = t.kind === "race" ? B.race.steepest : row.steepest;
    if (m.mean < mean[0] - EPS || m.mean > mean[1] + EPS) {
      add(rule, "error", `${t.id}: mean grade ${pc(m.mean)} outside ${pc(mean[0])}–${pc(mean[1])}`);
    }
    if (m.steepest > steepest + 1e-3)
      add(rule, "error", `${t.id}: ${pc(m.steepest)} over ${B.pitch} m (most ${pc(steepest)})`);
    if (m.climb > B.climb.most + EPS)
      add(rule, "error", `${t.id}: rises ${m.climb.toFixed(2)} m in ${B.climb.window} m`);
    if (m.cut > B.bench.most + EPS)
      add(rule, "error", `${t.id}: cut or filled ${m.cut.toFixed(1)} m`);
    const width = t.kind === "race" ? B.race.width : row.width;
    if (m.narrowest < width[0] - EPS || m.widest > width[1] * B.berm.widen + EPS) {
      add(
        rule,
        "error",
        `${t.id}: tread ${m.narrowest.toFixed(2)}–${m.widest.toFixed(2)} m (band ${width[0]}–${width[1]})`,
      );
    }
    if (t.kind === "race") {
      const from = t.points.find((p) => p.s >= t.start) ?? t.points[0];
      const v = from.y - t.points[t.points.length - 1].y;
      const len = t.length - from.s;
      if (v < B.race.vertical.least - EPS || v > B.race.vertical.most + EPS) {
        add(
          "R45",
          "error",
          `${t.id}: ${v.toFixed(0)} m from start to finish (band ${B.race.vertical.least}–${B.race.vertical.most})`,
        );
      }
      if (len < B.race.length[0] || len > B.race.length[1]) {
        add(
          "R45",
          "error",
          `${t.id}: ${len.toFixed(0)} m long (band ${B.race.length[0]}–${B.race.length[1]})`,
        );
      }
      const jump = t.features.find((f) => f.kind === "table" && f.from >= t.length - B.race.jump);
      if (!jump) add("R45", "warn", `${t.id}: no finish jump in its last ${B.race.jump} m`);
    }
    // REACHED FROM A TOP, and ENDING AT A BOTTOM.
    const head = t.points[0];
    const top = lifts.find((l) => l.id === t.lift);
    if (
      !top ||
      top.kind === "drag" ||
      hypot(top.top.x - head.x, top.top.z - head.z) > B.park.apron + 2
    ) {
      add(rule, "error", `${t.id}: its head is not on the apron of a lift that carries bikes`);
    }
    const tail = t.points[t.points.length - 1];
    const bottom = lifts.find((l) => l.id === t.end);
    if (
      !bottom ||
      hypot(bottom.bottom.x - tail.x, bottom.bottom.z - tail.z) >
        B.finish.ring + B.finish.within + 2
    ) {
      add(rule, "error", `${t.id}: it does not end beside a lift's bottom station`);
    }
    checkFeatures(t, add, rule);
    // NO TRUNK ON THE TREAD OR IN ITS FALL ZONE.
    const fall = t.kind === "race" ? 2 : row.fall;
    for (let i = 0; i < t.points.length; i += 2) {
      const p = t.points[i];
      for (const tr of trees.near(p.x, p.z)) {
        if (hypot(tr.x - p.x, tr.z - p.z) < p.width / 2 + Math.min(fall, 1) + tr.radius - 0.3) {
          add(rule, "error", `${t.id}: a trunk on its tread at ${p.s.toFixed(0)} m`);
          i = t.points.length;
          break;
        }
      }
    }
    // THE SURFACE IS THE TRAIL'S: the map answers with the bench where no
    // feature stands.
    const busy = (s: number) => t.features.some((f) => s >= f.from - 5 && s <= f.to + 5);
    for (let i = 20; i < t.points.length - 20; i += 37) {
      const p = t.points[i];
      if (busy(p.s)) continue;
      const y = level.groundAt(p.x, p.z);
      if (Math.abs(y - p.y) > 0.12) {
        add(
          rule,
          "error",
          `${t.id}: the ground at ${p.s.toFixed(0)} m stands ${(y - p.y).toFixed(2)} m off its bench`,
        );
        break;
      }
    }
  }
  return { ok: !findings.some((f) => f.severity === "error"), findings, trails };
}

const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

/** A trail measured off its stations. */
function measure(t: BikeTrail, trees: TreeIndex): TrailMeasure {
  const pts = t.points;
  const from = t.kind === "race" ? (pts.find((p) => p.s >= t.start) ?? pts[0]) : pts[0];
  const last = pts[pts.length - 1];
  let steepest = 0;
  let climb = 0;
  let cut = 0;
  let narrowest = Infinity;
  let widest = 0;
  let woods = 0;
  for (let i = 0, j = 0; i < pts.length; i++) {
    while (j < pts.length - 1 && pts[j].s - pts[i].s < B.pitch) j++;
    const ds = pts[j].s - pts[i].s;
    if (ds >= B.pitch * 0.9) steepest = Math.max(steepest, (pts[i].y - pts[j].y) / ds);
    for (let k = i + 1; k < pts.length && pts[k].s - pts[i].s <= B.climb.window; k++) {
      climb = Math.max(climb, pts[k].y - pts[i].y);
    }
    cut = Math.max(cut, Math.abs(pts[i].y - pts[i].ground));
    narrowest = Math.min(narrowest, pts[i].width);
    widest = Math.max(widest, pts[i].width);
    if (trees.dense(pts[i].x, pts[i].z)) woods++;
  }
  const features: Record<string, number> = {};
  for (const f of t.features) features[f.kind] = (features[f.kind] ?? 0) + 1;
  return {
    id: t.id,
    grade: t.grade,
    kind: t.kind,
    length: t.length,
    vertical: pts[0].y - last.y,
    mean: (from.y - last.y) / Math.max(1, last.s - from.s),
    steepest,
    climb,
    cut,
    narrowest,
    widest,
    features,
    woods: woods / pts.length,
  };
}

/** The features down a trail held to R44: none in its first or last
 * metres, none on another, each inside its grade's band, a jump's or a
 * drop's run-out clear of the next hard feature. */
function checkFeatures(
  t: BikeTrail,
  add: (r: string, s: Severity, m: string) => void,
  rule: string,
): void {
  const row = B.grades[t.grade];
  const hard = (f: BikeFeature) => f.kind !== "berm" && f.kind !== "roller" && f.kind !== "dip";
  const list = [...t.features].sort((a, b) => a.from - b.from);
  for (const f of list) {
    if (
      hard(f) &&
      (f.from < B.head - EPS || (t.kind !== "race" && f.to > t.length - B.tail + EPS))
    ) {
      add(rule, "error", `${f.id}: within the trail's first ${B.head} m or last ${B.tail} m`);
    }
    const band = sizeBand(t, f);
    if (band && (f.height < band[0] - EPS || f.height > band[1] + EPS)) {
      add(
        rule,
        "error",
        `${f.id}: ${f.kind} ${f.height.toFixed(2)} m (band ${band[0]}–${band[1]})`,
      );
    }
  }
  const hardOnes = list.filter(hard);
  for (let i = 0; i + 1 < hardOnes.length; i++) {
    const a = hardOnes[i];
    const b = hardOnes[i + 1];
    if (b.from < a.to - EPS) add(rule, "error", `${a.id} and ${b.id} overlap`);
    const jump =
      a.kind === "table" || a.kind === "gap" || a.kind === "drop" || a.kind === "stepdown";
    const line =
      (a.kind === "table" || a.kind === "gap") && (b.kind === "table" || b.kind === "gap");
    if (jump && !line && b.from < a.to + Math.min(row.runout * (a.to - a.from), 6) - EPS) {
      add(rule, "error", `${b.id} stands in ${a.id}'s run-out`);
    }
  }
  for (const f of list) {
    if (f.kind !== "berm") continue;
    for (const g of hardOnes)
      if (g.from < f.to && g.to > f.from) add(rule, "error", `${g.id} stands in the berm ${f.id}`);
  }
}

/** The band a feature's size is held to. */
function sizeBand(t: BikeTrail, f: BikeFeature): readonly [number, number] | null {
  const row = B.grades[t.grade];
  switch (f.kind) {
    case "berm":
      return row.berm.height;
    case "roller":
      return row.roller?.height ?? null;
    case "dip":
      return row.dip?.depth ?? null;
    case "table":
    case "gap":
      return row.table?.height ?? null;
    case "drop":
      return row.drop;
    case "stepdown":
      return row.step;
    case "rocks":
      return row.rocks?.height ?? null;
    case "roots":
      return row.roots?.height ?? null;
  }
}

type TreeIndex = {
  near(x: number, z: number): { x: number; z: number; radius: number }[];
  dense(x: number, z: number): boolean;
};

function treeIndex(level: Level): TreeIndex {
  const cells = new Map<number, { x: number; z: number; radius: number }[]>();
  const key = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
  for (const t of level.trees) {
    const k = key(Math.floor(t.x / 8), Math.floor(t.z / 8));
    let l = cells.get(k);
    if (!l) cells.set(k, (l = []));
    l.push(t);
  }
  return {
    near(x, z) {
      const out: { x: number; z: number; radius: number }[] = [];
      const ci = Math.floor(x / 8);
      const cj = Math.floor(z / 8);
      for (let j = cj - 1; j <= cj + 1; j++)
        for (let i = ci - 1; i <= ci + 1; i++) out.push(...(cells.get(key(i, j)) ?? []));
      return out;
    },
    dense(x, z) {
      return this.near(x, z).length >= 4;
    },
  };
}
