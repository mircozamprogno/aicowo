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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        reservation_date: '',
        duration_type: 'full_day',
        time_slot: 'morning'
      });
      setAvailabilityStatus(null);
    }
  }, [isOpen]);

  // Check availability when form data changes
  useEffect(() => {
    if (formData.reservation_date && contract) {
      checkAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [formData.reservation_date, formData.duration_type, formData.time_slot]);

  const checkAvailability = async () => {
    setCheckingAvailability(true);
    
    try {
      // Get the location resource for this contract's service
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select(`
          location_resources!fk_services_location_resource (
            id,
            resource_name,
            resource_type
          )
        `)
        .eq('id', contract.service_id)
        .single();

      if (serviceError) {
        setAvailabilityStatus({ available: false, error: 'Error checking availability' });
        return;
      }

      // Check existing package reservations for this date and resource
      const { data: existingReservations, error: reservationsError } = await supabase
        .from('package_reservations')
        .select('duration_type, time_slot')
        .eq('location_resource_id', serviceData.location_resources.id)
        .eq('reservation_date', formData.reservation_date)
        .eq('reservation_status', 'confirmed');

      if (reservationsError) {
        setAvailabilityStatus({ available: false, error: 'Error checking existing reservations' });
        return;
      }

      // Check for conflicts
      let hasConflict = false;
      let conflictReason = '';

      if (formData.duration_type === 'full_day') {
        // Full day conflicts with any existing reservation
        if (existingReservations.length > 0) {
          hasConflict = true;
          conflictReason = 'Resource already booked for this date';
        }
      } else {
        // Half day - check for conflicts
        const hasFullDayConflict = existingReservations.some(res => res.duration_type === 'full_day');
        const hasTimeSlotConflict = existingReservations.some(res => 
          res.duration_type === 'half_day' && res.time_slot === formData.time_slot
        );
        
        if (hasFullDayConflict) {
          hasConflict = true;
          conflictReason = 'Resource booked for full day on this date';
        } else if (hasTimeSlotConflict) {
          hasConflict = true;
          conflictReason = `${formData.time_slot === 'morning' ? 'Morning' : 'Afternoon'} slot already booked`;
        }
      }

      setAvailabilityStatus({
        available: !hasConflict,
        conflictReason,
        resourceName: serviceData.location_resources.resource_name
      });

    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityStatus({ available: false, error: 'Unexpected error' });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!availabilityStatus?.available) {
      toast.error('Resource not available for selected date and time');
      return;
    }

    const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;
    const remainingEntries = contract.service_max_entries - contract.entries_used;
    
    if (remainingEntries < entriesNeeded) {
      toast.error('Insufficient entries remaining in your package');
      return;
    }

    setLoading(true);

    try {
      // Get location resource ID
      const { data: serviceData } = await supabase
        .from('services')
        .select(`
          location_resources!fk_services_location_resource (
            id
          )
        `)
        .eq('id', contract.service_id)
        .single();

      const reservationData = {
        contract_id: contract.id,
        location_resource_id: serviceData.location_resources.id,
        partner_uuid: contract.partner_uuid,
        customer_id: contract.customer_id,
        reservation_date: formData.reservation_date,
        duration_type: formData.duration_type,
        time_slot: formData.duration_type === 'half_day' ? formData.time_slot : null,
        entries_used: entriesNeeded,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('package_reservations')
        .insert([reservationData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast.success('Reservation created successfully!');
      onSuccess(data);
      onClose();
      
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Error creating reservation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !contract) return null;

  const remainingEntries = contract.service_max_entries - contract.entries_used;
  const entriesNeeded = formData.duration_type === 'full_day' ? 1 : 0.5;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            Book Package Reservation
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Contract Info */}
          <div className="form-section">
            <h3 className="form-section-title">Contract Details</h3>
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
                    {contract.resource_type === 'scrivania' ? '🪑' : '🏢'} {contract.resource_name}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Remaining Entries:</span>
                  <div style={{ fontWeight: '700', color: '#16a34a' }}>
                    {remainingEntries} / {contract.service_max_entries}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation Form */}
          <div className="form-section">
            <h3 className="form-section-title">Reservation Details</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reservation_date" className="form-label">
                  Date *
                </label>
                <input
                  id="reservation_date"
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  max={contract.end_date}
                  value={formData.reservation_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, reservation_date: e.target.value }))}
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="duration_type" className="form-label">
                  Duration *
                </label>
                <select
                  id="duration_type"
                  value={formData.duration_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_type: e.target.value }))}
                  className="form-select"
                >
                  <option value="full_day">Full Day (1 entry)</option>
                  <option value="half_day">Half Day (0.5 entries)</option>
                </select>
              </div>
            </div>

            {/* Time Slot for Half Day */}
            {formData.duration_type === 'half_day' && (
              <div className="form-group">
                <label className="form-label">Time Slot *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    padding: '0.75rem', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '0.375rem', 
                    cursor: 'pointer',
                    backgroundColor: formData.time_slot === 'morning' ? '#eff6ff' : 'white'
                  }}>
                    <input
                      type="radio"
                      name="time_slot"
                      value="morning"
                      checked={formData.time_slot === 'morning'}
                      onChange={(e) => setFormData(prev => ({ ...prev, time_slot: e.target.value }))}
                    />
                    <div>
                      <div style={{ fontWeight: '500' }}>Morning</div>
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
                    backgroundColor: formData.time_slot === 'afternoon' ? '#eff6ff' : 'white'
                  }}>
                    <input
                      type="radio"
                      name="time_slot"
                      value="afternoon"
                      checked={formData.time_slot === 'afternoon'}
                      onChange={(e) => setFormData(prev => ({ ...prev, time_slot: e.target.value }))}
                    />
                    <div>
                      <div style={{ fontWeight: '500' }}>Afternoon</div>
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
              <h4>Availability Check</h4>
              {checkingAvailability ? (
                <div className="availability-loading">
                  <div className="loading-spinner-small"></div>
                  <span>Checking availability...</span>
                </div>
              ) : availabilityStatus ? (
                <div className={`availability-status ${availabilityStatus.available ? 'available' : 'unavailable'}`}>
                  {availabilityStatus.available ? (
                    <div className="availability-success">
                      <CheckCircle size={20} />
                      <div className="availability-details">
                        <p><strong>Available</strong></p>
                        <p>{availabilityStatus.resourceName} is free for your selected time</p>
                      </div>
                    </div>
                  ) : (
                    <div className="availability-error">
                      <AlertTriangle size={20} />
                      <div className="availability-details">
                        <p><strong>Not Available</strong></p>
                        <p>{availabilityStatus.conflictReason || availabilityStatus.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Summary */}
          {formData.reservation_date && availabilityStatus?.available && (
            <div style={{ 
              background: '#eff6ff', 
              border: '1px solid #bfdbfe', 
              borderRadius: '0.375rem', 
              padding: '1rem',
              borderLeft: '4px solid #3b82f6'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e40af' }}>Booking Summary</h4>
              <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                <p>Date: <strong>{new Date(formData.reservation_date).toLocaleDateString('it-IT')}</strong></p>
                <p>Duration: <strong>{formData.duration_type === 'full_day' ? 'Full Day' : 'Half Day'}</strong>
                  {formData.duration_type === 'half_day' && (
                    <span> - <strong>{formData.time_slot === 'morning' ? 'Morning (9:00-13:00)' : 'Afternoon (14:00-18:00)'}</strong></span>
                  )}
                </p>
                <p>Entries to use: <strong>{entriesNeeded}</strong></p>
                <p>Remaining after: <strong>{remainingEntries - entriesNeeded}</strong></p>
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
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !availabilityStatus?.available || remainingEntries < entriesNeeded}
            >
              {loading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Creating...
                </>
              ) : (
                'Confirm Reservation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackageBookingForm;