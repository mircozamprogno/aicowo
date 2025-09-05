create table public.payments (
  id bigserial not null,
  payment_uuid uuid null default gen_random_uuid (),
  payment_number character varying(50) not null,
  contract_id bigint null,
  partner_uuid uuid not null,
  amount numeric(10, 2) not null,
  currency character varying(3) null default 'EUR'::character varying,
  payment_method character varying(50) not null,
  payment_status character varying(20) null default 'pending'::character varying,
  payment_type character varying(20) null default 'full'::character varying,
  payment_date timestamp without time zone null,
  due_date date null,
  transaction_reference character varying(100) null,
  invoice_number character varying(50) null,
  notes text null,
  receipt_url text null,
  created_by uuid null,
  processed_by uuid null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  constraint payments_pkey primary key (id),
  constraint payments_payment_number_key unique (payment_number),
  constraint payments_payment_uuid_key unique (payment_uuid),
  constraint payments_contract_id_fkey foreign KEY (contract_id) references contracts (id) on delete CASCADE,
  constraint payments_payment_status_check check (
    (
      (payment_status)::text = any (
        (
          array[
            'pending'::character varying,
            'completed'::character varying,
            'failed'::character varying,
            'refunded'::character varying,
            'cancelled'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint payments_payment_method_check check (
    (
      (payment_method)::text = any (
        (
          array[
            'cash'::character varying,
            'bank_transfer'::character varying,
            'paypal'::character varying,
            'stripe'::character varying,
            'credit_card'::character varying,
            'other'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint payments_amount_check check ((amount > (0)::numeric)),
  constraint payments_payment_type_check check (
    (
      (payment_type)::text = any (
        (
          array[
            'full'::character varying,
            'partial'::character varying,
            'installment'::character varying,
            'deposit'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payments_contract_id on public.payments using btree (contract_id) TABLESPACE pg_default;

create index IF not exists idx_payments_partner_uuid on public.payments using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_payments_status on public.payments using btree (payment_status) TABLESPACE pg_default;

create index IF not exists idx_payments_date on public.payments using btree (payment_date) TABLESPACE pg_default;

create index IF not exists idx_payments_due_date on public.payments using btree (due_date) TABLESPACE pg_default;

create trigger trigger_set_payment_number BEFORE INSERT
or
update on payments for EACH row
execute FUNCTION set_payment_number ();