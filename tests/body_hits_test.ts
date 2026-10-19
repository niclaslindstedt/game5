// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON RUN INTO (`engine/game/person-hit.ts`, `body-person.ts`): the
// player meeting an amateur at speed is two bodies of their real masses
// colliding — a shoulder at a crawl, both thrown and both badly hurt at
// speed with the INJURIES switch on, nobody hurt past a knock with it off,
// and the bodies that need collecting listed for the rescue.

import { describe, expect, it } from "vitest";
import { CROWD_LOOKS } from "../pwa/src/game/crowd-rig.ts";
import { casualtiesOf, CROWD_BODIES, PERSON_HIT, personGive, type GameEvent } from "@engine";

import { hitRow, rideOn, stageMeeting } from "./support/body-hits.ts";

const CRUSH = /Ribs|Chest|Pelvis|pelvis|Femur|lacerated|Liver|Spleen|Lung|Neck|brain/;

describe("a person run into", () => {
  it("at 10 km/h is a shoulder: no collision, nobody down", () => {
    const { state, a, events } = stageMeeting(10, "man", true);
    expect(events.some((e) => e.kind === "struck")).toBe(false);
    expect(events.some((e) => e.kind === "bump")).toBe(true);
    expect(a.mode).not.toBe("down");
    expect(state.skier.thrown).toBeFalsy();
  });

  it("past the strike speed is a collision, reported with the spot and both outcomes", () => {
    const { state, a, events } = stageMeeting(60, "man", true);
    const e = events.find((x): x is Extract<GameEvent, { kind: "struck" }> => x.kind === "struck");
    expect(e).toBeDefined();
    expect(e!.amateur).toBe(a.id);
    expect(e!.speed).toBeCloseTo(60 / 3.6, 1);
    // Two grown bodies: each takes about half the closing speed.
    expect(e!.taken / e!.speed).toBeGreaterThan(0.4);
    expect(e!.given / e!.speed).toBeGreaterThan(0.45);
    expect(e!.thrown).toBe(true);
    expect(e!.killed).toBe(true);
    expect(Math.abs(e!.z - (state.skier.z + a.z) / 2)).toBeLessThan(1);
    // Both thrown, the player with what the exchange left him.
    expect(state.skier.thrown?.cause).toBe("skier");
    expect(state.skier.thrown!.vz).toBeLessThan(60 / 3.6 - e!.taken + 1);
    expect(a.mode).toBe("down");
    expect(a.thrown!.vz).toBeGreaterThan(5);
  });

  it("at 30 km/h with injuries on: the player bruised, the amateur hurt past getting up", () => {
    const r = hitRow(30, "man", true);
    expect(r.thrown).toBe(false);
    expect(r.dead).toBe(false);
    expect(r.injuries.length).toBeGreaterThan(0);
    expect(r.injured).toBe(true);
    expect(r.killed).toBe(false);
    expect(r.up).toBe(false);
    expect(r.casualties).toEqual(["amateur hurt"]);
  });

  it("at 60 and 90 km/h with injuries on: two bodies to collect, crushed", () => {
    for (const kmh of [60, 90]) {
      const r = hitRow(kmh, "man", true);
      expect(r.thrown, `${kmh}`).toBe(true);
      expect(r.killed, `${kmh}`).toBe(true);
      expect(r.worst, `${kmh}`).toBeGreaterThanOrEqual(4);
      expect(r.injuries.filter((k) => CRUSH.test(k)).length, `${kmh}`).toBeGreaterThanOrEqual(3);
      expect(r.dead || r.down, `${kmh}`).toBe(true);
      expect(r.casualties.length, `${kmh}`).toBe(2);
    }
    // The faster, the more crushed he is.
    expect(hitRow(90, "man", true).crush).toBeGreaterThan(hitRow(60, "man", true).crush);
  });

  it("a child takes far more of it than the grown man who hits him", () => {
    const r = hitRow(45, "child", true);
    expect(r.killed).toBe(true);
    expect(r.dead).toBe(false);
    expect(r.worst).toBeLessThan(4);
  });

  it("with injuries off nobody is killed or held down: knocked over, and up again", () => {
    for (const kmh of [30, 60, 90]) {
      const r = hitRow(kmh, "man", false, 20);
      expect(r.knocked, `${kmh}`).toBe(true);
      expect(r.killed || r.injured || r.crush > 0, `${kmh}`).toBe(false);
      expect(r.up, `${kmh}`).toBe(true);
      expect(r.dead || r.down, `${kmh}`).toBe(false);
      expect(r.casualties, `${kmh}`).toEqual([]);
    }
    expect(hitRow(90, "man", false).thrown).toBe(true);
  });

  it("casualtiesOf lists where the body lies, where it was struck, and when", () => {
    const { state, a } = stageMeeting(90, "man", true);
    const t = state.t;
    rideOn(state, 6);
    const list = casualtiesOf(state);
    const him = list.find((k) => k.who === "amateur")!;
    expect(him.id).toBe(a.id);
    expect(him.dead).toBe(true);
    expect(him.cause).toBe("skier");
    expect(him.t).toBe(t);
    expect(him.points?.length).toBe(a.thrown!.points.length);
    expect(him.crush).toBeGreaterThan(0.5);
    // Flung on down from the spot he was struck at.
    expect(him.z - him.impact!.z).toBeGreaterThan(2);
    const me = list.find((k) => k.who === "player")!;
    expect(me.id).toBe(-1);
    expect(me.impact).not.toBeNull();
    expect(me.cause).toBe("skier");
  });

  it("the same meeting is the same casualties, step for step", () => {
    const one = stageMeeting(60, "man", true);
    const two = stageMeeting(60, "man", true);
    rideOn(one.state, 3);
    rideOn(two.state, 3);
    expect(one.state.skier.body.injuries).toEqual(two.state.skier.body.injuries);
    expect(casualtiesOf(one.state)).toEqual(casualtiesOf(two.state));
  });

  it("a body gives softly to a slow blow and hardly at all to a fast one", () => {
    expect(personGive(0)).toBe(PERSON_HIT.give.soft);
    expect(personGive(PERSON_HIT.give.at * 2)).toBeCloseTo(PERSON_HIT.give.hard, 9);
  });

  it("every body's height is the figure's", () => {
    for (const b of CROWD_BODIES) expect(PERSON_HIT.height[b], b).toBe(CROWD_LOOKS[b].height);
  });
});
