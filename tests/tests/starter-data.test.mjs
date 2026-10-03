import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TEAMS,
  newCandidate,
  seedState,
  validateImport,
} from "../public/model.js";
import { draftRoster, newRoster } from "../public/legends.js";
import { rosterChecks } from "../public/roster-rules.js";

const load = (team) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../public/data/apex/${team}.json`, import.meta.url),
      "utf8",
    ),
  );

test("every franchise ships with a strict-tenure Franchise 400 pool and ordered Top 200", () => {
  assert.equal(TEAMS.length, 30);
  for (const [team] of TEAMS) {
    const data = load(team);
    assert.equal(data.version, team === "NYY" ? 11 : 9);
    assert.equal(data.team, team);
    assert.equal(data.candidates.length, Math.min(200, data.rules.cap, data.candidates.length + data.reserves.length), team);
    assert.ok(data.candidates.length + data.reserves.length <= 400, team + " pool cap");
    assert.equal(data.rules.tenureSeasons, 3);
    assert.equal(data.rules.top, 200);
    assert.ok(
      [...data.candidates, ...data.reserves].some(
        (row) => row.advancedStats.role === "RP" && row.throws === "L",
      ),
      team + " left-handed relief reserve",
    );
    assert.ok(
      data.managers.length >= 5 && data.managers.length <= 10,
      team + " manager choices",
    );
    assert.ok(
      data.managers.every(
        (row) => row.managerStats.G >= 100 && row.managerStats.seasons >= 1,
      ),
      team + " manager records",
    );
    assert.equal(
      new Set(data.candidates.map((row) => row.mlbId || row.name.toLowerCase())).size,
      data.candidates.length,
      team,
    );
    data.candidates.forEach((row, index) => {
      assert.equal(row.rank, index + 1, `${team} rank ${index + 1}`);
      assert.equal(row.advancedStats.version, "role-lane-v3");
      assert.equal(row.advancedStats.team, team);
      assert.ok(["BAT", "SP", "RP", "TWO"].includes(row.advancedStats.role));
      assert.ok(Number.isFinite(row.advancedStats.APEX_R));
      assert.ok(Number.isFinite(row.advancedStats.APEX_F));
      const october = row.advancedStats.apexOctoberEvidence;
      if (october?.complete) {
        assert.equal(october.method, "retrosheet-october-we-v2");
        assert.ok(Number.isFinite(row.advancedStats.APEX_OCT));
        // Stored APEX_F can differ from the recomputed sum by 1 ULP of
        // floating-point noise from data generation; compare with tolerance.
        const expected =
          row.advancedStats.APEX_R + row.advancedStats.APEX_OCT_CONTRIBUTION;
        assert.ok(
          Math.abs(row.advancedStats.APEX_F - expected) < 1e-9,
          `${team} ${row.name}: APEX_F additive within float tolerance`,
        );
      } else {
        assert.equal(row.advancedStats.APEX_F, row.advancedStats.APEX_R);
        assert.equal(row.advancedStats.APEX_OCT, null);
      }
      assert.ok(Number.isFinite(row.advancedStats.totalWAR));
      assert.ok(Number.isFinite(row.advancedStats.WAA));
      assert.equal(row.advancedStats.postseasonIncluded, Boolean(october?.complete));
      assert.equal(
        row.advancedStats.formulaVersion,
        "APEX 2.2 Test · 2026-09-29",
      );
      assert.equal(
        row.advancedStats.postseasonStatus,
        october?.complete ? "available" : "unknown-not-zero",
      );
      assert.ok(row.advancedStats.franchiseSeasons >= 3);
      assert.equal(row.advancedStats.intake.eligibleTenure, true);
      assert.ok(["H", "SP", "RP"].includes(row.advancedStats.intake.assignedPool));
      assert.ok(["H", "SP", "RP"].includes(row.advancedStats.primaryBoard));
      assert.ok(row.advancedStats.positionBoards);
      assert.ok(row.advancedStats.eraChapters);
      for (const code of ["H", "SP", "RP"]) {
        const lane = row.advancedStats.apexBoards[code];
        assert.equal(lane.code, code);
        assert.ok(Number.isFinite(lane.APEX_R));
        assert.ok(Number.isFinite(lane.Peak3));
        assert.ok(Number.isFinite(lane.Prime5));
        assert.ok(Number.isFinite(lane.Career));
        assert.equal(lane.postseasonIncluded, Boolean(october?.complete));
      }
      if (index)
        assert.ok(
          data.candidates[index - 1].advancedStats.APEX_R >=
            row.advancedStats.APEX_R,
          `${team} order at ${index + 1}`,
        );
      if (row.advancedStats.role === "SP" || row.advancedStats.role === "RP") {
        assert.deepEqual(row.positions, [row.advancedStats.role]);
        assert.ok(["APEX-SP", "APEX-RP"].includes(row.advancedStats.scoreBoard));
        assert.equal(row.advancedStats.roleSplitOfficial, false);
      }
    });
    for (const code of ["H", "SP", "RP"]) {
      const eligible = [...data.candidates, ...data.reserves]
        .filter((row) => row.advancedStats.apexBoards[code].eligible)
        .sort(
          (a, b) =>
            b.advancedStats.apexBoards[code].APEX_R -
              a.advancedStats.apexBoards[code].APEX_R ||
            a.name.localeCompare(b.name),
        );
      eligible.forEach((row, index) => {
        const laneRank = row.advancedStats.apexBoards[code].rank;
        assert.ok(Number.isInteger(laneRank) && laneRank >= 1);
        if (index)
          assert.ok(
            laneRank > eligible[index - 1].advancedStats.apexBoards[code].rank,
            `${team} ${code} lane rank`,
          );
      });
    }
  }
});

test("the approved Royals APEX anchors are reproduced by the bulk data", () => {
  const rows = load("KC").candidates;
  assert.deepEqual(
    rows.slice(0, 3).map((row) => row.name),
    ["George Brett", "Kevin Appier", "Bret Saberhagen"],
  );
  assert.equal(rows[0].advancedStats.APEX_R.toFixed(1), "71.0");
  assert.equal(rows[0].advancedStats.totalWAR.toFixed(1), "88.6");
  assert.equal(rows[0].advancedStats.WAA.toFixed(1), "50.6");
  assert.equal(rows.find((row) => row.name === "Frank White")?.rank, 19);
  assert.equal(
    rows.find((row) => row.name === "Frank White")?.advancedStats
      .positionBoards["2B"].rank,
    1,
  );
});

test("every franchise can auto-build all 26 roles from its included player pool", () => {
  for (const [team] of TEAMS) {
    const data = load(team),
      players = [...data.candidates, ...data.reserves].map((row, index) => {
        const c = newCandidate(row.name);
        c.id = `${team}-player-${index}`;
        c.role = row.role;
        c.era = row.era;
        c.profile = {
          ...c.profile,
          positions: row.positions,
          throws: row.throws || "",
          advancedStats: row.advancedStats,
        };
        return c;
      });
    const managers = data.managers.map((row, index) => {
        const c = newCandidate(row.name, "Manager / coach");
        c.id = `${team}-manager-${index}`;
        c.role = "Manager";
        c.profile = { ...c.profile, managerStats: row.managerStats };
        return c;
      }),
      all = [...players, ...managers],
      roster = draftRoster(all, newRoster()),
      check = rosterChecks(roster, all);
    assert.equal(
      check.complete,
      true,
      `${team}: ${check.errors.join("; ")} · ${check.warnings.join("; ")}`,
    );
    assert.ok(roster.manager, team + " manager");
  }
});

test("all built-in ranked players and roster reserves pass backup validation together", () => {
  const state = seedState();
  let expected = 0;
  for (const [team] of TEAMS) {
    const data = load(team);
    state.boards[team].mode = "apex";
    state.boards[team].candidates = [...data.candidates, ...data.reserves].map(
      (row, index) => {
        const candidate = newCandidate(row.name);
        candidate.id = `starter-${team}-${index}`;
        candidate.role = row.role;
        candidate.era = row.era;
        candidate.tier = row.rank
          ? row.rank <= 10
            ? "Inner Circle"
            : row.rank <= 25
              ? "Franchise great"
              : "Top 200"
          : "Roster reserve";
        candidate.sources = data.source;
        candidate.profile = {
          ...candidate.profile,
          mlbId: row.mlbId,
          pool: !row.rank,
          positions: row.positions,
          throws: row.throws || "",
          whyAdded: row.whyAdded,
          advancedStats: row.advancedStats,
          starterRank: row.rank || null,
          starterVersion: 4,
        };
        return candidate;
      },
    );
    state.boards[team].candidates.push(
      ...data.managers.map((row, index) => {
        const candidate = newCandidate(row.name, "Manager / coach");
        candidate.id = `manager-${team}-${index}`;
        candidate.role = "Manager";
        candidate.era = row.era;
        candidate.profile = {
          ...candidate.profile,
          pool: true,
          managerStats: row.managerStats,
          starterVersion: 4,
        };
        return candidate;
      }),
    );
    expected += state.boards[team].candidates.length;
    state.boards[team].studio.starterVersion = 4;
  }
  const result = validateImport(state);
  assert.equal(result.count, expected);
  assert.equal(result.state.boards.KC.candidates[0].name, "George Brett");
  assert.equal(result.state.boards.NYY.candidates[0].name, "Babe Ruth");
});
