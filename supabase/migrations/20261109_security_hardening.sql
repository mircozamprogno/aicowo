-- Security hardening (audit 2026-11-09), part 1: everything that keeps the live frontend working.
-- Part 2 (20261109_security_hardening_cleanup.sql) runs after the new frontend is deployed.

-- Requests coming straight from the REST API carry the caller's JWT role; DB jobs, triggers
-- fired by GoTrue and the service role don't, and are left alone by the guards below.
create or replace function public.is_api_user_request()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('authenticated', 'anon');
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles: nobody but a superadmin may change a role or a partner
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_api_user_request() and not public.is_superadmin()
     and (new.role is distinct from old.role
          or new.partner_uuid is distinct from old.partner_uuid
          or new.id is distinct from old.id) then
    raise exception 'Not allowed to change role or partner' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- 2. customers: admins see their partner's customers, a customer only their own row
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view customers from their partner" on public.customers;
drop policy if exists "Users can update customers from their partner" on public.customers;
drop policy if exists "Users can insert customers for their partner" on public.customers;

create policy "Admins and owners view customers" on public.customers
  for select to authenticated
  using ((public.is_admin() and partner_uuid = public.get_my_partner_uuid()) or user_id = auth.uid());

create policy "Admins and owners update customers" on public.customers
  for update to authenticated
  using ((public.is_admin() and partner_uuid = public.get_my_partner_uuid()) or user_id = auth.uid())
  with check ((public.is_admin() and partner_uuid = public.get_my_partner_uuid()) or user_id = auth.uid());

create policy "Admins and owners insert customers" on public.customers
  for insert to authenticated
  with check (partner_uuid = public.get_my_partner_uuid() and (public.is_admin() or user_id = auth.uid()));

-- Customers editing their own record can't touch access, ownership or status fields
create or replace function public.guard_customer_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_api_user_request() or public.is_admin() or public.is_superadmin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.door_code := null;
    new.door_position := null;
    new.user_id := auth.uid();
    new.fattureincloud_client_id := null;
  elsif new.door_code is distinct from old.door_code
     or new.door_position is distinct from old.door_position
     or new.partner_uuid is distinct from old.partner_uuid
     or new.user_id is distinct from old.user_id
     or new.customer_status is distinct from old.customer_status
     or new.fattureincloud_client_id is distinct from old.fattureincloud_client_id then
    raise exception 'Not allowed to change these customer fields' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_customer_self_edit on public.customers;
create trigger guard_customer_self_edit
  before insert or update on public.customers
  for each row execute function public.guard_customer_self_edit();

-- ---------------------------------------------------------------------------
-- 3. partners: secrets move to an admin-only table
-- ---------------------------------------------------------------------------
create table if not exists public.partner_secrets (
  partner_uuid uuid primary key,
  mikrotik_agent_secret text,
  fattureincloud_api_token text,
  updated_at timestamptz not null default now()
);

alter table public.partner_secrets enable row level security;
revoke all on public.partner_secrets from anon;
grant select, insert, update on public.partner_secrets to authenticated;

drop policy if exists "Partner admins manage their secrets" on public.partner_secrets;
create policy "Partner admins manage their secrets" on public.partner_secrets
  for all to authenticated
  using (public.is_admin() and partner_uuid = public.get_my_partner_uuid())
  with check (public.is_admin() and partner_uuid = public.get_my_partner_uuid());

drop policy if exists "Superadmins manage all secrets" on public.partner_secrets;
create policy "Superadmins manage all secrets" on public.partner_secrets
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

insert into public.partner_secrets (partner_uuid, mikrotik_agent_secret, fattureincloud_api_token)
select partner_uuid, mikrotik_agent_secret, fattureincloud_api_token
from public.partners
where mikrotik_agent_secret is not null or fattureincloud_api_token is not null
on conflict (partner_uuid) do update
  set mikrotik_agent_secret = excluded.mikrotik_agent_secret,
      fattureincloud_api_token = excluded.fattureincloud_api_token,
      updated_at = now();

