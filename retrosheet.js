const finite = (value) =>
  value !== null && value !== "" && Number.isFinite(Number(value))
    ? Number(value)
    : null;

export const retrosheetProfile = (candidate) =>
  candidate?.profile?.advancedStats?.retrosheet || null;

export function retrosheetPositionGames(candidate, position) {
  const value = finite(retrosheetProfile(candidate)?.positionUsage?.[position]?.games);
  return value === null ? null : value;
}

export function retrosheetPitchingWork(candidate) {
  const data = retrosheetProfile(candidate),
    regular = data?.pitching?.regular,
    bullpen = data?.bullpen;
  if (!regular && !bullpen) return null;
  return {
    games: finite(regular?.games) || 0,
    starts: finite(regular?.GS) || 0,
    starterInnings: (finite(regular?.startOuts) || 0) / 3,
    reliefGames: finite(bullpen?.reliefGames) || 0,
    reliefInnings: finite(bullpen?.reliefInnings) || 0,
    gamesFinished: finite(bullpen?.gamesFinished) || 0,
    saves: finite(bullpen?.saves) || 0,
    averageReliefOuts: finite(bullpen?.averageReliefOuts),
    finishRate: finite(bullpen?.finishRate),
  };
}

export function retrosheetRoleEvidence(candidate) {
  const work = retrosheetPitchingWork(candidate);
  if (!work || !work.reliefGames) return null;
  const throws = String(
    candidate?.profile?.throws || retrosheetProfile(candidate)?.throws || "",
  ).toUpperCase();
  let role = "Relief pitcher";
  if (work.saves >= 100 || work.finishRate >= 0.65) role = "Closer";
  else if (work.starts >= 10 && work.reliefGames >= 20) role = "Swingman / long relief";
  else if ((work.averageReliefOuts || 0) >= 5) role = "Multi-inning fireman";
  else if (throws === "L") role = "Left-handed relief";
  else if (work.finishRate >= 0.3) role = "Late-inning relief";
  else role = "Middle relief";
  return {
    role,
    detail: `${Math.round(work.reliefGames)} relief games · ${work.reliefInnings.toFixed(1)} relief IP · ${Math.round(work.gamesFinished)} games finished · ${Math.round(work.saves)} saves`,
    work,
  };
}

function innings(outs) {
  const value = Math.max(0, Number(outs) || 0);
  return `${Math.floor(value / 3)}.${value % 3}`;
}

const whole = (value) => Math.round(Number(value) || 0).toLocaleString();
const decimal = (value, digits = 1) =>
  value == null || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toFixed(digits);
const slash = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toFixed(3).replace(/^0/, "");

function metric(label, value) {
  return `<div><span>${label}</span><strong>${value}</strong></div>`;
}

function battingMetrics(line, opsPlus = null, compact = false) {
  if (!line || !(Number(line.b_pa) > 0)) return "";
  const items = compact
    ? [
        ["G", whole(line.games)],
        ["PA", whole(line.b_pa)],
        ["H", whole(line.b_h)],
        ["HR", whole(line.b_hr)],
        ["RBI", whole(line.b_rbi)],
        ["SB", whole(line.b_sb)],
        ["AVG", slash(line.AVG)],
        ["OPS", slash(line.OPS)],
      ]
    : [
        ["G", whole(line.games)],
        ["PA", whole(line.b_pa)],
        ["R", whole(line.b_r)],
        ["H", whole(line.b_h)],
        ["2B", whole(line.b_d)],
        ["3B", whole(line.b_t)],
        ["HR", whole(line.b_hr)],
        ["RBI", whole(line.b_rbi)],
        ["BB", whole(line.b_w)],
        ["SB", whole(line.b_sb)],
        ["AVG", slash(line.AVG)],
        ["OBP", slash(line.OBP)],
        ["SLG", slash(line.SLG)],
        ["OPS", slash(line.OPS)],
        ...(finite(opsPlus) === null ? [] : [["OPS+", decimal(opsPlus, 0)]]),
      ];
  return items.map(([label, value]) => metric(label, value)).join("");
}

function pitchingMetrics(line, eraPlus = null, compact = false) {
  if (!line || !(Number(line.p_ipouts) > 0)) return "";
  const items = compact
    ? [
        ["G", whole(line.games)],
        ["GS", whole(line.GS)],
        ["W-L", `${whole(line.W)}-${whole(line.L)}`],
        ["SV", whole(line.SV)],
        ["IP", innings(line.p_ipouts)],
        ["ERA", decimal(line.ERA, 2)],
        ["WHIP", decimal(line.WHIP, 2)],
        ["K", whole(line.p_k)],
      ]
    : [
        ["G", whole(line.games)],
        ["GS", whole(line.GS)],
        ["W-L", `${whole(line.W)}-${whole(line.L)}`],
        ["SV", whole(line.SV)],
        ["CG", whole(line.CG)],
        ["IP", innings(line.p_ipouts)],
        ["ERA", decimal(line.ERA, 2)],
        ["WHIP", decimal(line.WHIP, 2)],
        ["K", whole(line.p_k)],
        ["K/9", decimal(line.K9, 1)],
        ...(finite(eraPlus) === null ? [] : [["ERA+", decimal(eraPlus, 0)]]),
      ];
  return items.map(([label, value]) => metric(label, value)).join("");
}

function seasonSummary(item) {
  const batting = item.batting,
    pitching = item.pitching;
  if (batting && Number(batting.b_pa) >= Number(pitching?.p_bfp || 0))
    return `${whole(batting.games)} G · ${whole(batting.b_h)} H · ${whole(batting.b_hr)} HR · ${slash(batting.OPS)} OPS`;
  if (pitching)
    return `${whole(pitching.games)} G · ${whole(pitching.GS)} GS · ${innings(pitching.p_ipouts)} IP · ${decimal(pitching.ERA, 2)} ERA`;
  return "Franchise season";
}

function momentText(moment) {
  if (moment.type === "pitching") {
    const prefix = moment.shutout
      ? "Complete-game shutout"
      : moment.CG
        ? "Complete game"
        : moment.save
          ? "Save"
          : "Pitching performance";
    return `${prefix}: ${innings(moment.IPouts)} IP, ${moment.K} K, ${moment.ER} ER`;
  }
  return `${moment.H} H, ${moment.HR} HR, ${moment.RBI} RBI${moment.SB ? `, ${moment.SB} SB` : ""}`;
}

