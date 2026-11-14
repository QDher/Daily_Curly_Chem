# Plan: drawing fixes and features after the first test run

Recorded 2026-11-14 at the user's request. Status of every item: **planned, not started**.

## Rule while the first test run is open

- The page (`index.html`, `src/canvas.js`, `src/recognize.js`, `src/arrows.js`, `src/readings.js`, `src/scene.js`,
  `data/tasks.json`) is not changed for these items until the first test run has collected enough data. All testers
  of the run then use the same version, and their entries can be compared.
- This file is updated as observations come in (entries files, remarks, `docs/WEAKNESSES.md`): add them under
  "Evidence" of the item concerned, with the date and the counts, never with remark text.
- Exception: a fault that blocks testers (page error, lost entries) is fixed at once, as before, and noted in
  `docs/CONTEXT.md`.
- Items 1, 2, 4 and 5 give instant feedback and change how people draw. Entries made after they land are a
  different population: the first change adds `versions.page` to every entry, and reports compare figures within
  one page version only.

## Summary

| # | Item | Component | Depends on | Changes recorded data | Version raised |
|---|---|---|---|---|---|
| 1 | Bond lines straightened as they are drawn | `src/canvas.js` (display) | – | display only; raw points kept | `versions.page` |
| 2 | Clean-up preview after a 1 s pause with the pointer down | `src/canvas.js`, `src/recognize.js` | 1 | new field `previews` | `versions.page`, `Recognize.VERSION` if rules move |
| 3 | Rule for third-row atoms that can exceed the octet | `src/arrows.js`, `src/recognize.js` | – | readings of existing entries can change | `Arrows.VERSION`, `Recognize.VERSION` |
| 4 | Select, move and rotate a fragment drawn separately | `src/canvas.js`, `index.html` | – | new field `moves` | `versions.page` |
| 5 | Fragments snap together, within valence rules | `src/canvas.js`, `src/recognize.js` | 3, 4 | new field `snaps` | `versions.page`, `Recognize.VERSION` |
| 6 | Overlapping bonds: avoid, then distort within limits, then draw a bridge | `src/scene.js` (layout), `src/canvas.js` (rendering) | – | coordinates of shown structures only | `versions.page` |

Proposed order: 3 (rules only, no interface), then 6 (affects every structure shown), then 1, 2, 4, 5. Item 6 also
applies to the previews of item 2 and to the results of moves and snaps (items 4, 5).

---

## 1. Line smoothing while drawing

**Goal.** A stroke meant as a bond is shown as a straight segment as soon as it is finished, so that the tester sees
at once that it was taken as a bond (and not as a letter, or as two bonds).

**Current state.** Ink is shown as drawn (`renderInk` in `src/canvas.js`). Strokes are classified only when "Read
drawing" is pressed: `isStraight` (straight from 0.88 of the path, windows of a fifth of the stroke), `corners`
(turning of the direction), `letterShape` in `src/recognize.js`.

**Design.**
- On `pointerup` in draw mode, classify the stroke alone with the recognizer's own functions (`isStraight`,
  `corners`, `letterShape`), using the bond length estimated from the strokes so far (`estimateL`, nominal 1.5 when
  there are too few).
- Bond: draw the chord from the first to the last point (or the polyline through the corners for a stroke of several
  bonds), in the ink colour. Letter part: leave as drawn. Undecided: leave as drawn, slightly fainter.
- The raw points stay in `strokes` as now; the straightened form is display only. The recognizer still reads raw
  points, so a reading never depends on the display.
- Ends of a straightened bond close to an existing bond end (within 0.2 L) are shown joined.

**Evidence needed from the first run.** Drawings flagged `bond-extra` or `bond-missing` and corrections that remove
or add a bond (bowed bonds cut in two, two bonds read as one); remarks about strokes read as letters.

**Tests.** Unit: classification on the real fixture (`test/fixtures/drawings_2026-11-13.json`) gives the same bond /
letter split as the full recognizer. Page: a slightly bowed stroke is shown straight; the stored points are the raw
ones; a letter stroke is not changed.

**Risks.** A wrong classification becomes visible (intended: the tester can undo and redraw). Mouse jitter on short
letter strokes (the upright of N) may be straightened: harmless in display, since the reading uses raw points.

---

## 2. Structure clean-up while drawing (pause of 1 s)

**Goal.** While drawing several bonds in one stroke, a pause of about 1 s with the pen, finger or mouse button still
down shows the cleaned-up structure of that stroke: mostly zigzag chains and rings.

**Current state.** Nothing happens until "Read drawing". Clean layout exists only for confirmed structures
(`Scene.relayout`, RDKit).

**Design.**
- Pause: pointer down, movement below 0.15 L for 1.0 s (to be tuned on recorded timings: entries already hold
  `times` per point, so the pause length testers make naturally can be measured from the first run).
- Preview: corners of the stroke so far (`corners`); if the stroke closes on itself (end within 0.4 L of its start)
  with 3 to 8 corners, a regular ring of that size; else a chain with bonds of length L and angles of 120°, following
  the drawn direction of each turn. Shown faint over the ink.
- After the preview: lifting the pointer accepts it (the stroke is replaced in the display by the clean form; raw
  points kept); moving on continues the same stroke and the preview disappears. Undo removes the whole stroke.
- Recorded per stroke: `previews: [{ at: time, kind: 'chain'|'ring', n, accepted }]`, so that the data say whether
  testers relied on the preview.

**Evidence needed.** Distribution of pauses inside strokes in the first-run timings (to avoid triggering on natural
hesitations); drawings with multi-bond strokes and their reading errors.

**Tests.** Unit: chain and ring previews from synthetic strokes and from the real fixture strokes with several
corners. Page: a held pointer for 1 s shows the preview (emulated mouse and touch); release accepts; moving on
cancels.

**Risks.** Accidental triggers on slow drawing; the browser's long-press handling on touch (already blocked inside
input frames, `block` in `src/canvas.js`; to recheck on iOS and Android).

---

## 3. Third-row atoms that can exceed the octet

**Goal.** One explicit rule, shared by the arrow interpreter and the recognizer, for S, P, Si, Cl, Br, I (and Se if
added): which bond totals and charges are allowed, so that sulfoxides, sulfones, phosphonium ylides and phosphine
oxides, and iodine(III)/(V) reagents are accepted, and impossible ones are refused.

**Current state.**
- `src/arrows.js`: `SHELL_MAX` checks only H, B, C, N, O, F. Third-row atoms are not checked at all: an arrow may give
  S or Cl any number of electrons (accepts impossible structures).
- `src/recognize.js`, `implicitH`: one usual valence per group (S 2, P 3, Cl 1); above it, 0 hydrogens and no error.
- RDKit (used for canonical SMILES) allows its own valence list (S 2/4/6, P 3/5, I 1/3/5, Cl and Br 1 only); a
  structure our rules accept can fail there, and the page then says "an atom with too many bonds".

**Design (to be confirmed by the user).**
- A table of allowed states per element and charge, as total bond order plus lone pairs, for example:
  S neutral 2, 4, 6; S⁺ 3, 5; S⁻ 1; P neutral 3, 5; P⁺ 4; Si 4; Cl, Br neutral 1 (3, 5, 7 only if asked for);
  I neutral 1, 3, 5. Shell limit for these elements 12 electrons (I: 14).
- `arrows.js`: an arrow result is valid when each third-row atom is in an allowed state; the `octet` error gets a
  variant `valence-state` naming the allowed totals.
- `recognize.js`: implicit hydrogens take the lowest allowed state at or above the drawn bond total (S with 3 bonds
  and no charge: shown as uncertain, with the choice S⁺ or a hydrogen offered in the correction palette, instead of
  silently 0 H).
- Keep the table in one module used by both (for example `src/valence.js`), checked against RDKit in a test so that
  every accepted state also passes `Scene.canonical`.

**Evidence needed.** None of the 14 tasks of the first run uses a hypervalent atom; a later task set needs
examples (Wittig ylide, Swern or DMSO, Dess–Martin or other iodine(III), sulfonyl chloride, phosphate ester), taken
from published problems of the two sites.

**Tests.** `test/test_arrows.js`: allowed and refused cases for each element; all current tests unchanged.
`test/test_tasks.js`: references still valid. Replay of first-run entries: report any reading that changes.

**Risks.** Accepting too much makes wrong arrows look valid; the table is chemistry and must be reviewed by the user.

---

## 4. Select, move and rotate a fragment drawn separately

**Goal.** Fragments drawn apart can be moved and rotated, so that a tester can place a reagent next to the atom it
attacks, or tidy a drawing before reading it.

**Design.**
- Fragments: groups of ink strokes and typed atoms connected to each other (stroke ends or corners within 0.35 L, or
  a typed atom snapped to them); in the arrow phase and the reading panel, connected components of the scene.
- A small toggle (at least 44 px for touch) at a corner of each fragment's box. Tapping it selects the fragment,
  shown with a faint yellow shadow (`--hl` at low opacity) around its strokes or atoms.
- With a fragment selected, two handles appear: move (drag translates) and rotate (drag turns about the fragment's
  centre; steps of 15° unless the pointer is held still). Tapping outside or the toggle again ends the selection.
- Other tools are not active during a selection, so a move is never read as a stroke or an arrow.
- Recorded: `moves: [{ fragment: [stroke indices or atom ids], dx, dy, angle, at }]`. Stroke points in the entry are
  the final ones; the replay applies nothing (it reads the final points), and the log allows rebuilding the original
  drawing.
- Arrow phase: moving species changes coordinates only, never the scene's atoms or bonds; arrows already drawn are
  cleared, as when a hydrogen is drawn.

**Evidence needed.** Remarks and drawings where species were drawn on top of each other or far apart; T3 tasks where
the drawn species lies far from the atom it should attack.

**Tests.** Page: select shows the shadow; move and rotate change the points by the stated transform; the reading
after a move equals the reading of the moved points; undo restores; touch and mouse.

