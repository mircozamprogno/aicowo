--
-- PostgreSQL database dump
--

\restrict cikhb0d42otu7bUhtj8QdijJeGtegCx3sLRgYxD629oZkQ09NKek7cJKqRaxUMk

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
-- Name: partners_discount_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partners_discount_codes (
    id bigint NOT NULL,
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


ALTER TABLE public.partners_discount_codes OWNER TO postgres;

--
-- Name: partners_discount_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partners_discount_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partners_discount_codes_id_seq OWNER TO postgres;

--
-- Name: partners_discount_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partners_discount_codes_id_seq OWNED BY public.partners_discount_codes.id;


--
-- Name: partners_discount_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_discount_codes ALTER COLUMN id SET DEFAULT nextval('public.partners_discount_codes_id_seq'::regclass);


--
-- Name: partners_discount_codes partners_discount_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_discount_codes
    ADD CONSTRAINT partners_discount_codes_code_key UNIQUE (code);


--
-- Name: partners_discount_codes partners_discount_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_discount_codes
    ADD CONSTRAINT partners_discount_codes_pkey PRIMARY KEY (id);


--
-- Name: idx_partners_discount_codes_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_discount_codes_active ON public.partners_discount_codes USING btree (is_active);


--
-- Name: idx_partners_discount_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_discount_codes_code ON public.partners_discount_codes USING btree (code);


--
-- Name: idx_partners_discount_codes_valid_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_discount_codes_valid_from ON public.partners_discount_codes USING btree (valid_from);


--
-- Name: idx_partners_discount_codes_valid_until; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partners_discount_codes_valid_until ON public.partners_discount_codes USING btree (valid_until);


--
-- Name: partners_discount_codes update_partners_discount_codes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_partners_discount_codes_updated_at BEFORE UPDATE ON public.partners_discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partners_discount_codes partners_discount_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partners_discount_codes
    ADD CONSTRAINT partners_discount_codes_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);


--
-- Name: partners_discount_codes Superadmins manage all discount codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage all discount codes" ON public.partners_discount_codes TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: partners_discount_codes View active discount codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View active discount codes" ON public.partners_discount_codes FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: partners_discount_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.partners_discount_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE partners_discount_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.partners_discount_codes TO anon;
GRANT ALL ON TABLE public.partners_discount_codes TO authenticated;
GRANT ALL ON TABLE public.partners_discount_codes TO service_role;


--
-- Name: SEQUENCE partners_discount_codes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.partners_discount_codes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.partners_discount_codes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.partners_discount_codes_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict cikhb0d42otu7bUhtj8QdijJeGtegCx3sLRgYxD629oZkQ09NKek7cJKqRaxUMk

