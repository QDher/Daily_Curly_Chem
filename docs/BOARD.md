# Board

Work queue of the curly-arrow work, shared by the two sides that work on this repository:
- **people side**: test run with people, entries files, evaluation of human drawings, `docs/WEAKNESSES.md`;
- **agent side**: agent testers, review page, reviewers' judgements, `tools/agent_*`, `docs/AGENT_TESTER.md`;
- **user**: decisions, testers, reviewers.

Rules: read this file and `docs/DECISIONS.md` at the start of a session; update both before ending. A request to the
other side is a row under "Requests between the sides", answered in the row or in a `docs/handoff/` file that the row
links. Before changing a shared file (`src/`, `index.html`, `data/tasks.json`), add a row under "Shared files being
changed" and remove it when the change is pushed. Figures come from files or command outputs, with their date.

Last updated: 2026-11-21 (agent side).

## Links

| What | Link |
|---|---|
| Workflow of the two sides (flow chart, 15 steps; claude.ai artifact, private to the owner unless shared) | https://claude.ai/artifact/XxThPg1cfRoqeTtsEGNHoR |
| Review page of the agent testers (claude.ai artifact) | https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4 |
| Test page (unlisted, opened with a tester link) | https://qdher.github.io/Daily_Curly_Chem/ |
| Deployments (GitHub Actions, "Deploy GitHub Pages") | https://github.com/QDher/Daily_Curly_Chem/actions/workflows/pages.yml · https://github.com/QDher/Daily-organic-chemistry-puzzles/actions/workflows/pages.yml · https://github.com/QDher/Daily-name-reaction-puzzle/actions/workflows/pages.yml |

## Shared files being changed

| Files | Side | What | Since | Until |
|---|---|---|---|---|
| `src/recognize.js`, `src/canvas.js`, `src/scene.js`, `index.html` | agent side | Round 1 (B1, B2): reading rules from judged agent entries; item 6 (overlaps in shown structures). Starts from recognizer 0.4.0 (people side, 29ceade) | 2026-11-21 | end of round 1 |

## Open items

| # | Item | Owner | Status | Notes |
|---|---|---|---|---|
| B1 | Reading-rule fixes from judged agent entries | agent side | scheduled 2026-11-21 | Up to 2026-11-20: 17 distinct copy attempts judged readable that the page did not confirm, 27 judgements "page too permissive" on copies; check first what recognizer 0.4.0 already fixes; measure on both fixtures of people |
| B2 | Item 6: no overlap of bonds, labels and charge signs in structures shown by the page | agent side | scheduled 2026-11-21 | Hold lifted (decision 26); screenshots to the user before the distortion limits (proposed 15° and 15 %) are fixed |
| B3 | Agent ink 0.3.0: arrows bulge to the side free of bonds and of the other arrows | agent side | scheduled 2026-11-21 | 11 reviewer notes on overlapping arrows; all 11 attempts were read correctly by the page |
| B4 | Calibrate the agents' ink on people's strokes, per device | agent side | planned | Strokes now in `test/fixtures/drawings_2026-11-20.json` (168 drawings; pen and touch 145, mouse 23). Check: agents should fail like people, category by category |
| B5 | Weakness cases 13 to 18 (people) | people side | 13, 14 partly fixed (recognizer 0.4.0); 15 to 18 open | `docs/WEAKNESSES.md` |
| B6 | Method of the evaluation of human drawings (who judges, questions, labels, storage) | people side | unknown to the agent side | Request R1 |
| B7 | Contact e-mail of the test run (`contact` in `data/config.json`, public) | user | open since 2026-11-13 | A dedicated address is suggested; needed before testers are invited |
| B8 | More testers, with touch screens and pens | user | open | Today: one tester with pen and some touch, the creator with a mouse |
| B9 | Use only labels on which both reviewers agree | user | proposed 2026-11-20, not decided | Copies: kappa 0.74 on 103 attempts judged by both (up to 2026-11-20) |
| B10 | Written convention for reviewers on arrows | user, reviewers | proposed 2026-11-20 | Arrows: kappa 0.38 on 92 attempts judged by both; the notes show different criteria (start at the charge or the lone pair, end on the bond or the atom) |
| B11 | Review of the agent testers after two weeks: cost, report quality, calibration, more testers per day | user | due about 2026-11-30 | `docs/PLAN.md` F |
| B12 | Retirement check (98 % bound) of the agent testers | agent side | no tester reached it on 2026-11-20 | Closest: john0002, lower bound 0.87 for "correct" (threshold 0.90) |
| B13 | Arrow attempts judged "should not give the structure" that the page accepted (52 judgements up to 2026-11-20) | agent side | open | Examine before using them as labels (depends on B10) |
| B14 | Merge of the Worker part (`mech_entries`) | user | at the start of stage 3, not before | Decision 7 |
| B15 | Pages deploys of the two site repositories failed on 2026-11-21 ("No artifacts named github-pages", 01:35 and 01:55 to 02:31 UTC); today's problems were not live until a new run | any side | fixed by new runs at 02:31 UTC; watch | A re-run of the failed job fails again ("Multiple artifacts"); start a new run instead (Actions, "Run workflow"). If it recurs: split the workflow into a build job and a deploy job |

## Requests between the sides

| # | Date | From → to | Request | Status | Answer |
|---|---|---|---|---|---|
| R1 | 2026-11-21 | agent side → people side | Describe the evaluation of human drawings in `docs/handoff/human-drawing-evaluation_<date>.md`: (1) scope and outputs; (2) who judges, with which questions and labels, stored where, agreement between judges; (3) entries files used (dates, labels, devices, counts) and where they are kept; (4) testers planned, invitation status, devices wanted; (5) files of the repositories that the people side changes; (6) decisions taken or pending that change `docs/PLAN.md` (readiness thresholds, evaluation measures, start conditions, use of judged agent entries); (7) what the people side needs from the agent testers | open | – |

## Cycle

Daily:
1. 03:30 UTC: the workflow builds the daily set from the problems of the two site repositories (`docs/INTERFACES.md` I1).
2. 06:17 New York: the scheduled task runs the agent testers and publishes the runs to the review page (I3).
3. Reviewers judge the new attempts in the review page (I4).

Weekly:
1. People's entries files arrive; the people side replays them and updates `docs/WEAKNESSES.md` (I2).
2. One fix round on the shared files, with one owner recorded above; the gain is measured on people's fixtures,
   judged agent entries serve as the no-regression set.
3. The agent side recalibrates the ink when new strokes of people are available (B4).
4. Both sides update this board and `docs/DECISIONS.md`.
