// src/components/forms/PackageBookingForm.jsx
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

import { logActivity } from '../../utils/activityLogger';
import logger from '../../utils/logger';

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
        logger.error('Service error:', serviceError);
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
        logger.error('Reservations error:', reservationsError);
        setAvailabilityStatus({ available: false, error: 'Error checking existing reservations' });
        return;
      }

      // Check for conflicts based on resource type and quantity
      let hasConflict = false;
      let conflictReason = '';
      let usedSlots = 0;
      const totalQuantity = locationResource.quantity || 1;

      // Calculate how many slots are currently used
      // 1. Check for overlapping long-term subscription bookings
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('location_resource_id', locationResource.id)
        .eq('booking_status', 'active')
        .lte('start_date', formData.reservation_date)
        .gte('end_date', formData.reservation_date);

      if (bookingsError) {
        logger.error('Bookings error:', bookingsError);
        setAvailabilityStatus({ available: false, error: 'Error checking existing bookings' });
        return;
      }

      const activeSubscriptionsCount = existingBookings ? existingBookings.length : 0;
      usedSlots = activeSubscriptionsCount;

      // 2. Check existing package reservations (single-day)
      const reservationsFound = existingReservations && existingReservations.length > 0;

      if (formData.duration_type === 'full_day') {
        // For full day, count all existing package reservations (both full and half day)
        if (reservationsFound) {
          usedSlots += existingReservations.reduce((total, res) => {
            return total + (res.duration_type === 'full_day' ? 1 : 0.5);
          }, 0);
        }

        if (usedSlots >= totalQuantity) {
          hasConflict = true;
          conflictReason = usedSlots > activeSubscriptionsCount
            ? t('reservations.fullyBooked') || 'Resource fully booked for this date'
            : t('reservations.occupiedBySubscription') || 'Resource occupied by active subscription';
        }
      } else {
        // For half day, check specific time slot conflicts
        // A full-day subscription ALWAYS blocks any half-day reservation
        const hasFullDayReservation = reservationsFound && existingReservations.some(res => res.duration_type === 'full_day');

        const sameTimeSlotReservations = reservationsFound ? existingReservations.filter(res =>
          res.duration_type === 'half_day' && res.time_slot === formData.time_slot
        ) : [];

        if (activeSubscriptionsCount >= totalQuantity) {
          hasConflict = true;
          conflictReason = t('reservations.occupiedBySubscription') || 'Resource occupied by active subscription';
        } else if (hasFullDayReservation && (activeSubscriptionsCount + 1) >= totalQuantity) {
          hasConflict = true;
          conflictReason = t('reservations.occupiedForFullDay') || 'Resource booked for full day on this date';
        } else if ((activeSubscriptionsCount + sameTimeSlotReservations.length + 0.5) > totalQuantity) {
          // Note: using 0.5 here because a half-day reservation takes half a slot
          hasConflict = true;
          conflictReason = t('reservations.slotFullyBooked', { slot: formData.time_slot === 'morning' ? 'Morning' : 'Afternoon' }) ||
            `${formData.time_slot === 'morning' ? 'Morning' : 'Afternoon'} slot fully booked`;
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
      logger.error('Error checking availability:', error);
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

      logger.log('Creating reservation with data:', reservationData);

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
          ),
          customers (
            first_name,
            second_name,
            email,
            company_name
          )
        `)
        .single();

      if (error) {
        logger.error('Reservation creation error:', error);
        throw new Error(error.message);
      }

      logger.log('Reservation created successfully:', data);

      // Log activity
      try {
        const customerName = data.customers?.company_name ||
          `${data.customers?.first_name} ${data.customers?.second_name}`;

        const resourceInfo = `${data.location_resources?.resource_name} (${data.location_resources?.resource_type})`;
        const locationName = data.location_resources?.locations?.location_name;
        const durationText = data.duration_type === 'full_day'
          ? 'Full Day'
          : `Half Day (${data.time_slot})`;

        await logActivity({
          action_category: 'reservation',
          action_type: 'created',
          entity_id: data.id.toString(),
          entity_type: 'package_reservations',
          description: `Customer created package reservation for ${resourceInfo} at ${locationName} on ${data.reservation_date}`,
          metadata: {
            reservation_id: data.id,
            contract_number: data.contracts?.contract_number,
            contract_id: data.contract_id,
            customer_name: customerName,
            customer_id: data.customer_id,
            resource_name: data.location_resources?.resource_name,
            resource_type: data.location_resources?.resource_type,
            resource_id: data.location_resource_id,
            location_name: locationName,
            location_id: data.location_resources?.locations?.id,
            reservation_date: data.reservation_date,
            duration_type: data.duration_type,
            time_slot: data.time_slot,
            duration_text: durationText,
            entries_used: data.entries_used,
            service_name: data.contracts?.service_name,
            created_by: 'customer',
            self_service: true
          }
        });

        logger.log('✅ Package reservation activity logged successfully');
      } catch (logError) {
        logger.error('Error logging package reservation activity:', logError);
        // Don't fail the reservation if logging fails
      }

      toast.success(t('reservations.bookingConfirmed'));
      onSuccess(data);
      onClose();

    } catch (error) {
      logger.error('Error creating reservation:', error);
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
                <p>{t('reservations.confirmBookingWarning', { count: entriesNeeded })}</p>
              </div>
            </div>

            <div className="contract-summary">
              <h4>{t('reservations.bookingSummary')}</h4>


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
                className="btn-booking-primary"
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
          {/* Reservation Form - Contract Details Section REMOVED */}
          <div className="form-section-clean">
            {/* Section Title REMOVED */}

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
              {checkingAvailability ? (
                <div className="availability-loading">
                  <div className="loading-spinner-small"></div>
                  <span>{t('reservations.checkingAvailability')}...</span>
                </div>
              ) : availabilityStatus ? (
                <div style={availabilityStatus.available ? {
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                  borderLeft: '4px solid #22c55e'
                } : {
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                  borderLeft: '4px solid #ef4444'
                }}>
                  {availabilityStatus.available ? (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <CheckCircle size={20} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ color: '#166534', fontSize: '0.875rem' }}>
                        <p style={{ margin: '0 0 0.25rem 0', fontWeight: '600' }}>{t('reservations.resourceAvailable')}</p>
                        <p style={{ margin: '0 0 0.25rem 0' }}>{availabilityStatus.resourceName} is available for your selected time</p>
                        {availabilityStatus.totalQuantity > 1 && (
                          <p style={{ margin: 0 }}>Capacity: {availabilityStatus.totalQuantity - (availabilityStatus.usedSlots || 0)} of {availabilityStatus.totalQuantity} available</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <AlertTriangle size={20} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ color: '#991b1b', fontSize: '0.875rem' }}>
                        <p style={{ margin: '0 0 0.25rem 0', fontWeight: '600' }}>{t('reservations.resourceNotAvailable')}</p>
                        <p style={{ margin: 0 }}>{availabilityStatus.conflictReason || availabilityStatus.error}</p>
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
              className="btn-booking-primary"
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