create table public.partners_contracts (
  id bigserial not null,
  contract_uuid uuid not null default gen_random_uuid(),
  partner_uuid uuid not null,
  plan_id bigint not null,
  discount_code_id bigint null,
  contract_number character varying(50) not null,
  billing_frequency character varying(20) not null,
  contract_status character varying(20) not null default 'active',
  start_date date not null,
  end_date date null,
  base_price numeric(10, 2) not null,
  discount_amount numeric(10, 2) null default 0,
  final_price numeric(10, 2) not null,
  currency character varying(3) not null default 'EUR',
  auto_renew boolean not null default false,
  renewal_count integer not null default 0,
  contract_terms text null,
  notes text null,
  signed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  cancellation_reason text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_user_id uuid null,
  
  constraint partners_contracts_pkey primary key (id),
  constraint partners_contracts_contract_uuid_key unique (contract_uuid),
  constraint partners_contracts_contract_number_key unique (contract_number),
  constraint partners_contracts_partner_uuid_fkey foreign key (partner_uuid) references partners (partner_uuid) on delete restrict,
  constraint partners_contracts_plan_id_fkey foreign key (plan_id) references partners_pricing_plans (id) on delete restrict,
  constraint partners_contracts_discount_code_id_fkey foreign key (discount_code_id) references partners_discount_codes (id) on delete set null,
  constraint partners_contracts_created_by_fkey foreign key (created_by_user_id) references auth.users (id),
  constraint chk_billing_frequency check (
    billing_frequency in ('monthly', 'yearly')
  ),
  constraint chk_contract_status check (
    contract_status in ('draft', 'active', 'expired', 'cancelled', 'suspended')
  ),
  constraint chk_base_price check (base_price >= 0),
  constraint chk_discount_amount check (discount_amount >= 0),
  constraint chk_final_price check (final_price >= 0),
  constraint chk_renewal_count check (renewal_count >= 0),
  constraint chk_contract_dates check (end_date is null or end_date >= start_date)
) tablespace pg_default;

-- Indexes
create index idx_partners_contracts_partner_uuid on public.partners_contracts using btree (partner_uuid);
create index idx_partners_contracts_plan_id on public.partners_contracts using btree (plan_id);
create index idx_partners_contracts_status on public.partners_contracts using btree (contract_status);
create index idx_partners_contracts_billing_frequency on public.partners_contracts using btree (billing_frequency);
create index idx_partners_contracts_start_date on public.partners_contracts using btree (start_date);
create index idx_partners_contracts_end_date on public.partners_contracts using btree (end_date);
create index idx_partners_contracts_created_at on public.partners_contracts using btree (created_at);

-- Update trigger
create trigger update_partners_contracts_updated_at 
  before update on partners_contracts 
  for each row execute function update_updated_at_column();