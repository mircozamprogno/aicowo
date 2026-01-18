// src/pages/ServiceFormPage.jsx
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { useTourIntegration } from '../hooks/useTourIntegration';
import { supabase } from '../services/supabase';
import '../styles/pages/service-form.css';
import { logActivity } from '../utils/activityLogger';
import logger from '../utils/logger';

const ServiceFormPage = () => {
    const { t } = useTranslation();
    // Manual navigation helper
    const navigate = (path) => {
        window.location.hash = path;
    };

    // Manual params parsing from hash (e.g., #/services/edit?id=123)
    const getParams = () => {
        const hash = window.location.hash;
        if (!hash.includes('?')) return {};
        const queryString = hash.split('?')[1];
        const urlParams = new URLSearchParams(queryString);
        return Object.fromEntries(urlParams.entries());
    };

    const params = getParams();
    const id = params.id;
    const { profile } = useAuth();
    const isEditing = !!id;

    const [formData, setFormData] = useState({
        service_name: '',
        service_description: '',
        service_type: 'abbonamento',
        location_id: '',
        resource_type: '', // Changed from location_resource_id
        cost: '',
        currency: 'EUR',
        duration_days: '30',
        max_entries: '',
        service_status: 'active',
        is_renewable: true,
        auto_renew: false,
        private: false
    });

    const [locations, setLocations] = useState([]);
    const [resourceTypes, setResourceTypes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { onServiceCreated } = useTourIntegration();

    // Load initial data (Locations, Resource Types, and Service if editing)
    useEffect(() => {
        if (profile?.partner_uuid) {
            loadInitialData();
        }
    }, [profile, id]);

    const loadInitialData = async () => {
        setInitialLoading(true);
        try {
            // 1. Fetch Locations
            const { data: locationsData, error: locationsError } = await supabase
                .from('locations')
                .select('id, location_name')
                .eq('partner_uuid', profile.partner_uuid)
                .order('location_name');

            if (locationsError) throw locationsError;
            setLocations(locationsData || []);

            // 2. Fetch Resource Types
            const { data: typesData, error: typesError } = await supabase
                .from('partner_resource_types')
                .select('type_code, type_name')
                .eq('partner_uuid', profile.partner_uuid)
                .order('type_name');

            if (typesError) throw typesError;
            setResourceTypes(typesData || []);

            // 3. Fetch Service if editing
            if (isEditing) {
                const { data: service, error: serviceError } = await supabase
                    .from('services')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (serviceError) throw serviceError;

                if (service) {
                    setFormData({
                        service_name: service.service_name || '',
                        service_description: service.service_description || '',
                        service_type: service.service_type || 'abbonamento',
                        location_id: service.location_id?.toString() || '',
                        resource_type: service.resource_type || '', // Load resource_type
                        cost: service.cost?.toString() || '',
                        currency: service.currency || 'EUR',
                        duration_days: service.duration_days?.toString() || '30',
                        max_entries: service.max_entries?.toString() || '',
                        service_status: service.service_status || 'active',
                        is_renewable: service.is_renewable !== false,
                        auto_renew: service.auto_renew || false,
                        private: service.private || false
                    });
                }
            } else {
                // Default values for new service
                if (locationsData && locationsData.length > 0) {
                    setFormData(prev => ({
                        ...prev,
                        location_id: locationsData[0].id.toString()
                    }));
                }
            }

        } catch (error) {
            logger.error('Error loading data:', error);
            toast.error(t('messages.errorLoadingData'));
        } finally {
            setInitialLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleServiceTypeChange = (e) => {
        const newType = e.target.value;
        setFormData(prev => ({
            ...prev,
            service_type: newType,
            max_entries: newType === 'pacchetto' ? prev.max_entries : '',
            cost: newType === 'free_trial' ? '0' : prev.cost,
            duration_days: newType === 'abbonamento' ? '30' :
                newType === 'pacchetto' ? '90' :
                    newType === 'free_trial' ? '7' :
                        newType === 'giornaliero' ? '1' : prev.duration_days,
            is_renewable: newType === 'giornaliero' ? false : prev.is_renewable,
            auto_renew: newType === 'giornaliero' ? false : prev.auto_renew
        }));
    };

    const formatDuration = (days) => {
        const numDays = parseFloat(days);
        if (numDays === 0.5) return t('services.halfDay');
        if (numDays === 1) return t('services.oneDay');
        return t('services.daysCount', { count: numDays });
    };

    const validateForm = () => {
        if (!formData.service_name.trim()) {
            toast.error(t('messages.serviceNameRequired'));
            return false;
        }
        if (!formData.location_id) {
            toast.error(t('services.selectLocation'));
            return false;
        }
        if (!formData.resource_type) {
            toast.error(t('messages.resourceRequired'));
            return false;
        }
        if (formData.cost === '' || parseFloat(formData.cost) < 0) {
            toast.error(t('messages.validCostRequired'));
            return false;
        }
        // ... other validations same as before
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        try {
            const serviceData = {
                service_name: formData.service_name.trim(),
                service_description: formData.service_description.trim(),
                service_type: formData.service_type,
                location_id: parseInt(formData.location_id),
                resource_type: formData.resource_type, // Save resource_type
                location_resource_id: null, // Clear explicit resource link
                cost: parseFloat(formData.cost),
                currency: formData.currency,
                duration_days: parseFloat(formData.duration_days),
                max_entries: formData.service_type === 'pacchetto' ? parseInt(formData.max_entries) || null : null,
                service_status: formData.service_status,
                is_renewable: formData.is_renewable,
                auto_renew: formData.auto_renew,
                private: formData.private,
                partner_uuid: profile.partner_uuid
            };

            if (isEditing) {
                const { error } = await supabase
                    .from('services')
                    .update(serviceData)
                    .eq('id', id);

                if (error) throw error;
                toast.success(t('messages.serviceUpdatedSuccessfully'));

                await logActivity({
                    action_category: 'service',
                    action_type: 'updated',
                    entity_id: id,
                    entity_type: 'services',
                    description: `Updated service: ${serviceData.service_name}`,
                    metadata: serviceData
                });

            } else {
                const { data, error } = await supabase
                    .from('services')
                    .insert([serviceData])
                    .select()
                    .single();

                if (error) throw error;
                toast.success(t('messages.serviceCreatedSuccessfully'));
                if (onServiceCreated) onServiceCreated(data);

                await logActivity({
                    action_category: 'service',
                    action_type: 'created',
                    entity_id: data.id,
                    entity_type: 'services',
                    description: `Created service: ${serviceData.service_name}`,
                    metadata: serviceData
                });
            }
            navigate('/services');
        } catch (error) {
            logger.error('Error saving service:', error);
            toast.error(error.message || t('messages.errorSavingService'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        // Implement delete logic similar to modal, but redirect after
        setLoading(true);
        try {
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (error) throw error;
            toast.success(t('messages.serviceDeletedSuccessfully'));
            navigate('/services');
        } catch (error) {
            toast.error(t('messages.errorDeletingService'));
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) return <div className="p-8 text-center">{t('common.loading')}</div>;

    return (
        <div className="service-form-page">
            {/* Back Button - Outside the card, more spacing */}
            <div className="service-back-link">
                <button onClick={() => navigate('/services')} className="service-btn-secondary">
                    <ArrowLeft size={18} />
                    {t('common.back')}
                </button>
            </div>

            {/* The White Card Container */}
            <div className="service-form-container">
                <div className="service-form-header">
                    <h2>{isEditing ? t('services.editService') : t('services.addService')}</h2>
                    <p className="text-gray-500">
                        {isEditing ? t('services.editDescription') : t('services.createDescription')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="service-form-content">
                    {/* Service Name & Description */}
                    <div className="form-field">
                        <label className="form-label">{t('services.serviceName')} *</label>
                        <input
                            name="service_name"
                            value={formData.service_name}
                            onChange={handleChange}
                            className="form-input"
                            placeholder={t('services.serviceName')}
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label">{t('services.description')}</label>
                        <textarea
                            name="service_description"
                            value={formData.service_description}
                            onChange={handleChange}
                            className="form-textarea"
                            rows={3}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label className="form-label">{t('services.type')} *</label>
                            <Select
                                value={formData.service_type}
                                onChange={handleServiceTypeChange}
                                options={[
                                    { value: 'abbonamento', label: t('services.subscription') },
                                    { value: 'pacchetto', label: t('services.package') },
                                    { value: 'giornaliero', label: t('services.dayPass') },
                                    { value: 'free_trial', label: t('services.freeTrial') }
                                ]}
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label">{t('services.status')} *</label>
                            <Select
                                value={formData.service_status}
                                onChange={(e) => setFormData(prev => ({ ...prev, service_status: e.target.value }))}
                                options={[
                                    { value: 'active', label: t('services.active') },
                                    { value: 'inactive', label: t('services.inactive') },
                                    { value: 'draft', label: t('services.draft') }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label className="form-label">{t('services.location')} *</label>
                            <Select
                                value={formData.location_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, location_id: e.target.value }))}
                                options={locations.map(l => ({ value: l.id.toString(), label: l.location_name }))}
                                placeholder={t('services.selectLocation')}
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label">{t('locations.resourceType')} *</label>
                            <Select
                                value={formData.resource_type}
                                onChange={(e) => setFormData(prev => ({ ...prev, resource_type: e.target.value }))}
                                options={resourceTypes.map(rt => ({ value: rt.type_code, label: rt.type_name }))}
                                placeholder={t('services.selectResource')}
                            />
                        </div>
                    </div>

                    {/* Cost & Duration - The Strict Three-Col Layout */}
                    <div className="price-row">
                        <div className="form-field">
                            <label className="form-label">{t('services.cost')} *</label>
                            <input
                                type="number"
                                name="cost"
                                value={formData.cost}
                                onChange={handleChange}
                                className="form-input"
                                step="0.01"
                                min="0"
                                required
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label">&nbsp;</label>
                            <Select
                                value={formData.currency}
                                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }, { value: 'GBP', label: 'GBP' }]}
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label">{t('services.durationDays')} *</label>
                            <input
                                type="number"
                                name="duration_days"
                                value={formData.duration_days}
                                onChange={handleChange}
                                className="form-input"
                                required
                            />
                        </div>
                    </div>

                    {formData.service_type === 'pacchetto' && (
                        <div className="form-field">
                            <label className="form-label">{t('services.maxEntries')} *</label>
                            <input
                                type="number"
                                name="max_entries"
                                value={formData.max_entries}
                                onChange={handleChange}
                                className="form-input"
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t">
                        {['isRenewable', 'autoRenew', 'privateService'].map(key => {
                            const formKey = key === 'isRenewable' ? 'is_renewable' :
                                key === 'autoRenew' ? 'auto_renew' : 'private';
                            return (
                                (key !== 'autoRenew' || formData.is_renewable) && (
                                    <div key={key} className="switch-container">
                                        <div>
                                            <span className="font-medium text-gray-700">{t(`services.${key}`)}</span>
                                            <p className="text-sm text-gray-500">{t(`services.${key === 'privateService' ? 'privateServiceHelp' : key + 'Help'}`)}</p>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                name={formKey}
                                                checked={formData[formKey]}
                                                onChange={handleChange}
                                                disabled={formData.service_type === 'giornaliero' && key !== 'privateService'}
                                            />
                                            <span className="switch-slider"></span>
                                        </label>
                                    </div>
                                )
                            );
                        })}
                    </div>

                    <div className="buttons-footer">
                        <div>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="service-btn-danger flex items-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    {t('common.delete')}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                            <button type="button" onClick={() => navigate('/services')} className="service-btn-secondary">
                                {t('common.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="service-btn-primary flex items-center gap-2"
                                disabled={loading}
                                style={{ backgroundColor: '#4f46e5', color: 'white', borderColor: '#4f46e5', marginLeft: '2rem' }}
                            >
                                <Save size={16} />
                                {loading ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </form>
            </div >

            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <h3 className="text-xl font-bold mb-4">{t('common.confirmDelete')}</h3>
                        <p className="mb-6 text-gray-600">{t('services.confirmDeleteMessage')}</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="service-btn-secondary">{t('common.cancel')}</button>
                            <button onClick={handleDelete} className="service-btn-danger">{t('common.delete')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ServiceFormPage;
