--
-- PostgreSQL database dump
--

\restrict knK1RP6Q6kTtJJGd7OYIi75I6duw4IVZQcEohwgfcxfqzKV1xbR8ga1tSSrUc2I

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
-- Name: email_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_templates (
    id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    template_type character varying(50) NOT NULL,
    subject_line text NOT NULL,
    body_html text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_templates_template_type_check CHECK (((template_type)::text = ANY (ARRAY[('customer_invitation'::character varying)::text, ('partner_admin_invitation'::character varying)::text, ('customer_booking_confirmation'::character varying)::text, ('partner_booking_notification'::character varying)::text, ('partner_invitation'::character varying)::text, ('confirmation_email'::character varying)::text, ('expiry_reminder'::character varying)::text, ('contract_creation'::character varying)::text])))
);


ALTER TABLE public.email_templates OWNER TO postgres;

--
-- Name: TABLE email_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.email_templates IS 'Stores customized email template bodies for each partner';


--
-- Name: COLUMN email_templates.template_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_templates.template_type IS 'Type of email template: customer_invitation, partner_admin_invitation, customer_booking_confirmation, partner_booking_notification';


--
-- Name: COLUMN email_templates.subject_line; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_templates.subject_line IS 'Customizable email subject line with variable support';


--
-- Name: COLUMN email_templates.body_html; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_templates.body_html IS 'HTML body of the email template with variable placeholders like {{customer_name}}';


--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_templates_id_seq OWNER TO postgres;

--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_templates unique_partner_template; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT unique_partner_template UNIQUE (partner_uuid, template_type);


--
-- Name: idx_email_templates_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_templates_partner_uuid ON public.email_templates USING btree (partner_uuid);


--
-- Name: idx_email_templates_template_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_templates_template_type ON public.email_templates USING btree (template_type);


--
-- Name: email_templates trigger_update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_email_templates_updated_at();


--
-- Name: email_templates email_templates_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: email_templates Partner admins manage own templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins manage own templates" ON public.email_templates TO authenticated USING (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: email_templates Partner admins view own templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins view own templates" ON public.email_templates FOR SELECT TO authenticated USING ((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: email_templates Superadmins manage all templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage all templates" ON public.email_templates TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE email_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_templates TO anon;
GRANT ALL ON TABLE public.email_templates TO authenticated;
GRANT ALL ON TABLE public.email_templates TO service_role;


--
-- Name: SEQUENCE email_templates_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.email_templates_id_seq TO anon;
GRANT ALL ON SEQUENCE public.email_templates_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.email_templates_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict knK1RP6Q6kTtJJGd7OYIi75I6duw4IVZQcEohwgfcxfqzKV1xbR8ga1tSSrUc2I

