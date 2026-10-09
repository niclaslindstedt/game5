// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN ROW AND ITS CHART, as one answer — what the free ride's RUN row
// walks on a map, which stop it stands on, and what the chart under it marks.
// Asked by the two cards a run is picked on: the START CARD on the way onto
// the snow, and the pause card's PISTE MAP mid-ride (`menu-pause-slopes.tsx`),
// so a run is picked the same way on both and neither restates the other.

import { useSeedPreview, type SeedChart } from "./seed-preview.tsx";
import {
  AFTERSKI_RUN,
  BALLOON_RUN,
  HELI_RUN,
  PARA_RUN,
  SLED_RUN,
  afterskiOn,
  balloonOn,
  heliOn,
  markedRun,
  paraOn,
  sledOn,
  spotOn,
  type FreeRide,
  type FreeRunInfo,
} from "./free-ride.ts";
import { injuriesShown, type Settings } from "./settings.ts";
import { shellContent } from "../shell-host.ts";
import { STRINGS } from "./strings.ts";

/** What the chart marks a machine's start with, or null for a run's. */
export type RunMachine = "heli" | "sled" | "para" | "balloon" | "afterski";

export type RunPick = {
  chart: SeedChart;
  /** The RUN row's stops: the GRADE's colour's runs, then the machines. */
  stops: { id: string; label: string }[];
  /** The stop the row stands on ("" while the chart is still coming). */
  value: string;
  /** The run the ride starts down, or null on a machine or before the chart. */
  marked: FreeRunInfo | null;
  machine: RunMachine | null;
  /** Where on the chart the ride starts, where it was pressed. */
  spot: { x: number; z: number } | null;
};

export function useRunPick(settings: Settings, seed: number): RunPick {
  const ride: FreeRide = settings.ride;
  const chart = useSeedPreview(seed, ride.region, ride.grade, ride.face);
  // THE RUNS ON THIS MAP: a ski area's runs are the seed's and the
  // country's, whatever colour is asked of it, so the answer for another
  // grade still names them while the fresh one is drawn.
  const shown = chart.shown;
  const list =
    shown !== null &&
    shown.ok &&
    shown.seed === seed &&
    shown.region === ride.region &&
    (shown.face ?? null) === ride.face
      ? shown
      : null;
  // SAFE FOR WORK (the INJURIES switch off) the lodges are shut.
  const sfw = !injuriesShown(settings, shellContent());
  const machine: RunMachine | null = heliOn(ride, seed)
    ? "heli"
    : sledOn(ride, seed)
      ? "sled"
      : paraOn(ride, seed)
        ? "para"
        : balloonOn(ride, seed)
          ? "balloon"
          : !sfw && afterskiOn(ride, seed)
            ? "afterski"
            : null;
  const marked = list && machine === null ? markedRun(ride, seed, list) : null;
  // The RUN row walks the runs of the GRADE row's colour — every run where
  // it stands on AS DEALT, or where the map has none of the colour.
  const graded = list?.runs.filter((r) => r.grade === ride.grade) ?? [];
  const walked = graded.length > 0 ? graded : (list?.runs ?? []);
  // ...and, LAST, the ways up with no lift: the paramotor on the summit,
  // the snowmobile parked beside the village and the helicopter on its pad.
  const stops = [
    ...walked.map((r) => ({ id: r.id, label: STRINGS.startRunWord(r.number) })),
    ...(list
      ? [
          { id: PARA_RUN, label: STRINGS.startRunPara },
          { id: BALLOON_RUN, label: STRINGS.startRunBalloon },
          { id: SLED_RUN, label: STRINGS.startRunSled },
          { id: HELI_RUN, label: STRINGS.startRunHeli },
          // ...and the party in the valley's lodge, where the map has one.
          ...(list.machines.afterski && !sfw
            ? [{ id: AFTERSKI_RUN, label: STRINGS.startRunAfterski }]
            : []),
        ]
      : []),
  ];
  const value = machine === null ? (marked?.id ?? "") : MACHINE_RUN[machine];
  return {
    chart,
    stops,
    value,
    marked,
    machine,
    spot: machine === null ? spotOn(ride, seed) : null,
  };
}

/** The RUN row's stop each machine stands on. */
const MACHINE_RUN: Record<RunMachine, string> = {
  heli: HELI_RUN,
  sled: SLED_RUN,
  para: PARA_RUN,
  balloon: BALLOON_RUN,
  afterski: AFTERSKI_RUN,
};
