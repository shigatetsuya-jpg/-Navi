-- Existing accounts must confirm ownership before receiving application emails.
BEGIN IMMEDIATE;
ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1));
CREATE TABLE email_verifications(
 account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE email_outbox RENAME TO email_outbox_v3;
DROP INDEX idx_email_outbox_ready;
CREATE TABLE email_outbox(
 id INTEGER PRIMARY KEY,
 recipient TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('application-received','organization-new-application','application-status','email-verification')),
 payload_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
 locked_at TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 sent_at TEXT
);
INSERT INTO email_outbox SELECT * FROM email_outbox_v3;
DROP TABLE email_outbox_v3;
CREATE INDEX idx_email_outbox_ready ON email_outbox(status,next_attempt_at,id);
COMMIT;
