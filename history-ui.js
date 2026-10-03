import {
  ALMANAC_THEME,
  chapterMarkdown,
  chapterYears,
  cleanChapter,
  composeStoryFromSections,
  importStoryFile,
} from "./history-almanac.js";

const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];

export function createHistoryUI({
  getState,
  getBoard,
  getTeam,
  mutate,
  openModal,
  toast,
  download,
  esc,
  openPlayer,
}) {
  const almanac = () => getState().almanac;
  const chapter = (id) => almanac().chapters.find((item) => item.id === id);
  const linkedPlayers = (id) =>
    getBoard().candidates.filter((candidate) =>
      candidate.profile?.historyLinks?.includes(id),
    );
  const label = (status) =>
    ({ draft: "Draft", reviewed: "Reviewed", ready: "Ready to post" })[status] ||
    "Draft";

  async function copy(value, message) {
    try {
      await navigator.clipboard.writeText(value);
      toast(message);
    } catch {
      const box = document.createElement("textarea");
      box.value = value;
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.append(box);
      box.select();
      document.execCommand("copy");
      box.remove();
      toast(message);
    }
  }

  function renderYears() {
    const items = almanac().chapters;
    return `<section class="workspace almanac-workspace"><div class="section-heading"><div><div class="eyebrow muted">BASEBALL'S OLD SCRAPBOOK</div><h2>Baseball through the years</h2></div><div class="board-actions"><button class="subtle" id="import-story-trigger">Import story</button><button class="subtle" id="export-almanac">Export all</button><button class="primary" id="add-history-chapter">Add chapter</button></div></div><blockquote class="almanac-theme">${esc(almanac().themeLine || ALMANAC_THEME)}</blockquote><p class="section-description">Build the game five years at a time. Every chapter keeps a full story, a Facebook version, research links, graphic notes, and connections to the players in your franchise projects.</p><div class="almanac-chapters">${items
      .map((item, index) => {
        const players = linkedPlayers(item.id);
        return `<article class="almanac-chapter-card status-${esc(item.status)}"><div class="almanac-card-top"><span>${esc(chapterYears(item))}</span><small>${esc(label(item.status))}</small></div><div class="almanac-card-number">${String(index + 1).padStart(2, "0")}</div><h3>${esc(item.title)}</h3><p class="almanac-subtitle">${esc(item.subtitle)}</p><p>${esc(item.fullStory || "Start writing this chapter.")}</p><div class="almanac-card-meta"><span>${item.sources.length} sources</span><span>${item.researchClippings?.length || 0} private clippings</span><span>${players.length} linked ${players.length === 1 ? "person" : "people"}</span><span>${item.facebookPost ? "Facebook copy ready" : "Needs social copy"}</span></div><div class="almanac-card-actions"><button class="primary" data-history-open="${esc(item.id)}">Open chapter</button><button class="subtle" data-history-copy="${esc(item.id)}">Copy post</button><button class="subtle" data-history-research="${esc(item.id)}">Research</button><button class="icon-button" data-history-edit="${esc(item.id)}" aria-label="Edit ${esc(item.title)}">✎</button></div></article>`;
      })
      .join("")}</div><input id="story-file" type="file" accept=".json,.md,.txt,application/json,text/markdown,text/plain" hidden></section>`;
  }

  function renderDesk() {
    const ready = almanac().chapters.filter((item) => item.status === "ready").length;
    return `<section class="workspace story-desk"><div class="section-heading"><div><div class="eyebrow muted">RESEARCH, WRITE, KEEP YOUR VOICE</div><h2>The Story Desk</h2></div><button class="primary" id="desk-add-chapter">Start a story</button></div><p class="section-description">Every story is built from editable sections. Save article links or paste full articles into private research clippings, then update the complete draft without publishing the source text.</p><div class="story-desk-grid"><article><span>01</span><h3>Research one chapter</h3><p>Open a chapter and gather sources without sending hundreds of requests at once.</p><button class="subtle" id="desk-open-first">Open next draft</button></article><article><span>02</span><h3>Build the full story</h3><p>Edit each section and let the complete draft update as one clean article.</p><button class="subtle" id="desk-copy-ready">Copy next ready post</button></article><article><span>03</span><h3>Keep source material</h3><p>Save links and private article clippings, then export your original work as Markdown or JSON.</p><button class="subtle" id="desk-export">Export Almanac</button></article><article><span>04</span><h3>On this day</h3><p>Start a dated story, then connect it to a franchise, player, or five-year chapter.</p><button class="subtle" id="desk-daily">Start today's entry</button></article></div><div class="source-rules"><h3>Source guardrails</h3><div><strong>Wikipedia</strong><span>Use the official API, keep attribution, and verify important claims.</span></div><div><strong>MLB</strong><span>Use official statistics and history pages where coverage exists.</span></div><div><strong>Baseball Almanac</strong><span>Save the page link and your notes. Write the finished story in your own words.</span></div></div><div class="desk-summary"><strong>${almanac().chapters.length} entries</strong><span>${ready} ready to post</span><span>${almanac().chapters.reduce((n, item) => n + item.sources.length, 0)} saved sources</span><span>${almanac().chapters.reduce((n, item) => n + (item.researchClippings?.length || 0), 0)} private clippings</span></div></section>`;
  }

  function sourcesHTML(item) {
    if (!item.sources.length)
      return '<p class="help">No sources saved yet. Use Research to gather starting points.</p>';
    return `<div class="chapter-sources">${item.sources
      .map(
        (source) =>
          `<a href="${esc(source.url)}" target="_blank" rel="noopener"><small>${esc(source.type)}</small><strong>${esc(source.label)}</strong>${source.note ? `<span>${esc(source.note)}</span>` : ""}</a>`,
      )
      .join("")}</div>`;
  }

  function openChapter(id) {
    const item = chapter(id);
    if (!item) return;
    const paragraphs = String(item.fullStory || "Start writing this chapter.")
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((text) => `<p>${esc(text)}</p>`)
      .join("");
    const sections = [
      ["feel", "What baseball felt like"],
      ["stars", "Great players"],
      ["teams", "Teams and champions"],
      ["stats", "Numbers that explain the era"],
      ["changes", "Rules, equipment, and ballparks"],
      ["forgotten", "Forgotten lore"],
      ["moment", "Historic moment"],
      ["connection", "Connection to today"],
    ].filter(([key]) => item.sections[key]);
    const people = linkedPlayers(id);
    openModal(
      item.title,
      `<article class="modal-body almanac-detail"><div class="almanac-detail-head"><span>${esc(chapterYears(item))}</span><small>${esc(label(item.status))}</small></div><blockquote>${esc(almanac().themeLine)}</blockquote><div class="almanac-story">${paragraphs}</div>${sections.length ? `<div class="almanac-detail-sections">${sections.map(([key, name]) => `<section><h3>${esc(name)}</h3><p>${esc(item.sections[key])}</p></section>`).join("")}</div>` : ""}${people.length ? `<section class="linked-people"><h3>Connected to your collection</h3>${people.map((person) => `<button data-history-player="${esc(person.id)}"><strong>${esc(person.name)}</strong><span>${esc(person.profile.storyThread || person.moments || "Open player card")}</span></button>`).join("")}</section>` : ""}<section><h3>Sources and further reading</h3>${sourcesHTML(item)}</section>${item.graphicNotes ? `<section class="graphic-brief"><h3>Graphic direction</h3><p>${esc(item.graphicNotes)}</p></section>` : ""}</article><div class="modal-footer history-footer"><button class="subtle" id="chapter-research">Research</button><button class="subtle" id="chapter-copy-post">Copy Facebook post</button><button class="subtle" id="chapter-copy-full">Copy full chapter</button><button class="subtle" id="chapter-download">Download Markdown</button><button class="primary" id="chapter-edit">Edit</button></div>`,
      true,
    );
    const researchButton = $("#chapter-research");
    researchButton.textContent = item.kind === "prelude" ? "Add article" : "Find sources";
    researchButton.onclick = () => openResearch(id);
    if (item.kind !== "prelude") {
      const addArticle = document.createElement("button");
      addArticle.type = "button";
      addArticle.className = "subtle";
      addArticle.textContent = "Add article";
      addArticle.onclick = () => openArticleAdder(id);
      researchButton.after(addArticle);
    }
    $("#chapter-copy-post").onclick = () =>
      copy(item.facebookPost || item.fullStory, "Facebook copy copied.");
    $("#chapter-copy-full").onclick = () =>
      copy(chapterMarkdown(item, almanac().themeLine), "Full chapter copied.");
    $("#chapter-download").onclick = () =>
      download(
        `${item.id}.md`,
        chapterMarkdown(item, almanac().themeLine),
        "text/markdown;charset=utf-8",
      );
    $("#chapter-edit").onclick = () => openEditor(id);
    $$('[data-history-player]').forEach(
      (button) =>
        (button.onclick = () => {
          $("#modal").close();
          openPlayer(button.dataset.historyPlayer);
        }),
    );
  }

  const parseSources = (raw, existing = []) => {
    const old = new Map(existing.map((item) => [item.url, item]));
    return String(raw || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        const urlIndex = parts.findIndex((part) => /^https:\/\//.test(part));
        if (urlIndex < 0) throw Error(`Source line needs an https:// link: ${line}`);
        const url = parts[urlIndex];
        const type = ["Wikipedia", "MLB", "Baseball Almanac", "Other"].includes(parts[0])
          ? parts[0]
          : "Other";
        return {
          id: old.get(url)?.id || crypto.randomUUID(),
          type,
          label: parts[urlIndex - 1] || parts[1] || "Source",
          url,
          note: parts.slice(urlIndex + 1).join(" | "),
          checkedAt: old.get(url)?.checkedAt || "",
        };
      });
  };

  function openEditor(id = "", template = {}) {
    const current = id ? chapter(id) : null;
    const item = cleanChapter(
      current || {
        id: crypto.randomUUID(),
        kind: template.kind || "chapter",
        from: template.from ?? null,
        to: template.to ?? null,
        title: template.title || "",
        subtitle: template.subtitle || "",
        status: "draft",
        opening: "",
        autoCompose: true,
        fullStory: "",
        facebookPost: "",
        sections: {},
        graphicNotes: "",
        notes: "",
        sources: [],
        researchClippings: [],
      },
    );
    let workingClippings = (item.researchClippings || []).map((entry) => ({ ...entry }));
    const section = (key, title, placeholder) =>
      `<label>${title}<textarea class="story-section-input" name="section-${key}" rows="4" maxlength="12000" placeholder="${esc(placeholder)}">${esc(item.sections[key])}</textarea></label>`;
    const sourceLines = item.sources
      .map((source) =>
        [source.type, source.label, source.url, source.note].filter(Boolean).join(" | "),
      )
      .join("\n");
    openModal(
      current ? "Edit historical chapter" : "Add historical chapter",
      `<form id="almanac-form"><div class="modal-body almanac-editor"><div class="form-grid"><label>Entry type<select name="kind"><option value="chapter" ${item.kind === "chapter" ? "selected" : ""}>Five-year chapter</option><option value="prelude" ${item.kind === "prelude" ? "selected" : ""}>Prelude</option><option value="daily" ${item.kind === "daily" ? "selected" : ""}>On this day</option></select></label><label>Status<select name="status"><option value="draft" ${item.status === "draft" ? "selected" : ""}>Draft</option><option value="reviewed" ${item.status === "reviewed" ? "selected" : ""}>Sources reviewed</option><option value="ready" ${item.status === "ready" ? "selected" : ""}>Ready to post</option></select></label><label>Starting year<input name="from" type="number" min="1800" max="2100" value="${item.from ?? ""}"></label><label>Ending year<input name="to" type="number" min="1800" max="2100" value="${item.to ?? ""}"></label></div><label>Title<input name="title" required maxlength="180" value="${esc(item.title)}"></label><label>Subtitle<input name="subtitle" maxlength="180" value="${esc(item.subtitle)}"></label><div class="story-builder-head"><div><strong>Story builder</strong><span>Edit the sections below and the complete article updates automatically.</span></div><label class="toggle-line"><input name="auto-compose" type="checkbox" ${item.autoCompose ? "checked" : ""}> Keep full story synced to sections</label></div><label>Opening paragraph<textarea class="story-section-input" name="opening" rows="4" maxlength="12000" placeholder="Invite the reader into this chapter.">${esc(item.opening)}</textarea></label><details class="history-editor-sections" open><summary>Editable story sections</summary>${section("feel", "What baseball felt like", "Crowds, travel, playing conditions, and the mood of the game.")}${section("changes", "Rules, equipment, and ballparks", "What changed during this five-year stretch?")}${section("stars", "Great players", "The stars and why they mattered in their own baseball world.")}${section("teams", "Teams and champions", "Champions, great clubs, collapses, and rivalries.")}${section("stats", "Numbers that explain the era", "Only the statistics that help the story.")}${section("forgotten", "Forgotten lore", "One overlooked name or story worth bringing back.")}${section("moment", "Historic moment", "Triumph, heartbreak, controversy, oddity, or turning point.")}${section("connection", "Connection to today", "What can a modern fan still recognize?")}</details><div class="full-story-heading"><strong>Complete article</strong><button type="button" class="subtle" id="compose-story-now">Update from sections</button></div><label><span class="sr-only">Complete article</span><textarea name="full-story" rows="16" maxlength="60000" placeholder="Your complete article appears here.">${esc(item.fullStory)}</textarea></label><small class="help">Turn off automatic syncing if you want to polish the complete article without changing it when a section is edited.</small><label>Facebook-ready version<textarea name="facebook-post" rows="9" maxlength="20000" placeholder="A shorter post that invites readers into the full story.">${esc(item.facebookPost)}</textarea></label><details class="article-workspace" open><summary>Articles, links, and private research</summary><p class="help">Save an article link or paste the full text for private reference. Research clippings are never inserted into the published draft automatically.</p><div class="article-link-grid"><label>Source type<select id="article-source-type"><option>Other</option><option>Wikipedia</option><option>MLB</option><option>Baseball Almanac</option></select></label><label>Article title<input id="article-title" maxlength="300" placeholder="Article title"></label><label class="wide">Article link<input id="article-url" type="url" maxlength="2000" placeholder="https://..."></label><label class="wide">What this supports<input id="article-note" maxlength="2000" placeholder="Facts, dates, quote to verify, or section to update"></label></div><div class="article-actions"><button type="button" class="subtle" id="add-article-link">Add link to sources</button><button type="button" class="subtle" id="paste-article-text">Paste full article</button></div><label>Full article text or excerpt<textarea id="article-text" rows="10" maxlength="150000" placeholder="Paste source text here for private research. Keep the source link above."></textarea></label><button type="button" class="primary" id="save-article-clipping">Save private clipping</button><div id="saved-article-clippings"></div></details><label>Saved source links<textarea name="sources" rows="7" maxlength="30000" placeholder="Wikipedia | Article title | https://... | What this supports">${esc(sourceLines)}</textarea><small>One per line: Type | Article title | https://link | Note.</small></label><label>Graphic direction<textarea name="graphic-notes" rows="4" maxlength="12000">${esc(item.graphicNotes)}</textarea></label><label>Private working notes<textarea name="notes" rows="4" maxlength="12000">${esc(item.notes)}</textarea></label></div><div class="modal-footer">${current ? '<button type="button" class="danger-text" id="delete-history-entry">Delete</button>' : "<span></span>"}<div><button type="button" class="subtle" id="cancel-history-edit">Cancel</button><button class="primary">Save chapter</button></div></div></form>`,
      true,
    );
    const fieldsForStory = () => ({
      opening: String($("[name=opening]").value || ""),
      sections: Object.fromEntries(
        ["feel", "stars", "teams", "stats", "changes", "forgotten", "moment", "connection"].map(
          (key) => [key, String($(`[name=section-${key}]`).value || "")],
        ),
      ),
    });
    const updateFullStory = (announce = false) => {
      $("[name=full-story]").value = composeStoryFromSections(fieldsForStory());
      if (announce) toast("Complete article updated from your sections.");
    };
    const renderClippings = () => {
      const root = $("#saved-article-clippings");
      root.innerHTML = workingClippings.length
        ? `<h4>Saved private clippings</h4><div class="clipping-list">${workingClippings
            .map(
              (entry) => `<article><div><strong>${esc(entry.title)}</strong>${entry.sourceUrl ? `<a href="${esc(entry.sourceUrl)}" target="_blank" rel="noopener">Open article ↗</a>` : ""}<span>${esc(entry.note || `${entry.articleText.length.toLocaleString()} characters saved`)}</span></div><div><button type="button" class="subtle" data-copy-clipping="${esc(entry.id)}">Copy text</button><button type="button" class="danger-text" data-remove-clipping="${esc(entry.id)}">Remove</button></div></article>`,
            )
            .join("")}</div>`
        : '<p class="help">No full articles or excerpts saved yet.</p>';
      $$('[data-copy-clipping]', root).forEach(
        (button) =>
          (button.onclick = () => {
            const entry = workingClippings.find((row) => row.id === button.dataset.copyClipping);
            if (entry) copy(entry.articleText, "Article text copied.");
          }),
      );
      $$('[data-remove-clipping]', root).forEach(
        (button) =>
          (button.onclick = () => {
            workingClippings = workingClippings.filter(
              (row) => row.id !== button.dataset.removeClipping,
            );
            renderClippings();
          }),
      );
    };
    const addSourceLine = () => {
      const type = $("#article-source-type").value;
      const title = $("#article-title").value.trim() || "Article";
      const url = $("#article-url").value.trim();
      const note = $("#article-note").value.trim();
      if (!url) return toast("Add the article link first.");
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return toast("Add a valid https:// article link.");
      }
      if (parsed.protocol !== "https:") return toast("Article links must use https://");
      const sourceBox = $("[name=sources]");
      const line = [type, title, parsed.toString(), note].filter(Boolean).join(" | ");
      if (!sourceBox.value.includes(parsed.toString()))
        sourceBox.value = [sourceBox.value.trim(), line].filter(Boolean).join("\n");
      toast("Article link added to sources.");
    };
    $("#compose-story-now").onclick = () => updateFullStory(true);
    $$(".story-section-input").forEach(
      (input) =>
        (input.oninput = () => {
          if ($("[name=auto-compose]").checked) updateFullStory();
        }),
    );
    $("[name=auto-compose]").onchange = (event) => {
      if (event.target.checked) updateFullStory(true);
    };
    $("#add-article-link").onclick = addSourceLine;
    $("#paste-article-text").onclick = async () => {
      try {
        $("#article-text").value = await navigator.clipboard.readText();
        toast("Clipboard text pasted.");
      } catch {
        $("#article-text").focus();
        toast("Press and hold in the article box, then choose Paste.");
      }
    };
    $("#save-article-clipping").onclick = () => {
      const articleText = $("#article-text").value.trim();
      if (!articleText) return toast("Paste the article text or an excerpt first.");
      if (workingClippings.length >= 10)
        return toast("This chapter already has the 10-clipping limit.");
      const url = $("#article-url").value.trim();
      if (url) {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:") throw Error();
        } catch {
          return toast("Article links must be valid https:// addresses.");
        }
        addSourceLine();
      }
      workingClippings.push({
        id: crypto.randomUUID(),
        title: $("#article-title").value.trim() || "Untitled article",
        sourceUrl: url,
        articleText,
        note: $("#article-note").value.trim(),
        addedAt: new Date().toISOString(),
      });
      $("#article-text").value = "";
      renderClippings();
      toast("Private article clipping saved.");
    };
    renderClippings();
    $("#cancel-history-edit").onclick = () => $("#modal").close();
    $("#almanac-form").onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      try {
        const autoCompose = data.get("auto-compose") === "on";
        const draft = {
          ...item,
          kind: String(data.get("kind")),
          status: String(data.get("status")),
          from: data.get("from") || null,
          to: data.get("to") || null,
          title: String(data.get("title") || "").trim(),
          subtitle: String(data.get("subtitle") || "").trim(),
          opening: String(data.get("opening") || ""),
          autoCompose,
          fullStory: String(data.get("full-story") || ""),
          facebookPost: String(data.get("facebook-post") || ""),
          sections: Object.fromEntries(
            ["feel", "stars", "teams", "stats", "changes", "forgotten", "moment", "connection"].map(
              (key) => [key, String(data.get(`section-${key}`) || "")],
            ),
          ),
          sources: parseSources(data.get("sources"), item.sources),
          researchClippings: workingClippings,
          graphicNotes: String(data.get("graphic-notes") || ""),
          notes: String(data.get("notes") || ""),
          updatedAt: new Date().toISOString(),
        };
        if (autoCompose) draft.fullStory = composeStoryFromSections(draft);
        const saved = cleanChapter(draft);
        if (!saved.title) throw Error("Add a chapter title.");
        mutate(() => {
          const index = almanac().chapters.findIndex((row) => row.id === saved.id);
          if (index < 0) almanac().chapters.push(saved);
          else almanac().chapters[index] = saved;
        }, "Historical chapter saved.");
        $("#modal").close();
      } catch (error) {
        toast(error.message);
      }
    };
    if ($("#delete-history-entry"))
      $("#delete-history-entry").onclick = () => {
        mutate(() => {
          almanac().chapters = almanac().chapters.filter((row) => row.id !== item.id);
          for (const team of Object.values(getState().boards))
            for (const candidate of team.candidates)
              candidate.profile.historyLinks = (candidate.profile.historyLinks || []).filter(
                (linked) => linked !== item.id,
              );
        }, "Historical chapter deleted.");
        $("#modal").close();
      };
  }

  function openArticleAdder(id) {
    const item = chapter(id);
    if (!item) return;
    const sectionOptions = [
      ["general", "General research"],
      ["feel", "What baseball felt like"],
      ["changes", "Rules, equipment, and ballparks"],
      ["stars", "Great players"],
      ["teams", "Teams and champions"],
      ["stats", "Numbers that explain the era"],
      ["forgotten", "Forgotten lore"],
      ["moment", "Historic moment"],
      ["connection", "Connection to today"],
    ];
    openModal(
      `Add research: ${item.title}`,
      `<form id="quick-article-form"><div class="modal-body quick-article-adder"><div class="notice"><strong>Source material stays private.</strong> Only your own takeaway is added to the story, and only when you choose that option.</div><div class="form-grid"><label>Source type<select name="type"><option>Other</option><option>Wikipedia</option><option>MLB</option><option>Baseball Almanac</option></select></label><label>Supports section<select name="section">${sectionOptions.map(([value, name]) => `<option value="${value}">${esc(name)}</option>`).join("")}</select></label></div><label>Article title<input name="title" maxlength="300" placeholder="Article title"></label><label>Website or article link<input name="url" type="url" maxlength="2000" placeholder="https://..."></label><label>My takeaway or draft paragraph<textarea name="note" rows="5" maxlength="4000" placeholder="Write the fact, idea, or paragraph you want to use in your own words."></textarea></label><div class="article-paste-heading"><strong>Full article or excerpt</strong><button type="button" class="subtle" id="quick-paste-article">Paste from clipboard</button></div><textarea name="article-text" rows="12" maxlength="150000" aria-label="Full article or excerpt" placeholder="Optional: paste the article here for private reference."></textarea><small class="help">A link or pasted text is required. Pasted source text is never copied into the finished post automatically.</small></div><div class="modal-footer"><button type="button" class="subtle" id="quick-article-back">Back</button><div><button type="submit" class="subtle">Save research only</button><button type="button" class="primary" id="save-and-add-takeaway">Save + add my takeaway</button></div></div></form>`,
      true,
    );
    const form = $("#quick-article-form");
    const save = (addToStory) => {
      const data = new FormData(form);
      const rawURL = String(data.get("url") || "").trim();
      const articleText = String(data.get("article-text") || "").trim();
      const note = String(data.get("note") || "").trim();
      const section = String(data.get("section") || "general");
      if (!rawURL && !articleText)
        return toast("Add an article link or paste the article text.");
      let url = "";
      if (rawURL) {
        try {
          const parsed = new URL(rawURL);
          if (parsed.protocol !== "https:" || parsed.username || parsed.password)
            throw Error();
          url = parsed.toString();
        } catch {
          return toast("Article links must be valid https:// addresses.");
        }
      }
      if (addToStory && (section === "general" || !note))
        return toast("Choose a story section and write your takeaway first.");
      if (articleText && (item.researchClippings?.length || 0) >= 10)
        return toast("This chapter already has the 10-clipping limit.");
      const type = String(data.get("type") || "Other");
      const title =
        String(data.get("title") || "").trim() ||
        (url ? new URL(url).hostname.replace(/^www\./, "") : "Pasted research article");
      mutate(() => {
        if (url && !item.sources.some((source) => source.url === url))
          item.sources.push({
            id: crypto.randomUUID(),
            type,
            label: title,
            url,
            note: note || `Research for ${sectionOptions.find(([key]) => key === section)?.[1] || "this chapter"}.`,
            checkedAt: "",
          });
        if (articleText)
          item.researchClippings.push({
            id: crypto.randomUUID(),
            title,
            sourceUrl: url,
            articleText,
            section,
            note,
            addedAt: new Date().toISOString(),
          });
        if (addToStory) {
          item.sections[section] = [item.sections[section], note]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .join("\n\n");
          if (item.autoCompose) item.fullStory = composeStoryFromSections(item);
        }
        item.updatedAt = new Date().toISOString();
      }, addToStory ? "Research saved and your takeaway added to the story." : "Research saved.");
      openChapter(id);
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      save(false);
    };
    $("#save-and-add-takeaway").onclick = () => save(true);
    $("#quick-article-back").onclick = () => openChapter(id);
    $("#quick-paste-article").onclick = async () => {
      try {
        $("[name=article-text]", form).value = await navigator.clipboard.readText();
        toast("Clipboard text pasted.");
      } catch {
        $("[name=article-text]", form).focus();
        toast("Press and hold in the article box, then choose Paste.");
      }
    };
  }

  function openResearch(id) {
    const item = chapter(id);
    if (!item) return;
    if (item.kind === "prelude") return openArticleAdder(id);
    openModal(
      `Research: ${item.title}`,
      `<div class="modal-body research-desk-modal"><div class="research-source-buttons"><a href="https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(item.title + " baseball")}" target="_blank" rel="noopener">Search Wikipedia</a><a href="https://www.mlb.com/history" target="_blank" rel="noopener">Open MLB History</a><a href="https://www.baseball-almanac.com/" target="_blank" rel="noopener">Open Baseball Almanac</a></div><div id="history-research-results"><div class="loading-copy">Gathering a small set of Wikipedia starting points…</div></div><p class="help">This is a research aid, not an automatic final story. Review the full pages and verify important claims before marking the chapter reviewed.</p></div><div class="modal-footer"><button class="subtle" id="research-back">Back to chapter</button><button class="primary" id="save-research-sources" disabled>Add selected sources</button></div>`,
      true,
    );
    $("#research-back").onclick = () => openChapter(id);
    const addArticle = document.createElement("button");
    addArticle.type = "button";
    addArticle.className = "subtle";
    addArticle.textContent = "Add website or article";
    addArticle.onclick = () => openArticleAdder(id);
    $("#save-research-sources").before(addArticle);
    fetch(`/api/history-research?q=${encodeURIComponent(item.title)}&from=${item.from || ""}&to=${item.to || ""}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Research source is unavailable.");
        const results = data.results || [];
        $("#history-research-results").innerHTML = results.length
          ? `<div class="research-results">${results.map((result, index) => `<label><input type="checkbox" data-research-result="${index}" checked><span><strong>${esc(result.title)}</strong><small>${esc(result.extract || "Open the article to review the full context.")}</small><a href="${esc(result.url)}" target="_blank" rel="noopener">Open full article ↗</a></span></label>`).join("")}</div>`
          : '<div class="notice">No confident Wikipedia matches were returned. Use the source buttons above.</div>';
        const save = $("#save-research-sources");
        save.disabled = !results.length;
        save.onclick = () => {
          const chosen = $$('[data-research-result]:checked').map(
            (box) => results[Number(box.dataset.researchResult)],
          );
          mutate(() => {
            const existing = new Set(item.sources.map((source) => source.url));
            for (const result of chosen)
              if (!existing.has(result.url))
                item.sources.push({
                  id: crypto.randomUUID(),
                  type: "Wikipedia",
                  label: result.title,
                  url: result.url,
                  note: "Orientation source. Verify important claims with another source.",
                  checkedAt: new Date().toISOString(),
                });
            item.updatedAt = new Date().toISOString();
          }, `${chosen.length} research source${chosen.length === 1 ? "" : "s"} saved.`);
          openChapter(id);
        };
      })
      .catch((error) => {
        $("#history-research-results").innerHTML = `<div class="notice warning">${esc(error.message)} Use the direct source buttons and try again later.</div>`;
      });
  }

  function exportAll() {
    download(
      `legacy-lore-historical-almanac-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(almanac(), null, 2),
      "application/json",
    );
    toast("Historical Almanac exported.");
  }

  function bind(view) {
    if (view === "years") {
      $$('[data-history-open]').forEach(
        (button) => (button.onclick = () => openChapter(button.dataset.historyOpen)),
      );
      $$('[data-history-edit]').forEach(
        (button) => (button.onclick = () => openEditor(button.dataset.historyEdit)),
      );
      $$('[data-history-research]').forEach((button) => {
        const item = chapter(button.dataset.historyResearch);
        button.textContent = item?.kind === "prelude" ? "Add article" : "Find sources";
        button.onclick = () => openResearch(button.dataset.historyResearch);
        if (item?.kind !== "prelude") {
          const add = document.createElement("button");
          add.type = "button";
          add.className = "subtle";
          add.textContent = "Add article";
          add.onclick = () => openArticleAdder(button.dataset.historyResearch);
          button.after(add);
        }
      });
      $$('[data-history-copy]').forEach(
        (button) =>
          (button.onclick = () => {
            const item = chapter(button.dataset.historyCopy);
            copy(item.facebookPost || item.fullStory, "Facebook copy copied.");
          }),
      );
      $("#add-history-chapter").onclick = () => openEditor();
      $("#export-almanac").onclick = exportAll;
      $("#import-story-trigger").onclick = () => $("#story-file").click();
      $("#story-file").onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
          const items = importStoryFile(file.name, await file.text());
          mutate(() => {
            const ids = new Set(almanac().chapters.map((row) => row.id));
            for (const item of items) {
              if (ids.has(item.id)) item.id = crypto.randomUUID();
              almanac().chapters.push(item);
            }
          }, `${items.length} stor${items.length === 1 ? "y" : "ies"} imported.`);
        } catch (error) {
          toast(`Import rejected: ${error.message}`);
        }
      };
    } else if (view === "desk") {
      $("#desk-add-chapter").onclick = () => openEditor();
      $("#desk-export").onclick = exportAll;
      $("#desk-open-first").onclick = () => {
        const next = almanac().chapters.find((item) => item.status === "draft") || almanac().chapters[0];
        if (next) openChapter(next.id);
      };
      $("#desk-copy-ready").onclick = () => {
        const next = almanac().chapters.find((item) => item.status === "ready") || almanac().chapters.find((item) => item.facebookPost);
        if (!next) return toast("No Facebook-ready chapter yet.");
        copy(next.facebookPost || next.fullStory, "Facebook copy copied.");
      };
      $("#desk-daily").onclick = () => {
        const today = new Date();
        openEditor("", {
          kind: "daily",
          from: today.getUTCFullYear(),
          to: today.getUTCFullYear(),
          title: `On This Day: ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}`,
          subtitle: "A date from baseball's scrapbook",
        });
      };
    }
  }

  return { renderYears, renderDesk, bind, openChapter, openEditor, exportAll };
}
