--
-- PostgreSQL database dump
--

\restrict 6XkCE569KSpMzrm6wfshXmRBmovtFkZ25o7IAKbNuJe0I7DtbUgsV8qRmwOhlKY

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
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id bigint NOT NULL,
    service_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_uuid uuid NOT NULL,
    location_id bigint,
    service_name character varying(255) NOT NULL,
    service_description text,
    service_type character varying(50) NOT NULL,
    cost numeric(10,2) DEFAULT 0.00 NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying,
    duration_days numeric(10,2) DEFAULT 30.0 NOT NULL,
    max_entries integer,
    service_status character varying(20) DEFAULT 'active'::character varying,
    is_renewable boolean DEFAULT true,
    auto_renew boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    location_resource_id bigint,
    private boolean DEFAULT false NOT NULL,
    CONSTRAINT services_service_status_check CHECK (((service_status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('draft'::character varying)::text]))),
    CONSTRAINT services_service_type_check CHECK (((service_type)::text = ANY (ARRAY[('abbonamento'::character varying)::text, ('pacchetto'::character varying)::text, ('free_trial'::character varying)::text, ('giornaliero'::character varying)::text])))
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: TABLE services; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.services IS 'Services offered by partners, linked to specific location resources';


--
-- Name: COLUMN services.location_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services.location_id IS 'Kept for backward compatibility, use location_resource_id for new queries';


--
-- Name: COLUMN services.location_resource_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services.location_resource_id IS 'Links service to a specific resource at a location (required)';


--
-- Name: COLUMN services.private; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.services.private IS 'Private services are only visible to partner admins and cannot be selected by customers when creating contracts';


--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.services_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.services_id_seq OWNER TO postgres;

--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_service_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_service_uuid_key UNIQUE (service_uuid);


--
-- Name: services services_unique_name_resource; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_unique_name_resource UNIQUE (partner_uuid, location_resource_id, service_name);


--
-- Name: idx_services_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_location_id ON public.services USING btree (location_id);


--
-- Name: idx_services_location_resource_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_location_resource_id ON public.services USING btree (location_resource_id);


--
-- Name: idx_services_partner_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_partner_resource ON public.services USING btree (partner_uuid, location_resource_id);


--
-- Name: idx_services_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_partner_uuid ON public.services USING btree (partner_uuid);


--
-- Name: idx_services_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_status ON public.services USING btree (service_status);


--
-- Name: idx_services_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_type ON public.services USING btree (service_type);


--
-- Name: services update_services_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: services fk_services_location_resource; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT fk_services_location_resource FOREIGN KEY (location_resource_id) REFERENCES public.location_resources(id) ON DELETE CASCADE;


--
-- Name: services services_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: services services_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: services services_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: services Partner admins can create services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can create services" ON public.services FOR INSERT WITH CHECK ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: services Partner admins can delete their services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can delete their services" ON public.services FOR DELETE USING ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: services Partner admins can update their services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can update their services" ON public.services FOR UPDATE USING ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: services Partner admins can view their services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can view their services" ON public.services FOR SELECT USING ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: services Superadmins can manage all services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins can manage all services" ON public.services USING (public.is_superadmin());


--
-- Name: services Superadmins can view all services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins can view all services" ON public.services FOR SELECT USING (public.is_superadmin());


--
-- Name: services Users can view their partner services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their partner services" ON public.services FOR SELECT USING ((partner_uuid = public.get_my_partner_uuid()));


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;


--
-- Name: SEQUENCE services_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.services_id_seq TO anon;
GRANT ALL ON SEQUENCE public.services_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.services_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 6XkCE569KSpMzrm6wfshXmRBmovtFkZ25o7IAKbNuJe0I7DtbUgsV8qRmwOhlKY

