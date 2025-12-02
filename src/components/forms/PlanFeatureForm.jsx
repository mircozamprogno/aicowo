import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const PlanFeatureForm = ({ isOpen, onClose, onSuccess, feature = null }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isEditing = !!feature;
  
  const [formData, setFormData] = useState({
    feature_name: '',
    feature_key: '',
    feature_description: '',
    feature_type: 'boolean',
    feature_category: 'limits',
    default_value: '',
    is_active: true,
    display_order: 0
  });
  
  const [loading, setLoading] = useState(false);

  // Available categories and their labels
  const categories = [
    { value: 'limits', label: t('planFeatures.categories.limits') || 'Limits' },
    { value: 'integrations', label: t('planFeatures.categories.integrations') || 'Integrations' },
    { value: 'access_control', label: t('planFeatures.categories.access_control') || 'Access Control' },
    { value: 'support', label: t('planFeatures.categories.support') || 'Support' },
    { value: 'storage', label: t('planFeatures.categories.storage') || 'Storage' },
    { value: 'analytics', label: t('planFeatures.categories.analytics') || 'Analytics' }
  ];

  // Update form data when feature changes
  useEffect(() => {
    if (feature) {
      logger.log('Loading feature data for editing:', feature);
      setFormData({
        feature_name: feature.feature_name || '',
        feature_key: feature.feature_key || '',
        feature_description: feature.feature_description || '',
        feature_type: feature.feature_type || 'boolean',
        feature_category: feature.feature_category || 'limits',
        default_value: feature.default_value || '',
        is_active: feature.is_active !== undefined ? feature.is_active : true,
        display_order: feature.display_order || 0
      });
    } else {
      // Reset form for new feature
      logger.log('Resetting form for new feature');
      setFormData({
        feature_name: '',
        feature_key: '',
        feature_description: '',
        feature_type: 'boolean',
        feature_category: 'limits',
        default_value: '',
        is_active: true,
        display_order: 0
      });
    }
  }, [feature]);

  // Update default value when feature type changes
  useEffect(() => {
    if (!isEditing) {
      switch (formData.feature_type) {
        case 'boolean':
          setFormData(prev => ({ ...prev, default_value: 'false' }));
          break;
        case 'numeric':
          setFormData(prev => ({ ...prev, default_value: '0' }));
          break;
        case 'text':
          setFormData(prev => ({ ...prev, default_value: '' }));
          break;
        default:
          break;
      }
    }
  }, [formData.feature_type, isEditing]);

  // Generate feature key from feature name
  const generateFeatureKey = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Auto-generate feature key when name changes (only for new features)
    if (name === 'feature_name' && !isEditing) {
      const generatedKey = generateFeatureKey(value);
      setFormData(prev => ({
        ...prev,
        feature_key: generatedKey
      }));
    }
  };

  const validateForm = () => {
    if (!formData.feature_name.trim()) {
      toast.error(t('messages.featureNameRequired') || 'Feature name is required');
      return false;
    }

    if (!formData.feature_key.trim()) {
      toast.error(t('messages.featureKeyRequired') || 'Feature key is required');
      return false;
    }

    // Validate feature key format
    const keyRegex = /^[a-z0-9_]+$/;
    if (!keyRegex.test(formData.feature_key)) {
      toast.error(t('messages.featureKeyInvalid') || 'Feature key must contain only lowercase letters, numbers, and underscores');
      return false;
    }

    // Validate default value based on type
    if (formData.feature_type === 'boolean') {
      if (!['true', 'false'].includes(formData.default_value)) {
        setFormData(prev => ({ ...prev, default_value: 'false' }));
      }
    } else if (formData.feature_type === 'numeric') {
      if (formData.default_value && isNaN(Number(formData.default_value))) {
        toast.error(t('messages.numericValueRequired') || 'Default value must be a valid number for numeric features');
        return false;
      }
      if (!formData.default_value) {
        setFormData(prev => ({ ...prev, default_value: '0' }));
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        feature_name: formData.feature_name.trim(),
        feature_key: formData.feature_key.trim(),
        feature_description: formData.feature_description.trim() || null,
        default_value: formData.feature_type === 'text' && !formData.default_value ? null : formData.default_value,
        display_order: parseInt(formData.display_order) || 0,
        created_by_user_id: user?.id
      };

      let result;
      
      if (isEditing) {
        // Update existing feature
        result = await supabase
          .from('partners_plan_features')
          .update(submitData)
          .eq('id', feature.id)
          .select()
          .single();
      } else {
        // Create new feature - check for duplicate key first
        const { data: existingFeature } = await supabase
          .from('partners_plan_features')
          .select('id')
          .eq('feature_key', submitData.feature_key)
          .single();

        if (existingFeature) {
          toast.error(t('messages.featureKeyExists') || 'A feature with this key already exists');
          setLoading(false);
          return;
        }

        result = await supabase
          .from('partners_plan_features')
          .insert([submitData])
          .select()
          .single();
      }

      const { data, error } = result;

      if (error) {
        logger.error('Error saving feature:', error);
        throw error;
      }

      toast.success(
        isEditing 
          ? t('messages.featureUpdatedSuccessfully') || 'Feature updated successfully'
          : t('messages.featureCreatedSuccessfully') || 'Feature created successfully'
      );
      
      onSuccess(data);
      onClose();
    } catch (error) {
      logger.error('Error saving feature:', error);
      toast.error(error.message || (isEditing ? t('messages.errorUpdatingFeature') : t('messages.errorCreatingFeature')));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? t('planFeatures.editFeature') : t('planFeatures.addFeature')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section">
            <h3 className="form-section-title">{t('planFeatures.basicInformation')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="feature_name" className="form-label">
                  {t('planFeatures.featureName')} *
                </label>
                <input
                  id="feature_name"
                  name="feature_name"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g., Maximum Locations"
                  value={formData.feature_name}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="feature_key" className="form-label">
                  {t('planFeatures.featureKey')} *
                </label>
                <input
                  id="feature_key"
                  name="feature_key"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g., max_locations"
                  value={formData.feature_key}
                  onChange={handleChange}
                  disabled={isEditing} // Don't allow key changes when editing
                />
                <small className="form-help">
                  {t('planFeatures.keyHelp')}
                </small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="feature_description" className="form-label">
                {t('planFeatures.featureDescription')}
              </label>
              <textarea
                id="feature_description"
                name="feature_description"
                className="form-input"
                rows="3"
                placeholder="Describe what this feature controls..."
                value={formData.feature_description}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t('planFeatures.featureSettings')}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="feature_type" className="form-label">
                  {t('planFeatures.featureType')} *
                </label>
                <select
                  id="feature_type"
                  name="feature_type"
                  required
                  className="form-select"
                  value={formData.feature_type}
                  onChange={handleChange}
                  disabled={isEditing} // Don't allow type changes when editing
                >
                  <option value="boolean">{t('planFeatures.featureTypes.boolean')}</option>
                  <option value="numeric">{t('planFeatures.featureTypes.numeric')}</option>
                  <option value="text">{t('planFeatures.featureTypes.text')}</option>
                </select>
                <small className="form-help">
                  {t('planFeatures.examples.' + formData.feature_type)}
                </small>
              </div>
              
              <div className="form-group">
                <label htmlFor="feature_category" className="form-label">
                  {t('planFeatures.featureCategory')} *
                </label>
                <select
                  id="feature_category"
                  name="feature_category"
                  required
                  className="form-select"
                  value={formData.feature_category}
                  onChange={handleChange}
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <small className="form-help">
                  {t('planFeatures.categoryHelp')}
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="default_value" className="form-label">
                  {t('planFeatures.defaultValue')}
                </label>
                {formData.feature_type === 'boolean' ? (
                  <select
                    id="default_value"
                    name="default_value"
                    className="form-select"
                    value={formData.default_value}
                    onChange={handleChange}
                  >
                    <option value="false">No / False</option>
                    <option value="true">Yes / True</option>
                  </select>
                ) : formData.feature_type === 'numeric' ? (
                  <input
                    id="default_value"
                    name="default_value"
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={formData.default_value}
                    onChange={handleChange}
                  />
                ) : (
                  <input
                    id="default_value"
                    name="default_value"
                    type="text"
                    className="form-input"
                    placeholder="Default text value (optional)"
                    value={formData.default_value}
                    onChange={handleChange}
                  />
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="display_order" className="form-label">
                  {t('planFeatures.displayOrder')}
                </label>
                <input
                  id="display_order"
                  name="display_order"
                  type="number"
                  min="0"
                  className="form-input"
                  placeholder="0"
                  value={formData.display_order}
                  onChange={handleChange}
                />
                <small className="form-help">
                  {t('planFeatures.orderHelp')}
                </small>
              </div>
            </div>

            <div className="form-group">
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="form-checkbox"
                />
                <span className="checkbox-text">
                  {t('planFeatures.isActive')}
                </span>
              </label>
              <small className="form-help">
                Inactive features won't be available for assignment to pricing plans
              </small>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading 
                ? (isEditing ? t('common.updating') + '...' : t('common.creating') + '...') 
                : (isEditing ? t('common.save') : t('common.create'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanFeatureForm;