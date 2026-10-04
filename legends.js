import { roleEraSuggestions } from "./stat-context.js";
import {
  dataConfidenceGrade,
  rosterMetric,
  rosterModule,
  PREMIUM_DEFENSE_POSITIONS,
  premiumPositionScore,
  defenseRate150,
} from "./apex-roster.js";
import {
  retrosheetPitchingWork,
  retrosheetPositionGames,
  retrosheetProfile,
  retrosheetRoleEvidence,
} from "./retrosheet.js";
// Transparent studio heuristics for the custom legacy worksheet.
export const AUTO_KEYS = ["performance", "peak", "longevity"];
export const SLOTS = [
  ["C", "Catcher"],
  ["1B", "First base"],
  ["2B", "Second base"],
  ["3B", "Third base"],
  ["SS", "Shortstop"],
  ["LF", "Left field"],
  ["CF", "Center field"],
  ["RF", "Right field"],
  ["DH", "Designated hitter"],
  ...Array.from({ length: 5 }, (_, i) => [`SP${i + 1}`, `Rotation ${i + 1}`]),
  ["CL", "Closer"],
  ["SU1", "Primary setup"],
  ["SU2", "Secondary setup"],
  ["MR1", "Middle relief"],
  ["MR2", "Middle relief"],
  ["LHS", "Left-handed specialist"],
  ["LR", "Long relief / swingman"],
  ["C2", "Backup catcher"],
  ["UTIL", "Utility infielder"],
  ["OF4", "Fourth outfielder"],
  ["CI", "Corner infielder"],
  ["PH", "Pinch-hit / power bat"],
];
export const BULLPEN_SLOTS = ["CL", "SU1", "SU2", "MR1", "MR2", "LHS", "LR"];
export const BENCH_SLOTS = ["C2", "UTIL", "OF4", "CI", "PH"];
export const ROSTER_ELIGIBILITY = Object.freeze({
  tenureSeasons: 3,
  positionPA: 1000,
  specialistPA: 750,
  starterIP: 300,
  reliefIP: 100,
});
export const GUIDED_SHORTLIST_SIZE = 8;
const LEGACY_SLOTS = {
  RP1: "CL",
  RP2: "SU1",
  RP3: "SU2",
  RP4: "MR1",
  RP5: "MR2",
  RP6: "LHS",
  RP7: "LR",
  B1: "C2",
  B2: "UTIL",
  B3: "OF4",
  B4: "CI",
  B5: "PH",
};
export const newRoster = () => ({
  slots: {},
  overrides: {},
  legacyException: { playerId: "", reason: "" },
  order: SLOTS.slice(0, 9).map(([k]) => k),
  title: "All-time legends",
  notes: "",
  manager: "",
  strategy: "balanced",
});
const num = (v) => {
  const s = String(v ?? "")
    .trim()
    .replaceAll(",", "");
  return s !== "" && /^\d*(?:\.\d+)?$/.test(s) && Number.isFinite(Number(s))
    ? Number(s)
    : null;
};
const key = (v) =>
  String(v)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9+]/g, "");
const rate = (v, low, high) =>
  Math.round(Math.max(0, Math.min(10, ((v - low) / (high - low)) * 10)) * 10) /
  10;
