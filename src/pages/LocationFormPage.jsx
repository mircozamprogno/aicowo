// src/pages/LocationFormPage.jsx
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import LocationForm from '../components/forms/LocationForm';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

const LocationFormPage = () => {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const [partnerData, setPartnerData] = useState(null);
    const [locationData, setLocationData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            // Get location ID from URL hash if editing
            const hash = window.location.hash;
            const locationId = hash.includes('?locationId=')
                ? hash.split('?locationId=')[1].split('&')[0]
                : null;

            // Fetch partner data
            if (profile?.partner_uuid) {
                try {
                    const { data, error } = await supabase
                        .from('partners')
                        .select('*')
                        .eq('partner_uuid', profile.partner_uuid)
                        .maybeSingle();

                    if (error) {
                        logger.error('Error fetching partner data:', error);
                    } else {
                        setPartnerData(data);
                    }
                } catch (error) {
                    logger.error('Error fetching partner data:', error);
                }
            }

            // Fetch location data if editing
            if (locationId) {
                try {
                    const { data, error } = await supabase
                        .from('locations')
                        .select(`
              id,
              location_name,
              address,
              city,
              postal_code,
              country,
              phone,
              email,
              description,
              latitude,
              longitude,
              timezone,
              vat_percentage,
              created_at,
              resources:location_resources(
                id,
                resource_type,
                resource_name,
                quantity,
                description
              )
            `)
                        .eq('id', locationId)
                        .single();

                    if (error) {
                        logger.error('Error fetching location data:', error);
                    } else {
                        setLocationData(data);
                    }
                } catch (error) {
                    logger.error('Error fetching location data:', error);
                }
            }

            setLoading(false);
        };

        loadData();
    }, [profile]);

    const handleClose = () => {
        window.location.hash = '/settings';
    };

    const handleSuccess = () => {
        window.location.hash = '/settings';
    };

    if (loading) {
        return (
            <div className="settings-loading">
                <div className="loading-spinner"></div>
                {t('common.loading')}
            </div>
        );
    }

    const isEditing = !!locationData;

    return (
        <div className="settings-page">
            <div className="settings-header">
                <div className="settings-header-content">
                    <h1 className="settings-title">
                        <MapPin size={24} className="mr-2" />
                        {isEditing
                            ? `${t('locations.editLocation')} - ${locationData.location_name}`
                            : t('locations.addLocation')}
                    </h1>
                    <p className="settings-description">
                        {isEditing
                            ? t('locations.editLocationDescription') || 'Modifica i dettagli della sede'
                            : t('locations.addLocationDescription') || 'Aggiungi una nuova sede con tutte le informazioni necessarie'}
                    </p>
                </div>
            </div>

            <div className="settings-content">
                <LocationForm
                    isOpen={true}
                    onClose={handleClose}
                    onSuccess={handleSuccess}
                    location={locationData}
                    partnerUuid={profile?.partner_uuid}
                    partnerData={partnerData}
                    embedded={true}
                    hideHeader={true}
                />
            </div>
        </div>
    );
};

export default LocationFormPage;
