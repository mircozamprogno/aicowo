import { ChevronDown, Search, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Invitations = () => {
  const [allInvitations, setAllInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedInvitations, setSelectedInvitations] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  
  const { profile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchInvitations();
  }, [profile]);

  const fetchInvitations = async () => {
    if (!profile) return;

    console.log('Fetching invitations for user:', profile);
    setLoading(true);

    try {
      let query = supabase
        .from('invitations')
        .select(`
          *,
          partners (
            first_name,
            second_name,
            company_name
          )
        `)
        .order('created_at', { ascending: false });

      // Apply tenant isolation based on user role
      if (profile.role === 'superadmin') {
        // Superadmin sees all invitations
        console.log('Superadmin: fetching all invitations');
      } else if (profile.role === 'admin') {
        // Admin sees only invitations for their partner
        if (!profile.partner_uuid) {
          console.warn('Admin user has no partner_uuid');
          setAllInvitations([]);
          setLoading(false);
          return;
        }
        console.log('Admin: fetching invitations for partner:', profile.partner_uuid);
        query = query.eq('partner_uuid', profile.partner_uuid);
      } else {
        // Regular users shouldn't access this page, but just in case
        console.warn('Non-admin user trying to access invitations');
        setAllInvitations([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching invitations:', error);
        toast.error(t('messages.errorLoadingInvitations'));
        
        // Provide mock data for development
        const mockInvitations = [
          {
            id: 1,
            invitation_uuid: 'mock-uuid-1',
            invited_first_name: 'Mario',
            invited_last_name: 'Rossi',
            invited_email: 'mario.rossi@example.com',
            invited_role: 'admin',
            status: 'pending',
            used_at: null,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            partners: {
              first_name: 'TechHub',
              second_name: 'Milano',
              company_name: 'TechHub Milano SRL'
            }
          },
          {
            id: 2,
            invitation_uuid: 'mock-uuid-2',
            invited_first_name: 'Anna',
            invited_last_name: 'Verdi',
            invited_email: 'anna.verdi@example.com',
            invited_role: 'user',
            status: 'used',
            used_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
            partners: {
              first_name: 'TechHub',
              second_name: 'Milano',
              company_name: 'TechHub Milano SRL'
            }
          },
          {
            id: 3,
            invitation_uuid: 'mock-uuid-3',
            invited_first_name: 'Luca',
            invited_last_name: 'Bianchi',
            invited_email: 'luca.bianchi@example.com',
            invited_role: 'user',
            status: 'expired',
            used_at: null,
            created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            partners: {
              first_name: 'Startup',
              second_name: 'Space',
              company_name: 'Startup Space SRL'
            }
          }
        ];

        // Filter mock data based on user role for development
        if (profile.role === 'admin') {
          setAllInvitations(mockInvitations.filter(inv => 
            inv.partners?.first_name === 'TechHub' && inv.partners?.second_name === 'Milano'
          ));
        } else {
          setAllInvitations(mockInvitations);
        }
      } else {
        console.log('Invitations fetched successfully:', data);
        setAllInvitations(data || []);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast.error(t('messages.errorLoadingInvitations'));
      setAllInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search logic
  const filteredInvitations = useMemo(() => {
    let filtered = allInvitations;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(inv => {
        const email = inv.invited_email?.toLowerCase() || '';
        const firstName = inv.invited_first_name?.toLowerCase() || '';
        const lastName = inv.invited_last_name?.toLowerCase() || '';
        const partnerName = inv.partners?.company_name?.toLowerCase() || 
                           `${inv.partners?.first_name || ''} ${inv.partners?.second_name || ''}`.toLowerCase();
        
        return email.includes(searchLower) || 
               firstName.includes(searchLower) || 
               lastName.includes(searchLower) ||
               partnerName.includes(searchLower);
      });
    }

    return filtered;
  }, [allInvitations, statusFilter, searchTerm]);

  // Pagination logic
  const totalItems = filteredInvitations.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentInvitations = filteredInvitations.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, pageSize]);

  const handleCancelInvitation = async (invitation) => {
    if (invitation.status !== 'pending') {
      toast.error(t('messages.canOnlyCancelPendingInvitations'));
      return;
    }

    if (!window.confirm(t('messages.confirmCancelInvitation'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invitations')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('invitation_uuid', invitation.invitation_uuid);

      if (error) throw error;

      // Update local state
      setAllInvitations(prev => 
        prev.map(inv => 
          inv.invitation_uuid === invitation.invitation_uuid 
            ? { ...inv, status: 'cancelled', cancelled_at: new Date().toISOString() }
            : inv
        )
      );

      toast.success(t('messages.invitationCancelledSuccessfully'));
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error(t('messages.errorCancellingInvitation'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvitations.size === 0) {
      toast.error(t('invitations.noInvitationsSelected'));
      return;
    }

    if (!window.confirm(t('invitations.confirmDeleteSelected', { count: selectedInvitations.size }))) {
      return;
    }

    setDeleting(true);

    try {
      const invitationUuids = Array.from(selectedInvitations);
      
      const { error } = await supabase
        .from('invitations')
        .delete()
        .in('invitation_uuid', invitationUuids);

      if (error) throw error;

      // Update local state
      setAllInvitations(prev => 
        prev.filter(inv => !selectedInvitations.has(inv.invitation_uuid))
      );

      setSelectedInvitations(new Set());
      toast.success(t('invitations.invitationsDeletedSuccessfully', { count: selectedInvitations.size }));
    } catch (error) {
      console.error('Error deleting invitations:', error);
      toast.error(t('invitations.errorDeletingInvitations'));
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const newSelected = new Set(currentInvitations.map(inv => inv.invitation_uuid));
      setSelectedInvitations(newSelected);
    } else {
      setSelectedInvitations(new Set());
    }
  };

  const handleSelectInvitation = (invitationUuid, checked) => {
    const newSelected = new Set(selectedInvitations);
    if (checked) {
      newSelected.add(invitationUuid);
    } else {
      newSelected.delete(invitationUuid);
    }
    setSelectedInvitations(newSelected);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <UserPlus size={16} className="text-blue-600" />;
      case 'used':
        return <UserCheck size={16} className="text-green-600" />;
      case 'expired':
        return <UserX size={16} className="text-red-600" />;
      case 'cancelled':
        return <UserX size={16} className="text-gray-600" />;
      default:
        return <UserPlus size={16} className="text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'used':
        return 'status-active';
      case 'expired':
        return 'status-suspended';
      case 'cancelled':
        return 'status-inactive';
      default:
        return 'status-inactive';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="invitations-loading">{t('common.loading')}</div>;
  }

  const isAllSelected = currentInvitations.length > 0 && 
    currentInvitations.every(inv => selectedInvitations.has(inv.invitation_uuid));
  const isIndeterminate = currentInvitations.some(inv => selectedInvitations.has(inv.invitation_uuid)) && !isAllSelected;

  return (
    <div className="invitations-page">
      <div className="invitations-header">
        <div className="invitations-header-content">
          <h1 className="invitations-title">{t('invitations.title')}</h1>
          <p className="invitations-description">
            {profile?.role === 'superadmin' 
              ? t('invitations.manageAllInvitations')
              : t('invitations.managePartnerInvitations')
            }
          </p>
        </div>
        <div className="invitations-stats">
          <div className="stat-item">
            <span className="stat-label">{t('invitations.totalInvitations')}</span>
            <span className="stat-value">{allInvitations.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('invitations.pendingInvitations')}</span>
            <span className="stat-value">
              {allInvitations.filter(inv => inv.status === 'pending').length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('invitations.usedInvitations')}</span>
            <span className="stat-value">
              {allInvitations.filter(inv => inv.status === 'used').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="invitations-controls">
        <div className="invitations-search-and-filters">
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder={t('invitations.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-dropdown">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">{t('invitations.allStatuses')}</option>
              <option value="pending">{t('invitations.pending')}</option>
              <option value="used">{t('invitations.used')}</option>
              <option value="expired">{t('invitations.expired')}</option>
              <option value="cancelled">{t('invitations.cancelled')}</option>
            </select>
            <ChevronDown size={16} className="dropdown-icon" />
          </div>
        </div>

        {selectedInvitations.size > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">
              {t('invitations.selectedCount', { count: selectedInvitations.size })}
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bulk-delete-btn"
            >
              <Trash2 size={16} />
              {deleting ? t('invitations.deleting') : t('invitations.deleteSelected')}
            </button>
          </div>
        )}
      </div>

      <div className="invitations-table-container">
        <div className="invitations-table-wrapper">
          <table className="invitations-table">
            <thead className="invitations-table-head">
              <tr>
                <th className="invitations-table-header checkbox-column">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="checkbox-input"
                  />
                </th>
                <th className="invitations-table-header">
                  {t('invitations.invitee')}
                </th>
                <th className="invitations-table-header">
                  {t('auth.email')}
                </th>
                {profile?.role === 'superadmin' && (
                  <th className="invitations-table-header hide-on-mobile">
                    {t('partners.partner')}
                  </th>
                )}
                <th className="invitations-table-header role-column">
                  {t('auth.role')}
                </th>
                <th className="invitations-table-header">
                  {t('invitations.status')}
                </th>
                <th className="invitations-table-header sent-at-column">
                  {t('invitations.sentAt')}
                </th>
                <th className="invitations-table-header used-at-column">
                  {t('invitations.usedAt')}
                </th>
                <th className="invitations-table-header">
                  {t('partners.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="invitations-table-body">
              {currentInvitations.map((invitation) => (
                <tr key={invitation.invitation_uuid} className="invitations-table-row">
                  <td className="invitations-table-cell checkbox-column">
                    <input
                      type="checkbox"
                      checked={selectedInvitations.has(invitation.invitation_uuid)}
                      onChange={(e) => handleSelectInvitation(invitation.invitation_uuid, e.target.checked)}
                      className="checkbox-input"
                    />
                  </td>
                  <td className="invitations-table-cell">
                    <div className="invitee-info">
                      <div className="invitee-name">
                        {invitation.invited_first_name} {invitation.invited_last_name}
                      </div>
                      <div className="invitee-created">
                        {t('common.createdAt')}: {formatDate(invitation.created_at)}
                      </div>
                    </div>
                  </td>
                  <td className="invitations-table-cell">
                    {invitation.invited_email}
                  </td>
                  {profile?.role === 'superadmin' && (
                    <td className="invitations-table-cell hide-on-mobile">
                      <div className="partner-info">
                        <div className="partner-name">
                          {invitation.partners?.first_name && invitation.partners?.second_name 
                            ? `${invitation.partners.first_name} ${invitation.partners.second_name}`
                            : invitation.partners?.first_name || invitation.partners?.company_name
                          }
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="invitations-table-cell role-column">
                    <span className="role-badge">
                      {t(`roles.${invitation.invited_role}`)}
                    </span>
                  </td>
                  <td className="invitations-table-cell">
                    <div className="status-container">
                      {getStatusIcon(invitation.status)}
                      <span className={`status-badge ${getStatusBadgeClass(invitation.status)}`}>
                        {t(`invitations.${invitation.status}`)}
                      </span>
                    </div>
                  </td>
                  <td className="invitations-table-cell sent-at-column">
                    {formatDate(invitation.sent_at || invitation.created_at)}
                  </td>
                  <td className="invitations-table-cell used-at-column">
                    {formatDate(invitation.used_at)}
                  </td>
                  <td className="invitations-table-cell">
                    <div className="invitation-actions">
                      {invitation.status === 'pending' && (
                        <button
                          onClick={() => handleCancelInvitation(invitation)}
                          className="cancel-btn"
                          title={t('invitations.cancelInvitation')}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {invitation.status !== 'pending' && (
                        <span className="no-actions">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredInvitations.length === 0 && (
            <div className="invitations-empty">
              <UserPlus size={48} className="empty-icon" />
              <p>
                {searchTerm || statusFilter !== 'all' 
                  ? t('invitations.noInvitationsMatchFilter')
                  : t('invitations.noInvitationsFound')
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {filteredInvitations.length > 0 && (
        <div className="invitations-pagination">
          <div className="pagination-info">
            <span>
              {t('invitations.showingResults', {
                start: Math.min(startIndex + 1, totalItems),
                end: Math.min(endIndex, totalItems),
                total: totalItems
              })}
            </span>
          </div>
          
          <div className="pagination-controls">
            <div className="page-size-selector">
              <label htmlFor="pageSize">{t('invitations.itemsPerPage')}:</label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="page-size-select"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            
            <div className="page-navigation">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="page-btn"
              >
                {t('invitations.previous')}
              </button>
              
              <span className="page-info">
                {t('invitations.pageOfPages', { current: currentPage, total: totalPages })}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="page-btn"
              >
                {t('invitations.next')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invitations;