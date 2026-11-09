# 2026-11-09 — UI improvements and security hardening

Summary of a Claude Code session on PowerCowo (V 1.005 → V 1.019), kept for future reference.
No secrets are included here: keys and passwords live in Supabase secrets, Vercel env and `partner_secrets`.

## 1. UI / feature work

| Version | Change |
|---|---|
| 1.005 | Auto-renew switch on the contract form |
| 1.006 | Compact contracts list (client + contract code + small status chip in one column) with a hover panel showing all contract details |
| 1.007 | Filter chips in a row above the contracts table |
| 1.008 | Booking calendar hover card (`src/components/bookings/BookingHoverCard.jsx`) |
| 1.009 | Payment status in the booking hover card |
| 1.010 | Fixed "Maximum update depth" (SearchableSelect auto-select on empty value) |
| 1.011 | Fixed profile query timeout (`AuthContext`: shared fetch promise, deferred load after auth events) |
| 1.012–1.013 | Capitalized month, week and day headings in the booking calendar |
| 1.014 | Hover card in the Gantt view (`/bookings-new`) |
| 1.015 | When the last contract of a customer ends: door code cleared, WiFi user removed from the router (with retry + partner email after 3 failures) |
| 1.016 | Door position also reset when the last contract ends |
| 1.017 | Customer details hover card in the customers list (`src/components/customers/CustomerHoverCard.jsx`) |

Shared positioning helper: `src/utils/hoverCardPosition.js` (`HOVER_CARD_WIDTH`, `getHoverCardPosition`).
Styles: `src/styles/components/booking-hover-card.css` (hidden on touch devices).

### Access cleanup when the last contract ends (V 1.015–1.016)
- `supabase/functions/vpn-lifecycle` — `deprovision` checks for other active contracts, then clears `door_code`/`door_position` and revokes the WiFi user.
- Router failures set `revoke_requested_at` / `revoke_attempts` / `revoke_last_error` on `customer_vpn_credentials`; cron job `vpn-revoke-retry` (03:00 Zurich) retries; after 3 attempts the partner gets the `wifi_revoke_failed_partner` email once.
- Partner email `door_code_cleared_partner` (includes the door position).
- Supports `{"dry_run": true}` for safe testing.

## 2. Security audit (findings)

All verified with a real customer account inside rolled-back transactions, dry-run calls or read-only requests.

| # | Severity | Finding |
|---|---|---|
| 1 | Critical | `/api/mikrotik` (Vercel proxy) forwarded anything to the router without any login |
| 2 | Critical | Any user could set their own `profiles.role` to `superadmin` |
| 3 | High | `vpn-lifecycle` and `contract-*` edge functions accepted the public anon key (door codes readable, WiFi/door codes wipeable) |
| 4 | High | Customers could read/update all customers of their partner (door codes, PII) |
| 5 | High | Customers could read partner secrets (`mikrotik_agent_secret`, `fattureincloud_api_token`) |
| 6 | High | Customers could rewrite their own contracts (price, end date, payment flag) |
| 7 | High | OneSignal REST API key shipped in the frontend bundle |
| 8 | High | `invitations` listable by anyone; registration didn't check the invited email |
| 9 | High | Any logged-in user could write/delete any file in the `partners` storage bucket |
| 10 | Medium | Customers saw all payments of their partner |
| — | Low | Batch job functions callable through `/rpc`; no security headers; notification HTML unsanitized |

## 3. Fixes (V 1.018 – 1.019)

### Database
- `supabase/migrations/20261109_security_hardening.sql` (part 1, non-breaking):
  - `guard_profile_privileged_columns` trigger: role/partner changes only by superadmin.
  - customers: admins see their partner, customers only `user_id = auth.uid()`; `guard_customer_self_edit` blocks door code/position, status, ownership changes by customers.
  - `partner_secrets` table (admin/superadmin only) + `sync_partner_secrets` trigger on `partners`.
  - `guard_customer_contract_write`: customer-created contracts get price/dates/snapshot from the service, discount re-validated server-side, free trial once; customers may only toggle `auto_renew` and give back entries of cancelled package reservations.
  - `get_pending_invitation(uuid)` RPC.
  - Storage `partners` bucket: `can_write_partner_object()` — partner admins on their folder, customers only `<partner>/calendars/` and `<partner>/<customer_uuid>/`.
  - payments: customers only for their own contracts.
  - EXECUTE revoked on `auto_renew_contracts`, `handle_contract_expiry`, `handle_invitation_expiry`, `update_expired_contracts`, `get_tables_list`.
