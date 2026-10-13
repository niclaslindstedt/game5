// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/** WHAT THE SPRAY COST LAST FRAME — the snow eval lab's readout, written by
 * whichever spray the renderer flies (`spray.ts`, `gpu-spray.ts`): its own
 * CPU work in `update`, ms; the grains and clumps in the air; and the bytes
 * it sent the GPU. */
export const SPRAY_STATS = {
  updateMs: 0,
  live: 0,
  bytes: 0,
  /** Whether the GPU spray counts its live particles (a loop over the
   * ring the game itself never pays for). */
  count: false,
};
