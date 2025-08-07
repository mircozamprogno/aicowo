import { Edit2, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import LocationForm from '../forms/LocationForm';

const LocationsList = ({ partner, isOpen, onClose }) => {
  const [locations, setLocations] = useState([]);
  const [locationResources, setLocationResources] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && partner) {
      fetchLocationsAndResources();
    }
  }, [isOpen, partner]);

  const fetchLocationsAndResources = async () => {
    try {
      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .eq('partner_uuid', partner.partner_uuid)
        .order('created_at', { ascending: false });

      if (locationsError && locationsError.code !== 'PGRST116') {
        console.error('Error fetching locations:', locationsError);
        // Provide mock data for now
        setLocations([
          {
            id: 1,
            location_name: 'Main Office',
            location_uuid: 'mock-uuid-1',
            partner_uuid: partner.partner_uuid
          },
          {
            id: 2,
            location_name: 'Secondary Branch',
            location_uuid: 'mock-uuid-2', 
            partner_uuid: partner.partner_uuid
          }
        ]);
      } else {
        setLocations(locationsData || []);
      }

      // Fetch resources for all locations
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('location_resources')
        .select('*')
        .eq('partner_uuid', partner.partner_uuid)
        .order('resource_type', { ascending: true });

      if (resourcesError && resourcesError.code !== 'PGRST116') {
        console.error('Error fetching resources:', resourcesError);
        // Provide mock resources data
        setLocationResources({
          1: [
            { id: 1, resource_type: 'scrivania', resource_name: 'Hot Desks', quantity: 20, description: 'Flexible workspace desks' },
            { id: 2, resource_type: 'sala_riunioni', resource_name: 'Small Meeting Room', quantity: 3, description: 'Meeting rooms for up to 4 people' }
          ],
          2: [
            { id: 3, resource_type: 'scrivania', resource_name: 'Co-working Desks', quantity: 15, description: 'Shared workspace desks' },
            { id: 4, resource_type: 'sala_riunioni', resource_name: 'Conference Room', quantity: 2, description: 'Professional meeting spaces' }
          ]
        });
      } else {
        // Group resources by location_id
        const groupedResources = {};
        (resourcesData || []).forEach(resource => {
          if (!groupedResources[resource.location_id]) {
            groupedResources[resource.location_id] = [];
          }
          groupedResources[resource.location_id].push(resource);
        });
        setLocationResources(groupedResources);
      }
    } catch (error) {
      console.error('Error fetching locations and resources:', error);
      toast.error(t('messages.errorLoadingLocations'));
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
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', location.id);

      if (error) throw error;

      setLocations(prev => prev.filter(l => l.id !== location.id));
      setLocationResources(prev => {
        const newResources = { ...prev };
        delete newResources[location.id];
        return newResources;
      });
      toast.success(t('messages.locationDeletedSuccessfully'));
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
    if (editingLocation) {
      // Update existing location in the list
      setLocations(prev => 
        prev.map(l => l.id === savedLocation.id ? savedLocation : l)
      );
    } else {
      // Add new location to the list
      setLocations(prev => [savedLocation, ...prev]);
    }
    // Refresh resources data
    fetchLocationsAndResources();
  };

  const getResourceTypeLabel = (type) => {
    return type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni');
  };

  const getResourceTypeIcon = (type) => {
    return type === 'scrivania' ? '🪑' : '🏢';
  };

  const getTotalResourcesForLocation = (locationId) => {
    const resources = locationResources[locationId] || [];
    return resources.reduce((total, resource) => total + resource.quantity, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container locations-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            <MapPin size={20} className="inline mr-2" />
            {t('locations.locationsFor')} {partner?.first_name && partner?.second_name 
              ? `${partner.first_name} ${partner.second_name}`
              : partner?.first_name || partner?.company_name
            }
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="locations-content">
          <div className="locations-header">
            <button 
              onClick={handleAddLocation}
              className="btn-primary"
            >
              <Plus size={16} className="mr-2" />
              {t('locations.addLocation')}
            </button>
          </div>

          {loading ? (
            <div className="locations-loading">
              {t('common.loading')}
            </div>
          ) : (
            <div className="locations-list">
              {locations.length === 0 ? (
                <div className="locations-empty">
                  <MapPin size={48} className="text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">{t('locations.noLocationsFound')}</p>
                  <button 
                    onClick={handleAddLocation}
                    className="btn-primary mt-4"
                  >
                    {t('locations.addFirstLocation')}
                  </button>
                </div>
              ) : (
                locations.map((location) => (
                  <div key={location.id} className="location-item">
                    <div className="location-main-info">
                      <div className="location-header">
                        <h3 className="location-name">{location.location_name}</h3>
                        <div className="location-summary">
                          {t('locations.totalResources')}: {getTotalResourcesForLocation(location.id)}
                        </div>
                      </div>
                      <div className="location-actions">
                        <button
                          onClick={() => handleEditLocation(location)}
                          className="btn-icon"
                          title={t('common.edit')}
                        >
                          <Edit2 size={16} />
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
                    
                    {/* Resources List */}
                    <div className="location-resources">
                      <h4 className="resources-title">{t('locations.availableResources')}:</h4>
                      {locationResources[location.id] && locationResources[location.id].length > 0 ? (
                        <div className="resources-grid">
                          {locationResources[location.id].map((resource) => (
                            <div key={resource.id} className="resource-card">
                              <div className="resource-info">
                                <div className="resource-header">
                                  <span className="resource-icon">
                                    {getResourceTypeIcon(resource.resource_type)}
                                  </span>
                                  <span className="resource-type">
                                    {getResourceTypeLabel(resource.resource_type)}
                                  </span>
                                </div>
                                <div className="resource-name">{resource.resource_name}</div>
                                <div className="resource-quantity">
                                  <span className="quantity-number">{resource.quantity}</span>
                                  <span className="quantity-label">{t('locations.available')}</span>
                                </div>
                                {resource.description && (
                                  <div className="resource-description">{resource.description}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-resources">
                          <p>{t('locations.noResourcesFound')}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="location-meta">
                      <small>{t('common.createdAt')}: {new Date(location.created_at).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            {t('common.close')}
          </button>
        </div>
      </div>

      <LocationForm
        isOpen={showLocationForm}
        onClose={handleLocationFormClose}
        onSuccess={handleLocationFormSuccess}
        location={editingLocation}
        partnerUuid={partner?.partner_uuid}
      />
    </div>
  );
};

export default LocationsList;