export function retrosheetEvidenceHTML(candidate, esc) {
  const data = retrosheetProfile(candidate);
  if (!data) return "";
  const positions = Object.entries(data.positionUsage || {})
      .slice(0, 5)
      .map(
        ([position, item]) =>
          `<div><strong>${esc(position)}</strong><span>${Math.round(item.games).toLocaleString()} G · ${Math.round(item.starts).toLocaleString()} starts · ${Number(item.innings).toLocaleString()} innings</span></div>`,
      )
      .join(""),
    role = retrosheetRoleEvidence(candidate),
    catcher = data.catcher,
    moments = [
      ...(data.moments?.postseason || []).map((item) => ({ ...item, group: "October" })),
      ...(data.moments?.regularSeason || []).map((item) => ({ ...item, group: "Regular season" })),
    ].slice(0, 6),
    confidence = data.confidence || {},
    advanced = candidate?.profile?.advancedStats || {},
    showBatting = advanced.primaryBoard === "H" || advanced.role === "BAT" || advanced.role === "TWO",
    showPitching = advanced.primaryBoard !== "H" || advanced.role === "TWO" || Number(data.pitching?.regular?.p_ipouts || 0) >= 150,
    careerBatting = showBatting ? battingMetrics(data.batting?.regular, advanced.OPSPlus) : "",
    careerPitching = showPitching ? pitchingMetrics(data.pitching?.regular, advanced.ERAPlus) : "",
    postseasonBatting = showBatting ? battingMetrics(data.batting?.postseason, null, true) : "",
    postseasonPitching = showPitching ? pitchingMetrics(data.pitching?.postseason, null, true) : "",
    yearly = [...(data.yearly || [])].reverse(),
    confidenceText =
      confidence.grade === "A"
        ? "Full play-by-play coverage"
        : confidence.grade === "B"
          ? "Mixed full, reconstructed and box-score coverage"
          : "Box-score evidence; play-by-play is incomplete";
  return `<section class="retrosheet-card"><div class="retrosheet-head"><div><span>FRANCHISE CAREER & RETROSHEET</span><strong>Career totals, seasons and game evidence</strong></div><b class="retro-grade grade-${esc(String(confidence.grade || "C").toLowerCase())}">${esc(confidence.grade || "C")} confidence</b></div><p class="retro-summary">${esc(confidenceText)} · ${Math.round(confidence.games || 0).toLocaleString()} documented franchise games through 2025.</p>${careerBatting ? `<div class="retrosheet-stat-section"><h4>Franchise batting career</h4><div class="retrosheet-stat-grid">${careerBatting}</div></div>` : ""}${careerPitching ? `<div class="retrosheet-stat-section"><h4>Franchise pitching career</h4><div class="retrosheet-stat-grid">${careerPitching}</div></div>` : ""}${finite(advanced.totalWAR) !== null || finite(advanced.WAA) !== null ? `<div class="retrosheet-advanced"><span>Advanced franchise value</span>${finite(advanced.totalWAR) !== null ? `<strong>${decimal(advanced.totalWAR, 1)} WAR</strong>` : ""}${finite(advanced.WAA) !== null ? `<strong>${decimal(advanced.WAA, 1)} WAA</strong>` : ""}<small>Baseball-Reference bulk data · official APEX remains separate</small></div>` : ""}${postseasonBatting || postseasonPitching ? `<details class="retrosheet-postseason"><summary>Postseason career totals</summary>${postseasonBatting ? `<div><h4>Batting</h4><div class="retrosheet-stat-grid compact">${postseasonBatting}</div></div>` : ""}${postseasonPitching ? `<div><h4>Pitching</h4><div class="retrosheet-stat-grid compact">${postseasonPitching}</div></div>` : ""}</details>` : ""}${yearly.length ? `<details class="retrosheet-seasons"><summary>Year-by-year franchise stats · ${yearly.length} seasons</summary><p class="help">Tap a year for its full franchise line.</p><div class="retro-season-list">${yearly
    .map((item) => {
      const batting = showBatting ? battingMetrics(item.batting, null, true) : "",
        pitching = showPitching ? pitchingMetrics(item.pitching, null, true) : "",
        positions = Object.entries(item.positions || {})
          .slice(0, 4)
          .map(([position, value]) => `${position} ${whole(value.games)} G`)
          .join(" · ");
      return `<details><summary><strong>${esc(item.year)}</strong><span>${esc(seasonSummary(item))}</span></summary>${positions ? `<p class="retro-season-positions">${esc(positions)}</p>` : ""}${batting ? `<div><h4>Batting</h4><div class="retrosheet-stat-grid compact">${batting}</div></div>` : ""}${pitching ? `<div><h4>Pitching</h4><div class="retrosheet-stat-grid compact">${pitching}</div></div>` : ""}</details>`;
    })
    .join("")}</div><a class="retro-player-link" href="${esc(data.playerUrl)}" target="_blank" rel="noopener">Open Retrosheet career page and yearly game logs</a></details>` : ""}${positions ? `<div class="retrosheet-positions">${positions}</div>` : ""}${role ? `<div class="retrosheet-role"><span>Roster role evidence</span><strong>${esc(role.role)}</strong><small>${esc(role.detail)}</small></div>` : ""}${catcher ? `<div class="retrosheet-catcher"><span>APEX-C supporting evidence</span><strong>${Math.round(catcher.workload?.games || 0).toLocaleString()} games caught · ${Number(catcher.workload?.innings || 0).toLocaleString()} innings</strong><small>${catcher.throwing?.aboveLeague == null ? "Throwing comparison N/A" : `${catcher.throwing.aboveLeague >= 0 ? "+" : ""}${(catcher.throwing.aboveLeague * 100).toFixed(1)} points versus American League caught-stealing rate`} · blocking ${catcher.blocking?.per1000Innings == null ? "N/A" : `${catcher.blocking.per1000Innings.toFixed(1)} events per 1,000 innings`}</small></div>` : ""}${moments.length ? `<details class="retrosheet-moments"><summary>Documented game highlights</summary><div>${moments
    .map(
      (moment) =>
        `<article><span>${esc(moment.group)} · ${esc(moment.round || "regular")}</span><strong>${esc(momentText(moment))}</strong><small>${esc(moment.label)}</small><a href="${esc(moment.url)}" target="_blank" rel="noopener">Open Retrosheet box score</a></article>`,
    )
    .join("")}</div></details>` : ""}<p class="retrosheet-credit">${esc(data.attribution)} Retrosheet evidence supports roster roles, APEX-C and game history. It does not change official APEX.</p></section>`;
}
