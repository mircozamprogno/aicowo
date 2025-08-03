import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import PartnerForm from '../components/forms/PartnerForm';
import LocationsList from '../components/partners/LocationsList';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [showLocations, setShowLocations] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    console.log('Starting to fetch partners...');
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        // Provide mock data if the table doesn't exist
        console.log('Using mock data for partners');
        setPartners([
          {
            id: 1,
            partner_name: 'TechHub Milano',
            email: 'info@techhub.it',
            partner_status: 'active',
            partner_type: 'company',
            city: 'Milano',
            country: 'Italy',
            partner_uuid: 'mock-uuid-1'
          },
          {
            id: 2,
            partner_name: 'Startup Space',
            email: 'hello@startupspace.com',
            partner_status: 'active',
            partner_type: 'organization',
            city: 'Roma',
            country: 'Italy',
            partner_uuid: 'mock-uuid-2'
          }
        ]);
      } else {
        console.log('Setting real partners data:', data);
        setPartners(data || []);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast.error(t('messages.errorLoadingPartners'));
      // Set empty array so loading stops
      setPartners([]);
    } finally {
      console.log('Setting loading to false');
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
      // Update existing partner in the list
      setPartners(prev => 
        prev.map(p => p.id === savedPartner.id ? savedPartner : p)
      );
    } else {
      // Add new partner to the list
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

  if (loading) {
    return <div className="partners-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="partners-page">
      <div className="partners-header">
        <div className="partners-header-content">
          <h1 className="partners-title">{t('partners.title')}</h1>
          <p className="partners-description">
            {t('partners.managePartners')}
          </p>
        </div>
        <div className="partners-header-actions">
          <button className="add-partner-btn" onClick={handleAddPartner}>
            {t('partners.addPartner')}
          </button>
        </div>
      </div>

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
              {partners.map((partner) => (
                <tr key={partner.id} className="partners-table-row">
                  <td className="partners-table-cell">
                    <div className="partner-info">
                      <div className="partner-name">
                        {partner.partner_name || partner.company_name}
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
                      <button 
                        className="edit-btn"
                        onClick={() => handleEditPartner(partner)}
                      >
                        {t('partners.edit')}
                      </button>
                      <button 
                        className="locations-btn"
                        onClick={() => handleViewLocations(partner)}
                        title={t('locations.viewLocations')}
                      >
                        <MapPin size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {partners.length === 0 && (
            <div className="partners-empty">
              <p>{t('partners.noPartnersFound')}</p>
            </div>
          )}
        </div>
      </div>

      <PartnerForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        partner={editingPartner}
      />

      <LocationsList
        partner={selectedPartner}
        isOpen={showLocations}
        onClose={handleCloseLocations}
      />
    </div>
  );
};

export default Partners;