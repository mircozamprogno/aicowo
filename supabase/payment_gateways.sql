create table public.payment_gateways (
  id bigserial not null,
  partner_uuid uuid not null,
  gateway_type character varying(50) not null,
  gateway_name character varying(100) null,
  gateway_config jsonb null,
  is_active boolean null default false,
  test_mode boolean null default true,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  constraint payment_gateways_pkey primary key (id),
  constraint payment_gateways_gateway_type_check check (
    (
      (gateway_type)::text = any (
        (
          array[
            'paypal'::character varying,
            'stripe'::character varying,
            'square'::character varying,
            'pagopa'::character varying,
            'satispay'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payment_gateways_partner on public.payment_gateways using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_payment_gateways_type on public.payment_gateways using btree (gateway_type) TABLESPACE pg_default;