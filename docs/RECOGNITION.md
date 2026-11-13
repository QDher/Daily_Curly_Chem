# Hand-drawn structure recognition, version 0.1.1 (component R0)

Implemented by `src/recognize.js` (letter shapes in `src/glyphs.js`), tested by `test/test_recognize.js`.
No training: geometry and templates. Thresholds are in `Recognize.P`, as fractions of the bond length L.

## Input and output

`Recognize.recognize(strokes, { scene, L, nominal })` → `{ scene, L, unknown, edits, labels, counts }`.

- `strokes`: point lists (the raw ink). Stroke order and timing are not used.
- Without `scene`: a new structure; coordinates are scaled so that a bond is 1.5 units. `nominal` (the bond length
  of rendered structures) is used only when the drawing has no stroke long enough to be a bond.
- With `scene`: the strokes are merged into it (L = 1.5): a line from an atom adds a bond and an atom, a line between
  two atoms adds a bond, a line along a bond raises its order, a letter written on an atom changes its element or
  charge. Atom and bond ids of the scene are kept; `edits` lists the changes.
- `unknown`: atoms whose label was not read with confidence; the page circles them.
- Hydrogens are not read: they follow from the usual valence, the charge and the bonds (`implicitH`).

## Steps

1. Bond length L: the long straight pieces of the strokes; a straight stroke that points at a letter is counted up to
   that letter; lines of two or three times the usual length are left out. After a first reading, if the atoms found
   are farther apart than L, the drawing is read again with the larger value.
2. Bond ink or label ink. Curved strokes: by size (label below 0.7 L). Straight strokes: bond from 0.55 L; shorter
   ones (from 0.25 L) are bonds when both ends point at something (a letter, the end of a bond, an atom of the scene)
   or when they run along a bond. Straight strokes touched on their inside by a small curved stroke (B, P, r) or by
   a short bar (H, F) are letter parts.
3. Bonds: corners of each stroke (Ramer–Douglas–Peucker, tolerance 0.15 L) give segments. A shorter parallel line
   within 0.3 L raises the order of the longer one; a long line is cut where such a piece starts or ends (C–C≡N,
   C=C=O). A line is cut where another bond ends on its inside, and into two or three bonds when it is two or three
   bond lengths long.
4. Labels: strokes closer than 0.2 L form one label. Removed in this order: + and − (small, raised, at the right), H
   (two uprights joined by a bar), the tail of a two-letter symbol (l, r, i; an r may be one stroke or an upright with a hook). The capital is matched against the
   templates (C, N, O, S, F, P, B, H, I) by point-cloud distance ($P).
5. Atoms: ends of segments closer than 0.38 L are one atom; an end that points at a label within 0.45 L of its box
   ends on that label. A lone + or − is given to the nearest atom within 0.9 L.

## Benchmark (synthetic ink, 2026-11-13)

`data/structures.json`: 390 structures of the published problems of both sites (no metals); 376 are used (the others
have radicals or are not read back by RDKit). Each is redrawn by `src/ink.js` and must be read as exactly the same
structure.

| Noise level of the synthetic ink | Exact structures |
|---|---|
| 0 (exact lines and letters) | 85.9 % |
| 1 (neat) | 82.0 % |
| 2 (ordinary) | 66.0 % |
| 3 (careless) | 27.5 % |

The letters of the synthetic ink are the recognizer's own templates with distortion: these figures say that the
method is consistent, not how it performs on real handwriting. That is measured in the test run.

## Known limits

- Not read: wedge and hash bonds, aromatic circles, abbreviations (Me, Ph, OMe), written hydrogen counts and
  subscripts, radicals, elements other than C, N, O, S, F, P, B, H, I, Cl, Br, Si.
- A drawing whose bonds all run between two labels (Br–Br, H–O–O–H) or that has one bond only (CH3–I) is read
  unreliably: the bond length cannot be found.
- Letters that touch a bond or each other, and bonds shorter than half the usual length, are often misread.
- Failures at noise level 0 are mostly crowded layouts (cages, bridged rings) where atoms or bonds nearly overlap.
