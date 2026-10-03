// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPTIONS — every knob the game actually has, and not one it does not.
//
// That second half is the rule this page is written to. A settings screen
// carrying a row the app ignores is worse than one without it: the player
// moves it, nothing happens, and now nothing else on the page can be trusted
// either. So there is no MUSIC fader: the game has no music, by design.
//
// A ROW IS ALSO NOT OFFERED TO A MACHINE THAT CANNOT USE IT: the door to the
// keys only where there are keys, the thumbs' three rows only where there is
// a touchscreen. The settings behind each are stored either way, so a phone
// and the laptop beside it never argue over one blob.
//
// FOUR GROUPS IN ONE ORDER, walked the way a skier meets them: the hands
// first (which key, which thumb), then how much the skis helps them, then
// what it sounds like, and last what the picture costs — the one group about
// the MACHINE rather than the ride. On a phone that order is the column; on
// anything wider the first three stand on the left and PICTURE takes the
// right, so the two halves read as the game and the machine.
//
// THE PICTURE ROWS ARE OVER A LIVE RACE and apply the moment they are
// pressed (`App.tsx` hands them to the renderer), which is the whole reason
// they are here rather than behind a card of their own: DISTANCE and FOREST
// are judged by looking at the woods, and the woods are right there behind
// the card. What each row buys is `settings-video.ts`; this page only asks.
//
// Every word is `strings.ts`'s, and the rows are `menu-knobs.tsx`'s.

import { useState } from "preact/hooks";

import {
  Caption,
  FadeRow,
  KnobGroup,
  LinkRow,
  MenuBody,
  MenuHead,
  ON_OFF,
  StepRow,
  onOff,
  type Hint,
  type OnHint,
  type Stop,
} from "./menu-knobs.tsx";
import {
  ASSIST_LEVELS,
  AUDIO_STEP,
  LEVER_SIDES,
  TOUCH_SENSITIVITY,
  freshSettings,
  type AssistLevel,
  type AudioLevels,
  type LeverSide,
  type Settings,
} from "./settings.ts";
import { KEY_ACTIONS } from "./settings-input.ts";
import {
  DISTANCE_LEVELS,
  SHADOW_LEVELS,
  TIERS,
  TRAIL_LEVELS,
  presetOf,
  withPreset,
  type DistanceLevel,
  type ShadowLevel,
  type Tier,
  type TrailLevel,
  type VideoSettings,
} from "./settings-video.ts";
import { STRINGS } from "./strings.ts";

/** The word for a stop on any of the picture's ladders — one vocabulary for
 * every row, so LOW means the same thing wherever it is read. */
const STEP_WORD: Record<Tier | "off" | "max", string> = {
  off: STRINGS.optOff,
  low: STRINGS.optLow,
  medium: STRINGS.optMedium,
  high: STRINGS.optHigh,
  max: STRINGS.optMax,
};

const stopsOf = <T extends Tier | "off" | "max">(ladder: readonly T[]): Stop<T>[] =>
  ladder.map((id) => ({ id, label: STEP_WORD[id] }));

const TIER_STOPS = stopsOf(TIERS);
/** PRESET: AUTO first — the fit to this machine (`video-probe.ts`) — then
 * the whole pictures. */
const PRESET_STOPS: Stop<Tier | "auto">[] = [{ id: "auto", label: STRINGS.optAuto }, ...TIER_STOPS];
const DISTANCE_STOPS = stopsOf<DistanceLevel>(DISTANCE_LEVELS);
const TRAIL_STOPS = stopsOf<TrailLevel>(TRAIL_LEVELS);
const SHADOW_WORD: Record<ShadowLevel, string> = {
  off: STRINGS.optOff,
  skiers: STRINGS.optShadowSkiers,
  medium: STRINGS.optMedium,
  high: STRINGS.optHigh,
};
const SHADOW_STOPS: Stop<ShadowLevel>[] = SHADOW_LEVELS.map((id) => ({
  id,
  label: SHADOW_WORD[id],
}));

const LEVER_STOPS: Stop<LeverSide>[] = LEVER_SIDES.map((id) => ({
  id,
  label: id === "left" ? STRINGS.optLeverLeft : STRINGS.optLeverRight,
}));

const ASSIST_WORD: Record<AssistLevel, string> = {
  off: STRINGS.assistOff,
  half: STRINGS.assistHalf,
  full: STRINGS.assistFull,
};
const ASSIST_STOPS: Stop<AssistLevel>[] = ASSIST_LEVELS.map((id) => ({
  id,
  label: ASSIST_WORD[id],
}));

/** A volume's reading: OFF at the bottom of the travel rather than 0%,
 * because silence is a state a skier chooses and "0%" reads as a setting
 * that did not take. */
const level = (share: number): string =>
  share <= 0 ? STRINGS.optSoundOff : STRINGS.percent(share);

/** THE SOUND GROUP'S FOUR ROWS — the switch and the three faders. Exported
 * because the PAUSE CARD's panel carries the same rows: a fader moved mid-race
 * and one moved on the front door are one setting, and two copies of the rows
 * would be two lists the day a fourth fader lands. */
export function SoundRows({
  settings,
  onSettings,
  onHint,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onHint: OnHint;
}) {
  const setAudio = (next: Partial<AudioLevels>): void =>
    onSettings({ ...settings, audio: { ...settings.audio, ...next } });
  return (
    <>
      <StepRow
        label={STRINGS.optSound}
        hint={STRINGS.optSoundHint}
        stops={ON_OFF}
        value={onOff(settings.sound)}
        onPick={(id) => onSettings({ ...settings, sound: id === "on" })}
        onHint={onHint}
      />
      <FadeRow
        label={STRINGS.optMaster}
        hint={STRINGS.optMasterHint}
        value={settings.audio.master}
        min={0}
        max={1}
        step={AUDIO_STEP}
        read={level}
        onChange={(master) => setAudio({ master })}
        onHint={onHint}
      />
      <FadeRow
        label={STRINGS.optEngine}
        hint={STRINGS.optEngineHint}
        value={settings.audio.engine}
        min={0}
        max={1}
        step={AUDIO_STEP}
        read={level}
        onChange={(engine) => setAudio({ engine })}
        onHint={onHint}
      />
      <FadeRow
        label={STRINGS.optEffects}
        hint={STRINGS.optEffectsHint}
        value={settings.audio.effects}
        min={0}
        max={1}
        step={AUDIO_STEP}
        read={level}
        onChange={(effects) => setAudio({ effects })}
        onHint={onHint}
      />
    </>
  );
}

