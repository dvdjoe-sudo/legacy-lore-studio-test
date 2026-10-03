export const ALMANAC_THEME =
  "To better understand the future of baseball, we first have to understand its story.";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `history-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const source = (type, label, url, note = "") => ({
  id: uid(),
  type,
  label,
  url,
  note,
  checkedAt: "",
});

const preludeText = `Before we start walking through baseball five years at a time, I think it is worth saying what this series is really about.

This will not just be a list of statistics from long ago. It is about opening baseball's old scrapbook and looking at how the game became the game we know today.

To better understand the future of baseball, we first have to understand its story.

The rules changed. The equipment changed. The ballparks changed. The way pitchers were used changed. The way players moved, trained, traveled, and were valued changed.

The farther back we go, the more obvious it becomes why comparing players across eras is so difficult. They all played baseball, but they were not playing under the same conditions, expectations, or version of the game.

That does not mean we cannot compare them. It means we should understand their baseball first.

Pull up a chair. The first chapter begins in 1876.`;

export function defaultAlmanac() {
  const almanac = {
    version: 2,
    themeLine: ALMANAC_THEME,
    chapters: [
      {
        id: "prelude-before-first-chapter",
        kind: "prelude",
        from: null,
        to: null,
        title: "Prelude: Before the First Chapter",
        subtitle: "Pull up a chair and open baseball's old scrapbook.",
        status: "draft",
        opening:
          "Before we start walking through baseball five years at a time, pull up a chair and open the game's old scrapbook with me.",
        autoCompose: true,
        fullStory: preludeText,
        facebookPost: preludeText,
        sections: {
          feel: "Baseball history should feel like opening an old family scrapbook: familiar enough to draw us in, but full of people, places, and details waiting to be rediscovered.",
          stars: "The famous names will be here, but so will the players whose stories slipped out of the everyday conversation. Each chapter will ask what greatness looked like in that player's own baseball world.",
          teams: "Pennant winners matter, but the series will also follow the clubs that moved, folded, changed names, built rivalries, and helped turn a scattered sport into an enduring institution.",
          stats: "Statistics will help explain the game, not replace the story. A number only becomes meaningful when we understand the schedule, rules, equipment, competition, ballparks, and expectations behind it.",
          changes: "Rules, equipment, ballparks, travel, training, and player usage all changed over time. Those changes are not background details. They are part of the reason every era deserves to be understood on its own terms.",
          forgotten: "The old scrapbook is filled with forgotten stars, strange customs, brief leagues, lost ballparks, and small innovations that quietly shaped what came next.",
          moment: "Great moments, painful moments, controversies, scandals, breakthroughs, and failures all belong in an honest history. Some bad moments became historic because the game had to respond to them.",
          connection: `${ALMANAC_THEME} The goal is not to trap baseball in the past, but to see today's game more clearly through everything that came before it.`,
        },
        graphicNotes:
          "A weathered 1870s scrapbook on a wooden table, early baseball equipment, scorecard paper, warm lamplight, no modern uniforms.",
        notes: "Keep this short, personal, and inviting.",
        sources: [],
        researchClippings: [],
        updatedAt: new Date().toISOString(),
      },
      {
        id: "chapter-1876-1880",
        kind: "chapter",
        from: 1876,
        to: 1880,
        title: "Chapter 1: The National League Is Born",
        subtitle: "1876–1880",
        status: "draft",
        opening:
          "Baseball in 1876 did not arrive looking like the game we know today. It was rougher, more local, and still learning what a major league was supposed to be.",
        autoCompose: true,
        fullStory: `Baseball in 1876 did not arrive looking like the game we know today. It was rougher, more local, and still learning what a major league was supposed to be.

The new National League tried to bring order to a sport filled with unstable clubs, loose schedules, and rules that were still evolving. Players performed without modern gloves, pitchers carried workloads that would be unthinkable now, and the ballpark experience belonged to another world.

That is what makes this first five-year chapter so important. We are not simply looking for the earliest version of today's baseball. We are watching the foundation being built, one rule, club, argument, and remarkable player at a time.

The names and details still need a full source review, but the theme is already clear: before baseball could become America's enduring summer game, it first had to learn how to survive.` ,
        facebookPost: `⚾📖 BASEBALL THROUGH THE YEARS: 1876–1880 📖⚾

Pull up a chair. We are opening baseball's old scrapbook at the birth of the National League.

This was a game of bare hands, punishing pitching workloads, changing rules, unstable clubs, and early stars helping build something that had never existed before.

They were playing baseball, but not the same version of baseball we watch today. That is exactly why their story matters.

Full chapter coming together inside Legacy Lore.`,
        sections: {
          feel: "Imagine arriving by train, walking into a rough wooden ballpark, and watching a game played mostly with bare hands. Fields were uneven, schedules were short, travel was difficult, and clubs could disappear almost as quickly as they appeared. Pitchers worked from a box much closer than the modern mound and delivered the ball underhand. The sport was recognizable, but it belonged to a different world.",
          stars: "Ross Barnes gave the new league its first great batting season, hitting .429 for Chicago in 1876 under the rules of his time. Cap Anson became one of the period's most durable stars. George Wright remained a link to the earlier professional game, while pitchers such as Tommy Bond, Jim Devlin, and John Montgomery Ward carried workloads that now seem almost impossible. Paul Hines emerged as a brilliant all-around player and is commonly credited with a Triple Crown season in 1878.",
          teams: "Chicago's White Stockings won the first National League pennant in 1876. Boston followed with championships in 1877 and 1878, Providence broke through in 1879, and Chicago returned to the top in 1880. Those winners gave the young league continuity, but the era also showed how fragile professional clubs could be when attendance, ownership, travel, or public trust failed.",
          stats: "The numbers immediately reveal a different game. Barnes hit .429 in the league's first season, while George Hall led the National League with only five home runs. Pitchers routinely completed nearly every game they started and piled up hundreds of innings. These totals should not be read as primitive versions of modern statistics. They are clues to a game built around contact, fielding, stamina, and rules that created a very different balance between offense and defense.",
          changes: "The league was created to impose firmer schedules, stronger club commitments, and greater control over professional baseball. The fair-foul hit, a legal tactic that helped hitters such as Barnes, disappeared after 1876. The number of balls required for a walk, the pitching box, the delivery motion, and other playing rules continued to evolve. Gloves had not yet become normal equipment, so fielding demanded a kind of courage modern box scores cannot show.",
          forgotten: "George Hall is a perfect example of the era's complicated legacy. He led the first National League in home runs, then was banned after the 1877 Louisville gambling scandal. His name connects an early statistical achievement with one of professional baseball's first major crises of trust. The story is uncomfortable, but leaving it out would make the era feel cleaner than it really was.",
          moment: "The 1877 Louisville Grays scandal exposed players accused of deliberately losing games for gamblers. The league expelled four players for life. It was a damaging moment for a competition only two seasons old, yet the response also showed that organized baseball understood its survival depended on the public believing the games were honest.",
          connection: "Modern fans would recognize the pennant race, the arguments over rules, the fascination with stars, and the fear that scandal could damage the sport. They would barely recognize the equipment, travel, pitcher usage, or instability of the clubs. Between 1876 and 1880, baseball did not finish becoming modern. It proved that a more organized major league could survive long enough to keep changing.",
        },
        graphicNotes:
          "1870s newspaper and scrapbook collage, early ball field, barehanded player silhouettes, period scorecard typography, sepia and faded red ink.",
        notes: "Starter draft. Verify names, champions, rules, and statistics before marking reviewed.",
        sources: [
          source(
            "Wikipedia",
            "1876 National League season",
            "https://en.wikipedia.org/wiki/1876_National_League_season",
            "Starting orientation only. Verify important claims with another source.",
          ),
          source(
            "Baseball Almanac",
            "Baseball history in 1876",
            "https://www.baseball-almanac.com/yearly/yr1876n.shtml",
            "Linked research page. Summarize facts in your own words.",
          ),
          source(
            "MLB",
            "MLB history",
            "https://www.mlb.com/history",
            "Official history starting point and modern context.",
          ),
        ],
        researchClippings: [],
        updatedAt: new Date().toISOString(),
      },
    ],
  };
  for (const chapter of almanac.chapters)
    if (chapter.autoCompose) chapter.fullStory = composeStoryFromSections(chapter);
  return almanac;
}

