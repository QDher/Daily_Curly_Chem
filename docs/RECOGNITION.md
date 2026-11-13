# Hand-drawn structure recognition, version 0.3.0 (component R0)

Implemented by `src/recognize.js` (letter shapes in `src/glyphs.js`), tested by `test/test_recognize.js`.
No training: geometry and templates. Thresholds are in `Recognize.P`, as fractions of the bond length L.

## Input and output

`Recognize.recognize(strokes, { scene, L, nominal, labels })` → `{ scene, L, unknown, edits, labels, counts }`.

- `strokes`: point lists (the raw ink). Stroke order and timing are not used.
- Without `scene`: a new structure; coordinates are scaled so that a bond is 1.5 units. `nominal` (the bond length
  of rendered structures) is used only when the drawing has no stroke long enough to be a bond.
- With `scene`: the strokes are merged into it (L = 1.5): a line from an atom adds a bond and an atom, a line between
  two atoms adds a bond, a line along a bond raises its order, a letter written on an atom changes its element or
  charge. Atom and bond ids of the scene are kept; `edits` lists the changes.
- `labels`: atoms and charges entered without handwriting, `[{ el | null, q, x, y }]` (`el` null: a charge alone,
  given to the nearest atom). They need no reading and are never in `unknown`. On the page they come from the row of
  atoms (click an element, click the place) or, with a mouse, from pointing at a place and typing the letters (B then
  r for Br, C then l for Cl, S then i for Si; + and − for charges; Backspace removes). The place snaps to an atom, to
  the end or a corner of a stroke, or stays where it is.
- `unknown`: atoms whose label was not read with confidence; the page circles them.
- Hydrogens are not read: they follow from the usual valence, the charge and the bonds (`implicitH`).

## Steps

1. Bond length L: the long straight pieces of the strokes; a straight stroke that points at a letter is counted up to
   that letter; lines of two or three times the usual length are left out. After a first reading, if the atoms found
   are farther apart than L, the drawing is read again with the larger value. On a shown structure the drawing has
   its own scale: L is estimated from the strokes when the estimate is between 0.5 and 1.4 times the bond length of
   the structure, else that bond length is used.
2. Straight strokes: end-to-end distance above 0.88 of the path, and no turning of 40° or more between the fifth of
   the stroke before and the fifth after any point. A bowed or wobbly line is straight; a zigzag is not.
3. Bond ink or label ink.
   - Curved strokes: label below 0.7 L; never a label from 1.3 L. In between, a label when the stroke is compact
     (path at least 1.6 times the diagonal of its box) or turns back sharply (125° or more, as in N); a closed stroke
     is a ring when it has three sides of at least 0.6 L and two corners, else a letter (O). Letters written by hand
     are often two thirds of a bond high, so size alone does not decide.
   - Straight strokes: bond from 0.55 L. Shorter ones (from 0.25 L) are bonds when both ends point at something (a
     letter, the end of a bond, an atom of the scene, a typed atom), when one end does and the stroke is at least
     0.4 L (a bond with a free end drawn short), or when they run along a bond. Straight strokes with a small curved
     stroke running along them (B, P) or a short bar ending on their inside (H, F) are letter parts.
4. Bonds: corners of each stroke from the turning of its direction (between the 0.2 L before and the 0.2 L after each
   point, local maxima of at least 25°, at least 0.35 L apart). A bowed line turns a little everywhere and is one
   bond; two bonds at an angle turn at one place. A shorter parallel line within 0.3 L raises the order of the longer
   one; a long line is cut where such a piece starts or ends (C–C≡N, C=C=O). A line is cut where another bond ends
   on its inside, and into two or three bonds when it is two or three bond lengths long.
5. Labels: strokes closer than 0.2 L form one label. Removed in this order: + and − (small, raised, at the right), H
   (two uprights joined by a bar), the tail of a two-letter symbol (l, r, i; an r may be one stroke or an upright with
   a hook). The capital: one stroke with two sharp reversals and no loop is N; otherwise it is matched against the
   templates (C, N, O, S, F, P, B, H, I) by point-cloud distance ($P).
6. Atoms: ends of segments closer than 0.38 L are one atom; an end ends on a label when the nearest point of the
   label's box is within 0.45 L, ahead of the end and within 0.2 L of the line of the bond. A lone + or − is given to
   the nearest atom within 0.9 L.

## Benchmark (synthetic ink, 2026-11-13)

`data/structures.json`: 390 structures of the published problems of both sites (no metals); 376 are used (the others
have radicals or are not read back by RDKit). Each is redrawn by `src/ink.js` and must be read as exactly the same
structure.

| Noise level of the synthetic ink | Exact structures |
|---|---|
| 0 (exact lines and letters) | 83.5 % |
| 1 (neat) | 80.9 % |
| 2 (ordinary) | 59.0 % |
| 3 (careless) | 19.4 % |

The letters of the synthetic ink are the recognizer's own templates with distortion: these figures say that the
method is consistent, not how it performs on real handwriting. That is measured in the test run.

## Real drawings (first file, 2026-11-13)

One tester, mouse, 14 drawings recorded with version 0.1.1 (letters written by hand). Their stroke points are in
`test/fixtures/drawings_2026-11-13.json` (no timing, pressure or tester label; committed with the tester's
agreement), with the structure asked and what the current version reads; `test/test_recognize.js` fails when a
reading changes or fewer than 5 are exact. Read as exactly the structure asked:

| Version | Exact | Bonds right, a letter wrong |
|---|---|---|
| 0.1.1 (as recorded) | 1 of 14 | 0 |
| 0.3.0 | 5 of 14 | 3 (N read as P once; Br read as B or O) |

Of the other 6: three drawings are incomplete (a letter alone, or a bond that does not reach the letter), one writes
methyl groups as "Me", two write "NH2+" with a subscript. Main causes found in version 0.1.1: letters written as
large as two thirds of a bond were taken for bonds (size rule), slightly bowed bonds were cut in two (corner
tolerance), on a shown structure the drawing was read at the scale of the structure, and bond ends next to a letter
were attached to it. The synthetic figures above went down by 2 to 8 points with these changes: the synthetic ink
has letters of 0.42 bond length, smaller than real ones.

## Known limits

- Not read: wedge and hash bonds, aromatic circles, abbreviations (Me, Ph, OMe), written hydrogen counts and
  subscripts (a label such as NH2 with a large 2 is misread), radicals, elements other than C, N, O, S, F, P, B, H, I, Cl, Br, Si.
- A drawing whose bonds all run between two labels (Br–Br, H–O–O–H) or that has one bond only (CH3–I) is read
  unreliably: the bond length cannot be found.
- Letters that touch a bond or each other, and bonds shorter than half the usual length, are often misread.
- Two bonds drawn in one stroke at an angle wider than about 155° are read as one line; it is cut in two only when
  it is about two bond lengths long.
- Handwritten two-letter symbols (Br) and small letters are read unreliably with a mouse; atoms can be entered
  without handwriting (`labels`).
- Failures at noise level 0 are mostly crowded layouts (cages, bridged rings) where atoms or bonds nearly overlap.
