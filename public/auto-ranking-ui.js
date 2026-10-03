import { previewAutoRanking, applyRankingPreview } from "./auto-ranking.js";
export function createAutoRankingUI({
  getBoard,
  getTeam,
  openModal,
  mutate,
  esc,
  toast,
  prepareEvidence,
}) {
  const $ = (s) => document.querySelector(s);
  function open() {
    const b = getBoard(),
      team = getTeam()[0];
    let lens = "apex",
      useLore = false,
      preview,
      signature;
    openModal(
      "Auto-score & rank",
      `<div class="modal-body"><p>Build an editable collection order from Baseball-Reference advanced value. Review the preview before replacing your manual order.</p><label>Ranking basis<select id="auto-rank-lens"><option value="apex">APEX · collection suggestion</option><option value="legacy">Legacy/custom score · manual</option></select></label><p class="help">The official performance view is three separate boards: APEX-H, APEX-SP and APEX-RP. This preview mixes primary-role scores only to help organize the editable card collection; it is not an official cross-role ranking.</p><button id="prepare-evidence" class="subtle">Prepare missing APEX data</button><p id="auto-rank-method" class="notice"></p><div id="auto-rank-preview"></div></div><div class="modal-footer"><button id="auto-rank-apply" class="primary">Apply collection suggestion</button></div>`,
      true,
    );
    function draw() {
      signature = JSON.stringify(b);
      preview = previewAutoRanking(b, team, { lens, useLore });
      $("#auto-rank-method").textContent =
        lens === "apex"
          ? "Collection aid: compares each player's primary APEX-H, APEX-SP or APEX-RP score. APEX 2.2 Test uses 25% Peak3 / 35% Prime5 / 40% Career. APEX-F adds half of signed APEX-Oct only when complete postseason evidence is saved; otherwise October stays N/A."
          : "Manual Legacy/custom score uses the editable lore worksheet.";
      $("#auto-rank-preview").innerHTML =
        `<p><strong>${preview.eligible} candidates can be ranked.</strong> ${preview.filled} blank statistical ratings can be filled.</p><p class="help">Up to 200 scorable candidates enter your ranking. Other qualified players stay searchable in the franchise pool. This changes your manual order, with Undo available.</p>${
          !preview.eligible
            ? '<p class="notice">Use the built-in collection or prepare missing APEX data for a custom player.</p>'
            : `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Suggested rank</th><th>Candidate</th><th>${lens === "apex" ? "APEX" : "Legacy/custom"} </th></tr></thead><tbody>${preview.top
                .map((c, i) => {
                  const row = preview.rows.find((r) => r.candidate.id === c.id);
                  return `<tr><td>${i + 1}</td><td>${esc(c.name)}</td><td>${row.value === null ? "Needs assessment" : row.value.toFixed(1)}</td></tr>`;
                })
                .join("")}</tbody></table></div>`
        }`;
      $("#auto-rank-apply").disabled = !preview.eligible;
    }
    $("#prepare-evidence").onclick = () => {
      document.querySelector("#modal").close();
      prepareEvidence();
    };
    $("#auto-rank-lens").onchange = (e) => {
      lens = e.target.value;
      draw();
    };
    draw();
    $("#auto-rank-apply").onclick = () => {
      if (getBoard() !== b) {
        toast("Franchise changed. Reopen the preview.");
        return;
      }
      if (JSON.stringify(b) !== signature) {
        draw();
        toast(
          "Candidate data changed. Review the refreshed preview before applying.",
        );
        return;
      }
      $("#modal").close();
      mutate(() => {
        applyRankingPreview(b, preview);
        b.mode = lens;
      }, "Suggested scores and order applied. Review close calls; Undo is available.");
    };
  }
  return { open };
}
