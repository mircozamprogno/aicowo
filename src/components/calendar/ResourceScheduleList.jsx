// src/components/calendar/ResourceScheduleList.jsx
import { Clock, Edit, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import logger from '../../utils/logger';
import ResourceScheduleModal from './ResourceScheduleModal';

const ResourceScheduleList = ({ location }) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  
  const [resources, setResources] = useState([]);
  const [resourceSchedules, setResourceSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);

  useEffect(() => {
    if (location?.id) {
      // Reset state when location changes
      setResources([]);
      setResourceSchedules([]);
      setLoading(true);
      fetchData();
    }
  }, [location?.id]);

  const fetchData = async () => {
    try {
      logger.log('Fetching resources for location:', location.id, location.location_name);
      
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('location_resources')
        .select('*')
        .eq('location_id', location.id)
        .order('resource_name');

      if (resourcesError) throw resourcesError;

      logger.log('Found resources:', resourcesData?.length, resourcesData);

      const resourceIds = resourcesData?.map(r => r.id) || [];
      
      if (resourceIds.length > 0) {
        const { data: schedulesData, error: schedulesError } = await supabase
          .from('resource_operating_schedules')
          .select('*')
          .in('location_resource_id', resourceIds);

        if (schedulesError) throw schedulesError;
        setResourceSchedules(schedulesData || []);
      } else {
        setResourceSchedules([]);
      }

      setResources(resourcesData || []);
    } catch (error) {
      logger.error('Error fetching resource data:', error);
      toast.error(t('messages.errorLoadingResources'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = (resource) => {
    setSelectedResource(resource);
    setShowModal(true);
  };

  const handleEditSchedule = (resource) => {
    setSelectedResource(resource);
    setShowModal(true);
  };

  const handleDeleteSchedule = async (resourceId) => {
    if (!confirm(t('calendar.confirmDeleteResourceSchedule'))) return;

    try {
      const { error } = await supabase
        .from('resource_operating_schedules')
        .delete()
        .eq('location_resource_id', resourceId);

      if (error) throw error;

      toast.success(t('calendar.resourceScheduleDeleted'));
      fetchData();
    } catch (error) {
      logger.error('Error deleting resource schedule:', error);
      toast.error(t('messages.errorDeletingSchedule'));
    }
  };

  if (loading) {
    return <div className="schedule-loading">{t('common.loading')}...</div>;
  }

  if (resources.length === 0) {
    return (
      <div className="calendar-section">
        <div className="calendar-section-header">
          <div className="calendar-section-title">
            <Clock size={20} />
            <h3>{t('calendar.resourceOverrides')}</h3>
          </div>
          <p className="calendar-section-description">
            {t('calendar.noResourcesInLocation')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-section">
      <div className="calendar-section-header">
        <div className="calendar-section-title">
          <Clock size={20} />
          <h3>{t('calendar.resourceOverrides')}</h3>
        </div>
        <p className="calendar-section-description">
          {t('calendar.resourceOverridesIntro')}
        </p>
      </div>

      <div className="resources-grid">
        {resources.map(resource => {
          const hasOverride = resourceSchedules.some(s => s.location_resource_id === resource.id);
          
          return (
            <div key={resource.id} className="resource-schedule-row">
              <div className="resource-info">
                <div className="resource-name">
                  {resource.resource_name}
                </div>
                <div className="resource-type">
                  {resource.resource_type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni')}
                </div>
              </div>
              
              <div className="resource-schedule-status">
                {hasOverride ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => handleEditSchedule(resource)}
                    >
                      {t('calendar.usesLocationSchedule')}
                    </button>
                    <div className="resource-actions">
                      <button
                        type="button"
                        className="resource-action-btn edit"
                        onClick={() => handleEditSchedule(resource)}
                        title={t('common.edit')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        className="resource-action-btn delete"
                        onClick={() => handleDeleteSchedule(resource.id)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-secondary-sm"
                    >
                      {t('calendar.usesLocationSchedule')}
                    </button>
                    <button
                      type="button"
                      className="btn-primary-sm"
                      onClick={() => handleAddSchedule(resource)}
                    >
                      <Plus size={16} />
                      {t('calendar.addCustomSchedule')}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <ResourceScheduleModal
          resource={selectedResource}
          location={location}
          onClose={() => {
            setShowModal(false);
            setSelectedResource(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowModal(false);
            setSelectedResource(null);
          }}
        />
      )}
    </div>
  );
};

export default ResourceScheduleList;