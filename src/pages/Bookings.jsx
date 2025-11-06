import { Calendar, ChevronLeft, ChevronRight, Filter, Home, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import PartnerBookingForm from '../components/forms/PartnerBookingForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState('month');
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    customer: '',
    resourceType: '',
    location: ''
  });
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  
  // Partner booking modal state
  const [showPartnerBooking, setShowPartnerBooking] = useState(false);
  
  // Customer available packages state
  const [hasAvailablePackages, setHasAvailablePackages] = useState(false);
  
  const { profile, user } = useAuth();
  const { t } = useTranslation();

  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (profile) {
      fetchBookings();
      if (isPartnerAdmin) {
        fetchFilterOptions();
      }
      if (isCustomer) {
        checkAvailablePackages();
      }
    }
  }, [profile]);

  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);

  const checkAvailablePackages = async () => {
    try {
      console.log('Checking available packages for user:', user.id);
      
      // Get customer ID
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        return;
      }

      if (!customerData) {
        console.log('No customer data found for user');
        return;
      }

      console.log('Customer ID:', customerData.id);

      // Check for active package contracts with available reservations
      const { data: packageContracts, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          service_name,
          service_max_entries,
          contract_status,
          is_archived,
          package_reservations (
            id,
            reservation_status
          )
        `)
        .eq('customer_id', customerData.id)
        .eq('service_type', 'pacchetto')
        .eq('contract_status', 'active')
        .eq('is_archived', false);

      if (error) {
        console.error('Error fetching package contracts:', error);
        throw error;
      }

      console.log('Package contracts found:', packageContracts);

      if (!packageContracts || packageContracts.length === 0) {
        console.log('No active package contracts found');
        setHasAvailablePackages(false);
        return;
      }

      // Check if any package has available reservations
      const hasAvailable = packageContracts.some(contract => {
        // Count confirmed reservations
        const usedReservations = contract.package_reservations?.filter(
          r => r.reservation_status === 'confirmed'
        ).length || 0;
        
        // Use service_max_entries as the total (this is what's used in Contracts.jsx)
        const totalReservations = contract.service_max_entries || 0;
        const available = usedReservations < totalReservations;
        
        console.log(`Contract ${contract.contract_number}:`, {
          total: totalReservations,
          used: usedReservations,
          available: available
        });
        
        return available;
      });

      console.log('Has available packages:', hasAvailable);
      setHasAvailablePackages(hasAvailable);
    } catch (error) {
      console.error('Error checking available packages:', error);
      setHasAvailablePackages(false);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // Base queries with archive filter
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          start_date,
          end_date,
          booking_status,
          contracts!inner (
            id,
            contract_number,
            service_name,
            service_type,
            service_cost,
            service_currency,
            is_archived
          ),
          location_resources (
            id,
            resource_name,
            resource_type,
            locations (
              id,
              location_name
            )
          ),
          customers (
            id,
            first_name,
            second_name,
            email,
            company_name
          )
        `)
        .eq('booking_status', 'active')
        .eq('is_archived', false)
        .eq('contracts.is_archived', false)
        .order('start_date');

      let packagesQuery = supabase
        .from('package_reservations')
        .select(`
          id,
          reservation_date,
          duration_type,
          time_slot,
          reservation_status,
          contracts!inner (
            id,
            contract_number,
            service_name,
            service_type,
            service_cost,
            service_currency,
            is_archived
          ),
          location_resources (
            id,
            resource_name,
            resource_type,
            locations (
              id,
              location_name
            )
          ),
          customers (
            id,
            first_name,
            second_name,
            email,
            company_name
          )
        `)
        .eq('reservation_status', 'confirmed')
        .eq('is_archived', false)
        .eq('contracts.is_archived', false)
        .order('reservation_date');

      // Role-based filters
      if (isCustomer) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (customerData) {
          bookingsQuery = bookingsQuery.eq('customer_id', customerData.id);
          packagesQuery = packagesQuery.eq('customer_id', customerData.id);
        }
      } else if (isPartnerAdmin) {
        bookingsQuery = bookingsQuery.eq('partner_uuid', profile.partner_uuid);
        packagesQuery = packagesQuery.eq('partner_uuid', profile.partner_uuid);
      }

      // Execute both queries in parallel
      const [
        { data: bookingsData, error: bookingsError },
        { data: packagesData, error: packagesError }
      ] = await Promise.all([bookingsQuery, packagesQuery]);

      if (bookingsError) throw bookingsError;
      if (packagesError) throw packagesError;

      // Normalize package reservations to match bookings structure
      const normalizedPackages = (packagesData || []).map(pkg => ({
        id: `pkg-${pkg.id}`,
        start_date: pkg.reservation_date,
        end_date: pkg.reservation_date,
        contracts: pkg.contracts,
        location_resources: pkg.location_resources,
        customers: pkg.customers,
        duration_type: pkg.duration_type,
        time_slot: pkg.time_slot,
        booking_type: 'package'
      }));

      // Add booking_type to regular bookings
      const normalizedBookings = (bookingsData || []).map(booking => ({
        ...booking,
        booking_type: 'subscription'
      }));

      // Merge and sort all results
      const combined = [...normalizedBookings, ...normalizedPackages].sort(
        (a, b) => new Date(a.start_date) - new Date(b.start_date)
      );

      setBookings(combined);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error(t('messages.errorLoadingBookings') || 'Error loading bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, first_name, second_name, company_name')
        .eq('partner_uuid', profile.partner_uuid)
        .order('first_name');

      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, location_name')
        .eq('partner_uuid', profile.partner_uuid)
        .order('location_name');

      setCustomers(customersData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...bookings];
    if (filters.customer) {
      filtered = filtered.filter(b => b.customers?.id?.toString() === filters.customer);
    }
    if (filters.resourceType) {
      filtered = filtered.filter(b => b.location_resources?.resource_type === filters.resourceType);
    }
    if (filters.location) {
      filtered = filtered.filter(b => b.location_resources?.locations?.id?.toString() === filters.location);
    }
    setFilteredBookings(filtered);
  };

  const handlePartnerBookingSuccess = (reservation) => {
    console.log('Booking successful:', reservation);
    fetchBookings(); // Refresh bookings
    if (isCustomer) {
      checkAvailablePackages(); // Refresh available packages for customer
    }
    setShowPartnerBooking(false);
    toast.success(isCustomer ? 'Reservation created successfully' : 'Booking created successfully for customer');
  };

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date) => {
    const locale = t('app.locale') === 'it' ? 'it-IT' : 'en-US';
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatMonthYear = (date) => {
    const locale = t('app.locale') === 'it' ? 'it-IT' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long'
    });
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (viewType === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const getResourceColor = (booking) => {
    const serviceType = booking.contracts?.service_type || 'abbonamento';
    const resourceType = booking.location_resources?.resource_type || 'scrivania';
    
    const colors = {
      'abbonamento_scrivania': '#3b82f6',
      'abbonamento_sala_riunioni': '#8b5cf6',
      'pacchetto_scrivania': '#10b981',
      'pacchetto_sala_riunioni': '#f59e0b'
    };
    
    return colors[`${serviceType}_${resourceType}`] || '#6b7280';
  };

  const getBookingsForDate = (date) => {
    const dateStr = formatDate(date);
    return filteredBookings.filter(b => {
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      const check = new Date(date);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      check.setHours(0, 0, 0, 0);
      return check >= start && check <= end;
    });
  };

  const getResourceTypeIcon = (type) => (type === 'scrivania' ? '🖥️' : '🏢');

  const getBookingDisplayText = (booking) => {
    const customerName = booking.customers?.company_name || booking.customers?.first_name;
    
    if (booking.booking_type === 'package') {
      const durationText = booking.duration_type === 'full_day' 
        ? t('reservations.fullDay') 
        : `${t('reservations.halfDay')} (${booking.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon')})`;
      return `${customerName} - ${durationText}`;
    }
    
    return customerName;
  };

  const renderMonthView = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const days = [];
    const tempDate = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(tempDate));
      tempDate.setDate(tempDate.getDate() + 1);
    }
    return (
      <div className="calendar-month">
        <div className="calendar-weekdays">
          {[t('calendar.sunday'), t('calendar.monday'), t('calendar.tuesday'), t('calendar.wednesday'), t('calendar.thursday'), t('calendar.friday'), t('calendar.saturday')].map(d => (
            <div key={d} className="calendar-weekday">{d}</div>
          ))}
        </div>
        <div className="calendar-days">
          {days.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = formatDate(day) === formatDate(new Date());
            const dayBookings = getBookingsForDate(day);
            return (
              <div
                key={idx}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => { setCurrentDate(new Date(day)); setViewType('day'); }}
              >
                <div className="calendar-day-number">{day.getDate()}</div>
                <div className="calendar-day-bookings">
                  {dayBookings.slice(0, 3).map(b => (
                    <div
                      key={b.id}
                      className="calendar-booking-item"
                      style={{ backgroundColor: getResourceColor(b) }}
                      title={`${getBookingDisplayText(b)} - ${b.location_resources?.resource_name}`}
                    >
                      <span className="booking-title">{getBookingDisplayText(b)}</span>
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="calendar-more-bookings">
                      +{dayBookings.length - 3} {t('bookings.more')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day);
    }

    return (
      <div className="calendar-week">
        <div className="calendar-week-header">
          {weekDays.map((day, idx) => {
            const isToday = formatDate(day) === formatDate(new Date());
            const locale = t('app.locale') === 'it' ? 'it-IT' : 'en-US';
            return (
              <div key={idx} className={`calendar-week-day-header ${isToday ? 'today' : ''}`}>
                <div className="week-day-name">
                  {day.toLocaleDateString(locale, { weekday: 'short' })}
                </div>
                <div className="week-day-number">{day.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="calendar-week-content">
          {weekDays.map((day, idx) => {
            const isToday = formatDate(day) === formatDate(new Date());
            const dayBookings = getBookingsForDate(day);
            return (
              <div 
                key={idx} 
                className={`calendar-week-day ${isToday ? 'today' : ''}`}
                onClick={() => { setCurrentDate(new Date(day)); setViewType('day'); }}
              >
                <div className="week-day-bookings">
                  {dayBookings.map(b => (
                    <div
                      key={b.id}
                      className="week-booking-item"
                      style={{ backgroundColor: getResourceColor(b) }}
                      title={`${getBookingDisplayText(b)} - ${b.location_resources?.resource_name}`}
                    >
                      <div className="week-booking-title">{getBookingDisplayText(b)}</div>
                      <div className="week-booking-resource">{b.location_resources?.resource_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayBookings = getBookingsForDate(currentDate);
    return (
      <div className="calendar-day-view">
        <div className="day-view-header">
          <h2>{formatDisplayDate(currentDate)}</h2>
          <p>{dayBookings.length} {dayBookings.length === 1 ? t('bookings.booking') : t('bookings.bookings')}</p>
        </div>
        <div className="day-view-content">
          {dayBookings.length === 0 ? (
            <div className="day-no-bookings">
              <Calendar size={48} className="empty-icon" />
              <p>{t('bookings.noBookingsForDay')}</p>
            </div>
          ) : (
            <div className="day-bookings-list">
              {dayBookings.map(b => (
                <div key={b.id} className="day-booking-card">
                  <div className="day-booking-header">
                    <div className="day-booking-color" style={{ backgroundColor: getResourceColor(b) }} />
                    <div className="day-booking-info">
                      <h3>{b.customers?.company_name || `${b.customers?.first_name} ${b.customers?.second_name}`}</h3>
                      <p>{b.contracts?.contract_number}</p>
                    </div>
                    <div className="day-booking-cost">
                      {new Intl.NumberFormat('it-IT', {
                        style: 'currency',
                        currency: b.contracts?.service_currency || 'EUR'
                      }).format(b.contracts?.service_cost || 0)}
                    </div>
                  </div>
                  <div className="day-booking-details">
                    <div className="day-booking-service"><strong>{b.contracts?.service_name}</strong></div>
                    <div className="day-booking-resource">{getResourceTypeIcon(b.location_resources?.resource_type)} {b.location_resources?.resource_name}</div>
                    <div className="day-booking-location">📍 {b.location_resources?.locations?.location_name}</div>
                    <div className="day-booking-period">📅 {b.start_date} - {b.end_date}</div>
                    {b.duration_type && (
                      <div className="day-booking-duration">
                        ⏱ {b.duration_type === 'full_day' ? t('reservations.fullDay') : t('reservations.halfDay')}
                        {b.duration_type === 'half_day' && b.time_slot ? ` (${b.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon')})` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="bookings-loading">{t('common.loading')}</div>;

  // Show booking button if partner admin OR customer with available packages
  const showBookingButton = isPartnerAdmin || (isCustomer && hasAvailablePackages);

  return (
    <div className="bookings-page">
      {/* Header */}
      <div className="bookings-header">
        <div className="bookings-header-content">
          <h1 className="bookings-title">
            <Calendar size={24} className="mr-2" />
            {t('bookings.title')}
          </h1>
          <p className="bookings-description">
            {isCustomer ? t('bookings.viewYourBookings') : t('bookings.manageAllBookings')}
          </p>
        </div>
        <div className="bookings-controls">
          {/* Booking Button - Visible to partner admins AND customers with available packages */}
          {showBookingButton && (
            <button 
              className="partner-booking-btn" 
              onClick={() => setShowPartnerBooking(true)}
              title={isCustomer ? t('bookings.bookPackage') : t('bookings.bookForCustomer')}
            >
              <Plus size={16} />
              {isCustomer ? t('bookings.newReservation') : t('bookings.bookForCustomer')}
            </button>
          )}

          <div className="view-selector">
            <button className={`view-btn ${viewType === 'month' ? 'active' : ''}`} onClick={() => setViewType('month')}>
              {t('bookings.month')}
            </button>
            <button className={`view-btn ${viewType === 'week' ? 'active' : ''}`} onClick={() => setViewType('week')}>
              {t('bookings.week')}
            </button>
            <button className={`view-btn ${viewType === 'day' ? 'active' : ''}`} onClick={() => setViewType('day')}>
              {t('bookings.day')}
            </button>
          </div>
          <button className="today-btn" onClick={goToToday}>
            <Home size={16} />
            {t('bookings.today')}
          </button>
          {isPartnerAdmin && (
            <button className="filter-btn" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} />
              {t('bookings.filters')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && isPartnerAdmin && (
        <div className="filters-panel">
          <div className="filters-row">
            <div className="filter-group">
              <label>{t('bookings.customer')}:</label>
              <select value={filters.customer} onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}>
                <option value="">{t('bookings.allCustomers')}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || `${c.first_name} ${c.second_name}`}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>{t('bookings.resourceType')}:</label>
              <select value={filters.resourceType} onChange={(e) => setFilters(prev => ({ ...prev, resourceType: e.target.value }))}>
                <option value="">{t('bookings.allResources')}</option>
                <option value="scrivania">🖥️ {t('locations.scrivania')}</option>
                <option value="sala_riunioni">🏢 {t('locations.salaRiunioni')}</option>
              </select>
            </div>
            <div className="filter-group">
              <label>{t('bookings.location')}:</label>
              <select value={filters.location} onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}>
                <option value="">{t('bookings.allLocations')}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
              </select>
            </div>
            <button 
              className="clear-filters-btn" 
              onClick={() => setFilters({ customer: '', resourceType: '', location: '' })}
            >
              {t('bookings.clearFilters')}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="calendar-navigation">
        <button className="nav-btn" onClick={() => navigateDate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="calendar-title">
          {viewType === 'month' ? formatMonthYear(currentDate) : formatDisplayDate(currentDate)}
        </h2>
        <button className="nav-btn" onClick={() => navigateDate(1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar */}
      <div className="calendar-container">
        {filteredBookings.length === 0 ? (
          <div className="day-no-bookings">
            <Calendar size={48} className="empty-icon" />
            <p>{t('bookings.noBookingsFound')}</p>
          </div>
        ) : (
          <>
            {viewType === 'month' && renderMonthView()}
            {viewType === 'week' && renderWeekView()}
            {viewType === 'day' && renderDayView()}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <h4>{t('bookings.legend')}:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>🖥️ {t('services.subscription')} {t('locations.scrivania')}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#8b5cf6' }}></div>
            <span>🏢 {t('services.subscription')} {t('locations.salaRiunioni')}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
            <span>🖥️ {t('services.package')} {t('locations.scrivania')}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>🏢 {t('services.package')} {t('locations.salaRiunioni')}</span>
          </div>
        </div>
      </div>

      {/* Partner/Customer Booking Modal */}
      <PartnerBookingForm
        isOpen={showPartnerBooking}
        onClose={() => setShowPartnerBooking(false)}
        onSuccess={handlePartnerBookingSuccess}
      />
    </div>
  );
};

export default Bookings;