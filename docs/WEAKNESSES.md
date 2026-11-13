# Known weaknesses (to correct)

Observed on real input. New cases: a GitHub issue with the label `weakness` (template "Weakness of the page or of a
model"), ideally with the entries file of the session, which holds the strokes. Each case is listed here with its
status; a correction comes with a test built from the strokes when a file is available.

| # | Date | Component | Observation | Likely cause (not confirmed on the strokes) | Status |
|---|---|---|---|---|---|
| 1 | 2026-11-13 | Structure recognition (R0) | A bond is not recognized when the line is not straight enough | A stroke counts as straight only if end-to-end distance / path length is above 0.93; a wobbly short line is then treated as a curved stroke and, below 0.7 bond length, as label ink | corrected in version 0.3.0 on the first entries file: straight from 0.88 of the path, corners from the turning of the direction (a bowed line is one bond) |
| 2 | 2026-11-13 | Structure recognition (R0) | Two bonds drawn in one stroke are read as one when the angle between them is too shallow | Corner tolerance 0.15 bond length: a corner is found only if it deviates by more than that from the straight line, i.e. the angle must be below about 163° for two full bonds, less for short ones | partly: corners are found from 25° of turning (angle below about 155°); a shallower pair is one line, cut in two when about two bond lengths long. No example in the first entries file |
| 3 | 2026-11-13 | Structure recognition (R0) | Br (bromine) written by hand is not recognized | The rule for the second letter expects the r as two strokes (an upright and a separate hook touching it). An r written in one stroke is not taken as the tail of a two-letter symbol, and the label is then read as one letter (checked with constructed strokes, see below) | corrected in version 0.1.1 for an r written in one stroke (test in `test/test_recognize.js`, constructed strokes); not confirmed on the reported handwriting |

Check of case 3 with constructed strokes (2026-11-13, `Recognize.readLabel`, version 0.1.0): B in 3 strokes + r in 2
strokes → Br; with the r in one stroke → not Br, whether the B is written in 3 strokes or in 1. Version 0.1.1 reads all
four as Br.

| # | Date | Component | Observation | Cause | Status |
|---|---|---|---|---|---|
| 4 | 2026-11-13 | Page (draw and arrows) | When an incorrect structure was confirmed in the drawing phase, the arrow phase could not be validated although arrows and result were right | The arrow phase continued from the confirmed drawing, so every result contained the wrong species | corrected: the arrow phase starts from the structures asked for; test in `test/test_page.js` |
| 5 | 2026-11-13 | Page (draw and arrows) | Structures were not redrawn when switching to the arrow phase | Atoms added by a drawing on a shown structure kept their hand-drawn positions | corrected: clean layout of all structures at the switch; test in `test/test_page.js` |
| 6 | 2026-11-13 | Structure recognition (R0) | Letters written with a mouse are recognized very badly | Mouse handwriting is far from the letter templates; no strokes available | not corrected in the recognizer; avoided since version 0.2.0 by entering atoms without handwriting (row of atoms, or pointing and typing); handwritten letters remain possible |
| 7 | 2026-11-13 | Structure recognition (R0) | Letters as large as two thirds of a bond were read as bonds; a large O as a ring | Letters and bonds were separated by size only (first entries file: 12 of 14 drawings flagged) | corrected in version 0.3.0: shape rules (compact stroke, sharp reversal, closed stroke without long sides) |
| 8 | 2026-11-13 | Structure recognition (R0) | On a shown structure, a drawing smaller than the structure was misread | The bond length of the shown structure was imposed on the drawing | corrected in version 0.3.0: the scale of the drawing is estimated |
| 9 | 2026-11-13 | Structure recognition (R0) | Handwritten Br read as B or O; a small N read as P; "NH2+" with a subscript and "Me" not read | Letter reading by templates; subscripts and abbreviations are not supported | open; atoms can be entered without handwriting. Letter reading is the part to train (R2) |
| 10 | 2026-11-13 | Page (touch screen) | With a stylus (and possibly fingers) the page scrolls instead of drawing | `touch-action: none` was set on the frame only, which some browsers do not honour for touch and pen; the same setting also blocked scrolling over frames that only show a structure | corrected: in frames that take input, touch, gesture, context-menu and selection events are cancelled and `touch-action` is none on the frame and its container; frames that only show a structure scroll normally. Test in `test/test_page.js` (emulated touch); not confirmed on the reported device |

First entries file (2026-11-13, one tester, mouse, recognizer 0.1.1): all 14 drawings and 8 arrow entries replay to
the stored results. The stroke points of the drawings are the regression test of cases 1, 7, 8 and 9
(`test/fixtures/drawings_2026-11-13.json`). Arrows: the first reading was accepted in 8 of 8 entries. Drawings: figures in
`docs/RECOGNITION.md`.
