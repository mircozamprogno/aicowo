--
-- PostgreSQL database dump
--

\restrict ssDB7rUDB1UK8byi33FurGGogOjg9u1thhiahYvaBj0nexn5Cfzfr79uKo5kM0s

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
-- Name: partners_customer_activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_customer_activity_log (
    id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    customer_uuid uuid NOT NULL,
    event_type character varying(20) NOT NULL,
    event_date timestamp with time zone DEFAULT now() NOT NULL,
    event_month character varying(7) NOT NULL,
    previous_status character varying(50),
    new_status character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_event_type CHECK (((event_type)::text = ANY ((ARRAY['activated'::character varying, 'deactivated'::character varying])::text[])))
);


ALTER TABLE public.partners_customer_activity_log OWNER TO postgres;

--
-- Name: TABLE partners_customer_activity_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.partners_customer_activity_log IS 'Tracks customer activation/deactivation events for billing calculations';


--
-- Name: partners_customer_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_customer_activity_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_customer_activity_log_id_seq OWNER TO postgres;

--
-- Name: partners_customer_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_customer_activity_log_id_seq OWNED BY public.partners_customer_activity_log.id;


--
-- Name: partners_customer_activity_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_customer_activity_log ALTER COLUMN id SET DEFAULT nextval('public.partners_customer_activity_log_id_seq'::regclass);


--
-- Name: partners_customer_activity_log partners_customer_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_customer_activity_log
    ADD CONSTRAINT partners_customer_activity_log_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_log_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_log_customer ON public.partners_customer_activity_log USING btree (customer_uuid);


--
-- Name: idx_activity_log_event_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_log_event_date ON public.partners_customer_activity_log USING btree (event_date);


--
-- Name: idx_activity_log_partner_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_log_partner_month ON public.partners_customer_activity_log USING btree (partner_uuid, event_month);


--
-- Name: partners_customer_activity_log partners_customer_activity_log_customer_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_customer_activity_log
    ADD CONSTRAINT partners_customer_activity_log_customer_uuid_fkey FOREIGN KEY (customer_uuid) REFERENCES public.customers(customer_uuid) ON DELETE CASCADE;


--
-- Name: partners_customer_activity_log partners_customer_activity_log_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_customer_activity_log
    ADD CONSTRAINT partners_customer_activity_log_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: partners_customer_activity_log Insert own partner activity log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Insert own partner activity log" ON public.partners_customer_activity_log FOR INSERT TO authenticated WITH CHECK (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text))))));


--
-- Name: partners_customer_activity_log Partners view own activity log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partners view own activity log" ON public.partners_customer_activity_log FOR SELECT TO authenticated USING (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text))))));


--
-- Name: partners_customer_activity_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_customer_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_customer_activity_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_customer_activity_log TO anon;
GRANT ALL ON TABLE public.partners_customer_activity_log TO authenticated;
GRANT ALL ON TABLE public.partners_customer_activity_log TO service_role;


--
-- Name: SEQUENCE partners_customer_activity_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_customer_activity_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_customer_activity_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_customer_activity_log_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict ssDB7rUDB1UK8byi33FurGGogOjg9u1thhiahYvaBj0nexn5Cfzfr79uKo5kM0s