- `supabase/migrations/20261109_security_hardening_cleanup.sql` (part 2, after frontend deploy): drops the anon invitations policy; blanks the secret columns in `partners` (writes there are moved to `partner_secrets`; empty values never wipe a stored secret).

### Edge functions
- `_shared/serviceRoleOnly.ts`: `vpn-lifecycle`, `contract-expired-notifications`, `contract-expiry-reminders`, `contract-renewal-confirmation` accept only the service role (DB triggers and pg_cron already send it).
- `vpn-lifecycle`: no door code in responses; agent secret read from `partner_secrets`.
- `register-invited-user`: email must match `invited_email`.
- New `onesignal-send`: sends emails with the server-side key; requires login; customers may only email themselves, their partner and its admins; payload fields allowlisted.

### Frontend / hosting
- `api/mikrotik/[...path].js`: requires a Supabase login of a superadmin or an admin of a MikroTik-enabled partner; only GET plus writes under `/user-manager/`; path traversal rejected. V 1.019 fixed the path parsing (Vercel passes the catch-all as one string).
- `src/services/mikrotikApi.js` (`mikrotikFetch` sends the session token), `src/services/partnerSecrets.js`.
- `src/utils/logger.js`: reads env keys statically — the dynamic `import.meta.env[key]` was inlining every `VITE_*` variable (OneSignal key, SMTP user) into the bundle.
- `VITE_ONESIGNAL_API_KEY` removed from code and from Vercel env.
- Notification HTML sanitized with DOMPurify.
- `vercel.json`: `X-Frame-Options`, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

### Lessons learned
- After a deploy, open tabs keep the old JS: a 401 from the MikroTik page was just an old tab — fix with a hard reload (Cmd+Shift+R). Possible improvement: auto-reload when `version.json` changes.
- Never read `import.meta.env` dynamically.
- Apply DB changes in two steps (additive first, removals after the frontend is live) to avoid downtime.

## 4. Router state (read-only check)
- hAP ax³, RouterOS 7.23.1, ~520 MB free.
- MikroTik sits behind the ISP modem (LAN 192.168.1.3); the modem forwards only port 3000 to the agent container (172.18.0.2). Management ports are not reachable from the internet.
- Agent ↔ RouterOS REST runs over HTTP port 80 inside the container bridge. Router user `powercowo-api` has `group=full` (should be restricted).
- Router setup files: `router/powercowo_router/` (`index.js`, `Dockerfile`, `01_routeros_setup.rsc`).

## 5. MikroTik over HTTPS — decision in progress

| | Cloudflare Tunnel + Access service token | Caddy + Let's Encrypt |
|---|---|---|
| Open ports | none (outbound tunnel) | 80/443 on modem and router |
| Who can reach the agent | only callers with the Access token, then the agent secret | anyone on the internet, then the agent secret |
| TLS | ends at Cloudflare | end to end |
| Requirement | domain DNS on Cloudflare | DNS record (CNAME to the router's IP Cloud name) |

**Recommendation: Cloudflare Tunnel + Access service token** (most secure).
- A subdomain of `powercowo.com` works only if the whole domain's DNS moves to Cloudflare (partial setup needs the Business plan, subdomain delegation needs Enterprise). Current DNS: `ns1/ns2.andreapacini.com`, registrar Tucows; records to copy include website A, `www`, `mail` + MX, SPF, DMARC, `my` → Vercel, plus any DKIM/verification records from the DNS panel (set all to "DNS only").
- Alternative: a small separate domain on Cloudflare only for the agent.
- The agent container does **not** need a rebuild for HTTPS: a `cloudflared` (or Caddy) container is added next to it; port 3000 forwards are removed at the end. Code change: Access token headers in `api/mikrotik` and `vpn-lifecycle`; new URL in Vercel `MIKROTIK_AGENT_URL` and Settings → MikroTik.
- Optional later: rebuild the agent for HTTPS to RouterOS, path allowlist, constant-time secret compare.

## 6. Pending
1. Colleague decision: move `powercowo.com` DNS to Cloudflare or use a separate domain → then set up the tunnel.
2. Rotate keys (treat as leaked): OneSignal REST API key (`supabase secrets set ONESIGNAL_API_KEY=…`), FattureInCloud token, MikroTik agent secret (during the HTTPS switch: router env + Vercel + Settings).
3. Restrict the router user `powercowo-api` to User Manager and read rights.
4. Optional: full Content-Security-Policy (needs its own test pass); auto-reload on new version.
