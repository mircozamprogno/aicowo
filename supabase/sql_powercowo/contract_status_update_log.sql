--
-- PostgreSQL database dump
--

\restrict VTzVZwZnscMRLSKwLyb4vmiEcDOguJuZkDrsILG2E4mrQStSGJIe66j1QDGmyj0

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
-- Name: contract_status_update_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_status_update_log (
    id bigint NOT NULL,
    updated_count integer DEFAULT 0 NOT NULL,
    execution_time timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contract_status_update_log OWNER TO postgres;

--
-- Name: TABLE contract_status_update_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contract_status_update_log IS 'Logs automated contract status updates for monitoring and debugging';


--
-- Name: contract_status_update_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_status_update_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_status_update_log_id_seq OWNER TO postgres;

--
-- Name: contract_status_update_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_status_update_log_id_seq OWNED BY public.contract_status_update_log.id;


--
-- Name: contract_status_update_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_status_update_log ALTER COLUMN id SET DEFAULT nextval('public.contract_status_update_log_id_seq'::regclass);


--
-- Name: contract_status_update_log contract_status_update_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_status_update_log
    ADD CONSTRAINT contract_status_update_log_pkey PRIMARY KEY (id);


--
-- Name: idx_contract_status_log_execution_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_status_log_execution_time ON public.contract_status_update_log USING btree (execution_time DESC);


--
-- Name: contract_status_update_log Superadmins view status logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins view status logs" ON public.contract_status_update_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: contract_status_update_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_status_update_log ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE contract_status_update_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contract_status_update_log TO anon;
GRANT ALL ON TABLE public.contract_status_update_log TO authenticated;
GRANT ALL ON TABLE public.contract_status_update_log TO service_role;


--
-- Name: SEQUENCE contract_status_update_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.contract_status_update_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contract_status_update_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contract_status_update_log_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict VTzVZwZnscMRLSKwLyb4vmiEcDOguJuZkDrsILG2E4mrQStSGJIe66j1QDGmyj0

