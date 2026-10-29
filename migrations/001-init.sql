CREATE TABLE circles(
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 university TEXT NOT NULL,
 campus TEXT,
 category TEXT,
 description TEXT,
 days TEXT,
 periods TEXT,
 location TEXT,
 frequency TEXT,
 cost TEXT,
 members TEXT,
 beginner INTEGER,
 experienced INTEGER,
 concurrent INTEGER,
 official INTEGER,
 trial INTEGER,
 conditions TEXT,
 website TEXT,
 sns TEXT,
 trial_url TEXT,
 contact TEXT,
 verified INTEGER NOT NULL DEFAULT 0,
 published INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE admins(
 id INTEGER PRIMARY KEY CHECK(id=1),
 email TEXT UNIQUE NOT NULL,
 salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sessions(
 token_hash TEXT PRIMARY KEY,
 admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX idx_circles_public ON circles(published,updated_at);
