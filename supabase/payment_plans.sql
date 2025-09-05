create table public.payment_plans (
  id bigserial not null,
  contract_id bigint null,
  plan_type character varying(20) null default 'single'::character varying,
  total_amount numeric(10, 2) not null,
  installment_count integer null default 1,
  installment_amount numeric(10, 2) null,
  frequency character varying(20) null,
  start_date date not null,
  end_date date null,
  next_payment_date date null,
  status character varying(20) null default 'active'::character varying,
  payment_terms character varying(20) null default 'net_30'::character varying,
  late_fee_percentage numeric(5, 2) null default 0.00,
  grace_period_days integer null default 0,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  constraint payment_plans_pkey primary key (id),
  constraint payment_plans_contract_id_fkey foreign KEY (contract_id) references contracts (id) on delete CASCADE,
  constraint payment_plans_frequency_check check (
    (
      (frequency)::text = any (
        (
          array[
            'monthly'::character varying,
            'quarterly'::character varying,
            'semi_annually'::character varying,
            'annually'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint payment_plans_payment_terms_check check (
    (
      (payment_terms)::text = any (
        (
          array[
            'net_7'::character varying,
            'net_15'::character varying,
            'net_30'::character varying,
            'net_45'::character varying,
            'net_60'::character varying,
            'immediate'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint payment_plans_plan_type_check check (
    (
      (plan_type)::text = any (
        (
          array[
            'single'::character varying,
            'installments'::character varying,
            'recurring'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint payment_plans_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'completed'::character varying,
            'cancelled'::character varying,
            'paused'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payment_plans_contract_id on public.payment_plans using btree (contract_id) TABLESPACE pg_default;

create index IF not exists idx_payment_plans_status on public.payment_plans using btree (status) TABLESPACE pg_default;

create index IF not exists idx_payment_plans_next_payment on public.payment_plans using btree (next_payment_date) TABLESPACE pg_default;