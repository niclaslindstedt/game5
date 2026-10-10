// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP: the shell the game lives inside, and the §37 clock underneath it.
//
// SEVEN SURFACES, ONE CANVAS, AND THE SNOW NEVER STOPS — except under the
// card standing over the PLAYER's own race, and under the BENCHMARK, whose
// pump turns it itself. `game/shell.ts` names every surface (the attract
// card, the front door and all its pages, the loading card, the pause card,
// the run, the replay and the bench) and owns what each means; this file
// decides when one gives way to the next. DEVELOPER's half is `dev-app.tsx`.
//
// ONE ENGINE STATE THROUGHOUT, and the surface decides who rides it:
// `botInput` under a card, the input manager under a run. Leaving a race
// for the front door hands the same skis back to the bot rather than
// tearing anything down, which is why the menu comes up over the map the
// player was just on. Until the first run the door stands over the TITLE
// SCENE instead (`title-app.tsx`), and no map is built. Under a card the camera is the slow ORBIT round the
// skis; over a run it is the rung the skier chose (`cameraFor`).
//
// THE RECORD BOOK AND THE GHOST (`ghost-run.ts`): every run the player
// rides is armed with a ticket — its seed, skis, mode and length — before
// its first step; every input the engine is handed passes `snapInput` on
// the way in, so what the book's tape writes down is what was ridden. The
// bot's race under a card is armed with nothing.
//
// THE PINNED MAPS (`pinned-run.ts`): a RACE rides a pinned map.
// THE REPLAY (`replay-run.ts`): every run the player rides is recorded, and WATCH REPLAY stands
// a copy up under the `replay` surface, setting the run aside and handing it back to the surface
// it was watched from (on the bar's way out, or at the end of the crash an instant replay shows).
//
// THE URL: every parameter the app reads is listed in `game/url-params.ts`.
// A URL that names a race (`start`, `shot`, `paused`) boots into one;
// anything else opens on the attract card or the front door.
//
// THE LOOP: `requestAnimationFrame` hands the clock (the framework's `loop/run-clock`) the wall
// time; the clock says how many fixed steps to take; each step samples the
// input (§37.1, once per step) and calls `step`. The renderer draws the
// state once per frame; the HUD is refreshed from a snapshot at ~12 Hz. A
// hidden tab pauses the clock (§37.3) and the HUD says so.
//
// THE RENDERER IS FETCHED, NOT BUNDLED (`use-render-kit.ts`): `game/renderer.ts` is the one
// import that reaches three.js, so it arrives as its own chunk behind the attract card, and all
// this file asks of it is `renderer-api.ts`'s — it draws a `GameState` and never writes one.
//
// THE SOUND AND THE MOTOR FOLLOW THE SAME RULE AS THE SNOW: fed every frame
// the engine steps — the beds ducked under a card, where the bot's race is
// scenery — and told to be quiet on every frame it does not, because a bed
// that is merely not fed holds its last note. The race's events make a
// noise and a pulse only with the player's feet on the skis: a gate
// the bot takes under the menu is not news.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  TUNING,
  botInput,
  createGame,
  error,
  placeRun,
  step,
  type CreateGameOptions,
  type GameMode,
  type GameState,
  type Level,
  type SkiSpec,
} from "@engine";

import { connectOutput } from "./output-bridge.ts";
import { onShellCommand, shellContent } from "./shell-host.ts";
import { createRunAudio, setAudioVolumes } from "./game/audio/index.ts";
import { watchCanvas } from "./game/app-canvas.ts";
import { createLoader, raceOrFallback } from "./game/app-load.ts";
import { buildMap, gameOrder } from "./game/map-build.ts";
import { isTraining } from "./game/downhill-run.ts";
import { NO_PRESSES, type Presses } from "./game/app-presses.ts";
import { pinnedFor, pinnedPress, type PinnedSkier } from "./game/pinned.ts";
import { raceMapsOf } from "./game/race-maps.ts";
import { carriesPoles } from "./game/outfit.ts";
import { mapPicks } from "./game/map-picks.ts";
import { isTrickRun, trickMapFor, tricksTile } from "./game/trick-maps.ts";
import { useCloudSync } from "./game/use-cloud-sync.ts";
import {
  FIRST_FREE_SEED,
  againAt,
  freeAgainOptions,
  type AgainAt,
  freeGameOptions,
  freeRestart,
  standingFor,
} from "./game/free-ride.ts";
import { freeRideLevel } from "./game/seed-maps.ts";
import { DevLayer, useDevApp } from "./game/dev-app.tsx";
import { snapInput } from "./game/ghost.ts";
import { heldRide } from "./game/hold-input.ts";
import { createRunBook, type RunBook, type RunTicket } from "./game/ghost-run.ts";
import { keepsRecords, runKey } from "./game/records.ts";
import { runRumble } from "./game/haptics.ts";
import { Hud, hasTouch, type HudFlash } from "./game/hud.tsx";
import { createHudLive, feedHudLive } from "./game/hud-live.ts";
import { deathOver } from "./game/hud-wreck.ts";
import { ResultPlate } from "./game/hud-result.tsx";
import { contestPlateUp } from "./game/contest-board.ts";
import { ReplayBar } from "./game/hud-replay.tsx";
import { createXrayRun, dying, xrayHud } from "./game/xray-run.ts";
import { createReplayRun, type ReplayBarFacts, type ReplayRun } from "./game/replay-run.ts";
import { prepareMinimap } from "./game/minimap.tsx";
import { createInputManager, type InputManager } from "./game/input.ts";
import { watchMachineTaps } from "./game/machine-tap.ts";
import { LoadingScreen } from "./game/loading-screen.tsx";
import { labProbe } from "./game/lab-probe.ts";
import { MainMenu } from "./game/menu-main.tsx";
import { useStats } from "./game/use-stats.ts";
import { MenuPages } from "./game/menu-pages.tsx";
import { createMenuNav, walkCardsOnKeys } from "./game/menu-nav.ts";
import { PauseMenu } from "./game/menu-pause.tsx";
import { createPinnedRuns, secondRunOff } from "./game/pinned-run.ts";
import type { WorldRenderer } from "./game/renderer-api.ts";
import { useRenderKit } from "./game/use-render-kit.ts";
import { createRunActions } from "./game/run-actions.ts";
import type { LoadPhase } from "./game/run-loader.ts";
import { createRunClock } from "@niclaslindstedt/oss-game-framework/loop/run-clock";
import { shotLabel } from "./game/run-news.ts";
import { createNewsFeed } from "./game/run-watch.ts";
import {
  assistOf,
  injuriesShown,
  loadSettings,
  mixOf,
  nextCamera,
  saveSettings,
  specFor,
  type Settings,
} from "./game/settings.ts";
import { withPreset, type VideoSettings } from "./game/settings-video.ts";
import { boundLabel } from "./game/settings-input.ts";
import {
  appDraws,
  cameraFor,
  canPause,
  hudOver,
  playerRides,
  simulates,
  soundsLive,
  watching,
  type Shell,
} from "./game/shell.ts";
import { useTitle } from "./game/title-app.tsx";
import { splashSkipped } from "./game/splash.ts";
import { readHudLayer } from "@niclaslindstedt/oss-game-framework/shots/shot-hud";
import { createShotRequest } from "./game/shot-request.ts";
import { takeSnapshot, type HudSnapshot } from "./game/snapshot.ts";
import { dealSeed, linkWorld, overLink, readParams, type MenuPage } from "./game/url-params.ts";
import { createPictureAuto } from "./game/picture-auto.ts";
import { UpdateButton } from "./game/update-button.tsx";
import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";

/** How often the HUD's readouts are refreshed, s. */
const HUD_TICK = 1 / 12;
/** How long a line stays in the news column, s. */
const FLASH_LIFE = 3.2;
/** The loading card's fade off the race; must match `.loading.leaving` in styles.css. */
const LOAD_FADE_MS = 260;
/** How much of the mix the bot's race gets under a card. */
const CARD_DUCK = 0.5;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params] = useState(() => readParams(location.search));
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [hudLive] = useState(createHudLive);
  const [flashes, setFlashes] = useState<HudFlash[]>([]);
  /** The TAB is away and the clock with it (§37.3) — not the pause card. */
  const [away, setAway] = useState(false);
  const [again, setAgain] = useState<AgainAt>("start");
  const [shell, setShell] = useState<Shell>(() =>
    params.rides
      ? params.paused
        ? "pause"
        : "run"
      : splashSkipped(location.search)
        ? "menu"
        : "splash",
  );
  const title = useTitle(params, shell);
  const [loadingPhase, setLoadingPhase] = useState<LoadPhase | null>(null);
  const [loadLeaving, setLoadLeaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  /** True once the race has drawn a frame (over the title: once booted) —
   * what the attract card waits on before it will take a press. */
  const [warm, setWarm] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    if (params.page === "dev") s.developer = true;
    return params.camera ? { ...s, camera: params.camera } : s;
  });
  /** Which page of the front door is up. */
  const [page, setPage] = useState<MenuPage>(params.page);
  /** A link's pair for this visit (`?skis=`), never written back — until
   * the skier picks one on the skis card, which is theirs to keep. */
  const [linkSkis, setLinkSkis] = useState(params.skis);
  const linkSkisRef = useRef(linkSkis);
  linkSkisRef.current = linkSkis;
  /** The pair the player skis, under his build (`specFor`). */
  const specOf = (s: Settings): SkiSpec => specFor(s, linkSkisRef.current);
  /** Who skis the player's runs, and with what: the pair, the help, the
   * switches, his poles (the DRESS card's, a link's `?poles=` over them). */
  const skierOf = (s: Settings): PinnedSkier => ({
    spec: specOf(s),
    assist: assistOf(s.assist),
    damage: s.damage,
    gore: injuriesShown(s, shellContent()),
    sfw: !injuriesShown(s, shellContent()), // SAFE FOR WORK (`RunRules.sfw`)
    poles: params.poles ?? carriesPoles(s.outfit),
  });
  /** The picture drawn: the stored one, or a lab's preset for this visit —
   * `?video=` is never written back. */
  const videoOf = (s: Settings): VideoSettings => ({
    ...(params.video ? withPreset(s.video, params.video) : s.video),
    ...params.picture,
  });
  /** THE SEED RACE WILL BUILD, shown on the tile. Pinned by `?seed=`; the
   * free ride's first mountain on a fresh visit — so the front door stands on
   * the map the start card opens on, and a free ride on it is stood up off
   * the ski area already built — and dealt fresh after every race stood up. */
  const [nextSeed, setNextSeed] = useState(() => params.seed ?? FIRST_FREE_SEED);
  /** THE MAP THE MENU IS STANDING OVER — what a tricks run a link pinned rides. */
  const [mapSeed, setMapSeed] = useState(nextSeed);
  /** The mode the skis card's RIDE is for: whichever tile opened it. */
  // (A link to the start card is a free ride on its way to the skis card.)
  const modeRef = useRef<GameMode>(params.page === "start" ? "free" : params.mode);
  /** The presses that route a card to the skis card (`map-picks.ts`). */
  const picks = mapPicks({ mode: modeRef, setPage, setSettings });
  const dev = useDevApp();
  const bookRef = useRef<RunBook | null>(null);
  const stats = useStats();
  useCloudSync({ settings, setSettings, book: bookRef, shell });
  const [input, setInput] = useState<InputManager | null>(null);
  /** The bar over a recording, and whether one (or the crash just taken) is
   * worth offering — refreshed on the HUD's tick, never per frame. */
  const [replayBar, setReplayBar] = useState<ReplayBarFacts | null>(null);
  const [canReplay, setCanReplay] = useState(false);
  const [crashReplay, setCrashReplay] = useState(false);
  const replayRef = useRef<ReplayRun | null>(null);
  const [touch] = useState(hasTouch);
  const [keys] = useState(
    () => typeof matchMedia === "undefined" || matchMedia("(pointer: fine)").matches,
  );

  const shellRef = useRef<Shell>(shell);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const nextSeedRef = useRef(nextSeed);
  nextSeedRef.current = nextSeed;
  const pressRef = useRef<Presses>(NO_PRESSES);
  /** The two flags the loop raises at most once a frame, as refs beside the
   * state, so the loop can ask "have I already said this?" without waiting
   * for a render to answer. */
  const warmRef = useRef(false);
  const awayRef = useRef(false);
  const rendererRef = useRef<WorldRenderer | null>(null);

  useEffect(() => saveSettings(settings), [settings]);
  // The switch reaches the bus the moment it moves; a layer reads the bus
  // every frame, so the engine under the card goes quiet with the press.
  const mix = mixOf(settings);
  useEffect(
    () => setAudioVolumes({ engine: mix.engine, effects: mix.effects }),
    [mix.engine, mix.effects],
  );
  const { keys: skiKeys, heliKeys } = settings;
  useEffect(() => input?.setBindings({ keys: skiKeys, heliKeys }), [input, skiKeys, heliKeys]);

  // THE RENDER STACK, FETCHED RATHER THAN BUNDLED (see the header).
  const renderKit = useRenderKit();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderKit) return;
    connectOutput();
    const manager = createInputManager(
      window,
      () => playerRides(shellRef.current),
      settingsRef.current.keys,
    );
    setInput(manager);
    const renderer = renderKit.createWorldRenderer(canvas, { video: videoOf(settingsRef.current) });
    rendererRef.current = renderer;
    manager.onLook((dx, dy) => renderer.lookAround(dx, dy));
    const book = createRunBook({ show: (ghost) => renderer.setGhost(ghost) });
    bookRef.current = book;
    const replays = (replayRef.current = createReplayRun({
      renderer,
      show: (s) => show(s),
      shell: () => shellRef.current,
      done: () => pressRef.current.unwatch(),
    }));
    const xray = createXrayRun(renderer.setXray, xrayHud, () => settingsRef.current);
    const audio = createRunAudio();
    const clock = createRunClock(TUNING.physicsHz);
    const nav = createMenuNav();

    /* ── WHICH MAP THE RENDERER HOLDS ───────────────────────────────────
       A map is built into the renderer asynchronously, and until it has
       been the renderer cannot draw a race on it — nor may that race be
       stepped, or its lights would count down under a card the player
       cannot see through. So every build goes through `build`, which
       remembers which level is standing; `drawable` is the one question the
       loop asks before it steps or draws. */
    let standing: Level | null = null;
    let wanted: Level | null = null;
    const build = (s: GameState): Promise<void> => {
      const level = s.level;
      // A new race on the map already standing needs nothing built: the
      // renderer sees a fresh state and starts its trails and spray clean.
      if (standing === level) return Promise.resolve();
      wanted = level;
      standing = null;
      prepareMinimap(level);
      return renderer.load(s).then(() => {
        if (wanted === level) standing = level;
      });
    };
    // The renderer's methods are closures, never `this`, so a copy with its
    // own `load` is the renderer with every build going through `build`.
    const view: WorldRenderer = { ...renderer, load: build };

    const raceSeed = params.seed ?? nextSeedRef.current;
    /** The options the free ride on the pause card's START AGAIN rides:
     * the last one stood up, on the map it was stood up on. */
    let freeAgain: CreateGameOptions | null = null;
    /** A free ride off the start card's answers — or, where the seed will
     * not build, the race fallback's map. */
    const freeBoot = (): GameState => {
      const s = settingsRef.current;
      const seed = params.seed ?? s.ride.seed ?? FIRST_FREE_SEED;
      const ride = freeGameOptions(s.ride, seed, skierOf(s));
      // A link's sky (`?weather=` / `?hour=`) and region over the card's.
      const opts = overLink(ride, params);
      try {
        const game = createGame(opts);
        freeAgain = freeAgainOptions(opts, game.level);
        return game;
      } catch (e) {
        error(`seed ${seed} would not build (${e instanceof Error ? e.message : String(e)})`);
        return raceOrFallback(1, { ...skierOf(s), mode: "slalom" });
      }
    };
    // A race a link boots into is the player's, with the player's help; the
    // one under the front door is the bot's, with every hand on.
    let state: GameState = params.free
      ? freeBoot()
      : raceOrFallback(
          raceSeed,
          params.rides ? { ...skierOf(settingsRef.current), mode: params.mode } : null,
          linkWorld(params),
        );
    // A link's SECOND RUN (`?run=2`): the first skied by the bot to its flag.
    if (params.rides && params.run === 2) state = secondRunOff(state);
    /** The mode the player's runs are ridden in, until a tile says otherwise. */
    let mode: GameMode = params.mode;
    /** The run the player is about to ski, in `mode`, on the pair they
     * picked and with the help they asked for — on this map, or a fresh one. */
    const playerGame = (level: Level | undefined, seed: number): GameState =>
      createGame({
        // A tricks run needs its map's trick field (R20): the race's won't do.
        level: mode === "tricks" && !level?.kickers?.some((k) => k.trick) ? undefined : level,
        seed,
        ...linkWorld(params),
        mode,
        training: mode === "downhill" ? true : undefined,
        ...skierOf(settingsRef.current),
      });
    /** What a player's run is filed under — nothing for a run the bot rides
     * from the line (`?bot=1`), which is nobody's time, nothing for a mode
     * that keeps no book (a free ride, `keepsRecords`), and nothing for a
     * downhill's training, which counts for nothing, or a ski cross's heat,
     * which is a race for places — its qualification is the timed run. */
    const ticketFor = (s: GameState): RunTicket | null =>
      params.bot || !keepsRecords(mode) || isTraining(s) || s.cross !== undefined
        ? null
        : { key: runKey(s, mode), assist: { ...s.assist } };
    const drawable = (): boolean => standing !== null && standing === state.level;
    let frozen = params.shot;
    let preroll = false;
    let ready = false;
    const live: { id: number; text: string; tone: HudFlash["tone"]; until: number }[] = [];
    let flashId = 0;
    const news = createNewsFeed();
    /** Every event the player's run has raised, by kind (`__SH_PROBE__`). */
    const tally: Record<string, number> = {};
    let hudClock = HUD_TICK;
    let wall = 0;
    /** THE SHUTTER (`shot-request.ts`): asked for at the press, served in the
     * frame loop right after the draw that filled the buffer. */
    const shots = createShotRequest({
      canvas: () => canvasRef.current,
      answers: () => hudOver(shellRef.current),
      label: () => shotLabel(state),
      hud: readHudLayer,
      say: (text, tone) => live.push({ id: flashId++, text, tone, until: wall + FLASH_LIFE }),
    });

    const setShellNow = (next: Shell): void => {
      shellRef.current = next;
      setShell(next);
      title.shellIs(next);
      renderer.setCamera(cameraFor(next, settingsRef.current.camera));
      hudClock = HUD_TICK; // the readouts at once, never a tick late
    };

    /** A state on screen as the one the loop steps, nothing armed (a replay's). */
    const show = (next: GameState): void => {
      state = next;
      live.length = 0;
      audio.reset();
      runRumble.reset();
    };
    /** A new race takes the engine, and all of the last one's goes with it. */
    const adopt = (next: GameState, ticket: RunTicket | null = null, rides = false): void => {
      show(next);
      manager.freshHand();
      book.arm(next, ticket);
      stats.rig.arm(next, mode);
      replays.arm(next, rides ? mode : null);
      setMapSeed(next.seed);
      for (const k of Object.keys(tally)) delete tally[k];
    };

    /** What this step is ridden on: the player's hands on a run, and the BOT
     * everywhere else — the race behind a card is still being raced — and
     * through a link's pre-roll, so a picture of a race is of one moving. */
    const inputFor = () =>
      preroll || params.bot || !playerRides(shellRef.current)
        ? botInput(state)
        : manager.ride(state);

    window.__SH_PROBE__ = () =>
      labProbe(state, book, {
        shell: shellRef.current,
        camera: renderer.camera(),
        replay: replays.bar()?.rung ?? null,
        events: tally,
      });

    const stepOnce = (): void => {
      // ON THE TAPE'S GRID whoever is riding (`ghost.ts`), and written down.
      const input = snapInput(replays.input() ?? inputFor());
      step(state, input);
      if (!watching(shellRef.current)) book.step(input, state.events);
      replays.step(input, state);
      xray.step(state);
      for (const e of state.events) tally[e.kind] = (tally[e.kind] ?? 0) + 1;
      if (preroll) return;
      const rides = playerRides(shellRef.current);
      if (soundsLive(shellRef.current)) audio.events(state.events, state);
      if (rides && !params.bot) stats.rig.step(state);
      if (rides) {
        runRumble.events(state.events);
        runRumble.step(state.skier);
      }
      if (rides || watching(shellRef.current)) {
        for (const line of news.step(state))
          live.push({ id: flashId++, ...line, until: wall + FLASH_LIFE });
      }
    };

    // THE FIRST RACE: the map the menu stands over (and RACE rides, unless
    // the player waits for another), or the race a link names — already
    // `t` seconds in, ridden by the bot.
    // A link's race is the player's, and filed — unless the bot pre-rides it.
    const linkTicket = params.rides && params.t === 0 && !params.hold ? ticketFor(state) : null;
    adopt(state, linkTicket, params.rides);
    if (params.rides && params.t > 0) {
      preroll = true;
      const steps = Math.round(params.t * TUNING.physicsHz);
      for (let i = 0; i < steps; i++) stepOnce();
      preroll = false;
    }
    if (params.rides && params.pose) placeRun(state, params.pose);
    const holdRide = heldRide(params.rides ? params.hold : null); // `?hold=`, as the map stands
    renderer.setCamera(cameraFor(shellRef.current, settingsRef.current.camera));
    // Over the title nothing is built until the first run (`title-app.tsx`).
    if (!title.raced()) setWarm(true);
    else
      build(state).catch((e: unknown) =>
        error(
          `the renderer could not build the map: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );

    /* ── STANDING A RACE UP ────────────────────────────────────────────── */
    const loader = createLoader(
      {
        renderer: view,
        adopt: (s) => adopt(s, ticketFor(s), true),
        current: () => state,
        buildMap,
      },
      {
        phase: setLoadingPhase,
        start: () => {
          setLoadLeaving(false);
          setShellNow("loading");
        },
        failed: setLoadFailed,
      },
    );

    const lift = (): void => {
      setLoadLeaving(true);
      setShellNow("run");
      clock.resume();
      window.setTimeout(() => setLoadLeaving(false), LOAD_FADE_MS);
    };

    /** The race again from the start line, on the same map: nothing to generate
     * and nothing to build — the renderer sees a fresh state and starts its
     * trails and its spray clean — so no card, just the lights again. */
    const restart = (): void => {
      if (loader.busy()) return;
      // A free ride starts again at the top of the last piste it skied;
      // every other run from the start line, on the same map, in its mode.
      const free = freeRestart(state, freeAgain);
      const next = free
        ? createGame(free)
        : (pinned.again() ?? playerGame(state.level, state.seed));
      adopt(next, ticketFor(next), true);
      frozen = false;
      clock.resume();
      setShellNow("run");
    };

    const pinned = createPinnedRuns({
      loader,
      current: () => state,
      settings: () => settingsRef.current,
      skier: skierOf,
      setMode: (asked) => (mode = asked),
      done: lift,
    });
    // DEVELOPER's instruments and its BENCHMARK (`dev-app.tsx`).
    const devRig = dev.attach({
      renderer,
      canvas,
      settings: () => settingsRef.current,
      current: () => state,
      mode: () => mode,
      setMode: (asked) => (mode = asked),
      begin: loader.begin,
      shell: () => shellRef.current,
      setShell: setShellNow,
      silence: audio.silence,
      toDevPage: () => setPage("dev"),
      video: () => videoOf(settingsRef.current),
      benchNow: params.bench,
      benchGpu: params.gpu,
      benchHide: params.hide,
      benchAb: params.ab,
      benchFrames: params.frames,
      benchVista: params.view === "vista",
    });

    pressRef.current = {
      race: (seed, asked) => {
        mode = asked;
        pinned.clear();
        const under = state.level.seed === seed && state.rules.course ? state.level : undefined;
        loader.begin({
          // THE MAP UNDER THE MENU IS REUSED when it is the one asked for (never
          // a free ride's, the seed's map on another day); else a worker builds it.
          map: () => (under ? null : gameOrder({ seed, mode, ...linkWorld(params) })),
          build: (level) => playerGame(level ?? under, seed),
          camera: settingsRef.current.camera,
          done: lift,
        });
      },
      free: (options) => {
        mode = "free";
        pinned.clear();
        // The map standing, or the one the start card's worker built or is
        // building (`seed-maps.ts`); else built on the card's own worker.
        const made = freeRideLevel(options, () => standingFor(state.level, state.rules, options));
        loader.begin({
          ...made,
          build: (built) => {
            const game = createGame({ ...options, level: built ?? made.has() });
            freeAgain = freeAgainOptions(options, game.level);
            return game;
          },
          camera: settingsRef.current.camera,
          done: lift,
        });
      },
      tricks: pinned.tricks,
      pinned: pinned.press,
      restart,
      second: pinned.second,
      pause: () => {
        if (canPause(shellRef.current)) setShellNow("pause");
        else if (watching(shellRef.current)) pressRef.current.unwatch();
      },
      watch: (from = "start") => {
        const back = shellRef.current === "pause" ? "pause" : "run";
        if (loader.busy() || !replays.watch(from, state, back)) return;
        renderer.setGhost(null);
        frozen = false;
        clock.resume();
        setShellNow("replay");
      },
      unwatch: () => {
        const out = replays.leave();
        if (!out) return;
        show(out.state);
        renderer.setGhost(book.ghost());
        setShellNow(out.back);
      },
      resume: () => {
        if (shellRef.current === "pause") setShellNow("run");
      },
      toMenu: () => {
        // The run goes back to the bot: nothing more is filed or recorded.
        renderer.clearBodies();
        book.clear();
        stats.rig.flush();
        pinned.clear();
        replays.clear();
        setPage("root");
        frozen = false;
        clock.resume();
        title.toRace(); // the live race is the door's backdrop from here on
        setShellNow("menu");
      },
      abandonLoad: () => {
        loader.abandon();
        pinned.clear();
        setShellNow("menu");
      },
      camera: () => {
        if (watching(shellRef.current)) return replays.camera();
        const next = nextCamera(settingsRef.current.camera);
        setSettings((s) => ({ ...s, camera: next }));
        if (hudOver(shellRef.current)) renderer.setCamera(next);
      },
      shot: () => shots.take(),
    };

    /** One of the game's own buttons, wherever the press came from. */
    const act = createRunActions({
      shell: () => shellRef.current,
      pause: () => pressRef.current.pause(),
      resume: () => pressRef.current.resume(),
      restart,
      camera: () => pressRef.current.camera(),
      reset: () => manager.requestReset(),
      leave: () => pressRef.current.unwatch(),
      replay: () => pressRef.current.watch(replays.crash() ? "crash" : "recent"),
      shoot: shots.take,
      toggleHud: () => setSettings((s) => ({ ...s, hud: !s.hud })),
    });
    manager.onAction(act);
    // A MENU ROW, PRESSED: the desktop shell's menu bar reaches the game by
    // NAME (shell-host.ts), and every word lands on the handler its key does.
    const stopShellCommands = onShellCommand(act);

    // Walking a card on the keys is `menu-nav.ts`'s.
    const walk = walkCardsOnKeys(nav, () => shellRef.current !== "run");

    // PRESET ▸ AUTO (`picture-auto.ts`): times the race under the front
    // door and fits every picture row to this machine. Never over a race a
    // link boots, a link's picture, a lab's `?probe=0` or the title scene
    // (the stored picture stands until the door is first over the race).
    const pictureAuto = createPictureAuto(
      params.probe && !params.rides && !params.video && Object.keys(params.picture).length === 0,
      setSettings,
    );

    let raf = 0;
    let last = performance.now();
    let frameMs = 1000 / 60;
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      // CLAMPED AT BOTH ENDS: the ceiling is the long-frame guard, and the
      // floor is the first callback after a build, whose timestamp lands
      // BEHIND the clock read after it.
      const dtFrame = clamp((now - last) / 1000, 0, 0.1);
      frameMs = now - last || frameMs;
      last = now;
      wall += dtFrame;

      // A LOAD IS PAID FOR BEFORE THE STEPS, and the steps still happen.
      loader.frame(frameMs);
      if (walk.walked()) nav.sync();

      // THE BACKDROP RACES ON: a race behind a card that the bot has taken
      // to the flag is stood back up on the same map, never left coasting.
      const backdrop = !playerRides(shellRef.current) && !watching(shellRef.current);
      if (backdrop && shellRef.current !== "pause" && !loader.busy()) {
        if (state.progress.finished) {
          book.clear();
          adopt(createGame({ level: state.level, seed: state.seed }));
        }
      }

      const held = !simulates(shellRef.current);
      const shown = drawable();
      // SLOW MOTION is fewer steps a frame: the replay director's (`replay-shots.ts`) and the X-ray cam's.
      const xrayOn = playerRides(shellRef.current) && !frozen && !held && shown;
      renderer.setDeathCam(playerRides(shellRef.current) && dying(state));
      const rate = replays.frame() * xray.frame(state, xrayOn ? dtFrame : 0, xrayOn);
      const dtRun = dtFrame * rate;
      renderer.setPace(rate);
      const simAt = performance.now();
      if (shown) holdRide(state, () => renderer.draw(state, 0, 1 / 60, false));
      if (!frozen && !held && shown) {
        const steps = replays.cap(clock.frame(dtRun));
        for (let i = 0; i < steps; i++) stepOnce();
        // DIED (`hud-wreck.ts`): a new rider (`againAt`) once the dark is down.
        if (playerRides(shellRef.current) && deathOver(state, settingsRef.current.restartAfter))
          restart();
      } else {
        // Held: the controls are still read, so a banked reset does not fire on the thaw.
        manager.sample(TUNING.dt);
      }
      devRig.frame(frameMs, dtFrame, performance.now() - simAt);
      if (!shown || !appDraws(shellRef.current)) return;
      const still = frozen || held || clock.paused() || rate === 0;
      const quiet = !playerRides(shellRef.current) && !loader.busy() && !still && title.raced();
      const timing = pictureAuto.wants(settingsRef.current.autoPicture, quiet);
      const drawAt = performance.now();
      renderer.draw(state, clock.alpha(), still ? 0 : dtRun);
      feedHudLive(hudLive, state);
      shots.serve();
      if (timing) {
        const drawMs = performance.now() - drawAt + renderer.drain();
        pictureAuto.frame(frameMs, drawMs, videoOf(settingsRef.current));
      }
      if (!still) {
        audio.setView(renderer.camera());
        audio.frame(state, dtRun, soundsLive(shellRef.current) ? 1 : CARD_DUCK);
        if (playerRides(shellRef.current)) runRumble.frame(dtFrame);
      } else {
        audio.silence();
      }
      if (!warmRef.current) {
        warmRef.current = true;
        setWarm(true);
      }
      // The frame above is presented on the NEXT animation frame; the flag
      // waits for it, and for the race to be up, so a screenshot never
      // captures a card over it.
      if (!ready && hudOver(shellRef.current)) {
        ready = true;
        requestAnimationFrame(() => {
          window.__SH_READY__ = true;
        });
      }
      hudClock += dtFrame;
      if (hudClock >= HUD_TICK) {
        hudClock = 0;
        const taken = takeSnapshot(state, book.ledger());
        setSnap(taken);
        // Where the next rider will stand, read only once this one is dead.
        if (taken.died) setAgain(againAt(state.rules, freeRestart(state, freeAgain)));
        const kept = live.filter((f) => f.until > wall);
        if (kept.length !== live.length) live.splice(0, live.length, ...kept);
        setFlashes(live.map(({ id, text, tone }) => ({ id, text, tone })));
        setReplayBar(replays.bar());
        setCanReplay(replays.offers());
        setCrashReplay(replays.crash());
        devRig.tick();
        if (clock.paused() !== awayRef.current) {
          awayRef.current = clock.paused();
          setAway(awayRef.current);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    // §37.3: a hidden tab is a paused race.
    const onVisibility = (): void => {
      if (document.hidden) {
        clock.pause();
        audio.silence();
        stats.rig.flush();
      } else {
        clock.resume();
        last = performance.now();
      }
      awayRef.current = clock.paused();
      setAway(awayRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    const stopCanvas = watchCanvas(canvas, renderer);
    // A tap on the snowmobile or the helicopter beside him gets him on.
    const stopTaps = watchMachineTaps(canvas, {
      ray: (x, y) => renderer.pickRay(x, y),
      state: () => state,
      rides: () => playerRides(shellRef.current),
      board: () => manager.requestMachine(),
    });

    return () => {
      cancelAnimationFrame(raf);
      audio.silence();
      stopCanvas();
      stopTaps();
      xray.dispose();
      document.removeEventListener("visibilitychange", onVisibility);
      walk.stop();
      devRig.dispose();
      stopShellCommands();
      manager.dispose();
      renderer.dispose();
      delete window.__SH_PROBE__;
    };
    // Boots once: the URL is read on mount and `renderKit` is set exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKit]);

  // THE PICTURE reaches the renderer the moment a row is pressed — after the
  // renderer's own effect above, so the first call finds it standing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => rendererRef.current?.setVideo(videoOf(settings)), [renderKit, settings.video]);
  useEffect(() => rendererRef.current?.dress(settings.outfit), [renderKit, settings.outfit]);

  /** THE MAP A TRICKS RUN RIDES where no trick map card picked it: a
   * pinned one, or the one the menu stands over. */
  const hereSeed = params.seed ?? mapSeed;
  /** Onto the snow: in the mode the tile that opened the skis card named, on
   * the seed that tile showed and the pair the ski card holds. */
  const race = (): void => {
    setPage("root");
    // A PINNED map off the level card.
    const pin = pinnedPress(settings, modeRef.current, params.seed);
    if (pin) return pressRef.current.pinned(...pin);
    // A TRICKS run on the trick map card's map, unless a link pinned a seed.
    // ...and a BIG AIR contest, a SLOPESTYLE run, a HALFPIPE, MOGULS or
    // AERIALS on the same card's map, its venue built over it.
    const m = modeRef.current;
    if (isTrickRun(m) && params.seed === null) {
      return pressRef.current.tricks(trickMapFor(settings.trickMap), m);
    }
    // The tricks run is ridden on the map the menu stands over.
    const here = modeRef.current === "tricks";
    pressRef.current.race(here ? hereSeed : nextSeed, modeRef.current);
    // The next race deals the next map, unless a link pinned this one.
    if (!here && params.seed === null) setNextSeed(dealSeed());
  };

  /** The map on the start card: the one it stored, or the first of the
   * free ride's own mountains (`FREE_SEEDS`). */
  const startSeed = settings.ride.seed ?? FIRST_FREE_SEED;
  /** Onto the snow on a FREE RIDE: the start card's map, day and snow (or the
   * pause card's PISTE MAP's), on the pair the ski card holds. */
  const freeRide = (ride = settings.ride): void => {
    setPage("root");
    pressRef.current.free(freeGameOptions(ride, ride.seed ?? startSeed, skierOf(settings)));
  };
  /** Out of the run to the level card a pinned map is picked on. */
  const toLevels = (): void => (pressRef.current.toMenu(), setPage("levels"));
  // A freestyle contest's plate takes the screen from the run's HUD.
  const plated = shell === "run" && !away && contestPlateUp(snap);
  const hudUp = hudOver(shell) && snap !== null && input !== null && !plated;
  return (
    <>
      <canvas ref={canvasRef} />
      {title.stage(shell, videoOf(settings))}
      {hudUp && (
        <Hud
          snap={snap!}
          flashes={flashes}
          touch={touch && !watching(shell)}
          replaying={watching(shell)}
          input={input!}
          live={hudLive}
          feel={settings.touch}
          lever={settings.touch.lever}
          away={away}
          onReset={() => playerRides(shell) && input?.requestReset()}
          onCamera={() => pressRef.current.camera()}
          onPause={() => pressRef.current.pause()}
          bare={!settings.hud}
          machineKey={boundLabel(settings.keys.machine)}
          tuckKey={boundLabel(settings.keys.tuck)}
          jumpKey={boundLabel(settings.keys.jump)}
          injuries={injuriesShown(settings, shellContent())}
          bodyHud={settings.bodyHud}
          restartAfter={settings.restartAfter}
          again={again}
          offer={
            shell === "run" && crashReplay
              ? {
                  keyLabel: boundLabel(settings.keys.replay),
                  onWatch: () => pressRef.current.watch("crash"),
                }
              : null
          }
        />
      )}
      {/* THE NEW-BUILD NOTICE over the front door: a deploy most often lands
          on a tab nobody is racing, and the HUD's own corner is not up. */}
      {shell === "menu" && (
        <div class="hud hud-over-card">
          <div class="hud-right">
            <UpdateButton />
          </div>
        </div>
      )}
      {replayBar && watching(shell) && (
        <ReplayBar
          {...replayBar}
          touch={touch}
          controls={replayRef.current!}
          onLeave={() => pressRef.current.unwatch()}
        />
      )}
      <ResultPlate
        snap={shell === "run" && !away ? snap : null}
        touch={touch}
        onAgain={() => pressRef.current.restart()}
        onNew={() => (pinnedFor(settings, modeRef.current, params.seed) ? toLevels() : race())}
        onMenu={() => pressRef.current.toMenu()}
        onReplay={canReplay ? () => pressRef.current.watch() : null}
        onSecond={() => pressRef.current.second()}
      />
      {shell === "pause" && snap !== null && (
        <PauseMenu
          snap={snap}
          settings={settings}
          onSettings={setSettings}
          onCamera={(camera) => {
            setSettings((s) => ({ ...s, camera }));
            rendererRef.current?.setCamera(camera);
          }}
          onResume={() => pressRef.current.resume()}
          onRestart={() => pressRef.current.restart()}
          onMainMenu={() => pressRef.current.toMenu()}
          onReplay={canReplay ? () => pressRef.current.watch() : null}
          onSlopes={modeRef.current === "free" ? freeRide : null}
          onMaps={raceMapsOf(modeRef.current) && params.seed === null ? toLevels : null}
        />
      )}
      {shell === "menu" && (page === "root" || page === "play") && (
        <MainMenu
          page={page}
          onPage={setPage}
          seed={nextSeed}
          pinned={params.seed !== null}
          onRace={() => setPage("races")}
          onFree={() => picks.openCard("free", "start")}
          tricks={tricksTile(settings.trickMap, params.seed)}
          onTricks={() => setPage("freestyle")}
          onOptions={() => setPage("options")}
          onGallery={() => setPage("gallery")}
          stats={stats.face}
          onStats={() => setPage("stats")}
          developer={settings.developer}
          onDeveloper={() => setPage("dev")}
          onHeld={() => setSettings((s) => ({ ...s, developer: true }))}
        />
      )}
      {shell === "menu" && page !== "root" && page !== "play" && (
        <MenuPages
          page={page}
          setPage={setPage}
          mode={modeRef.current}
          settings={settings}
          setSettings={setSettings}
          skis={linkSkisRef.current ?? settings.skis}
          picks={picks}
          standing={(key) => bookRef.current?.standing(key) ?? null}
          linkSeed={params.seed}
          startSeed={startSeed}
          dev={dev}
          keys={keys}
          touch={touch}
          onLinkSkis={() => setLinkSkis(null)}
          onRide={race}
          onFreeRide={() => freeRide()}
          stats={stats.book}
          onResetStats={stats.rig.reset}
        />
      )}
      {(shell === "loading" || loadLeaving) && (
        <LoadingScreen
          leaving={loadLeaving}
          phase={loadingPhase}
          failed={loadFailed}
          onBack={() => pressRef.current.abandonLoad()}
        />
      )}
      <DevLayer dev={dev} shell={shell} video={videoOf(settings)} />
      {title.splash(warm, () => {
        shellRef.current = "menu";
        setShell("menu");
      })}
    </>
  );
}
