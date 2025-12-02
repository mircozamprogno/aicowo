import { Plus, Settings, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const PlanFeaturesModal = ({ isOpen, onClose, plan, onFeaturesUpdated }) => {
  const { t } = useTranslation();
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [assignedFeatures, setAssignedFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState('');
  const [featureValue, setFeatureValue] = useState('');

  useEffect(() => {
    if (isOpen && plan) {
      fetchFeatures();
      fetchAssignedFeatures();
    }
  }, [isOpen, plan]);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_plan_features')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('feature_name', { ascending: true });

      if (error) {
        logger.error('Error fetching features:', error);
        // Mock data for development
        setAvailableFeatures([
          {
            id: 1,
            feature_name: 'Max Locations',
            feature_key: 'max_locations',
            feature_type: 'numeric',
            feature_category: 'limits',
            default_value: '0'
          },
          {
            id: 2,
            feature_name: 'WiFi Management',
            feature_key: 'wifi_management',
            feature_type: 'boolean',
            feature_category: 'access_control',
            default_value: 'false'
          },
          {
            id: 3,
            feature_name: 'Support Level',
            feature_key: 'support_level',
            feature_type: 'text',
            feature_category: 'support',
            default_value: null
          }
        ]);
      } else {
        setAvailableFeatures(data || []);
      }
    } catch (error) {
      logger.error('Error fetching features:', error);
    }
  };

  const fetchAssignedFeatures = async () => {
    if (!plan?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partners_plan_feature_mappings')
        .select(`
          *,
          partners_plan_features (
            id,
            feature_name,
            feature_key,
            feature_type,
            feature_category,
            default_value
          )
        `)
        .eq('plan_id', plan.id)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching assigned features:', error);
        // Mock data for development
        setAssignedFeatures([
          {
            id: 1,
            plan_id: plan.id,
            feature_id: 1,
            feature_value: '5',
            partners_plan_features: {
              id: 1,
              feature_name: 'Max Locations',
              feature_key: 'max_locations',
              feature_type: 'numeric',
              feature_category: 'limits'
            }
          },
          {
            id: 2,
            plan_id: plan.id,
            feature_id: 2,
            feature_value: 'true',
            partners_plan_features: {
              id: 2,
              feature_name: 'WiFi Management',
              feature_key: 'wifi_management',
              feature_type: 'boolean',
              feature_category: 'access_control'
            }
          }
        ]);
      } else {
        setAssignedFeatures(data || []);
      }
    } catch (error) {
      logger.error('Error fetching assigned features:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeature = async () => {
    if (!selectedFeature || !plan?.id) return;

    // Check if feature is already assigned
    const isAlreadyAssigned = assignedFeatures.some(af => 
      af.feature_id === parseInt(selectedFeature)
    );

    if (isAlreadyAssigned) {
      toast.error(t('messages.featureAlreadyAssigned') || 'This feature is already assigned to this plan');
      return;
    }

    setSaving(true);
    try {
      const feature = availableFeatures.find(f => f.id === parseInt(selectedFeature));
      let valueToSave = featureValue;

      // Use default value if no value provided
      if (!valueToSave) {
        valueToSave = feature.default_value || '';
        if (feature.feature_type === 'boolean' && !valueToSave) {
          valueToSave = 'false';
        } else if (feature.feature_type === 'numeric' && !valueToSave) {
          valueToSave = '0';
        }
      }

      const { data, error } = await supabase
        .from('partners_plan_feature_mappings')
        .insert([{
          plan_id: plan.id,
          feature_id: parseInt(selectedFeature),
          feature_value: valueToSave
        }])
        .select(`
          *,
          partners_plan_features (
            id,
            feature_name,
            feature_key,
            feature_type,
            feature_category,
            default_value
          )
        `)
        .single();

      if (error) {
        logger.error('Error adding feature:', error);
        toast.error(t('messages.errorAddingFeature') || 'Error adding feature');
        return;
      }

      setAssignedFeatures(prev => [...prev, data]);
      setSelectedFeature('');
      setFeatureValue('');
      toast.success(t('messages.featureAddedSuccessfully') || 'Feature added successfully');
      
      if (onFeaturesUpdated) {
        onFeaturesUpdated();
      }
    } catch (error) {
      logger.error('Error adding feature:', error);
      toast.error(t('messages.errorAddingFeature') || 'Error adding feature');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFeature = async (mappingId) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('partners_plan_feature_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) {
        logger.error('Error removing feature:', error);
        toast.error(t('messages.errorRemovingFeature') || 'Error removing feature');
        return;
      }

      setAssignedFeatures(prev => prev.filter(af => af.id !== mappingId));
      toast.success(t('messages.featureRemovedSuccessfully') || 'Feature removed successfully');
      
      if (onFeaturesUpdated) {
        onFeaturesUpdated();
      }
    } catch (error) {
      logger.error('Error removing feature:', error);
      toast.error(t('messages.errorRemovingFeature') || 'Error removing feature');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFeatureValue = async (mappingId, newValue) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('partners_plan_feature_mappings')
        .update({ feature_value: newValue })
        .eq('id', mappingId);

      if (error) {
        logger.error('Error updating feature value:', error);
        toast.error(t('messages.errorUpdatingFeature') || 'Error updating feature');
        return;
      }

      setAssignedFeatures(prev => 
        prev.map(af => 
          af.id === mappingId ? { ...af, feature_value: newValue } : af
        )
      );
      
      toast.success(t('messages.featureUpdatedSuccessfully') || 'Feature updated successfully');
    } catch (error) {
      logger.error('Error updating feature value:', error);
      toast.error(t('messages.errorUpdatingFeature') || 'Error updating feature');
    } finally {
      setSaving(false);
    }
  };

  const formatFeatureValue = (feature, value) => {
    if (!value && value !== '0' && value !== 'false') return '-';
    
    switch (feature.feature_type) {
      case 'boolean':
        return value === 'true' ? 'Yes' : 'No';
      case 'numeric':
        return value;
      case 'text':
        return value;
      default:
        return value;
    }
  };

  const getFeatureInput = (feature, value, onChange) => {
    switch (feature.feature_type) {
      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="feature-input"
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        );
      case 'numeric':
        return (
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="feature-input"
            placeholder="0"
          />
        );
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="feature-input"
            placeholder="Enter value"
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="feature-input"
          />
        );
    }
  };

  const getAvailableFeaturesToAdd = () => {
    const assignedFeatureIds = assignedFeatures.map(af => af.feature_id);
    return availableFeatures.filter(f => !assignedFeatureIds.includes(f.id));
  };

  const selectedFeatureObj = availableFeatures.find(f => f.id === parseInt(selectedFeature));

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container plan-features-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            <Settings size={20} className="mr-2" />
            {t('pricingPlans.manageFeaturesFor')} "{plan?.plan_name}"
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <span>{t('common.loading')}</span>
            </div>
          ) : (
            <>
              {/* Add New Feature Section */}
              <div className="add-feature-section">
                <h3 className="section-title">{t('pricingPlans.addFeature')}</h3>
                
                <div className="add-feature-form">
                  <div className="feature-select-group">
                    <select
                      value={selectedFeature}
                      onChange={(e) => {
                        setSelectedFeature(e.target.value);
                        setFeatureValue(''); // Reset value when feature changes
                      }}
                      className="feature-select"
                    >
                      <option value="">{t('pricingPlans.selectFeature')}</option>
                      {getAvailableFeaturesToAdd().map(feature => (
                        <option key={feature.id} value={feature.id}>
                          {feature.feature_name} ({feature.feature_type})
                        </option>
                      ))}
                    </select>
                    
                    {selectedFeatureObj && (
                      <div className="feature-value-input">
                        {getFeatureInput(
                          selectedFeatureObj,
                          featureValue || selectedFeatureObj.default_value || '',
                          setFeatureValue
                        )}
                      </div>
                    )}
                    
                    <button
                      onClick={handleAddFeature}
                      disabled={!selectedFeature || saving}
                      className="add-feature-btn"
                    >
                      <Plus size={16} />
                      {t('common.add')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Assigned Features List */}
              <div className="assigned-features-section">
                <h3 className="section-title">
                  {t('pricingPlans.assignedFeatures')} ({assignedFeatures.length})
                </h3>
                
                {assignedFeatures.length === 0 ? (
                  <div className="empty-features">
                    <p>{t('pricingPlans.noFeaturesAssigned')}</p>
                  </div>
                ) : (
                  <div className="features-list">
                    {assignedFeatures.map((assignedFeature) => {
                      const feature = assignedFeature.partners_plan_features;
                      
                      return (
                        <div key={assignedFeature.id} className="feature-item">
                          <div className="feature-info">
                            <div className="feature-name">{feature.feature_name}</div>
                            <div className="feature-details">
                              <span className="feature-key">{feature.feature_key}</span>
                              <span className="feature-type">({feature.feature_type})</span>
                              <span className="feature-category">{feature.feature_category}</span>
                            </div>
                          </div>
                          
                          <div className="feature-value-section">
                            {getFeatureInput(
                              feature,
                              assignedFeature.feature_value,
                              (newValue) => handleUpdateFeatureValue(assignedFeature.id, newValue)
                            )}
                          </div>
                          
                          <div className="feature-actions">
                            <button
                              onClick={() => handleRemoveFeature(assignedFeature.id)}
                              disabled={saving}
                              className="remove-feature-btn"
                              title={t('common.remove')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={saving}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanFeaturesModal;