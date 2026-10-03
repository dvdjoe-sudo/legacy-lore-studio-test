export const APEX_ROLE_FORMULA_VERSION = "APEX 2.2 Test · 2026-09-29";
export const PITCHER_FORMULA_VERSION = APEX_ROLE_FORMULA_VERSION;
export const PITCHER_SP_IP_CAP = 275;
export const PITCHER_RP_IP_CAP = 120;
export const PITCHER_IP_CAP = PITCHER_SP_IP_CAP;
export const APEX_CAREER_WEIGHTS = [0.25, 0.35, 0.4];
export const APEX_OCTOBER_WEIGHT = 0.5;

const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const clamp01 = (value) => Math.max(0, Math.min(1, finite(value)));
const optionalNumber = (value) =>
  value !== null && value !== "" && Number.isFinite(Number(value))
    ? Number(value)
    : null;

export function apexOctober({ wpa = null, clutch = null, complete = false } = {}) {
  const W = optionalNumber(wpa),
    C = optionalNumber(clutch);
  if (!complete || W === null || C === null)
    return {
      complete: false,
      raw: null,
      contribution: null,
      status: "unknown-not-zero",
    };
  const raw =
    0.6 * Math.max(-6, Math.min(14, W)) +
    0.25 * Math.max(-4, Math.min(8, C));
  return {
    complete: true,
    raw,
    contribution: APEX_OCTOBER_WEIGHT * raw,
    status: "available",
  };
}

export function apexFranchiseScore(regularScore, october = {}) {
  const regular = finite(regularScore),
    contribution = optionalNumber(october?.contribution);
  return october?.complete && contribution !== null
    ? regular + contribution
    : regular;
}

export function applyApexOctoberEvidence(advancedStats, evidence = {}) {
  if (!advancedStats || typeof advancedStats !== "object") return advancedStats;
  const complete = evidence.complete === true,
    october = apexOctober({
      wpa: evidence.wpa,
      clutch: evidence.clutch,
      complete,
    }),
    next = structuredClone(advancedStats),
    source = typeof evidence.source === "string" ? evidence.source.trim() : "";
  next.apexOctoberEvidence = {
    wpa: optionalNumber(evidence.wpa),
    clutch: optionalNumber(evidence.clutch),
    complete: october.complete,
    source,
    checkedAt:
      typeof evidence.checkedAt === "string" ? evidence.checkedAt : "",
  };
  next.APEX_OCT = october.raw;
  next.APEX_OCT_CONTRIBUTION = october.contribution;
  next.APEX_F = apexFranchiseScore(next.APEX_R, october);
  next.postseasonIncluded = october.complete;
  next.postseasonStatus = october.status;
  for (const lane of Object.values(next.apexBoards || {})) {
    lane.APEX_OCT = october.raw;
    lane.APEX_OCT_CONTRIBUTION = october.contribution;
    lane.APEX_F = apexFranchiseScore(lane.APEX_R, october);
    lane.postseasonIncluded = october.complete;
    lane.postseasonStatus = october.status;
  }
  return next;
}

export function hitterSeasonDominance({ waa = 0, rep = 0 } = {}) {
  const W = finite(waa),
    R = Math.max(finite(rep), 0),
    V = W + R,
    g = Math.max(0, Math.min(1, V / 0.75));
  return Math.max(W, 0) ** 1.35 + 0.2 * R * g;
}

export const legacySeasonDominance = hitterSeasonDominance;

export function pitcherSeasonDominance({
  waa = 0,
  rep = 0,
  ip = 0,
  waaAdj = 0,
  leverage = false,
  role = leverage ? "RP" : "SP",
  ipCap = role === "RP" ? PITCHER_RP_IP_CAP : PITCHER_SP_IP_CAP,
} = {}) {
  const innings = Math.max(0, finite(ip));
  if (innings <= 0) return { D: 0, k: 1, g: 0, WAA_CAP: 0, REP_CAP: 0 };
  const k = Math.min(1, Math.max(0, finite(ipCap)) / innings),
    waaCap = finite(waa) * k,
    repCap = Math.max(0, finite(rep) * k),
    Xcore = Math.max(waaCap, 0),
    leverageValue =
      leverage && waaCap > 0
        ? Math.max(finite(waaAdj) * k, 0) * (Xcore / (Xcore + 1))
        : 0,
    X = Xcore + leverageValue,
    g = X > 0 ? X / (X + 1) : 0;
  return {
    D: X > 0 ? X ** 1.35 + 0.2 * repCap * g : 0,
    k,
    g,
    WAA_CAP: waaCap,
    REP_CAP: repCap,
    X_CORE: Xcore,
    LEVERAGE: leverageValue,
  };
}

export function primeGapYears(seasons = []) {
  const played = [...new Set(seasons.map((row) => Number(row.year)).filter(Number.isFinite))].sort(
    (a, b) => a - b,
  );
  const skipped = [];
  for (let i = 1; i < played.length; i++) {
    const gap = played[i] - played[i - 1] - 1;
    if (gap >= 1 && gap <= 3)
      for (let year = played[i - 1] + 1; year < played[i]; year++) skipped.push(year);
  }
  return skipped;
}

