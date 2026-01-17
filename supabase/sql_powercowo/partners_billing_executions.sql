--
-- PostgreSQL database dump
--

\restrict TFDMkpJw49Np0aUNH0bcqRn5LTAwwxLSpt2gElAcppVa3O2auz13mzH6aulc9LG

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
-- Name: partners_billing_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_billing_executions (
    id bigint NOT NULL,
    execution_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    billing_month character varying(7) NOT NULL,
    execution_type character varying(20) NOT NULL,
    triggered_by_user_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    total_partners integer,
    success_count integer,
    error_count integer,
    skipped_count integer,
    execution_details jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_execution_type CHECK (((execution_type)::text = ANY ((ARRAY['scheduled'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT chk_status CHECK (((status)::text = ANY ((ARRAY['running'::character varying, 'completed'::character varying, 'failed'::character varying, 'partial'::character varying])::text[])))
);


ALTER TABLE public.partners_billing_executions OWNER TO postgres;

--
-- Name: TABLE partners_billing_executions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.partners_billing_executions IS 'Audit log of all billing execution runs (scheduled and manual)';


--
-- Name: partners_billing_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_billing_executions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_billing_executions_id_seq OWNER TO postgres;

--
-- Name: partners_billing_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_billing_executions_id_seq OWNED BY public.partners_billing_executions.id;


--
-- Name: partners_billing_executions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_billing_executions ALTER COLUMN id SET DEFAULT nextval('public.partners_billing_executions_id_seq'::regclass);


--
-- Name: partners_billing_executions partners_billing_executions_execution_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_billing_executions
    ADD CONSTRAINT partners_billing_executions_execution_uuid_key UNIQUE (execution_uuid);


--
-- Name: partners_billing_executions partners_billing_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_billing_executions
    ADD CONSTRAINT partners_billing_executions_pkey PRIMARY KEY (id);


--
-- Name: idx_billing_executions_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_billing_executions_month ON public.partners_billing_executions USING btree (billing_month);


--
-- Name: idx_billing_executions_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_billing_executions_started ON public.partners_billing_executions USING btree (started_at DESC);


--
-- Name: idx_billing_executions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_billing_executions_status ON public.partners_billing_executions USING btree (status);


--
-- Name: partners_billing_executions partners_billing_executions_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_billing_executions
    ADD CONSTRAINT partners_billing_executions_triggered_by_fkey FOREIGN KEY (triggered_by_user_id) REFERENCES auth.users(id);


--
-- Name: partners_billing_executions Superadmins manage billing executions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage billing executions" ON public.partners_billing_executions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: partners_billing_executions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_billing_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_billing_executions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_billing_executions TO anon;
GRANT ALL ON TABLE public.partners_billing_executions TO authenticated;
GRANT ALL ON TABLE public.partners_billing_executions TO service_role;


--
-- Name: SEQUENCE partners_billing_executions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_billing_executions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_billing_executions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_billing_executions_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict TFDMkpJw49Np0aUNH0bcqRn5LTAwwxLSpt2gElAcppVa3O2auz13mzH6aulc9LG

