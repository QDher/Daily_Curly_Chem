# Agent testers: synthetic drawing data, every tester every day

Decisions of the user: agent testers named john0002, john0003, and so on (2026-11-14); every tester of
`rotation` runs every day (2026-11-16; one per day before); the daily run is a Claude Code scheduled task that adds each run to the review page (2026-11-16;
it replaces the Claude Console deployment of 2026-11-14, whose files in `console/` are kept but not used). They know the correct answer of every task; only the drawing of arrows, bonds and
atoms is under test, with two traits: precision and reproducibility (consistency). Each run also reports what
it saw on the page.

Files: `tools/agent_testers.json` (testers and rotation), `tools/agent_ink.js` (ink from the traits),
`tools/agent_tester.js` (drives the page), `test/test_agent.js` (`npm run test:agent`),
`tools/agent_review_data.js` (run record to review files), `tools/agent_review_page.html` (review page),
`tools/agent_convention_sheet.js` (reviewer sheet of the arrow convention, written to `tools/agent_convention_sheet.html`),
`docs/AGENT_TASK_PROMPT.md` (prompt of the scheduled task), `console/` (Console resources, not used).

## What the data are and are not

- **Synthetic.** A model has no hand: the ink is made by code from the intended arrows or structure, with noise
  and habits set by the traits of the tester. The model (Claude, in the scheduled session) runs the script, checks
  the output, looks at the readings that went wrong, reviews the chemistry of the day's reference steps and writes
  the report. It does not draw stroke by stroke and does not set the traits.
- **Use:** pre-training of the recognition model (R2) and of the arrow-reading ranker (I1), with exact labels (the
  intended structure or arrows of every attempt are in the run record); a daily end-to-end check of the page, the
  entries file and the replay; feedback on the page and on the reference steps.
- **Not tester data.** Agent entries are never counted in the readiness criteria of the test run (`docs/PLAN.md`,
  section F), in the start conditions of phase 4 (drawings, visitors) or in the "at least 3 different visitors"
  rule. Every evaluation of a model and every frequency figure use entries of people only. The gap between models trained on
  synthetic ink and their results on human drawings is measured on the human entries.
- **Judged agent entries and replacement (2026-11-14).** Attempts judged by the user in the review page are "judged agent entries" (2026-11-14): kept with the answers, right or wrong, used to find weaknesses and as labelled training examples; frequencies and model evaluations use entries of people only. A tester always judged correct, or always incorrect, with more than 98 % confidence is retired and replaced by a new tester (new name) closer to the less clear-cut cases; rules in `docs/PLAN.md`, section F.
- **Letters are typed**, not handwritten: the only letter shapes available are the recognizer's own templates
  (`src/glyphs.js`), so handwritten letters from them would test the recognizer against itself. Atoms other than
  carbon and charges are placed with the row of atoms, as testers may do. Letter recognition needs letters from
  people.
- **Hydrogens on heteroatoms** (user, 2026-11-16): only hydrogens on carbon are implicit. From ink 0.2.0 (script
  0.1.3), every hydrogen of N, O, S, ... in a copy is drawn as a bond stroke with a typed H at its end, as long as the
  other bonds, with the geometry of the review page (C=N-H bent at 120 degrees, two H at +-120 degrees, ...); a bond
  between two labels keeps at least 0.6 of its length (gap at most 0.2 bond at each end). The page cannot yet read a
  hydrogen written next to a heteroatom (NH2 as a label, items 7 and 8 of `docs/PLAN_DRAWING.md`). Structures shown
  in the review page and in the run record carry the hydrogen counts (`h`, from script 0.1.2).
- **Not calibrated yet.** The noise levels are set by hand. After the first files of testers, measure endpoint
  gaps, bond angle and length errors and arrow end distances on human drawings (`test/fixtures/`, tester files)
  and set `PRECISION` in `tools/agent_ink.js` to match (a change of the ink raises its `VERSION`).
- Mouse only; stroke timing is not human (a point every 3 to 12 ms); the questions at the end, remarks, the
  draw-and-arrows tasks (T3) and the votes on mechanisms (T4) are not done.

## Testers

| Name | Label in entries | Precision | Consistency | Seed |
|---|---|---|---|---|
| john0002 | `cf87ec24` | high | high | 1101 |
| john0003 | `55a54912` | high | low | 2203 |
| john0004 | `4f85c0b1` | low | high | 3307 |
| john0005 | `cdf81363` | low | low | 4409 |
| john0006 | `8d3f6873` | high | high | 5501; pen, hand 0.87 |
| john0007 | `770f7a8b` | low | low | 6607; pen, hand 0.87 |
| john0008 | `d37c5816` | high | low | 7703; touch, hand 1 |
| john0009 | `c6a16cb5` | low | high | 8809; mouse, hand 0.04 |

