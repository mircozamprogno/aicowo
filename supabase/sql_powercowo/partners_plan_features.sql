--
-- PostgreSQL database dump
--

\restrict q3FHyhfgwbAtQvEO1JcymRY6lE1PJDvO5v1Tlfa5VjYI99fHe7QiwNrfg5FyHxq

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
-- Name: partners_plan_features; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_plan_features (
    id bigint NOT NULL,
    feature_name character varying(100) NOT NULL,
    feature_key character varying(100) NOT NULL,
    feature_description text,
    feature_type character varying(20) NOT NULL,
    default_value text,
    feature_category character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    CONSTRAINT chk_default_value CHECK (((((feature_type)::text = 'boolean'::text) AND (default_value = 'false'::text)) OR (((feature_type)::text = 'numeric'::text) AND (default_value = '0'::text)) OR (((feature_type)::text = 'text'::text) AND (default_value IS NULL)))),
    CONSTRAINT chk_feature_type CHECK (((feature_type)::text = ANY (ARRAY[('boolean'::character varying)::text, ('numeric'::character varying)::text, ('text'::character varying)::text])))
);


ALTER TABLE public.partners_plan_features OWNER TO postgres;

--
-- Name: partners_plan_features_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_plan_features_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_plan_features_id_seq OWNER TO postgres;

--
-- Name: partners_plan_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_plan_features_id_seq OWNED BY public.partners_plan_features.id;


--
-- Name: partners_plan_features id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_features ALTER COLUMN id SET DEFAULT nextval('public.partners_plan_features_id_seq'::regclass);


--
-- Name: partners_plan_features partners_plan_features_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_features
    ADD CONSTRAINT partners_plan_features_feature_key_key UNIQUE (feature_key);


--
-- Name: partners_plan_features partners_plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_features
    ADD CONSTRAINT partners_plan_features_pkey PRIMARY KEY (id);


--
-- Name: idx_partners_plan_features_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_plan_features_active ON public.partners_plan_features USING btree (is_active);


--
-- Name: idx_partners_plan_features_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_plan_features_category ON public.partners_plan_features USING btree (feature_category);


--
-- Name: idx_partners_plan_features_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_plan_features_key ON public.partners_plan_features USING btree (feature_key);


--
-- Name: idx_partners_plan_features_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_plan_features_order ON public.partners_plan_features USING btree (display_order);


--
-- Name: idx_partners_plan_features_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_plan_features_type ON public.partners_plan_features USING btree (feature_type);


--
-- Name: partners_plan_features update_partners_plan_features_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_partners_plan_features_updated_at BEFORE UPDATE ON public.partners_plan_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners_plan_features partners_plan_features_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_plan_features
    ADD CONSTRAINT partners_plan_features_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);


--
-- Name: partners_plan_features Everyone views active features; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone views active features" ON public.partners_plan_features FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: partners_plan_features Superadmins manage features; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage features" ON public.partners_plan_features TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: partners_plan_features; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_plan_features ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_plan_features; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_plan_features TO anon;
GRANT ALL ON TABLE public.partners_plan_features TO authenticated;
GRANT ALL ON TABLE public.partners_plan_features TO service_role;


--
-- Name: SEQUENCE partners_plan_features_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_plan_features_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_plan_features_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_plan_features_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict q3FHyhfgwbAtQvEO1JcymRY6lE1PJDvO5v1Tlfa5VjYI99fHe7QiwNrfg5FyHxq

