# Scheduled task: daily agent tester run

Backup of the prompt of the Claude Code scheduled task "Agent tester daily run (Daily Curly Chem)"
(`trig_011K8tD5cD824NjmCTRhhYFb`), which starts a fresh session every day at 06:17 America/New_York and runs every
agent tester of the rotation (decisions of the user, 2026-11-16; plan in `docs/AGENT_TESTER.md`). A change of the prompt is made in the scheduled task and here, with identical text.

Backed up on 2026-11-16 (all testers every day, user request of 2026-11-16).

```text
Daily agent tester runs of Daily Curly Chem (scheduled task; plan: docs/AGENT_TESTER.md of QDher/Daily_Curly_Chem).

Setup. Work in a clone of QDher/Daily_Curly_Chem: use the one in the working directory if there is one, else run
`git clone https://github.com/QDher/Daily_Curly_Chem.git`. In it run `git fetch origin main && git checkout -B main
origin/main`, then `npm ci` and `npm run setup`. Do not change, commit or push any file of the repository: agent
outputs are never committed. Review page (claude.ai artifact): https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4

1. DATE = today's date in America/New_York (YYYY-MM-DD). TESTERS = output of
   `node -e "console.log(require('./tools/agent_testers.json').rotation.join(' '))"`: every agent tester runs every day.
2. Read the review page's published file runs/index.json with the Artifact tool (action "read", the url above,
   path "runs/index.json") and save its content as agent-runs/DATE/site/runs/index.json. A tester whose run
   DATE_TESTER is already listed there is skipped. If no tester is left, stop.
3. For each remaining TESTER, in the order of TESTERS:
   a. Run `node tools/agent_tester.js --agent TESTER --date DATE --out agent-runs/DATE/TESTER`. Exit code 2: report the
      last lines of its output and go to the next tester. Exit code 0 or 1 (1 = a page error or an entry that does
      not replay): go on, and report it.
   b. Run `node tools/replay.js agent-runs/DATE/TESTER/curly-entries-*.json --verbose`.
   c. Read the run record agent-runs/DATE/TESTER/run-DATE-TESTER.json. Open the screenshots (agent-runs/DATE/TESTER/shots/)
      of the attempts whose outcome is not "accepted", "confirmed" or "not-done", at most 6 per tester. Write
      agent-runs/DATE/TESTER/report.md, brief and neutral, with these sections:
      - Figures: the summary of the run record and the replay line of step b.
      - Errors: page and script errors quoted, or "none".
      - Attempts not as intended: one line each with set, task, attempt, outcome and the cause seen in the screenshot
        (recognition, snapping, convention, page, or ink of the agent), or "not looked at" beyond 6.
      - Reference steps of the daily set: only in the report of the first tester run today (the other reports say
        "see the report of" that tester). You are an expert in organic reaction mechanisms; one line per arrow task of
        the daily set: sound, doubtful or wrong, and why. The references are made by a program and are not reviewed
        by a chemist; this review is advice to the owner and changes nothing.
      - Page observations: anything a tester would stumble on, with the screenshot file, or "none".
      - Not verified: what you could not check.
      Use only figures from the run record or from command outputs.
   d. Run `node tools/agent_review_data.js agent-runs/DATE/TESTER/run-DATE-TESTER.json --out agent-runs/DATE/site
      --index agent-runs/DATE/site/runs/index.json --entries <the curly-entries file of step a>
      --report agent-runs/DATE/TESTER/report.md --source "scheduled Claude Code run"`. It adds the run to
      agent-runs/DATE/site/runs/index.json and prints the files to publish (published path: local file).
4. Read the review page once (Artifact tool, action "read", the url above), then publish it once: Artifact tool, action
   "publish", the url above, file_path tools/agent_review_page.html, files = runs/index.json and, for every run of
   step 3, its runs/<runId>.json and entries/<file> (all under agent-runs/DATE/site, as printed in step d), no
   capabilities field (the page keeps the ones it has). All these files are produced in this session by the scripts
   you ran. The files of earlier runs stay published. If the publish is refused, report why and stop.
5. Final message: per tester the figures and the replay line, the published version, and the main points of the
   reports in at most 8 lines.

Rules. The entries are synthetic (labels of agent testers) and never tester data. Do not change the testers, the
seeds, the code or the data to get better results: the results are the data. Do not read, write or delete the
documents of the page's database (the reviewer's answers). If a step fails, report the command, its exit code and
the last lines of its output; stop, except where step 3a says to go on. Brief, neutral and objective tone.
```
