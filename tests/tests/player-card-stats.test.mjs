import test from "node:test";
import assert from "node:assert/strict";
import { playerCardPayload } from "../server/catalog.js";

const section = (gameType, season, stat) => ({
  stats: [
    {
      group: { displayName: "hitting" },
      type: { displayName: "yearByYear" },
      splits: [
        {
          season,
          gameType,
          team: { id: 143, name: "Philadelphia Phillies" },
          sport: { id: 1 },
          stat,
        },
      ],
    },
  ],
});

const stat = {
  gamesPlayed: 10,
  plateAppearances: 40,
  atBats: 35,
  hits: 10,
  doubles: 2,
  triples: 0,
  homeRuns: 3,
  rbi: 8,
  runs: 6,
  baseOnBalls: 5,
  strikeOuts: 8,
  stolenBases: 1,
  caughtStealing: 0,
  totalBases: 21,
  hitByPitch: 0,
  sacFlies: 0,
  avg: ".286",
  obp: ".375",
  slg: ".600",
  ops: ".975",
};

test("player card payload returns separate franchise regular and postseason ledgers", () => {
  const payload = playerCardPayload(
    "PHI",
    110157,
    1963,
    1978,
    section("R", "1964", stat),
    section("P", "1976", { ...stat, gamesPlayed: 3 }),
  );
  assert.equal(payload.version, "player-card-stats-v1");
  assert.equal(payload.regular.length, 1);
  assert.equal(payload.postseason.length, 1);
  assert.match(payload.regular[0].scope, /regular season/);
  assert.match(payload.postseason[0].scope, /postseason/);
  assert.match(payload.note, /do not create APEX-Oct points/);
});
