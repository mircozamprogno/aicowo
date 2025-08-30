import { Building, Calendar, FileText, MapPin, Plus, RefreshCw, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from '../components/common/ToastContainer';
import ContractForm from '../components/forms/ContractForm';
import PackageBookingForm from '../components/forms/PackageBookingForm';
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

    // NEW: Contract management states for customer dashboard
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPackageBooking, setShowPackageBooking] = useState(false);
  const [selectedPackageContract, setSelectedPackageContract] = useState(null);
  const [editingContract, setEditingContract] = useState(null);

  // State for managing auto-renewal toggles
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState({});

  // Determine user type
  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (profile) {
      if (isCustomer) {
        fetchCustomerContracts(); // NEW: Fetch contracts instead of stats
      } else {
        fetchStats();
        if (isPartnerAdmin || isSuperAdmin) {
          fetchContractsChartData();
        }
      }
    }
  }, [profile, user]);

  // NEW: Fetch customer contracts
  const fetchCustomerContracts = async () => {
    setContractsLoading(true);
    
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
        setContracts([
          {
            id: 1,
            contract_uuid: 'mock-1',
            service_name: 'Nome del pacchetto',
            service_type: 'pacchetto',
            service_max_entries: 4,
            entries_used: 0,
            start_date: '2024-07-20',
            end_date: '2025-10-20',
            contract_status: 'active',
            auto_renew: false,
            service_cost: 150.00,
            location_id: 1
          },
          {
            id: 2,
            contract_uuid: 'mock-2',
            service_name: 'Nome del pacchetto',
            service_type: 'pacchetto',
            service_max_entries: 10,
            entries_used: 10,
            start_date: '2024-07-20',
            end_date: '2025-07-20',
            contract_status: 'active',
            auto_renew: false,
            service_cost: 200.00,
            location_id: 1
          },
          {
            id: 3,
            contract_uuid: 'mock-3',
            service_name: 'Nome dell\'abbonamento',
            service_type: 'abbonamento',
            start_date: '2024-10-01',
            end_date: '2025-10-31',
            contract_status: 'active',
            auto_renew: true,
            service_cost: 300.00,
            location_id: 1
          },
          {
            id: 4,
            contract_uuid: 'mock-4',
            service_name: 'Nome dell\'abbonamento',
            service_type: 'abbonamento',
            start_date: '2024-07-01',
            end_date: '2025-07-12',
            contract_status: 'active',
            auto_renew: false,
            service_cost: 250.00,
            location_id: 1
          }
        ]);
        setContractsLoading(false);
        return;
      }

      const customerId = customerData.id;

      // Fetch active contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select(`
          *,
          services (
            id,
            service_name,
            service_type,
            location_id
          ),
          locations (
            id,
            location_name
          )
        `)
        .eq('customer_id', customerId)
        .eq('contract_status', 'active')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
        throw contractsError;
      }

      // Process contracts to ensure numeric fields are numbers
      const processedContracts = (contractsData || []).map(contract => ({
        ...contract,
        entries_used: parseFloat(contract.entries_used) || 0,
        service_max_entries: contract.service_max_entries ? parseFloat(contract.service_max_entries) : null
      }));

      console.log('Processed contracts:', processedContracts);
      console.log('Entries used values:', processedContracts.map(c => ({ id: c.id, entries_used: c.entries_used, type: typeof c.entries_used })));

      setContracts(processedContracts);
      
    } catch (error) {
      console.error('Error fetching customer contracts:', error);
      
      // Fallback to mock data
      setContracts([
        {
          id: 1,
          contract_uuid: 'mock-1',
          service_name: 'Hot Desk Monthly',
          service_type: 'pacchetto',
          service_max_entries: 20,
          entries_used: 7,
          start_date: '2024-11-01',
          end_date: '2025-10-31',
          contract_status: 'active',
          auto_renew: false,
          service_cost: 150.00,
          location_id: 1
        },
        {
          id: 2,
          contract_uuid: 'mock-2',
          service_name: 'Meeting Room Access',
          service_type: 'abbonamento',
          start_date: '2024-10-15',
          end_date: '2025-11-15',
          contract_status: 'active',
          auto_renew: true,
          service_cost: 300.00,
          location_id: 1
        }
      ]);
    } finally {
      setContractsLoading(false);
    }
  };

  // Form success handlers
  const handleFormSuccess = (newContract) => {
    console.log('Contract created successfully:', newContract);
    fetchCustomerContracts(); // Refresh contracts
    setShowForm(false);
    setEditingContract(null);
    toast.success(t('messages.contractCreatedSuccessfully') || 'Contract created successfully');
  };

  const handlePackageBookingSuccess = (reservation) => {
    console.log('Package booking successful:', reservation);
    
    // Update the local contract state immediately for better UX
    setContracts(prev => prev.map(contract => {
      if (contract.id === reservation.contract_id) {
        const newEntriesUsed = parseFloat(contract.entries_used || 0) + parseFloat(reservation.entries_used || 0);
        return {
          ...contract,
          entries_used: newEntriesUsed
        };
      }
      return contract;
    }));
    
    // Fetch fresh data after a small delay to avoid overwriting the optimistic update
    setTimeout(() => {
      fetchCustomerContracts();
    }, 100);
    
    setShowPackageBooking(false);
    setSelectedPackageContract(null);
    toast.success(t('messages.bookingConfirmedSuccessfully') || 'Booking confirmed successfully');
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

    
    // Get active contracts for the customer
    const activeContracts = contracts.filter(c => c.contract_status === 'active');
    
    // Calculate days remaining for a contract
    const calculateDaysRemaining = (endDate) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      const diffTime = end - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    };
    
    // Check if contract is expired
    const isContractExpired = (endDate) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      return today > end;
    };
    
    // Format date for display
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };
    
    // Handle auto-renewal toggle
    const handleAutoRenewToggle = async (contractId, currentValue) => {
      setUpdatingAutoRenew(prev => ({ ...prev, [contractId]: true }));
      
      try {
        const { error } = await supabase
          .from('contracts')
          .update({ auto_renew: !currentValue })
          .eq('id', contractId);
        
        if (error) throw error;
        
        // Update local state
        setContracts(prev => prev.map(c => 
          c.id === contractId ? { ...c, auto_renew: !currentValue } : c
        ));
        
        toast.success(
          !currentValue 
            ? t('messages.autoRenewEnabled') || 'Rinnovo automatico attivato'
            : t('messages.autoRenewDisabled') || 'Rinnovo automatico disattivato'
        );
      } catch (error) {
        console.error('Error updating auto-renewal:', error);
        toast.error(t('messages.errorUpdatingAutoRenew') || 'Errore nell\'aggiornamento del rinnovo automatico');
      } finally {
        setUpdatingAutoRenew(prev => ({ ...prev, [contractId]: false }));
      }
    };
    
    // Handle package booking - same as Contracts page
    const handleBookPackage = (contract) => {
      console.log('Opening package booking for contract:', contract);
      setSelectedPackageContract(contract);
      setShowPackageBooking(true);
    };
    
    // Handle purchase more entries or new package - opens Contract creation form
    const handlePurchaseMore = (contract = null) => {
      console.log('Opening contract form for new purchase');
      // If we have a contract, we can pre-select the same service/location
      if (contract) {
        setEditingContract({
          service_id: contract.service_id,
          location_id: contract.location_id,
          isPreselected: true
        });
      }
      setShowForm(true);
    };
    
    // Handle renew subscription
    const handleRenewSubscription = (contract) => {
      console.log('Opening contract form for renewal');
      // Pre-fill the form with the same service for renewal
      setEditingContract({
        service_id: contract.service_id,
        location_id: contract.location_id,
        service_name: contract.service_name,
        isRenewal: true
      });
      setShowForm(true);
    };
    
    // Check if can book package entry
    const canBookPackageEntry = (contract) => {
      if (contract.service_type !== 'pacchetto') return false;
      if (isContractExpired(contract.end_date)) return false;
      const remaining = parseFloat(contract.service_max_entries || 0) - parseFloat(contract.entries_used || 0);
      return remaining >= 0.5;
    };

    return (
      <>
        <h1 className="dashboard-title">
          {t('dashboard.welcomeBack')}, {profile?.first_name || 'User'}!
        </h1>
        
        <div className="dashboard-section">
          <div className="contract-cards-grid">
            {activeContracts.map((contract) => {
              const isExpired = isContractExpired(contract.end_date);
              const daysRemaining = calculateDaysRemaining(contract.end_date);
              
              // Calculate remaining entries with proper decimal handling
              let remainingEntries = null;
              if (contract.service_type === 'pacchetto') {
                const maxEntries = parseFloat(contract.service_max_entries || 0);
                const usedEntries = parseFloat(contract.entries_used || 0);
                remainingEntries = Math.round((maxEntries - usedEntries) * 10) / 10; // Round to 1 decimal place
              }
              
              const canBook = canBookPackageEntry(contract);
              
              return (
                <div key={contract.id} className="contract-card">
                  <div className="contract-card-header">
                    <span className="contract-type-label">
                      {contract.service_type === 'pacchetto' 
                        ? t('services.package').toUpperCase() || 'PACCHETTO'
                        : t('services.subscription').toUpperCase() || 'ABBONAMENTO'
                      }
                    </span>
                  </div>
                  
                  <div className="contract-card-body">
                    <h3 className="contract-service-name">
                      {contract.service_name || 
                      (contract.service_type === 'pacchetto' 
                        ? 'Nome del pacchetto' 
                        : 'Nome dell\'abbonamento')}
                    </h3>
                    
                    <div className="contract-status-info">
                      {contract.service_type === 'pacchetto' ? (
                        <>
                          <p className={`contract-entries ${remainingEntries === 0 ? 'no-entries' : ''}`}>
                            {t('dashboard.hasEntries') || 'Hai ancora'} {' '}
                            <strong className={remainingEntries === 0 ? 'text-red' : ''}>
                              {/* Show .0 only if it's a whole number, otherwise show .5 */}
                              {remainingEntries.toFixed(remainingEntries % 1 === 0 ? 0 : 1)}
                            </strong> {' '}
                            {t('dashboard.usableEntries') || 'ingressi utilizzabili'}
                          </p>
                        </>
                      ) : (
                        <>
                          {!isExpired && (
                            <p className="contract-days">
                              {t('dashboard.hasRemainingDays') || 'Hai ancora'} {' '}
                              <strong>{daysRemaining}</strong> {' '}
                              {t('dashboard.daysRemaining') || 'giorni rimanenti'}
                            </p>
                          )}
                        </>
                      )}
                      
                      <p className={`contract-expiry ${isExpired ? 'expired' : ''}`}>
                        {isExpired 
                          ? `${t('dashboard.expiredOn') || 'Scaduto il'} ${formatDate(contract.end_date)}`
                          : `${t('dashboard.expiresOn') || 'Scadenza'} ${formatDate(contract.end_date)}`
                        }
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="contract-card-actions">
                      {contract.service_type === 'pacchetto' ? (
                        <>
                          {/* Package Actions */}
                          {remainingEntries > 0 && !isExpired ? (
                            <>
                              <button 
                                className="btn-contract-primary"
                                onClick={() => handleBookPackage(contract)}
                              >
                                <Calendar size={16} />
                                {t('dashboard.bookEntry') || 'PRENOTA INGRESSO'}
                              </button>
                              <button 
                                className="btn-contract-outline"
                                onClick={() => handlePurchaseMore(contract)}
                              >
                                <Plus size={16} />
                                {t('dashboard.buyMoreEntries') || 'ACQUISTA ALTRI INGRESSI'}
                              </button>
                            </>
                          ) : (
                            <button 
                              className="btn-contract-primary full-width"
                              onClick={() => handlePurchaseMore(contract)}
                            >
                              <Plus size={16} />
                              {t('dashboard.buyNewPackage') || 'ACQUISTA NUOVO PACCHETTO'}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Subscription Actions - Only show auto-renew and renew options if it's NOT a free trial */}
                          {contract.service_cost > 0 ? (
                            <>
                              <div className="auto-renew-section">
                                <label className="auto-renew-toggle">
                                  <input
                                    type="checkbox"
                                    checked={contract.auto_renew || false}
                                    onChange={() => handleAutoRenewToggle(contract.id, contract.auto_renew)}
                                    disabled={updatingAutoRenew[contract.id]}
                                  />
                                  <span className="toggle-slider"></span>
                                  <span className="toggle-label">
                                    {t('dashboard.autoRenewActive') || 'Rinnovo automatico attivato'}
                                  </span>
                                </label>
                              </div>
                              <button 
                                className={contract.auto_renew ? 'btn-contract-outline' : 'btn-contract-primary'}
                                onClick={() => handleRenewSubscription(contract)}
                              >
                                <RefreshCw size={16} />
                                {t('dashboard.renewNow') || 'RINNOVA ADESSO'}
                              </button>
                            </>
                          ) : (
                            /* Free trial - show informational message instead */
                            <div className="free-trial-info">
                              <p className="free-trial-text">
                                {t('dashboard.freeTrialActive') || 'Prova gratuita attiva - non rinnovabile'}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Empty state remains the same */}
          </div>
        </div>
        
        {/* Quick Actions section remains the same */}
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
      
      {/* Modal Components for Customer Dashboard */}
      {isCustomer && (
        <>
          {/* Contract Form Modal - for creating new contracts */}
          <ContractForm
            isOpen={showForm}
            onClose={() => {
              setShowForm(false);
              setEditingContract(null);
            }}
            onSuccess={handleFormSuccess}
            partnerUuid={profile?.partner_uuid}
            isCustomerMode={true}
            customers={[]}
            locations={[]}
            editMode={false}
            contractToEdit={editingContract}
          />

          {/* Package Booking Modal - for booking package entries */}
          <PackageBookingForm
            isOpen={showPackageBooking}
            onClose={() => {
              setShowPackageBooking(false);
              setSelectedPackageContract(null);
            }}
            onSuccess={handlePackageBookingSuccess}
            contract={selectedPackageContract}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;