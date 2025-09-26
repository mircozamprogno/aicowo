import { AlertTriangle, Calendar, Edit, FileText, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import LocationForm from '../forms/LocationForm';

const LocationsList = ({ partner, isOpen, onClose, embedded = false }) => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  
  // Enhanced delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [deleteValidation, setDeleteValidation] = useState({
    loading: false,
    canDelete: false,
    dependencies: {
      activeContracts: 0,
      futureBookings: 0,
      pastBookings: 0,
      totalResources: 0,
      images: 0
    },
    warnings: []
  });

  useEffect(() => {
    if ((isOpen || embedded) && partner) {
      fetchLocations();
    }
  }, [isOpen, embedded, partner]);

  const fetchLocations = async () => {
    if (!partner?.partner_uuid) {
      console.warn('No partner UUID provided');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching locations for partner:', partner.partner_uuid);
      
      // Fetch locations with their resources
      const { data: locationsData, error: locationsError } = await supabase
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
        .eq('partner_uuid', partner.partner_uuid)
        .order('created_at', { ascending: false });

      if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        toast.error(t('messages.errorLoadingLocations'));
        setLocations([]);
        return;
      }

      console.log('Locations data:', locationsData);
      setLocations(locationsData || []);

    } catch (error) {
      console.error('Error in fetchLocations:', error);
      toast.error(t('messages.errorLoadingLocations'));
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = () => {
    setEditingLocation(null);
    setShowLocationForm(true);
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setShowLocationForm(true);
  };

  // Replace the entire handleDeleteLocation function with this improved version:

  const handleDeleteLocation = async (location) => {
    setLocationToDelete(location);
    setDeleteValidation({
      loading: true,
      canDelete: false,
      dependencies: {
        activeContracts: 0,
        futureBookings: 0,
        pastBookings: 0,
        totalResources: 0,
        images: 0
      },
      warnings: []
    });
    setShowDeleteConfirm(true);

    try {
      let activeContractCount = 0;
      let futureBookingCount = 0;
      let pastBookingCount = 0;
      let imageCount = 0;

      // Check for active contracts - handle gracefully if contracts table doesn't exist or has different structure
      try {
        const { data: activeContracts, error: contractsError } = await supabase
          .from('contracts')
          .select('id, contract_number, contract_status, start_date, end_date')
          .eq('location_id', location.id)
          .in('contract_status', ['active', 'pending']);

        if (contractsError) {
          console.warn('Error checking contracts (this may be expected):', contractsError);
          // Continue with activeContractCount = 0
        } else {
          activeContractCount = activeContracts ? activeContracts.length : 0;
        }
      } catch (contractError) {
        console.warn('Contracts check failed (continuing):', contractError);
        // Continue with activeContractCount = 0
      }

      // Check for future bookings - handle gracefully
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: futureBookings, error: futureBookingsError } = await supabase
          .from('package_reservations')
          .select('id, booking_date')
          .eq('location_id', location.id)
          .gte('booking_date', today);

        if (futureBookingsError) {
          console.warn('Error checking future bookings (this may be expected):', futureBookingsError);
          // Continue with futureBookingCount = 0
        } else {
          futureBookingCount = futureBookings ? futureBookings.length : 0;
        }
      } catch (bookingError) {
        console.warn('Future bookings check failed (continuing):', bookingError);
        // Continue with futureBookingCount = 0
      }

      // Check for past bookings - handle gracefully
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: pastBookings, error: pastBookingsError } = await supabase
          .from('package_reservations')
          .select('id')
          .eq('location_id', location.id)
          .lt('booking_date', today);

        if (pastBookingsError) {
          console.warn('Error checking past bookings (this may be expected):', pastBookingsError);
          // Continue with pastBookingCount = 0
        } else {
          pastBookingCount = pastBookings ? pastBookings.length : 0;
        }
      } catch (bookingError) {
        console.warn('Past bookings check failed (continuing):', bookingError);
        // Continue with pastBookingCount = 0
      }

      // Check for location images - handle gracefully
      try {
        const { data: imageFiles, error: imageError } = await supabase.storage
          .from('locations')
          .list(`${partner.partner_uuid}/${location.id}`, {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (imageError) {
          console.warn('Error checking images (this may be expected):', imageError);
          // Continue with imageCount = 0
        } else {
          imageCount = imageFiles ? imageFiles.length : 0;
        }
      } catch (imageError) {
        console.warn('Images check failed (continuing):', imageError);
        // Continue with imageCount = 0
      }

      // Count total resources
      const totalResources = location.resources ? location.resources.length : 0;

      // Determine if location can be safely deleted
      const canDelete = activeContractCount === 0 && futureBookingCount === 0;

      // Generate warnings - only for actual issues
      const warnings = [];
      if (activeContractCount > 0) {
        warnings.push(t('locations.deleteWarningActiveContracts', { count: activeContractCount }));
      }
      if (futureBookingCount > 0) {
        warnings.push(t('locations.deleteWarningFutureBookings', { count: futureBookingCount }));
      }
      if (totalResources > 0) {
        warnings.push(t('locations.deleteWarningResources', { count: totalResources }));
      }
      if (imageCount > 0) {
        warnings.push(t('locations.deleteWarningImages', { count: imageCount }));
      }
      if (pastBookingCount > 0) {
        warnings.push(t('locations.deleteWarningHistoricalData', { count: pastBookingCount }));
      }

      // Update state with successful validation
      setDeleteValidation({
        loading: false,
        canDelete,
        dependencies: {
          activeContracts: activeContractCount,
          futureBookings: futureBookingCount,
          pastBookings: pastBookingCount,
          totalResources,
          images: imageCount
        },
        warnings
      });

    } catch (error) {
      // Only show validation error for truly unexpected errors
      console.error('Unexpected error during validation:', error);
      setDeleteValidation({
        loading: false,
        canDelete: false,
        dependencies: {
          activeContracts: 0,
          futureBookings: 0,
          pastBookings: 0,
          totalResources: 0,
          images: 0
        },
        warnings: [t('locations.deleteValidationError')]
      });
    }
  };


  // Proceed with deletion after confirmation
  const confirmDeleteLocation = async () => {
    if (!deleteValidation.canDelete) {
      return; // Should not happen as button is disabled
    }

    try {
      // Delete location images from storage
      if (deleteValidation.dependencies.images > 0) {
        try {
          const { error: storageError } = await supabase.storage
            .from('locations')
            .remove([`${partner.partner_uuid}/${locationToDelete.id}`]);
          
          if (storageError) {
            console.warn('Error deleting location images:', storageError);
            // Continue with location deletion even if image deletion fails
          }
        } catch (storageError) {
          console.warn('Error deleting location images:', storageError);
        }
      }

      // Delete associated resources first
      const { error: resourcesError } = await supabase
        .from('location_resources')
        .delete()
        .eq('location_id', locationToDelete.id);

      if (resourcesError) {
        console.error('Error deleting location resources:', resourcesError);
        // Continue with location deletion
      }

      // Delete the location
      const { error: locationError } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationToDelete.id);

      if (locationError) throw locationError;

      toast.success(t('messages.locationDeletedSuccessfully'));
      fetchLocations(); // Refresh the list
      setShowDeleteConfirm(false);
      setLocationToDelete(null);

    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error(t('messages.errorDeletingLocation'));
    }
  };

  const handleLocationFormClose = () => {
    setShowLocationForm(false);
    setEditingLocation(null);
  };

  const handleLocationFormSuccess = (savedLocation) => {
    fetchLocations(); // Refresh the list
  };

  const formatLocationAddress = (location) => {
    const parts = [
      location.address,
      [location.postal_code, location.city].filter(Boolean).join(' '),
      location.country
    ].filter(Boolean);
    
    return parts.join(', ') || t('locations.noAddressYet');
  };

  const getResourcesSummary = (resources) => {
    if (!resources || resources.length === 0) {
      return t('locations.noResourcesFound');
    }

    const groupedResources = resources.reduce((acc, resource) => {
      if (!acc[resource.resource_type]) {
        acc[resource.resource_type] = 0;
      }
      acc[resource.resource_type] += resource.quantity;
      return acc;
    }, {});

    const summary = Object.entries(groupedResources).map(([type, count]) => {
      const label = type === 'scrivania' ? t('locations.scrivania') : t('locations.salaRiunioni');
      return `${count} ${label}`;
    });

    return summary.join(', ');
  };

  // Don't render anything if not open and not embedded
  if (!isOpen && !embedded) return null;

  const content = (
    <>
      {!embedded && (
        <div className="modal-header">
          <h2 className="modal-title">
            <MapPin size={20} />
            {t('locations.locationsFor')} {partner?.company_name || partner?.first_name}
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>
      )}

      <div className="locations-content">
        {loading ? (
          <div className="locations-loading">{t('common.loading')}</div>
        ) : (
          <>
            <div className="locations-header">
              <div className="locations-header-content">
                {!embedded && (
                  <p className="locations-description">
                    {t('locations.manageWorkspacesAndMeetingRooms')}
                  </p>
                )}
              </div>
              <button 
                onClick={handleAddLocation}
                className="add-location-btn"
              >
                <Plus size={16} />
                {t('locations.addLocation')}
              </button>
            </div>

            {locations.length === 0 ? (
              <div className="locations-empty">
                <MapPin size={48} className="empty-icon" />
                <p>{t('locations.noLocationsFound')}</p>
                <button 
                  onClick={handleAddLocation}
                  className="add-location-btn"
                >
                  <Plus size={16} />
                  {t('locations.addFirstLocation')}
                </button>
              </div>
            ) : (
              <div className="locations-list">
                {locations.map((location) => (
                  <div key={location.id} className="location-item">
                    <div className="location-info">
                      <h3 className="location-name">{location.location_name}</h3>
                      <p className="location-details">
                        <MapPin size={14} className="location-detail-icon" />
                        {formatLocationAddress(location)}
                      </p>
                      <p className="location-resources">
                        <span className="location-resources-label">{t('locations.resources')}:</span>
                        {getResourcesSummary(location.resources)}
                      </p>
                      {location.phone && (
                        <p className="location-contact">
                          📞 {location.phone}
                        </p>
                      )}
                      {location.email && (
                        <p className="location-contact">
                          ✉️ {location.email}
                        </p>
                      )}
                      {location.vat_percentage && (
                        <p className="location-vat">
                          🧾 VAT: {location.vat_percentage}%
                        </p>
                      )}
                    </div>
                    <div className="location-actions">
                      <button
                        onClick={() => handleEditLocation(location)}
                        className="btn-icon btn-edit"
                        title={t('common.edit')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location)}
                        className="btn-icon btn-danger"
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!embedded && (
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            {t('common.close')}
          </button>
        </div>
      )}

      {/* Location Form Modal */}
      <LocationForm
        isOpen={showLocationForm}
        onClose={handleLocationFormClose}
        onSuccess={handleLocationFormSuccess}
        location={editingLocation}
        partnerUuid={partner?.partner_uuid}
        partnerData={partner}
      />

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && locationToDelete && (
        <div className="modal-overlay">
          <div className="modal-container enhanced-delete-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {deleteValidation.canDelete ? (
                  <>
                    <Trash2 size={20} />
                    {t('locations.confirmDeleteLocation')}
                  </>
                ) : (
                  <>
                    <AlertTriangle size={20} />
                    {t('locations.cannotDeleteLocation')}
                  </>
                )}
              </h2>
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="modal-close-btn"
              >
                <X size={24} />
              </button>
            </div>

            <div className="enhanced-delete-content">
              {/* Location Information */}
              <div className="delete-location-info">
                <div className="delete-location-header">
                  <MapPin size={24} />
                  <div>
                    <h3>{locationToDelete.location_name}</h3>
                    <p>{formatLocationAddress(locationToDelete)}</p>
                  </div>
                </div>
              </div>

              {deleteValidation.loading ? (
                <div className="delete-validation-loading">
                  <div className="loading-spinner" />
                  <p>{t('locations.checkingDependencies')}</p>
                </div>
              ) : (
                <>
                  {/* Dependencies Summary */}
                  <div className="delete-dependencies-summary">
                    <h4>{t('locations.dependenciesFound')}</h4>
                    <div className="dependencies-grid">
                      <div className="dependency-item">
                        <FileText size={16} />
                        <span>{t('locations.activeContracts')}</span>
                        <span className={`count ${deleteValidation.dependencies.activeContracts > 0 ? 'blocking' : 'safe'}`}>
                          {deleteValidation.dependencies.activeContracts}
                        </span>
                      </div>
                      <div className="dependency-item">
                        <Calendar size={16} />
                        <span>{t('locations.futureBookings')}</span>
                        <span className={`count ${deleteValidation.dependencies.futureBookings > 0 ? 'blocking' : 'safe'}`}>
                          {deleteValidation.dependencies.futureBookings}
                        </span>
                      </div>
                      <div className="dependency-item">
                        <Calendar size={16} />
                        <span>{t('locations.resources')}</span>
                        <span className="count warning">
                          {deleteValidation.dependencies.totalResources}
                        </span>
                      </div>
                      <div className="dependency-item">
                        <Calendar size={16} />
                        <span>{t('locations.historicalBookings')}</span>
                        <span className="count info">
                          {deleteValidation.dependencies.pastBookings}
                        </span>
                      </div>
                      <div className="dependency-item">
                        <FileText size={16} />
                        <span>{t('locations.images')}</span>
                        <span className="count info">
                          {deleteValidation.dependencies.images}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {deleteValidation.warnings.length > 0 && (
                    <div className="delete-warnings">
                      <h4>
                        {deleteValidation.canDelete ? (
                          <>⚠️ {t('locations.deleteWarnings')}</>
                        ) : (
                          <>🚫 {t('locations.deleteBlockers')}</>
                        )}
                      </h4>
                      <ul>
                        {deleteValidation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Message */}
                  <div className={`delete-action-message ${deleteValidation.canDelete ? 'warning' : 'error'}`}>
                    {deleteValidation.canDelete ? (
                      <div>
                        <h4>⚠️ {t('locations.proceedWithCaution')}</h4>
                        <p>{t('locations.deleteLocationWarning')}</p>
                        <ul>
                          <li>• {t('locations.deleteConsequence1')}</li>
                          <li>• {t('locations.deleteConsequence2')}</li>
                          <li>• {t('locations.deleteConsequence3')}</li>
                        </ul>
                      </div>
                    ) : (
                      <div>
                        <h4>🚫 {t('locations.cannotProceed')}</h4>
                        <p>{t('locations.resolveIssuesFirst')}</p>
                        <ul>
                          <li>• {t('locations.cancelActiveContracts')}</li>
                          <li>• {t('locations.cancelFutureBookings')}</li>
                          <li>• {t('locations.thenRetryDelete')}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="enhanced-delete-actions">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                {t('common.cancel')}
              </button>
              
              {!deleteValidation.loading && deleteValidation.canDelete && (
                <button
                  onClick={confirmDeleteLocation}
                  className="btn-danger delete-confirm-btn"
                >
                  <Trash2 size={16} />
                  {t('locations.deleteLocationPermanently')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  // If embedded, return content directly
  if (embedded) {
    return (
      <div className="locations-embedded">
        {content}
      </div>
    );
  }

  // If not embedded, return in modal
  return (
    <div className="locations-modal-backdrop">
      <div className="locations-modal">
        {content}
      </div>
    </div>
  );
};

export default LocationsList;