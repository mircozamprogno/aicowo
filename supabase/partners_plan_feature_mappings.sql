create table public.partners_plan_feature_mappings (
  id bigserial not null,
  plan_id bigint not null,
  feature_id bigint not null,
  feature_value text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  
  constraint partners_plan_feature_mappings_pkey primary key (id),
  constraint partners_plan_feature_mappings_plan_feature_unique unique (plan_id, feature_id),
  constraint partners_plan_feature_mappings_plan_id_fkey foreign key (plan_id) references partners_pricing_plans (id) on delete cascade,
  constraint partners_plan_feature_mappings_feature_id_fkey foreign key (feature_id) references partners_plan_features (id) on delete cascade
) tablespace pg_default;

-- Indexes
create index idx_partners_plan_feature_mappings_plan_id on public.partners_plan_feature_mappings using btree (plan_id);
create index idx_partners_plan_feature_mappings_feature_id on public.partners_plan_feature_mappings using btree (feature_id);

-- Update trigger
create trigger update_partners_plan_feature_mappings_updated_at 
  before update on partners_plan_feature_mappings 
  for each row execute function update_updated_at_column();