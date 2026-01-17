--
-- PostgreSQL database dump
--

\restrict I0aFDle0i8h6XWTrK5Ic3Tz9AeJKMXREvWHlimTQ3ZhEXzJ9xgAMeb2eBTFoD67

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
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    payment_uuid uuid DEFAULT gen_random_uuid(),
    payment_number character varying(50) NOT NULL,
    contract_id bigint,
    partner_uuid uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying,
    payment_method character varying(50) NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_type character varying(20) DEFAULT 'full'::character varying,
    payment_date timestamp without time zone,
    due_date date,
    transaction_reference character varying(100),
    invoice_number character varying(50),
    notes text,
    receipt_url text,
    created_by uuid,
    processed_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    amount_net numeric(10,2),
    amount_vat numeric(10,2),
    amount_gross numeric(10,2),
    vat_percentage numeric(5,2),
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_amount_gross_check CHECK ((amount_gross >= (0)::numeric)),
    CONSTRAINT payments_amount_net_check CHECK ((amount_net >= (0)::numeric)),
    CONSTRAINT payments_amount_vat_check CHECK ((amount_vat >= (0)::numeric)),
    CONSTRAINT payments_payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('cash'::character varying)::text, ('bank_transfer'::character varying)::text, ('paypal'::character varying)::text, ('stripe'::character varying)::text, ('credit_card'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT payments_payment_status_check CHECK (((payment_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('refunded'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT payments_payment_type_check CHECK (((payment_type)::text = ANY (ARRAY[('full'::character varying)::text, ('partial'::character varying)::text, ('installment'::character varying)::text, ('deposit'::character varying)::text]))),
    CONSTRAINT payments_vat_percentage_check CHECK (((vat_percentage >= (0)::numeric) AND (vat_percentage <= (100)::numeric)))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: COLUMN payments.amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.amount IS 'Legacy amount field - use amount_gross for new records';


--
-- Name: COLUMN payments.amount_net; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.amount_net IS 'Net amount (before VAT)';


--
-- Name: COLUMN payments.amount_vat; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.amount_vat IS 'VAT amount calculated';


--
-- Name: COLUMN payments.amount_gross; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.amount_gross IS 'Total amount including VAT';


--
-- Name: COLUMN payments.vat_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.vat_percentage IS 'VAT percentage applied at time of payment';


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_payment_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_uuid_key UNIQUE (payment_uuid);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: idx_payments_contract_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_contract_id ON public.payments USING btree (contract_id);


--
-- Name: idx_payments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_date ON public.payments USING btree (payment_date);


--
-- Name: idx_payments_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_due_date ON public.payments USING btree (due_date);


--
-- Name: idx_payments_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_partner_uuid ON public.payments USING btree (partner_uuid);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_status ON public.payments USING btree (payment_status);


--
-- Name: payments trigger_set_payment_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_set_payment_number BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_payment_number();


--
-- Name: payments payments_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: payments Partner admins manage own payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins manage own payments" ON public.payments TO authenticated USING ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: payments Partner admins view own payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins view own payments" ON public.payments FOR SELECT TO authenticated USING ((partner_uuid = public.get_my_partner_uuid()));


--
-- Name: payments Superadmins view all payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins view all payments" ON public.payments FOR SELECT TO authenticated USING (public.is_superadmin());


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: SEQUENCE payments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payments_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict I0aFDle0i8h6XWTrK5Ic3Tz9AeJKMXREvWHlimTQ3ZhEXzJ9xgAMeb2eBTFoD67

