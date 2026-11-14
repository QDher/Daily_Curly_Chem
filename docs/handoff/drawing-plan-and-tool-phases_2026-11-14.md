# Handoff: tool phases, remark box, drawing plan (2026-11-13 to 2026-11-14)

Session `session_01HwgXng2hhX8bnTxQWEQRrJ`, repository QDher/Daily_Curly_Chem, branch `main`.

## 1. Scope

- Page changes requested by the user on 2026-11-13: tools restricted per task phase; a remark box for the first
  testers.
- A recorded plan of future drawing fixes and features (`docs/PLAN_DRAWING.md`, 11 items), written on 2026-11-14
  without any page change.

## 2. Decisions (user)

| Date | Decision |
|---|---|
| 2026-11-13 | A task (or phase) asking for arrows has the drawing tools off; one asking for a drawing has the arrow tools off |
| 2026-11-13 | The creator and the five first-round testers can leave a remark of at most 500 characters on each task |
| 2026-11-14 | Planned drawing fixes are recorded and updated only; the page is not changed for them while the first test run collects data |
| 2026-11-14 | Item 7 (H written next to a heteroatom): carbon excluded; hydrogens on carbon follow the implicit-hydrogen rule |

## 3. State per component

| Component | State | Verified | Not verified |
|---|---|---|---|
| Tool phases (`setPhase` in `index.html`) | done, deployed | 26/26 page tests (headless Chromium), screenshots at 1100 and 390 px | real devices (touch, stylus) |
| Remark box (labels in `remarks` of `data/config.json`, entry kind `remark`) | done, deployed | page tests: one per task, 500-character cut, saved on leaving the task, replaced, removed, restored after reload, hidden for unlisted labels | use by testers |
| `docs/PLAN_DRAWING.md` | 11 items, all "planned, not started" | – | – |

## 4. Open items, blockers, waiting for the user

- The Worker branch of QDher/Daily-organic-chemistry-puzzles (`claude/beautiful-pasteur-7tg1k3`) accepts only kinds
  `arrows`, `drawing`, `votes`, `questionnaire` (`MECH_KINDS`, `feedback-worker/src/rows.js`). `remark` must be added
  before sending is switched on. Not changed by this session.
- Waiting for the user: valence-state table of item 3 (third-row atoms); distortion limits of item 6 (10–15°, 15 %)
  to be confirmed on screenshots; distance threshold of item 7 (about 0.5 bond length) to be tuned on real drawings.
- Items 10 (fishhook arrows) and 11 (stereochemistry) need new tasks and a second test run.
- `ML_PLAN.md` (One-Pot repository) does not yet reference `docs/PLAN_DRAWING.md`.

## 5. Files and commits (all on `main`)

| Commit | Files | Content |
|---|---|---|
| `1289a43` | `index.html`, `data/config.json`, `test/test_page.js`, `README.md`, `docs/CONTEXT.md` | tool phases, remark box, 3 new page tests, 2 tests moved from a T1 to a T3 task |
| `67c65f8` | `docs/PLAN_DRAWING.md`, `docs/CONTEXT.md`, `README.md` | plan, items 1–5 |
| `3327e01` | same | item 6, overlapping bonds |
| `6b6e4f0`, `6585a8a` | same | item 7, H next to a heteroatom; carbon excluded |
| `5c9d6e8` | same | item 8, subscripts |
| `b8eebbd` | same | item 9, arrows stylized after snapping |
| `73c8432` | same | item 10, fishhook arrows |
| `1d4c45f` | same | item 11, wedge and hash bonds |

## 6. Interfaces other sessions must check

- Entry kind `remark`: `{ kind, tester, level, step, text }`. `tools/replay.js` counts it as "other". Free text:
  never copied into a repository.
- `data/config.json`: new key `remarks` (list of tester labels). Any session that rewrites the config must keep it.
- Tool phases: in T1 and the arrow phase of T3, draw mode cannot be entered (`setMode` ignores modes outside the
  phase); in T2, a confirmed drawing clears the frame and stays in draw mode. Scripts or agent testers that click
  `#m-draw` in an arrow task, or expect arrow mode after a T2 confirmation, will fail.
- Page tests: the merge and clean-layout tests now use task index 11 (T3); task indices are fixed in
  `test/test_page.js`, so a change of the task list or of the daily set (commit `a10ae77`, other session) must keep
  them consistent.
- Planned format changes (items 10, 11): atom fields `rad`, `cfg`, bond fields `stereo`, `ez`, arrow field `e`;
  replay, Worker payload and `docs/SCENE.md` change together.
- Planned versions: items that change the page add `versions.page` to entries; figures are compared within one page
  version.

## 7. Next steps (priority order)

1. Add `remark` to `MECH_KINDS` on the Worker branch before sending is switched on.
2. Collect first-run evidence into the evidence log of `docs/PLAN_DRAWING.md` (counts only).
3. After the run: item 3, then 6, 7, 8, 9, 1, 2, 4, 5; items 10 and 11 with new tasks and a second run.
4. Reference `docs/PLAN_DRAWING.md` from `ML_PLAN.md` when the global plan is merged.
