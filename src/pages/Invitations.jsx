// src/pages/Invitations.jsx
import { Search, Send, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';
import Pagination from '../components/common/Pagination';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import SendInvitationModal from '../components/invitations/SendInvitationModal';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

import logger from '../utils/logger';


const Invitations = () => {
  const [allInvitations, setAllInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedInvitations, setSelectedInvitations] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showInvitation, setShowInvitation] = useState(false);
  const [currentPartner, setCurrentPartner] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, invitation: null, isBulk: false });

  const { profile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchInvitations();
    if (profile?.role === 'admin') {
      fetchCurrentPartner();
    }
  }, [profile]);

  const fetchCurrentPartner = async () => {
    if (!profile?.partner_uuid) return;

    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .single();

      if (error) {
        logger.error('Error fetching current partner:', error);
        // Mock data for development
        setCurrentPartner({
          partner_uuid: profile.partner_uuid,
          first_name: 'TechHub',
          second_name: 'Milano',
          company_name: 'TechHub Milano SRL'
        });
      } else {
        setCurrentPartner(data);
      }
    } catch (error) {
      logger.error('Error fetching current partner:', error);
    }
  };

  const fetchInvitations = async () => {
    if (!profile) return;

    logger.log('Fetching invitations for user:', profile);
    setLoading(true);

    try {
      let query = supabase
        .from('invitations')
        .select(`
          *,
          partners (
            first_name,
            second_name,
            company_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      // Apply tenant isolation based on user role
      if (profile.role === 'superadmin') {
        // Superadmin sees all invitations
        logger.log('Superadmin: fetching all invitations');
      } else if (profile.role === 'admin') {
        // Admin sees only invitations for their partner
        if (!profile.partner_uuid) {
          logger.warn('Admin user has no partner_uuid');
          setAllInvitations([]);
          setLoading(false);
          return;
        }
        logger.log('Admin: fetching invitations for partner:', profile.partner_uuid);
        query = query.eq('partner_uuid', profile.partner_uuid);
      } else {
        // Regular users shouldn't access this page, but just in case
        logger.warn('Non-admin user trying to access invitations');
        setAllInvitations([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching invitations:', error);
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
              company_name: 'TechHub Milano SRL',
              email: 'info@techhub.it'
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
              company_name: 'TechHub Milano SRL',
              email: 'info@techhub.it'
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
              company_name: 'Startup Space SRL',
              email: 'hello@startupspace.com'
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
        logger.log('Invitations fetched successfully:', data);
        setAllInvitations(data || []);
      }
    } catch (error) {
      logger.error('Error fetching invitations:', error);
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
        const partnerEmail = inv.partners?.email?.toLowerCase() || '';

        return email.includes(searchLower) ||
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          partnerName.includes(searchLower) ||
          partnerEmail.includes(searchLower);
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
      logger.error('Error cancelling invitation:', error);
      toast.error(t('messages.errorCancellingInvitation'));
    }
  };

  const handleBulkDelete = async () => {
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
      logger.error('Error deleting invitations:', error);
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

  const handleSendInvitation = () => {
    setShowInvitation(true);
  };

  const handleCloseInvitation = () => {
    setShowInvitation(false);
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

  // Status filter options for Select component
  const statusOptions = [
    { value: 'all', label: t('invitations.allStatuses') },
    { value: 'pending', label: t('invitations.pending') },
    { value: 'used', label: t('invitations.used') },
    { value: 'expired', label: t('invitations.expired') },
    { value: 'cancelled', label: t('invitations.cancelled') }
  ];

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

        {/* Stats and Actions Container */}
        <div className="invitations-stats-and-actions">
          <div className="invitations-stats">
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

          {/* Send Invitation button only for partner admins */}
          {profile?.role === 'admin' && currentPartner && (
            <div className="invitations-header-actions">
              <button
                className="send-invitation-btn"
                onClick={handleSendInvitation}
              >
                <Send size={16} />
                {t('invitations.sendInvitation')}
              </button>
            </div>
          )}
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
            <Select
              name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              placeholder={t('invitations.selectStatus')}
            />
          </div>
        </div>

        {selectedInvitations.size > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">
              {t('invitations.selectedCount', { count: selectedInvitations.size })}
            </span>
            <button
              onClick={() => {
                if (selectedInvitations.size === 0) {
                  toast.error(t('invitations.noInvitationsSelected'));
                  return;
                }
                setConfirmModal({ isOpen: true, invitation: null, isBulk: true });
              }}
              disabled={deleting}
              className="bulk-delete-btn"
            >
              <Trash2 size={16} />
              {deleting ? t('invitations.deleting') : t('invitations.deleteSelected')}
            </button>
          </div>
        )}
      </div>

      <Pagination
        totalItems={filteredInvitations.length}
        itemsPerPage={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setPageSize}
      />

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
                {profile?.role === 'admin' && (
                  <th className="invitations-table-header">
                    {t('auth.email')}
                  </th>
                )}

                {profile?.role === 'superadmin' && (
                  <th className="invitations-table-header hide-on-mobile">
                    {t('partners.partner')}
                  </th>
                )}

                <th className="invitations-table-header status-column hide-on-mobile">
                  {t('invitations.status')}
                </th>
                <th className="invitations-table-header sent-at-column">
                  {t('invitations.sentAt')}
                </th>
                <th className="invitations-table-header used-at-column">
                  {t('invitations.usedAt')}
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
                  {profile?.role === 'admin' && (
                    <td className="invitations-table-cell email-column">
                      <div className="invitee-email-container">
                        {invitation.invited_email}
                      </div>
                      <div className="status-mobile-only">
                        <span className={`status-badge ${getStatusBadgeClass(invitation.status)}`}>
                          {t(`invitations.${invitation.status}`)}
                        </span>
                      </div>
                    </td>
                  )}

                  {profile?.role === 'superadmin' && (
                    <td className="invitations-table-cell hide-on-mobile">
                      <div className="partner-info">
                        <div className="partner-name">
                          {invitation.partners?.first_name && invitation.partners?.second_name
                            ? `${invitation.partners.first_name} ${invitation.partners.second_name}`
                            : invitation.partners?.first_name || invitation.partners?.company_name
                          }
                        </div>
                        <div className="partner-email">
                          {invitation.partners?.email}
                        </div>
                      </div>
                    </td>
                  )}

                  <td className="invitations-table-cell status-column hide-on-mobile">
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

      {/* Pagination removed from bottom and moved to top */}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, invitation: null, isBulk: false })}
        onConfirm={() => {
          if (confirmModal.isBulk) {
            handleBulkDelete();
          } else if (confirmModal.invitation) {
            handleCancelInvitation(confirmModal.invitation);
          }
        }}
        title={confirmModal.isBulk
          ? t('invitations.confirmDeleteTitle')
          : t('invitations.confirmCancelTitle')
        }
        message={confirmModal.isBulk
          ? t('invitations.confirmDeleteMessage', { count: selectedInvitations.size })
          : t('invitations.confirmCancelMessage')
        }
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />

      {/* Send Invitation Modal - Only for partner admins */}
      {profile?.role === 'admin' && currentPartner && (
        <SendInvitationModal
          isOpen={showInvitation}
          onClose={handleCloseInvitation}
          onSuccess={fetchInvitations}
          partner={currentPartner}
          currentUserRole={profile?.role}
        />
      )}
    </div>
  );
};

export default Invitations;