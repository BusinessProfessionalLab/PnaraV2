# Live Chat — architecture, setup, deployment

Persian RTL live-chat widget (Astro) → Cloudflare Worker API → D1 storage →
Telegram support group. The visitor chats on the website; support staff reply
from Telegram with the native **Reply** feature. No admin panel (v1).

## Architecture

```text
Visitor (Astro widget, RTL Persian)
   │  fetch + credentials:include, X-Visitor-Token fallback
   ▼
Cloudflare Worker (CloudflareWorker.js)
   │  /api/chat/* ......... visitor API (CORS, cookie + header auth)
   │  /api/telegram/webhook  Telegram updates (secret-token verified)
   ├─ D1 (binding DB) ...... visitors, conversations, messages,
   │                          telegram_message_map, telegram_updates
   └─ Telegram Bot API ..... support-group notifications + reply intake
                             (single bot, single webhook — shared with the
                             legacy demo form, which is unchanged: POST /)
```

- **Storage:** D1 only. KV/Durable Objects are intentionally *not* used:
  polling (4 s, cursor-based) is enough for a small support chat, and rate
  limiting is a best-effort in-memory window per isolate.
- **Realtime:** periodic polling with `?after=<lastId>` (incremental, no
  full-history refetch). Documented as polling, not instant delivery.
- **Closed conversations:** a visitor message to a closed conversation
  **reopens** it automatically (system message records the event). Support
  closes with `/close` and reopens with `/open` as a **reply** to any mapped
  Telegram message of that conversation.

## Files

| Path | Purpose |
| --- | --- |
| `CloudflareWorker.js` | Legacy `POST /` demo form (preserved) + chat API + webhook |
| `src/components/chat/LiveChat.astro` | Widget markup + styles, mounted globally in `Layout.astro` |
| `src/components/chat/live-chat.ts` | Widget client (state, polling, safe rendering) |
| `shared/chat-shared.js` (+`.d.ts`) | Canonical validation/tokenize/merge helpers (browser + Worker mirror + tests) |
| `migrations/0001_chat_init.sql` | D1 schema |
| `wrangler.toml.example` | Bindings + vars template (copy to `wrangler.toml`, gitignored) |
| `.dev.vars.example` | Local-dev secrets template (copy to `.dev.vars`, gitignored) |
| `.env.example` | Adds `PUBLIC_CHAT_API_URL` (widget → Worker base URL) |
| `tests/chat/` | `node --test` suites, no new dependencies (`pnpm test:chat`) |

## Required Cloudflare setup

1. **D1 database**
   ```powershell
   wrangler d1 create pnara_chat
   # paste database_id into wrangler.toml, then:
   wrangler d1 execute pnara_chat --file=./migrations/0001_chat_init.sql
   wrangler d1 execute pnara_chat --file=./migrations/0001_chat_init.sql --local  # local dev
   ```
   The Worker also runs `CREATE TABLE IF NOT EXISTS` on boot, so local dev
   works before the migration; **production must apply the migration.**
2. **Secrets** (never in source; placeholders only in examples)
   ```powershell
   wrangler secret put TELEGRAM_BOT_TOKEN      # migrates the embedded legacy fallback
   wrangler secret put TELEGRAM_WEBHOOK_SECRET # random string, e.g. 32-hex
   ```
3. **Vars** (in `wrangler.toml`): `SUPPORT_GROUP_ID` (e.g. `-1001234567890`,
   required), `SUPPORT_USER_IDS` (comma list, required in production),
   `CONTACT_TELEGRAM_CHAT_IDS`, `ALLOWED_ORIGINS` (extra origins only;
   `pnara.ir` + local dev are built in).
4. **Deploy** `wrangler deploy` (single file; dashboard paste still works).

## Telegram setup

1. Create the bot via `@BotFather`, create the **support group**, add the bot
   as admin (needs send/read/reply permissions).
2. Get IDs: send a message in the group, then
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → group id (negative),
   staff user ids from `message.from.id`.
3. Set `SUPPORT_GROUP_ID`, `SUPPORT_USER_IDS`, secrets (above).
4. Register **one** webhook for the bot (shared by demo form + chat):
   ```powershell
   $body = @{ url = "https://<worker>/api/telegram/webhook"; secret_token = "<TELEGRAM_WEBHOOK_SECRET>" } | ConvertTo-Json
   Invoke-RestMethod "https://api.telegram.org/bot<TOKEN>/setWebhook" -Method Post -ContentType "application/json" -Body $body
   ```
5. Staff workflow: new conversation → anchor notice in the group →
   **Reply** to it to answer → `/close` / `/open` as a reply to manage state.
   Replies from non-allowlisted users and non-replies are ignored (logged).

## Local development

```powershell
Copy-Item .dev.vars.example .dev.vars   # fill test values
wrangler dev                             # Worker + local D1
pnpm dev                                 # Astro on :5200 (allowed origin)
pnpm test:chat                           # 50 backend/contract tests
pnpm build                               # astro check && astro build
```

## API summary

- `GET/POST /api/chat/session` — issue/restore token (`Set-Cookie`
  `pnara_visitor`, HttpOnly, 1 y; raw token also in body for the
  `localStorage` fallback + `X-Visitor-Token` header); onboarding creates the
  visitor + open conversation + Telegram anchor notice.
- `GET /api/chat/conversations/current` — visitor + conversation + last 50.
- `GET .../messages?after=&limit=` — incremental poll (max 100/page).
- `POST .../messages` `{ text, clientMsgId }` — idempotent send; reopens
  closed conversations; Telegram fan-out is best-effort (failure marks
  `delivery_status='telegram_failed'`, the send still succeeds).
- `POST /api/telegram/webhook` — secret-verified, idempotent via
  `telegram_updates(update_id)`.

Limits: bodies ≤ 32 KB, messages ≤ 2000 chars, names ≤ 80, café ≤ 120.
Rate limits per IP: session 20/min, send 15/min, poll 60/min.

## Security notes

- Visitor identity = 256-bit random token; only its SHA-256 is stored.
  Conversation ownership is validated server-side on every call; sequential
  message ids are conversation-scoped.
- Phone is normalized (Persian/Arabic digits, `+98`/`0098` prefixes) and must
  match `09xxxxxxxxx`, client + server.
- All SQL parameterized; webhook secret timing-safe compared; support
  allowlist by user id (never display name); bot token never logged/returned.
- Messages render via `textContent` + tokenized safe links (`http(s)` and
  `tel:` only); no HTML from Telegram is ever injected.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Widget shows “service unavailable” | `DB` binding missing → 503; check `wrangler.toml` |
| No Telegram notices | `SUPPORT_GROUP_ID` unset or bot not group admin; check Worker logs |
| Replies don't reach visitor | Staff didn't use Reply on a mapped message, or sender not in `SUPPORT_USER_IDS` |
| 401 loops in widget | Token cleared → onboarding reshown; check cookies/third-party blocking (header fallback covers it) |
| Duplicate Telegram sends | Update redelivery is deduped by `update_id`; visitor double-send is deduped by `clientMsgId` |

## Known limitations (honest)

- Polling (~4 s), not instant push; no typing indicators; text-only messages
  (Telegram photos/files without caption are ignored).
- Rate limiting is per-isolate memory (restarts reset windows); use KV if
  abuse becomes a problem.
- `TELEGRAM_BOT_TOKEN`/demo chat ids still have embedded legacy fallbacks
  until secrets are set and redeployed (then delete the literals).
- Manual browser verification (mobile keyboard, screen reader, RTL visuals)
  still required — see Testing Results in the task report.
