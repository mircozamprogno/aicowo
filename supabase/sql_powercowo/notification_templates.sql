--
-- PostgreSQL database dump
--

\restrict Xazvln5WHRLXnUWLYeHyGo3iKYTvLlgdD5DT0weCK0IZwmKja3GH5cRyds7DTxk

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
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    notification_type character varying(50) NOT NULL,
    title_template text NOT NULL,
    message_template text NOT NULL,
    created_by_role character varying(20) NOT NULL,
    partner_uuid uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notification_templates_created_by_role_check CHECK (((created_by_role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT notification_templates_notification_type_check CHECK (((notification_type)::text = ANY ((ARRAY['promotion'::character varying, 'announcement'::character varying, 'release_note'::character varying, 'alert'::character varying, 'new_location'::character varying])::text[]))),
    CONSTRAINT template_partner_check CHECK (((((created_by_role)::text = 'superadmin'::text) AND (partner_uuid IS NULL)) OR (((created_by_role)::text = 'admin'::text) AND (partner_uuid IS NOT NULL))))
);


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: idx_notification_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_active ON public.notification_templates USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_notification_templates_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_partner ON public.notification_templates USING btree (partner_uuid);


--
-- Name: notification_templates update_notification_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_templates notification_templates_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: notification_templates Allow authenticated users to manage templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users to manage templates" ON public.notification_templates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: notification_templates Allow authenticated users to view templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users to view templates" ON public.notification_templates FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: notification_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE notification_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_templates TO anon;
GRANT ALL ON TABLE public.notification_templates TO authenticated;
GRANT ALL ON TABLE public.notification_templates TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict Xazvln5WHRLXnUWLYeHyGo3iKYTvLlgdD5DT0weCK0IZwmKja3GH5cRyds7DTxk

