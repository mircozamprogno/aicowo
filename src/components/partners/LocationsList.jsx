import { Edit2, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import LocationForm from '../forms/LocationForm';

const LocationsList = ({ partner, isOpen, onClose }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && partner) {
      fetchLocations();
    }
  }, [isOpen, partner]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('partner_uuid', partner.partner_uuid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching locations:', error);
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
        setLocations(data || []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
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
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container locations-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            <MapPin size={20} className="inline mr-2" />
            {t('locations.locationsFor')} {partner?.partner_name}
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
                    <div className="location-info">
                      <h3 className="location-name">{location.location_name}</h3>
                      <p className="location-details">
                        {t('common.createdAt')}: {new Date(location.created_at).toLocaleDateString()}
                      </p>
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