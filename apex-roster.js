import { retrosheetRoleEvidence } from "./retrosheet.js";

export const APEX_ROSTER_MODULE_VERSION =
  "APEX 2.1 Franchise Roster Module · 2026-09-21";

const FIELD_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const OUTFIELD = ["LF", "CF", "RF"];
const INFIELD = ["2B", "3B", "SS"];

const finite = (value) =>
  value !== null && value !== "" && Number.isFinite(Number(value))
    ? Number(value)
    : null;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const advanced = (candidate) => candidate?.profile?.advancedStats || null;

export function franchiseApex(candidate, lane = "") {
  const stats = advanced(candidate);
  if (!stats || stats.found === false) return null;
  const code = lane || stats.primaryBoard || (stats.role === "SP" ? "SP" : stats.role === "RP" ? "RP" : "H"),
    board = stats.apexBoards?.[code],
    value = finite(
      board?.APEX_F ??
        board?.APEX_R ??
        (code === stats.primaryBoard ? stats.APEX_F ?? stats.APEX_R : null),
    );
  if (value === null) return null;
  return {
    code,
    label: `Franchise APEX-${code}`,
    value,
    Peak3: finite(board?.Peak3 ?? board?.Apex ?? stats.Apex),
    Prime5: finite(board?.Prime5 ?? board?.Prime ?? stats.Prime),
    Career: finite(board?.Career ?? board?.Reign ?? stats.Career ?? stats.Reign),
    eligible: board?.eligible !== false,
    rank: Number.isFinite(Number(board?.rank)) ? Number(board.rank) : null,
    detail: "Only seasons credited to this franchise. APEX 2.2 Test favors peak and prime; complete October evidence may add a signed half-strength adjustment.",
  };
}

export function rosterPosition(candidate, position) {
  const stats = advanced(candidate);
  if (!stats) return null;
  if (position === "SP" || position === "RP") {
    const result = franchiseApex(candidate, position);
    return result
      ? {
          ...result,
          position,
          games: null,
          status: result.eligible ? "official" : "limited",
          label: `RosterPos ${position}`,
        }
      : null;
  }
  const board = stats.positionBoards?.[position],
    value = finite(board?.APEX_R),
    games = finite(board?.games ?? stats.positionGames?.[position]);
  if (value === null && (!games || games <= 0)) return null;
  return {
    position,
    label: `RosterPos ${position}`,
    value,
    games,
    Peak3: finite(board?.Peak3),
    Prime5: finite(board?.Prime5),
    Career: finite(board?.Career),
    rank: Number.isFinite(Number(board?.rank)) ? Number(board.rank) : null,
    status: board?.eligible
      ? "official"
      : board?.alsoQualified || (games || 0) >= 150
        ? "also-qualified"
        : "limited",
    detail:
      value === null
        ? "Position experience is recorded, but a position-earned APEX slice is not available."
        : "Only franchise value earned during seasons with meaningful work at this position.",
  };
}

function positionWork(candidate) {
  const games = advanced(candidate)?.positionGames || {},
    rows = FIELD_POSITIONS.map((position) => [position, Math.max(0, finite(games[position]) || 0)])
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]),
    teamGames = Number(advanced(candidate)?.G) || 0,
    fieldTotal = rows.reduce((sum, [, value]) => sum + value, 0),
    mostPlayed = rows[0]?.[0] || null,
    denominator = teamGames > 0 ? teamGames : fieldTotal,
    // DH rule 6 (current): 25%+ of team games, or the most-played spot,
    // with a 50-game floor so cameos never count. Falls back to share of
    // field work when team games are missing.
    meaningful = rows.filter(
      ([position, value]) => value >= 50 && (position === mostPlayed || (denominator > 0 && value / denominator >= 0.25)),
    );
  return { rows, meaningful, total: fieldTotal, high: rows[0]?.[1] || 0 };
}

