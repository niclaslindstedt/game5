// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY'S SUN AND MOON ARE THE REAL ONES: a few rows of `make sky-solar`
// held as numbers — the sun against the NOAA reference (after Meeus, with
// the refraction) at places across the world and the year, the midnight
// sun and the polar night, the moon on its real orbit and phase — and a
// real face stood at its own place on the globe (`withPlace`), the south
// half a year on.

import { describe, expect, it } from "vitest";
import {
  SKY_YEAR,
  clockHourOf,
  dayOfYearOf,
  hourOfTime,
  moonAtRun,
  realFacePlace,
  seasonDay,
  sunAtRun,
  sunWindowOf,
  withPlace,
} from "@engine";

const DEG = Math.PI / 180;

type Sun = {
  hour: number;
  dayOfYear: number;
  latitude: number;
  longitude?: number;
  facing?: number;
};
const at = (sun: Sun) => ({ sun });
const compass = (rad: number): number => (((rad / DEG) % 360) + 360) % 360;

describe("the sun stands where it really stands", () => {
  // Reference rows off `scripts/lib/solar-reference.mjs` (2026): the
  // apparent (refracted) elevation and the compass azimuth, °; sunrise and
  // sunset (the upper limb, refracted) in apparent solar hours.
  const ROWS = [
    {
      name: "the alps in February, mid-morning",
      sun: { hour: 10, dayOfYear: 46, latitude: 45.3, longitude: 6.59 },
      el: 26.094,
      az: 147.1,
      rise: 6.7913,
      set: 17.2195,
    },
    {
      name: "the far north at midsummer midnight",
      sun: { hour: 0, dayOfYear: 172, latitude: 69, longitude: 15 },
      el: 2.695,
      az: 0,
      rise: null,
      set: null,
    },
    {
      name: "the far south in its July",
      sun: { hour: 9, dayOfYear: 201, latitude: -45.05, longitude: 168.8 },
      el: 12.604,
      az: 42.653,
      rise: 7.3943,
      set: 16.6115,
    },
    {
      name: "a summer noon at 36°N",
      sun: { hour: 12, dayOfYear: 196, latitude: 36, longitude: 135 },
      el: 75.535,
      az: 180,
      rise: 4.8095,
      set: 19.1849,
    },
  ];

  it("is dated in one nominal year", () => {
    expect(SKY_YEAR).toBe(2026);
  });

  for (const row of ROWS) {
    it(`to a few hundredths of a degree: ${row.name}`, () => {
      const sun = sunAtRun(at(row.sun));
      expect(Math.abs(sun.elevation / DEG - row.el)).toBeLessThan(0.05);
      const dAz = ((compass(sun.azimuth) - row.az + 540) % 360) - 180;
      expect(Math.abs(dAz)).toBeLessThan(0.05);
      const w = sunWindowOf(at(row.sun));
      if (row.rise === null) {
        expect(w).toEqual({ min: 0, max: 24 });
      } else {
        expect(Math.abs(w!.min - row.rise) * 60).toBeLessThan(1);
        expect(Math.abs(w!.max - (row.set ?? 0)) * 60).toBeLessThan(1);
      }
    });
  }

  it("is lifted by the air: seen over the horizon while it stands under it", () => {
    const level = at({ hour: 12, dayOfYear: 46, latitude: 45.3, longitude: 6.59 });
    const rise = sunWindowOf(level)!.min;
    // The upper limb's sunrise: the centre 0.833° down, seen ~0.4° higher.
    const up = sunAtRun({ sun: { ...level.sun, hour: rise } });
    expect(up.trueElevation / DEG).toBeCloseTo(-0.833, 3);
    expect(up.elevation - up.trueElevation).toBeGreaterThan(0.3 * DEG);
    // Minutes later the centre is seen over the horizon while still under it.
    const later = sunAtRun({ sun: { ...level.sun, hour: rise + 4 / 60 } });
    expect(later.trueElevation).toBeLessThan(0);
    expect(later.elevation).toBeGreaterThan(0);
  });

  it("never sets under the midnight sun and never rises in the polar night", () => {
    expect(sunWindowOf(at({ hour: 12, dayOfYear: 172, latitude: 69 }))).toEqual({
      min: 0,
      max: 24,
    });
    expect(sunWindowOf(at({ hour: 12, dayOfYear: 355, latitude: 69 }))).toBeNull();
    // ...the polar night's noon a civil twilight still, its sun under the horizon.
    const noon = sunAtRun(at({ hour: 12, dayOfYear: 355, latitude: 69 }));
    expect(noon.elevation).toBeLessThan(0);
    expect(noon.trueElevation).toBeGreaterThan(-6 * DEG);
    // The lowest midsummer sun at 69°N stands a couple of degrees up.
    const midnight = sunAtRun(at({ hour: 24, dayOfYear: 172, latitude: 69 }));
    expect(midnight.elevation / DEG).toBeGreaterThan(2);
    expect(midnight.elevation / DEG).toBeLessThan(3.5);
  });

  it("puts NIGHT at midnight where there is no sunset to count from", () => {
    expect(hourOfTime(69, 172, "night")).toBe(24);
    expect(hourOfTime(69, 355, "night")).toBe(24);
    const night = hourOfTime(45, 46, "night");
    expect(night).toBeGreaterThan(19);
    expect(night).toBeLessThan(21);
  });
});

