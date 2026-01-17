--
-- PostgreSQL database dump
--

\restrict N271HVuxb1ILAnV9SIaDDfc02ZnhoteE4mPAyWNkRzFvDcVtUnmr5mOtRcORx3d

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
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_plans (
    id bigint NOT NULL,
    contract_id bigint,
    plan_type character varying(20) DEFAULT 'single'::character varying,
    total_amount numeric(10,2) NOT NULL,
    installment_count integer DEFAULT 1,
    installment_amount numeric(10,2),
    frequency character varying(20),
    start_date date NOT NULL,
    end_date date,
    next_payment_date date,
    status character varying(20) DEFAULT 'active'::character varying,
    payment_terms character varying(20) DEFAULT 'net_30'::character varying,
    late_fee_percentage numeric(5,2) DEFAULT 0.00,
    grace_period_days integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT payment_plans_frequency_check CHECK (((frequency)::text = ANY (ARRAY[('monthly'::character varying)::text, ('quarterly'::character varying)::text, ('semi_annually'::character varying)::text, ('annually'::character varying)::text]))),
    CONSTRAINT payment_plans_payment_terms_check CHECK (((payment_terms)::text = ANY (ARRAY[('net_7'::character varying)::text, ('net_15'::character varying)::text, ('net_30'::character varying)::text, ('net_45'::character varying)::text, ('net_60'::character varying)::text, ('immediate'::character varying)::text]))),
    CONSTRAINT payment_plans_plan_type_check CHECK (((plan_type)::text = ANY (ARRAY[('single'::character varying)::text, ('installments'::character varying)::text, ('recurring'::character varying)::text]))),
    CONSTRAINT payment_plans_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('paused'::character varying)::text])))
);


ALTER TABLE public.payment_plans OWNER TO postgres;

--
-- Name: payment_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_plans_id_seq OWNER TO postgres;

--
-- Name: payment_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_plans_id_seq OWNED BY public.payment_plans.id;


--
-- Name: payment_plans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans ALTER COLUMN id SET DEFAULT nextval('public.payment_plans_id_seq'::regclass);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: idx_payment_plans_contract_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_plans_contract_id ON public.payment_plans USING btree (contract_id);


--
-- Name: idx_payment_plans_next_payment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_plans_next_payment ON public.payment_plans USING btree (next_payment_date);


--
-- Name: idx_payment_plans_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_plans_status ON public.payment_plans USING btree (status);


--
-- Name: payment_plans payment_plans_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: payment_plans Manage via partner ownership; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Manage via partner ownership" ON public.payment_plans TO authenticated USING (((contract_id IN ( SELECT c.id
   FROM public.contracts c
  WHERE (c.partner_uuid = ( SELECT profiles.partner_uuid
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))));


--
-- Name: payment_plans View via contract access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View via contract access" ON public.payment_plans FOR SELECT TO authenticated USING (((contract_id IN ( SELECT c.id
   FROM public.contracts c
  WHERE ((c.partner_uuid = ( SELECT profiles.partner_uuid
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (c.customer_id IN ( SELECT customers.id
           FROM public.customers
          WHERE (customers.user_id = auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text))))));


--
-- Name: payment_plans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE payment_plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_plans TO anon;
GRANT ALL ON TABLE public.payment_plans TO authenticated;
GRANT ALL ON TABLE public.payment_plans TO service_role;


--
-- Name: SEQUENCE payment_plans_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payment_plans_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payment_plans_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_plans_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict N271HVuxb1ILAnV9SIaDDfc02ZnhoteE4mPAyWNkRzFvDcVtUnmr5mOtRcORx3d

