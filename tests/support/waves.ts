// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES HELD BACK for a test about another part of the hunt (the
// helicopters, a squad set down): `WANTED.waves` emptied for the length of
// `fn` and put back as it was, so a column up the mountain neither crowds
// the snow nor counts among the soldiers that test reads.

import { WANTED } from "@engine";

export function withoutWaves<T>(fn: () => T): T {
  const rows = WANTED.waves as (typeof WANTED.waves)[number][];
  const kept = rows.slice();
  rows.fill(null);
  try {
    return fn();
  } finally {
    kept.forEach((r, i) => (rows[i] = r));
  }
}
