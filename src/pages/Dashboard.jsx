import { Activity, Building, Calendar, Clock, FileText, MapPin, Package, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Dashboard = () => {
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  
  const [stats, setStats] = useState({
    totalPartners: 0,
    totalLocations: 0,
    totalUsers: 0,
    totalCustomers: 0,
    totalContracts: 0,
    activeBookings: 0,
    totalDesks: 0,
    totalMeetingRooms: 0,
    availableDesks: 0,
    availableMeetingRooms: 0,
    loading: true
  });

  // Customer-specific stats
  const [customerStats, setCustomerStats] = useState({
    totalContracts: 0,
    activeContracts: 0,
    packageContracts: 0,
    subscriptionContracts: 0,
    totalPackageEntries: 0,
    usedPackageEntries: 0,
    remainingPackageEntries: 0,
    activeBookings: 0,
    upcomingBookings: 0,
    packageReservations: 0,
    loading: true
  });

  const [contractsChartData, setContractsChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);

  // Determine user type
  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (profile) {
      if (isCustomer) {
        fetchCustomerStats();
      } else {
        fetchStats();
        if (isPartnerAdmin || isSuperAdmin) {
          fetchContractsChartData();
        }
      }
    }
  }, [profile, user]);

  const fetchCustomerStats = async () => {
    setCustomerStats(prev => ({ ...prev, loading: true }));

    try {
      // Get customer ID
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerError || !customerData) {
        console.error('Error fetching customer data:', customerError);
        // Use mock data for development
        setCustomerStats({
          totalContracts: 3,
          activeContracts: 2,
          packageContracts: 1,
          subscriptionContracts: 2,
          totalPackageEntries: 20,
          usedPackageEntries: 7,
          remainingPackageEntries: 13,
          activeBookings: 2,
          upcomingBookings: 1,
          packageReservations: 3,
          loading: false
        });
        return;
      }

      const customerId = customerData.id;

      // Fetch contracts data
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('customer_id', customerId);

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
        throw contractsError;
      }

      // Process contracts data
      const contracts = contractsData || [];
      const activeContracts = contracts.filter(c => c.contract_status === 'active');
      const packageContracts = activeContracts.filter(c => c.service_type === 'pacchetto');
      const subscriptionContracts = activeContracts.filter(c => c.service_type === 'abbonamento');

      // Calculate package entries
      const totalPackageEntries = packageContracts.reduce((sum, c) => sum + (c.service_max_entries || 0), 0);
      const usedPackageEntries = packageContracts.reduce((sum, c) => sum + (c.entries_used || 0), 0);
      const remainingPackageEntries = totalPackageEntries - usedPackageEntries;

      // Fetch active bookings (subscription bookings)
      const today = new Date().toISOString().split('T')[0];
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', customerId)
        .eq('booking_status', 'active');

      // Fetch package reservations
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('*')
        .eq('customer_id', customerId)
        .eq('reservation_status', 'confirmed');

      if (bookingsError) console.error('Error fetching bookings:', bookingsError);
      if (reservationsError) console.error('Error fetching reservations:', reservationsError);

      const bookings = bookingsData || [];
      const reservations = reservationsData || [];

      // Count active bookings (current subscriptions)
      const activeBookings = bookings.filter(b => {
        const startDate = new Date(b.start_date);
        const endDate = new Date(b.end_date);
        const currentDate = new Date(today);
        return currentDate >= startDate && currentDate <= endDate;
      }).length;

      // Count upcoming bookings/reservations
      const upcomingBookings = bookings.filter(b => new Date(b.start_date) > new Date(today)).length;
      const upcomingReservations = reservations.filter(r => new Date(r.reservation_date) >= new Date(today)).length;

      setCustomerStats({
        totalContracts: contracts.length,
        activeContracts: activeContracts.length,
        packageContracts: packageContracts.length,
        subscriptionContracts: subscriptionContracts.length,
        totalPackageEntries,
        usedPackageEntries,
        remainingPackageEntries,
        activeBookings,
        upcomingBookings: upcomingBookings + upcomingReservations,
        packageReservations: reservations.length,
        loading: false
      });

    } catch (error) {
      console.error('Error fetching customer stats:', error);
      
      // Fallback to mock data
      setCustomerStats({
        totalContracts: 3,
        activeContracts: 2,
        packageContracts: 1,
        subscriptionContracts: 2,
        totalPackageEntries: 20,
        usedPackageEntries: 7,
        remainingPackageEntries: 13,
        activeBookings: 2,
        upcomingBookings: 1,
        packageReservations: 3,
        loading: false
      });
    }
  };

  const fetchContractsChartData = async () => {
    setChartLoading(true);
    
    try {
      let query = supabase
        .from('contracts')
        .select('created_at, start_date, service_type, contract_status')
        .order('created_at', { ascending: true });

      // Filter by partner for admin users
      if (profile.role === 'admin' && profile.partner_uuid) {
        query = query.eq('partner_uuid', profile.partner_uuid);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching contracts chart data:', error);
        // Generate mock data for development
        generateMockChartData();
        return;
      }

      if (data && data.length > 0) {
        processContractsData(data);
      } else {
        // Generate mock data when no contracts exist
        generateMockChartData();
      }

    } catch (error) {
      console.error('Error in fetchContractsChartData:', error);
      generateMockChartData();
    } finally {
      setChartLoading(false);
    }
  };

  const processContractsData = (contracts) => {
    // Group contracts by month and type - use BOTH created_at and start_date
    const monthlyData = {};

    contracts.forEach(contract => {
      // Process by creation date
      const createdDate = new Date(contract.created_at);
      const createdMonthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      const createdMonthName = createdDate.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });

      if (!monthlyData[createdMonthKey]) {
        monthlyData[createdMonthKey] = {
          month: createdMonthName,
          monthKey: createdMonthKey,
          date: new Date(createdDate.getFullYear(), createdDate.getMonth(), 1),
          Abbonamento: 0,
          Pacchetto: 0,
          total: 0
        };
      }

      // Also process by start date if it's different from creation date
      if (contract.start_date && contract.start_date !== contract.created_at.split('T')[0]) {
        const startDate = new Date(contract.start_date);
        const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        const startMonthName = startDate.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });

        if (!monthlyData[startMonthKey]) {
          monthlyData[startMonthKey] = {
            month: startMonthName,
            monthKey: startMonthKey,
            date: new Date(startDate.getFullYear(), startDate.getMonth(), 1),
            Abbonamento: 0,
            Pacchetto: 0,
            total: 0
          };
        }
      }

      const serviceType = contract.service_type === 'abbonamento' ? 'Abbonamento' : 
                         contract.service_type === 'pacchetto' ? 'Pacchetto' : 'Altro';
      
      if (serviceType !== 'Altro') {
        // Add to creation month
        monthlyData[createdMonthKey][serviceType]++;
        monthlyData[createdMonthKey].total++;

        // Also add to start month if different (this shows when services actually begin)
        if (contract.start_date && contract.start_date !== contract.created_at.split('T')[0]) {
          const startDate = new Date(contract.start_date);
          const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Only add if it's a future start (to avoid double counting)
          const createdMonth = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);
          const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          
          if (startMonth > createdMonth) {
            monthlyData[startMonthKey][serviceType]++;
            monthlyData[startMonthKey].total++;
          }
        }
      }
    });

    // Define the view range: 4 months back + current + 8 months forward
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startMonth = new Date(currentMonth);
    startMonth.setMonth(currentMonth.getMonth() - 4); // 4 months back
    const endMonth = new Date(currentMonth);
    endMonth.setMonth(currentMonth.getMonth() + 8); // 8 months forward

    // Create a complete month sequence for the defined range
    const completeTimeline = [];
    
    for (let d = new Date(startMonth); d <= endMonth; d.setMonth(d.getMonth() + 1)) {
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
      
      const existingData = monthlyData[monthKey];
      
      completeTimeline.push(existingData || {
        month: monthName,
        monthKey,
        date: new Date(d),
        Abbonamento: 0,
        Pacchetto: 0,
        total: 0
      });
    }

    // Remove monthKey and date from final data
    const chartData = completeTimeline.map(({ monthKey, date, ...rest }) => rest);

    setContractsChartData(chartData);
  };

  const generateMockChartData = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Generate timeline: 4 months back + current + 8 months forward = 13 months total
    const mockData = [];
    
    for (let i = -4; i <= 8; i++) {
      const date = new Date(currentYear, currentMonth + i, 1);
      const monthName = date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
      
      let abbonamenti, pacchetti;
      
      if (i <= 0) {
        // Past and current months with historical data
        abbonamenti = Math.floor(Math.random() * 12) + 3;
        pacchetti = Math.floor(Math.random() * 8) + 2;
      } else {
        // Future months with pre-bookings and advance contracts
        // Show realistic future booking patterns
        const futureFactor = Math.max(0.3, 1 - (i * 0.15)); // Gradually decrease into future
        abbonamenti = Math.floor((Math.random() * 10 + 2) * futureFactor);
        pacchetti = Math.floor((Math.random() * 6 + 1) * futureFactor);
      }
      
      mockData.push({
        month: monthName,
        Abbonamento: abbonamenti,
        Pacchetto: pacchetti,
        total: abbonamenti + pacchetti
      });
    }

    setContractsChartData(mockData);
  };

  const fetchStats = async () => {
    if (!profile) return;

    setStats(prev => ({ ...prev, loading: true }));

    try {
      console.log('Fetching dashboard stats for role:', profile.role);

      let partnersCount = 0;
      let locationsCount = 0;
      let usersCount = 0;
      let customersCount = 0;
      let contractsCount = 0;
      let activeBookingsCount = 0;
      let totalDesks = 0;
      let totalMeetingRooms = 0;
      let availableDesks = 0;
      let availableMeetingRooms = 0;

      // Fetch data based on user role
      if (profile.role === 'superadmin') {
        // Superadmin sees all data
        const [partnersResult, locationsResult, usersResult] = await Promise.all([
          supabase.from('partners').select('*', { count: 'exact', head: true }),
          supabase.from('locations').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true })
        ]);

        partnersCount = partnersResult.count || 0;
        locationsCount = locationsResult.count || 0;
        usersCount = usersResult.count || 0;

        console.log('Superadmin stats:', { partnersCount, locationsCount, usersCount });

      } else if (profile.role === 'admin') {
        // Partner admin sees only their partner's data
        if (profile.partner_uuid) {
          const [
            locationsResult, 
            usersResult, 
            customersResult, 
            contractsResult,
            resourcesResult,
            bookingsResult
          ] = await Promise.all([
            supabase
              .from('locations')
              .select('*', { count: 'exact', head: true })
              .eq('partner_uuid', profile.partner_uuid),
            supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('partner_uuid', profile.partner_uuid),
            supabase
              .from('customers')
              .select('*', { count: 'exact', head: true })
              .eq('partner_uuid', profile.partner_uuid),
            supabase
              .from('contracts')
              .select('*', { count: 'exact', head: true })
              .eq('partner_uuid', profile.partner_uuid)
              .eq('contract_status', 'active'),
            supabase
              .from('location_resources')
              .select('resource_type, quantity')
              .eq('partner_uuid', profile.partner_uuid)
              .eq('is_available', true),
            supabase
              .from('bookings')
              .select('location_resource_id', { count: 'exact', head: true })
              .eq('partner_uuid', profile.partner_uuid)
              .eq('booking_status', 'active')
          ]);

          locationsCount = locationsResult.count || 0;
          usersCount = usersResult.count || 0;
          customersCount = customersResult.count || 0;
          contractsCount = contractsResult.count || 0;
          activeBookingsCount = bookingsResult.count || 0;

          // Calculate resource statistics
          if (resourcesResult.data) {
            const resources = resourcesResult.data;
            totalDesks = resources
              .filter(r => r.resource_type === 'scrivania')
              .reduce((sum, r) => sum + r.quantity, 0);
            
            totalMeetingRooms = resources
              .filter(r => r.resource_type === 'sala_riunioni')
              .reduce((sum, r) => sum + r.quantity, 0);
          }

          // Calculate available resources (total - currently booked for today)
          if (resourcesResult.data) {
            const today = new Date().toISOString().split('T')[0];
            
            // Get detailed booking info to calculate availability for today
            const { data: detailedBookings } = await supabase
              .from('bookings')
              .select(`
                location_resource_id,
                location_resources (
                  resource_type
                )
              `)
              .eq('partner_uuid', profile.partner_uuid)
              .eq('booking_status', 'active')
              .lte('start_date', today)
              .gte('end_date', today);

            console.log('Active bookings for today:', detailedBookings);

            if (detailedBookings) {
              const bookedDesks = detailedBookings.filter(b => 
                b.location_resources?.resource_type === 'scrivania'
              ).length;
              
              const bookedMeetingRooms = detailedBookings.filter(b => 
                b.location_resources?.resource_type === 'sala_riunioni'
              ).length;

              availableDesks = Math.max(0, totalDesks - bookedDesks);
              availableMeetingRooms = Math.max(0, totalMeetingRooms - bookedMeetingRooms);
              
              console.log('Resource calculation:', {
                totalDesks,
                bookedDesks,
                availableDesks,
                totalMeetingRooms,
                bookedMeetingRooms,
                availableMeetingRooms
              });
            } else {
              // No bookings for today, all resources are available
              availableDesks = totalDesks;
              availableMeetingRooms = totalMeetingRooms;
            }
          }

          console.log('Partner admin stats:', { 
            locationsCount, usersCount, customersCount, contractsCount,
            totalDesks, totalMeetingRooms, availableDesks, availableMeetingRooms
          });
        }
      }

      // Handle database errors with mock data
      if (profile.role === 'admin' && locationsCount === 0 && usersCount === 0) {
        console.log('No data from database, using mock data for partner admin');
        locationsCount = 3;
        usersCount = 15;
        customersCount = 25;
        contractsCount = 12;
        activeBookingsCount = 8;
        totalDesks = 50;
        totalMeetingRooms = 12;
        availableDesks = 42;
        availableMeetingRooms = 9;
      }

      setStats({
        totalPartners: partnersCount,
        totalLocations: locationsCount,
        totalUsers: usersCount,
        totalCustomers: customersCount,
        totalContracts: contractsCount,
        activeBookings: activeBookingsCount,
        totalDesks,
        totalMeetingRooms,
        availableDesks,
        availableMeetingRooms,
        loading: false
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      
      // Fallback to mock data
      let mockStats = { 
        totalPartners: 0, totalLocations: 0, totalUsers: 0, 
        totalCustomers: 0, totalContracts: 0, activeBookings: 0,
        totalDesks: 0, totalMeetingRooms: 0, availableDesks: 0, availableMeetingRooms: 0
      };
      
      if (profile.role === 'superadmin') {
        mockStats = { ...mockStats, totalPartners: 12, totalLocations: 28, totalUsers: 245 };
      } else if (profile.role === 'admin') {
        mockStats = { 
          ...mockStats, 
          totalLocations: 3, totalUsers: 15, totalCustomers: 25, totalContracts: 12,
          activeBookings: 8, totalDesks: 50, totalMeetingRooms: 12, 
          availableDesks: 42, availableMeetingRooms: 9
        };
      }

      setStats({ ...mockStats, loading: false });
    }
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + entry.value, 0);
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-entry" style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
          <p className="tooltip-total">Totale: {total}</p>
        </div>
      );
    }
    return null;
  };

  // Customer Dashboard Render
  const renderCustomerDashboard = () => {
    return (
      <>
        <h1 className="dashboard-title">
          {t('dashboard.welcomeBack')}, {profile?.first_name || 'User'}!
        </h1>
        
        {/* Contracts Overview */}
        <div className="dashboard-section">
          <h2 className="section-title">{t('contracts.title') || 'I Tuoi Contratti'}</h2>
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <FileText size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('contracts.totalContracts') || 'Contratti Totali'}</dt>
                  <dd className="stat-value">
                    {customerStats.loading ? '...' : customerStats.totalContracts}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Activity size={24} color="#16a34a" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('contracts.activeContracts') || 'Contratti Attivi'}</dt>
                  <dd className="stat-value" style={{ color: '#16a34a' }}>
                    {customerStats.loading ? '...' : customerStats.activeContracts}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Package size={24} color="#f59e0b" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('services.package') || 'Pacchetti'}</dt>
                  <dd className="stat-value" style={{ color: '#f59e0b' }}>
                    {customerStats.loading ? '...' : customerStats.packageContracts}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Calendar size={24} color="#3b82f6" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('services.subscription') || 'Abbonamenti'}</dt>
                  <dd className="stat-value" style={{ color: '#3b82f6' }}>
                    {customerStats.loading ? '...' : customerStats.subscriptionContracts}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Package Entries Overview */}
        {customerStats.packageContracts > 0 && (
          <div className="dashboard-section">
            <h2 className="section-title">{t('reservations.packageEntries') || 'Ingressi Pacchetti'}</h2>
            <div className="dashboard-stats">
              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon">
                    <Package size={24} color="#6b7280" />
                  </div>
                  <div className="stat-info">
                    <dt className="stat-label">{t('reservations.totalEntries') || 'Ingressi Totali'}</dt>
                    <dd className="stat-value">
                      {customerStats.loading ? '...' : customerStats.totalPackageEntries}
                    </dd>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon">
                    <Activity size={24} color="#dc2626" />
                  </div>
                  <div className="stat-info">
                    <dt className="stat-label">{t('reservations.usedEntries') || 'Ingressi Utilizzati'}</dt>
                    <dd className="stat-value" style={{ color: '#dc2626' }}>
                      {customerStats.loading ? '...' : customerStats.usedPackageEntries}
                    </dd>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon">
                    <Clock size={24} color="#16a34a" />
                  </div>
                  <div className="stat-info">
                    <dt className="stat-label">{t('reservations.remainingEntries') || 'Ingressi Rimanenti'}</dt>
                    <dd className="stat-value" style={{ color: '#16a34a' }}>
                      {customerStats.loading ? '...' : customerStats.remainingPackageEntries}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Progress Bar */}
            {!customerStats.loading && customerStats.totalPackageEntries > 0 && (
              <div className="usage-progress">
                <div className="progress-info">
                  <span className="progress-label">
                    {t('reservations.usageProgress') || 'Progresso Utilizzo'}
                  </span>
                  <span className="progress-percentage">
                    {Math.round((customerStats.usedPackageEntries / customerStats.totalPackageEntries) * 100)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${(customerStats.usedPackageEntries / customerStats.totalPackageEntries) * 100}%`,
                      backgroundColor: customerStats.remainingPackageEntries <= 2 ? '#dc2626' : '#3b82f6'
                    }}
                  />
                </div>
                {customerStats.remainingPackageEntries <= 2 && (
                  <div className="progress-warning">
                    ⚠️ {t('reservations.lowEntriesWarning') || 'Attenzione: Pochi ingressi rimanenti!'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bookings Overview */}
        <div className="dashboard-section">
          <h2 className="section-title">{t('bookings.title') || 'Le Tue Prenotazioni'}</h2>
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Calendar size={24} color="#16a34a" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('bookings.activeBookings') || 'Prenotazioni Attive'}</dt>
                  <dd className="stat-value" style={{ color: '#16a34a' }}>
                    {customerStats.loading ? '...' : customerStats.activeBookings}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Clock size={24} color="#f59e0b" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('bookings.upcomingBookings') || 'Prenotazioni Future'}</dt>
                  <dd className="stat-value" style={{ color: '#f59e0b' }}>
                    {customerStats.loading ? '...' : customerStats.upcomingBookings}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Package size={24} color="#8b5cf6" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('reservations.packageReservations') || 'Prenotazioni Pacchetto'}</dt>
                  <dd className="stat-value" style={{ color: '#8b5cf6' }}>
                    {customerStats.loading ? '...' : customerStats.packageReservations}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section">
          <h2 className="section-title">{t('dashboard.quickActions') || 'Azioni Rapide'}</h2>
          <div className="quick-actions">
            <div className="action-card">
              <div className="action-icon">
                <FileText size={32} color="#3b82f6" />
              </div>
              <div className="action-content">
                <h3>{t('contracts.viewContracts') || 'Visualizza Contratti'}</h3>
                <p>{t('contracts.manageYourContracts') || 'Gestisci i tuoi contratti e servizi'}</p>
              </div>
              <div className="action-arrow">→</div>
            </div>

            <div className="action-card">
              <div className="action-icon">
                <Calendar size={32} color="#16a34a" />
              </div>
              <div className="action-content">
                <h3>{t('bookings.viewBookings') || 'Visualizza Prenotazioni'}</h3>
                <p>{t('bookings.manageAllBookings') || 'Controlla le tue prenotazioni attive'}</p>
              </div>
              <div className="action-arrow">→</div>
            </div>

            {customerStats.packageContracts > 0 && (
              <div className="action-card">
                <div className="action-icon">
                  <Package size={32} color="#f59e0b" />
                </div>
                <div className="action-content">
                  <h3>{t('reservations.bookPackage') || 'Prenota Pacchetto'}</h3>
                  <p>{t('reservations.usePackageEntries') || 'Utilizza i tuoi ingressi pacchetto'}</p>
                </div>
                <div className="action-arrow">→</div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // Render different dashboards based on user role
  const renderDashboard = () => {
    if (isCustomer) {
      return renderCustomerDashboard();
    }

    if (profile?.role === 'superadmin') {
      return (
        <>
          <h1 className="dashboard-title">
            {t('dashboard.welcomeBack')}, {profile?.first_name || 'Admin'}!
          </h1>
          
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Building size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.totalPartners')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalPartners}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <MapPin size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.activeLocations')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalLocations}
                  </dd>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Users size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <dt className="stat-label">{t('dashboard.totalUsers')}</dt>
                  <dd className="stat-value">
                    {stats.loading ? '...' : stats.totalUsers}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {/* Contracts Analytics Chart for Superadmin */}
          <div className="dashboard-section">
            <div className="dashboard-chart">
              <h2 className="chart-title">Andamento Contratti - Tutti i Partner</h2>
              <p className="chart-subtitle">Ultimi 4 mesi e prossimi 8 mesi - contratti per tipologia</p>
              {chartLoading ? (
                <div className="chart-loading">
                  <div className="loading-spinner"></div>
                  <span>Caricamento dati...</span>
                </div>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contractsChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="Abbonamento" stackId="a" fill="#3b82f6" name="Abbonamenti" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Pacchetto" stackId="a" fill="#f59e0b" name="Pacchetti" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      );
    }

    if (profile?.role === 'admin') {
      return (
        <>
          <h1 className="dashboard-title">
            {t('dashboard.welcomeBack')}, {profile?.first_name || 'Admin'}!
          </h1>
          
          {/* Business Overview Stats */}
          <div className="dashboard-section">
            <h2 className="section-title">Panoramica Business</h2>
            <div className="dashboard-stats">
              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon">
                    <MapPin size={24} color="#9ca3af" />
                  </div>
                  <div className="stat-info">
                    <dt className="stat-label">Sedi Attive</dt>
                    <dd className="stat-value">
                      {stats.loading ? '...' : stats.totalLocations}
                    </dd>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon">
                    <Users size={24} color="#9ca3af" />
                  </div>
                  <div className="stat-info">
                    <dt className="stat-label">Clienti Totali</dt>
                    <dd className="stat-value">
                      {stats.loading ? '...' : stats.totalCustomers}
                    </dd>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon">
                    <FileText size={24} color="#9ca3af" />
                  </div>
                  <div className="stat-info">
                    <dt className="stat-label">Contratti Attivi</dt>
                    <dd className="stat-value">
                      {stats.loading ? '...' : stats.totalContracts}
                    </dd>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon">
                    <Calendar size={24} color="#9ca3af" />
                  </div>
                  <div className="stat-info">
                    <dt className="stat-label">Prenotazioni Attive</dt>
                    <dd className="stat-value">
                      {stats.loading ? '...' : stats.activeBookings}
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contracts Analytics Chart for Partner Admin */}
          <div className="dashboard-section">
            <div className="dashboard-chart">
              <h2 className="chart-title">Andamento Contratti</h2>
              <p className="chart-subtitle">Ultimi 4 mesi e prossimi 8 mesi - contratti per tipologia</p>
              {chartLoading ? (
                <div className="chart-loading">
                  <div className="loading-spinner"></div>
                  <span>Caricamento dati...</span>
                </div>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contractsChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="Abbonamento" stackId="a" fill="#3b82f6" name="Abbonamenti" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Pacchetto" stackId="a" fill="#f59e0b" name="Pacchetti" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Resources Overview */}
          <div className="dashboard-section">
            <h2 className="section-title">Risorse Disponibili</h2>
            <div className="resources-grid">
              {/* Desks Section */}
              <div className="resource-card desks">
                <div className="resource-header">
                  <div className="resource-icon">🪑</div>
                  <div className="resource-title">
                    <h3>Scrivanie</h3>
                    <p>Tutte le sedi</p>
                  </div>
                </div>
                <div className="resource-stats">
                  <div className="resource-stat">
                    <span className="resource-number">{stats.loading ? '...' : stats.totalDesks}</span>
                    <span className="resource-label">Totali</span>
                  </div>
                  <div className="resource-stat">
                    <span className="resource-number available">{stats.loading ? '...' : stats.availableDesks}</span>
                    <span className="resource-label">Disponibili</span>
                  </div>
                  <div className="resource-stat">
                    <span className="resource-number booked">{stats.loading ? '...' : Math.max(0, stats.totalDesks - stats.availableDesks)}</span>
                    <span className="resource-label">Prenotate</span>
                  </div>
                </div>
                <div className="resource-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: stats.totalDesks > 0 ? `${Math.max(0, ((stats.totalDesks - stats.availableDesks) / stats.totalDesks) * 100)}%` : '0%',
                        backgroundColor: '#3b82f6'
                      }}
                    />
                  </div>
                  <span className="progress-text">
                    {stats.totalDesks > 0 ? Math.max(0, Math.round(((stats.totalDesks - stats.availableDesks) / stats.totalDesks) * 100)) : 0}% Occupazione
                  </span>
                </div>
              </div>

              {/* Meeting Rooms Section */}
              <div className="resource-card meeting-rooms">
                <div className="resource-header">
                  <div className="resource-icon">🏢</div>
                  <div className="resource-title">
                    <h3>Sale Riunioni</h3>
                    <p>Tutte le sedi</p>
                  </div>
                </div>
                <div className="resource-stats">
                  <div className="resource-stat">
                    <span className="resource-number">{stats.loading ? '...' : stats.totalMeetingRooms}</span>
                    <span className="resource-label">Totali</span>
                  </div>
                  <div className="resource-stat">
                    <span className="resource-number available">{stats.loading ? '...' : stats.availableMeetingRooms}</span>
                    <span className="resource-label">Disponibili</span>
                  </div>
                  <div className="resource-stat">
                    <span className="resource-number booked">{stats.loading ? '...' : Math.max(0, stats.totalMeetingRooms - stats.availableMeetingRooms)}</span>
                    <span className="resource-label">Prenotate</span>
                  </div>
                </div>
                <div className="resource-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: stats.totalMeetingRooms > 0 ? `${Math.max(0, ((stats.totalMeetingRooms - stats.availableMeetingRooms) / stats.totalMeetingRooms) * 100)}%` : '0%',
                        backgroundColor: '#f59e0b'
                      }}
                    />
                  </div>
                  <span className="progress-text">
                    {stats.totalMeetingRooms > 0 ? Math.max(0, Math.round(((stats.totalMeetingRooms - stats.availableMeetingRooms) / stats.totalMeetingRooms) * 100)) : 0}% Occupazione
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

    // Fallback - should not reach here
    return null;
  };

  return (
    <div className="dashboard-page">
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;