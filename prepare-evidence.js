import { requestJSON } from "./cloud-save.js";
import {
  resolveCandidate,
  fetchFranchise,
  mlbJSON,
  mergePlayerStats,
} from "./bulk-lookup.js";
import { awardsURL, franchiseHonors } from "./honors.js";
import { effectiveScope } from "./franchise-scope.js";
import {
  STAT_VERSION,
  scoringRows,
  principalRows,
  contextKey,
} from "./stat-context.js";
import { applyAutoScores } from "./legends.js";
import { loreDraft, applyLoreDraft } from "./lore-autofill.js";
import {
  APEX_ROLE_FORMULA_VERSION,
  applyApexOctoberEvidence,
} from "./apex-formula.js";
export async function prepareEvidence(
  candidate,
  team,
  studio,
  { signal, progress = () => {}, includeLore = true } = {},
) {
  let c = structuredClone(candidate),
    issues = [],
    retryAfter = 0;
  const scope = effectiveScope(team, studio);
  const alive = () => {
    if (signal?.aborted) throw new DOMException("Paused", "AbortError");
  };
  if (c.type === "Player") {
    const savedAdvanced = c.profile.advancedStats,
      needsCurrentFormula =
        savedAdvanced?.formulaVersion !== APEX_ROLE_FORMULA_VERSION;
    if (
      !savedAdvanced ||
      savedAdvanced.version !== STAT_VERSION ||
      !Number.isFinite(Number(savedAdvanced.APEX_R)) ||
      needsCurrentFormula
    ) {
      try {
        progress("Loading advanced franchise value");
        const adv = await requestJSON(
          "/api/advanced-stats?team=" +
            team +
            "&name=" +
            encodeURIComponent(c.name) +
            "&from=" +
            scope.from +
            "&to=" +
            scope.to,
          { signal },
        );
        alive();
        if (adv?.found) {
          c.profile.advancedStats = {
            ...savedAdvanced,
            ...adv,
            positionBoards:
              adv.positionBoards || savedAdvanced?.positionBoards || {},
            eraChapters:
              adv.eraChapters || savedAdvanced?.eraChapters || {},
          };
          if (savedAdvanced?.apexOctoberEvidence)
            c.profile.advancedStats = applyApexOctoberEvidence(
              c.profile.advancedStats,
              savedAdvanced.apexOctoberEvidence,
            );
        }
      } catch (e) {
        alive();
        issues.push("Advanced stats: " + e.message);
      }
    }
    if (!c.statImports?.length) {
      progress("Matching player and franchise stats");
      const match = c.profile.mlbId
        ? { id: c.profile.mlbId, fullName: c.name }
        : (await resolveCandidate(c.name, mlbJSON, signal)).automatic;
      alive();
      if (match) {
        const tables = await fetchFranchise(
          match,
          team,
          scope.from,
          scope.to,
          mlbJSON,
          signal,
        );
        c = mergePlayerStats(c, tables, match, false);
        c.profile.mlbId = match.id;
      } else issues.push("Name needs a confirmed MLB match.");
    }
    const rows = principalRows(c);
    if (
      rows.length &&
      rows.every((r) => r.year >= scope.from && r.year <= scope.to)
    ) {
      const key = contextKey(rows);
      if (
        c.profile.statContext?.key !== key ||
        c.profile.statContext?.version !== STAT_VERSION
      ) {
        const seasons = [];
        try {
          for (let i = 0; i < rows.length; i += 6) {
            alive();
            progress(
              `Comparing roles and eras: seasons ${i + 1}–${Math.min(rows.length, i + 6)} / ${rows.length}`,
            );
            const data = await requestJSON("/api/scoring-context", {
              method: "POST",
              body: JSON.stringify({ rows: rows.slice(i, i + 6) }),
              signal,
            });
            seasons.push(...data.seasons);
          }
          alive();
          c.profile.statContext = {
            version: STAT_VERSION,
            key,
            seasons,
            at: new Date().toISOString(),
          };
          if (seasons.some((r) => !r))
            issues.push(
              "Some seasons lack enough peer data or a known pitching role.",
            );
        } catch (e) {
          alive();
          issues.push("Statistical context: " + e.message);
        }
      }
    } else if (rows.length)
      issues.push(
        "Saved stats extend outside the selected years. Reimport this scope before scoring.",
      );
    else issues.push("No usable OPS/PA or ERA/IP/G/GS season rows.");
    c = applyAutoScores(c);
    if (includeLore && c.profile.mlbId) {
      try {
        progress("Checking franchise honors");
        c.profile.awards = franchiseHonors(
          await mlbJSON(awardsURL(c.profile.mlbId), signal),
          team,
          scope.from,
          scope.to,
        );
      } catch (e) {
        alive();
        issues.push("Honors: " + e.message);
      }
    }
  }
  if (includeLore) {
    try {
      progress("Finding attributed stories and nicknames");
      const r = await requestJSON(
        "/api/research?name=" +
          encodeURIComponent(c.name) +
          `&team=${team}&from=${scope.from}&to=${scope.to}`,
        { signal },
      );
      alive();
      if (r.needsReview)
        issues.push(
          "Biography needs a confirmed identity. Use Read sources & rate.",
        );
      else c.profile.research = r;
    } catch (e) {
      alive();
      issues.push("Biography: " + e.message);
      if (e.status === 429)
        retryAfter = Math.max(60, Number(e.retryAfter) || 60);
    }
    c = applyLoreDraft(c, loreDraft(c, team, studio));
  }
  c.profile.preparation = {
    at: new Date().toISOString(),
    issues,
    retryAfter,
    version: STAT_VERSION,
    from: scope.from,
    to: scope.to,
  };
  return c;
}
export function migrateScoringState(state) {
  let changed = false;
  for (const b of Object.values(state.boards)) {
    if (b.studio.scoringVersion === STAT_VERSION) continue;
    for (const c of b.candidates) {
      const outdated = Object.entries(c.autoScores || {}).filter(
        ([, v]) => v.version !== STAT_VERSION,
      );
      if (outdated.length) {
        c.profile.retiredStatEstimates = {
          at: new Date().toISOString(),
          values: Object.fromEntries(outdated),
        };
        for (const [key, a] of outdated) {
          if (c.scores[key] === a.value) c.scores[key] = null;
          delete c.autoScores[key];
        }
      }
    }
    if (b.studio.lastAutoRanking?.lens === "stats")
      b.studio.lastAutoRanking.retired = true;
    b.mode = "apex";
    b.studio.scoringVersion = STAT_VERSION;
    b.studio.scoringNotice = true;
    changed = true;
  }
  return changed;
}
