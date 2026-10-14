// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/** WHAT THE SPRAY COSTS — the snow eval lab's readout (`make snow-eval`'s
 * perf rows), written by whichever way the spray is flown (`spray.ts`'s CPU
 * pool, `gpu-spray.ts`'s ring) only while `on`: the CPU's own work in the
 * spray's emit and update, ms, and the bytes it sent the GPU, both summed
 * until the lab reads and zeroes them; and the grains in the air at the
 * last update. The game never turns it on. */
export const SPRAY_STATS = {
  on: false,
  cpuMs: 0,
  bytes: 0,
  live: 0,
};
