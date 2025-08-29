create table public.services (
  id bigserial not null,
  service_uuid uuid not null default gen_random_uuid (),
  partner_uuid uuid not null,
  location_id bigint null,
  service_name character varying(255) not null,
  service_description text null,
  service_type character varying(50) not null,
  cost numeric(10, 2) not null default 0.00,
  currency character varying(3) null default 'EUR'::character varying,
  duration_days integer not null default 30,
  max_entries integer null,
  service_status character varying(20) null default 'active'::character varying,
  is_renewable boolean null default true,
  auto_renew boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  location_resource_id bigint null,
  constraint services_pkey primary key (id),
  constraint services_unique_name_resource unique (partner_uuid, location_resource_id, service_name),
  constraint services_service_uuid_key unique (service_uuid),
  constraint services_partner_uuid_fkey foreign KEY (partner_uuid) references partners (partner_uuid) on delete CASCADE,
  constraint services_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint fk_services_location_resource foreign KEY (location_resource_id) references location_resources (id) on delete CASCADE,
  constraint services_location_id_fkey foreign KEY (location_id) references locations (id) on delete CASCADE,
  constraint services_service_status_check check (
    (
      (service_status)::text = any (
        (
          array[
            'active'::character varying,
            'inactive'::character varying,
            'draft'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint services_service_type_check check (
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
  )
) TABLESPACE pg_default;

create index IF not exists idx_services_partner_uuid on public.services using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_services_location_id on public.services using btree (location_id) TABLESPACE pg_default;

create index IF not exists idx_services_type on public.services using btree (service_type) TABLESPACE pg_default;

create index IF not exists idx_services_status on public.services using btree (service_status) TABLESPACE pg_default;

create index IF not exists idx_services_location_resource_id on public.services using btree (location_resource_id) TABLESPACE pg_default;

create index IF not exists idx_services_partner_resource on public.services using btree (partner_uuid, location_resource_id) TABLESPACE pg_default;

create trigger update_services_updated_at BEFORE
update on services for EACH row
execute FUNCTION update_updated_at_column ();