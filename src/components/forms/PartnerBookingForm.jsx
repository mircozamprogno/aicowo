import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import oneSignalEmailService from '../../services/oneSignalEmailService';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const PartnerBookingForm = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  
  const [step, setStep] = useState(1); // 1: Select Customer, 2: Select Package & Book
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
      setStep(1);
      setSelectedCustomer(null);
      setSelectedPackage(null);
      setAvailablePackages([]);
      setFormData({
        reservation_date: '',
        duration_type: 'full_day',
        time_slot: 'morning'
      });
      setAvailabilityStatus(null);
      setShowConfirmation(false);
      fetchCustomersWithPackages();
    }
  }, [isOpen]);

  // Check availability when form data changes and package is selected
  useEffect(() => {
    if (formData.reservation_date && selectedPackage) {
      checkAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [formData.reservation_date, formData.duration_type, formData.time_slot, selectedPackage]);

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
      toast.error('Error loading customers');
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
        .eq('partner_uuid', profile.partner_uuid)
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
      toast.error('Error loading packages');
      setAvailablePackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleCustomerSelect = async (customerId) => {
    const customer = customers.find(c => c.id === parseInt(customerId));
    setSelectedCustomer(customer);
    
    if (customer) {
      await fetchPackagesForCustomer(customer.id);
      setStep(2);
    }
  };

  const handlePackageSelect = (packageId) => {
    const pkg = availablePackages.find(p => p.id === parseInt(packageId));
    setSelectedPackage(pkg);
    setFormData({
      reservation_date: '',
      duration_type: 'full_day',
      time_slot: 'morning'
    });
    setAvailabilityStatus(null);
  };

  const checkAvailability = async () => {
    if (!selectedPackage || !formData.reservation_date) return;
    
    setCheckingAvailability(true);
    
    try {
      const locationResourceId = selectedPackage.location_resource_id;

      // Check existing package reservations for this date and resource
      const { data: existingReservations, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('duration_type, time_slot, entries_used')
        .eq('location_resource_id', locationResourceId)
        .eq('reservation_date', formData.reservation_date)
        .eq('reservation_status', 'confirmed');

      if (reservationsError) throw reservationsError;

      // Check for conflicts
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
            conflictReason = 'Resource fully booked for this date';
          }
        } else {
          const hasFullDayConflict = existingReservations.some(res => res.duration_type === 'full_day');
          const sameTimeSlotReservations = existingReservations.filter(res => 
            res.duration_type === 'half_day' && res.time_slot === formData.time_slot
          );
          
          if (hasFullDayConflict) {
            hasConflict = true;
            conflictReason = 'Resource booked for full day on this date';
          } else if (sameTimeSlotReservations.length >= totalQuantity) {
            hasConflict = true;
            conflictReason = `${formData.time_slot === 'morning' ? 'Morning' : 'Afternoon'} slot fully booked`;
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
      setAvailabilityStatus({ available: false, error: 'Error checking availability' });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const validateReservation = () => {
    const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;
    const remainingEntries = selectedPackage.service_max_entries - (selectedPackage.entries_used || 0);
    
    if (remainingEntries < entriesNeeded) {
      toast.error('Insufficient entries remaining in package');
      return false;
    }

    const reservationDate = new Date(formData.reservation_date);
    const contractStart = new Date(selectedPackage.start_date);
    const contractEnd = new Date(selectedPackage.end_date);
    
    if (reservationDate < contractStart || reservationDate > contractEnd) {
      toast.error('Reservation date must be within contract period');
      return false;
    }

    if (!availabilityStatus?.available) {
      toast.error('Resource not available for selected date and time');
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
        partner_uuid: profile.partner_uuid,
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
            service_name
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

      // Send booking confirmation emails
      try {
        const { data: partnerData } = await supabase
          .from('partners')
          .select('email, contact_email, first_name, second_name, company_name')
          .eq('partner_uuid', profile.partner_uuid)
          .single();

        await oneSignalEmailService.sendBookingConfirmation(
          data,
          selectedPackage,
          t,
          partnerData
        );
      } catch (emailError) {
        console.error('Error sending emails:', emailError);
      }

      toast.success(t('reservations.bookingConfirmed'));
      onSuccess(data);
      onClose();
      
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Error creating reservation: ' + error.message);
    } finally {
      setLoading(false);
      setShowConfirmation(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getResourceTypeIcon = (type) => {
    return type === 'scrivania' ? '🖥️' : '🏢';
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
              <h4>{t('reservations.bookingSummary')}</h4>
              
              <div className="summary-section">
                <h5>{t('customers.customerDetails')}</h5>
                <div className="summary-item">
                  <span className="summary-label">{t('customers.customer')}:</span>
                  <span className="summary-value">
                    {selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.second_name}`}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('customers.email')}:</span>
                  <span className="summary-value">{selectedCustomer.email}</span>
                </div>
              </div>

              <div className="summary-section">
                <h5>{t('reservations.contractDetails')}</h5>
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.contract')}:</span>
                  <span className="summary-value">{selectedPackage.contract_number}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.service')}:</span>
                  <span className="summary-value">{selectedPackage.service_name}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.resource')}:</span>
                  <span className="summary-value">
                    {getResourceTypeIcon(selectedPackage.resource_type)} {selectedPackage.resource_name}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.location')}:</span>
                  <span className="summary-value">{selectedPackage.location_name}</span>
                </div>
              </div>

              <div className="summary-section">
                <h5>{t('reservations.reservationDetails')}</h5>
                <div className="summary-item">
                  <span className="summary-label">{t('reservations.dateLabel')}:</span>
                  <span className="summary-value">{formatDate(formData.reservation_date)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('reservations.durationLabel')}:</span>
                  <span className="summary-value">
                    {formData.duration_type === 'full_day' ? t('reservations.fullDay') : t('reservations.halfDay')}
                    {formData.duration_type === 'half_day' && (
                      <span> - {formData.time_slot === 'morning' ? t('reservations.morningSlot') : t('reservations.afternoonSlot')}</span>
                    )}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('reservations.entriesToUse')}:</span>
                  <span className="summary-value">{entriesNeeded}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">{t('reservations.remainingAfter')}:</span>
                  <span className="summary-value cost">{remainingEntries - entriesNeeded}</span>
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
            {t('bookings.bookForCustomer')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Step 1: Customer Selection */}
          {step === 1 && (
            <div className="form-section">
              <h3 className="form-section-title">{t('bookings.selectCustomer')}</h3>
              
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
                  <select
                    id="customer"
                    required
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="form-select"
                  >
                    <option value="">{t('bookings.selectACustomer')}</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name || `${customer.first_name} ${customer.second_name}`} - {customer.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Package Selection and Booking */}
          {step === 2 && (
            <>
              {/* Selected Customer Info */}
              <div className="form-section">
                <div style={{ 
                  background: '#f9fafb', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '0.375rem', 
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
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
              </div>

              {/* Package Selection */}
              <div className="form-section">
                <h3 className="form-section-title">{t('bookings.selectPackage')}</h3>
                
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
                    <select
                      id="package"
                      required
                      value={selectedPackage?.id || ''}
                      onChange={(e) => handlePackageSelect(e.target.value)}
                      className="form-select"
                    >
                      <option value="">{t('bookings.selectAPackage')}</option>
                      {availablePackages.map(pkg => {
                        const remaining = pkg.service_max_entries - (pkg.entries_used || 0);
                        return (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.contract_number} - {pkg.service_name} ({remaining} {t('bookings.entriesRemaining')}) - {pkg.resource_name} @ {pkg.location_name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Package Details */}
              {selectedPackage && (
                <div className="form-section">
                  <h3 className="form-section-title">{t('bookings.packageDetails')}</h3>
                  <div style={{ 
                    background: '#f9fafb', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '0.375rem', 
                    padding: '1rem' 
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                      <div>
                        <span style={{ color: '#6b7280' }}>{t('contracts.contract')}:</span>
                        <div style={{ fontWeight: '600' }}>{selectedPackage.contract_number}</div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>{t('contracts.service')}:</span>
                        <div style={{ fontWeight: '500' }}>{selectedPackage.service_name}</div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>{t('contracts.resource')}:</span>
                        <div style={{ fontWeight: '500' }}>
                          {getResourceTypeIcon(selectedPackage.resource_type)} {selectedPackage.resource_name}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>{t('contracts.location')}:</span>
                        <div style={{ fontWeight: '500' }}>{selectedPackage.location_name}</div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>{t('contracts.contractPeriod')}:</span>
                        <div style={{ fontWeight: '500' }}>
                          {formatDate(selectedPackage.start_date)} - {formatDate(selectedPackage.end_date)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>{t('contracts.remainingEntries')}:</span>
                        <div style={{ fontWeight: '700', color: remainingEntries > 2 ? '#16a34a' : '#dc2626' }}>
                          {remainingEntries} / {selectedPackage.service_max_entries}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reservation Form */}
              {selectedPackage && (
                <>
                  <div className="form-section">
                    <h3 className="form-section-title">{t('reservations.reservationDetails')}</h3>
                    
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
                        <div className="form-help-text">
                          {t('contracts.availablePeriod')}: {formatDate(selectedPackage.start_date)} {t('contracts.to')} {formatDate(selectedPackage.end_date)}
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="duration_type" className="form-label">
                          {t('reservations.duration')} *
                        </label>
                        <select
                          id="duration_type"
                          value={formData.duration_type}
                          onChange={(e) => setFormData(prev => ({ ...prev, duration_type: e.target.value }))}
                          className="form-select"
                        >
                          <option value="full_day">{t('reservations.fullDayEntry')}</option>
                          <option value="half_day">{t('reservations.halfDayEntry')}</option>
                        </select>
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
                  </div>

                  {/* Availability Check */}
                  {formData.reservation_date && (
                    <div className="availability-check">
                      <h4>{t('reservations.availabilityCheck')}</h4>
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
                                <p><strong>{t('reservations.resourceAvailable')}</strong></p>
                                <p>{availabilityStatus.resourceName} is available for your selected time</p>
                                {availabilityStatus.totalQuantity > 1 && (
                                  <p>Capacity: {availabilityStatus.totalQuantity - (availabilityStatus.usedSlots || 0)} of {availabilityStatus.totalQuantity} available</p>
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

                  {/* Booking Summary */}
                  {formData.reservation_date && availabilityStatus?.available && (
                    <div style={{ 
                      background: '#eff6ff', 
                      border: '1px solid #bfdbfe', 
                      borderRadius: '0.375rem', 
                      padding: '1rem',
                      borderLeft: '4px solid #3b82f6'
                    }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e40af' }}>{t('reservations.bookingSummary')}</h4>
                      <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                        <p>{t('reservations.dateLabel')}: <strong>{formatDate(formData.reservation_date)}</strong></p>
                        <p>{t('reservations.durationLabel')}: <strong>
                          {formData.duration_type === 'full_day' ? t('reservations.fullDay') : t('reservations.halfDay')}
                          {formData.duration_type === 'half_day' && (
                            <span> - <strong>{formData.time_slot === 'morning' ? t('reservations.morningSlot') : t('reservations.afternoonSlot')}</strong></span>
                          )}
                        </strong></p>
                        <p>{t('reservations.entriesToUse')}: <strong>{entriesNeeded}</strong></p>
                        <p>{t('reservations.remainingAfter')}: <strong>{remainingEntries - entriesNeeded}</strong></p>
                      </div>
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