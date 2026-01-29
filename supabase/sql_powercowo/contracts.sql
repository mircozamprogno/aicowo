--
-- PostgreSQL database dump
--

\restrict HXtfLFBFuELF9fzRsyabIENCcno0DJyBzTGMjGKq616PaBwsbjCQ2Qtu30wc90y

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
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id bigint NOT NULL,
    contract_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id bigint NOT NULL,
    service_id bigint NOT NULL,
    location_id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    contract_number character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    service_name character varying(255) NOT NULL,
    service_type character varying(50) NOT NULL,
    service_cost numeric(10,2) NOT NULL,
    service_currency character varying(3) DEFAULT 'EUR'::character varying,
    service_duration_days numeric(10,2) NOT NULL,
    service_max_entries numeric(10,1),
    location_name character varying(255) NOT NULL,
    resource_name character varying(255) NOT NULL,
    resource_type character varying(50) NOT NULL,
    contract_status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    entries_used numeric(10,1) DEFAULT 0,
    last_entry_date date,
    is_renewable boolean DEFAULT false,
    auto_renew boolean DEFAULT false,
    renewal_count integer DEFAULT 0,
    created_by_user_id uuid,
    created_by_role character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cancelled_at timestamp with time zone,
    cancelled_by_user_id uuid,
    cancellation_reason text,
    notes text,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archived_by_user_id uuid,
    archive_reason text,
    payment_terms character varying(20) DEFAULT 'net_30'::character varying,
    requires_payment boolean DEFAULT true,
    discount_code character varying(50),
    discount_type character varying(20),
    discount_value numeric(10,2),
    original_price numeric(10,2),
    discount_amount numeric(10,2),
    final_price numeric(10,2),
    CONSTRAINT chk_contract_dates CHECK ((end_date >= start_date)),
    CONSTRAINT chk_contract_status CHECK (((contract_status)::text = ANY (ARRAY[('active'::character varying)::text, ('expired'::character varying)::text, ('cancelled'::character varying)::text, ('suspended'::character varying)::text]))),
    CONSTRAINT chk_entries_used CHECK ((entries_used >= (0)::numeric)),
    CONSTRAINT chk_service_type CHECK (((service_type)::text = ANY (ARRAY[('abbonamento'::character varying)::text, ('pacchetto'::character varying)::text, ('free_trial'::character varying)::text, ('giornaliero'::character varying)::text])))
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: COLUMN contracts.discount_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.discount_code IS 'Discount code applied to this contract';


--
-- Name: COLUMN contracts.discount_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.discount_type IS 'Type of discount: percentage or fixed_amount';


--
-- Name: COLUMN contracts.discount_value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.discount_value IS 'Value of discount (percentage or fixed amount)';


--
-- Name: COLUMN contracts.original_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.original_price IS 'Original service price before discount';


--
-- Name: COLUMN contracts.discount_amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.discount_amount IS 'Actual discount amount applied';


--
-- Name: COLUMN contracts.final_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.final_price IS 'Final price after discount';


--
-- Name: contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contracts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contracts_id_seq OWNER TO postgres;

--
-- Name: contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contracts_id_seq OWNED BY public.contracts.id;


--
-- Name: contracts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts ALTER COLUMN id SET DEFAULT nextval('public.contracts_id_seq'::regclass);


--
-- Name: contracts contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: contracts contracts_contract_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_uuid_key UNIQUE (contract_uuid);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: idx_contracts_archived_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_archived_at ON public.contracts USING btree (archived_at);


--
-- Name: idx_contracts_contract_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_contract_number ON public.contracts USING btree (contract_number);


--
-- Name: idx_contracts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_created_at ON public.contracts USING btree (created_at);


--
-- Name: idx_contracts_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_customer_id ON public.contracts USING btree (customer_id);


--
-- Name: idx_contracts_discount_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_discount_code ON public.contracts USING btree (discount_code);


--
-- Name: idx_contracts_end_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_end_date ON public.contracts USING btree (end_date);


--
-- Name: idx_contracts_is_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_is_archived ON public.contracts USING btree (is_archived);


--
-- Name: idx_contracts_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_location_id ON public.contracts USING btree (location_id);


--
-- Name: idx_contracts_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_partner_uuid ON public.contracts USING btree (partner_uuid);


--
-- Name: idx_contracts_payment_terms; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_payment_terms ON public.contracts USING btree (payment_terms);


--
-- Name: idx_contracts_requires_payment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_requires_payment ON public.contracts USING btree (requires_payment);


--
-- Name: idx_contracts_service_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_service_id ON public.contracts USING btree (service_id);


--
-- Name: idx_contracts_start_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_start_date ON public.contracts USING btree (start_date);


--
-- Name: idx_contracts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_status ON public.contracts USING btree (contract_status);


--
-- Name: contracts contracts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_contracts_updated_at();


--
-- Name: contracts contracts_archived_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_archived_by_user_id_fkey FOREIGN KEY (archived_by_user_id) REFERENCES auth.users(id);


--
-- Name: contracts contracts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: contracts contracts_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- Name: contracts Customers can insert own contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can insert own contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: contracts Customers can update own contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can update own contracts" ON public.contracts FOR UPDATE TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid())))) WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: contracts Customers view own contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers view own contracts" ON public.contracts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.customers
  WHERE ((customers.id = contracts.customer_id) AND (customers.user_id = auth.uid())))));


--
-- Name: contracts Partner admins can insert contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (((public.is_admin() OR public.is_superadmin()) AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts partner_admin_own_contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY partner_admin_own_contracts ON public.contracts TO authenticated USING ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: contracts superadmin_all_contracts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY superadmin_all_contracts ON public.contracts TO authenticated USING (public.is_superadmin());


--
-- Name: TABLE contracts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contracts TO anon;
GRANT ALL ON TABLE public.contracts TO authenticated;
GRANT ALL ON TABLE public.contracts TO service_role;


--
-- Name: SEQUENCE contracts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.contracts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contracts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contracts_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict HXtfLFBFuELF9fzRsyabIENCcno0DJyBzTGMjGKq616PaBwsbjCQ2Qtu30wc90y

