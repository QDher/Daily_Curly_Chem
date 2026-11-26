# Boundary panel and stopping rule (people side, 2026-11-26; decision 71, request R6)

Agreed by the user on 2026-11-26. Replaces, for finding thresholds, the judging of boundary attempts inside the
daily stream. The daily testers keep their natural ink (realism); the panel is a separate instrument.

## Why

In a boundary attempt of ink 0.6.0 the measure under test is mixed with the tester's general imprecision (bent
bonds, gaps at corners, misshapen letters): a "no" of a reviewer has several possible causes (user, 2026-11-26).

## Panel drawing: one variable only

| Element | In a panel drawing |
|---|---|
| Measure under test | Set to a fixed value of its range |
| Bonds | People's median values of `data/ink_profile.json` (wobble, joint gap), same pointer type |
| Letters | One sample the recognizer reads correctly (`read` = `label`), the same in every drawing of the measure |
| Other atoms | Placed with the buttons, except the one letter concerned by the measure |
| Structure and layout | Same structure, same layout and scale; only the measure changes |
| Question | Names the element: "Is this letter attached to this bond?", "Is this a double bond?", for arrows "Does this arrow start from the lone pair?" and so on; the element is marked in the drawing |

Two structures per measure: one simple, one crowded. Measures: the three of the copies (letter gap, second line
length, second line spacing) and the six of the arrows (decision 63).

## Phase 1: coarse (now)

Aim: find quickly which measures matter and roughly where their threshold is. The user asked for "50 %
confidence" in this phase; read by the session as: a threshold located to one band, without the margins of the
precise rule.

1. 5 values across the range, 3 drawings per value (two structures: 2 and 1), one round. Both reviewers judge all
   15 per measure: about 135 judgements per reviewer for the 9 measures.
2. Threshold of the reviewers: between the last value with at least half of the judgements "yes" and the first
   with less than half. No bracketing margin, no second round.
3. The same values are read offline (`node tools/compare_ink.js --boundary`, many drawings) for the threshold of
   the page, and compared with the range people use (p10 to p90 of `data/ink_profile.json`).
4. A measure is **relevant** when the two thresholds differ by one band or more inside or next to the range people
   use, or when the two reviewers differ by more than one band. The others are closed.

## Phase 2: precise (only the relevant measures)

1. 6 drawings per value at the two values around the threshold and their neighbours, values half a band apart.
2. Determined when one value has 80 % or more "yes" and the next 20 % or less, each with at least 10 judgements.
3. Else repeat around the 50 % point; stop after 3 rounds and record "no sharp threshold" with the width.
4. Reviewers more than one band apart: recorded as "reviewers disagree", to the user.

## Outcome per measure

| Reviewers accept | Page reads | Outcome |
|---|---|---|
| Yes | No | Fault of the reading to fix, if people draw in that range |
| No | Yes | Reading too permissive there; decide whether it matters |
| Same | Same | Closed |

A change of `Recognize.P` or `Readings.P` that follows is tested on the fixtures of people and with
`node tools/measure.js` as any other change.

## Asked of the agent side (request R6)

1. `tools/agent_ink.js`: an option to draw a panel attempt as above (every other habit at people's median, one
   fixed sample, typed atoms elsewhere, given value), for copies and arrows; `boundary` recorded as now, with
   `panel: true`.
2. A tool that writes the phase 1 panel as a run of the review page (9 measures × 5 values × 3 drawings), and the
   page: the question per measure with the element marked, a panel shown apart from the daily runs.
3. `tools/agent_boundaries.js`: per measure, the threshold of the reviewers by the phase 1 rule, each reviewer's
   own threshold, and the "relevant" flag given the offline table and the profile.
4. While a panel is open, boundary attempts of the daily stream need not be listed for review (sampling).

Limits: two reviewers; thresholds found on two structures; measures are taken one at a time, interactions later.
