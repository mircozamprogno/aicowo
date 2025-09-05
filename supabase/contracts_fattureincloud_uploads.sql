create table public.contract_fattureincloud_uploads (
  id serial not null,
  contract_id integer null,
  fattureincloud_invoice_id text null,
  fattureincloud_invoice_number text null,
  upload_status text null default 'pending'::text,
  error_message text null,
  uploaded_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  constraint contract_fattureincloud_uploads_pkey primary key (id),
  constraint contract_fattureincloud_uploa_contract_id_fattureincloud_in_key unique (contract_id, fattureincloud_invoice_id),
  constraint contract_fattureincloud_uploads_contract_id_fkey foreign KEY (contract_id) references contracts (id) on delete CASCADE,
  constraint contract_fattureincloud_uploads_upload_status_check check (
    (
      upload_status = any (
        array['success'::text, 'failed'::text, 'pending'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_contract_fattureincloud_uploads_contract_id on public.contract_fattureincloud_uploads using btree (contract_id) TABLESPACE pg_default;

create index IF not exists idx_contract_fattureincloud_uploads_status on public.contract_fattureincloud_uploads using btree (upload_status) TABLESPACE pg_default;