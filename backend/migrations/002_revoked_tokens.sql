-- Persistent JWT revocation list for server-side logout.
-- Survives process restarts (in-memory dict did not).
-- A row exists from logout until the original token's exp passes;
-- _decode_jwt purges expired rows opportunistically.
CREATE TABLE IF NOT EXISTS revoked_tokens (
    signature TEXT PRIMARY KEY,
    exp INTEGER NOT NULL,
    revoked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(exp);
