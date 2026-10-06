// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FRONT DOOR'S PAGES — every card behind the front door, routed off the
// page that is up (`MenuPage`): the race card and the cards a pinned map is
// picked on, the skis and dress cards, the free ride's start card, the
// gallery, the developer's pages, OPTIONS and its KEYS. One component so
// `App.tsx` routes them with one element: which card is up is the page, and
// what each press does is the app's, handed in.

import type { GameMode, SkiId } from "@engine";

import type { CampaignApp } from "./campaign-app.ts";
import { frontDoorPins } from "./campaign.ts";
import type { DevApp } from "./dev-app.tsx";
import { DevPages } from "./menu-dev.tsx";
import { SkisCards } from "./menu-dress.tsx";
import { GalleryPage } from "./menu-gallery.tsx";
import { KeysPage } from "./menu-keys.tsx";
import { OptionsPage } from "./menu-options.tsx";
import { PinnedCards } from "./menu-pinned.tsx";
import { RacesPage } from "./menu-races.tsx";
import { FreestylePage } from "./menu-freestyle.tsx";
import { StartPage } from "./menu-start.tsx";
import { skisBack } from "./pinned-run.ts";
import type { RecordKey, RunRecord } from "./records.ts";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";
import { nextFreeSeed } from "./free-ride.ts";
import type { MenuPage } from "./url-params.ts";

export function MenuPages(p: {
  page: Exclude<MenuPage, "root">;
  setPage: (page: MenuPage) => void;
  /** The mode the cards are for: whichever tile opened them. */
  mode: GameMode;
  settings: Settings;
  setSettings: (next: Settings | ((s: Settings) => Settings)) => void;
  skis: SkiId;
  campaign: CampaignApp;
  standing: (key: RecordKey) => RunRecord | null;
  /** The seed a link pinned, or null. */
  linkSeed: number | null;
  /** The map the start card stands on. */
  startSeed: number;
  dev: DevApp;
  keys: boolean;
  touch: boolean;
  onLinkSkis: () => void;
  /** RIDE on the skis card: onto the snow in the mode the cards are for. */
  onRide: () => void;
  onFreeRide: () => void;
}) {
  const { page, setPage, settings, setSettings, campaign } = p;
  const back = (): void => setPage("root");
  if (page === "races") {
    const pins = frontDoorPins(campaign.progress, settings, p.linkSeed);
    const seedLine = p.linkSeed === null ? null : STRINGS.menuRaceSeed(p.linkSeed);
    return (
      <div class="menu">
        <RacesPage
          maps={{
            slalom: seedLine ?? pins.raceMap ?? undefined,
            superG: seedLine ?? pins.superGMap ?? undefined,
            giantSlalom: seedLine ?? pins.giantSlalomMap ?? undefined,
            downhill: seedLine ?? pins.downhillMap ?? undefined,
            speedSki: seedLine ?? pins.speedSkiMap ?? undefined,
            skiCross: seedLine ?? pins.skiCrossMap ?? undefined,
          }}
          chosen={p.mode}
          onBack={back}
          onPick={(mode) => campaign.openCard(mode, p.linkSeed === null ? "levels" : "skis")}
        />
      </div>
    );
  }
  if (page === "freestyle") {
    return (
      <div class="menu">
        <FreestylePage
          chosen={p.mode}
          onBack={back}
          onPick={(mode) => campaign.openCard(mode, p.linkSeed === null ? "tricks" : "skis")}
        />
      </div>
    );
  }
  // A race's level card goes back to the race card, the trick map card to
  // the tricks card.
  const race =
    p.mode === "slalom" ||
    p.mode === "superG" ||
    p.mode === "giantSlalom" ||
    p.mode === "downhill" ||
    p.mode === "speedSki" ||
    p.mode === "skiCross";
  return (
    <div class="menu">
      {page === "campaign" || page === "levels" || page === "tricks" ? (
        <PinnedCards
          page={page}
          mode={p.mode}
          settings={settings}
          skis={p.skis}
          progress={campaign.progress}
          standing={p.standing}
          onBack={() =>
            setPage(page === "levels" && race ? "races" : page === "tricks" ? "freestyle" : "root")
          }
          onChoose={campaign.choose}
          onTrick={campaign.chooseTrick}
        />
      ) : page === "skis" || page === "dress" ? (
        <SkisCards
          page={page}
          skis={p.skis}
          settings={settings}
          onSettings={setSettings}
          onLink={p.onLinkSkis}
          onPage={setPage}
          onBack={() => {
            const to = skisBack(campaign.rung.current, p.mode, p.linkSeed);
            const trick =
              p.mode === "tricks" ||
              p.mode === "bigAir" ||
              p.mode === "knuckleHuck" ||
              p.mode === "slopestyle" ||
              p.mode === "railJam" ||
              p.mode === "halfpipe" ||
              p.mode === "moguls" ||
              p.mode === "dualMoguls";
            setPage(to === "root" && race ? "races" : to === "root" && trick ? "freestyle" : to);
          }}
          onRide={p.mode === "free" ? p.onFreeRide : p.onRide}
        />
      ) : page === "start" ? (
        <StartPage
          settings={settings}
          seed={p.startSeed}
          onSettings={setSettings}
          onReroll={() =>
            setSettings((s) => ({
              ...s,
              ride: { ...s.ride, seed: nextFreeSeed(p.startSeed), spot: null },
            }))
          }
          onBack={back}
          onNext={() => setPage("skis")}
        />
      ) : page === "gallery" ? (
        <GalleryPage onBack={back} />
      ) : page === "dev" || page === "unlocks" || page === "benchHistory" ? (
        <DevPages
          page={page}
          settings={settings}
          progress={campaign.progress}
          repro={() => p.dev.rig.current?.repro() ?? ""}
          onSettings={setSettings}
          onProgress={campaign.setProgress}
          onPage={setPage}
          onBack={back}
          onBenchmark={() => p.dev.rig.current?.startBench()}
        />
      ) : page === "options" ? (
        <OptionsPage
          settings={settings}
          keys={p.keys}
          touch={p.touch}
          onSettings={setSettings}
          onBack={back}
          onKeys={() => setPage("keys")}
        />
      ) : (
        <KeysPage settings={settings} onSettings={setSettings} onBack={() => setPage("options")} />
      )}
    </div>
  );
}
