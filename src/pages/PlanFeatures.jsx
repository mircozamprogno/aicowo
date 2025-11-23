import { Edit, Layers, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import PlanFeatureForm from '../components/forms/PlanFeatureForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

import logger from '../utils/logger';

const PlanFeatures = () => {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [featureToDelete, setFeatureToDelete] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const { profile } = useAuth();
  const { t } = useTranslation();

  // Check if user is superadmin
  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      fetchFeatures();
    }
  }, [isSuperAdmin]);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_plan_features')
        .select('*')
        .order('display_order', { ascending: true })
        .order('feature_name', { ascending: true });

      if (error) {
        logger.error('Error fetching features:', error);
        // Mock data for development
        setFeatures([
          {
            id: 1,
            feature_name: 'Max Locations',
            feature_key: 'max_locations',
            feature_description: 'Maximum number of locations allowed',
            feature_type: 'numeric',
            feature_category: 'limits',
            default_value: '0',
            is_active: true,
            display_order: 1,
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            feature_name: 'WiFi Management',
            feature_key: 'wifi_management',
            feature_description: 'Ability to manage WiFi access controls',
            feature_type: 'boolean',
            feature_category: 'access_control',
            default_value: 'false',
            is_active: true,
            display_order: 2,
            created_at: new Date().toISOString()
          },
          {
            id: 3,
            feature_name: 'Support Level',
            feature_key: 'support_level',
            feature_description: 'Level of customer support provided',
            feature_type: 'text',
            feature_category: 'support',
            default_value: null,
            is_active: true,
            display_order: 3,
            created_at: new Date().toISOString()
          }
        ]);
      } else {
        setFeatures(data || []);
      }
    } catch (error) {
      logger.error('Error fetching features:', error);
      toast.error(t('messages.errorLoadingFeatures') || 'Error loading features');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeature = () => {
    setEditingFeature(null);
    setShowForm(true);
  };

  const handleEditFeature = (feature) => {
    setEditingFeature(feature);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingFeature(null);
  };

  const handleFormSuccess = (savedFeature) => {
    if (editingFeature) {
      setFeatures(prev => 
        prev.map(f => f.id === savedFeature.id ? savedFeature : f)
      );
      toast.success(t('messages.featureUpdatedSuccessfully') || 'Feature updated successfully');
    } else {
      setFeatures(prev => [savedFeature, ...prev]);
      toast.success(t('messages.featureCreatedSuccessfully') || 'Feature created successfully');
    }
    setShowForm(false);
    setEditingFeature(null);
  };

  const handleDeleteFeature = (feature) => {
    setFeatureToDelete(feature);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('partners_plan_features')
        .delete()
        .eq('id', featureToDelete.id);

      if (error) {
        logger.error('Error deleting feature:', error);
        toast.error(t('messages.errorDeletingFeature') || 'Error deleting feature');
        return;
      }

      setFeatures(prev => prev.filter(f => f.id !== featureToDelete.id));
      toast.success(t('messages.featureDeletedSuccessfully') || 'Feature deleted successfully');
    } catch (error) {
      logger.error('Error deleting feature:', error);
      toast.error(t('messages.errorDeletingFeature') || 'Error deleting feature');
    } finally {
      setShowDeleteConfirm(false);
      setFeatureToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setFeatureToDelete(null);
  };

  const getFeatureTypeLabel = (type) => {
    return t(`planFeatures.featureTypes.${type}`) || type;
  };

  const getCategoryLabel = (category) => {
    return t(`planFeatures.categories.${category}`) || category;
  };

  const getFeatureTypeIcon = (type) => {
    switch (type) {
      case 'boolean':
        return '✓';
      case 'numeric':
        return '#';
      case 'text':
        return 'T';
      default:
        return '?';
    }
  };

  const formatDefaultValue = (type, value) => {
    if (!value) return '-';
    
    switch (type) {
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

  // Filter features
  const filteredFeatures = features.filter(feature => {
    const categoryMatch = selectedCategory === 'all' || feature.feature_category === selectedCategory;
    const typeMatch = selectedType === 'all' || feature.feature_type === selectedType;
    return categoryMatch && typeMatch;
  });

  // Get unique categories and types for filters
  const uniqueCategories = [...new Set(features.map(f => f.feature_category))].filter(Boolean);
  const uniqueTypes = [...new Set(features.map(f => f.feature_type))].filter(Boolean);

  // Access control
  if (!isSuperAdmin) {
    return (
      <div className="plan-features-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>Only super administrators can manage plan features.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="plan-features-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="plan-features-page">
      <div className="plan-features-header">
        <div className="plan-features-header-content">
          <h1 className="plan-features-title">
            <Layers size={24} className="mr-2" />
            {t('planFeatures.title')}
          </h1>
          <p className="plan-features-description">
            {t('planFeatures.subtitle')}
          </p>
          <div className="plan-features-stats">
            <div className="stat-item">
              <span className="stat-label">{t('planFeatures.totalFeatures')}</span>
              <span className="stat-value">{features.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('planFeatures.activeFeatures')}</span>
              <span className="stat-value">
                {features.filter(f => f.is_active).length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('planFeatures.categoriesCount')}</span>
              <span className="stat-value">{uniqueCategories ? uniqueCategories.length : 0}</span>
            </div>
          </div>
        </div>
        <div className="plan-features-header-actions">
          <button className="add-feature-btn" onClick={handleAddFeature}>
            <Plus size={16} className="mr-2" />
            {t('planFeatures.addFeature')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="plan-features-filters">
        <div className="filter-group">
          <label htmlFor="category-filter" className="filter-label">
            {t('planFeatures.featureCategory')}:
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('common.all')}</option>
            {uniqueCategories.map(category => (
              <option key={category} value={category}>
                {getCategoryLabel(category)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="type-filter" className="filter-label">
            {t('planFeatures.featureType')}:
          </label>
          <select
            id="type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('common.all')}</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {getFeatureTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="plan-features-table-container">
        <div className="plan-features-table-wrapper">
          <table className="plan-features-table">
            <thead className="plan-features-table-head">
              <tr>
                <th className="plan-features-table-header">
                  {t('planFeatures.featureName')}
                </th>
                <th className="plan-features-table-header">
                  {t('planFeatures.featureKey')}
                </th>
                <th className="plan-features-table-header">
                  {t('planFeatures.featureType')}
                </th>
                <th className="plan-features-table-header">
                  {t('planFeatures.featureCategory')}
                </th>
                <th className="plan-features-table-header">
                  {t('planFeatures.defaultValue')}
                </th>
                <th className="plan-features-table-header">
                  {t('planFeatures.isActive')}
                </th>
                <th className="plan-features-table-header">
                  {t('planFeatures.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="plan-features-table-body">
              {filteredFeatures.map((feature) => (
                <tr key={feature.id} className="plan-features-table-row">
                  <td className="plan-features-table-cell">
                    <div className="feature-info">
                      <div className="feature-name">{feature.feature_name}</div>
                      {feature.feature_description && (
                        <div className="feature-description">{feature.feature_description}</div>
                      )}
                    </div>
                  </td>
                  <td className="plan-features-table-cell">
                    <code className="feature-key">{feature.feature_key}</code>
                  </td>
                  <td className="plan-features-table-cell">
                    <span className={`feature-type-badge feature-type-${feature.feature_type}`}>
                      <span className="feature-type-icon">{getFeatureTypeIcon(feature.feature_type)}</span>
                      {getFeatureTypeLabel(feature.feature_type)}
                    </span>
                  </td>
                  <td className="plan-features-table-cell">
                    <span className="feature-category">
                      {getCategoryLabel(feature.feature_category)}
                    </span>
                  </td>
                  <td className="plan-features-table-cell">
                    <span className="default-value">
                      {formatDefaultValue(feature.feature_type, feature.default_value)}
                    </span>
                  </td>
                  <td className="plan-features-table-cell">
                    <span className={`status-badge ${feature.is_active ? 'status-active' : 'status-inactive'}`}>
                      {feature.is_active ? t('common.yes') : t('common.no')}
                    </span>
                  </td>
                  <td className="plan-features-table-cell">
                    <div className="feature-actions">
                      <button 
                        className="edit-btn"
                        onClick={() => handleEditFeature(feature)}
                        title={t('planFeatures.editFeature')}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteFeature(feature)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFeatures.length === 0 && (
            <div className="plan-features-empty">
              <Layers size={48} className="empty-icon" />
              <p>{features.length === 0 ? t('planFeatures.noFeaturesFound') : 'No features match the current filters'}</p>
              {features.length === 0 && (
                <button 
                  onClick={handleAddFeature}
                  className="btn-primary mt-4"
                >
                  {t('planFeatures.addFirstFeature')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feature Form Modal */}
      <PlanFeatureForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        feature={editingFeature}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && featureToDelete && (
        <div className="modal-overlay">
          <div className="modal-container delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {t('common.confirmDelete')}
              </h2>
              <button onClick={handleDeleteCancel} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="delete-modal-content">
              <div className="delete-warning">
                <Trash2 size={24} className="warning-icon" />
                <div className="warning-text">
                  <h3>{t('common.warning') || 'Warning'}</h3>
                  <p>Are you sure you want to delete the feature "{featureToDelete.feature_name}"?</p>
                  <p className="warning-note">This action cannot be undone and will remove the feature from all pricing plans.</p>
                </div>
              </div>

              <div className="delete-modal-actions">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="btn-danger"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanFeatures;