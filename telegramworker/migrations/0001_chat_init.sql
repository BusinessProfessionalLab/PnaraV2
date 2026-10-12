-- Pnara live-chat schema (Cloudflare D1 / SQLite).
-- Applied with:  wrangler d1 execute pnara_chat --file=./migrations/0001_chat_init.sql
-- The Worker also runs CREATE TABLE IF NOT EXISTS on boot, so local dev works
-- even before this migration is applied; production must apply it explicitly.

CREATE TABLE IF NOT EXISTS visitors (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT UNIQUE NOT NULL,   -- SHA-256 hex of the opaque visitor token
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  cafe_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,          -- normalized Iranian mobile (09xxxxxxxxx)
  created_at  TEXT NOT NULL,          -- UTC ISO-8601
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id                          TEXT PRIMARY KEY,  -- 32-hex random
  short_ref                   TEXT UNIQUE NOT NULL, -- e.g. #A1B2C3 (human ref)
  visitor_id                  TEXT NOT NULL REFERENCES visitors(id),
  status                      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  telegram_anchor_chat_id     TEXT,
  telegram_anchor_message_id  INTEGER,
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL,
  last_message_at             TEXT,
  closed_at                   TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT, -- polling cursor
  conversation_id     TEXT NOT NULL REFERENCES conversations(id),
  sender              TEXT NOT NULL CHECK (sender IN ('visitor', 'support', 'system')),
  sender_name         TEXT,          -- Telegram display name for support replies
  text                TEXT NOT NULL, -- max 2000 chars (enforced in Worker)
  client_msg_id       TEXT UNIQUE,   -- visitor idempotency key (nullable)
  telegram_message_id INTEGER,
  delivery_status     TEXT NOT NULL DEFAULT 'sent',
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_message_map (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id      TEXT NOT NULL REFERENCES conversations(id),
  telegram_chat_id     TEXT NOT NULL,
  telegram_message_id  INTEGER NOT NULL,
  direction            TEXT NOT NULL, -- system_to_support | visitor_to_support | support_to_visitor
  internal_message_id  INTEGER,
  created_at           TEXT NOT NULL,
  UNIQUE (telegram_chat_id, telegram_message_id)
);

CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id     INTEGER PRIMARY KEY, -- Telegram update_id, dedupes redeliveries
  status        TEXT NOT NULL,
  processed_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_conv_visitor ON conversations (visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_token ON visitors (token_hash);
