import { AlertTriangle, Building, Calendar, DollarSign, MapPin, Plus, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from '../components/common/ToastContainer';
import PackageBookingForm from '../components/forms/PackageBookingForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

// Add these imports to the top of Dashboard.jsx:
import MessageModal from '../components/common/MessageModal';
import CustomerForm from '../components/forms/CustomerForm';
import SetupProgressIndicator from '../components/tour/SetupProgressIndicator';
import TourOverlay from '../components/tour/TourOverlay';
import WelcomeModal from '../components/tour/WelcomeModal';
import { useTour } from '../contexts/TourContext';
import logger from '../utils/logger';

// Add this import to the top of Dashboard.jsx with your other imports:
import { generateAndUploadICS } from '../services/calendarService';
import oneSignalEmailService from '../services/oneSignalEmailService';






const Dashboard = () => {
  const { profile, user } = useAuth();
  const { t } = useTranslation();

  const [profileCheckRetries, setProfileCheckRetries] = useState(0);
  const MAX_PROFILE_CHECK_RETRIES = 3;

  const [partnersUsersData, setPartnersUsersData] = useState([]);
  const [partnersUsersLoading, setPartnersUsersLoading] = useState(true);

  const [chartsReady, setChartsReady] = useState(false);

  // ADD THIS DEBUG LOG
  logger.log('🔍 DASHBOARD DEBUG - Profile object:', profile);
  logger.log('🔍 Role:', profile?.role);
  logger.log('🔍 Partner UUID:', profile?.partner_uuid);
  logger.log('🔍 isCustomer calculation:', profile?.role === 'user');

  const [stats, setStats] = useState({
    totalPartners: 0,
    totalLocations: 0,
    totalUsers: 0,
    totalCustomers: 0,
    totalContracts: 0,
    activeBookings: 0,
    totalContractValue: 0,
    loading: true
  });

  // New state for dynamic resource occupancy
  const [resourceOccupancy, setResourceOccupancy] = useState([]);
  const [resourceOccupancyLoading, setResourceOccupancyLoading] = useState(true);

  // Enhanced business intelligence state
  const [businessMetrics, setBusinessMetrics] = useState({
    expiringContracts: {
      next7Days: [],
      next15Days: [],
      next30Days: [],
      revenueAtRisk: 0,
      loading: true
    },
    paymentStatus: {
      overdue: [],
      dueThisWeek: [],
      dueThisMonth: [],
      totalOverdue: 0,
      loading: true
    },
    revenueMetrics: {
      currentMRR: 0,
      totalActiveValue: 0,
      monthOverMonthGrowth: 0,
      loading: true
    },
    utilizationMetrics: {
      packageUtilization: [],
      resourceTrends: [],
      loading: true
    }
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
  const [hasContractData, setHasContractData] = useState(false);

  // Contract management states for customer dashboard
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [showStatusAlert, setShowStatusAlert] = useState(false);
  const [customerStatus, setCustomerStatus] = useState(null);
  const [showPackageBooking, setShowPackageBooking] = useState(false);
  const [selectedPackageContract, setSelectedPackageContract] = useState(null);

  // State for managing auto-renewal toggles
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState({});

  // Determine user type
  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';

  // Then in the Dashboard component, add this after the existing hooks:
  const { isOnboardingComplete, shouldShowWelcome } = useTour();

  // Add these state variables at the top of Dashboard component:
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [customerProfileData, setCustomerProfileData] = useState(null);
  const [profileCheckComplete, setProfileCheckComplete] = useState(false);

  // Modified useEffect with better dependency management
  // Modified useEffect with better dependency management and profile loading check
  useEffect(() => {
    logger.log('Dashboard useEffect triggered - Profile:', !!profile, 'User:', !!user);

    // ✅ Wait for BOTH user and profile to be fully loaded
    if (!profile || !user) {
      logger.log('⏳ Waiting for user and profile...');
      setProfileCheckComplete(false);
      return;
    }

    // ✅ Ensure profile has essential fields
    if (!profile.role || !profile.id) {
      logger.log('⏳ Profile incomplete, waiting...');
      setProfileCheckComplete(false);
      return;
    }

    // ✅ CHECK ROLE HERE, NOT USING PRE-CALCULATED isCustomer
    const currentRole = profile.role;
    logger.log('✅ Profile fully loaded with role:', currentRole);

    if (currentRole === 'user') {
      // This is a CUSTOMER
      logger.log('👤 Customer detected, checking profile completion...');
      checkProfileCompletion();
    } else if (currentRole === 'admin') {
      // This is a PARTNER ADMIN
      logger.log('👔 Partner admin detected, loading dashboard...');
      setProfileCheckComplete(true);
      fetchStats();
      fetchResourceOccupancy();
      fetchContractsChartData();
      fetchBusinessMetrics();
    } else if (currentRole === 'superadmin') {
      // This is a SUPER ADMIN
      logger.log('👑 Super admin detected, loading dashboard...');
      setProfileCheckComplete(true);
      fetchStats();
      fetchContractsChartData();
      fetchPartnersUsersData(); // ADD THIS LINE
    } else {
      // Unknown role
      logger.warn('⚠️ Unknown role:', currentRole);
      setProfileCheckComplete(true);
    }
  }, [profile?.id, user?.id, profile?.role]); // Include role in dependencies


  useEffect(() => {
    // Delay chart rendering to ensure containers have dimensions
    const timer = setTimeout(() => {
      setChartsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Enhanced Business Metrics Fetching
  const fetchBusinessMetrics = async () => {
    if (!profile?.partner_uuid) return;

    try {
      // Fetch expiring contracts
      await fetchExpiringContracts();
      // Fetch payment status
      await fetchPaymentStatus();
      // Fetch revenue metrics
      await fetchRevenueMetrics();
      // Fetch utilization metrics
      await fetchUtilizationMetrics();
    } catch (error) {
      logger.error('Error fetching business metrics:', error);
    }
  };

  const fetchExpiringContracts = async () => {
    setBusinessMetrics(prev => ({
      ...prev,
      expiringContracts: { ...prev.expiringContracts, loading: true }
    }));

    try {
      const today = new Date();
      const next7Days = new Date(today);
      next7Days.setDate(today.getDate() + 7);
      const next15Days = new Date(today);
      next15Days.setDate(today.getDate() + 15);
      const next30Days = new Date(today);
      next30Days.setDate(today.getDate() + 30);

      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          end_date,
          service_cost,
          service_currency,
          service_name,
          contract_status,
          customers (
            first_name,
            second_name,
            company_name
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .eq('contract_status', 'active')
        .eq('is_archived', false)
        .lte('end_date', next30Days.toISOString().split('T')[0])
        .gte('end_date', today.toISOString().split('T')[0])
        .order('end_date');

      if (error) throw error;

      const contracts = data || [];
      const next7DaysContracts = contracts.filter(c => new Date(c.end_date) <= next7Days);
      const next15DaysContracts = contracts.filter(c => new Date(c.end_date) <= next15Days);
      const next30DaysContracts = contracts;

      const revenueAtRisk = next30DaysContracts.reduce((sum, contract) => {
        return sum + (parseFloat(contract.service_cost) || 0);
      }, 0);

      setBusinessMetrics(prev => ({
        ...prev,
        expiringContracts: {
          next7Days: next7DaysContracts,
          next15Days: next15DaysContracts,
          next30Days: next30DaysContracts,
          revenueAtRisk,
          loading: false
        }
      }));
    } catch (error) {
      logger.error('Error fetching expiring contracts:', error);
      setBusinessMetrics(prev => ({
        ...prev,
        expiringContracts: { ...prev.expiringContracts, loading: false }
      }));
    }
  };

  const fetchPaymentStatus = async () => {
    setBusinessMetrics(prev => ({
      ...prev,
      paymentStatus: { ...prev.paymentStatus, loading: true }
    }));

    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);

      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          payment_number,
          amount,
          currency,
          due_date,
          payment_status,
          contract_id,
          contracts (
            contract_number,
            customers (
              first_name,
              second_name,
              company_name
            )
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .in('payment_status', ['pending', 'failed'])
        .order('due_date');

      if (error) throw error;

      const payments = data || [];
      const overdue = payments.filter(p => new Date(p.due_date) < today);
      const dueThisWeek = payments.filter(p => {
        const dueDate = new Date(p.due_date);
        return dueDate >= today && dueDate <= nextWeek;
      });
      const dueThisMonth = payments.filter(p => {
        const dueDate = new Date(p.due_date);
        return dueDate >= today && dueDate <= nextMonth;
      });

      const totalOverdue = overdue.reduce((sum, payment) => {
        return sum + (parseFloat(payment.amount) || 0);
      }, 0);

      setBusinessMetrics(prev => ({
        ...prev,
        paymentStatus: {
          overdue,
          dueThisWeek,
          dueThisMonth,
          totalOverdue,
          loading: false
        }
      }));
    } catch (error) {
      logger.error('Error fetching payment status:', error);
      setBusinessMetrics(prev => ({
        ...prev,
        paymentStatus: { ...prev.paymentStatus, loading: false }
      }));
    }
  };

  const fetchRevenueMetrics = async () => {
    setBusinessMetrics(prev => ({
      ...prev,
      revenueMetrics: { ...prev.revenueMetrics, loading: true }
    }));

    try {
      // Fetch active contracts for MRR calculation
      const { data: activeContracts, error: contractsError } = await supabase
        .from('contracts')
        .select('service_cost, service_type, start_date, end_date')
        .eq('partner_uuid', profile.partner_uuid)
        .eq('contract_status', 'active')
        .eq('is_archived', false);

      if (contractsError) throw contractsError;

      const contracts = activeContracts || [];

      // Calculate current MRR (Monthly Recurring Revenue)
      const currentMRR = contracts.reduce((sum, contract) => {
        if (contract.service_type === 'abbonamento') {
          // Assume monthly recurring for subscriptions
          return sum + (parseFloat(contract.service_cost) || 0);
        }
        return sum;
      }, 0);

      // Calculate total active contract value
      const totalActiveValue = contracts.reduce((sum, contract) => {
        return sum + (parseFloat(contract.service_cost) || 0);
      }, 0);

      // Calculate month-over-month growth (simplified)
      const thisMonth = new Date();
      const lastMonth = new Date(thisMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const { data: lastMonthContracts, error: lastMonthError } = await supabase
        .from('contracts')
        .select('service_cost, service_type')
        .eq('partner_uuid', profile.partner_uuid)
        .eq('contract_status', 'active')
        .eq('is_archived', false)
        .lte('start_date', lastMonth.toISOString().split('T')[0]);

      if (!lastMonthError) {
        const lastMonthMRR = (lastMonthContracts || []).reduce((sum, contract) => {
          if (contract.service_type === 'abbonamento') {
            return sum + (parseFloat(contract.service_cost) || 0);
          }
          return sum;
        }, 0);

        const monthOverMonthGrowth = lastMonthMRR > 0
          ? ((currentMRR - lastMonthMRR) / lastMonthMRR) * 100
          : 0;

        setBusinessMetrics(prev => ({
          ...prev,
          revenueMetrics: {
            currentMRR,
            totalActiveValue,
            monthOverMonthGrowth,
            loading: false
          }
        }));
      }
    } catch (error) {
      logger.error('Error fetching revenue metrics:', error);
      setBusinessMetrics(prev => ({
        ...prev,
        revenueMetrics: { ...prev.revenueMetrics, loading: false }
      }));
    }
  };

  const fetchUtilizationMetrics = async () => {
    setBusinessMetrics(prev => ({
      ...prev,
      utilizationMetrics: { ...prev.utilizationMetrics, loading: true }
    }));

    try {
      // Fetch package utilization data
      const { data: packageContracts, error: packageError } = await supabase
        .from('contracts')
        .select(`
          id,
          service_name,
          service_max_entries,
          entries_used,
          customers (
            first_name,
            second_name,
            company_name
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .eq('contract_status', 'active')
        .eq('service_type', 'pacchetto')
        .eq('is_archived', false);

      if (!packageError) {
        const packageUtilization = (packageContracts || []).map(contract => {
          const maxEntries = parseFloat(contract.service_max_entries) || 0;
          const usedEntries = parseFloat(contract.entries_used) || 0;
          const utilizationRate = maxEntries > 0 ? (usedEntries / maxEntries) * 100 : 0;

          return {
            id: contract.id,
            serviceName: contract.service_name,
            customerName: contract.customers?.company_name ||
              `${contract.customers?.first_name} ${contract.customers?.second_name}`.trim(),
            maxEntries,
            usedEntries,
            utilizationRate: Math.round(utilizationRate * 10) / 10
          };
        });

        setBusinessMetrics(prev => ({
          ...prev,
          utilizationMetrics: {
            packageUtilization,
            resourceTrends: [], // Could be expanded with booking trend data
            loading: false
          }
        }));
      }
    } catch (error) {
      logger.error('Error fetching utilization metrics:', error);
      setBusinessMetrics(prev => ({
        ...prev,
        utilizationMetrics: { ...prev.utilizationMetrics, loading: false }
      }));
    }
  };

  // Fetch customer contracts - REMOVED MOCK DATA FALLBACK
  const fetchCustomerContracts = async () => {
    setContractsLoading(true);

    try {
      // Get customer ID
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, customer_status')
        .eq('user_id', user.id)
        .single();

      if (customerError || !customerData) {
        logger.error('Error fetching customer data:', customerError);
        // NO MORE MOCK DATA - just set empty array
        setContracts([]);
        setContractsLoading(false);
        return;
      }

      const customerId = customerData.id;
      setCustomerStatus(customerData.customer_status);

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
        logger.error('Error fetching contracts:', contractsError);
        throw contractsError;
      }

      // Process contracts to ensure numeric fields are numbers
      const processedContracts = (contractsData || []).map(contract => ({
        ...contract,
        entries_used: parseFloat(contract.entries_used) || 0,
        service_max_entries: contract.service_max_entries ? parseFloat(contract.service_max_entries) : null
      }));

      logger.log('Processed contracts:', processedContracts);
      setContracts(processedContracts);

    } catch (error) {
      logger.error('Error fetching customer contracts:', error);
      // NO MORE MOCK DATA FALLBACK - just set empty array
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  // Improved checkProfileCompletion function with better error handling
  const checkProfileCompletion = async (retryCount = 0) => {
    // ✅ FIX: Get FRESH values from context/state, NOT from parameters!
    const currentProfile = profile;
    const currentUser = user;

    logger.log('=== STARTING PROFILE COMPLETION CHECK ===');
    logger.log('User ID:', currentUser?.id);
    logger.log('Profile partner_uuid:', currentProfile?.partner_uuid);
    logger.log('Profile role:', currentProfile?.role);
    logger.log('Retry count:', retryCount);

    // ✅ IMMEDIATE EXIT: If not a customer, don't even continue
    if (currentProfile?.role !== 'user') {
      logger.log('❌ NOT A CUSTOMER (role is', currentProfile?.role, ') - EXITING IMMEDIATELY');
      setProfileCheckComplete(true);
      setContractsLoading(false);
      return;
    }

    // ✅ SAFETY: Check if profile is fully loaded
    if (!currentProfile || !currentProfile.role || !currentProfile.id) {
      logger.warn('⚠️ Profile not fully loaded yet, waiting...');
      setProfileCheckComplete(false);
      return;
    }

    if (!currentUser?.id) {
      logger.warn('No user ID available for profile check');
      setProfileCheckComplete(true);
      return;
    }

    // Check retry limit
    if (retryCount >= MAX_PROFILE_CHECK_RETRIES) {
      logger.error('❌ MAX RETRIES REACHED');
      setProfileCheckComplete(true);
      setContractsLoading(false);
      toast.error('Unable to load customer profile. Please refresh.');
      return;
    }

    try {
      setContractsLoading(true);

      logger.log('Fetching customer data for user:', currentUser.id, `(attempt ${retryCount + 1}/${MAX_PROFILE_CHECK_RETRIES})`);
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      logger.log('Customer fetch result:', { data: customerData, error: customerError });

      if (customerError) {
        logger.error('Error fetching customer data:', customerError);
        setProfileCheckComplete(true);
        setContractsLoading(false);
        fetchCustomerContracts();
        return;
      }

      if (!customerData) {
        logger.log('No customer record found - waiting for creation...');

        if (retryCount < MAX_PROFILE_CHECK_RETRIES) {
          logger.log(`⏳ Will retry in 1 second (${retryCount + 1}/${MAX_PROFILE_CHECK_RETRIES})...`);
          setTimeout(() => {
            logger.log('🔄 Retrying profile completion check...');
            checkProfileCompletion(retryCount + 1); // ✅ ONLY pass retry count, NOT profile/user!
          }, 1000);
        } else {
          logger.error('❌ Customer record not found after retries');
          setProfileCheckComplete(true);
          setContractsLoading(false);
          toast.error('Customer profile not found. Please contact support.');
        }
        return;
      }

      logger.log('✅ Customer profile status:', customerData.customer_status);

      if (customerData.customer_status === 'incomplete_profile') {
        logger.log('🚨 PROFILE INCOMPLETE - SHOWING COMPLETION FORM');
        setCustomerProfileData(customerData);
        setShowProfileCompletion(true);
        setProfileCheckComplete(true);
        setContractsLoading(false);
      } else {
        logger.log('✅ PROFILE COMPLETE - PROCEEDING');
        setShowProfileCompletion(false);
        setCustomerProfileData(null);
        setProfileCheckComplete(true);
        fetchCustomerContracts();
      }
    } catch (error) {
      logger.error('Error in profile completion check:', error);
      setProfileCheckComplete(true);
      setContractsLoading(false);
      fetchCustomerContracts();
    }

    logger.log('=== PROFILE COMPLETION CHECK COMPLETE ===');
  };


  // Modified success handler for profile completion
  const handleProfileCompletionSuccess = async (updatedCustomer) => {
    logger.log('🎉 PROFILE COMPLETION SUCCESSFUL:', updatedCustomer);

    try {
      // Update customer status to 'active'
      const { error } = await supabase
        .from('customers')
        .update({
          customer_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedCustomer.id);

      if (error) {
        logger.error('Error updating customer status:', error);
        toast.error(t('messages.errorUpdatingStatus') || 'Error updating status');
      } else {
        logger.log('✅ Customer status updated to active');
        toast.success(t('customers.profileCompletedSuccessfully') || 'Profile completed successfully');
      }
    } catch (error) {
      logger.error('Error in profile completion handler:', error);
    }

    // Close the profile completion form
    setShowProfileCompletion(false);
    setCustomerProfileData(null);

    // Now fetch contracts normally
    logger.log('Fetching contracts after profile completion...');
    fetchCustomerContracts();
  };

  const handlePackageBookingSuccess = async (reservation) => {
    logger.log('🎯 BOOKING SUCCESS HANDLER CALLED!', reservation);
    logger.log('📧 Selected package contract:', selectedPackageContract);

    try {
      // Send booking confirmation emails if we have contract data
      if (selectedPackageContract) {
        logger.log('📧 About to send emails for contract:', selectedPackageContract);

        // Get partner data for partner email
        let partnerData = null;
        if (profile?.partner_uuid) {
          try {
            const { data: partner, error: partnerError } = await supabase
              .from('partners')
              .select('email, first_name, second_name, company_name, structure_name, email_banner_url')
              .eq('partner_uuid', profile.partner_uuid)
              .single();

            if (!partnerError && partner) {
              partnerData = partner;
            }
          } catch (error) {
            logger.warn('📧 Could not fetch partner data for email:', error);
          }
        }

        // Get full contract data with customer info for the email
        let fullContractData = selectedPackageContract;

        try {
          const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .select(`
              *,
              customers (
                id,
                first_name,
                second_name,
                email,
                company_name
              ),
              services (
                id,
                service_name,
                service_type
              ),
              locations (
                id,
                location_name
              )
            `)
            .eq('id', selectedPackageContract.id)
            .single();

          if (!contractError && contractData) {
            fullContractData = contractData;
          }
        } catch (error) {
          logger.warn('📧 Error fetching full contract data:', error);
        }

        // Generate ICS file content and upload to Supabase Storage
        let calendarLink = null;
        try {
          // Note: reservation is the booking data here
          calendarLink = await generateAndUploadICS(reservation, 'package', profile.partner_uuid);
        } catch (icsError) {
          logger.error('Error generating ICS:', icsError);
        }

        // Send booking confirmation emails
        const emailResults = await oneSignalEmailService.sendBookingConfirmation(
          reservation,
          fullContractData,
          t,
          partnerData,
          calendarLink
        );

        // Show toast messages about email status
        if (emailResults.customerSuccess && emailResults.partnerSuccess) {
          toast.success(t('reservations.confirmationEmailsSent') || 'Email di conferma inviate');
        } else if (emailResults.customerSuccess || emailResults.partnerSuccess) {
          toast.info(t('reservations.someEmailsSent') || 'Alcune email di conferma inviate');
        }
      }
    } catch (error) {
      logger.error('❌ Error sending booking confirmation emails:', error);
      // Don't fail the booking process if emails fail
    }

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

    // Fetch fresh data after a small delay
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
        logger.error('Error fetching contracts chart data:', error);
        // NO MORE MOCK DATA - just set empty and indicate no data
        setContractsChartData([]);
        setHasContractData(false);
        return;
      }

      if (data && data.length > 0) {
        processContractsData(data);
        setHasContractData(true);
      } else {
        // NO MORE MOCK DATA - just set empty
        setContractsChartData([]);
        setHasContractData(false);
      }

    } catch (error) {
      logger.error('Error in fetchContractsChartData:', error);
      // NO MORE MOCK DATA - just set empty
      setContractsChartData([]);
      setHasContractData(false);
    } finally {
      setChartLoading(false);
    }
  };

  const processContractsData = (contracts) => {
    // Group contracts by month and type
    const monthlyData = {};

    contracts.forEach(contract => {
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

      const serviceType = contract.service_type === 'abbonamento' ? 'Abbonamento' :
        contract.service_type === 'pacchetto' ? 'Pacchetto' : 'Altro';

      if (serviceType !== 'Altro') {
        monthlyData[createdMonthKey][serviceType]++;
        monthlyData[createdMonthKey].total++;
      }
    });

    // Define the view range: 4 months back + current + 8 months forward
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startMonth = new Date(currentMonth);
    startMonth.setMonth(currentMonth.getMonth() - 4);
    const endMonth = new Date(currentMonth);
    endMonth.setMonth(currentMonth.getMonth() + 8);

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

  const fetchStats = async () => {
    logger.log('🚀 DASHBOARD FETCHSTATS CALLED');
    if (!profile) {
      logger.log('❌ DASHBOARD FETCHSTATS - No profile, exiting');
      return;
    }

    setStats(prev => ({ ...prev, loading: true }));

    try {
      logger.log('📊 Fetching dashboard stats for role:', profile.role, 'Partner UUID:', profile.partner_uuid);

      let partnersCount = 0;
      let locationsCount = 0;
      let usersCount = 0;
      let customersCount = 0;
      let contractsCount = 0;
      let activeBookingsCount = 0;

      // Fetch data based on user role
      if (profile.role === 'superadmin') {
        const [partnersResult, locationsResult, usersResult, contractsResult] = await Promise.all([
          supabase.from('partners').select('*', { count: 'exact', head: true }),
          supabase.from('locations').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('partners_contracts').select('final_price').eq('contract_status', 'active')
        ]);

        partnersCount = partnersResult.count || 0;
        locationsCount = locationsResult.count || 0;
        usersCount = usersResult.count || 0;

        const totalContractValue = contractsResult.data
          ? contractsResult.data.reduce((sum, contract) => sum + (contract.final_price || 0), 0)
          : 0;

        setStats({
          totalPartners: partnersCount,
          totalLocations: locationsCount,
          totalUsers: usersCount,
          totalCustomers: 0,
          totalContracts: 0,
          activeBookings: 0,
          totalContractValue: totalContractValue,
          loading: false
        });

      } else if (profile.role === 'admin') {
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
              .eq('partner_uuid', profile.partner_uuid),
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
        }

        setStats({
          totalPartners: 0,
          totalLocations: locationsCount,
          totalUsers: usersCount,
          totalCustomers: customersCount,
          totalContracts: contractsCount,
          activeBookings: activeBookingsCount,
          totalContractValue: 0,
          loading: false
        });
      }
    } catch (error) {
      logger.error('Error fetching dashboard stats:', error);

      // Set all stats to 0 instead of using mock data
      setStats({
        totalPartners: 0, totalLocations: 0, totalUsers: 0,
        totalCustomers: 0, totalContracts: 0, activeBookings: 0,
        totalContractValue: 0,
        loading: false
      });
    }
  };

  // Fetch dynamic resource occupancy based on partner_resource_types
  const fetchResourceOccupancy = async () => {
    if (profile?.role !== 'admin' || !profile?.partner_uuid) {
      setResourceOccupancyLoading(false);
      return;
    }

    setResourceOccupancyLoading(true);

    try {
      logger.log('📊 Fetching resource occupancy for partner:', profile.partner_uuid);

      // Get current month date range
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const monthStart = `${year}-${month}-01`;
      const monthEnd = `${year}-${month}-${lastDay}`;

      // Fetch partner resource types
      const { data: resourceTypes, error: resourceTypesError } = await supabase
        .from('partner_resource_types')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .eq('is_active', true)
        .order('type_name');

      if (resourceTypesError) {
        logger.error('Error fetching resource types:', resourceTypesError);
        setResourceOccupancyLoading(false);
        return;
      }

      if (!resourceTypes || resourceTypes.length === 0) {
        logger.log('No resource types found for partner');
        setResourceOccupancy([]);
        setResourceOccupancyLoading(false);
        return;
      }

      // Fetch all location resources for this partner
      const { data: allResources, error: resourcesError } = await supabase
        .from('location_resources')
        .select('id, resource_type, quantity')
        .eq('partner_uuid', profile.partner_uuid);

      if (resourcesError) {
        logger.error('Error fetching resources:', resourcesError);
        setResourceOccupancyLoading(false);
        return;
      }

      // Today's date for today's bookings query
      const todayStr = `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;

      // Fetch all bookings and package reservations for current month AND today
      const [bookingsResult, packageResult, todayBookingsResult, todayPackagesResult] = await Promise.all([
        supabase
          .from('bookings')
          .select(`
            location_resource_id,
            location_resources!inner (
              resource_type,
              partner_uuid
            )
          `)
          .eq('location_resources.partner_uuid', profile.partner_uuid)
          .eq('booking_status', 'active')
          .lte('start_date', monthEnd)
          .gte('end_date', monthStart),
        supabase
          .from('package_reservations')
          .select(`
            location_resource_id,
            location_resources!inner (
              resource_type
            )
          `)
          .eq('partner_uuid', profile.partner_uuid)
          .eq('reservation_status', 'confirmed')
          .lte('reservation_date', monthEnd)
          .gte('reservation_date', monthStart),
        // Today's bookings
        supabase
          .from('bookings')
          .select(`
            location_resource_id,
            location_resources!inner (
              resource_type,
              partner_uuid
            )
          `)
          .eq('location_resources.partner_uuid', profile.partner_uuid)
          .eq('booking_status', 'active')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr),
        // Today's package reservations
        supabase
          .from('package_reservations')
          .select(`
            location_resource_id,
            location_resources!inner (
              resource_type
            )
          `)
          .eq('partner_uuid', profile.partner_uuid)
          .eq('reservation_status', 'confirmed')
          .eq('reservation_date', todayStr)
      ]);

      const detailedBookings = bookingsResult.data || [];
      const detailedPackages = packageResult.data || [];
      const todayBookings = todayBookingsResult.data || [];
      const todayPackages = todayPackagesResult.data || [];

      // Calculate data for each resource type
      const occupancyData = resourceTypes.map(resourceType => {
        // Get total quantity for this resource type
        const totalQuantity = (allResources || [])
          .filter(r => r.resource_type === resourceType.type_code)
          .reduce((sum, r) => sum + (r.quantity || 0), 0);

        // Count monthly bookings for this type
        const monthlyBookingsCount = [
          ...detailedBookings.filter(b => b.location_resources?.resource_type === resourceType.type_code),
          ...detailedPackages.filter(p => p.location_resources?.resource_type === resourceType.type_code)
        ].length;

        // Count today's bookings for this type
        const todayBookingsCount = [
          ...todayBookings.filter(b => b.location_resources?.resource_type === resourceType.type_code),
          ...todayPackages.filter(p => p.location_resources?.resource_type === resourceType.type_code)
        ].length;

        return {
          type_name: resourceType.type_name,
          type_code: resourceType.type_code,
          total: totalQuantity,
          monthlyBookings: monthlyBookingsCount,
          todayBookings: todayBookingsCount
        };
      });

      logger.log('📊 Resource occupancy calculated:', occupancyData);
      setResourceOccupancy(occupancyData);
      setResourceOccupancyLoading(false);

    } catch (error) {
      logger.error('Error fetching resource occupancy:', error);
      setResourceOccupancy([]);
      setResourceOccupancyLoading(false);
    }
  };



  const fetchPartnersUsersData = async () => {
    setPartnersUsersLoading(true);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

      // Get all partners
      const { data: partners, error: partnersError } = await supabase
        .from('partners')
        .select('partner_uuid, company_name, first_name, second_name')
        .eq('partner_status', 'active');

      if (partnersError) throw partnersError;

      // For each partner, get active users count and plan limit
      const partnersData = await Promise.all(
        (partners || []).map(async (partner) => {
          // FIXED: Month parameter FIRST, partner UUID SECOND
          const { data: activeUsersData, error: activeUsersError } = await supabase
            .rpc('count_active_users_for_month', {
              p_billing_month: currentMonth,
              p_partner_uuid: partner.partner_uuid
            });

          if (activeUsersError) {
            logger.error('❌ Error getting active users:', activeUsersError);
          }

          // Call the RPC function to get plan limit
          const { data: planLimitData, error: planLimitError } = await supabase
            .rpc('get_partner_active_users_limit', {
              p_partner_uuid: partner.partner_uuid
            });

          if (planLimitError) {
            logger.error('❌ Error getting plan limit:', planLimitError);
          }

          const activeUsers = activeUsersData || 0;
          const planLimit = planLimitData || 0;
          const isOverLimit = activeUsers > planLimit;

          const partnerName = partner.company_name ||
            `${partner.first_name || ''} ${partner.second_name || ''}`.trim() ||
            'Partner';

          return {
            partnerName,
            activeUsers,
            planLimit,
            isOverLimit
          };
        })
      );

      // Filter out partners with no data and sort
      const chartData = partnersData
        .filter(p => p.activeUsers > 0 || p.planLimit > 0)
        .sort((a, b) => {
          if (a.isOverLimit !== b.isOverLimit) return a.isOverLimit ? -1 : 1;
          return b.activeUsers - a.activeUsers;
        })
        .slice(0, 15); // Top 15 partners

      setPartnersUsersData(chartData);
    } catch (error) {
      logger.error('Error fetching partners users data:', error);
      setPartnersUsersData([]);
    } finally {
      setPartnersUsersLoading(false);
    }
  };


  // Format currency helper
  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date helper
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + entry.value, 0);
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={entry.dataKey || index} className="tooltip-entry" style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
          <p className="tooltip-total">Totale: {total}</p>
        </div>
      );
    }
    return null;
  };

  // Enhanced Partner Dashboard Render
  // Enhanced Partner Dashboard Render
  const renderEnhancedPartnerDashboard = () => {
    return (
      <>
        <h1 className="dashboard-title">
          {t('dashboard.welcomeBack')}, {profile?.first_name || 'Admin'}!
        </h1>

        {!isOnboardingComplete && (
          <div className="dashboard-setup-section">
            <SetupProgressIndicator />
          </div>
        )}

        {/* Resources Overview - MOVED TO TOP */}
        <div className="dashboard-section">
          <h2 className="section-title">
            {t('dashboard.resourcesOverview')} - {(() => {
              const now = new Date();
              const monthKey = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
              const year = now.getFullYear();
              return `${t(`common.months.${monthKey}`)} ${year}`;
            })()}
          </h2>
          <div className="resources-grid">
            {resourceOccupancyLoading ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
                <p>{t('common.loading')}...</p>
              </div>
            ) : resourceOccupancy.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
                <p>{t('dashboard.noResourceTypes') || 'Nessun tipo di risorsa configurato'}</p>
              </div>
            ) : (
              resourceOccupancy.map((resource, index) => {
                // Assign colors dynamically based on index
                const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];
                const color = colors[index % colors.length];

                return (
                  <div key={resource.type_code} className="resource-card" style={{ borderTopColor: color }}>
                    <div className="resource-header">
                      <div className="resource-title">
                        <h3>{resource.type_name}</h3>
                      </div>
                    </div>
                    <div className="resource-stats">
                      <div className="resource-stat">
                        <span className="resource-number">{resource.total}</span>
                        <span className="resource-label">{t('dashboard.total')}</span>
                      </div>
                      <div className="resource-stat">
                        <span className="resource-number booked">{resource.monthlyBookings}</span>
                        <span className="resource-label">{t('dashboard.monthlyBookings') || 'Prenotazioni Mese'}</span>
                      </div>
                      <div className="resource-stat">
                        <span className="resource-number today">{resource.todayBookings}</span>
                        <span className="resource-label">{t('dashboard.todayBookings') || 'Oggi'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Critical Business Alerts */}
        <div className="dashboard-section">
          <h2 className="section-title">{t('dashboard.criticalAlerts')}</h2>
          <div className="alert-cards-grid">
            {/* Expiring Contracts Alert */}
            <div className="alert-card expiring-contracts">
              <div className="alert-card-header">
                <div className="alert-icon">
                  <Calendar size={24} />
                </div>
                <div className="alert-title">
                  <h3>{t('dashboard.expiringContracts')}</h3>
                  <p>{t('dashboard.contractsNeedingAttention')}</p>
                </div>
              </div>
              <div className="alert-card-body">
                {businessMetrics.expiringContracts.loading ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <>
                    <div className="alert-metrics">
                      <div className="alert-metric">
                        <span className="metric-number urgent">
                          {businessMetrics.expiringContracts.next7Days.length}
                        </span>
                        <span className="metric-label">{t('dashboard.next7Days')}</span>
                      </div>
                      <div className="alert-metric">
                        <span className="metric-number warning">
                          {businessMetrics.expiringContracts.next15Days.length}
                        </span>
                        <span className="metric-label">{t('dashboard.next15Days')}</span>
                      </div>
                      <div className="alert-metric">
                        <span className="metric-number info">
                          {businessMetrics.expiringContracts.next30Days.length}
                        </span>
                        <span className="metric-label">{t('dashboard.next30Days')}</span>
                      </div>
                    </div>
                    <div className="revenue-at-risk">
                      <span className="risk-label">{t('dashboard.revenueAtRisk')}:</span>
                      <span className="risk-amount">
                        {formatCurrency(businessMetrics.expiringContracts.revenueAtRisk)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment Status Alert */}
            <div className="alert-card payment-status">
              <div className="alert-card-header">
                <div className="alert-icon">
                  <DollarSign size={24} />
                </div>
                <div className="alert-title">
                  <h3>{t('dashboard.paymentStatus')}</h3>
                  <p>{t('dashboard.paymentHealthCheck')}</p>
                </div>
              </div>
              <div className="alert-card-body">
                {businessMetrics.paymentStatus.loading ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <>
                    <div className="alert-metrics">
                      <div className="alert-metric">
                        <span className="metric-number urgent">
                          {businessMetrics.paymentStatus.overdue.length}
                        </span>
                        <span className="metric-label">{t('dashboard.overduePayments')}</span>
                      </div>
                      <div className="alert-metric">
                        <span className="metric-number warning">
                          {businessMetrics.paymentStatus.dueThisWeek.length}
                        </span>
                        <span className="metric-label">{t('dashboard.dueThisWeek')}</span>
                      </div>
                      <div className="alert-metric">
                        <span className="metric-number info">
                          {businessMetrics.paymentStatus.dueThisMonth.length}
                        </span>
                        <span className="metric-label">{t('dashboard.dueThisMonth')}</span>
                      </div>
                    </div>
                    <div className="overdue-amount">
                      <span className="overdue-label">{t('dashboard.totalOverdue')}:</span>
                      <span className="overdue-value">
                        {formatCurrency(businessMetrics.paymentStatus.totalOverdue)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="dashboard-section">
          <h2 className="section-title">{t('dashboard.financialOverview')}</h2>
          <div className="financial-metrics-grid">
            <div className="financial-metric-card mrr">
              <div className="metric-header">
                <div className="metric-icon">
                  <TrendingUp size={20} />
                </div>
                <h3>{t('dashboard.monthlyRecurringRevenue')}</h3>
              </div>
              <div className="metric-value">
                {businessMetrics.revenueMetrics.loading ? (
                  <div className="loading-spinner small"></div>
                ) : (
                  <>
                    <span className="value-main">
                      {formatCurrency(businessMetrics.revenueMetrics.currentMRR)}
                    </span>
                    <span className={`value-change ${businessMetrics.revenueMetrics.monthOverMonthGrowth >= 0 ? 'positive' : 'negative'
                      }`}>
                      {businessMetrics.revenueMetrics.monthOverMonthGrowth >= 0 ? '+' : ''}
                      {businessMetrics.revenueMetrics.monthOverMonthGrowth.toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="financial-metric-card total-value">
              <div className="metric-header">
                <div className="metric-icon">
                  <Building size={20} />
                </div>
                <h3>{t('dashboard.totalActiveValue')}</h3>
              </div>
              <div className="metric-value">
                {businessMetrics.revenueMetrics.loading ? (
                  <div className="loading-spinner small"></div>
                ) : (
                  <span className="value-main">
                    {formatCurrency(businessMetrics.revenueMetrics.totalActiveValue)}
                  </span>
                )}
              </div>
            </div>

            <div className="financial-metric-card growth">
              <div className="metric-header">
                <div className="metric-icon">
                  {businessMetrics.revenueMetrics.monthOverMonthGrowth >= 0 ?
                    <TrendingUp size={20} /> : <TrendingDown size={20} />
                  }
                </div>
                <h3>{t('dashboard.monthOverMonthGrowth')}</h3>
              </div>
              <div className="metric-value">
                {businessMetrics.revenueMetrics.loading ? (
                  <div className="loading-spinner small"></div>
                ) : (
                  <span className={`value-main ${businessMetrics.revenueMetrics.monthOverMonthGrowth >= 0 ? 'positive' : 'negative'
                    }`}>
                    {businessMetrics.revenueMetrics.monthOverMonthGrowth >= 0 ? '+' : ''}
                    {businessMetrics.revenueMetrics.monthOverMonthGrowth.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Business Overview Stats - REMOVED "Sedi Attive" (Active Locations) */}
        <div className="dashboard-section">
          <h2 className="section-title">{t('dashboard.businessOverview')}</h2>
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Users size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <div className="stat-label">{t('dashboard.totalCustomers')}</div>
                  <div className="stat-value">
                    {stats.loading ? '...' : stats.totalCustomers}
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Building size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <div className="stat-label">{t('dashboard.totalContracts')}</div>
                  <div className="stat-value">
                    {stats.loading ? '...' : stats.totalContracts}
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Calendar size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <div className="stat-label">{t('dashboard.activeBookings')}</div>
                  <div className="stat-value">
                    {stats.loading ? '...' : stats.activeBookings}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Charts Section - Contracts */}
        {hasContractData && (
          <div className="dashboard-section">
            <div className="dashboard-chart">
              <h2 className="chart-title">{t('dashboard.contractsAnalytics')}</h2>
              <p className="chart-subtitle">{t('dashboard.contractsAnalyticsSubtitle')}</p>
              {chartLoading ? (
                <div className="chart-loading">
                  <div className="loading-spinner"></div>
                  <span>Caricamento dati...</span>
                </div>
              ) : !chartsReady ? (
                <div className="chart-loading">
                  <div className="loading-spinner"></div>
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
                      <Bar dataKey="Abbonamento" stackId="a" fill="#3b82f6" name={t('dashboard.subscriptions')} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Pacchetto" stackId="a" fill="#f59e0b" name={t('dashboard.packages')} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Charts Section - Utilization */}
        {!businessMetrics.utilizationMetrics.loading &&
          businessMetrics.utilizationMetrics.packageUtilization.length > 0 && (
            <div className="dashboard-section">
              <div className="dashboard-chart">
                <h2 className="chart-title">{t('dashboard.packageUtilization')}</h2>
                <p className="chart-subtitle">{t('dashboard.customerUsagePatterns')}</p>
                <div className="chart-container utilization">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={businessMetrics.utilizationMetrics.packageUtilization.slice(0, 10)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="customerName"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [`${value.toFixed(1)}%`, 'Utilization']}
                        labelFormatter={(label) => `Customer: ${label}`}
                      />
                      <Bar
                        dataKey="utilizationRate"
                        fill="#10b981"
                        name="Utilization Rate (%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
      </>
    );
  };

  // Customer Dashboard Render
  const renderCustomerDashboard = () => {
    // Show loading if profile check is not complete
    if (!profileCheckComplete) {
      return (
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <span>{t('dashboard.checkingProfile') || 'Checking profile...'}</span>
        </div>
      );
    }

    // If profile completion is required, show a message (the modal will handle the form)
    if (showProfileCompletion) {
      return (
        <div className="dashboard-profile-completion">
          <div className="profile-completion-message">
            <h1>{t('dashboard.welcomeMessage') || 'Welcome!'}</h1>
            <p>{t('dashboard.profileCompletionRequired') || 'Please complete your profile to continue.'}</p>
            <div className="loading-spinner"></div>
          </div>
        </div>
      );
    }
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
        logger.error('Error updating auto-renewal:', error);
        toast.error(t('messages.errorUpdatingAutoRenew') || 'Errore nell\'aggiornamento del rinnovo automatico');
      } finally {
        setUpdatingAutoRenew(prev => ({ ...prev, [contractId]: false }));
      }
    };

    // Handle package booking
    const handleBookPackage = (contract) => {
      logger.log('Opening package booking for contract:', contract);
      setSelectedPackageContract(contract);
      setShowPackageBooking(true);
    };

    // Handle purchase more entries or new package
    const handlePurchaseMore = (contract = null) => {
      // Check customer status first
      if (profile?.role === 'user' && customerStatus !== 'active') {
        setShowStatusAlert(true);
        return;
      }

      logger.log('Navigating to contract form for new purchase');
      if (contract) {
        // Navigate to contract form with preselected service and location
        window.location.hash = `/contracts/new?service_id=${contract.service_id}&location_id=${contract.location_id}`;
      } else {
        // Navigate to contract form without preselection
        window.location.hash = '/contracts/new';
      }
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
            {contractsLoading ? (
              <div className="loading-message">
                <div className="loading-spinner"></div>
                <span>{t('dashboard.loadingContracts') || 'Caricamento contratti...'}</span>
              </div>
            ) : activeContracts.length === 0 ? (
              <div className="no-contracts-message">
                <div className="empty-icon">
                  <Building size={48} />
                </div>
                <p>{t('dashboard.noContractsYet') || 'No contracts yet'}</p>
                <button
                  className="btn-contract-primary"
                  onClick={() => handlePurchaseMore()}
                >
                  <Plus size={16} />
                  {t('dashboard.createFirstContract') || 'Crea il tuo primo contratto'}
                </button>
              </div>
            ) : (
              activeContracts.map((contract) => {
                const isExpired = isContractExpired(contract.end_date);
                const daysRemaining = calculateDaysRemaining(contract.end_date);

                // Calculate remaining entries with proper decimal handling
                let remainingEntries = null;
                if (contract.service_type === 'pacchetto') {
                  const maxEntries = parseFloat(contract.service_max_entries || 0);
                  const usedEntries = parseFloat(contract.entries_used || 0);
                  remainingEntries = Math.round((maxEntries - usedEntries) * 10) / 10;
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
                            {/* Subscription Actions - Only show auto-renew, REMOVED renew button */}
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
              })
            )}
          </div>
        </div>

        {/* Quick Actions section */}
        <div className="dashboard-section">
          <h2 className="section-title">{t('dashboard.quickActions') || 'Azioni Rapide'}</h2>
          <div className="quick-actions">
            <button
              className="action-card"
              onClick={() => handlePurchaseMore()}
            >
              <div className="action-icon">
                <Plus size={24} />
              </div>
              <div className="action-content">
                <h3>{t('dashboard.newContract') || 'Nuovo Contratto'}</h3>
                <p>{t('dashboard.newContractDesc') || 'Acquista un nuovo pacchetto o abbonamento'}</p>
              </div>
              <div className="action-arrow">→</div>
            </button>
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
                  <div className="stat-label">{t('dashboard.totalPartners')}</div>
                  <div className="stat-value">
                    {stats.loading ? '...' : stats.totalPartners}
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <MapPin size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <div className="stat-label">{t('dashboard.activeLocations')}</div>
                  <div className="stat-value">
                    {stats.loading ? '...' : stats.totalLocations}
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <Users size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <div className="stat-label">{t('dashboard.totalUsers')}</div>
                  <div className="stat-value">
                    {stats.loading ? '...' : stats.totalUsers}
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-icon">
                  <DollarSign size={24} color="#9ca3af" />
                </div>
                <div className="stat-info">
                  <div className="stat-label">{t('dashboard.totalContractValue')}</div>
                  <div className="stat-value">
                    {stats.loading ? '...' : new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(stats.totalContractValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Partners Active Users Monitoring - SUPERADMIN ONLY */}
          <div className="dashboard-section">
            <h2 className="section-title">
              <Users size={20} style={{ marginRight: '0.5rem' }} />
              {t('dashboard.partnersUsersMonitoring') || 'Monitoraggio Utenti Partner'}
            </h2>
            <div className="dashboard-chart">
              <h3 className="chart-subtitle">
                {t('dashboard.activeUsersVsPlanLimits') || 'Utenti Attivi vs Limiti Piano - Top Partner'}
              </h3>
              {partnersUsersLoading ? (
                <div className="chart-loading">
                  <div className="loading-spinner"></div>
                  <span>Caricamento dati...</span>
                </div>
              ) : partnersUsersData.length === 0 ? (
                <div className="chart-empty">
                  <p>{t('dashboard.noPartnersData') || 'Nessun dato di fatturazione disponibile'}</p>
                </div>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={partnersUsersData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                      layout="horizontal"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="partnerName"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) => [
                          value,
                          name === 'activeUsers' ? 'Utenti Attivi' : 'Limite Piano'
                        ]}
                        labelFormatter={(label) => `Partner: ${label}`}
                      />
                      <Legend
                        formatter={(value) =>
                          value === 'activeUsers' ? 'Utenti Attivi' : 'Limite Piano'
                        }
                        wrapperStyle={{ paddingTop: '20px' }}
                      />
                      <Bar
                        dataKey="activeUsers"
                        fill="#3b82f6"
                        name="activeUsers"
                        radius={[4, 4, 0, 0]}
                      >
                        {partnersUsersData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.isOverLimit ? '#ef4444' : '#3b82f6'}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="planLimit"
                        fill="#10b981"
                        name="planLimit"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Over-Limit Partners Summary */}
                  {partnersUsersData.some(p => p.isOverLimit) && (
                    <div className="partners-overlimit-alert">
                      <AlertTriangle size={20} />
                      <div className="alert-content">
                        <strong>
                          {partnersUsersData.filter(p => p.isOverLimit).length} {' '}
                          {t('dashboard.partnersOverLimit') || 'partner oltre il limite'}
                        </strong>
                        <div className="overlimit-partners-list">
                          {partnersUsersData
                            .filter(p => p.isOverLimit)
                            .map((p, idx) => (
                              <span key={idx} className="overlimit-partner">
                                {p.partnerName} ({p.activeUsers}/{p.planLimit})
                              </span>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contracts Analytics Chart - ONLY IF DATA EXISTS */}
          {hasContractData && (
            <div className="dashboard-section">
              <div className="dashboard-chart">
                <h2 className="chart-title">Andamento Contratti - Tutti i Partner</h2>
                <p className="chart-subtitle">Ultimi 4 mesi e prossimi 8 mesi - contratti per tipologia</p>
                {chartLoading ? (
                  <div className="chart-loading">
                    <div className="loading-spinner"></div>
                    <span>Caricamento dati...</span>
                  </div>
                ) : !chartsReady ? (
                  <div className="chart-loading">
                    <div className="loading-spinner"></div>
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
          )}
        </>
      );
    }

    if (profile?.role === 'admin') {
      return renderEnhancedPartnerDashboard();
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
          {/* Profile Completion Modal - MUST complete on first login */}
          {showProfileCompletion && customerProfileData && (
            <CustomerForm
              isOpen={true} // Always open when showProfileCompletion is true
              onClose={() => {
                logger.log('Profile completion form close attempted - but it should be mandatory');
                // Don't allow closing during profile completion
              }}
              onSuccess={handleProfileCompletionSuccess}
              customer={customerProfileData}
              partnerUuid={profile?.partner_uuid}
              userId={user?.id}
              isProfileCompletion={true}
            />
          )}

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
      {/* Tour Components */}
      <WelcomeModal />
      <TourOverlay />
      {/* Status Alert Modal */}
      <MessageModal
        isOpen={showStatusAlert}
        onClose={() => setShowStatusAlert(false)}
        title={t('contracts.actionNotAllowed') || 'Azione non consentita'}
        message={t('contracts.statusRestrictionMessage') || 'Il tuo profilo non è ancora attivo. Non puoi creare contratti finché non sarai qualificato dal partner.'}
        closeText={t('common.close') || 'Chiudi'}
      />
    </div>
  );
};

export default Dashboard;