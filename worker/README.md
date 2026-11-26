# Worker of the entries of the test run (`curly-entries`)

Cloudflare Worker with its own D1 database, separate from the Worker of the two puzzle sites (decision 64).
It receives the entries the page sends (`POST /mech_entries`) and gives them back only with a key
(`/rpc/mech_export`, header `X-Export-Key` = Worker secret `MECH_EXPORT_KEY`). Routes: `src/index.js`.

State on 2026-11-26: the D1 database `curly-entries` exists with the table `mech_entries` (empty). The Worker is
deployed (2026-11-26 15:40 UTC, through the Cloudflare API connector; deployed `index.js` and `rows.js` identical to
`main` at 8b475d5 by SHA-256), at https://curly-entries.dailyorgchem.workers.dev, with the bindings of
`wrangler.toml`. Same day: the user set the secret `MECH_EXPORT_KEY` (the export with the key of the cloud environment
answers 200) and allowed the host; the checks of step 3 passed (`GET /` 200, unknown label 400, export without or
with a wrong key 403, origin other than `ALLOWED_ORIGINS` 403); step 4 done: `worker` set in `data/config.json`
(decision 67). Step 5: from the page under its origin, an entry with the session label was refused (400 "unknown
visitor") and the page saved the file; a row of an accepted label stored and read back is pending (the user sends
one from the live page).

Tests: `cd worker && npm ci && npm test` (local database, 8 tests; also run by `.github/workflows/worker.yml`).

## To switch sending on (next session, with a Cloudflare connector that can deploy Workers)

Before (user, decision 66): the Cloudflare API connector granted Workers Scripts Write and D1 Write (on 2026-11-26
it had neither: HTTP 401/403 on `workers/scripts`, `workers/subdomain` and `d1/database`); the host
`curly-entries.dailyorgchem.workers.dev` in the allowed domains of the cloud environment (refused by the proxy on
2026-11-26; `puzzle-feedback.dailyorgchem.workers.dev` is allowed). The testers agreed to be recorded (decision 66).

1. Deploy `worker/src/index.js` and `rows.js` as the Worker `curly-entries` with the settings of `wrangler.toml`
   (binding `DB` to the database, vars `ALLOWED_ORIGINS` and `MECH_TESTERS`), `workers_dev` on. Through the API:
   `PUT /accounts/{account}/workers/scripts/curly-entries` (multipart: part `metadata`, and the two files as
   `index.js` and `rows.js` with type `application/javascript+module`), metadata
   `{"main_module": "index.js", "compatibility_date": "2026-10-23", "bindings": [{"type": "d1", "name": "DB", "id": "<database_id>"}, {"type": "plain_text", "name": "ALLOWED_ORIGINS", "text": "..."}, {"type": "plain_text", "name": "MECH_TESTERS", "text": "..."}], "keep_bindings": ["secret_text"]}`
   with the values of `wrangler.toml` (`keep_bindings` keeps `MECH_EXPORT_KEY` on later deploys); then
   `POST /accounts/{account}/workers/scripts/curly-entries/subdomain` with `{"enabled": true}`. The URL is
   `https://curly-entries.<account subdomain>.workers.dev` (`GET /accounts/{account}/workers/subdomain`;
   `dailyorgchem` for the Worker `puzzle-feedback`).
2. Set the Worker secret `MECH_EXPORT_KEY` (chosen by the user, in the Cloudflare dashboard: Workers & Pages →
   `curly-entries` → Settings → Variables and Secrets; the same value as environment variable `MECH_EXPORT_KEY` of
   the cloud environment of the sessions; never in a repository or in a chat).
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