export function versatilityCompanion(candidate) {
  const stats = advanced(candidate);
  if (!stats || ["SP", "RP"].includes(stats.role)) return null;
  const { meaningful, total, high } = positionWork(candidate),
    secondary = meaningful.slice(1),
    secondaryGames = secondary.reduce((sum, [, games]) => sum + games, 0),
    score = secondary.length
      ? clamp(
          30 * Math.min(1, secondary.length / 3) +
            40 * (secondaryGames / Math.max(1, total)) +
            30 * Math.min(1, secondaryGames / 400),
          0,
          100,
        )
      : 0;
  return {
    label: "APEX-V",
    value: Math.round(score * 10) / 10,
    positions: meaningful.map(([position]) => position),
    primary: meaningful[0]?.[0] || null,
    secondaryGames,
    detail: secondary.length
      ? `${secondary.length + 1} meaningful positions; ${Math.round(secondaryGames)} games beyond the primary position.`
      : high
        ? "No second position meets the meaningful franchise-work threshold."
        : "No position workload is available.",
  };
}

export function catcherDefenseCompanion(candidate) {
  const stats = advanced(candidate),
    games = Math.max(0, finite(stats?.positionGames?.C) || 0);
  if (!stats || games < 75) return null;
  const profile = stats.catcherDefense,
    manual = finite(candidate?.profile?.defenseEvidence?.rating);
  if (!profile)
    return {
      label: "APEX-C",
      value: null,
      Peak3: null,
      Prime5: null,
      Career: null,
      games,
      confidence: "low",
      detail: "Catcher workload is known, but season-level defensive evidence is unavailable. Missing data is N/A, not zero.",
      framing: { value: null, status: "N/A" },
      manual: manual === null ? null : candidate.profile.defenseEvidence,
    };
  const seasons = Array.isArray(profile.seasons) ? profile.seasons : [],
    throwingRows = seasons.filter(
      (row) =>
        finite(row.throwing?.CS) !== null &&
        finite(row.throwing?.SB) !== null &&
        finite(row.throwing?.leagueCaughtStealingPct) !== null,
    ),
    chances = throwingRows.reduce(
      (sum, row) => sum + finite(row.throwing.CS) + finite(row.throwing.SB),
      0,
    ),
    caught = throwingRows.reduce((sum, row) => sum + finite(row.throwing.CS), 0),
    leagueCaught = throwingRows.reduce((sum, row) => {
      const opportunities = finite(row.throwing.CS) + finite(row.throwing.SB);
      return sum + opportunities * finite(row.throwing.leagueCaughtStealingPct);
    }, 0),
    blockingRows = seasons.filter(
      (row) =>
        finite(row.innings) !== null &&
        finite(row.blocking?.per1000Innings) !== null &&
        finite(row.blocking?.leaguePer1000Innings) !== null,
    ),
    blockingInnings = blockingRows.reduce((sum, row) => sum + finite(row.innings), 0),
    blockingEvents = blockingRows.reduce(
      (sum, row) =>
        sum + (finite(row.blocking.PB) || 0) + (finite(row.blocking.WP) || 0),
      0,
    ),
    expectedBlockingEvents = blockingRows.reduce(
      (sum, row) =>
        sum + (finite(row.blocking.leaguePer1000Innings) * finite(row.innings)) / 1000,
      0,
    );
  return {
    label: "APEX-C",
    value: finite(profile.Prime5),
    Peak3: finite(profile.Peak3),
    Peak3Years: profile.Peak3Years || [],
    Prime5: finite(profile.Prime5),
    Prime5Years: profile.Prime5Years || [],
    Career: finite(profile.Career),
    workload: profile.workload || { games },
    coverage: profile.coverage || {},
    confidence: ["high", "medium", "low"].includes(profile.confidence)
      ? profile.confidence
      : "low",
    throwing: {
      caughtStealingPct: finite(profile.throwing?.caughtStealingPct) ??
        (chances ? caught / chances : null),
      leagueCaughtStealingPct: finite(profile.throwing?.leagueCaughtStealingPct) ??
        (chances ? leagueCaught / chances : null),
      aboveLeague: finite(profile.throwing?.aboveLeague) ??
        (chances ? (caught - leagueCaught) / chances : null),
      seasons: Number(profile.throwing?.seasons) || throwingRows.length,
    },
    blocking: {
      per1000Innings: finite(profile.blocking?.per1000Innings) ??
        (blockingInnings ? (blockingEvents * 1000) / blockingInnings : null),
      leaguePer1000Innings: finite(profile.blocking?.leaguePer1000Innings) ??
        (blockingInnings ? (expectedBlockingEvents * 1000) / blockingInnings : null),
      seasons: Number(profile.blocking?.seasons) || blockingRows.length,
    },
    framing: profile.framing || { value: null, status: "N/A · not measured in the bulk source" },
    manual: manual === null ? null : candidate.profile.defenseEvidence,
    source: profile.retrosheetEvidence
      ? "Baseball-Reference run prevention plus separate Retrosheet game-log evidence"
      : "one era-appropriate Baseball-Reference fielding-runs system per season",
    detail: `C-Peak3, C-Prime5 and C-Career use one non-overlapping run-prevention value per catching season. Throwing and blocking remain separate evidence.${profile.retrosheetEvidence ? " Retrosheet supplies workload, throwing and blocking game logs." : ""} Confidence: ${profile.confidence}.`,
  };
}