export function OptionsPage({
  settings,
  keys,
  touch,
  onSettings,
  onBack,
  onKeys,
}: {
  settings: Settings;
  /** Whether this machine has keys worth binding. */
  keys: boolean;
  /** Whether it has a touchscreen for the thumbs' rows. */
  touch: boolean;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  onKeys: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const video = settings.video;
  // A row moved by hand is the skier's picture, not the fit's.
  const setVideo = (next: Partial<VideoSettings>): void =>
    onSettings({ ...settings, autoPicture: false, video: { ...video, ...next } });
  const setTouch = (next: Partial<Settings["touch"]>): void =>
    onSettings({ ...settings, touch: { ...settings.touch, ...next } });
  const setAssist = (next: Partial<Settings["assist"]>): void =>
    onSettings({ ...settings, assist: { ...settings.assist, ...next } });
  const preset = presetOf(video);
  const T = TOUCH_SENSITIVITY;
  return (
    <div class="menu-card menu-card-options" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.menuOptions} />
      <MenuBody>
        <div class="knob-groups">
          <div class="knob-col">
            {(keys || touch) && (
              <KnobGroup title={STRINGS.optControlsGroup} glyph="keyboard">
                {keys && (
                  <LinkRow
                    label={STRINGS.optKeys}
                    hint={STRINGS.optKeysHint}
                    value={STRINGS.optKeysCount(KEY_ACTIONS.length)}
                    onOpen={onKeys}
                    onHint={setHint}
                  />
                )}
                {touch && (
                  <>
                    <StepRow
                      label={STRINGS.optLever}
                      hint={STRINGS.optLeverHint}
                      stops={LEVER_STOPS}
                      value={settings.touch.lever}
                      onPick={(lever) => setTouch({ lever })}
                      onHint={setHint}
                    />
                    <FadeRow
                      label={STRINGS.optSensitivity}
                      hint={STRINGS.optSensitivityHint}
                      value={settings.touch.sensitivity}
                      min={T.min}
                      max={T.max}
                      step={T.step}
                      read={STRINGS.times}
                      onChange={(sensitivity) => setTouch({ sensitivity })}
                      onHint={setHint}
                    />
                    <StepRow
                      label={STRINGS.optInvertLean}
                      hint={STRINGS.optInvertLeanHint}
                      stops={ON_OFF}
                      value={onOff(settings.touch.invertLean)}
                      onPick={(id) => setTouch({ invertLean: id === "on" })}
                      onHint={setHint}
                    />
                  </>
                )}
              </KnobGroup>
            )}
            {/* THE ARCADE'S TWO HANDS on the skis — the engine's `Assist`. A race
              is dealt them when it is stood up, so a change here is the NEXT
              race's, and the caption says so. */}
            <KnobGroup title={STRINGS.optAssistGroup} glyph="gauge">
              <StepRow
                label={STRINGS.optAssistSteer}
                hint={`${STRINGS.optAssistSteerHint} ${STRINGS.optAssistNote}`}
                stops={ASSIST_STOPS}
                value={settings.assist.steer}
                onPick={(steer) => setAssist({ steer })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optAssistAir}
                hint={`${STRINGS.optAssistAirHint} ${STRINGS.optAssistNote}`}
                stops={ASSIST_STOPS}
                value={settings.assist.air}
                onPick={(air) => setAssist({ air })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optDamage}
                hint={`${STRINGS.optDamageHint} ${STRINGS.optAssistNote}`}
                stops={ON_OFF}
                value={onOff(settings.damage)}
                onPick={(id) => onSettings({ ...settings, damage: id === "on" })}
                onHint={setHint}
              />
            </KnobGroup>
            {/* THE FADERS ARE OVER A LIVE RACE TOO: the bus reads them every
              frame, so the engine under the card gets quieter as the thumb
              moves. The switch over all three is the front door's own. */}
            <KnobGroup title={STRINGS.optSoundGroup} glyph={settings.sound ? "speaker" : "mute"}>
              <SoundRows settings={settings} onSettings={onSettings} onHint={setHint} />
            </KnobGroup>
          </div>
          <div class="knob-col">
            {/* Eight rows, not one, because they are eight different bills — a
              machine can be short of pixels and rich in triangles. PRESET
              moves all of them and reads back which one they still are. */}
            <KnobGroup title={STRINGS.optPicture} glyph="display">
              {/* The readouts over the snow — H mid-race is the same switch. */}
              <StepRow
                label={STRINGS.optHud}
                hint={STRINGS.optHudHint}
                stops={ON_OFF}
                value={onOff(settings.hud)}
                onPick={(id) => onSettings({ ...settings, hud: id === "on" })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optPreset}
                hint={STRINGS.optPresetHint}
                stops={PRESET_STOPS}
                value={settings.autoPicture ? "auto" : preset}
                extra={STRINGS.optCustom}
                onPick={(tier) =>
                  onSettings(
                    tier === "auto"
                      ? { ...settings, autoPicture: true }
                      : { ...settings, autoPicture: false, video: withPreset(video, tier) },
                  )
                }
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optResolution}
                hint={STRINGS.optResolutionHint}
                stops={TIER_STOPS}
                value={video.resolution}
                onPick={(resolution) => setVideo({ resolution })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optDistance}
                hint={STRINGS.optDistanceHint}
                stops={DISTANCE_STOPS}
                value={video.distance}
                onPick={(distance) => setVideo({ distance })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optTerrain}
                hint={STRINGS.optTerrainHint}
                stops={TIER_STOPS}
                value={video.terrain}
                onPick={(terrain) => setVideo({ terrain })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optTrails}
                hint={STRINGS.optTrailsHint}
                stops={TRAIL_STOPS}
                value={video.trails}
                onPick={(trails) => setVideo({ trails })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optForest}
                hint={STRINGS.optForestHint}
                stops={TIER_STOPS}
                value={video.forest}
                onPick={(forest) => setVideo({ forest })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optShadows}
                hint={STRINGS.optShadowsHint}
                stops={SHADOW_STOPS}
                value={video.shadows}
                onPick={(shadows) => setVideo({ shadows })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optSpray}
                hint={STRINGS.optSprayHint}
                stops={TIER_STOPS}
                value={video.spray}
                onPick={(spray) => setVideo({ spray })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.optAntialias}
                hint={STRINGS.optAntialiasHint}
                stops={ON_OFF}
                value={onOff(video.antialias)}
                onPick={(id) => setVideo({ antialias: id === "on" })}
                onHint={setHint}
              />
            </KnobGroup>
          </div>
        </div>
        {/* RESTORE DEFAULTS keeps the camera the skier chose, the probe's
          verdict and the developer page — none is a row on this page — and
          puts every row that IS back where it shipped. */}
        <button
          type="button"
          class="opt-reset"
          onClick={() =>
            onSettings({
              ...freshSettings(),
              camera: settings.camera,
              probed: settings.probed,
              developer: settings.developer,
              dev: settings.dev,
            })
          }
        >
          {STRINGS.optRestore}
        </button>
      </MenuBody>
      <Caption hint={hint} fallback={STRINGS.optCaption} />
    </div>
  );
}
