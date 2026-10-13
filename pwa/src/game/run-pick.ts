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
  WINGSUIT_RUN,
  SKIS_START,
  SUMMER_STARTS,
  seasonRide,
  summerOn,
  SLED_RUN,
  afterskiOn,
  balloonOn,
  heliOn,
  markedRun,
  paraOn,
  planeOn,
  wingsuitOn,
  sledOn,
  spotOn,
  startPicked,
  type FreeRide,
  type DealtDay,
  type FreeRunInfo,
} from "./free-ride.ts";
import { injuriesShown, type Settings } from "./settings.ts";
import { shellContent } from "../shell-host.ts";
import { STRINGS } from "./strings.ts";

/** What the chart marks a machine's start with, or null for a run's. */
export type RunMachine = "heli" | "sled" | "para" | "balloon" | "plane" | "wingsuit" | "afterski";

export type RunPick = {
  chart: SeedChart;
  /** The RUN row's stops: every run of the map, pistes and ski routes. */
  stops: { id: string; label: string }[];
  /** The run the RUN row stands on ("" while the chart is still coming,
   * and on a machine, which starts at no run). */
  value: string;
  /** The START row's stops: SLOPE, then the machines and the lodge. */
  starts: { id: string; label: string }[];
  /** The stop the START row stands on ("" while the chart is coming). */
  start: string;
  /** The run the ride starts down, or null on a machine or before the chart. */
  marked: FreeRunInfo | null;
  machine: RunMachine | null;
  /** Where on the chart the ride starts, where it was pressed. */
  spot: { x: number; z: number } | null;
  /** The day the map was dealt, once its chart is in. */
  dealt: DealtDay | null;
};

export function useRunPick(settings: Settings, seed: number): RunPick {
  // IN SUMMER a start that is not a way into the air stands on the
  // helicopter (`seasonRide`), as the ride is stood up.
  const ride: FreeRide = seasonRide(settings.ride, seed);
  const summer = summerOn(ride);
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
            : wingsuitOn(ride, seed)
              ? "wingsuit"
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
  // THE START ROW: SLOPE (skis or a snowboard, as the gear card picks),
  // by the lift to the run picked — or one of the ways
  // up with no lift: the paramotor on the summit, the balloon and the
  // snowmobile on the valley floor, the helicopter on its pad and the jump
  // plane on its strip below the village — or the wingsuit, no skis on,
  // off its exit high on the mountain.
  const all = [
    ...(list
      ? [
          { id: SKIS_START, label: STRINGS.startOnSlope },
          { id: PARA_RUN, label: STRINGS.startRunPara },
          { id: BALLOON_RUN, label: STRINGS.startRunBalloon },
          { id: SLED_RUN, label: STRINGS.startRunSled },
          { id: HELI_RUN, label: STRINGS.startRunHeli },
          { id: PLANE_RUN, label: STRINGS.startRunPlane },
          // ...and the wingsuit off its own exit high on the mountain.
          { id: WINGSUIT_RUN, label: STRINGS.startRunWingsuit },
          // ...and the party in the valley's lodge, where the map has one.
          ...(list.machines.afterski && !sfw
            ? [{ id: AFTERSKI_RUN, label: STRINGS.startRunAfterski }]
            : []),
        ]
      : []),
  ];
  // ...and in SUMMER only the ways into the air (`SUMMER_STARTS`): no snow
  // to ski, board or sled on, no lodge to start the night in.
  const starts = summer ? all.filter((s) => SUMMER_STARTS.includes(s.id)) : all;
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
    dealt: list?.dealt ?? null,
  };
}

/** THE START ROW PICKED on `seed`: the ride's own answer (`startPicked`);
 * the pair, skis or a board, is the gear card's to pick. */
export function startChosen(s: Settings, seed: number, id: string): Settings {
  return { ...s, ride: { ...s.ride, ...startPicked(s.ride, seed, id) } };
}

/** The RUN row's stop each machine stands on. */
const MACHINE_RUN: Record<RunMachine, string> = {
  heli: HELI_RUN,
  sled: SLED_RUN,
  para: PARA_RUN,
  balloon: BALLOON_RUN,
  plane: PLANE_RUN,
  wingsuit: WINGSUIT_RUN,
  afterski: AFTERSKI_RUN,
};
