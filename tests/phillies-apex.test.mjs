import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const file = new URL("../public/data/apex/PHI.json", import.meta.url);
const data = JSON.parse(await readFile(file, "utf8"));
const players = [...(data.candidates || []), ...(data.reserves || [])];
const byName = (name) => players.find((row) => row.name === name);
const apex = (name) => Number(byName(name)?.advancedStats?.APEX_R);
const position = (name, code) =>
  Number(byName(name)?.advancedStats?.positionBoards?.[code]?.APEX_R);

test("Phillies Franchise 400 is clean, unique, and Phillies-only", () => {
  assert.equal(players.length, 400);
  assert.equal(new Set(players.map((row) => row.mlbId)).size, 400);
  assert.ok(players.every((row) => row.advancedStats?.team === "PHI"));
  assert.ok(players.every((row) => Number(row.advancedStats?.franchiseSeasons) >= 3));
  const cliffLees = players.filter((row) => row.name === "Cliff Lee");
  assert.equal(cliffLees.length, 2);
  assert.notEqual(cliffLees[0].mlbId, cliffLees[1].mlbId);
  assert.notEqual(cliffLees[0].advancedStats.role, cliffLees[1].advancedStats.role);
});

test("Phillies identity anchors survive APEX 2.2 role and position calculations", () => {
  assert.ok(apex("Mike Schmidt") > apex("Chase Utley"));
  assert.ok(apex("Chase Utley") > apex("Ed Delahanty"));
  assert.ok(apex("Grover Alexander") > apex("Steve Carlton"));
  assert.ok(apex("Steve Carlton") > apex("Robin Roberts"));
  assert.ok(position("Mike Schmidt", "3B") > position("Scott Rolen", "3B"));
  assert.ok(position("Darren Daulton", "C") > position("J.T. Realmuto", "C"));
});
