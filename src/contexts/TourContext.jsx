// src/contexts/TourContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from '../components/common/ToastContainer';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

import logger from '../utils/logger';

const TourContext = createContext();

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

export const TourProvider = ({ children }) => {
  const { profile, user } = useAuth();
  const [tourState, setTourState] = useState({
    isActive: false,
    currentStep: 0,
    showWelcome: false,
    onboardingCompleted: false,
    steps: {
      location_created: false,
      resources_added: false,
      service_created: false
    }
  });

  const [loading, setLoading] = useState(false);

  // Check onboarding status when profile loads
  useEffect(() => {
    if (profile && profile.role === 'admin' && profile.partner_uuid) {
      checkOnboardingStatus();
      verifyActualSetupStatus();
    }
  }, [profile]);

  const checkOnboardingStatus = async () => {
    if (!profile?.partner_uuid) return;

    try {
      const { data, error } = await supabase
        .from('partners')
        .select('onboarding_completed, onboarding_steps')
        .eq('partner_uuid', profile.partner_uuid)
        .single();

      if (error) {
        logger.error('Error checking onboarding status:', error);
        return;
      }

      const isCompleted = data?.onboarding_completed || false;
      const steps = data?.onboarding_steps || {
        location_created: false,
        resources_added: false,
        service_created: false
      };

      setTourState(prev => ({
        ...prev,
        onboardingCompleted: isCompleted,
        steps: steps,
        showWelcome: !isCompleted // Show welcome if not completed
      }));

    } catch (error) {
      logger.error('Error checking onboarding status:', error);
    }
  };


  const verifyActualSetupStatus = async () => {
    if (!profile?.partner_uuid) return;

    try {
      // Check if partner actually has the required setup
      const [locationsResult, servicesResult] = await Promise.all([
        supabase
          .from('locations')
          .select('id, location_resources(*)')
          .eq('partner_uuid', profile.partner_uuid),
        supabase
          .from('services')
          .select('id')
          .eq('partner_uuid', profile.partner_uuid)
          .eq('service_status', 'active')
      ]);

      const locations = locationsResult.data || [];
      const services = servicesResult.data || [];
      
      // Check actual completion status
      const hasLocations = locations.length > 0;
      const hasResources = locations.some(loc => 
        loc.location_resources && loc.location_resources.length > 0
      );
      const hasServices = services.length > 0;

      const actualSteps = {
        location_created: hasLocations,
        resources_added: hasResources,
        service_created: hasServices
      };

      const actuallyCompleted = hasLocations && hasResources && hasServices;

      // Update database if actual status differs from stored status
      if (actuallyCompleted !== tourState.onboardingCompleted || 
          JSON.stringify(actualSteps) !== JSON.stringify(tourState.steps)) {
        
        await supabase
          .from('partners')
          .update({
            onboarding_completed: actuallyCompleted,
            onboarding_steps: actualSteps
          })
          .eq('partner_uuid', profile.partner_uuid);

        // Update local state
        setTourState(prev => ({
          ...prev,
          onboardingCompleted: actuallyCompleted,
          steps: actualSteps,
          showWelcome: !actuallyCompleted
        }));
      }

    } catch (error) {
      logger.error('Error verifying actual setup status:', error);
    }
  };

  const startTour = () => {
    setTourState(prev => ({
      ...prev,
      isActive: true,
      currentStep: 0,
      showWelcome: false
    }));
  };

  const nextStep = () => {
    setTourState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 2) // 0, 1, 2 = 3 steps total
    }));
  };

  const previousStep = () => {
    setTourState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0)
    }));
  };

  const skipTour = async () => {
    await updateOnboardingStatus({ skip: true });
    setTourState(prev => ({
      ...prev,
      isActive: false,
      currentStep: 0,
      showWelcome: false,
      onboardingCompleted: true
    }));
  };

  const closeTour = () => {
    setTourState(prev => ({
      ...prev,
      isActive: false,
      currentStep: 0
    }));
  };

  const updateStepProgress = async (stepName, completed = true) => {
    if (!profile?.partner_uuid) return;

    const newSteps = {
      ...tourState.steps,
      [stepName]: completed
    };

    // Check if all steps are completed
    const allCompleted = Object.values(newSteps).every(step => step === true);

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('partners')
        .update({
          onboarding_steps: newSteps,
          onboarding_completed: allCompleted
        })
        .eq('partner_uuid', profile.partner_uuid);

      if (error) {
        logger.error('Error updating onboarding progress:', error);
        toast.error('Error saving progress');
        return;
      }

      setTourState(prev => ({
        ...prev,
        steps: newSteps,
        onboardingCompleted: allCompleted
      }));

      // If all steps completed, celebrate and close tour
      if (allCompleted) {
        completeTour();
      }

    } catch (error) {
      logger.error('Error updating step progress:', error);
      toast.error('Error saving progress');
    } finally {
      setLoading(false);
    }
  };

  const completeTour = () => {
    toast.success('🎉 Onboarding completed! Your workspace is ready for customers.');
    setTourState(prev => ({
      ...prev,
      isActive: false,
      currentStep: 0,
      onboardingCompleted: true
    }));
  };

  const updateOnboardingStatus = async ({ skip = false } = {}) => {
    if (!profile?.partner_uuid) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('partners')
        .update({
          onboarding_completed: true,
          onboarding_steps: skip ? tourState.steps : {
            location_created: true,
            resources_added: true,
            service_created: true
          }
        })
        .eq('partner_uuid', profile.partner_uuid);

      if (error) {
        logger.error('Error updating onboarding status:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error updating onboarding status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetOnboarding = async () => {
    if (!profile?.partner_uuid) return;

    try {
      const { error } = await supabase
        .from('partners')
        .update({
          onboarding_completed: false,
          onboarding_steps: {
            location_created: false,
            resources_added: false,
            service_created: false
          }
        })
        .eq('partner_uuid', profile.partner_uuid);

      if (error) {
        logger.error('Error resetting onboarding:', error);
        return;
      }

      setTourState(prev => ({
        ...prev,
        onboardingCompleted: false,
        steps: {
          location_created: false,
          resources_added: false,
          service_created: false
        },
        showWelcome: true
      }));

    } catch (error) {
      logger.error('Error resetting onboarding:', error);
    }
  };

  const dismissWelcome = () => {
    setTourState(prev => ({
      ...prev,
      showWelcome: false
    }));
  };

  const getTourProgress = () => {
    const completed = Object.values(tourState.steps).filter(Boolean).length;
    const total = Object.keys(tourState.steps).length;
    return { completed, total, percentage: (completed / total) * 100 };
  };

  const isStepCompleted = (stepName) => {
    return tourState.steps[stepName] === true;
  };

  const value = {
    // State
    tourState,
    loading,
    
    // Actions
    startTour,
    nextStep,
    previousStep,
    skipTour,
    closeTour,
    dismissWelcome,
    updateStepProgress,
    completeTour,
    resetOnboarding,
    
    // Helpers
    getTourProgress,
    isStepCompleted,
    
    // Computed
    shouldShowWelcome: tourState.showWelcome && !tourState.onboardingCompleted,
    shouldShowTour: tourState.isActive,
    isOnboardingComplete: tourState.onboardingCompleted
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
};

export default TourContext;