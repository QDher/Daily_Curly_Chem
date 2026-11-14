# Handoff: training data for the arrow-reading model (2026-11-14)

## 1. Scope
Proposal and assessment of a plan to generate synthetic training data (Monte Carlo, optionally on an HPC cluster) for
a learned arrow-reading model. Analysis only: no code, data or plan file was changed.

## 2. Decisions
None taken by the user. Proposed (2026-11-13), not yet accepted:
- The learned task is strokes → intended arrows (ranking component C3). Arrows → structure stays deterministic
  (`src/arrows.js`, C1); no model there.
- Training label = the arrows the drawer intended (known exactly for synthetic data), not the problem's known
  intermediate. Labelling by intermediate would train the model to correct wrong arrows, contrary to the rule that
  entries are never judged against the problem.
- The model only re-scores candidates enumerated by I0 (`Readings.read`); a small score margin gives `ambiguous`.
- Acceptance on real strokes from the test run (work package 7), not on synthetic data.

## 3. State per component
| Component | State |
|---|---|
| C1 `src/arrows.js` | done, tests pass (previous sessions); not changed here |
| I0 `src/readings.js` | done; `Readings.P` not tuned on real drawings |
| C3 learned ranking | not started; plan above proposed only |
| Synthetic stroke generator for arrows | not started |
| Throughput of `Scene.fromSpecies` + `Readings.read` on random strokes (`data/steps.json`, 3000 samples per row) | measured: 0.59 / 0.74 / 1.88 ms per sample for 1 / 2 / 3 arrows on one core; 27 / 20 / 16 % of uniformly random entries have a valid reading. Verified once, not repeated |

## 4. Open items
- User decision: adopt the proposed plan or not; whether an HPC cluster is used (generation does not need it:
  about 2 to 6 million samples per core-hour; useful only for training sweeps).
- Blocked on the test run (work packages 6 and 7): real strokes for calibrating the drawing model and for acceptance.
- Not checked: licences and format conversion of external mechanism datasets (mech-USPTO-31K, PMechDB, FlowER data).
- Chemistry of the references in `data/tasks.json` not reviewed by a chemist (from README).

## 5. Files changed
None, apart from this file. Benchmark script kept outside the repository (session scratchpad, not durable).

## 6. Assumptions and interfaces to check
- Candidate enumeration and scene format of `docs/SCENE.md` 0.1.0 and `Readings` 0.1.0 are the model's input; a change
  there changes the training data.
- Structure equality by `Readings.signature` (atom ids, charges, H counts, bond orders) for counting equivalent arrow
  sets; RDKit canonical SMILES elsewhere.
- Synthetic strokes must use the page's layout (`src/scene.js`, RDKit 2D coordinates, bond length 1.5).
- The `CLAUDE.md` rule against tuning on synthetic ink (recognizer) is assumed to apply to arrow strokes too.
- The plan text belongs in `ML_PLAN.md` of QDher/Daily-organic-chemistry-puzzles; not written there.

## 7. Next steps
1. Fuzz test of C1 with random arrows (charge conservation, electron counts, determinism, no crash); no data needed.
2. Drawing model arrow → stroke (offset, overshoot, curvature, scale, order) with broad parameter ranges; intents =
   reference arrows, valid alternatives, typical errors; each labelled with its C1 result.
3. Fit the 8 parameters of `Readings.P` on synthetic data; metrics: top-1/top-3 against intent, correct `ambiguous`
   rate, rate of error intents read as a valid structure (target 0); splits by substrate and noise setting.
4. After the test run: calibrate the drawing model on real strokes; decide whether C3 needs a learned model
   (feature ranker first, neural network only for failures features cannot express).
5. If adopted: write the plan into `ML_PLAN.md` (other repository) and the status table of `README.md`.
