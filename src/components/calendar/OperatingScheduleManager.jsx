// src/components/calendar/OperatingScheduleManager.jsx
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Select from '../common/Select';
import ClosuresList from './ClosuresList';
import LocationScheduleForm from './LocationScheduleForm';
import ResourceScheduleList from './ResourceScheduleList';

const OperatingScheduleManager = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.partner_uuid) {
      fetchLocations();
    }
  }, [profile]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('partner_uuid', profile.partner_uuid)
        .order('location_name');

      if (error) throw error;

      setLocations(data || []);
      if (data && data.length > 0) {
        setSelectedLocation(data[0]);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error(t('messages.errorLoadingLocations'));
    } finally {
      setLoading(false);
    }
  };

  const handleLocationChange = (e) => {
    const locationId = e.target.value;
    const location = locations.find(loc => loc.id === parseInt(locationId));
    setSelectedLocation(location);
  };

  if (loading) {
    return (
      <div className="operating-calendar-manager">
        <div className="calendar-manager-loading">
          {t('common.loading')}...
        </div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="operating-calendar-manager">
        <div className="calendar-manager-empty">
          <MapPin size={48} className="empty-icon" />
          <h3>{t('calendar.noLocationsFound')}</h3>
          <p>{t('calendar.createLocationFirst')}</p>
        </div>
      </div>
    );
  }

  const locationOptions = locations.map(loc => ({
    value: loc.id,
    label: loc.location_name
  }));

  return (
    <div className="operating-calendar-manager">
      {/* Location Selector */}
      <div className="location-selector-section">
        <label className="location-selector-label">
          {t('calendar.selectLocation')}
        </label>
        <Select
          value={selectedLocation?.id || ''}
          onChange={handleLocationChange}
          options={locationOptions}
          placeholder={t('calendar.selectLocation')}
          emptyMessage={t('calendar.noLocationsFound')}
        />
      </div>

      {/* Selected Location Content */}
      {selectedLocation && (
        <>
          <div className="selected-location-header">
            <h2 className="location-header-title">{selectedLocation.location_name}</h2>
            {selectedLocation.address && (
              <p className="location-header-address">
                {selectedLocation.address}, {selectedLocation.city}
              </p>
            )}
          </div>

          {/* Location Schedule Section */}
          <LocationScheduleForm location={selectedLocation} />

          {/* Resource Overrides Section */}
          <ResourceScheduleList location={selectedLocation} />

          {/* Closures Section */}
          <ClosuresList location={selectedLocation} />
        </>
      )}
    </div>
  );
};

export default OperatingScheduleManager;