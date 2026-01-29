--
-- PostgreSQL database dump
--

\restrict qHEexTbkYJTbTgSrrTw6DKEbscsA9TkvUYoTc17zv3Ph8kst8SgfDeze7dgIkHW

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
-- Name: partners_pricing_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_pricing_plans (
    id bigint NOT NULL,
    plan_name character varying(100) NOT NULL,
    plan_description text,
    monthly_price numeric(10,2) NOT NULL,
    yearly_price numeric(10,2) NOT NULL,
    plan_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    is_trial boolean DEFAULT false NOT NULL,
    trial_duration_days integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    CONSTRAINT chk_currency CHECK (((currency)::text = ANY (ARRAY[('EUR'::character varying)::text, ('USD'::character varying)::text, ('GBP'::character varying)::text, ('CHF'::character varying)::text, ('CAD'::character varying)::text, ('AUD'::character varying)::text, ('JPY'::character varying)::text]))),
    CONSTRAINT chk_monthly_price CHECK ((monthly_price >= (0)::numeric)),
    CONSTRAINT chk_plan_status CHECK (((plan_status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('archived'::character varying)::text]))),
    CONSTRAINT chk_trial_duration CHECK (((is_trial = false) OR ((is_trial = true) AND (trial_duration_days > 0)))),
    CONSTRAINT chk_yearly_price CHECK ((yearly_price >= (0)::numeric))
);


ALTER TABLE public.partners_pricing_plans OWNER TO postgres;

--
-- Name: partners_pricing_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_pricing_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_pricing_plans_id_seq OWNER TO postgres;

--
-- Name: partners_pricing_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_pricing_plans_id_seq OWNED BY public.partners_pricing_plans.id;


--
-- Name: partners_pricing_plans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_pricing_plans ALTER COLUMN id SET DEFAULT nextval('public.partners_pricing_plans_id_seq'::regclass);


--
-- Name: partners_pricing_plans partners_pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_pricing_plans
    ADD CONSTRAINT partners_pricing_plans_pkey PRIMARY KEY (id);


--
-- Name: partners_pricing_plans partners_pricing_plans_plan_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_pricing_plans
    ADD CONSTRAINT partners_pricing_plans_plan_name_key UNIQUE (plan_name);


--
-- Name: idx_partners_pricing_plans_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_pricing_plans_created_at ON public.partners_pricing_plans USING btree (created_at);


--
-- Name: idx_partners_pricing_plans_currency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_pricing_plans_currency ON public.partners_pricing_plans USING btree (currency);


--
-- Name: idx_partners_pricing_plans_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_pricing_plans_name ON public.partners_pricing_plans USING btree (plan_name);


--
-- Name: idx_partners_pricing_plans_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_pricing_plans_status ON public.partners_pricing_plans USING btree (plan_status);


--
-- Name: partners_pricing_plans update_partners_pricing_plans_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_partners_pricing_plans_updated_at BEFORE UPDATE ON public.partners_pricing_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners_pricing_plans partners_pricing_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_pricing_plans
    ADD CONSTRAINT partners_pricing_plans_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);


--
-- Name: partners_pricing_plans Everyone views active plans; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone views active plans" ON public.partners_pricing_plans FOR SELECT TO authenticated USING (((plan_status)::text = 'active'::text));


--
-- Name: partners_pricing_plans Superadmins manage plans; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage plans" ON public.partners_pricing_plans TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: partners_pricing_plans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_pricing_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_pricing_plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_pricing_plans TO anon;
GRANT ALL ON TABLE public.partners_pricing_plans TO authenticated;
GRANT ALL ON TABLE public.partners_pricing_plans TO service_role;


--
-- Name: SEQUENCE partners_pricing_plans_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_pricing_plans_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_pricing_plans_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_pricing_plans_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict qHEexTbkYJTbTgSrrTw6DKEbscsA9TkvUYoTc17zv3Ph8kst8SgfDeze7dgIkHW

