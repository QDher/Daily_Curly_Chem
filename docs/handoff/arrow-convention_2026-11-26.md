# Handoff: convention for the arrows drawn by the agent testers (2026-11-26)

From the people side to the agent side (request R3 of `docs/BOARD.md`). Decision 53 of `docs/DECISIONS.md`.
Status: rules proposed by the session and taken as the basis by the user; the rates of rule breaking were set
by the user on 2026-11-26. Nothing is implemented. L: bond length of the shown structure.

## Why

Up to 2026-11-25, 204 arrow attempts of agents were judged by both reviewers; they disagree on 47 (question
"should the arrows give the right structure"). Notes exist for 9 of the 47: six concern where an arrow starts or
ends (start on a bond of the atom instead of its lone pair, end on the atom instead of the bond formed, arrow
curling back onto its own bond), three concern precision. The generator (`tools/agent_ink.js` 0.3.0) produces
these cases without intending them:

| Case | Ink 0.3.0 | Result |
|---|---|---|
| Lone pair or charge | start 0.05 to 0.3 L from the atom, direction mixed between "toward the target" and "away from the bonds" (`lpFacing`), plus noise | the start lands on a bond of the atom when the target lies behind it |
| Single bond | start at the middle, moved along the bond by noise; an arrow shorter than 0.55 L has its start pushed back | the start slides toward an atom; a short arrow leaves its bond |
| Multiple bond | as a single bond; an end between two atoms lies anywhere from 50 % to 85 % toward the atom (`pairToward`) | the tail does not show which atom forms the new bond; the head lies between "atom" and "bond" |

## Rules of an arrow drawn by convention

1. From a lone pair or a charge
   - direction of the start: in a sector free of the atom's bonds (at least 30° from each); "toward the target"
     only inside that sector;
   - distance 0.15 to 0.3 L from the atom; on a charged atom the start may be at the charge sign;
   - after the noise, a start closer than 0.15 L to a bond line is moved back into the free sector.
2. From or to a single bond
   - start on the line, in the middle half of the bond (25 % to 75 %); noise along the bond is cut there;
   - a short arrow (bond to one of its own atoms) keeps its start on the bond and gets a taller arc;
   - end on an atom: within 0.2 L of it, from a side free of that atom's bonds.
3. From or to a multiple bond
   - from a multiple bond to another atom: start between 55 % and 75 % toward the atom that forms the new bond
     (known from the reference step), arc on that atom's side;
   - to a bond that gains an order: end on the middle half of that bond's line, never on one of its atoms;
   - end between two atoms (new single bond): the middle (45 % to 55 %) or the receiving atom (within 0.2 L);
     nothing in between;
   - implicit carbons: an end meant for a chain carbon lies within 0.2 L of the vertex; an end meant for a bond
     stays at least 0.3 L from both vertices.

## Rule breaking (user, 2026-11-26)

Every agent tester has a chance of breaking a rule; no tester always follows the convention.

- Rates per attempt (user, 2026-11-26): precise testers (john0002, john0003) 5 %, imprecise testers (john0004,
  john0005) 20 %. In an attempt chosen this way exactly one arrow breaks exactly one rule; the other arrows
  follow the convention.
- The rule broken is drawn from those that apply to the arrows of the step: start on a bond of the atom (rule 1), start beyond 0.5 L in empty
  space (rule 1), start in the outer quarter of the bond (rule 2), short arrow off its bond (rule 2), start in
  the half of a multiple bond away from the reacting atom (rule 3), end in the removed range between atom and
  bond (rule 3).
- Each attempt of the run record states `convention`: `ok`, or the arrow and the rule broken. This is the generator's intent,
  not a judgement: reviewers still answer on what they see.

## Use

- Reviewer sheet with drawn right and wrong pairs for the three cases (board item B10).
- Per rule: agreement of each reviewer with the intent, and what the page does with the arrows that break it.
- First run: old and new ink on the same set, both published, to compare the reviewers' agreement.

## Open

- Charge sign accepted as a start; the two accepted ends for a new single bond.
- Not measured: how the 75 arrow entries of people and the 47 disputed attempts fall under these rules.
- A change of `tools/agent_ink.js` raises its `VERSION`; names, seeds and traits of the testers stay.
