# 2026-11-15/16 — OneSignal key rotation, Supabase new API keys and JWT signing keys

Session notes. Versions V 1.025 – V 1.027.

No secret values appear here. Keys live only in the git-ignored files
`.onesignal` and `supabase/connection.md` (renamed from `connection.sql`),
in Vercel env and in Supabase secrets / Vault.

## 1. OneSignal REST API key rotation (2026-11-15)

New key written to `.onesignal` (`ONESIGNAL_APIKEY=…`, git-ignored).

- Verified against the PowerCowo OneSignal app (`tuttoapposto`,
  `5efd40c4-…-446657581421`): HTTP 200 with both `Key` (api.onesignal.com)
  and `Basic` (onesignal.com/api/v1, the style the edge functions use).
- Where the key is read:
  - **Supabase edge function secret `ONESIGNAL_API_KEY`** — the one that
    matters: `onesignal-send`, `send-email`, `vpn-lifecycle`,
    `_shared/contractEmails.ts`. Set by the user in the dashboard (the access
    token lacks `edge_functions_secrets_write`). Verified by comparing the
    SHA-256 digest from `supabase secrets list` with the new key.
  - Vercel `ONESIGNAL_API_KEY` (prod/preview/dev) — only used by
    `api/onesignal-proxy.js`, which nothing calls any more.
  - `.env.local` `VITE_ONESIGNAL_API_KEY` — not read by any code.
- Edge functions pick up new secrets without redeploy.
- Afterwards the old key can be revoked in OneSignal.

## 2. Supabase: legacy anon / service_role → publishable / secret keys

New keys in `supabase/connection.md`: `SUPABASE_PUBLISHABLE_KEY`
(`sb_publishable_…`) and `SUPABASE_SECRET_KEY` (`sb_secret_…`).

`.gitignore` only covered `supabase/connection.sql`; fixed to
`supabase/connection.md` (never committed).

### Key facts that drove the design

- Edge runtime injects `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS`
  as JSON maps keyed by name (`default`).
- The new keys are **not JWTs**. The gateway's `verify_jwt` only understands
  legacy JWTs, so functions called with the secret key, or before login,
  need `verify_jwt = false` and their own auth check. Send the new keys on
  the `apikey` header only (as `Authorization: Bearer` they fail with
  "Invalid JWT").

### Code changes (V 1.025)

- `supabase/functions/_shared/supabaseKeys.ts` — exports
  `SUPABASE_SECRET_KEY` / `SUPABASE_PUBLISHABLE_KEY` from the injected maps.
- `supabase/functions/_shared/secretKeyOnly.ts` replaces `serviceRoleOnly.ts`:
  cron/trigger-only functions require the secret key on `apikey`
  (constant-time compare).
- All edge functions switched (`contract-expiry-reminders`,
  `contract-expired-notifications`, `contract-renewal-confirmation`,
  `vpn-lifecycle` (also supabase-js 2.39.0 → @2), `onesignal-send`,
  `delete-user`, `register-invited-user`, `send-email`, `fattureincloud`,
  `generate-ics` — the last one is not deployed).
- `supabase/config.toml` (new) — `verify_jwt = false` for the 4 cron/trigger
  functions and `register-invited-user` (called before login, validates the
  invitation token itself).
