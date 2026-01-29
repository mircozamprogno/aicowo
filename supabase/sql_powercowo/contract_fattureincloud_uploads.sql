--
-- PostgreSQL database dump
--

\restrict 2QQZjnUDRqikDqo9hfVOyfZ585NI6iO5U8sCmbBNiMYlzUnnisp0yXVuz4lFOXc

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
-- Name: contract_fattureincloud_uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_fattureincloud_uploads (
    id integer NOT NULL,
    contract_id integer,
    fattureincloud_invoice_id text,
    fattureincloud_invoice_number text,
    upload_status text DEFAULT 'pending'::text,
    error_message text,
    uploaded_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contract_fattureincloud_uploads_upload_status_check CHECK ((upload_status = ANY (ARRAY['success'::text, 'failed'::text, 'pending'::text])))
);


ALTER TABLE public.contract_fattureincloud_uploads OWNER TO postgres;

--
-- Name: contract_fattureincloud_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_fattureincloud_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_fattureincloud_uploads_id_seq OWNER TO postgres;

--
-- Name: contract_fattureincloud_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_fattureincloud_uploads_id_seq OWNED BY public.contract_fattureincloud_uploads.id;


--
-- Name: contract_fattureincloud_uploads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_fattureincloud_uploads ALTER COLUMN id SET DEFAULT nextval('public.contract_fattureincloud_uploads_id_seq'::regclass);


--
-- Name: contract_fattureincloud_uploads contract_fattureincloud_uploa_contract_id_fattureincloud_in_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_fattureincloud_uploads
    ADD CONSTRAINT contract_fattureincloud_uploa_contract_id_fattureincloud_in_key UNIQUE (contract_id, fattureincloud_invoice_id);


--
-- Name: contract_fattureincloud_uploads contract_fattureincloud_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_fattureincloud_uploads
    ADD CONSTRAINT contract_fattureincloud_uploads_pkey PRIMARY KEY (id);


--
-- Name: idx_contract_fattureincloud_uploads_contract_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_fattureincloud_uploads_contract_id ON public.contract_fattureincloud_uploads USING btree (contract_id);


--
-- Name: idx_contract_fattureincloud_uploads_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_fattureincloud_uploads_status ON public.contract_fattureincloud_uploads USING btree (upload_status);


--
-- Name: contract_fattureincloud_uploads contract_fattureincloud_uploads_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_fattureincloud_uploads
    ADD CONSTRAINT contract_fattureincloud_uploads_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_fattureincloud_uploads View via contract access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View via contract access" ON public.contract_fattureincloud_uploads FOR SELECT TO authenticated USING ((contract_id IN ( SELECT c.id
   FROM public.contracts c
  WHERE ((c.partner_uuid = ( SELECT profiles.partner_uuid
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text))))))));


--
-- Name: contract_fattureincloud_uploads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contract_fattureincloud_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE contract_fattureincloud_uploads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contract_fattureincloud_uploads TO anon;
GRANT ALL ON TABLE public.contract_fattureincloud_uploads TO authenticated;
GRANT ALL ON TABLE public.contract_fattureincloud_uploads TO service_role;


--
-- Name: SEQUENCE contract_fattureincloud_uploads_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.contract_fattureincloud_uploads_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contract_fattureincloud_uploads_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contract_fattureincloud_uploads_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 2QQZjnUDRqikDqo9hfVOyfZ585NI6iO5U8sCmbBNiMYlzUnnisp0yXVuz4lFOXc

