create table public.profiles (
  id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  username text null,
  email text null,
  partner_uuid uuid null,
  role text not null default 'user'::text,
  phone text null,
  fcm_token text null,
  customer_uuid uuid null,
  first_name text null,
  last_name text null,
  avatar_url text null,
  is_active boolean not null default true,
  last_login timestamp with time zone null,
  preferences jsonb null default '{}'::jsonb,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on update CASCADE on delete CASCADE,
  constraint profiles_partner_fkey foreign KEY (partner_uuid) references partners (partner_uuid) on update CASCADE on delete set null,
  constraint profiles_role_check check (
    (
      role = any (
        array['superadmin'::text, 'admin'::text, 'user'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_profiles_partner on public.profiles using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_profiles_role on public.profiles using btree (role) TABLESPACE pg_default;

create trigger update_profiles_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION update_updated_at_column ();