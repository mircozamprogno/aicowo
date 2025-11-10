// src/components/contracts/ContractForm.jsx
import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import SearchableSelect from '../common/SearchableSelect';
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

  const [hasExistingFreeTrial, setHasExistingFreeTrial] = useState(false);
  const [checkingFreeTrial, setCheckingFreeTrial] = useState(false);

  // Price and date override states (for partners only)
  const [overrideEndDate, setOverrideEndDate] = useState(false);
  const [manualEndDate, setManualEndDate] = useState('');
  const [overridePrice, setOverridePrice] = useState(false);
  const [manualPrice, setManualPrice] = useState('');

  // Discount code states
  const [discountCode, setDiscountCode] = useState('');
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [discountValidation, setDiscountValidation] = useState(null);
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  // Determine if user can override
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';
  const canOverride = isPartnerAdmin || isSuperAdmin;

  // Separate state for tracking if we're loading a contract for edit
  const [loadingEditContract, setLoadingEditContract] = useState(false);
  const [pendingServiceId, setPendingServiceId] = useState(null);

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

  // Set service_id AFTER availableServices is populated in edit mode
  useEffect(() => {
    if (loadingEditContract && availableServices.length > 0 && pendingServiceId) {
      setFormData(prev => ({
        ...prev,
        service_id: pendingServiceId
      }));
      setLoadingEditContract(false);
      setPendingServiceId(null);
    }
  }, [availableServices, loadingEditContract, pendingServiceId]);

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

  // Calculate end date when service or start date changes (only if not overriding)
  useEffect(() => {
    if (selectedService && formData.start_date && !overrideEndDate) {
      calculateEndDate();
    } else if (!overrideEndDate) {
      setCalculatedEndDate('');
      setAvailabilityStatus(null);
    }
  }, [selectedService, formData.start_date, overrideEndDate]);

  // Check availability when we have service, dates, and it's an abbonamento
  useEffect(() => {
    const endDate = overrideEndDate ? manualEndDate : calculatedEndDate;
    if (selectedService && formData.start_date && endDate && 
        selectedService.service_type === 'abbonamento') {
      checkResourceAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [selectedService, formData.start_date, calculatedEndDate, overrideEndDate, manualEndDate]);

  useEffect(() => {
    if (isCustomerMode && formData.customer_id && isOpen) {
      checkExistingFreeTrial();
    }
  }, [formData.customer_id, isOpen, isCustomerMode]);

  // Validate discount code when it changes or service changes
  useEffect(() => {
    if (discountCode && selectedService && formData.customer_id) {
      validateDiscountCode();
    } else {
      setDiscountValidation(null);
      setAppliedDiscount(null);
    }
  }, [discountCode, selectedService, formData.customer_id]);

  // Calculate discount when price changes
  useEffect(() => {
    if (appliedDiscount && selectedService) {
      calculateDiscount();
    }
  }, [appliedDiscount, selectedService, overridePrice, manualPrice]);

  const loadContractForEditing = async () => {
    if (!contractToEdit) return;

    try {
      setLoadingEditContract(true);
      
      // Load ALL services for this location first
      const { data: servicesData, error: servicesError } = await supabase
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
        .eq('location_resources.location_id', parseInt(contractToEdit.location_id))
        .eq('partner_uuid', partnerUuid)
        .eq('service_status', 'active')
        .order('service_name');

      if (!servicesError && servicesData) {
        // Set available services first
        setAvailableServices(servicesData);
        
        // Find and set the selected service
        const selectedSvc = servicesData.find(s => s.id === contractToEdit.service_id);
        if (selectedSvc) {
          setSelectedService(selectedSvc);
          
          // Check if dates or price were manually overridden
          const calculatedEnd = new Date(contractToEdit.start_date);
          calculatedEnd.setDate(calculatedEnd.getDate() + selectedSvc.duration_days);
          const calculatedEndStr = calculatedEnd.toISOString().split('T')[0];
          
          if (contractToEdit.end_date !== calculatedEndStr && canOverride) {
            setOverrideEndDate(true);
            setManualEndDate(contractToEdit.end_date);
          }
          
          if (parseFloat(contractToEdit.service_cost) !== parseFloat(selectedSvc.cost) && canOverride) {
            setOverridePrice(true);
            setManualPrice(contractToEdit.service_cost.toString());
          }
        }
        
        // Store the service_id to be set after services are loaded
        setPendingServiceId(contractToEdit.service_id?.toString() || '');
      }

      // Load discount code if present
      if (contractToEdit.discount_code) {
        setDiscountCode(contractToEdit.discount_code);
      }

      // Set form data WITHOUT service_id (will be set by useEffect)
      setFormData({
        customer_id: contractToEdit.customer_id?.toString() || '',
        location_id: contractToEdit.location_id?.toString() || '',
        service_id: '', // Will be set by useEffect after services load
        start_date: contractToEdit.start_date || ''
      });

      // Set calculated end date from existing contract
      setCalculatedEndDate(contractToEdit.end_date || '');
    } catch (error) {
      console.error('Error loading contract for editing:', error);
      toast.error('Error loading contract data');
      setLoadingEditContract(false);
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
    setOverrideEndDate(false);
    setManualEndDate('');
    setOverridePrice(false);
    setManualPrice('');
    setLoadingEditContract(false);
    setPendingServiceId(null);
    setDiscountCode('');
    setValidatingDiscount(false);
    setDiscountValidation(null);
    setAppliedDiscount(null);
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
        // Filter out free trial services if customer already had one
        let filteredServices = data || [];
        
        if (isCustomerMode && hasExistingFreeTrial) {
          filteredServices = filteredServices.filter(service => service.service_type !== 'free_trial');
        }
        
        setAvailableServices(filteredServices);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setAvailableServices([]);
    }
  };

  const checkExistingFreeTrial = async () => {
    setCheckingFreeTrial(true);
    try {
      // Check for ANY free trial contract (including archived ones)
      const { data, error } = await supabase
        .from('contracts')
        .select('id, contract_number, is_archived')
        .eq('customer_id', parseInt(formData.customer_id))
        .eq('service_type', 'free_trial')
        .limit(1);

      if (error) {
        console.error('Error checking free trial:', error);
        return;
      }

      // If any free trial exists (archived or not), prevent new ones
      if (data && data.length > 0) {
        setHasExistingFreeTrial(true);
      } else {
        setHasExistingFreeTrial(false);
      }
    } catch (error) {
      console.error('Error checking free trial:', error);
    } finally {
      setCheckingFreeTrial(false);
    }
  };

  const validateDiscountCode = async () => {
    if (!discountCode || !selectedService || !formData.customer_id) return;

    // No discount on free_trial
    if (selectedService.service_type === 'free_trial') {
      setDiscountValidation({ valid: false, error: t('contracts.noDiscountOnFreeTrial') || 'Discount codes cannot be applied to free trial services' });
      setAppliedDiscount(null);
      return;
    }

    // Only for abbonamento and pacchetto
    if (selectedService.service_type !== 'abbonamento' && selectedService.service_type !== 'pacchetto') {
      setDiscountValidation({ valid: false, error: t('contracts.discountOnlyForPaidServices') || 'Discount codes can only be applied to subscriptions and packages' });
      setAppliedDiscount(null);
      return;
    }

    setValidatingDiscount(true);

    try {
      const { data, error } = await supabase
        .from('customers_discount_codes')
        .select('*')
        .eq('partner_uuid', partnerUuid)
        .eq('code', discountCode.trim().toUpperCase())
        .single();

      if (error || !data) {
        setDiscountValidation({ valid: false, error: t('contracts.discountCodeNotFound') || 'Discount code not found' });
        setAppliedDiscount(null);
        return;
      }

      // Check if active
      if (!data.is_active) {
        setDiscountValidation({ valid: false, error: t('contracts.discountCodeInactive') || 'This discount code is inactive' });
        setAppliedDiscount(null);
        return;
      }

      // Check dates
      const now = new Date();
      const validFrom = new Date(data.valid_from);
      const validUntil = new Date(data.valid_until);

      if (now < validFrom) {
        setDiscountValidation({ valid: false, error: t('contracts.discountCodeNotYetValid') || 'This discount code is not yet valid' });
        setAppliedDiscount(null);
        return;
      }

      if (now > validUntil) {
        setDiscountValidation({ valid: false, error: t('contracts.discountCodeExpired') || 'This discount code has expired' });
        setAppliedDiscount(null);
        return;
      }

      // Check usage limit
      if (data.usage_limit && data.usage_count >= data.usage_limit) {
        setDiscountValidation({ valid: false, error: t('contracts.discountCodeUsageLimitReached') || 'This discount code has reached its usage limit' });
        setAppliedDiscount(null);
        return;
      }

      // Check if applies to this service type
      if (data.applies_to_plans && data.applies_to_plans.length > 0) {
        if (!data.applies_to_plans.includes(selectedService.service_type)) {
          setDiscountValidation({ valid: false, error: t('contracts.discountCodeNotApplicable') || 'This discount code does not apply to this service type' });
          setAppliedDiscount(null);
          return;
        }
      }

      // Valid!
      setDiscountValidation({ valid: true });
      setAppliedDiscount(data);

    } catch (error) {
      console.error('Error validating discount code:', error);
      setDiscountValidation({ valid: false, error: t('contracts.errorValidatingDiscount') || 'Error validating discount code' });
      setAppliedDiscount(null);
    } finally {
      setValidatingDiscount(false);
    }
  };

  const calculateDiscount = () => {
    if (!appliedDiscount || !selectedService) return null;

    const basePrice = overridePrice ? parseFloat(manualPrice || 0) : selectedService.cost;
    let discountAmount = 0;

    if (appliedDiscount.discount_type === 'percentage') {
      discountAmount = (basePrice * appliedDiscount.discount_value) / 100;
    } else if (appliedDiscount.discount_type === 'fixed_amount') {
      discountAmount = Math.min(appliedDiscount.discount_value, basePrice);
    }

    const finalPrice = Math.max(basePrice - discountAmount, 0);

    return {
      originalPrice: basePrice,
      discountAmount: discountAmount,
      finalPrice: finalPrice
    };
  };

  const calculateEndDate = () => {
    if (!selectedService || !formData.start_date) return;

    const startDate = new Date(formData.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + selectedService.duration_days);
    
    setCalculatedEndDate(endDate.toISOString().split('T')[0]);
  };

  const checkResourceAvailability = async () => {
    const endDate = overrideEndDate ? manualEndDate : calculatedEndDate;
    if (!selectedService || !formData.start_date || !endDate) return;

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
        .or(`and(start_date.lte.${endDate},end_date.gte.${formData.start_date})`);

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
      
      // Reset price override and discount when service changes
      if (!editMode) {
        setOverridePrice(false);
        setManualPrice('');
        setDiscountCode('');
        setDiscountValidation(null);
        setAppliedDiscount(null);
      }
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

    // Only restrict past dates for customers in create mode
    if (!editMode && isCustomerMode) {
      const startDate = new Date(formData.start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        toast.error(t('messages.startDateCannotBeInPast'));
        return false;
      }
    }

    // Validate manual end date if overriding
    if (overrideEndDate) {
      if (!manualEndDate) {
        toast.error(t('messages.endDateRequired'));
        return false;
      }
      const startDate = new Date(formData.start_date);
      const endDate = new Date(manualEndDate);
      if (endDate <= startDate) {
        toast.error(t('messages.endDateMustBeAfterStartDate'));
        return false;
      }
    }

    // Validate manual price if overriding
    if (overridePrice) {
      const price = parseFloat(manualPrice);
      if (isNaN(price) || price <= 0) {
        toast.error(t('messages.priceInvalid'));
        return false;
      }
    }

    // Check we have an end date (calculated or manual)
    const endDate = overrideEndDate ? manualEndDate : calculatedEndDate;
    if (!endDate) {
      toast.error(t('messages.endDateRequired'));
      return false;
    }

    // Validate discount code if provided
    if (discountCode && discountCode.trim()) {
      if (validatingDiscount) {
        toast.error(t('contracts.discountValidationInProgress') || 'Please wait for discount validation to complete');
        return false;
      }
      if (!discountValidation || !discountValidation.valid) {
        toast.error(t('contracts.invalidDiscountCode') || 'Invalid discount code');
        return false;
      }
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
      const finalEndDate = overrideEndDate ? manualEndDate : calculatedEndDate;
      const basePrice = overridePrice ? parseFloat(manualPrice) : selectedService.cost;
      
      // Calculate discount if applied
      const discountCalc = appliedDiscount ? calculateDiscount() : null;

      let contractData = {
        customer_id: parseInt(formData.customer_id),
        service_id: parseInt(formData.service_id),
        location_id: parseInt(formData.location_id),
        partner_uuid: partnerUuid,
        start_date: formData.start_date,
        end_date: finalEndDate,
        
        // Service snapshot
        service_name: selectedService.service_name,
        service_type: selectedService.service_type,
        service_cost: discountCalc ? discountCalc.finalPrice : basePrice,
        service_currency: selectedService.currency,
        service_duration_days: selectedService.duration_days,
        service_max_entries: selectedService.max_entries,
        
        // Location snapshot
        location_name: selectedLocation?.location_name || 'Unknown Location',
        resource_name: selectedService.location_resources?.resource_name || 'Unknown Resource',
        resource_type: selectedService.location_resources?.resource_type || 'scrivania',
        
        // Discount fields
        discount_code: appliedDiscount ? discountCode.trim().toUpperCase() : null,
        discount_type: appliedDiscount ? appliedDiscount.discount_type : null,
        discount_value: appliedDiscount ? appliedDiscount.discount_value : null,
        original_price: discountCalc ? discountCalc.originalPrice : null,
        discount_amount: discountCalc ? discountCalc.discountAmount : null,
        final_price: discountCalc ? discountCalc.finalPrice : null,
        
        // Contract settings
        contract_status: 'active',
        is_renewable: selectedService.is_renewable || false,
        auto_renew: selectedService.auto_renew || false,
        
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

        // Update booking for abbonamento and free_trial services
        if (selectedService.service_type === 'abbonamento' || selectedService.service_type === 'free_trial') {
          const bookingEndDate = selectedService.service_type === 'free_trial' 
            ? formData.start_date
            : finalEndDate;
            
          await updateBookingForContract(contractToEdit.id, formData.start_date, bookingEndDate);
        }

        // Handle discount usage count update
        if (appliedDiscount) {
          // Check if discount changed
          const oldDiscount = contractToEdit.discount_code;
          const newDiscount = discountCode.trim().toUpperCase();
          
          if (oldDiscount !== newDiscount) {
            // Decrement old discount if it had usage_limit
            if (oldDiscount) {
              await decrementDiscountUsage(oldDiscount);
            }
            // Increment new discount if it has usage_limit
            if (appliedDiscount.usage_limit !== null) {
              await incrementDiscountUsage(newDiscount);
            }
          }
        } else if (contractToEdit.discount_code) {
          // Discount was removed, decrement old discount
          await decrementDiscountUsage(contractToEdit.discount_code);
        }

        result = data;
        toast.success(t('messages.contractUpdatedSuccessfully'));
      } else {
        // Create new contract
        const contractNumber = await generateContractNumber();
        contractData.contract_number = contractNumber;

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

        // Create booking for abbonamento and free_trial services
        if (selectedService.service_type === 'abbonamento' || selectedService.service_type === 'free_trial') {
          const bookingEndDate = selectedService.service_type === 'free_trial' 
            ? formData.start_date
            : finalEndDate;
            
          await createBookingForContract(data.id, formData.start_date, bookingEndDate);
        }

        // Increment discount usage count if it has usage_limit
        if (appliedDiscount && appliedDiscount.usage_limit !== null) {
          await incrementDiscountUsage(discountCode.trim().toUpperCase());
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

  const incrementDiscountUsage = async (code) => {
    try {
      const { error } = await supabase.rpc('increment_discount_usage', {
        p_partner_uuid: partnerUuid,
        p_code: code
      });

      if (error) {
        console.error('Error incrementing discount usage:', error);
      }
    } catch (error) {
      console.error('Error incrementing discount usage:', error);
    }
  };

  const decrementDiscountUsage = async (code) => {
    try {
      const { error } = await supabase.rpc('decrement_discount_usage', {
        p_partner_uuid: partnerUuid,
        p_code: code
      });

      if (error) {
        console.error('Error decrementing discount usage:', error);
      }
    } catch (error) {
      console.error('Error decrementing discount usage:', error);
    }
  };

  const generateContractNumber = async () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `CONT-${dateStr}-${randomNum}`;
  };

  const createBookingForContract = async (contractId, startDate, endDate) => {
    try {
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
    return type === 'scrivania' ? '🖥️' : '🏢';
  };

  const getFinalPrice = () => {
    const discountCalc = appliedDiscount ? calculateDiscount() : null;
    if (discountCalc) {
      return discountCalc.finalPrice;
    }
    if (overridePrice && manualPrice) {
      return parseFloat(manualPrice);
    }
    return selectedService?.cost || 0;
  };

  const getFinalEndDate = () => {
    return overrideEndDate ? manualEndDate : calculatedEndDate;
  };

  // Prepare options for SearchableSelect components
  const customerOptions = customers.map(customer => ({
    value: customer.id.toString(),
    label: customer.company_name || `${customer.first_name} ${customer.second_name} (${customer.email})`
  }));

  const locationOptions = (isCustomerMode ? customerLocations : locations).map(location => ({
    value: location.id.toString(),
    label: location.location_name
  }));

  const serviceOptions = availableServices.map(service => ({
    value: service.id.toString(),
    label: `${service.service_name} - ${formatCurrency(service.cost, service.currency)} (${getServiceTypeLabel(service.service_type)})`
  }));

  // Calculate discount info for display
  const discountCalc = appliedDiscount ? calculateDiscount() : null;

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
                  {formData.start_date} - {getFinalEndDate()} 
                  {overrideEndDate && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>({t('contracts.customDuration')})</span>}
                </span>
              </div>
              
              {discountCalc && (
                <>
                  <div className="summary-item">
                    <span className="summary-label">{t('contracts.originalPrice')}:</span>
                    <span className="summary-value">{formatCurrency(discountCalc.originalPrice, selectedService?.currency)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">{t('contracts.discount')}:</span>
                    <span className="summary-value" style={{ color: '#059669' }}>
                      -{formatCurrency(discountCalc.discountAmount, selectedService?.currency)}
                      {' '}({appliedDiscount.discount_type === 'percentage' ? `${appliedDiscount.discount_value}%` : t('contracts.fixedAmount')})
                    </span>
                  </div>
                </>
              )}
              
              <div className="summary-item">
                <span className="summary-label">{t('contracts.cost')}:</span>
                <span className="summary-value cost">
                  {formatCurrency(getFinalPrice(), selectedService?.currency)}
                  {overridePrice && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>({t('contracts.customPrice')})</span>}
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
                className="btn-primary-green"
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
            <div className="form-section-clean">
              <div className="form-group">
                <label htmlFor="customer_id" className="form-label">
                  {t('contracts.customer')} *
                </label>
                <SearchableSelect
                  value={formData.customer_id}
                  onChange={(e) => handleChange({ target: { name: 'customer_id', value: e.target.value } })}
                  options={customerOptions}
                  placeholder={t('contracts.selectCustomer')}
                  emptyMessage={t('common.noResultsFound')}
                  className={editMode ? 'disabled' : ''}
                />
              </div>
            </div>
          )}

          {/* Location Selection */}
          <div className="form-section-clean">
            <div className="form-group">
              <label htmlFor="location_id" className="form-label">
                {t('contracts.location')} *
              </label>
              <SearchableSelect
                value={formData.location_id}
                onChange={(e) => handleChange({ target: { name: 'location_id', value: e.target.value } })}
                options={locationOptions}
                placeholder={t('contracts.selectLocation')}
                emptyMessage={t('common.noResultsFound')}
              />
            </div>
          </div>

          {isCustomerMode && hasExistingFreeTrial && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'start',
              gap: '0.75rem'
            }}>
              <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '0.125rem' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e', fontWeight: 500 }}>
                  {t('contracts.freeTrialAlreadyUsed') || 'You have already used your free trial'}
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#92400e' }}>
                  {t('contracts.freeTrialOncePerCustomer') || 'Free trial services can only be used once per customer, even if deleted or archived.'}
                </p>
              </div>
            </div>
          )}

          {/* Service Selection */}
          <div className="form-section-clean">
            <div className="form-group">
              <label htmlFor="service_id" className="form-label">
                {t('contracts.service')} *
              </label>
              <SearchableSelect
                value={formData.service_id}
                onChange={(e) => {
                  const value = e.target.value;
                  handleChange({ target: { name: 'service_id', value } });
                }}
                options={serviceOptions}
                placeholder={!formData.location_id 
                  ? t('contracts.selectLocationFirst')
                  : t('contracts.selectService')
                }
                emptyMessage={t('common.noResultsFound')}
              />
              <p style={{ 
                fontSize: '0.8125rem', 
                color: '#6b7280', 
                fontStyle: 'italic', 
                marginTop: '0.375rem',
                marginBottom: 0 
              }}>
                {t('contracts.pricesExcludeVAT')}
              </p>
            </div>

            {selectedService && (
              <div className="service-details">
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
                  <div className="service-detail-item">
                    <span className="detail-label">{t('contracts.cost')}:</span>
                    <span className="detail-value" style={{ fontWeight: 600 }}>
                      {discountCalc ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#9ca3af', marginRight: '0.5rem' }}>
                            {formatCurrency(discountCalc.originalPrice, selectedService.currency)}
                          </span>
                          <span style={{ color: '#059669' }}>
                            {formatCurrency(discountCalc.finalPrice, selectedService.currency)}
                          </span>
                        </>
                      ) : (
                        formatCurrency(overridePrice ? parseFloat(manualPrice || 0) : selectedService.cost, selectedService.currency)
                      )}
                      {overridePrice && !discountCalc && <span style={{ color: '#f59e0b', marginLeft: '0.5rem', fontSize: '0.875rem' }}>({t('contracts.customPrice')})</span>}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Discount Code Section - Only for abbonamento and pacchetto */}
          {selectedService && (selectedService.service_type === 'abbonamento' || selectedService.service_type === 'pacchetto') && (
            <div className="form-section-clean">
              <div className="form-group">
                <label htmlFor="discount_code" className="form-label">
                  {t('contracts.discountCode')} ({t('common.optional')})
                  {!canOverride && isCustomerMode && (
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                      ({t('contracts.askPartnerForCode') || 'Ask your partner for discount codes'})
                    </span>
                  )}
                </label>
                <input
                  id="discount_code"
                  type="text"
                  className="form-input"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                  placeholder={t('contracts.enterDiscountCode') || 'SUMMER2024'}
                  style={{ textTransform: 'uppercase' }}
                  disabled={!canOverride && isCustomerMode && editMode}
                />
                {validatingDiscount && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="loading-spinner-small"></div>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {t('contracts.validatingCode') || 'Validating code...'}
                    </span>
                  </div>
                )}
                {discountValidation && !validatingDiscount && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    backgroundColor: discountValidation.valid ? '#d1fae5' : '#fee2e2',
                    color: discountValidation.valid ? '#065f46' : '#991b1b',
                    border: `1px solid ${discountValidation.valid ? '#6ee7b7' : '#fca5a5'}`
                  }}>
                    {discountValidation.valid ? (
                      <span>✅ {t('contracts.validDiscountCode') || 'Valid discount code'}</span>
                    ) : (
                      <span>❌ {discountValidation.error}</span>
                    )}
                  </div>
                )}
                {discountCalc && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: '#d1fae5',
                    border: '1px solid #6ee7b7',
                    borderRadius: '0.375rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#065f46', marginBottom: '0.5rem', fontWeight: 600 }}>
                      {t('contracts.discountApplied') || 'Discount Applied'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#047857' }}>{t('contracts.originalPrice')}:</span>
                        <span style={{ color: '#047857', textDecoration: 'line-through' }}>
                          {formatCurrency(discountCalc.originalPrice, selectedService.currency)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#047857' }}>
                          {t('contracts.discount')} ({appliedDiscount.discount_type === 'percentage' ? `${appliedDiscount.discount_value}%` : t('contracts.fixedAmount')}):
                        </span>
                        <span style={{ color: '#047857', fontWeight: 600 }}>
                          -{formatCurrency(discountCalc.discountAmount, selectedService.currency)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #6ee7b7' }}>
                        <span style={{ color: '#065f46', fontWeight: 700 }}>{t('contracts.finalPrice')}:</span>
                        <span style={{ color: '#065f46', fontWeight: 700, fontSize: '1rem' }}>
                          {formatCurrency(discountCalc.finalPrice, selectedService.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price Override Section - Partner Only */}
          {canOverride && selectedService && !appliedDiscount && (
            <div className="form-section-clean">
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    {t('contracts.price')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={overridePrice}
                      onChange={(e) => {
                        setOverridePrice(e.target.checked);
                        if (!e.target.checked) {
                          setManualPrice('');
                        } else {
                          setManualPrice(selectedService.cost.toString());
                        }
                      }}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    <span>{t('contracts.overridePrice')}</span>
                  </label>
                </div>
                
                {overridePrice ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder={t('contracts.enterCustomPrice')}
                  />
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={formatCurrency(selectedService.cost, selectedService.currency)}
                    disabled
                    style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Start Date Selection */}
          <div className="form-section-clean">
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
                    min={!isCustomerMode || editMode ? undefined : new Date().toISOString().split('T')[0]}
                  />
              </div>
              
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    {t('contracts.endDate')} *
                  </label>
                  {canOverride && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={overrideEndDate}
                        onChange={(e) => {
                          setOverrideEndDate(e.target.checked);
                          if (!e.target.checked) {
                            setManualEndDate('');
                          } else if (calculatedEndDate) {
                            setManualEndDate(calculatedEndDate);
                          }
                        }}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <span>{t('contracts.customEndDate')}</span>
                    </label>
                  )}
                </div>
                
                {canOverride && overrideEndDate ? (
                  <input
                    type="date"
                    className="form-input"
                    value={manualEndDate}
                    onChange={(e) => setManualEndDate(e.target.value)}
                    min={formData.start_date || new Date().toISOString().split('T')[0]}
                  />
                ) : (
                  <input
                    type="date"
                    className="form-input"
                    value={calculatedEndDate}
                    disabled
                    style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                )}
              </div>
            </div>

            {!overrideEndDate && calculatedEndDate && (
              <div className="date-calculation">
                <p className="calculation-note">
                  {t('contracts.endDateCalculated')}
                </p>
              </div>
            )}

            {/* Availability Check for Abbonamento */}
            {selectedService?.service_type === 'abbonamento' && getFinalEndDate() && (
              <div className="availability-check">
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
              className="btn-primary-green"
              disabled={loading || !getFinalEndDate()}
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