create table public.partners_plan_features (
  id bigserial not null,
  feature_name character varying(100) not null,
  feature_key character varying(100) not null,
  feature_description text null,
  feature_type character varying(20) not null,
  default_value text null,
  feature_category character varying(50) null,
  is_active boolean not null default true,
  display_order integer null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_user_id uuid null,
  
  constraint partners_plan_features_pkey primary key (id),
  constraint partners_plan_features_feature_key_key unique (feature_key),
  constraint partners_plan_features_created_by_fkey foreign key (created_by_user_id) references auth.users (id),
  constraint chk_feature_type check (
    feature_type in ('boolean', 'numeric', 'text')
  ),
  constraint chk_default_value check (
  (feature_type = 'boolean' and default_value = 'false') or
  (feature_type = 'numeric' and default_value = '0') or
  (feature_type = 'text' and default_value is null)
)
) tablespace pg_default;

-- Indexes
create index idx_partners_plan_features_key on public.partners_plan_features using btree (feature_key);
create index idx_partners_plan_features_type on public.partners_plan_features using btree (feature_type);
create index idx_partners_plan_features_category on public.partners_plan_features using btree (feature_category);
create index idx_partners_plan_features_active on public.partners_plan_features using btree (is_active);
create index idx_partners_plan_features_order on public.partners_plan_features using btree (display_order);

-- Update trigger
create trigger update_partners_plan_features_updated_at 
  before update on partners_plan_features 
  for each row execute function update_updated_at_column();