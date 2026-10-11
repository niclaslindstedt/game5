// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A MEDAL LOOKS LIKE — the gold, the silver and the bronze as every
// surface paints them: the HUD's chip and plate, the minimap's kicker
// stars, the pause card's list and the statistics' tally. One table, so a
// gold on the plate is the gold on the card. DOM-free.

import type { Medal } from "@engine";

/** Each medal's face (a light top to a deep foot, for the disc's
 * gradient), its rim and the ink a word in its colour is set in. */
export const MEDAL_LOOK: Record<Medal, { light: string; deep: string; rim: string; ink: string }> =
  {
    gold: { light: "#ffe88a", deep: "#d9a21b", rim: "#8a6208", ink: "#ffd447" },
    silver: { light: "#f4f6f8", deep: "#a9b2bc", rim: "#5d6670", ink: "#dfe5ea" },
    bronze: { light: "#f3c08f", deep: "#b4692d", rim: "#6e3a12", ink: "#e9a066" },
  };
