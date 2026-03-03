// src/pages/BookingsNew.jsx
import { Calendar, ChevronLeft, ChevronRight, Filter, Layers, MapPin, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';
import SearchableSelect from '../components/common/SearchableSelect';
import { toast } from '../components/common/ToastContainer';
import PartnerBookingForm from '../components/forms/PartnerBookingForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import oneSignalEmailService from '../services/oneSignalEmailService';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

import '../styles/pages/bookings-new.css';
import '../styles/pages/bookings.css';
import { logActivity } from '../utils/activityLogger';

const SCROLL_STEP = 7 * 80;

const BookingsNew = () => {
    const [loading, setLoading] = useState(true);
    const [resources, setResources] = useState([]);
    const [filteredResources, setFilteredResources] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [locations, setLocations] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [closures, setClosures] = useState([]);
    const [resourceTypeMap, setResourceTypeMap] = useState({});
    const [currentDate, setCurrentDate] = useState(new Date());

    const [filters, setFilters] = useState({ location: '', resourceType: '', customer: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(true);
    const [hasAvailablePackages, setHasAvailablePackages] = useState(false);

    const [showPartnerBooking, setShowPartnerBooking] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showBookingDetails, setShowBookingDetails] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const { profile, user } = useAuth();
    const { t } = useTranslation();
    const scrollRef = useRef(null);

    const isCustomer = profile?.role === 'user';
    const isPartnerAdmin = profile?.role === 'admin';
    const isSuperAdmin = profile?.role === 'superadmin';

    useEffect(() => {
        if (profile) {
            fetchInitialData();
            if (isPartnerAdmin) fetchFilterOptions();
            if (isCustomer) checkAvailablePackages();
        }
    }, [profile, currentDate]);

    useEffect(() => { applyFilters(); }, [resources, filters, searchQuery]);

    const updateArrows = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateArrows, { passive: true });
        setTimeout(updateArrows, 150);
        return () => el.removeEventListener('scroll', updateArrows);
    }, [filteredResources, loading]);

    const scrollTimeline = (dir) => {
        scrollRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' });
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const { data: locationsData } = await supabase.from('locations').select('*').eq('partner_uuid', profile.partner_uuid).order('location_name');
            setLocations(locationsData || []);

            const { data: resourcesData } = await supabase.from('location_resources').select(`*, locations (id, location_name)`).eq('partner_uuid', profile.partner_uuid).order('locations(location_name)').order('resource_type').order('resource_name');
            setResources(resourcesData || []);

            const { data: typeNamesData } = await supabase.from('partner_resource_types').select('type_code, type_name').eq('partner_uuid', profile.partner_uuid);
            const typeMap = {};
            (typeNamesData || []).forEach(t => { typeMap[t.type_code] = t.type_name; });
            setResourceTypeMap(typeMap);

            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

            let bookingsQuery = supabase.from('bookings')
                .select(`id, start_date, end_date, booking_status, is_archived, contracts!inner (id, contract_number, service_name, service_type, is_archived), location_resources (id, resource_name, resource_type, locations (id, location_name)), customers (id, first_name, second_name, company_name)`)
                .eq('booking_status', 'active').eq('is_archived', false)
                .lte('start_date', endOfMonth.toISOString()).gte('end_date', startOfMonth.toISOString());

            let packagesQuery = supabase.from('package_reservations')
                .select(`id, reservation_date, duration_type, time_slot, reservation_status, is_archived, contracts!inner (id, contract_number, service_name, service_type, is_archived), location_resources (id, resource_name, resource_type, locations (id, location_name)), customers (id, first_name, second_name, company_name)`)
                .eq('reservation_status', 'confirmed').eq('is_archived', false)
                .gte('reservation_date', startOfMonth.toISOString().split('T')[0])
                .lte('reservation_date', endOfMonth.toISOString().split('T')[0]);

            if (isCustomer) {
                const { data: cust } = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle();
                if (cust) { bookingsQuery = bookingsQuery.eq('customer_id', cust.id); packagesQuery = packagesQuery.eq('customer_id', cust.id); }
            } else {
                bookingsQuery = bookingsQuery.eq('partner_uuid', profile.partner_uuid);
                packagesQuery = packagesQuery.eq('partner_uuid', profile.partner_uuid);
            }

            const [resBookings, resPackages] = await Promise.all([bookingsQuery, packagesQuery]);
            setBookings([
                ...(resBookings.data || []).map(b => ({ ...b, booking_type: 'subscription' })),
                ...(resPackages.data || []).map(p => ({ ...p, id: `pkg-${p.id}`, start_date: p.reservation_date, end_date: p.reservation_date, booking_type: 'package' }))
            ]);

            const { data: closuresData } = await supabase.from('operating_closures')
                .select(`*, locations (id, location_name), location_resources (id, resource_name, resource_type)`)
                .eq('partner_uuid', profile.partner_uuid)
                .lte('closure_start_date', endOfMonth.toISOString().split('T')[0])
                .gte('closure_end_date', startOfMonth.toISOString().split('T')[0]);
            setClosures(closuresData || []);
        } catch (error) {
            logger.error('Error fetching data:', error);
            toast.error(t('messages.errorLoadingBookings'));
        } finally {
            setLoading(false);
        }
    };

    const checkAvailablePackages = async () => {
        try {
            const { data: customerData } = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle();
            if (!customerData) return;
            const { data: packageContracts } = await supabase.from('contracts')
                .select(`id, service_max_entries, package_reservations (id, reservation_status)`)
                .eq('customer_id', customerData.id).eq('service_type', 'pacchetto').eq('contract_status', 'active').eq('is_archived', false);
            if (!packageContracts?.length) { setHasAvailablePackages(false); return; }
            setHasAvailablePackages(packageContracts.some(c => (c.package_reservations?.filter(r => r.reservation_status === 'confirmed').length || 0) < (c.service_max_entries || 0)));
        } catch (e) { logger.error(e); setHasAvailablePackages(false); }
    };

    const fetchFilterOptions = async () => {
        try {
            const { data } = await supabase.from('customers').select('id, first_name, second_name, company_name').eq('partner_uuid', profile.partner_uuid).eq('customer_status', 'active').order('first_name');
            setCustomers(data || []);
        } catch (e) { logger.error(e); }
    };

    const applyFilters = () => {
        let filtered = [...resources];
        if (filters.location) filtered = filtered.filter(r => r.location_id?.toString() === filters.location);
        if (filters.resourceType) filtered = filtered.filter(r => r.resource_type === filters.resourceType);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => r.resource_name.toLowerCase().includes(q) || r.resource_type.toLowerCase().includes(q) || (resourceTypeMap[r.resource_type] || '').toLowerCase().includes(q));
        }
        setFilteredResources(filtered);
    };

    const days = useMemo(() => {
        const year = currentDate.getFullYear(), month = currentDate.getMonth();
        const count = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
    }, [currentDate]);

    const getBlockStyle = (startDate, endDate) => {
        const start = new Date(startDate), end = new Date(endDate);
        const mStart = days[0], mEnd = new Date(days[days.length - 1]); mEnd.setHours(23, 59, 59);
        if (end < mStart || start > mEnd) return null;
        const effS = start < mStart ? mStart : start, effE = end > mEnd ? mEnd : end;
        const sIdx = days.findIndex(d => { const a = new Date(d); a.setHours(0, 0, 0, 0); const b = new Date(effS); b.setHours(0, 0, 0, 0); return a.getTime() === b.getTime(); });
        if (sIdx === -1) return null;
        const d1 = new Date(effS); d1.setHours(0, 0, 0, 0);
        const d2 = new Date(effE); d2.setHours(0, 0, 0, 0);
        const span = Math.round((d2 - d1) / 86400000) + 1;
        return { left: `${sIdx * 80}px`, width: `${Math.min(span, days.length - sIdx) * 80 - 8}px` };
    };

    const handleBookingClick = (b) => { setSelectedBooking(b); setShowBookingDetails(true); };

    const handleDelete = async () => {
        if (!selectedBooking) return;
        const isPkg = selectedBooking.booking_type === 'package';
        const id = isPkg ? selectedBooking.id.replace('pkg-', '') : selectedBooking.id;
        try {
            setLoading(true);
            if (isPkg) {
                const { data: packageData, error: fetchError } = await supabase.from('package_reservations').select(`*, contracts(id, entries_used, customer_id, contract_number, service_name, service_type, partner_uuid), location_resources(resource_name, resource_type, locations(id, location_name)), customers(first_name, second_name, email, company_name)`).eq('id', id).maybeSingle();
                if (fetchError) throw fetchError;
                const { error: deleteError } = await supabase.from('package_reservations').update({ is_archived: true, reservation_status: 'cancelled' }).eq('id', id);
                if (deleteError) throw deleteError;
                if (packageData?.contracts) await supabase.from('contracts').update({ entries_used: Math.max(0, (packageData.contracts.entries_used || 0) - 1) }).eq('id', packageData.contracts.id);
                const customerName = packageData?.customers?.company_name || `${packageData?.customers?.first_name} ${packageData?.customers?.second_name}`;
                try { await logActivity({ action_category: 'booking', action_type: 'deleted', entity_type: 'package_reservations', entity_id: id, description: `Deleted package reservation for ${customerName}`, metadata: { reservation_id: id, customer_name: customerName, deleted_by: 'partner' } }); } catch (e) { logger.error(e); }
                toast.success(t('bookings.packageReservationDeleted') || t('common.deletedSuccessfully'));
                try { await oneSignalEmailService.sendBookingDeletionEmail(packageData, packageData.contracts, t); } catch (e) { logger.error(e); }
            } else {
                const { data: bookingData, error: fetchError } = await supabase.from('bookings').select(`*, location_resources(resource_name), customers(first_name, second_name, company_name)`).eq('id', id).maybeSingle();
                if (fetchError) throw fetchError;
                const { error: deleteError } = await supabase.from('bookings').update({ is_archived: true, booking_status: 'cancelled' }).eq('id', id);
                if (deleteError) throw deleteError;
                const customerName = bookingData?.customers?.company_name || `${bookingData?.customers?.first_name} ${bookingData?.customers?.second_name}`;
                try { await logActivity({ action_category: 'booking', action_type: 'deleted', entity_type: 'bookings', entity_id: id, description: `Deleted booking for ${customerName}`, metadata: { booking_id: id, customer_name: customerName, deleted_by: 'partner' } }); } catch (e) { logger.error(e); }
                toast.success(t('common.deletedSuccessfully'));
                try {
                    const { data: contractData } = await supabase.from('contracts').select('id, contract_number, service_name, service_type, partner_uuid, customers(first_name, second_name, email)').eq('id', bookingData.contract_id).maybeSingle();
                    if (contractData) await oneSignalEmailService.sendBookingDeletionEmail(bookingData, contractData, t);
                } catch (e) { logger.error(e); }
            }
            setShowDeleteConfirm(false);
            setShowBookingDetails(false);
            fetchInitialData();
        } catch (e) {
            logger.error('Error in handleDelete:', e);
            toast.error(t('messages.errorDeletingBooking'));
        } finally {
            setLoading(false);
        }
    };

    const formatMonth = () => currentDate.toLocaleDateString(t('app.locale') === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' });

    if (loading && resources.length === 0) return <div className="loading-container"><div className="loading-spinner"></div></div>;

    return (
        <div className="bookings-page">
            <div className="bookings-header">
                <div className="bookings-header-content">
                    <h1 className="bookings-title"><Calendar size={24} />{t('navigation.ganttBookings')}</h1>
                    <p className="bookings-description">{isCustomer ? t('bookings.viewYourBookings') : t('bookings.manageAllBookings')}</p>
                </div>
                <div className="bookings-controls">
                    {(isPartnerAdmin || (isCustomer && hasAvailablePackages)) && (
                        <button className="partner-booking-btn" onClick={() => setShowPartnerBooking(true)}>
                            <Plus size={16} />
                            {isCustomer ? t('bookings.newReservation') : t('bookings.bookForCustomer')}
                        </button>
                    )}
                </div>
            </div>

            {/*
                Single unified nav bar:
                Left side  — month prev/today/next  (changes the month)
                Right side — gantt scroll prev/next (scrolls the day columns)
                Both groups use the same visual style: no confusion, no extra toolbars.
            */}
            <div className="timeline-controls">
                <div className="timeline-navigation">
                    <button className="btn-icon" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
                    <button className="btn-today" onClick={() => setCurrentDate(new Date())}>{t('common.today')}</button>
                    <button className="btn-icon" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
                    <h2 className="timeline-month-header">{formatMonth()}</h2>
                </div>

                <div className="timeline-controls-right">
                    {/* Gantt scroll group — visually separated by a divider */}
                    <div className="gantt-scroll-group">
                        <button
                            className="gantt-scroll-btn"
                            onClick={() => scrollTimeline(-1)}
                            disabled={!canScrollLeft}
                            title={t('common.previous')}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="gantt-scroll-label">7 {t('common.days') || 'gg'}</span>
                        <button
                            className="gantt-scroll-btn"
                            onClick={() => scrollTimeline(1)}
                            disabled={!canScrollRight}
                            title={t('common.next')}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="timeline-controls-divider" />

                    <button className="btn-toggle-filters" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={16} />
                        {showFilters ? t('common.close') : t('common.filter')}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="timeline-filters">
                    <div className="filter-group">
                        <label className="filter-label"><MapPin size={16} /> {t('contracts.location')}</label>
                        <SearchableSelect value={filters.location} onChange={v => setFilters(f => ({ ...f, location: v.target.value }))} options={[{ value: '', label: t('common.all') }, ...locations.map(l => ({ value: l.id.toString(), label: l.location_name }))]} />
                    </div>
                    <div className="filter-group">
                        <label className="filter-label"><Layers size={16} /> {t('contracts.resourceType')}</label>
                        <SearchableSelect value={filters.resourceType} onChange={v => setFilters(f => ({ ...f, resourceType: v.target.value }))} options={[{ value: '', label: t('common.all') }, ...[...new Set(resources.map(r => r.resource_type))].map(type => ({ value: type, label: resourceTypeMap[type] || type }))]} />
                    </div>
                    <div className="filter-group">
                        <label className="filter-label"><Search size={16} /> {t('common.search')}</label>
                        <input className="filter-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('common.search')} />
                    </div>
                </div>
            )}

            {/*
                THE GRID — single overflow:scroll container.
                - .timeline-header-corner → sticky top:0 + left:0  (corner always visible)
                - .timeline-car-cell      → sticky left:0          (resource column never scrolls)
                No child has overflow set — this is the only scroll ancestor.
            */}
            <div className="timeline-container" ref={scrollRef}>
                <div className="timeline-header">
                    <div className="timeline-header-corner">{t('contracts.resource')}</div>
                    {days.map((d, i) => (
                        <div key={i} className={`timeline-day-header${d.toDateString() === new Date().toDateString() ? ' today' : ''}`}>
                            <div className="day-name">{d.toLocaleDateString(t('app.locale') === 'it' ? 'it-IT' : 'en-US', { weekday: 'short' })}</div>
                            <div className="day-number">{d.getDate()}</div>
                        </div>
                    ))}
                </div>

                {filteredResources.map(res => {
                    const resBookings = bookings.filter(b => b.location_resources?.id === res.id);
                    const resClosures = closures.filter(c => c.location_id === res.location_id || c.location_resource_id === res.id);
                    return (
                        <div key={res.id} className="timeline-row">
                            <div className="timeline-car-cell">
                                <div className="car-plate-label">{res.resource_name}</div>
                                <div className="car-model-label">{res.locations?.location_name}</div>
                            </div>
                            <div className="timeline-days-row">
                                {days.map((_, dayIdx) => <div key={dayIdx} className="timeline-day-cell" />)}
                                {resBookings.map(b => {
                                    const style = getBlockStyle(b.start_date, b.end_date);
                                    if (!style) return null;
                                    return (
                                        <div key={b.id} className={`timeline-booking-block status-${b.booking_type === 'package' ? 'active' : 'open'}`} style={style} onClick={() => handleBookingClick(b)}>
                                            <span className="booking-renter">{b.customers?.company_name || `${b.customers?.first_name} ${b.customers?.second_name}`}</span>
                                        </div>
                                    );
                                })}
                                {resClosures.map(c => {
                                    const style = getBlockStyle(c.closure_start_date, c.closure_end_date);
                                    if (!style) return null;
                                    return (
                                        <div key={c.id} className="timeline-booking-block status-closed" style={{ ...style, opacity: 0.7 }}>
                                            <span className="booking-renter">{c.reason || 'Chiuso'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <PartnerBookingForm isOpen={showPartnerBooking} onClose={() => setShowPartnerBooking(false)} onSuccess={() => { fetchInitialData(); setShowPartnerBooking(false); }} />

            {showBookingDetails && selectedBooking && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{t('reservations.reservationDetails') || 'Dettagli'}</h2>
                            <button className="modal-close-icon" onClick={() => setShowBookingDetails(false)}><X size={24} /></button>
                        </div>
                        <div className="booking-modal-body">
                            <div className="detail-item"><label>{t('contracts.customer')}</label><p>{selectedBooking.customers?.company_name || `${selectedBooking.customers?.first_name} ${selectedBooking.customers?.second_name}`}</p></div>
                            <div className="detail-item"><label>{t('contracts.resource')}</label><p>{selectedBooking.location_resources?.resource_name} ({selectedBooking.location_resources?.resource_type})</p></div>
                            <div className="detail-item"><label>{t('contracts.period')}</label><p>{new Date(selectedBooking.start_date).toLocaleDateString()} - {new Date(selectedBooking.end_date).toLocaleDateString()}</p></div>
                        </div>
                        <div className="booking-modal-footer">
                            <button className="btn-delete-booking" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={18} /> {t('common.delete')}</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} title={t('bookings.deleteBookingTitle')} message={selectedBooking?.booking_type === 'package' ? t('bookings.confirmDeletePackageReservation') : t('bookings.confirmDeleteSubscriptionBooking')} confirmText={t('bookings.confirmDelete')} isDestructive={true} />
        </div>
    );
};

export default BookingsNew;