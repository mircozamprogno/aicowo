// src/hooks/useTourIntegration.js
import { toast } from '../components/common/ToastContainer';
import { useTour } from '../contexts/TourContext';

/**
 * Hook for integrating tour progress with form submissions
 * This automatically tracks when users complete onboarding steps
 */
export const useTourIntegration = () => {
  const { updateStepProgress, isOnboardingComplete } = useTour();

  // Location creation integration
  const onLocationCreated = async (locationData) => {
    if (!isOnboardingComplete) {
      await updateStepProgress('location_created', true);
      
      // Also mark resources as added if resources were included in location creation
      if (locationData?.resources && locationData.resources.length > 0) {
        await updateStepProgress('resources_added', true);
      }
    }
  };

  // Service creation integration
  const onServiceCreated = async (serviceData) => {
    if (!isOnboardingComplete) {
      await updateStepProgress('service_created', true);
    }
  };

  // Resource addition integration (if resources are added separately)
  const onResourcesAdded = async (resourcesData) => {
    if (!isOnboardingComplete) {
      await updateStepProgress('resources_added', true);
    }
  };

  return {
    onLocationCreated,
    onServiceCreated,
    onResourcesAdded,
    isOnboardingComplete
  };
};

/**
 * Hook for checking setup requirements
 * Used to show warnings or guidance when setup is incomplete
 */
export const useSetupRequirements = () => {
  const { tourState, isOnboardingComplete } = useTour();

  const checkLocationRequirement = () => {
    if (!isOnboardingComplete && !tourState.steps.location_created) {
      toast.error('Please create a location first to continue setup');
      return false;
    }
    return true;
  };

  const checkResourceRequirement = () => {
    if (!isOnboardingComplete && !tourState.steps.resources_added) {
      toast.error('Please add resources to your location first');
      return false;
    }
    return true;
  };

  const checkServiceRequirement = () => {
    if (!isOnboardingComplete && !tourState.steps.service_created) {
      toast.info('Create your first service to complete setup');
      return true; // Not blocking, just informational
    }
    return true;
  };

  return {
    checkLocationRequirement,
    checkResourceRequirement,
    checkServiceRequirement,
    isSetupComplete: isOnboardingComplete,
    setupSteps: tourState.steps
  };
};