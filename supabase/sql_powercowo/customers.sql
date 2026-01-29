--
-- PostgreSQL database dump
--

\restrict SchXPGS3IeAQ45Ra64F0LUdJhuRn74dRnU6jZCL23SwJOa1CW569TFh64Nzu4Da

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
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id bigint NOT NULL,
    customer_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_uuid uuid,
    user_id uuid,
    first_name character varying(255) NOT NULL,
    second_name character varying(255),
    company_name character varying(255),
    email character varying(255) NOT NULL,
    phone character varying(50),
    address text,
    zip character varying(20),
    city character varying(255),
    country character varying(255) DEFAULT 'Italy'::character varying,
    customer_type character varying(50) DEFAULT 'individual'::character varying,
    customer_status character varying(50) DEFAULT 'incomplete_profile'::character varying,
    piva character varying(50),
    codice_fiscale character varying(50),
    pec character varying(255),
    sdi_code character varying(50),
    website character varying(255),
    billing_email character varying(255),
    billing_phone character varying(50),
    billing_address text,
    billing_zip character varying(20),
    billing_city character varying(255),
    billing_country character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fattureincloud_client_id integer
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: customers customers_customer_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_uuid_key UNIQUE (customer_uuid);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers_partner_email_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX customers_partner_email_unique ON public.customers USING btree (partner_uuid, email) WHERE ((email IS NOT NULL) AND ((email)::text <> ''::text));


--
-- Name: customers_partner_fc_client_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX customers_partner_fc_client_unique ON public.customers USING btree (partner_uuid, fattureincloud_client_id) WHERE (fattureincloud_client_id IS NOT NULL);


--
-- Name: idx_customers_customer_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_customer_uuid ON public.customers USING btree (customer_uuid);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_fc_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_fc_client_id ON public.customers USING btree (fattureincloud_client_id);


--
-- Name: idx_customers_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_partner_uuid ON public.customers USING btree (partner_uuid);


--
-- Name: idx_customers_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_user_id ON public.customers USING btree (user_id);


--
-- Name: customers customers_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER customers_updated_at_trigger BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_customers_updated_at();


--
-- Name: customers trigger_log_customer_activity; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_log_customer_activity AFTER INSERT OR UPDATE OF customer_status ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_customer_activity();


--
-- Name: customers customers_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customers Superadmins can view all customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins can view all customers" ON public.customers USING (public.is_superadmin());


--
-- Name: customers Users can insert customers for their partner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert customers for their partner" ON public.customers FOR INSERT WITH CHECK ((partner_uuid = public.get_my_partner_uuid()));


--
-- Name: customers Users can update customers from their partner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update customers from their partner" ON public.customers FOR UPDATE USING ((partner_uuid = public.get_my_partner_uuid()));


--
-- Name: customers Users can view customers from their partner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view customers from their partner" ON public.customers FOR SELECT USING ((partner_uuid = public.get_my_partner_uuid()));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: SEQUENCE customers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customers_id_seq TO anon;
GRANT ALL ON SEQUENCE public.customers_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.customers_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict SchXPGS3IeAQ45Ra64F0LUdJhuRn74dRnU6jZCL23SwJOa1CW569TFh64Nzu4Da

