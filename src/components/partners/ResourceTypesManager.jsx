import { Edit, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import '../../styles/components/resources-manager.css'; // Reusing styles
import { logActivity } from '../../utils/activityLogger';
import logger from '../../utils/logger';
import ConfirmModal from '../common/ConfirmModal';
import { toast } from '../common/ToastContainer';

const ResourceTypesManager = ({ partnerUuid }) => {
    const { t } = useTranslation();
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [typeToDelete, setTypeToDelete] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        type_name: '',
        type_code: ''
    });

    useEffect(() => {
        if (partnerUuid) {
            fetchTypes();
        }
    }, [partnerUuid]);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('partner_resource_types')
                .select('*')
                .eq('partner_uuid', partnerUuid)
                .order('type_name');

            if (error) throw error;
            setTypes(data || []);
        } catch (error) {
            logger.error('Error fetching resource types:', error);
            toast.error(t('settings.errorLoadingTypes'));
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (type) => {
        setEditingType(type);
        setFormData({
            type_name: type.type_name,
            type_code: type.type_code
        });
        setShowModal(true);
    };

    const handleAddNew = () => {
        setEditingType(null);
        setFormData({
            type_name: '',
            type_code: ''
        });
        setShowModal(true);
    };

    const handleDelete = (type) => {
        if (['scrivania', 'sala_riunioni'].includes(type.type_code)) {
            toast.error(t('settings.cannotDeleteSystemType'));
            return;
        }
        setTypeToDelete(type);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!typeToDelete) return;

        try {
            const { error } = await supabase
                .from('partner_resource_types')
                .delete()
                .eq('id', typeToDelete.id);

            if (error) throw error;

            await logActivity({
                action_category: 'settings',
                action_type: 'deleted',
                entity_type: 'partner_resource_types',
                entity_id: typeToDelete.id,
                description: `Deleted resource type: ${typeToDelete.type_name}`
            });

            toast.success(t('common.deletedSuccessfully'));
            fetchTypes();
        } catch (error) {
            logger.error('Error deleting resource type:', error);
            toast.error(t('settings.errorDeletingType'));
        } finally {
            setShowDeleteConfirm(false);
            setTypeToDelete(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Auto-generate slug if code is empty (for new items)
        let finalCode = formData.type_code;
        if (!finalCode) {
            finalCode = formData.type_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }

        try {
            const typeData = {
                partner_uuid: partnerUuid,
                type_name: formData.type_name,
                type_code: finalCode
            };

            if (editingType) {
                const { error } = await supabase
                    .from('partner_resource_types')
                    .update({ type_name: formData.type_name }) // Only update name, keep code stable
                    .eq('id', editingType.id);

                if (error) throw error;
                toast.success(t('common.savedSuccessfully'));
            } else {
                const { error } = await supabase
                    .from('partner_resource_types')
                    .insert([typeData]);

                if (error) throw error;
                toast.success(t('common.createdSuccessfully'));
            }

            setShowModal(false);
            fetchTypes();
        } catch (error) {
            logger.error('Error saving resource type:', error);
            toast.error(t('common.errorSaving'));
        }
    };

    return (
        <div className="resources-manager">
            <div className="manager-header">
                <h3>{t('settings.manageResourceTypes')}</h3>
                <button onClick={handleAddNew} className="btn-primary">
                    <Plus size={16} />
                    {t('settings.addType')}
                </button>
            </div>

            <div className="resources-list-container">
                {loading ? (
                    <div className="loading-spinner"></div>
                ) : (
                    <table className="resources-table">
                        <thead>
                            <tr>
                                <th>{t('settings.typeName')}</th>
                                <th>{t('common.edit')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {types.map(type => (
                                <tr key={type.id}>
                                    <td><span className="resource-name-cell">{type.type_name}</span></td>
                                    <td className="actions-cell">
                                        <button onClick={() => handleEdit(type)} className="btn-icon">
                                            <Edit size={16} />
                                        </button>
                                        {!['scrivania', 'sala_riunioni'].includes(type.type_code) && (
                                            <button onClick={() => handleDelete(type)} className="btn-icon delete">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingType ? t('settings.editType') : t('settings.addType')}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="modal-close-btn">✖</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-content">
                            <div className="form-group">
                                <label>{t('settings.typeName')}</label>
                                <input
                                    type="text"
                                    value={formData.type_name}
                                    onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
                                    required
                                    className="form-input"
                                    placeholder="e.g. Studio Privato"
                                    autoFocus
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
            )}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title={t('settings.deleteType')}
                message={t('settings.deleteTypeConfirm', { name: typeToDelete?.type_name })}
            />
        </div>
    );
};

export default ResourceTypesManager;
