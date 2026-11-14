# Handoff: agent testers, Claude Console setup, review page (2026-11-14)

Session `session_01HwgXngBmA4gsVTLzMc9YZF`, repository QDher/Daily_Curly_Chem, branch `main`; one plan note on branch
`claude/beautiful-pasteur-7tg1k3` of QDher/Daily-organic-chemistry-puzzles.

## 1. Scope

- An assessment of using Claude agents as testers to produce drawing and arrow data for the test run and for ML.
  Conclusion given to the user: agent ink is synthetic. It is useful for pre-training (R2, I1) with exact labels, for
  a daily end-to-end check of the page and for feedback, but not as tester data. The two traits are set in code,
  not through the model.
- On the user's request: agent testers, the Claude Console resources for one run per day, and a review page where
  the user judges the agents' drawings and the page's outcomes.

## 2. Decisions

| Date | Decision | By |
|---|---|---|
| 2026-11-14 | Agent testers run from the Claude Console, one per day to start with | user |
| 2026-11-14 | Agent testers are named john0002, john0003, and so on | user |
| 2026-11-14 | Agents know the answer of every task; only drawing is tested, with two traits: precision and reproducibility (consistency); each run gives feedback | user |
| 2026-11-14 | Review questions per attempt: could a person draw this; should the arrows/drawing have given the right structure (yes/no/unsure); when the right structure was not found, the resulting structure is shown with "outcome right/wrong/unsure" | user |
| 2026-11-14 | Mapping of names to traits (john0002 precise and consistent, john0003 precise and variable, john0004 imprecise and consistent, john0005 imprecise and variable), rotation from 2026-11-15, letters typed and not handwritten, run schedule and budget | this session; not discussed further by the user |
| 2026-11-14 | Agent entries are synthetic: never counted in readiness criteria, phase-4 start conditions or the 3-visitor rule; never used to evaluate a model; never committed | this session, written into `CLAUDE.md`, `docs/CONTEXT.md`, `ML_PLAN.md` |

## 3. State per component

