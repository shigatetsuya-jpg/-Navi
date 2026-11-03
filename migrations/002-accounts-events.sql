CREATE TABLE accounts(
 id INTEGER PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL,
 account_type TEXT NOT NULL CHECK(account_type IN ('member','organization')),
 university TEXT,
 school_year TEXT,
 salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE account_sessions(
 token_hash TEXT PRIMARY KEY,
 account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX idx_account_sessions_expiry ON account_sessions(expires_at);

CREATE TABLE circle_managers(
 circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
 account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 manager_role TEXT NOT NULL DEFAULT 'owner' CHECK(manager_role IN ('owner','manager')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(circle_id,account_id)
);
CREATE INDEX idx_circle_managers_account ON circle_managers(account_id,circle_id);

CREATE TABLE organization_requests(
 circle_id INTEGER PRIMARY KEY REFERENCES circles(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 reviewed_at TEXT,
 reviewed_by INTEGER REFERENCES admins(id) ON DELETE SET NULL
);
CREATE INDEX idx_organization_requests_status ON organization_requests(status,created_at);

CREATE TABLE events(
 id INTEGER PRIMARY KEY,
 circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 description TEXT,
 starts_at TEXT,
 location TEXT,
 capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 5000),
 application_deadline TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_public ON events(status,circle_id,starts_at);

CREATE TABLE applications(
 id INTEGER PRIMARY KEY,
 event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 member_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 message TEXT,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','waitlisted','cancelled')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(event_id,member_id)
);
CREATE INDEX idx_applications_event_status ON applications(event_id,status,created_at);
CREATE INDEX idx_applications_member ON applications(member_id,created_at);
