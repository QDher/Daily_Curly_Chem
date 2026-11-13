# Daily Curly Chem: notes for Claude Code sessions

- Purpose: test-run page and single source of the shared curly-arrow modules for the two puzzle sites. The plan is
  `ML_PLAN.md` in QDher/Daily-organic-chemistry-puzzles (section "Future development: curly-arrow mechanisms"); update
  it there when a decision changes, and the status table in `README.md` here.
- The two site repositories are not changed from here before the test run is evaluated. Deployment is a versioned
  copy of the modules into their `src/`, by pull request.
- `src/arrows.js` (component C1): no dependency, runs in Node and in the page. Every rule is described in
  `docs/SCENE.md` and covered in `test/test_arrows.js`; `node test/test_arrows.js` must end with N/N passed. A change
  of the rules or of the scene format increases `VERSION`.
- The interpreter is deterministic and never guesses: an arrow with more than one reading is an error (`ambiguous`)
  that lists the options; choosing between readings belongs to the ranking component (C3).
- Text shown to testers before they answer follows the content rules of the site repositories (no reaction names,
  no mechanism words).
- Remarks of testers stay in D1; never copy them into the repository.
- Reporting: brief, neutral and objective; state what was verified and what was not.
