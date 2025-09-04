create table public.customers (
  id bigserial not null,
  customer_uuid uuid not null default gen_random_uuid (),
  partner_uuid uuid null,
  user_id uuid null,
  first_name character varying(255) not null,
  second_name character varying(255) null,
  company_name character varying(255) null,
  email character varying(255) not null,
  phone character varying(50) null,
  address text null,
  zip character varying(20) null,
  city character varying(255) null,
  country character varying(255) null default 'Italy'::character varying,
  customer_type character varying(50) null default 'individual'::character varying,
  customer_status character varying(50) null default 'active'::character varying,
  piva character varying(50) null,
  codice_fiscale character varying(50) null,
  pec character varying(255) null,
  sdi_code character varying(50) null,
  website character varying(255) null,
  billing_email character varying(255) null,
  billing_phone character varying(50) null,
  billing_address text null,
  billing_zip character varying(20) null,
  billing_city character varying(255) null,
  billing_country character varying(255) null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint customers_pkey primary key (id),
  constraint customers_customer_uuid_key unique (customer_uuid),
  constraint customers_email_key unique (email),
  constraint customers_partner_uuid_fkey foreign KEY (partner_uuid) references partners (partner_uuid) on delete CASCADE,
  constraint customers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_customers_partner_uuid on public.customers using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_customers_user_id on public.customers using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_customers_email on public.customers using btree (email) TABLESPACE pg_default;

create index IF not exists idx_customers_customer_uuid on public.customers using btree (customer_uuid) TABLESPACE pg_default;

create trigger customers_updated_at_trigger BEFORE
update on customers for EACH row
execute FUNCTION update_customers_updated_at ();
