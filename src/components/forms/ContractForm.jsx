import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const ContractForm = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  partnerUuid, 
  isCustomerMode = false,
  customers = [],
  locations = [],
  editMode = false,
  contractToEdit = null
}) => {
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    customer_id: '',
    location_id: '',
    service_id: '',
    start_date: ''
  });
  
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [calculatedEndDate, setCalculatedEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [customerLocations, setCustomerLocations] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Get customer ID for customer mode
  useEffect(() => {
    if (isCustomerMode && user && isOpen) {
      fetchCustomerData();
    }
  }, [isCustomerMode, user, isOpen]);

  // Reset form when modal opens/closes or when edit contract changes
  useEffect(() => {
    if (isOpen) {
      if (editMode && contractToEdit) {
        loadContractForEditing();
      } else {
        resetForm();
      }
      if (isCustomerMode) {
        fetchCustomerLocations();
      }
    }
  }, [isOpen, editMode, contractToEdit]);

  // Fetch services when location changes
  useEffect(() => {
    if (formData.location_id) {
      fetchServicesForLocation(formData.location_id);
      setSelectedLocation(customerLocations.find(loc => loc.id.toString() === formData.location_id) || 
                         locations.find(loc => loc.id.toString() === formData.location_id));
    } else {
      setAvailableServices([]);
      setSelectedLocation(null);
    }
  }, [formData.location_id, customerLocations, locations]);

  // Calculate end date when service or start date changes
  useEffect(() => {
    if (selectedService && formData.start_date) {
      calculateEndDate();
    } else {
      setCalculatedEndDate('');
      setAvailabilityStatus(null);
    }
  }, [selectedService, formData.start_date]);

  // Check availability when we have service, dates, and it's an abbonamento
  useEffect(() => {
    if (selectedService && formData.start_date && calculatedEndDate && 
        selectedService.service_type === 'abbonamento') {
      checkResourceAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [selectedService, formData.start_date, calculatedEndDate]);

  const loadContractForEditing = async () => {
    if (!contractToEdit) return;

    try {
      // Set form data from existing contract
      setFormData({
        customer_id: contractToEdit.customer_id?.toString() || '',
        location_id: contractToEdit.location_id?.toString() || '',
        service_id: contractToEdit.service_id?.toString() || '',
        start_date: contractToEdit.start_date || ''
      });

      // Load the service details if we have a service_id
      if (contractToEdit.service_id) {
        const { data: serviceData, error } = await supabase
          .from('services')
          .select(`
            *,
            location_resources!fk_services_location_resource (
              id,
              resource_name,
              resource_type,
              locations (
                id,
                location_name
              )
            )
          `)
          .eq('id', contractToEdit.service_id)
          .single();

        if (!error && serviceData) {
          setSelectedService(serviceData);
        }
      }

      // Set calculated end date from existing contract
      setCalculatedEndDate(contractToEdit.end_date || '');
    } catch (error) {
      console.error('Error loading contract for editing:', error);
      toast.error('Error loading contract data');
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      location_id: '',
      service_id: '',
      start_date: ''
    });
    setAvailableServices([]);
    setSelectedService(null);
    setSelectedLocation(null);
    setCalculatedEndDate('');
    setShowConfirmation(false);
  };

  const fetchCustomerData = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching customer data:', error);
        return;
      }

      if (data) {
        setFormData(prev => ({ ...prev, customer_id: data.id.toString() }));
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
    }
  };

  const fetchCustomerLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, location_name')
        .eq('partner_uuid', partnerUuid)
        .order('location_name');

      if (error) {
        console.error('Error fetching locations:', error);
        // Mock data for development
        setCustomerLocations([
          { id: 1, location_name: 'Milano Centro' },
          { id: 2, location_name: 'Roma Termini' }
        ]);
      } else {
        setCustomerLocations(data || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      setCustomerLocations([]);
    }
  };

  const fetchServicesForLocation = async (locationId) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          location_resources!fk_services_location_resource (
            id,
            resource_name,
            resource_type,
            locations (
              id,
              location_name
            )
          )
        `)
        .eq('location_resources.location_id', parseInt(locationId))
        .eq('partner_uuid', partnerUuid)
        .eq('service_status', 'active')
        .order('service_name');

      if (error) {
        console.error('Error fetching services:', error);
        // Mock data for development
        const mockServices = [
          {
            id: 1,
            service_name: 'Hot Desk Monthly',
            service_type: 'abbonamento',
            service_description: '10 meeting room bookings',
            cost: 200.00,
            currency: 'EUR',
            duration_days: 90,
            max_entries: 10,
            location_resources: {
              resource_name: 'Small Meeting Room',
              resource_type: 'sala_riunioni'
            }
          }
        ];
        setAvailableServices(mockServices);
      } else {
        setAvailableServices(data || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setAvailableServices([]);
    }
  };

  const calculateEndDate = () => {
    if (!selectedService || !formData.start_date) return;

    const startDate = new Date(formData.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + selectedService.duration_days);
    
    setCalculatedEndDate(endDate.toISOString().split('T')[0]);
  };

  const checkResourceAvailability = async () => {
    if (!selectedService || !formData.start_date || !calculatedEndDate) return;

    setCheckingAvailability(true);
    
    try {
      // Get the location resource for this service
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select(`
          location_resources!fk_services_location_resource (
            id,
            resource_name,
            quantity,
            resource_type
          )
        `)
        .eq('id', selectedService.id)
        .single();

      if (serviceError) {
        console.error('Error fetching service resource:', serviceError);
        setAvailabilityStatus({ available: false, error: 'Error checking availability' });
        return;
      }

      const locationResource = serviceData.location_resources;
      if (!locationResource) {
        setAvailabilityStatus({ available: false, error: 'No resource found for this service' });
        return;
      }

      // Check existing bookings that overlap with the requested period
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('location_resource_id', locationResource.id)
        .eq('booking_status', 'active')
        .or(`and(start_date.lte.${calculatedEndDate},end_date.gte.${formData.start_date})`);

      if (bookingsError) {
        console.error('Error checking existing bookings:', bookingsError);
        setAvailabilityStatus({ available: false, error: 'Error checking existing bookings' });
        return;
      }

      // Calculate available quantity
      const totalQuantity = locationResource.quantity;
      const bookedQuantity = existingBookings ? existingBookings.length : 0;
      const availableQuantity = totalQuantity - bookedQuantity;

      // If editing, exclude current contract's booking from the count
      let editExclusion = 0;
      if (editMode && contractToEdit) {
        const { data: currentBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('contract_id', contractToEdit.id)
          .eq('location_resource_id', locationResource.id)
          .single();
        
        if (currentBooking) {
          editExclusion = 1;
        }
      }

      const finalAvailableQuantity = availableQuantity + editExclusion;

      setAvailabilityStatus({
        available: finalAvailableQuantity > 0,
        totalQuantity,
        bookedQuantity: bookedQuantity - editExclusion,
        availableQuantity: finalAvailableQuantity,
        resourceName: locationResource.resource_name,
        resourceType: locationResource.resource_type
      });

    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityStatus({ available: false, error: 'Unexpected error checking availability' });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Handle service selection
    if (name === 'service_id') {
      const service = availableServices.find(s => s.id.toString() === value);
      setSelectedService(service);
    }
  };

  const validateForm = () => {
    if (!formData.customer_id) {
      toast.error(t('messages.customerRequired'));
      return false;
    }
    if (!formData.location_id) {
      toast.error(t('messages.locationRequired'));
      return false;
    }
    if (!formData.service_id) {
      toast.error(t('messages.serviceRequired'));
      return false;
    }
    if (!formData.start_date) {
      toast.error(t('messages.startDateRequired'));
      return false;
    }

    const startDate = new Date(formData.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // For edit mode, allow past dates if they were already set
    if (!editMode && startDate < today) {
      toast.error(t('messages.startDateCannotBeInPast'));
      return false;
    }

    // Check availability for abbonamento services
    if (selectedService?.service_type === 'abbonamento') {
      if (checkingAvailability) {
        toast.error(t('messages.availabilityCheckInProgress'));
        return false;
      }
      
      if (!availabilityStatus) {
        toast.error(t('messages.pleaseWaitForAvailabilityCheck'));
        return false;
      }
      
      if (!availabilityStatus.available) {
        toast.error(t('messages.resourceNotAvailable'));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmContract = async () => {
    setLoading(true);

    try {
      let contractData = {
        customer_id: parseInt(formData.customer_id),
        service_id: parseInt(formData.service_id),
        location_id: parseInt(formData.location_id),
        partner_uuid: partnerUuid,
        start_date: formData.start_date,
        end_date: calculatedEndDate,
        
        // Service snapshot
        service_name: selectedService.service_name,
        service_type: selectedService.service_type,
        service_cost: selectedService.cost,
        service_currency: selectedService.currency,
        service_duration_days: selectedService.duration_days,
        service_max_entries: selectedService.max_entries,
        
        // Location snapshot
        location_name: selectedLocation?.location_name || 'Unknown Location',
        resource_name: selectedService.location_resources?.resource_name || 'Unknown Resource',
        resource_type: selectedService.location_resources?.resource_type || 'scrivania',
        
        // Contract settings
        contract_status: 'active',
        is_renewable: selectedService.is_renewable || false,
        auto_renew: selectedService.auto_renew || false,
        
        // Audit fields - only include fields that exist in the database
        // updated_by_user_id: user.id,
        // updated_by_role: profile.role,
        updated_at: new Date().toISOString()
      };

      let result;
      
      if (editMode && contractToEdit) {
        // Update existing contract
        const { data, error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', contractToEdit.id)
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
          .single();

        if (error) {
          console.error('Contract update error:', error);
          throw error;
        }

        // Update booking if it's an abbonamento
        if (selectedService.service_type === 'abbonamento') {
          await updateBookingForContract(contractToEdit.id, formData.start_date, calculatedEndDate);
        }

        result = data;
        toast.success(t('messages.contractUpdatedSuccessfully'));
      } else {
        // Create new contract
        const contractNumber = await generateContractNumber();
        contractData.contract_number = contractNumber;
        // Only add creation audit fields for new contracts
        // contractData.created_by_user_id = user.id;
        // contractData.created_by_role = profile.role;

        const { data, error } = await supabase
          .from('contracts')
          .insert([contractData])
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
          .single();

        if (error) {
          console.error('Contract creation error:', error);
          throw error;
        }

        // Create booking if it's an abbonamento
        if (selectedService.service_type === 'abbonamento') {
          await createBookingForContract(data.id, formData.start_date, calculatedEndDate);
        }

        result = data;
        toast.success(t('messages.contractCreatedSuccessfully'));
      }

      onSuccess(result);
      onClose();
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error(error.message || (editMode ? t('messages.errorUpdatingContract') : t('messages.errorCreatingContract')));
    } finally {
      setLoading(false);
      setShowConfirmation(false);
    }
  };

  const generateContractNumber = async () => {
    // For now, generate a simple contract number
    // In real implementation, you'd call the database function
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `CONT-${dateStr}-${randomNum}`;
  };

  const createBookingForContract = async (contractId, startDate, endDate) => {
    try {
      // Get the location resource for this service
      const { data: serviceData } = await supabase
        .from('services')
        .select(`
          location_resources!fk_services_location_resource (
            id
          )
        `)
        .eq('id', selectedService.id)
        .single();

      if (!serviceData?.location_resources) {
        throw new Error('Location resource not found for service');
      }

      const bookingData = {
        contract_id: contractId,
        location_resource_id: serviceData.location_resources.id,
        partner_uuid: partnerUuid,
        customer_id: parseInt(formData.customer_id),
        start_date: startDate,
        end_date: endDate,
        booking_status: 'active',
        created_by: user.id
      };

      const { error } = await supabase
        .from('bookings')
        .insert([bookingData]);

      if (error) {
        console.error('Error creating booking:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in createBookingForContract:', error);
      throw error;
    }
  };

  const updateBookingForContract = async (contractId, startDate, endDate) => {
    try {
      // Get the location resource for this service
      const { data: serviceData } = await supabase
        .from('services')
        .select(`
          location_resources!fk_services_location_resource (
            id
          )
        `)
        .eq('id', selectedService.id)
        .single();

      if (!serviceData?.location_resources) {
        throw new Error('Location resource not found for service');
      }

      // Update existing booking
      const { error } = await supabase
        .from('bookings')
        .update({
          location_resource_id: serviceData.location_resources.id,
          start_date: startDate,
          end_date: endDate,
          updated_by: user.id
        })
        .eq('contract_id', contractId);

      if (error) {
        console.error('Error updating booking:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in updateBookingForContract:', error);
      throw error;
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getServiceTypeLabel = (type) => {
    const types = {
      abbonamento: t('services.subscription'),
      pacchetto: t('services.package'),
      free_trial: t('services.freeTrial')
    };
    return types[type] || type;
  };

  const getResourceTypeIcon = (type) => {
    return type === 'scrivania' ? '🪑' : '🏢';
  };

  if (!isOpen) return null;

  if (showConfirmation) {
    return (
      <div className="modal-overlay">
        <div className="modal-container">
          <div className="modal-header">
            <h2 className="modal-title">
              {editMode ? t('contracts.confirmUpdate') : t('contracts.confirmContract')}
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
                <p>{editMode ? t('contracts.contractUpdateWarning') : t('contracts.contractImmutableWarning')}</p>
              </div>
            </div>

            <div className="contract-summary">
              <h4>{editMode ? t('contracts.updateSummary') : t('contracts.contractSummary')}</h4>
              
              {!isCustomerMode && (
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.customer')}:</span>
                  <span className="summary-value">
                    {customers.find(c => c.id.toString() === formData.customer_id)?.first_name} {' '}
                    {customers.find(c => c.id.toString() === formData.customer_id)?.second_name}
                  </span>
                </div>
              )}
              
              <div className="summary-item">
                <span className="summary-label">{t('contracts.location')}:</span>
                <span className="summary-value">{selectedLocation?.location_name}</span>
              </div>
              
              <div className="summary-item">
                <span className="summary-label">{t('contracts.service')}:</span>
                <span className="summary-value">
                  {selectedService?.service_name} ({getServiceTypeLabel(selectedService?.service_type)})
                </span>
              </div>
              
              <div className="summary-item">
                <span className="summary-label">{t('contracts.resource')}:</span>
                <span className="summary-value">
                  {getResourceTypeIcon(selectedService?.location_resources?.resource_type)} {' '}
                  {selectedService?.location_resources?.resource_name}
                </span>
              </div>
              
              <div className="summary-item">
                <span className="summary-label">{t('contracts.period')}:</span>
                <span className="summary-value">
                  {formData.start_date} - {calculatedEndDate} ({selectedService?.duration_days} {t('contracts.days')})
                </span>
              </div>
              
              <div className="summary-item">
                <span className="summary-label">{t('contracts.cost')}:</span>
                <span className="summary-value cost">
                  {formatCurrency(selectedService?.cost, selectedService?.currency)}
                </span>
              </div>

              {selectedService?.service_type === 'pacchetto' && selectedService?.max_entries && (
                <div className="summary-item">
                  <span className="summary-label">{t('contracts.includedEntries')}:</span>
                  <span className="summary-value">{selectedService.max_entries}</span>
                </div>
              )}
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
                onClick={handleConfirmContract}
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    {editMode ? t('contracts.updating') : t('contracts.creating')}...
                  </>
                ) : (
                  editMode ? t('contracts.confirmAndUpdate') : t('contracts.confirmAndCreate')
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
      <div className="modal-container contract-form-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {editMode ? t('contracts.editContract') : t('contracts.createContract')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Customer Selection - Only for partner admins */}
          {!isCustomerMode && (
            <div className="form-section">
              <h3 className="form-section-title">{t('contracts.selectCustomer')}</h3>
              
              <div className="form-group">
                <label htmlFor="customer_id" className="form-label">
                  {t('contracts.customer')} *
                </label>
                <select
                  id="customer_id"
                  name="customer_id"
                  required
                  className="form-select"
                  value={formData.customer_id}
                  onChange={handleChange}
                  disabled={editMode} // Disable customer change in edit mode
                >
                  <option value="">{t('contracts.selectCustomer')}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name || `${customer.first_name} ${customer.second_name}`} ({customer.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Location Selection */}
          <div className="form-section">
            <h3 className="form-section-title">{t('contracts.selectLocation')}</h3>
            
            <div className="form-group">
              <label htmlFor="location_id" className="form-label">
                {t('contracts.location')} *
              </label>
              <select
                id="location_id"
                name="location_id"
                required
                className="form-select"
                value={formData.location_id}
                onChange={handleChange}
              >
                <option value="">{t('contracts.selectLocation')}</option>
                {(isCustomerMode ? customerLocations : locations).map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.location_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Service Selection */}
          <div className="form-section">
            <h3 className="form-section-title">{t('contracts.selectService')}</h3>
            
            <div className="form-group">
              <label htmlFor="service_id" className="form-label">
                {t('contracts.service')} *
              </label>
              <select
                id="service_id"
                name="service_id"
                required
                className="form-select"
                value={formData.service_id}
                onChange={handleChange}
                disabled={!formData.location_id}
              >
                <option value="">
                  {!formData.location_id 
                    ? t('contracts.selectLocationFirst')
                    : t('contracts.selectService')
                  }
                </option>
                {availableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.service_name} - {formatCurrency(service.cost, service.currency)} 
                    ({getServiceTypeLabel(service.service_type)})
                  </option>
                ))}
              </select>
            </div>

            {selectedService && (
              <div className="service-details">
                <h4>{t('contracts.serviceDetails')}</h4>
                <div className="service-info-display">
                  <div className="service-detail-item">
                    <span className="detail-label">{t('contracts.description')}:</span>
                    <span className="detail-value">{selectedService.service_description}</span>
                  </div>
                  <div className="service-detail-item">
                    <span className="detail-label">{t('contracts.duration')}:</span>
                    <span className="detail-value">{selectedService.duration_days} {t('contracts.days')}</span>
                  </div>
                  <div className="service-detail-item">
                    <span className="detail-label">{t('contracts.resource')}:</span>
                    <span className="detail-value">
                      {getResourceTypeIcon(selectedService.location_resources?.resource_type)} {' '}
                      {selectedService.location_resources?.resource_name}
                    </span>
                  </div>
                  {selectedService.service_type === 'pacchetto' && selectedService.max_entries && (
                    <div className="service-detail-item">
                      <span className="detail-label">{t('contracts.includedEntries')}:</span>
                      <span className="detail-value">{selectedService.max_entries}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Start Date Selection */}
          <div className="form-section">
            <h3 className="form-section-title">{t('contracts.selectStartDate')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_date" className="form-label">
                  {t('contracts.startDate')} *
                </label>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  required
                  className="form-input"
                  value={formData.start_date}
                  onChange={handleChange}
                  min={editMode ? undefined : new Date().toISOString().split('T')[0]}
                />
              </div>
              
              {calculatedEndDate && (
                <div className="form-group">
                  <label className="form-label">
                    {t('contracts.endDate')}
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={calculatedEndDate}
                    disabled
                    style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>
              )}
            </div>

            {calculatedEndDate && (
              <div className="date-calculation">
                <p className="calculation-note">
                  {t('contracts.endDateCalculated')}
                </p>
              </div>
            )}

            {/* Availability Check for Abbonamento */}
            {selectedService?.service_type === 'abbonamento' && calculatedEndDate && (
              <div className="availability-check">
                <h4>{t('contracts.resourceAvailability')}</h4>
                {checkingAvailability ? (
                  <div className="availability-loading">
                    <div className="loading-spinner-small"></div>
                    <span>{t('contracts.checkingAvailability')}...</span>
                  </div>
                ) : availabilityStatus ? (
                  <div className={`availability-status ${availabilityStatus.available ? 'available' : 'unavailable'}`}>
                    {availabilityStatus.available ? (
                      <div className="availability-success">
                        <span className="availability-icon">✅</span>
                        <div className="availability-details">
                          <p><strong>{t('contracts.resourceAvailable')}</strong></p>
                          <p>{availabilityStatus.availableQuantity} di {availabilityStatus.totalQuantity} {availabilityStatus.resourceName} disponibili per questo periodo</p>
                        </div>
                      </div>
                    ) : (
                      <div className="availability-error">
                        <span className="availability-icon">❌</span>
                        <div className="availability-details">
                          <p><strong>{t('contracts.resourceNotAvailable')}</strong></p>
                          {availabilityStatus.error ? (
                            <p>{availabilityStatus.error}</p>
                          ) : (
                            <p>Tutti i {availabilityStatus.totalQuantity} {availabilityStatus.resourceName} sono prenotati per questo periodo</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

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
              disabled={loading || !calculatedEndDate}
            >
              {editMode ? t('contracts.reviewUpdate') : t('contracts.reviewContract')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContractForm;