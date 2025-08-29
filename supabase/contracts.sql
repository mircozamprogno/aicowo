create table public.contracts (
  id bigserial not null,
  contract_uuid uuid not null default gen_random_uuid (),
  customer_id bigint not null,
  service_id bigint not null,
  location_id bigint not null,
  partner_uuid uuid not null,
  contract_number character varying(50) not null,
  start_date date not null,
  end_date date not null,
  service_name character varying(255) not null,
  service_type character varying(50) not null,
  service_cost numeric(10, 2) not null,
  service_currency character varying(3) null default 'EUR'::character varying,
  service_duration_days integer not null,
  service_max_entries integer null,
  location_name character varying(255) not null,
  resource_name character varying(255) not null,
  resource_type character varying(50) not null,
  contract_status character varying(50) not null default 'active'::character varying,
  entries_used integer null default 0,
  last_entry_date date null,
  is_renewable boolean null default false,
  auto_renew boolean null default false,
  renewal_count integer null default 0,
  created_by_user_id uuid null,
  created_by_role character varying(50) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  cancelled_at timestamp with time zone null,
  cancelled_by_user_id uuid null,
  cancellation_reason text null,
  notes text null,
  is_archived boolean not null default false,
  archived_at timestamp with time zone null,
  archived_by_user_id uuid null,
  archive_reason text null,
  constraint contracts_pkey primary key (id),
  constraint contracts_contract_number_key unique (contract_number),
  constraint contracts_contract_uuid_key unique (contract_uuid),
  constraint contracts_service_id_fkey foreign KEY (service_id) references services (id) on delete RESTRICT,
  constraint contracts_archived_by_user_id_fkey foreign KEY (archived_by_user_id) references auth.users (id),
  constraint contracts_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete CASCADE,
  constraint contracts_location_id_fkey foreign KEY (location_id) references locations (id) on delete RESTRICT,
  constraint chk_entries_used check ((entries_used >= 0)),
  constraint chk_contract_status check (
    (
      (contract_status)::text = any (
        (
          array[
            'active'::character varying,
            'expired'::character varying,
            'cancelled'::character varying,
            'suspended'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint chk_service_type check (
    (
      (service_type)::text = any (
        (
          array[
            'abbonamento'::character varying,
            'pacchetto'::character varying,
            'free_trial'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint chk_contract_dates check ((end_date > start_date)),
  constraint chk_resource_type check (
    (
      (resource_type)::text = any (
        (
          array[
            'scrivania'::character varying,
            'sala_riunioni'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_contracts_customer_id on public.contracts using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_contracts_service_id on public.contracts using btree (service_id) TABLESPACE pg_default;

create index IF not exists idx_contracts_location_id on public.contracts using btree (location_id) TABLESPACE pg_default;

create index IF not exists idx_contracts_partner_uuid on public.contracts using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_contracts_contract_number on public.contracts using btree (contract_number) TABLESPACE pg_default;

create index IF not exists idx_contracts_start_date on public.contracts using btree (start_date) TABLESPACE pg_default;

create index IF not exists idx_contracts_end_date on public.contracts using btree (end_date) TABLESPACE pg_default;

create index IF not exists idx_contracts_status on public.contracts using btree (contract_status) TABLESPACE pg_default;

create index IF not exists idx_contracts_created_at on public.contracts using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_contracts_is_archived on public.contracts using btree (is_archived) TABLESPACE pg_default;

create index IF not exists idx_contracts_archived_at on public.contracts using btree (archived_at) TABLESPACE pg_default;

create trigger contracts_updated_at BEFORE
update on contracts for EACH row
execute FUNCTION update_contracts_updated_at ();