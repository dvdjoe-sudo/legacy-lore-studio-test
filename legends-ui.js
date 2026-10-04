import { rankedCandidates } from "./workspace-extra.js";
import {
  rosterChecks,
  rosterNextStep,
  rosterRulesHTML,
} from "./roster-rules.js";
import { teamTheme, teamLogo } from "./team-theme.js";
import {
  APEX_ROSTER_MODULE_VERSION,
  rosterMetric,
  rosterModule,
} from "./apex-roster.js";
import {
  AUTO_KEYS,
  SLOTS,
  BULLPEN_SLOTS,
  BENCH_SLOTS,
  newRoster,
  cleanRoster,
  draftRoster,
  assignSlot,
  suggestScores,
  applyAutoScores,
  statStrip,
  positions,
  slotCandidates,
  slotShortlist,
  slotFitLabel,
  slotFitExplanation,
  eligibleForSlot,
  rosterEligibility,
  lineupOrderNote,
  detectPositionBattles,
} from "./legends.js";
export function createLegendsUI({
  getBoard,
  getTeam,
  mutate,
  openModal,
  toast,
  esc,
  download,
  openEditor,
  prepareEvidence,
}) {
  const $ = (q) => document.querySelector(q),
    $$ = (q) => [...document.querySelectorAll(q)],
    expandedSlots = new Set();
  const roster = () => cleanRoster(getBoard().roster, getBoard().candidates);
  const candidate = (id) => getBoard().candidates.find((c) => c.id === id);
  const managerOptions = (b, r) =>
    b.candidates
      .filter((c) => c.type === "Manager / coach")
      .map((c) => {
        const m = c.profile?.managerStats,
          s = m
            ? ` · ${m.W}–${m.L} · ${m.seasons} seasons`
            : c.era
              ? ` · ${c.era}`
              : "";
        return `<option value="${esc(c.id)}" ${r.manager === c.id ? "selected" : ""}>${esc(c.name + s)}</option>`;
      })
      .join("");
  const playerOptions = (b, r, slot, showAll = expandedSlots.has(slot)) => {
    const selected = r.slots[slot] || "",
      eligibilityOptions = {
        legacyExceptionId: r.legacyException?.playerId || "",
      },
      list = showAll
        ? slotCandidates(b.candidates, slot, selected, eligibilityOptions)
        : slotShortlist(b.candidates, slot, selected, eligibilityOptions);
    return list
      .map((c) => {
        const status = rosterEligibility(c, slot, eligibilityOptions),
          invalid = !status.eligible,
          fit = slotFitLabel(c, slot),
          module = rosterModule(c),
          metric = rosterMetric(c, slot),
          franchise = module.franchise?.value;
        return `<option value="${esc(c.id)}" ${selected === c.id ? "selected" : ""}>${invalid ? "⚠ " : status.usingException ? "★ " : ""}${esc(c.name)} · ${esc(fit)}${invalid ? ` · ${esc(status.reason)}` : ""}${metric?.value != null ? ` · ${esc(metric.label)} ${Number(metric.value).toFixed(1)}` : ""}${Number.isFinite(franchise) ? ` · F-APEX ${Number(franchise).toFixed(1)}` : ""}</option>`;
      })
      .join("");
  };
  const overrideStatus = (b, r, slot, selected) => {
    if (!selected) return null;
    const usedElsewhere = new Set(
        Object.entries(r.slots)
          .filter(([key]) => key !== slot)
          .map(([, id]) => id),
      ),
      selectedMetric = rosterMetric(selected, slot),
      alternatives = b.candidates
        .filter(
          (c) =>
            c.type === "Player" &&
            eligibleForSlot(c, slot, {
              legacyExceptionId: r.legacyException?.playerId || "",
            }) &&
            !usedElsewhere.has(c.id),
        )
        .map((c) => ({ c, metric: rosterMetric(c, slot) }))
        .filter((row) => Number.isFinite(Number(row.metric?.value)))
        .sort((a, z) => Number(z.metric.value) - Number(a.metric.value)),
      best = alternatives[0];
    if (
      !best ||
      best.c.id === selected.id ||
      !Number.isFinite(Number(selectedMetric?.value)) ||
      Number(best.metric.value) <= Number(selectedMetric.value) * 1.01
    )
      return null;
    return {
      selectedMetric,
      best: best.c,
      bestMetric: best.metric,
    };
  };
  const rosterFitHTML = (b, r, slot, c) => {
    if (!c) return "";
    const module = rosterModule(c),
      metric = rosterMetric(c, slot),
      eligibility = rosterEligibility(c, slot, {
        legacyExceptionId: r.legacyException?.playerId || "",
      }),
      override = overrideStatus(b, r, slot, c),
      explanation = slotFitExplanation(c, slot, {
        legacyExceptionId: r.legacyException?.playerId || "",
      }),
      chips = [
        eligibility.usingException
          ? "★ Legacy Legend exception"
          : eligibility.baseEligible
            ? `${Math.round(eligibility.seasons)} seasons · ${Math.round(eligibility.workload.value).toLocaleString()} ${eligibility.workload.unit}`
            : "⚠ Eligibility review",
        module.franchise?.value != null
          ? `F-APEX ${Number(module.franchise.value).toFixed(2)}`
          : "F-APEX —",
        metric?.value != null
          ? `${metric.label} ${Number(metric.value).toFixed(2)}`
          : "Role value —",
        module.confidence.label,
        module.versatility && ["UTIL", "OF4", "CI"].includes(slot)
          ? `APEX-V ${Number(module.versatility.value).toFixed(1)}`
          : "",
        module.catcher && ["C", "C2"].includes(slot)
          ? `C-Prime5 ${module.catcher.Prime5 == null ? "N/A" : `${Number(module.catcher.Prime5) > 0 ? "+" : ""}${Number(module.catcher.Prime5).toFixed(1)}`} · ${module.catcher.confidence}`
          : "",
        module.pitcherRole ? module.pitcherRole.role : "",
      ].filter(Boolean);
    return `<div class="roster-fit"><div>${chips.map((text) => `<span>${esc(text)}</span>`).join("")}</div>${!eligibility.eligible ? `<small class="eligibility-warning">${esc(eligibility.reason)}. Change the selection or use the one Legacy Legend exception.</small>` : ""}<p class="fit-explanation"><b>Why this player fits:</b> ${esc(explanation)}.</p><small>${esc(metric?.detail || "Roster companion unavailable; review the player card.")}</small>${c.profile?.storyThread ? `<p class="roster-story-thread"><b>Legacy thread:</b> ${esc(c.profile.storyThread)}</p>` : ""}${override ? `<label class="role-override ${r.overrides?.[slot] ? "complete" : "needs-note"}"><strong>Role-fit override</strong><span>${esc(override.best.name)} has the higher ${esc(override.bestMetric.label)} (${Number(override.bestMetric.value).toFixed(2)}). Record why ${esc(c.name)} is the better roster choice.</span><textarea data-role-override="${esc(slot)}" maxlength="2000" rows="2" placeholder="Defense, handedness, bench coverage, bullpen job, era fit…">${esc(r.overrides?.[slot] || "")}</textarea></label>` : r.overrides?.[slot] ? `<label class="role-override complete"><strong>Saved selection note</strong><textarea data-role-override="${esc(slot)}" maxlength="2000" rows="2">${esc(r.overrides[slot])}</textarea></label>` : ""}</div>`;
  };
  const comparisonCard = (c, slot, r, selectedId) => {
    const module = rosterModule(c),
      metric = rosterMetric(c, slot),
      lane = /^SP\d$/.test(slot) ? "SP" : BULLPEN_SLOTS.includes(slot) ? "RP" : "H",
      board = c.profile?.advancedStats?.apexBoards?.[lane] || {},
      number = (value) =>
        Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "—";
    return `<article class="slot-compare-card ${c.id === selectedId ? "current" : ""}"><span>${c.id === selectedId ? "CURRENT CHOICE" : "TOP ALTERNATIVE"}</span><h3>${esc(c.name)}</h3><p>${esc(slotFitExplanation(c, slot, { legacyExceptionId: r.legacyException?.playerId || "" }))}</p><div><div><small>${esc(metric?.label || "Role value")}</small><strong>${number(metric?.value)}</strong></div><div><small>F-APEX</small><strong>${number(module.franchise?.value)}</strong></div><div><small>Peak3</small><strong>${number(board.Peak3 ?? board.Apex)}</strong></div><div><small>Prime5</small><strong>${number(board.Prime5 ?? board.Prime)}</strong></div></div>${c.id === selectedId ? "" : `<button class="primary" data-compare-choose="${esc(c.id)}">Use ${esc(c.name)}</button>`}<button class="subtle" data-compare-open="${esc(c.id)}">Open full card</button></article>`;
  };
  const openSlotCompare = (slot) => {
    const b = getBoard(),
      r = roster(),
      selectedId = r.slots[slot] || "",
      usedElsewhere = new Set(
        Object.entries(r.slots)
          .filter(([key]) => key !== slot)
          .map(([, id]) => id),
      ),
      options = { legacyExceptionId: r.legacyException?.playerId || "" },
      all = slotCandidates(b.candidates, slot, selectedId, options).filter(
        (c) => c.id === selectedId || !usedElsewhere.has(c.id),
      ),
      first = selectedId ? candidate(selectedId) : all[0],
      second = all.find((c) => c.id !== first?.id),
      cards = [first, second].filter(Boolean);
    openModal(
      `Compare for ${slot}`,
      `<div class="modal-body slot-compare"><p>Compare the current choice with the strongest available role fit. APEX ranks performance; position experience, workload, handedness and roster coverage explain the fit.</p><div class="slot-compare-grid">${cards.map((c) => comparisonCard(c, slot, r, selectedId)).join("")}</div>${cards.length < 2 ? '<p class="help">No second eligible, unassigned candidate is available for this role.</p>' : ""}</div>`,
      true,
    );
    $$('[data-compare-open]').forEach(
      (el) => (el.onclick = () => openEditor(el.dataset.compareOpen)),
    );
    $$('[data-compare-choose]').forEach(
      (el) =>
        (el.onclick = () => {
          const next = assignSlot(roster(), slot, el.dataset.compareChoose);
          document.querySelector("#modal").close();
          mutate(() => {
            getBoard().roster = next;
          }, `${candidate(el.dataset.compareChoose)?.name || "Player"} selected for ${slot}.`);
        }),
    );
  };
  // Field diagram (Joe 2026-10-03): SVG baseball diamond showing the starting
  // nine at their positions, like the Clubhouse view. Battle positions get a
  // red indicator.
  function fieldDiagramHTML(r, battles) {
    const pos = {
      // [x, y] in a 400x400 viewBox, catcher's perspective.
      P: [200, 250], C: [200, 355], "1B": [285, 270], "2B": [235, 200],
      "3B": [115, 270], SS: [165, 200], LF: [70, 110], CF: [200, 60],
      RF: [330, 110], DH: [340, 355],
    };
    const fieldSlots = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
    const markers = fieldSlots
      .map((slot) => {
        const c = candidate(r.slots[slot]);
        const [x, y] = pos[slot];
        const battle = battles[slot];
        const name = c ? c.name : "Open";
        // Split long names for display.
        const displayName = name.length > 16 ? name.split(" ").slice(-1)[0] : name;
        const apex = c ? c.profile?.apex?.F ?? c.profile?.board?.Apex : null;
        const apexStr = apex != null ? `${Math.round(apex * 10) / 10} W` : "";
        return `<g class="field-pos ${battle ? "field-battle" : ""}" data-field-slot="${slot}">
          <circle cx="${x}" cy="${y}" r="26" class="field-marker-bg"/>
          ${battle ? `<circle cx="${x + 18}" cy="${y - 18}" r="8" class="field-battle-dot"/><text x="${x + 18}" y="${y - 14}" class="field-battle-text">!</text>` : ""}
          <text x="${x}" y="${y - 8}" class="field-pos-label">${slot}</text>
          <text x="${x}" y="${y + 6}" class="field-player-name">${esc(displayName)}</text>
          <text x="${x}" y="${y + 18}" class="field-player-apex">${esc(apexStr)}</text>
        </g>`;
      })
      .join("");
    return `<section class="field-diagram-wrap"><h3>On the field</h3>
      <svg viewBox="0 0 400 400" class="field-diagram" role="img" aria-label="Starting nine field diagram">
        <ellipse cx="200" cy="200" rx="185" ry="175" class="field-grass"/>
        <polygon points="200,330 285,245 200,160 115,245" class="field-infield"/>
        <circle cx="200" cy="245" r="12" class="field-mound"/>
        <rect x="192" y="322" width="16" height="12" class="field-home"/>
        ${markers}
      </svg>
      <p class="help">Click a position to compare candidates. Red ! marks a position battle.</p>
    </section>`;
  }
  function renderRoster() {
    const b = getBoard(),
      r = roster(),
      check = rosterChecks(r, b.candidates),
      next = rosterNextStep(r, b.candidates, check),
      count = Object.keys(r.slots).length,
      progress = Math.round((count / 26) * 100),
      // Compute battles live so saved rosters (drafted before the feature)
      // show them without needing a fresh draft.
      liveBattles = detectPositionBattles(r, b.candidates || []),
      battles = { ...(r.battles || {}), ...liveBattles };
    const depth = (slots) =>
      slots
        .map(
          (k) =>
            `<div><span>${esc(k)}</span><strong>${esc(candidate(r.slots[k])?.name || "Open")}</strong></div>`,
        )
        .join("");
    const exceptionOptions = b.candidates
      .filter(
        (c) =>
          c.type === "Player" &&
          SLOTS.some(([slot]) => rosterEligibility(c, slot).exceptionEligible),
      )
      .map(
        (c) =>
          `<option value="${esc(c.id)}" ${r.legacyException?.playerId === c.id ? "selected" : ""}>${esc(c.name)}</option>`,
      )
      .join("");
    return `<section class="workspace legends-roster"><div class="section-heading"><div><div class="eyebrow muted">YOUR FRANCHISE. EVERY ERA.</div><h2>All-time roster</h2></div><div class="board-actions"><button class="subtle" id="clear-roster">Start over</button><button class="subtle" id="draft-roster" ${r.strategy === "custom" ? "disabled" : ""}>Fill open roles</button><button class="primary" id="export-lineup">Download lineup card</button></div></div><p class="section-description">${count} / 26 players · Nine starters, a five-man rotation, seven defined bullpen jobs, and a five-player coverage bench. Position menus enforce franchise tenure, workload and meaningful experience.</p><section class="roster-progress state-${esc(next.state)}"><div><span>${count} OF 26 ROLES FILLED</span><strong>${esc(next.text)}</strong></div><progress value="${count}" max="26" aria-label="${count} of 26 roster roles filled">${progress}%</progress><b>${progress}%</b></section><section class="roster-module-intro"><div><span>APEX 2.2 TEST</span><strong>Franchise Roster Module</strong><small>${esc(APEX_ROSTER_MODULE_VERSION)}</small></div><p><b>Franchise APEX</b> ranks performance. <b>RosterPos</b>, <b>APEX-V</b>, <b>APEX-C</b>, confidence, October and pitcher roles explain how the player fits. Complete APEX-Oct evidence may adjust APEX-F; missing evidence stays N/A.</p></section><div class="roster-strategy"><label>Roster builder<select id="roster-strategy"><option value="balanced" ${r.strategy === "balanced" ? "selected" : ""}>Balanced MLB-style roster</option><option value="apex" ${r.strategy === "apex" ? "selected" : ""}>Best position-earned APEX by role</option><option value="custom" ${r.strategy === "custom" ? "selected" : ""}>Fully manual</option></select></label><p>${r.strategy === "apex" ? "Fills each legal job using position-earned or role-lane APEX. Companions break roster-fit decisions without changing position or role eligibility." : r.strategy === "custom" ? "No automatic selections. Every roster choice stays in your hands; lower-score choices can carry a saved explanation." : "Prioritizes real lineup coverage, a true closer, setup and middle relief, one left-handed specialist, a swingman and a functional bench."}</p></div>${rosterRulesHTML(r, b.candidates, esc)}<section class="legacy-exception"><div><span>OPTIONAL</span><strong>Legacy Legend exception</strong><p>One player may miss only the workload minimum. Three franchise seasons and real experience at the selected position are still required.</p></div><label>Player<select id="legacy-exception-player"><option value="">No exception</option>${exceptionOptions}</select></label><label>Why this legend belongs<textarea id="legacy-exception-reason" maxlength="2000" rows="2" placeholder="Franchise meaning, era context, specialist value…">${esc(r.legacyException?.reason || "")}</textarea></label></section><div class="roster-layout"><div class="roster-editor"><div class="roster-title-fields"><label>Card title<input id="roster-title" maxlength="150" value="${esc(r.title)}"></label><label>Manager<select id="roster-manager"><option value="">Choose a manager</option>${managerOptions(b, r)}</select></label></div>${fieldDiagramHTML(r, battles)}${[
      ["The starting nine", SLOTS.slice(0, 9)],
      ["The rotation", SLOTS.slice(9, 14)],
      ["The bullpen", SLOTS.slice(14, 21)],
      ["The bench", SLOTS.slice(21)],
    ]
      .map(
        ([label, slots]) =>
          `<section class="roster-group"><h3>${label}</h3>${slots
            .map(([k, label]) => {
              const c = candidate(r.slots[k]);
              const eligibilityOptions = {
                legacyExceptionId: r.legacyException?.playerId || "",
              },
                eligible = slotCandidates(b.candidates, k, "", eligibilityOptions),
                short = slotShortlist(b.candidates, k, "", eligibilityOptions),
                expanded = expandedSlots.has(k),
                shown = expanded ? eligible.length : short.length,
                battle = battles[k],
                battleBadge = battle
                  ? `<span class="battle-badge" title="Position battle: ${esc(battle.candidates.map((x) => x.name).join(" vs "))} (gap ${battle.gapPct}%). Click Compare best fits to decide.">BATTLE</span>`
                  : "";
              return `<div class="roster-slot-wrap ${next.slot === k ? "guided-next" : ""} ${battle ? "has-battle" : ""}"><div class="roster-slot"><span class="position-chip">${k}${battleBadge}</span><div><label for="slot-${k}">${label} <small>${shown} of ${eligible.length} choices</small></label><select id="slot-${k}" data-slot="${k}"><option value="">Choose an eligible player</option>${playerOptions(b, r, k, expanded)}</select><div class="slot-tools">${!expanded && eligible.length > short.length ? `<button type="button" data-slot-all="${k}">Show all ${eligible.length}</button>` : ""}<button type="button" data-slot-compare="${k}" ${eligible.length < 2 ? "disabled" : ""}>Compare best fits</button></div></div>${c ? `<button class="icon-button" data-roster-edit="${esc(c.id)}" aria-label="View ${esc(c.name)} stats">↗</button>` : ""}</div>${rosterFitHTML(b, r, k, c)}</div>`;
            })
            .join("")}</section>`,
      )
      .join(
        "",
      )}<label>Roster notes<textarea id="roster-notes" rows="4" maxlength="20000" placeholder="Era rules, tough omissions, and why this team belongs together…">${esc(r.notes)}</textarea></label><p class="help">The DH goes first to a true franchise DH, then to the best remaining power bat. Bench selections favor coverage and game use. Edit a player to correct throwing hand or preferred roster role.</p></div><div class="lineup-preview"><div class="lineup-card" id="lineup-card">${teamLogo(getTeam()[0], "lineup-logo")}<div class="lineup-kicker">LEGACY LORE · ${esc(getTeam()[0])}</div><h2>${esc(r.title)}</h2><p class="lineup-team">${esc(getTeam()[1])}</p><div class="lineup-rule"></div><div class="lineup-heading"><span>ORDER</span><span>THE STARTING NINE</span><span>POS</span></div>${r.order
      .map((slot, i) => {
        const c = candidate(r.slots[slot]);
        return `<div class="lineup-player"><span class="lineup-number">${i + 1}</span><button ${c ? `data-roster-edit="${esc(c.id)}"` : "disabled"}><strong>${esc(c?.name || "Open position")}</strong><small>${esc(c?.nickname || c?.era || "")}</small></button><span class="lineup-position">${slot}</span><div class="lineup-moves"><button data-order-up="${slot}" aria-label="Move batting spot ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑</button><button data-order-down="${slot}" aria-label="Move batting spot ${i + 1} down" ${i === 8 ? "disabled" : ""}>↓</button></div></div>`;
      })
      .join(
        "",
      )}<p class="lineup-order-note"><b>ORDER LOGIC</b> ${esc(lineupOrderNote(r, b.candidates))}</p><div class="lineup-ace"><span>OPENING-DAY ACE</span><strong>${esc(candidate(r.slots.SP1)?.name || "Choose rotation No. 1")}</strong></div><div class="lineup-depth"><section><h3>BULLPEN</h3>${depth(BULLPEN_SLOTS)}</section><section><h3>BENCH</h3>${depth(BENCH_SLOTS)}</section></div><div class="lineup-manager" id="lineup-manager">${r.manager ? "MANAGER · " + esc(candidate(r.manager)?.name) : ""}</div><div class="lineup-signature">The names that take you back.</div></div><p class="help">Use the arrows to set your batting order. Complete all 26 valid roles and resolve every flagged role-fit override before downloading the final card.</p><button class="subtle" id="print-lineup">Print lineup card</button></div></div></section>`;
  }
  function bindRoster() {
    if (!$("#draft-roster")) return;
    $$("[data-slot]").forEach(
      (el) =>
        (el.onchange = () => {
          const current = roster(),
            selected = candidate(el.value),
            status = selected
              ? rosterEligibility(selected, el.dataset.slot, {
                  legacyExceptionId: current.legacyException?.playerId || "",
                })
              : null;
          if (selected && !status.eligible) {
            el.value = roster().slots[el.dataset.slot] || "";
            toast(`${selected.name}: ${status.reason}.`);
            return;
          }
          const next = assignSlot(current, el.dataset.slot, el.value);
          mutate(() => {
            getBoard().roster = next;
          }, "Roster saved.");
        }),
    );
    $$('[data-slot-all]').forEach(
      (button) =>
        (button.onclick = () => {
          const slot = button.dataset.slotAll,
            r = roster(),
            select = $(`#slot-${slot}`),
            total = slotCandidates(getBoard().candidates, slot, "", {
              legacyExceptionId: r.legacyException?.playerId || "",
            }).length;
          expandedSlots.add(slot);
          select.innerHTML = `<option value="">Choose an eligible player</option>${playerOptions(getBoard(), r, slot, true)}`;
          select.value = r.slots[slot] || "";
          button.closest(".roster-slot").querySelector("label small").textContent = `${total} of ${total} choices`;
          button.remove();
        }),
    );
    $$('[data-slot-compare]').forEach(
      (button) =>
        (button.onclick = () => openSlotCompare(button.dataset.slotCompare)),
    );
    // Field diagram positions open the same comparison modal.
    $$('[data-field-slot]').forEach(
      (el) =>
        (el.onclick = () => openSlotCompare(el.dataset.fieldSlot)),
    );
    for (const field of ["title", "notes", "manager"])
      $("#roster-" + field).onchange = (e) => {
        const value = e.target.value;
        mutate(
          () => {
            const r = roster();
            r[field] = value;
            getBoard().roster = r;
          },
          "Roster saved.",
          { redraw: false },
        );
        const r = roster();
        $("#lineup-card h2").textContent = r.title;
        $("#lineup-manager").textContent = r.manager
          ? "MANAGER · " + candidate(r.manager)?.name
          : "";
      };
    $("#roster-strategy").onchange = (e) => {
      mutate(() => {
        const r = roster();
        r.strategy = e.target.value;
        getBoard().roster = r;
      }, "Roster-builder mode saved.");
    };
    $("#legacy-exception-player").onchange = (e) => {
      const playerId = e.target.value;
      mutate(() => {
        const r = roster();
        r.legacyException = {
          playerId,
          reason:
            playerId && playerId === r.legacyException?.playerId
              ? r.legacyException?.reason || ""
              : "",
        };
        getBoard().roster = r;
      }, playerId ? "Legacy Legend exception selected." : "Legacy Legend exception cleared.");
    };
    $("#legacy-exception-reason").onchange = (e) => {
      const reason = e.target.value.trim();
      mutate(() => {
        const r = roster();
        r.legacyException = {
          playerId: r.legacyException?.playerId || "",
          reason,
        };
        getBoard().roster = r;
      }, reason ? "Legacy Legend reason saved." : "Legacy Legend reason cleared.");
    };
    $$('[data-role-override]').forEach((el) => {
      el.onchange = () => {
        const slot = el.dataset.roleOverride,
          value = el.value.trim();
        mutate(
          () => {
            const r = roster();
            r.overrides = r.overrides || {};
            if (value) r.overrides[slot] = value;
            else delete r.overrides[slot];
            getBoard().roster = r;
          },
          value ? "Role-fit explanation saved." : "Role-fit explanation cleared.",
        );
      };
    });
    $$("[data-roster-edit]").forEach(
      (el) => (el.onclick = () => openEditor(el.dataset.rosterEdit)),
    );
    $$("[data-order-up],[data-order-down]").forEach(
      (el) =>
        (el.onclick = () => {
          const k = el.dataset.orderUp || el.dataset.orderDown,
            delta = el.dataset.orderUp ? -1 : 1;
          mutate(() => {
            const r = roster(),
              i = r.order.indexOf(k),
              j = i + delta;
            if (j >= 0 && j < 9)
              [r.order[i], r.order[j]] = [r.order[j], r.order[i]];
            getBoard().roster = r;
          }, "Batting order saved.");
        }),
    );
    $("#draft-roster").onclick = () => {
      const r = draftRoster(
        getBoard().candidates,
        roster(),
        getBoard().candidates,
        roster().strategy,
      );
      const added =
        Object.keys(r.slots).length - Object.keys(roster().slots).length;
      if (rosterChecks(r, getBoard().candidates).errors.length) {
        toast(
          "Draft would exceed roster limits. Fill the remaining slots manually.",
        );
        return;
      }
      mutate(() => {
        getBoard().roster = r;
      }, `${added} roles filled from your ranked stars and specialist reserve. Open roles need a suitable player; Undo is available.`);
    };
    $("#clear-roster").onclick = () => {
      mutate(() => {
        const current = roster(), next = newRoster();
        next.title = current.title;
        next.notes = current.notes;
        next.manager = current.manager;
        next.strategy = current.strategy;
        getBoard().roster = next;
      }, "Player selections cleared. Manager and notes were kept.");
    };
    $("#export-lineup").onclick = () => {
      const check = rosterChecks(roster(), getBoard().candidates);
      if (check.errors.length) {
        toast(check.errors[0]);
        return;
      }
      if (!check.complete) {
        toast(
          check.unexplainedOverrides.length
            ? `Add a role-fit explanation for ${check.unexplainedOverrides[0]} before finalizing the roster.`
            : "Complete all 26 roster roles before downloading the final lineup card.",
        );
        return;
      }
      download(
        `legacy-lore-${getTeam()[0]}-lineup.svg`,
        lineupSVG(),
        "image/svg+xml",
      );
    };
    $("#print-lineup").onclick = () => window.print();
  }
  function lineupSVG() {
    const r = roster(),
      theme = teamTheme(getTeam()[0]);
    const cut = (s, n) =>
      String(s || "").length > n
        ? String(s).slice(0, n - 1) + "…"
        : String(s || "");
    const text = (x, y, s, size = 30, fill = theme.primary, extra = "") =>
      `<text x="${x}" y="${y}" font-family="Georgia,serif" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;
    const depth = (slots, x, y) =>
      slots
        .map((slot, i) =>
          text(
            x,
            y + i * 31,
            slot + " · " + cut(candidate(r.slots[slot])?.name || "Open", 22),
            18,
          ),
        )
        .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1750" viewBox="0 0 1100 1750"><rect width="1100" height="1750" fill="#f7f0df"/><rect x="30" y="30" width="1040" height="1690" fill="none" stroke="${theme.primary}" stroke-width="4"/><rect x="880" y="50" width="130" height="130" rx="12" fill="${theme.primary}"/><image href="${theme.embedded}" x="890" y="60" width="110" height="110"/>${text(80, 100, "LEGACY LORE  /  " + getTeam()[0], 25)}${text(80, 179, cut(r.title, 31), 42)}${text(80, 225, getTeam()[1], 28)}<path d="M80 260H1020" stroke="${theme.primary}" stroke-width="3"/>${text(80, 310, "ORDER", 18)}${text(180, 310, "THE STARTING NINE", 18)}${text(930, 310, "POS", 18)}${r.order
      .map((slot, i) => {
        const c = candidate(r.slots[slot]),
          y = 375 + i * 98;
        return (
          text(90, y, i + 1, 34) +
          text(180, y, cut(c?.name || "Open position", 32), 34) +
          text(
            180,
            y + 30,
            cut(c?.nickname || c?.era || "", 63),
            19,
            "#657169",
          ) +
          text(940, y, slot, 25) +
          `<path d="M80 ${y + 49}H1020" stroke="#c5c8b7"/>`
        );
      })
      .join(
        "",
      )}${text(80, 1300, "OPENING-DAY ACE · " + cut(candidate(r.slots.SP1)?.name || "Open", 34), 21)}${text(80, 1360, "BULLPEN", 18)}${text(575, 1360, "BENCH", 18)}${depth(BULLPEN_SLOTS, 80, 1395)}${depth(BENCH_SLOTS, 575, 1395)}${text(80, 1645, "MANAGER · " + cut(candidate(r.manager)?.name || "To be selected", 45), 22)}${text(80, 1690, "The names that take you back.", 22)}</svg>`;
  }
  function openAutomation() {
    openModal(
      "Scoring assistant",
      `<div class="modal-body"><h3>Lore leads. Statistics supply context.</h3><p>Legacy Lore keeps identity 30%, fan connection 25%, signature legacy 25% and excellence 20%. The raw ERA/OPS starting-order formula has been retired.</p><button class="primary" id="prepare-scoring">Research & auto-fill</button><details class="auto-method"><summary>Corrected statistical method</summary><p>Seasonal OPS or ERA is compared with same-year hitters, starters or relievers. Small workloads are shrunk toward the middle of their peer group. A contribution factor then incorporates franchise workload relative to a full hitter or starter season.</p><p>Performance is weighted by equivalent seasonal workload. Peak uses the best three imported seasons; a single season cannot fill all three. Longevity measures equivalent full-season workloads, with 12 earning 10.</p><p>These remain studio estimates, not wins above replacement. Same-year comparison addresses era context but not park effects. Defense has a separate optional sourced assessment. Missing defense, baserunning and postseason evidence is explicitly labeled. No automatic player-value estimate alone determines your legacy order.</p></details><p>Manual ratings and FLS are protected. Automatic story and lore drafts cite their evidence and remain editable. Missing fan attachment never becomes zero.</p></div>`,
      true,
    );
    document.querySelector("#prepare-scoring").onclick = () => {
      document.querySelector("#modal").close();
      prepareEvidence();
    };
  }
  function editorAssistant(c) {
    const suggestions = suggestScores(c);
    if (c.type !== "Player") return "";
    return `<section class="candidate-assistant"><div><h3>Scoring assistant</h3><p class="help">${Object.keys(suggestions).length ? "Estimates from your saved franchise seasons. Manual ratings are protected." : "Use Research & auto-fill to prepare era and role context for your imported seasons."}</p></div>${Object.keys(suggestions).length ? '<button class="subtle" type="button" id="estimate-candidate">Fill available estimates</button>' : ""}<div class="auto-estimates">${AUTO_KEYS.filter(
      (k) => suggestions[k],
    )
      .map(
        (k) =>
          `<div><strong>${k[0].toUpperCase() + k.slice(1)} · ${suggestions[k].value} / 10</strong><p>${esc(suggestions[k].reason)}</p></div>`,
      )
      .join(
        "",
      )}</div><small>Lore needs a story: ${["identity", "attachment", "moments", "nostalgia", "culture"].filter((k) => c.scores[k] == null && !c.na.includes(k)).length} editorial ratings still open.</small></section>`;
  }
  return {
    renderRoster,
    bindRoster,
    openAutomation,
    editorAssistant,
    statStrip,
  };
}
