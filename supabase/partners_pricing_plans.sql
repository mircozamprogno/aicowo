create table public.partners_pricing_plans (
  id bigserial not null,
  plan_name character varying(100) not null,
  plan_description text null,
  monthly_price numeric(10, 2) not null,
  yearly_price numeric(10, 2) not null,
  plan_status character varying(20) not null default 'active'::character varying,
  is_trial boolean not null default false,
  trial_duration_days integer null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_user_id uuid null,
  currency character varying(3) not null default 'EUR'::character varying,
  constraint partners_pricing_plans_pkey primary key (id),
  constraint partners_pricing_plans_plan_name_key unique (plan_name),
  constraint partners_pricing_plans_created_by_fkey foreign KEY (created_by_user_id) references auth.users (id),
  constraint chk_trial_duration check (
    (
      (is_trial = false)
      or (
        (is_trial = true)
        and (trial_duration_days > 0)
      )
    )
  ),
  constraint chk_currency check (
    (
      (currency)::text = any (
        (
          array[
            'EUR'::character varying,
            'USD'::character varying,
            'GBP'::character varying,
            'CHF'::character varying,
            'CAD'::character varying,
            'AUD'::character varying,
            'JPY'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint chk_yearly_price check ((yearly_price >= (0)::numeric)),
  constraint chk_monthly_price check ((monthly_price >= (0)::numeric)),
  constraint chk_plan_status check (
    (
      (plan_status)::text = any (
        (
          array[
            'active'::character varying,
            'inactive'::character varying,
            'archived'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_partners_pricing_plans_status on public.partners_pricing_plans using btree (plan_status) TABLESPACE pg_default;

create index IF not exists idx_partners_pricing_plans_name on public.partners_pricing_plans using btree (plan_name) TABLESPACE pg_default;

create index IF not exists idx_partners_pricing_plans_created_at on public.partners_pricing_plans using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_partners_pricing_plans_currency on public.partners_pricing_plans using btree (currency) TABLESPACE pg_default;

create trigger update_partners_pricing_plans_updated_at BEFORE
update on partners_pricing_plans for EACH row
execute FUNCTION update_updated_at_column ();