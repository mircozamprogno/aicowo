--
-- PostgreSQL database dump
--

\restrict J0SencOyN3Gzyo0qwoQx8hmiMHa8dqqW1sGLPdmbRI9tPh7NXCglLyfycVGqShy

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
-- Name: notification_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_recipients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    notification_id uuid NOT NULL,
    recipient_type character varying(20) NOT NULL,
    recipient_uuid uuid NOT NULL,
    partner_uuid uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notification_recipients_recipient_type_check CHECK (((recipient_type)::text = ANY ((ARRAY['partner'::character varying, 'customer'::character varying])::text[])))
);


ALTER TABLE public.notification_recipients OWNER TO postgres;

--
-- Name: notification_recipients notification_recipients_notification_id_recipient_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_notification_id_recipient_uuid_key UNIQUE (notification_id, recipient_uuid);


--
-- Name: notification_recipients notification_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_pkey PRIMARY KEY (id);


--
-- Name: idx_notification_recipients_notification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_recipients_notification ON public.notification_recipients USING btree (notification_id);


--
-- Name: idx_notification_recipients_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_recipients_partner ON public.notification_recipients USING btree (partner_uuid);


--
-- Name: idx_notification_recipients_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_recipients_recipient ON public.notification_recipients USING btree (recipient_uuid);


--
-- Name: idx_notification_recipients_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_recipients_type ON public.notification_recipients USING btree (recipient_type);


--
-- Name: notification_recipients notification_recipients_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_recipients notification_recipients_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: notification_recipients Manage own notification recipients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Manage own notification recipients" ON public.notification_recipients TO authenticated USING ((notification_id IN ( SELECT n.id
   FROM public.notifications n
  WHERE ((n.created_by_uuid = auth.uid()) AND ((n.partner_uuid = ( SELECT profiles.partner_uuid
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))))))));


--
-- Name: notification_recipients View via notification access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View via notification access" ON public.notification_recipients FOR SELECT TO authenticated USING (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text))))));


--
-- Name: notification_recipients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE notification_recipients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_recipients TO anon;
GRANT ALL ON TABLE public.notification_recipients TO authenticated;
GRANT ALL ON TABLE public.notification_recipients TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict J0SencOyN3Gzyo0qwoQx8hmiMHa8dqqW1sGLPdmbRI9tPh7NXCglLyfycVGqShy

