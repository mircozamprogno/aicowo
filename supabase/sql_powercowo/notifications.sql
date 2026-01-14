--
-- PostgreSQL database dump
--

\restrict meVnLMWt9z0GjmGmw2OFkTrr0u2beqjPI9HTPKIygllgmuviqpamj6jbYupQivv

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
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_by_uuid uuid NOT NULL,
    creator_role character varying(20) NOT NULL,
    partner_uuid uuid,
    title text NOT NULL,
    message text NOT NULL,
    notification_type character varying(50) NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    template_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notification_partner_check CHECK (((((creator_role)::text = 'superadmin'::text) AND (partner_uuid IS NULL)) OR (((creator_role)::text = 'admin'::text) AND (partner_uuid IS NOT NULL)))),
    CONSTRAINT notifications_creator_role_check CHECK (((((creator_role)::text = 'superadmin'::text) AND (partner_uuid IS NULL)) OR (((creator_role)::text = 'admin'::text) AND (partner_uuid IS NOT NULL)))),
    CONSTRAINT notifications_notification_type_check CHECK (((notification_type)::text = ANY ((ARRAY['promotion'::character varying, 'announcement'::character varying, 'release_note'::character varying, 'alert'::character varying, 'new_location'::character varying])::text[]))),
    CONSTRAINT notifications_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying])::text[]))),
    CONSTRAINT valid_date_range CHECK ((valid_until > valid_from))
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: idx_notifications_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_active ON public.notifications USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_notifications_creator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_creator ON public.notifications USING btree (created_by_uuid);


--
-- Name: idx_notifications_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_dates ON public.notifications USING btree (valid_from, valid_until);


--
-- Name: idx_notifications_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_partner ON public.notifications USING btree (partner_uuid);


--
-- Name: idx_notifications_published_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_published_active ON public.notifications USING btree (status, is_active, valid_from, valid_until) WHERE (((status)::text = 'published'::text) AND (is_active = true));


--
-- Name: idx_notifications_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_status ON public.notifications USING btree (status);


--
-- Name: notifications update_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications notifications_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: notifications notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id) ON DELETE SET NULL;


--
-- Name: notifications Allow authenticated users to manage notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users to manage notifications" ON public.notifications TO authenticated USING (true) WITH CHECK (true);


--
-- Name: notifications Allow authenticated users to view notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users to view notifications" ON public.notifications FOR SELECT TO authenticated USING (true);


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict meVnLMWt9z0GjmGmw2OFkTrr0u2beqjPI9HTPKIygllgmuviqpamj6jbYupQivv