const outs = (v) => {
  const s = String(v ?? "");
  if (!/^\d+(?:\.[012])?$/.test(s)) return null;
  const [a, b = "0"] = s.split(".");
  return Number(a) * 3 + Number(b);
};
function readTable(s) {
  const cols = s.columns.map(key);
  const y = cols.findIndex((c) => c === "YEAR" || c === "SEASON");
  if (y < 0) return null;
  const rows = s.rows
    .filter((r) => /^\d{4}[*#]?$/.test(String(r[y])))
    .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  if (!rows.length || rows.length !== s.rows.length) return null; // totals mixed with seasons cannot be scored safely
  const years = rows.map((r) =>
    String(r.YEAR ?? r.SEASON).replace(/[*#]/g, ""),
  );
  if (new Set(years).size !== years.length) return null; // split-season duplicates require a consolidated table
  return { s, rows, years, pitching: cols.includes("IP"), cols };
}
function tableRatings(t) {
  const workload = t.rows
    .map((r) => (t.pitching ? (outs(r.IP) ?? 0) / 3 : (num(r.PA) ?? 0)))
    .reduce((a, b) => a + b, 0);
  return { workload };
}
export function suggestScores(c) {
  return roleEraSuggestions(c);
}
export function applyAutoScores(c, { replace = false } = {}) {
  const next = structuredClone(c);
  next.autoScores = next.autoScores || {};
  const suggestions = suggestScores(c);
  for (const k of AUTO_KEYS) {
    if (c.na.includes(k)) continue;
    const previous = next.autoScores[k];
    const owned = previous && c.scores[k] === previous.value;
    if (suggestions[k] && (replace || c.scores[k] == null || owned)) {
      next.scores[k] = suggestions[k].value;
      next.autoScores[k] = suggestions[k];
    } else if (owned && !suggestions[k]) {
      next.scores[k] = null;
      delete next.autoScores[k];
    }
  }
  return next;
}
export function keyStats(c) {
  const tables = [...(c.statImports || [])].sort(
    (a, b) =>
      Number(/regular season/i.test(b.scope || b.label || "")) -
        Number(/regular season/i.test(a.scope || a.label || "")) ||
      Date.parse(b.importedAt) - Date.parse(a.importedAt),
  );
  const batting = tables.find((s) => !s.columns.some((c) => key(c) === "IP")),
    pitch = tables.find((s) => s.columns.some((c) => key(c) === "IP"));
  const exposure = (s) => {
    if (!s) return -1;
    const t = readTable(s);
    return t ? tableRatings(t).workload / (t.pitching ? 50 : 200) : 0;
  };
  const isPitcher = positions(c).some((p) => p === "SP" || p === "RP");
  const usable =
    isPitcher && pitch
      ? pitch
      : exposure(pitch) > exposure(batting)
        ? pitch
        : batting || pitch;
  if (!usable) return null;
  const pitching = usable.columns.some((c) => key(c) === "IP");
  const wanted = pitching
    ? ["W", "SV", "IP", "SO", "ERA", "WHIP"]
    : ["H", "HR", "RBI", "SB", "AVG", "OPS"];
  let values = usable.summary;
  if (!values.length) {
    const t = readTable(usable);
    if (!t)
      return {
        source: usable,
        values: [],
        message: "Open the saved table to inspect these stats.",
      };
    const sum = (k) =>
      t.rows.every((r) => num(r[k]) !== null)
        ? t.rows.reduce((a, r) => a + num(r[k]), 0)
        : null;
    const output = [];
    for (const k of wanted) {
      let v = null;
      if (k === "IP") {
        const oo = t.rows.map((r) => outs(r.IP));
        if (oo.every((x) => x !== null)) {
          const o = oo.reduce((a, b) => a + b, 0);
          v = `${Math.floor(o / 3)}.${o % 3}`;
        }
      } else if (k === "AVG") {
        const h = sum("H"),
          ab = sum("AB");
        if (h !== null && ab > 0) v = (h / ab).toFixed(3);
      } else if (["OPS", "WHIP"].includes(k)) {
        if (t.rows.length === 1) v = t.rows[0][k] ?? null;
      } else if (k === "ERA") {
        const er = sum("ER"),
          o = t.rows.map((r) => outs(r.IP));
        if (
          er !== null &&
          o.every((x) => x !== null) &&
          o.reduce((a, b) => a + b, 0) > 0
        )
          v = ((er * 27) / o.reduce((a, b) => a + b, 0)).toFixed(2);
      } else v = sum(k);
      if (v !== null) output.push({ label: k, value: String(v) });
    }
    values = output;
  }
  return {
    source: usable,
    values: wanted
      .map((k) => values.find((v) => key(v.label) === k))
      .filter(Boolean),
  };
}
export function statStrip(c, esc) {
  const s = keyStats(c),
    a = c.profile?.advancedStats,
    isPitch = a?.role === "SP" || a?.role === "RP",
    primary = a?.apexBoards?.[a?.primaryBoard];
  const adv =
    a && a.version === "role-lane-v3" && a.found !== false
      ? [
          {
            label: `F-${String(a.scoreBoard || "APEX").split(" · ")[0]}`,
            value: Number(a.APEX_F ?? a.APEX_R).toFixed(1),
          },
          ...(primary?.eligible && primary?.rank
            ? [{ label: `${primary.label} rank`, value: `#${primary.rank}${primary.nearTie ? " ≈" : ""}` }]
            : []),
          { label: "bWAR", value: Number(a.totalWAR).toFixed(1) },
          { label: "WAA", value: Number(a.WAA).toFixed(1) },
          ...(!primary
            ? [{ label: "Peak 5 WAR", value: Number(a.peak5WAR).toFixed(1) }]
            : []),
          { label: "Peak3", value: Number(primary?.Peak3 ?? a.Apex).toFixed(1) },
          { label: "Prime5", value: Number(primary?.Prime5 ?? a.Prime).toFixed(1) },
          { label: "Career", value: Number(primary?.Career ?? a.Career ?? a.Reign).toFixed(1) },
          {
            label: isPitch ? "ERA+" : "OPS+",
            value: Number(isPitch ? a.ERAPlus : a.OPSPlus).toFixed(0),
          },
          {
            label: isPitch ? "IP" : "PA",
            value: isPitch
              ? Number(a.IP).toFixed(1)
              : String(Math.round(Number(a.PA))),
          },
          { label: "Seasons", value: String(Math.round(Number(a.seasons))) },
        ].filter((x) => x.value !== "NaN")
      : [];
  if (!s && !adv.length) return "";
  const values = [...adv, ...(s?.values || [])].slice(0, 10);
  const flags = a
    ? [
        a.mixedRoleExposure ? "mixed-role exposure" : "",
        a.gsFallbackUsed ? "GS/G fallback used" : "",
      ].filter(Boolean)
    : [];
  return `<section class="legend-stat-strip"><div class="eyebrow">FRANCHISE STAT SNAPSHOT</div><div class="legend-stats">${values.map((x) => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join("")}</div><small>${a?.source ? `Baseball-Reference WAR data · franchise seasons through 2025 · ${esc(a.formulaVersion || "role-separated APEX")}${isPitch ? " · pitching role reconstructed" : ""}${flags.length ? ` · ${esc(flags.join(" · "))}` : ""} · ${a.postseasonIncluded ? "October included in APEX-F" : "October N/A, not zero"}` : s ? esc(s.source.scope) + " · " + esc(s.source.provider) : ""}${s?.message ? " · " + esc(s.message) : ""}</small></section>`;
}
export function positionApexHTML(c, esc) {
  const stats = c.profile?.advancedStats;
  if (!stats || stats.role !== "BAT") return "";
  const rows = Object.values(stats.positionBoards || {})
    .filter(
      (board) =>
        board &&
        (board.eligible ||
          board.alsoQualified ||
          Number(board.games) >= 25 ||
          Number(board.APEX_R) > 0),
    )
    .sort(
      (a, b) =>
        Number(b.games || 0) - Number(a.games || 0) ||
        Number(b.APEX_R || 0) - Number(a.APEX_R || 0),
    );
  if (!rows.length) return "";
  return `<section class="position-apex-card"><div class="position-apex-head"><div><span>POSITION-EARNED VALUE</span><strong>Every meaningful fielding position</strong></div><b>Overall APEX-H ${esc(Number(stats.APEX_R || 0).toFixed(2))}</b></div><div class="position-apex-list">${rows
    .map((board) => {
      const status = board.eligible
        ? `Official${board.rank ? ` · #${board.rank}` : ""}`
        : board.alsoQualified
          ? "Also qualified"
          : "Limited sample";
      return `<div><strong>${esc(board.code)}</strong><span>${esc(Number(board.APEX_R || 0).toFixed(2))} APEX</span><small>${esc(`${Math.round(Number(board.games || 0))} games · ${status}${board.pos_pctile != null ? ` · ${Number(board.pos_pctile).toFixed(0)}th percentile` : ""}`)}</small></div>`;
    })
    .join("")}</div><p>Position APEX is the share of value earned while playing that position. It is not a separate full-career grade, and the position slices should not be added together.</p></section>`;
}
export function rosterCompanionHTML(c, esc) {
  if (c.type !== "Player" || !c.profile?.advancedStats) return "";
  const module = rosterModule(c),
    metric = (item, fallback = "—") =>
      item?.value == null ? fallback : Number(item.value).toFixed(2),
    signed = (value, digits = 1) =>
      value == null ? "N/A" : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(digits)}`,
    pct = (value) =>
      value == null ? "N/A" : `${(Number(value) * 100).toFixed(1)}%`,
    catcher = module.catcher,
    items = [
      ["Franchise APEX", metric(module.franchise), module.franchise?.detail],
      [
        module.rosterPos?.label || "RosterPos",
        metric(module.rosterPos),
        module.rosterPos
          ? `${module.rosterPos.games == null ? "Role-specific pitching value" : `${Math.round(module.rosterPos.games || 0)} games at position`} · ${module.rosterPos.detail}`
          : "No position-earned slice is available.",
      ],
      ["APEX-V", metric(module.versatility, "N/A"), module.versatility?.detail || "Pitcher or no measurable multi-position work."],
      ...(catcher
        ? [["C-Prime5", signed(catcher.Prime5), `Catcher-only run prevention · ${catcher.confidence} confidence`]]
        : [["APEX-C", "N/A", "Catcher-only companion."]]),
      ["APEX-Oct", metric(module.october, "N/A"), module.october.detail],
    ],
    catcherHTML = catcher
      ? `<section class="catcher-companion"><div class="catcher-companion-head"><div><span>APEX-C · ROSTER COMPANION ONLY</span><strong>Catcher defense profile</strong></div><b class="catcher-confidence confidence-${esc(catcher.confidence)}">${esc(catcher.confidence)} confidence</b></div><div class="catcher-windows"><div><span>C-Peak3</span><strong>${esc(signed(catcher.Peak3))}</strong><small>${esc(catcher.Peak3Years?.length ? catcher.Peak3Years.join(", ") : "N/A")}</small></div><div><span>C-Prime5</span><strong>${esc(signed(catcher.Prime5))}</strong><small>${esc(catcher.Prime5Years?.length ? `${catcher.Prime5Years[0]}–${catcher.Prime5Years.at(-1)}` : "N/A")}</small></div><div><span>C-Career</span><strong>${esc(signed(catcher.Career))}</strong><small>${esc(`${Math.round(catcher.workload?.games || 0)} C games${catcher.workload?.innings == null ? " · innings N/A" : ` · ${Math.round(catcher.workload.innings)} innings`}`)}</small></div></div><div class="catcher-components"><div><span>Run prevention</span><strong>${esc(catcher.Career == null ? "N/A" : signed(catcher.Career))}</strong><small>One era-appropriate fielding-runs system per season. Never stacked with another system.</small></div><div><span>Throwing vs league</span><strong>${esc(catcher.throwing?.aboveLeague == null ? "N/A" : signed(catcher.throwing.aboveLeague * 100, 1) + " pts")}</strong><small>${esc(`${pct(catcher.throwing?.caughtStealingPct)} CS · league ${pct(catcher.throwing?.leagueCaughtStealingPct)} · ${catcher.throwing?.seasons || 0} measured seasons`)}</small></div><div><span>Blocking</span><strong>${esc(catcher.blocking?.per1000Innings == null ? "N/A" : Number(catcher.blocking.per1000Innings).toFixed(1) + " / 1,000 IP")}</strong><small>${esc(catcher.blocking?.leaguePer1000Innings == null ? "League comparison N/A" : `League ${Number(catcher.blocking.leaguePer1000Innings).toFixed(1)} · lower is better · ${catcher.blocking.seasons || 0} measured seasons`)}</small></div><div><span>Framing</span><strong>N/A</strong><small>${esc(catcher.framing?.status || "Not measured reliably")}. Missing is unknown, never zero.</small></div></div><p>${esc(catcher.detail)} It never changes or adds to official APEX-H.</p></section>`
      : "";
  return `<section class="roster-module-card"><div class="roster-module-head"><div><span>APEX 2.2 TEST</span><strong>Franchise Roster Module</strong></div><span class="data-grade grade-${esc(module.confidence.grade.toLowerCase())}" title="${esc(module.confidence.detail)}">${esc(module.confidence.label)}</span></div><div class="roster-module-grid">${items
    .map(
      ([label, value, detail]) =>
        `<div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail || "")}</small></div>`,
    )
    .join("")}${module.pitcherRole ? `<div><span>${esc(module.pitcherRole.label)}</span><strong class="role-text">${esc(module.pitcherRole.role)}</strong><small>${esc(module.pitcherRole.detail)}</small></div>` : ""}</div>${module.october?.source ? `<p><a href="${esc(module.october.source)}" target="_blank" rel="noopener">Open APEX-Oct evidence</a></p>` : ""}${positionApexHTML(c, esc)}${catcherHTML}<p>Roster companions explain fit. Open Score / notes to enter verified WPA and Clutch. Only complete signed APEX-Oct evidence adjusts APEX-F; missing postseason data never becomes zero.</p></section>`;
}
export function cleanRoster(raw, candidates) {
  const r = newRoster();
  if (!raw) return r;
  if (typeof raw !== "object" || !raw.slots || typeof raw.slots !== "object")
    throw Error("Invalid roster.");
  for (const k of ["title", "notes"]) {
    if (
      raw[k] != null &&
      (typeof raw[k] !== "string" ||
        raw[k].length > (k === "title" ? 150 : 20000))
    )
      throw Error("Invalid roster text.");
    r[k] = raw[k] ?? r[k];
  }
  const migrated = { ...raw.slots };
  for (const [oldSlot, newSlot] of Object.entries(LEGACY_SLOTS))
    if (!migrated[newSlot] && migrated[oldSlot])
      migrated[newSlot] = migrated[oldSlot];
  const used = new Set();
  for (const [slot] of SLOTS) {
    const id = migrated[slot];
    if (id == null || id === "") continue;
    if (typeof id !== "string") throw Error("Invalid roster candidate.");
    if (
      candidates.some((c) => c.id === id && c.type === "Player") &&
      !used.has(id)
    ) {
      r.slots[slot] = id;
      used.add(id);
    }
  }
  if (raw.overrides !== undefined) {
    if (!raw.overrides || typeof raw.overrides !== "object" || Array.isArray(raw.overrides))
      throw Error("Invalid roster override notes.");
    for (const [slot, note] of Object.entries(raw.overrides)) {
      if (!SLOTS.some(([key]) => key === slot) || typeof note !== "string" || note.length > 2000)
        throw Error("Invalid roster override note.");
      if (note.trim() && r.slots[slot]) r.overrides[slot] = note.trim();
    }
  }
  if (raw.legacyException !== undefined) {
    const legacy = raw.legacyException;
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy))
      throw Error("Invalid Legacy Legend exception.");
    const playerId = legacy.playerId ?? "",
      reason = legacy.reason ?? "";
    if (
      typeof playerId !== "string" ||
      typeof reason !== "string" ||
      reason.length > 2000
    )
      throw Error("Invalid Legacy Legend exception.");
    if (
      playerId &&
      candidates.some((c) => c.id === playerId && c.type === "Player")
    )
      r.legacyException = { playerId, reason: reason.trim() };
  }
  if (raw.order !== undefined) {
    if (
      !Array.isArray(raw.order) ||
      raw.order.length !== 9 ||
      new Set(raw.order).size !== 9 ||
      raw.order.some((k) => !r.order.includes(k))
    )
      throw Error("Invalid batting order.");
    r.order = [...raw.order];
  }
  if (
    candidates.some((c) => c.id === raw.manager && c.type === "Manager / coach")
  )
    r.manager = raw.manager;
  if (["balanced", "apex", "custom"].includes(raw.strategy))
    r.strategy = raw.strategy;
  const defaultOrder = SLOTS.slice(0, 9).map(([slot]) => slot);
  if (
    defaultOrder.every((slot) => Boolean(r.slots[slot])) &&
    r.order.every((slot, index) => slot === defaultOrder[index])
  )
    r.order = recommendedBattingOrder(r, candidates);
  return r;
}
export function positions(c) {
  const s = String(c.role || "").toLowerCase();
  const out = [];
  const tests = {
    C: /\b(catcher|c)\b/,
    "1B": /first base|\b1b\b/,
    "2B": /second base|\b2b\b/,
    "3B": /third base|\b3b\b/,
    SS: /shortstop|\bss\b/,
    LF: /left field|\blf\b/,
    CF: /cent(?:er|re) field|\bcf\b/,
    RF: /right field|\brf\b/,
    DH: /designated hitter|\bdh\b/,
    SP: /starting pitcher|\bsp\b/,
    RP: /relief|closer|setup|bullpen|\brp\b/,
  };
  for (const [p, re] of Object.entries(tests)) if (re.test(s)) out.push(p);
  for (const p of c.profile?.positions || [])
    if (
      [
        "C",
        "1B",
        "2B",
        "3B",
        "SS",
        "LF",
        "CF",
        "RF",
        "DH",
        "SP",
        "RP",
      ].includes(p)
    )
      out.push(p);
  if (
    !out.some((p) => ["LF", "CF", "RF"].includes(p)) &&
    /outfield|\bof\b/.test(s)
  )
    out.push("LF", "CF", "RF");
  if (!out.some((p) => ["SP", "RP"].includes(p)) && /pitcher|\bp\b/.test(s))
    out.push("SP", "RP");
  return [...new Set(out)];
}
export function positionGames(c, pos) {
  const retro = retrosheetPositionGames(c, pos);
  if (retro !== null && retro > 0) return retro;
  const value = Number(c.profile?.advancedStats?.positionGames?.[pos]);
  return Number.isFinite(value) && value > 0
    ? value
    : positions(c).includes(pos)
      ? null
      : 0;
}
export function meaningfulPositions(c) {
  const all = positions(c),
    retro = retrosheetProfile(c)?.positionUsage,
    games = retro
      ? Object.fromEntries(
          Object.entries(retro).map(([position, item]) => [
            position,
            Number(item.games) || 0,
          ]),
        )
      : c.profile?.advancedStats?.positionGames;
  if (!games || typeof games !== "object") return all;
  const field = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]
    .map((p) => [p, Number(games[p]) || 0])
    .filter(([, n]) => n > 0);
  if (!field.length) return all;
  const teamGames = Number(c.profile?.advancedStats?.G) || 0,
    fieldTotal = field.reduce((n, [, g]) => n + g, 0),
    // DH rule 6 (current): a player can only take a field spot at a position
    // with 25%+ of his own team games, or at his most-played spot. A 50-game
    // floor keeps tiny cameos from counting. The most-played fallback
    // guarantees every player is eligible somewhere. When team games are
    // missing, fall back to share of field work.
    mostPlayed = field.reduce((best, [p, g]) => (g > (best[1] || 0) ? [p, g] : best), [null, 0])[0],
    denominator = teamGames > 0 ? teamGames : fieldTotal,
    meaningful = field
      .filter(([p, g]) => g >= 50 && (p === mostPlayed || (denominator > 0 && g / denominator >= 0.25)))
      .map(([p]) => p);
  return [...new Set([...all.filter((p) => p === "SP" || p === "RP"), ...meaningful])];
}
export function dataConfidence(c) {
  const grade = dataConfidenceGrade(c);
  return { level: grade.grade.toLowerCase(), label: grade.label, detail: grade.detail };
}
const statNumber = (c, label) => {
  const retroPitching = retrosheetPitchingWork(c);
  if (label === "SV" && retroPitching) return retroPitching.saves;
  if (label === "GS" && retroPitching) return retroPitching.starts;
  const a = c.profile?.advancedStats;
  if (a && a[label] != null && Number.isFinite(Number(a[label])))
    return Number(a[label]);
  const item = keyStats(c)?.values?.find((x) => key(x.label) === key(label));
  return item && Number.isFinite(Number(String(item.value).replaceAll(",", "")))
    ? Number(String(item.value).replaceAll(",", ""))
    : null;
};
const isPitcher = (c) =>
  positions(c).some((p) => p === "SP" || p === "RP") ||
  ["pitcher", "two-way"].includes(c.profile?.designation);
const isLefty = (c) =>
  String(
    c.profile?.throws ||
      c.profile?.pitchHand ||
      retrosheetProfile(c)?.throws ||
      "",
  ).toUpperCase() ===
    "L" || /left[- ]hand(?:ed)?|southpaw/i.test(c.role || "");
const preference = (c) => String(c.profile?.rosterRole || "").toLowerCase();
const trueDH = (c) =>
  preference(c) === "dh" ||
  /^designated hitter$/i.test(c.role || "") ||
  (() => {
    const games = c.profile?.advancedStats?.positionGames || {},
      dh = Number(games.DH) || 0,
      field = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]
        .map((p) => Number(games[p]) || 0)
        .reduce((sum, value) => sum + value, 0);
    return dh >= 300 && dh >= field * 0.5;
  })();
const powerScore = (c) => {
  // DH rule 2 (current): scored on run production only. OPS+ above average
  // with a playing-time/longevity credit (sqrt PA), power (HR), and batting
  // runs. No baserunning, no glove. The old APEX_F term is removed: the
  // H-lane APEX can include baserunning, which Rule 2 excludes, and its
  // hitting signal is already captured by OPS+ and runsBat.
  const opsPlus = statNumber(c, "OPSPlus") || 100,
    pa = Math.max(1, statNumber(c, "PA") || 1);
  return (
    (statNumber(c, "HR") || 0) * 4 +
    Math.max(0, opsPlus - 100) * Math.sqrt(pa) * 0.1 +
    Math.max(0, statNumber(c, "runsBat") || 0) * 0.5
  );
};

const starterSlotKeys = () => SLOTS.slice(0, 9).map(([slot]) => slot);
const lineupScores = (c) => {
  const a = c.profile?.advancedStats || {},
    ops = Number(a.OPSPlus) || 100,
    apex = Number(a.apexBoards?.H?.APEX_F ?? a.apexBoards?.H?.APEX_R ?? a.APEX_F ?? a.APEX_R) || 0,
    runsBat = Number(a.runsBat) || 0,
    runsBr = Number(a.runsBaserunning) || 0,
    pa = Math.max(1, Number(a.PA) || 1),
    pos = meaningfulPositions(c),
    athletic = pos.some((p) => ["SS", "CF", "2B"].includes(p)) ? 10 : pos.some((p) => ["LF", "RF", "3B"].includes(p)) ? 4 : 0,
    slowCatcher = pos.includes("C") && runsBr <= 0,
    slowCorner = pos.some((p) => ["1B", "DH"].includes(p)) && !pos.some((p) => ["SS", "CF", "2B"].includes(p)),
    speed = runsBr * 2 + athletic - (slowCatcher ? 60 : 0) - (slowCorner ? 12 : 0),
    rateValue = ops + (runsBat / pa) * 180,
    allAround = rateValue + apex * 1.35 + Math.max(-15, runsBr) * 0.65;
  return {
    leadoff: rateValue + speed,
    table: rateValue * 1.05 + speed * 0.45 + apex * 0.55,
    allAround,
    power: powerScore(c),
    offense: allAround + powerScore(c) * 0.22,
    slowCatcher,
  };
};

export function recommendedBattingOrder(roster, candidates) {
  const byId = new Map(candidates.map((c) => [c.id, c])),
    rows = starterSlotKeys()
      .map((slot) => ({ slot, c: byId.get(roster.slots?.[slot]) }))
      .filter((row) => row.c);
  if (rows.length < 2) return [...(roster.order || starterSlotKeys())];
  const remaining = [...rows],
    take = (score) => {
      remaining.sort(
        (a, b) =>
          score(lineupScores(b.c)) - score(lineupScores(a.c)) ||
          rows.indexOf(a) - rows.indexOf(b),
      );
      return remaining.shift();
    },
    ordered = [];
  ordered.push(take((s) => s.leadoff));
  if (remaining.length) ordered.push(take((s) => s.table));
  if (remaining.length) ordered.push(take((s) => s.allAround));
  if (remaining.length) ordered.push(take((s) => s.power + s.allAround * 0.35));
  if (remaining.length) ordered.push(take((s) => s.power));
  remaining.sort(
    (a, b) =>
      lineupScores(b.c).offense - lineupScores(a.c).offense ||
      rows.indexOf(a) - rows.indexOf(b),
  );
  ordered.push(...remaining);
  const assigned = ordered.map((row) => row.slot),
    unassigned = (roster.order || starterSlotKeys()).filter(
      (slot) => !assigned.includes(slot),
    );
  return [...assigned, ...unassigned];
}

export function lineupOrderNote(roster, candidates) {
  const byId = new Map(candidates.map((c) => [c.id, c])),
    shown = (roster.order || starterSlotKeys())
      .map((slot) => ({ slot, c: byId.get(roster.slots?.[slot]) }))
      .filter((row) => row.c),
    recommended = recommendedBattingOrder(roster, candidates),
    recommendedLead = byId.get(roster.slots?.[recommended[0]]);
  if (!shown.length) return "Fill the starting nine to build the batting order.";
  if (shown[0].c.id !== recommendedLead?.id)
    return `${shown[0].c.name} is currently shown at leadoff. Baseball logic recommends ${recommendedLead?.name || "another table-setter"} for the stronger on-base and speed profile.`;
  const one = shown[0]?.c?.name,
    two = shown[1]?.c?.name,
    three = shown[2]?.c?.name,
    four = shown[3]?.c?.name,
    five = shown[4]?.c?.name;
  return `${one} leads off for the strongest table-setting profile. ${two} follows in the two-hole. ${[three, four].filter(Boolean).join(" and ")} form the all-around heart of the order${five ? `, with ${five} supplying the next middle-order power bat` : ""}.`;
}
const saves = (c) =>
  statNumber(c, "SV") ??
  (/closer/i.test(c.role || "") || preference(c) === "closer" ? 1 : 0);
const coverage = (c, set) => meaningfulPositions(c).filter((p) => set.includes(p)).length;
const played = (c, pos) => meaningfulPositions(c).includes(pos);
const franchiseSeasons = (c) => {
  const a = c.profile?.advancedStats,
    value = Number(
      a?.franchiseSeasons ?? a?.intake?.franchiseSeasons ?? a?.seasons,
    );
  if (Number.isFinite(value)) return value;
  const imported = statNumber(c, "Seasons");
  return Number.isFinite(imported) ? imported : 0;
};
const roleFit = (c, slot) => {
  if (!c || c.type !== "Player") return false;
  const positionEligible = !isPitcher(c) || c.profile?.designation === "two-way";
  if (["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].includes(slot))
    return played(c, slot);
  if (slot === "DH") return positionEligible;
  if (/^SP\d$/.test(slot)) return meaningfulPositions(c).includes("SP");
  if (["CL", "SU1", "SU2", "MR1", "MR2"].includes(slot))
    return meaningfulPositions(c).includes("RP");
  if (slot === "LHS") return meaningfulPositions(c).includes("RP") && isLefty(c);
  if (slot === "LR") return meaningfulPositions(c).some((p) => p === "RP" || p === "SP");
  if (slot === "C2") return positionEligible && played(c, "C");
  if (slot === "UTIL")
    return (
      positionEligible &&
      ["2B", "3B", "SS"].filter((p) => played(c, p)).length >= 2
    );
  if (slot === "OF4")
    return positionEligible && ["LF", "CF", "RF"].some((p) => played(c, p));
  if (slot === "CI")
    return positionEligible && (played(c, "1B") || played(c, "3B"));
  if (slot === "PH") return positionEligible;
  return false;
};
const rosterWorkload = (c, slot) => {
  const a = c.profile?.advancedStats || {},
    retroPitching = retrosheetPitchingWork(c),
    totalIP = Number(a.IP ?? statNumber(c, "IP")) || 0,
    startIPValue = Number(a.startIP),
    reliefIPValue = Number(a.reliefIP),
    startIP = retroPitching?.starterInnings
      ? retroPitching.starterInnings
      : Number.isFinite(startIPValue)
        ? Math.max(0, startIPValue)
      : meaningfulPositions(c).includes("SP") && !meaningfulPositions(c).includes("RP")
        ? totalIP
        : 0,
    reliefIP = retroPitching?.reliefInnings
      ? retroPitching.reliefInnings
      : Number.isFinite(reliefIPValue)
        ? Math.max(0, reliefIPValue)
      : meaningfulPositions(c).includes("RP") && !meaningfulPositions(c).includes("SP")
        ? totalIP
        : 0,
    pa = Math.max(0, Number(a.PA ?? statNumber(c, "PA")) || 0);
  if (/^SP\d$/.test(slot))
    return {
      value: startIP,
      minimum: ROSTER_ELIGIBILITY.starterIP,
      unit: "starter IP",
    };
  if (BULLPEN_SLOTS.includes(slot))
    return {
      value: reliefIP,
      minimum: ROSTER_ELIGIBILITY.reliefIP,
      unit: "relief IP",
    };
  const specialist = slot === "C" || BENCH_SLOTS.includes(slot),
    minimum = specialist
      ? ROSTER_ELIGIBILITY.specialistPA
      : ROSTER_ELIGIBILITY.positionPA;
  return { value: pa, minimum, unit: "PA" };
};
export function rosterEligibility(c, slot, { legacyExceptionId = "" } = {}) {
  const seasons = franchiseSeasons(c),
    fit = roleFit(c, slot),
    workload = rosterWorkload(c, slot),
    tenureMet = seasons >= ROSTER_ELIGIBILITY.tenureSeasons,
    workloadMet = workload.value >= workload.minimum,
    baseEligible = !!c && c.type === "Player" && fit && tenureMet && workloadMet,
    exceptionEligible = !!c && c.type === "Player" && fit && tenureMet && !workloadMet,
    usingException = exceptionEligible && legacyExceptionId === c?.id,
    reasons = [];
  if (!fit) reasons.push(`No meaningful franchise experience for ${slot}`);
  if (!tenureMet)
    reasons.push(
      `${Math.max(0, ROSTER_ELIGIBILITY.tenureSeasons - seasons)} more franchise season${ROSTER_ELIGIBILITY.tenureSeasons - seasons === 1 ? "" : "s"} needed`,
    );
  if (!workloadMet)
    reasons.push(
      `${Math.max(0, Math.ceil(workload.minimum - workload.value))} more ${workload.unit} needed`,
    );
  return {
    eligible: baseEligible || usingException,
    baseEligible,
    exceptionEligible,
    usingException,
    fit,
    tenureMet,
    workloadMet,
    seasons,
    workload,
    reason: reasons.join(" · ") || "Roster eligible",
  };
}
export function eligibleForSlot(c, slot, options = {}) {
  return rosterEligibility(c, slot, options).eligible;
}
function slotQuality(c, slot) {
  if (["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].includes(slot)) {
    const games = positionGames(c, slot);
    return games === null ? 1 : games >= 200 ? 3 : games >= 50 ? 2 : 1;
  }
  if (slot === "C2") {
    const games = positionGames(c, "C");
    return games === null ? 1 : games >= 200 ? 3 : games >= 50 ? 2 : 1;
  }
  if (slot === "DH") return trueDH(c) ? 3 : 2;
  if (slot === "CL") return saves(c) >= 100 ? 4 : saves(c) > 0 ? 3 : 2;
  if (slot === "LHS") return preference(c) === "left-specialist" ? 4 : 3;
  if (slot === "LR")
    return preference(c) === "long" || preference(c) === "swing"
      ? 4
      : positions(c).includes("RP") && positions(c).includes("SP")
        ? 3
        : 2;
  if (slot === "UTIL")
    return ["2B", "3B", "SS"].filter((p) => played(c, p)).length;
  if (slot === "OF4") return played(c, "CF") ? 3 : 2;
  return 2;
}
export function slotCandidates(candidates, slot, selectedId = "", options = {}) {
  const indexed = candidates
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => eligibleForSlot(c, slot, options) || c.id === selectedId);
  return indexed
    .sort((a, b) => {
      if (a.c.id === selectedId && !eligibleForSlot(a.c, slot, options)) return -1;
      if (b.c.id === selectedId && !eligibleForSlot(b.c, slot, options)) return 1;
      return (
        slotQuality(b.c, slot) - slotQuality(a.c, slot) ||
        (rosterMetric(b.c, slot)?.value ?? -Infinity) -
          (rosterMetric(a.c, slot)?.value ?? -Infinity) ||
        a.index - b.index
      );
    })
    .map((x) => x.c);
}
export function slotShortlist(
  candidates,
  slot,
  selectedId = "",
  options = {},
  limit = GUIDED_SHORTLIST_SIZE,
) {
  const all = slotCandidates(candidates, slot, selectedId, options),
    selected = all.find((c) => c.id === selectedId),
    short = all.filter((c) => c.id !== selectedId).slice(0, Math.max(1, limit));
  if (selected) short.unshift(selected);
  return short;
}
export function slotFitExplanation(c, slot, options = {}) {
  const status = rosterEligibility(c, slot, options),
    module = rosterModule(c),
    hand = String(
      c.profile?.bats ||
        c.profile?.throws ||
        retrosheetProfile(c)?.bats ||
        retrosheetProfile(c)?.throws ||
        "",
    ).toUpperCase(),
    parts = [
      `${Math.round(status.seasons)} franchise seasons`,
      `${Math.round(status.workload.value).toLocaleString()} ${status.workload.unit}`,
    ];
  if (["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "C2"].includes(slot)) {
    const pos = slot === "C2" ? "C" : slot,
      games = positionGames(c, pos);
    if (games != null) parts.push(`${Math.round(games)} games at ${pos}`);
  }
  if (slot === "UTIL") {
    const spots = ["2B", "3B", "SS"].filter((p) => played(c, p));
    parts.push(`covers ${spots.join(", ")}`);
  }
  if (slot === "OF4") {
    const spots = ["LF", "CF", "RF"].filter((p) => played(c, p));
    parts.push(`outfield coverage: ${spots.join(", ")}`);
  }
  if (slot === "CI") {
    const spots = ["1B", "3B"].filter((p) => played(c, p));
    parts.push(`corner coverage: ${spots.join(" and ")}`);
  }
  if (slot === "DH")
    parts.push(trueDH(c) ? "true designated-hitter experience" : "power-bat option");
  if (slot === "CL" && saves(c)) parts.push(`${Math.round(saves(c))} saves`);
  if (slot === "LHS") parts.push("verified left-handed arm");
  if (slot === "LR") parts.push("verified franchise relief workload");
  const retroRole = retrosheetRoleEvidence(c);
  if (retroRole && BULLPEN_SLOTS.includes(slot))
    parts.push(`${retroRole.role.toLowerCase()} from game logs`);
  else if (module.pitcherRole?.role && (BULLPEN_SLOTS.includes(slot) || /^SP\d$/.test(slot)))
    parts.push(module.pitcherRole.role.toLowerCase());
  if (hand) parts.push(`${hand}-handed`);
  if (status.usingException) parts.push("uses the Legacy Legend workload exception");
  return parts.join(" · ");
}
export function slotFitLabel(c, slot) {
  if (
    ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].includes(slot) ||
    slot === "C2"
  ) {
    const pos = slot === "C2" ? "C" : slot,
      games = positionGames(c, pos);
    return games === null ? pos : `${pos} · ${Math.round(games)} G`;
  }
  if (slot === "CL" && saves(c)) return `${Math.round(saves(c))} SV`;
  if (slot === "LHS") return "LHP";
  if (/^SP\d$/.test(slot)) return `${Math.round(statNumber(c, "GS") || 0)} GS`;
  if (["SU1", "SU2", "MR1", "MR2", "LR"].includes(slot)) {
    const work = retrosheetPitchingWork(c);
    return `${Number(work?.reliefInnings ?? statNumber(c, "reliefIP") ?? 0).toFixed(0)} relief IP`;
  }
  return c.role || positions(c).join("/");
}

export function addAutomaticRoleFitExplanations(roster, candidates) {
  const r = structuredClone(roster),
    byId = new Map(candidates.map((c) => [c.id, c])),
    entries = Object.entries(r.slots || {}),
    legacyExceptionId = r.legacyException?.playerId || "";
  r.overrides = r.overrides || {};
  for (const [slot, id] of entries) {
    if (r.overrides[slot]?.trim()) continue;
    const selected = byId.get(id),
      selectedMetric = rosterMetric(selected, slot);
    if (!selected || !Number.isFinite(Number(selectedMetric?.value))) continue;
    const occupiedElsewhere = new Set(
        entries.filter(([key]) => key !== slot).map(([, playerId]) => playerId),
      ),
      alternatives = candidates
        .filter(
          (c) =>
            c.type === "Player" &&
            eligibleForSlot(c, slot, { legacyExceptionId }) &&
            !occupiedElsewhere.has(c.id),
        )
        .map((c) => ({ c, metric: rosterMetric(c, slot) }))
        .filter((row) => Number.isFinite(Number(row.metric?.value)))
        .sort((a, b) => Number(b.metric.value) - Number(a.metric.value)),
      best = alternatives[0];
    if (
      !best ||
      best.c.id === selected.id ||
      Number(best.metric.value) <= Number(selectedMetric.value) * 1.01
    )
      continue;
    r.overrides[slot] = `Automatic role-fit draft: ${selected.name} was chosen for ${slot} because ${slotFitExplanation(selected, slot, { legacyExceptionId })}. ${best.c.name} has the higher ${best.metric.label}, so Joe should review this choice.`;
  }
  return r;
}

// DH rule 5 (current): DH glove rule. After the nine are set, compare the DH
// with the top 2-3 starters he could replace in the field. If the DH has the
// better glove by 1+ run per 150 games, he plays the field and the other guy
// DHs. Uses career runsDefense per 150 games as the glove rate.
// Data guardrail: the DH must have played at least half his field games at
// the compared position, so the career rate is a fair proxy for his glove
// there. (Per-position defensive data lives in the data pipeline; until it
// lands, this keeps the rule from misfiring on blended utility rates.)
function applyDHGloveRule(roster, players) {
  const byId = new Map(players.map((c) => [c.id, c])),
    dhId = roster.slots?.DH,
    dh = dhId ? byId.get(dhId) : null;
  if (!dh) return;
  const gloveRate = (c) => {
      const a = c.profile?.advancedStats || {},
        runs = Number(a.runsDefense),
        g = Number(a.G);
      if (!Number.isFinite(runs) || !Number.isFinite(g) || g <= 0) return null;
      return (runs / g) * 150;
    },
    dhRate = gloveRate(dh);
  if (dhRate == null) return;
  const fieldPositions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"],
    dhGames = dh.profile?.advancedStats?.positionGames || {},
    dhFieldTotal = fieldPositions.reduce((n, p) => n + (Number(dhGames[p]) || 0), 0),
    // Top 3 eligible field positions by games played, requiring at least
    // half the DH's field work came at the position.
    candidates = fieldPositions
      .filter((pos) => meaningfulPositions(dh).includes(pos))
      .map((pos) => ({ pos, games: Number(dhGames[pos]) || 0 }))
      .filter(({ games }) => dhFieldTotal > 0 && games / dhFieldTotal >= 0.5)
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);
  let bestSwap = null;
  for (const { pos } of candidates) {
    const starterId = roster.slots?.[pos],
      starter = starterId ? byId.get(starterId) : null;
    if (!starter || starter.id === dh.id) continue;
    const starterRate = gloveRate(starter);
    if (starterRate == null) continue;
    const advantage = dhRate - starterRate;
    if (advantage >= 1 && (!bestSwap || advantage > bestSwap.advantage)) {
      bestSwap = { pos, starter, advantage };
    }
  }
  if (bestSwap) {
    // DH takes the field; the displaced starter becomes the DH.
    roster.slots[bestSwap.pos] = dh.id;
    roster.slots.DH = bestSwap.starter.id;
  }
}

export function draftRoster(candidates, existing, allCandidates = candidates, strategy = existing?.strategy || "balanced") {
  const r = cleanRoster(existing, allCandidates),
    used = new Set(Object.values(r.slots)),
    players = candidates.filter((c) => c.type === "Player"),
    defaultOrder = starterSlotKeys(),
    orderWasDefault = r.order.every((slot, index) => slot === defaultOrder[index]);
  r.strategy = ["balanced", "apex", "custom"].includes(strategy) ? strategy : "balanced";
  const apexFor = (c, slot) => {
    const lane = /^SP\d$/.test(slot) ? "SP" : BULLPEN_SLOTS.includes(slot) ? "RP" : "H";
    const board = c.profile?.advancedStats?.apexBoards?.[lane];
    return Number(board?.APEX_F ?? board?.APEX_R) || 0;
  };
  const available = (filter, slot) => {
    const list = players.filter(
      (c) => !used.has(c.id) && eligibleForSlot(c, slot) && filter(c),
    );
    list.sort((a, b) => {
      const rosterDifference =
        (rosterMetric(b, slot)?.value ?? -Infinity) -
        (rosterMetric(a, slot)?.value ?? -Infinity);
      return r.strategy === "apex"
        ? rosterDifference || apexFor(b, slot) - apexFor(a, slot)
        : slotQuality(b, slot) - slotQuality(a, slot) || rosterDifference;
    });
    return list;
  };
  const take = (slot, filter, sort = null) => {
    if (r.slots[slot]) return;
    const list = available(filter, slot);
    if (sort) list.sort((a, b) => sort(a, b) || (r.strategy === "apex" ? apexFor(b, slot) - apexFor(a, slot) : 0));
    const c = list[0];
    if (c) {
      r.slots[slot] = c.id;
      used.add(c.id);
    }
  };
  for (const slot of ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]) {
    take(
      slot,
      (c) => played(c, slot) && (positionGames(c, slot) ?? 200) >= 200,
    );
    take(slot, (c) => played(c, slot));
  }
  // DH rule 1+2 (current): anyone can DH, no DH games required, no penalty
  // for never playing DH. The DH goes to the best hitter by run production
  // (powerScore: OPS+, power, batting runs, longevity). The old true-DH
  // preference is removed; true-DH data is used for the DH comparison only.
  // DH rule 8 (current): flag a Close Call when the top two DH candidates
  // are very close (within 5% on the hitting-only score).
  {
    const dhPool = players
      .filter((c) => c.type === "Player" && !isPitcher(c) && !used.has(c.id))
      .map((c) => ({ c, score: powerScore(c) }))
      .sort((a, b) => b.score - a.score);
    if (dhPool[0]) {
      r.slots.DH = dhPool[0].c.id;
      used.add(dhPool[0].c.id);
    }
    if (dhPool.length >= 2 && dhPool[0].score > 0) {
      const gap = (dhPool[0].score - dhPool[1].score) / dhPool[0].score;
      if (gap < 0.05) {
        r.overrides = r.overrides || {};
        const note = `Close call at DH: ${dhPool[0].c.name} edged ${dhPool[1].c.name} by ${(gap * 100).toFixed(1)}% on the hitting-only score.`;
        r.overrides.DH = r.overrides.DH ? `${r.overrides.DH} ${note}` : note;
      }
    }
  }
  // DH rule 5 (current): DH glove rule. After the nine are set, compare the
  // DH with the top 2-3 starters he could replace in the field. If the DH
  // has the better glove by 1+ run per 150 games, he plays the field and the
  // other guy DHs. (This is why DiMaggio plays CF and Mantle DHs.)
  applyDHGloveRule(r, players);
  // Roster optimizer (Joe 2026-10-03): try pairwise swaps to maximize total
  // 9-man value. Runs before rotation/bullpen/bench so the bench backfills
  // any promoted players.
  optimizeNineMan(r, players);
  // Sync the used set with optimizer changes.
  used.clear();
  for (const id of Object.values(r.slots)) if (id) used.add(id);
  for (let i = 1; i <= 5; i++)
    take("SP" + i, (c) => meaningfulPositions(c).includes("SP"));
  // v0.4: 2 lefty / 2 righty rotation. Applied in the balanced strategy as a
  // preference, not a mandate: a lefty is preferred for SP4/SP5 only when
  // within 25% of the best available arm, so balance never forces a clearly
  // inferior starter. Apex strategy stays pure merit.
  if (r.strategy === "balanced") {
    const rotationLefties = () =>
      ["SP1", "SP2", "SP3", "SP4", "SP5"]
        .map((key) => players.find((c) => c.id === r.slots[key]))
        .filter((c) => c && isLefty(c)).length;
    for (const i of [4, 5]) {
      const slot = "SP" + i,
        occupant = players.find((c) => c.id === r.slots[slot]);
      if (!occupant || isLefty(occupant) || rotationLefties() >= 2) continue;
      // Guardrail compares against the arm already slotted, not the best
      // remaining arm, so balance never displaces a clearly superior starter.
      const metric = (c) => rosterMetric(c, slot)?.value ?? -Infinity,
        floor = 0.75 * metric(occupant),
        leftyPick = players
          .filter(
            (c) =>
              !used.has(c.id) &&
              eligibleForSlot(c, slot) &&
              meaningfulPositions(c).includes("SP") &&
              isLefty(c) &&
              metric(c) >= floor,
          )
          .sort((a, b) => metric(b) - metric(a))[0];
      if (leftyPick) {
        used.delete(occupant.id);
        r.slots[slot] = leftyPick.id;
        used.add(leftyPick.id);
      }
    }
  }
  const relief = (c) => meaningfulPositions(c).includes("RP");
  take(
    "CL",
    (c) => relief(c) && preference(c) === "closer",
    (a, b) => saves(b) - saves(a),
  );
  take(
    "CL",
    relief,
    (a, b) => saves(b) - saves(a) || powerScore(b) - powerScore(a),
  );
  take(
    "LHS",
    (c) =>
      relief(c) &&
      isLefty(c) &&
      (preference(c) === "left-specialist" || /specialist/i.test(c.role || "")),
  );
  take("LHS", (c) => relief(c) && isLefty(c));
  for (const slot of ["SU1", "SU2"])
    take(slot, (c) => relief(c) && ["setup", "closer"].includes(preference(c)));
  for (const slot of ["SU1", "SU2"]) take(slot, relief);
  for (const slot of ["MR1", "MR2"])
    take(slot, (c) => relief(c) && ["middle", "setup"].includes(preference(c)));
  for (const slot of ["MR1", "MR2"]) take(slot, relief);
  // LR is the emergency starter, not a 7th pure bullpen arm. Prefer a
  // swingman (SP+RP eligible), then any starter with the stamina for long
  // relief, before falling back to pure relievers. A 26-man roster rarely
  // has seven quality dedicated bullpen arms; the long man should be able
  // to spot-start.
  const isSwingman = (c) => {
    const mp = meaningfulPositions(c);
    return mp.includes("SP") && mp.includes("RP");
  };
  take("LR", (c) => isSwingman(c) && ["long", "swing"].includes(preference(c)));
  take("LR", isSwingman);
  take("LR", (c) => meaningfulPositions(c).includes("SP"));
  take("LR", (c) => relief(c) && ["long", "swing"].includes(preference(c)));
  take("LR", relief);
  take("C2", (c) => meaningfulPositions(c).includes("C"));
  // UTIL: prefer the player covering the most spots. A super-utility who
  // covers middle infield plus corners and outfield frees the rest of the
  // bench for bats. Breadth is the tiebreaker after the coverage minimum.
  const coverageBreadth = (c) =>
    coverage(c, ["2B", "3B", "SS", "1B", "LF", "CF", "RF"]);
  take(
    "UTIL",
    (c) => coverage(c, ["2B", "3B", "SS"]) >= 2,
    (a, b) => coverageBreadth(b) - coverageBreadth(a),
  );
  take(
    "UTIL",
    (c) => coverage(c, ["2B", "3B", "SS"]) >= 1,
    (a, b) => coverageBreadth(b) - coverageBreadth(a),
  );
  // OF4: if a starting corner outfielder can also play CF, the OF4 only
  // needs corner coverage (the starter shifts to CF when needed). This
  // frees the spot for a better bat instead of a redundant CF glove.
  const cornerOFShiftsToCF = ["LF", "RF"].some((slot) => {
    const starter = players.find((c) => c.id === r.slots[slot]);
    return starter && meaningfulPositions(starter).includes("CF");
  });
  if (cornerOFShiftsToCF) {
    take(
      "OF4",
      (c) => coverage(c, ["LF", "RF"]) >= 1,
      (a, b) => coverageBreadth(b) - coverageBreadth(a),
    );
  } else {
    take("OF4", (c) => meaningfulPositions(c).includes("CF"));
    take(
      "OF4",
      (c) => coverage(c, ["LF", "CF", "RF"]) >= 1,
      (a, b) => coverageBreadth(b) - coverageBreadth(a),
    );
  }
  take("CI", (c) => coverage(c, ["1B", "3B"]) >= 1);
  take(
    "PH",
    () => true,
    (a, b) => powerScore(b) - powerScore(a),
  );
  if (!r.manager)
    r.manager = candidates.find((c) => c.type === "Manager / coach")?.id || "";
  if (
    orderWasDefault &&
    defaultOrder.every((slot) => Boolean(r.slots[slot]))
  )
    r.order = recommendedBattingOrder(r, allCandidates);
  // Position battles (Joe 2026-10-03): for premium defense positions and any
  // close call, flag when the top two are within 15%. The user picks the
  // winner; clicking the position shows the comparison.
  r.battles = detectPositionBattles(r, players);
  return addAutomaticRoleFitExplanations(r, allCandidates);
}

// Optimize the starting nine as a unit. The greedy draft picks each position
// independently; this tries swapping each fielder with top alternatives and
// re-picking the DH, keeping the configuration with the highest total value.
// This catches cases like Stargell-1B opening DH for Kiner.
function optimizeNineMan(roster, players) {
  const byId = new Map(players.map((c) => [c.id, c]));
  const fieldSlots = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  
  // Value of the 9-man: fielders by rosterMetric, DH by powerScore.
  const nineManValue = (slots) => {
    let total = 0;
    for (const s of fieldSlots) {
      const c = byId.get(slots[s]);
      if (!c) continue;
      total += Number(rosterMetric(c, s)?.value) || 0;
    }
    const dh = byId.get(slots.DH);
    if (dh) total += powerScore(dh) / 10; // Scale to match fielder magnitudes.
    return total;
  };
  
  // Get top 3 alternatives for a slot (excluding current 9-man only; bench
  // players are eligible to be promoted).
  const nineManSlots = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
  const alternatives = (slot, currentNine) => {
    const usedNine = new Set(nineManSlots.map((s) => currentNine[s]).filter(Boolean));
    return players
      .filter((c) => c.type === "Player" && !usedNine.has(c.id) && meaningfulPositions(c).includes(slot))
      .map((c) => ({ c, score: Number(rosterMetric(c, slot)?.value) || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.c);
  };
  
  // Re-pick DH from players not in the 9-man.
  const repickDH = (slots) => {
    const used = new Set(fieldSlots.map((s) => slots[s]).filter(Boolean));
    const dhPool = players.filter((c) => c.type === "Player" && !used.has(c.id));
    if (!dhPool.length) return slots.DH;
    return dhPool.sort((a, b) => powerScore(b) - powerScore(a))[0].id;
  };
  
  let improved = true, iterations = 0;
  while (improved && iterations < 3) {
    improved = false;
    iterations++;
    const currentValue = nineManValue(roster.slots);
    
    for (const slot of fieldSlots) {
      const currentNine = { ...roster.slots };
      const alts = alternatives(slot, currentNine);
      
      for (const alt of alts) {
        const trial = { ...roster.slots, [slot]: alt.id };
        trial.DH = repickDH(trial);
        const trialValue = nineManValue(trial);
        
        if (trialValue > currentValue * 1.01) { // 1% improvement threshold.
          // If the alternative was on the bench, clear that bench slot.
          for (const [s, id] of Object.entries(roster.slots)) {
            if (id === alt.id && !nineManSlots.includes(s)) {
              delete roster.slots[s];
            }
          }
          roster.slots[slot] = alt.id;
          roster.slots.DH = trial.DH;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
}

// Detect positions where the top two candidates are close enough that the
// user should decide. Covers premium defense spots (elite glove vs bat) and
// any other tight race. Returns { [slot]: { candidates: [...], leaderId } }.
export function detectPositionBattles(roster, players) {
  const byId = new Map(players.map((c) => [c.id, c])),
    battles = {},
    // Check premium positions plus 1B/3B/LF/RF (DH already has close-call).
    checkSlots = [...PREMIUM_DEFENSE_POSITIONS, "1B", "3B", "LF", "RF"];
  for (const slot of checkSlots) {
    const starterId = roster.slots?.[slot];
    if (!starterId) continue;
    const starter = byId.get(starterId);
    if (!starter) continue;
    // Top 3 by the slot's metric, including the starter.
    const usedOthers = new Set(
      Object.values(roster.slots || {}).filter((id) => id !== starterId),
    );
    const ranked = players
      .filter(
        (c) =>
          c.type === "Player" &&
          !usedOthers.has(c.id) &&
          meaningfulPositions(c).includes(slot),
      )
      .map((c) => ({
        c,
        score: Number(rosterMetric(c, slot)?.value) || 0,
        defense: Math.round(defenseRate150(c) * 10) / 10,
        opsPlus: Number(c.profile?.advancedStats?.OPSPlus) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (ranked.length < 2 || ranked[0].score <= 0) continue;
    const gap = (ranked[0].score - ranked[1].score) / ranked[0].score;
    // 15% threshold: flags genuine toss-ups like Mazeroski/Ritchey.
    if (gap < 0.15) {
      battles[slot] = {
        leaderId: ranked[0].c.id,
        gapPct: Math.round(gap * 1000) / 10,
        candidates: ranked.map(({ c, score, defense, opsPlus }) => ({
          id: c.id,
          name: c.name,
          score: Math.round(score * 10) / 10,
          defense,
          opsPlus: Math.round(opsPlus),
        })),
      };
    }
  }
  return battles;
}
export function assignSlot(roster, slot, id) {
  const r = structuredClone(roster);
  if (!SLOTS.some(([k]) => k === slot)) throw Error("Unknown roster slot.");
  if (id) {
    for (const k of Object.keys(r.slots))
      if (r.slots[k] === id) delete r.slots[k];
    r.slots[slot] = id;
    if (r.overrides) delete r.overrides[slot];
  } else {
    delete r.slots[slot];
    if (r.overrides) delete r.overrides[slot];
  }
  return r;
}
