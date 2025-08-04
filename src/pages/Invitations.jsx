import { Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Invitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
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
            partner_name,
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
          setInvitations([]);
          setLoading(false);
          return;
        }
        console.log('Admin: fetching invitations for partner:', profile.partner_uuid);
        query = query.eq('partner_uuid', profile.partner_uuid);
      } else {
        // Regular users shouldn't access this page, but just in case
        console.warn('Non-admin user trying to access invitations');
        setInvitations([]);
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
              partner_name: 'TechHub Milano',
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
              partner_name: 'TechHub Milano',
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
              partner_name: 'Startup Space',
              company_name: 'Startup Space SRL'
            }
          }
        ];

        // Filter mock data based on user role for development
        if (profile.role === 'admin') {
          setInvitations(mockInvitations.filter(inv => 
            inv.partners?.partner_name === 'TechHub Milano'
          ));
        } else {
          setInvitations(mockInvitations);
        }
      } else {
        console.log('Invitations fetched successfully:', data);
        setInvitations(data || []);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast.error(t('messages.errorLoadingInvitations'));
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

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
      setInvitations(prev => 
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
            <span className="stat-value">{invitations.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('invitations.pendingInvitations')}</span>
            <span className="stat-value">
              {invitations.filter(inv => inv.status === 'pending').length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('invitations.usedInvitations')}</span>
            <span className="stat-value">
              {invitations.filter(inv => inv.status === 'used').length}
            </span>
          </div>
        </div>
      </div>

      <div className="invitations-table-container">
        <div className="invitations-table-wrapper">
          <table className="invitations-table">
            <thead className="invitations-table-head">
            <tr>
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
                {invitations.map((invitation) => (
                <tr key={invitation.invitation_uuid} className="invitations-table-row">
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
                            {invitation.partners?.partner_name || invitation.partners?.company_name}
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
          {invitations.length === 0 && (
            <div className="invitations-empty">
              <UserPlus size={48} className="empty-icon" />
              <p>{t('invitations.noInvitationsFound')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Invitations;