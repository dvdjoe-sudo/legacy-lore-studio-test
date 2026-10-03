import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newCandidate } from "../public/model.js";
import {
  draftRoster,
  meaningfulPositions,
  newRoster,
} from "../public/legends.js";

const loadTeam = (team) => {
  const source = JSON.parse(
    readFileSync(new URL(`../public/data/apex/${team}.json`, import.meta.url)),
  );
  return [...source.candidates, ...(source.reserves || [])].map((row, index) => {
    const candidate = newCandidate(row.name);
    candidate.id = `${team}-${index}`;
    candidate.role = row.role;
    candidate.era = row.era;
    candidate.profile = {
      ...candidate.profile,
      mlbId: row.mlbId,
      positions: row.positions,
      throws: row.throws || "",
      advancedStats: row.advancedStats,
    };
    return candidate;
  });
};

const rotation = (team) => {
  const candidates = loadTeam(team),
    roster = draftRoster(candidates, newRoster(), candidates, "balanced"),
    byId = new Map(candidates.map((c) => [c.id, c]));
  return [1, 2, 3, 4, 5].map((i) => byId.get(roster.slots[`SP${i}`]));
};

test("v0.4 rotation balance prefers a near-equal lefty but never forces a weak one", () => {
  // Houston gains a lefty at SP5 (Keuchel within range of the displaced arm).
  const hou = rotation("HOU"),
    houLefties = hou.filter(
      (c) => String(c.profile?.throws || "").toUpperCase() === "L",
    );
  assert.ok(houLefties.length >= 1, "Houston rotation adds a left-handed starter");
  assert.ok(
    houLefties.some((c) => c.name === "Dallas Keuchel"),
    "Keuchel is the balanced SP5 pick",
  );
  // Washington has no lefty within 25% of its five best arms: the guardrail
  // holds and the all-righty rotation stands.
  const wsh = rotation("WSH"),
    wshLefties = wsh.filter(
      (c) => String(c.profile?.throws || "").toUpperCase() === "L",
    );
  assert.equal(wshLefties.length, 0);
  assert.deepEqual(
    wsh.map((c) => c.name),
    [
      "Max Scherzer",
      "Steve Rogers",
      "Stephen Strasburg",
      "Pedro Martínez",
      "Dennis Martínez",
    ],
  );
});

test("DH rule 6 eligibility is 25%+ of team games or the most-played spot", () => {
  const player = (games, teamGames) => {
    const c = newCandidate("Test Player");
    c.role = "Infielder";
    c.profile.positions = ["2B", "SS", "3B"];
    c.profile.advancedStats = { positionGames: games, G: teamGames };
    return c;
  };
  // 120 games at SS out of 2000 team games (6%): not enough share, not the
  // most-played spot, so it does not count. 2B (1880) is the most-played.
  assert.ok(
    !meaningfulPositions(player({ SS: 120, "2B": 1880 }, 2000)).includes("SS"),
  );
  assert.ok(
    meaningfulPositions(player({ SS: 120, "2B": 1880 }, 2000)).includes("2B"),
  );
  // 60 games at 3B out of 200 (30%): counts on the share rule.
  assert.ok(
    meaningfulPositions(player({ "3B": 60, "1B": 140 }, 200)).includes("3B"),
  );
  // 60 games at 2B out of 400 (15%): too small a share, not most-played.
  assert.ok(
    !meaningfulPositions(player({ "2B": 60, "1B": 340 }, 400)).includes("2B"),
  );
  // 30-game cameo never counts, even as the player's top position (50-game floor).
  assert.ok(
    !meaningfulPositions(player({ LF: 30, CF: 20 }, 100)).includes("LF"),
  );
  // Most-played spot always counts, even under 25% (Wagner back to SS).
  assert.ok(
    meaningfulPositions(player({ SS: 180, "2B": 120, "3B": 100 }, 2000)).includes("SS"),
  );
});
