// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A RUN IS CALLED — every run of a ski area (R27) named, as the sign
// at its head and the news line that greets it read it. DOM-free and
// three-free, so the suite reads it.
//
// A NAME IS DEALT, NEVER DRAWN: each run's name is a pure function of the
// map (its seed, its region) and the run (its number, its colour, whether
// it is a lane, the lift it leaves), hashed here on a generator of its own
// — nothing reads `state.rng`, nothing reaches the engine, and no digest
// can see a name. The words and the forms they are put together in are the
// strings table's (`strings-run-names.ts`), in the voice of the country the
// map was built in, and a lane is always named as a way.
//
// NO TWO RUNS OF ONE AREA SHARE A NAME: the runs are named in the order
// the resort lists them, and a name already taken is dealt again off the
// next hash until a free one comes up.

import { regionOf, type Course, type Level, type Run } from "@engine";

import { RUN_NAMES, RUN_WORDS, type NameForm, type RegionNames } from "./strings-run-names.ts";

/** FNV-1a over a string, then a final avalanche — a well-spread 32-bit
 * hash of a run's key. */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** How many names a form can make. */
const sizeOf = (f: NameForm): number => f.heads.length * (f.tails?.length ?? 1);

/** The `n`th name a form can make. */
function nameAt(f: NameForm, n: number): string {
  if (!f.tails) return f.heads[n % f.heads.length];
  const head = f.heads[Math.floor(n / f.tails.length) % f.heads.length];
  const tail = f.tails[n % f.tails.length];
  return f.join ? f.join(head, tail) : `${head} ${tail}`;
}

/** The forms a run is named from: a lane's, or its colour's. */
function formsFor(voice: RegionNames, run: Run): readonly NameForm[] {
  return run.kind === "road" ? voice.lane : voice[run.grade];
}

/** Deal one run its name, clear of every name in `taken`. Every form's
 * names are one list, so a form with more names is dealt more often. A
 * taken name is walked past by a prime stride longer than any list, which
 * visits every name once; a list run dry falls back on the number. */
function dealName(level: Level, voice: RegionNames, run: Run, taken: Set<string>): string {
  const forms = formsFor(voice, run);
  const total = forms.reduce((n, f) => n + sizeOf(f), 0);
  const key = `${level.seed}|${regionOf(level).id}|${run.id}|${run.kind}|${run.grade}|${run.from}`;
  const start = hash(key);
  for (let k = 0; k < total; k++) {
    let n = (start + k * 7919) % total;
    let name = "";
    for (const f of forms) {
      const size = sizeOf(f);
      if (n < size) {
        name = nameAt(f, n);
        break;
      }
      n -= size;
    }
    if (name && !taken.has(name)) return name;
  }
  return `${forms[0].heads[0]} ${run.id}`;
}

const cache = new WeakMap<Level, ReadonlyMap<string, string>>();

/** Every run's name on `level`'s ski area, by run id — empty off a resort.
 * Built once per map. */
export function runNames(level: Level): ReadonlyMap<string, string> {
  const hit = cache.get(level);
  if (hit) return hit;
  const names = new Map<string, string>();
  const voice = RUN_NAMES[regionOf(level).id];
  const taken = new Set<string>();
  for (const run of level.resort?.runs ?? []) {
    const name = dealName(level, voice, run, taken);
    taken.add(name);
    names.set(run.id, name);
  }
  cache.set(level, names);
  return names;
}

const numbers = new WeakMap<Level, ReadonlyMap<string, string>>();

/** THE NUMBER EVERY RUN IS SIGNED WITH, by run id — the one a skier reads
 * on the piste map, on the sign at the run's head and in the news column.
 * The engine's id is a run's SLOT in the ski area's plan (R27): a slot
 * whose run was not laid leaves a hole, and the lanes laid after the
 * pistes carry on past the highest slot. So the pistes are numbered 1…P
 * in the plan's order, without a gap, and the lanes after them. Built once
 * per map; empty off a resort. */
export function runNumbers(level: Level): ReadonlyMap<string, string> {
  const hit = numbers.get(level);
  if (hit) return hit;
  const byId = (a: Run, b: Run): number => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);
  const runs = level.resort?.runs ?? [];
  const order = [
    ...runs.filter((r) => r.kind !== "road").sort(byId),
    ...runs.filter((r) => r.kind === "road").sort(byId),
  ];
  const out = new Map(order.map((r, i) => [r.id, String(i + 1)]));
  numbers.set(level, out);
  return out;
}

/** The number `run` is signed with. */
export function runNumber(level: Level, run: Run): string {
  return runNumbers(level).get(run.id) ?? run.id;
}

/** What `run` is called. */
export function runName(level: Level, run: Run): string {
  return runNames(level).get(run.id) ?? run.id;
}

/** The run of `level`'s ski area with this id, if there is one. */
export function runById(level: Level, id: string): Run | undefined {
  return level.resort?.runs.find((r) => r.id === id);
}

/** What a COURSE is called (R28): its first run's name, or the first's to
 * the last's when it chains runs — for a card or a plate that bills the
 * course raced. Null for an id the map does not carry. */
export function courseName(level: Level, courseId: string): string | null {
  const course: Course | undefined = level.resort?.courses.find((c) => c.id === courseId);
  if (!course || course.runs.length === 0) return null;
  const names = runNames(level);
  const first = names.get(course.runs[0]) ?? course.runs[0];
  if (course.runs.length === 1) return first;
  const lastId = course.runs[course.runs.length - 1];
  return RUN_WORDS.courseChain(first, names.get(lastId) ?? lastId);
}

/** The run's line as the news column reads it: its mark, its number and
 * its name — or a lane's mark and name, a lane carrying no number a skier
 * would use. */
export function runNewsText(level: Level, run: Run): string {
  const mark = RUN_WORDS.mark[run.grade];
  const name = runName(level, run);
  return run.kind === "road"
    ? RUN_WORDS.newsLane(mark, name)
    : RUN_WORDS.newsRun(mark, runNumber(level, run), name);
}
