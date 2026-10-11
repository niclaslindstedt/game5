// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE SEARCH AND THE PATROL (`avalanche-rescue.ts`) — a block
// of the one strings table (`strings.ts`, §39.1), stated next door and
// spread into `STRINGS` under the same names: the transceiver's face
// (`hud-beacon.tsx`), its two keys and touch presses, the view from under
// the snow, and the news a search earns.

export const AVALANCHE_STRINGS = {
  /* ── THE KEYS (OPTIONS ▸ KEYS) ─────────────────────────────────────── */
  keyBeacon: "TRANSCEIVER SEND / SEARCH",
  keyRescue: "PROBE / DIG",

  /* ── THE TRANSCEIVER (hud-beacon.tsx) ──────────────────────────────── */
  beaconSend: "SEND",
  beaconSearch: "SEARCH",
  beaconNoSignal: "NO SIGNAL",
  beaconMetres: (m: number): string => (m < 10 ? m.toFixed(1) : `${Math.round(m)}`),
  beaconUnit: "M",
  beaconSlow: "SLOW DOWN · UNIT TO THE SNOW",
  beaconStop: "STOP · LOWEST NUMBER",
  beaconProbe: (key: string): string => `${key} PROBE`,
  beaconDig: (key: string): string => `HOLD ${key} DIG`,
  beaconDigging: "DIGGING",
  beaconStrike: "STRIKE",
  beaconSwitch: (key: string): string => `${key} SEND / SEARCH`,
  /** The touch presses. */
  touchBeacon: "BEACON",
  touchProbe: "PROBE",
  touchDig: "DIG",

  /* ── UNDER THE SNOW (hud-buried.tsx) ───────────────────────────────── */
  buriedAir: "AIR",
  buriedDepth: (m: number): string => `${m.toFixed(1)} M UNDER`,
  buriedWait: "THE PATROL IS CALLED",
  buriedComing: "THE PATROL IS COMING",
  buriedSearch: "THEY ARE SEARCHING",
  buriedProbe: "A PROBE IN THE SNOW",
  buriedDig: "THEY ARE DIGGING",

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsOtherCaught: "A SKIER TAKEN BY THE SLIDE!",
  newsOtherBuried: "SOMEONE BURIED — SEARCH!",
  newsOtherSurfaced: "A SKIER'S HEAD OUT OF THE DEBRIS",
  newsBeaconSearch: "TRANSCEIVER TO SEARCH",
  newsBeaconSend: "TRANSCEIVER TO SEND",
  newsStrike: "PROBE STRIKE!",
  newsDugAlive: "DUG OUT ALIVE!",
  newsDugDead: "DUG OUT — TOO LATE",
  newsPatrol: "SKI PATROL ON SCENE",
  newsPatrolYou: "THE PATROL HAS YOU — OUT!",
} as const;
