-- Entries of the test-run page (docs/INTERFACES.md I2), one row per entry of a page session: arrows drawn and the
-- readings shown, a hand-drawn structure and its reading, votes, the final questions, a remark.
-- visitor: tester label (first 8 hex digits of the SHA-256 of the tester code); session: one page load; seq: number
-- of the entry in the session. A row sent again with the same (site, visitor, session, seq) replaces the earlier
-- one (an entry is completed later, e.g. when its structure is submitted as an answer).
-- payload: the entry as JSON (scene, strokes with timing and pressure, readings, corrections, tool versions, and
-- the text of a remark). It is returned only by the keyed export (mech_export), never by mech_summary.
CREATE TABLE mech_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site        TEXT    NOT NULL CHECK (site IN ('mechpilot')),
  visitor     TEXT    NOT NULL CHECK (length(visitor) = 8),
  session     TEXT    NOT NULL CHECK (length(session) = 36),
  seq         INTEGER NOT NULL CHECK (seq BETWEEN 0 AND 9999),
  kind        TEXT    NOT NULL CHECK (kind IN ('arrows', 'drawing', 'votes', 'questionnaire', 'remark')),
  task        TEXT    CHECK (task IS NULL OR length(task) BETWEEN 1 AND 120),
  user_level  TEXT    CHECK (user_level IS NULL OR user_level IN ('undergraduate', 'graduate', 'postgraduate')),
  accepted    INTEGER CHECK (accepted IS NULL OR accepted IN (0, 1)),
  flagged     TEXT    CHECK (flagged IS NULL OR flagged IN ('wrong')),
  payload     TEXT    NOT NULL CHECK (length(payload) BETWEEN 2 AND 300000),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT,
  UNIQUE (site, visitor, session, seq)
);
CREATE INDEX mech_entries_site_task ON mech_entries (site, task, kind);
