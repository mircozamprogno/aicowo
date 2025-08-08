import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const PackageBookingForm = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  contract 
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    reservation_date: '',
    duration_type: 'full_day', // 'full_day' or 'half_day'
    time_slot: 'morning' // 'morning' or 'afternoon'
  });
  
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        reservation_date: '',
        duration_type: 'full_day',
        time_slot: 'morning'
      });
      setAvailabilityStatus(null);
      setShowConfirmation(false);
    }
  }, [isOpen]);

  // Check availability when form data changes
  useEffect(() => {
    if (formData.reservation_date && contract) {
      checkAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [formData.reservation_date, formData.duration_type, formData.time_slot, contract]);

  const checkAvailability = async () => {
    if (!contract || !formData.reservation_date) return;
    
    setCheckingAvailability(true);
    
    try {
      // Get the location resource for this contract's service
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select(`
          location_resources!fk_services_location_resource (
            id,
            resource_name,
            resource_type,
            quantity
          )
        `)
        .eq('id', contract.service_id)
        .single();

      if (serviceError) {
        console.error('Service error:', serviceError);
        setAvailabilityStatus({ available: false, error: 'Error checking availability' });
        return;
      }

      const locationResource = serviceData.location_resources;
      if (!locationResource) {
        setAvailabilityStatus({ available: false, error: 'No resource found for this service' });
        return;
      }

      // Check existing package reservations for this date and resource
      const { data: existingReservations, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('duration_type, time_slot, entries_used')
        .eq('location_resource_id', locationResource.id)
        .eq('reservation_date', formData.reservation_date)
        .eq('reservation_status', 'confirmed');

      if (reservationsError) {
        console.error('Reservations error:', reservationsError);
        setAvailabilityStatus({ available: false, error: 'Error checking existing reservations' });
        return;
      }

      // Check for conflicts based on resource type and quantity
      let hasConflict = false;
      let conflictReason = '';
      let usedSlots = 0;
      const totalQuantity = locationResource.quantity || 1;

      // Calculate how many slots are currently used
      if (existingReservations && existingReservations.length > 0) {
        if (formData.duration_type === 'full_day') {
          // For full day, count all existing reservations (both full and half day)
          usedSlots = existingReservations.reduce((total, res) => {
            return total + (res.duration_type === 'full_day' ? 1 : 0.5);
          }, 0);
          
          if (usedSlots >= totalQuantity) {
            hasConflict = true;
            conflictReason = 'Resource fully booked for this date';
          }
        } else {
          // For half day, check specific time slot conflicts
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
        resourceName: locationResource.resource_name,
        resourceType: locationResource.resource_type,
        totalQuantity,
        usedSlots
      });

    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityStatus({ available: false, error: 'Unexpected error checking availability' });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const validateReservation = () => {
    const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;
    const remainingEntries = contract.service_max_entries - (contract.entries_used || 0);
    
    // Check if enough entries remain
    if (remainingEntries < entriesNeeded) {
      toast.error('Insufficient entries remaining in your package');
      return false;
    }

    // Check if date is within contract range
    const reservationDate = new Date(formData.reservation_date);
    const contractStart = new Date(contract.start_date);
    const contractEnd = new Date(contract.end_date);
    
    if (reservationDate < contractStart || reservationDate > contractEnd) {
      toast.error('Reservation date must be within contract period');
      return false;
    }

    // Check if resource is available
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
      // Get location resource ID
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select(`
          location_resources!fk_services_location_resource (
            id
          )
        `)
        .eq('id', contract.service_id)
        .single();

      if (serviceError) {
        throw new Error('Error getting service resource: ' + serviceError.message);
      }

      const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;

      const reservationData = {
        contract_id: contract.id,
        location_resource_id: serviceData.location_resources.id,
        partner_uuid: contract.partner_uuid,
        customer_id: contract.customer_id,
        reservation_date: formData.reservation_date,
        duration_type: formData.duration_type,
        time_slot: formData.duration_type === 'half_day' ? formData.time_slot : null,
        entries_used: entriesNeeded,
        reservation_status: 'confirmed',
        created_by: user.id
      };

      console.log('Creating reservation with data:', reservationData);

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

      if (error) {
        console.error('Reservation creation error:', error);
        throw new Error(error.message);
      }

      console.log('Reservation created successfully:', data);
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

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Updated icon function with desk icon for scrivania
  const getResourceTypeIcon = (type) => {
    return type === 'scrivania' ? '🖥️' : '🏢';
  };

  // Helper function to get the minimum selectable date
  const getMinSelectableDate = () => {
    const today = new Date();
    const contractStart = new Date(contract.start_date);
    
    // Return the later of today or contract start date
    return today > contractStart 
      ? today.toISOString().split('T')[0]
      : contract.start_date;
  };

  if (!isOpen || !contract) return null;

  const remainingEntries = contract.service_max_entries - (contract.entries_used || 0);
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
                <p>This reservation will use {entriesNeeded} entries from your package. Once confirmed, the reservation cannot be modified.</p>
              </div>
            </div>

            <div className="contract-summary">
              <h4>{t('reservations.bookingSummary')}</h4>
              
              <div className="summary-section">
                <h5>{t('reservations.contractDetails')}</h5>
                <div className="summary-item">
                  <span className="summary-label">Contract:</span>
                  <span className="summary-value">{contract.contract_number}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Service:</span>
                  <span className="summary-value">{contract.service_name}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Resource:</span>
                  <span className="summary-value">
                    {getResourceTypeIcon(contract.resource_type)} {contract.resource_name}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Location:</span>
                  <span className="summary-value">{contract.location_name}</span>
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
            {t('reservations.bookReservation')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Contract Info */}
          <div className="form-section">
            <h3 className="form-section-title">{t('reservations.contractDetails')}</h3>
            <div style={{ 
              background: '#f9fafb', 
              border: '1px solid #e5e7eb', 
              borderRadius: '0.375rem', 
              padding: '1rem' 
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div>
                  <span style={{ color: '#6b7280' }}>Contract:</span>
                  <div style={{ fontWeight: '600' }}>{contract.contract_number}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Service:</span>
                  <div style={{ fontWeight: '500' }}>{contract.service_name}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Resource:</span>
                  <div style={{ fontWeight: '500' }}>
                    {getResourceTypeIcon(contract.resource_type)} {contract.resource_name}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Location:</span>
                  <div style={{ fontWeight: '500' }}>{contract.location_name}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Contract Period:</span>
                  <div style={{ fontWeight: '500' }}>
                    {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Remaining Entries:</span>
                  <div style={{ fontWeight: '700', color: remainingEntries > 2 ? '#16a34a' : '#dc2626' }}>
                    {remainingEntries} / {contract.service_max_entries}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation Form */}
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
                  max={contract.end_date}
                  value={formData.reservation_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, reservation_date: e.target.value }))}
                  className="form-input"
                />
                <div className="form-help-text">
                  Available period: {formatDate(contract.start_date)} to {formatDate(contract.end_date)}
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

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !availabilityStatus?.available || remainingEntries < entriesNeeded}
            >
              {t('reservations.confirmReservation')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackageBookingForm;