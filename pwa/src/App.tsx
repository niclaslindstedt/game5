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
// player was just on. Under a card the camera is the slow ORBIT round the
// skis; over a run it is the rung the skier chose (`cameraFor`).
//
// THE RECORD BOOK AND THE GHOST (`ghost-run.ts`): every run the player
// rides is armed with a ticket — its seed, skis, mode and length — before
// its first step; every input the engine is handed passes `snapInput` on
// the way in, so what the book's tape writes down is what was ridden; and
// a TIME TRIAL is ridden beside the ghost of the best run on that ticket.
// The bot's race under a card is armed with nothing.
//
// THE CAMPAIGN (`campaign-run.ts`, `pinned-run.ts`): a rung is armed before its
// first step and booked at the flag; RACE and TIME TRIAL ride pinned maps too.
// THE REPLAY (`replay-run.ts`): the same runs are recorded as the controls
// that rode them, and WATCH REPLAY on the finish plate or the pause card
// rebuilds the race and steps it off the tape under the `replay` surface —
// on the broadcast camera, in slow motion where the director says so.
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
// THE RENDERER IS FETCHED, NOT BUNDLED (`use-render-kit.ts`):
// `game/renderer.ts` is the one import that reaches three.js, so it arrives
// as its own chunk behind the attract card, and everything this file asks of
// it is `renderer-api.ts`'s — it draws a `GameState` and never writes one.
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
  lastPiste,
  placeRun,
  skisById,
  step,
  type CreateGameOptions,
  type GameMode,
  type GameState,
  type Level,
  type SkiSpec,
} from "@engine";

import { connectOutput } from "./output-bridge.ts";
import { onShellCommand } from "./shell-host.ts";
import { createRunAudio, setAudioVolumes, unlockAudio } from "./game/audio/index.ts";
import { createLoader, raceOrFallback } from "./game/app-load.ts";
import { isTraining } from "./game/downhill-run.ts";
import { NO_PRESSES, type Presses } from "./game/app-presses.ts";
import { frontDoorPins, pinnedFor, pinnedPress, type PinnedSkier } from "./game/campaign.ts";
import { carriesPoles } from "./game/outfit.ts";
import { useCampaign } from "./game/campaign-app.ts";
import { trickMapFor, tricksTile } from "./game/trick-maps.ts";
import { useCloudSync } from "./game/use-cloud-sync.ts";
import { freeAgainOptions, freeGameOptions, freeTopOptions } from "./game/free-ride.ts";
import { DevLayer, useDevApp } from "./game/dev-app.tsx";
import { snapInput } from "./game/ghost.ts";
import { heldRide } from "./game/hold-input.ts";
import { createRunBook, type RunBook, type RunTicket } from "./game/ghost-run.ts";
import { keepsRecords, pairKey, runKey } from "./game/records.ts";
import { runRumble } from "./game/haptics.ts";
import { Hud, hasTouch, type HudFlash } from "./game/hud.tsx";
import { ResultPlate } from "./game/hud-result.tsx";
import { ReplayBar } from "./game/hud-replay.tsx";
import { createReplayRun, type ReplayBarFacts } from "./game/replay-run.ts";
import { prepareMinimap } from "./game/minimap.tsx";
import { createInputManager, type InputManager } from "./game/input.ts";
import { LoadingScreen } from "./game/loading-screen.tsx";
import { labProbe } from "./game/lab-probe.ts";
import { DevPages } from "./game/menu-dev.tsx";
import { KeysPage } from "./game/menu-keys.tsx";
import { MainMenu } from "./game/menu-main.tsx";
import { createMenuNav, walkCardsOnKeys } from "./game/menu-nav.ts";
import { GalleryPage } from "./game/menu-gallery.tsx";
import { OptionsPage } from "./game/menu-options.tsx";
import { SkisCards } from "./game/menu-dress.tsx";
import { StartPage } from "./game/menu-start.tsx";
import { PauseMenu } from "./game/menu-pause.tsx";
import { PinnedCards } from "./game/menu-pinned.tsx";
import { createPinnedRuns, secondRunOff, skisBack } from "./game/pinned-run.ts";
import type { WorldRenderer } from "./game/renderer-api.ts";
import { useRenderKit } from "./game/use-render-kit.ts";
import { createRunActions } from "./game/run-actions.ts";
import type { LoadPhase } from "./game/run-loader.ts";
import { createRunClock } from "@niclaslindstedt/oss-game-framework/loop/run-clock";
import { shotLabel } from "./game/run-news.ts";
import { createNewsFeed } from "./game/run-watch.ts";
import {
  assistOf,
  loadSettings,
  mixOf,
  nextCamera,
  saveSettings,
  specFor,
  type Settings,
} from "./game/settings.ts";
import { withPreset, type VideoSettings } from "./game/settings-video.ts";
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
import { SplashScreen } from "./game/splash-screen.tsx";
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
/** How long the loading card takes to fade off the race underneath. Must
 * match the `.loading.leaving` transition in styles.css. */
const LOAD_FADE_MS = 260;
/** How much of the mix the bot's race gets under a card. */
const CARD_DUCK = 0.5;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params] = useState(() => readParams(location.search));
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [flashes, setFlashes] = useState<HudFlash[]>([]);
  /** The TAB is away and the clock with it (§37.3) — not the pause card. */
  const [away, setAway] = useState(false);
  const [shell, setShell] = useState<Shell>(() =>
    params.rides
      ? params.paused
        ? "pause"
        : "run"
      : splashSkipped(location.search)
        ? "menu"
        : "splash",
  );
  const [loadingPhase, setLoadingPhase] = useState<LoadPhase | null>(null);
  const [loadLeaving, setLoadLeaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  /** True once the renderer has drawn a frame — what the attract card waits
   * on before it will take a press (`splash.ts`). */
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
    poles: params.poles ?? carriesPoles(s.outfit),
  });
  /** The picture drawn: the stored one, or a lab's preset for this visit —
   * `?video=` is never written back. */
  const videoOf = (s: Settings): VideoSettings => ({
    ...(params.video ? withPreset(s.video, params.video) : s.video),
    ...params.picture,
  });
  /** THE SEED RACE WILL BUILD, shown on the tile. Pinned by `?seed=`,
   * otherwise dealt fresh after every race stood up. */
  const [nextSeed, setNextSeed] = useState(() => params.seed ?? dealSeed());
  /** THE MAP THE MENU IS STANDING OVER — what the TIME TRIAL tile rides. */
  const [mapSeed, setMapSeed] = useState(nextSeed);
  /** The mode the skis card's RIDE is for: whichever tile opened it. */
  // (A link to the start card is a free ride on its way to the skis card.)
  const modeRef = useRef<GameMode>(params.page === "start" ? "free" : params.mode);
  /** THE CAMPAIGN: the board, the rig that books a rung, the rung being ridden. */
  const campaign = useCampaign({ mode: modeRef, setPage, setSettings });
  const dev = useDevApp();
  const bookRef = useRef<RunBook | null>(null);
  useCloudSync({ settings, setSettings, campaign, book: bookRef, shell });
  const [input, setInput] = useState<InputManager | null>(null);
  /** The bar over a recording, and whether there is one worth offering —
   * both refreshed on the HUD's tick, never per frame. */
  const [replayBar, setReplayBar] = useState<ReplayBarFacts | null>(null);
  const [canReplay, setCanReplay] = useState(false);
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
    const book = createRunBook({ show: (ghost) => renderer.setGhost(ghost) });
    bookRef.current = book;
    const replays = createReplayRun({
      renderer,
      adopt: (s) => adopt(s),
      shell: () => shellRef.current,
    });
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
      const seed = params.seed ?? s.ride.seed ?? raceSeed;
      const ride = freeGameOptions(s.ride, seed, skierOf(s));
      // A link's sky (`?weather=` / `?hour=`) and region over the card's.
      const opts = overLink(ride, params);
      try {
        const game = createGame(opts);
        freeAgain = freeAgainOptions(opts, game.level);
        return game;
      } catch (e) {
        error(`seed ${seed} would not build (${e instanceof Error ? e.message : String(e)})`);
        return raceOrFallback(1, { ...skierOf(s), mode: "slalom", laps: s.trialLaps });
      }
    };
    // A race a link boots into is the player's, with the player's help; the
    // one under the front door is the bot's, with every hand on.
    let state: GameState = params.free
      ? freeBoot()
      : raceOrFallback(
          raceSeed,
          params.rides
            ? {
                ...skierOf(settingsRef.current),
                mode: params.mode,
                laps: settingsRef.current.trialLaps,
              }
            : null,
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
        laps: mode === "timeTrial" ? settingsRef.current.trialLaps : undefined,
        training: mode === "downhill" ? true : undefined,
        ...skierOf(settingsRef.current),
      });
    /** What a player's run is filed under — nothing for a run the bot rides
     * from the line (`?bot=1`), which is nobody's time, nothing for a mode
     * that keeps no book (a free ride, `keepsRecords`), and nothing for a
     * downhill's training, which counts for nothing. */
    const ticketFor = (s: GameState): RunTicket | null =>
      params.bot || !keepsRecords(mode) || isTraining(s)
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
      renderer.setCamera(cameraFor(next, settingsRef.current.camera));
    };

    /** A new race has taken over the engine: everything that belonged to
     * the one before it goes with it. */
    const adopt = (next: GameState, ticket: RunTicket | null = null): void => {
      state = next;
      book.arm(next, ticket);
      replays.arm(next, ticket ? mode : null);
      setMapSeed(next.seed);
      live.length = 0;
      for (const k of Object.keys(tally)) delete tally[k];
      audio.reset();
      runRumble.reset();
    };

    /** What this step is ridden on: the player's hands on a run, and the BOT
     * everywhere else — the race behind a card is still being raced — and
     * through a link's pre-roll, so a picture of a race is of one moving. */
    const inputFor = () =>
      preroll || params.bot || !playerRides(shellRef.current)
        ? botInput(state)
        : manager.sample(TUNING.dt, state.skier.airborne, !!state.heli?.rider);

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
      book.step(input, state.events);
      replays.step(input, state);
      for (const e of state.events) tally[e.kind] = (tally[e.kind] ?? 0) + 1;
      if (preroll) return;
      const rides = playerRides(shellRef.current);
      if (soundsLive(shellRef.current)) audio.events(state.events, state);
      if (rides) {
        if (!params.bot) campaign.rig.step(state);
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
    adopt(state, params.rides && params.t === 0 && !params.hold ? ticketFor(state) : null);
    if (params.rides && params.t > 0) {
      preroll = true;
      const steps = Math.round(params.t * TUNING.physicsHz);
      for (let i = 0; i < steps; i++) stepOnce();
      preroll = false;
    }
    if (params.rides && params.pose) placeRun(state, params.pose);
    const holdRide = heldRide(params.rides ? params.hold : null); // `?hold=`, as the map stands
    renderer.setCamera(cameraFor(shellRef.current, settingsRef.current.camera));
    build(state).catch((e: unknown) =>
      error(`the renderer could not build the map: ${e instanceof Error ? e.message : String(e)}`),
    );

    /* ── STANDING A RACE UP ────────────────────────────────────────────── */
    const loader = createLoader(
      { renderer: view, adopt: (s) => adopt(s, ticketFor(s)), current: () => state },
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
      hudClock = HUD_TICK;
      window.setTimeout(() => setLoadLeaving(false), LOAD_FADE_MS);
    };

    /** The race again from the start line, on the same map: nothing to generate
     * and nothing to build — the renderer sees a fresh state and starts its
     * trails and its spray clean — so no card, just the lights again. */
    const restart = (): void => {
      if (loader.busy()) return;
      // A free ride starts again at the top of the last piste it skied;
      // every other run from the start line, on the same map, in its mode.
      const next =
        !state.rules.course && !state.rules.tricks && freeAgain
          ? createGame(freeTopOptions(freeAgain, lastPiste(state)))
          : (pinned.again() ?? playerGame(state.level, state.seed));
      adopt(next, ticketFor(next));
      frozen = false;
      clock.resume();
      setShellNow("run");
      hudClock = HUD_TICK;
    };

    const pinned = createPinnedRuns({
      rig: campaign.rig,
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
        loader.begin({
          // THE MAP UNDER THE MENU IS REUSED when it is the one asked for —
          // the race the player presses RACE over is the race they ride.
          // (Never a free ride's: that one is the seed's map on another day.)
          build: () =>
            playerGame(
              state.level.seed === seed && state.rules.course ? state.level : undefined,
              seed,
            ),
          camera: settingsRef.current.camera,
          done: lift,
        });
      },
      free: (options) => {
        mode = "free";
        pinned.clear();
        loader.begin({
          build: () => {
            const reuse =
              state.level.seed === options.seed && state.rules.course ? state.level : undefined;
            const game = createGame({ ...options, level: reuse });
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
        else if (watching(shellRef.current)) pressRef.current.toMenu();
      },
      watch: () => {
        if (loader.busy() || !replays.watch()) return;
        frozen = false;
        clock.resume();
        setShellNow("replay");
        hudClock = HUD_TICK;
      },
      resume: () => {
        if (shellRef.current === "pause") setShellNow("run");
      },
      toMenu: () => {
        // The run goes back to the bot: nothing more is filed or recorded.
        book.clear();
        pinned.clear();
        replays.clear();
        setPage("root");
        frozen = false;
        clock.resume();
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
      leave: () => pressRef.current.toMenu(),
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
    // link boots, a link's picture or a lab's `?probe=0`.
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
      // to the flag is stood back up on the same map, so the front door is
      // never over a skis coasting to a stop.
      const backdrop = !playerRides(shellRef.current) && !watching(shellRef.current);
      if (backdrop && shellRef.current !== "pause" && !loader.busy()) {
        if (state.progress.finished) {
          book.clear();
          adopt(createGame({ level: state.level, seed: state.seed }));
        }
      }

      const held = !simulates(shellRef.current);
      const shown = drawable();
      // SLOW MOTION is the replay director's alone (`replay-shots.ts`): fewer
      // steps per frame. A wipeout runs at full speed (`camera-death.ts`).
      renderer.setDeathCam(playerRides(shellRef.current));
      const rate = replays.frame();
      const dtRun = dtFrame * rate;
      const simAt = performance.now();
      if (shown) holdRide(state, () => renderer.draw(state, 0, 1 / 60, false));
      if (!frozen && !held && shown) {
        const steps = clock.frame(dtRun);
        for (let i = 0; i < steps; i++) stepOnce();
        if (replays.over()) pressRef.current.toMenu();
      } else {
        // Held: the controls are still read, so a banked reset does not
        // fire the moment the picture thaws.
        manager.sample(TUNING.dt);
      }
      devRig.frame(frameMs, dtFrame, performance.now() - simAt);
      if (!shown || !appDraws(shellRef.current)) return;
      const still = frozen || held || clock.paused();
      const quiet = !playerRides(shellRef.current) && !loader.busy() && !still;
      const timing = pictureAuto.wants(settingsRef.current.autoPicture, quiet);
      const drawAt = performance.now();
      renderer.draw(state, clock.alpha(), still ? 0 : dtRun);
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
        setSnap(takeSnapshot(state, book.ledger()));
        const kept = live.filter((f) => f.until > wall);
        if (kept.length !== live.length) live.splice(0, live.length, ...kept);
        setFlashes(live.map(({ id, text, tone }) => ({ id, text, tone })));
        setReplayBar(replays.bar());
        setCanReplay(replays.offers());
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
      } else {
        clock.resume();
        last = performance.now();
      }
      awayRef.current = clock.paused();
      setAway(awayRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    // A browser makes no sound before the player has touched something, so
    // the unlock hangs off real gestures only — captured, so a card that
    // stops propagation cannot swallow it.
    const unlockOpts = { capture: true, passive: true } as const;
    document.addEventListener("pointerdown", unlockAudio, unlockOpts);
    document.addEventListener("keydown", unlockAudio, unlockOpts);
    // The canvas's size is the renderer's own business: it is handed the
    // box it draws into and told again whenever the box changes.
    const fit = (): void => {
      const box = canvas.getBoundingClientRect();
      renderer.resize(box.width, box.height, Math.min(2, devicePixelRatio || 1));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();

    return () => {
      cancelAnimationFrame(raf);
      audio.silence();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", unlockAudio, unlockOpts);
      document.removeEventListener("keydown", unlockAudio, unlockOpts);
      walk.stop();
      devRig.dispose();
      stopShellCommands();
      manager.dispose();
      renderer.dispose();
      delete window.__SH_PROBE__;
    };
    // Boots once: the URL is read on mount and `renderKit` is set exactly
    // once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKit]);

  // THE PICTURE reaches the renderer the moment a row is pressed — after the
  // renderer's own effect above, so the first call finds it standing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => rendererRef.current?.setVideo(videoOf(settings)), [renderKit, settings.video]);
  useEffect(() => rendererRef.current?.dress(settings.outfit), [renderKit, settings.outfit]);

  /** THE TIME TRIAL'S MAP: a pinned one, or the one the menu stands over. */
  const trialSeed = params.seed ?? mapSeed;
  /** Onto the snow: in the mode the tile that opened the skis card named, on
   * the seed that tile showed and the pair the ski card holds. */
  const race = (): void => {
    setPage("root");
    // A RUNG off the campaign card, or a PINNED map off the level card.
    const pin = pinnedPress(campaign.rung.current, settings, modeRef.current, params.seed);
    if (pin) return pressRef.current.pinned(...pin);
    // A TRICKS run on the trick map card's map, unless a link pinned a seed.
    if (modeRef.current === "tricks" && params.seed === null) {
      return pressRef.current.tricks(trickMapFor(settings.trickMap));
    }
    // The trial and the tricks run are ridden on the map the menu stands over.
    const trial = modeRef.current === "timeTrial" || modeRef.current === "tricks";
    pressRef.current.race(trial ? trialSeed : nextSeed, modeRef.current);
    // The next race deals the next map, unless a link pinned this one.
    if (!trial && params.seed === null) setNextSeed(dealSeed());
  };
  const trialBest = bookRef.current?.standing({
    seed: trialSeed,
    ...pairKey(specOf(settings)),
    mode: "timeTrial",
    laps: settings.trialLaps,
  });

  /** The map on the start card: the one it stored, or the front door's. */
  const startSeed = settings.ride.seed ?? nextSeed;
  /** Onto the snow on a FREE RIDE: the start card's map, day and snow, on
   * the pair the ski card holds. */
  const freeRide = (): void => {
    setPage("root");
    pressRef.current.free(freeGameOptions(settings.ride, startSeed, skierOf(settings)));
  };

  const hudUp = hudOver(shell) && snap !== null && input !== null;
  return (
    <>
      <canvas ref={canvasRef} />
      {hudUp && (
        <Hud
          snap={snap!}
          flashes={flashes}
          touch={touch && !watching(shell)}
          input={input!}
          feel={settings.touch}
          lever={settings.touch.lever}
          away={away}
          onReset={() => playerRides(shell) && input?.requestReset()}
          onCamera={() => pressRef.current.camera()}
          onPause={() => pressRef.current.pause()}
          bare={!settings.hud}
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
          onCamera={() => pressRef.current.camera()}
          onLeave={() => pressRef.current.toMenu()}
        />
      )}
      <ResultPlate
        snap={shell === "run" && !away ? snap : null}
        touch={touch}
        onAgain={() => pressRef.current.restart()}
        onNew={() => {
          if (!pinnedFor(settings, modeRef.current, params.seed)) return race();
          pressRef.current.toMenu();
          setPage("levels");
        }}
        onMenu={() => pressRef.current.toMenu()}
        campaign={shell === "run" ? campaign.rig.plate() : null}
        onNext={(next) => pressRef.current.pinned((campaign.rung.current = next), next.mode, true)}
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
        />
      )}
      {shell === "menu" && page === "root" && (
        <MainMenu
          {...frontDoorPins(campaign.progress, settings, params.seed)}
          onCampaign={() => setPage("campaign")}
          seed={nextSeed}
          pinned={params.seed !== null}
          trial={{
            seed: trialSeed,
            best: trialBest ? { time: trialBest.value, skis: skisById(trialBest.skis).name } : null,
          }}
          onRace={() => campaign.openCard("slalom", params.seed === null ? "levels" : "skis")}
          onDownhill={() => campaign.openCard("downhill", params.seed === null ? "levels" : "skis")}
          onTrial={() => campaign.openCard("timeTrial", params.seed === null ? "levels" : "skis")}
          onFree={() => campaign.openCard("free", "start")}
          tricks={tricksTile(settings.trickMap, params.seed)}
          onTricks={() => campaign.openCard("tricks", params.seed === null ? "tricks" : "skis")}
          onOptions={() => setPage("options")}
          onGallery={() => setPage("gallery")}
          developer={settings.developer}
          onDeveloper={() => setPage("dev")}
          onHeld={() => setSettings((s) => ({ ...s, developer: true }))}
        />
      )}
      {shell === "menu" && page !== "root" && (
        <div class="menu">
          {page === "campaign" || page === "levels" || page === "tricks" ? (
            <PinnedCards
              page={page}
              mode={modeRef.current}
              settings={settings}
              skis={specOf(settings).id}
              progress={campaign.progress}
              standing={(key) => bookRef.current?.standing(key) ?? null}
              onBack={() => setPage("root")}
              onChoose={campaign.choose}
              onTrick={campaign.chooseTrick}
            />
          ) : page === "skis" || page === "dress" ? (
            <SkisCards
              page={page}
              skis={specOf(settings).id}
              settings={settings}
              onSettings={setSettings}
              onLink={() => setLinkSkis(null)}
              onPage={setPage}
              onBack={() => setPage(skisBack(campaign.rung.current, modeRef.current, params.seed))}
              onRide={modeRef.current === "free" ? freeRide : race}
            />
          ) : page === "start" ? (
            <StartPage
              settings={settings}
              seed={startSeed}
              onSettings={setSettings}
              onReroll={() =>
                setSettings((s) => ({ ...s, ride: { ...s.ride, seed: dealSeed(), spot: null } }))
              }
              onBack={() => setPage("root")}
              onNext={() => setPage("skis")}
            />
          ) : page === "gallery" ? (
            <GalleryPage onBack={() => setPage("root")} />
          ) : page === "dev" || page === "unlocks" || page === "benchHistory" ? (
            <DevPages
              page={page}
              settings={settings}
              progress={campaign.progress}
              repro={() => dev.rig.current?.repro() ?? ""}
              onSettings={setSettings}
              onProgress={campaign.setProgress}
              onPage={setPage}
              onBack={() => setPage("root")}
              onBenchmark={() => dev.rig.current?.startBench()}
            />
          ) : page === "options" ? (
            <OptionsPage
              settings={settings}
              keys={keys}
              touch={touch}
              onSettings={setSettings}
              onBack={() => setPage("root")}
              onKeys={() => setPage("keys")}
            />
          ) : (
            <KeysPage
              settings={settings}
              onSettings={setSettings}
              onBack={() => setPage("options")}
            />
          )}
        </div>
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
      {shell === "splash" && (
        <SplashScreen
          warm={warm}
          onDone={() => {
            shellRef.current = "menu";
            setShell("menu");
          }}
        />
      )}
    </>
  );
}
