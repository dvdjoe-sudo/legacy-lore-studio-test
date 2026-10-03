import test from "node:test";
import assert from "node:assert/strict";
import {
  APEX_ROLE_FORMULA_VERSION,
  PITCHER_FORMULA_VERSION,
  pitcherSeasonDominance,
  legacySeasonDominance,
  apexCareer,
  apexOctober,
  apexFranchiseScore,
  applyApexOctoberEvidence,
  estimatedRoleApex,
  pitchingStintAllocation,
} from "../public/apex-formula.js";

test("role-separated pitcher season caps innings and unlocks replacement value", () => {
  assert.equal(PITCHER_FORMULA_VERSION, APEX_ROLE_FORMULA_VERSION);
  assert.equal(APEX_ROLE_FORMULA_VERSION, "APEX 2.2 Test · 2026-09-29");
  const result = pitcherSeasonDominance({ waa: 6, rep: 5, ip: 300 });
  const k = 275 / 300;
  const x = 6 * k;
  const g = x / (x + 1);
  assert.equal(result.k, k);
  assert.equal(result.WAA_CAP, x);
  assert.equal(result.REP_CAP, 5 * k);
  assert.ok(Math.abs(result.D - (x ** 1.35 + 0.2 * 5 * k * g)) < 1e-12);
});

test("APEX 2.2 shifts the career blend toward peak and prime", () => {
  const result = apexCareer([
    { year: 2000, D: 10 },
    { year: 2001, D: 9 },
    { year: 2002, D: 6 },
    { year: 2003, D: 3 },
    { year: 2004, D: 2 },
    { year: 2005, D: 10 },
  ]);
  assert.equal(result.Peak3, 29);
  assert.equal(result.Prime5, 30);
  assert.equal(result.Career, 40);
  assert.equal(result.score, 33.75);
});

test("October is signed, clipped, half-strength, and never invented", () => {
  const missing = apexOctober({ wpa: 10, clutch: 4 });
  assert.equal(missing.complete, false);
  assert.equal(missing.contribution, null);
  assert.equal(apexFranchiseScore(40, missing), 40);
  const high = apexOctober({ wpa: 99, clutch: 99, complete: true });
  assert.equal(high.raw, 10.4);
  assert.equal(high.contribution, 5.2);
  assert.equal(apexFranchiseScore(40, high), 45.2);
  const low = apexOctober({ wpa: -99, clutch: -99, complete: true });
  assert.equal(low.raw, -4.6);
  assert.equal(low.contribution, -2.3);
  assert.equal(apexFranchiseScore(40, low), 37.7);
});

test("verified October evidence updates the visible franchise total and every role lane", () => {
  const stats = {
    APEX_R: 40,
    APEX_F: 40,
    apexBoards: {
      H: { APEX_R: 40, APEX_F: 40 },
      SP: { APEX_R: 3, APEX_F: 3 },
      RP: { APEX_R: 1, APEX_F: 1 },
    },
  };
  const scored = applyApexOctoberEvidence(stats, {
    wpa: 3.2,
    clutch: 1.4,
    complete: true,
    source: "https://www.baseball-reference.com/postseason/Playoffs_batting.shtml",
    checkedAt: "2026-09-29T00:00:00.000Z",
  });
  assert.equal(scored.APEX_OCT, 2.27);
  assert.equal(scored.APEX_OCT_CONTRIBUTION, 1.135);
  assert.equal(scored.APEX_F, 41.135);
  assert.equal(scored.apexBoards.H.APEX_F, 41.135);
  assert.equal(scored.postseasonIncluded, true);
  assert.equal(stats.APEX_F, 40, "the helper must not mutate saved data in place");
});

test("unverified October values stay a preview and do not change APEX-F", () => {
  const scored = applyApexOctoberEvidence(
    { APEX_R: 40, APEX_F: 40, apexBoards: {} },
    { wpa: 3.2, clutch: 1.4, complete: false, source: "" },
  );
  assert.equal(scored.APEX_OCT, null);
  assert.equal(scored.APEX_OCT_CONTRIBUTION, null);
  assert.equal(scored.APEX_F, 40);
  assert.equal(scored.postseasonStatus, "unknown-not-zero");
});

test("negative pitcher WAA adds no dominance points", () => {
  const result = pitcherSeasonDominance({ waa: -1, rep: 4, ip: 180 });
  assert.equal(result.D, 0);
  assert.equal(result.g, 0);
});

test("Prime5 removes returned interior gaps of one to three empty years", () => {
  const career = apexCareer([
    { year: 2000, D: 8 },
    { year: 2002, D: 7 },
    { year: 2005, D: 10 },
  ]);
  assert.equal(career.Peak3, 25);
  assert.equal(career.Prime5, 25);
  assert.equal(career.Reign, 25);
  assert.equal(career.score, 25);
});

test("APEX-H season formula uses positive batting-file WAA and replacement value", () => {
  const expected = 4 ** 1.35 + 0.2 * 3;
  assert.equal(legacySeasonDominance({ waa: 4, rep: 3 }), expected);
});

test("APEX-H tapers replacement credit for junk and cup-of-coffee seasons", () => {
  assert.equal(legacySeasonDominance({ waa: -2, rep: 1 }), 0);
  const partial = legacySeasonDominance({ waa: 0.1, rep: 0.1 });
  assert.ok(partial > 0.1 ** 1.35);
  assert.ok(partial < 0.1 ** 1.35 + 0.02);
});

test("APEX-RP uses the 120 inning cap and leverage cannot rescue negative core WAA", () => {
  const capped = pitcherSeasonDominance({
    waa: 4,
    rep: 2,
    waaAdj: 1,
    ip: 240,
    leverage: true,
    role: "RP",
  });
  assert.equal(capped.k, 0.5);
  assert.ok(capped.LEVERAGE > 0);
  const negative = pitcherSeasonDominance({
    waa: -1,
    rep: 3,
    waaAdj: 8,
    ip: 60,
    leverage: true,
    role: "RP",
  });
  assert.equal(negative.LEVERAGE, 0);
  assert.equal(negative.D, 0);
});

test("starter and relief boards are explicitly labeled estimates", () => {
  const seasons = [
    {
      year: 2010,
      IPouts: 300,
      startOuts: 210,
      reliefOuts: 90,
      pitchWAA: 2,
      pitchREP: 1.5,
      pitchWAAAdj: 0.4,
    },
  ];
  const sp = estimatedRoleApex(seasons, "SP");
  const rp = estimatedRoleApex(seasons, "RP");
  assert.equal(sp.approximation, true);
  assert.equal(rp.approximation, true);
  assert.match(sp.reason, /estimated from starter\/relief innings share/i);
  assert.ok(sp.score > 0);
  assert.ok(rp.score > 0);
});

test("pitching stints split WAA and replacement value before annual dominance", () => {
  const exact = pitchingStintAllocation({
    IPouts: 300,
    IPouts_start: 225,
    IPouts_relief: 75,
    WAA: 4,
    WAR_rep: 2,
    WAA_adj: 0.6,
    G: 20,
    GS: 15,
  });
  assert.equal(exact.splitSource, "innings");
  assert.equal(exact.spOuts, 225);
  assert.equal(exact.rpOuts, 75);
  assert.equal(exact.spWAA, 3);
  assert.equal(exact.rpWAA, 1);
  assert.equal(exact.spREP, 1.5);
  assert.equal(exact.rpREP, 0.5);
  assert.equal(exact.rpWAAAdj, 0.6);
  assert.equal(exact.mixedRole, true);

  const fallback = pitchingStintAllocation({
    IPouts: 120,
    G: 10,
    GS: 2,
    WAA: 1,
    WAR_rep: 0.5,
  });
  assert.equal(fallback.splitSource, "gs-g-fallback");
  assert.equal(fallback.spOuts, 24);
  assert.equal(fallback.rpOuts, 96);
});

test("Prime5 does not stitch a gap longer than three empty years", () => {
  const career = apexCareer(
    [
      { year: 1942, D: 10 },
      { year: 1947, D: 9 },
      { year: 1948, D: 8 },
      { year: 1949, D: 7 },
      { year: 1950, D: 6 },
    ],
  );
  assert.equal(career.Prime5, 30);
  assert.equal(career.Career, 40);
  assert.equal(career.score, 33.25);
});
