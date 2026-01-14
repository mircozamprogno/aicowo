--
-- PostgreSQL database dump
--

\restrict VOet1mVyv2yEOohcJgC19ydgRVwSJ7baAv8supS9XsmdDZvcATs8r5hSa56krsP

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
-- Name: location_resources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_resources (
    id bigint NOT NULL,
    location_resource_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_name character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    description text,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT location_resources_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT location_resources_resource_type_check CHECK (((resource_type)::text = ANY (ARRAY[('scrivania'::character varying)::text, ('sala_riunioni'::character varying)::text])))
);


ALTER TABLE public.location_resources OWNER TO postgres;

--
-- Name: TABLE location_resources; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.location_resources IS 'Resources available at each location (desks, meeting rooms, etc.)';


--
-- Name: COLUMN location_resources.resource_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_resources.resource_type IS 'Type of resource: scrivania or sala_riunioni';


--
-- Name: COLUMN location_resources.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.location_resources.quantity IS 'Number of this resource type available';


--
-- Name: location_resources_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.location_resources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.location_resources_id_seq OWNER TO postgres;

--
-- Name: location_resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.location_resources_id_seq OWNED BY public.location_resources.id;


--
-- Name: location_resources id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_resources ALTER COLUMN id SET DEFAULT nextval('public.location_resources_id_seq'::regclass);


--
-- Name: location_resources location_resources_location_resource_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_resources
    ADD CONSTRAINT location_resources_location_resource_uuid_key UNIQUE (location_resource_uuid);


--
-- Name: location_resources location_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_resources
    ADD CONSTRAINT location_resources_pkey PRIMARY KEY (id);


--
-- Name: location_resources location_resources_unique_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_resources
    ADD CONSTRAINT location_resources_unique_name UNIQUE (location_id, resource_name);


--
-- Name: idx_location_resources_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_resources_location_id ON public.location_resources USING btree (location_id);


--
-- Name: idx_location_resources_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_resources_partner_uuid ON public.location_resources USING btree (partner_uuid);


--
-- Name: idx_location_resources_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_location_resources_type ON public.location_resources USING btree (resource_type);


--
-- Name: location_resources update_location_resources_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_location_resources_updated_at BEFORE UPDATE ON public.location_resources FOR EACH ROW EXECUTE FUNCTION public.update_location_resources_updated_at();


--
-- Name: location_resources location_resources_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_resources
    ADD CONSTRAINT location_resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: location_resources location_resources_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_resources
    ADD CONSTRAINT location_resources_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: location_resources location_resources_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_resources
    ADD CONSTRAINT location_resources_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: location_resources Partner admins can create location resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can create location resources" ON public.location_resources FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.partner_uuid = location_resources.partner_uuid)))));


--
-- Name: location_resources Partner admins can delete their location resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can delete their location resources" ON public.location_resources FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.partner_uuid = location_resources.partner_uuid)))));


--
-- Name: location_resources Partner admins can update their location resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can update their location resources" ON public.location_resources FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.partner_uuid = location_resources.partner_uuid)))));


--
-- Name: location_resources Partner admins can view their location resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can view their location resources" ON public.location_resources FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text) AND (profiles.partner_uuid = location_resources.partner_uuid)))));


--
-- Name: location_resources Superadmins can manage all location resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins can manage all location resources" ON public.location_resources USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: location_resources Superadmins can view all location resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins can view all location resources" ON public.location_resources FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: location_resources Users can view their partner location resources; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their partner location resources" ON public.location_resources FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.partner_uuid = location_resources.partner_uuid)))));


--
-- Name: location_resources; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.location_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE location_resources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.location_resources TO anon;
GRANT ALL ON TABLE public.location_resources TO authenticated;
GRANT ALL ON TABLE public.location_resources TO service_role;


--
-- Name: SEQUENCE location_resources_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.location_resources_id_seq TO anon;
GRANT ALL ON SEQUENCE public.location_resources_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.location_resources_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict VOet1mVyv2yEOohcJgC19ydgRVwSJ7baAv8supS9XsmdDZvcATs8r5hSa56krsP

