import { createEvidenceUI } from "./evidence-ui.js";
import { migrateScoringState } from "./prepare-evidence.js";
import { createAutoRankingUI } from "./auto-ranking-ui.js";
import { honorsHTML } from "./honors.js";
import { rankedCandidates } from "./workspace-extra.js";
import { createCloudSave, requestJSON } from "./cloud-save.js";
import { createStudioUI } from "./studio-ui.js";
import {
  LEGACY_FACTORS,
  closeCall,
  cleanLegacy,
  safeSource,
} from "./legacy-score.js";
import { renderLegacyEditor, pilotHTML } from "./legacy-ui.js";
import {
  applyTeamTheme,
  teamLogo,
  teamHat,
  teamBallpark,
} from "./team-theme.js";
import { createBulkLookup } from "./bulk-lookup.js";
import { createLegendsUI } from "./legends-ui.js";
import {
  applyAutoScores,
  statStrip,
  rosterCompanionHTML,
} from "./legends.js";
import { retrosheetEvidenceHTML, retrosheetProfile } from "./retrosheet.js";
import { createImportUI, renderStatImports } from "./import-ui.js";
import { FRANCHISE_DATA } from "./data-import.js";
import {
  franchiseMoments,
  momentStoryLink,
  TONES,
  toneLabel,
} from "./franchise-moments.js";
import { dataConfidence } from "./legends.js";
import {
  apexOctober,
  applyApexOctoberEvidence,
} from "./apex-formula.js";
import { createHistoryUI } from "./history-ui.js";
import {
  KEY,
  FACTORS,
  PILLARS,
  TEAMS,
  TYPES,
  defaults,
  calculate,
  moveCandidate,
  rankByScore,
  newCandidate,
  seedState,
  validateImport,
} from "./model.js";
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name, size = 18) => {
  const paths = {
    diamond: '<path d="m12 3 9 9-9 9-9-9Z"/><path d="m12 7 5 5-5 5-5-5Z"/>',
    board:
      '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    compare: '<path d="M4 4v16h6V4ZM14 4v16h6V4Z"/>',
    book: '<path d="M12 6v15M12 6C8 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-6-1-10 2Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    tune: '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="9" cy="18" r="2" fill="currentColor"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    undo: '<path d="m8 3-5 5 5 5M3 8h11a7 7 0 0 1 0 14"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    grip: '<path d="M9 5v.1M15 5v.1M9 12v.1M15 12v.1M9 19v.1M15 19v.1" stroke-width="3"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.diamond}</svg>`;
};
let state;
let storageIssue = "";
let invalidStored = false;
try {
  const raw = localStorage.getItem(KEY);
  state = raw ? validateImport(JSON.parse(raw)).state : seedState();
} catch (e) {
  state = seedState();
  storageIssue =
    "Saved data could not be read. Export recovery data from Backups before replacing it.";
  invalidStored = true;
}
let tab = "home",
  query = "",
  filter = "all",
  listMode = "top",
  compareIds = [],
  history = [],
  dragId = null,
  editorDraft = null,
  apexLane = "collection",
  apexEra = "",
  playerView = "rankings",
  moreView = "menu",
  momentFilter = "all",
  historyView = "years";
const modeLabel = (m) =>
  m === "apex"
    ? "APEX performance"
    : m === "legacy"
      ? "Custom legacy"
      : m === "lore"
        ? "Classic custom"
        : "Archived FLS";
const modeFactors = (m) =>
  m === "apex"
    ? [
        ["Apex", "Best 3 seasons", 100],
        ["Prime", "Best 5-year run", 100],
        ["Reign", "Career dominance", 100],
      ]
    : m === "legacy"
      ? LEGACY_FACTORS
      : m === "lore"
        ? FACTORS
        : PILLARS;
const board = () => state.boards[state.selected];
const team = () => TEAMS.find((t) => t[0] === state.selected);
// Season-by-season franchise lines (Player Book Seasons tab, prototype:
// NYM/LAD/NYY). Data in public/data/seasons/{TEAM}.json, fetched on demand.
const seasonsCache = {};
const normName = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const fmt3 = (v) => (v === 1 ? "1.000" : String(Number(v || 0).toFixed(3)).replace(/^0/, ""));
const fmt2 = (v) => Number(v || 0).toFixed(2);
const seasonBattingHTML = (seasons) => {
  const rows = seasons
    .map(
      (s) =>
        `<tr><td>${s.y}</td><td>${esc(s.t)}</td><td>${s.g}</td><td>${s.pa}</td><td>${s.ab}</td><td>${s.r}</td><td>${s.h}</td><td>${s.hr}</td><td>${s.rbi}</td><td>${s.sb}</td><td>${s.bb}</td><td>${s.so}</td><td>${fmt3(s.avg)}</td><td>${fmt3(s.obp)}</td><td>${fmt3(s.slg)}</td><td>${s.opsplus || ""}</td><td>${s.war ?? ""}</td><td>${esc(s.pos || "")}</td></tr>`,
    )
    .join("");
  const t = seasons.reduce(
    (a, s) => ({
      g: a.g + s.g, pa: a.pa + (s.pa || 0), ab: a.ab + s.ab, r: a.r + s.r,
      h: a.h + s.h, hr: a.hr + s.hr, rbi: a.rbi + (s.rbi || 0),
      sb: a.sb + (s.sb || 0), bb: a.bb + (s.bb || 0), so: a.so + (s.so || 0),
      war: a.war + (s.war || 0),
    }),
    { g: 0, pa: 0, ab: 0, r: 0, h: 0, hr: 0, rbi: 0, sb: 0, bb: 0, so: 0, war: 0 },
  );
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Year</th><th>Tm</th><th>G</th><th>PA</th><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>SB</th><th>BB</th><th>SO</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS+</th><th>WAR</th><th>Pos</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">Total</td><td>${t.g}</td><td>${t.pa}</td><td>${t.ab}</td><td>${t.r}</td><td>${t.h}</td><td>${t.hr}</td><td>${t.rbi}</td><td>${t.sb}</td><td>${t.bb}</td><td>${t.so}</td><td>${fmt3(t.ab ? t.h / t.ab : 0)}</td><td colspan="2"></td><td></td><td>${t.war ? t.war.toFixed(1) : ""}</td><td></td></tr></tfoot></table></div>`;
};
const seasonPitchingHTML = (seasons) => {
  const rows = seasons
    .map(
      (s) =>
        `<tr><td>${s.y}</td><td>${esc(s.t)}</td><td>${s.w}</td><td>${s.l}</td><td>${fmt2(s.era)}</td><td>${s.eraplus || ""}</td><td>${s.g}</td><td>${s.gs}</td><td>${fmt2(s.ip)}</td><td>${s.h}</td><td>${s.bb}</td><td>${s.so}</td><td>${s.sv}</td><td>${fmt2(s.whip)}</td><td>${s.war ?? ""}</td></tr>`,
    )
    .join("");
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Year</th><th>Tm</th><th>W</th><th>L</th><th>ERA</th><th>ERA+</th><th>G</th><th>GS</th><th>IP</th><th>H</th><th>BB</th><th>SO</th><th>SV</th><th>WHIP</th><th>WAR</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};
const seasonTablesHTML = (entry) => {
  const bat = (entry.seasons || []).filter((s) => (s.pa || s.ab) > 0),
    pit = (entry.pitching || []).filter((s) => (s.ip || 0) > 0);
  let html = "";
  if (bat.length) html += `<h4>Batting</h4>${seasonBattingHTML(bat)}`;
  if (pit.length) html += `<h4>Pitching</h4>${seasonPitchingHTML(pit)}`;
  return html;
};
const starterKey = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const starterRowKey = (row) =>
  row?.mlbId ? `mlb:${row.mlbId}` : `name:${starterKey(row?.name)}`;