export function pitchingStintAllocation(row = {}) {
  const outs = Math.max(0, finite(row.IPouts));
  if (!outs)
    return {
      positiveIP: false,
      starterShare: 0,
      splitSource: "none",
      mixedRole: false,
      spOuts: 0,
      rpOuts: 0,
      spWAA: 0,
      rpWAA: 0,
      spREP: 0,
      rpREP: 0,
      rpWAAAdj: 0,
    };
  const startOuts = Math.max(0, finite(row.IPouts_start)),
    reliefOuts = Math.max(0, finite(row.IPouts_relief)),
    hasInningsSplit = startOuts + reliefOuts > 0,
    games = Math.max(0, finite(row.G)),
    starts = Math.max(0, finite(row.GS)),
    starterShare = hasInningsSplit
      ? clamp01(startOuts / outs)
      : games > 0
        ? clamp01(starts / games)
        : 0,
    waa = finite(row.WAA),
    rep = finite(row.WAR_rep);
  return {
    positiveIP: true,
    starterShare,
    splitSource: hasInningsSplit ? "innings" : "gs-g-fallback",
    mixedRole: starterShare > 0 && starterShare < 1,
    spOuts: outs * starterShare,
    rpOuts: outs * (1 - starterShare),
    spWAA: waa * starterShare,
    rpWAA: waa * (1 - starterShare),
    spREP: rep * starterShare,
    rpREP: rep * (1 - starterShare),
    rpWAAAdj: finite(row.WAA_adj),
  };
}

export function apexCareer(
  seasons,
  {
    dKey = "D",
    weights = APEX_CAREER_WEIGHTS,
    missingYearsZero = true,
    excludedPrimeYears,
  } = {},
) {
  const ordered = [...seasons].sort((a, b) => a.year - b.year),
    values = ordered.map((row) => Math.max(0, finite(row[dKey]))),
    Peak3 = [...values]
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((a, b) => a + b, 0),
    excluded = new Set(excludedPrimeYears ?? primeGapYears(ordered));
  let Prime5 = 0;
  if (ordered.length) {
    const byYear = new Map(
        ordered.map((row) => [row.year, Math.max(0, finite(row[dKey]))]),
      ),
      first = ordered[0].year,
      last = ordered.at(-1).year;
    if (missingYearsZero) {
      const timeline = [];
      for (let year = first; year <= last; year++)
        if (!excluded.has(year))
          timeline.push({ year, value: byYear.get(year) || 0 });
      if (timeline.length < 5)
        timeline.push(
          ...Array.from({ length: 5 - timeline.length }, () => ({
            year: null,
            value: 0,
          })),
        );
      for (let start = 0; start <= timeline.length - 5; start++)
        Prime5 = Math.max(
          Prime5,
          timeline
            .slice(start, start + 5)
            .reduce((sum, row) => sum + row.value, 0),
        );
    } else {
      for (let start = first; start <= last - 4; start++) {
        const window = [0, 1, 2, 3, 4].map((offset) =>
          byYear.get(start + offset),
        );
        if (window.every((value) => value !== undefined))
          Prime5 = Math.max(
            Prime5,
            window.reduce((a, b) => a + b, 0),
          );
      }
    }
  }
  const Career = values.reduce((a, b) => a + b, 0),
    score = weights[0] * Peak3 + weights[1] * Prime5 + weights[2] * Career;
  return { Peak3, Prime5, Career, Reign: Career, score };
}

export function roleSeparatedPitchingCareer(seasons, role) {
  const relief = role === "RP",
    dKey = relief ? "DRP" : "DSP";
  const rows = seasons.map((row) => {
    const ip = Math.max(0, finite(relief ? row.rpOuts : row.spOuts)) / 3,
      calc = pitcherSeasonDominance({
        waa: relief ? row.rpWAA : row.spWAA,
        rep: relief ? row.rpREP : row.spREP,
        ip,
        waaAdj: relief ? row.rpWAAAdj : 0,
        leverage: relief,
        role,
      });
    return { ...row, [dKey]: calc.D, roleIP: ip, roleK: calc.k };
  });
  const career = apexCareer(rows, { dKey });
  return {
    ...career,
    APEX_R: career.score,
    IP: rows.reduce((sum, row) => sum + row.roleIP, 0),
    cappedSeasons: rows.filter((row) => row.roleK < 1).length,
    minimumWorkloadRetained: rows.reduce(
      (minimum, row) => Math.min(minimum, row.roleK),
      1,
    ),
  };
}

export function estimatedRoleApex(seasons, role, playerName = "") {
  const rows = seasons.map((row) => {
    if (
      row.spWAA !== undefined ||
      row.rpWAA !== undefined ||
      row.spOuts !== undefined ||
      row.rpOuts !== undefined
    )
      return row;
    const total = Math.max(0, finite(row.IPouts)),
      spOuts = Math.max(0, finite(row.startOuts)),
      rpOuts = Math.max(0, finite(row.reliefOuts)),
      spShare = total ? clamp01(spOuts / total) : 0,
      rpShare = total ? clamp01(rpOuts / total) : 0;
    return {
      ...row,
      spOuts,
      rpOuts,
      spWAA: finite(row.pitchWAA) * spShare,
      rpWAA: finite(row.pitchWAA) * rpShare,
      spREP: finite(row.pitchREP) * spShare,
      rpREP: finite(row.pitchREP) * rpShare,
      rpWAAAdj: finite(row.pitchWAAAdj),
    };
  });
  const result = roleSeparatedPitchingCareer(rows, role, playerName);
  return {
    score: result.score,
    Peak3: result.Peak3,
    Prime5: result.Prime5,
    Career: result.Career,
    Reign: result.Career,
    IP: result.IP,
    approximation: true,
    reason:
      "Role WAA and replacement value are estimated from starter/relief innings share; mixed-role exposure and GS/G fallback are flagged.",
  };
}
