CREATE TABLE email_outbox(
 id INTEGER PRIMARY KEY,
 recipient TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('application-received','organization-new-application','application-status')),
 payload_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
 locked_at TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 sent_at TEXT
);
CREATE INDEX idx_email_outbox_ready ON email_outbox(status,next_attempt_at,id);

