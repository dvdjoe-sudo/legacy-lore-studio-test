import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newCandidate } from "../public/model.js";
import {
  draftRoster,
  lineupOrderNote,
  newRoster,
} from "../public/legends.js";
import { notableOmissions, rosterChecks } from "../public/roster-rules.js";
import { franchiseApex, rosterMetric } from "../public/apex-roster.js";

const source = JSON.parse(
  readFileSync(new URL("../public/data/apex/NYM.json", import.meta.url)),
);
const candidates = [
  ...source.candidates,
  ...(source.reserves || []),
].map((row, index) => {
  const candidate = newCandidate(row.name);
  candidate.id = `mets-${index}`;
  candidate.role = row.role;
  candidate.era = row.era;
  candidate.profile = {
    ...candidate.profile,
    mlbId: row.mlbId,
    pool: !row.rank,
    positions: row.positions,
    throws: row.throws || "",
    advancedStats: row.advancedStats,
  };
  return candidate;
});
for (const [index, row] of source.managers.entries()) {
  const candidate = newCandidate(row.name, "Manager / coach");
  candidate.id = `mets-manager-${index}`;
  candidate.role = "Manager";
  candidate.profile.managerStats = row.managerStats;
  candidates.push(candidate);
}
const name = (id) => candidates.find((candidate) => candidate.id === id)?.name;

test("Mets Clubhouse uses baseball-aware batting order and the power-bat DH rule", () => {
  const roster = draftRoster(candidates, newRoster(), candidates, "balanced"),
    order = roster.order.map((slot) => name(roster.slots[slot]));
  assert.equal(name(roster.slots.DH), "Pete Alonso");
  assert.equal(name(roster.slots.CI), "John Olerud");
  assert.notEqual(order[0], "Mike Piazza");
  assert.equal(order.indexOf("Mike Piazza"), 3);
  assert.match(lineupOrderNote(roster, candidates), new RegExp(`^${order[0]} leads off`));
  assert.match(lineupOrderNote(roster, candidates), new RegExp(`${order[1]} follows in the two-hole`));
});

test("DH slot compares on franchise hitting value, not the vestigial DH slice", () => {
  const byName = new Map(candidates.map((c) => [c.name, c])),
    alonso = byName.get("Pete Alonso"),
    metric = rosterMetric(alonso, "DH"),
    franchise = franchiseApex(alonso, "H");
  assert.equal(metric.label, franchise.label);
  assert.equal(metric.value, franchise.value);
  assert.ok(metric.value > 1, "Alonso shows real hitting value at DH, not ~0");
});

test("Mets automatic build explains lower-ranked role fits and blocks missing explanations", () => {
  const roster = draftRoster(candidates, newRoster(), candidates, "balanced");
  assert.match(roster.overrides.DH, /Automatic role-fit draft/);
  assert.equal(rosterChecks(roster, candidates).complete, true);
  delete roster.overrides.DH;
  const check = rosterChecks(roster, candidates);
  assert.ok(check.unexplainedOverrides.includes("DH"));
  assert.equal(check.complete, false);
});

test("slow catcher leadoff is rejected and notable omissions explain Al Leiter", () => {
  const roster = draftRoster(candidates, newRoster(), candidates, "balanced");
  roster.order = ["C", ...roster.order.filter((slot) => slot !== "C")];
  assert.match(rosterChecks(roster, candidates).errors.join(" "), /slow catcher/i);
  const leiter = notableOmissions(roster, candidates).find(
    (item) => item.name === "Al Leiter",
  );
  assert.ok(leiter);
  assert.match(leiter.reason, /28\.8 franchise WAR/);
  assert.match(leiter.reason, /rotation is limited to five/i);
});