const text = (value, max, label) => {
  if (typeof value !== "string" || value.length > max)
    throw Error(`Invalid ${label}.`);
  return value;
};

const safeURL = (value) => {
  const raw = text(value || "", 2000, "history source link").trim();
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Error("History source links must be valid web addresses.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("History source links must use https://");
  return url.toString();
};

export function cleanChapter(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid history chapter.");
  const kind = ["prelude", "chapter", "daily"].includes(input.kind)
    ? input.kind
    : "chapter";
  const from = input.from == null || input.from === "" ? null : Number(input.from);
  const to = input.to == null || input.to === "" ? null : Number(input.to);
  for (const year of [from, to])
    if (year !== null && (!Number.isInteger(year) || year < 1800 || year > 2100))
      throw Error("History years must be between 1800 and 2100.");
  if (from !== null && to !== null && from > to)
    throw Error("A history chapter cannot end before it starts.");
  const sections = {};
  for (const key of [
    "feel",
    "stars",
    "teams",
    "stats",
    "changes",
    "forgotten",
    "moment",
    "connection",
  ])
    sections[key] = text(input.sections?.[key] || "", 12000, "history section");
  const sources = Array.isArray(input.sources) ? input.sources : [];
  if (sources.length > 40) throw Error("A chapter may keep up to 40 sources.");
  const researchClippings = Array.isArray(input.researchClippings)
    ? input.researchClippings
    : [];
  if (researchClippings.length > 10)
    throw Error("A chapter may keep up to 10 private article clippings.");
  const cleanedClippings = researchClippings.map((item) => ({
    id: text(item.id || uid(), 120, "research clipping ID"),
    title: text(item.title || "Untitled article", 300, "research clipping title"),
    sourceUrl: safeURL(item.sourceUrl || ""),
    articleText: text(item.articleText || "", 150000, "research article text"),
    section: [
      "general",
      "feel",
      "stars",
      "teams",
      "stats",
      "changes",
      "forgotten",
      "moment",
      "connection",
    ].includes(item.section)
      ? item.section
      : "general",
    note: text(item.note || "", 4000, "research clipping note"),
    addedAt: text(item.addedAt || new Date().toISOString(), 60, "research clipping date"),
  }));
  if (cleanedClippings.reduce((total, item) => total + item.articleText.length, 0) > 500000)
    throw Error("Private article clippings for one chapter may total up to 500,000 characters.");
  return {
    id: text(input.id || uid(), 120, "history chapter ID"),
    kind,
    from,
    to,
    title: text(input.title || "", 180, "history title"),
    subtitle: text(input.subtitle || "", 180, "history subtitle"),
    status: ["draft", "reviewed", "ready"].includes(input.status)
      ? input.status
      : "draft",
    opening: text(
      input.opening || String(input.fullStory || "").split(/\n{2,}/)[0] || "",
      12000,
      "history opening",
    ),
    autoCompose: input.autoCompose !== false,
    fullStory: text(input.fullStory || "", 120000, "full history story"),
    facebookPost: text(input.facebookPost || "", 20000, "Facebook post"),
    sections,
    graphicNotes: text(input.graphicNotes || "", 12000, "graphic notes"),
    notes: text(input.notes || "", 12000, "history notes"),
    sources: sources.map((item) => ({
      id: text(item.id || uid(), 120, "history source ID"),
      type: ["Wikipedia", "MLB", "Baseball Almanac", "Other"].includes(item.type)
        ? item.type
        : "Other",
      label: text(item.label || "Source", 220, "history source label"),
      url: safeURL(item.url),
      note: text(item.note || "", 2000, "history source note"),
      checkedAt: text(item.checkedAt || "", 60, "history source date"),
    })),
    researchClippings: cleanedClippings,
    updatedAt: text(input.updatedAt || new Date().toISOString(), 60, "history update date"),
  };
}

export function composeStoryFromSections(chapter) {
  const order = [
    "feel",
    "changes",
    "stars",
    "teams",
    "stats",
    "forgotten",
    "moment",
    "connection",
  ];
  return [chapter.opening, ...order.map((key) => chapter.sections?.[key])]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function cleanAlmanac(input) {
  const seeded = defaultAlmanac();
  if (!input) return seeded;
  if (typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid Historical Almanac.");
  const chapters = Array.isArray(input.chapters) ? input.chapters : seeded.chapters;
  if (chapters.length > 250) throw Error("Historical Almanac chapter limit exceeded.");
  const oldPlaceholders = new Set([
    "Research the defining players of each season before finalizing.",
    "Add champions and the clubs that shaped the young National League.",
    "Add only the numbers that help a reader understand how different this version of baseball was.",
    "Track rule changes, pitching distance and delivery, equipment, scheduling, and club stability.",
    "Find at least one name or story that even longtime fans may not know.",
    "Include both achievements and difficult history when they became part of baseball's memory.",
    "Show which early ideas survived and which would be almost unrecognizable in today's game.",
    "A welcoming opening that explains why the series looks beyond a stat line.",
  ]);
  const defaultsById = new Map(seeded.chapters.map((chapter) => [chapter.id, chapter]));
  const upgraded = chapters.map((chapter) => {
    const defaults = defaultsById.get(chapter?.id);
    if (!defaults || Number(input.version || 1) >= 2) return chapter;
    const sections = { ...(chapter.sections || {}) };
    for (const [key, value] of Object.entries(defaults.sections))
      if (!String(sections[key] || "").trim() || oldPlaceholders.has(sections[key]))
        sections[key] = value;
    const next = {
      ...chapter,
      opening: chapter.opening || defaults.opening,
      autoCompose: true,
      sections,
      researchClippings: chapter.researchClippings || [],
    };
    next.fullStory = composeStoryFromSections(next);
    return next;
  });
  const cleaned = upgraded.map(cleanChapter);
  if (new Set(cleaned.map((chapter) => chapter.id)).size !== cleaned.length)
    throw Error("Historical Almanac chapter IDs must be unique.");
  return {
    version: 2,
    themeLine: text(input.themeLine || ALMANAC_THEME, 500, "Almanac theme line"),
    chapters: cleaned,
  };
}

export function chapterYears(chapter) {
  if (chapter.kind === "prelude") return "PRELUDE";
  if (chapter.from && chapter.to)
    return chapter.from === chapter.to ? String(chapter.from) : `${chapter.from}–${chapter.to}`;
  return chapter.subtitle || "DATE OPEN";
}

export function chapterMarkdown(chapter, themeLine = ALMANAC_THEME) {
  const story = chapter.autoCompose
    ? composeStoryFromSections(chapter) || chapter.fullStory
    : chapter.fullStory || composeStoryFromSections(chapter);
  const lines = [
    `# ${chapter.title}`,
    chapter.subtitle ? `\n_${chapter.subtitle}_` : "",
    `\n> ${themeLine}`,
    `\n${story || "Story draft not started."}`,
  ];
  const labels = {
    feel: "What baseball felt like",
    stars: "Great players",
    teams: "Teams and champions",
    stats: "Numbers that explain the era",
    changes: "Rules, equipment, and ballparks",
    forgotten: "Forgotten lore",
    moment: "Historic moment",
    connection: "Connection to today",
  };
  if (!chapter.autoCompose)
    for (const [key, label] of Object.entries(labels))
      if (chapter.sections?.[key]) lines.push(`\n## ${label}\n\n${chapter.sections[key]}`);
  if (chapter.sources?.length) {
    lines.push("\n## Sources");
    for (const item of chapter.sources)
      lines.push(`\n- [${item.label}](${item.url})${item.note ? `: ${item.note}` : ""}`);
  }
  return lines.filter(Boolean).join("\n").trim() + "\n";
}

export function importStoryFile(name, raw) {
  if (raw.length > 1000000) throw Error("Story file exceeds the 1 MB limit.");
  if (name.toLowerCase().endsWith(".json")) {
    const value = JSON.parse(raw);
    return Array.isArray(value?.chapters)
      ? value.chapters.map(cleanChapter)
      : [cleanChapter(value)];
  }
  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || name.replace(/\.[^.]+$/, "");
  return [
    cleanChapter({
      id: uid(),
      kind: "chapter",
      title,
      subtitle: "Imported story",
      status: "draft",
      fullStory: raw.replace(/^#\s+.+$/m, "").trim(),
      facebookPost: "",
      sections: {},
      sources: [],
      notes: `Imported from ${name}`,
    }),
  ];
}
