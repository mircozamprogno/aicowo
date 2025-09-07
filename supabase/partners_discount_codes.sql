create table public.partners_discount_codes (
  id bigserial not null,
  code character varying(50) not null,
  description text null,
  discount_type character varying(20) not null,
  discount_value numeric(10, 2) not null,
  valid_from timestamp with time zone not null default now(),
  valid_until timestamp with time zone null,
  usage_limit integer null,
  usage_count integer not null default 0,
  is_active boolean not null default true,
  applies_to_plans text[] null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_user_id uuid null,
  
  constraint partners_discount_codes_pkey primary key (id),
  constraint partners_discount_codes_code_key unique (code),
  constraint partners_discount_codes_created_by_fkey foreign key (created_by_user_id) references auth.users (id),
  constraint chk_discount_type check (
    discount_type in ('percentage', 'fixed_amount')
  ),
  constraint chk_discount_value check (
    (discount_type = 'percentage' and discount_value > 0 and discount_value <= 100) or
    (discount_type = 'fixed_amount' and discount_value >= 0)
  ),
  constraint chk_usage_count check (usage_count >= 0),
  constraint chk_usage_limit check (usage_limit is null or usage_limit > 0),
  constraint chk_valid_dates check (valid_until is null or valid_until > valid_from)
) tablespace pg_default;

-- Indexes
create index idx_partners_discount_codes_code on public.partners_discount_codes using btree (code);
create index idx_partners_discount_codes_active on public.partners_discount_codes using btree (is_active);
create index idx_partners_discount_codes_valid_from on public.partners_discount_codes using btree (valid_from);
create index idx_partners_discount_codes_valid_until on public.partners_discount_codes using btree (valid_until);

-- Update trigger
create trigger update_partners_discount_codes_updated_at 
  before update on partners_discount_codes 
  for each row execute function update_updated_at_column();