# Implementation proposal for proposals 2 to 6 (people side, 2026-11-26)

Follows `docs/handoff/review-of-the-two-tasks_2026-11-26.md`. Proposal only: nothing is started and nothing is
decided except the agreement on data below (decision 60). Names of new tools are suggestions.

Agreement (user, 2026-11-26, decision 60): the tester and the reviewer agreed to the use of their data. This lifts
the three points that were open in this proposal: the strokes of the entries file of 2026-11-25, letter samples
cut from the strokes, and reviewers seeing a tester's drawings. The rule on what enters the repository is
unchanged: stroke points only, no timing, pressure, tester label or free text.

## Proposal 2: agent ink calibrated on people's strokes (B4)

1. Extract (people side): `tools/ink_stats.js` reads the fixtures of people and writes `data/ink_profile.json`,
   distributions only, per device: gap between bond end and letter, and between bonds; spacing, length ratio and
   hook of second lines; wobble, corner rounding of rings, letter height relative to bond length.
2. Letters (people side): the same tool cuts the handwritten letter strokes out of drawings whose reading matched
   the target and stores them, normalized, as points only (`data/letter_samples.json`).
3. Use (agent side): `tools/agent_ink.js` draws its habits from the profile and writes letters from the samples
   for a share of the atoms instead of typing them; new `VERSION`, new tester names (traits change).
4. Check: the failure profile of the recognizer on agent copies approaches that of people (letters first, then
   rings and charges).

Limit: with 2 testers the agents copy two handwritings.

## Proposal 3: reviewers judge people's failed drawings

1. Filter (people side): an option of `tools/replay.js` writes a run record with only the copy attempts whose
   reading differs from the target and the arrow attempts with no accepted reading.
2. Upload through the existing upload route of the review page (to be described in `docs/INTERFACES.md`).
3. Question (agent side): for these runs, "did the person draw the structure asked?" (yes, no, unsure), with the
   target shown beside the ink.
4. Result: "yes" is a recognizer fault with a confirmed label; "no" is a drawing error and leaves the failure count.

Load: about 100 drawings for the backlog, then about 20 per tester per week. Arrow attempts of people are already
judged on the accepted reading (decision 58); this adds the copies and the attempts with no accepted reading.

## Proposal 4: agents as a targeted instrument (agent side)

1. Sampling: the review page shows every boundary attempt and about 20 % of the plain attempts of the precise
   testers.
2. The four fixed standard copies are drawn once per version of the agent ink instead of daily.
3. Boundary attempts: each varies one parameter and records it per attempt, as `convention` does for arrows
   (decision 57). For copies first: gap between bond and letter, 0 to 0.5 L; length of a second line, 0.3 to 1.0 of
   the bond; spacing of a second line, 0.05 to 0.4 L.
4. Output: per parameter, the share judged acceptable by reviewers and the share read correctly; the threshold of
   `Recognize.P` or `Readings.P` is set where the reviewers' acceptance crosses 50 %.

`docs/AGENT_TASK_PROMPT.md` and the scheduled task change together.

## Proposal 5: one shared measure (people side)

`tools/measure.js` takes a recognizer version and gives one table, appended to `docs/RECOGNITION.md` after each
change.

| Row | Content |
|---|---|
| People, tuning set | the 168 drawings (regression only) |
| People, held-out | drawings never used for tuning |
| Judged agent entries | copies the reviewers judged "should be read" |

Columns: exact reading, aromatic, with handwritten letters, per device. The held-out set is fixed by date:
drawings made after a recognizer version are held-out for that version and enter the tuning set only when the
next version is tuned on them. The agent row needs an export of the judged entries from the review database.

## Proposal 6: letters (choice of the user)

Option A, typed atoms recommended: the page presents the atom buttons as the normal way to write an atom other
than carbon; handwriting stays possible. Text and layout change, raises `PAGE`; measured through the `typed` field
of the entries. Cost: fewer handwritten letters collected for a later model.

Option B, small trained classifier: letter crops of proposal 2, labelled by the target; strokes resampled to a
fixed number of points; a small network or nearest neighbour; about 12 classes (C, N, O, S, P, F, Cl, Br, I, H,
+, −); plain JavaScript weights called by `src/recognize.js` in place of the template match. Needs a few hundred
letters per class.

Recommendation of the session: A now, the crops collected for B. A removes the dominant failure (11 of the 18 new
failures) without waiting for data.

## Order

| Step | Side | Depends on |
|---|---|---|
| 5, rows of people | people | none |
| 6 A | people | choice of the user |
| 3 | both | note on the upload route in `docs/INTERFACES.md` |
| 2, steps 1 and 2, then 3 | people, then agent | none (agreement given) |
| 4 | agent | none (ink 0.4.0 is in use) |
| 6 B | people | 2 step 2, more testers |

Not verified: the number of handwritten letters per class in the drawings of people; whether the review page can
ask a different question per run without a change of its database rules.
