--
-- PostgreSQL database dump
--

\restrict 3wo9QgEPHwaFTvRHI5ENffWoe5hspKIzc4E7lK4R9ezgeKN0pO2ZycAOQTudIa6

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
-- Name: contract_renewal_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_renewal_log (
    id bigint NOT NULL,
    original_contract_id bigint NOT NULL,
    original_contract_number character varying(50) NOT NULL,
    renewal_attempt_date timestamp with time zone DEFAULT now() NOT NULL,
    renewal_status character varying(50) NOT NULL,
    new_contract_id bigint,
    new_contract_number character varying(50),
    error_message text,
    resource_availability_details jsonb,
    partner_uuid uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_renewal_status CHECK (((renewal_status)::text = ANY ((ARRAY['success'::character varying, 'failed_no_availability'::character varying, 'failed_booking_error'::character varying, 'failed_payment_error'::character varying, 'failed_error'::character varying])::text[])))
);


ALTER TABLE public.contract_renewal_log OWNER TO postgres;

--
-- Name: TABLE contract_renewal_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contract_renewal_log IS 'Logs all automatic contract renewal attempts for monitoring and debugging';


--
-- Name: contract_renewal_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_renewal_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_renewal_log_id_seq OWNER TO postgres;

--
-- Name: contract_renewal_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_renewal_log_id_seq OWNED BY public.contract_renewal_log.id;


--
-- Name: contract_renewal_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_renewal_log ALTER COLUMN id SET DEFAULT nextval('public.contract_renewal_log_id_seq'::regclass);


--
-- Name: contract_renewal_log contract_renewal_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_renewal_log
    ADD CONSTRAINT contract_renewal_log_pkey PRIMARY KEY (id);


--
-- Name: idx_renewal_log_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_renewal_log_date ON public.contract_renewal_log USING btree (renewal_attempt_date DESC);


--
-- Name: idx_renewal_log_original_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_renewal_log_original_contract ON public.contract_renewal_log USING btree (original_contract_id);


--
-- Name: idx_renewal_log_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_renewal_log_partner_uuid ON public.contract_renewal_log USING btree (partner_uuid);


--
-- Name: idx_renewal_log_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_renewal_log_status ON public.contract_renewal_log USING btree (renewal_status);


--
-- Name: contract_renewal_log fk_renewal_log_new_contract; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_renewal_log
    ADD CONSTRAINT fk_renewal_log_new_contract FOREIGN KEY (new_contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: contract_renewal_log fk_renewal_log_original_contract; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_renewal_log
    ADD CONSTRAINT fk_renewal_log_original_contract FOREIGN KEY (original_contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_renewal_log fk_renewal_log_partner; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_renewal_log
    ADD CONSTRAINT fk_renewal_log_partner FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: contract_renewal_log View own partner renewals; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View own partner renewals" ON public.contract_renewal_log FOR SELECT TO authenticated USING (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text))))));


--
-- Name: contract_renewal_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_renewal_log ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE contract_renewal_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contract_renewal_log TO anon;
GRANT ALL ON TABLE public.contract_renewal_log TO authenticated;
GRANT ALL ON TABLE public.contract_renewal_log TO service_role;


--
-- Name: SEQUENCE contract_renewal_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.contract_renewal_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contract_renewal_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contract_renewal_log_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 3wo9QgEPHwaFTvRHI5ENffWoe5hspKIzc4E7lK4R9ezgeKN0pO2ZycAOQTudIa6