describe("the moon is the real one on its date", () => {
  it("stands within a degree of the reference, lit by its real phase", () => {
    // Reference: 15 Feb 2026, 10h solar at 45.3°N 6.59°E — 20.71° up at
    // 174.12°, 4.6 % lit; 15 Jul, noon at 36°N 135°E — 72.58° up, 0.8 % lit.
    const a = moonAtRun(at({ hour: 10, dayOfYear: 46, latitude: 45.3, longitude: 6.59 }));
    expect(Math.abs(a.elevation / DEG - 20.71)).toBeLessThan(1);
    expect(Math.abs(compass(a.azimuth) - 174.12)).toBeLessThan(1);
    expect(a.lit).toBeCloseTo(0.046, 2);
    const b = moonAtRun(at({ hour: 12, dayOfYear: 196, latitude: 36, longitude: 135 }));
    expect(Math.abs(b.elevation / DEG - 72.58)).toBeLessThan(1);
    expect(b.lit).toBeLessThan(0.02);
  });

  it("rides a winter's full moon high", () => {
    // 3 January 2026 is full: round midnight at 45°N it stands over 60° up.
    const full = moonAtRun(at({ hour: 0, dayOfYear: 3, latitude: 45 }));
    expect(full.lit).toBeGreaterThan(0.95);
    expect(full.elevation / DEG).toBeGreaterThan(60);
  });
});

describe("a real face is skied at its own place", () => {
  const dealt = { hour: 11, dayOfYear: 46, latitude: 45, facing: 3 };

  it("takes the face's latitude, longitude and true north", () => {
    const place = realFacePlace("alpine-1")!;
    const level = withPlace(at(dealt), place);
    expect(level.sun.latitude).toBe(place.lat);
    expect(level.sun.longitude).toBe(place.lon);
    expect(level.sun.facing).toBeCloseTo(compass(place.bearing * DEG) * DEG, 9);
    expect(level.sun.dayOfYear).toBe(46);
    // ...and stood there again, it is the same map.
    expect(withPlace(level, place)).toBe(level);
    expect(withPlace(level, null)).toBe(level);
  });

  it("is skied in its own winter south of the equator", () => {
    const place = realFacePlace("continental-23")!;
    expect(place.lat).toBeLessThan(0);
    const level = withPlace(at(dealt), place);
    expect(level.sun.dayOfYear).toBe(dayOfYearOf(46 + 182));
    expect(seasonDay(20, place.lat)).toBe(202);
    expect(seasonDay(20, 45)).toBe(20);
    // A late-morning sun stands low and to the NORTH.
    const sun = sunAtRun(level);
    const bearing = compass(sun.azimuth + (level.sun.facing ?? 0));
    expect(bearing).toBeLessThan(90);
    expect(sun.elevation / DEG).toBeGreaterThan(10);
    expect(sun.elevation / DEG).toBeLessThan(35);
  });

  it("keeps the hour's place in the day", () => {
    const place = realFacePlace("maritime-4")!; // 68.4°N
    const level = withPlace(at({ hour: 10, dayOfYear: 30, latitude: 62 }), place);
    expect(sunAtRun(level).elevation).toBeGreaterThan(0);
    const evening = withPlace(at({ hour: 19, dayOfYear: 30, latitude: 62 }), place);
    expect(sunAtRun(evening).elevation).toBeLessThan(-5 * DEG);
  });

  it("reads the place's clock off the sun's hour", () => {
    // 6.59°E in the zone of the prime meridian on 15 February: 26 min of
    // longitude ahead of the zone, and the sun 14 min late on its mean
    // (the equation of time) — solar noon is 11:48 on a watch.
    const level = at({ hour: 12, dayOfYear: 46, latitude: 45.3, longitude: 6.59 });
    expect(clockHourOf(level, 12)).toBeCloseTo(12 - (6.59 * 4) / 60 + 14.12 / 60, 2);
    // A generated map has no longitude: its clock is the sun's.
    expect(clockHourOf(at({ hour: 12, dayOfYear: 46, latitude: 45 }), 13.5)).toBe(13.5);
  });
});
