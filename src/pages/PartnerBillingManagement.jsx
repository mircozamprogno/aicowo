// src/pages/PartnerBillingManagement.jsx
import { AlertTriangle, Calendar, CheckCircle, Clock, Eye, Play, RefreshCw, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import '../styles/pages/partner-billing-management.css';

const PartnerBillingManagement = () => {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [lastExecution, setLastExecution] = useState(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState(null);

  const { profile } = useAuth();
  const { t } = useTranslation();

  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      fetchExecutionHistory();
      fetchLastExecution();
    }
  }, [isSuperAdmin]);

  const fetchExecutionHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_billing_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error fetching execution history:', error);
      toast.error(t('messages.errorLoadingData') || 'Error loading execution history');
    } finally {
      setLoading(false);
    }
  };

  const fetchLastExecution = async () => {
    try {
      const { data, error } = await supabase.rpc('get_last_billing_execution');
      if (error) throw error;
      setLastExecution(data?.[0] || null);
    } catch (error) {
      console.error('Error fetching last execution:', error);
    }
  };

  const handleViewDetails = (execution) => {
    setSelectedExecution(execution);
    setShowDetailsModal(true);
  };

  const handleTriggerBilling = async () => {
    if (!selectedMonth) {
      toast.error(t('partnerBilling.selectMonth') || 'Please select a billing month');
      return;
    }

    setTriggering(true);

    try {
      const { data, error } = await supabase.rpc('trigger_manual_billing', {
        p_billing_month: selectedMonth,
        p_triggered_by_user_id: profile.id
      });

      if (error) throw error;

      const result = data;

      if (result.success) {
        toast.success(
          t('partnerBilling.billingTriggeredSuccess') || 
          `Billing triggered successfully for ${selectedMonth}`
        );
        setShowTriggerModal(false);
        fetchExecutionHistory();
        fetchLastExecution();
      } else {
        toast.error(result.error || 'Failed to trigger billing');
      }
    } catch (error) {
      console.error('Error triggering billing:', error);
      toast.error(t('messages.errorProcessing') || 'Error triggering billing');
    } finally {
      setTriggering(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} className="status-icon success" />;
      case 'failed':
        return <XCircle size={20} className="status-icon error" />;
      case 'partial':
        return <AlertTriangle size={20} className="status-icon warning" />;
      case 'running':
        return <Clock size={20} className="status-icon info" />;
      default:
        return null;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'partial':
        return 'status-partial';
      case 'running':
        return 'status-running';
      default:
        return '';
    }
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7); // YYYY-MM format
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    
    return options;
  };

  if (!isSuperAdmin) {
    return (
      <div className="partner-billing-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>Only super administrators can access billing management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="partner-billing-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="partner-billing-page">
      <div className="partner-billing-header">
        <div className="partner-billing-header-content">
          <h1 className="partner-billing-title">
            <Calendar size={24} className="mr-2" />
            {t('partnerBilling.title') || 'Partner Billing Management'}
          </h1>
          <p className="partner-billing-description">
            {t('partnerBilling.subtitle') || 'Manage automated and manual billing executions'}
          </p>
        </div>
        <div className="partner-billing-header-actions">
          <button 
            className="btn-primary"
            onClick={() => setShowTriggerModal(true)}
          >
            <Play size={16} className="mr-2" />
            {t('partnerBilling.triggerBilling') || 'Trigger Manual Billing'}
          </button>
          <button 
            className="btn-secondary"
            onClick={() => {
              fetchExecutionHistory();
              fetchLastExecution();
            }}
          >
            <RefreshCw size={16} className="mr-2" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Last Execution Summary */}
      {lastExecution && (
        <div className="last-execution-card">
          <div className="card-header">
            <h3>{t('partnerBilling.lastExecution') || 'Last Execution'}</h3>
            {getStatusIcon(lastExecution.status)}
          </div>
          <div className="card-content">
            <div className="execution-summary">
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.billingMonth')}</span>
                <span className="summary-value">{lastExecution.billing_month}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.executionType')}</span>
                <span className={`summary-badge ${lastExecution.execution_type}`}>
                  {lastExecution.execution_type}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.started')}</span>
                <span className="summary-value">{formatDate(lastExecution.started_at)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.duration')}</span>
                <span className="summary-value">
                  {formatDuration(lastExecution.duration_seconds)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.totalPartners')}</span>
                <span className="summary-value">{lastExecution.total_partners || 0}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.successful')}</span>
                <span className="summary-value success">{lastExecution.success_count || 0}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.errors')}</span>
                <span className="summary-value error">{lastExecution.error_count || 0}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{t('partnerBilling.skipped')}</span>
                <span className="summary-value">{lastExecution.skipped_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution History Table */}
      <div className="execution-history-section">
        <h2>{t('partnerBilling.executionHistory') || 'Execution History'}</h2>
        
        <div className="execution-table-container">
          <table className="execution-table">
            <thead>
              <tr>
                <th>{t('partnerBilling.status')}</th>
                <th>{t('partnerBilling.billingMonth')}</th>
                <th>{t('partnerBilling.type')}</th>
                <th>{t('partnerBilling.started')}</th>
                <th>{t('partnerBilling.duration')}</th>
                <th>{t('partnerBilling.results')}</th>
                <th>{t('partnerBilling.triggeredBy')}</th>
                <th>{t('partnerContracts.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td>
                    <div className={`status-cell ${getStatusClass(execution.status)}`}>
                      {getStatusIcon(execution.status)}
                      <span>{execution.status}</span>
                    </div>
                  </td>
                  <td>
                    <span className="billing-month">{execution.billing_month}</span>
                  </td>
                  <td>
                    <span className={`execution-type-badge ${execution.execution_type}`}>
                      {execution.execution_type}
                    </span>
                  </td>
                  <td>
                    <span className="date-time">{formatDate(execution.started_at)}</span>
                  </td>
                  <td>
                    <span className="duration">
                      {execution.completed_at
                        ? formatDuration(
                            (new Date(execution.completed_at) - new Date(execution.started_at)) / 1000
                          )
                        : '-'}
                    </span>
                  </td>
                  <td>
                    <div className="results-cell">
                      {execution.total_partners !== null && (
                        <>
                          <span className="result-item">
                            Total: {execution.total_partners}
                          </span>
                          <span className="result-item success">
                            ✓ {execution.success_count || 0}
                          </span>
                          {execution.error_count > 0 && (
                            <span className="result-item error">
                              ✗ {execution.error_count}
                            </span>
                          )}
                          {execution.skipped_count > 0 && (
                            <span className="result-item skipped">
                              ⊘ {execution.skipped_count}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="triggered-by">
                      {execution.triggered_by_user_id ? 'Manual' : 'Scheduled'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="action-btn view-btn"
                      onClick={() => handleViewDetails(execution)}
                      title={t('partnerBilling.viewDetails')}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {executions.length === 0 && (
            <div className="empty-state">
              <Calendar size={48} className="empty-icon" />
              <p>{t('partnerBilling.noExecutions') || 'No billing executions found'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Trigger Modal */}
      {showTriggerModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>{t('partnerBilling.triggerBilling') || 'Trigger Manual Billing'}</h2>
              <button 
                className="modal-close"
                onClick={() => setShowTriggerModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <p className="modal-description">
                {t('partnerBilling.triggerDescription') || 
                  'Select the billing month to process. This will create payment records for all active partners.'}
              </p>

              <div className="form-group">
                <label htmlFor="billing-month">
                  {t('partnerBilling.selectBillingMonth') || 'Billing Month'}
                </label>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  options={generateMonthOptions().map(opt => ({ value: opt.value, label: opt.label }))}
                  placeholder={t('partnerBilling.selectMonth') || 'Select month...'}
                  emptyMessage={t('common.noOptionsAvailable') || 'No options available'}
                  autoSelectSingle={false}
                />
              </div>

              <div className="modal-warning">
                <AlertTriangle size={20} />
                <p>
                  {t('partnerBilling.duplicateWarning') || 
                    'If billing has already been processed for this month, duplicate records will be skipped.'}
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowTriggerModal(false)}
                disabled={triggering}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleTriggerBilling}
                disabled={triggering || !selectedMonth}
              >
                {triggering ? (
                  <>
                    <RefreshCw size={16} className="spinning mr-2" />
                    {t('partnerBilling.processing') || 'Processing...'}
                  </>
                ) : (
                  <>
                    <Play size={16} className="mr-2" />
                    {t('partnerBilling.triggerNow') || 'Trigger Billing'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Details Modal */}
      {showDetailsModal && selectedExecution && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('partnerBilling.executionDetails')}</h2>
              <button 
                className="modal-close-btn"
                onClick={() => setShowDetailsModal(false)}
              >
                <X size={24} />
              </button>
            </div>

            <div className="modal-content">
              {/* Execution Summary */}
              <div className="details-section">
                <h3>{t('partnerBilling.executionSummary')}</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.executionId')}:</span>
                    <span className="detail-value">{selectedExecution.execution_uuid}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.billingMonth')}:</span>
                    <span className="detail-value">{selectedExecution.billing_month}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.executionType')}:</span>
                    <span className={`execution-type-badge ${selectedExecution.execution_type}`}>
                      {selectedExecution.execution_type}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.status')}:</span>
                    <div className={`status-cell ${getStatusClass(selectedExecution.status)}`}>
                      {getStatusIcon(selectedExecution.status)}
                      <span>{selectedExecution.status}</span>
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.started')}:</span>
                    <span className="detail-value">{formatDate(selectedExecution.started_at)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.completed')}:</span>
                    <span className="detail-value">{formatDate(selectedExecution.completed_at)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.duration')}:</span>
                    <span className="detail-value">
                      {selectedExecution.completed_at
                        ? formatDuration(
                            (new Date(selectedExecution.completed_at) - new Date(selectedExecution.started_at)) / 1000
                          )
                        : '-'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.totalPartners')}:</span>
                    <span className="detail-value">{selectedExecution.total_partners || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.successful')}:</span>
                    <span className="detail-value success">{selectedExecution.success_count || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.errors')}:</span>
                    <span className="detail-value error">{selectedExecution.error_count || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('partnerBilling.skipped')}:</span>
                    <span className="detail-value">{selectedExecution.skipped_count || 0}</span>
                  </div>
                </div>

                {/* Error Message if any */}
                {selectedExecution.error_message && (
                  <div className="error-message-box">
                    <AlertTriangle size={20} />
                    <div>
                      <strong>{t('partnerBilling.errorMessage')}:</strong>
                      <p>{selectedExecution.error_message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Partner Results */}
            {selectedExecution.execution_details?.results && (
              <>
                  <div className="partner-results-header">
                    <h3>{t('partnerBilling.partnerResults')}</h3>
                  </div>
                  <div className="partner-results-table-container">
                    <table className="partner-results-table">
                      <thead>
                        <tr>
                          <th>{t('partnerBilling.partnerName')}</th>
                          <th>{t('partnerBilling.result')}</th>
                          <th>{t('partnerBilling.errorMessage')}</th>
                          <th>{t('partnerBilling.invoiceNumber')}</th>
                          <th>{t('partnerBilling.amount')}</th>
                          <th>{t('partnerBilling.activeUsers')}</th>
                          <th>{t('partnerBilling.overLimit')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExecution.execution_details.results.map((result, index) => (
                          <tr key={index} className={!result.success ? 'error-row' : ''}>
                            <td>{result.partner_uuid}</td>
                            <td>
                              {result.success ? (
                                <span className="success-badge">
                                  <CheckCircle size={16} /> Success
                                </span>
                              ) : (
                                <span className="error-badge">
                                  <XCircle size={16} /> Error
                                </span>
                              )}
                            </td>
                            <td>
                              {result.error ? (
                                <span className="error-text">{result.error}</span>
                              ) : (
                                <span className="success-text">-</span>
                              )}
                            </td>
                            <td>{result.invoice_number || '-'}</td>
                            <td>
                              {result.amount && result.currency ? 
                                `${result.currency} ${Number(result.amount).toFixed(2)}` : 
                                '-'
                              }
                            </td>
                            <td>
                              {result.active_users_count !== undefined ? 
                                `${result.active_users_count} / ${result.plan_limit || 0}` : 
                                '-'
                              }
                            </td>
                            <td>
                              {result.is_over_limit ? (
                                <span className="over-limit-badge">
                                  {t('partnerBilling.yes')}
                                </span>
                              ) : (
                                <span className="under-limit-badge">
                                  {t('partnerBilling.no')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!selectedExecution.execution_details.results || 
                          selectedExecution.execution_details.results.length === 0) && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                              {t('partnerBilling.noResults') || 'No results available'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowDetailsModal(false)}
              >
                {t('partnerBilling.closeDetails')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerBillingManagement;