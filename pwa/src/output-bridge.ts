// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Wires the engine's central output module (§19.4) into the app, so an
// engine diagnostic lands in one buffer the app can read back — the
// engine's account of a run sitting beside the app's, in order, for the
// crash-report block of §38.2. Dev builds also lift the line onto the
// console, which is the documented way to raise verbosity (§19.3).
//
// The buffer lives here for now, DOM-free: when the developer menu arrives
// it moves to `game/debug-log.ts` and this file only routes.

import { setDebugEnabled, setOutputSink, type OutputLevel } from "@engine";

/** How many lines are kept. A run is a couple of minutes and the engine
 * says something on every event rather than every step, so a few thousand
 * covers several runs — and caps what a report can dump into a chat. */
const CAP = 4000;

export type OutputEntry = {
  /** Milliseconds since the bridge connected — a wall clock is noise in a
   * diff, and what anybody reading this wants is the gap between lines. */
  at: number;
  level: OutputLevel;
  message: string;
};

const entries: OutputEntry[] = [];
let started = Date.now();

/** Everything the engine has said since the bridge connected, oldest first. */
export function recentOutput(): readonly OutputEntry[] {
  return entries;
}

export function connectOutput(): void {
  started = Date.now();
  entries.length = 0;
  setDebugEnabled(import.meta.env.DEV);
  setOutputSink((level: OutputLevel, message: string) => {
    entries.push({ at: Date.now() - started, level, message });
    if (entries.length > CAP) entries.shift();
    if (import.meta.env.DEV) {
      console.log(`[engine:${level}] ${message}`);
    }
  });
}
