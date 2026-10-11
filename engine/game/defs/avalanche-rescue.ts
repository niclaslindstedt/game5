// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEARCH AND THE PATROL's numbers (`avalanche-rescue.ts`): the others
// a slide takes (the crowd's amateurs, the night's keen skiers), the
// player's TRANSCEIVER switched to search, the PROBE that finds a body and
// the SHOVEL that digs him out, and the SKI PATROL that comes for whoever
// nobody else digs out — the player himself among them. Every number
// carries its unit and the research it is drawn from (`docs/avalanche.md`
// restates it); a number that is a dial for play says so. The survival
// clock's compression (`AVALANCHE.timeScale`, 30 ×) runs through all of it:
// a real minute is two seconds of play.

export const AVALANCHE_RESCUE = {
  /** THE TRANSCEIVER, on 457 kHz. `range` is how far off a buried unit is
   * heard, m: a digital unit picks a signal up at 40–70 m, and the usable
   * search strip is about half the receiving range either side. Inside
   * `range` it gives a DIRECTION along the field's flux line and a
   * DISTANCE; under `fine` m the arrow is dropped and the searcher
   * brackets for the lowest number with the unit on the snow (the fine
   * search starts at about 3 m); under `slow` m he slows down (a real
   * searcher does at about 10 m). `watch` is how near a burial the player
   * must be for his unit to switch itself to search — he saw it go (a
   * dial; a real party switches by hand at once). */
  beacon: { range: 50, fine: 3, slow: 10, watch: 220 },
  /** THE PROBE: a collapsible pole of 2.4–3.2 m pushed into the debris in a
   * spiral out from the lowest reading, 25 cm apart. A strike is a soft
   * give against the hard bottom. `reach` is how near the body a probe
   * must go in to strike it, m (a spiral of a few strokes 25 cm apart
   * covers about half a metre round its middle — a dial); `length` m;
   * `still` the fastest a skier may be going to probe, m/s (he takes his
   * skis off at about 3 m); `every` s between two probes (a stroke
   * assembled, pushed in and drawn back); the last `most` holes are kept. */
  probe: { reach: 0.6, length: 3, still: 1.5, every: 0.6, most: 24 },
  /** THE SHOVEL: STRATEGIC SHOVELLING starts DOWNHILL of the probe, 1–1.5 ×
   * the burial depth away (`downhill`), and digs in from the side.
   * Shovelling clears 13–25 cm of depth a minute (hard to soft debris),
   * and a lone rescuer reaches 1.5 m in about 18 minutes — about 8 cm a
   * minute; a team on a conveyor works at the top of the range. At the
   * clock's 30 ×: `rate` (one, m/s of play) and `team` (two on a conveyor).
   * `reach` is how near the probe a digger must stand, m, and `still` the
   * fastest he may be going, m/s. */
  dig: { reach: 3, still: 1.5, rate: 0.05, team: 0.1, downhill: 1.2 },
  /** THE PATROL: called the moment a burial is seen, a team of two arrives
   * after `respond` s of play, dealt between the two (a team on the
   * mountain reaches a slide inside the area in about 10–20 minutes — 20–40
   * s at 30 × — cut by a further 1.5 × for play, a dial: the whole rescue
   * then lands where the survival curve is falling, so a player buried
   * deep or unlucky dies and most come out alive), skiing in from `from` m up the slope off the slab's flank
   * at `speed` m/s to a stand-off `standoff` m short of the burial. Then
   * the coarse and fine search on foot (`search` s — a practised searcher
   * finds a lone burial in about three minutes, six seconds of play), the
   * probe spiral (`probe` s, a minute and a half), the dig at the team's rate, and `leave` s
   * standing by before they go on to the next or ski off. */
  patrol: {
    respond: [13, 27] as const,
    from: 160,
    speed: 11,
    standoff: 14,
    search: 6,
    probe: 3,
    leave: 25,
  },
  /** THE OTHERS A SLIDE TAKES: the burials remembered at once (the player's
   * and the others'), most — a dial that keeps the search's state a few
   * hundred bytes. */
  burials: 8,
} as const;
