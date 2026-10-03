import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newCandidate } from "../public/model.js";
import {
  retrosheetEvidenceHTML,
  retrosheetPitchingWork,
  retrosheetPositionGames,
  retrosheetProfile,
  retrosheetRoleEvidence,
} from "../public/retrosheet.js";
import {
  positionGames,
  rosterEligibility,
  slotFitExplanation,
} from "../public/legends.js";
import { catcherDefenseCompanion } from "../public/apex-roster.js";

const data = JSON.parse(
  readFileSync(new URL("../public/data/apex/NYY.json", import.meta.url)),
);
const rows = [...data.candidates, ...data.reserves];
const candidate = (name) => {
  const row = rows.find((item) => item.name === name);
  assert.ok(row, `${name} exists in the Yankees franchise pool`);
  const c = newCandidate(row.name);
  c.role = row.role;
  c.era = row.era;
  c.profile.positions = row.positions;
  c.profile.throws = row.throws;
  c.profile.advancedStats = row.advancedStats;
  return c;
};

test("Yankees pilot matches every Franchise 400 player without changing APEX", () => {
  assert.equal(data.version, 11);
  assert.equal(data.retrosheet.matched, 400);
  assert.deepEqual(data.retrosheet.unmatched, []);
  assert.ok(rows.every((row) => row.advancedStats.retrosheet));
  const ruth = candidate("Babe Ruth");
  assert.equal(ruth.profile.advancedStats.APEX_R, 146.6574123397192);
  assert.equal(retrosheetProfile(ruth).version, "retrosheet-yankees-pilot-v2");
});

test("Retrosheet supplies exact bullpen workload and role evidence", () => {
  const rivera = candidate("Mariano Rivera"),
    work = retrosheetPitchingWork(rivera),
    role = retrosheetRoleEvidence(rivera);
  assert.equal(work.reliefGames, 1105);
  assert.equal(work.reliefInnings, 1233.7);
  assert.equal(work.saves, 652);
  assert.equal(role.role, "Closer");
  assert.equal(rosterEligibility(rivera, "CL").eligible, true);
  assert.match(slotFitExplanation(rivera, "CL"), /closer from game logs/i);
});

test("Retrosheet position innings and catcher evidence support roster companions", () => {
  const berra = candidate("Yogi Berra"),
    retro = retrosheetProfile(berra),
    catcher = catcherDefenseCompanion(berra);
  assert.equal(retrosheetPositionGames(berra, "C"), 1694);
  assert.equal(positionGames(berra, "C"), 1694);
  assert.equal(retro.catcher.workload.innings, 14346.7);
  assert.ok(retro.catcher.throwing.aboveLeague > 0);
  assert.ok(Number.isFinite(retro.catcher.blocking.per1000Innings));
  assert.equal(catcher.workload.innings, 14346.7);
  assert.match(catcher.detail, /Retrosheet supplies/);
});

test("player cards show sourced regular-season and postseason game evidence", () => {
  const jeter = candidate("Derek Jeter"),
    retro = retrosheetProfile(jeter),
    html = retrosheetEvidenceHTML(jeter, String);
  const season1999 = retro.yearly.find((season) => season.year === 1999);
  assert.equal(season1999.batting.b_pa, 739);
  assert.equal(season1999.batting.b_h, 219);
  assert.equal(season1999.positions.SS.games, 158);
  assert.equal(retro.playerUrl, "https://www.retrosheet.org/boxesetc/J/Pjeted001.htm");
  assert.ok(retro.moments.postseason.length > 0);
  assert.ok(retro.moments.postseason.every((moment) => moment.url.startsWith("https://www.retrosheet.org/boxesetc/")));
  assert.match(html, /Franchise batting career/);
  assert.match(html, /Year-by-year franchise stats · 20 seasons/);
  assert.match(html, /Open Retrosheet career page and yearly game logs/);
  assert.match(html, /Documented game highlights/);
  assert.match(html, /copyrighted by Retrosheet/);
  assert.match(html, /Open Retrosheet box score/);
});
