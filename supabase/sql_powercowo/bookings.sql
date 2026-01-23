--
-- PostgreSQL database dump
--

\restrict mLWQx50POVZEtstWeX6iLh7MKL0sboIfycdqTWwzyt5PZJVT3CBaWUKcffYxNAH

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
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id bigint NOT NULL,
    booking_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id bigint NOT NULL,
    location_resource_id bigint NOT NULL,
    partner_uuid uuid NOT NULL,
    customer_id bigint NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    booking_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archived_by_user_id uuid,
    archive_reason text,
    CONSTRAINT bookings_booking_status_check CHECK (((booking_status)::text = ANY (ARRAY[('active'::character varying)::text, ('cancelled'::character varying)::text, ('completed'::character varying)::text, ('expired'::character varying)::text]))),
    CONSTRAINT bookings_dates_check CHECK ((end_date >= start_date))
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bookings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bookings_id_seq OWNER TO postgres;

--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: bookings bookings_booking_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_booking_uuid_key UNIQUE (booking_uuid);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: idx_bookings_archived_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_archived_at ON public.bookings USING btree (archived_at);


--
-- Name: idx_bookings_contract_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_contract_id ON public.bookings USING btree (contract_id);


--
-- Name: idx_bookings_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_customer_id ON public.bookings USING btree (customer_id);


--
-- Name: idx_bookings_date_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_date_range ON public.bookings USING btree (start_date, end_date);


--
-- Name: idx_bookings_is_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_is_archived ON public.bookings USING btree (is_archived);


--
-- Name: idx_bookings_location_resource_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_location_resource_id ON public.bookings USING btree (location_resource_id);


--
-- Name: idx_bookings_partner_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_partner_uuid ON public.bookings USING btree (partner_uuid);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (booking_status);


--
-- Name: bookings update_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_bookings_updated_at();


--
-- Name: bookings bookings_archived_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_archived_by_user_id_fkey FOREIGN KEY (archived_by_user_id) REFERENCES auth.users(id);


--
-- Name: bookings bookings_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_location_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_location_resource_id_fkey FOREIGN KEY (location_resource_id) REFERENCES public.location_resources(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_partner_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_partner_uuid_fkey FOREIGN KEY (partner_uuid) REFERENCES public.partners(partner_uuid) ON DELETE CASCADE;


--
-- Name: bookings bookings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: bookings Customers can insert own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can insert own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: bookings Customers can update own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can update own bookings" ON public.bookings FOR UPDATE TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid())))) WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: bookings Customers view own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers view own bookings" ON public.bookings FOR SELECT TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: bookings Partner admins can insert bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins can insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (((public.is_admin() OR public.is_superadmin()) AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: bookings Partner admins manage own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins manage own bookings" ON public.bookings TO authenticated USING ((public.is_admin() AND (partner_uuid = public.get_my_partner_uuid())));


--
-- Name: bookings Partner admins view own bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins view own bookings" ON public.bookings FOR SELECT TO authenticated USING ((partner_uuid = public.get_my_partner_uuid()));


--
-- Name: bookings Superadmins view all bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins view all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.is_superadmin());


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bookings TO anon;
GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- Name: SEQUENCE bookings_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.bookings_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bookings_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bookings_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict mLWQx50POVZEtstWeX6iLh7MKL0sboIfycdqTWwzyt5PZJVT3CBaWUKcffYxNAH

