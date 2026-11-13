# Known weaknesses (to correct)

Observed on real input. New cases: a GitHub issue with the label `weakness` (template "Weakness of the page or of a
model"), ideally with the entries file of the session, which holds the strokes. Each case is listed here with its
status; a correction comes with a test built from the strokes when a file is available.

| # | Date | Component | Observation | Likely cause (not confirmed on the strokes) | Status |
|---|---|---|---|---|---|
| 1 | 2026-11-13 | Structure recognition (R0) | A bond is not recognized when the line is not straight enough | A stroke counts as straight only if end-to-end distance / path length is above 0.93; a wobbly short line is then treated as a curved stroke and, below 0.7 bond length, as label ink | open; needs strokes |
| 2 | 2026-11-13 | Structure recognition (R0) | Two bonds drawn in one stroke are read as one when the angle between them is too shallow | Corner tolerance 0.15 bond length: a corner is found only if it deviates by more than that from the straight line, i.e. the angle must be below about 163° for two full bonds, less for short ones | open; needs strokes |
