import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

const LocationForm = ({ isOpen, onClose, onSuccess, location = null, partnerUuid }) => {
  const { t } = useTranslation();
  const isEditing = !!location;
  
  const [formData, setFormData] = useState({
    location_name: location?.location_name || '',
  });
  
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      
      if (isEditing) {
        // Update existing location
        result = await supabase
          .from('locations')
          .update(formData)
          .eq('id', location.id)
          .select();
      } else {
        // Create new location
        result = await supabase
          .from('locations')
          .insert([{
            ...formData,
            partner_uuid: partnerUuid
          }])
          .select();
      }

      const { data, error } = result;

      if (error) throw error;

      toast.success(
        isEditing 
          ? t('messages.locationUpdatedSuccessfully') 
          : t('messages.locationCreatedSuccessfully')
      );
      
      onSuccess(data[0]);
      onClose();
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error(error.message || t('messages.errorSavingLocation'));
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
            {isEditing ? t('locations.editLocation') : t('locations.addLocation')}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="location_name" className="form-label">
              {t('locations.locationName')} *
            </label>
            <input
              id="location_name"
              name="location_name"
              type="text"
              required
              className="form-input"
              placeholder={t('placeholders.locationNamePlaceholder')}
              value={formData.location_name}
              onChange={handleChange}
            />
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
                ? (isEditing ? t('common.saving') + '...' : t('common.creating') + '...') 
                : (isEditing ? t('common.save') : t('common.create'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LocationForm;