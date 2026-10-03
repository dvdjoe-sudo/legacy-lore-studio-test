# Legacy Lore Studio — changes by Cooper (2026-10-03)

Work done on the source exported from the ChatGPT dev chat on 2026-10-03.
All 134 automated tests pass (`node --test tests/*.test.mjs`).
Verified end to end in a real browser (Mets Clubhouse auto-draft) and across
all 30 franchises (every auto-draft completes 26/26 with zero errors).

## DH rules (current, from Joe 2026-10-03)

Implemented the current DH rulebook:

1. **Rule 1+2 — DH goes to the best hitter, no DH-experience preference**
   (`public/legends.js` `draftRoster`). Removed the true-DH first pick. The DH
   is now chosen purely by run production (powerScore: OPS+, power, batting
   runs, longevity credit). No penalty for never playing DH, no bonus for
   having DH'd. True-DH data is still used for the DH comparison display.

2. **Rule 5 — DH glove rule** (`public/legends.js` `applyDHGloveRule`). After
   the nine are set, the DH is compared with the top 3 starters he could
   replace in the field. If the DH has the better glove by 1+ run per 150
   games (career runsDefense rate), he plays the field and the other guy DHs.
   This produces the rulebook's signature outcome: DiMaggio in CF, Mantle at
   DH for the Yankees (verified).

3. **Rule 6 — eligibility is 25%+ of team games or the most-played spot**
   (`public/legends.js` `meaningfulPositions`, `public/apex-roster.js`
   `positionWork`). Replaces the v0.4 25%-or-100-games rule. A 50-game floor
   keeps tiny cameos from counting. Falls back to share of field work when
   team games are missing. The most-played fallback guarantees every player
   is eligible somewhere (this is what moved Wagner back to SS).

4. **Rule 8 — Close Call flag** (`public/legends.js` `draftRoster`). When the
   top two DH candidates are within 5% on the hitting-only score, a "Close
   call at DH" note is added to the roster overrides. (Fan-override pins are
   a manual-roster feature; the app respects manual edits.)

## Stat engine review (Joe asked 2026-10-03)

Three issues found and fixed:

1. **DH formula cleaned to match Rule 2** (`public/legends.js` `powerScore`).
   Removed the APEX_F term: the H-lane APEX can include baserunning, which
   Rule 2 excludes, and its hitting signal was already captured by OPS+ and
   batting runs. The score is now purely OPS+ (with longevity credit), power
   (HR), and batting runs. Result: 7 teams get a better pure slugger at DH,
   all improvements (BOS Ortiz over Williams with Williams staying in LF;
   MIN Killebrew over Yost; CLE Manny Ramirez; MIL Fielder; CHC Hack Wilson;
   BAL Boog Powell).

2. **Glove-rule data guardrail** (`public/legends.js` `applyDHGloveRule`).
   Per-position defensive data does not exist in the app data (only career
   runsDefense). Added a guardrail: the DH must have played at least half his
   field games at the compared position, so the career rate is a fair proxy
   for his glove there. True per-position defense is a data-pipeline item.

3. **Lineup order audited.** The `recommendedBattingOrder` logic follows
   standard baseball construction (speed/OBP leadoff, table-setter 2nd,
   best all-around 3rd, power cleanup 4th-5th, then by offense). No changes
   needed; it now uses the cleaned DH formula for its power component.

Rules 3 (pitchers excluded from league averages), 4 (picked together), and 7
(bench bat uses the same hitting-only score) were already satisfied or live
in the data pipeline.

## Changelog audit (Joe's APEX change log, v0.1-v0.7.3)

Went through every entry. Most were already in the code, superseded, or live
in the data pipeline (ChatGPT side, not app code). Implemented the three that
were real, missing, and safe:

1. **v0.4 — 25%-or-100-games eligibility** (`public/legends.js`
   `meaningfulPositions`, `public/apex-roster.js` `positionWork`). A position
   now counts as meaningful with 100+ games, or 50+ games making up at least
   25% of the player's field work. Replaces the old 200-game / 10% rule and
   the "most-played always counts" clause. Same definition in both modules.
   **Superseded 2026-10-03 by DH rule 6 above.**

2. **v0.4 — 2 lefty / 2 righty rotation** (`public/legends.js`
   `draftRoster`). For SP4/SP5 in the balanced strategy, a left-hander is
   preferred when within 25% of the arm already slotted, so balance never
   forces a clearly inferior starter. Apex strategy stays pure merit.
   Examples: Houston swaps Keuchel in at SP5, the Mets run Matlack/Koosman
   4-5, Washington stays all-righty (no lefty within range — guardrail held).

3. **DH slot compares on Franchise APEX-H** (`public/apex-roster.js`
   `rosterMetric`). The DH slot used a vestigial DH position slice (~0 for
   nearly every player), showing "RosterPos DH 0.0" in the picker and mixing
   units in override checks. DH now always compares on overall franchise
   hitting value, matching the draft logic (true DH first, then best power
   bat). Dropdown now reads "Pete Alonso · First base ·
   Franchise APEX-H 14.2 · F-APEX 14.2".

Deliberately NOT implemented, with reasons:

- **v0.3 "Top-4 bats can't lead off": built it, tested all 30 teams, reverted
  it.** The ban is faithful to the changelog but the current table-setter
  scoring already does the job better: it picks genuine table-setters
  (Henderson, Raines, Ichiro, Jeter, Biggio types). The hard ban made three
  lineups worse, worst case Cleveland going from Jose Ramirez (a real
  leadoff hitter) to Albert Belle. The v0.3 rule was written for a dumber
  version of the app and is superseded. Best hitter still bats 3rd.
- **v0.2 "Closer by quality, not saves": superseded.** The defined-roles
  bullpen came later; a closer is defined by saves, and RP-lane APEX already
  breaks ties. Every drafted closer has 50+ saves.
- **v0.2 "APEX-V only breaks ties": already true** (tiebreak after
  coverage/quality for UTIL).
- **v0.4 "Utility SS glove check": already satisfied** — every drafted UTIL
  covers SS.
- **v0.7.2 fan-override pins: removed in v0.7.3** ("same result" via the DH
  glove rule); the overrides + explanations system covers it.
- **Data-pipeline items** (military years in Prime5, corner OF combined,
  Total Zone blend, Retrosheet/Statcast/park/leverage, 2022-25 league fix,
  season floor, pre-1953 fielding): generated on the ChatGPT side, not
  changeable from app code.

## Earlier fixes (same session)

- The four September 29 fixes were already in the exported code and verified
  working: Piazza bats 4th (Beltran leads off), Alonso DH / Olerud CI,
  automatic role-fit explanations, notable omissions with reasons.
- `tests/starter-data.test.mjs`: APEX_F additivity now uses 1e-9 tolerance
  instead of strict equality (1-ULP data-generation noise). Test-only.
- `tests/mets-clubhouse.test.mjs`: new test locking the DH metric fix.
- `tests/changelog-v04.test.mjs`: new tests for the rotation balance
  (Houston gains Keuchel; Washington's guardrail holds all-righty) and the
  eligibility rule.

## Test site

https://dvdjoe-sudo.github.io/legacy-lore-studio-test/ (public repo
dvdjoe-sudo/legacy-lore-studio-test). Fixed build, for Joe to click around.
Cloud-save /api/* calls fail gracefully there; everything else works.

## How to publish

Feed these files back through the ChatGPT "Edit site" flow. Nothing here
touches the live site until ChatGPT republishes it. `node build.mjs`
(regenerates `server/assets.generated.js`) needs one `npm install` first.
