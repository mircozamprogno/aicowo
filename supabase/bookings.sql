create table public.bookings (
  id bigserial not null,
  booking_uuid uuid not null default gen_random_uuid (),
  contract_id bigint not null,
  location_resource_id bigint not null,
  partner_uuid uuid not null,
  customer_id bigint not null,
  start_date date not null,
  end_date date not null,
  booking_status character varying(20) not null default 'active'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  updated_by uuid null,
  is_archived boolean not null default false,
  archived_at timestamp with time zone null,
  archived_by_user_id uuid null,
  archive_reason text null,
  constraint bookings_pkey primary key (id),
  constraint bookings_booking_uuid_key unique (booking_uuid),
  constraint bookings_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint bookings_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete CASCADE,
  constraint bookings_updated_by_fkey foreign KEY (updated_by) references auth.users (id),
  constraint bookings_contract_id_fkey foreign KEY (contract_id) references contracts (id) on delete CASCADE,
  constraint bookings_partner_uuid_fkey foreign KEY (partner_uuid) references partners (partner_uuid) on delete CASCADE,
  constraint bookings_archived_by_user_id_fkey foreign KEY (archived_by_user_id) references auth.users (id),
  constraint bookings_location_resource_id_fkey foreign KEY (location_resource_id) references location_resources (id) on delete CASCADE,
  constraint bookings_dates_check check ((end_date >= start_date)),
  constraint bookings_booking_status_check check (
    (
      (booking_status)::text = any (
        array[
          ('active'::character varying)::text,
          ('cancelled'::character varying)::text,
          ('completed'::character varying)::text,
          ('expired'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_bookings_contract_id on public.bookings using btree (contract_id) TABLESPACE pg_default;

create index IF not exists idx_bookings_location_resource_id on public.bookings using btree (location_resource_id) TABLESPACE pg_default;

create index IF not exists idx_bookings_partner_uuid on public.bookings using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_bookings_customer_id on public.bookings using btree (customer_id) TABLESPACE pg_default;

create index IF not exists idx_bookings_date_range on public.bookings using btree (start_date, end_date) TABLESPACE pg_default;

create index IF not exists idx_bookings_status on public.bookings using btree (booking_status) TABLESPACE pg_default;

create index IF not exists idx_bookings_is_archived on public.bookings using btree (is_archived) TABLESPACE pg_default;

create index IF not exists idx_bookings_archived_at on public.bookings using btree (archived_at) TABLESPACE pg_default;

create trigger update_bookings_updated_at BEFORE
update on bookings for EACH row
execute FUNCTION update_bookings_updated_at ();