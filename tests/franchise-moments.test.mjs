import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TEAMS, seedState, validateImport } from "../public/model.js";
import { starterMoments, franchiseMoments } from "../public/franchise-moments.js";

const candidates = (team) => JSON.parse(fs.readFileSync(new URL(`../public/data/apex/${team}.json`, import.meta.url))).candidates.map((row, i) => ({
  id:`${team}-${i}`, name:row.name, type:"Player", role:row.role,
  profile:{ advancedStats:row.advancedStats },
}));

test("every franchise starts with 25 editable history cards and landmark heartbreak", () => {
  for (const [team] of TEAMS) {
    const rows = starterMoments(team, candidates(team));
    assert.equal(rows.length, 25, team);
    assert.equal(new Set(rows.map((m) => m.id)).size, 25, team);
    assert.ok(rows.filter((m) => m.kind === "moment").length >= 8, team);
    assert.ok(rows.filter((m) => m.tone === "heartbreak").length >= 1, team);
    assert.ok(rows.every((m) => m.fullSummary?.length > m.story.length), `${team} full summaries`);
    assert.ok(rows.every((m) => /^https:\/\//.test(m.storyUrl)), `${team} story links`);
  }
});

test("moment edits, custom history, pins and hidden cards survive backup validation", () => {
  const state = seedState(), studio = state.boards.KC.studio;
  studio.momentPins = ["KC-landmark-1"];
  studio.momentHidden = ["KC-landmark-2"];
  studio.momentEdits["KC-landmark-1"] = { year:"1969", tone:"beloved", title:"Opening day", story:"My version", fullSummary:"My complete version of opening day.", people:"", note:"Ticket stub", storyUrl:"https://example.com/opening-day", source:"" };
  studio.customMoments.push({ id:"KC-custom-one", year:"2026", tone:"turning-point", title:"A new chapter", story:"Personal history", fullSummary:"The complete personal history.", people:"", note:"", storyUrl:"https://example.com/new-chapter", source:"" });
  const restored = validateImport(structuredClone(state)).state.boards.KC.studio;
  assert.deepEqual(restored.momentPins, studio.momentPins);
  assert.deepEqual(restored.customMoments, studio.customMoments);
  const rows = franchiseMoments("KC", candidates("KC"), restored);
  assert.equal(rows.find((m) => m.id === "KC-landmark-1").title, "Opening day");
  assert.equal(rows.find((m) => m.id === "KC-landmark-1").fullSummary, "My complete version of opening day.");
  assert.equal(rows.find((m) => m.id === "KC-custom-one").storyUrl, "https://example.com/new-chapter");
  assert.equal(rows.some((m) => m.id === "KC-landmark-2"), false);
  assert.equal(rows.some((m) => m.id === "KC-custom-one"), true);
});