async function ensureStarterTeam(teamId) {
  const b = state.boards[teamId],
    current = Number(b.studio?.starterVersion) || 0,
    targetVersion = teamId === "NYY" ? 11 : 9;
  if (current >= targetVersion) return false;
  const response = await fetch(`./data/apex/${teamId}.json?v=${targetVersion}`);
  if (!response.ok)
    throw Error("The built-in franchise collection could not be opened.");
  const data = await response.json();
  if (
    data.version !== targetVersion ||
    data.team !== teamId ||
    !Array.isArray(data.candidates) ||
    !data.candidates.length ||
    data.candidates.length > 200 ||
    !Array.isArray(data.reserves) ||
    !Array.isArray(data.managers)
  )
    throw Error("The built-in franchise collection is incomplete.");
  const existing = new Map(),
    excluded = new Set(b.studio.exclusions || []),
    used = new Set();
  for (const c of b.candidates) {
    if (c.profile?.mlbId) existing.set(`mlb:${c.profile.mlbId}`, c);
    const nameKey = `name:${starterKey(c.name)}`;
    if (!existing.has(nameKey)) existing.set(nameKey, c);
  }
  const existingForRow = (row) => {
    const byId = row?.mlbId ? existing.get(`mlb:${row.mlbId}`) : null;
    if (byId && !used.has(byId.id)) return byId;
    const byName = existing.get(`name:${starterKey(row?.name)}`);
    return byName && !used.has(byName.id) ? byName : null;
  };
  const apply = (c, row, pool) => {
    const savedOctober = c.profile?.advancedStats?.apexOctoberEvidence,
      automaticOctober = row.advancedStats?.apexOctoberEvidence,
      preserveManualOctober =
        savedOctober?.complete &&
        savedOctober?.source &&
        savedOctober?.method !== automaticOctober?.method,
      advancedStats = preserveManualOctober
        ? applyApexOctoberEvidence(row.advancedStats, savedOctober)
        : row.advancedStats;
    used.add(c.id);
    c.sample = false;
    c.type = "Player";
    c.role = c.role || row.role;
    c.era = c.era || row.era;
    c.tier =
      c.tier && c.tier !== "Candidate"
        ? c.tier
        : pool
          ? "Roster reserve"
          : row.rank <= 10
            ? "Inner Circle"
            : row.rank <= 25
              ? "Franchise great"
              : "Top 200";
    c.sources = c.sources || data.source;
    if (!pool)
      c.rationale =
        c.rationale ||
        `Built-in APEX starting rank #${row.rank}. Move this card whenever your judgment differs.`;
    c.profile = {
      ...c.profile,
      mlbId: c.profile?.mlbId || row.mlbId || null,
      pool,
      positions: row.positions || c.profile?.positions || [],
      throws: c.profile?.throws || row.throws || "",
      whyAdded: row.whyAdded,
      advancedStats,
      starterRank: pool ? null : row.rank,
      starterVersion: data.version,
    };
    return c;
  };
  if (current >= 1) {
    for (const row of data.candidates) {
      const c = existingForRow(row);
      if (c) apply(c, row, false);
      else if (
        !excluded.has("mlb:" + row.mlbId) &&
        !excluded.has("name:" + starterKey(row.name))
      ) {
        const added = apply(newCandidate(row.name), row, false);
        b.candidates.push(added);
        existing.set(starterRowKey(row), added);
      }
    }
    for (const row of data.reserves) {
      const key = starterKey(row.name), rowKey = starterRowKey(row);
      if (
        existing.has(rowKey) ||
        excluded.has("mlb:" + row.mlbId) ||
        excluded.has("name:" + key)
      )
        continue;
      const c = apply(newCandidate(row.name), row, true);
      b.candidates.push(c);
      existing.set(rowKey, c);
    }
    b.candidates = [
      ...b.candidates.filter((c) => !c.profile?.pool),
      ...b.candidates.filter((c) => c.profile?.pool),
    ];
  } else {
    const ranked = data.candidates.map((row) =>
      apply(
        existingForRow(row) || newCandidate(row.name),
        row,
        false,
      ),
    );
    const reserves = data.reserves
      .filter((row) => !existingForRow(row))
      .map((row) => apply(newCandidate(row.name), row, true));
    const extras = b.candidates.filter((c) => !used.has(c.id));
    for (const c of extras) if (c.type === "Player") c.profile.pool = true;
    b.candidates = [...ranked, ...reserves, ...extras];
    b.mode = "apex";
    b.studio.lastAutoRanking = {
      at: data.generatedAt,
      lens: "apex",
      eligible: ranked.length,
      values: Object.fromEntries(
        ranked.map((c) => [c.id, Number(c.profile.advancedStats.APEX_F ?? c.profile.advancedStats.APEX_R)]),
      ),
    };
  }
  for (const row of data.managers) {
    const key = starterKey(row.name);
    if (excluded.has("name:" + key)) continue;
    let c = existing.get(`name:${key}`);
    if (!c || c.type !== "Manager / coach") {
      c = newCandidate(row.name, "Manager / coach");
      b.candidates.push(c);
      if (!existing.has(`name:${key}`)) existing.set(`name:${key}`, c);
    }
    c.sample = false;
    c.role = c.role || "Manager";
    c.era = c.era || row.era;
    c.tier = c.tier && c.tier !== "Candidate" ? c.tier : "Manager candidate";
    c.sources = c.sources || data.source;
    c.profile = {
      ...c.profile,
      pool: true,
      whyAdded: row.whyAdded,
      managerStats: row.managerStats,
      starterVersion: data.version,
    };
  }
  b.studio.starterVersion = data.version;
  b.studio.starterAt = data.generatedAt;
  b.studio.scoringNotice = false;
  return true;
}
async function selectTeam(teamId) {
  state.selected = teamId;
  query = "";
  compareIds = [];
  filter = "all";
  apexLane = "collection";
  apexEra = "";
  try {
    await ensureStarterTeam(teamId);
  } catch (e) {
    toast(e.message);
  }
  persist();
  render();
}
const snapshot = () => {
  history.push(JSON.stringify(state));
  while (
    history.length > 1 &&
    (history.length > 40 ||
      history.reduce((n, x) => n + x.length, 0) > 20000000)
  )
    history.shift();
};
const moveRanked = (id, to) => {
  const b = board();
  if (!rankedCandidates(b).some((c) => c.id === id) || to < 0) return;
  b.candidates = [
    ...moveCandidate(rankedCandidates(b), id, to),
    ...b.candidates.filter((c) => c.profile?.pool),
  ];
};
function persist() {
  state.updatedAt = new Date().toISOString();
  storageIssue = invalidStored
    ? "Saved data needs recovery. Open Backups."
    : "";
  cloud?.schedule();
  updateSave();
}
function mutate(fn, msg, { redraw = true } = {}) {
  snapshot();
  fn();
  persist();
  if (redraw) render();
  if (msg) toast(msg);
  return !storageIssue;
}
function updateSave() {
  const status = cloud?.status || "Connecting to cloud…";
  const warning =
    storageIssue ||
    (cloud?.cacheIssue
      ? status === "Saved to your account"
        ? "Saved to your account. A device recovery copy is unavailable; an exported backup gives you an extra copy."
        : cloud.cacheIssue
      : "");
  const el = $("#save-status");
  if (el) {
    el.classList.toggle("error", /failed|unavailable|conflict/.test(status));
    el.textContent = status;
    el.title =
      warning ||
      "Saved to your account when connected. Export backups for an independent copy.";
  }
  const er = $("#storage-warning");
  if (er) {
    er.hidden = !warning;
    er.textContent = warning;
  }
}
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3800);
}
function scoreText(c, mode = board().mode) {
  const s = calculate(c, mode, board().weights);
  return s.value === null
    ? "—"
    : s.value.toFixed(mode === "apex" ? 2 : mode === "fls" ? 1 : 0);
}
const APEX_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
const APEX_ERAS = [
  "Pioneer",
  "Deadball",
  "Live ball",
  "Integration",
  "Free agency",
  "Steroid",
  "Testing",
  "Modern",
];
function apexViewBoard(c) {
  const stats = c.profile?.advancedStats;
  if (!stats || apexLane === "collection") return null;
  if (["H", "SP", "RP"].includes(apexLane)) return stats.apexBoards?.[apexLane];
  const position = apexLane.startsWith("POS:") ? apexLane.slice(4) : "";
  return apexEra
    ? stats.eraChapters?.[apexEra]?.positions?.[position]
    : stats.positionBoards?.[position];
}
function apexViewLabel() {
  if (apexLane === "collection") return "Collection";
  if (["H", "SP", "RP"].includes(apexLane)) return `APEX-${apexLane}`;
  const position = apexLane.slice(4);
  return apexEra ? `${apexEra} · ${position}` : `APEX-H · ${position}`;
}
function scoreBadge(c) {
  if (board().mode === "apex" && apexLane !== "collection") {
    const lane = apexViewBoard(c);
    return `<span class="score ${lane?.eligible ? "" : "partial"}">${lane?.eligible && Number.isFinite(Number(lane.APEX_R)) ? Number(lane.APEX_R).toFixed(2) : "—"}${lane?.nearTie ? "<small>≈</small>" : ""}</span>`;
  }
  const s = calculate(c, board().mode, board().weights);
  return `<span class="score ${s.complete ? "" : "partial"}">${scoreText(c)}${s.value !== null && !s.complete ? "<small>*</small>" : ""}</span>`;
}
function initials(n) {
  return n
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
}
function navButton(id, label, ico) {
  return `<button class="nav-item ${tab === id ? "active" : ""}" data-nav="${id}">${icon(ico)}<span>${label}</span>${id === "compare" && compareIds.length ? `<small>${compareIds.length}</small>` : ""}</button>`;
}
function homeCandidates(b) {
  const lanes = ["H", "SP", "RP"].map((code) =>
    b.candidates
      .filter((c) => c.type === "Player" && c.profile?.advancedStats?.primaryBoard === code && c.profile?.advancedStats?.apexBoards?.[code]?.eligible)
      .sort((a, z) => Number(z.profile.advancedStats.apexBoards[code].APEX_R) - Number(a.profile.advancedStats.apexBoards[code].APEX_R))[0],
  );
  if (lanes.every(Boolean)) return lanes;
  const ranked = rankedCandidates(b).filter((c) => c.type === "Player");
  if (ranked.length) return ranked.slice(0, 3);
  return b.candidates.filter((c) => c.type === "Player").slice(0, 3);
}
function homeMetric(c, key, digits = 1) {
  const raw = c?.profile?.advancedStats?.[key],
    value = Number(raw);
  return raw !== null && raw !== undefined && Number.isFinite(value)
    ? value.toFixed(digits)
    : "—";
}
function homeTeamLabels(t) {
  const special = {
    BOS: ["BOSTON", "RED SOX"],
    CWS: ["CHICAGO", "WHITE SOX"],
    TOR: ["TORONTO", "BLUE JAYS"],
    WSH: ["WASHINGTON", "NATIONALS / EXPOS"],
    ATH: ["THE", "ATHLETICS"],
  };
  return (
    special[t[0]] || [
      t[1].split(" ").slice(0, -1).join(" ").toUpperCase(),
      t[1].split(" ").slice(-1)[0].toUpperCase(),
    ]
  );
}
function homeBallpark(teamId) {
  return teamBallpark(teamId);
}
function renderHomeCard(c, index, t, featured = false) {
  if (!c)
    return `<button class="collection-card collection-card-empty" data-home-action="more"><span>${icon("plus", 28)}</span><strong>Open the card box</strong><small>Pull the franchise player pool</small></button>`;
  const a = c.profile?.advancedStats || {},
    lane = a.primaryBoard,
    laneData = a.apexBoards?.[lane] || {},
    apexLabel = lane ? `APEX-${lane}` : a.scoreBoard || "APEX",
    role =
      c.role ||
      { SP: "Starting pitcher", RP: "Relief pitcher", C: "Catcher" }[a.role] ||
      "Player",
    labels = homeTeamLabels(t);
  const n = (v, d = 1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—";
  return `<button class="collection-card ${featured ? "featured" : ""}" data-home-flip="${esc(c.id)}" aria-label="Flip ${esc(c.name)} card" aria-pressed="false"><span class="card-inner"><span class="card-face card-front"><span class="card-team-banner"><small>${esc(labels[0])}</small><strong>${esc(labels[1])}</strong></span><span class="card-art">${teamLogo(t[0], "card-watermark")}</span><span class="card-rank">#${laneData.rank || index + 1}</span><span class="card-medals"><span><b>APEX-F</b>${n(a.APEX_F ?? laneData.APEX_F ?? laneData.APEX_R ?? a.APEX_R)}</span><span><b>WAR</b>${n(laneData.WAR ?? a.totalWAR)}</span><span><b>WAA</b>${n(laneData.WAA ?? a.WAA)}</span></span><span class="card-name"><span>${esc(c.name)}</span></span><span class="card-position">${esc(role.toUpperCase())}</span>${teamHat(t[0], "card-cap")}</span><span class="card-face card-back"><span class="card-back-title">${esc(c.name)}</span><span class="card-back-sub">${esc(apexLabel)} FRANCHISE BREAKDOWN</span><span class="card-back-grid"><span><b>${n(laneData.Peak3 ?? a.Apex, 2)}</b>PEAK3</span><span><b>${n(laneData.Prime5 ?? a.Prime, 2)}</b>PRIME5</span><span><b>${n(laneData.Career ?? a.Career, 2)}</b>CAREER</span><span><b>${n(a.peak5WAR)}</b>PEAK 5 WAR</span><span><b>${n(a.seasons, 0)}</b>SEASONS</span><span><b>${a.role === "SP" || a.role === "RP" ? n(a.IP) : n(a.PA, 0)}</b>${a.role === "SP" || a.role === "RP" ? "INNINGS" : "PLATE APPEARANCES"}</span></span><span class="card-open" data-home-edit="${esc(c.id)}">OPEN FULL CARD</span></span></span></button>`;
}
function renderCollectionHome(t, cards, scored) {
  const labels = homeTeamLabels(t),
    ballpark = homeBallpark(t[0]),
    style = ballpark ? ` style="--ballpark-image:url('${ballpark}')"` : "",
    rankedCount = rankedCandidates(board()).filter((c) => c.type === "Player").length,
    poolCount = board().candidates.filter((c) => c.type === "Player").length,
    evidenceStatus =
      t[0] === "NYY"
        ? "Retrosheet game evidence ready for all 400 players"
        : `${poolCount} qualified players searchable`;
  const leader = (c, code) => {
    const lane = c?.profile?.advancedStats?.apexBoards?.[code];
    return `<button data-home-action="players" data-home-lane="${code}"><small>APEX-${code}</small><strong>${esc(c?.name || "Open board")}</strong><span>${lane?.eligible ? Number(lane.APEX_R).toFixed(2) : "—"}</span></button>`;
  };
  return `<main class="collection-home clubhouse-home team-${t[0].toLowerCase()} ${ballpark ? "has-ballpark" : ""}"${style} aria-label="${esc(t[1])} Legacy Lore home"><header class="collection-header"><a class="collection-brand" href="#" aria-label="Legacy Lore home">${teamLogo(t[0], "collection-logo")}<span>LEGACY LORE<small>THE FRANCHISE COLLECTION</small></span></a><label class="collection-team-select"><span class="sr-only">Select franchise</span><select id="home-franchise" aria-label="Select franchise">${TEAMS.map(([id, name]) => `<option value="${id}" ${id === t[0] ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label></header><div class="clubhouse-wrap"><section class="clubhouse-hero"><div class="clubhouse-hero-shade"></div><div class="clubhouse-identity">${teamLogo(t[0], "clubhouse-logo")}<div><span>${esc(labels[0])}</span><h1>${esc(labels[1])}</h1><p>THE FRANCHISE COLLECTION</p></div></div><div class="clubhouse-status"><b>${rankedCount} LEGENDS READY</b><span>${scored} APEX 2.2 Test scores · roster tools</span><span>${esc(evidenceStatus)}</span></div></section><section class="clubhouse-intro"><p class="eyebrow">YOUR ALL-TIME BASEBALL CLUBHOUSE</p><h2>Where do you want to start?</h2><p>Rank the players, relive the history, or build a legal 26-man roster. Everything starts ready.</p></section><section class="clubhouse-menu" aria-label="Main collection tools"><button data-home-action="players">${icon("board", 34)}<span><small>THE PLAYER BOOK</small><strong>Explore the Top 200</strong><em>APEX boards, positions and eras</em></span><b>01</b></button><button data-home-action="roster">${icon("star", 34)}<span><small>THE CLUBHOUSE</small><strong>Build the Best 26</strong><em>Role fit and MLB rules</em></span><b>02</b></button><button data-home-action="moments">${icon("book", 34)}<span><small>THE OLD SCRAPBOOK</small><strong>Historical Almanac</strong><em>Five-year chapters and franchise moments</em></span><b>03</b></button><button data-home-action="more">${icon("tune", 34)}<span><small>THE TOOLBOX</small><strong>More Tools</strong><em>Imports, notes, backups and custom legends</em></span><b>04</b></button></section><section class="clubhouse-leaders"><div><small>FRANCHISE LEADERS BY ROLE</small><strong>APEX 2.2 TEST · ROSTER MODULE</strong></div>${leader(cards[0], "H")}${leader(cards[1], "SP")}${leader(cards[2], "RP")}</section><div class="collection-save"><span id="save-status"></span><button id="home-backups">${icon("download", 15)} Backups</button></div></div><nav class="collection-bottom-nav" aria-label="Main navigation"><button class="active" data-home-action="home">${icon("diamond", 25)}<span>Home</span></button><button data-home-action="players">${icon("board", 25)}<span>Players</span></button><button data-home-action="moments">${icon("book", 25)}<span>History</span></button><button data-home-action="roster">${icon("star", 25)}<span>Roster</span></button><button data-home-action="more">${icon("tune", 25)}<span>More</span></button></nav></main>`;
}
function referenceCardOverlay(c, index, place, t) {
  if (!c) return "";
  const labels = homeTeamLabels(t),
    apexLabel = c.profile?.advancedStats?.scoreBoard || "APEX";
  return `<div class="reference-card-live reference-live-${place}" aria-hidden="true"><div class="reference-live-banner"><small>${esc(labels[0])}</small><strong>${esc(labels[1])}</strong></div><div class="reference-live-metrics"><span><b>APEX-F</b>${homeMetric(c, c?.profile?.advancedStats?.APEX_F == null ? "APEX_R" : "APEX_F")}</span><span><b>WAR</b>${homeMetric(c, "totalWAR")}</span><span><b>WAA</b>${homeMetric(c, "WAA")}</span></div><div class="reference-live-rank">#${index + 1}</div><div class="reference-live-name">${esc(c.name)}</div><div class="reference-live-role">${esc((c.role || "Player").toUpperCase())}</div>${teamLogo(t[0], "reference-live-logo")}</div>`;
}
function renderReferenceHome(t, cards) {
  const labels = homeTeamLabels(t),
    kc = t[0] === "KC",
    ordered = [cards[1], cards[0], cards[2]];
  return `<main class="reference-home ${kc ? "kc-reference" : ""}" aria-label="${esc(t[1])} Legacy Lore collection home"><img class="reference-home-art" src="./assets/royals-home-reference.png" alt="Vintage Legacy Lore baseball-card collection home" draggable="false"><div class="reference-brand-team" aria-hidden="true">${teamLogo(t[0])}</div><div class="reference-picker-face" aria-hidden="true">${esc(labels[1])}⌄</div><div class="reference-pennant-live" aria-hidden="true"><small>${esc(labels[0])}</small><strong>${esc(labels[1])}</strong></div><div class="reference-count-live" aria-hidden="true">100 FRANCHISE LEGENDS</div><div class="reference-scoreboard-logo" aria-hidden="true">${teamLogo(t[0])}</div>${referenceCardOverlay(ordered[0], 1, "left", t)}${referenceCardOverlay(ordered[1], 0, "center", t)}${referenceCardOverlay(ordered[2], 2, "right", t)}<label class="reference-team-picker"><span class="sr-only">Select franchise</span><select id="home-franchise" aria-label="Select franchise">${TEAMS.map(([id, name]) => `<option value="${id}" ${id === t[0] ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>${ordered.map((c, i) => (c ? `<button class="reference-hotspot reference-card ${["reference-card-left", "reference-card-center", "reference-card-right"][i]}" data-reference-id="${esc(c.id)}" aria-label="Open ${esc(c.name)} live player card"></button>` : "")).join("")}<button class="reference-hotspot reference-action reference-top-left" data-home-action="cards" aria-label="View the Top 100 franchise players"><span class="reference-action-copy"><strong>VIEW TOP 100</strong><small>Legends ranked</small></span></button><button class="reference-hotspot reference-action reference-top-right" data-home-action="roster" aria-label="Build the best 26-player roster"><span class="reference-action-copy"><strong>BUILD BEST 26</strong><small>Your all-time team</small></span></button><button class="reference-hotspot reference-action reference-bottom-left" data-home-action="lineup" aria-label="Set the starting lineup"><span class="reference-action-copy"><strong>SET LINEUP</strong><small>Create and manage</small></span></button><button class="reference-hotspot reference-action reference-bottom-right" data-home-action="compare" aria-label="Compare legends side by side"><span class="reference-action-copy"><strong>COMPARE</strong><small>Legends side by side</small></span></button><nav class="reference-nav" aria-label="Main navigation"><button data-home-action="home" aria-label="Home"></button><button data-home-action="cards" aria-label="Cards"></button><button data-home-action="rank" aria-label="Rank"></button><button data-home-action="roster" aria-label="Roster"></button><button data-home-action="more" aria-label="More"></button></nav><span id="save-status" class="sr-only"></span><button id="home-backups" class="reference-backup" aria-label="Open backups and export"></button></main>`;
}
function renderHome() {
  const b = board(),
    t = team(),
    cards = homeCandidates(b),
    scored = b.candidates.filter(
      (c) => c.type === "Player" && calculate(c, "apex", b.weights).complete,
    ).length;
  return renderCollectionHome(t, cards, scored);
}
function bindHome() {
  requestAnimationFrame(() => window.scrollTo(0, 0));
  $("#home-franchise").onchange = (e) => void selectTeam(e.target.value);
  if ($(".collection-brand"))
    $(".collection-brand").onclick = (e) => e.preventDefault();
  $$("[data-reference-id]").forEach(
    (el) => (el.onclick = () => openEditor(el.dataset.referenceId)),
  );
  $$("[data-home-flip]").forEach(
    (el) =>
      (el.onclick = (e) => {
        const edit = e.target.closest("[data-home-edit]");
        if (edit) {
          openEditor(edit.dataset.homeEdit);
          return;
        }
        el.classList.toggle("flipped");
        el.setAttribute(
          "aria-pressed",
          String(el.classList.contains("flipped")),
        );
      }),
  );
  $$("[data-home-action]").forEach(
    (el) =>
      (el.onclick = () => {
        const action = el.dataset.homeAction;
        if (action === "home") return;
        if (action === "players" || action === "cards") {
          listMode = action === "players" ? "top" : "all";
          playerView = "rankings";
          if (el.dataset.homeLane) apexLane = el.dataset.homeLane;
          tab = "players";
        } else if (action === "rank") {
          listMode = "top";
          playerView = "rankings";
          tab = "players";
        } else if (action === "compare") {
          playerView = "compare";
          tab = "players";
        } else if (action === "moments") {
          historyView = "years";
          tab = "moments";
        }
        else if (action === "roster" || action === "lineup") tab = "roster";
        else tab = "more";
        render();
      }),
  );
  if ($("#home-backups")) $("#home-backups").onclick = openBackups;
}
function renderPlayers() {
  return `<div class="players-hub"><nav class="section-tabs" aria-label="Player tools"><button data-player-view="rankings" class="${playerView === "rankings" ? "active" : ""}">Top 200 & APEX boards</button><button data-player-view="compare" class="${playerView === "compare" ? "active" : ""}">Compare players</button></nav>${playerView === "compare" ? renderCompare() : renderBoard()}</div>`;
}
function momentsNow() {
  return franchiseMoments(state.selected, rankedCandidates(board()), board().studio);
}
function momentFullStory(m) {
  const preferred = safeSource(m.storyUrl),
    fallback = safeSource(m.source);
  return (
    preferred ||
    fallback ||
    momentStoryLink(state.selected, m.year || "", m.title || "baseball history")
  );
}
function openMomentDetails(id) {
  const m = momentsNow().find((row) => row.id === id);
  if (!m) return;
  const summary = String(m.fullSummary || m.story || "Add the complete story behind this moment.")
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((paragraph) => `<p>${esc(paragraph)}</p>`)
      .join(""),
    storyUrl = momentFullStory(m);
  openModal(
    m.title,
    `<article class="modal-body moment-detail"><div class="moment-detail-meta"><span class="moment-year">${esc(m.year || "YEAR OPEN")}</span><span class="moment-tone">${esc(toneLabel(m.tone))}</span></div><div class="moment-detail-summary"><h3>Full summary</h3>${summary}</div>${m.people ? `<div class="moment-detail-block"><strong>Connected people</strong><p>${esc(m.people)}</p></div>` : ""}${m.note ? `<blockquote>${esc(m.note)}</blockquote>` : ""}<a class="moment-story-link" href="${esc(storyUrl)}" target="_blank" rel="noopener">Read the full story ↗</a><p class="help">The story link opens outside the studio. The summary and link remain editable.</p></article><div class="modal-footer"><button class="subtle" id="moment-detail-edit">Edit summary & link</button>${m.playerId ? '<button class="subtle" id="moment-detail-player">Open player card</button>' : ""}<button class="primary" id="moment-detail-close">Done</button></div>`,
    true,
  );
  $("#moment-detail-close").onclick = () => $("#modal").close();
  $("#moment-detail-edit").onclick = () => {
    $("#modal").close();
    openMomentEditor(m.id);
  };
  if ($("#moment-detail-player"))
    $("#moment-detail-player").onclick = () => {
      $("#modal").close();
      openEditor(m.playerId);
    };
}
function renderMoments() {
  const b = board(), pins = b.studio.momentPins || [], pinSet = new Set(pins);
  const moments = momentsNow()
    .filter((m) => momentFilter === "all" || m.tone === momentFilter)
    .sort((a, z) => {
      const ai = pins.indexOf(a.id), zi = pins.indexOf(z.id);
      if (ai >= 0 || zi >= 0) return (ai < 0 ? 999 : ai) - (zi < 0 ? 999 : zi);
      return String(z.year).localeCompare(String(a.year), undefined, { numeric: true });
    });
  const card = (m) => {
    const pinned = pinSet.has(m.id), pinIndex = pins.indexOf(m.id);
    return `<article class="moment-card tone-${esc(m.tone)} ${pinned ? "pinned" : ""}" data-moment-open="${esc(m.id)}" role="button" tabindex="0" aria-label="Open full summary for ${esc(m.title)}"><div class="moment-top"><span class="moment-year">${esc(m.year || "YEAR OPEN")}</span><span class="moment-tone">${esc(toneLabel(m.tone))}</span></div><h3>${esc(m.title)}</h3><p class="moment-teaser">${esc(m.story || "Add the memory and why it still matters.")}</p>${m.people ? `<small><strong>Connected:</strong> ${esc(m.people)}</small>` : ""}${m.note ? `<blockquote>${esc(m.note)}</blockquote>` : ""}<button class="moment-read" data-moment-summary="${esc(m.id)}">Open full summary</button><div class="moment-actions"><button class="subtle" data-moment-pin="${esc(m.id)}">${pinned ? "★ Top 10" : "☆ Add to Top 10"}</button>${pinned ? `<button class="icon-button" data-pin-up="${esc(m.id)}" ${pinIndex === 0 ? "disabled" : ""} aria-label="Move moment up">↑</button><button class="icon-button" data-pin-down="${esc(m.id)}" ${pinIndex === pins.length - 1 ? "disabled" : ""} aria-label="Move moment down">↓</button>` : ""}<button class="subtle" data-moment-edit="${esc(m.id)}">Edit</button>${m.playerId ? `<button class="subtle" data-moment-player="${esc(m.playerId)}">Player card</button>` : ""}</div></article>`;
  };
  return `<section class="workspace moments-workspace"><div class="section-heading"><div><div class="eyebrow muted">THE JOY, THE HEARTBREAK, THE STORIES</div><h2>Franchise history</h2></div><div class="board-actions"><button class="subtle" id="export-moments">Export history</button><button class="primary" id="add-moment">Add a moment</button></div></div><p class="section-description">A 25-card starting collection blends landmark moments with data-backed player eras. Pin and arrange your personal Top 10. History is separate from APEX—no memory adds or removes performance points.</p><div class="moment-summary"><strong>${pins.length}/10 personal favorites</strong><span>${momentsNow().filter((m) => m.tone === "heartbreak").length} heartbreak cards included</span><span>Starter wording is editable</span></div><nav class="moment-filters" aria-label="Filter franchise history">${TONES.map(([id, label]) => `<button data-moment-filter="${id}" class="${momentFilter === id ? "active" : ""}">${esc(label)}</button>`).join("")}</nav><div class="moments-grid">${moments.map(card).join("") || '<div class="empty"><h3>No history cards in this view.</h3><p>Choose another filter or add your own franchise moment.</p></div>'}</div></section>`;
}
function renderHistory() {
  return `<div class="history-hub"><nav class="section-tabs history-tabs" aria-label="History tools"><button data-history-view="years" class="${historyView === "years" ? "active" : ""}">Through the years</button><button data-history-view="franchise" class="${historyView === "franchise" ? "active" : ""}">${esc(team()[1])} history</button><button data-history-view="desk" class="${historyView === "desk" ? "active" : ""}">Story Desk</button></nav>${historyView === "franchise" ? renderMoments() : historyView === "desk" ? historyUI.renderDesk() : historyUI.renderYears()}</div>`;
}
function openMomentEditor(id = "") {
  const b = board(), current = id ? momentsNow().find((m) => m.id === id) : null,
    existingStoryUrl = current ? momentFullStory(current) : "";
  openModal(
    current ? "Edit franchise history" : "Add franchise history",
    `<form method="dialog" id="moment-form" class="modal-body"><div class="form-grid"><label>Year or era<input name="year" maxlength="20" value="${esc(current?.year || "")}" placeholder="1985 or 2014–15"></label><label>Type<select name="tone">${TONES.filter(([x]) => x !== "all").map(([x, label]) => `<option value="${x}" ${current?.tone === x ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label></div><label>Moment title<input name="title" required maxlength="180" value="${esc(current?.title || "")}"></label><label>Card summary<textarea name="story" rows="3" maxlength="2000" placeholder="A short introduction shown on the history card.">${esc(current?.story || "")}</textarea></label><label>Full summary<textarea name="full-summary" rows="8" maxlength="8000" required placeholder="Tell the complete story, what happened, and why it still matters.">${esc(current?.fullSummary || current?.story || "")}</textarea></label><label>Connected players, managers, or voices<input name="people" maxlength="500" value="${esc(current?.people || "")}"></label><label>Your memory or graphic Easter egg<textarea name="note" rows="3" maxlength="2000">${esc(current?.note || "")}</textarea></label><label>Full-story link<input name="story-url" type="url" required maxlength="2000" value="${esc(existingStoryUrl)}" placeholder="https://..."><small>One reliable article or page that tells the complete story.</small></label><label>Research or data source (optional)<input name="source" type="url" maxlength="2000" value="${esc(current?.source || "")}" placeholder="https://..."></label><div class="modal-actions">${current ? `<button type="button" class="danger" id="hide-moment">${current.starter ? "Hide starter card" : "Delete moment"}</button>` : ""}<button value="cancel">Cancel</button><button class="primary" value="default">Save moment</button></div></form>`,
    true,
  );
  const form = $("#moment-form");
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form), source = String(fd.get("source") || "").trim(),
      storyUrl = String(fd.get("story-url") || "").trim();
    if (source && !/^https:\/\//.test(source)) { toast("Source links must start with https://"); return; }
    if (!/^https:\/\//.test(storyUrl)) { toast("Add one full-story link beginning with https://"); return; }
    const saved = { year:String(fd.get("year") || ""), tone:String(fd.get("tone") || "turning-point"), title:String(fd.get("title") || "").trim(), story:String(fd.get("story") || ""), fullSummary:String(fd.get("full-summary") || ""), people:String(fd.get("people") || ""), note:String(fd.get("note") || ""), storyUrl, source };
    if (!saved.title) return;
    mutate(() => {
      if (current?.starter) b.studio.momentEdits[current.id] = saved;
      else if (current) b.studio.customMoments = b.studio.customMoments.map((m) => m.id === current.id ? { ...saved, id:m.id } : m);
      else b.studio.customMoments.push({ ...saved, id:`${state.selected}-custom-${crypto.randomUUID()}` });
    }, "Franchise history saved.");
    $("#modal").close();
  };
  if ($("#hide-moment")) $("#hide-moment").onclick = () => {
    mutate(() => {
      b.studio.momentPins = b.studio.momentPins.filter((x) => x !== current.id);
      if (current.starter) b.studio.momentHidden.push(current.id);
      else b.studio.customMoments = b.studio.customMoments.filter((m) => m.id !== current.id);
    }, current.starter ? "Starter history card hidden." : "Custom moment deleted.");
    $("#modal").close();
  };
}
function renderMore() {
  if (moreView === "discover") return `<div class="more-return"><button class="subtle" data-more-view="menu">← More tools</button></div>${studioUI.renderLegends()}`;
  if (moreView === "notebook") return `<div class="more-return"><button class="subtle" data-more-view="menu">← More tools</button></div>${renderNotebook()}`;
  if (moreView === "create") return `<div class="more-return"><button class="subtle" data-more-view="menu">← More tools</button></div>${studioUI.renderCreate()}`;
  return `<section class="workspace more-workspace"><div class="section-heading"><div><div class="eyebrow muted">POWER WHEN YOU WANT IT</div><h2>More tools</h2></div></div><p class="section-description">The everyday app stays simple. Data imports, research, custom legacy and exports live here.</p><div class="more-grid"><button data-more-action="discover">${icon("search", 30)}<strong>Research & player pool</strong><span>Refresh APEX data and review reserves</span></button><button data-more-action="notebook">${icon("book", 30)}<strong>Legacy notebook</strong><span>Nicknames, lore and Easter eggs</span></button><button data-more-action="import">${icon("download", 30)}<strong>Import player data</strong><span>CSV and MLB lookup tools</span></button><button data-more-action="fetch">${icon("tune", 30)}<strong>Fetch team stats</strong><span>Bulk player-stat refresh</span></button><button data-more-action="create">${icon("diamond", 30)}<strong>Graphics & editions</strong><span>Export collection artwork</span></button><button data-more-action="backup">${icon("lock", 30)}<strong>Backups & export</strong><span>Keep an independent copy</span></button><button data-more-action="guide">${icon("board", 30)}<strong>APEX scoring guide</strong><span>Formula, lanes and limitations</span></button><button data-more-action="add">${icon("plus", 30)}<strong>Add a custom person</strong><span>Players and non-player legends</span></button></div></section>`;
}
function render() {
  applyTeamTheme(state.selected);
  if (tab === "home") {
    $("#app").innerHTML = renderHome();
    bindHome();
    updateSave();
    return;
  }
  const b = board(),
    t = team();
  const complete = b.candidates.filter(
    (c) => calculate(c, b.mode, b.weights).complete,
  ).length;
  const nonplayers = b.candidates.filter((c) => c.type !== "Player").length;
  $("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#" aria-label="Legacy Lore home"><div class="brand-mark">${icon("diamond", 30)}</div><div>LEGACY LORE<span>THE FRANCHISE SERIES</span></div></a><label class="franchise-label" for="franchise">Your franchise</label><div class="team-select"><span class="team-monogram">${teamLogo(t[0])}</span><select id="franchise" aria-label="Select franchise">${TEAMS.map(([id, name]) => `<option value="${id}" ${id === t[0] ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></div><div class="sidebar-rule"></div><nav aria-label="Main sections">${navButton("home", "Home", "diamond")}${navButton("players", "Players", "board")}${navButton("moments", "History", "book")}${navButton("roster", "Roster", "star")}${navButton("more", "More", "tune")}</nav><div class="sidebar-bottom"><button class="nav-item" id="backups">${icon("download")} Backups & export</button><button class="nav-item" id="method">${icon("tune")} Scoring guide</button><div class="owner"><div class="avatar">JW</div><div>Joe’s private studio<span>${icon("lock", 11)} Owner access only</span></div></div></div></aside>
 <main><header class="topbar"><div class="breadcrumb">${esc(t[1])} <span>/</span> <strong>${tab === "players" ? "Players" : tab === "moments" ? "Historical Almanac" : tab === "roster" ? "All-time roster" : "More tools"}</strong></div><div class="topbar-right"><span id="save-status"></span><button class="icon-button mobile-backup" id="mobile-backups" aria-label="Backups and export">${icon("download", 15)}</button><button id="undo" class="icon-button" title="Undo last change" aria-label="Undo last change" ${history.length ? "" : "disabled"}>${icon("undo", 16)}</button><span class="private-badge">${icon("lock", 12)} PRIVATE</span></div></header><div class="main-content"><div id="storage-warning" class="notice warning" hidden></div><section class="hero compact-hero">${teamLogo(t[0], "hero-team-logo")}<div class="eyebrow">${esc(t[2])} <span>✦</span> THE FRANCHISE COLLECTION</div><h1>${esc(t[1])}<span class="title-dot">.</span></h1><p>Greatness lives in the numbers. <em>Legacy lives with the fans.</em></p><div class="hero-bottom"><button class="scope-button" id="edit-scope">${icon("diamond", 14)} ${esc(b.scope)} <span>EDIT</span></button></div></section>
 <div class="overview"><div><span class="stat-label">ON THE BOARD</span><strong>${String(Math.min(200, rankedCandidates(b).length)).padStart(3, "0")}<small>/ 200</small></strong></div><div><span class="stat-label">QUALIFIED POOL</span><strong>${String(b.candidates.filter((c) => c.type === "Player").length).padStart(3, "0")}<small>searchable players</small></strong></div><div><span class="stat-label">BEYOND THE PLAYERS</span><strong>${String(nonplayers).padStart(2, "0")}<small>voices & personalities</small></strong></div><button class="model-summary" id="weights"><span class="model-icon">${icon("tune", 22)}</span><span><span class="stat-label">SCORING BASELINE</span><strong>${modeLabel(b.mode)}<small>${b.mode === "apex" ? "Frozen 2.0 core · 2.1 roster module" : b.mode === "legacy" ? "Custom legacy · / 100" : b.mode === "lore" ? "Classic custom" : "Archived worksheet"}</small></strong></span><span>↗</span></button></div>
 ${tab === "players" ? renderPlayers() : tab === "moments" ? renderHistory() : tab === "roster" ? legendsUI.renderRoster() : renderMore()}<footer>LEGACY LORE <span>Built for the stories that outlive the stat sheet.</span><span>Independent fan project</span></footer></div></main>`;
  bind();
  legendsUI.bindRoster();
  if (tab === "moments" && historyView !== "franchise") historyUI.bind(historyView);
  studioUI.bind();
  updateSave();
}
function renderBoard() {
  const b = board(),
    laneView = b.mode === "apex" && apexLane !== "collection",
    laneLabel = apexViewLabel();
  return `<section class="workspace">${b.mode === "apex" ? `<div class="notice"><p><strong>APEX 2.2 Test.</strong> Peak3 is 25%, Prime5 is 35%, and Career is 40%. APEX-F adds half of signed APEX-Oct only when complete postseason evidence is saved. Missing October evidence remains N/A and never becomes zero.</p></div>` : ""}<div class="section-heading"><div><div class="eyebrow muted">THE PEOPLE WHO DEFINE A FRANCHISE</div><h2>${laneView ? `${laneLabel} franchise board` : `Your ${listMode === "top" ? "Top 200" : "qualified player pool"}`}</h2></div><div class="board-actions"><button class="subtle" id="research-autofill">Refresh APEX</button><button class="primary" id="auto-score-rank">Auto-score collection</button><button class="subtle" id="automation">Scoring assistant</button><button class="subtle" id="sort-score" ${laneView ? "disabled" : ""}>${icon("tune", 15)} Order collection</button><button class="subtle" id="export-list">${icon("download", 15)} Export list</button></div></div>
 ${b.studio.scoringNotice ? '<div class="notice"><div><strong>APEX 2.1 roster tools are ready.</strong><p>Open a player card for Franchise APEX, RosterPos, APEX-V, APEX-C, confidence and separate October status.</p></div></div>' : ""}${b.mode === "lore" ? '<div class="notice"><div><strong>Try APEX for the player board.</strong><p>Start with the built-in Top 200, then use custom legacy notes for fan favorites, broadcasters, managers and memories.</p><button class="subtle" id="try-legacy">Choose scoring lens</button></div></div>' : ""}
 <div class="board-toolbar"><div class="segmented"><button data-list="top" class="${listMode === "top" ? "selected" : ""}" ${laneView ? "disabled" : ""}>Top 200</button><button data-list="all" class="${listMode === "all" ? "selected" : ""}" ${laneView ? "disabled" : ""}>Qualified pool <span>${b.candidates.filter((c) => c.type === "Player").length}</span></button></div>${b.mode === "apex" ? `<label class="lane-picker">Performance board<select id="apex-lane" aria-label="Choose APEX performance board"><option value="collection" ${apexLane === "collection" ? "selected" : ""}>Mixed collection</option><option value="H" ${apexLane === "H" ? "selected" : ""}>APEX-H · position players</option><option value="SP" ${apexLane === "SP" ? "selected" : ""}>APEX-SP · starters</option><option value="RP" ${apexLane === "RP" ? "selected" : ""}>APEX-RP · relievers</option><optgroup label="Position chapters">${APEX_POSITIONS.map((position) => `<option value="POS:${position}" ${apexLane === `POS:${position}` ? "selected" : ""}>${position} position board</option>`).join("")}</optgroup></select></label>${apexLane.startsWith("POS:") ? `<label class="lane-picker">Era chapter<select id="apex-era" aria-label="Choose era chapter"><option value="">All eras</option>${APEX_ERAS.map((era) => `<option value="${era}" ${apexEra === era ? "selected" : ""}>${era}${era === "Modern" ? " · incomplete" : ""}</option>`).join("")}</select></label>` : ""}` : ""}<div class="search-box">${icon("search", 16)}<input id="search" value="${esc(query)}" placeholder="Find a name, position, or era…" aria-label="Search candidates"></div><select id="type-filter" aria-label="Filter candidate type" ${laneView ? "disabled" : ""}><option value="all">Everyone</option><option value="players" ${filter === "players" ? "selected" : ""}>Players</option><option value="nonplayers" ${filter === "nonplayers" ? "selected" : ""}>Non-players</option></select></div>
 <div class="board-table"><div class="table-head"><span>RANK</span><span>CANDIDATE</span><span class="role-heading">FRANCHISE ROLE</span><span>${laneView ? laneLabel : b.mode === "apex" ? "APEX-F" : "SCORE"} ${b.mode === "fls" ? "<small>/ 1,005</small>" : b.mode === "apex" ? "" : "<small>/ 100</small>"}</span><span>COMPARE</span><span></span></div><div id="candidate-rows">${renderRows()}</div></div><div class="board-foot"><span>${laneView ? `${laneLabel} uses role-only regular-season value and full precision. ≈ marks an adjacent score within 1%.` : "Drag the grip, use arrows, or click a rank to move a candidate. Your mixed collection order is always yours."}</span><span>${laneView ? "October is shown separately · missing evidence is N/A" : "* Ratings or evidence incomplete"}</span></div></section>`;
}
function renderRows() {
  const b = board(),
    laneView = b.mode === "apex" && apexLane !== "collection",
    laneLabel = apexViewLabel();
  const base = laneView
    ? b.candidates
        .filter((c) => apexViewBoard(c)?.eligible)
        .sort(
          (a, z) =>
            Number(apexViewBoard(z).APEX_R) - Number(apexViewBoard(a).APEX_R) ||
            a.name.localeCompare(z.name),
        )
    : listMode === "top"
      ? rankedCandidates(b).slice(0, 200)
      : b.candidates;
  const list = base.filter(
    (c) =>
      (laneView ||
        filter === "all" ||
        (filter === "players" ? c.type === "Player" : c.type !== "Player")) &&
      [c.name, c.role, c.era, c.nickname, c.moments, c.notes, c.easterEggs]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (!list.length)
    return `<div class="empty"><div class="empty-icon">${icon("diamond", 30)}</div><h3>${b.candidates.length ? "No matching candidates" : "Every franchise starts with a name."}</h3><p>${b.candidates.length ? "Try a different search or filter." : "Add a player, a voice, a manager, or a personality the fans will never forget."}</p>${b.candidates.length ? "" : '<button class="primary" data-add>Add your first candidate</button>'}</div>`;
  return list
    .map((c) => {
      const manualIndex = rankedCandidates(b).findIndex((x) => x.id === c.id),
        viewBoard = apexViewBoard(c),
        laneRank = viewBoard?.rank,
        rank = laneView ? laneRank || list.indexOf(c) + 1 : manualIndex + 1,
        confidence = c.type === "Player" ? dataConfidence(c) : null;
      return `<article class="candidate-row ${compareIds.includes(c.id) ? "comparing" : ""}" data-id="${esc(c.id)}"><div class="rank-cell">${laneView ? '<span class="lane-rank-mark">◆</span>' : `<span class="drag-handle" draggable="${!c.profile?.pool}" title="Drag ranked candidates to reorder" aria-hidden="true">${icon("grip", 16)}</span>`}<button class="rank ${rank <= 3 ? "top-rank" : ""}" ${laneView ? "disabled" : c.profile?.pool ? "data-promote" : "data-move"}="${esc(c.id)}" aria-label="${laneView ? `${laneLabel} rank` : c.profile?.pool ? "Add to ranking" : "Move to rank"} ${esc(c.name)}">${laneView ? `#${rank}` : c.profile?.pool ? "+ Rank" : String(rank).padStart(2, "0")}</button></div><button class="candidate-name" data-edit="${esc(c.id)}"><span class="candidate-avatar tone-${Math.max(0, manualIndex) % 4}">${esc(initials(c.name))}</span><span><strong>${esc(c.name)}</strong><small>${esc(c.nickname || c.era || "Add a nickname or a memory")}${c.sample ? " <i>EXAMPLE</i>" : ""}</small>${confidence ? `<small class="confidence-badge confidence-${esc(confidence.level)}" title="${esc(confidence.detail)}">${esc(confidence.label)}</small>` : ""}${laneView && viewBoard?.nearTie ? '<small class="starting-score">Within 1% of an adjacent score</small>' : ""}</span></button><div class="role-cell"><span class="role-badge ${c.type !== "Player" ? "nonplayer" : ""}">${esc(c.role || c.type)}</span>${c.era ? `<small>${esc(c.era)}</small>` : ""}</div><button class="score-button" data-edit="${esc(c.id)}" title="Open ${esc(c.name)} scoring card">${scoreBadge(c)}</button><label class="compare-check"><input type="checkbox" data-compare="${esc(c.id)}" aria-label="Compare ${esc(c.name)}" ${compareIds.includes(c.id) ? "checked" : ""}><span>${icon("check", 12)}</span></label><div class="row-arrows">${laneView ? "" : `<button data-up="${esc(c.id)}" aria-label="Move ${esc(c.name)} up" ${manualIndex <= 0 ? "disabled" : ""}>↑</button><button data-down="${esc(c.id)}" aria-label="Move ${esc(c.name)} down" ${manualIndex < 0 || manualIndex === rankedCandidates(b).length - 1 ? "disabled" : ""}>↓</button>`}</div></article>`;
    })
    .join("");
}
function renderCompare() {
  const b = board();
  const choices = b.candidates.filter((c) => compareIds.includes(c.id));
  const closePairs = [];
  if (b.mode === "legacy")
    for (let i = 0; i < choices.length; i++)
      for (let j = i + 1; j < choices.length; j++) {
        const pair = closeCall(choices[i], choices[j]);
        if (pair?.close)
          closePairs.push(choices[i].name + " / " + choices[j].name);
      }
  return `<section class="workspace"><div class="section-heading"><div><div class="eyebrow muted">THE CLOSE CALLS DESERVE A CLOSER LOOK</div><h2>Head to head</h2></div><button class="subtle" id="choose-compare">Choose candidates</button></div><p class="section-description">Compare up to three candidates using the current baseline. Scores guide the discussion; you make the call.</p>${closePairs.length ? `<div class="notice"><div><strong>Close call: ${esc(closePairs.join("; "))}</strong><p>A one-point change in one category could tie or reverse these complete scores. Review the evidence before choosing an order.</p></div></div>` : ""}${
    choices.length < 2
      ? `<div class="empty"><div class="empty-icon">${icon("compare", 32)}</div><h3>Who gets the nod?</h3><p>Select two or three candidates from your board to compare every factor, memory, and reason.</p><button class="primary" id="choose-compare-empty">Choose candidates</button></div>`
      : `<div class="comparison-scroll"><div class="comparison" style="--cols:${choices.length}"><div class="comparison-label">${modeLabel(b.mode)}<small>${b.mode === "apex" ? "APEX components from B-Ref value" : b.mode !== "fls" ? "Ratings on a 0–10 scale" : "Archived pillar points"}</small></div>${choices.map((c) => `<div class="compare-card"><span class="candidate-avatar">${esc(initials(c.name))}</span><small>${c.profile?.pool ? "Research pool" : "#" + (rankedCandidates(b).indexOf(c) + 1)} · ${esc(c.type)}</small><h3>${esc(c.name)}</h3><p>${esc(c.nickname)}</p><strong class="compare-total">${scoreText(c)}<small>${b.mode === "apex" ? "APEX score" : " / " + (b.mode === "fls" ? "1,005" : "100")}</small></strong><small>${calculate(c, b.mode, b.weights).complete ? "Complete" : b.mode === "fls" && c.type !== "Player" ? "Not applicable" : b.mode === "legacy" && calculate(c, b.mode, b.weights).value !== null ? "Evidence needs review" : "Incomplete / unscored"}</small><button class="subtle" data-edit="${esc(c.id)}">Edit candidate</button></div>`).join("")}${modeFactors(
          b.mode,
        )
          .map(
            ([k, label, cap]) =>
              `<div class="comparison-label">${esc(label)}<small>${b.mode === "apex" ? "APEX component" : b.mode === "legacy" ? cap + "% weight" : b.mode === "lore" ? b.weights[k] + " base weight" : "Maximum " + cap}</small></div>${choices
                .map((c) => {
                  const s = calculate(c, b.mode, b.weights),
                    p = s.parts.find((p) => p.key === k),
                    value = p?.value;
                  return `<div class="compare-factor"><strong>${!p ? "N/A" : value === null ? "Unrated" : value}</strong><div class="mini-track"><span style="width:${value == null ? 0 : Math.max(0, Math.min(100, (value / (b.mode === "apex" ? Math.max(cap || 100, value || 1) : b.mode !== "fls" ? 10 : cap)) * 100))}%"></span></div>${p && Number.isFinite(p.weight) ? `<small>${p.weight.toFixed(1)}% effective weight</small>` : ""}${b.mode === "legacy" ? `<small>Confidence: ${esc(c.legacy?.evidence[k]?.confidence || "needs-research")}</small><p class="help">${esc(c.legacy?.evidence[k]?.reason || "No reason recorded.")}</p>${safeSource(c.legacy?.evidence[k]?.source) ? `<a href="${esc(safeSource(c.legacy.evidence[k].source))}" target="_blank" rel="noopener">Source ↗</a>` : ""}` : ""}</div>`;
                })
                .join("")}`,
          )
          .join(
            "",
          )}<div class="comparison-label">Imported player data</div>${choices.map((c) => `<div class="compare-data">${renderStatImports(c, esc, { compact: true }) || '<p class="help">No imported stats yet.</p>'}</div>`).join("")}${[
          ["moments", "Famous moments"],
          ["easterEggs", "Graphic Easter eggs"],
          ["rationale", "The case for this rank"],
          ["notes", "Research notes"],
        ]
          .map(
            ([k, n]) =>
              `<div class="comparison-label">${n}</div>${choices.map((c) => `<div class="compare-notes">${esc(c[k] || "No notes yet.")}</div>`).join("")}`,
          )
          .join("")}</div></div>`
  }</section>`;
}
function renderNotebook() {
  const b = board();
  return `<section class="workspace"><div class="section-heading"><div><div class="eyebrow muted">SAVE THE DETAILS THAT BRING IT TO LIFE</div><h2>The lore notebook</h2></div><button class="subtle" id="edit-board-notes">Edit collection notes</button></div><div class="collection-notes"><span>COLLECTION NOTES</span><p>${esc(b.notes || "Ballpark setting, recurring Easter eggs, near misses, and the story you want this franchise collection to tell.")}</p></div><div class="notebook-grid">${b.candidates.map((c) => `<button class="note-card" data-edit="${esc(c.id)}"><div class="note-card-top"><span class="eyebrow muted">${esc(c.type)}</span><span>↗</span></div><h3>${esc(c.name)}</h3><p class="note-nickname">${esc(c.nickname || "Add a nickname")}</p>${c.profile?.storyThread ? `<div class="story-thread-preview"><span>THE THREAD</span><p>${esc(c.profile.storyThread)}</p></div>` : ""}${c.legacy?.moment ? `<div class="notice"><strong>Signature moment</strong><p>${esc(c.legacy.moment)}</p><small>Recognition only · no score bonus</small></div>` : ""}<div class="note-field"><span>THE MOMENT</span><p>${esc(c.moments || "Which story should never be forgotten?")}</p></div><div class="note-field"><span>THE EASTER EGG</span><p>${esc(c.easterEggs || "A small detail for the fans who know.")}</p></div>${c.sample ? '<small class="example-label">STARTER EXAMPLE · REVIEW BEFORE USE</small>' : ""}</button>`).join("") || '<div class="empty"><h3>A home for every story.</h3><p>Add your first candidate to begin collecting their lore.</p><button class="primary" data-add>Add candidate</button></div>'}</div></section>`;
}
function bind() {
  if ($("#research-autofill"))
    $("#research-autofill").onclick = () => evidenceUI.open();
  if ($("#auto-score-rank"))
    $("#auto-score-rank").onclick = () => autoRankingUI.open();
  if ($("#try-legacy")) $("#try-legacy").onclick = openWeights;
  if ($("#automation"))
    $("#automation").onclick = () => legendsUI.openAutomation();
  $$(".nav-item[data-nav]").forEach(
    (el) =>
      (el.onclick = () => {
        tab = el.dataset.nav;
        render();
      }),
  );
  $$("[data-player-view]").forEach((el) => (el.onclick = () => {
    playerView = el.dataset.playerView;
    render();
  }));
  $$("[data-more-view]").forEach((el) => (el.onclick = () => {
    moreView = el.dataset.moreView;
    render();
  }));
  $$("[data-history-view]").forEach((el) => (el.onclick = () => {
    historyView = el.dataset.historyView;
    render();
  }));
  $(".brand").onclick = (e) => {
    e.preventDefault();
    tab = "home";
    render();
  };
  $("#franchise").onchange = (e) => void selectTeam(e.target.value);
  $("#undo").onclick = () => {
    if (history.length) {
      state = JSON.parse(history.pop());
      compareIds = compareIds.filter((id) =>
        board().candidates.some((c) => c.id === id),
      );
      persist();
      render();
      toast("Last change undone.");
    }
  };
  if ($("#add-candidate")) $("#add-candidate").onclick = () => openEditor();
  if ($("#open-import")) $("#open-import").onclick = () => importUI.openImport();
  if ($("#fetch-team")) $("#fetch-team").onclick = () => bulkLookup.open();
  $$("[data-add]").forEach((e) => (e.onclick = () => openEditor()));
  $("#backups").onclick = openBackups;
  $("#mobile-backups").onclick = openBackups;
  $("#weights").onclick = openWeights;
  $("#method").onclick = openGuide;
  $("#edit-scope").onclick = () => studioUI.openScope();
  $$("[data-more-action]").forEach((el) => (el.onclick = () => {
    const action = el.dataset.moreAction;
    if (["discover", "notebook", "create"].includes(action)) { moreView = action; render(); }
    else if (action === "import") importUI.openImport();
    else if (action === "fetch") bulkLookup.open();
    else if (action === "backup") openBackups();
    else if (action === "guide") openGuide();
    else if (action === "add") openEditor();
  }));
  if ($("#add-moment")) $("#add-moment").onclick = () => openMomentEditor();
  $$("[data-moment-filter]").forEach((el) => (el.onclick = () => { momentFilter = el.dataset.momentFilter; render(); }));
  $$("[data-moment-summary]").forEach((el) => (el.onclick = () => openMomentDetails(el.dataset.momentSummary)));
  $$("[data-moment-open]").forEach((el) => {
    el.onclick = (event) => {
      if (event.target.closest("button,a")) return;
      openMomentDetails(el.dataset.momentOpen);
    };
    el.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button,a") && event.target !== el) return;
      event.preventDefault();
      openMomentDetails(el.dataset.momentOpen);
    };
  });
  $$("[data-moment-edit]").forEach((el) => (el.onclick = () => openMomentEditor(el.dataset.momentEdit)));
  $$("[data-moment-player]").forEach((el) => (el.onclick = () => openEditor(el.dataset.momentPlayer)));
  $$("[data-moment-pin]").forEach((el) => (el.onclick = () => {
    const id = el.dataset.momentPin;
    if (!board().studio.momentPins.includes(id) && board().studio.momentPins.length >= 10) {
      toast("Your Franchise Top 10 is full. Remove one favorite first.");
      return;
    }
    mutate(() => {
      const pins = board().studio.momentPins;
      if (pins.includes(id)) board().studio.momentPins = pins.filter((x) => x !== id);
      else pins.push(id);
    }, board().studio.momentPins.includes(id) ? "Removed from your Franchise Top 10." : "Added to your Franchise Top 10.");
  }));
  $$("[data-pin-up],[data-pin-down]").forEach((el) => (el.onclick = () => {
    const id = el.dataset.pinUp || el.dataset.pinDown, pins = board().studio.momentPins, i = pins.indexOf(id), j = i + (el.dataset.pinUp ? -1 : 1);
    if (i < 0 || j < 0 || j >= pins.length) return;
    mutate(() => { [pins[i], pins[j]] = [pins[j], pins[i]]; }, "Franchise Top 10 order saved.");
  }));
  if ($("#export-moments")) $("#export-moments").onclick = () => {
    const rows = [["Rank","Year","Type","Title","Card summary","Full summary","People","Personal note","Full story","Research source"], ...momentsNow().map((m) => [board().studio.momentPins.indexOf(m.id) + 1 || "",m.year,toneLabel(m.tone),m.title,m.story,m.fullSummary || m.story,m.people,m.note,momentFullStory(m),m.source])];
    download(`legacy-lore-${state.selected}-history.csv`, rows.map((r) => r.map((v) => `"${String(v || "").replaceAll('"','""')}"`).join(",")).join("\n"), "text/csv");
  };
  if ($("#edit-board-notes"))
    $("#edit-board-notes").onclick = () =>
      editText(
        "Collection notes",
        "Ballpark, series direction, and ideas to revisit.",
        "notes",
      );
  if ($("#search"))
    $("#search").oninput = (e) => {
      query = e.target.value;
      $("#candidate-rows").innerHTML = renderRows();
      bindRows();
    };
  if ($("#type-filter"))
    $("#type-filter").onchange = (e) => {
      filter = e.target.value;
      $("#candidate-rows").innerHTML = renderRows();
      bindRows();
    };
  if ($("#apex-lane"))
    $("#apex-lane").onchange = (e) => {
      apexLane = e.target.value;
      if (!apexLane.startsWith("POS:")) apexEra = "";
      query = "";
      render();
    };
  if ($("#apex-era"))
    $("#apex-era").onchange = (e) => {
      apexEra = e.target.value;
      query = "";
      render();
    };
  $$("[data-list]").forEach(
    (el) =>
      (el.onclick = () => {
        listMode = el.dataset.list;
        render();
      }),
  );
  if ($("#sort-score"))
    $("#sort-score").onclick = () =>
      confirmAction(
        "Order by score?",
        `Complete scores will be sorted highest first. Candidates needing ratings or evidence, and inapplicable candidates, follow in their existing order. Ties keep their order. You can undo this.`,
        () =>
          mutate(() => {
            board().candidates = [
              ...rankByScore(
                rankedCandidates(board()),
                board().mode,
                board().weights,
              ),
              ...board().candidates.filter((c) => c.profile?.pool),
            ];
          }, "Board ordered by complete scores."),
        "Apply score order",
      );
  if ($("#export-list")) $("#export-list").onclick = () => downloadList();
  if ($("#clear-examples"))
    $("#clear-examples").onclick = () =>
      confirmAction(
        "Remove starter examples?",
        "Only entries still marked as examples will be removed. Your saved edits and new candidates stay.",
        () =>
          mutate(() => {
            board().candidates = board().candidates.filter((c) => !c.sample);
            compareIds = compareIds.filter((id) =>
              board().candidates.some((c) => c.id === id),
            );
          }, "Starter examples removed."),
        "Remove examples",
      );
  $$("#choose-compare, #choose-compare-empty").forEach(
    (e) => (e.onclick = openComparePicker),
  );
  bindRows();
}
function bindRows() {
  $$("[data-promote]").forEach(
    (el) =>
      (el.onclick = () =>
        mutate(() => {
          const b = board(),
            c = b.candidates.find((x) => x.id === el.dataset.promote);
          const ranked = rankedCandidates(b);
          c.profile.pool = false;
          b.candidates = [
            ...ranked,
            c,
            ...b.candidates.filter((x) => x.profile?.pool),
          ];
        }, "Added to your manual ranking.")),
  );

  $$("[data-edit]").forEach(
    (el) => (el.onclick = () => openEditor(el.dataset.edit)),
  );
  $$("[data-compare]").forEach(
    (el) =>
      (el.onchange = () => {
        const id = el.dataset.compare;
        if (el.checked && compareIds.length >= 3) {
          el.checked = false;
          toast("Compare up to three candidates at a time.");
          return;
        }
        compareIds = el.checked
          ? [...compareIds, id]
          : compareIds.filter((x) => x !== id);
        render();
        if (compareIds.length === 2)
          toast(
            "Two selected. Open Compare candidates to see them side by side.",
          );
      }),
  );
  $$("[data-up],[data-down]").forEach(
    (el) =>
      (el.onclick = () => {
        const id = el.dataset.up || el.dataset.down;
        const index = rankedCandidates(board()).findIndex((c) => c.id === id);
        mutate(() => {
          moveRanked(id, index + (el.dataset.up ? -1 : 1));
        });
      }),
  );
  $$("[data-move]").forEach(
    (el) => (el.onclick = () => openMove(el.dataset.move)),
  );
  $$(".drag-handle").forEach(
    (el) =>
      (el.ondragstart = (e) => {
        dragId = el.closest(".candidate-row").dataset.id;
        e.dataTransfer.setData("text/plain", dragId);
        e.dataTransfer.effectAllowed = "move";
      }),
  );
  $$(".candidate-row").forEach((el) => {
    el.ondragover = (e) => {
      e.preventDefault();
      el.classList.add("drag-over");
    };
    el.ondragleave = () => el.classList.remove("drag-over");
    el.ondrop = (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      const from = dragId;
      if (!from) return;
      const to = rankedCandidates(board()).findIndex(
        (c) => c.id === el.dataset.id,
      );
      mutate(() => {
        moveRanked(from, to);
      });
      dragId = null;
    };
    el.ondragend = () => {
      dragId = null;
      $$(".drag-over").forEach((x) => x.classList.remove("drag-over"));
    };
  });
}
function openModal(title, body, wide = false) {
  const modal = $("#modal");
  modal.className = wide ? "wide" : "";
  modal.innerHTML = `<div class="modal-head"><div><span class="eyebrow muted">LEGACY LORE STUDIO</span><h2>${esc(title)}</h2></div><button class="icon-button" id="close-modal" aria-label="Close dialog">${icon("x")}</button></div>${body}`;
  $("#close-modal").onclick = () => modal.close();
  modal.showModal();
  return modal;
}
function confirmAction(title, text, fn, label = "Confirm") {
  openModal(
    title,
    `<div class="modal-body"><p>${esc(text)}</p></div><div class="modal-footer"><button class="subtle" id="cancel-action">Cancel</button><button class="primary" id="confirm-action">${esc(label)}</button></div>`,
  );
  $("#cancel-action").onclick = () => $("#modal").close();
  $("#confirm-action").onclick = () => {
    $("#modal").close();
    fn();
  };
}
function openMove(id) {
  const c = board().candidates.find((c) => c.id === id);
  openModal(
    "Move " + c.name,
    `<form id="move-form"><div class="modal-body"><label>New rank<input id="rank-input" type="number" min="1" max="${rankedCandidates(board()).length}" value="${rankedCandidates(board()).indexOf(c) + 1}" required></label><p class="help">Ranks 1–100 form your main player collection. Custom additions remain available beyond it.</p></div><div class="modal-footer"><button class="primary">Move candidate</button></div></form>`,
  );
  $("#move-form").onsubmit = (e) => {
    e.preventDefault();
    const to = Number($("#rank-input").value) - 1;
    $("#modal").close();
    mutate(() => {
      moveRanked(id, to);
    }, "Candidate moved.");
  };
}
function editText(title, description, key) {
  openModal(
    title,
    `<form id="text-form"><div class="modal-body"><label>${esc(description)}<textarea id="text-value" rows="5" maxlength="20000">${esc(board()[key])}</textarea></label></div><div class="modal-footer"><button class="primary">Save notes</button></div></form>`,
  );
  $("#text-form").onsubmit = (e) => {
    e.preventDefault();
    const value = $("#text-value").value;
    $("#modal").close();
    mutate(() => {
      board()[key] = value;
    }, "Saved.");
  };
}
function playerStoryResearchHTML(c, existing) {
  if (c.type !== "Player") return "";
  const research = c.profile?.research,
    source = safeSource(research?.source),
    retro = retrosheetProfile(c),
    retroUrl = safeSource(retro?.playerUrl),
    claims = (research?.claims || [])
      .filter((item) => typeof item?.text === "string" && item.text.trim())
      .slice(0, 3),
    excerpt = String(research?.extract || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 520);
  return `<section class="player-story-research"><div class="player-story-head"><div><span>STORIES & BIOGRAPHY</span><strong>${research ? "Sourced leads ready to review" : "Build the story without changing the score"}</strong></div><b>Editorial</b></div><p>Retrosheet supplies game evidence. Wikipedia supplies a biography starting point. Nothing in this section changes APEX or automatically becomes your final lore.</p>${research ? `${claims.length ? `<div class="player-story-leads">${claims.map((item) => `<article><span>${esc(String(item.kind || "story").replaceAll("-", " "))}</span><p>${esc(item.text)}</p></article>`).join("")}</div>` : excerpt ? `<blockquote>${esc(excerpt)}${String(research.extract || "").replace(/\s+/g, " ").trim().length > excerpt.length ? "…" : ""}</blockquote>` : ""}<div class="player-story-links">${source ? `<a href="${esc(source)}" target="_blank" rel="noopener">Read full Wikipedia biography</a>` : ""}<button type="button" class="subtle" id="player-story-research">Refresh story research</button></div><small>${esc(research.license || "Wikipedia text · CC BY-SA")} · Review franchise and year context before saving a story.</small>` : `<div class="player-story-links">${existing ? '<button type="button" class="subtle" id="player-story-research">Find Wikipedia biography and story leads</button>' : "<small>Save this player first, then research the biography.</small>"}</div>`}${retroUrl ? `<a class="retro-player-link" href="${esc(retroUrl)}" target="_blank" rel="noopener">Open Retrosheet player page, transactions and yearly logs</a>` : ""}</section>`;
}
function openEditor(id) {
  const existing = board().candidates.find((c) => c.id === id);
  editorDraft = structuredClone(existing || newCandidate());
  const c = editorDraft;
  const fullStatsHTML = (status = "") => {
    const tables = c.statImports || [],
      regular = tables.filter((item) => /regular season/i.test(item.scope || item.label || "")).length,
      postseason = tables.filter((item) => /postseason/i.test(item.scope || item.label || "")).length;
    return `<section class="full-player-stats"><div class="full-player-stats-head"><div><span>COMPLETE FRANCHISE LEDGER</span><strong>Career totals and every season</strong></div>${regular ? `<b>${regular} regular · ${postseason} postseason</b>` : ""}</div><p id="player-stat-status" class="help">${esc(status || (regular ? `Loaded from MLB for this franchise. Postseason counting stats are separate from verified APEX-Oct evidence.${c.profile?.playerCardStats?.warning ? ` ${c.profile.playerCardStats.warning}` : ""}` : c.type === "Player" && c.profile?.mlbId ? "Loading franchise regular-season and postseason lines…" : "Use MLB lookup to connect this player and load full franchise statistics."))}</p>${renderStatImports(c, esc, { editable: true, collapsed: true })}<div id="player-seasons"><p class="help">Loading season-by-season franchise lines…</p></div></section>`;
  };
  const loadPlayerSeasons = async () => {
    const el = $("#player-seasons");
    if (!el || c.type !== "Player") return;
    const franchise = state.selected;
    try {
      if (!seasonsCache[franchise]) {
        const res = await fetch(`./data/seasons/${franchise}.json`);
        if (!res.ok) return el.remove();
        seasonsCache[franchise] = await res.json();
      }
      const data = seasonsCache[franchise],
        mlbid = String(c.profile?.mlbId || ""),
        entry =
          data.players[mlbid] ||
          data.players["name:" + normName(c.name)];
      if (!entry || (!entry.seasons?.length && !entry.pitching?.length)) {
        el.innerHTML = `<p class="help">No season-by-season data for ${esc(c.name)} yet.</p>`;
        return;
      }
      el.innerHTML = `<div class="seasons-head"><span>SEASON BY SEASON</span><strong>${esc(entry.name)} with the franchise</strong></div><small class="help">Lahman Baseball Database (1871–2021) and Baseball-Reference (2022–2025). WAR and OPS+/ERA+ from Baseball-Reference where available.</small>${seasonTablesHTML(entry)}`;
    } catch {
      el.remove();
    }
  };
  const field = (key, label, placeholder = "", area = false) =>
    `<label>${label}${area ? `<textarea name="${key}" rows="3" maxlength="20000" placeholder="${esc(placeholder)}">${esc(c[key])}</textarea>` : `<input name="${key}" value="${esc(c[key])}" maxlength="${key === "name" ? 150 : 500}" placeholder="${esc(placeholder)}" ${key === "name" ? "required" : ""}>`}</label>`;
  const historyLinks = new Set(c.profile?.historyLinks || []),
    historyChoices = state.almanac.chapters
      .map(
        (chapter) =>
          `<label><input type="checkbox" name="history-link" value="${esc(chapter.id)}" ${historyLinks.has(chapter.id) ? "checked" : ""}><span><strong>${esc(chapter.title)}</strong><small>${esc(chapter.subtitle || "Historical Almanac")}</small></span></label>`,
      )
      .join("");
  openModal(
    existing ? "Edit candidate" : "Add a franchise legend",
    `<form id="candidate-form"><div class="modal-body editor"><div class="form-grid">${field("name", "Name", "Player, broadcaster, manager…")}<label>Candidate type<select name="type">${TYPES.map((t) => `<option ${c.type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>${field("nickname", "Nickname / signature line", "The name fans remember")}${field("role", "Franchise role", "Shortstop, voice of the team…")}${field("era", "Franchise years / era", "Years with this franchise")}${field("tier", "Your tier", "Inner Circle, Icon, Fan Favorite…")}</div><label class="bulk-option"><input id="lookup-after-save" type="checkbox" ${!existing ? "checked" : ""}> Look up MLB stats after saving this player</label><div id="key-stats">${statStrip(c, esc)}${rosterCompanionHTML(c, esc)}${retrosheetEvidenceHTML(c, esc)}</div>${playerStoryResearchHTML(c, existing)}${honorsHTML(c, esc)}${
      Object.keys(c.profile?.generated?.fields || {}).length
        ? `<div class="notice"><div><strong>Auto-filled source drafts · editable</strong><p>${Object.entries(
            c.profile.generated.fields,
          )
            .map(
              ([key, item]) =>
                `<a href="${esc(safeSource(item.source))}" target="_blank" rel="noopener">${esc(key)} source ↗</a>`,
            )
            .join(
              " · ",
            )}</p><p class="help">Story text may be an attributed excerpt. Review the original context; editing a field protects your version from later refreshes.</p></div></div>`
        : ""
    }<div id="saved-stats">${fullStatsHTML()}</div><div id="candidate-assistant">${legendsUI.editorAssistant(c)}</div>${
      c.type === "Player"
        ? `<details class="auto-method" open><summary>Roster fit · editable</summary><p class="help">These labels guide the balanced 26-player builder. MLB lookup can fill throwing hand; you can correct it here.</p><div class="form-grid"><label>Throws<select name="throws"><option value="">Unknown</option><option value="R" ${c.profile.throws === "R" ? "selected" : ""}>Right</option><option value="L" ${c.profile.throws === "L" ? "selected" : ""}>Left</option><option value="S" ${c.profile.throws === "S" ? "selected" : ""}>Switch / both</option></select></label><label>Preferred roster use<select name="roster-role"><option value="">Automatic from stats and position</option>${[
            ["closer", "Closer"],
            ["setup", "Setup relief"],
            ["middle", "Middle relief"],
            ["left-specialist", "Left-handed specialist"],
            ["long", "Long relief"],
            ["swing", "Swingman"],
            ["dh", "True designated hitter"],
            ["pinch-hitter", "Pinch-hit / power bat"],
          ]
            .map(
              ([v, n]) =>
                `<option value="${v}" ${c.profile.rosterRole === v ? "selected" : ""}>${n}</option>`,
            )
            .join(
              "",
            )}</select></label></div><label class="bulk-option"><input name="two-way-qualified" type="checkbox" ${c.profile.twoWayQualified ? "checked" : ""}> Verified qualified MLB two-way player (does not count toward the 13-pitcher limit)</label></details><details class="auto-method"><summary>Defensive contribution · optional sourced assessment</summary><p class="help">Defense is not inferred from fielding percentage or Gold Gloves. An explicit sourced assessment can contribute 20% of the suggested excellence score. Leave blank when evidence is missing.</p><label>Defensive value / 10<input name="defense-rating" type="number" min="0" max="10" step="0.5" value="${c.profile.defenseEvidence?.rating ?? ""}"></label><label>Why this defensive rating?<textarea name="defense-reason" maxlength="3000">${esc(c.profile.defenseEvidence?.reason || "")}</textarea></label><label>Defense source<input name="defense-source" type="url" maxlength="2000" value="${esc(c.profile.defenseEvidence?.source || "")}"></label></details>`
        : ""
    }<div class="editor-score-head"><h3>Score / notes</h3><select id="editor-mode" aria-label="Scoring mode for candidate"><option value="apex" ${board().mode === "apex" ? "selected" : ""}>Team APEX · performance</option><option value="legacy" ${board().mode === "legacy" ? "selected" : ""}>Custom legacy · four factors</option><option value="lore" ${board().mode === "lore" ? "selected" : ""}>Classic custom · eight factors</option></select></div><div id="editor-scoring"></div><details class="story-thread-editor" open><summary>Story thread across Legacy Lore</summary><p class="help">This short theme follows the person into your all-time roster, Legacy Legends, and linked history chapters.</p><label>Theme line<textarea name="story-thread" rows="3" maxlength="2000" placeholder="The one or two lines that explain why this person belongs in the larger story.">${esc(c.profile?.storyThread || "")}</textarea></label><div class="history-link-choices"><strong>Linked Historical Almanac chapters</strong>${historyChoices || '<p class="help">Create a Historical Almanac chapter first.</p>'}</div></details><details class="note-details" open><summary>Custom legacy notes</summary><div class="notes-form">${field("moments", "Famous moments", "The play, call, season, or story fans still talk about.", true)}${field("easterEggs", "Graphic Easter eggs", "Ballpark details, hidden numbers, props, rituals, mascots…", true)}${field("rationale", "Why this rank?", "The case for keeping this person above the next name.", true)}${field("notes", "Research notes", "Franchise-only stats, memories, questions to check.", true)}${field("sources", "Sources / evidence", "Paste links and label what each one supports.", true)}</div></details><p class="help">APEX builds the player-performance board. Custom notes are where favorites, lore and non-player legends live.</p></div><div class="modal-footer">${existing ? '<button type="button" class="danger-text" id="delete-candidate">Remove candidate</button>' : "<span></span>"}<div><button type="button" class="subtle" id="cancel-edit">Cancel</button><button class="primary">Save candidate</button></div></div></form>`,
    true,
  );
  if ($("#player-story-research"))
    $("#player-story-research").onclick = () => studioUI.research(existing.id);
  const bindAssistant = () => {
    const button = $("#estimate-candidate");
    if (button)
      button.onclick = () => {
        const next = applyAutoScores(c);
        Object.assign(c, next);
        $("#candidate-assistant").innerHTML = legendsUI.editorAssistant(c);
        bindAssistant();
        renderEditorScores();
      };
  };
  bindAssistant();
  renderEditorScores();
  $("#editor-mode").onchange = renderEditorScores;
  const bindStatRemoval = () => {
    $$("[data-remove-stat]").forEach(
      (el) =>
        (el.onclick = () => {
          c.statImports = c.statImports.filter(
            (s) => s.id !== el.dataset.removeStat,
          );
          if (c.profile?.playerCardStats) delete c.profile.playerCardStats;
          Object.assign(c, applyAutoScores(c));
          $("#saved-stats").innerHTML = fullStatsHTML("Saved table removed.");
          $("#key-stats").innerHTML =
            statStrip(c, esc) +
            rosterCompanionHTML(c, esc) +
            retrosheetEvidenceHTML(c, esc);
          $("#candidate-assistant").innerHTML = legendsUI.editorAssistant(c);
          bindAssistant();
          renderEditorScores();
          bindStatRemoval();
        }),
    );
  };
  bindStatRemoval();
  const loadFullPlayerStats = async (force = false) => {
    if (
      !existing ||
      c.type !== "Player" ||
      !Number.isInteger(c.profile?.mlbId) ||
      (!force && c.profile?.playerCardStats?.version === "player-card-stats-v1")
    )
      return;
    const status = $("#player-stat-status");
    if (status) status.textContent = "Loading franchise regular-season and postseason lines…";
    try {
      const franchise = state.selected,
        from = FRANCHISE_DATA[franchise][2],
        to = new Date().getFullYear(),
        result = await requestJSON(
          `/api/player-card-stats?team=${encodeURIComponent(franchise)}&id=${c.profile.mlbId}&from=${from}&to=${to}`,
        ),
        automatic = [...(result.regular || []), ...(result.postseason || [])],
        other = (c.statImports || []).filter(
          (item) =>
            !(
              item.provider === "MLB Stats API" &&
              Number(item.playerId) === Number(c.profile.mlbId) &&
              String(item.scope || "").startsWith(franchise + " ·")
            ),
        );
      c.statImports = [...automatic, ...other].slice(0, 10);
      c.profile.playerCardStats = {
        version: result.version,
        fetchedAt: result.fetchedAt,
        warning: result.warning || "",
        regularTables: (result.regular || []).length,
        postseasonTables: (result.postseason || []).length,
      };
      Object.assign(c, applyAutoScores(c));
      mutate(() => {
        const index = board().candidates.findIndex((item) => item.id === c.id);
        if (index >= 0) board().candidates[index] = structuredClone(c);
      }, null, { redraw: false });
      if ($("#saved-stats")) $("#saved-stats").innerHTML = fullStatsHTML();
      if ($("#key-stats"))
        $("#key-stats").innerHTML =
          statStrip(c, esc) +
          rosterCompanionHTML(c, esc) +
          retrosheetEvidenceHTML(c, esc);
      if ($("#candidate-assistant"))
        $("#candidate-assistant").innerHTML = legendsUI.editorAssistant(c);
      bindStatRemoval();
      bindAssistant();
      renderEditorScores();
    } catch (error) {
      if ($("#player-stat-status"))
        $("#player-stat-status").innerHTML = `${esc(error.message)} <button type="button" class="text-button" id="retry-player-stats">Retry</button>`;
      if ($("#retry-player-stats"))
        $("#retry-player-stats").onclick = () => loadFullPlayerStats(true);
    }
  };
  void loadFullPlayerStats();
  void loadPlayerSeasons();
  $('#candidate-form [name="type"]').onchange = (e) => {
    const wasPlayer = c.type === "Player";
    c.type = e.target.value;
    if (wasPlayer && c.type !== "Player")
      c.na = [...new Set([...c.na, "performance", "peak"])];
    if (!wasPlayer && c.type === "Player")
      c.na = c.na.filter((k) => !["performance", "peak"].includes(k));
    $("#candidate-assistant").innerHTML = legendsUI.editorAssistant(c);
    bindAssistant();
    renderEditorScores();
  };
  $("#cancel-edit").onclick = () => $("#modal").close();
  $("#candidate-form").onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const name = String(data.get("name")).trim();
    if (!name) {
      toast("Enter a candidate name.");
      return;
    }
    for (const k of [
      "name",
      "type",
      "nickname",
      "role",
      "era",
      "tier",
      "moments",
      "easterEggs",
      "notes",
      "sources",
      "rationale",
    ])
      c[k] = String(data.get(k) || "").trim();
    c.profile.storyThread = String(data.get("story-thread") || "").trim();
    c.profile.historyLinks = data
      .getAll("history-link")
      .map(String)
      .filter((chapterId) => state.almanac.chapters.some((item) => item.id === chapterId));
    if (c.type === "Player") {
      c.profile.throws = String(data.get("throws") || "");
      c.profile.rosterRole = String(data.get("roster-role") || "");
      c.profile.twoWayQualified = data.get("two-way-qualified") === "on";
      const raw = data.get("defense-rating"),
        source = String(data.get("defense-source") || "");
      if (source && !safeSource(source)) {
        toast("Use a valid defense source URL.");
        return;
      }
      c.profile.defenseEvidence = {
        rating: raw == null || raw === "" ? null : Number(raw),
        reason: String(data.get("defense-reason") || ""),
        source,
      };
    }
    try {
      c.legacy = cleanLegacy(c.legacy);
    } catch (err) {
      toast(err.message);
      return;
    }
    c.sample = false;
    const lookup = $("#lookup-after-save").checked && c.type === "Player";
    $("#modal").close();
    mutate(() => {
      const i = board().candidates.findIndex((x) => x.id === c.id);
      if (i < 0) board().candidates.push(c);
      else board().candidates[i] = c;
    }, `${c.name} saved.`);
    if (lookup) bulkLookup.open([c.id], true);
  };
  if ($("#delete-candidate"))
    $("#delete-candidate").onclick = () => {
      const old = c;
      $("#modal").close();
      confirmAction(
        "Remove " + c.name + "?",
        "This removes the candidate and their notes from this franchise. Undo can restore them.",
        () =>
          mutate(() => {
            board().studio.exclusions.push(
              old.profile?.mlbId
                ? "mlb:" + old.profile.mlbId
                : "name:" +
                    old.name
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, ""),
            );
            board().candidates = board().candidates.filter(
              (x) => x.id !== old.id,
            );
            compareIds = compareIds.filter((x) => x !== old.id);
          }, "Candidate removed."),
        "Remove candidate",
      );
    };
}
function renderEditorScores() {
  const c = editorDraft,
    mode = $("#editor-mode").value;
  const fls = mode === "fls";
  if (mode === "apex") {
    const s = calculate(c, "apex", board().weights),
      a = c.profile?.advancedStats,
      boards = a?.apexBoards,
      primary = boards?.[a?.primaryBoard] || null,
      rows = boards
        ? ["H", "SP", "RP"]
            .map((code) => {
              const lane = boards[code];
              if (!lane) return "";
              return `<tr><th>${esc(lane.label || `APEX-${code}`)}</th><td>${Number(lane.APEX_R || 0).toFixed(2)}${lane.eligible ? ` · #${lane.rank || "—"}` : " · not eligible"}</td></tr>`;
            })
            .join("")
        : "",
      evidence = a?.apexOctoberEvidence || {},
      october = apexOctober(evidence),
      flags = [
        a?.mixedRoleExposure ? "Mixed starter/relief exposure" : "",
        a?.gsFallbackUsed ? "GS/G fallback used" : "",
        a?.primeRule ? "Prime5 uses the mechanical 1–3 empty-year skip rule" : "",
      ].filter(Boolean),
      retroOct = a?.retrosheetOctober,
      retroSource = retroOct?.source ? safeSource(retroOct.source) : "",
      retroRoles = retroOct
        ? [
            retroOct.batting
              ? `${retroOct.batting.events} batting PA · ${Number(retroOct.batting.wpa).toFixed(2)} WPA`
              : "",
            retroOct.pitching
              ? `${retroOct.pitching.events} batters faced · ${Number(retroOct.pitching.wpa).toFixed(2)} WPA`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
      automaticOctober = retroOct
        ? `<div class="notice retrosheet-october"><strong>Automatic Retrosheet postseason model</strong><br>WPA ${Number(retroOct.wpa).toFixed(2)} · Clutch ${Number(retroOct.clutch).toFixed(2)} · ${retroRoles}<br><small>${esc(String(retroOct.confidence || "").toUpperCase())} confidence · ${esc((retroOct.years || []).join(", "))}${retroSource ? ` · <a href="${esc(retroSource)}" target="_blank" rel="noopener">source data</a>` : ""}</small><br><small>${esc(retroOct.attribution || "")}</small></div>`
        : "";
    $("#editor-scoring").innerHTML =
      `<div class="rating-total"><span>${esc(a?.scoreBoard || "APEX role board")}</span><strong id="apex-final-total">${s.value === null ? "Needs data" : s.value.toFixed(2)}</strong><small>${s.complete ? esc(a?.formulaVersion || "Ready") : "Use Find top players or Prepare APEX scores"}</small></div>${a?.found !== false && a ? `<div class="data-table-wrap"><table class="data-table"><tbody>${rows}<tr><th>Peak3 · best 3 seasons</th><td>${Number(primary?.Peak3 ?? a.Apex ?? 0).toFixed(2)}</td></tr><tr><th>Prime5 · best 5-year window</th><td>${Number(primary?.Prime5 ?? a.Prime ?? 0).toFixed(2)}</td></tr><tr><th>Career · all seasons</th><td>${Number(primary?.Career ?? a.Career ?? a.Reign ?? 0).toFixed(2)}</td></tr><tr><th>Primary-role WAR</th><td>${Number(primary?.WAR ?? a.totalWAR ?? 0).toFixed(1)}</td></tr><tr><th>Primary-role WAA</th><td>${Number(primary?.WAA ?? a.WAA ?? 0).toFixed(1)}</td></tr></tbody></table></div>${a?.role === "SP" || a?.role === "RP" ? `<p class="notice"><strong>Pitching roles are reconstructed.</strong> ${esc(a.roleSplitReason || "Starter and relief WAA are allocated from each stint's innings share; WAA_adj belongs only to relief.")}${flags.length ? `<br>${esc(flags.join(" · "))}` : ""}</p>` : flags.length ? `<p class="notice">${esc(flags.join(" · "))}</p>` : ""}<details class="auto-method october-score-editor" open><summary>APEX-Oct · postseason scoring</summary>${automaticOctober}<p class="help">The Retrosheet model fills these values automatically when evidence exists. You can replace them with complete, verified career totals from another source. The signed score adds at half strength to APEX-F. Rings never add points.</p><div class="form-grid"><label>Career postseason WPA<input id="oct-wpa" type="number" step="0.01" min="-100" max="100" value="${evidence.wpa ?? ""}" placeholder="N/A"></label><label>Career postseason Clutch<input id="oct-clutch" type="number" step="0.01" min="-100" max="100" value="${evidence.clutch ?? ""}" placeholder="N/A"></label></div><label>Postseason evidence link<input id="oct-source" type="url" maxlength="2000" value="${esc(evidence.source || "")}" placeholder="https://..."></label><label class="bulk-option"><input id="oct-complete" type="checkbox" ${evidence.complete ? "checked" : ""}> Use these complete career postseason totals through 2025</label><div class="rating-total october-live"><span>APEX-Oct</span><strong id="oct-live-score">${october.raw == null ? "N/A" : `${october.raw >= 0 ? "+" : ""}${october.raw.toFixed(2)}`}</strong><small id="oct-live-detail">${october.complete ? `APEX-F contribution ${october.contribution >= 0 ? "+" : ""}${october.contribution.toFixed(2)}` : "Enter both values, a source, and verify completeness"}</small></div><p class="help">Formula: 0.60 × clipped WPA + 0.25 × clipped Clutch. APEX-F = APEX-R + 0.50 × APEX-Oct.</p></details>` : '<p class="notice">No APEX data saved for this player yet.</p>'}<p class="help">Regular-season APEX uses completed seasons through 2025. Missing October evidence is unknown, never zero. Your collection order, roster choices, notes and legacy judgment stay editable.</p>`;
    if (a?.found !== false && a) {
      const updateOctober = () => {
        const wpa = $("#oct-wpa").value === "" ? null : Number($("#oct-wpa").value),
          clutch = $("#oct-clutch").value === "" ? null : Number($("#oct-clutch").value),
          source = $("#oct-source").value.trim(),
          verified = $("#oct-complete").checked,
          sourceOK = !source || Boolean(safeSource(source)),
          complete = verified && sourceOK && Boolean(source) && wpa !== null && clutch !== null;
        c.profile.advancedStats = applyApexOctoberEvidence(c.profile.advancedStats, {
          wpa,
          clutch,
          source,
          complete,
          checkedAt: complete ? new Date().toISOString() : evidence.checkedAt || "",
        });
        const preview = apexOctober({ wpa, clutch, complete: wpa !== null && clutch !== null });
        $("#oct-live-score").textContent = preview.raw == null ? "N/A" : `${preview.raw >= 0 ? "+" : ""}${preview.raw.toFixed(2)}`;
        $("#oct-live-detail").textContent = complete
          ? `Applied to APEX-F: ${preview.contribution >= 0 ? "+" : ""}${preview.contribution.toFixed(2)}`
          : verified && !sourceOK
            ? "Use a complete http or https source link"
            : verified && !source
              ? "Add the evidence link before applying the score"
              : "Preview only until both values, a source, and verification are present";
        $("#apex-final-total").textContent = Number(c.profile.advancedStats.APEX_F).toFixed(2);
      };
      for (const id of ["#oct-wpa", "#oct-clutch", "#oct-source", "#oct-complete"])
        $(id).addEventListener("input", updateOctober);
    }
    return;
  }
  if (mode === "legacy") {
    renderLegacyEditor(c, state.selected, esc);
    return;
  }
  if (fls && c.type !== "Player") {
    $("#editor-scoring").innerHTML =
      '<div class="notice">FLS-V2.2 is a player-specific framework. This non-player stays on your board without an FLS score. Use Lore first for a comparable, role-aware assessment.</div>';
    return;
  }
  $("#editor-scoring").innerHTML =
    `<p class="help">${fls ? "Enter researched pillar totals from your locked specification. This is a bounded points worksheet, not an automatic raw-stat calculator. WAR adds no points." : "Rate each factor from 0 to 10. Blank = unassessed; 0 = assessed with no points. N/A removes a factor and proportionally redistributes its weight."}</p><div class="rating-total"><span>${fls ? "FLS-V2.2 total" : "Weighted lore score"}</span><strong id="live-total"></strong><small id="live-completeness"></small></div>${(fls
      ? PILLARS
      : FACTORS
    )
      .map(([k, n, cap, desc]) => {
        const max = fls ? cap : 10;
        const v = (fls ? c.fls : c.scores)[k];
        return `<div class="rating-row"><div><label for="score-${k}">${esc(n)}</label><p>${esc(desc)}</p>${!fls && c.autoScores?.[k] && c.scores[k] === c.autoScores[k].value ? `<small class="auto-tag">AUTO ESTIMATE · editable</small>` : ""}</div><div class="rating-controls"><input aria-label="${esc(n)} slider" type="range" min="0" max="${max}" step="${fls ? "1" : ".5"}" value="${v ?? 0}" data-slider="${k}" ${!fls && c.na.includes(k) ? "disabled" : ""}><input id="score-${k}" aria-label="${esc(n)} score" type="number" min="0" max="${max}" step="any" placeholder="—" value="${v ?? ""}" data-score="${k}" ${!fls && c.na.includes(k) ? "disabled" : ""}><small>/ ${max}</small>${!fls ? `<label class="na-label"><input type="checkbox" data-na="${k}" ${c.na.includes(k) ? "checked" : ""}> N/A</label>` : ""}</div></div>`;
      })
      .join(
        "",
      )}${fls ? '<p class="help">P4 uses max(Track A, Track B), capped at 200. P5 = defense up to 85 + baserunning/control up to 50. Identity Residual must pass identification, non-redundancy, and durability tests.</p>' : '<p class="help">Anchors: 0 = none · 2 = minor · 5 = meaningful · 8 = franchise icon · 10 = defining, generational legacy. Avoid giving the same piece of evidence full credit across overlapping factors.</p>'}`;
  const update = () => {
    const s = calculate(c, mode, board().weights);
    $("#live-total").textContent =
      s.value === null
        ? "Unscored"
        : `${s.value.toFixed(1)} / ${s.max.toLocaleString()}`;
    $("#live-completeness").textContent = s.complete
      ? "Complete"
      : s.applicable
        ? "Incomplete · blank factors contribute no points until rated"
        : "No applicable weighted factors";
  };
  update();
  $$("[data-score]", $("#editor-scoring")).forEach(
    (el) =>
      (el.oninput = () => {
        const k = el.dataset.score;
        const max = Number(el.max);
        const n = el.value === "" ? null : Number(el.value);
        if (n !== null && (!Number.isFinite(n) || n < 0 || n > max)) {
          el.setCustomValidity(`Use a value from 0 to ${max}.`);
          return;
        }
        el.setCustomValidity("");
        (fls ? c.fls : c.scores)[k] = n;
        if (!fls && c.autoScores) delete c.autoScores[k];
        el.closest(".rating-row").querySelector(".auto-tag")?.remove();
        $(`[data-slider="${k}"]`).value = n ?? 0;
        update();
      }),
  );
  $$("[data-slider]", $("#editor-scoring")).forEach(
    (el) =>
      (el.oninput = () => {
        const k = el.dataset.slider;
        (fls ? c.fls : c.scores)[k] = Number(el.value);
        if (!fls && c.autoScores) delete c.autoScores[k];
        el.closest(".rating-row").querySelector(".auto-tag")?.remove();
        $(`[data-score="${k}"]`).value = el.value;
        $(`[data-score="${k}"]`).setCustomValidity("");
        update();
      }),
  );
  $$("[data-na]", $("#editor-scoring")).forEach(
    (el) =>
      (el.onchange = () => {
        c.na = el.checked
          ? [...new Set([...c.na, el.dataset.na])]
          : c.na.filter((k) => k !== el.dataset.na);
        renderEditorScores();
      }),
  );
}
function openWeights() {
  const b = board();
  openModal(
    "Choose your scoring lens",
    `<form id="weights-form"><div class="modal-body"><div class="mode-options"><label><input type="radio" name="mode" value="apex" ${b.mode === "apex" || b.mode === "fls" ? "checked" : ""}><span><strong>Role-separated APEX · recommended</strong><small>Three performance boards: hitters, starters and relievers.</small></span></label><label><input type="radio" name="mode" value="legacy" ${b.mode === "legacy" ? "checked" : ""}><span><strong>Custom legacy section</strong><small>Manual identity, fan connection, signature and role excellence.</small></span></label><label><input type="radio" name="mode" value="lore" ${b.mode === "lore" ? "checked" : ""}><span><strong>Classic custom sliders</strong><small>Your older eight-factor worksheet, kept for notes and experiments.</small></span></label></div><div id="apex-explanation" class="notice"><strong>APEX 2.2 Test is performance-first.</strong><p>APEX-H scores batting, fielding and baserunning. APEX-SP scores starter pitching. APEX-RP scores relief pitching with leverage adjustment. All three use 25% Peak3, 35% Prime5 and 40% Career. APEX-F may add half of signed APEX-Oct when complete evidence is available.</p></div><div id="legacy-explanation" class="notice"><strong>Custom legacy is manual.</strong><p>Use this for broadcasters, managers, mascots, favorites, moments, nicknames and the names fans remember beyond the stat sheet.</p></div><div id="weight-settings"><p class="help">Weights are normalized to 100%. Applied only to this franchise.</p>${FACTORS.map(([k, n]) => `<label class="weight-row">${n}<input type="number" name="weight-${k}" min="0" max="100" step="any" value="${b.weights[k]}" required></label>`).join("")}<p id="weight-summary" class="notice"></p><button type="button" class="text-button" id="reset-weights">Restore defaults</button></div><p class="help">Changing the lens updates displayed scores. It never reorders your board until you choose Auto-score & rank or Order by score.</p></div><div class="modal-footer"><button class="primary">Apply scoring lens</button></div></form>`,
  );
  const update = () => {
    const selected = $('[name="mode"]:checked').value;
    $("#apex-explanation").hidden = selected !== "apex";
    $("#legacy-explanation").hidden = selected !== "legacy";
    $("#weight-settings").hidden = selected !== "lore";
    $$('[name^="weight-"]').forEach((x) => (x.disabled = selected !== "lore"));
    const total = FACTORS.reduce(
      (s, [k]) => s + Number($(`[name="weight-${k}"]`).value),
      0,
    );
    const lore = [
      "identity",
      "moments",
      "nostalgia",
      "attachment",
      "culture",
    ].reduce((s, k) => s + Number($(`[name="weight-${k}"]`).value), 0);
    $("#weight-summary").textContent = total
      ? `${((lore / total) * 100).toFixed(1)}% lore & fan connection · ${(100 - (lore / total) * 100).toFixed(1)}% performance, peak & longevity`
      : "Set at least one positive weight.";
  };
  $$('[name="mode"], [name^="weight-"]').forEach((x) => (x.oninput = update));
  update();
  $("#reset-weights").onclick = () => {
    FACTORS.forEach(([k, , v]) => ($(`[name="weight-${k}"]`).value = v));
    update();
  };
  $("#weights-form").onsubmit = (e) => {
    e.preventDefault();
    const mode = $('[name="mode"]:checked').value;
    const weights = Object.fromEntries(
      FACTORS.map(([k]) => [k, Number($(`[name="weight-${k}"]`).value)]),
    );
    if (
      mode === "lore" &&
      Object.values(weights).reduce((a, b) => a + b, 0) <= 0
    ) {
      toast("Set at least one positive weight.");
      return;
    }
    $("#modal").close();
    mutate(() => {
      b.mode = mode;
      if (mode === "lore") b.weights = weights;
    }, "Scoring lens saved. Your ranking order is unchanged.");
  };
}
function openGuide() {
  openModal(
    "The scoring guide",
    `<div class="modal-body guide"><h3>APEX 2.2 Test</h3><p>The performance view uses separate APEX-H, APEX-SP and APEX-RP boards calculated from Baseball-Reference bulk WAR records through the completed 2025 season. The 2026 season is a YTD companion and is not mixed into the test scores.</p><h3>Franchise 400 intake</h3><p>Every built-in player has at least three distinct franchise seasons. The search pool targets 220 position players, 105 starters and 75 relievers; swingmen fill the thinner pitching lane. Younger franchises may have fewer than 400 qualifying players, but the tenure rule is never weakened.</p><p>Position players qualify with 1.0 franchise WAR, 120 games, 350 PA, or 75 games caught. Starters qualify with 1.5 pitching WAR, 25 starts, 150 innings, or 15 wins. Relievers qualify with 0.5 relief WAR, 60 relief appearances, 15 saves, or 75 relief innings with a 105 ERA+. The bullpen intake index uses relief WAR, leverage adjustment, saves and innings because historical holds and complete WPA are not available in the bulk source.</p><p><strong>Discovery is not roster eligibility.</strong> The broad pool keeps useful specialists available for research. The Best 26 separately requires three franchise seasons plus 1,000 PA for regular position players, 750 PA for catchers and bench specialists, 300 starter IP, or 100 relief IP.</p><h3>APEX-H · position players</h3><div class="formula">g = clip((WAA + REP) / 0.75, 0, 1)<br>D = max(WAA, 0)^1.35 + 20% × max(REP, 0) × g</div><h3>APEX-SP · starting pitchers</h3><div class="formula">Cap starter work at 275 IP, then apply positive WAA^1.35 and gated replacement value.</div><h3>APEX-RP · relief pitchers</h3><div class="formula">Cap relief work at 120 IP. Positive leverage WAA is gated by positive core relief WAA before the 1.35 exponent.</div><p>Leverage cannot rescue a below-average season.</p><h3>Career formula</h3><div class="formula">APEX_R = 25% Peak3 + 35% Prime5 + 40% Career<br>APEX_F = APEX_R + 50% × APEX-Oct</div><p>Peak3 uses the three best seasons. Prime5 uses five calendar years; an interior run of one to three completely empty MLB years is removed if the player returned. Longer gaps are not stitched and partial seasons keep their actual value. APEX-Oct is signed and clipped; it is applied only when complete WPA and clutch evidence is saved.</p><h3>Position and era chapters</h3><p>A season enters a position chapter when at least 30% of its defensive or DH work occurred there, and only that share of D is credited. Official position eligibility requires 400 career games; era×position chapters require 150 games in that era. Modern (2020–2025) is labeled incomplete.</p><p><strong>October guardrail.</strong> Missing postseason evidence is N/A, never zero. Rings do not add points. Current built-in bulk profiles have no complete postseason WPA feed, so their APEX-F currently equals APEX_R.</p><h3>Collection, history and roster</h3><p>The Top 200 is an editable franchise collection, not one official cross-role leaderboard. The entire qualified pool stays searchable for catchers, defenders, left-handers and bullpen specialists. Historic moments and custom legacy notes stay separate from APEX. The 26-man builder enforces every role and allows one documented Legacy Legend to bypass only the workload minimum, never tenure or position fit.</p><h3>Keeping your work</h3><p>Download a JSON backup to protect franchise boards, player data, APEX values, rankings, rosters, moment edits and notes.</p></div>`,
    true,
  );
}
function openComparePicker() {
  openModal(
    "Choose your close call",
    `<div class="modal-body"><p class="help">Pick two or three candidates from ${esc(team()[1])}.</p><div class="picker">${
      board()
        .candidates.map(
          (c) =>
            `<label><input type="checkbox" value="${esc(c.id)}" ${compareIds.includes(c.id) ? "checked" : ""}><span><strong>${esc(c.name)}</strong><small>${esc(c.type)}</small></span></label>`,
        )
        .join("") || "<p>Add candidates to your board first.</p>"
    }</div></div><div class="modal-footer"><button class="primary" id="apply-compare">Compare candidates</button></div>`,
  );
  $$(".picker input").forEach(
    (x) =>
      (x.onchange = () => {
        if ($$(".picker input:checked").length > 3) {
          x.checked = false;
          toast("Choose up to three candidates.");
        }
      }),
  );
  $("#apply-compare").onclick = () => {
    const ids = $$(".picker input:checked").map((x) => x.value);
    if (ids.length < 2) {
      toast("Choose at least two candidates.");
      return;
    }
    compareIds = ids;
    tab = "players";
    playerView = "compare";
    $("#modal").close();
    render();
  };
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function backup() {
  download(
    `legacy-lore-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(state, null, 2),
    "application/json",
  );
  toast("Backup downloaded. Keep it somewhere safe.");
}
function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
function downloadList() {
  const b = board();
  const fields = [
    "Rank",
    "Name",
    "Type",
    "Role",
    "Nickname",
    "Era",
    "Tier",
    "Baseline",
    "Score",
    "Complete",
    "Why this rank",
    "Famous moments",
    "Graphic Easter eggs",
    "Research notes",
    "Sources",
    "Legacy story thread",
    "Linked history chapters",
    "Signature distinction",
    "Signature distinction source",
    ...LEGACY_FACTORS.flatMap(([k, n]) => [
      n + " rating",
      n + " reason",
      n + " source",
      n + " confidence",
    ]),
  ];
  const rows = rankedCandidates(b)
    .slice(0, 200)
    .map((c, i) => {
      const s = calculate(c, b.mode, b.weights);
      return [
        i + 1,
        c.name,
        c.type,
        c.role,
        c.nickname,
        c.era,
        c.tier,
        modeLabel(b.mode),
        s.value === null ? "" : s.value.toFixed(3),
        s.complete ? "Yes" : "No",
        c.rationale,
        c.moments,
        c.easterEggs,
        c.notes,
        c.sources,
        c.profile?.storyThread || "",
        (c.profile?.historyLinks || [])
          .map((id) => state.almanac.chapters.find((chapter) => chapter.id === id)?.title || id)
          .join("; "),
        c.legacy?.moment || "",
        c.legacy?.momentSource || "",
        ...LEGACY_FACTORS.flatMap(([k]) => [
          c.legacy?.ratings[k] ?? "",
          c.legacy?.evidence[k]?.reason || "",
          c.legacy?.evidence[k]?.source || "",
          c.legacy?.evidence[k]?.confidence || "needs-research",
        ]),
      ];
    });
  download(
    `legacy-lore-${state.selected}-top-200.csv`,
    "\uFEFF" +
      [fields, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
  toast("Top 200 exported with notes. Use JSON for a restorable backup.");
}
function openBackups() {
  openModal(
    "Keep your collection",
    `<div class="modal-body"><p>Your work saves to your account when connected. The status above shows pending saves or conflicts. A JSON backup includes all 30 franchises, player profiles, rosters, rankings, notes, story threads, and every Historical Almanac chapter.</p><div class="backup-actions"><button class="subtle" id="download-device-recovery">Download device recovery</button><button class="subtle" id="retry-cloud">Retry cloud save</button><button class="primary" id="download-backup">${icon("download")} Download full backup</button><button class="subtle" id="download-csv">Export current Top 200 · CSV</button></div><div class="import-box"><h3>Restore or move your workspace</h3><p class="help">Choose a Legacy Lore JSON backup. Review it before replacing the current workspace.</p><input id="import-file" type="file" accept=".json,application/json" aria-label="Import backup JSON"><div id="import-review" role="status"></div></div>${invalidStored ? '<div class="notice warning"><p>Your previous saved data could not be loaded. Download the raw data for recovery before using this fresh workspace.</p><button class="subtle" id="raw-recovery">Download recovery data</button><button class="subtle" id="use-fresh">Use this fresh workspace</button></div>' : ""}</div>`,
  );
  $("#download-device-recovery").onclick = () => {
    const raw = localStorage.getItem(cloud.recoveryKey);
    if (raw)
      download("legacy-lore-device-recovery.json", raw, "application/json");
    else toast("No separate device recovery was needed.");
  };
  $("#retry-cloud").onclick = () => cloud.retry();
  $("#download-backup").onclick = backup;
  $("#download-csv").onclick = downloadList;
  if ($("#raw-recovery"))
    $("#raw-recovery").onclick = () =>
      download(
        "legacy-lore-recovery.json",
        localStorage.getItem(KEY) || "",
        "application/json",
      );
  if ($("#use-fresh"))
    $("#use-fresh").onclick = () => {
      const raw = localStorage.getItem(KEY) || "";
      download("legacy-lore-recovery.json", raw, "application/json");
      invalidStored = false;
      persist();
      $("#modal").close();
      render();
    };
  $("#import-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10000000)
        throw Error("Backup exceeds the 10 MB import limit.");
      const raw = JSON.parse(await file.text());
      const checked = validateImport(raw);
      $("#import-review").innerHTML =
        `<div class="notice"><div><strong>Backup ready: ${checked.count} candidates across 30 franchise boards.</strong><p>This will replace your current workspace. A backup of the current workspace downloads first. You can also undo the import.</p><button class="primary" id="apply-import">Back up current & restore</button></div></div>`;
      $("#apply-import").onclick = () => {
        backup();
        $("#modal").close();
        invalidStored = false;
        mutate(() => {
          state = checked.state;
          migrateScoringState(state);
          compareIds = [];
          query = "";
          filter = "all";
        }, "Backup restored.");
      };
    } catch (err) {
      $("#import-review").innerHTML =
        `<p class="error">Import rejected: ${esc(err.message)}</p>`;
    }
  };
}
window.addEventListener("storage", (e) => {
  if (e.key === KEY + "-draft")
    toast(
      "Another tab is editing. Export any pending work before reloading cloud data.",
    );
});
const autoRankingUI = createAutoRankingUI({
  getBoard: board,
  getTeam: team,
  openModal,
  mutate,
  esc,
  toast,
  prepareEvidence: () => evidenceUI.open(),
});
const evidenceUI = createEvidenceUI({
  getBoard: board,
  getTeam: team,
  getState: () => state,
  openModal,
  mutate,
  esc,
  toast,
  onDone: () => autoRankingUI.open(),
});
const legendsUI = createLegendsUI({
  getBoard: board,
  getTeam: team,
  mutate,
  openModal,
  toast,
  esc,
  download,
  openEditor,
  prepareEvidence: () => evidenceUI.open(),
});
const bulkLookup = createBulkLookup({
  getBoard: board,
  getTeam: team,
  openModal,
  mutate,
  esc,
  toast,
});
const importUI = createImportUI({
  getBoard: board,
  getTeam: team,
  openModal,
  mutate,
  toast,
  esc,
  download,
  lookupPlayers: (ids) => bulkLookup.open(ids, true),
});
const historyUI = createHistoryUI({
  getState: () => state,
  getBoard: board,
  getTeam: team,
  mutate,
  openModal,
  toast,
  download,
  esc,
  openPlayer: openEditor,
});
$("#modal").addEventListener("close", () => render());
const cloud = createCloudSave({
  getState: () => state,
  onStatus: () => updateSave(),
  preserveLegacy: () => invalidStored,
});
const studioUI = createStudioUI({
  getBoard: board,
  getTeam: team,
  getState: () => state,
  mutate,
  openModal,
  esc,
  toast,
  download,
  openEditor,
  cloud,
});
$("#app").textContent = "Opening your Legacy Lore workspace…";
render();
state = await cloud.start(state);
const scoringMigrated = migrateScoringState(state);
let starterLoaded = false;
try {
  starterLoaded = await ensureStarterTeam(state.selected);
} catch (e) {
  storageIssue = e.message;
}
render();
if ((scoringMigrated || starterLoaded) && !invalidStored) persist();
