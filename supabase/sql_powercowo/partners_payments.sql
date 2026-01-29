--
-- PostgreSQL database dump
--

\restrict 9va55OjSgSXGbSQYyZ1gC5RvU1E9Xlw6a3FIpWJGCD5ZQzH4n7WXyoz56wdHvka

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
-- Name: partners_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_payments (
    id bigint NOT NULL,
    payment_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    payment_period_start date NOT NULL,
    payment_period_end date NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    payment_method character varying(50),
    payment_date timestamp with time zone,
    due_date date NOT NULL,
    transaction_reference character varying(255),
    invoice_number character varying(50),
    invoice_url text,
    payment_notes text,
    late_fee numeric(10,2) DEFAULT 0,
    is_overdue boolean DEFAULT false NOT NULL,
    overdue_days integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    notes text,
    active_users_count integer,
    plan_active_users_limit integer,
    is_over_limit boolean DEFAULT false NOT NULL,
    billing_details jsonb,
    CONSTRAINT chk_active_users_count CHECK ((active_users_count >= 0)),
    CONSTRAINT chk_amount CHECK ((amount >= (0)::numeric)),
    CONSTRAINT chk_late_fee CHECK ((late_fee >= (0)::numeric)),
    CONSTRAINT chk_overdue_days CHECK ((overdue_days >= 0)),
    CONSTRAINT chk_payment_period CHECK ((payment_period_end >= payment_period_start)),
    CONSTRAINT chk_payment_status CHECK (((payment_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('paid'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text, ('refunded'::character varying)::text, ('partial'::character varying)::text])))
);


ALTER TABLE public.partners_payments OWNER TO postgres;

--
-- Name: COLUMN partners_payments.active_users_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.partners_payments.active_users_count IS 'Snapshot of active users count at billing time';


--
-- Name: COLUMN partners_payments.plan_active_users_limit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.partners_payments.plan_active_users_limit IS 'Snapshot of plan limit at billing time';


--
-- Name: COLUMN partners_payments.is_over_limit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.partners_payments.is_over_limit IS 'Flag indicating if partner exceeded plan limit';


--
-- Name: COLUMN partners_payments.billing_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.partners_payments.billing_details IS 'Additional billing metadata: growth %, previous count, etc.';


--
-- Name: partners_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_payments_id_seq OWNER TO postgres;

--
-- Name: partners_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_payments_id_seq OWNED BY public.partners_payments.id;


--
-- Name: partners_payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_payments ALTER COLUMN id SET DEFAULT nextval('public.partners_payments_id_seq'::regclass);


--
-- Name: partners_payments partners_payments_payment_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_payments
    ADD CONSTRAINT partners_payments_payment_uuid_key UNIQUE (payment_uuid);


--
-- Name: partners_payments partners_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_payments
    ADD CONSTRAINT partners_payments_pkey PRIMARY KEY (id);


--
-- Name: idx_partners_payments_contract_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_contract_id ON public.partners_payments USING btree (contract_id);


--
-- Name: idx_partners_payments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_created_at ON public.partners_payments USING btree (created_at);


--
-- Name: idx_partners_payments_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_due_date ON public.partners_payments USING btree (due_date);


--
-- Name: idx_partners_payments_overdue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_overdue ON public.partners_payments USING btree (is_overdue);


--
-- Name: idx_partners_payments_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_partner_uuid ON public.partners_payments USING btree (partner_uuid);


--
-- Name: idx_partners_payments_payment_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_payment_date ON public.partners_payments USING btree (payment_date);


--
-- Name: idx_partners_payments_period_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_period_start ON public.partners_payments USING btree (payment_period_start);


--
-- Name: idx_partners_payments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_payments_status ON public.partners_payments USING btree (payment_status);


--
-- Name: idx_payments_over_limit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_over_limit ON public.partners_payments USING btree (partner_uuid, is_over_limit) WHERE (is_over_limit = true);


--
-- Name: partners_payments update_partners_payments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_partners_payments_updated_at BEFORE UPDATE ON public.partners_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners_payments partners_payments_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_payments
    ADD CONSTRAINT partners_payments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.partners_contracts(id) ON DELETE CASCADE;


--
-- Name: partners_payments partners_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_payments
    ADD CONSTRAINT partners_payments_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);


--
-- Name: partners_payments partners_payments_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_payments
    ADD CONSTRAINT partners_payments_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE RESTRICT;


--
-- Name: partners_payments Partners view own payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners view own payments" ON public.partners_payments FOR SELECT TO authenticated USING ((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: partners_payments Superadmins manage all partner payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage all partner payments" ON public.partners_payments TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: partners_payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_payments TO anon;
GRANT ALL ON TABLE public.partners_payments TO authenticated;
GRANT ALL ON TABLE public.partners_payments TO service_role;


--
-- Name: SEQUENCE partners_payments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_payments_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 9va55OjSgSXGbSQYyZ1gC5RvU1E9Xlw6a3FIpWJGCD5ZQzH4n7WXyoz56wdHvka

