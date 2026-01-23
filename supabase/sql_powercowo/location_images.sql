--
-- PostgreSQL database dump
--

\restrict Wqgra9YigaltBcF71SZ3IsZ8B0VRQYDnBo442eAPb35E3IkQvOeKJIFb6EKQFgn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: location_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_images (
    id bigint NOT NULL,
    image_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    resource_type character varying(50),
    image_category character varying(50) NOT NULL,
    image_name character varying(255) NOT NULL,
    storage_path text NOT NULL,
    file_size bigint,
    mime_type character varying(100),
    display_order integer DEFAULT 0,
    alt_text text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT location_images_category_check CHECK (((image_category)::text = ANY (ARRAY[('exterior'::character varying)::text, ('scrivania'::character varying)::text, ('sala_riunioni'::character varying)::text]))),
    CONSTRAINT location_images_file_size_check CHECK (((file_size IS NULL) OR (file_size > 0)))
);


ALTER TABLE public.location_images OWNER TO postgres;

--
-- Name: TABLE location_images; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.location_images IS 'Stores images for locations and their resources';


--
-- Name: COLUMN location_images.resource_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_images.resource_type IS 'Type of resource the image represents, NULL for general location images';


--
-- Name: COLUMN location_images.image_category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_images.image_category IS 'Category of image: exterior, scrivania, or sala_riunioni';


--
-- Name: COLUMN location_images.storage_path; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_images.storage_path IS 'Full path to image in Supabase storage';


--
-- Name: COLUMN location_images.display_order; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_images.display_order IS 'Order for displaying images within the same category';


--
-- Name: COLUMN location_images.alt_text; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_images.alt_text IS 'Alternative text for accessibility';


--
-- Name: location_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.location_images_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.location_images_id_seq OWNER TO postgres;

--
-- Name: location_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.location_images_id_seq OWNED BY public.location_images.id;


--
-- Name: location_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_images ALTER COLUMN id SET DEFAULT nextval('public.location_images_id_seq'::regclass);


--
-- Name: location_images location_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_images
    ADD CONSTRAINT location_images_pkey PRIMARY KEY (id);


--
-- Name: location_images location_images_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_images
    ADD CONSTRAINT location_images_uuid_key UNIQUE (image_uuid);


--
-- Name: idx_location_images_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_images_category ON public.location_images USING btree (image_category);


--
-- Name: idx_location_images_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_images_location ON public.location_images USING btree (location_id);


--
-- Name: idx_location_images_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_images_order ON public.location_images USING btree (location_id, image_category, display_order);


--
-- Name: idx_location_images_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_images_partner ON public.location_images USING btree (partner_uuid);


--
-- Name: location_images update_location_images_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_location_images_updated_at BEFORE UPDATE ON public.location_images FOR EACH ROW EXECUTE FUNCTION public.update_location_images_updated_at();


--
-- Name: location_images location_images_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_images
    ADD CONSTRAINT location_images_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: location_images location_images_location_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_images
    ADD CONSTRAINT location_images_location_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: location_images location_images_partner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_images
    ADD CONSTRAINT location_images_partner_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: location_images Admins can delete partner location images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete partner location images" ON public.location_images FOR DELETE USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: location_images Admins can insert partner location images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert partner location images" ON public.location_images FOR INSERT WITH CHECK ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: location_images Admins can update partner location images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update partner location images" ON public.location_images FOR UPDATE USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));


--
-- Name: location_images Users can view partner location images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view partner location images" ON public.location_images FOR SELECT USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: location_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.location_images ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE location_images; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.location_images TO anon;
GRANT ALL ON TABLE public.location_images TO authenticated;
GRANT ALL ON TABLE public.location_images TO service_role;


--
-- Name: SEQUENCE location_images_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.location_images_id_seq TO anon;
GRANT ALL ON SEQUENCE public.location_images_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.location_images_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict Wqgra9YigaltBcF71SZ3IsZ8B0VRQYDnBo442eAPb35E3IkQvOeKJIFb6EKQFgn

