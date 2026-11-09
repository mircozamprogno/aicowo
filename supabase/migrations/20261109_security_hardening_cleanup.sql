-- Security hardening (audit 2026-11-09), part 2: run after the frontend reading
-- get_pending_invitation() and partner_secrets is deployed.

-- Invitations are no longer listable by anyone: the register page uses get_pending_invitation()
drop policy if exists "Read invitation by exact UUID" on public.invitations;

-- Secrets now live only in partner_secrets. Writes to the old columns are still accepted
-- (copied there, then blanked); an empty value never wipes a stored secret.
create or replace function public.sync_partner_secrets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(new.mikrotik_agent_secret, '') is not null or nullif(new.fattureincloud_api_token, '') is not null then
    insert into public.partner_secrets (partner_uuid, mikrotik_agent_secret, fattureincloud_api_token)
    values (new.partner_uuid, nullif(new.mikrotik_agent_secret, ''), nullif(new.fattureincloud_api_token, ''))
    on conflict (partner_uuid) do update
      set mikrotik_agent_secret = coalesce(excluded.mikrotik_agent_secret, partner_secrets.mikrotik_agent_secret),
          fattureincloud_api_token = coalesce(excluded.fattureincloud_api_token, partner_secrets.fattureincloud_api_token),
          updated_at = now();
  end if;
  new.mikrotik_agent_secret := null;
  new.fattureincloud_api_token := null;
  return new;
end;
$$;

update public.partners
set mikrotik_agent_secret = mikrotik_agent_secret
where mikrotik_agent_secret is not null or fattureincloud_api_token is not null;
