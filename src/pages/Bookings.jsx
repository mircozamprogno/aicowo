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
  const [viewType, setViewType] = useState('month'); // 'month', 'week', 'day'
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
  }, [profile]); // Remove currentDate and viewType dependency

  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
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

      // Apply role-based filtering
      if (isCustomer) {
        // Get customer ID first
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (customerData) {
          query = query.eq('customer_id', customerData.id);
        }
      } else if (isPartnerAdmin) {
        query = query.eq('partner_uuid', profile.partner_uuid);
      }

      // Fetch all bookings without date filtering here
      // Date filtering will be done in the view functions
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching bookings:', error);
        toast.error('Error loading bookings');
        setBookings([]);
      } else {
        console.log('Fetched bookings:', data);
        setBookings(data || []);
      }
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
      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, first_name, second_name, company_name')
        .eq('partner_uuid', profile.partner_uuid)
        .order('first_name');

      // Fetch locations
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

  const getMockBookings = () => {
    const today = new Date();
    return [
      {
        id: 1,
        booking_uuid: 'mock-1',
        start_date: formatDate(today),
        end_date: formatDate(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)),
        contracts: {
          contract_number: 'CONT-20250108-0001',
          service_name: 'Hot Desk Monthly',
          service_cost: 200,
          service_currency: 'EUR'
        },
        location_resources: {
          resource_name: 'Hot Desks Area A',
          resource_type: 'scrivania',
          locations: { location_name: 'Milano Centro' }
        },
        customers: {
          first_name: 'Mario',
          second_name: 'Rossi',
          company_name: null
        }
      },
      {
        id: 2,
        booking_uuid: 'mock-2',
        start_date: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
        end_date: formatDate(new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000)),
        contracts: {
          contract_number: 'CONT-20250108-0002',
          service_name: 'Meeting Room Package',
          service_cost: 150,
          service_currency: 'EUR'
        },
        location_resources: {
          resource_name: 'Small Meeting Room',
          resource_type: 'sala_riunioni',
          locations: { location_name: 'Milano Centro' }
        },
        customers: {
          first_name: 'Anna',
          second_name: 'Verdi',
          company_name: 'Verdi SRL'
        }
      }
    ];
  };

  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    switch (viewType) {
      case 'month':
        start.setDate(1);
        start.setMonth(start.getMonth() - 1); // Include previous month for better coverage
        end.setMonth(end.getMonth() + 2);
        end.setDate(0); // Last day of next month
        break;
      case 'week':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        end.setDate(start.getDate() + 6);
        break;
      case 'day':
        end.setDate(start.getDate());
        break;
    }
    
    return {
      start: formatDate(start),
      end: formatDate(end)
    };
  };

  const applyFilters = () => {
    let filtered = [...bookings];
    
    if (filters.customer) {
      filtered = filtered.filter(booking => 
        booking.customers?.id.toString() === filters.customer
      );
    }
    
    if (filters.resourceType) {
      filtered = filtered.filter(booking => 
        booking.location_resources?.resource_type === filters.resourceType
      );
    }
    
    if (filters.location) {
      filtered = filtered.filter(booking => 
        booking.location_resources?.locations?.id.toString() === filters.location
      );
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
    
    switch (viewType) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction * 7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + direction);
        break;
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getResourceColor = (resourceType) => {
    const colors = {
      'scrivania': '#3b82f6', // Blue for desks
      'sala_riunioni': '#f59e0b' // Orange for meeting rooms
    };
    return colors[resourceType] || '#6b7280';
  };

  const getBookingsForDate = (date) => {
    const dateStr = formatDate(date);
    console.log('Getting bookings for date:', dateStr, 'Total bookings:', filteredBookings.length);
    
    const dayBookings = filteredBookings.filter(booking => {
      const startDate = new Date(booking.start_date);
      const endDate = new Date(booking.end_date);
      const checkDate = new Date(date);
      
      // Reset all times to start of day for accurate comparison
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      
      const isInRange = checkDate >= startDate && checkDate <= endDate;
      if (isInRange) {
        console.log('Booking in range for', dateStr, ':', booking.contracts?.contract_number);
      }
      
      return isInRange;
    });
    
    console.log('Found', dayBookings.length, 'bookings for', dateStr);
    return dayBookings;
  };

  const handleBookingClick = (booking) => {
    if (isPartnerAdmin) {
      // TODO: Open edit contract modal
      console.log('Edit contract:', booking.contracts?.id);
    } else {
      // TODO: Open view contract modal
      console.log('View contract:', booking.contracts?.id);
    }
  };

  const renderMonthView = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDateForLoop = new Date(startDate);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDateForLoop));
      currentDateForLoop.setDate(currentDateForLoop.getDate() + 1);
    }

    return (
      <div className="calendar-month">
        <div className="calendar-weekdays">
          {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>
        <div className="calendar-days">
          {days.map((day, index) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = formatDate(day) === formatDate(new Date());
            const dayBookings = getBookingsForDate(day);
            
            return (
              <div 
                key={index} 
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => {
                  setCurrentDate(new Date(day));
                  setViewType('day');
                }}
              >
                <div className="calendar-day-number">{day.getDate()}</div>
                <div className="calendar-day-bookings">
                  {dayBookings.slice(0, 3).map((booking, idx) => (
                    <div
                      key={booking.id}
                      className="calendar-booking-item"
                      style={{ backgroundColor: getResourceColor(booking.location_resources?.resource_type) }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookingClick(booking);
                      }}
                      title={`${booking.customers?.company_name || 
                        `${booking.customers?.first_name} ${booking.customers?.second_name}`} - ${booking.location_resources?.resource_name}`}
                    >
                      <span className="booking-title">
                        {booking.customers?.company_name || booking.customers?.first_name}
                      </span>
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="calendar-more-bookings">
                      +{dayBookings.length - 3} more
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
          {weekDays.map(day => {
            const isToday = formatDate(day) === formatDate(new Date());
            return (
              <div key={formatDate(day)} className={`calendar-week-day-header ${isToday ? 'today' : ''}`}>
                <div className="week-day-name">
                  {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                </div>
                <div className="week-day-number">{day.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="calendar-week-content">
          {weekDays.map(day => {
            const dayBookings = getBookingsForDate(day);
            const isToday = formatDate(day) === formatDate(new Date());
            
            return (
              <div 
                key={formatDate(day)} 
                className={`calendar-week-day ${isToday ? 'today' : ''}`}
                onClick={() => {
                  setCurrentDate(new Date(day));
                  setViewType('day');
                }}
              >
                <div className="week-day-bookings">
                  {dayBookings.map(booking => (
                    <div
                      key={booking.id}
                      className="week-booking-item"
                      style={{ backgroundColor: getResourceColor(booking.location_resources?.resource_type) }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookingClick(booking);
                      }}
                    >
                      <div className="week-booking-title">
                        {booking.customers?.company_name || booking.customers?.first_name}
                      </div>
                      <div className="week-booking-resource">
                        {booking.location_resources?.resource_name}
                      </div>
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
              {dayBookings.map(booking => (
                <div
                  key={booking.id}
                  className="day-booking-card"
                  onClick={() => handleBookingClick(booking)}
                >
                  <div className="day-booking-header">
                    <div 
                      className="day-booking-color"
                      style={{ backgroundColor: getResourceColor(booking.location_resources?.resource_type) }}
                    />
                    <div className="day-booking-info">
                      <h3>{booking.customers?.company_name || 
                        `${booking.customers?.first_name} ${booking.customers?.second_name}`}
                      </h3>
                      <p>{booking.contracts?.contract_number}</p>
                    </div>
                    <div className="day-booking-cost">
                      {new Intl.NumberFormat('it-IT', {
                        style: 'currency',
                        currency: booking.contracts?.service_currency || 'EUR'
                      }).format(booking.contracts?.service_cost || 0)}
                    </div>
                  </div>
                  <div className="day-booking-details">
                    <div className="day-booking-service">
                      <strong>{booking.contracts?.service_name}</strong>
                    </div>
                    <div className="day-booking-resource">
                      {getResourceTypeIcon(booking.location_resources?.resource_type)} {' '}
                      {booking.location_resources?.resource_name}
                    </div>
                    <div className="day-booking-location">
                      📍 {booking.location_resources?.locations?.location_name}
                    </div>
                    <div className="day-booking-period">
                      📅 {formatDate(new Date(booking.start_date))} - {formatDate(new Date(booking.end_date))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const getResourceTypeIcon = (type) => {
    return type === 'scrivania' ? '🪑' : '🏢';
  };

  const getViewTitle = () => {
    switch (viewType) {
      case 'month':
        return formatMonthYear(currentDate);
      case 'week':
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `${startOfWeek.getDate()}-${endOfWeek.getDate()} ${formatMonthYear(currentDate)}`;
      case 'day':
        return formatDisplayDate(currentDate);
      default:
        return '';
    }
  };

  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      customer: '',
      resourceType: '',
      location: ''
    });
  };

  if (loading) {
    return <div className="bookings-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="bookings-page">
      <div className="bookings-header">
        <div className="bookings-header-content">
          <h1 className="bookings-title">
            <Calendar size={24} className="mr-2" />
            Calendario Prenotazioni
          </h1>
          <p className="bookings-description">
            {isCustomer 
              ? 'Visualizza le tue prenotazioni attive'
              : 'Gestisci tutte le prenotazioni dei tuoi clienti'
            }
          </p>
        </div>
        
        <div className="bookings-controls">
          {/* View Type Selector */}
          <div className="view-selector">
            <button
              className={`view-btn ${viewType === 'month' ? 'active' : ''}`}
              onClick={() => setViewType('month')}
            >
              Mese
            </button>
            <button
              className={`view-btn ${viewType === 'week' ? 'active' : ''}`}
              onClick={() => setViewType('week')}
            >
              Settimana
            </button>
            <button
              className={`view-btn ${viewType === 'day' ? 'active' : ''}`}
              onClick={() => setViewType('day')}
            >
              Giorno
            </button>
          </div>

          {/* Today Button */}
          <button className="today-btn" onClick={goToToday}>
            <Home size={16} />
            Oggi
          </button>

          {/* Filters for Partner Admin */}
          {isPartnerAdmin && (
            <button 
              className="filter-btn"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              Filtri
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && isPartnerAdmin && (
        <div className="filters-panel">
          <div className="filters-row">
            <div className="filter-group">
              <label>Cliente:</label>
              <select 
                value={filters.customer} 
                onChange={(e) => handleFilterChange('customer', e.target.value)}
              >
                <option value="">Tutti i clienti</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name || `${customer.first_name} ${customer.second_name}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Tipo Risorsa:</label>
              <select 
                value={filters.resourceType} 
                onChange={(e) => handleFilterChange('resourceType', e.target.value)}
              >
                <option value="">Tutte le risorse</option>
                <option value="scrivania">🪑 Scrivanie</option>
                <option value="sala_riunioni">🏢 Sale Riunioni</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Sede:</label>
              <select 
                value={filters.location} 
                onChange={(e) => handleFilterChange('location', e.target.value)}
              >
                <option value="">Tutte le sedi</option>
                {locations.map(location => (
                  <option key={location.id} value={location.id}>
                    {location.location_name}
                  </option>
                ))}
              </select>
            </div>
            
            <button className="clear-filters-btn" onClick={clearFilters}>
              Pulisci Filtri
            </button>
          </div>
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="calendar-navigation">
        <button className="nav-btn" onClick={() => navigateDate(-1)}>
          <ChevronLeft size={20} />
        </button>
        
        <h2 className="calendar-title">{getViewTitle()}</h2>
        
        <button className="nav-btn" onClick={() => navigateDate(1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Content */}
      <div className="calendar-container">
        {filteredBookings.length === 0 && !loading ? (
          <div className="day-no-bookings">
            <Calendar size={48} className="empty-icon" />
            <p>Nessuna prenotazione trovata per il periodo selezionato</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#9ca3af' }}>
              Debug: Fetched {bookings.length} bookings, filtered to {filteredBookings.length}
            </p>
          </div>
        ) : (
          <>
            {viewType === 'month' && renderMonthView()}
            {viewType === 'week' && renderWeekView()}
            {viewType === 'day' && renderDayView()}
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
              Debug Info: {bookings.length} total bookings loaded, {filteredBookings.length} after filters
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <h4>Legenda:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>🪑 Scrivanie</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>🏢 Sale Riunioni</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bookings;