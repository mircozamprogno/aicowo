// src/pages/Partners.jsx
import { Edit, Send, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import PartnerForm from '../components/forms/PartnerForm';
import SendInvitationModal from '../components/invitations/SendInvitationModal';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [showLocations, setShowLocations] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showInvitation, setShowInvitation] = useState(false);
  const [invitationPartner, setInvitationPartner] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { profile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    logger.log('Starting to fetch partners...');
    try {
      let query = supabase.from('partners').select('*');
      
      if (profile?.role !== 'superadmin' && profile?.partner_uuid) {
        query = query.eq('partner_uuid', profile.partner_uuid);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      logger.log('Supabase response:', { data, error });

      if (error) {
        logger.error('Supabase error:', error);
        logger.log('Using mock data for partners');
        setPartners([
          {
            id: 1,
            first_name: 'TechHub',
            second_name: 'Milano',
            company_name: 'TechHub Milano SRL',
            email: 'info@techhub.it',
            partner_status: 'active',
            partner_type: 'company',
            city: 'Milano',
            country: 'Italy',
            partner_uuid: 'mock-uuid-1'
          },
          {
            id: 2,
            first_name: 'Startup',
            second_name: 'Space',
            company_name: 'Startup Space SRL',
            email: 'hello@startupspace.com',
            partner_status: 'active',
            partner_type: 'organization',
            city: 'Roma',
            country: 'Italy',
            partner_uuid: 'mock-uuid-2'
          }
        ]);
      } else {
        logger.log('Setting real partners data:', data);
        setPartners(data || []);
      }
    } catch (error) {
      logger.error('Error fetching partners:', error);
      toast.error(t('messages.errorLoadingPartners'));
      setPartners([]);
    } finally {
      logger.log('Setting loading to false');
      setLoading(false);
    }
  };

  const handleAddPartner = () => {
    setEditingPartner(null);
    setShowForm(true);
  };

  const handleEditPartner = (partner) => {
    setEditingPartner(partner);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPartner(null);
  };

  const handleFormSuccess = (savedPartner) => {
    if (editingPartner) {
      setPartners(prev => 
        prev.map(p => p.id === savedPartner.id ? savedPartner : p)
      );
    } else {
      setPartners(prev => [savedPartner, ...prev]);
    }
  };

  const handleViewLocations = (partner) => {
    setSelectedPartner(partner);
    setShowLocations(true);
  };

  const handleCloseLocations = () => {
    setShowLocations(false);
    setSelectedPartner(null);
  };

  const handleSendInvitation = (partner) => {
    setInvitationPartner(partner);
    setShowInvitation(true);
  };

  const handleCloseInvitation = () => {
    setShowInvitation(false);
    setInvitationPartner(null);
  };

  // Pagination calculations
  const totalPages = Math.ceil(partners.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedPartners = partners.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  const canInvite = profile?.role === 'superadmin' || profile?.role === 'admin';
  const canManagePartners = profile?.role === 'superadmin';

  if (loading) {
    return <div className="partners-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="partners-page">
      <div className="partners-header">
        <div className="partners-header-content">
          <h1 className="partners-title">{t('partners.title')}</h1>
          <p className="partners-description">
            {canManagePartners 
              ? t('partners.managePartners')
              : t('partners.viewPartnerInfo')
            }
          </p>
        </div>
        <div className="partners-header-actions">
          {canManagePartners && (
            <button className="add-partner-btn" onClick={handleAddPartner}>
              {t('partners.addPartner')}
            </button>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {partners.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            <span className="pagination-text">
              {t('common.showing')} {startIndex + 1}-{Math.min(endIndex, partners.length)} {t('common.of')} {partners.length}
            </span>
          </div>
          <div className="pagination-controls">
            <div className="rows-per-page">
              <span className="pagination-label">{t('common.rowsPerPage')}:</span>
              <Select
                value={rowsPerPage.toString()}
                onChange={handleRowsPerPageChange}
                options={[
                  { value: '10', label: '10' },
                  { value: '20', label: '20' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' }
                ]}
                autoSelectSingle={false}
              />
            </div>
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                {t('common.previous')}
              </button>
              <span className="pagination-pages">
                {currentPage} {t('common.of')} {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="partners-table-container">
        <div className="partners-table-wrapper">
          <table className="partners-table">
            <thead className="partners-table-head">
              <tr>
                <th className="partners-table-header">
                  {t('partners.partner')}
                </th>
                <th className="partners-table-header">
                  {t('auth.email')}
                </th>
                <th className="partners-table-header">
                  {t('partners.status')}
                </th>
                <th className="partners-table-header">
                  {t('partners.type')}
                </th>
                <th className="partners-table-header">
                  {t('partners.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="partners-table-body">
              {paginatedPartners.map((partner) => (
                <tr key={partner.id} className="partners-table-row">
                  <td className="partners-table-cell">
                    <div className="partner-info">
                      <div className="partner-name">
                        {partner.first_name && partner.second_name 
                          ? `${partner.first_name} ${partner.second_name}`
                          : partner.first_name || partner.company_name
                        }
                      </div>
                      <div className="partner-location">{partner.city}, {partner.country}</div>
                    </div>
                  </td>
                  <td className="partners-table-cell">
                    {partner.email}
                  </td>
                  <td className="partners-table-cell">
                    <span className={`status-badge status-${partner.partner_status}`}>
                      {t(`partners.${partner.partner_status}`)}
                    </span>
                  </td>
                  <td className="partners-table-cell">
                    {t(`partners.${partner.partner_type}`)}
                  </td>
                  <td className="partners-table-cell">
                    <div className="partner-actions">
                      {canManagePartners && (
                        <button 
                          className="partner-action-btn edit-btn"
                          onClick={() => handleEditPartner(partner)}
                          title={t('partners.edit')}
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {canInvite && (
                        <button 
                          className="partner-action-btn invite-btn"
                          onClick={() => handleSendInvitation(partner)}
                          title={
                            profile?.role === 'superadmin' 
                              ? t('invitations.invitePartnerAdmin')
                              : t('invitations.inviteUser')
                          }
                        >
                          {profile?.role === 'superadmin' ? (
                            <UserPlus size={16} />
                          ) : (
                            <Send size={16} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {partners.length === 0 && (
            <div className="partners-empty">
              <p>
                {canManagePartners 
                  ? t('partners.noPartnersFound')
                  : t('partners.noPartnerAssigned')
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {canManagePartners && (
        <PartnerForm
          isOpen={showForm}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          partner={editingPartner}
        />
      )}

      {canInvite && (
        <SendInvitationModal
          isOpen={showInvitation}
          onClose={handleCloseInvitation}
          partner={invitationPartner}
          currentUserRole={profile?.role}
        />
      )}
    </div>
  );
};

export default Partners;