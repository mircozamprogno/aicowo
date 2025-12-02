// src/components/calendar/ClosureModal.jsx
import { Calendar, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Select from '../common/Select';

import logger from '../../utils/logger';

const ClosureModal = ({ location, closure, onClose, onSuccess }) => {
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState([]);
  const [formData, setFormData] = useState({
    closure_scope: 'location',
    location_id: location.id,
    location_resource_id: null,
    resource_type: null,
    closure_start_date: '',
    closure_end_date: '',
    closure_type: 'custom',
    closure_reason: '',
    is_recurring: false
  });

  useEffect(() => {
    fetchResources();
    if (closure) {
      setFormData({
        closure_scope: closure.closure_scope,
        location_id: closure.location_id,
        location_resource_id: closure.location_resource_id,
        resource_type: closure.resource_type,
        closure_start_date: closure.closure_start_date,
        closure_end_date: closure.closure_end_date,
        closure_type: closure.closure_type,
        closure_reason: closure.closure_reason || '',
        is_recurring: closure.is_recurring
      });
    }
  }, [closure]);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('location_resources')
        .select('*')
        .eq('location_id', location.id)
        .order('resource_name');

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      logger.error('Error fetching resources:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleScopeChange = (e) => {
    const scope = e.target.value;
    setFormData(prev => ({
      ...prev,
      closure_scope: scope,
      location_resource_id: scope === 'resource' ? prev.location_resource_id : null,
      resource_type: scope === 'resource_type' ? prev.resource_type : null
    }));
  };

  const handleResourceTypeChange = (e) => {
    setFormData(prev => ({
      ...prev,
      resource_type: e.target.value
    }));
  };

  const handleResourceChange = (e) => {
    setFormData(prev => ({
      ...prev,
      location_resource_id: e.target.value ? parseInt(e.target.value) : null
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const closureData = {
        partner_uuid: profile.partner_uuid,
        closure_scope: formData.closure_scope,
        location_id: formData.closure_scope === 'location' || formData.closure_scope === 'resource_type' 
          ? location.id 
          : null,
        location_resource_id: formData.closure_scope === 'resource' 
          ? formData.location_resource_id 
          : null,
        resource_type: formData.closure_scope === 'resource_type' 
          ? formData.resource_type 
          : null,
        closure_start_date: formData.closure_start_date,
        closure_end_date: formData.closure_end_date,
        closure_type: formData.closure_type,
        closure_reason: formData.closure_reason,
        is_recurring: formData.is_recurring,
        created_by: user.id,
        updated_by: user.id
      };

      let result;
      if (closure) {
        result = await supabase
          .from('operating_closures')
          .update(closureData)
          .eq('id', closure.id)
          .select();
      } else {
        result = await supabase
          .from('operating_closures')
          .insert([closureData])
          .select();
      }

      const { error } = result;
      if (error) throw error;

      toast.success(closure ? t('calendar.closureUpdated') : t('calendar.closureCreated'));
      onSuccess();
    } catch (error) {
      logger.error('Error saving closure:', error);
      toast.error(t('messages.errorSavingClosure'));
    } finally {
      setLoading(false);
    }
  };

  // Options for closure scope dropdown
  const scopeOptions = [
    { value: 'location', label: t('calendar.entireLocation') },
    { value: 'resource_type', label: t('calendar.allResourcesOfType') },
    { value: 'resource', label: t('calendar.specificResource') }
  ];

  // Options for closure type dropdown
  const typeOptions = [
    { value: 'holiday', label: t('calendar.holiday') },
    { value: 'maintenance', label: t('calendar.maintenance') },
    { value: 'special_event', label: t('calendar.specialEvent') },
    { value: 'emergency', label: t('calendar.emergency') },
    { value: 'custom', label: t('calendar.custom') }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content closure-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <Calendar size={20} />
            {closure ? t('calendar.editClosure') : t('calendar.addNewClosure')}
          </h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="closure-form">
              {/* Closure Scope */}
              <div className="closure-form-group">
                <label className="closure-form-label required">{t('calendar.closureScope')}</label>
                <Select
                  value={formData.closure_scope}
                  onChange={handleScopeChange}
                  options={scopeOptions}
                  placeholder={t('common.select')}
                />
              </div>

              {/* Resource Type Selection */}
              {formData.closure_scope === 'resource_type' && (
                <div className="closure-form-group">
                  <label className="closure-form-label required">{t('calendar.resourceType')}</label>
                  <Select
                    value={formData.resource_type || ''}
                    onChange={handleResourceTypeChange}
                    options={[
                      { value: 'scrivania', label: t('locations.allDesks') },
                      { value: 'sala_riunioni', label: t('locations.allMeetingRooms') }
                    ]}
                    placeholder={t('common.select')}
                  />
                </div>
              )}

              {/* Specific Resource Selection */}
              {formData.closure_scope === 'resource' && (
                <div className="closure-form-group">
                  <label className="closure-form-label required">{t('calendar.selectResource')}</label>
                  <Select
                    value={formData.location_resource_id ? String(formData.location_resource_id) : ''}
                    onChange={handleResourceChange}
                    options={resources.map(resource => ({
                      value: String(resource.id),
                      label: `${resource.resource_name} (${resource.resource_type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni')})`
                    }))}
                    placeholder={t('common.select')}
                    emptyMessage={t('calendar.noResourcesInLocation')}
                  />
                </div>
              )}

              {/* Date Range */}
              <div className="date-range-group">
                <div className="closure-form-group">
                  <label className="closure-form-label required">{t('calendar.startDate')}</label>
                  <input
                    type="date"
                    name="closure_start_date"
                    className="closure-form-input"
                    value={formData.closure_start_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="closure-form-group">
                  <label className="closure-form-label required">{t('calendar.endDate')}</label>
                  <input
                    type="date"
                    name="closure_end_date"
                    className="closure-form-input"
                    value={formData.closure_end_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Closure Type */}
              <div className="closure-form-group">
                <label className="closure-form-label required">{t('calendar.closureType')}</label>
                <Select
                  value={formData.closure_type}
                  onChange={(e) => handleChange({ target: { name: 'closure_type', value: e.target.value } })}
                  options={typeOptions}
                  placeholder={t('common.select')}
                />
              </div>

              {/* Closure Reason */}
              <div className="closure-form-group">
                <label className="closure-form-label">{t('calendar.reason')}</label>
                <textarea
                  name="closure_reason"
                  className="closure-form-textarea"
                  value={formData.closure_reason}
                  onChange={handleChange}
                  placeholder={t('calendar.closureReasonPlaceholder')}
                  rows="3"
                />
              </div>

              {/* Recurring Checkbox */}
              <div className="closure-form-checkbox-group">
                <input
                  type="checkbox"
                  id="is_recurring"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleChange}
                />
                <label htmlFor="is_recurring">
                  {t('calendar.recurringAnnually')}
                </label>
              </div>
              {formData.is_recurring && (
                <p className="closure-form-help-text">
                  {t('calendar.recurringHelpText')}
                </p>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>{t('common.saving')}...</>
              ) : (
                <>
                  <Save size={16} />
                  {closure ? t('common.save') : t('common.create')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClosureModal;