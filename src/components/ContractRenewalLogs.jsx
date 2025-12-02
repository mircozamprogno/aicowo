import { AlertTriangle, CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import '../styles/components/contractrenewallogs.css';
import logger from '../utils/logger';
import { toast } from './common/ToastContainer';

const ContractRenewalLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, success, failed
  const [dateFilter, setDateFilter] = useState('last_30'); // last_7, last_30, last_90, all_time
  const [expandedLog, setExpandedLog] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    failed_no_availability: 0,
    failed_payment: 0,
    failed_booking: 0,
    failed_error: 0
  });

  const { profile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (profile?.partner_uuid) {
      fetchRenewalLogs();
    }
  }, [profile, filter, dateFilter]);

  const fetchRenewalLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contract_renewal_log')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .order('renewal_attempt_date', { ascending: false });

      // Apply status filter
      if (filter === 'success') {
        query = query.eq('renewal_status', 'success');
      } else if (filter === 'failed') {
        query = query.like('renewal_status', 'failed%');
      }

      // Apply date filter
      const now = new Date();
      let startDate;
      
      switch (dateFilter) {
        case 'last_7':
          startDate = new Date(now.setDate(now.getDate() - 7));
          query = query.gte('renewal_attempt_date', startDate.toISOString());
          break;
        case 'last_30':
          startDate = new Date(now.setDate(now.getDate() - 30));
          query = query.gte('renewal_attempt_date', startDate.toISOString());
          break;
        case 'last_90':
          startDate = new Date(now.setDate(now.getDate() - 90));
          query = query.gte('renewal_attempt_date', startDate.toISOString());
          break;
        case 'all_time':
          // No date filter
          break;
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching renewal logs:', error);
        toast.error(t('renewalLogs.errorLoading'));
        return;
      }

      setLogs(data || []);
      calculateStats(data || []);
    } catch (error) {
      logger.error('Error fetching renewal logs:', error);
      toast.error(t('renewalLogs.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logsData) => {
    const stats = {
      total: logsData.length,
      successful: logsData.filter(l => l.renewal_status === 'success').length,
      failed: logsData.filter(l => l.renewal_status.startsWith('failed')).length,
      failed_no_availability: logsData.filter(l => l.renewal_status === 'failed_no_availability').length,
      failed_payment: logsData.filter(l => l.renewal_status === 'failed_payment_error').length,
      failed_booking: logsData.filter(l => l.renewal_status === 'failed_booking_error').length,
      failed_error: logsData.filter(l => l.renewal_status === 'failed_error').length
    };
    setStats(stats);
  };

  const getStatusIcon = (status) => {
    if (status === 'success') {
      return <CheckCircle size={20} className="status-icon success" />;
    } else if (status.startsWith('failed')) {
      return <XCircle size={20} className="status-icon failed" />;
    }
    return <Clock size={20} className="status-icon pending" />;
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'success') return 'status-badge-success';
    if (status.startsWith('failed')) return 'status-badge-failed';
    return 'status-badge-pending';
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'success':
        return t('renewalLogs.statusLabels.success') || 'Success';
      case 'failed_no_availability':
        return t('renewalLogs.statusLabels.failedNoAvailability') || 'No Availability';
      case 'failed_booking_error':
        return t('renewalLogs.statusLabels.failedBooking') || 'Booking Error';
      case 'failed_payment_error':
        return t('renewalLogs.statusLabels.failedPayment') || 'Payment Error';
      case 'failed_error':
        return t('renewalLogs.statusLabels.failedError') || 'System Error';
      default:
        return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleLogExpansion = (logId) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const handleRefresh = () => {
    fetchRenewalLogs();
    toast.success(t('renewalLogs.refreshed'));
  };

  if (loading) {
    return (
      <div className="renewal-logs-page">
        <div className="renewal-logs-loading">
          <div className="loading-spinner"></div>
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="renewal-logs-page">
      {/* Header */}
      <div className="renewal-logs-header">
        <div className="header-content">
          <h1 className="page-title">
            <RefreshCw size={24} className="mr-2" />
            {t('renewalLogs.title')}
          </h1>
          <p className="page-description">
            {t('renewalLogs.description')}
          </p>
        </div>
        <button 
          className="refresh-btn"
          onClick={handleRefresh}
          title={t('renewalLogs.refresh')}
        >
          <RefreshCw size={16} />
          {t('renewalLogs.refresh')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="renewal-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <RefreshCw size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">{t('renewalLogs.stats.total')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.successful}</div>
            <div className="stat-label">{t('renewalLogs.stats.successful')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon failed">
            <XCircle size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">{t('renewalLogs.stats.failed')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.failed_no_availability}</div>
            <div className="stat-label">{t('renewalLogs.stats.noAvailability')}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="renewal-filters">
        <div className="filter-group">
          <label className="filter-label">{t('renewalLogs.filters.status')}</label>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              {t('renewalLogs.filters.all')}
            </button>
            <button
              className={`filter-btn ${filter === 'success' ? 'active' : ''}`}
              onClick={() => setFilter('success')}
            >
              {t('renewalLogs.filters.successful')}
            </button>
            <button
              className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
              onClick={() => setFilter('failed')}
            >
              {t('renewalLogs.filters.failed')}
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">{t('renewalLogs.filters.period')}</label>
          <select
            className="filter-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="last_7">{t('renewalLogs.filters.last7Days')}</option>
            <option value="last_30">{t('renewalLogs.filters.last30Days')}</option>
            <option value="last_90">{t('renewalLogs.filters.last90Days')}</option>
            <option value="all_time">{t('renewalLogs.filters.allTime')}</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="renewal-logs-container">
        {logs.length === 0 ? (
          <div className="no-logs">
            <RefreshCw size={48} className="no-logs-icon" />
            <h3>{t('renewalLogs.noLogs')}</h3>
            <p>{t('renewalLogs.noLogsDescription')}</p>
          </div>
        ) : (
          <div className="logs-list">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className={`log-item ${expandedLog === log.id ? 'expanded' : ''}`}
              >
                <div 
                  className="log-header"
                  onClick={() => toggleLogExpansion(log.id)}
                >
                  <div className="log-main-info">
                    {getStatusIcon(log.renewal_status)}
                    <div className="log-contract-info">
                      <div className="log-contract-number">
                        {log.original_contract_number}
                      </div>
                      <div className="log-date">
                        {formatDate(log.renewal_attempt_date)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="log-status-info">
                    <span className={`status-badge ${getStatusBadgeClass(log.renewal_status)}`}>
                      {getStatusLabel(log.renewal_status)}
                    </span>
                    {log.new_contract_number && (
                      <div className="new-contract-badge">
                        → {log.new_contract_number}
                      </div>
                    )}
                  </div>
                </div>

                {expandedLog === log.id && (
                  <div className="log-details">
                    <div className="details-grid">
                      <div className="detail-item">
                        <span className="detail-label">{t('renewalLogs.originalContract')}:</span>
                        <span className="detail-value">{log.original_contract_number}</span>
                      </div>

                      {log.new_contract_number && (
                        <div className="detail-item">
                          <span className="detail-label">{t('renewalLogs.newContract')}:</span>
                          <span className="detail-value">{log.new_contract_number}</span>
                        </div>
                      )}

                      <div className="detail-item">
                        <span className="detail-label">{t('renewalLogs.attemptDate')}:</span>
                        <span className="detail-value">{formatDate(log.renewal_attempt_date)}</span>
                      </div>

                      <div className="detail-item">
                        <span className="detail-label">{t('renewalLogs.statusField')}:</span>
                        <span className="detail-value">{getStatusLabel(log.renewal_status)}</span>
                      </div>
                    </div>

                    {log.error_message && (
                      <div className="error-message-box">
                        <AlertTriangle size={16} />
                        <div>
                          <strong>{t('renewalLogs.errorMessage')}:</strong>
                          <p>{log.error_message}</p>
                        </div>
                      </div>
                    )}

                    {log.resource_availability_details && (
                      <div className="availability-details">
                        <h4>{t('renewalLogs.resourceAvailability')}:</h4>
                        <div className="availability-grid">
                          <div className="availability-item">
                            <span className="availability-label">{t('renewalLogs.totalQuantity')}:</span>
                            <span className="availability-value">
                              {log.resource_availability_details.total_quantity}
                            </span>
                          </div>
                          <div className="availability-item">
                            <span className="availability-label">{t('renewalLogs.bookedQuantity')}:</span>
                            <span className="availability-value">
                              {log.resource_availability_details.booked_quantity}
                            </span>
                          </div>
                          <div className="availability-item">
                            <span className="availability-label">{t('renewalLogs.availableQuantity')}:</span>
                            <span className="availability-value">
                              {log.resource_availability_details.available_quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractRenewalLogs;