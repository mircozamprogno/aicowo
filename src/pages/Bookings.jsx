import { Calendar, ChevronLeft, ChevronRight, Filter, Home } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
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
    }
  }, [profile]);

  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // Base queries
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          start_date,
          end_date,
          booking_status,
          contracts (
            id,
            contract_number,
            service_name,
            service_cost,
            service_currency
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
        .order('start_date');

      let packagesQuery = supabase
        .from('package_reservations')
        .select(`
          id,
          reservation_date,
          duration_type,
          time_slot,
          reservation_status,
          contracts (
            id,
            contract_number,
            service_name,
            service_cost,
            service_currency
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
        id: `pkg-${pkg.id}`, // Unique ID with prefix
        start_date: pkg.reservation_date,
        end_date: pkg.reservation_date,
        contracts: pkg.contracts,
        location_resources: pkg.location_resources,
        customers: pkg.customers,
        duration_type: pkg.duration_type,   // new
        time_slot: pkg.time_slot            // new
      }));

      // Merge and sort all results
      const combined = [...(bookingsData || []), ...normalizedPackages].sort(
        (a, b) => new Date(a.start_date) - new Date(b.start_date)
      );

      setBookings(combined);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Error loading bookings');
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

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('it-IT', {
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

  const getResourceColor = (type) => {
    const colors = { scrivania: '#3b82f6', sala_riunioni: '#f59e0b' };
    return colors[type] || '#6b7280';
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

  const getResourceTypeIcon = (type) => (type === 'scrivania' ? '🪑' : '🏢');

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
          {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(d => (
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
                      style={{ backgroundColor: getResourceColor(b.location_resources?.resource_type) }}
                      title={`${b.customers?.company_name || `${b.customers?.first_name} ${b.customers?.second_name}`} - ${b.location_resources?.resource_name}`}
                    >
                      <span className="booking-title">{b.customers?.company_name || b.customers?.first_name}</span>
                    </div>
                  ))}
                  {dayBookings.length > 3 && <div className="calendar-more-bookings">+{dayBookings.length - 3} more</div>}
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
          <p>{dayBookings.length} {dayBookings.length === 1 ? 'prenotazione' : 'prenotazioni'}</p>
        </div>
        <div className="day-view-content">
          {dayBookings.length === 0 ? (
            <div className="day-no-bookings">
              <Calendar size={48} className="empty-icon" />
              <p>Nessuna prenotazione per questo giorno</p>
            </div>
          ) : (
            <div className="day-bookings-list">
              {dayBookings.map(b => (
                <div key={b.id} className="day-booking-card">
                  <div className="day-booking-header">
                    <div className="day-booking-color" style={{ backgroundColor: getResourceColor(b.location_resources?.resource_type) }} />
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
                        ⏱ {b.duration_type === 'full_day' ? 'Giornata intera' : 'Mezza giornata'}
                        {b.duration_type === 'half_day' && b.time_slot ? ` (${b.time_slot === 'morning' ? 'Mattina' : 'Pomeriggio'})` : ''}
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

  return (
    <div className="bookings-page">
      {/* Header */}
      <div className="bookings-header">
        <div className="bookings-header-content">
          <h1 className="bookings-title"><Calendar size={24} className="mr-2" />Calendario Prenotazioni</h1>
          <p className="bookings-description">
            {isCustomer ? 'Visualizza le tue prenotazioni attive' : 'Gestisci tutte le prenotazioni dei tuoi clienti'}
          </p>
        </div>
        <div className="bookings-controls">
          <div className="view-selector">
            <button className={`view-btn ${viewType === 'month' ? 'active' : ''}`} onClick={() => setViewType('month')}>Mese</button>
            <button className={`view-btn ${viewType === 'week' ? 'active' : ''}`} onClick={() => setViewType('week')}>Settimana</button>
            <button className={`view-btn ${viewType === 'day' ? 'active' : ''}`} onClick={() => setViewType('day')}>Giorno</button>
          </div>
          <button className="today-btn" onClick={goToToday}><Home size={16} />Oggi</button>
          {isPartnerAdmin && <button className="filter-btn" onClick={() => setShowFilters(!showFilters)}><Filter size={16} />Filtri</button>}
        </div>
      </div>

      {/* Filters */}
      {showFilters && isPartnerAdmin && (
        <div className="filters-panel">
          <div className="filters-row">
            <div className="filter-group">
              <label>Cliente:</label>
              <select value={filters.customer} onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}>
                <option value="">Tutti i clienti</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || `${c.first_name} ${c.second_name}`}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Tipo Risorsa:</label>
              <select value={filters.resourceType} onChange={(e) => setFilters(prev => ({ ...prev, resourceType: e.target.value }))}>
                <option value="">Tutte le risorse</option>
                <option value="scrivania">🪑 Scrivanie</option>
                <option value="sala_riunioni">🏢 Sale Riunioni</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Sede:</label>
              <select value={filters.location} onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}>
                <option value="">Tutte le sedi</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
              </select>
            </div>
            <button className="clear-filters-btn" onClick={() => setFilters({ customer: '', resourceType: '', location: '' })}>Pulisci Filtri</button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="calendar-navigation">
        <button className="nav-btn" onClick={() => navigateDate(-1)}><ChevronLeft size={20} /></button>
        <h2 className="calendar-title">{viewType === 'month' ? formatMonthYear(currentDate) : formatDisplayDate(currentDate)}</h2>
        <button className="nav-btn" onClick={() => navigateDate(1)}><ChevronRight size={20} /></button>
      </div>

      {/* Calendar */}
      <div className="calendar-container">
        {filteredBookings.length === 0 ? (
          <div className="day-no-bookings">
            <Calendar size={48} className="empty-icon" />
            <p>Nessuna prenotazione trovata per il periodo selezionato</p>
          </div>
        ) : (
          <>
            {viewType === 'month' && renderMonthView()}
            {viewType === 'day' && renderDayView()}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <h4>Legenda:</h4>
        <div className="legend-items">
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div><span>🪑 Scrivanie</span></div>
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div><span>🏢 Sale Riunioni</span></div>
        </div>
      </div>
    </div>
  );
};

export default Bookings;
