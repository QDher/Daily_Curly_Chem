# Scheduled task: daily agent tester run

Backup of the prompt of the Claude Code scheduled task "Agent tester daily run (Daily Curly Chem)", which starts a
fresh session every day at 06:17 America/New_York (decision of the user, 2026-11-16; plan in
`docs/AGENT_TESTER.md`). A change of the prompt is made in the scheduled task and here, with identical text.

Backed up on 2026-11-16.

```text
Daily agent tester run of Daily Curly Chem (scheduled task; plan: docs/AGENT_TESTER.md of QDher/Daily_Curly_Chem).

Setup. Work in a clone of QDher/Daily_Curly_Chem: use the one in the working directory if there is one, else run
`git clone https://github.com/QDher/Daily_Curly_Chem.git`. In it run `git fetch origin main && git checkout -B main
origin/main`, then `npm ci` and `npm run setup`. Do not change, commit or push any file of the repository: agent
outputs are never committed. Review page (claude.ai artifact): https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4

1. DATE = today's date in America/New_York (YYYY-MM-DD). TESTER = output of
   `node -e "console.log(require('./tools/agent_tester.js').testerFor('DATE'))"`. RUN = DATE_TESTER.
2. Read the review page's published file runs/index.json with the Artifact tool (action "read", the url above,
   path "runs/index.json") and save its content as agent-runs/DATE/index.json. If RUN is already listed in it,
   stop: there is one run per day.
3. Run `node tools/agent_tester.js --out agent-runs/DATE` (the script chooses TESTER from the date). Exit code 2:
   report the last lines of its output and stop. Exit code 0 or 1 (1 = a page error or an entry that does not
   replay): go on, and report it.
4. Run `node tools/replay.js agent-runs/DATE/curly-entries-*.json --verbose`.
5. Read the run record agent-runs/DATE/run-DATE-TESTER.json. Open the screenshots (agent-runs/DATE/shots/) of the
   attempts whose outcome is not "accepted", "confirmed" or "not-done", at most 12. Write agent-runs/DATE/report.md,
   brief and neutral, with these sections:
   - Figures: the summary of the run record and the replay line of step 4.
   - Errors: page and script errors quoted, or "none".
   - Attempts not as intended: one line each with set, task, attempt, outcome and the cause seen in the screenshot
     (recognition, snapping, convention, page, or ink of the agent), or "not looked at" beyond 12.
   - Reference steps of the daily set: you are an expert in organic reaction mechanisms; one line per arrow task of
     the daily set: sound, doubtful or wrong, and why. The references are made by a program and are not reviewed
     by a chemist; this review is advice to the owner and changes nothing.
   - Page observations: anything a tester would stumble on, with the screenshot file, or "none".
   - Not verified: what you could not check.
   Use only figures from the run record or from command outputs.
6. Run `node tools/agent_review_data.js agent-runs/DATE/run-DATE-TESTER.json --out agent-runs/DATE/site
   --index agent-runs/DATE/index.json --entries <the curly-entries file of step 3> --report agent-runs/DATE/report.md
   --source "scheduled Claude Code run"`. It prints three files to publish (published path: local file). All of
   them are produced in this session by the scripts you ran.
7. Read the review page once (Artifact tool, action "read", the url above), then publish it: Artifact tool, action
   "publish", the url above, file_path tools/agent_review_page.html, files = the three files printed in step 6, no
   capabilities field (the page keeps the ones it has). The files of earlier runs stay published. If the publish is
   refused, report why and stop.
8. Final message: tester, date, the figures, the replay line, the published version, and the main points of the
   report in at most 8 lines.

Rules. The entries are synthetic (labels of agent testers) and never tester data. Do not change the tester, the
seeds, the code or the data to get better results: the results are the data. Do not read, write or delete the
documents of the page's database (the reviewer's answers). If a step fails, report the command, its exit code and
the last lines of its output, and stop. Brief, neutral and objective tone.
```
