--
-- PostgreSQL database dump
--

\restrict nCV6faN5jztoaz9qMBZKnhc5PGVDXsaavEgnP7gnja5VRvqCA6lToSQlRolVjf2

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
-- Name: package_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.package_reservations (
    id integer NOT NULL,
    reservation_uuid uuid DEFAULT gen_random_uuid(),
    contract_id integer NOT NULL,
    location_resource_id integer NOT NULL,
    partner_uuid uuid NOT NULL,
    customer_id integer NOT NULL,
    reservation_date date NOT NULL,
    duration_type character varying(20) NOT NULL,
    time_slot character varying(20),
    entries_used numeric(3,1) NOT NULL,
    reservation_status character varying(20) DEFAULT 'confirmed'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archived_by_user_id uuid,
    archive_reason text,
    CONSTRAINT check_time_slot_for_half_day CHECK ((((duration_type)::text = 'full_day'::text) OR (((duration_type)::text = 'half_day'::text) AND (time_slot IS NOT NULL)))),
    CONSTRAINT package_reservations_duration_type_check CHECK (((duration_type)::text = ANY (ARRAY[('full_day'::character varying)::text, ('half_day'::character varying)::text]))),
    CONSTRAINT package_reservations_reservation_status_check CHECK (((reservation_status)::text = ANY (ARRAY[('confirmed'::character varying)::text, ('cancelled'::character varying)::text, ('completed'::character varying)::text]))),
    CONSTRAINT package_reservations_time_slot_check CHECK (((time_slot)::text = ANY (ARRAY[('morning'::character varying)::text, ('afternoon'::character varying)::text])))
);


ALTER TABLE public.package_reservations OWNER TO postgres;

--
-- Name: package_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.package_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.package_reservations_id_seq OWNER TO postgres;

--
-- Name: package_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.package_reservations_id_seq OWNED BY public.package_reservations.id;


--
-- Name: package_reservations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations ALTER COLUMN id SET DEFAULT nextval('public.package_reservations_id_seq'::regclass);


--
-- Name: package_reservations package_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations
    ADD CONSTRAINT package_reservations_pkey PRIMARY KEY (id);


--
-- Name: idx_package_reservations_archived_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_reservations_archived_at ON public.package_reservations USING btree (archived_at);


--
-- Name: idx_package_reservations_contract; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_reservations_contract ON public.package_reservations USING btree (contract_id);


--
-- Name: idx_package_reservations_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_reservations_date ON public.package_reservations USING btree (reservation_date);


--
-- Name: idx_package_reservations_is_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_reservations_is_archived ON public.package_reservations USING btree (is_archived);


--
-- Name: idx_package_reservations_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_package_reservations_resource ON public.package_reservations USING btree (location_resource_id);


--
-- Name: package_reservations_active_booking_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX package_reservations_active_booking_unique ON public.package_reservations USING btree (location_resource_id, reservation_date, time_slot) WHERE ((is_archived = false) AND ((reservation_status)::text = 'confirmed'::text));


--
-- Name: package_reservations_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX package_reservations_active_unique ON public.package_reservations USING btree (location_resource_id, reservation_date, duration_type, time_slot) WHERE ((is_archived = false) AND ((reservation_status)::text = 'confirmed'::text));


--
-- Name: package_reservations trigger_update_contract_entries; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_contract_entries AFTER INSERT OR DELETE OR UPDATE ON public.package_reservations FOR EACH ROW EXECUTE FUNCTION public.update_contract_entries_on_reservation();


--
-- Name: package_reservations package_reservations_archived_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations
    ADD CONSTRAINT package_reservations_archived_by_user_id_fkey FOREIGN KEY (archived_by_user_id) REFERENCES auth.users(id);


--
-- Name: package_reservations package_reservations_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations
    ADD CONSTRAINT package_reservations_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: package_reservations package_reservations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations
    ADD CONSTRAINT package_reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: package_reservations package_reservations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations
    ADD CONSTRAINT package_reservations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: package_reservations package_reservations_location_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations
    ADD CONSTRAINT package_reservations_location_resource_id_fkey FOREIGN KEY (location_resource_id) REFERENCES public.location_resources(id);


--
-- Name: package_reservations package_reservations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.package_reservations
    ADD CONSTRAINT package_reservations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: package_reservations Customers create own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers create own reservations" ON public.package_reservations FOR INSERT TO authenticated WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: package_reservations Customers view own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers view own reservations" ON public.package_reservations FOR SELECT TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: package_reservations Partner admins manage own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins manage own reservations" ON public.package_reservations TO authenticated USING (((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))));


--
-- Name: package_reservations Partner admins view own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Partner admins view own reservations" ON public.package_reservations FOR SELECT TO authenticated USING ((partner_uuid = ( SELECT profiles.partner_uuid
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: package_reservations Superadmins view all reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Superadmins view all reservations" ON public.package_reservations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));


--
-- Name: package_reservations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.package_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE package_reservations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.package_reservations TO anon;
GRANT ALL ON TABLE public.package_reservations TO authenticated;
GRANT ALL ON TABLE public.package_reservations TO service_role;


--
-- Name: SEQUENCE package_reservations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.package_reservations_id_seq TO anon;
GRANT ALL ON SEQUENCE public.package_reservations_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.package_reservations_id_seq TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict nCV6faN5jztoaz9qMBZKnhc5PGVDXsaavEgnP7gnja5VRvqCA6lToSQlRolVjf2