-- Writes of the old columns (e.g. from a cached frontend) are copied into partner_secrets.
-- Part 2 also blanks the old columns.
create or replace function public.sync_partner_secrets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.mikrotik_agent_secret is distinct from old.mikrotik_agent_secret
     or new.fattureincloud_api_token is distinct from old.fattureincloud_api_token then
    if new.mikrotik_agent_secret is not null or new.fattureincloud_api_token is not null then
      insert into public.partner_secrets (partner_uuid, mikrotik_agent_secret, fattureincloud_api_token)
      values (new.partner_uuid, new.mikrotik_agent_secret, new.fattureincloud_api_token)
      on conflict (partner_uuid) do update
        set mikrotik_agent_secret = coalesce(excluded.mikrotik_agent_secret, partner_secrets.mikrotik_agent_secret),
            fattureincloud_api_token = coalesce(excluded.fattureincloud_api_token, partner_secrets.fattureincloud_api_token),
            updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_partner_secrets on public.partners;
create trigger sync_partner_secrets
  before insert or update on public.partners
  for each row execute function public.sync_partner_secrets();

-- ---------------------------------------------------------------------------
-- 4. contracts: customers can create contracts at the real price and only toggle auto-renew
-- ---------------------------------------------------------------------------
create or replace function public.guard_customer_contract_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  svc public.services%rowtype;
  dc public.customers_discount_codes%rowtype;
  v_base numeric;
  v_discount numeric := 0;
  v_active_entries integer;
begin
  -- Admins, DB jobs and the entries trigger on package_reservations are not restricted
  if not public.is_api_user_request() or public.is_admin() or public.is_superadmin() or pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select s.* into svc
    from public.services s
    join public.customers c on c.id = new.customer_id and c.user_id = auth.uid()
    where s.id = new.service_id and s.partner_uuid = c.partner_uuid and s.service_status = 'active';
    if not found then
      raise exception 'Service not available' using errcode = '42501';
    end if;

    if svc.service_type = 'free_trial' and exists (
      select 1 from public.contracts where customer_id = new.customer_id and service_type = 'free_trial'
    ) then
      raise exception 'Free trial already used' using errcode = '42501';
    end if;

    -- Snapshot always taken from the service, never from the request
    new.partner_uuid := svc.partner_uuid;
    new.service_name := svc.service_name;
    new.service_type := svc.service_type;
    new.service_currency := svc.currency;
    new.service_duration_days := svc.duration_days;
    new.service_max_entries := svc.max_entries;
    new.is_renewable := coalesce(svc.is_renewable, false);
    new.end_date := case
      when svc.service_type = 'giornaliero' then new.start_date
      else new.start_date + ceil(coalesce(svc.duration_days, 0))::integer
    end;
    new.entries_used := 0;
    new.renewal_count := 0;
    new.contract_status := 'active';
    new.requires_payment := true;
    new.is_archived := false;
    new.archived_at := null;
    new.cancelled_at := null;

    v_base := coalesce(svc.cost, 0);
    if new.discount_code is not null then
      select d.* into dc
      from public.customers_discount_codes d
      where d.partner_uuid = svc.partner_uuid
        and upper(d.code) = upper(trim(new.discount_code))
        and d.is_active
        and (d.valid_from is null or d.valid_from <= now())
        and (d.valid_until is null or d.valid_until >= now())
        and (d.usage_limit is null or coalesce(d.usage_count, 0) < d.usage_limit)
      limit 1;
      if found then
        v_discount := case
          when dc.discount_type = 'percentage' then v_base * dc.discount_value / 100
          when dc.discount_type = 'fixed_amount' then least(dc.discount_value, v_base)
          else 0
        end;
      end if;
    end if;

    if v_discount > 0 then
      new.discount_code := upper(dc.code);
      new.discount_type := dc.discount_type;
      new.discount_value := dc.discount_value;
      new.original_price := v_base;
      new.discount_amount := v_discount;
      new.final_price := greatest(v_base - v_discount, 0);
      new.service_cost := greatest(v_base - v_discount, 0);
    else
      new.discount_code := null;
      new.discount_type := null;
      new.discount_value := null;
      new.original_price := null;
      new.discount_amount := null;
      new.final_price := null;
      new.service_cost := v_base;
    end if;
    return new;
  end if;

  -- UPDATE: only auto_renew, and giving back entries of cancelled package reservations
  if (to_jsonb(new) - array['auto_renew', 'updated_at', 'entries_used'])
     is distinct from (to_jsonb(old) - array['auto_renew', 'updated_at', 'entries_used']) then
    raise exception 'Not allowed to change this contract' using errcode = '42501';
  end if;
  if new.entries_used is distinct from old.entries_used then
    select coalesce(sum(entries_used), 0) into v_active_entries
    from public.package_reservations
    where contract_id = new.id
      and coalesce(reservation_status, '') <> 'cancelled'
      and not coalesce(is_archived, false);
    if new.entries_used > old.entries_used or new.entries_used < v_active_entries then
      raise exception 'Invalid entries change' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_customer_contract_write on public.contracts;
create trigger guard_customer_contract_write
  before insert or update on public.contracts
  for each row execute function public.guard_customer_contract_write();

-- ---------------------------------------------------------------------------
-- 5. invitations: read one invitation by its UUID instead of listing the table
-- ---------------------------------------------------------------------------
create or replace function public.get_pending_invitation(p_invitation_uuid uuid)
returns setof public.invitations
language sql
stable
security definer
set search_path = public
as $$
  select * from public.invitations
  where invitation_uuid = p_invitation_uuid
    and status = 'pending'
    and expires_at > now()
  limit 1;
$$;

revoke all on function public.get_pending_invitation(uuid) from public;
grant execute on function public.get_pending_invitation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. storage: each partner's folder is writable only by its admins
--    (customers: their own folder and the booking calendars)
-- ---------------------------------------------------------------------------
create or replace function public.can_write_partner_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_superadmin()
    or ((storage.foldername(p_name))[1] = public.get_my_partner_uuid()::text
        and (public.is_admin()
             or (storage.foldername(p_name))[2] = 'calendars'
             or exists (
               select 1 from public.customers c
               where c.user_id = auth.uid()
                 and c.customer_uuid::text = (storage.foldername(p_name))[2]))), false);
$$;

drop policy if exists "Allow authenticated partners bucket access" on storage.objects;
drop policy if exists "Partners bucket read" on storage.objects;
drop policy if exists "Partners bucket insert" on storage.objects;
drop policy if exists "Partners bucket update" on storage.objects;
drop policy if exists "Partners bucket delete" on storage.objects;

create policy "Partners bucket read" on storage.objects
  for select to authenticated
  using (bucket_id = 'partners' and public.can_write_partner_object(name));
create policy "Partners bucket insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'partners' and public.can_write_partner_object(name));
create policy "Partners bucket update" on storage.objects
  for update to authenticated
  using (bucket_id = 'partners' and public.can_write_partner_object(name))
  with check (bucket_id = 'partners' and public.can_write_partner_object(name));
create policy "Partners bucket delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'partners' and public.can_write_partner_object(name));

-- ---------------------------------------------------------------------------
-- 7. payments: customers only see the payments of their own contracts
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'payments' and cmd = 'SELECT'
      and qual = '(partner_uuid = get_my_partner_uuid())'
  loop
    execute format('drop policy %I on public.payments', pol.policyname);
  end loop;
end $$;

drop policy if exists "Customers view own payments" on public.payments;
create policy "Customers view own payments" on public.payments
  for select to authenticated
  using (contract_id in (
    select k.id from public.contracts k
    join public.customers c on c.id = k.customer_id
    where c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 8. Batch jobs are for pg_cron only
-- ---------------------------------------------------------------------------
revoke execute on function public.auto_renew_contracts() from public, anon, authenticated;
revoke execute on function public.handle_contract_expiry() from public, anon, authenticated;
revoke execute on function public.handle_invitation_expiry() from public, anon, authenticated;
revoke execute on function public.update_expired_contracts() from public, anon, authenticated;
revoke execute on function public.get_tables_list() from public, anon, authenticated;
