import { Calendar, ChevronLeft, ChevronRight, Filter, Layers, MapPin, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';
import SearchableSelect from '../components/common/SearchableSelect';
import { toast } from '../components/common/ToastContainer';
import PartnerBookingForm from '../components/forms/PartnerBookingForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

// Import the specific CSS provided by the user
import '../styles/pages/bookings.css';
import '../styles/pages/exampleBookingNew.css';
import { logActivity } from '../utils/activityLogger';

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

    // Filters
    const [filters, setFilters] = useState({
        location: '',
        resourceType: '',
        customer: ''
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(true);
    const [hasAvailablePackages, setHasAvailablePackages] = useState(false);

    // States for modals and selection
    const [showPartnerBooking, setShowPartnerBooking] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showBookingDetails, setShowBookingDetails] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const { profile, user } = useAuth();
    const { t } = useTranslation();

    // Refs for sync scroll
    const headerRef = useRef(null);
    const bodyRef = useRef(null);
    const rowRefs = useRef([]);

    const isCustomer = profile?.role === 'user';
    const isPartnerAdmin = profile?.role === 'admin';
    const isSuperAdmin = profile?.role === 'superadmin';

    useEffect(() => {
        if (profile) {
            fetchInitialData();
            if (isPartnerAdmin) {
                fetchFilterOptions();
            }
            if (isCustomer) {
                checkAvailablePackages();
            }
        }
    }, [profile, currentDate]);

    useEffect(() => {
        applyFilters();
    }, [resources, filters, searchQuery]);

    // Synchronize horizontal scroll
    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

        const handleScroll = (e) => {
            const scrollLeft = e.target.scrollLeft;
            // Update all rows simultaneously
            rowRefs.current.forEach(row => {
                if (row && row !== e.target) {
                    row.scrollLeft = scrollLeft;
                }
            });
            // Update header if we scrolled a row
            if (header && header !== e.target) {
                header.scrollLeft = scrollLeft;
            }
        };

        header.addEventListener('scroll', handleScroll);
        return () => header.removeEventListener('scroll', handleScroll);
    }, [filteredResources, loading]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Fetch locations for filters
            const { data: locationsData } = await supabase
                .from('locations')
                .select('*')
                .eq('partner_uuid', profile.partner_uuid)
                .order('location_name');
            setLocations(locationsData || []);

            // Fetch resources
            const { data: resourcesData } = await supabase
                .from('location_resources')
                .select(`
          *,
          locations (
            id,
            location_name
          )
        `)
                .eq('partner_uuid', profile.partner_uuid)
                .order('locations(location_name)')
                .order('resource_type')
                .order('resource_name');
            setResources(resourcesData || []);

            // Fetch Resource Type Names
            const { data: typeNamesData } = await supabase
                .from('partner_resource_types')
                .select('type_code, type_name')
                .eq('partner_uuid', profile.partner_uuid);

            const typeMap = {};
            (typeNamesData || []).forEach(t => {
                typeMap[t.type_code] = t.type_name;
            });
            setResourceTypeMap(typeMap);

            // Month bounds
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

            // Fetch Bookings & Package Reservations
            let bookingsQuery = supabase
                .from('bookings')
                .select(`
          id, start_date, end_date, booking_status, is_archived,
          contracts!inner (id, contract_number, service_name, service_type, is_archived),
          location_resources (id, resource_name, resource_type, locations (id, location_name)),
          customers (id, first_name, second_name, company_name)
        `)
                .eq('booking_status', 'active')
                .eq('is_archived', false)
                .lte('start_date', endOfMonth.toISOString())
                .gte('end_date', startOfMonth.toISOString());

            let packagesQuery = supabase
                .from('package_reservations')
                .select(`
          id, reservation_date, duration_type, time_slot, reservation_status, is_archived,
          contracts!inner (id, contract_number, service_name, service_type, is_archived),
          location_resources (id, resource_name, resource_type, locations (id, location_name)),
          customers (id, first_name, second_name, company_name)
        `)
                .eq('reservation_status', 'confirmed')
                .eq('is_archived', false)
                .gte('reservation_date', startOfMonth.toISOString().split('T')[0])
                .lte('reservation_date', endOfMonth.toISOString().split('T')[0]);

            if (isCustomer) {
                const { data: cust } = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle();
                if (cust) {
                    bookingsQuery = bookingsQuery.eq('customer_id', cust.id);
                    packagesQuery = packagesQuery.eq('customer_id', cust.id);
                }
            } else {
                bookingsQuery = bookingsQuery.eq('partner_uuid', profile.partner_uuid);
                packagesQuery = packagesQuery.eq('partner_uuid', profile.partner_uuid);
            }

            const [resBookings, resPackages] = await Promise.all([bookingsQuery, packagesQuery]);

            const normalized = [
                ...(resBookings.data || []).map(b => ({ ...b, booking_type: 'subscription' })),
                ...(resPackages.data || []).map(p => ({
                    ...p,
                    id: `pkg-${p.id}`,
                    start_date: p.reservation_date,
                    end_date: p.reservation_date,
                    booking_type: 'package'
                }))
            ];
            setBookings(normalized);

            // Fetch Closures
            const { data: closuresData } = await supabase
                .from('operating_closures')
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
            const { data: customerData } = await supabase
                .from('customers')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!customerData) return;

            const { data: packageContracts } = await supabase
                .from('contracts')
                .select(`
                    id,
                    service_max_entries,
                    package_reservations (
                        id,
                        reservation_status
                    )
                `)
                .eq('customer_id', customerData.id)
                .eq('service_type', 'pacchetto')
                .eq('contract_status', 'active')
                .eq('is_archived', false);

            if (!packageContracts || packageContracts.length === 0) {
                setHasAvailablePackages(false);
                return;
            }

            const hasAvailable = packageContracts.some(contract => {
                const usedReservations = contract.package_reservations?.filter(
                    r => r.reservation_status === 'confirmed'
                ).length || 0;
                return usedReservations < (contract.service_max_entries || 0);
            });

            setHasAvailablePackages(hasAvailable);
        } catch (error) {
            logger.error('Error checking packages:', error);
            setHasAvailablePackages(false);
        }
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
            filtered = filtered.filter(r => {
                const typeName = (resourceTypeMap[r.resource_type] || '').toLowerCase();
                return r.resource_name.toLowerCase().includes(q) ||
                    r.resource_type.toLowerCase().includes(q) ||
                    typeName.includes(q);
            });
        }
        setFilteredResources(filtered);
    };

    const days = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const count = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
    }, [currentDate]);

    const handleBookingClick = (b) => {
        setSelectedBooking(b);
        setShowBookingDetails(true);
    };

    const handleDelete = async () => {
        if (!selectedBooking) return;
        const isPkg = selectedBooking.booking_type === 'package';
        const id = isPkg ? selectedBooking.id.replace('pkg-', '') : selectedBooking.id;

        try {
            setLoading(true);
            const table = isPkg ? 'package_reservations' : 'bookings';
            const statusField = isPkg ? 'reservation_status' : 'booking_status';

            if (isPkg) {
                // Handle package reservation deletion
                const { data: packageData, error: fetchError } = await supabase
                    .from('package_reservations')
                    .select(`
                        *,
                        contracts(id, entries_used, customer_id, contract_number, service_name),
                        location_resources(
                            resource_name,
                            resource_type,
                            locations(id, location_name)
                        ),
                        customers(first_name, second_name, email, company_name)
                    `)
                    .eq('id', id)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                // Soft delete the package reservation
                const { error: deleteError } = await supabase
                    .from('package_reservations')
                    .update({
                        is_archived: true,
                        reservation_status: 'cancelled'
                    })
                    .eq('id', id);

                if (deleteError) throw deleteError;

                // Restore the entry count in the contract
                if (packageData?.contracts) {
                    const { error: contractError } = await supabase
                        .from('contracts')
                        .update({
                            entries_used: Math.max(0, (packageData.contracts.entries_used || 0) - 1)
                        })
                        .eq('id', packageData.contracts.id);

                    if (contractError) throw contractError;
                }

                // Log activity
                const customerName = packageData?.customers?.company_name ||
                    `${packageData?.customers?.first_name} ${packageData?.customers?.second_name}`;

                try {
                    await logActivity({
                        action_category: 'booking',
                        action_type: 'deleted',
                        entity_type: 'package_reservations',
                        entity_id: id,
                        description: `Deleted package reservation for ${customerName} at ${packageData?.location_resources?.resource_name}`,
                        metadata: {
                            reservation_id: id,
                            contract_id: packageData?.contracts?.id,
                            customer_name: customerName,
                            deleted_by: 'partner'
                        }
                    });
                } catch (logError) {
                    logger.error('Error logging package deletion activity:', logError);
                }

                toast.success(t('bookings.packageReservationDeleted') || t('common.deletedSuccessfully'));
            } else {
                // Handle subscription booking deletion
                const { data: bookingData, error: fetchError } = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        location_resources(resource_name),
                        customers(first_name, second_name, company_name)
                    `)
                    .eq('id', id)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                // Soft delete the booking
                const { error: deleteError } = await supabase
                    .from('bookings')
                    .update({
                        is_archived: true,
                        booking_status: 'cancelled'
                    })
                    .eq('id', id);

                if (deleteError) throw deleteError;

                // Log activity
                const customerName = bookingData?.customers?.company_name ||
                    `${bookingData?.customers?.first_name} ${bookingData?.customers?.second_name}`;

                try {
                    await logActivity({
                        action_category: 'booking',
                        action_type: 'deleted',
                        entity_type: 'bookings',
                        entity_id: id,
                        description: `Deleted booking for ${customerName} at ${bookingData?.location_resources?.resource_name}`,
                        metadata: {
                            booking_id: id,
                            customer_name: customerName,
                            deleted_by: 'partner'
                        }
                    });
                } catch (logError) {
                    logger.error('Error logging booking deletion activity:', logError);
                }

                toast.success(t('common.deletedSuccessfully'));
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

    const formatMonth = () => currentDate.toLocaleDateString(t('locale') === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' });

    if (loading && resources.length === 0) return <div className="loading-container"><div className="loading-spinner"></div></div>;

    return (
        <div className="bookings-page">
            <div className="bookings-header">
                <div className="bookings-header-content">
                    <h1 className="bookings-title">
                        <Calendar size={24} className="mr-2" />
                        {t('navigation.ganttBookings')}
                    </h1>
                    <p className="bookings-description">
                        {isCustomer ? t('bookings.viewYourBookings') : t('bookings.manageAllBookings')}
                    </p>
                </div>
                <div className="bookings-controls">
                    {(isPartnerAdmin || (isCustomer && hasAvailablePackages)) && (
                        <button
                            className="partner-booking-btn"
                            onClick={() => setShowPartnerBooking(true)}
                            title={isCustomer ? t('bookings.bookPackage') : t('bookings.bookForCustomer')}
                        >
                            <Plus size={16} />
                            {isCustomer ? t('bookings.newReservation') : t('bookings.bookForCustomer')}
                        </button>
                    )}
                </div>
            </div>

            <div className="timeline-controls">
                <div className="timeline-navigation">
                    <button className="btn-icon" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}><ChevronLeft /></button>
                    <button className="btn-today" onClick={() => setCurrentDate(new Date())}>{t('common.today')}</button>
                    <button className="btn-icon" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}><ChevronRight /></button>
                    <h2 className="timeline-month-header">{formatMonth()}</h2>
                </div>
                <button className="btn-toggle-filters" onClick={() => setShowFilters(!showFilters)}>
                    <Filter size={18} /> {showFilters ? t('common.close') : t('common.filter')}
                </button>
            </div>

            {showFilters && (
                <div className="timeline-filters">
                    <div className="filter-group">
                        <label className="filter-label"><MapPin size={16} /> {t('contracts.location')}</label>
                        <SearchableSelect
                            value={filters.location}
                            onChange={v => setFilters(f => ({ ...f, location: v.target.value }))}
                            options={[{ value: '', label: t('common.all') }, ...locations.map(l => ({ value: l.id.toString(), label: l.location_name }))]}
                        />
                    </div>
                    <div className="filter-group">
                        <label className="filter-label"><Layers size={16} /> {t('contracts.resourceType')}</label>
                        <SearchableSelect
                            value={filters.resourceType}
                            onChange={v => setFilters(f => ({ ...f, resourceType: v.target.value }))}
                            options={[{ value: '', label: t('common.all') }, ...[...new Set(resources.map(r => r.resource_type))].map(type => ({ value: type, label: resourceTypeMap[type] || type }))]}
                        />
                    </div>
                    <div className="filter-group">
                        <label className="filter-label"><Search size={16} /> {t('common.search')}</label>
                        <input className="filter-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('common.search')} />
                    </div>
                </div>
            )}

            <div className="timeline-container">
                <div className="timeline-header">
                    <div className="timeline-header-corner">{t('contracts.resource')}</div>
                    <div className="timeline-days-header" ref={headerRef}>
                        {days.map((d, i) => (
                            <div key={i} className={`timeline-day-header ${d.toDateString() === new Date().toDateString() ? 'today' : ''}`}>
                                <div className="day-name">{d.toLocaleDateString(t('locale') === 'it' ? 'it-IT' : 'en-US', { weekday: 'short' })}</div>
                                <div className="day-number">{d.getDate()}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="timeline-body" ref={bodyRef}>
                    {filteredResources.map((res, resIdx) => {
                        const resBookings = bookings.filter(b => b.location_resources?.id === res.id);
                        const resClosures = closures.filter(c => c.location_id === res.location_id || c.location_resource_id === res.id);

                        return (
                            <div key={res.id} className="timeline-row">
                                <div className="timeline-car-cell col-fixed">
                                    <div className="car-plate-label">{res.resource_name}</div>
                                    <div className="car-model-label">{res.locations?.location_name}</div>
                                </div>
                                <div
                                    className="timeline-days-row"
                                    ref={el => rowRefs.current[resIdx] = el}
                                    onScroll={(e) => {
                                        const scrollLeft = e.target.scrollLeft;
                                        if (headerRef.current) headerRef.current.scrollLeft = scrollLeft;
                                        rowRefs.current.forEach((r, idx) => {
                                            if (r && idx !== resIdx) r.scrollLeft = scrollLeft;
                                        });
                                    }}
                                >
                                    {days.map((_, dayIdx) => <div key={dayIdx} className="timeline-day-cell" />)}

                                    {/* Bookings Overlay */}
                                    {resBookings.map(b => {
                                        const start = new Date(b.start_date); const end = new Date(b.end_date);
                                        const mStart = days[0]; const mEnd = new Date(days[days.length - 1]); mEnd.setHours(23, 59, 59);
                                        if (end < mStart || start > mEnd) return null;
                                        const effS = start < mStart ? mStart : start; const effE = end > mEnd ? mEnd : end;
                                        const sIdx = days.findIndex(d => {
                                            const dS = new Date(d); dS.setHours(0, 0, 0, 0);
                                            const sC = new Date(effS); sC.setHours(0, 0, 0, 0);
                                            return dS.getTime() === sC.getTime();
                                        });
                                        if (sIdx === -1) return null;
                                        const d1 = new Date(effS); d1.setHours(0, 0, 0, 0);
                                        const d2 = new Date(effE); d2.setHours(0, 0, 0, 0);
                                        const span = Math.round((d2 - d1) / 86400000) + 1;
                                        const finalSpan = Math.min(span, days.length - sIdx);

                                        return (
                                            <div
                                                key={b.id}
                                                className={`timeline-booking-block status-${b.booking_type === 'package' ? 'active' : 'open'}`}
                                                style={{ left: `${sIdx * 80}px`, width: `${finalSpan * 80 - 8}px` }}
                                                onClick={() => handleBookingClick(b)}
                                            >
                                                <span className="booking-renter">{b.customers?.company_name || `${b.customers?.first_name} ${b.customers?.second_name}`}</span>
                                            </div>
                                        );
                                    })}

                                    {/* Closures Overlay */}
                                    {resClosures.map(c => {
                                        const start = new Date(c.closure_start_date); const end = new Date(c.closure_end_date);
                                        const mStart = days[0]; const mEnd = new Date(days[days.length - 1]); mEnd.setHours(23, 59, 59);
                                        if (end < mStart || start > mEnd) return null;
                                        const effS = start < mStart ? mStart : start; const effE = end > mEnd ? mEnd : end;
                                        const sIdx = days.findIndex(d => {
                                            const dS = new Date(d); dS.setHours(0, 0, 0, 0);
                                            const sC = new Date(effS); sC.setHours(0, 0, 0, 0);
                                            return dS.getTime() === sC.getTime();
                                        });
                                        if (sIdx === -1) return null;
                                        const d1 = new Date(effS); d1.setHours(0, 0, 0, 0);
                                        const d2 = new Date(effE); d2.setHours(0, 0, 0, 0);
                                        const span = Math.round((d2 - d1) / 86400000) + 1;
                                        const finalSpan = Math.min(span, days.length - sIdx);

                                        return (
                                            <div
                                                key={c.id}
                                                className="timeline-booking-block status-closed"
                                                style={{ left: `${sIdx * 80}px`, width: `${finalSpan * 80 - 8}px`, opacity: 0.7 }}
                                            >
                                                <span className="booking-renter">{c.reason || 'Chiuso'}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <PartnerBookingForm
                isOpen={showPartnerBooking}
                onClose={() => setShowPartnerBooking(false)}
                onSuccess={() => { fetchInitialData(); setShowPartnerBooking(false); }}
            />

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

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title={t('bookings.deleteBookingTitle')}
                message={
                    selectedBooking?.booking_type === 'package'
                        ? t('bookings.confirmDeletePackageReservation')
                        : t('bookings.confirmDeleteSubscriptionBooking')
                }
                confirmText={t('bookings.confirmDelete')}
                isDestructive={true}
            />
        </div>
    );
};

export default BookingsNew;
