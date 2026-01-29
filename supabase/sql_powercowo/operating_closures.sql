--
-- PostgreSQL database dump
--

\restrict FxlX0Kf8gy67YymhdcyrngkqRY9umkGTaEg9tHRGFuzJNXTvpP456HRbSTSZjBr

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
-- Name: operating_closures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operating_closures (
    id bigint NOT NULL,
    closure_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_uuid uuid NOT NULL,
    closure_scope character varying(20) NOT NULL,
    location_id bigint,
    location_resource_id bigint,
    resource_type character varying(50),
    closure_start_date date NOT NULL,
    closure_end_date date NOT NULL,
    closure_type character varying(50) DEFAULT 'custom'::character varying NOT NULL,
    closure_reason text,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_pattern jsonb,
    affects_existing_bookings boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT operating_closures_closure_scope_check CHECK (((closure_scope)::text = ANY ((ARRAY['location'::character varying, 'resource'::character varying, 'resource_type'::character varying])::text[]))),
    CONSTRAINT operating_closures_date_check CHECK ((closure_end_date >= closure_start_date)),
    CONSTRAINT operating_closures_scope_check CHECK (((((closure_scope)::text = 'location'::text) AND (location_id IS NOT NULL) AND (location_resource_id IS NULL) AND (resource_type IS NULL)) OR (((closure_scope)::text = 'resource'::text) AND (location_resource_id IS NOT NULL) AND (location_id IS NULL) AND (resource_type IS NULL)) OR (((closure_scope)::text = 'resource_type'::text) AND (resource_type IS NOT NULL) AND (location_id IS NOT NULL) AND (location_resource_id IS NULL)))),
    CONSTRAINT operating_closures_type_check CHECK (((closure_type)::text = ANY ((ARRAY['holiday'::character varying, 'maintenance'::character varying, 'special_event'::character varying, 'custom'::character varying, 'emergency'::character varying])::text[])))
);


ALTER TABLE public.operating_closures OWNER TO postgres;

--
-- Name: TABLE operating_closures; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.operating_closures IS 'Exception closures (holidays, maintenance, etc.) that override regular schedules';


--
-- Name: operating_closures_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.operating_closures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.operating_closures_id_seq OWNER TO postgres;

--
-- Name: operating_closures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.operating_closures_id_seq OWNED BY public.operating_closures.id;


--
-- Name: operating_closures id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures ALTER COLUMN id SET DEFAULT nextval('public.operating_closures_id_seq'::regclass);


--
-- Name: operating_closures operating_closures_closure_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures
    ADD CONSTRAINT operating_closures_closure_uuid_key UNIQUE (closure_uuid);


--
-- Name: operating_closures operating_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures
    ADD CONSTRAINT operating_closures_pkey PRIMARY KEY (id);


--
-- Name: idx_operating_closures_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_operating_closures_dates ON public.operating_closures USING btree (closure_start_date, closure_end_date);


--
-- Name: idx_operating_closures_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_operating_closures_location ON public.operating_closures USING btree (location_id);


--
-- Name: idx_operating_closures_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_operating_closures_partner ON public.operating_closures USING btree (partner_uuid);


--
-- Name: idx_operating_closures_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_operating_closures_resource ON public.operating_closures USING btree (location_resource_id);


--
-- Name: idx_operating_closures_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_operating_closures_scope ON public.operating_closures USING btree (closure_scope);


--
-- Name: operating_closures operating_closures_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures
    ADD CONSTRAINT operating_closures_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: operating_closures operating_closures_location_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures
    ADD CONSTRAINT operating_closures_location_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: operating_closures operating_closures_partner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures
    ADD CONSTRAINT operating_closures_partner_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: operating_closures operating_closures_resource_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures
    ADD CONSTRAINT operating_closures_resource_fkey FOREIGN KEY (location_resource_id) REFERENCES public.location_resources(id) ON DELETE CASCADE;


--
-- Name: operating_closures operating_closures_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operating_closures
    ADD CONSTRAINT operating_closures_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: operating_closures Partners can delete their closures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can delete their closures" ON public.operating_closures FOR DELETE USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: operating_closures Partners can insert their closures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can insert their closures" ON public.operating_closures FOR INSERT WITH CHECK ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: operating_closures Partners can update their closures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can update their closures" ON public.operating_closures FOR UPDATE USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: operating_closures Partners can view their closures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can view their closures" ON public.operating_closures FOR SELECT USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: operating_closures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.operating_closures ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE operating_closures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.operating_closures TO anon;
GRANT ALL ON TABLE public.operating_closures TO authenticated;
GRANT ALL ON TABLE public.operating_closures TO service_role;


--
-- Name: SEQUENCE operating_closures_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.operating_closures_id_seq TO anon;
GRANT ALL ON SEQUENCE public.operating_closures_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.operating_closures_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict FxlX0Kf8gy67YymhdcyrngkqRY9umkGTaEg9tHRGFuzJNXTvpP456HRbSTSZjBr

