import { Edit, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import LocationForm from '../forms/LocationForm';

const LocationsList = ({ partner, isOpen, onClose, embedded = false }) => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  useEffect(() => {
    if ((isOpen || embedded) && partner) {
      fetchLocations();
    }
  }, [isOpen, embedded, partner]);

  const fetchLocations = async () => {
    if (!partner?.partner_uuid) {
      console.warn('No partner UUID provided');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching locations for partner:', partner.partner_uuid);
      
      // Fetch locations with their resources
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select(`
          id,
          location_name,
          address,
          city,
          postal_code,
          country,
          phone,
          email,
          description,
          latitude,
          longitude,
          timezone,
          vat_percentage,
          created_at,
          resources:location_resources(
            id,
            resource_type,
            resource_name,
            quantity,
            description
          )
        `)
        .eq('partner_uuid', partner.partner_uuid)
        .order('created_at', { ascending: false });

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        toast.error(t('messages.errorLoadingLocations'));
        setLocations([]);
        return;
      }

      console.log('Locations data:', locationsData);
      setLocations(locationsData || []);

    } catch (error) {
      console.error('Error in fetchLocations:', error);
      toast.error(t('messages.errorLoadingLocations'));
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = () => {
    setEditingLocation(null);
    setShowLocationForm(true);
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setShowLocationForm(true);
  };

  const handleDeleteLocation = async (location) => {
    if (!window.confirm(t('messages.confirmDeleteLocation'))) {
      return;
    }

    try {
      // First delete associated resources
      const { error: resourcesError } = await supabase
        .from('location_resources')
        .delete()
        .eq('location_id', location.id);

      if (resourcesError) {
        console.error('Error deleting location resources:', resourcesError);
      }

      // Then delete the location
      const { error: locationError } = await supabase
        .from('locations')
        .delete()
        .eq('id', location.id);

      if (locationError) throw locationError;

      toast.success(t('messages.locationDeletedSuccessfully'));
      fetchLocations(); // Refresh the list

    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error(t('messages.errorDeletingLocation'));
    }
  };

  const handleLocationFormClose = () => {
    setShowLocationForm(false);
    setEditingLocation(null);
  };

  const handleLocationFormSuccess = (savedLocation) => {
    fetchLocations(); // Refresh the list
  };

  const formatLocationAddress = (location) => {
    const parts = [
      location.address,
      [location.postal_code, location.city].filter(Boolean).join(' '),
      location.country
    ].filter(Boolean);
    
    return parts.join(', ') || t('locations.noAddressYet');
  };

  const getResourcesSummary = (resources) => {
    if (!resources || resources.length === 0) {
      return t('locations.noResourcesFound');
    }

    const groupedResources = resources.reduce((acc, resource) => {
      if (!acc[resource.resource_type]) {
        acc[resource.resource_type] = 0;
      }
      acc[resource.resource_type] += resource.quantity;
      return acc;
    }, {});

    const summary = Object.entries(groupedResources).map(([type, count]) => {
      const label = type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni');
      return `${count} ${label}`;
    });

    return summary.join(', ');
  };

  // Don't render anything if not open and not embedded
  if (!isOpen && !embedded) return null;

  const content = (
    <>
      {!embedded && (
        <div className="modal-header">
          <h2 className="modal-title">
            <MapPin size={20} />
            {t('locations.locationsFor')} {partner?.company_name || partner?.first_name}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>
      )}

      <div className="locations-content">
        {loading ? (
          <div className="locations-loading">{t('common.loading')}</div>
        ) : (
          <>
            <div className="locations-header">
              <div className="locations-header-content">
                {!embedded && (
                  <p className="locations-description">
                    {t('locations.manageWorkspacesAndMeetingRooms')}
                  </p>
                )}
              </div>
              <button 
                onClick={handleAddLocation}
                className="add-location-btn"
              >
                <Plus size={16} />
                {t('locations.addLocation')}
              </button>
            </div>

            {locations.length === 0 ? (
              <div className="locations-empty">
                <MapPin size={48} className="empty-icon" />
                <p>{t('locations.noLocationsFound')}</p>
                <button 
                  onClick={handleAddLocation}
                  className="add-location-btn"
                >
                  <Plus size={16} />
                  {t('locations.addFirstLocation')}
                </button>
              </div>
            ) : (
              <div className="locations-list">
                {locations.map((location) => (
                  <div key={location.id} className="location-item">
                    <div className="location-info">
                      <h3 className="location-name">{location.location_name}</h3>
                      <p className="location-details">
                        <MapPin size={14} className="location-detail-icon" />
                        {formatLocationAddress(location)}
                      </p>
                      <p className="location-resources">
                        <span className="location-resources-label">{t('locations.resources')}:</span>
                        {getResourcesSummary(location.resources)}
                      </p>
                      {location.phone && (
                        <p className="location-contact">
                          📞 {location.phone}
                        </p>
                      )}
                      {location.email && (
                        <p className="location-contact">
                          ✉️ {location.email}
                        </p>
                      )}
                    </div>
                    <div className="location-actions">
                      <button
                        onClick={() => handleEditLocation(location)}
                        className="btn-icon btn-edit"
                        title={t('common.edit')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location)}
                        className="btn-icon btn-danger"
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!embedded && (
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            {t('common.close')}
          </button>
        </div>
      )}

      {/* Location Form Modal */}
      <LocationForm
        isOpen={showLocationForm}
        onClose={handleLocationFormClose}
        onSuccess={handleLocationFormSuccess}
        location={editingLocation}
        partnerUuid={partner?.partner_uuid}
        partnerData={partner}
      />
    </>
  );

  // If embedded, return content directly
  if (embedded) {
    return (
      <div className="locations-embedded">
        {content}
      </div>
    );
  }

  // If not embedded, return in modal
  return (
    <div className="locations-modal-backdrop">
      <div className="locations-modal">
        {content}
      </div>
    </div>
  );
};

export default LocationsList;