export function dataConfidenceGrade(candidate) {
  const stats = advanced(candidate);
  if (!stats || stats.found === false)
    return { grade: "C", label: "C · sparse", detail: "No complete franchise APEX profile is saved." };
  const from = finite(stats.from),
    roleReconstructed = stats.role === "SP" || stats.role === "RP",
    fallback = Boolean(stats.gsFallbackUsed);
  if ((from !== null && from < 1901) || fallback)
    return {
      grade: "C",
      label: "C · limited",
      detail: fallback
        ? "Starter/relief usage required a GS/G fallback and needs historical review."
        : "Nineteenth-century fielding and role measurement is materially incomplete.",
    };
  if ((from !== null && from < 1954) || roleReconstructed)
    return {
      grade: "B",
      label: "B · contextual",
      detail: `${from !== null && from < 1954 ? "Early fielding records require era context. " : ""}${roleReconstructed ? "Pitching value is allocated between starting and relief work from recorded usage." : ""}`.trim(),
    };
  return {
    grade: "A",
    label: "A · strong",
    detail: `Complete franchise regular-season value through ${stats.through || 2025}${Number(stats.to) >= Number(stats.through || 2025) ? "; active career may change" : ""}.`,
  };
}

export function octoberCompanion(candidate) {
  const stats = advanced(candidate),
    value = finite(stats?.apexOct ?? stats?.APEX_OCT),
    contribution = finite(stats?.APEX_OCT_CONTRIBUTION),
    evidence = stats?.apexOctoberEvidence;
  return value === null
    ? {
        label: "APEX-Oct",
        value: null,
        status: "unknown-not-zero",
        detail: "Postseason remains a separate signed companion. Add verified career WPA and Clutch on the player card to calculate it.",
      }
    : {
        label: "APEX-Oct",
        value,
        contribution,
        status: "available",
        source: evidence?.source || "",
        detail: `Signed postseason companion. Half-strength APEX-F contribution: ${contribution >= 0 ? "+" : ""}${contribution.toFixed(2)}${evidence?.checkedAt ? `; verified ${evidence.checkedAt.slice(0, 10)}` : ""}.`,
      };
}

