# Decision log

One line per decision about the curly-arrow work (this repository, the test run, the agent testers and the review
page). Append new lines at the end; do not rewrite old ones. When a decision replaces an earlier one, add a line and
write "replaced by line N" in the Status column of the earlier one. A decision exists for the other side only once
it is here; chat transcripts are not read across sessions.

By: "user" for a decision of the creator; "session" for a choice made in a working session and kept since (the commit
or file says why). Where: the file that holds the full rule.

Lines 1 to 30 were collected on 2026-11-21 from `CLAUDE.md`, `docs/CONTEXT.md`, `docs/AGENT_TESTER.md`,
`docs/PLAN_DRAWING.md` and `docs/PLAN.md` (formerly `ML_PLAN.md` of QDher/Daily-organic-chemistry-puzzles).

| # | Date | Decision | By | Where | Status |
|---|---|---|---|---|---|
| 1 | 2026-11-11 | A curly-arrow interface and models are developed for the two daily sites (goals, components C1 to C4) | user | `docs/PLAN.md` A, C | in force |
| 2 | 2026-11-13 | The test-run page lives in its own repository (QDher/Daily_Curly_Chem), on its own unlisted GitHub Pages site, opened with a personal tester code | user | `docs/PLAN.md` F; `README.md` | in force |
| 3 | 2026-11-13 | A daily set dated D uses only problems published before D, newest first | user | `docs/CONTEXT.md` "Daily set" | in force |
| 4 | 2026-11-13 | Stroke points of `test/fixtures/drawings_2026-11-13.json` may be kept in the repository (agreement of the person who drew them) | user | `CLAUDE.md` | in force |
| 5 | 2026-11-13 | The contact e-mail of the test run is decided later; remind the user before testers are invited | user | `CLAUDE.md` | open (board B7) |
| 6 | 2026-11-14 | Overall plan in six stages, from the test run (stage 1) to a model that draws human-like mechanisms (stage 6) | user | `docs/PLAN.md` "Overall plan in six stages" | in force |
| 7 | 2026-11-14 | Entries stay files saved by testers; the Worker part (`mech_entries`) is merged at the start of stage 3, not before (replaces the order of 2026-11-13: merge after the training work) | user | `docs/PLAN.md` E; `CLAUDE.md` | in force |
| 8 | 2026-11-14 | Several sessions may change the page; before a push that touches the page, rebase on `origin/main` and `npm run check` must pass | user | `CLAUDE.md` | in force |
| 9 | 2026-11-14 | A daily set has 5 arrow tasks and 5 structures to copy (before: 10 structures) | user | `docs/CONTEXT.md` | in force |
| 10 | 2026-11-14 | Agent testers (john0002, john0003, ...): synthetic entries, never counted with entries of people, never used to evaluate a model, never committed; a name, seed or traits are never reused or changed after a run | user | `docs/PLAN.md` F; `docs/AGENT_TESTER.md` | in force |
| 11 | 2026-11-14 | Attempts judged in the review page are "judged agent entries": kept with the answers, used to find weaknesses and as labelled training examples | user | `docs/PLAN.md` F | in force |
| 12 | 2026-11-14 | A tester judged always correct, or always incorrect, with a one-sided 98 % bound above 90 % is retired and replaced by a new tester closer to the less clear-cut cases | user | `docs/PLAN.md` F | in force |
| 13 | 2026-11-14 | Ketcher is replaced by the curly interface for the curly_merge users in stage 3 and for all visitors in stage 5 (before: kept, freehand as an addition) | user | `docs/PLAN.md` "Open decisions" | in force |
| 14 | 2026-11-14 | Eleven drawing items are planned (`docs/PLAN_DRAWING.md`); the page is not changed for them while the first test run collects data | user | `docs/PLAN_DRAWING.md` | in force, except line 26 |
| 15 | 2026-11-14 | Hydrogens on carbon are excluded from the rule "H written next to an atom is bonded to it" (item 7) | user | `docs/PLAN_DRAWING.md` 7 | in force |
| 16 | 2026-11-14 | Monte Carlo generation of synthetic arrow strokes to fit `Readings.P`: noted as an option, not adopted | user | `docs/PLAN.md` "Decided on 2026-11-14" | in force |
| 17 | 2026-11-14 | Data generation and evaluation stay as in the plan: entries of people; judged agent entries kept apart | user | `docs/PLAN.md` | in force |
| 18 | 2026-11-16 | Agent testers run every day as a Claude Code scheduled task (not Claude Console), every tester every day (before: one tester per day) | user | `docs/AGENT_TESTER.md`; `docs/AGENT_TASK_PROMPT.md` | in force |
| 19 | 2026-11-16 | The review page shows one run date at a time and keeps every run | user | `docs/AGENT_TESTER.md` | in force |
| 20 | 2026-11-16 | Several reviewers, each under their own account; their answers are kept apart; every judgement counts on its own, also in the 98 % bound | user | `docs/PLAN.md` F; `docs/AGENT_TESTER.md` | in force |
| 21 | 2026-11-16 | Structures in the review page show every hydrogen of an atom other than carbon as a bond; hydrogens of carbon stay implicit | user | `docs/AGENT_TESTER.md` | in force |
| 22 | 2026-11-16 | In copies, the agents draw hydrogens of atoms other than carbon as bonds ending on a typed H (ink 0.2.0) | user | `docs/AGENT_TESTER.md` | in force |
| 23 | 2026-11-16 | A run made again with a new ink is added beside the first run (`<date>_<tester>_<suffix>`); the first run and its answers are kept | user | `docs/AGENT_TESTER.md` | in force |
| 24 | 2026-11-16 | The intro of the test page offers a day selection of the daily sets | user | `docs/CONTEXT.md` | in force |
| 25 | 2026-11-17 | The fixed set of `data/tasks.json` is no longer offered to testers; it is shown only with `?set=standard` (tests, agent testers) | session (8a98d15) | `CLAUDE.md`; `docs/CONTEXT.md` | in force |
| 26 | 2026-11-20 | The hold of line 14 is lifted for item 6 only (overlaps in structures shown by the page), extended to atom labels and charge signs; done before testers are invited | user | `docs/PLAN_DRAWING.md` | in force (board B2) |
| 27 | 2026-11-20 | Review page: runs drawn with ink 0.1.0 are no longer listed; their files and answers are kept | user | `docs/AGENT_TESTER.md` | in force |
| 28 | 2026-11-20 | Round 1 of rule-based drawing fixes on 2026-11-21: reading rules, item 6, agents' arrows kept off bonds and other arrows | user | `docs/BOARD.md` | in progress (board B1 to B3) |
| 29 | 2026-11-21 | Stroke points of the week files of 2026-11-20 (labels `3005a301`, `4f7c82a3`) may be used like those of line 4; both testers agreed | user | `CLAUDE.md`; `test/fixtures/drawings_2026-11-20.json` | in force |
| 30 | 2026-11-21 | Arrow tasks show every hydrogen of an atom other than carbon as an atom with a bond (page 0.2.0), from weakness case 12 | session (75870fe) | `CLAUDE.md`; `docs/WEAKNESSES.md` 12 | in force |
| 31 | 2026-11-21 | The curly-arrow plan moves from `ML_PLAN.md` of QDher/Daily-organic-chemistry-puzzles to `docs/PLAN.md` here; `ML_PLAN.md` keeps problem selection (stage 2) and points here | user | `docs/PLAN.md` | in force |
| 32 | 2026-11-21 | Coordination through four files in this repository: `docs/DECISIONS.md`, `docs/BOARD.md`, `docs/INTERFACES.md`, `docs/handoff/`; each session reads the board and the log first and writes back before ending | user | `CLAUDE.md` | in force |
| 33 | 2026-11-21 | Copy tasks: the reading is compared with the structure to copy before it is confirmed, and the difference is named (page 0.3.0), from weakness case 15; the tester still decides | user | `CLAUDE.md`; `docs/WEAKNESSES.md` 15 | in force |
| 34 | 2026-11-21 | Recognizer 0.4.0 is the first round on people's drawings (cases 13, 14); the causes left open (rounded ring corners, C of Cl closed, bonds short of the letter, others in `docs/RECOGNITION.md`) wait for the next cycle of improvement | user | `docs/RECOGNITION.md` | in force |
