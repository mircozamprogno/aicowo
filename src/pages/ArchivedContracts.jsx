// src/pages/ArchivedContracts.jsx
import { Archive, Download, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { ContractArchiveService } from '../services/contractArchiveService';
import { generateContractPDF } from '../services/pdfGenerator';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

const ArchivedContracts = () => {
  const [archivedContracts, setArchivedContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [contractToRestore, setContractToRestore] = useState(null);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [contractToDelete, setContractToDelete] = useState(null);
  const [deleteStep, setDeleteStep] = useState(1); // Add delete step for double confirmation
  const [generatingPDF, setGeneratingPDF] = useState(null);
  const [archiveAnalytics, setArchiveAnalytics] = useState(null);
  
  const { profile, user } = useAuth();
  const { t } = useTranslation();

  const isCustomer = profile?.role === 'user';
  const isPartnerAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'superadmin';
  const canRestore = isPartnerAdmin || isSuperAdmin;

  useEffect(() => {
    if (profile) {
      fetchArchivedContracts();
      if (isPartnerAdmin) {
        fetchArchiveAnalytics();
      }
    }
  }, [profile]);

  const fetchArchivedContracts = async () => {
    setLoading(true);
    try {
      const result = await ContractArchiveService.getArchivedContracts(
        profile?.partner_uuid,
        profile?.role,
        user?.id
      );

      if (result.success) {
        setArchivedContracts(result.data);
      } else {
        logger.error('Error fetching archived contracts:', result.error);
        toast.error(t('messages.errorLoadingContracts'));
        setArchivedContracts([]);
      }
    } catch (error) {
      logger.error('Error fetching archived contracts:', error);
      toast.error(t('messages.errorLoadingContracts'));
      setArchivedContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchiveAnalytics = async () => {
    if (!profile?.partner_uuid) return;

    try {
      const result = await ContractArchiveService.getArchiveAnalytics(profile.partner_uuid);
      if (result.success) {
        setArchiveAnalytics(result.data);
      }
    } catch (error) {
      logger.error('Error fetching archive analytics:', error);
    }
  };

  const handleRestore = (contract) => {
    setContractToRestore(contract);
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    if (!contractToRestore || !canRestore) return;

    try {
      const result = await ContractArchiveService.restoreContract(
        contractToRestore.id,
        user.id
      );

      if (result.success) {
        toast.success(t('contracts.contractRestoredSuccessfully') || 'Contract restored successfully');
        setArchivedContracts(prev => prev.filter(c => c.id !== contractToRestore.id));
        if (archiveAnalytics) {
          fetchArchiveAnalytics(); // Refresh analytics
        }
      } else {
        toast.error(result.error || t('contracts.errorRestoringContract') || 'Error restoring contract');
      }
    } catch (error) {
      logger.error('Error restoring contract:', error);
      toast.error(t('contracts.errorRestoringContract') || 'Error restoring contract');
    } finally {
      setShowRestoreConfirm(false);
      setContractToRestore(null);
    }
  };

  const handlePermanentDelete = (contract) => {
    setContractToDelete(contract);
    setDeleteStep(1); // Start with step 1
    setShowPermanentDeleteConfirm(true);
  };

  const handlePermanentDeleteConfirm = async () => {
    if (deleteStep === 1) {
      // Move to step 2 (final confirmation)
      setDeleteStep(2);
      return;
    }

    // Step 2 - Actually delete
    if (!contractToDelete) return;

    try {
      // First delete related package reservations
      const { error: reservationsError } = await supabase
        .from('package_reservations')
        .delete()
        .eq('contract_id', contractToDelete.id);

      if (reservationsError) {
        logger.error('Error deleting package reservations:', reservationsError);
      }

      // Then delete related bookings
      const { error: bookingsError } = await supabase
        .from('bookings')
        .delete()
        .eq('contract_id', contractToDelete.id);

      if (bookingsError) {
        logger.error('Error deleting bookings:', bookingsError);
      }

      // Finally delete the contract
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractToDelete.id);

      if (error) {
        logger.error('Error permanently deleting contract:', error);
        toast.error(t('contracts.errorDeletingContract') || 'Error deleting contract permanently');
        return;
      }

      setArchivedContracts(prev => prev.filter(c => c.id !== contractToDelete.id));
      toast.success(t('contracts.contractDeletedPermanently') || 'Contract deleted permanently');
      
      if (archiveAnalytics) {
        fetchArchiveAnalytics(); // Refresh analytics
      }
    } catch (error) {
      logger.error('Error permanently deleting contract:', error);
      toast.error(t('contracts.errorDeletingContract') || 'Error deleting contract permanently');
    } finally {
      setShowPermanentDeleteConfirm(false);
      setContractToDelete(null);
      setDeleteStep(1); // Reset to step 1
    }
  };

  const handlePermanentDeleteCancel = () => {
    setShowPermanentDeleteConfirm(false);
    setContractToDelete(null);
    setDeleteStep(1); // Reset to step 1
  };

  const handleGeneratePDF = async (contract) => {
    setGeneratingPDF(contract.id);
    
    try {
      // Fetch complete customer data with address information
      let fullCustomerData = contract.customers;
      
      if (contract.customer_id) {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', contract.customer_id)
          .single();
        
        if (!customerError && customerData) {
          fullCustomerData = customerData;
        }
      }
      
      // Create enhanced contract object with full customer data
      const enhancedContract = {
        ...contract,
        customers: fullCustomerData
      };
      
      // Fetch partner data for PDF header
      let partnerData = null;
      let logoUrl = null;
      
      if (profile?.partner_uuid) {
        const { data: partner } = await supabase
          .from('partners')
          .select('*')
          .eq('partner_uuid', profile.partner_uuid)
          .single();
        
        if (partner) {
          partnerData = partner;
        }
        
        // Get partner logo
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

      // Generate PDF with enhanced data
      await generateContractPDF(enhancedContract, partnerData, logoUrl, t);
      
      toast.success(t('contracts.pdfGeneratedSuccessfully') || 'PDF generated successfully!');
      
    } catch (error) {
      logger.error('Error generating PDF:', error);
      toast.error(t('contracts.errorGeneratingPDF') || 'Error generating PDF. Please try again.');
    } finally {
      setGeneratingPDF(null);
    }
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

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT');
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

  const getServiceTypeBadgeClass = (type) => {
    const classes = {
      abbonamento: 'service-type-subscription',
      pacchetto: 'service-type-package',
      free_trial: 'service-type-trial'
    };
    return classes[type] || 'service-type-default';
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

  if (loading) {
    return <div className="contracts-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="archived-contracts-page">
      <div className="archived-contracts-header">
        <div className="archived-contracts-header-content">
          <h1 className="archived-contracts-title">
            <Archive size={24} className="mr-2" />
            {t('contracts.archivedContracts') || 'Archived Contracts'}
          </h1>
          <p className="archived-contracts-description">
            {isCustomer 
              ? (t('contracts.manageYourArchivedContracts') || 'View your archived service contracts')
              : (t('contracts.managePartnerArchivedContracts') || 'Manage archived contracts for your partner customers')
            }
          </p>
          
          {/* Archive Analytics for Admins */}
          {archiveAnalytics && isPartnerAdmin && (
            <div className="archive-stats">
              <div className="stat-item">
                <span className="stat-label">{t('contracts.totalArchived') || 'Total Archived'}</span>
                <span className="stat-value">{archiveAnalytics.totalArchived}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('contracts.archivedThisMonth') || 'This Month'}</span>
                <span className="stat-value">{archiveAnalytics.archivedThisMonth}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('contracts.archivedThisYear') || 'This Year'}</span>
                <span className="stat-value">{archiveAnalytics.archivedThisYear}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('contracts.totalArchivedValue') || 'Total Value'}</span>
                <span className="stat-value">{formatCurrency(archiveAnalytics.totalArchivedValue)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="archived-contracts-table-container">
        <div className="archived-contracts-table-wrapper">
          <table className="contracts-table">
            <thead className="contracts-table-head">
              <tr>
                <th className="contracts-table-header">
                  {t('contracts.contract')}
                </th>
                {!isCustomer && (
                  <th className="contracts-table-header">
                    {t('contracts.customer')}
                  </th>
                )}
                <th className="contracts-table-header">
                  {t('contracts.service')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.location')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.period')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.cost')}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.archivedInfo') || 'Archived Info'}
                </th>
                <th className="contracts-table-header">
                  {t('contracts.actionsColumn')}
                </th>
              </tr>
            </thead>
            <tbody className="contracts-table-body">
              {archivedContracts.map((contract) => (
                <tr key={contract.id} className="contracts-table-row archived-row">
                  <td className="contracts-table-cell">
                    <div className="contract-info">
                      <div className="contract-number">{contract.contract_number}</div>
                      <div className="contract-created">
                        {t('common.createdAt')}: {formatDate(contract.created_at)}
                      </div>
                    </div>
                  </td>
                  {!isCustomer && (
                    <td className="contracts-table-cell">
                      <div className="customer-info">
                        <div className="customer-name">
                          {contract.customers?.company_name || 
                           `${contract.customers?.first_name} ${contract.customers?.second_name}`}
                        </div>
                        <div className="customer-email">{contract.customers?.email}</div>
                      </div>
                    </td>
                  )}
                  <td className="contracts-table-cell">
                    <div className="service-info">
                      <div className="service-header">
                        <span className="service-name">{contract.service_name}</span>
                        <span className={`service-type-badge ${getServiceTypeBadgeClass(contract.service_type)}`}>
                          {getServiceTypeLabel(contract.service_type)}
                        </span>
                      </div>
                      {contract.service_type === 'pacchetto' && contract.service_max_entries && (
                        <div className="usage-info">
                          <div className="usage-display">
                            <span className="entries-used">{contract.entries_used || 0}</span>
                            <span className="entries-separator"> / </span>
                            <span className="entries-total">{contract.service_max_entries}</span>
                            <span className="entries-label"> {t('contracts.entriesUsed')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="contracts-table-cell">
                    <div className="location-info">
                      <div className="location-name">{contract.location_name}</div>
                      <div className="resource-info">
                        {getResourceDisplayName(contract)}
                      </div>
                    </div>
                  </td>
                  <td className="contracts-table-cell">
                    <div className="period-info">
                      <div className="period-dates">
                        {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                      </div>
                      <div className="duration-info">
                        {contract.service_duration_days} {t('contracts.days')}
                      </div>
                    </div>
                  </td>
                  <td className="contracts-table-cell">
                    <div className="cost-info">
                      {formatCurrency(contract.service_cost, contract.service_currency)}
                    </div>
                  </td>
                  <td className="contracts-table-cell">
                    <div className="archive-info">
                      <div className="archive-date">
                        {t('contracts.archivedOn') || 'Archived on'}: {formatDateTime(contract.archived_at)}
                      </div>
                      {contract.archive_reason && (
                        <div className="archive-reason">
                          {t('contracts.reason')}: {contract.archive_reason}
                        </div>
                      )}
                      <div className="archive-status">
                        <span className="status-badge status-archived">
                          {t('contracts.archived') || 'Archived'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="contracts-table-cell">
                    <div className="contract-actions">
                      {/* PDF Generation Button */}
                      <button 
                        className="pdf-btn"
                        onClick={() => handleGeneratePDF(contract)}
                        disabled={generatingPDF === contract.id}
                        title={t('contracts.generatePDF') || 'Generate PDF'}
                        style={{
                          backgroundColor: generatingPDF === contract.id ? '#9ca3af' : '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          padding: '0.5rem',
                          cursor: generatingPDF === contract.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '2.5rem',
                          opacity: generatingPDF === contract.id ? 0.6 : 1
                        }}
                      >
                        {generatingPDF === contract.id ? (
                          <div className="loading-spinner-small" style={{ borderTopColor: 'white' }}></div>
                        ) : (
                          <Download size={16} />
                        )}
                      </button>

                      {/* Restore Button - Only for admins */}
                      {canRestore && (
                        <button 
                          className="restore-btn"
                          onClick={() => handleRestore(contract)}
                          title={t('contracts.restoreContract') || 'Restore Contract'}
                          style={{
                            backgroundColor: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '2.5rem'
                          }}
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                      
                      {/* Permanent Delete Button - Show for admins and superadmins */}
                      {(isPartnerAdmin || isSuperAdmin) && (
                        <button 
                          className="permanent-delete-btn"
                          onClick={() => handlePermanentDelete(contract)}
                          title={t('contracts.deletePermanently') || 'Delete Permanently'}
                          style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '2.5rem'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {archivedContracts.length === 0 && (
            <div className="contracts-empty">
              <Archive size={48} className="empty-icon" />
              <p>{t('contracts.noArchivedContractsFound') || 'No archived contracts found.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && contractToRestore && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('contracts.confirmRestore') || 'Confirm Restore'}
              </h2>
              <button onClick={() => setShowRestoreConfirm(false)} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="restore-modal-content" style={{ padding: '1.5rem' }}>
              <div className="restore-warning">
                <RotateCcw size={24} className="warning-icon" />
                <div className="warning-text">
                  <h3>{t('contracts.restoreContract') || 'Restore Contract'}</h3>
                  <p>{t('contracts.restoreContractWarning') || 'This will restore the contract and make it active again. All related bookings and reservations will also be restored.'}</p>
                </div>
              </div>

              <div className="contract-to-restore">
                <div className="contract-detail">
                  <strong>{t('contracts.contract')}:</strong> {contractToRestore.contract_number}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.customer')}:</strong> {contractToRestore.customers?.company_name || 
                    `${contractToRestore.customers?.first_name} ${contractToRestore.customers?.second_name}`}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.service')}:</strong> {contractToRestore.service_name}
                </div>
                <div className="contract-detail">
                  <strong>{t('contracts.archivedOn') || 'Archived on'}:</strong> {formatDateTime(contractToRestore.archived_at)}
                </div>
              </div>

              <div className="restore-modal-actions" style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '0.75rem', 
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  onClick={() => setShowRestoreConfirm(false)}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleRestoreConfirm}
                  className="btn-primary"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  {t('contracts.confirmRestore') || 'Confirm Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal - DOUBLE CONFIRMATION */}
      {showPermanentDeleteConfirm && contractToDelete && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">
                {deleteStep === 1 ? (t('contracts.confirmPermanentDelete') || 'Confirm Permanent Delete') : (t('contracts.permanentDelete') || 'Permanent Delete')}
              </h2>
              <button onClick={handlePermanentDeleteCancel} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="delete-modal-content" style={{ padding: '1.5rem' }}>
              {deleteStep === 1 ? (
                <>
                  <div className="delete-warning">
                    <Trash2 size={24} className="warning-icon" />
                    <div className="warning-text">
                      <h3>{t('common.warning') || 'Warning'}!</h3>
                      <p>{t('contracts.permanentDeleteWarning') || 'This action will permanently delete the contract and all its data. This cannot be undone.'}</p>
                    </div>
                  </div>

                  <div className="contract-to-delete">
                    <div className="contract-detail">
                      <strong>{t('contracts.contract')}:</strong> {contractToDelete.contract_number}
                    </div>
                    <div className="contract-detail">
                      <strong>{t('contracts.customer')}:</strong> {contractToDelete.customers?.company_name || 
                        `${contractToDelete.customers?.first_name} ${contractToDelete.customers?.second_name}`}
                    </div>
                    <div className="contract-detail">
                      <strong>{t('contracts.service')}:</strong> {contractToDelete.service_name}
                    </div>
                    <div className="contract-detail">
                      <strong>{t('contracts.archivedOn') || 'Archived on'}:</strong> {formatDateTime(contractToDelete.archived_at)}
                    </div>
                  </div>

                  <div className="delete-consequences">
                    <h4>{t('contracts.permanentDeleteNote') || 'This action will permanently remove'}:</h4>
                    <ul>
                      <li>{t('contracts.permanentDeleteNote') || 'Contract and all its data'}</li>
                      <li>{t('contracts.archiveNote2') || 'All related bookings and reservations'}</li>
                      <li>{t('payments.paymentHistory') || 'Payment history'}</li>
                      <li><strong>{t('contracts.warning') || 'WARNING'}: {t('contracts.permanentDeleteWarning') || 'This cannot be undone'}</strong></li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <div className="final-warning">
                    <Trash2 size={32} className="final-warning-icon" />
                    <div className="final-warning-text">
                      <h3>{t('contracts.permanentDelete') || 'Permanent Delete'}</h3>
                      <p>{t('contracts.permanentDeleteWarning') || 'This action will permanently delete the contract and all its data. This cannot be undone.'}</p>
                      <div className="final-warning-note">
                        <strong>{t('contracts.warning') || 'WARNING'}:</strong> {t('contracts.permanentDeleteNote') || 'This will permanently remove the contract'} <strong>{contractToDelete.contract_number}</strong> {t('contracts.fromDatabase') || 'from the database.'}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="delete-modal-actions" style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '0.75rem', 
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  onClick={handlePermanentDeleteCancel}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handlePermanentDeleteConfirm}
                  className={deleteStep === 1 ? "btn-warning" : "btn-danger"}
                >
                  {deleteStep === 1 ? (t('common.continue') || 'Continue') : (t('contracts.deletePermanently') || 'Delete Permanently')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedContracts;