// src/components/calendar/ClosuresList.jsx
import { Calendar, Edit, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import ClosureModal from './ClosureModal';

import logger from '../../utils/logger';

const ClosuresList = ({ location }) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState(null);

  useEffect(() => {
    if (location) {
      fetchClosures();
    }
  }, [location]);

  const fetchClosures = async () => {
    try {
      const { data, error } = await supabase
        .from('operating_closures')
        .select(`
          *,
          location_resources (
            id,
            resource_name
          )
        `)
        .eq('partner_uuid', profile.partner_uuid)
        .or(`location_id.eq.${location.id},and(closure_scope.eq.resource_type,location_id.eq.${location.id})`)
        .order('closure_start_date', { ascending: false });

      if (error) throw error;

      setClosures(data || []);
    } catch (error) {
      logger.error('Error fetching closures:', error);
      toast.error(t('messages.errorLoadingClosures'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddClosure = () => {
    setSelectedClosure(null);
    setShowModal(true);
  };

  const handleEditClosure = (closure) => {
    setSelectedClosure(closure);
    setShowModal(true);
  };

  const handleDeleteClosure = async (closureId) => {
    if (!confirm(t('calendar.confirmDeleteClosure'))) return;

    try {
      const { error } = await supabase
        .from('operating_closures')
        .delete()
        .eq('id', closureId);

      if (error) throw error;

      toast.success(t('calendar.closureDeleted'));
      fetchClosures();
    } catch (error) {
      logger.error('Error deleting closure:', error);
      toast.error(t('messages.errorDeletingClosure'));
    }
  };

  const getClosureScopeLabel = (closure) => {
    if (closure.closure_scope === 'location') {
      return t('calendar.entireLocation');
    } else if (closure.closure_scope === 'resource') {
      return closure.location_resources?.resource_name || t('calendar.specificResource');
    } else if (closure.closure_scope === 'resource_type') {
      return closure.resource_type === 'scrivania' 
        ? t('locations.allDesks') 
        : t('locations.allMeetingRooms');
    }
    return '';
  };

  const getClosureTypeLabel = (type) => {
    const types = {
      'holiday': t('calendar.holiday'),
      'maintenance': t('calendar.maintenance'),
      'special_event': t('calendar.specialEvent'),
      'emergency': t('calendar.emergency'),
      'custom': t('calendar.custom')
    };
    return types[type] || type;
  };

  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const locale = t('app.locale') === 'it' ? 'it-IT' : 'en-US';
    
    if (startDate === endDate) {
      return start.toLocaleDateString(locale, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    
    return `${start.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  };

  if (loading) {
    return <div className="closures-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="closures-list">
      <div className="closures-header">
        <button type="button" className="add-closure-btn" onClick={handleAddClosure}>
          <Plus size={16} />
          {t('calendar.addClosure')}
        </button>
      </div>

      {closures.length === 0 ? (
        <div className="closures-empty">
          <Calendar size={48} className="empty-icon" />
          <p>{t('calendar.noClosuresFound')}</p>
          <p className="empty-description">{t('calendar.addClosureDescription')}</p>
        </div>
      ) : (
        <div className="closures-table">
          {closures.map(closure => (
            <div key={closure.id} className="closure-row">
              <div className="closure-info">
                <div className="closure-main">
                  <h4 className="closure-reason">{closure.closure_reason || t('calendar.closure')}</h4>
                  <div className="closure-meta">
                    <span className="closure-type-badge">{getClosureTypeLabel(closure.closure_type)}</span>
                    <span className="closure-scope">{getClosureScopeLabel(closure)}</span>
                    {closure.is_recurring && (
                      <span className="recurring-badge">{t('calendar.recurring')}</span>
                    )}
                  </div>
                </div>
                <div className="closure-dates">
                  <Calendar size={16} />
                  {formatDateRange(closure.closure_start_date, closure.closure_end_date)}
                </div>
              </div>
              
              <div className="closure-actions">
                <button
                  type="button"
                  className="closure-action-btn edit"
                  onClick={() => handleEditClosure(closure)}
                  title={t('common.edit')}
                >
                  <Edit size={16} />
                </button>
                <button
                  type="button"
                  className="closure-action-btn delete"
                  onClick={() => handleDeleteClosure(closure.id)}
                  title={t('common.delete')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ClosureModal
          location={location}
          closure={selectedClosure}
          onClose={() => {
            setShowModal(false);
            setSelectedClosure(null);
          }}
          onSuccess={() => {
            fetchClosures();
            setShowModal(false);
            setSelectedClosure(null);
          }}
        />
      )}
    </div>
  );
};

export default ClosuresList;