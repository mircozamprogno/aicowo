create table public.partners_payments (
  id bigserial not null,
  payment_uuid uuid not null default gen_random_uuid (),
  contract_id bigint not null,
  partner_uuid uuid not null,
  payment_period_start date not null,
  payment_period_end date not null,
  amount numeric(10, 2) not null,
  currency character varying(3) not null default 'EUR'::character varying,
  payment_status character varying(20) not null default 'pending'::character varying,
  payment_method character varying(50) null,
  payment_date timestamp with time zone null,
  due_date date not null,
  transaction_reference character varying(255) null,
  invoice_number character varying(50) null,
  invoice_url text null,
  payment_notes text null,
  late_fee numeric(10, 2) null default 0,
  is_overdue boolean not null default false,
  overdue_days integer null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_user_id uuid null,
  notes text null,
  constraint partners_payments_pkey primary key (id),
  constraint partners_payments_payment_uuid_key unique (payment_uuid),
  constraint partners_payments_contract_id_fkey foreign KEY (contract_id) references partners_contracts (id) on delete CASCADE,
  constraint partners_payments_created_by_fkey foreign KEY (created_by_user_id) references auth.users (id),
  constraint partners_payments_partner_uuid_fkey foreign KEY (partner_uuid) references partners (partner_uuid) on delete RESTRICT,
  constraint chk_amount check ((amount >= (0)::numeric)),
  constraint chk_overdue_days check ((overdue_days >= 0)),
  constraint chk_late_fee check ((late_fee >= (0)::numeric)),
  constraint chk_payment_period check ((payment_period_end >= payment_period_start)),
  constraint chk_payment_status check (
    (
      (payment_status)::text = any (
        (
          array[
            'pending'::character varying,
            'paid'::character varying,
            'failed'::character varying,
            'cancelled'::character varying,
            'refunded'::character varying,
            'partial'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_contract_id on public.partners_payments using btree (contract_id) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_partner_uuid on public.partners_payments using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_status on public.partners_payments using btree (payment_status) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_due_date on public.partners_payments using btree (due_date) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_payment_date on public.partners_payments using btree (payment_date) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_period_start on public.partners_payments using btree (payment_period_start) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_overdue on public.partners_payments using btree (is_overdue) TABLESPACE pg_default;

create index IF not exists idx_partners_payments_created_at on public.partners_payments using btree (created_at) TABLESPACE pg_default;

create trigger update_partners_payments_updated_at BEFORE
update on partners_payments for EACH row
execute FUNCTION update_updated_at_column ();