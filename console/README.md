# Claude Console: daily agent tester

Managed Agents resources for the daily agent tester (plan: `docs/AGENT_TESTER.md`). One run per day; the tester
of the day (john0002, john0003, john0004, john0005 in turn, `tools/agent_testers.json`) is chosen by the script.

| File | Resource |
|---|---|
| `curly-agent-tester/agent.md` | agent: model, tools (web tools off), instructions |
| `curly-agent-tester/environment.yaml` | cloud container, limited networking (package registries and code hosts only) |
| `curly-agent-tester/deployment-daily.yaml` | schedule 06:17 America/New_York, budget 5 USD per run, task and starter rubric |

No credential is needed: the repository is public and the page is served inside the container.

## Apply (once, from a terminal with the `ant` CLI 1.30.0 or later, signed in with `ant auth login`)

Run from this folder, so that `claude-lock.json` (the IDs of the resources) is written here. Commit it afterwards;
without it the next `ant apply` creates duplicates.

```bash
cd console
```

```bash
ant apply --dry-run -v curly-agent-tester/agent.md curly-agent-tester/environment.yaml curly-agent-tester/deployment-daily.yaml
```

```bash
ant apply curly-agent-tester/agent.md curly-agent-tester/environment.yaml curly-agent-tester/deployment-daily.yaml
```

The dry run prints the plan and changes nothing; check the organization and workspace in its header. The second
command asks before creating. The deployment starts firing at the next 06:17 New York time.

## Test now, without waiting for the schedule

A manual run of the deployment starts a session at once (it also works while the deployment is paused):
`POST /v1/deployments/{id}/run`, with the deployment ID from `claude-lock.json`. The CLI command for it is listed by
`ant beta:deployments --help`. The session can be watched in the Console (Managed Agents, Sessions).

## Results of a run

Each session writes to its outputs: `report.md`, the entries file `curly-entries-<label>-<device>.json`, the run
record `run-<date>-<tester>.json` and `shots/`. They are listed and downloaded in the Console session view, or with
`ant beta:files list --scope-id <session id> --beta managed-agents-2026-04-01`. These files are synthetic data:
they are not committed to this repository and never counted with the entries of people.

## Change, pause, stop

- Instructions, model or tools: edit `agent.md` and run `ant apply` again (a new agent version; later runs use it).
- Testers or rotation: `tools/agent_testers.json` in the repository (each run clones `main`).
- Pause: pause the deployment in the Console or with the API (`POST /v1/deployments/{id}/pause`); unpause resumes
  at the next scheduled time, missed days are not run.
- Budget: `budget` in `deployment-daily.yaml`, then `ant apply`; it applies from the next run.
