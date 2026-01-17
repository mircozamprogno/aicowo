--
-- PostgreSQL database dump
--

\restrict K1aOlEeBEdHC6PnbbkCkxq6CVCuLu19xEpkf2VUqazM7moaj0a7GJ7e8sktjnpW

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
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_uuid uuid NOT NULL,
    user_id uuid NOT NULL,
    action_category public.activity_category NOT NULL,
    action_type public.activity_action NOT NULL,
    entity_type text,
    description text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now(),
    entity_id text
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_category ON public.activity_logs USING btree (action_category);


--
-- Name: idx_activity_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_created ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_id);


--
-- Name: idx_activity_logs_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_partner ON public.activity_logs USING btree (partner_uuid);


--
-- Name: idx_activity_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id);


--
-- Name: activity_logs activity_logs_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: activity_logs Admins view own partner logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins view own partner logs" ON public.activity_logs FOR SELECT USING ((partner_uuid IN ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: activity_logs Authenticated users insert logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users insert logs" ON public.activity_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: activity_logs Superadmins view all logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins view all logs" ON public.activity_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict K1aOlEeBEdHC6PnbbkCkxq6CVCuLu19xEpkf2VUqazM7moaj0a7GJ7e8sktjnpW

