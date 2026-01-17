--
-- PostgreSQL database dump
--

\restrict OAF0h6TXIymAGuohiQB6c7w1c4zxuCJ3XvzW7r0TYaJ80Ef3EIscG5kcGaNaTef

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
-- Name: resource_operating_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource_operating_schedules (
    id bigint NOT NULL,
    location_resource_id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    day_of_week integer NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    open_time time without time zone,
    close_time time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT resource_operating_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT resource_operating_schedules_time_check CHECK (((is_closed = true) OR ((open_time IS NOT NULL) AND (close_time IS NOT NULL)))),
    CONSTRAINT resource_operating_schedules_time_order_check CHECK (((is_closed = true) OR (open_time < close_time)))
);


ALTER TABLE public.resource_operating_schedules OWNER TO postgres;

--
-- Name: TABLE resource_operating_schedules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.resource_operating_schedules IS 'Optional overrides for specific resources operating hours';


--
-- Name: resource_operating_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.resource_operating_schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resource_operating_schedules_id_seq OWNER TO postgres;

--
-- Name: resource_operating_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resource_operating_schedules_id_seq OWNED BY public.resource_operating_schedules.id;


--
-- Name: resource_operating_schedules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_operating_schedules ALTER COLUMN id SET DEFAULT nextval('public.resource_operating_schedules_id_seq'::regclass);


--
-- Name: resource_operating_schedules resource_operating_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_operating_schedules
    ADD CONSTRAINT resource_operating_schedules_pkey PRIMARY KEY (id);


--
-- Name: resource_operating_schedules resource_operating_schedules_unique_day; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_operating_schedules
    ADD CONSTRAINT resource_operating_schedules_unique_day UNIQUE (location_resource_id, day_of_week);


--
-- Name: idx_resource_operating_schedules_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resource_operating_schedules_partner ON public.resource_operating_schedules USING btree (partner_uuid);


--
-- Name: idx_resource_operating_schedules_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resource_operating_schedules_resource ON public.resource_operating_schedules USING btree (location_resource_id);


--
-- Name: resource_operating_schedules resource_operating_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_operating_schedules
    ADD CONSTRAINT resource_operating_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: resource_operating_schedules resource_operating_schedules_partner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_operating_schedules
    ADD CONSTRAINT resource_operating_schedules_partner_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: resource_operating_schedules resource_operating_schedules_resource_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_operating_schedules
    ADD CONSTRAINT resource_operating_schedules_resource_fkey FOREIGN KEY (location_resource_id) REFERENCES public.location_resources(id) ON DELETE CASCADE;


--
-- Name: resource_operating_schedules resource_operating_schedules_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource_operating_schedules
    ADD CONSTRAINT resource_operating_schedules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: resource_operating_schedules Partners can delete their resource schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can delete their resource schedules" ON public.resource_operating_schedules FOR DELETE USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: resource_operating_schedules Partners can insert their resource schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can insert their resource schedules" ON public.resource_operating_schedules FOR INSERT WITH CHECK ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: resource_operating_schedules Partners can update their resource schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can update their resource schedules" ON public.resource_operating_schedules FOR UPDATE USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: resource_operating_schedules Partners can view their resource schedules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can view their resource schedules" ON public.resource_operating_schedules FOR SELECT USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: resource_operating_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.resource_operating_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE resource_operating_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.resource_operating_schedules TO anon;
GRANT ALL ON TABLE public.resource_operating_schedules TO authenticated;
GRANT ALL ON TABLE public.resource_operating_schedules TO service_role;


--
-- Name: SEQUENCE resource_operating_schedules_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.resource_operating_schedules_id_seq TO anon;
GRANT ALL ON SEQUENCE public.resource_operating_schedules_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.resource_operating_schedules_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict OAF0h6TXIymAGuohiQB6c7w1c4zxuCJ3XvzW7r0TYaJ80Ef3EIscG5kcGaNaTef

