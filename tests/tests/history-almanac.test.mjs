import test from "node:test";
import assert from "node:assert/strict";
import {
  chapterMarkdown,
  cleanAlmanac,
  cleanChapter,
  composeStoryFromSections,
  defaultAlmanac,
  importStoryFile,
} from "../public/history-almanac.js";
import { seedState, validateImport } from "../public/model.js";

test("the Almanac starts with the prelude and 1876–1880", () => {
  const almanac = defaultAlmanac();
  assert.equal(almanac.chapters.length, 2);
  assert.equal(almanac.chapters[0].kind, "prelude");
  assert.equal(almanac.chapters[1].from, 1876);
  assert.equal(almanac.chapters[1].to, 1880);
  assert.match(almanac.themeLine, /understand its story/i);
  for (const chapter of almanac.chapters)
    for (const value of Object.values(chapter.sections)) assert.ok(value.trim());
});

test("editing a story section can rebuild the complete article", () => {
  const chapter = defaultAlmanac().chapters[1];
  chapter.sections.forgotten = "A newly restored forgotten story.";
  const composed = composeStoryFromSections(chapter);
  assert.match(composed, /newly restored forgotten story/i);
  assert.match(composed, /^Baseball in 1876/);
});

test("private article clippings survive cleaning but stay out of public Markdown", () => {
  const base = defaultAlmanac().chapters[1];
  const chapter = cleanChapter({
    ...base,
    researchClippings: [
      {
        id: "clip-1",
        title: "Research article",
        sourceUrl: "https://example.com/baseball-history",
        articleText: "Private source text that should not be republished.",
        section: "forgotten",
        note: "Check the date.",
        addedAt: "2026-09-22T00:00:00.000Z",
      },
    ],
  });
  assert.equal(chapter.researchClippings[0].articleText.startsWith("Private"), true);
  assert.equal(chapter.researchClippings[0].section, "forgotten");
  assert.doesNotMatch(chapterMarkdown(chapter), /Private source text/);
});

test("version 1 starter placeholders upgrade to completed sections", () => {
  const old = defaultAlmanac();
  old.version = 1;
  old.chapters[1].sections.stars =
    "Research the defining players of each season before finalizing.";
  const upgraded = cleanAlmanac(old);
  assert.equal(upgraded.version, 2);
  assert.match(upgraded.chapters[1].sections.stars, /Ross Barnes/);
  assert.match(upgraded.chapters[1].fullStory, /Ross Barnes/);
});

test("older workspace backups gain the Almanac without losing boards", () => {
  const state = seedState();
  delete state.almanac;
  const restored = validateImport(state).state;
  assert.equal(restored.almanac.chapters[1].title, "Chapter 1: The National League Is Born");
  assert.ok(restored.boards.LAD);
});

test("chapter exports include the composed story and source links without duplicate sections", () => {
  const almanac = cleanAlmanac(defaultAlmanac());
  const markdown = chapterMarkdown(almanac.chapters[1], almanac.themeLine);
  assert.match(markdown, /^# Chapter 1/m);
  assert.match(markdown, /Modern fans would recognize/);
  assert.doesNotMatch(markdown, /## Great players/);
  assert.match(markdown, /baseball-almanac\.com/);
});

test("Markdown imports become editable drafts", () => {
  const [chapter] = importStoryFile("next.md", "# Chapter 2\n\nA new baseball story.");
  assert.equal(chapter.title, "Chapter 2");
  assert.equal(chapter.status, "draft");
  assert.match(chapter.fullStory, /new baseball story/);
});
