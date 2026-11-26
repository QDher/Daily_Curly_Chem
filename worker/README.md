# Worker of the entries of the test run (`curly-entries`)

Cloudflare Worker with its own D1 database, separate from the Worker of the two puzzle sites (decision 64).
It receives the entries the page sends (`POST /mech_entries`) and gives them back only with a key
(`/rpc/mech_export`, header `X-Export-Key` = Worker secret `MECH_EXPORT_KEY`). Routes: `src/index.js`.

State on 2026-11-26: the D1 database `curly-entries` exists with the table `mech_entries`; the Worker is **not
deployed** and the page sends nothing (`worker: null` in `data/config.json`).

Tests: `cd worker && npm ci && npm test` (local database, 8 tests; also run by `.github/workflows/worker.yml`).

## To switch sending on (next session, with a Cloudflare connector that can deploy Workers)

1. Deploy `worker/src/index.js` and `rows.js` as the Worker `curly-entries` with the settings of `wrangler.toml`
   (binding `DB` to the database, vars `ALLOWED_ORIGINS` and `MECH_TESTERS`), `workers_dev` on.
2. Set the Worker secret `MECH_EXPORT_KEY` (chosen by the user; the same value as a secret of the cloud
   environment of the sessions; never in a repository).
3. Check with curl: `GET /` gives `{"service":"curly-entries"}`; a `POST /mech_entries` with an unknown label gives
   400; `/rpc/mech_export?p_site=mechpilot` without the key gives 403.
4. Set `worker` in `data/config.json` to the Worker URL. The page then tells the tester that the entries are sent
   (text of `intro-data` in `index.html`) and still saves the file at the end.
5. Verify one entry end to end from the page, read it with the export, then delete that row.
6. Record it in `docs/DECISIONS.md` and on the board (item B20).

A new tester code: add its label to `MECH_TESTERS` in `wrangler.toml` (the test checks it against
`data/testers.json`) and deploy again. Agent testers run the page with `worker: null`, so their entries are never
sent; the label of Claude Code sessions is not accepted.

Reading the entries: `curl -H "X-Export-Key: $MECH_EXPORT_KEY" "<worker>/rpc/mech_export?p_site=mechpilot" > entries.json`,
then `node tools/replay.js entries.json` and `node tools/failures.js entries.json`. Remarks are in the payloads:
never copy them into the repository.
