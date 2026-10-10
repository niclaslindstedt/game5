// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE JUMP PLANE (`plane.ts`) — a block of the one strings
// table (`strings.ts`, §39.1), stated next door and spread into `STRINGS`
// under the same names, as the paramotor's are: the START row's stop, the
// news a flight earns, its HUD (`hud-plane.tsx`) — the airspeed, the height
// over the snow, the climb, the power, the flaps and the stall horn, and the
// press that takes him out of the door — and its rows in OPTIONS ▸ KEYS
// (`settings-plane-keys.ts`).

/** Knots in a metre a second: an airspeed is read in knots in a cockpit. */
const KNOTS = 1.943844;

export const PLANE_STRINGS = {
  /** The START row's stop: the ride begun in the jump plane's door on its
   * strip below the village. */
  startRunPlane: "PLANE",

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsPlaneBoard: "IN THE DOOR! FLY HER UP",
  newsPlaneLiftoff: "WHEELS UP!",
  newsPlaneLand: "TOUCHDOWN",
  /** Out of the door, this many metres over the snow. */
  newsPlaneJump: (metres: number): string => `EXIT AT ${Math.round(metres)} M!`,
  newsPlaneStepoff: "OFF THE PLANE",
  newsPlaneHome: "THE PLANE IS HOME",
  newsPlaneCrash: "MAYDAY! SHE'S GONE IN",
  newsPlaneRestart: "BACK ON THE STRIP",
  newsPlaneStall: "STALL!",

  /* ── THE HUD (hud-plane.tsx) ───────────────────────────────────────── */
  /** The airspeed, knots. */
  planeSpeed: "IAS",
  planeKnots: (ms: number): string => `${Math.round(ms * KNOTS)} KT`,
  /** The height over the snow under it, m. */
  planeHeight: "AGL",
  planeMetres: (m: number): string => `${Math.round(m)} M`,
  /** Its height over the sea, m. */
  planeAltitude: (m: number): string => `ALT ${Math.round(m)} M`,
  /** The climb, m/s. */
  planeClimb: (v: number): string => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)} M/S`,
  /** The power lever's bar, and the flap lever's setting, deg. */
  planePower: "Power",
  planePowerShort: "PWR",
  planeFlaps: (deg: number): string => `FLAPS ${Math.round(deg)}°`,
  /** The stall horn: a wing let go of its air. */
  planeStall: "STALL",
  /** The load on the airframe, g, past the comfortable. */
  planeLoad: (g: number): string => `${g.toFixed(1)} G`,
  /** The next press in the air: out of the door — the machine key (`key`,
   * as bound), a double tap on touch. */
  planeJump: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO JUMP" : `${key} TO JUMP`,
  /** ...and stopped on the snow: off it onto his skis. */
  planeStepOff: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO STEP OFF" : `${key} TO STEP OFF`,
  /** On the snow, how to go: the power up and off down the strip. */
  planeGo: (touch: boolean): string =>
    touch ? "PUSH THE RIGHT PAD UP TO ROLL" : "POWER UP TO ROLL",
  /** Parked on its strip near him: its word, how far, and the press that
   * takes him aboard at its door. */
  planeCall: "PLANE",
  planeAway: (m: number): string => `${Math.round(m)} M`,
  planeTake: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO BOARD" : `${key} TO BOARD`,

  /* ── OPTIONS ▸ KEYS (settings-plane-keys.ts) ───────────────────────── */
  keysPlaneTitle: "PLANE",
  keyThrottleUp: "POWER UP",
  keyThrottleDown: "POWER DOWN",
  keyStickForward: "STICK FORWARD",
  keyStickBack: "STICK BACK",
  keyStickLeft: "STICK LEFT",
  keyStickRight: "STICK RIGHT",
  keyRudderLeft: "RUDDER LEFT",
  keyRudderRight: "RUDDER RIGHT",
  keyFlapsDown: "FLAPS DOWN",
  keyFlapsUp: "FLAPS UP",
  keyPlaneBrake: "BRAKES",
};