**Risks.** Clutter of toggles on a phone with many fragments (show toggles only for fragments of at least one bond,
or only after a tap near the fragment).

---

## 5. Fragments snap together, within valence rules

**Goal.** While a fragment is moved (item 4), an atom of it brought close to an atom of another fragment snaps onto
it when the result is allowed by valence; implicit hydrogens on that carbon (or heteroatom) are removed as needed.

**Design.**
- During a move, the nearest pair of atoms (one per fragment) within 0.4 L is a snap candidate; candidates also
  include a bond end of one fragment onto an atom of the other.
- Allowed when the merged atom stays within an allowed state (item 3 for third-row atoms, usual valence otherwise):
  implicit hydrogens drop by the number of bonds gained; a drawn or typed H on that atom is removed only if needed
  and the tester sees it disappear in the preview. Refused snaps are shown (red outline) and not applied.
- Preview while dragging (dashed outline at the snapped place); release applies it.
- Ink level (before reading): the moved strokes are placed so that their end lies on the target atom, and the
  recognizer joins them by its usual rules. Scene level (reading panel, arrow phase): the two atoms are merged in the
  scene and the change is recorded like a correction.
- Recorded: `snaps: [{ from, to, removedH, at }]`.

**Evidence needed.** Drawings where two parts meant as one molecule were read as two (corrections adding a bond
between fragments).

**Tests.** Unit: merge rules on carbon, nitrogen, oxygen and the item 3 table (allowed and refused). Page: a methyl
fragment dragged onto a ring carbon snaps and the ring carbon loses one H; a snap onto a carbon with four bonds is
refused.

**Risks.** Unwanted snaps when fragments are meant to stay apart (a reagent next to a substrate): snapping only while
a move is in progress, never while drawing, and a tester can undo.

---

## 6. Overlapping bonds

Added 2026-11-14 at the user's request.

**Goal.** No two bonds of a structure shown on the page cross or lie on top of each other in a way that can be read
as a bond meeting at an atom. In order of preference: (a) a layout with correct bond lengths and angles that has no
overlap; (b) if none is found, bond angles and lengths distorted within set limits; (c) if overlap remains, the bond
behind is drawn with a gap where the other crosses it (a "bridge"), so that the crossing cannot be read as an atom.

**Current state.** Shown structures take RDKit coordinates (`mol.set_new_coords()` in `Scene.fromSmiles`,
`Scene.relayout`); species are placed side by side by `Scene.compose`. Nothing checks for crossing bonds, between
or within species. Bonds are drawn as plain lines (`src/canvas.js`). Crossings are most likely in bridged and fused
polycycles, macrocycles, crowded substituents, and after arrows join two species. Hand-drawn ink is shown as drawn
and is not covered here; the reading panel and the arrow phase show laid-out structures and are covered.

**Design.**
- Detection, after every layout (`fromSmiles`, `relayout`, `compose`, and later the item 2 preview and item 4/5
  results): pairs of bonds with no shared atom whose segments intersect, or come closer than 0.15 L; also an atom
  closer than 0.25 L to a bond it is not part of (looks like a junction).
- (a) Avoid: ask RDKit again with its other depiction options (CoordGen on and off, ring templates), and, for a
  species with rotatable bonds, try flipping substituents about single bonds (mirror a branch across the bond);
  keep the first layout without overlap.
- (b) Distort: a small relaxation that moves atoms to remove the remaining crossings, with each bond angle allowed
  to change by at most 15° (target 10°) and each bond length by at most 15 %; ring bonds of aromatic rings kept
  regular. Accept the result only if every angle and length stays within the limits.
- (c) Bridge: if a crossing remains, choose the bond drawn behind (the one outside a ring, or the longer one) and
  cut it on both sides of the crossing with a gap of about 0.15 L, drawn in the background colour, so the front
  bond passes over it. No atom label or dot at the crossing.
- The coordinates change only the display: atom and bond ids, arrows, readings and entries' structures are not
  affected, apart from the coordinates stored in `scene` fields.
- Arrow input: a crossing point is never a target; an arrow ending there snaps to the front bond only.

**Evidence needed.** Count of structures in `data/tasks.json` and in the daily sets (`data/daily/`) that have a
crossing today (a script over all of them, run once, gives the size of the problem without changing the page);
remarks or flags about structures that looked wrong.

**Tests.** Unit: detection on constructed crossings and on known difficult structures (bridged bicycles, a
macrocycle, a crowded quaternary centre); each step (a), (b), (c) reached by a test case; after (b), all angles
within 15° and lengths within 15 %. Page: a structure with a remaining crossing is drawn with the gap; arrows still
attach to both bonds.

**Risks.** The relaxation may make a structure look less familiar than RDKit's layout with a crossing; the limits
(10 to 15°, 15 %) are to be checked on screenshots with the user before they are fixed.

---

## Evidence log

Add dated observations from the first test run here (counts and entry references, no remark text).

| Date | Item | Observation | Source |
|---|---|---|---|
