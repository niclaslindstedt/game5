// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RANGES A REAL FACE IS FILED UNDER on the start card's RANGE row, by
// the key its crop row carries (`real-face-crops.mjs`'s `range`): a
// country's ISO 3166-1 alpha-2 code where a range's ski areas lie in one
// country, or a key of its own for a range across borders. One of the few
// files that names real places (the crop rows and the generated face index
// are the others) — a range, an area and a part of it, never a brand, a
// lift, a piste or a race.

export const RANGE_NAMES: Readonly<Record<string, string>> = {
  ALPS: "THE ALPS",
  AD: "ANDORRA",
  AR: "ARGENTINA",
  AT: "AUSTRIA",
  AU: "AUSTRALIA",
  BA: "BOSNIA",
  BG: "BULGARIA",
  CA: "CANADA",
  CH: "SWITZERLAND",
  CL: "CHILE",
  CN: "CHINA",
  CZ: "CZECHIA",
  DE: "GERMANY",
  ES: "SPAIN",
  FI: "FINLAND",
  FR: "FRANCE",
  GB: "BRITAIN",
  GE: "GEORGIA",
  GR: "GREECE",
  IN: "INDIA",
  IS: "ICELAND",
  IT: "ITALY",
  JP: "JAPAN",
  KR: "KOREA",
  LI: "LIECHTENSTEIN",
  NO: "NORWAY",
  NZ: "NEW ZEALAND",
  PL: "POLAND",
  RO: "ROMANIA",
  RS: "SERBIA",
  RU: "RUSSIA",
  SE: "SWEDEN",
  SI: "SLOVENIA",
  SK: "SLOVAKIA",
  TR: "TURKEY",
  US: "USA",
};
