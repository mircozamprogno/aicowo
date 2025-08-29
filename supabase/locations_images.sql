create table public.location_images (
  id bigserial not null,
  image_uuid uuid not null default gen_random_uuid (),
  location_id bigint not null,
  partner_uuid uuid not null,
  resource_type character varying(50) null,
  image_category character varying(50) not null,
  image_name character varying(255) not null,
  storage_path text not null,
  file_size bigint null,
  mime_type character varying(100) null,
  display_order integer null default 0,
  alt_text text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint location_images_pkey primary key (id),
  constraint location_images_uuid_key unique (image_uuid),
  constraint location_images_partner_fkey foreign KEY (partner_uuid) references partners (partner_uuid) on delete CASCADE,
  constraint location_images_location_fkey foreign KEY (location_id) references locations (id) on delete CASCADE,
  constraint location_images_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint location_images_category_check check (
    (
      (image_category)::text = any (
        (
          array[
            'exterior'::character varying,
            'scrivania'::character varying,
            'sala_riunioni'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint location_images_file_size_check check (
    (
      (file_size is null)
      or (file_size > 0)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_location_images_location on public.location_images using btree (location_id) TABLESPACE pg_default;

create index IF not exists idx_location_images_partner on public.location_images using btree (partner_uuid) TABLESPACE pg_default;

create index IF not exists idx_location_images_category on public.location_images using btree (image_category) TABLESPACE pg_default;

create index IF not exists idx_location_images_order on public.location_images using btree (location_id, image_category, display_order) TABLESPACE pg_default;

create trigger update_location_images_updated_at BEFORE
update on location_images for EACH row
execute FUNCTION update_location_images_updated_at ();