export function pitcherRoleProfile(candidate) {
  const stats = advanced(candidate);
  if (!stats || !["SP", "RP"].includes(stats.role)) return null;
  const retro = retrosheetRoleEvidence(candidate);
  if (retro)
    return {
      label: "Pitcher role · Retrosheet",
      role: retro.role,
      detail: retro.detail,
    };
  const preference = String(candidate?.profile?.rosterRole || ""),
    saves = Math.max(0, finite(stats.SV) || 0),
    reliefIP = Math.max(0, finite(stats.reliefIP) || 0),
    startIP = Math.max(0, finite(stats.startIP) || 0),
    throws = String(candidate?.profile?.throws || stats.throws || "").toUpperCase();
  let role = "Relief pitcher";
  if (preference === "closer" || saves >= 100) role = "Closer";
  else if (preference === "setup") role = "Setup relief";
  else if (preference === "middle") role = "Middle relief";
  else if (preference === "left-specialist") role = "Left-handed specialist";
  else if (preference === "long" || preference === "swing" || (startIP >= 200 && reliefIP >= 100)) role = "Long relief / swingman";
  else if (stats.role === "SP") role = "Starting pitcher";
  else if (throws === "L") role = "Left-handed relief";
  return {
    label: "Pitcher role",
    role,
    detail: `${Math.round(saves)} SV · ${reliefIP.toFixed(0)} relief IP · ${startIP.toFixed(0)} starter IP${throws ? ` · throws ${throws}` : ""}`,
  };
}

function bestPositionMetric(candidate, positions) {
  const choices = positions
    .map((position) => rosterPosition(candidate, position))
    .filter((item) => item && item.value !== null)
    .sort((a, b) => b.value - a.value);
  return choices[0] || null;
}

export function rosterMetric(candidate, slot) {
  if (/^SP\d+$/.test(slot)) return rosterPosition(candidate, "SP");
  if (["CL", "SU1", "SU2", "MR1", "MR2", "LHS", "LR"].includes(slot))
    return rosterPosition(candidate, "RP") || rosterPosition(candidate, "SP");
  // Field positions draft on overall franchise hitting value (H-lane), not
  // the position-specific slice. The slice penalizes great hitters who split
  // time (Stargell 1B/LF) and rewards mediocre full-timers (Fletcher).
  // Eligibility (Rule 6) already ensures meaningful experience at the
  // position; among the eligible, the best hitter plays. (Same principle as
  // the DH fix. rosterPosition keeps the slice for display.)
  if (FIELD_POSITIONS.includes(slot)) return franchiseApex(candidate, "H");
  if (slot === "C2") return rosterPosition(candidate, "C");
  if (slot === "UTIL") {
    const versatility = versatilityCompanion(candidate);
    return versatility
      ? { label: "APEX-V", value: versatility.value, detail: versatility.detail }
      : null;
  }
  if (slot === "OF4") return bestPositionMetric(candidate, OUTFIELD);
  if (slot === "CI") return bestPositionMetric(candidate, ["1B", "3B"]);
  if (slot === "DH") {
    // DH is a pure batting role: the vestigial DH position slice (usually ~0)
    // misleads both the dropdown display and override comparisons, so the
    // slot always compares on overall franchise hitting value. The draft
    // itself still prefers a true DH first, then the best power bat.
    return franchiseApex(candidate, "H");
  }
  if (slot === "PH") return franchiseApex(candidate, "H");
  return franchiseApex(candidate);
}

export function rosterModule(candidate) {
  const stats = advanced(candidate),
    primary = stats?.primaryBoard || (stats?.role === "SP" ? "SP" : stats?.role === "RP" ? "RP" : "H"),
    mainPosition = stats?.positions?.find((position) => FIELD_POSITIONS.includes(position)) || null;
  return {
    version: APEX_ROSTER_MODULE_VERSION,
    franchise: franchiseApex(candidate, primary),
    rosterPos: mainPosition
      ? rosterPosition(candidate, mainPosition)
      : primary === "SP" || primary === "RP"
        ? rosterPosition(candidate, primary)
        : null,
    versatility: versatilityCompanion(candidate),
    catcher: catcherDefenseCompanion(candidate),
    confidence: dataConfidenceGrade(candidate),
    october: octoberCompanion(candidate),
    pitcherRole: pitcherRoleProfile(candidate),
  };
}
