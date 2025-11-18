import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import oneSignalEmailService from '../../services/oneSignalEmailService';
import { supabase } from '../../services/supabase';
import '../../styles/components/PartnerBookingForm.css';
import SearchableSelect from '../common/SearchableSelect';
import { toast } from '../common/ToastContainer';

const PartnerBookingForm = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  
  // Determine if user is a customer (end user) or partner admin
  const isCustomerUser = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  
  const [step, setStep] = useState(1); // 1: Select Customer (partner only), 2: Select Package & Book
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);
  
  const [formData, setFormData] = useState({
    reservation_date: '',
    duration_type: 'full_day',
    time_slot: 'morning'
  });
  
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPackage(null);
      setAvailablePackages([]);
      setFormData({
        reservation_date: '',
        duration_type: 'full_day',
        time_slot: 'morning'
      });
      setAvailabilityStatus(null);
      setShowConfirmation(false);
      
      // If customer user, automatically load their data and go to step 2
      if (isCustomerUser) {
        setStep(2); // Skip customer selection
        fetchCurrentCustomerData();
      } else {
        // Partner admin - show customer selection
        setStep(1);
        setSelectedCustomer(null);
        fetchCustomersWithPackages();
      }
    }
  }, [isOpen, isCustomerUser]);

  // Check availability when form data changes and package is selected
  useEffect(() => {
    if (formData.reservation_date && selectedPackage) {
      checkAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [formData.reservation_date, formData.duration_type, formData.time_slot, selectedPackage]);

  // Auto-load packages when customer is selected (for both customer users and partner admins)
  useEffect(() => {
    if (selectedCustomer && step === 2) {
      fetchPackagesForCustomer(selectedCustomer.id);
    }
  }, [selectedCustomer, step]);

  // Fetch current customer data (for end customers)
  const fetchCurrentCustomerData = async () => {
    setLoadingCustomers(true);
    try {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, first_name, second_name, email, company_name')
        .eq('user_id', user.id)
        .single();

      if (customerError) throw customerError;

      if (customerData) {
        setSelectedCustomer(customerData);
        // Packages will be loaded by the useEffect above
      } else {
        toast.error(t('customers.profileNotFound'));
        onClose();
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast.error(t('customers.errorLoadingProfile'));
      onClose();
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchCustomersWithPackages = async () => {
    setLoadingCustomers(true);
    try {
      // Get all customers for this partner
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, first_name, second_name, email, company_name')
        .eq('partner_uuid', profile.partner_uuid)
        .order('first_name');

      if (customersError) throw customersError;

      // Get active package contracts for these customers
      const customerIds = customersData.map(c => c.id);
      
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('customer_id, service_max_entries, entries_used')
        .eq('partner_uuid', profile.partner_uuid)
        .eq('service_type', 'pacchetto')
        .eq('contract_status', 'active')
        .eq('is_archived', false)
        .in('customer_id', customerIds);

      if (contractsError) throw contractsError;

      // Filter customers who have active packages with remaining entries
      const customersWithPackages = customersData.filter(customer => {
        const customerContracts = contractsData.filter(c => c.customer_id === customer.id);
        return customerContracts.some(contract => {
          const remaining = (contract.service_max_entries || 0) - (contract.entries_used || 0);
          return remaining >= 0.5; // At least half day remaining
        });
      });

      setCustomers(customersWithPackages);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error(t('customers.errorLoadingCustomers'));
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchPackagesForCustomer = async (customerId) => {
    setLoadingPackages(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: packagesData, error: packagesError } = await supabase
        .from('contracts')
        .select(`
          *,
          services (
            id,
            service_name,
            location_resources!fk_services_location_resource (
              id,
              resource_name,
              resource_type,
              quantity,
              locations (
                id,
                location_name
              )
            )
          )
        `)
        .eq('customer_id', customerId)
        .eq('service_type', 'pacchetto')
        .eq('contract_status', 'active')
        .eq('is_archived', false)
        .lte('start_date', today)
        .gte('end_date', today);

      if (packagesError) throw packagesError;

      // Filter packages with remaining entries
      const availablePackages = packagesData.filter(pkg => {
        const remaining = (pkg.service_max_entries || 0) - (pkg.entries_used || 0);
        return remaining >= 0.5;
      }).map(pkg => ({
        ...pkg,
        resource_name: pkg.services?.location_resources?.resource_name,
        resource_type: pkg.services?.location_resources?.resource_type,
        location_name: pkg.services?.location_resources?.locations?.location_name,
        location_id: pkg.services?.location_resources?.locations?.id,
        location_resource_id: pkg.services?.location_resources?.id
      }));

      setAvailablePackages(availablePackages);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error(t('contracts.errorLoadingPackages'));
      setAvailablePackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleCustomerSelect = async (e) => {
    const customerId = e.target.value;
    const customer = customers.find(c => c.id === parseInt(customerId));
    setSelectedCustomer(customer);
    
    if (customer) {
      setStep(2);
      // Packages will be loaded by useEffect
    }
  };

  const handlePackageSelect = (e) => {
    const packageId = e.target.value;
    const pkg = availablePackages.find(p => p.id === parseInt(packageId));
    setSelectedPackage(pkg);
    setFormData({
      reservation_date: '',
      duration_type: 'full_day',
      time_slot: 'morning'
    });
    setAvailabilityStatus(null);
  };

  // src/components/bookings/PartnerBookingForm.jsx
  // Replace the checkAvailability function (around line 186-236)

  const checkAvailability = async () => {
    if (!selectedPackage || !formData.reservation_date) return;
    
    setCheckingAvailability(true);
    
    try {
      const locationResourceId = selectedPackage.location_resource_id;
      const locationId = selectedPackage.location_id;
      const resourceType = selectedPackage.resource_type;
      
      // Get day of week (0 = Sunday, 6 = Saturday)
      const reservationDate = new Date(formData.reservation_date);
      const dayOfWeek = reservationDate.getDay();

      // ===== STEP 1: Check Exceptional Closures =====
      const { data: closures, error: closuresError } = await supabase
        .from('operating_closures')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .lte('closure_start_date', formData.reservation_date)
        .gte('closure_end_date', formData.reservation_date);

      if (closuresError) throw closuresError;

      // Check for location-level closure
      const locationClosure = closures?.find(c => 
        c.closure_scope === 'location' && c.location_id === locationId
      );
      
      if (locationClosure) {
        setAvailabilityStatus({
          available: false,
          conflictReason: t('reservations.locationClosedOnDate', { 
            reason: locationClosure.closure_reason || t(`reservations.closureType.${locationClosure.closure_type}`)
          }),
          closureInfo: locationClosure
        });
        setCheckingAvailability(false);
        return;
      }

      // Check for resource-type closure
      const resourceTypeClosure = closures?.find(c => 
        c.closure_scope === 'resource_type' && 
        c.location_id === locationId &&
        c.resource_type === resourceType
      );
      
      if (resourceTypeClosure) {
        setAvailabilityStatus({
          available: false,
          conflictReason: t('reservations.resourceTypeClosedOnDate', { 
            resourceType: t(`resources.${resourceType}`),
            reason: resourceTypeClosure.closure_reason || t(`reservations.closureType.${resourceTypeClosure.closure_type}`)
          }),
          closureInfo: resourceTypeClosure
        });
        setCheckingAvailability(false);
        return;
      }

      // Check for specific resource closure
      const resourceClosure = closures?.find(c => 
        c.closure_scope === 'resource' && 
        c.location_resource_id === locationResourceId
      );
      
      if (resourceClosure) {
        setAvailabilityStatus({
          available: false,
          conflictReason: t('reservations.resourceClosedOnDate', { 
            reason: resourceClosure.closure_reason || t(`reservations.closureType.${resourceClosure.closure_type}`)
          }),
          closureInfo: resourceClosure
        });
        setCheckingAvailability(false);
        return;
      }

      // ===== STEP 2: Check Resource Operating Schedule =====
      const { data: resourceSchedule, error: resourceScheduleError } = await supabase
        .from('resource_operating_schedules')
        .select('*')
        .eq('location_resource_id', locationResourceId)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (resourceScheduleError) throw resourceScheduleError;

      // If resource has custom schedule
      if (resourceSchedule) {
        if (resourceSchedule.is_closed) {
          setAvailabilityStatus({
            available: false,
            conflictReason: t('reservations.resourceClosedOnDay', { 
              day: t(`calendar.${getDayName(dayOfWeek)}`)
            }),
            scheduleInfo: resourceSchedule
          });
          setCheckingAvailability(false);
          return;
        }
        // Resource is open - continue to check booking conflicts
      } else {
        // ===== STEP 3: Check Location Operating Schedule =====
        const { data: locationSchedule, error: locationScheduleError } = await supabase
          .from('location_operating_schedules')
          .select('*')
          .eq('location_id', locationId)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle();

        if (locationScheduleError) throw locationScheduleError;

        if (locationSchedule && locationSchedule.is_closed) {
          setAvailabilityStatus({
            available: false,
            conflictReason: t('reservations.locationClosedOnDay', { 
              day: t(`calendar.${getDayName(dayOfWeek)}`)
            }),
            scheduleInfo: locationSchedule
          });
          setCheckingAvailability(false);
          return;
        }
      }

      // ===== STEP 4: Check Existing Package Reservations =====
      const { data: existingReservations, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('duration_type, time_slot, entries_used')
        .eq('location_resource_id', locationResourceId)
        .eq('reservation_date', formData.reservation_date)
        .eq('reservation_status', 'confirmed');

      if (reservationsError) throw reservationsError;

      // Check for booking conflicts
      let hasConflict = false;
      let conflictReason = '';
      let usedSlots = 0;
      const totalQuantity = selectedPackage.services?.location_resources?.quantity || 1;

      if (existingReservations && existingReservations.length > 0) {
        if (formData.duration_type === 'full_day') {
          usedSlots = existingReservations.reduce((total, res) => {
            return total + (res.duration_type === 'full_day' ? 1 : 0.5);
          }, 0);
          
          if (usedSlots >= totalQuantity) {
            hasConflict = true;
            conflictReason = t('reservations.resourceFullyBooked');
          }
        } else {
          const hasFullDayConflict = existingReservations.some(res => res.duration_type === 'full_day');
          const sameTimeSlotReservations = existingReservations.filter(res => 
            res.duration_type === 'half_day' && res.time_slot === formData.time_slot
          );
          
          if (hasFullDayConflict) {
            hasConflict = true;
            conflictReason = t('reservations.resourceBookedFullDay');
          } else if (sameTimeSlotReservations.length >= totalQuantity) {
            hasConflict = true;
            const timeSlotLabel = formData.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon');
            conflictReason = t('reservations.timeSlotFullyBooked', { timeSlot: timeSlotLabel });
          }
        }
      }

      setAvailabilityStatus({
        available: !hasConflict,
        conflictReason,
        resourceName: selectedPackage.resource_name,
        resourceType: selectedPackage.resource_type,
        totalQuantity,
        usedSlots
      });

    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityStatus({ available: false, error: t('reservations.errorCheckingAvailability') });
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Helper function to get day name
  const getDayName = (dayOfWeek) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayOfWeek];
  };

  const validateReservation = () => {
    const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;
    const remainingEntries = selectedPackage.service_max_entries - (selectedPackage.entries_used || 0);
    
    if (remainingEntries < entriesNeeded) {
      toast.error(t('reservations.insufficientEntries'));
      return false;
    }

    const reservationDate = new Date(formData.reservation_date);
    const contractStart = new Date(selectedPackage.start_date);
    const contractEnd = new Date(selectedPackage.end_date);
    
    if (reservationDate < contractStart || reservationDate > contractEnd) {
      toast.error(t('reservations.dateOutsideContract'));
      return false;
    }

    if (!availabilityStatus?.available) {
      toast.error(t('reservations.resourceNotAvailableError'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateReservation()) {
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmReservation = async () => {
    setLoading(true);

    try {
      const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;

      const reservationData = {
        contract_id: selectedPackage.id,
        location_resource_id: selectedPackage.location_resource_id,
        partner_uuid: selectedPackage.partner_uuid,
        customer_id: selectedCustomer.id,
        reservation_date: formData.reservation_date,
        duration_type: formData.duration_type,
        time_slot: formData.duration_type === 'half_day' ? formData.time_slot : null,
        entries_used: entriesNeeded,
        reservation_status: 'confirmed',
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('package_reservations')
        .insert([reservationData])
        .select(`
          *,
          contracts (
            contract_number,
            service_name,
            service_max_entries,
            entries_used,
            customers (
              first_name,
              second_name,
              email
            )
          ),
          location_resources (
            resource_name,
            resource_type,
            locations (
              location_name
            )
          )
        `)
        .single();

      if (error) throw error;

      // Send booking confirmation email
      try {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('company_name, email')
          .eq('partner_uuid', selectedPackage.partner_uuid)
          .single();

        const emailSent = await oneSignalEmailService.sendBookingConfirmation(
          data,
          selectedPackage,
          t,
          partnerData
        );

        if (!emailSent) {
          console.warn('Booking confirmation email not sent');
        }
      } catch (emailError) {
        console.error('Error sending booking confirmation:', emailError);
      }

      toast.success(t('reservations.bookingConfirmed'));
      onSuccess(data);
      onClose();
      
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error(t('reservations.errorCreatingReservation') + ': ' + error.message);
    } finally {
      setLoading(false);
      setShowConfirmation(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };


  const getMinSelectableDate = () => {
    if (!selectedPackage) return new Date().toISOString().split('T')[0];
    
    const today = new Date();
    const contractStart = new Date(selectedPackage.start_date);
    
    return today > contractStart 
      ? today.toISOString().split('T')[0]
      : selectedPackage.start_date;
  };

  if (!isOpen) return null;

  const remainingEntries = selectedPackage 
    ? selectedPackage.service_max_entries - (selectedPackage.entries_used || 0)
    : 0;
  const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;

  // Prepare customer options for SearchableSelect
  const customerOptions = customers.map(customer => ({
    value: customer.id.toString(),
    label: `${customer.company_name || `${customer.first_name} ${customer.second_name}`} - ${customer.email}`
  }));

  // Prepare package options for SearchableSelect
  const packageOptions = availablePackages.map(pkg => {
    const remaining = pkg.service_max_entries - (pkg.entries_used || 0);
    return {
      value: pkg.id.toString(),
      label: `${pkg.contract_number} - ${pkg.service_name} (${remaining} ${t('bookings.entriesRemaining')}) - ${pkg.resource_name} @ ${pkg.location_name}`
    };
  });

  // Prepare duration options for SearchableSelect
  const durationOptions = [
    { value: 'full_day', label: t('reservations.fullDayEntry') },
    { value: 'half_day', label: t('reservations.halfDayEntry') }
  ];

  // Confirmation modal
  if (showConfirmation) {
    return (
      <div className="modal-overlay">
        <div className="modal-container">
          <div className="modal-header">
            <h2 className="modal-title">
              {t('reservations.confirmReservation')}
            </h2>
            <button onClick={() => setShowConfirmation(false)} className="modal-close-btn">
              <X size={24} />
            </button>
          </div>

          <div className="confirmation-content">
            <div className="confirmation-warning">
              <AlertTriangle size={24} className="warning-icon" />
              <div className="warning-text">
                <h3>{t('contracts.importantNotice')}</h3>                
                <p>{t('reservations.confirmationMessage')}</p>
              </div>
            </div>

            <div className="contract-summary">
              <div className="summary-section">
                <h5>{t('customers.customerDetails')}</h5>
                <div>
                  <div className="summary-item">
                    <span className="summary-label">{t('customers.customer')}</span>
                    <span className="summary-value">
                      {selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.second_name}`}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('customers.email')}</span>
                    <span className="summary-value">{selectedCustomer.email}</span>
                  </div>
                </div>
              </div>

              <div className="summary-section">
                <h5>{t('reservations.reservationDetails')}</h5>
                <div>
                  <div className="summary-item">
                    <span className="summary-label">{t('contracts.contract')}</span>
                    <span className="summary-value">{selectedPackage.contract_number}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('contracts.service')}</span>
                    <span className="summary-value">{selectedPackage.service_name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('contracts.resource')}</span>
                    <span className="summary-value">{selectedPackage.resource_name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('contracts.location')}</span>
                    <span className="summary-value">{selectedPackage.location_name}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('reservations.dateLabel')}</span>
                    <span className="summary-value">{formatDate(formData.reservation_date)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('reservations.durationLabel')}</span>
                    <span className="summary-value">
                      {formData.duration_type === 'full_day' ? t('reservations.fullDay') : t('reservations.halfDay')}
                      {formData.duration_type === 'half_day' && (
                        <span> ({formData.time_slot === 'morning' ? t('reservations.morningSlot') : t('reservations.afternoonSlot')})</span>
                      )}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('reservations.entriesToUse')}</span>
                    <span className="summary-value">{entriesNeeded}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('reservations.remainingAfter')}</span>
                    <span className="summary-value cost">{remainingEntries - entriesNeeded}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="confirmation-actions">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="btn-secondary"
                disabled={loading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmReservation}
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    {t('common.creating')}...
                  </>
                ) : (
                  t('reservations.confirmReservation')
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            {isCustomerUser ? t('bookings.newReservation') : t('bookings.bookForCustomer')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Step 1: Customer Selection - ONLY FOR PARTNER ADMINS */}
          {step === 1 && isPartnerAdmin && (
            <>
              {loadingCustomers ? (
                <div className="availability-loading">
                  <div className="loading-spinner-small"></div>
                  <span>{t('bookings.loadingCustomers')}</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="day-no-bookings">
                  <p>{t('bookings.noCustomersWithPackages')}</p>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="customer" className="form-label">
                    {t('customers.customer')} *
                  </label>
                  <SearchableSelect
                    options={customerOptions}
                    value={selectedCustomer?.id?.toString() || ''}
                    onChange={handleCustomerSelect}
                    placeholder={t('bookings.selectACustomer')}
                    required
                  />
                </div>
              )}
            </>
          )}

          {/* Step 2: Package Selection and Booking */}
          {step === 2 && (
            <>
              {/* Selected Customer Info - Show ONLY for partner admin */}
              {isPartnerAdmin && selectedCustomer && (
                <div style={{ 
                  background: '#f9fafb', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '0.375rem', 
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t('bookings.bookingFor')}</div>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>
                      {selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.second_name}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setSelectedPackage(null);
                      setAvailablePackages([]);
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '0.875rem' }}
                  >
                    {t('bookings.changeCustomer')}
                  </button>
                </div>
              )}

              {/* Package Selection */}
              {loadingPackages ? (
                <div className="availability-loading">
                  <div className="loading-spinner-small"></div>
                  <span>{t('bookings.loadingPackages')}</span>
                </div>
              ) : availablePackages.length === 0 ? (
                <div className="day-no-bookings">
                  <p>{t('bookings.noAvailablePackages')}</p>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="package" className="form-label">
                    {t('bookings.packageContract')} *
                  </label>
                  <SearchableSelect
                    options={packageOptions}
                    value={selectedPackage?.id?.toString() || ''}
                    onChange={handlePackageSelect}
                    placeholder={t('bookings.selectAPackage')}
                    required
                  />
                </div>
              )}

              {/* Reservation Form */}
              {selectedPackage && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="reservation_date" className="form-label">
                        {t('reservations.reservationDate')} *
                      </label>
                      <input
                        id="reservation_date"
                        type="date"
                        required
                        min={getMinSelectableDate()}
                        max={selectedPackage.end_date}
                        value={formData.reservation_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, reservation_date: e.target.value }))}
                        className="form-input"
                      />
                      {selectedPackage.start_date && selectedPackage.end_date && (
                        <small style={{ display: 'block', marginTop: '0.25rem', color: '#6b7280' }}>
                          {t('reservations.availablePeriod')}: {formatDate(selectedPackage.start_date)} {t('common.to')} {formatDate(selectedPackage.end_date)}
                        </small>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="duration_type" className="form-label">
                        {t('reservations.duration')} *
                      </label>
                      <SearchableSelect
                        options={durationOptions}
                        value={formData.duration_type}
                        onChange={(e) => setFormData(prev => ({ ...prev, duration_type: e.target.value }))}
                        placeholder={t('reservations.selectDuration')}
                        required
                      />
                    </div>
                  </div>

                  {/* Time Slot for Half Day */}
                  {formData.duration_type === 'half_day' && (
                    <div className="form-group">
                      <label className="form-label">{t('reservations.timeSlot')} *</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem', 
                          padding: '0.75rem', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '0.375rem', 
                          cursor: 'pointer',
                          backgroundColor: formData.time_slot === 'morning' ? '#eff6ff' : 'white',
                          borderColor: formData.time_slot === 'morning' ? '#3b82f6' : '#d1d5db'
                        }}>
                          <input
                            type="radio"
                            name="time_slot"
                            value="morning"
                            checked={formData.time_slot === 'morning'}
                            onChange={(e) => setFormData(prev => ({ ...prev, time_slot: e.target.value }))}
                          />
                          <div>
                            <div style={{ fontWeight: '500' }}>{t('reservations.morning')}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>9:00 - 13:00</div>
                          </div>
                        </label>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem', 
                          padding: '0.75rem', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '0.375rem', 
                          cursor: 'pointer',
                          backgroundColor: formData.time_slot === 'afternoon' ? '#eff6ff' : 'white',
                          borderColor: formData.time_slot === 'afternoon' ? '#3b82f6' : '#d1d5db'
                        }}>
                          <input
                            type="radio"
                            name="time_slot"
                            value="afternoon"
                            checked={formData.time_slot === 'afternoon'}
                            onChange={(e) => setFormData(prev => ({ ...prev, time_slot: e.target.value }))}
                          />
                          <div>
                            <div style={{ fontWeight: '500' }}>{t('reservations.afternoon')}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>14:00 - 18:00</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Availability Check */}
                  {formData.reservation_date && (
                    <div className="availability-check">
                      {checkingAvailability ? (
                        <div className="availability-loading">
                          <div className="loading-spinner-small"></div>
                          <span>{t('reservations.checkingAvailability')}...</span>
                        </div>
                      ) : availabilityStatus ? (
                        <div className={`availability-status ${availabilityStatus.available ? 'available' : 'unavailable'}`}>
                          {availabilityStatus.available ? (
                            <div className="availability-success">
                              <CheckCircle size={20} />
                              <div className="availability-details">
                                <p><strong>{t('reservations.available')}</strong></p>
                                <p>{t('reservations.resourceAvailableFor', { resource: availabilityStatus.resourceName })}</p>
                                {availabilityStatus.totalQuantity > 1 && (
                                  <p>
                                    {t('reservations.capacity')}: {availabilityStatus.totalQuantity - (availabilityStatus.usedSlots || 0)} {t('common.of')} {availabilityStatus.totalQuantity} {t('reservations.available')}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="availability-error">
                              <AlertTriangle size={20} />
                              <div className="availability-details">
                                <p><strong>{t('reservations.resourceNotAvailable')}</strong></p>
                                <p>{availabilityStatus.conflictReason || availabilityStatus.error}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            {step === 2 && selectedPackage && (
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !availabilityStatus?.available || remainingEntries < entriesNeeded}
              >
                {t('reservations.confirmReservation')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartnerBookingForm;