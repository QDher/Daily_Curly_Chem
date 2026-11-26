# Request R4 to the agent side: proposals 2 (step 3), 3 (steps 2 to 4) and 4 (people side, 2026-11-26)

The user asked on 2026-11-26, in the people-side session, to implement all proposals of
`docs/handoff/review-of-the-two-tasks_2026-11-26.md` (decision 61). The people-side parts are pushed (below). The
parts in `tools/agent_*`, the review page and the scheduled task "Daily tester" are asked here. The people-side
session can change the scheduled task and `docs/AGENT_TASK_PROMPT.md` on request.

## What the people side delivered

| File | Content |
|---|---|
| `data/ink_profile.json` | Quantiles (p10 to p90) per pointer type (pen, touch, mouse; `unknown` = the 14 drawings of 2026-11-13), in bond lengths L of the drawing: `bondLength`, `wobble`, `jointGap`, `secondLineSpacing`, `secondLineLength`, `secondLineShift`, `letterHeight`, `letterGap`. From 203 drawings; rebuilt with `node tools/ink_stats.js --write` |
| `data/letter_samples.json` | 198 handwritten letters and signs of people (O 143, N 42, Si 5, H 5, − 3), stroke points centred, largest side 1, with `height` in L, `pointer`, `source` (`reading` or `target`) and `read` (what the recognizer read: 26 are misread) |
| `tools/measure.js` | One table per recognizer version: people tuning set, people held-out, judged agent copies (`--runs <dir> --answers <dir>`: run records and answers saved from the review page) |
| `tools/failures.js` | Failed attempts of an entries file of a person and what the tester did next; `--write <file>` gives an entries file with the failures only |
| `test/fixtures/drawings_2026-11-25.json` | 21 held-out copies (pen); `pointer` added to the fixture of 2026-11-20 |
| `src/recognize.js` | Output only: each label carries `typed` and `ink` (indices of its strokes). Rules and `VERSION` unchanged |
| `index.html` 0.9.0 | Copy tasks ask for atoms other than carbon with the buttons; drawing entries record `hand` (strokes read as letters or signs) |

## Asked

### 1. Agent ink calibrated on people (proposal 2, step 3; closes B4)

- `tools/agent_ink.js`, new `VERSION`: the habits of a tester (joint gap, second line spacing, length and shift,
  wobble, letter height and gap) are drawn from `data/ink_profile.json` for the tester's pointer type, between the
  quantiles that fit its precision (for example precise: p25 to p50; imprecise: p50 to p90).
- Handwritten letters: for a share of the atoms other than carbon (suggested 50 %, a trait of the tester), the
  agent writes the letter with a sample of `data/letter_samples.json` (same label, scaled to `height` × L, placed
  at `letterGap` from the bond end) instead of typing it. Only labels with samples (today O, N, Si, H, −).
- New tester names for the changed traits (rule: a tester that has run is never changed).
- Check: with `node tools/measure.js`, the share of agent copies read exactly approaches the people rows, and the
  failures are of the same kinds (letters first).

### 2. Reviewers on people's failures (proposal 3)

- A run made from an entries file written by `node tools/failures.js <file> --write <out>` holds failed attempts
  only. For its copies the page asks "Did the person draw the structure asked?" (yes, no, unsure), with the
  structure to copy beside the ink. Suggested storage: `outcome` right, wrong or unsure with `asked`
  "drawn-as-asked", like decision 58 for arrows.
- Arrow attempts with no accepted reading are today not judged (decision 58). For them the same question on the
  arrows: "Do these arrows show the step asked?".
- The upload route and these questions are to be described in `docs/INTERFACES.md` (I4).

### 3. Agents as a targeted instrument (proposal 4)

- Sampling: the review page lists every boundary attempt and attempts with a broken rule, and about 20 % of the
  other attempts of the precise testers (a fixed draw per attempt, for example from its seed, so that both
  reviewers see the same ones).
- The four fixed standard copies: once per version of the agent ink instead of every day.
- Boundary attempts for copies: one parameter varied per attempt and recorded with it (`boundary`: name and
  value), as `convention` is for arrows: gap between bond and letter 0 to 0.5 L; length of a second line 0.3 to
  1.0 of the bond; spacing of a second line 0.05 to 0.4 L. The ranges enclose the quantiles of people in
  `data/ink_profile.json` (pen: letter gap p10 0.03, p90 0.31; second line length p10 0.57, p90 0.97; spacing
  p10 0.14, p90 0.29).
- Output: per parameter value, the share judged "should be read" and the share read by the page.
- `docs/AGENT_TASK_PROMPT.md` and the scheduled task "Daily tester" change together.

### 4. Export for the shared measure (proposal 5)

A way to get the run records and the answers as files (or a statement that the people side reads them from the
review page as on 2026-11-26), so that `tools/measure.js` fills the row of judged agent copies after each change
of the recognizer.

## Not asked

Proposal 6 B (trained letter classifier): the samples hold two elements in number (O 143, N 42) from two
testers; not started. Proposal 1 (testers, contact e-mail) is with the user.
