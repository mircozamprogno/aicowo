// src/pages/Bookings.jsx
import { AlertTriangle, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, Filter, Home, Package, Plus, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import PartnerBookingForm from '../components/forms/PartnerBookingForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import '../styles/pages/bookings.css';

import ConfirmModal from '../components/common/ConfirmModal';

import { logActivity } from '../utils/activityLogger';
import logger from '../utils/logger';

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
  
  // Customer contracts for enhanced details
  const [customerContracts, setCustomerContracts] = useState([]);
  
  const { profile, user } = useAuth();
  const { t } = useTranslation();

  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';

  const [closures, setClosures] = useState([]);

  // Booking details modal state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchBookings();
      if (isPartnerAdmin) {
        fetchFilterOptions();
      }
      if (isCustomer) {
        checkAvailablePackages();
        fetchCustomerContracts();
      }
    }
  }, [profile]);

  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);


  useEffect(() => {
    if (profile && (isPartnerAdmin || isCustomer)) {
      fetchClosures();
    }
  }, [currentDate, viewType, filters.location, profile]);

  const fetchCustomerContracts = async () => {
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customerData) return;

      const { data: contractsData, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          service_name,
          service_type,
          service_max_entries,
          contract_status,
          start_date,
          end_date,
          service_cost,
          service_currency,
          entries_used,
          requires_payment,
          is_archived,
          resource_name,
          resource_type,
          location_name
        `)
        .eq('customer_id', customerData.id)
        .eq('is_archived', false)
        .eq('contract_status', 'active');

      if (error) throw error;

      setCustomerContracts(contractsData || []);
    } catch (error) {
      logger.error('Error fetching customer contracts:', error);
    }
  };

  const checkAvailablePackages = async () => {
    try {
      logger.log('Checking available packages for user:', user.id);
      
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerError) {
        logger.error('Error fetching customer:', customerError);
        return;
      }

      if (!customerData) {
        logger.log('No customer data found for user');
        return;
      }

      logger.log('Customer ID:', customerData.id);

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
        logger.error('Error fetching package contracts:', error);
        throw error;
      }

      logger.log('Package contracts found:', packageContracts);

      if (!packageContracts || packageContracts.length === 0) {
        logger.log('No active package contracts found');
        setHasAvailablePackages(false);
        return;
      }

      const hasAvailable = packageContracts.some(contract => {
        const usedReservations = contract.package_reservations?.filter(
          r => r.reservation_status === 'confirmed'
        ).length || 0;
        
        const totalReservations = contract.service_max_entries || 0;
        const available = usedReservations < totalReservations;
        
        logger.log(`Contract ${contract.contract_number}:`, {
          total: totalReservations,
          used: usedReservations,
          available: available
        });
        
        return available;
      });

      logger.log('Has available packages:', hasAvailable);
      setHasAvailablePackages(hasAvailable);
    } catch (error) {
      logger.error('Error checking available packages:', error);
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

      const [
        { data: bookingsData, error: bookingsError },
        { data: packagesData, error: packagesError }
      ] = await Promise.all([bookingsQuery, packagesQuery]);

      if (bookingsError) throw bookingsError;
      if (packagesError) throw packagesError;

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

      const normalizedBookings = (bookingsData || []).map(booking => ({
        ...booking,
        booking_type: 'subscription'
      }));

      const combined = [...normalizedBookings, ...normalizedPackages].sort(
        (a, b) => new Date(a.start_date) - new Date(b.start_date)
      );

      setBookings(combined);
    } catch (error) {
      logger.error('Error fetching bookings:', error);
      toast.error(t('messages.errorLoadingBookings') || 'Error loading bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };


  const fetchClosures = async () => {
    try {
      // Calculate date range based on view type
      let startDate, endDate;
      
      if (viewType === 'month') {
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        startDate = new Date(firstDay);  // <-- FIXED: assign to outer variable
        const dayOfWeek = firstDay.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToSubtract);
        
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        endDate = new Date(lastDay);
        endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
      } else if (viewType === 'week') {
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - currentDate.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else {
        startDate = new Date(currentDate);
        endDate = new Date(currentDate);
      }

      let closuresQuery = supabase
        .from('operating_closures')
        .select(`
          *,
          locations (
            id,
            location_name
          ),
          location_resources (
            id,
            resource_name,
            resource_type
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .lte('closure_start_date', formatDate(endDate))
        .gte('closure_end_date', formatDate(startDate));

      // Apply location filter if set
      if (filters.location) {
        closuresQuery = closuresQuery.or(`location_id.eq.${filters.location},location_resources.locations.id.eq.${filters.location}`);
      }

      const { data: closuresData, error } = await closuresQuery;

      if (error) throw error;

      setClosures(closuresData || []);
    } catch (error) {
      logger.error('Error fetching closures:', error);
      setClosures([]);
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
      logger.error('Error fetching filter options:', error);
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

  const handlePartnerBookingSuccess = async (reservation) => {
    logger.log('Booking successful:', reservation);
    
    try {
      // Fetch full reservation details for logging
      let fullReservation = null;
      let isPackageReservation = false;
      
      // Determine if it's a package reservation or subscription booking
      if (reservation.duration_type) {
        // It's a package reservation
        isPackageReservation = true;
        const { data, error } = await supabase
          .from('package_reservations')
          .select(`
            *,
            contracts (
              contract_number,
              service_name,
              service_type
            ),
            location_resources (
              resource_name,
              resource_type,
              locations (
                location_name
              )
            ),
            customers (
              first_name,
              second_name,
              email,
              company_name
            )
          `)
          .eq('id', reservation.id)
          .single();
        
        if (!error && data) {
          fullReservation = data;
        }
      } else {
        // It's a subscription booking
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            contracts (
              contract_number,
              service_name,
              service_type
            ),
            location_resources (
              resource_name,
              resource_type,
              locations (
                location_name
              )
            ),
            customers (
              first_name,
              second_name,
              email,
              company_name
            )
          `)
          .eq('id', reservation.id)
          .single();
        
        if (!error && data) {
          fullReservation = data;
        }
      }

      if (fullReservation) {
        const customerName = fullReservation.customers?.company_name || 
          `${fullReservation.customers?.first_name} ${fullReservation.customers?.second_name}`;
        
        const resourceInfo = `${fullReservation.location_resources?.resource_name} (${fullReservation.location_resources?.resource_type})`;
        const locationName = fullReservation.location_resources?.locations?.location_name;

        if (isPackageReservation) {
          // Log package reservation
          const durationText = fullReservation.duration_type === 'full_day' 
            ? 'Full Day' 
            : `Half Day (${fullReservation.time_slot})`;
          
          await logActivity({
            action_category: 'booking',
            action_type: 'created',
            entity_id: fullReservation.id.toString(),
            entity_type: 'package_reservations',
            description: isCustomer 
              ? `Customer created package reservation for ${resourceInfo} at ${locationName} on ${fullReservation.reservation_date}`
              : `Created package reservation for ${customerName} at ${resourceInfo}, ${locationName} on ${fullReservation.reservation_date}`,
            metadata: {
              reservation_id: fullReservation.id,
              contract_number: fullReservation.contracts?.contract_number,
              contract_id: fullReservation.contract_id,
              customer_name: customerName,
              customer_id: fullReservation.customer_id,
              resource_name: fullReservation.location_resources?.resource_name,
              resource_type: fullReservation.location_resources?.resource_type,
              resource_id: fullReservation.resource_id,
              location_name: locationName,
              location_id: fullReservation.location_resources?.locations?.id,
              reservation_date: fullReservation.reservation_date,
              duration_type: fullReservation.duration_type,
              time_slot: fullReservation.time_slot,
              duration_text: durationText,
              service_name: fullReservation.contracts?.service_name,
              service_type: fullReservation.contracts?.service_type,
              created_by: isCustomer ? 'customer' : 'partner',
              self_service: isCustomer
            }
          });
        } else {
          // Log subscription booking
          await logActivity({
            action_category: 'booking',
            action_type: 'created',
            entity_id: fullReservation.id.toString(),
            entity_type: 'bookings',
            description: isCustomer 
              ? `Customer created subscription booking for ${resourceInfo} at ${locationName}`
              : `Created subscription booking for ${customerName} at ${resourceInfo}, ${locationName}`,
            metadata: {
              booking_id: fullReservation.id,
              contract_number: fullReservation.contracts?.contract_number,
              contract_id: fullReservation.contract_id,
              customer_name: customerName,
              customer_id: fullReservation.customer_id,
              resource_name: fullReservation.location_resources?.resource_name,
              resource_type: fullReservation.location_resources?.resource_type,
              resource_id: fullReservation.resource_id,
              location_name: locationName,
              location_id: fullReservation.location_resources?.locations?.id,
              start_date: fullReservation.start_date,
              end_date: fullReservation.end_date,
              service_name: fullReservation.contracts?.service_name,
              service_type: fullReservation.contracts?.service_type,
              created_by: isCustomer ? 'customer' : 'partner',
              self_service: isCustomer
            }
          });
        }
      }
    } catch (error) {
      logger.error('Error logging booking activity:', error);
      // Don't fail the booking if logging fails
    }

    fetchBookings();
    if (isCustomer) {
      checkAvailablePackages();
      fetchCustomerContracts();
    }
    setShowPartnerBooking(false);
    toast.success(isCustomer ? 'Reservation created successfully' : 'Booking created successfully for customer');
  };



  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;

    const isPackage = selectedBooking.booking_type === 'package';
    const bookingId = isPackage ? selectedBooking.id.replace('pkg-', '') : selectedBooking.id;

    try {
      setLoading(true);

      if (isPackage) {
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
          .eq('id', bookingId)
          .single();

        if (fetchError) throw fetchError;

        // Soft delete the package reservation
        const { error: deleteError } = await supabase
          .from('package_reservations')
          .update({ 
            is_archived: true,
            reservation_status: 'cancelled'
          })
          .eq('id', bookingId);

        if (deleteError) throw deleteError;

        // Restore the entry count in the contract
        const { error: contractError } = await supabase
          .from('contracts')
          .update({ 
            entries_used: Math.max(0, (packageData.contracts.entries_used || 0) - 1)
          })
          .eq('id', packageData.contract_id);

        if (contractError) throw contractError;

        // Log activity
        const customerName = packageData.customers?.company_name || 
          `${packageData.customers?.first_name} ${packageData.customers?.second_name}`;
        
        try {
          await logActivity({
            // partner_uuid: profile.partner_uuid, // ADD THIS
            action_category: 'booking',
            action_type: 'deleted',
            entity_type: 'package_reservations',
            entity_id: parseInt(bookingId),
            description: isCustomer 
              ? `Customer deleted package reservation for ${packageData.location_resources?.resource_name}`
              : `Deleted package reservation for ${customerName} at ${packageData.location_resources?.resource_name}`,
            metadata: {
              reservation_id: parseInt(bookingId),
              contract_id: packageData.contract_id,
              contract_number: packageData.contracts?.contract_number,
              service_name: packageData.contracts?.service_name,
              customer_name: customerName,
              customer_id: packageData.customer_id,
              resource_name: packageData.location_resources?.resource_name,
              resource_type: packageData.location_resources?.resource_type,
              resource_id: packageData.resource_id,
              location_name: packageData.location_resources?.locations?.location_name,
              location_id: packageData.location_resources?.locations?.id,
              reservation_date: packageData.reservation_date,
              duration_type: packageData.duration_type,
              time_slot: packageData.time_slot,
              deleted_by: isCustomer ? 'customer' : 'partner'
            }
          });
        } catch (logError) {
          logger.error('Error logging package deletion activity:', logError);
          // Don't fail the deletion if logging fails
        }

        toast.success(t('bookings.packageReservationDeleted'));
      } else {
        // Handle subscription booking deletion
        const { data: bookingData, error: fetchError } = await supabase
          .from('bookings')
          .select(`
            *,
            contracts(id, customer_id, contract_number, service_name),
            location_resources(
              resource_name,
              resource_type,
              locations(id, location_name)
            ),
            customers(first_name, second_name, email, company_name)
          `)
          .eq('id', bookingId)
          .single();

        if (fetchError) throw fetchError;

        // Soft delete the booking
        const { error: deleteError } = await supabase
          .from('bookings')
          .update({ 
            is_archived: true,
            booking_status: 'cancelled'
          })
          .eq('id', bookingId);

        if (deleteError) throw deleteError;

        // Log activity
        const customerName = bookingData.customers?.company_name || 
          `${bookingData.customers?.first_name} ${bookingData.customers?.second_name}`;
        
        try {
          await logActivity({
            // partner_uuid: profile.partner_uuid, // ADD THIS
            action_category: 'booking',
            action_type: 'deleted',
            entity_type: 'bookings',
            entity_id: parseInt(bookingId),
            description: isCustomer 
              ? `Customer deleted subscription booking for ${bookingData.location_resources?.resource_name}`
              : `Deleted subscription booking for ${customerName} at ${bookingData.location_resources?.resource_name}`,
            metadata: {
              booking_id: parseInt(bookingId),
              contract_id: bookingData.contract_id,
              contract_number: bookingData.contracts?.contract_number,
              service_name: bookingData.contracts?.service_name,
              customer_name: customerName,
              customer_id: bookingData.customer_id,
              resource_name: bookingData.location_resources?.resource_name,
              resource_type: bookingData.location_resources?.resource_type,
              resource_id: bookingData.resource_id,
              location_name: bookingData.location_resources?.locations?.location_name,
              location_id: bookingData.location_resources?.locations?.id,
              start_date: bookingData.start_date,
              end_date: bookingData.end_date,
              deleted_by: isCustomer ? 'customer' : 'partner'
            }
          });
        } catch (logError) {
          logger.error('Error logging booking deletion activity:', logError);
          // Don't fail the deletion if logging fails
        }

        toast.success(t('bookings.subscriptionBookingDeleted'));
      }

      // Refresh data
      await fetchBookings();
      if (isCustomer) {
        await checkAvailablePackages();
        await fetchCustomerContracts();
      }

      // Close modal
      setShowBookingDetails(false);
      setSelectedBooking(null);

    } catch (error) {
      logger.error('Error deleting booking:', error);
      toast.error(t('bookings.errorDeletingBooking'));
    } finally {
      setLoading(false);
    }
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

  const getClosuresForDate = (date) => {
    const dateStr = formatDate(date);
    return closures.filter(closure => {
      return dateStr >= closure.closure_start_date && dateStr <= closure.closure_end_date;
    });
  };

  // Add helper function to categorize closures (after getClosuresForDate)

  const categorizeClosures = (closuresForDate) => {
    const locationClosures = closuresForDate.filter(c => c.closure_scope === 'location');
    const resourceTypeClosures = closuresForDate.filter(c => c.closure_scope === 'resource_type');
    const specificResourceClosures = closuresForDate.filter(c => c.closure_scope === 'resource');

    return {
      hasLocationClosure: locationClosures.length > 0,
      locationClosure: locationClosures[0],
      partialClosureCount: resourceTypeClosures.length + specificResourceClosures.length,
      allClosures: closuresForDate
    };
  };

  // Add helper to get closure color by type (after categorizeClosures)

  const getClosureColor = (closureType) => {
    const colors = {
      'holiday': '#10b981',
      'maintenance': '#f59e0b',
      'special_event': '#8b5cf6',
      'emergency': '#ef4444',
      'custom': '#6b7280'
    };
    return colors[closureType] || '#6b7280';
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

  const getBookingDisplayText = (booking) => {
    // For partners: show customer name
    if (!isCustomer) {
      const customerName = booking.customers?.company_name || booking.customers?.first_name;
      
      if (booking.booking_type === 'package') {
        const durationText = booking.duration_type === 'full_day' 
          ? t('reservations.fullDay') 
          : `${t('reservations.halfDay')} (${booking.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon')})`;
        return `${customerName} - ${durationText}`;
      }
      
      return customerName;
    }
    
    // For customers: show resource + location
    const resourceName = booking.location_resources?.resource_name;
    const locationName = booking.location_resources?.locations?.location_name;
    
    if (booking.booking_type === 'package') {
      const durationText = booking.duration_type === 'full_day' 
        ? t('reservations.fullDay') 
        : booking.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon');
      return `${resourceName} - ${durationText}`;
    }
    
    return `${resourceName} - ${locationName}`;
  };

  const calculateDaysRemaining = (endDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getContractForBooking = (booking) => {
    if (!isCustomer) return null;
    return customerContracts.find(c => c.id === booking.contracts?.id);
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
          {[t('calendar.monday'), t('calendar.tuesday'), t('calendar.wednesday'), t('calendar.thursday'), t('calendar.friday'), t('calendar.saturday'), t('calendar.sunday')].map(d => (
            <div key={d} className="calendar-weekday">{d}</div>
          ))}
        </div>
        <div className="calendar-days">
          {days.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = formatDate(day) === formatDate(new Date());
            const dayBookings = getBookingsForDate(day);
            const dayClosures = getClosuresForDate(day);
            const closureInfo = categorizeClosures(dayClosures);
            
            return (
              <div
                key={idx}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${closureInfo.hasLocationClosure ? 'location-closed' : ''}`}
                onClick={() => { setCurrentDate(new Date(day)); setViewType('day'); }}
              >
                <div className="calendar-day-header">
                  <div className="calendar-day-number">{day.getDate()}</div>
                  {closureInfo.hasLocationClosure && (
                    <div 
                      className="closure-badge full-closure"
                      title={`${t('bookings.locationClosed')}: ${closureInfo.locationClosure.closure_reason || t(`reservations.closureType.${closureInfo.locationClosure.closure_type}`)}`}
                    >
                      🚫
                    </div>
                  )}
                  {!closureInfo.hasLocationClosure && closureInfo.partialClosureCount > 0 && (
                    <div 
                      className="closure-badge partial-closure"
                      title={`${closureInfo.partialClosureCount} ${t('bookings.resourcesClosed')}`}
                    >
                      ⚠️{closureInfo.partialClosureCount}
                    </div>
                  )}
                </div>
                
                {closureInfo.hasLocationClosure && (
                  <div className="closure-overlay">
                    <div className="closure-message">
                      {closureInfo.locationClosure.closure_reason || t(`reservations.closureType.${closureInfo.locationClosure.closure_type}`)}
                    </div>
                  </div>
                )}
                
                {!closureInfo.hasLocationClosure && (
                  <div className="calendar-day-bookings">
                    {dayBookings.slice(0, 3).map(b => {
                      const contract = getContractForBooking(b);
                      return (
                        <div
                          key={b.id}
                          className="calendar-booking-item"
                          style={{ backgroundColor: getResourceColor(b) }}
                          title={`${getBookingDisplayText(b)} - ${b.location_resources?.resource_name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(b);
                            setShowBookingDetails(true);
                          }}
                        >
                          <span className="booking-title">{getBookingDisplayText(b)}</span>
                          {isCustomer && contract && contract.service_type === 'pacchetto' && (
                            <span className="booking-entries-badge">
                              {(contract.service_max_entries - contract.entries_used)} {t('bookings.left')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <div className="calendar-more-bookings">
                        +{dayBookings.length - 3} {t('bookings.more')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = currentDate.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(currentDate.getDate() - daysToSubtract);
    
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
            const dayClosures = getClosuresForDate(day);
            const closureInfo = categorizeClosures(dayClosures);
            
            return (
              <div key={idx} className={`calendar-week-day-header ${isToday ? 'today' : ''} ${closureInfo.hasLocationClosure ? 'has-closure' : ''}`}>
                <div className="week-day-name">
                  {day.toLocaleDateString(locale, { weekday: 'short' })}
                </div>
                <div className="week-day-number">{day.getDate()}</div>
                {closureInfo.hasLocationClosure && (
                  <div className="week-closure-indicator" title={t('bookings.locationClosed')}>
                    🚫
                  </div>
                )}
                {!closureInfo.hasLocationClosure && closureInfo.partialClosureCount > 0 && (
                  <div className="week-closure-indicator partial" title={`${closureInfo.partialClosureCount} ${t('bookings.resourcesClosed')}`}>
                    ⚠️
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="calendar-week-content">
          {weekDays.map((day, idx) => {
            const isToday = formatDate(day) === formatDate(new Date());
            const dayBookings = getBookingsForDate(day);
            const dayClosures = getClosuresForDate(day);
            const closureInfo = categorizeClosures(dayClosures);
            
            return (
              <div 
                key={idx} 
                className={`calendar-week-day ${isToday ? 'today' : ''} ${closureInfo.hasLocationClosure ? 'location-closed' : ''}`}
                onClick={() => { setCurrentDate(new Date(day)); setViewType('day'); }}
              >
                {closureInfo.hasLocationClosure ? (
                  <div className="week-closure-message">
                    {closureInfo.locationClosure.closure_reason || t(`reservations.closureType.${closureInfo.locationClosure.closure_type}`)}
                  </div>
                ) : (
                  <div className="week-day-bookings">
                    {dayBookings.map(b => {
                      const contract = getContractForBooking(b);
                      return (
                        <div
                          key={b.id}
                          className="week-booking-item"
                          style={{ backgroundColor: getResourceColor(b) }}
                          title={`${getBookingDisplayText(b)} - ${b.location_resources?.resource_name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(b);
                            setShowBookingDetails(true);
                          }}
                        >
                          <div className="week-booking-title">{getBookingDisplayText(b)}</div>
                          <div className="week-booking-resource">{b.location_resources?.resource_name}</div>
                          {isCustomer && contract && contract.service_type === 'pacchetto' && (
                            <div className="week-booking-entries">
                              {(contract.service_max_entries - contract.entries_used)} {t('bookings.entriesLeft')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCustomerDayView = () => {
    const dayBookings = getBookingsForDate(currentDate);
    const dayClosures = getClosuresForDate(currentDate);
    const closureInfo = categorizeClosures(dayClosures);
    const subscriptions = dayBookings.filter(b => b.booking_type === 'subscription');
    const packages = dayBookings.filter(b => b.booking_type === 'package');

    return (
      <div className="customer-day-view">
        <div className="day-view-header">
          <h2>{formatDisplayDate(currentDate)}</h2>
        </div>

        {/* Closure Alert Banner */}
        {closureInfo.hasLocationClosure && (
          <div className="closure-alert location-closure-alert">
            <div className="closure-alert-icon">🚫</div>
            <div className="closure-alert-content">
              <h4>{t('bookings.locationClosedToday')}</h4>
              <p>{closureInfo.locationClosure.closure_reason || t(`reservations.closureType.${closureInfo.locationClosure.closure_type}`)}</p>
              {closureInfo.locationClosure.locations && (
                <p className="closure-location">📍 {closureInfo.locationClosure.locations.location_name}</p>
              )}
            </div>
          </div>
        )}

        {!closureInfo.hasLocationClosure && closureInfo.partialClosureCount > 0 && (
          <div className="closure-alert partial-closure-alert">
            <div className="closure-alert-icon">⚠️</div>
            <div className="closure-alert-content">
              <h4>{t('bookings.partialClosureToday')}</h4>
              <div className="closure-list">
                {closureInfo.allClosures.map((closure, idx) => (
                  <div key={idx} className="closure-item">
                    <span className="closure-scope-badge" style={{ backgroundColor: getClosureColor(closure.closure_type) }}>
                      {closure.closure_scope === 'resource_type' 
                        ? t(`resources.${closure.resource_type}`)
                        : closure.location_resources?.resource_name
                      }
                    </span>
                    <span className="closure-reason">
                      {closure.closure_reason || t(`reservations.closureType.${closure.closure_type}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {dayBookings.length === 0 && !closureInfo.hasLocationClosure ? (
          <div className="day-no-bookings">
            <Calendar size={48} className="empty-icon" />
            <p>{t('bookings.noBookingsForDay')}</p>
          </div>
        ) : (
          <>
            {/* Active Subscriptions Section */}
            {subscriptions.length > 0 && (
              <div className="customer-section">
                <h3 className="section-title">
                  <CheckCircle size={20} />
                  {t('bookings.activeSubscriptions')}
                </h3>
                <div className="customer-cards">
                  {subscriptions.map(booking => {
                    const contract = getContractForBooking(booking);
                    const daysRemaining = contract ? calculateDaysRemaining(contract.end_date) : 0;
                    
                    return (
                      <div key={booking.id} className="customer-booking-card subscription-card">
                        <div className="card-header">
                          <div className="card-color-bar" style={{ backgroundColor: getResourceColor(booking) }} />
                          <div className="card-title-section">
                            <h4>{booking.contracts?.service_name}</h4>
                            <span className="service-type-badge">{t('services.subscription')}</span>
                          </div>
                        </div>

                        <div className="card-section">
                          <h5 className="card-section-title">{t('bookings.whatYouCanAccess')}</h5>
                          <div className="access-details">
                            <div className="detail-row">
                              <span className="detail-label">{t('bookings.resource')}:</span>
                              <span className="detail-value">{booking.location_resources?.resource_name}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">{t('bookings.location')}:</span>
                              <span className="detail-value">{booking.location_resources?.locations?.location_name}</span>
                            </div>
                          </div>
                        </div>

                        {contract && (
                          <div className="card-section">
                            <h5 className="card-section-title">{t('bookings.contractStatus')}</h5>
                            <div className="contract-status-details">
                              <div className="status-row">
                                <Clock size={16} />
                                <span className={`days-remaining ${daysRemaining <= 7 ? 'warning' : ''}`}>
                                  {daysRemaining > 0 
                                    ? `${daysRemaining} ${t('contracts.daysRemaining')}`
                                    : t('contracts.expired')
                                  }
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">{t('bookings.validUntil')}:</span>
                                <span className="detail-value">
                                  {new Date(contract.end_date).toLocaleDateString(
                                    t('app.locale') === 'it' ? 'it-IT' : 'en-US'
                                  )}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">{t('bookings.contractValue')}:</span>
                                <span className="detail-value">
                                  {new Intl.NumberFormat('it-IT', {
                                    style: 'currency',
                                    currency: contract.service_currency || 'EUR'
                                  }).format(contract.service_cost)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Packages Section */}
            {packages.length > 0 && (
              <div className="customer-section">
                <h3 className="section-title">
                  <Package size={20} />
                  {t('bookings.packageBookings')}
                </h3>
                <div className="customer-cards">
                  {packages.map(booking => {
                    const contract = getContractForBooking(booking);
                    const daysRemaining = contract ? calculateDaysRemaining(contract.end_date) : 0;
                    const entriesRemaining = contract 
                      ? (contract.service_max_entries - contract.entries_used) 
                      : 0;
                    const utilizationPercent = contract 
                      ? ((contract.entries_used / contract.service_max_entries) * 100).toFixed(0)
                      : 0;
                    
                    return (
                      <div key={booking.id} className="customer-booking-card package-card">
                        <div className="card-header">
                          <div className="card-color-bar" style={{ backgroundColor: getResourceColor(booking) }} />
                          <div className="card-title-section">
                            <h4>{booking.contracts?.service_name}</h4>
                            <span className="service-type-badge package-badge">{t('services.package')}</span>
                          </div>
                        </div>

                        {contract && (
                          <>
                            <div className="card-section">
                              <h5 className="card-section-title">{t('bookings.packageOverview')}</h5>
                              <div className="package-overview">
                                <div className="entries-display">
                                  <div className="entries-progress-bar">
                                    <div 
                                      className="entries-progress-fill" 
                                      style={{ 
                                        width: `${utilizationPercent}%`,
                                        backgroundColor: entriesRemaining <= 2 ? '#ef4444' : entriesRemaining <= 5 ? '#f59e0b' : '#10b981'
                                      }}
                                    />
                                  </div>
                                  <div className="entries-text">
                                    <span className="entries-count">
                                      {entriesRemaining} {t('bookings.of')} {contract.service_max_entries} {t('bookings.entriesRemaining')}
                                    </span>
                                    <span className="entries-percent">{utilizationPercent}% {t('bookings.used')}</span>
                                  </div>
                                </div>
                                
                                <div className="package-alerts">
                                  {daysRemaining <= 14 && daysRemaining > 0 && (
                                    <div className="alert-item warning">
                                      <AlertTriangle size={16} />
                                      <span>{t('bookings.packageExpiringSoon', { days: daysRemaining })}</span>
                                    </div>
                                  )}
                                  {entriesRemaining <= 2 && entriesRemaining > 0 && (
                                    <div className="alert-item warning">
                                      <TrendingDown size={16} />
                                      <span>{t('bookings.lowEntriesRemaining', { entries: entriesRemaining })}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="package-stats">
                                  <div className="stat-item">
                                    <span className="stat-label">{t('bookings.costPerEntry')}:</span>
                                    <span className="stat-value">
                                      {new Intl.NumberFormat('it-IT', {
                                        style: 'currency',
                                        currency: contract.service_currency || 'EUR'
                                      }).format(contract.service_cost / contract.service_max_entries)}
                                    </span>
                                  </div>
                                  <div className="stat-item">
                                    <span className="stat-label">{t('bookings.remainingValue')}:</span>
                                    <span className="stat-value">
                                      {new Intl.NumberFormat('it-IT', {
                                        style: 'currency',
                                        currency: contract.service_currency || 'EUR'
                                      }).format((contract.service_cost / contract.service_max_entries) * entriesRemaining)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="card-section">
                              <h5 className="card-section-title">{t('bookings.todayBooking')}</h5>
                              <div className="booking-details">
                                <div className="detail-row">
                                  <span className="detail-label">{t('bookings.timeSlot')}:</span>
                                  <span className="detail-value">
                                    {booking.duration_type === 'full_day' 
                                      ? t('reservations.fullDay')
                                      : `${t('reservations.halfDay')} (${booking.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon')})`
                                    }
                                  </span>
                                </div>
                                <div className="detail-row">
                                  <span className="detail-label">{t('bookings.resource')}:</span>
                                  <span className="detail-value">{booking.location_resources?.resource_name}</span>
                                </div>
                                <div className="detail-row">
                                  <span className="detail-label">{t('bookings.location')}:</span>
                                  <span className="detail-value">{booking.location_resources?.locations?.location_name}</span>
                                </div>
                              </div>
                            </div>

                            {entriesRemaining > 0 && (
                              <div className="card-actions">
                                <button 
                                  className="action-button primary"
                                  onClick={() => setShowPartnerBooking(true)}
                                >
                                  <Plus size={16} />
                                  {t('bookings.bookAnother')}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderPartnerDayView = () => {
    const dayBookings = getBookingsForDate(currentDate);
    const dayClosures = getClosuresForDate(currentDate);
    const closureInfo = categorizeClosures(dayClosures);
    
    return (
      <div className="calendar-day-view">
        <div className="day-view-header">
          <h2>{formatDisplayDate(currentDate)}</h2>
          <p>{dayBookings.length} {dayBookings.length === 1 ? t('bookings.booking') : t('bookings.bookings')}</p>
        </div>

        {/* Closure Alert Banner */}
        {closureInfo.hasLocationClosure && (
          <div className="closure-alert location-closure-alert">
            <div className="closure-alert-icon">🚫</div>
            <div className="closure-alert-content">
              <h4>{t('bookings.locationClosedToday')}</h4>
              <p>{closureInfo.locationClosure.closure_reason || t(`reservations.closureType.${closureInfo.locationClosure.closure_type}`)}</p>
              {closureInfo.locationClosure.locations && (
                <p className="closure-location">📍 {closureInfo.locationClosure.locations.location_name}</p>
              )}
            </div>
          </div>
        )}

        {!closureInfo.hasLocationClosure && closureInfo.partialClosureCount > 0 && (
          <div className="closure-alert partial-closure-alert">
            <div className="closure-alert-icon">⚠️</div>
            <div className="closure-alert-content">
              <h4>{t('bookings.partialClosureToday')} - {closureInfo.partialClosureCount} {t('bookings.resourcesAffected')}</h4>
              <div className="closure-list">
                {closureInfo.allClosures.map((closure, idx) => (
                  <div key={idx} className="closure-item">
                    <span className="closure-scope-badge" style={{ backgroundColor: getClosureColor(closure.closure_type) }}>
                      {closure.closure_scope === 'resource_type' 
                        ? t(`resources.${closure.resource_type}`)
                        : closure.location_resources?.resource_name
                      }
                    </span>
                    <span className="closure-reason">
                      {closure.closure_reason || t(`reservations.closureType.${closure.closure_type}`)}
                    </span>
                    {closure.locations && (
                      <span className="closure-location">@ {closure.locations.location_name}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="day-view-content">
          {/* Rest of existing renderPartnerDayView content */}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    return isCustomer ? renderCustomerDayView() : renderPartnerDayView();
  };

  if (loading) return <div className="bookings-loading">{t('common.loading')}</div>;

  const showBookingButton = isPartnerAdmin || (isCustomer && hasAvailablePackages);

  return (
    <div className="bookings-page">
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
                <option value="scrivania">{t('locations.scrivania')}</option>
                <option value="sala_riunioni">{t('locations.salaRiunioni')}</option>
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

      <div className="calendar-legend">
        <h4>{t('bookings.legend')}:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>{t('services.subscription')} {t('locations.scrivania')}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#8b5cf6' }}></div>
            <span>{t('services.subscription')} {t('locations.salaRiunioni')}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
            <span>{t('services.package')} {t('locations.scrivania')}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>{t('services.package')} {t('locations.salaRiunioni')}</span>
          </div>
        </div>
      </div>

      <PartnerBookingForm
        isOpen={showPartnerBooking}
        onClose={() => setShowPartnerBooking(false)}
        onSuccess={handlePartnerBookingSuccess}
      />



      {/* Booking Details Modal */}
      {showBookingDetails && selectedBooking && (
        <div className="modal-overlay" onClick={() => setShowBookingDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('bookings.bookingDetails')}</h2>
              <button className="modal-close" onClick={() => setShowBookingDetails(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="booking-detail-section">
                <h3>{t('bookings.serviceInformation')}</h3>
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.serviceName')}:</span>
                  <span className="detail-value">{selectedBooking.contracts?.service_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.serviceType')}:</span>
                  <span className="detail-value">
                    {selectedBooking.booking_type === 'package' ? t('services.package') : t('services.subscription')}
                  </span>
                </div>
                {selectedBooking.booking_type === 'package' && (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">{t('bookings.duration')}:</span>
                      <span className="detail-value">
                        {selectedBooking.duration_type === 'full_day' 
                          ? t('reservations.fullDay')
                          : `${t('reservations.halfDay')} (${selectedBooking.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon')})`
                        }
                      </span>
                    </div>
                  </>
                )}
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.contractNumber')}:</span>
                  <span className="detail-value">{selectedBooking.contracts?.contract_number}</span>
                </div>
              </div>

              <div className="booking-detail-section">
                <h3>{t('bookings.resourceInformation')}</h3>
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.resource')}:</span>
                  <span className="detail-value">{selectedBooking.location_resources?.resource_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.resourceType')}:</span>
                  <span className="detail-value">
                    {selectedBooking.location_resources?.resource_type === 'scrivania' 
                      ? t('locations.scrivania') 
                      : t('locations.salaRiunioni')
                    }
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.location')}:</span>
                  <span className="detail-value">{selectedBooking.location_resources?.locations?.location_name}</span>
                </div>
              </div>

              {!isCustomer && selectedBooking.customers && (
                <div className="booking-detail-section">
                  <h3>{t('bookings.customerInformation')}</h3>
                  <div className="detail-row">
                    <span className="detail-label">{t('bookings.customer')}:</span>
                    <span className="detail-value">
                      {selectedBooking.customers.company_name || `${selectedBooking.customers.first_name} ${selectedBooking.customers.second_name}`}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('bookings.email')}:</span>
                    <span className="detail-value">{selectedBooking.customers.email}</span>
                  </div>
                </div>
              )}

              <div className="booking-detail-section">
                <h3>{t('bookings.bookingPeriod')}</h3>
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.startDate')}:</span>
                  <span className="detail-value">
                    {new Date(selectedBooking.start_date).toLocaleDateString(t('app.locale') === 'it' ? 'it-IT' : 'en-US')}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('bookings.endDate')}:</span>
                  <span className="detail-value">
                    {new Date(selectedBooking.end_date).toLocaleDateString(t('app.locale') === 'it' ? 'it-IT' : 'en-US')}
                  </span>
                </div>
              </div>

              {selectedBooking.contracts?.service_cost && (
                <div className="booking-detail-section">
                  <h3>{t('bookings.pricing')}</h3>
                  <div className="detail-row">
                    <span className="detail-label">{t('bookings.serviceCost')}:</span>
                    <span className="detail-value">
                      {new Intl.NumberFormat('it-IT', {
                        style: 'currency',
                        currency: selectedBooking.contracts.service_currency || 'EUR'
                      }).format(selectedBooking.contracts.service_cost)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-danger" 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                {t('bookings.deleteBooking')}
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setShowBookingDetails(false)}
                disabled={loading}
              >
                {t('common.close')}
              </button>
            </div>


          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteBooking}
        title={t('bookings.deleteBookingTitle')}
        message={
          selectedBooking?.booking_type === 'package'
            ? t('bookings.confirmDeletePackageReservation')
            : t('bookings.confirmDeleteSubscriptionBooking')
        }
        confirmText={t('bookings.confirmDelete')}
        cancelText={t('common.cancel')}
        isDestructive={true}
      />


    </div>
  );
};

export default Bookings;