- Frontend `src/services/supabase.js` → `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `src/services/fattureInCloudService.js` — invoice creation sent the anon key
  as Bearer (so `getUser()` in the function could not succeed); now sends the
  user session token, masked in the debug log.
- `api/calendar-feed.js` → `SUPABASE_SECRET_KEY`;
  `api/mikrotik/[...path].js` → publishable key.
- `scripts/cleanup-partner.js`, `test_supabase.js`, READMEs → new names.
- Migration `supabase/migrations/20261116_cron_and_triggers_use_secret_key.sql`:
  the 5 pg_cron jobs and `trigger_vpn_lifecycle()` send
  `apikey: <vault secret_key>` instead of
  `Authorization: Bearer <vault service_role_key>`.
  `supabase/sql_powercowo/cron_jobs.sql` updated the same way.

### Rollout (2026-11-16)

1. Access token in `connection.md` had become invalid; user regenerated it.
2. Deployed 9 functions (`--use-api`, `--workdir` repo root); verify_jwt
   confirmed via Management API.
3. Created Vault secret `secret_key`, applied the migration in one
   transaction: 5/5 cron jobs and the trigger use it, 0 reference
   `service_role_key`.
4. Vercel: `VITE_SUPABASE_PUBLISHABLE_KEY` (production) and
   `SUPABASE_SECRET_KEY` (all envs); local `.env.local` / `.env` updated.
5. Commit `6d40283` pushed → production deploy Ready on my.powercowo.com.

Checks: publishable key reads via RLS and is refused on auth admin (401);
secret key has admin access; cron functions 403 without key or with the
publishable key, pass with the secret key; a `pg_net` call built like the
cron jobs reaches `vpn-lifecycle` (400 "Missing required fields" = past the
guard); `register-invited-user` rejects a fake invitation; live bundle
contains the publishable key, no legacy anon JWT, no secret key;
`/api/calendar-feed` and `/api/mikrotik` return normal 401s.

Staging (Vercel "Preview (staging)", Supabase project `xymlnkrcwvqantnuyddb`)
is deleted and no longer used — its Vercel vars are to be removed.

## 3. JWT signing keys: HS256 legacy secret → ES256

Disabling the legacy API keys alone does not retire the legacy JWT secret:
anyone with it can still forge user tokens. Before rotating, the project had
no signing keys (`keys: []`).

### Preparation (V 1.026)

`verify_jwt` fails with asymmetric tokens, so it was turned off for the
functions logged-in users call — `fattureincloud`, `delete-user`,
`onesignal-send` — which already validate via `auth.getUser()`. Verified
they reject missing / fake tokens. `send-email` keeps `verify_jwt = true`:
nothing calls it (replaced by `onesignal-send`), so after rotation it simply
rejects everything. Commit `f6a398d`.

### Rotation

- User created the ES256 (P-256) standby key, published in JWKS.
- Rotation via API failed (token lacks `auth_signing_keys_write`); user
  clicked **Rotate keys** in the dashboard, ticking the three confirmations
  (standby key picked up; revoke needed to invalidate old tokens;
  `send-email` may stop working — expected).
- 2026-11-16 11:05:58 UTC: ES256 `in_use`, HS256 `previously_used`.
  Cron path re-tested OK.

## Completion (2026-11-16, evening)

Version V 1.028.

- Legacy JWT-based API keys (anon, service_role) disabled in the dashboard
  first; Supabase refuses to revoke the JWT secret otherwise (revoking it
  invalidates those keys).
- HS256 key revoked: signing keys now `HS256 revoked`, `ES256 in_use`; JWKS
  serves only the ES256 key.
- Verification after revoke: old anon / service_role keys → 401; publishable
  key reads via RLS (200) and is refused on auth admin (401); secret key has
  admin access; the 4 cron/trigger functions return 403 without a key or with
  the publishable key and pass with the secret key; `fattureincloud`,
  `onesignal-send`, `delete-user` reject fake tokens; `register-invited-user`
  rejects a fake invitation; all 7 pg_cron jobs active, no failing cron HTTP
  responses; my.powercowo.com 200.
  Note: `delete-user` validates the body before the token (400 on empty body),
  but the `getUser()` check still gates every action (401 with a fake token).
- Cleanup done: Vault `service_role_key` deleted (only `secret_key` left);
  legacy keys removed from `supabase/connection.md`, `.env`
  (`SUPABASE_SERVICE_ROLE_KEY`) and `.env.local` (`VITE_SUPABASE_ANON_KEY`).
  No code reads them.

## Still to do by hand

1. Vercel (CLI not linked here): delete `VITE_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY`, and the staging `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY`.
2. Log in again on my.powercowo.com and test data load, an email and a
   FattureInCloud invoice (ES256 session end to end).
3. Optional: delete the unused `send-email` function (it rejects everything
   now) and `api/onesignal-proxy.js`; revoke the old OneSignal key.

## Access token permissions (for next time)

The Supabase personal access token in `connection.md` can deploy functions
and read secrets, but lacks `edge_functions_secrets_write` and
`auth_signing_keys_write` — those changes go through the dashboard.
