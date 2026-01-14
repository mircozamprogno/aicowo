--
-- PostgreSQL database dump
--

\restrict DvEDRDeI7oS001KoDGxGMbYWjr1xa0cuJlDNcE62l9WKfTqyv6mzWTGvmIRo1Z9

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
-- Name: customers_discount_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers_discount_codes (
    id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    usage_limit integer,
    usage_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    applies_to_plans text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    CONSTRAINT chk_discount_type CHECK (((discount_type)::text = ANY (ARRAY[('percentage'::character varying)::text, ('fixed_amount'::character varying)::text]))),
    CONSTRAINT chk_discount_value CHECK (((((discount_type)::text = 'percentage'::text) AND (discount_value > (0)::numeric) AND (discount_value <= (100)::numeric)) OR (((discount_type)::text = 'fixed_amount'::text) AND (discount_value >= (0)::numeric)))),
    CONSTRAINT chk_usage_count CHECK ((usage_count >= 0)),
    CONSTRAINT chk_usage_limit CHECK (((usage_limit IS NULL) OR (usage_limit > 0))),
    CONSTRAINT chk_valid_dates CHECK (((valid_until IS NULL) OR (valid_until > valid_from)))
);


ALTER TABLE public.customers_discount_codes OWNER TO postgres;

--
-- Name: customers_discount_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_discount_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_discount_codes_id_seq OWNER TO postgres;

--
-- Name: customers_discount_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_discount_codes_id_seq OWNED BY public.customers_discount_codes.id;


--
-- Name: customers_discount_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers_discount_codes ALTER COLUMN id SET DEFAULT nextval('public.customers_discount_codes_id_seq'::regclass);


--
-- Name: customers_discount_codes customers_discount_codes_partner_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers_discount_codes
    ADD CONSTRAINT customers_discount_codes_partner_code_key UNIQUE (partner_uuid, code);


--
-- Name: customers_discount_codes customers_discount_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers_discount_codes
    ADD CONSTRAINT customers_discount_codes_pkey PRIMARY KEY (id);


--
-- Name: idx_customers_discount_codes_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_discount_codes_active ON public.customers_discount_codes USING btree (is_active);


--
-- Name: idx_customers_discount_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_discount_codes_code ON public.customers_discount_codes USING btree (code);


--
-- Name: idx_customers_discount_codes_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_discount_codes_partner ON public.customers_discount_codes USING btree (partner_uuid);


--
-- Name: idx_customers_discount_codes_valid_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_discount_codes_valid_from ON public.customers_discount_codes USING btree (valid_from);


--
-- Name: idx_customers_discount_codes_valid_until; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_discount_codes_valid_until ON public.customers_discount_codes USING btree (valid_until);


--
-- Name: customers_discount_codes update_customers_discount_codes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_discount_codes_updated_at BEFORE UPDATE ON public.customers_discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers_discount_codes customers_discount_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers_discount_codes
    ADD CONSTRAINT customers_discount_codes_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: customers_discount_codes customers_discount_codes_partner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers_discount_codes
    ADD CONSTRAINT customers_discount_codes_partner_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: customers_discount_codes Partners can delete their own discount codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can delete their own discount codes" ON public.customers_discount_codes FOR DELETE USING ((partner_uuid IN ( SELECT p.partner_uuid
   FROM (public.partners p
     JOIN public.profiles pr ON ((pr.partner_uuid = p.partner_uuid)))
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'admin'::text)))));


--
-- Name: customers_discount_codes Partners can insert their own discount codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can insert their own discount codes" ON public.customers_discount_codes FOR INSERT WITH CHECK ((partner_uuid IN ( SELECT p.partner_uuid
   FROM (public.partners p
     JOIN public.profiles pr ON ((pr.partner_uuid = p.partner_uuid)))
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'admin'::text)))));


--
-- Name: customers_discount_codes Partners can update their own discount codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners can update their own discount codes" ON public.customers_discount_codes FOR UPDATE USING ((partner_uuid IN ( SELECT p.partner_uuid
   FROM (public.partners p
     JOIN public.profiles pr ON ((pr.partner_uuid = p.partner_uuid)))
  WHERE ((pr.id = auth.uid()) AND (pr.role = 'admin'::text)))));


--
-- Name: customers_discount_codes Select Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Select Policy" ON public.customers_discount_codes FOR SELECT TO anon, authenticated USING (true);


--
-- Name: customers_discount_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customers_discount_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE customers_discount_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers_discount_codes TO anon;
GRANT ALL ON TABLE public.customers_discount_codes TO authenticated;
GRANT ALL ON TABLE public.customers_discount_codes TO service_role;


--
-- Name: SEQUENCE customers_discount_codes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customers_discount_codes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.customers_discount_codes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.customers_discount_codes_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict DvEDRDeI7oS001KoDGxGMbYWjr1xa0cuJlDNcE62l9WKfTqyv6mzWTGvmIRo1Z9

