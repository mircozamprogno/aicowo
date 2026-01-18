import { Edit, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import '../../styles/components/resources-manager.css';
import { logActivity } from '../../utils/activityLogger';
import logger from '../../utils/logger';
import ConfirmModal from '../common/ConfirmModal';
import { toast } from '../common/ToastContainer';

const ResourcesManager = ({ partnerUuid }) => {
    const { t } = useTranslation();
    const [resources, setResources] = useState([]);
    const [locations, setLocations] = useState([]);
    const [resourceTypes, setResourceTypes] = useState([]); // New state for types
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [resourceToDelete, setResourceToDelete] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        resource_name: '',
        resource_type: 'scrivania',
        custom_type: '',
        location_id: '',
        description: '',
        quantity: 1, // Default to 1 for new granular resources
        is_available: true
    });

    useEffect(() => {
        if (partnerUuid) {
            fetchLocations();
            fetchResourceTypes();
            fetchResources();
        }
    }, [partnerUuid]);

    const fetchResourceTypes = async () => {
        try {
            const { data, error } = await supabase
                .from('partner_resource_types')
                .select('*')
                .eq('partner_uuid', partnerUuid)
                .order('type_name');

            if (error) throw error;
            setResourceTypes(data || []);
        } catch (error) {
            logger.error('Error fetching resource types:', error);
        }
    };

    const fetchLocations = async () => {
        try {
            const { data, error } = await supabase
                .from('locations')
                .select('id, location_name')
                .eq('partner_uuid', partnerUuid)
                .order('location_name');

            if (error) throw error;
            setLocations(data || []);
        } catch (error) {
            logger.error('Error fetching locations:', error);
        }
    };

    const fetchResources = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('location_resources')
                .select(`
          *,
          locations (
            id,
            location_name
          )
        `)
                .eq('partner_uuid', partnerUuid)
                .order('resource_type')
                .order('resource_name');

            if (error) throw error;
            setResources(data || []);
        } catch (error) {
            logger.error('Error fetching resources:', error);
            toast.error(t('settings.errorLoadingResources'));
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (resource) => {
        setEditingResource(resource);

        // Check if the type exists in our list, otherwise it might be a legacy one or missing
        // For simplicity, we assume the code matches.
        setFormData({
            resource_name: resource.resource_name,
            resource_type: resource.resource_type,
            location_id: resource.location_id,
            description: resource.description || '',
            quantity: resource.quantity,
            is_available: resource.is_available
        });
        setShowModal(true);
    };

    const handleAddNew = () => {
        setEditingResource(null);
        setFormData({
            resource_name: '',
            resource_type: resourceTypes.length > 0 ? resourceTypes[0].type_code : 'scrivania',
            location_id: locations.length > 0 ? locations[0].id : '',
            description: '',
            quantity: 1, // Default 1 for granular
            is_available: true
        });
        setShowModal(true);
    };

    const handleDelete = (resource) => {
        setResourceToDelete(resource);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!resourceToDelete) return;

        try {
            const { error } = await supabase
                .from('location_resources')
                .delete()
                .eq('id', resourceToDelete.id);

            if (error) throw error;

            await logActivity({
                action_category: 'settings',
                action_type: 'deleted',
                entity_type: 'location_resources',
                entity_id: resourceToDelete.id,
                description: `Deleted resource: ${resourceToDelete.resource_name}`
            });

            toast.success(t('common.deletedSuccessfully'));
            fetchResources();
        } catch (error) {
            logger.error('Error deleting resource:', error);
            toast.error(t('settings.errorDeletingResource'));
        } finally {
            setShowDeleteConfirm(false);
            setResourceToDelete(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const finalResourceType = formData.resource_type;

        if (!finalResourceType) {
            toast.error(t('settings.resourceTypeRequired'));
            return;
        }

        try {
            const resourceData = {
                partner_uuid: partnerUuid,
                location_id: formData.location_id,
                resource_name: formData.resource_name,
                resource_type: finalResourceType.toLowerCase(),
                description: formData.description,
                is_available: formData.is_available,
                quantity: formData.quantity
            };

            if (editingResource) {
                const { error } = await supabase
                    .from('location_resources')
                    .update(resourceData)
                    .eq('id', editingResource.id);

                if (error) throw error;

                await logActivity({
                    action_category: 'settings',
                    action_type: 'updated',
                    entity_type: 'location_resources',
                    entity_id: editingResource.id,
                    description: `Updated resource: ${formData.resource_name}`
                });

                toast.success(t('common.savedSuccessfully'));
            } else {
                const { error } = await supabase
                    .from('location_resources')
                    .insert([resourceData]);

                if (error) throw error;

                toast.success(t('common.createdSuccessfully'));
            }

            setShowModal(false);
            fetchResources();
        } catch (error) {
            logger.error('Error saving resource:', error);
            toast.error(t('common.errorSaving'));
        }
    };

    const ResourceModal = () => (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {editingResource ? t('settings.editResource') : t('settings.addResource')}
                    </h2>
                    <button onClick={() => setShowModal(false)} className="modal-close-btn">
                        ✖
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="modal-content">
                    <div className="form-group">
                        <label>{t('settings.resourceName')}</label>
                        <input
                            type="text"
                            value={formData.resource_name}
                            onChange={(e) => setFormData({ ...formData, resource_name: e.target.value })}
                            required
                            className="form-input"
                            placeholder="e.g. Scrivania 1, Stampante HP..."
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('settings.resourceType')}</label>
                        <select
                            value={formData.resource_type}
                            onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
                            className="form-select"
                        >
                            {resourceTypes.map(type => (
                                <option key={type.id} value={type.type_code}>
                                    {type.type_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>{t('settings.location')}</label>
                        <select
                            value={formData.location_id}
                            onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                            required
                            className="form-select"
                        >
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group half">
                            <label>
                                {t('settings.quantity')}
                                <span className="info-text">({t('settings.quantityGranularHint')})</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                                className="form-input"
                                disabled={!editingResource} // Recommend keeping 1 for new items
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('settings.description')}</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="form-textarea"
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="btn-primary">
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="resources-manager">
            <div className="manager-header">
                <h3>{t('settings.manageResources')}</h3>
                <button onClick={handleAddNew} className="btn-primary">
                    <Plus size={16} />
                    {t('settings.addResource')}
                </button>
            </div>

            <div className="resources-list-container">
                {loading ? (
                    <div className="loading-spinner"></div>
                ) : (
                    <table className="resources-table">
                        <thead>
                            <tr>
                                <th>{t('settings.resourceName')}</th>
                                <th>{t('settings.type')}</th>
                                <th>{t('settings.location')}</th>
                                <th>{t('settings.quantity')}</th>
                                <th>{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resources.map(resource => (
                                <tr key={resource.id}>
                                    <td>
                                        <span className="resource-name-cell">{resource.resource_name}</span>
                                    </td>
                                    <td>
                                        <span className="resource-type-badge">{resource.resource_type}</span>
                                    </td>
                                    <td>{resource.locations?.location_name}</td>
                                    <td>
                                        {resource.quantity > 1 ? (
                                            <span className="pool-badge" title="Legacy Pool">{resource.quantity}</span>
                                        ) : (
                                            resource.quantity
                                        )}
                                    </td>
                                    <td className="actions-cell">
                                        <button onClick={() => handleEdit(resource)} className="btn-icon">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(resource)} className="btn-icon delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && <ResourceModal />}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title={t('settings.deleteResourceTypes')}
                message={t('settings.deleteResourceConfirm', { name: resourceToDelete?.resource_name })}
            />
        </div>
    );
};

export default ResourcesManager;
