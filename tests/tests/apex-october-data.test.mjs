import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (team) =>
  JSON.parse(readFileSync(new URL(`../public/data/apex/${team}.json`, import.meta.url)));
const row = (team, name) => {
  const data = load(team);
  return [...data.candidates, ...(data.reserves || [])].find((item) => item.name === name);
};

test("Retrosheet October engine reproduces approved hitter and pitcher anchors", () => {
  const ortiz = row("BOS", "David Ortiz").advancedStats;
  const rivera = row("NYY", "Mariano Rivera").advancedStats;
  assert.equal(ortiz.apexOctoberEvidence.wpa, 3.2);
  assert.equal(rivera.apexOctoberEvidence.wpa, 11.7);
  assert.equal(ortiz.apexOctoberEvidence.method, "retrosheet-october-we-v2");
  assert.equal(rivera.retrosheetOctober.pitching.events, 527);
  assert.equal(rivera.retrosheetOctober.batting.events, 3);
});

test("signed October values flow into APEX-F at half strength", () => {
  for (const [team, name] of [
    ["BOS", "David Ortiz"],
    ["NYY", "Mariano Rivera"],
    ["PHI", "Dick Allen"],
  ]) {
    const stats = row(team, name).advancedStats;
    const expected =
      0.6 * Math.max(-6, Math.min(14, stats.apexOctoberEvidence.wpa)) +
      0.25 * Math.max(-4, Math.min(8, stats.apexOctoberEvidence.clutch));
    assert.ok(Math.abs(stats.APEX_OCT - expected) < 1e-12, name);
    assert.ok(
      Math.abs(stats.APEX_F - (stats.APEX_R + 0.5 * expected)) < 1e-12,
      name,
    );
  }
  assert.ok(row("PHI", "Dick Allen").advancedStats.APEX_OCT < 0);
});

test("automatic October evidence is sourced, attributed, and missing stays unknown", () => {
  let scored = 0;
  for (const team of [
    "ARI", "ATL", "BAL", "BOS", "CHC", "CWS", "CIN", "CLE", "COL", "DET",
    "HOU", "KC", "LAA", "LAD", "MIA", "MIL", "MIN", "NYM", "NYY", "ATH",
    "PHI", "PIT", "SD", "SF", "SEA", "STL", "TB", "TEX", "TOR", "WSH",
  ]) {
    const data = load(team);
    assert.equal(data.retrosheetOctober.version, "retrosheet-october-we-v2");
    for (const player of [...data.candidates, ...(data.reserves || [])]) {
      const stats = player.advancedStats;
      if (!stats.apexOctoberEvidence?.complete) {
        assert.equal(stats.APEX_OCT, null);
        assert.equal(stats.postseasonStatus, "unknown-not-zero");
        continue;
      }
      scored += 1;
      assert.match(stats.apexOctoberEvidence.source, /^https:\/\//);
      assert.match(stats.retrosheetOctober.attribution, /copyrighted by Retrosheet/);
      assert.ok(Number.isFinite(stats.retrosheetOctober.wpa));
      assert.ok(Number.isFinite(stats.retrosheetOctober.clutch));
      assert.ok(stats.retrosheetOctober.events > 0);
    }
  }
  assert.equal(scored, 4189);
});
