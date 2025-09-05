create table public.location_resources (
  id bigserial not null,
  location_resource_uuid uuid not null default gen_random_uuid (),
  location_id bigint not null,
  partner_uuid uuid not null,
  resource_type character varying(50) not null,
  resource_name character varying(255) not null,
  quantity integer not null default 1,
  description text null,
  is_available boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint location_resources_pkey primary key (id),
  constraint location_resources_location_resource_uuid_key unique (location_resource_uuid),
  constraint location_resources_unique_name unique (location_id, resource_name),
  constraint location_resources_partner_uuid_fkey foreign KEY (partner_uuid) references partners (partner_uuid) on delete CASCADE,
  constraint location_resources_location_id_fkey foreign KEY (location_id) references locations (id) on delete CASCADE,
  constraint location_resources_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint location_resources_quantity_positive check ((quantity > 0)),
  constraint location_resources_resource_type_check check (
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

create index IF not exists idx_location_resources_location_id on public.location_resources using btree (location_id) TABLESPACE pg_default;

create index IF not exists idx_location_resources_partner_uuid on public.location_resources using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_location_resources_type on public.location_resources using btree (resource_type) TABLESPACE pg_default;

create trigger update_location_resources_updated_at BEFORE
update on location_resources for EACH row
execute FUNCTION update_location_resources_updated_at ();