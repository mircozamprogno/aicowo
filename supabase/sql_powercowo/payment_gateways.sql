--
-- PostgreSQL database dump
--

\restrict LjihlJhkTTu9P8MFCOSxX2i8RJq7eHZrozyxlPk3uXuPra1YpNdaUxsOmIBfVrT

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
-- Name: payment_gateways; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_gateways (
    id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    gateway_type character varying(50) NOT NULL,
    gateway_name character varying(100),
    gateway_config jsonb,
    is_active boolean DEFAULT false,
    test_mode boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT payment_gateways_gateway_type_check CHECK (((gateway_type)::text = ANY (ARRAY[('paypal'::character varying)::text, ('stripe'::character varying)::text, ('square'::character varying)::text, ('pagopa'::character varying)::text, ('satispay'::character varying)::text])))
);


ALTER TABLE public.payment_gateways OWNER TO postgres;

--
-- Name: payment_gateways_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_gateways_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_gateways_id_seq OWNER TO postgres;

--
-- Name: payment_gateways_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_gateways_id_seq OWNED BY public.payment_gateways.id;


--
-- Name: payment_gateways id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_gateways ALTER COLUMN id SET DEFAULT nextval('public.payment_gateways_id_seq'::regclass);


--
-- Name: payment_gateways payment_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT payment_gateways_pkey PRIMARY KEY (id);


--
-- Name: idx_payment_gateways_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_gateways_partner ON public.payment_gateways USING btree (partner_uuid);


--
-- Name: idx_payment_gateways_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_gateways_type ON public.payment_gateways USING btree (gateway_type);


--
-- Name: payment_gateways Partner admins manage own gateways; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins manage own gateways" ON public.payment_gateways TO authenticated USING (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: payment_gateways Superadmins manage all gateways; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage all gateways" ON public.payment_gateways TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: payment_gateways; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE payment_gateways; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_gateways TO anon;
GRANT ALL ON TABLE public.payment_gateways TO authenticated;
GRANT ALL ON TABLE public.payment_gateways TO service_role;


--
-- Name: SEQUENCE payment_gateways_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payment_gateways_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payment_gateways_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_gateways_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict LjihlJhkTTu9P8MFCOSxX2i8RJq7eHZrozyxlPk3uXuPra1YpNdaUxsOmIBfVrT

