--
-- PostgreSQL database dump
--

\restrict HXczZ19gnmooCW6NV2dzYtAvGBcpQ6Lvq9hQTIhJmb0D7IMuovaTYW5ri5ZhjbU

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
-- Name: partners_contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_contracts (
    id bigint NOT NULL,
    contract_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_uuid uuid NOT NULL,
    plan_id bigint NOT NULL,
    discount_code_id bigint,
    contract_number character varying(50) NOT NULL,
    billing_frequency character varying(20) NOT NULL,
    contract_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date,
    base_price numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0,
    final_price numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    auto_renew boolean DEFAULT false NOT NULL,
    renewal_count integer DEFAULT 0 NOT NULL,
    contract_terms text,
    notes text,
    signed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    CONSTRAINT chk_base_price CHECK ((base_price >= (0)::numeric)),
    CONSTRAINT chk_billing_frequency CHECK (((billing_frequency)::text = ANY (ARRAY[('monthly'::character varying)::text, ('yearly'::character varying)::text]))),
    CONSTRAINT chk_contract_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_contract_status CHECK (((contract_status)::text = ANY (ARRAY[('draft'::character varying)::text, ('active'::character varying)::text, ('expired'::character varying)::text, ('cancelled'::character varying)::text, ('suspended'::character varying)::text]))),
    CONSTRAINT chk_discount_amount CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT chk_final_price CHECK ((final_price >= (0)::numeric)),
    CONSTRAINT chk_renewal_count CHECK ((renewal_count >= 0))
);


ALTER TABLE public.partners_contracts OWNER TO postgres;

--
-- Name: partners_contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_contracts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_contracts_id_seq OWNER TO postgres;

--
-- Name: partners_contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_contracts_id_seq OWNED BY public.partners_contracts.id;


--
-- Name: partners_contracts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts ALTER COLUMN id SET DEFAULT nextval('public.partners_contracts_id_seq'::regclass);


--
-- Name: partners_contracts partners_contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts
    ADD CONSTRAINT partners_contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: partners_contracts partners_contracts_contract_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts
    ADD CONSTRAINT partners_contracts_contract_uuid_key UNIQUE (contract_uuid);


--
-- Name: partners_contracts partners_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts
    ADD CONSTRAINT partners_contracts_pkey PRIMARY KEY (id);


--
-- Name: idx_partners_contracts_billing_frequency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_contracts_billing_frequency ON public.partners_contracts USING btree (billing_frequency);


--
-- Name: idx_partners_contracts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_contracts_created_at ON public.partners_contracts USING btree (created_at);


--
-- Name: idx_partners_contracts_end_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_contracts_end_date ON public.partners_contracts USING btree (end_date);


--
-- Name: idx_partners_contracts_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_contracts_partner_uuid ON public.partners_contracts USING btree (partner_uuid);


--
-- Name: idx_partners_contracts_plan_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_contracts_plan_id ON public.partners_contracts USING btree (plan_id);


--
-- Name: idx_partners_contracts_start_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_contracts_start_date ON public.partners_contracts USING btree (start_date);


--
-- Name: idx_partners_contracts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_contracts_status ON public.partners_contracts USING btree (contract_status);


--
-- Name: partners_contracts update_partners_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_partners_contracts_updated_at BEFORE UPDATE ON public.partners_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners_contracts partners_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts
    ADD CONSTRAINT partners_contracts_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);


--
-- Name: partners_contracts partners_contracts_discount_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts
    ADD CONSTRAINT partners_contracts_discount_code_id_fkey FOREIGN KEY (discount_code_id) REFERENCES public.partners_discount_codes(id) ON DELETE SET NULL;


--
-- Name: partners_contracts partners_contracts_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts
    ADD CONSTRAINT partners_contracts_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE RESTRICT;


--
-- Name: partners_contracts partners_contracts_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_contracts
    ADD CONSTRAINT partners_contracts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.partners_pricing_plans(id) ON DELETE RESTRICT;


--
-- Name: partners_contracts Partners view own contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners view own contracts" ON public.partners_contracts FOR SELECT TO authenticated USING ((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: partners_contracts Superadmins manage all partner contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage all partner contracts" ON public.partners_contracts TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: partners_contracts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_contracts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_contracts TO anon;
GRANT ALL ON TABLE public.partners_contracts TO authenticated;
GRANT ALL ON TABLE public.partners_contracts TO service_role;


--
-- Name: SEQUENCE partners_contracts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_contracts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_contracts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_contracts_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict HXczZ19gnmooCW6NV2dzYtAvGBcpQ6Lvq9hQTIhJmb0D7IMuovaTYW5ri5ZhjbU

