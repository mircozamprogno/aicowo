// src/components/tour/SetupProgressIndicator.jsx
import { Calendar, CheckCircle, MapPin, Settings } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTour } from '../../contexts/TourContext';

const SetupProgressIndicator = ({ showInDashboard = false }) => {
  const { t } = useTranslation();
  const { 
    tourState, 
    getTourProgress, 
    isStepCompleted,
    startTour,
    isOnboardingComplete
  } = useTour();

  // Don't show if onboarding is completed unless explicitly requested
  if (isOnboardingComplete && !showInDashboard) return null;

  const progress = getTourProgress();
  
  const steps = [
    {
      id: 'location_created',
      title: t('tour.steps.locations.title'),
      description: t('tour.steps.locations.description'),
      icon: MapPin,
      completed: isStepCompleted('location_created')
    },
    {
      id: 'resources_added',
      title: t('tour.steps.resources.title'),
      description: t('tour.steps.resources.description'),
      icon: Calendar,
      completed: isStepCompleted('resources_added')
    },
    {
      id: 'service_created',
      title: t('tour.steps.services.title'),
      description: t('tour.steps.services.description'),
      icon: Settings,
      completed: isStepCompleted('service_created')
    }
  ];

  const handleStartTour = () => {
    startTour();
  };

  if (isOnboardingComplete && showInDashboard) {
    return (
      <div className="setup-progress-complete">
        <div className="setup-complete-icon">
          <CheckCircle size={24} />
        </div>
        <div className="setup-complete-content">
          <h3 className="setup-complete-title">
            {t('tour.setupComplete')}
          </h3>
          <p className="setup-complete-description">
            {t('tour.congratulations')} Your workspace is ready for customers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-progress-indicator">
      <div className="setup-progress-header">
        <div className="setup-progress-title-section">
          <h3 className="setup-progress-title">
            {progress.completed === progress.total 
              ? t('tour.almostDone')
              : t('tour.setupProgress')
            }
          </h3>
          <p className="setup-progress-subtitle">
            {progress.completed} / {progress.total} {t('tour.stepsCompleted')}
          </p>
        </div>
        
        <div className="setup-progress-percentage">
          {Math.round(progress.percentage)}%
        </div>
      </div>

      <div className="setup-progress-bar">
        <div 
          className="setup-progress-fill"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      <div className="setup-steps-list">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`setup-step-item ${step.completed ? 'completed' : 'pending'}`}
          >
            <div className="setup-step-icon-container">
              {step.completed ? (
                <CheckCircle size={20} className="setup-step-check" />
              ) : (
                <div className="setup-step-number">{index + 1}</div>
              )}
            </div>
            
            <div className="setup-step-content">
              <div className="setup-step-header">
                <step.icon size={16} className="setup-step-type-icon" />
                <h4 className="setup-step-title">
                  {step.title}
                </h4>
              </div>
              <p className="setup-step-description">
                {step.description}
              </p>
            </div>

            <div className="setup-step-status">
              {step.completed ? (
                <span className="setup-step-status-badge completed">
                  {t('tour.completed')}
                </span>
              ) : (
                <span className="setup-step-status-badge pending">
                  Pending
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {progress.completed < progress.total && (
        <div className="setup-progress-actions">
          <button 
            onClick={handleStartTour}
            className="setup-continue-button"
          >
            {progress.completed === 0 
              ? t('tour.getStarted')
              : t('tour.continueSetup')
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default SetupProgressIndicator;