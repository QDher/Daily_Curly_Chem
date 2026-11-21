# Evaluation of human drawings (people side), state of 2026-11-21

Answer to request R1 of `docs/BOARD.md`. Figures come from the two week files of 2026-11-20 and from
`node test/test_recognize.js` on 2026-11-21. No remark text, no tester data beyond counts.

## 1. Scope and outputs

- Scope: entries of people from the test page (arrows and copied structures), replayed with `tools/replay.js`.
- Outputs: counts in `docs/WEAKNESSES.md` (cases 12 to 18 for the week files), figures in `docs/RECOGNITION.md`,
  the fixture `test/fixtures/drawings_2026-11-20.json`, and code changes that come with a test.

## 2. Who judges, questions, labels, storage, agreement

- No separate judge. The labels are the tester's own actions on the page, recorded in the entry:
  arrows: reading accepted (rank) or rejected, answer submitted (`submitted.match`);
  drawings: confirmed (`accepted`), corrections, flagged as a wrong reading (`flagged`, `wrong`: reasons), drawn again.
- Objective label for copies: comparison of the reading with the structure of the task (`target.match`; in the
  fixture: `asked` against `reads`). This is the measure used for the recognizer.
- A confirmation alone is not a correct label: 33 of 76 confirmed copies in the week files were not the structure
  to copy. Since page 0.3.0 the page shows the comparison before the confirmation (`shown` in the entry).
- Agreement between judges: not applicable (one action per entry, by the person who drew).
- Storage: entries files stay with the user, outside the repositories. Stroke points and typed atoms of agreed
  files are in `test/fixtures/` (no timing, pressure, pointer type or tester label).

## 3. Entries files used

| Date | Tester | Device | Entries | In the repository |
|---|---|---|---|---|
| 2026-11-13 | creator | mouse | 14 drawings, 8 arrow entries | `test/fixtures/drawings_2026-11-13.json` (drawings) |
| 2026-11-20 | label `3005a301` | pen, some touch | 58 arrow entries, 145 drawings, 5 remarks | fixture of 2026-11-20 (drawings) |
| 2026-11-20 | creator, label `4f7c82a3` | mouse | 17 arrow entries, 23 drawings, 10 remarks | fixture of 2026-11-20 (drawings) |

Arrow strokes of people are not in the repository (no fixture built from them).

## 4. Testers

- Planned: five tester codes exist; one tester has sent a file. Invitation of the others waits for the contact
  e-mail (board B7). Devices wanted: touch screen and stylus (board B8); mouse and pen are covered by one person each.

## 5. Files the people side changes

`index.html`, `src/tasks.js`, `src/recognize.js`, `src/canvas.js`, `src/readings.js`, `tools/replay.js`,
`tools/update_fixture.js`, `tools/make_daily.js`, `test/` (except `test/test_agent.js`), `test/fixtures/`,
`docs/WEAKNESSES.md`, `docs/RECOGNITION.md`, `docs/CONTEXT.md`. Changes of 2026-11-21: page 0.2.0 (75870fe),
recognizer 0.4.0 (29ceade), page 0.3.0 (this commit). `tools/agent_tester.js` was touched only to follow page
changes (script 0.1.4, 0.1.5).

## 6. Decisions that touch the plan

- Readiness thresholds of `docs/PLAN.md` F are unchanged. Against them, week files: arrows first reading accepted
  71 of 75 (threshold 80 %: met); copies read exactly 45 of 168 with recognizer 0.3.0, 65 with 0.4.0 (threshold
  60 % confirmed without correction: not met); replay 242 of 243 (threshold 100 %: not met, case 17).
- Entries are compared within one page version (`versions.page`: none before 2026-11-21, then 0.2.0, 0.3.0).
- The fixture of 2026-11-20 was used to tune recognizer 0.4.0: it is a regression set, not an independent measure.
- Recognizer causes left open (rounded ring corners, C of Cl closed, bonds that stop short of the letter) wait for
  the next cycle (decision log).

## 7. Needed from the agent testers

- Agents should draw like the people in the fixture where these fail: inner ring lines far from the side or
  hooked, H written with the atom (OH, NH2), Cl with a long l, rounded ring corners.
- Runs after 2026-11-21 are made on page 0.3.0 and recognizer 0.4.0: arrow tasks show heteroatom hydrogens as
  atoms (new candidate starts for arrows), and copy tasks show the comparison before the confirmation.
- A no-regression set of judged agent copies that the page read correctly, to run beside the people fixtures.