| Component | State | Verified | Not verified |
|---|---|---|---|
| `tools/agent_testers.json` (names, traits, seeds, rotation) | 4 testers | `test/test_agent.js` (rotation, distinct labels, none shared with people's labels) | – |
| `tools/agent_ink.js` (ink from traits), VERSION 0.1.0 | done | determinism, consistency spread (variable testers at least 4× consistent ones), precision (imprecise end error > 2× precise), short arrows ≥ 0.5 units | noise levels not calibrated on human drawings |
| `tools/agent_tester.js` (drives the page in headless Chromium, real mouse events; T1 and T2 of standard and daily set), VERSION 0.1.1 | done | `npm run test:agent` 11/11; four local runs (seeds of 2026-11-15, daily set of 2026-11-13): every entry replays (29, 28, 39, 37), 0 page errors | T3 and T4 not done by design |
| `console/curly-agent-tester/` (agent, environment, daily deployment 06:17 America/New_York, budget 5 USD, outcome rubric) | written | YAML parses; field names taken from the Managed Agents documentation | not applied (`ant` not available in the session); never run in the Console; Playwright resolution in the Console container and cost per run unknown |
| `docs/AGENT_TESTER.md` (plan, data rules, first results) | written | – | – |
| Review page (claude.ai artifact, private to the user, https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4, version 2) | published; answers saved in its database, collection `reviews`, one document per `<tester>__<task>__<attempt>` | rendered locally (no script error); database read once | saving on the live page not exercised by the session |
| `npm test` | 19, 12, 14, 17, 8 passed after the changes | yes | `npm run test:page` not re-run after the changes (no page file changed; 30/30 before) |
| Pages deploy of the two commits | – | live page answers 200 | workflow run status not read (GitHub connector failed to connect) |

First results (driver figures; count of tasks): arrows accepted on the first reading 11, 10, 8, 10 of 11; copies
confirmed on the first attempt 10, 10, 0, 2 of 14 (john0002 to john0005).

## 4. Open items, blockers, waiting for the user

- Waiting for the user: apply the Console resources (`console/README.md`, `ant apply`), start a manual run, check
  the first `report.md` and the cost.
- Waiting for the user: review in the review page. 5 answers were saved before the questions changed; their
  "drawing" answers stay valid, their answers to the replaced question are stored under `reading` and not shown.
- Page weaknesses found with synthetic ink, page not changed: in `t1-cc-bond` the two atoms joined by the new bond
  are 5.1 units apart, above `pairReach` 4.5 of `src/readings.js` (an arrow ending in the middle gives no valid
  reading); in arrow mode a stroke shorter than 0.5 units is dropped without a message. Both are in the open-issues
  table of `docs/CONTEXT.md`, to be judged on drawings of people.
- Imprecise testers' copies are mostly flagged; whether people draw like this is unknown until the noise is
  calibrated.
- Carried over from earlier sessions: the contact e-mail of the test run (`contact` in `data/config.json`) is still
  open; raise it before testers are invited.

## 5. Files and commits

| Commit | Repository / branch | Content |
|---|---|---|
| `e20da70` | QDher/Daily_Curly_Chem / `main` | `tools/agent_testers.json`, `tools/agent_ink.js`, `tools/agent_tester.js`, `test/test_agent.js`, `console/` (README, agent, environment, deployment), `docs/AGENT_TESTER.md`; `CLAUDE.md`, `README.md`, `docs/CONTEXT.md`, `package.json` (`test:agent`, `agent`), `.gitignore` (`agent-runs/`) |
| `74f8f39` | QDher/Daily_Curly_Chem / `main` | driver 0.1.1: run record keeps the strokes (and the structure for arrows) of every attempt |
| `9aa5fb3` | QDher/Daily-organic-chemistry-puzzles / `claude/beautiful-pasteur-7tg1k3` | `ML_PLAN.md` section F: agent testers paragraph |

No change to `index.html`, `src/`, `data/` or the site repositories' `main`.

## 6. Assumptions and interfaces other sessions must check

- The driver depends on the page's element ids and `window.__app` (`input.getScene`, `getStrokes`, `getInk`,
  `getTyped`, `toClient`, `getReading`, `tasks`, `daily`) and `window.__entries`. Ids used: `#start`,
  `#start-daily`, `#step`, `#m-arrow`, `#m-draw`, `#m-h`, `#apply`, `#result`, `#yes`, `#no`, `#submit`, `#clear`,
  `#read`, `#reading`, `#r-yes`, `#r-wrong`, `#wrong-what`, `#r-wrong-send`, `#atoms button[data-tool]`, `#msg`,
  `#save2`. After any page change, run `npm run test:agent`. Items of `docs/PLAN_DRAWING.md` that change ink
  handling (straightening, pause preview, stylized arrows, snapping) will change what the agents' ink gives.
- The driver serves the page locally with its own `data/testers.json` (hashes of `agent-<name>`) and
  `data/config.json` (`worker: null`, no remarks). Agent codes are not in the live `data/testers.json` and not in
  `MECH_TESTERS` of the Worker branch. If agent files are ever loaded into D1, they must be excluded by label:
  `cf87ec24`, `55a54912`, `4f85c0b1`, `cdf81363`.
- The entry format is unchanged (the agent uses the page as it is). New file format: the run record
  `run-<date>-<tester>.json` (described in `docs/AGENT_TESTER.md`).
- Schedule: the Console run at 06:17 New York uses the newest `data/daily/latest.json`, built by
  `.github/workflows/pages.yml` at 03:30 UTC. A change of that schedule may need the Console schedule moved.
- The Console run clones `main` of this repository; testers and rotation are read from `tools/agent_testers.json`
  at each run. Never reuse a name or change the seed or traits of a tester that has run.

## 7. Next steps, in priority order

1. User applies the Console resources and starts one manual run; check the report, the replay line and the cost;
   adjust the rubric and the budget.
2. User reviews the four testers in the review page; read the answers back (`reviews` collection) and use them to
   set the noise levels (`PRECISION` in `tools/agent_ink.js`, then raise its `VERSION`).
3. After the first files of people: measure endpoint gaps, angle and length errors and arrow end distances on
   human drawings and calibrate the ink to them.
4. After about two weeks of runs: write the analysis of reproducibility per tester on the fixed panel (standard set),
   from the run records; decision of the user on more testers per day.
5. Judge the `pairReach` and short-stroke findings on drawings of people (test run), not on synthetic ink.
