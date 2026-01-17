--
-- PostgreSQL database dump
--

\restrict xJEkqVvbOdHNduip6f8f0ih64nzughVwtuKv7iLK3GUHCTPbOnPiS7RHVoZbrHj

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
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    email text,
    partner_uuid uuid,
    role text DEFAULT 'user'::text NOT NULL,
    phone text,
    fcm_token text,
    customer_uuid uuid,
    first_name text,
    last_name text,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'user'::text])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: idx_profiles_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_partner ON public.profiles USING btree (partner_uuid);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: profiles profiles_partner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_partner_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: profiles Admins view partner profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins view partner profiles" ON public.profiles FOR SELECT TO authenticated USING ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: profiles Superadmins manage profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins manage profiles" ON public.profiles TO authenticated USING (public.is_superadmin());


--
-- Name: profiles Superadmins view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_superadmin());


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: profiles Users view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict xJEkqVvbOdHNduip6f8f0ih64nzughVwtuKv7iLK3GUHCTPbOnPiS7RHVoZbrHj

