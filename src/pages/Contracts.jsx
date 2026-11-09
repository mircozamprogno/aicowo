// src/pages/Contracts.jsx
import { AlertTriangle, Archive, Calendar, Clock, Download, Edit2, FileText, Filter, Plus, RefreshCw, Upload, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import Pagination from '../components/common/Pagination';
import { toast } from '../components/common/ToastContainer';
import ContractActionsCell from '../components/ContractActionsCell';
// ContractForm import removed
import PackageBookingForm from '../components/forms/PackageBookingForm';
import PaymentForm from '../components/forms/PaymentForm';
import PaymentHistoryModal from '../components/modals/PaymentHistoryModal';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { generateAndUploadICS } from '../services/calendarService';
import { ContractArchiveService } from '../services/contractArchiveService';
import { CSVExportService } from '../services/csvExportService';
import oneSignalEmailService from '../services/oneSignalEmailService';
import { PaymentService } from '../services/paymentService';
import { generateContractPDF } from '../services/pdfGenerator';
import { supabase } from '../services/supabase';

import MessageModal from '../components/common/MessageModal';
import ContractsFilter from '../components/ContractsFilter';
import { BulkUploadModal } from '../components/fattureincloud/FattureInCloudComponents';
import { FattureInCloudService } from '../services/fattureInCloudService';

import { logActivity } from '../utils/activityLogger';
import logger from '../utils/logger';


const Contracts = () => {
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Modal states removed
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [contractToArchive, setContractToArchive] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [contractToClose, setContractToClose] = useState(null);
  const [closing, setClosing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);

  const [showPackageBooking, setShowPackageBooking] = useState(false);
  const [selectedPackageContract, setSelectedPackageContract] = useState(null);

  const [generatingPDF, setGeneratingPDF] = useState(null);

  const { profile, user } = useAuth();
  const { t } = useTranslation();

  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';
  const canCreateContracts = isCustomer || isPartnerAdmin;
  const canEditContracts = isPartnerAdmin || isSuperAdmin;

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [paymentToEdit, setPaymentToEdit] = useState(null);
  const [contractPayments, setContractPayments] = useState({});
  const canManagePayments = isPartnerAdmin || isSuperAdmin;

  const [exportingCSV, setExportingCSV] = useState(false);

  const [partnerSettings, setPartnerSettings] = useState(null);
  const [uploadStatuses, setUploadStatuses] = useState({});
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const [activeFilters, setActiveFilters] = useState({});

  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [onlyNeedsResource, setOnlyNeedsResource] = useState(false);
  const [onlyAutoRenew, setOnlyAutoRenew] = useState(false);
  // Hover panel with the full contract details (desktop table)
  const [detailsHover, setDetailsHover] = useState(null);
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [customerStatus, setCustomerStatus] = useState(null);
  const [showStatusAlert, setShowStatusAlert] = useState(false);

  const loadPartnerSettings = async () => {
    try {
      const settings = await FattureInCloudService.getPartnerSettings(profile.partner_uuid);
      setPartnerSettings(settings);
    } catch (error) {
      logger.error('Error loading partner settings:', error);
    }
  };

  const loadUploadStatuses = async () => {
    try {
      const contractIds = contracts.map(c => c.id);
      const statuses = await FattureInCloudService.getUploadStatus(contractIds);
      setUploadStatuses(statuses);
    } catch (error) {
      logger.error('Error loading upload statuses:', error);
    }
  };

  const handleUploadSuccess = (result) => {
    loadUploadStatuses();
  };

  const handleBulkUpload = () => {
    setShowBulkUpload(true);
  };

  const handleBulkUploadClose = () => {
    setShowBulkUpload(false);
    loadUploadStatuses();
  };

  const handleFilterChange = (filtered, filters) => {
    setFilteredContracts(filtered);
    setActiveFilters(filters);
    setCurrentPage(1);
  };

  const getPaymentStatusForFilter = (contract) => {
    if (contract.service_type === 'free_trial' || !contract.requires_payment) {
      return 'not_required';
    }

    const paymentInfo = contractPayments[contract.id];
    if (!paymentInfo) {
      return 'unpaid';
    }

    return paymentInfo.payment_status;
  };

  useEffect(() => {
    if (profile) {
      fetchContracts();
      if (isPartnerAdmin) {
        fetchCustomersAndLocations();
      }
    }
  }, [profile]);

  useEffect(() => {
    setFilteredContracts(contracts);
  }, [contracts]);

  useEffect(() => {
    if (profile?.partner_uuid && (isPartnerAdmin || isSuperAdmin)) {
      loadPartnerSettings();
    }
  }, [profile]);

  useEffect(() => {
    if (contracts.length > 0 && partnerSettings?.fattureincloud_enabled) {
      loadUploadStatuses();
    }
  }, [contracts, partnerSettings]);

  // Reset page when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const fetchContracts = async () => {
    try {
      logger.log('Fetching contracts for user:', profile);

      let query = supabase
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
            location_name,
            vat_percentage
          ),
          bookings (
            id,
            end_date,
            booking_status,
            is_archived
          )
        `)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (isCustomer) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, customer_status')
          .eq('user_id', profile.id)
          .single();

        if (customerData) {
          query = query.eq('customer_id', customerData.id);
          setCustomerStatus(customerData.customer_status);
        }
      } else if (isPartnerAdmin) {
        query = query.eq('partner_uuid', profile.partner_uuid);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching contracts:', error);

        const mockContracts = [
          {
            id: 1,
            contract_uuid: 'mock-contract-1',
            contract_number: 'TECH-MIL-20250107-0001',
            start_date: '2025-01-07',
            end_date: '2025-02-07',
            service_name: 'Hot Desk Monthly',
            service_type: 'abbonamento',
            service_cost: 150.00,
            service_currency: 'EUR',
            location_name: 'Milano Centro',
            location_id: 1,
            resource_name: 'Hot Desks Area A',
            resource_type: 'scrivania',
            contract_status: 'active',
            entries_used: 0,
            service_max_entries: null,
            service_id: 1,
            customer_id: 1,
            partner_uuid: 'test-partner',
            created_at: new Date().toISOString(),
            is_archived: false,
            requires_payment: true,
            payment_terms: 'net_30',
            customers: {
              first_name: 'Mario',
              second_name: 'Rossi',
              email: 'mario.rossi@email.com',
              company_name: null
            }
          },
          {
            id: 2,
            contract_uuid: 'mock-contract-2',
            contract_number: 'TECH-MIL-20250105-0001',
            start_date: '2025-01-05',
            end_date: '2025-04-05',
            service_name: 'Meeting Room Package',
            service_type: 'pacchetto',
            service_cost: 200.00,
            service_currency: 'EUR',
            location_name: 'Milano Centro',
            location_id: 1,
            resource_name: 'Small Meeting Room',
            resource_type: 'sala_riunioni',
            contract_status: 'active',
            entries_used: 3,
            service_max_entries: 10,
            service_id: 2,
            customer_id: 1,
            partner_uuid: 'test-partner',
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            is_archived: false,
            requires_payment: true,
            payment_terms: 'net_30',
            customers: {
              first_name: 'Anna',
              second_name: 'Verdi',
              email: 'anna.verdi@company.com',
              company_name: 'Verdi SRL'
            }
          }
        ];

        setContracts(mockContracts);

        loadPaymentStatuses(mockContracts.map(c => c.id));
      } else {
        const processedContracts = (data || []).map(contract => ({
          ...contract,
          entries_used: parseFloat(contract.entries_used) || 0,
          service_max_entries: contract.service_max_entries ? parseFloat(contract.service_max_entries) : null,
          service_cost: parseFloat(contract.service_cost) || 0
        }));

        setContracts(processedContracts);

        loadPaymentStatuses(processedContracts.map(c => c.id));
      }
    } catch (error) {
      logger.error('Error fetching contracts:', error);
      toast.error(t('messages.errorLoadingContracts'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersAndLocations = async () => {
    try {
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, first_name, second_name, email, company_name')
        .eq('partner_uuid', profile.partner_uuid)
        .eq('customer_status', 'active')
        .order('first_name');

      if (customersError) {
        logger.error('Error fetching customers:', customersError);
      } else {
        setCustomers(customersData || []);
      }

      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('id, location_name')
        .eq('partner_uuid', profile.partner_uuid)
        .order('location_name');

      if (locationsError) {
        logger.error('Error fetching locations:', locationsError);
      } else {
        setLocations(locationsData || []);
      }
    } catch (error) {
      logger.error('Error fetching customers and locations:', error);
    }
  };

  const handleCreateContract = () => {
    if (isCustomer && customerStatus !== 'active') {
      setShowStatusAlert(true);
      return;
    }
    window.location.hash = '/contracts/new';
  };

  const handleEditContract = (contract) => {
    window.location.hash = `/contracts/edit/${contract.id}`;
  };

  const handlePackageBooking = (contract) => {
    logger.log('Opening package booking for contract:', contract);
    setSelectedPackageContract(contract);
    setShowPackageBooking(true);
  };

  const handlePackageBookingClose = () => {
    setShowPackageBooking(false);
    setSelectedPackageContract(null);
  };

  const handlePackageBookingSuccess = async (reservation) => {
    logger.log('Package booking successful:', reservation);

    try {
      if (selectedPackageContract) {
        logger.log('Sending booking confirmation emails...');

        let partnerData = null;
        if (profile?.partner_uuid) {
          try {
            const { data: partner, error: partnerError } = await supabase
              .from('partners')
              .select('company_name, structure_name, email, email_banner_url, first_name, second_name')
              .eq('partner_uuid', profile.partner_uuid)
              .single();

            if (!partnerError && partner) {
              partnerData = partner;
            }
          } catch (error) {
            logger.warn('Could not fetch partner data for email:', error);
          }
        }

        // Generate ICS file content and upload to Supabase Storage
        let calendarLink = null;
        try {
          // Note: reservation is the booking data here
          calendarLink = await generateAndUploadICS(reservation, 'package', profile.partner_uuid);
        } catch (icsError) {
          logger.error('Error generating ICS:', icsError);
        }

        const emailSent = await oneSignalEmailService.sendBookingConfirmation(
          reservation,
          selectedPackageContract,
          t,
          partnerData,
          calendarLink
        );

        if (emailSent) {
          logger.log('✅ Booking confirmation sent');
          toast.success('Email di conferma inviata');
        } else {
          logger.warn('❌ Email not sent');
        }
      }
    } catch (error) {
      logger.error('Error sending booking confirmation emails:', error);
    }

    fetchContracts();
    setShowPackageBooking(false);
    setSelectedPackageContract(null);
  };

  const handleGeneratePDF = async (contract) => {
    setGeneratingPDF(contract.id);

    try {
      logger.log('Generating PDF for contract:', contract);

      let fullCustomerData = contract.customers;

      if (contract.customer_id) {
        logger.log('Fetching customer data for ID:', contract.customer_id);

        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', contract.customer_id)
          .single();

        if (customerError) {
          logger.error('Error fetching customer data:', customerError);
        } else if (customerData) {
          logger.log('Found customer data:', customerData);
          fullCustomerData = customerData;
        } else {
          logger.warn('No customer data found for ID:', contract.customer_id);
        }
      } else {
        logger.warn('No customer_id found in contract:', contract);
      }

      let locationData = null;
      if (contract.location_id) {
        logger.log('Fetching location data for ID:', contract.location_id);

        const { data: locationInfo, error: locationError } = await supabase
          .from('locations')
          .select('*')
          .eq('id', contract.location_id)
          .single();

        if (locationError) {
          logger.error('Error fetching location data:', locationError);
        } else if (locationInfo) {
          logger.log('Found location data:', locationInfo);
          locationData = locationInfo;
        } else {
          logger.warn('No location data found for ID:', contract.location_id);
        }
      } else {
        logger.warn('No location_id found in contract:', contract);
      }

      const enhancedContract = {
        ...contract,
        customers: fullCustomerData,
        location_data: locationData
      };

      logger.log('Enhanced contract with customer and location data:', enhancedContract);

      let partnerData = null;
      let logoUrl = null;

      if (profile?.partner_uuid) {
        const { data: partner, error: partnerError } = await supabase
          .from('partners')
          .select('*')
          .eq('partner_uuid', profile.partner_uuid)
          .single();

        if (!partnerError && partner) {
          partnerData = partner;
        }

        try {
          const { data: files } = await supabase.storage
            .from('partners')
            .list(`${profile.partner_uuid}`, {
              search: 'logo'
            });

          const logoFile = files?.find(file => file.name.startsWith('logo.'));

          if (logoFile) {
            const { data } = supabase.storage
              .from('partners')
              .getPublicUrl(`${profile.partner_uuid}/${logoFile.name}`);

            logoUrl = data.publicUrl;
          }
        } catch (logoError) {
          logger.log('No logo found:', logoError);
        }
      }

      await generateContractPDF(enhancedContract, partnerData, logoUrl, t);

      toast.success(t('contracts.pdfGeneratedSuccessfully') || 'PDF generated successfully!');

    } catch (error) {
      logger.error('Error generating PDF:', error);
      toast.error(t('contracts.errorGeneratingPDF') || 'Error generating PDF. Please try again.');
    } finally {
      setGeneratingPDF(null);
    }
  };

  const handleArchiveContract = (contract) => {
    setContractToArchive(contract);
    setShowArchiveConfirm(true);
  };

  const handleCloseContract = (contract) => {
    setContractToClose(contract);
    setShowCloseConfirm(true);
  };

  const handleCloseConfirm = async () => {
    if (!contractToClose) return;
    setClosing(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ contract_status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', contractToClose.id);

      if (error) throw error;

      await logActivity({
        action_category: 'contract',
        action_type: 'cancelled',
        entity_id: contractToClose.id.toString(),
        entity_type: 'contracts',
        description: `Closed contract ${contractToClose.contract_number} for ${contractToClose.customers?.company_name || `${contractToClose.customers?.first_name} ${contractToClose.customers?.second_name}`}`,
        metadata: {
          contract_number: contractToClose.contract_number,
          customer_id: contractToClose.customer_id,
          service_name: contractToClose.service_name,
          end_date: contractToClose.end_date
        }
      });

      setContracts(prev => prev.map(c =>
        c.id === contractToClose.id ? { ...c, contract_status: 'cancelled' } : c
      ));
      toast.success(t('contracts.contractClosedSuccessfully') || 'Contract closed successfully');
    } catch (err) {
      toast.error(t('contracts.errorClosingContract') || 'Error closing contract');
    } finally {
      setClosing(false);
      setShowCloseConfirm(false);
      setContractToClose(null);
    }
  };

  const handleArchiveConfirm = async () => {
    try {
      const result = await ContractArchiveService.archiveContract(
        contractToArchive.id,
        user.id,
        'Contract archived by user'
      );

      if (result.success) {
        // Log activity
        await logActivity({
          action_category: 'contract',
          action_type: 'deleted',
          entity_id: contractToArchive.id.toString(),
          entity_type: 'contracts',
          description: `Archived contract ${contractToArchive.contract_number} for ${contractToArchive.customers?.company_name || `${contractToArchive.customers?.first_name} ${contractToArchive.customers?.second_name}`}`,
          metadata: {
            contract_number: contractToArchive.contract_number,
            customer_id: contractToArchive.customer_id,
            service_name: contractToArchive.service_name,
            service_type: contractToArchive.service_type,
            location_name: contractToArchive.location_name,
            start_date: contractToArchive.start_date,
            end_date: contractToArchive.end_date,
            archive_reason: 'Contract archived by user'
          }
        });

        setContracts(prev => prev.filter(c => c.id !== contractToArchive.id));
        setShowArchiveConfirm(false);
        setContractToArchive(null);

        toast.success(t('contracts.contractArchivedSuccessfully') || 'Contract archived successfully');
      } else {
        toast.error(result.error || t('contracts.errorArchivingContract') || 'Error archiving contract');
      }
    } catch (error) {
      logger.error('Error archiving contract:', error);
      toast.error(t('contracts.errorArchivingContract') || 'Error archiving contract');
    }
  };

  const handleArchiveCancel = () => {
    setShowArchiveConfirm(false);
    setContractToArchive(null);
  };

  const loadPaymentStatuses = async (contractIds) => {
    try {
      const { data, error } = await PaymentService.getContractPaymentStatus(contractIds);

      if (error) {
        logger.error('Error loading payment statuses:', error);
        return;
      }

      const statusMap = {};
      (data || []).forEach(status => {
        statusMap[status.contract_id] = status;
      });

      setContractPayments(statusMap);
    } catch (error) {
      logger.error('Error loading payment statuses:', error);
    }
  };

  const handleRecordPayment = (contract) => {
    setSelectedContract(contract);
    setPaymentToEdit(null);
    setShowPaymentForm(true);
  };

  const handlePaymentHistory = (contract) => {
    setSelectedContract(contract);
    setShowPaymentHistory(true);
  };

  const handleEditPayment = (payment) => {
    setPaymentToEdit(payment);
    setShowPaymentForm(true);
    setShowPaymentHistory(false);
  };

  const handlePaymentFormClose = () => {
    setShowPaymentForm(false);
    setSelectedContract(null);
    setPaymentToEdit(null);
  };

  const handlePaymentSuccess = async (payment) => {
    setShowPaymentForm(false);

    setTimeout(async () => {
      await fetchContracts();

      if (contracts.length > 0) {
        loadPaymentStatuses(contracts.map(c => c.id));
      }
    }, 500);

    if (paymentToEdit) {
      setShowPaymentHistory(true);
    }
  };

  const handlePaymentHistoryClose = () => {
    setShowPaymentHistory(false);
    setSelectedContract(null);
  };

  const handlePaymentRefresh = () => {
    fetchContracts();
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'expired':
        return 'status-expired';
      case 'cancelled':
        return 'status-cancelled';
      case 'suspended':
        return 'status-suspended';
      default:
        return 'status-inactive';
    }
  };

  const getServiceTypeLabel = (type) => {
    const types = {
      abbonamento: t('services.subscription'),
      pacchetto: t('services.package'),
      free_trial: t('services.freeTrial')
    };
    return types[type] || type;
  };



  const getResourceDisplayName = (contract) => {
    if (contract.resource_name && contract.resource_name !== 'Unknown Resource') {
      return contract.resource_name;
    }

    const resourceTypeNames = {
      'scrivania': t('locations.scrivania'),
      'sala_riunioni': t('locations.salaRiunioni')
    };

    return resourceTypeNames[contract.resource_type] || t('services.resource');
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

  const calculateContractDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isDateInContractRange = (startDate, endDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return today <= end;
  };

  const canBookPackage = (contract) => {
    if (contract.service_type !== 'pacchetto') return false;
    if (contract.contract_status !== 'active') return false;
    if (!isDateInContractRange(contract.start_date, contract.end_date)) return false;

    const remainingEntries = (contract.service_max_entries || 0) - (contract.entries_used || 0);
    return remainingEntries >= 0.5;
  };

  const getBookButtonText = (contract) => {
    const remainingEntries = (contract.service_max_entries || 0) - (contract.entries_used || 0);
    const canBook = canBookPackage(contract);

    if (canBook) {
      return t('reservations.bookReservation');
    } else if (remainingEntries < 0.5) {
      return t('reservations.noEntriesRemaining') || 'No Entries';
    } else if (new Date() > new Date(contract.end_date)) {
      return t('contracts.expired') || 'Expired';
    } else {
      return t('reservations.cannotBook') || 'Not Available';
    }
  };

  const getPaymentStatus = (contract) => {
    if (contract.service_type === 'free_trial' || !contract.requires_payment) {
      return 'not_required';
    }

    const paymentInfo = contractPayments[contract.id];
    if (!paymentInfo) {
      return 'unpaid';
    }

    return paymentInfo.payment_status;
  };

  const getPaymentStatusBadgeClass = (status) => {
    const classes = {
      paid: 'payment-status-paid',
      unpaid: 'payment-status-unpaid',
      partial: 'payment-status-partial',
      overdue: 'payment-status-overdue',
      not_required: 'payment-status-not-required'
    };
    return classes[status] || 'payment-status-default';
  };

  const isPaymentOverdue = (contract) => {
    const paymentInfo = contractPayments[contract.id];
    return paymentInfo?.is_overdue || false;
  };

  const getNextDueDate = (contract) => {
    const paymentInfo = contractPayments[contract.id];
    return paymentInfo?.next_due_date;
  };

  const showContractDetails = (contract, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const panelWidth = 300;
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 16);
    const below = rect.bottom + 6;
    // Open above the cell when there's no room below
    const top = below + 260 > window.innerHeight ? Math.max(8, rect.top - 266) : below;
    setDetailsHover({ contract, top, left });
  };

  const hideContractDetails = () => setDetailsHover(null);

  const getContractDetailRows = (contract) => {
    const rows = [];
    if (contract.resource_name || contract.resource_type) {
      rows.push([t('services.resource') || 'Risorsa', `📍 ${getResourceDisplayName(contract)}`]);
    }
    rows.push([t('contracts.period') || 'Periodo', `${formatDate(contract.start_date)} → ${formatDate(contract.end_date)}`]);
    rows.push([t('contracts.duration') || 'Durata', `${calculateContractDuration(contract.start_date, contract.end_date)} ${t('contracts.days')}`]);
    if (contract.service_type === 'pacchetto' && contract.service_max_entries) {
      const used = contract.entries_used || 0;
      rows.push([t('contracts.entriesUsed') || 'Ingressi utilizzati', `${used} / ${contract.service_max_entries}`]);
      rows.push([t('reservations.entriesRemaining') || 'Ingressi rimanenti', `${contract.service_max_entries - used}`]);
    }
    if (contract.service_type === 'abbonamento' && contract.is_renewable !== false) {
      rows.push([t('contracts.autoRenew') || 'Rinnovo automatico', contract.auto_renew ? '✓' : '—']);
      rows.push([t('contracts.renewals') || 'Rinnovi', `${contract.renewal_count || 0}`]);
    }
    const nextDue = getNextDueDate(contract);
    const paymentStatus = getPaymentStatus(contract);
    if (nextDue && paymentStatus !== 'paid' && paymentStatus !== 'not_required') {
      rows.push([t('contracts.nextDueDate') || 'Scadenza pagamento', formatDate(nextDue)]);
    }
    return rows;
  };

  // Partner admin turns a subscription's automatic renewal on/off
  const handleToggleAutoRenew = async (contract) => {
    const newValue = !contract.auto_renew;
    setUpdatingAutoRenew(prev => ({ ...prev, [contract.id]: true }));
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ auto_renew: newValue, updated_at: new Date().toISOString() })
        .eq('id', contract.id);
      if (error) throw error;

      const apply = list => list.map(c => (c.id === contract.id ? { ...c, auto_renew: newValue } : c));
      setContracts(apply);
      setFilteredContracts(apply);
      toast.success(newValue
        ? (t('contracts.autoRenewEnabled') || 'Automatic renewal enabled')
        : (t('contracts.autoRenewDisabled') || 'Automatic renewal disabled'));
    } catch (error) {
      logger.error('Error updating auto-renew:', error);
      toast.error(t('contracts.autoRenewUpdateError') || 'Error updating automatic renewal');
    } finally {
      setUpdatingAutoRenew(prev => ({ ...prev, [contract.id]: false }));
    }
  };

  const handleExportCSV = async () => {
    if (!isPartnerAdmin && !isSuperAdmin) {
      toast.error(t('contracts.exportNotAllowed') || 'Export non consentito');
      return;
    }

    const contractsToExport = filteredContracts.length > 0 ? filteredContracts : contracts;

    if (contractsToExport.length === 0) {
      toast.error(t('contracts.noContractsToExport') || 'Nessun contratto da esportare');
      return;
    }

    setExportingCSV(true);

    try {
      const csvContent = await CSVExportService.exportContractsToCSV(contractsToExport, t);
      const filename = CSVExportService.generateFilename();
      CSVExportService.downloadCSV(csvContent, filename);

      toast.success(t('contracts.csvExportedSuccessfully') || 'Export CSV completato con successo');

    } catch (error) {
      logger.error('Error exporting CSV:', error);
      toast.error(t('contracts.errorExportingCSV') || 'Errore durante l\'export CSV. Riprova.');
    } finally {
      setExportingCSV(false);
    }
  };

  if (loading) {
    return <div className="contracts-loading">{t('common.loading')}</div>;
  }

  // Pagination logic
  const baseContracts = filteredContracts.length >= 0 ? filteredContracts : contracts;
  const displayFilter = (onlyNeedsResource
    ? baseContracts.filter(c =>
        Array.isArray(c.bookings) &&
        c.bookings.some(b => b.booking_status === 'active' && !b.is_archived && b.end_date < c.end_date)
      )
    : baseContracts
  ).filter(c => !onlyAutoRenew || (c.service_type === 'abbonamento' && c.auto_renew));
  const totalContractsCount = displayFilter.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const contractsToDisplayTotal = displayFilter;
  const contractsToDisplay = contractsToDisplayTotal.slice(startIndex, endIndex);



  return (
    <div className={`contracts-page ${isCustomer ? 'contracts-page-customer' : ''}`}>

      <div className="contracts-header">
        <div className="contracts-header-top">
          <div className="contracts-title-section">
            <h1 className="contracts-title">
              <FileText size={24} className="mr-2" />
              {t('contracts.title')}
            </h1>
            <p className="contracts-description">
              {isCustomer
                ? t('contracts.manageYourContracts')
                : t('contracts.managePartnerContracts')
              }
            </p>
          </div>

          {canCreateContracts && (
            <div className="contracts-header-actions">
              <button className="add-contract-btn" onClick={handleCreateContract}>
                <Plus size={16} className="mr-2" />
                {t('contracts.createContract')}
              </button>

              {(isPartnerAdmin || isSuperAdmin) && (
                <button
                  className="export-csv-btn"
                  onClick={handleExportCSV}
                  disabled={exportingCSV || contractsToDisplay.length === 0}
                  title={t('contracts.exportToCSV') || 'Esporta in CSV'}
                >
                  <Download size={16} className="mr-2" />
                  {exportingCSV
                    ? (t('contracts.exporting') || 'Esportazione...')
                    : (t('contracts.exportCSV') || 'Esporta CSV')
                  }
                </button>
              )}

              <button
                className="archived-contracts-btn"
                onClick={() => window.location.hash = '/archived-contracts'}
                title={t('contracts.viewArchivedContracts') || 'View Archived Contracts'}
              >
                <Archive size={16} className="mr-2" />
                {t('contracts.archivedContracts') || 'Archived Contracts'}
              </button>

              {(isCustomer || isPartnerAdmin || isSuperAdmin) && (
                <button
                  className="archived-contracts-btn"
                  onClick={() => setShowFilters(!showFilters)}
                  title={showFilters ? (t('filters.hideFilters') || 'Hide Filters') : (t('filters.showFilters') || 'Show Filters')}
                >
                  <Filter size={16} className="mr-2" />
                  {showFilters ? (t('filters.hideFilters') || 'Nascondi Filtri') : (t('filters.showFilters') || 'Mostra Filtri')}
                </button>
              )}

              {partnerSettings?.fattureincloud_enabled && (isPartnerAdmin || isSuperAdmin) && (
                <button
                  className="bulk-upload-btn"
                  onClick={handleBulkUpload}
                  disabled={contractsToDisplay.length === 0}
                  title="Upload to FattureInCloud"
                >
                  <Upload size={16} className="mr-2" />
                  Upload F.C.
                </button>
              )}

              {(isPartnerAdmin || isSuperAdmin) && (
                <button
                  className="renewal-logs-btn"
                  onClick={() => window.location.hash = '/renewal-logs'}
                  title={t('renewalLogs.viewRenewalLogs') || 'View Renewal Logs'}
                >
                  <RefreshCw size={16} className="mr-2" />
                  {t('renewalLogs.renewalLogs') || 'Renewal Logs'}
                </button>
              )}
            </div>
          )}
        </div>

        {!isCustomer && (
          <div className="contracts-stats">
            <div className="stat-item">
              <span className="stat-label">{t('contracts.totalContracts')}</span>
              <span className="stat-value">{contractsToDisplay.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('contracts.activeContracts')}</span>
              <span className="stat-value">
                {contractsToDisplay.filter(c => c.contract_status === 'active').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('contracts.expiredContracts')}</span>
              <span className="stat-value">
                {contractsToDisplay.filter(c => c.contract_status === 'expired').length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('contracts.cancelledContracts') || 'Cancelled'}</span>
              <span className="stat-value">
                {contractsToDisplay.filter(c => c.contract_status === 'cancelled').length}
              </span>
            </div>
            {(
              <div className="stat-item">
                <span className="stat-label">{t('payments.outstanding')}</span>
                <span className="stat-value">
                  {contractsToDisplay.filter(c => {
                    const status = getPaymentStatus(c);
                    return status === 'unpaid' || status === 'partial' || status === 'overdue';
                  }).length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>


      {showFilters && (
        <ContractsFilter
          contracts={contracts}
          customers={customers}
          locations={locations}
          onFilterChange={handleFilterChange}
          isCustomerMode={isCustomer}
          canManagePayments={canManagePayments}
          contractPayments={contractPayments}
          getPaymentStatus={getPaymentStatus}
        />
      )}

      {Object.values(activeFilters).some(value => value !== '') && (
        <div className="filter-results-info">
          <span className="filter-results-count">
            {t('filters.showingResults', {
              count: contractsToDisplay.length,
              total: contracts.length
            }) || `Showing ${contractsToDisplay.length} of ${contracts.length} contracts`}
          </span>
        </div>
      )}

      {!isCustomer && (
        <label className="filter-chip">
          <input
            type="checkbox"
            checked={onlyNeedsResource}
            onChange={(e) => {
              setOnlyNeedsResource(e.target.checked);
              setCurrentPage(1);
            }}
          />
          <AlertTriangle size={14} />
          {t('contracts.needsResourceReassignment') || 'Needs resource reassignment'}
        </label>
      )}

      {!isCustomer && (
        <label className="filter-chip">
          <input
            type="checkbox"
            checked={onlyAutoRenew}
            onChange={(e) => {
              setOnlyAutoRenew(e.target.checked);
              setCurrentPage(1);
            }}
          />
          <RefreshCw size={14} />
          {t('contracts.onlyAutoRenew') || 'Automatic renewal only'}
        </label>
      )}

      <div className="contracts-mobile-list">
        {contractsToDisplay.map((contract) => {
          const service = contract.services;
          const customer = contract.customers;
          const location = contract.locations;
          const paymentStatus = getPaymentStatus(contract);
          const activeS = contract.contract_status === 'active';

          return (
            <div key={contract.id} className="contract-card">
              <div className="contract-card-header">
                <div className="contract-card-title">
                  <span className="contract-number">{contract.contract_number}</span>
                  <span className={`status-badge status-${contract.contract_status}`}>
                    {t(`contracts.${contract.contract_status}`) || contract.contract_status}
                  </span>
                </div>
                {(
                  <span className={`payment-status-badge payment-status-${paymentStatus}`}>
                    {t(`payments.status.${paymentStatus}`) || paymentStatus}
                  </span>
                )}
              </div>

              <div className="contract-card-body">
                {!isCustomer && (
                  <div className="contract-card-row">
                    <span className="card-label">{t('contracts.customer')}:</span>
                    <div className="customer-info" style={{ alignItems: 'flex-end' }}>
                      <span className="customer-name">{customer?.first_name} {customer?.second_name}</span>
                      {customer?.email && <span className="customer-email">{customer.email}</span>}
                    </div>
                  </div>
                )}

                <div className="contract-card-row">
                  <span className="card-label">{t('contracts.service')}:</span>
                  <div className="service-info" style={{ alignItems: 'flex-end' }}>
                    <div className="service-header" style={{ justifyContent: 'flex-end' }}>
                      <span className="service-name">{service?.service_name}</span>
                      <span className={`service-type-badge service-type-${service?.service_type}`}>
                        {service?.service_type}
                      </span>
                    </div>
                    {(contract.resource_name || contract.resource_type) && (
                      <span className="service-resource" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        📍 {getResourceDisplayName(contract)}
                      </span>
                    )}
                    {/* Simplified service details for mobile */}
                    {service?.service_type === 'pacchetto' && (
                      <span className="remaining-entries">
                        {contract.remaining_entries}/{service.max_entries} {t('contracts.entries')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="contract-card-row">
                  <span className="card-label">{t('contracts.period')}:</span>
                  <div className="period-info" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
                    <span className="period-dates">
                      {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                    </span>
                    <span className={`days-remaining ${calculateDaysRemaining(contract.end_date) < 7 && activeS ? 'warning' : ''}`}>
                      {calculateDaysRemaining(contract.end_date)} {t('contracts.daysRemaining')}
                    </span>
                  </div>
                </div>

                <div className="contract-card-row">
                  <span className="card-label">{t('contracts.cost')}:</span>
                  <div className="cost-status-info" style={{ alignItems: 'flex-end' }}>
                    <span className="cost-info">
                      {formatCurrency(contract.service_cost, contract.service_currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="contract-card-actions">
                {/* Booking Action - Only for Packages in Range */}
                {canBookPackage(contract) && (
                  <button
                    className="action-btn package-booking-btn"
                    onClick={() => handlePackageBooking(contract)}
                    title={t('reservations.bookReservation')}
                  >
                    <Calendar size={18} />
                    <span>{t('reservations.bookReservation') || 'Prenota'}</span>
                  </button>
                )}

                {/* PDF Action - Always available */}
                <button
                  className="action-btn pdf-btn"
                  onClick={() => handleGeneratePDF(contract)}
                  disabled={generatingPDF === contract.id}
                  title={t('contracts.downloadPDF')}
                >
                  {generatingPDF === contract.id ? (
                    <div className="loading-spinner-small"></div>
                  ) : (
                    <Download size={18} />
                  )}
                  <span>{t('contracts.actions.downloadPDF') || 'Scarica PDF'}</span>
                </button>

                {/* Admin Actions (Edit/View) - Hidden for User */}
                {isPartnerAdmin && (
                  <button
                    className="action-btn edit-btn"
                    onClick={() => handleEditContract(contract)}
                    title={t('common.edit')}
                  >
                    <Edit2 size={20} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="contracts-table-container hide-on-mobile">
        <div className="contracts-table-wrapper">
          <table className="contracts-table">
            <thead className="contracts-table-head">
              <tr>
                <th className="contracts-table-header cliente-column">
                  {isCustomer ? t('contracts.contract') : t('contracts.customer')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.service')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.period')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.cost')}
                </th>
                {(
                  <th className="contracts-table-header">
                    {t('payments.paymentStatus')}
                  </th>
                )}
                <th className="contracts-table-header">
                  {t('contracts.actionsColumn')}
                </th>
              </tr>
            </thead>
            <tbody className="contracts-table-body">
              {contractsToDisplay.map((contract) => {
                const daysRemaining = calculateDaysRemaining(contract.end_date);
                const isInRange = isDateInContractRange(contract.start_date, contract.end_date);
                const canBook = canBookPackage(contract);
                const paymentStatus = getPaymentStatus(contract);
                const isOverdue = isPaymentOverdue(contract);
                const nextDue = getNextDueDate(contract);

                return (
                  <tr key={contract.id} className="contracts-table-row">
                    <td className="contracts-table-cell cliente-column">
                      {!isCustomer && (
                        <div className="contract-cell-main">
                          {`${contract.customers?.first_name || ''} ${contract.customers?.second_name || ''}`.trim()}
                          {contract.customers?.company_name && (
                            <span className="contract-cell-company"> · {contract.customers.company_name}</span>
                          )}
                        </div>
                      )}
                      <div className={isCustomer ? 'contract-cell-main contract-cell-code' : 'contract-cell-sub'}>
                        <span className="contract-cell-code">{contract.contract_number}</span>
                        <span className={`status-badge status-badge-sm ${getStatusBadgeClass(contract.contract_status)}`}>
                          {t(`contracts.${contract.contract_status}`)}
                        </span>
                      </div>
                    </td>
                    <td
                      className="contracts-table-cell contract-cell-hover"
                      onMouseEnter={(e) => showContractDetails(contract, e)}
                      onMouseLeave={hideContractDetails}
                    >
                      <div className="contract-cell-main">{contract.service_name}</div>
                      <div className="contract-cell-sub">
                        <span>{getServiceTypeLabel(contract.service_type)}</span>
                        {contract.service_type === 'pacchetto' && contract.service_max_entries && (
                          <span className={(contract.service_max_entries - (contract.entries_used || 0)) <= 2 ? 'contract-cell-warning' : ''}>
                            · {contract.service_max_entries - (contract.entries_used || 0)}/{contract.service_max_entries} {t('contracts.entriesShort') || 'ingressi'}
                          </span>
                        )}
                        {contract.service_type === 'abbonamento' && contract.is_renewable !== false && (
                          <button
                            type="button"
                            className={`auto-renew-icon ${contract.auto_renew ? 'on' : 'off'}`}
                            disabled={!isPartnerAdmin || updatingAutoRenew[contract.id]}
                            onClick={(e) => { e.stopPropagation(); handleToggleAutoRenew(contract); }}
                            title={contract.auto_renew
                              ? (t('contracts.autoRenewOn') || 'Automatic renewal on')
                              : (t('contracts.autoRenewOff') || 'Automatic renewal off')}
                            aria-label={t('contracts.autoRenew') || 'Automatic renewal'}
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td
                      className="contracts-table-cell contract-cell-hover"
                      onMouseEnter={(e) => showContractDetails(contract, e)}
                      onMouseLeave={hideContractDetails}
                    >
                      <div className="contract-cell-main contract-cell-dates">
                        {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
                      </div>
                      <div className="contract-cell-sub">
                        {contract.contract_status === 'active' && isInRange ? (
                          <span className={daysRemaining <= 7 ? 'contract-cell-warning' : 'contract-cell-ok'}>
                            {daysRemaining > 0
                              ? `${daysRemaining} ${t('contracts.daysRemaining')}`
                              : t('contracts.expired')}
                          </span>
                        ) : (
                          <span>{calculateContractDuration(contract.start_date, contract.end_date)} {t('contracts.days')}</span>
                        )}
                      </div>
                    </td>
                    <td className="contracts-table-cell">
                      <div className="cost-info">
                        {formatCurrency(contract.service_cost, contract.service_currency)}
                      </div>
                    </td>
                    <td className="contracts-table-cell">
                      <span className={`payment-status-badge status-badge-sm ${getPaymentStatusBadgeClass(paymentStatus)} ${isOverdue ? 'overdue' : ''}`}>
                        {isOverdue && <AlertTriangle size={11} className="overdue-icon" />}
                        {t(`payments.status.${paymentStatus}`)}
                      </span>
                      {nextDue && paymentStatus !== 'paid' && paymentStatus !== 'not_required' && (
                        <div className={`contract-cell-sub ${isOverdue ? 'contract-cell-warning' : ''}`}>
                          {t('contracts.dueShort') || 'scade'} {formatDate(nextDue)}
                        </div>
                      )}
                    </td>
                    <ContractActionsCell
                      contract={contract}
                      openDropdownId={openDropdownId}
                      setOpenDropdownId={setOpenDropdownId}
                      canManagePayments={canManagePayments}
                      canEditContracts={canEditContracts}
                      isPartnerAdmin={isPartnerAdmin}
                      isSuperAdmin={isSuperAdmin}
                      generatingPDF={generatingPDF}
                      onGeneratePDF={handleGeneratePDF}
                      onRecordPayment={handleRecordPayment}
                      onPaymentHistory={handlePaymentHistory}
                      onEditContract={handleEditContract}
                      onPackageBooking={handlePackageBooking}
                      onDeleteContract={handleArchiveContract}
                      onCloseContract={handleCloseContract}
                      canBookPackage={canBookPackage}
                      getBookButtonText={getBookButtonText}
                      isInRange={isInRange}
                      t={t}
                    />
                  </tr>
                );
              })}
            </tbody>
          </table>
          {detailsHover && (
            <div
              className="contract-details-tooltip"
              style={{ top: detailsHover.top, left: detailsHover.left }}
              role="tooltip"
            >
              <div className="contract-details-title">
                {detailsHover.contract.service_name}
                <span className="contract-cell-code"> · {detailsHover.contract.contract_number}</span>
              </div>
              <dl>
                {getContractDetailRows(detailsHover.contract).map(([label, value]) => (
                  <div key={label} className="contract-details-row">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {contractsToDisplay.length === 0 && (
            <div className="contracts-empty">
              <FileText size={48} className="empty-icon" />
              <p>
                {Object.values(activeFilters).some(value => value !== '')
                  ? t('filters.noResultsFound') || 'No contracts found matching your filters'
                  : t('contracts.noContractsFound')
                }
              </p>
              {canCreateContracts && !Object.values(activeFilters).some(value => value !== '') && (
                <button
                  onClick={handleCreateContract}
                  className="add-contract-btn mt-4"
                >
                  {t('contracts.createFirstContract')}
                </button>
              )}
              {Object.values(activeFilters).some(value => value !== '') && (
                <button
                  onClick={() => {
                    setActiveFilters({});
                    setFilteredContracts(contracts);
                  }}
                  className="btn-secondary mt-4"
                >
                  {t('filters.clearFilters') || 'Clear Filters'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Pagination
        totalItems={totalContractsCount}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* ContractForm modals removed */}

      <PackageBookingForm
        isOpen={showPackageBooking}
        onClose={handlePackageBookingClose}
        onSuccess={handlePackageBookingSuccess}
        contract={selectedPackageContract}
      />

      {showCloseConfirm && contractToClose && (
        <div className="modal-overlay">
          <div className="modal-container archive-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('contracts.confirmClose') || 'Close Contract'}
              </h2>
              <button onClick={() => { setShowCloseConfirm(false); setContractToClose(null); }} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="archive-modal-content" style={{ padding: '1.5rem' }}>
              <div className="archive-warning">
                <XCircle size={24} className="warning-icon" style={{ color: '#ef4444' }} />
                <div className="warning-text">
                  <h3>{t('contracts.closeContractTitle') || 'Close this contract?'}</h3>
                  <p>{t('contracts.closeContractWarning') || 'The contract will be marked as cancelled and remain visible in the contracts list. This action cannot be undone.'}</p>
                </div>
              </div>

              <div className="contract-to-archive" style={{ marginTop: '1rem' }}>
                <div className="contract-detail">
                  <strong>{t('contracts.contract')}:</strong> {contractToClose.contract_number}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.customer')}:</strong> {contractToClose.customers?.company_name ||
                    `${contractToClose.customers?.first_name} ${contractToClose.customers?.second_name}`}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.service')}:</strong> {contractToClose.service_name}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.period')}:</strong> {formatDate(contractToClose.start_date)} - {formatDate(contractToClose.end_date)}
                </div>
              </div>

              <div className="archive-info-note" style={{ marginTop: '1rem' }}>
                <h4>{t('contracts.closeNoteTitle') || 'What happens when you close:'}</h4>
                <ul>
                  <li>{t('contracts.closeNote1') || 'Contract status changes to Cancelled'}</li>
                  <li>{t('contracts.closeNote2') || 'Contract stays visible (not archived)'}</li>
                  <li>{t('contracts.closeNote3') || 'If this is the customer\'s last active contract, WiFi access and door code are automatically removed'}</li>
                </ul>
              </div>

              <div className="archive-modal-actions" style={{
                display: 'flex', justifyContent: 'flex-end',
                gap: '0.75rem', marginTop: '1.5rem',
                paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  onClick={() => { setShowCloseConfirm(false); setContractToClose(null); }}
                  className="btn-secondary"
                  disabled={closing}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseConfirm}
                  disabled={closing}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', background: '#ef4444', border: 'none',
                    borderRadius: '0.375rem', color: 'white', fontSize: '0.875rem',
                    fontWeight: 500, cursor: closing ? 'not-allowed' : 'pointer',
                    opacity: closing ? 0.6 : 1
                  }}
                >
                  <XCircle size={15} />
                  {closing ? (t('common.saving') || 'Closing…') : (t('contracts.closeContract') || 'Close Contract')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchiveConfirm && contractToArchive && (
        <div className="modal-overlay">
          <div className="modal-container archive-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('contracts.confirmArchive') || 'Confirm Archive'}
              </h2>
              <button onClick={handleArchiveCancel} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="archive-modal-content" style={{ padding: '1.5rem' }}>
              <div className="archive-warning">
                <Archive size={24} className="warning-icon" />
                <div className="warning-text">
                  <h3>{t('contracts.archiveContract') || 'Archive Contract'}</h3>
                  <p>{t('contracts.archiveContractWarning') || 'This will archive the contract and move it to the archived contracts section. The contract can be restored later if needed.'}</p>
                </div>
              </div>

              <div className="contract-to-archive">
                <div className="contract-detail">
                  <strong>{t('contracts.contract')}:</strong> {contractToArchive.contract_number}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.customer')}:</strong> {contractToArchive.customers?.company_name ||
                    `${contractToArchive.customers?.first_name} ${contractToArchive.customers?.second_name}`}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.service')}:</strong> {contractToArchive.service_name}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.period')}:</strong> {formatDate(contractToArchive.start_date)} - {formatDate(contractToArchive.end_date)}
                </div>
              </div>

              <div className="archive-info-note">
                <h4>{t('contracts.archiveNoteTitle') || 'What happens when you archive:'}</h4>
                <ul>
                  <li>{t('contracts.archiveNote1') || 'Contract will be moved to archived contracts'}</li>
                  <li>{t('contracts.archiveNote2') || 'Related bookings and reservations will be preserved'}</li>
                  <li>{t('contracts.archiveNote3') || 'Contract can be restored at any time'}</li>
                  <li>{t('contracts.archiveNote4') || 'No data will be permanently lost'}</li>
                </ul>
              </div>

              <div className="archive-modal-actions" style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  onClick={handleArchiveCancel}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleArchiveConfirm}
                  className="btn-archive"
                  style={{
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <Archive size={16} className="mr-2" />
                  {t('contracts.confirmArchive') || 'Archive Contract'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PaymentForm
        isOpen={showPaymentForm}
        onClose={handlePaymentFormClose}
        onSuccess={handlePaymentSuccess}
        contract={selectedContract}
        editMode={!!paymentToEdit}
        paymentToEdit={paymentToEdit}
      />

      <PaymentHistoryModal
        isOpen={showPaymentHistory}
        onClose={handlePaymentHistoryClose}
        contract={selectedContract}
        onEditPayment={handleEditPayment}
        onRefresh={handlePaymentRefresh}
      />

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={handleBulkUploadClose}
        contracts={contractsToDisplay}
        partnerSettings={partnerSettings}
        uploadStatuses={uploadStatuses}
        partnerUuid={profile?.partner_uuid}
      />
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

export default Contracts;