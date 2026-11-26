# Review of the two parallel tasks (people side, 2026-11-26)

Asked by the user. Proposals only: nothing here is decided (decisions are in `docs/DECISIONS.md`).

Task 1: people draw structures and mechanisms whose answer the computer knows; used to improve the reading of human
drawing and to gather data. Task 2: agent testers draw structures and mechanisms known to human reviewers, who judge
them; used to improve the agents' drawing and to find what people judge acceptable.

## Figures used

- People: 2 testers; 168 copy drawings of the first week and 21 newer ones; 75 + 18 arrow attempts.
- Agents: 4 testers, about 41 copies and 37 arrow attempts per day; 1,564 judgements by 2 reviewers up to 2026-11-25.
- Reviewer agreement: copies kappa 0.74; arrows kappa 0.38 (47 disagreements on 204 attempts judged by both).
- Recognizer on people's copies: 84 of 168 on the drawings the rules were found on; 5 of 21 on new drawings
  (5 before the last cycle; corrected 2026-11-26: 12 and 11 of 30 first written counted 9 drawings of the tuning set).
- Arrows of people: first reading accepted 71 of 75, then 13 of 18.

## Where the two tasks do help each other

- Daily end-to-end check of each set by the agents before people open it.
- Agent copies found two reading faults that people's drawings also contain (C-C≡N in one line, short second line).
- People's fixtures stop a stricter rule that would lose a drawing of people.
- Remarks of people led to display fixes that reviewers and agents also see.

## Where they do not, today

1. The main link is missing: the agents' ink is not calibrated on people's strokes (board B4). Agents fail on gaps
   between bonds and loosely drawn second lines; people fail on handwritten letters (11 of the 18 new failures are
   the letter N), rounded rings and charge signs. The agents type their atoms, so they produce none of the
   dominant failure of people.
2. Reviewers spend most of their effort on synthetic drawings: about 1,560 judgements on agent attempts against
   one uploaded file of a person. A judgement on a drawing of a person is worth more: the strokes are real.
3. The two tasks measure different things. Task 1 has a known answer, so the page can be scored without a
   reviewer. Task 2 asks "should this drawing give the structure", which for copies is close to "is it readable"
   but for arrows depends on a convention that did not exist; hence kappa 0.38.
4. Rule fixes on people's drawings generalize weakly: +19 on the tuning drawings, 0 on 21 new ones. More rule
   cycles on the same 2 testers will mostly fit those 2 testers.
5. Volume is not what the agents give: their ink is generated in code, so any number of labelled drawings can be
   produced offline. The daily runs are useful for the check and for reviewers' judgements only.

## Work of little use now

- Further recognizer rule cycles on the 168 drawings (done twice; the third would fit two handwritings).
- Judging every agent copy every day: reviewers agree on copies and the precise testers are nearly always right;
  a sample would do.
- The four fixed standard copies drawn by four agents every day: the same structures, about 16 attempts per day.
- Using "page too permissive" judgements on arrows before the convention is applied (146 judgements waiting).
- Collecting agent volume for pre-training before the ink is calibrated.

## Proposed changes, in order of value

1. More people before more rules: the contact e-mail and the invitation of testers are the bottleneck of both
   tasks (B7, B8).
2. Build link A first on the agent side: calibrate the ink on people's strokes per device, and give the agents
   handwritten letters sampled from people's letter strokes (with their agreement). Then agents can reproduce the
   dominant failure of people.
3. Move reviewer time to people's drawings: each entries file of a person goes through the review page (the upload
   route exists); reviewers answer "is this the structure asked" on the failures only. This yields what the
   recognizer needs most: for a failed drawing, whether the person drew it right.
4. Agents become a targeted instrument, not a daily census: fewer plain attempts, more attempts built to sit on a
   boundary (the arrow convention with rule breaking is the first case; the same for copies: gap between bond and
   letter, length of a second line).
5. One shared measure: after each fix, the same table for people (new drawings only) and for judged agent entries.
6. Letters: stop tuning rules; decide between typed atoms as the recommended input and a small trained letter
   classifier on people's letter strokes (earlier than stage 6, small data need).
7. Record for each human entry what the tester did next (redrew, typed the atom, gave up): it is the cheapest
   label of a failure and is partly in the entries already.

## Risks of the proposals

- Proposal 2 needs letter strokes of several people; with 2 testers the agents would copy two handwritings.
- Proposal 3 increases the reviewers' load unless the agent load is reduced (proposal 4).
- Proposal 6 (trained letters) departs from the plan's order and is a decision of the user.
