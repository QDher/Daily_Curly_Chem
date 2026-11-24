# Interfaces

Contracts between the parts of the curly-arrow work. A change on one side of a contract is made together with the
other side, its tests and the version named here, and is noted in `docs/DECISIONS.md` when it changes behaviour.
Code is the reference for exact fields; this file says where they are and who depends on them.

Versions on 2026-11-21: arrows 0.1.1, readings 0.1.0, recognizer 0.4.0, solver 0.1.0, page 0.2.0, agent ink 0.2.0,
agent script 0.1.5, review data 0.3.0.

| # | From → to | What passes | Defined in | Version | Checked by |
|---|---|---|---|---|---|
| I1 | Site repositories (QDher/Daily-organic-chemistry-puzzles, QDher/Daily-name-reaction-puzzle) → daily sets | `data/problems.json` of each site on `main`, downloaded every day at 03:30 UTC; problems dated before the set date (One-Pot: undergraduate and graduate only; Name Reaction Daily: all) become 5 arrow tasks and 5 structures to copy in `data/daily/<date>.json` and `data/daily/index.json`; built every day, a day dated Saturday or Sunday listed by the page from the next Monday (`Tasks.releaseDate`) | `.github/workflows/pages.yml`; `tools/make_daily.js`; `src/solver.js` | `Solver.VERSION` | `node test/test_daily.js`; fixtures `test/fixtures/problems_*.json` |
| I2 | Test page → entries files (people and agents) | One JSON file per tester and device, `curly-entries-<label>-<device tag>.json`; entries of kind `arrows`, `drawing`, `votes`, `questionnaire`, `remark`, each with tool versions (`versions.page` from page 0.2.0) | `index.html` (entry objects); `tools/replay.js` | `PAGE` in `index.html`; module versions | `tools/replay.js` (every current-version entry replays); `npm run test:page` |
| I3 | Agent run → review page | `runs/index.json` (one line per run: runId, date, visibleFrom (review data 0.4.0), tester, ink, script, figures, report), `runs/<runId>.json` (attempts with ink, scene, readings, outcome; structures), `entries/<file>`; runId `<date>_<tester>` or `<date>_<tester>_<suffix>` | `tools/agent_tester.js`; `tools/agent_review_data.js` | agent script, review data | `npm run test:agent`; the scheduled run's replay |
| I4 | Review page → labels | Database documents `reviews/<reviewer id>/answers/<runId>__<set>__<task>__<attempt>`: `expected` (yes, no, unsure: should it give the right structure), `outcome` (right, wrong, unsure: was the page's outcome right), `drawing` (`not-person` or empty), `note`, `type`, `at`. Label = `expected` crossed with the page outcome of the run file (confirmation, weakness of the page, page too permissive, correct rejection), refined by `outcome` when the page did not give the right structure (page misread: `expected` no, another structure read, `outcome` wrong; decision 50) | `tools/agent_review_page.html`; `docs/PLAN.md` F | review page | read with the ArtifactData tool; never written by sessions |
| I5 | Tasks → reference arrows | Atom and bond ids of the shown structures, including hydrogens shown as atoms (`h1` for `drawH`, `x1`, ... for the others); reference arrows refer to them | `src/tasks.js` (`showHydrogens`); `data/tasks.json`; `docs/SCENE.md` | `PAGE`; `Arrows.VERSION` | `node test/test_tasks.js`; `node test/test_daily.js` |
| I6 | People's strokes → fixtures | Stroke points only (no timing, pressure, label or text), with the agreement of the person who drew them; `reads` and `recognizer` fields rebuilt after a recognizer change | `test/fixtures/drawings_*.json`; `tools/update_fixture.js` | recognizer | `node test/test_recognize.js` |
| I7 | Modules → site repositories (stage 3) | Versioned copy of the modules into `src/` of both sites, by pull request | `docs/PLAN.md` F | module versions | the sites' own tests |
| I8 | Test page → Worker (stage 3) | Table `mech_entries`, site key `mechpilot`, export with `MECH_EXPORT_KEY` (never in a repository); off until the merge (decision 7) | branch `claude/beautiful-pasteur-7tg1k3` of QDher/Daily-organic-chemistry-puzzles | – | Worker tests on that branch |

Not yet defined (request R1 on `docs/BOARD.md`): where people's entries files are kept, and the format and storage
of the labels given to human drawings.