From 2026-11-26 (request R4, decision 62) the rotation is john0006 to john0009, drawn with ink 0.5.0 (section "Ink of
people"); john0002 to john0005 have no pointer type, left the rotation and keep their runs and answers.

- **Precision** (noise of one drawing, fractions of the bond length L): high = bond ends 0.05, atom positions
  0.04, arrow start and end 0.07, clicks 0.05, rotation 2°; low = 0.16, 0.12, 0.22 and 0.25, 0.18, 7°. From ink
  0.4.0 the noise moves an arrow end only inside the place the convention allows, and a rule of the convention is
  broken on purpose in 20 % (high) or 40 % (low) of the arrow attempts (below).
- **Consistency** (reproducibility): each tester has fixed habits drawn from its seed: drawing scale and rotation,
  how many bonds go into one stroke, stroke direction, side and gap of the second line of a double bond, gap left
  before an atom label, arrow bend and side, where an arrow from a lone pair starts, how short of the target it
  stops, whether a new single bond ends at the middle or on the receiving atom, where a charge is clicked, drawing
  speed; from ink 0.4.0 also where an arrow starts on a bond or a multiple bond and how often it starts at a charge
  sign (drawn from a random stream of their own, so the other habits and the copies are those of ink 0.3.0 for the
  same seed). At each drawing the
  habits move towards a new random set by a factor of 0.1 (high consistency) or 1 (low: drawn anew each time).
- **Label**: first 8 hex digits of the SHA-256 of `agent-<name>`. That code opens only the page served locally by
  the script (with its own tester list); it is not valid on the live site and is not in `data/testers.json`.
- **Daily testers**: every tester listed in `rotation` runs every day (user, 2026-11-16), so each date has one
  run per tester. Each tester draws the standard set at every run: its 6 arrow tasks and 4 copies are the fixed
  panel on which reproducibility is measured across runs; the daily set adds new tasks. (`--agent auto` of the
  script still picks one tester by date, counted from 2026-11-15, for local runs.)
- **More testers**: add a name, traits and seed to `tools/agent_testers.json` and to `rotation`. Never reuse a
  name and never change the seed or traits of a tester that has run. A tester listed in `rotation` runs from the
  next day on; one removed from it stops (its runs stay on the review page). The run id is `<date>_<tester>`.

## Arrow convention (ink 0.4.0, 2026-11-26)

Decisions 53 to 55 (`docs/DECISIONS.md`), rules in `docs/handoff/arrow-convention_2026-11-26.md`, request R3 of
`docs/BOARD.md`; implementation: decision 57. L: bond length of the structure shown (1.5 units).

| Case | Start | End |
|---|---|---|
| 1. From a lone pair or a charge | in a direction at least 30° from each bond of the atom (the habit of facing the target is kept inside that sector), 0.15 to 0.3 L from the atom and at least 0.15 L from every bond line; on a charged atom, at the charge sign (habit, 0 to 60 % of the arrows; the sign's place as written by the test page) | – |
| 2. From or to a single bond | on the line (within 0.1 L), 25 % to 75 % of the bond; a short arrow (bond to one of its own atoms) keeps its start on the bond and has an arc at least 0.3 L high | on an atom: within 0.2 L, in a direction at least 30° from each bond of that atom, nearest to the start |
| 3. From or to a multiple bond | to another atom (new bond): 55 % to 75 % toward the atom that forms the new bond, the arc bulging on that atom's side; toward its own atom or an adjacent bond: as case 2 | on a bond that gains an order: 30 % to 70 % of its line (middle half, and 0.3 L from both atoms for implicit carbons); a new single bond: at the middle (45 % to 55 %) or on the receiving atom (habit), both right |

- Noise of the precision level is applied inside these places (a few draws, else the noiseless point); the ends of
  a stroke are not moved by the wobble of the line. Every arrow is at least 0.6 units long along its path (the page
  drops strokes shorter than 0.5 units).
- Rule breaking (decision 55): an arrow attempt breaks one rule with probability 20 % (john0002, john0003) or 40 %
  (john0004, john0005), drawn from a stream of its own. The rule is drawn among those that apply to the arrows of
  the step, then the arrow among those it applies to; the other arrows follow the convention. Rules:
  `lp-start-on-bond` (start 0.15 to 0.3 L along a bond of the atom), `lp-start-far` (0.5 to 0.65 L from the atom,
  in the free sector), `bond-start-outer` (6 % to 20 % or 80 % to 94 % of the bond), `short-off-bond` (0.3 to
  0.45 L off the bond line), `multiple-start-far-half` (25 % to 45 % toward the atom that forms the bond),
  `pair-end-between` (62 % of the way to the receiving atom up to 0.3 L from it). Copies are not affected.
- Record: each arrow attempt of the run record has `convention` (`'ok'`, or `{ arrow, rule, text }`, arrow counted
  from 1 in the order of the reference) and `arrowCases` (start and end of each arrow: `lp`, `charge-sign`, `bond`,
  `bond-short`, `multiple-toward`; `atom`, `bond`, `pair-middle`, `pair-atom`, `pair-between`); the run summary
  counts `arrows.ruleBroken`. Review data 0.5.0 keeps both fields in `runs/<runId>.json`. This is the generator's
  intent, not a judgement; the review page does not show it, and reviewers answer on what they see.
- Reviewer sheet (board item B10): `node tools/agent_convention_sheet.js` draws, with this ink without noise, a right
  and a wrong arrow for each rule that is broken on purpose, plus the right variants (start at the charge sign, end
  on the receiving atom, end on a bond or an atom), on two small steps; the place each rule allows is shaded. It is
  published with the review page as `convention.html` and shown in its "Arrow convention" panel. A change of the ink
  or of the convention: run it again (`npm run test:agent` checks that the file is current).
- Check of the rules (`npm run test:agent`): on the sheet's two steps, 600 attempts per step (four testers), every
  arrow that follows the convention starts and ends where the rules allow, and in a broken attempt exactly one
  arrow breaks exactly the rule stated; rates within 5 points of 20 % and 40 % over 600 attempts per tester. The
  same check on the arrow tasks of the standard set and of the daily sets of 2026-11-19 to 2026-11-24 (4,080
  attempts, session of 2026-11-26): no deviation.
- What the page does with them (same 4,080 attempts, read by `src/readings.js` in Node, not in the browser): the
  intended structure among the readings for 98 % of the attempts that follow the convention (first reading 87 %);
  for the rules broken: `lp-start-on-bond` 95 % (first reading 39 %), `lp-start-far` 85 %, `bond-start-outer`
  98 %, `short-off-bond` 99 %, `multiple-start-far-half` 91 % (35 attempts), `pair-end-between` 4 of 6. An arrow
  that ends at the middle of a new bond whose atoms are farther apart than `pairReach` (4.5 units; `t1-cc-bond`,
  5.1 units) gives no reading as intended although it follows the convention (known since 2026-11-14; not changed,
  thresholds are set on drawings of people).
- Comparison run (2026-11-26): the four testers with ink 0.4.0 on the seeds and the daily set (2026-11-24) of the
  scheduled run of 2026-11-25 (ink 0.3.0), arrow tasks only (`--types T1`), published as
  `2026-11-25_<tester>_ink0.4.0`. Arrow tasks on the first attempt and first reading / accepted, of 11 per tester,
  ink 0.3.0 → 0.4.0: john0002 6/10 → 7/11, john0003 6/10 → 6/9, john0004 5/10 → 5/10, john0005 8/10 → 7/11; 10 of
  47 attempts broke a rule on purpose. `t1-cc-bond` gave no reading for all four with ink 0.3.0; with 0.4.0 it is
  read when the arrow ends on the receiving carbon or between (2 testers) and not when it ends at the middle
  (`pairReach`). New with 0.4.0: john0003 `d20261124-a1` (board item B19, lone pair of an atom with three bonds).
- Retirement rule (`docs/PLAN.md` F, board item B12): with one rule broken in 20 % of the arrow attempts, a precise
  tester's arrows cannot all be judged "correct" when reviewers answer "should not give the right structure" for the
  broken ones; copies have no rule breaking. The bound is still computed over all judged attempts, as decided.

## Ink of people (ink 0.5.0, 2026-11-26)

Request R4 of `docs/BOARD.md` (`docs/handoff/request-R4-agent-side_2026-11-26.md`), decision 62. For testers with a
pointer type (john0006 and later); the others draw as with ink 0.4.0 (same strokes for the same seed).

- Habits from `data/ink_profile.json` (people's ink per pointer type, in bond lengths L): joint gap, wobble, second
  line spacing, length and shift, letter height and gap. A tester's habit is a position (quantile) between p10 and
  p90 of people: precise testers p25 to p50 on the side of a measure that is worse (joint gap, wobble), p50 to p75
  for the length of a second line, p25 to p75 for the others; imprecise testers p50 to p90, p10 to p50 and p10 to p90.
  Consistency moves the position per drawing as for the other habits; each stroke varies it a little (0.05). A
  pointer type with fewer than 10 values of a measure uses the pen values (mouse: letters).
- Strokes: a stroke end at a corner with other bonds stops short of it by about half a joint gap; the bow of a line is
  the wobble (largest deviation over the chord); a second line has the spacing, the length (shorter over longer) and
  the shift along the bond of the profile. Arrows are unchanged (convention of ink 0.4.0).
- Handwritten letters: each atom other than carbon (H of N, O, S included) is written by hand with probability
  `hand` (0.5 until ink 0.7.0; then the share of people with the same pointer type, section "Ink 0.7.0"), with a sample of `data/letter_samples.json` of the same label (O, N, Si, H; those of the tester's
  pointer type when there are 3 or more), scaled to the letter height habit, the bond ending at the letter gap from
  the letter; other labels, and atoms not written, are typed with the row of atoms. A negative charge is written
  with a "-" sample with the same probability; other charges are typed.
- Boundary attempts (request R4, part 3): in 20 % (precise) or 40 % (imprecise) of the copy attempts one measure is
  set for the whole drawing across its range: gap between bond and letter 0 to 0.5 L, length of a second line 0.3 to
  1.0, spacing of a second line 0.05 to 0.4 L (the measure is drawn among those that apply). Recorded as
  `boundary: { name, value }` (null otherwise); `hand` lists the letters and signs written by hand. Neither is shown
  to reviewers. `node tools/agent_boundaries.js --runs <dir> --answers <dir>` gives, per measure and band of values,
  the attempts, the share judged "should be read" and the share read by the page.
- Check (session of 2026-11-26, recognizer 0.5.0, copies of the standard set and of the daily sets of 2026-11-17 to
  2026-11-24, 3 seeds, read in Node): read exactly, ink 0.4.0 testers 94 %, 97 %, 43 %, 35 %; ink 0.5.0 testers
  john0006 75 %, john0007 40 %, john0008 67 %, john0009 42 % (copies with handwritten letters 68 %, 35 %, 61 %, 36 %;
  typed only 100 %, 72 %, 95 %, 77 %). People (`node tools/measure.js`): 49 % on the tuning set (46 % with
  handwritten letters), 24 % held-out. Most copies not read exactly have an atom read wrong, with handwritten
  letters, as for people. In the browser (`tools/agent_tester.js`, date 2026-11-26, standard set and daily set of
  2026-11-25): copies confirmed on the first attempt 7, 3, 5, 6 of 9 (john0006 to john0009), arrow tasks on the first
  reading 10, 9, 9, 8 of 11; no page error; every entry replays.

## The standard set as boundary panel (ink 0.6.0, 2026-11-26)

Decision 63 (user: more variance on the standard set, to find sooner what reviewers accept; standard copies at every
run). On the standard set (same molecules every day, so that only the deviation changes):

- Every arrow attempt sets one measure of the convention on one arrow at a value drawn across its range (the other
  arrows follow the convention; no rule is broken on purpose there): start from a lone pair at 0.05 to 0.7 L from the
  atom (`lpDistance`) or at 0 to 90 degrees from its nearest bond (`lpAngle`); start on a bond at 0 to 0.5 of its
  length from the nearer end (`bondStart`); start on a multiple bond at 0.2 to 0.8 of the way toward the atom that
  forms the new bond (`multipleStart`); end at 0 to 0.5 L from the target atom (`atomEnd`); end of a new bond at 0.45 to
  1.0 of the way to the receiving atom (`pairEnd`). The measure is drawn among those that apply to the step, then the
  arrow. Recorded: `convention: 'boundary'`, `boundary: { arrow, name, value, inside }` (`inside`: the arrow keeps every
  rule of the convention, checked by `arrowBreaks`, the same checks as the tests).
- Every copy of a tester with a pointer type is a boundary attempt (measures of section "Ink of people").
- The four standard copies are drawn at every run (script 0.2.1; `--index` of script 0.2.0 is withdrawn).
- Daily sets keep the rates of decisions 55 (arrows) and 62 (copies). Review data 0.6.1 lists every boundary attempt.
- `node tools/agent_boundaries.js --runs <dir> --answers <dir>` gives, per measure and band of values, the attempts,
  the share inside the convention, the share judged "should be read" or "should give the right structure", and the
  share the page read as intended.

## Ink 0.7.0 (request R5, 2026-11-26)

Decision 70. Request R5 of the people side (`node tools/compare_ink.js`, decision 69): the joint gap of the agents was
0.17 to 0.19 L against 0.10 L for people; misread letter samples were diluted; precise testers were read more often
than people. Measured in this session (scripts not kept): the corners themselves were not counted twice (two stroke
ends at a corner 0.06 L apart for john0006). The measure was raised by (a) bonds stopping 0.2 to 0.38 L short of a typed
atom (two such ends 0.35 L apart), where people place the typed atom at the end of their bonds (typed atom to nearest
bond end: median 0 for pen and mouse), and (b) longer strokes through several bonds (1.44 bonds per bond stroke for
john0006 against 1.16 for people with a pen), so that fewer corners have two stroke ends and more ends pair with the
end of a second line (about 0.19 L). Letters: people with a pen or on touch write 87 % and 100 % of the labelled atoms
by hand, with a mouse 4 %; the testers wrote 50 %, so the misread samples came half as often.

Changes, copies of testers with a pointer type only (arrows and the testers without a pointer type are unchanged):
- Bonds meet at a typed atom as at a corner (half a joint gap of people when the atom has two or more bonds); the
  click of the typed atom is at the atom. A boundary attempt on the letter gap still sets the gap to a typed atom.
- The probability to draw on through the next bond is set per pointer type (`TRAIL`: pen 0.2 to 0.45, touch 0.7 to
  0.98, mouse 0.4 to 0.7; the tester's trail habit gives its place). Bonds per bond stroke, people against testers:
  pen 1.16 against 1.15 (john0006) and 1.16 (john0007), touch 1.47 against 1.44, mouse 1.33 against 1.35.
- `hand` of john0006 to john0009 (before their first run) set to the share of people of their pointer type: pen 0.87,
  touch 1, mouse 0.04. Samples are drawn uniformly among those of the label, so misread samples keep their share.
  Letters with no sample (Cl, Br, S, F, I, ...) and positive charges are still typed.

`node tools/compare_ink.js` (recognizer 0.5.0, 43 structures, 2 seeds), ink 0.6.0 then 0.7.0:

| Writer | Read exactly | Joint gap (L) | Stroke length (L) |
|---|---|---|---|
| People, pen and touch | 46 % | 0.10 (pen 0.10, touch 0.21) | 0.72 |
| People, mouse | 57 % | 0.09 | 0.88 |
| john0006 (pen, precise) | 76 % then 69 % | 0.19 then 0.08 | 0.87 then 0.88 |
| john0007 (pen, imprecise) | 44 % then 40 % | 0.17 then 0.15 | 0.71 then 0.69 |
| john0008 (touch, precise) | 78 % then 59 % | 0.17 then 0.21 | 0.85 then 0.88 |
| john0009 (mouse, imprecise) | 47 % then 44 % | 0.19 then 0.17 | 0.72 then 0.80 |

Precise testers are still read more often than people. On the 29 structures with only C, N, O and H and no charge
(letters all with samples): people with a pen 59 % (106 drawings), on touch 40 % (15), with a mouse 50 % (16); john0006
67 %, john0007 43 %, john0008 57 %, john0009 45 % (58 copies each). Moving the precise testers' quantiles from p25 to
p50 toward the median (p40 to p60, or p50 to p75) did not lower john0006 (61 and 62 of 86), so the ranges of R4 are
kept. What remains, seen on people's copies not read exactly: letters without samples written by hand (Cl read as O
in 3), charges written by hand and not read, and one carbon more or less (7 of the pen copies), which the measured
habits do not produce. Not examined: why the stroke length of the precise testers stays at 0.88 L against 0.72 L.

## Boundary panel (ink 0.8.0, request R6, 2026-11-26)

Decision 71 (people side, `docs/handoff/boundary-panel_2026-11-26.md`), implemented on the agent side (decision 73).
Thresholds of what reviewers accept come from a panel in which a drawing varies one measure only.

- Ink 0.8.0 (`panelCopy`, `panelArrows` of `tools/agent_ink.js`): the measure is set to the value given; copies have
  every other measure at the median of people with a pen (`data/ink_profile.json`), one stroke per bond, no rotation
  or placement noise, every atom typed at its place except, for the letter gap, the one letter asked about, written
  with one fixed sample of `data/letter_samples.json` that the recognizer read as its label (`panelSample`); arrows
  follow the convention without noise except the measured one. Each line or arrow has its own random stream, so that
  another value of the measure leaves the rest of the drawing as it was; the seed changes only the side of the slight
  bow of a line. The element asked about is returned as `mark`. The daily testers draw as with ink 0.7.0.
- Tool `tools/agent_panel.js` (0.1.0): writes the phase 1 panel as a run of the review page, `<date>_panel1`, tester
  `panel`: 9 measures × 5 values (centres of the 5 bands of each range) × 3 drawings (simple structure twice,
  crowded once), 135 drawings, mixed in a fixed order per measure, each with a question that names the element
  (`question`) and the element to mark (`mark`). Structures: letter gap `t2-diketone`, `t2-bromoketone` (letter O);
  second line `t2-iminium`, `t2-ester` (the C=C); lone-pair start, bond start and end on an atom `t1-substitution`,
  `t1-addition`; start on a multiple bond `d20261122-a2`, `d20261124-a3`; end of a new bond the step ALDOL of the
  reviewer sheet, three drawings (the only task with that end, `t1-cc-bond`, is not read as intended on its layout:
  the methyl carbon of the second molecule lies between the two atoms that form the bond). The run also holds the
  offline reading of each value (10 drawings of each structure; copies read exactly by `src/recognize.js`, arrows
  giving the intended structure among the readings of `src/readings.js`), and each drawing's own reading (`read`);
  neither is shown. Index line: `panel: { phase: 1, open: true }`.
- Review page: open panels are shown apart from the daily runs ("Boundary panel", one group per measure, the
  measure's 15 drawings), never in the runs table; the element is marked (dashed circle round an atom or letter,
  band along a bond; the arrow asked about in the accent colour, the others grey). Answer: `expected` yes, no or
  unsure with `asked` "panel", under the attempt's key. "Not reviewed by you" shows the panel's count.
- Thresholds: `node tools/agent_boundaries.js --panel --runs <dir> --answers <dir>` (export as in
  `docs/INTERFACES.md` I4c): per measure the judgements per value, the threshold of the reviewers by the phase 1 rule
  (a value is accepted when at least half of its yes/no judgements are yes; the threshold lies between neighbouring
  values that differ), each reviewer's threshold, the page's threshold (offline reading) and "relevant" (reviewers and
  page differ at a value inside or next to the range of people, p10 to p90 widened by a band; arrows: no measure of
  people, every value counts; or two reviewers differ at two values or more).
- While a panel is open, review data 0.7.0 does not list boundary attempts of the daily runs (`listed` false); the
  scheduled task needs no change, since it passes the live index. To close a panel:
  `node tools/agent_panel.js --close <runId> --index <runs/index.json of the live page> --out <dir>`, then publish
  `runs/index.json`. Phase 2 (relevant measures only) is not written yet.
- Offline reading of the phase 1 values (panel of 2026-11-26): the page reads every value of the eight measures other
  than the letter gap; the letter gap is not read at 0.45 L (0 of 20) and is read below it. So any "no" of the
  reviewers at a value the page reads points to a reading too permissive there.

## One run

1. Clone `main`, `npm ci`, `npm run setup` (in the scheduled session).
2. `node tools/agent_tester.js --out agent-runs/<date>`: serves the page of the clone, opens it in headless
   Chromium with the tester's code, does the arrow and copy tasks of the standard set, then those of the newest
   daily set (`data/daily/latest.json`), with real mouse events. About one minute.
   - Arrow task: draws the reference arrows (and taps the hydrogens to draw first). A reading is accepted when its
     structure is the one the reference arrows give; readings before it are rejected; the accepted structure is
     then submitted as an answer (separate choice). No reading as intended: all are rejected and the arrows are
     drawn again once.
   - Copy task: draws the bonds, places the atoms and charges with the row of atoms, reads the drawing. Read as
     the structure shown: confirmed. Otherwise: flagged as a wrong reading with the differences (bond missing,
     bond added, bond order, letter, charge) and drawn again once.
3. The page saves the entries file as for a tester; the script replays it (`tools/replay.js`) and writes the run
   record `run-<date>-<tester>.json`: tester, label, traits, habits, commit, tool versions, and for each attempt
   the seed, the habits used, the intended answer, the strokes as the page recorded them (and, for arrows,
   the structure they were drawn on, `convention` and `arrowCases`), the readings, the outcome, the entries recorded
   and the screenshot. Exit code 1 if the page reported an error or an entry does not replay.
4. The session replays the file, opens the screenshots of the attempts that did not end as intended (at most 12),
   reviews the reference steps of the daily set (sound, doubtful or wrong) and writes `report.md`.
5. `tools/agent_review_data.js` turns the run record into `runs/<runId>.json`, adds the run to `runs/index.json` and
   copies the entries file; the session publishes them with the review page (below).

Locally: `npm run agent -- --agent john0004 --date 2026-11-17` (outputs in `agent-runs/<date>/`, ignored by git).
`--index` (script 0.2.0, standard copies once per ink version) was withdrawn by decision 63 (script 0.2.1): the
standard copies are drawn at every run.
`--types T1` (script 0.1.9) does the arrow tasks only: used for a run made again with a new arrow ink, whose
copies would be drawn with the same strokes as the first run (ink 0.4.0 draws copies as 0.3.0 did).

## Daily run: Claude Code scheduled task (2026-11-16)

- Scheduled task "Daily tester" (before 2026-11-23: "Agent tester daily run (Daily Curly Chem)"), a fresh session
  every day at 06:17 America/New_York, Saturday and Sunday included,
  after the daily set is built (03:30 UTC). Prompt: `docs/AGENT_TASK_PROMPT.md` (identical to the stored one; a
  change is made in both). Every tester of `rotation` runs once per date; a run already in `runs/index.json` is not
  run again (a second firing on the same date adds only the missing testers). One publish adds all runs of the
  date. Time: about 2 minutes per tester for the script, plus the report.
- Runs dated Saturday or Sunday are listed on the review page from the next Monday (decision of 2026-11-23): review
  data 0.4.0 writes `visibleFrom` (`Tasks.releaseDate`) in each line of `runs/index.json`, and the page leaves out a
  run whose `visibleFrom` is after today in New York ("waiting" count in the status line). The agents open the test
  page with `?ahead=1` (script 0.1.7), so a run on Sunday tests the set dated Saturday.
- Workflow job `testers` (decision 72, 2026-11-26): the mechanical steps (3a, tester runs, and 3b, replay) run in
  `.github/workflows/pages.yml` right after the daily set is built (scheduled run at 03:30 UTC, or a manual run;
  input `testers_only` runs only this job, dated today). Each tester's folder (run record, entries file, `shots/`,
  `tester.txt`, `exit.txt`, `replay.txt`) goes into the artifact `agent-runs-<date>` (14 days; about 14 MB for four
  testers), never committed; the figures are in the job summary. Runs are dated the next day in New York, the
  morning the task publishes them, as before. The scheduled task fetches the artifact (step 2b: GitHub tools, then a
  download link on `productionresultssa*.blob.core.windows.net`) and does steps 3a and 3b itself when it cannot.
  The download host must be allowed in the network settings of the environment; on 2026-11-26 it was not (proxy
  answer 403), so until then the task does the steps itself and says so. A failure of the job does not stop the site.
- The session changes nothing in the repository and commits nothing; its outputs go to the review page only.
- `console/` (Managed Agents agent, environment and deployment of 2026-11-14) is kept but not used: it was never
  applied.

## Review page

https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4 (claude.ai artifact, private to the user; source
`tools/agent_review_page.html`, capabilities `db` and `user`).

- Structures (the scene of an arrow task, the structure to copy or that the reference arrows give, the structures the
  page read) are drawn by the review page itself from their layout, with every hydrogen of N, O, S, ... drawn as a
  bond and hydrogens of carbon implicit (user, 2026-11-16, for clarity of the review). Geometry: one heavy
  neighbour and one H bent at 120 degrees on the side away from the neighbour's other bonds (C=N-H, C-O-H); two H at
  +-120 degrees; three at 90, 180, 270 degrees; with two or more heavy neighbours the H go into the largest gaps;
  lone H2O as a V, H3O+ as a Y; bonds to H are two thirds of a bond. Charge signs go in the direction the test page
  uses (`Scene.labelPlan`: the free direction nearest to the upper right, tried from -45° in steps of 15°, at least
  0.75 rad from every bond; from 2026-11-26, so that an arrow drawn from a charge sign is seen where the tester saw
  the sign; before, the first free of eight directions, which differed for 17 of the 36 charged atoms of the arrow
  tasks up to 2026-11-24).
- Sampling (request R4, review data 0.6.0): each attempt of a run has `listed`; the page shows only listed attempts
  (the count left out is in the progress line). Listed: every arrow attempt with a rule broken on purpose, every
  copy with a boundary measure, every attempt of an imprecise tester, and a fifth of the other attempts of a precise
  tester, drawn from the attempt's seed (the same for every reviewer). Runs made before have no `listed`: all shown.
- People's entries files (upload route, `uploads` in the page's database; described in `docs/INTERFACES.md` I4):
  listed on the day they are added (New York), with the date the tester saved the file beside the tester. A file
  written by `node tools/failures.js <file> --write <out>` carries `failuresOnly`; its copies ask "Did the person draw
  the structure asked?" (structure asked beside what the page read). Arrow attempts of people with no accepted
  reading ask "Do these arrows show the step asked?". Both stored in `outcome` (right, wrong, unsure) with `asked`
  "drawn-as-asked" (request R4, decision 62).
- "Not reviewed by you" (2026-11-26): above the runs table, the dates that still hold attempts without an answer of
  the reviewer shown, with their number (listed attempts less answers saved, per run), each a link to its date.
  People's entries files are not counted there; the five copies of the panel below are, for dates up to today.
- "Drawings of people" (decision 65, 2026-11-26): below the runs, five structures copied by people for the date shown,
  the same for every reviewer, with the questions of the agents' copies. Pool of a date: the copies with ink of the
  people's entries files added up to that date (not files of failures only), only those whose structure to copy has a
  layout in the file (the daily set of 2026-11-13 has none: 40 of the 166 copies of the file of 2026-11-25 are left
  out); files in the order they were added, within a file one copy of each task before a second one, tasks and copies
  ordered by a hash of their keys. The k-th weekday from the date of the first file takes copies 5k to 5k + 4, from
  the start again once used up; Saturday and Sunday show Friday's copies; a past date keeps its copies. Answers are
  stored under the attempt's key (`reviews/<reviewer id>/answers/<runId>__<set>__<task>__<attempt>`), so an answer
  given when the file was shown as a run counts here too. People's files are no longer shown as runs by default;
  they can be ticked in the runs table.
- "Arrow convention" panel (2026-11-26): opened, it loads `convention.html` (the reviewer sheet, published with the
  page) and shows its drawings. The page does not show the `convention` of an attempt. Layouts come from `tools/agent_review_data.js` (`scenes` in the run file,
  RDKit 2D coordinates); runs published before 2026-11-16 have them in `runs/<runId>.scenes.json`; RDKit drawings
  (`svg`) are the fallback. The test page itself still shows hydrogens in labels (OH, NH2); drawing arrows with N-H
  as a bond on the test page is to be explored later (user, 2026-11-16).
- Every run is kept. A run is three files published with the page: `runs/<runId>.json` (attempts, structures, run
  figures, report), a line in `runs/index.json`, and `entries/<entries file>` (the entries saved by the page during
  the run). A publish adds the files it names and keeps the others, so earlier runs stay. runId = `<date>_<tester>`;
  a further run of the same tester and date (made again with a new ink, user request of 2026-11-16) is
  `<date>_<tester>_<suffix>` (`--suffix` of `tools/agent_review_data.js`, e.g. `ink0.2.0`), and the first run is kept
  with the answers given on it. The index line carries the ink and script versions.
- The page shows one run date at a time; each run's column keeps the width of a quarter of the page (arrows next to "Runs" go to the earlier or later date; it opens on the newest date or the date shown last); all runs of that date are listed with their ink version, except runs drawn with ink 0.1.0 (not listed since 2026-11-20, user request; files and answers kept); the newest run of each tester is shown by default, each run can be ticked or unticked, and each
  task shows the chosen runs side by side.
- Reviewers (decision of 2026-11-16): members of the organization, given access in the page's Share menu at
  Contributor level (Viewers and Commenters cannot save; Editors could also republish the page). Each reviewer's
  answers are kept apart under their claude.ai account: `reviews/<reviewer id>/answers/<runId>__<set>__<task>__<attempt>`,
  plus `reviews/<reviewer id>` (marks the reviewer). Database rules declared with the page: `reviews` read `admin`,
  write `owner`; `reviews/{self}` read and write `interact`. So a reviewer reads and writes only their own answers;
  the owner and Editors read all and see a table of reviewers (answers, answers on the date shown, disagreements
  with another reviewer) and can show one reviewer's answers (read only). The page stores reviewer ids, never names.
- Each answer has `drawing` ("not-person" when a person would not draw it), `expected` (yes, no, unsure), `outcome`
  (right, wrong, unsure; asked only when the right structure was not found; for "no reading" the question is whether
  the no reading is correct, also for a copy whose reading is not a valid structure, from 2026-11-24), `asked` (the
  question `outcome` answers), `note`, `reviewer`. Arrow attempts of people (entries files added from the page,
  decision 58): one question only, "Is this structure what these arrows show?", on the reading the tester accepted
  (`outcome`, `asked` "accepted-reading"); the structure of the problem and the answer submitted are shown, not
  judged; no accepted reading, no question. The readings are drawn from the arrows on the tester's structure (bonds
  formed or changed in colour, bonds broken dotted; decision 59): uploads keep the arrows of each reading
  (`readingArrows`); for earlier uploads the page computes the readings again from the recorded strokes, with
  `src/arrows.js` and `src/readings.js` published with the page (republish them when their `VERSION` changes),
  and falls back to the SMILES when the versions, the number of readings or the atoms and charge differ.
  `outcome` refines the label (`docs/PLAN.md` F, decision of
  2026-11-24): "should not give the right structure" with another structure read and the outcome judged wrong is a
  "page misread", a negative example for both structures. Every judgement counts on its own: an attempt can be "correct" for
  one reviewer and "incorrect" for another, and all judgements count in the 98 % bound of the replacement rule
  (`docs/PLAN.md`, section F). Answers saved before reviewers were kept apart were moved by the owner's page into the
  owner's space (31 answers, 2026-11-16).
