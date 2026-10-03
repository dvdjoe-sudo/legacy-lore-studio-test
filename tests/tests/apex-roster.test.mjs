import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newCandidate } from "../public/model.js";
import {
  APEX_ROSTER_MODULE_VERSION,
  catcherDefenseCompanion,
  dataConfidenceGrade,
  franchiseApex,
  octoberCompanion,
  rosterPosition,
  versatilityCompanion,
} from "../public/apex-roster.js";
import { assignSlot, cleanRoster, newRoster } from "../public/legends.js";
import { rosterChecks } from "../public/roster-rules.js";

const data = JSON.parse(
  readFileSync(new URL("../public/data/apex/PHI.json", import.meta.url)),
);
const rows = [...data.candidates, ...data.reserves];
const candidate = (name) => {
  const row = rows.find((item) => item.name === name);
  assert.ok(row, `${name} exists in the Phillies franchise pool`);
  const c = newCandidate(row.name);
  c.role = row.role;
  c.era = row.era;
  c.profile.mlbId = row.mlbId;
  c.profile.positions = row.positions;
  c.profile.throws = row.throws;
  c.profile.advancedStats = row.advancedStats;
  return c;
};

test("APEX 2.1 keeps regular APEX intact while complete October evidence adjusts APEX-F", () => {
  assert.match(APEX_ROSTER_MODULE_VERSION, /APEX 2\.1/);
  const utley = candidate("Chase Utley"),
    polanco = candidate("Plácido Polanco");
  assert.equal(franchiseApex(utley).value, utley.profile.advancedStats.APEX_F);
  assert.equal(utley.profile.advancedStats.APEX_R, 61.243710846815745);
  assert.ok(franchiseApex(utley).value > franchiseApex(polanco).value);
  assert.ok(rosterPosition(utley, "2B").value > rosterPosition(polanco, "2B").value);
  assert.ok(versatilityCompanion(polanco).value > versatilityCompanion(utley).value);
});

test("RosterPos credits Harper only for value earned at the selected position", () => {
  const harper = candidate("Bryce Harper"),
    full = franchiseApex(harper).value,
    first = rosterPosition(harper, "1B"),
    right = rosterPosition(harper, "RF");
  assert.ok(first.value > 0);
  assert.ok(first.value < full);
  assert.ok(right.value < full);
  assert.notEqual(first.value, right.value);
});

test("catcher defense uses separate windows and never treats missing evidence as zero", () => {
  const realmuto = candidate("J.T. Realmuto"),
    daulton = candidate("Darren Daulton"),
    modern = catcherDefenseCompanion(realmuto),
    earlier = catcherDefenseCompanion(daulton);
  assert.equal(modern.Prime5, modern.value);
  assert.ok(Number.isFinite(modern.Peak3));
  assert.ok(Number.isFinite(modern.Prime5));
  assert.ok(Number.isFinite(modern.Career));
  assert.equal(modern.framing.value, null);
  assert.equal(earlier.framing.value, null);
  assert.equal(earlier.blocking.per1000Innings, null);
  assert.equal(earlier.confidence, "medium");
  assert.ok(Number.isFinite(modern.throwing.aboveLeague));
  assert.match(modern.detail, /non-overlapping/);
  assert.ok(rosterPosition(daulton, "C").value > rosterPosition(realmuto, "C").value);
});

test("C-Peak3, C-Prime5 and C-Career ship as compact non-overlapping summaries", () => {
  const c = candidate("J.T. Realmuto"),
    raw = c.profile.advancedStats.catcherDefense,
    companion = catcherDefenseCompanion(c);
  assert.equal(companion.Peak3, raw.Peak3);
  assert.equal(companion.Prime5, raw.Prime5);
  assert.equal(companion.Career, raw.Career);
  assert.equal(raw.additiveToApexH, false);
  assert.equal(raw.runPrevention.overlappingSystemsAdded, false);
  assert.equal(raw.coverage.framingSeasons, 0);
  assert.equal(raw.seasons, undefined);
});

test("historical confidence and October availability labels stay honest", () => {
  const hamilton = candidate("Billy Hamilton"),
    utley = candidate("Chase Utley");
  assert.equal(dataConfidenceGrade(hamilton).grade, "C");
  assert.equal(dataConfidenceGrade(utley).grade, "A");
  assert.ok(Number.isFinite(octoberCompanion(utley).value));
  assert.equal(octoberCompanion(utley).status, "available");
  assert.equal(octoberCompanion(hamilton).value, null);
  assert.equal(octoberCompanion(hamilton).status, "unknown-not-zero");
});

test("Phillies position anchors keep Schmidt ahead of Rolen at third base", () => {
  assert.ok(
    rosterPosition(candidate("Mike Schmidt"), "3B").value >
      rosterPosition(candidate("Scott Rolen"), "3B").value,
  );
});

test("role-fit override notes survive backups and clear when a slot changes", () => {
  const utley = candidate("Chase Utley"),
    polanco = candidate("Plácido Polanco"),
    roster = newRoster();
  roster.slots["2B"] = polanco.id;
  let check = rosterChecks(roster, [utley, polanco]);
  assert.deepEqual(check.unexplainedOverrides, ["2B"]);
  roster.overrides["2B"] = "Polanco covers third base elsewhere in this roster.";
  const restored = cleanRoster(
    JSON.parse(JSON.stringify(roster)),
    [utley, polanco],
  );
  assert.equal(restored.overrides["2B"], roster.overrides["2B"]);
  check = rosterChecks(restored, [utley, polanco]);
  assert.deepEqual(check.unexplainedOverrides, []);
  const reassigned = assignSlot(restored, "2B", utley.id);
  assert.equal(reassigned.overrides["2B"], undefined);
});
