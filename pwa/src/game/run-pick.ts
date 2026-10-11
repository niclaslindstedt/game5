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
  PLANE_RUN,
  SKIS_START,
  SLED_RUN,
  afterskiOn,
  balloonOn,
  heliOn,
  markedRun,
  paraOn,
  planeOn,
  sledOn,
  spotOn,
  type FreeRide,
  type FreeRunInfo,
} from "./free-ride.ts";
import { injuriesShown, type Settings } from "./settings.ts";
import { shellContent } from "../shell-host.ts";
import { STRINGS } from "./strings.ts";

/** What the chart marks a machine's start with, or null for a run's. */
export type RunMachine = "heli" | "sled" | "para" | "balloon" | "plane" | "afterski";

export type RunPick = {
  chart: SeedChart;
  /** The RUN row's stops: every run of the map, pistes and ski routes. */
  stops: { id: string; label: string }[];
  /** The run the RUN row stands on ("" while the chart is still coming,
   * and on a machine, which starts at no run). */
  value: string;
  /** The START row's stops: ON SKIS, then the machines and the lodge. */
  starts: { id: string; label: string }[];
  /** The stop the START row stands on ("" while the chart is coming). */
  start: string;
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
          : planeOn(ride, seed)
            ? "plane"
            : !sfw && afterskiOn(ride, seed)
              ? "afterski"
              : null;
  const marked = list && machine === null ? markedRun(ride, seed, list) : null;
  // The RUN row walks EVERY run of the map, whatever its colour: a slope
  // is all it ever names.
  const stops = (list?.runs ?? []).map((r) => ({
    id: r.id,
    label: STRINGS.startRunWord(r.number),
  }));
  // THE START ROW: on skis, by the lift to the run picked — or one of the
  // ways up with no lift: the paramotor on the summit, the balloon and the
  // snowmobile on the valley floor, the helicopter on its pad and the jump
  // plane on its strip below the village.
  const starts = [
    ...(list
      ? [
          { id: SKIS_START, label: STRINGS.startOnSkis },
          { id: PARA_RUN, label: STRINGS.startRunPara },
          { id: BALLOON_RUN, label: STRINGS.startRunBalloon },
          { id: SLED_RUN, label: STRINGS.startRunSled },
          { id: HELI_RUN, label: STRINGS.startRunHeli },
          { id: PLANE_RUN, label: STRINGS.startRunPlane },
          // ...and the party in the valley's lodge, where the map has one.
          ...(list.machines.afterski && !sfw
            ? [{ id: AFTERSKI_RUN, label: STRINGS.startRunAfterski }]
            : []),
        ]
      : []),
  ];
  const value = marked?.id ?? "";
  const start = list === null ? "" : machine === null ? SKIS_START : MACHINE_RUN[machine];
  return {
    chart,
    stops,
    value,
    starts,
    start,
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
  plane: PLANE_RUN,
  afterski: AFTERSKI_RUN,
};