- People outside the organization cannot open the page: its organization does not allow public links or e-mail
  invitations to outside people.
- Limits: a version holds at most 511 files (two per run: about 250 runs) and 256 MB; split the page before that.
- Earlier versions of the page are kept by claude.ai; the answers are in the database, not in a version.

## Review after two weeks (decision of the user)

After 14 runs (each tester 3 or 4 times):
- per tester on the fixed panel: arrow tasks accepted on the first reading, copies confirmed on the first attempt,
  reasons of the flags;
- reproducibility: spread of arrow end points and of the habits used between runs of one tester, compared with
  the variable testers (from the run records; analysis script to be written when the records exist);
- report quality;
- then: calibrate precision on human drawings, add testers or runs per day, or stop.

## First runs (session of 2026-11-14)

Run in a Claude Code cloud session (not yet in the Console), seeds of 2026-11-15: standard set (6 arrow tasks,
4 copies) and daily set of 2026-11-13 (5 arrow tasks, 10 copies). Figures are counts of tasks or attempts.

| Tester | Arrow tasks accepted on the first reading / accepted (of 11) | Copies confirmed on the first attempt / confirmed (of 14) | Flagged drawings | Entries replayed | Page errors | Time |
|---|---|---|---|---|---|---|
| john0002 (precise, consistent) | 11 / 11 | 10 / 12 | 6 | 29 / 29 | 0 | 64 s |
| john0003 (precise, variable) | 10 / 10 | 10 / 13 | 5 | 28 / 28 | 0 | 66 s |
| john0004 (imprecise, consistent) | 8 / 10 | 0 / 2 | 26 | 39 / 39 | 0 | 94 s |
| john0005 (imprecise, variable) | 10 / 11 | 2 / 5 | 21 | 37 / 37 | 0 | 91 s |

Observations:
- Arrow task `t1-cc-bond` (standard set): the two atoms joined by the new bond are 5.1 units apart on the page,
  above `pairReach` (4.5 units) of `src/readings.js`. An arrow that ends in the middle of the two atoms cannot give
  the reference; it is read as intended only when it ends near the atom that receives the bond. The first version
  of the script, which ended such arrows at the middle, failed this task on both attempts for the two testers run
  with it; where such an arrow ends is now a habit of each tester (from the middle to near the atom). Not changed
  in the page: thresholds are set on drawings of people (`CLAUDE.md`); to watch in the test run.
- An arrow from a lone pair to a bond of the same atom drawn shorter than 0.5 units is dropped by the page
  (`src/canvas.js`) without a message; the script now draws such arrows from farther out.
- Copies by the imprecise testers are mostly flagged: bonds that do not meet, two bonds drawn in one nearly
  straight stroke, second lines of double bonds not read. Whether people draw this way is not known until the
  noise is calibrated.
- Drawn N-H bonds (ink 0.2.0, 2026-11-16): the page places a typed atom on the nearest ink point within 0.6 units
  and, when another typed atom lies within 0.45 units of that point, changes that atom instead of adding one
  (`place` in `src/canvas.js`). A short N-H stroke then turns the typed N into H: the N is lost, and the reading has
  a separate H (H-), H-H or a short stroke read as a letter (F, I). A first draft of the ink (bonds to H 0.9 of a
  bond, full gap at both labels, N-H strokes of about 16 px) hit it often; ink 0.2.0 draws bonds to H at full
  length with smaller gaps between two labels. Copies confirmed of 9 (first attempt) on the set of 2026-11-16, ink
  0.1.0 (scheduled run) → ink 0.2.0 (session run): john0002 8 (7) → 8 (8); john0003 9 (8) → 9 (9); john0004 3 (3)
  → 2 (2); john0005 3 (1) → 2 (1). The imprecise testers still lose the N of their NH2 and NH copies this way. Not
  changed in the page (synthetic evidence; thresholds are set on drawings of people). To watch in the test run:
  whether people draw X-H bonds short enough to hit it.
- Round 1 (2026-11-21), from the judged agent entries of 2026-11-16 to 2026-11-20 (205 copies, 185 arrow attempts):
  - Recognizer 0.4.1: copies judged readable by every reviewer who answered, read as the structure to copy: 75 → 80
    of 90 (C–C≡N drawn in one line; short second line of C=N). Copies judged not readable but read as the structure
    to copy: 20 → 28. People's fixtures unchanged in counts (`docs/RECOGNITION.md`).
  - Ink 0.3.0: 11 reviewer notes said arrows were drawn over bonds or other arrows (all 11 read as intended). An
    arrow now bulges to the side whose arc stays clear of the bonds and of the arrows of the step already drawn,
    when one side is clearly freer (probability `care`: 0.95 precise, 0.7 imprecise); otherwise the habit
    `arrowLeft` decides as before. Figures on the set of 2026-11-21 in the round-1 report (`docs/BOARD.md` B3).
