ALTER TABLE events ADD COLUMN first_published_at TEXT;
UPDATE events SET first_published_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE status='open';
CREATE TABLE circle_notification_subscriptions(
 account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
 new_events INTEGER NOT NULL DEFAULT 0 CHECK(new_events IN (0,1)),
 followed_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 consent_version TEXT NOT NULL,
 PRIMARY KEY(account_id,circle_id)
);
CREATE TABLE event_reminders(
 account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 deadline_reminders INTEGER NOT NULL DEFAULT 0 CHECK(deadline_reminders IN (0,1)),
 start_reminders INTEGER NOT NULL DEFAULT 0 CHECK(start_reminders IN (0,1)),
 followed_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 consent_version TEXT NOT NULL,
 PRIMARY KEY(account_id,event_id)
);
ALTER TABLE email_outbox RENAME TO email_outbox_v5;
DROP INDEX idx_email_outbox_ready;
CREATE TABLE email_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,recipient TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('application-received','organization-new-application','application-status','email-verification','password-reset','new-event','deadline-reminder','start-reminder')),payload_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),locked_at TEXT,last_error TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),sent_at TEXT);
INSERT INTO email_outbox SELECT * FROM email_outbox_v5;
DROP TABLE email_outbox_v5;
CREATE INDEX idx_email_outbox_ready ON email_outbox(status,next_attempt_at,id);
CREATE TABLE event_notification_deliveries(
 account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('new-event','deadline-reminder','start-reminder')),
 outbox_id INTEGER NOT NULL UNIQUE REFERENCES email_outbox(id) ON DELETE CASCADE,
 PRIMARY KEY(account_id,event_id,kind)
);
