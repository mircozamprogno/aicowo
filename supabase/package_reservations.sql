create table public.package_reservations (
  id serial not null,
  reservation_uuid uuid null default gen_random_uuid (),
  contract_id integer not null,
  location_resource_id integer not null,
  partner_uuid uuid not null,
  customer_id integer not null,
  reservation_date date not null,
  duration_type character varying(20) not null,
  time_slot character varying(20) null,
  entries_used numeric(3, 1) not null,
  reservation_status character varying(20) not null default 'confirmed'::character varying,
  notes text null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  updated_at timestamp with time zone null default now(),
  updated_by uuid null,
  is_archived boolean not null default false,
  archived_at timestamp with time zone null,
  archived_by_user_id uuid null,
  archive_reason text null,
  constraint package_reservations_pkey primary key (id),
  constraint package_reservations_location_resource_id_reservation_date__key unique (
    location_resource_id,
    reservation_date,
    duration_type,
    time_slot
  ),
  constraint package_reservations_contract_id_fkey foreign KEY (contract_id) references contracts (id) on delete CASCADE,
  constraint package_reservations_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint package_reservations_customer_id_fkey foreign KEY (customer_id) references customers (id),
  constraint package_reservations_location_resource_id_fkey foreign KEY (location_resource_id) references location_resources (id),
  constraint package_reservations_updated_by_fkey foreign KEY (updated_by) references auth.users (id),
  constraint package_reservations_archived_by_user_id_fkey foreign KEY (archived_by_user_id) references auth.users (id),
  constraint package_reservations_duration_type_check check (
    (
      (duration_type)::text = any (
        (
          array[
            'full_day'::character varying,
            'half_day'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint package_reservations_reservation_status_check check (
    (
      (reservation_status)::text = any (
        (
          array[
            'confirmed'::character varying,
            'cancelled'::character varying,
            'completed'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint package_reservations_time_slot_check check (
    (
      (time_slot)::text = any (
        (
          array[
            'morning'::character varying,
            'afternoon'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint check_time_slot_for_half_day check (
    (
      ((duration_type)::text = 'full_day'::text)
      or (
        ((duration_type)::text = 'half_day'::text)
        and (time_slot is not null)
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_package_reservations_date on public.package_reservations using btree (reservation_date) TABLESPACE pg_default;

create index IF not exists idx_package_reservations_contract on public.package_reservations using btree (contract_id) TABLESPACE pg_default;

create index IF not exists idx_package_reservations_resource on public.package_reservations using btree (location_resource_id) TABLESPACE pg_default;

create index IF not exists idx_package_reservations_is_archived on public.package_reservations using btree (is_archived) TABLESPACE pg_default;

create index IF not exists idx_package_reservations_archived_at on public.package_reservations using btree (archived_at) TABLESPACE pg_default;

create trigger trigger_update_contract_entries
after INSERT
or DELETE
or
update on package_reservations for EACH row
execute FUNCTION update_contract_entries_on_reservation ();