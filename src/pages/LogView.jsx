// src/pages/LogView.jsx
import { Calendar, ChevronLeft, ChevronRight, Eye, FileText, Filter, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

import '../styles/pages/logview.css';
import logger from '../utils/logger';

const LogView = () => {
  const [logs, setLogs] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    category: '',
    actionType: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0
  });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  
  const { profile } = useAuth();
  const { t } = useTranslation();

  const isSuperAdmin = profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin';

  // Action categories and types for filters
  const actionCategories = [
    'authentication',
    'contract',
    'customer',
    'booking',
    'service',
    'location',
    'resource',
    'payment',
    'system'
  ];

  const actionTypes = [
    'create',
    'update',
    'delete',
    'login',
    'logout',
    'view',
    'export',
    'import',
    'approve',
    'reject',
    'cancel',
    'activate',
    'deactivate'
  ];

  useEffect(() => {
    if (profile) {
      if (isSuperAdmin) {
        fetchPartners();
      } else if (isAdmin) {
        setSelectedPartner(profile.partner_uuid);
      }
    }
  }, [profile, isSuperAdmin, isAdmin]);

  useEffect(() => {
    if (selectedPartner) {
      fetchLogs();
    }
  }, [selectedPartner, filters, pagination.currentPage]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('partner_uuid, partner_name')
        .order('partner_name');

      if (error) throw error;
      setPartners(data || []);
      
      // Auto-select first partner if available
      if (data && data.length > 0) {
        setSelectedPartner(data[0].partner_uuid);
      }
    } catch (error) {
      logger.error('Error fetching partners:', error);
      toast.error(t('logs.errorLoadingPartners'));
    }
  };

  const fetchLogs = async () => {
    if (!selectedPartner) return;
    
    setLoading(true);
    try {
      // Build query with filters
      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .eq('partner_uuid', selectedPartner)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.dateFrom) {
        query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }
      if (filters.category) {
        query = query.eq('action_category', filters.category);
      }
      if (filters.actionType) {
        query = query.eq('action_type', filters.actionType);
      }

      // Apply pagination
      const from = (pagination.currentPage - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Fetch user profiles for the logs
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(log => log.user_id).filter(Boolean))];
        
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name')
            .in('id', userIds);

          if (!profilesError && profilesData) {
            // Map profiles to logs
            const enrichedLogs = data.map(log => ({
              ...log,
              profiles: profilesData.find(p => p.id === log.user_id) || null
            }));
            setLogs(enrichedLogs);
          } else {
            setLogs(data);
          }
        } else {
          setLogs(data);
        }
      } else {
        setLogs([]);
      }

      setPagination(prev => ({
        ...prev,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / prev.pageSize)
      }));
    } catch (error) {
      logger.error('Error fetching logs:', error);
      toast.error(t('logs.errorLoadingLogs'));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to first page
  };

  const handleClearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      category: '',
      actionType: ''
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatUserName = (log) => {
    if (!log.profiles) return t('logs.unknownUser');
    const { first_name, last_name, email } = log.profiles;
    if (first_name && last_name) {
      return `${first_name} ${last_name}`;
    }
    return email || t('logs.unknownUser');
  };

  const formatUserEmail = (log) => {
    return log.profiles?.email || '-';
  };

  const getCategoryBadgeClass = (category) => {
    const classes = {
      authentication: 'category-auth',
      contract: 'category-contract',
      customer: 'category-customer',
      booking: 'category-booking',
      service: 'category-service',
      location: 'category-location',
      resource: 'category-resource',
      payment: 'category-payment',
      system: 'category-system'
    };
    return classes[category] || 'category-default';
  };

  const getActionTypeBadgeClass = (actionType) => {
    const classes = {
      create: 'action-create',
      update: 'action-update',
      delete: 'action-delete',
      login: 'action-login',
      logout: 'action-logout',
      view: 'action-view',
      export: 'action-export',
      import: 'action-import',
      approve: 'action-approve',
      reject: 'action-reject',
      cancel: 'action-cancel',
      activate: 'action-activate',
      deactivate: 'action-deactivate'
    };
    return classes[actionType] || 'action-default';
  };

  const truncateText = (text, maxLength = 80) => {
    if (!text) return '-';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  // Check if user can view logs
  const canViewLogs = isSuperAdmin || isAdmin;

  if (!canViewLogs) {
    return (
      <div className="logs-page">
        <div className="logs-unauthorized">
          <h1>{t('logs.accessDenied')}</h1>
          <p>{t('logs.accessDeniedMessage')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="logs-page">
      <div className="logs-header">
        <div className="logs-header-content">
          <h1 className="logs-title">
            <FileText size={24} className="mr-2" />
            {t('logs.title')}
          </h1>
          <p className="logs-description">
            {t('logs.description')}
          </p>
        </div>
      </div>

      {/* Partner Selector for SuperAdmin */}
      {isSuperAdmin && (
        <div className="logs-partner-selector">
          <label className="filter-label">
            {t('logs.selectPartner')}
          </label>
          <select
            className="filter-select"
            value={selectedPartner || ''}
            onChange={(e) => {
              setSelectedPartner(e.target.value);
              setPagination(prev => ({ ...prev, currentPage: 1 }));
            }}
          >
            <option value="">{t('logs.selectPartnerPlaceholder')}</option>
            {partners.map(partner => (
              <option key={partner.partner_uuid} value={partner.partner_uuid}>
                {partner.partner_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedPartner && (
        <>
          {/* Filters Section */}
          <div className="logs-filters">
            <div className="filters-header">
              <div className="filters-title">
                <Filter size={18} className="mr-2" />
                {t('logs.filters')}
              </div>
              <button 
                className="clear-filters-btn"
                onClick={handleClearFilters}
              >
                {t('logs.clearFilters')}
              </button>
            </div>
            
            <div className="filters-grid">
              <div className="filter-group">
                <label className="filter-label">
                  <Calendar size={14} className="mr-1" />
                  {t('logs.dateFrom')}
                </label>
                <input
                  type="date"
                  className="filter-input"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">
                  <Calendar size={14} className="mr-1" />
                  {t('logs.dateTo')}
                </label>
                <input
                  type="date"
                  className="filter-input"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">
                  {t('logs.category')}
                </label>
                <select
                  className="filter-select"
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="">{t('logs.allCategories')}</option>
                  {actionCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {t(`logs.categories.${cat}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">
                  {t('logs.actionType')}
                </label>
                <select
                  className="filter-select"
                  value={filters.actionType}
                  onChange={(e) => handleFilterChange('actionType', e.target.value)}
                >
                  <option value="">{t('logs.allActions')}</option>
                  {actionTypes.map(action => (
                    <option key={action} value={action}>
                      {t(`logs.actions.${action}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Logs Stats */}
          <div className="logs-stats">
            <div className="stat-item">
              <span className="stat-label">{t('logs.totalLogs')}</span>
              <span className="stat-value">{pagination.totalCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('logs.currentPage')}</span>
              <span className="stat-value">
                {pagination.currentPage} / {pagination.totalPages || 1}
              </span>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="logs-loading">{t('common.loading')}</div>
          ) : (
            <>
              <div className="logs-table-container">
                <div className="logs-table-wrapper">
                  <table className="logs-table">
                    <thead className="logs-table-head">
                      <tr>
                        <th className="logs-table-header">{t('logs.dateTime')}</th>
                        <th className="logs-table-header">{t('logs.user')}</th>
                        <th className="logs-table-header">{t('logs.category')}</th>
                        <th className="logs-table-header">{t('logs.actionType')}</th>
                        <th className="logs-table-header">{t('logs.entityType')}</th>
                        <th className="logs-table-header">{t('logs.description')}</th>
                        <th className="logs-table-header">{t('logs.actionsColumn')}</th>
                      </tr>
                    </thead>
                    <tbody className="logs-table-body">
                      {logs.map((log) => (
                        <tr key={log.id} className="logs-table-row">
                          <td className="logs-table-cell">
                            <div className="log-datetime">
                              {formatDateTime(log.created_at)}
                            </div>
                          </td>
                          <td className="logs-table-cell">
                            <div className="log-user">
                              <div className="user-name">{formatUserName(log)}</div>
                              <div className="user-email">{formatUserEmail(log)}</div>
                            </div>
                          </td>
                          <td className="logs-table-cell">
                            <span className={`category-badge ${getCategoryBadgeClass(log.action_category)}`}>
                              {t(`logs.categories.${log.action_category}`)}
                            </span>
                          </td>
                          <td className="logs-table-cell">
                            <span className={`action-badge ${getActionTypeBadgeClass(log.action_type)}`}>
                              {t(`logs.actions.${log.action_type}`)}
                            </span>
                          </td>
                          <td className="logs-table-cell">
                            <div className="log-entity">
                              {log.entity_type || '-'}
                            </div>
                          </td>
                          <td className="logs-table-cell">
                            <div className="log-description">
                              {truncateText(log.description)}
                            </div>
                          </td>
                          <td className="logs-table-cell">
                            <button
                              className="view-details-btn"
                              onClick={() => handleViewDetails(log)}
                              title={t('logs.viewDetails')}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {logs.length === 0 && (
                    <div className="logs-empty">
                      <FileText size={48} className="empty-icon" />
                      <p>{t('logs.noLogsFound')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pagination */}
              {logs.length > 0 && (
                <div className="logs-pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                    {t('logs.previous')}
                  </button>
                  
                  <div className="pagination-info">
                    {t('logs.page')} {pagination.currentPage} {t('logs.of')} {pagination.totalPages}
                  </div>
                  
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage >= pagination.totalPages}
                  >
                    {t('logs.next')}
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="modal-overlay">
          <div className="modal-container log-detail-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('logs.logDetails')}
              </h2>
              <button 
                onClick={() => setShowDetailModal(false)} 
                className="modal-close-btn"
              >
                <X size={24} />
              </button>
            </div>

            <div className="log-detail-content">
              <div className="detail-section">
                <h3 className="detail-section-title">{t('logs.generalInfo')}</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.dateTime')}:</span>
                    <span className="detail-value">{formatDateTime(selectedLog.created_at)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.user')}:</span>
                    <span className="detail-value">{formatUserName(selectedLog)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.email')}:</span>
                    <span className="detail-value">{formatUserEmail(selectedLog)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.ipAddress')}:</span>
                    <span className="detail-value">{selectedLog.ip_address || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="detail-section-title">{t('logs.actionInfo')}</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.category')}:</span>
                    <span className={`category-badge ${getCategoryBadgeClass(selectedLog.action_category)}`}>
                      {t(`logs.categories.${selectedLog.action_category}`)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.actionType')}:</span>
                    <span className={`action-badge ${getActionTypeBadgeClass(selectedLog.action_type)}`}>
                      {t(`logs.actions.${selectedLog.action_type}`)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.entityType')}:</span>
                    <span className="detail-value">{selectedLog.entity_type || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('logs.entityId')}:</span>
                    <span className="detail-value">{selectedLog.entity_id || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="detail-section-title">{t('logs.description')}</h3>
                <div className="detail-description">
                  {selectedLog.description}
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="detail-section">
                  <h3 className="detail-section-title">{t('logs.metadata')}</h3>
                  <pre className="metadata-json">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="log-detail-actions">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="btn-primary"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogView;