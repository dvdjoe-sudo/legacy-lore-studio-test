import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const TEAMS = ["NYM", "LAD", "NYY"];

for (const team of TEAMS) {
  test(`${team} seasons file is valid`, () => {
    const path = new URL(`../public/data/seasons/${team}.json`, import.meta.url);
    assert.ok(existsSync(path), `seasons file exists for ${team}`);
    const doc = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(doc.version, 1);
    assert.equal(doc.team, team);
    const ids = Object.keys(doc.players);
    assert.ok(ids.length > 300, `${team} has seasons for 300+ players (got ${ids.length})`);
    // every player has at least one season with a year and team
    for (const [id, p] of Object.entries(doc.players)) {
      const all = [...(p.seasons || []), ...(p.pitching || [])];
      assert.ok(all.length > 0, `${p.name} has seasons`);
      for (const s of all) {
        assert.ok(Number.isInteger(s.y) && s.y >= 1871 && s.y <= 2026, `${p.name} season year ${s.y}`);
        assert.ok(typeof s.t === "string" && s.t.length >= 3, `${p.name} season team`);
      }
      if (id !== `name:${p.name.toLowerCase().replace(/[^a-z ]/g, "").trim()}`) {
        // keyed by mlbId when available
        assert.ok(/^\d+$/.test(id) || id.startsWith("name:"), `player key ${id}`);
      }
    }
  });
}

test("Piazza Mets seasons are complete and accurate", () => {
  const doc = JSON.parse(readFileSync(new URL("../public/data/seasons/NYM.json", import.meta.url), "utf8"));
  const entry = Object.values(doc.players).find((p) => p.name === "Mike Piazza");
  assert.ok(entry, "Piazza found");
  const years = entry.seasons.map((s) => s.y);
  assert.deepEqual(years, [1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005]);
  const s1999 = entry.seasons.find((s) => s.y === 1999);
  assert.equal(s1999.hr, 40);
  assert.ok(Math.abs(s1999.avg - 0.303) < 0.001);
});
