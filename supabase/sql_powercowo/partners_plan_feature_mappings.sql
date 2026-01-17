--
-- PostgreSQL database dump
--

\restrict hn8pOStjGqGVc4qOgC0v7K3lFcSM6S1ibhlyNzQMN7MLRbmu4TwPqOOno8CQWBw

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
-- Name: partners_plan_feature_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_plan_feature_mappings (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    feature_id bigint NOT NULL,
    feature_value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.partners_plan_feature_mappings OWNER TO postgres;

--
-- Name: partners_plan_feature_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_plan_feature_mappings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_plan_feature_mappings_id_seq OWNER TO postgres;

--
-- Name: partners_plan_feature_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_plan_feature_mappings_id_seq OWNED BY public.partners_plan_feature_mappings.id;


--
-- Name: partners_plan_feature_mappings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_feature_mappings ALTER COLUMN id SET DEFAULT nextval('public.partners_plan_feature_mappings_id_seq'::regclass);


--
-- Name: partners_plan_feature_mappings partners_plan_feature_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_feature_mappings
    ADD CONSTRAINT partners_plan_feature_mappings_pkey PRIMARY KEY (id);


--
-- Name: partners_plan_feature_mappings partners_plan_feature_mappings_plan_feature_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_feature_mappings
    ADD CONSTRAINT partners_plan_feature_mappings_plan_feature_unique UNIQUE (plan_id, feature_id);


--
-- Name: idx_partners_plan_feature_mappings_feature_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_plan_feature_mappings_feature_id ON public.partners_plan_feature_mappings USING btree (feature_id);


--
-- Name: idx_partners_plan_feature_mappings_plan_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_plan_feature_mappings_plan_id ON public.partners_plan_feature_mappings USING btree (plan_id);


--
-- Name: partners_plan_feature_mappings update_partners_plan_feature_mappings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_partners_plan_feature_mappings_updated_at BEFORE UPDATE ON public.partners_plan_feature_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners_plan_feature_mappings partners_plan_feature_mappings_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_feature_mappings
    ADD CONSTRAINT partners_plan_feature_mappings_feature_id_fkey FOREIGN KEY (feature_id) REFERENCES public.partners_plan_features(id) ON DELETE CASCADE;


--
-- Name: partners_plan_feature_mappings partners_plan_feature_mappings_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_feature_mappings
    ADD CONSTRAINT partners_plan_feature_mappings_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.partners_pricing_plans(id) ON DELETE CASCADE;


--
-- Name: partners_plan_feature_mappings Authenticated users view feature mappings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users view feature mappings" ON public.partners_plan_feature_mappings FOR SELECT TO authenticated USING (true);


--
-- Name: partners_plan_feature_mappings Superadmins manage feature mappings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage feature mappings" ON public.partners_plan_feature_mappings TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: partners_plan_feature_mappings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_plan_feature_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_plan_feature_mappings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_plan_feature_mappings TO anon;
GRANT ALL ON TABLE public.partners_plan_feature_mappings TO authenticated;
GRANT ALL ON TABLE public.partners_plan_feature_mappings TO service_role;


--
-- Name: SEQUENCE partners_plan_feature_mappings_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_plan_feature_mappings_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_plan_feature_mappings_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_plan_feature_mappings_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict hn8pOStjGqGVc4qOgC0v7K3lFcSM6S1ibhlyNzQMN7MLRbmu4TwPqOOno8CQWBw

