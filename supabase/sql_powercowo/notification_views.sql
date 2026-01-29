--
-- PostgreSQL database dump
--

\restrict o6RghrOUfBBa3QFLKtpdszgonkAYbcXtq8AvZOvJggGvLgDC6WxPPa3CYj8FNV1

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
-- Name: notification_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_views (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    notification_id uuid NOT NULL,
    user_uuid uuid NOT NULL,
    modal_acknowledged boolean DEFAULT false,
    viewed_at timestamp with time zone,
    partner_uuid uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_views OWNER TO postgres;

--
-- Name: notification_views notification_views_notification_id_user_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_views
    ADD CONSTRAINT notification_views_notification_id_user_uuid_key UNIQUE (notification_id, user_uuid);


--
-- Name: notification_views notification_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_views
    ADD CONSTRAINT notification_views_pkey PRIMARY KEY (id);


--
-- Name: idx_notification_views_notification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_views_notification ON public.notification_views USING btree (notification_id);


--
-- Name: idx_notification_views_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_views_partner ON public.notification_views USING btree (partner_uuid);


--
-- Name: idx_notification_views_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_views_unread ON public.notification_views USING btree (user_uuid, modal_acknowledged) WHERE (modal_acknowledged = false);


--
-- Name: idx_notification_views_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_views_user ON public.notification_views USING btree (user_uuid);


--
-- Name: notification_views update_notification_views_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_views_updated_at BEFORE UPDATE ON public.notification_views FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_views notification_views_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_views
    ADD CONSTRAINT notification_views_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_views notification_views_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_views
    ADD CONSTRAINT notification_views_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: notification_views Admins view partner notification views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins view partner notification views" ON public.notification_views FOR SELECT TO authenticated USING (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))));


--
-- Name: notification_views Users manage own views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own views" ON public.notification_views TO authenticated USING ((user_uuid = auth.uid()));


--
-- Name: notification_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_views ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE notification_views; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_views TO anon;
GRANT ALL ON TABLE public.notification_views TO authenticated;
GRANT ALL ON TABLE public.notification_views TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict o6RghrOUfBBa3QFLKtpdszgonkAYbcXtq8AvZOvJggGvLgDC6WxPPa3CYj8FNV1

