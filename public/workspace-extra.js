// Optional extensions remain backwards-compatible with version-1 backups.
export const defaultStudio = () => ({
  scopeKey: "franchise",
  from: null,
  to: null,
  target: 175,
  exclusions: [],
  suggested: [],
  discovery: null,
  jobs: {},
  changes: [],
  favoriteId: "",
  memory: "",
  momentPins: [],
  momentHidden: [],
  momentEdits: {},
  customMoments: [],
  graphic: {
    title: "",
    count: 20,
    background: "",
    backgroundCredit: "",
    caption: "",
  },
});
export const defaultProfile = () => ({
  mlbId: null,
  whyAdded: "",
  pool: false,
  research: null,
  positions: [],
  awards: [],
  personalMemory: "",
  designation: "",
  throws: "",
  rosterRole: "",
  twoWayQualified: false,
  twoWay: { season: null, source: "" },
  storyThread: "",
  historyLinks: [],
});
const jsonCopy = (v, max, label) => {
  let s;
  try {
    s = JSON.stringify(v);
  } catch {
    throw Error("Invalid " + label);
  }
  if (s.length > max) throw Error(label + " exceeds its size limit.");
  return JSON.parse(s);
};
export function cleanStudio(v) {
  const d = defaultStudio();
  if (!v) return d;
  if (typeof v !== "object" || Array.isArray(v))
    throw Error("Invalid studio settings.");
  const r = { ...d, ...jsonCopy(v, 1500000, "Team research") };
  if (
    !Array.isArray(r.exclusions) ||
    r.exclusions.length > 2000 ||
    r.exclusions.some((x) => typeof x !== "string" || x.length > 200)
  )
    throw Error("Invalid exclusions.");
  if (!Array.isArray(r.suggested) || r.suggested.length > 1000)
    throw Error("Invalid candidate suggestions.");
  if (![150, 175, 200].includes(r.target))
    throw Error("Choose 150, 175 or 200 candidates.");
  for (const k of ["from", "to"])
    if (
      r[k] !== null &&
      (!Number.isInteger(r[k]) || r[k] < 1800 || r[k] > 2100)
    )
      throw Error("Invalid scope years.");
  if (r.from && r.to && r.from > r.to)
    throw Error("Scope starts after it ends.");
  r.graphic = { ...d.graphic, ...r.graphic };
  if (![10, 15, 20, 25, 50].includes(r.graphic.count))
    throw Error("Invalid graphic count.");
  if (
    r.graphic.background &&
    !(
      r.graphic.background.startsWith("/api/assets/") ||
      /^\.\/ballparks\/[\w-]+\.(jpg|jpeg|png|webp)$/.test(r.graphic.background)
    )
  )
    throw Error("Invalid background path.");
  if (
    typeof r.graphic.title !== "string" ||
    typeof r.graphic.caption !== "string" ||
    typeof r.graphic.backgroundCredit !== "string"
  )
    throw Error("Invalid graphic text.");
  r.changes = Array.isArray(r.changes) ? r.changes.slice(-50) : [];
  for (const k of ["momentPins", "momentHidden"]) {
    if (
      !Array.isArray(r[k]) ||
      r[k].length > 200 ||
      r[k].some((x) => typeof x !== "string" || x.length > 120)
    )
      throw Error("Invalid franchise moment list.");
    r[k] = [...new Set(r[k])];
  }
  if (!r.momentEdits || typeof r.momentEdits !== "object" || Array.isArray(r.momentEdits))
    throw Error("Invalid franchise moment edits.");
  if (Object.keys(r.momentEdits).length > 200)
    throw Error("Too many franchise moment edits.");
  const cleanMoment = (m, custom = false) => {
    if (!m || typeof m !== "object" || Array.isArray(m))
      throw Error("Invalid franchise moment.");
    const text = (value, max) => {
      if (typeof value !== "string" || value.length > max)
        throw Error("Invalid franchise moment text.");
      return value;
    };
    const tone = ["triumph", "heartbreak", "turning-point", "beloved", "bizarre"].includes(m.tone)
      ? m.tone
      : "turning-point";
    const out = {
      ...(custom ? { id: text(m.id, 120) } : {}),
      year: text(m.year ?? "", 20),
      title: text(m.title ?? "", 180),
      story: text(m.story ?? "", 2000),
      fullSummary: text(m.fullSummary ?? "", 8000),
      people: text(m.people ?? "", 500),
      storyUrl: text(m.storyUrl ?? "", 2000),
      source: text(m.source ?? "", 2000),
      note: text(m.note ?? "", 2000),
      tone,
    };
    if (!out.title.trim()) throw Error("Franchise moments need a title.");
    return out;
  };
  r.momentEdits = Object.fromEntries(
    Object.entries(r.momentEdits).map(([id, m]) => {
      if (typeof id !== "string" || id.length > 120)
        throw Error("Invalid franchise moment ID.");
      return [id, cleanMoment(m)];
    }),
  );
  if (!Array.isArray(r.customMoments) || r.customMoments.length > 100)
    throw Error("Invalid custom franchise moments.");
  r.customMoments = r.customMoments.map((m) => cleanMoment(m, true));
  return r;
}
export function cleanProfile(v) {
  const d = defaultProfile();
  if (!v) return d;
  if (typeof v !== "object" || Array.isArray(v))
    throw Error("Invalid candidate profile.");
  const r = { ...d, ...jsonCopy(v, 100000, "Candidate research") };
  if (r.mlbId !== null && (!Number.isInteger(r.mlbId) || r.mlbId < 1))
    throw Error("Invalid player identity.");
  if (
    typeof r.pool !== "boolean" ||
    typeof r.whyAdded !== "string" ||
    r.whyAdded.length > 2000
  )
    throw Error("Invalid candidate origin.");
  if (!Array.isArray(r.positions) || !Array.isArray(r.awards))
    throw Error("Invalid position or award data.");
  if (typeof r.storyThread !== "string" || r.storyThread.length > 2000)
    throw Error("Invalid player story thread.");
  if (
    !Array.isArray(r.historyLinks) ||
    r.historyLinks.length > 40 ||
    r.historyLinks.some((id) => typeof id !== "string" || id.length > 120)
  )
    throw Error("Invalid player history links.");
  r.historyLinks = [...new Set(r.historyLinks)];
  if (!["", "pitcher", "position", "two-way"].includes(r.designation))
    throw Error("Invalid roster designation.");
  if (
    !["", "L", "R", "S"].includes(r.throws) ||
    ![
      "",
      "closer",
      "setup",
      "middle",
      "left-specialist",
      "long",
      "swing",
      "dh",
      "pinch-hitter",
    ].includes(r.rosterRole) ||
    typeof r.twoWayQualified !== "boolean"
  )
    throw Error("Invalid roster role profile.");
  if (r.generated) {
    if (
      typeof r.generated !== "object" ||
      !r.generated.fields ||
      !r.generated.ratings ||
      Array.isArray(r.generated.fields) ||
      Array.isArray(r.generated.ratings)
    )
      throw Error("Invalid generated drafts.");
    for (const [key, item] of Object.entries(r.generated.fields)) {
      if (
        !["nickname", "moments", "easterEggs"].includes(key) ||
        typeof item.value !== "string" ||
        item.value.length > 20000 ||
        typeof item.source !== "string"
      )
        throw Error("Invalid draft field.");
    }
    for (const [key, item] of Object.entries(r.generated.ratings)) {
      if (
        !["identity", "connection", "signature", "excellence"].includes(key) ||
        !Number.isFinite(item.value) ||
        item.value < 0 ||
        item.value > 10 ||
        typeof item.evidence?.reason !== "string" ||
        typeof item.evidence?.source !== "string"
      )
        throw Error("Invalid draft rating.");
    }
  }
  if (r.statContext) {
    const v = r.statContext;
    if (
      !["role-era-v2", "role-lane-v3"].includes(v.version) ||
      typeof v.key !== "string" ||
      !Array.isArray(v.seasons) ||
      v.seasons.length > 300
    )
      throw Error("Invalid scoring context.");
    for (const row of v.seasons)
      if (
        row &&
        (!Number.isFinite(row.contribution) ||
          row.contribution < 0 ||
          row.contribution > 1 ||
          !Number.isFinite(row.opportunity) ||
          row.opportunity < 0 ||
          row.opportunity > 1.25)
      )
        throw Error("Invalid season contribution.");
  }
  if (r.advancedStats) {
    const a = r.advancedStats;
    if (
      a.version !== "role-lane-v3" ||
      typeof a.source !== "string" ||
      !["BAT", "C", "SP", "RP", "TWO"].includes(a.role)
    )
      throw Error("Invalid advanced stats.");
    for (const k of [
      "totalWAR",
      "batWAR",
      "pitchWAR",
      "peak5WAR",
      "WAA",
      "REP",
      "Apex",
      "Prime",
      "Reign",
      "APEX_R",
      "APEX_OCT",
      "APEX_OCT_CONTRIBUTION",
      "APEX_F",
      "APEX_100",
      "SP_est",
      "RP_est",
    ])
      if (a[k] != null && !Number.isFinite(Number(a[k])))
        throw Error("Invalid advanced stat value.");
    for (const k of ["PA", "IP", "seasons"])
      if (a[k] != null && (!Number.isFinite(Number(a[k])) || Number(a[k]) < 0))
        throw Error("Invalid advanced stat value.");
    if (a.apexBoards != null) {
      if (
        typeof a.apexBoards !== "object" ||
        !["H", "SP", "RP"].every((code) => a.apexBoards[code])
      )
        throw Error("Invalid APEX role boards.");
      for (const code of ["H", "SP", "RP"]) {
        const lane = a.apexBoards[code];
        if (
          lane.code !== code ||
          typeof lane.label !== "string" ||
          typeof lane.eligible !== "boolean"
        )
          throw Error("Invalid APEX role board.");
        for (const key of [
          "Peak3",
          "Prime5",
          "Career",
          "APEX_R",
          "APEX_F",
          "WAA",
          "REP",
          "WAR",
        ])
          if (!Number.isFinite(Number(lane[key])))
            throw Error("Invalid APEX role-board value.");
        if (
          lane.rank != null &&
          (!Number.isInteger(Number(lane.rank)) || Number(lane.rank) < 1)
        )
          throw Error("Invalid APEX role-board rank.");
      }
    }
    if (a.apexOctoberEvidence != null) {
      const o = a.apexOctoberEvidence;
      if (
        typeof o !== "object" ||
        Array.isArray(o) ||
        typeof o.complete !== "boolean" ||
        typeof o.source !== "string" ||
        o.source.length > 2000 ||
        typeof o.checkedAt !== "string" ||
        o.checkedAt.length > 80
      )
        throw Error("Invalid APEX-Oct evidence.");
      for (const value of [o.wpa, o.clutch])
        if (value != null && (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > 100))
          throw Error("Invalid APEX-Oct value.");
      if (o.source) {
        let u;
        try {
          u = new URL(o.source);
        } catch {
          throw Error("Invalid APEX-Oct source.");
        }
        if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
          throw Error("Invalid APEX-Oct source.");
      }
      if (o.complete && (o.wpa == null || o.clutch == null || !o.source))
        throw Error("Complete APEX-Oct evidence needs WPA, Clutch, and a source.");
    }
    if (a.catcherDefense != null) {
      const d = a.catcherDefense;
      if (
        typeof d !== "object" ||
        Array.isArray(d) ||
        d.version !== "apex-c-2.1" ||
        d.additiveToApexH !== false ||
        !["high", "medium", "low"].includes(d.confidence) ||
        (d.seasons !== undefined && !Array.isArray(d.seasons)) ||
        (Array.isArray(d.seasons) && d.seasons.length > 200)
      )
        throw Error("Invalid APEX-C profile.");
      for (const key of ["Peak3", "Prime5", "Career"])
        if (d[key] != null && !Number.isFinite(Number(d[key])))
          throw Error("Invalid APEX-C window value.");
      for (const value of [
        d.throwing?.caughtStealingPct,
        d.throwing?.leagueCaughtStealingPct,
        d.throwing?.aboveLeague,
        d.blocking?.per1000Innings,
        d.blocking?.leaguePer1000Innings,
      ])
        if (value != null && !Number.isFinite(Number(value)))
          throw Error("Invalid APEX-C summary evidence.");
      for (const row of d.seasons || []) {
        if (
          !Number.isInteger(Number(row.year)) ||
          Number(row.year) < 1800 ||
          Number(row.year) > 2100 ||
          !["high", "medium", "low"].includes(row.confidence)
        )
          throw Error("Invalid APEX-C season.");
        for (const value of [
          row.innings,
          row.runPrevention?.value,
          row.throwing?.caughtStealingPct,
          row.throwing?.leagueCaughtStealingPct,
          row.blocking?.per1000Innings,
          row.blocking?.leaguePer1000Innings,
        ])
          if (value != null && !Number.isFinite(Number(value)))
            throw Error("Invalid APEX-C evidence.");
      }
    }
  }
  if (r.defenseEvidence) {
    const d = r.defenseEvidence;
    if (
      d.rating !== null &&
      (!Number.isFinite(d.rating) || d.rating < 0 || d.rating > 10)
    )
      throw Error("Invalid defensive rating.");
    if (
      typeof d.reason !== "string" ||
      d.reason.length > 3000 ||
      typeof d.source !== "string" ||
      d.source.length > 2000
    )
      throw Error("Invalid defensive evidence.");
    if (d.source) {
      let u;
      try {
        u = new URL(d.source);
      } catch {
        throw Error("Invalid defense source.");
      }
      if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
        throw Error("Invalid defense source.");
    }
  }
  if (r.research) {
    if (
      typeof r.research.extract !== "string" ||
      typeof r.research.title !== "string" ||
      typeof r.research.checkedAt !== "string"
    )
      throw Error("Invalid saved research.");
    let u;
    try {
      u = new URL(r.research.source);
    } catch {
      throw Error("Invalid research source.");
    }
    if (
      u.protocol !== "https:" ||
      u.hostname !== "en.wikipedia.org" ||
      u.username ||
      u.password
    )
      throw Error("Invalid research source.");
  }
  return r;
}
export const rankedCandidates = (b) =>
  b.candidates.filter((c) => !c.profile?.pool);
export function logChange(b, text) {
  b.studio ||= defaultStudio();
  b.studio.changes.push({ at: new Date().toISOString(), text });
  b.studio.changes = b.studio.changes.slice(-50);
}
