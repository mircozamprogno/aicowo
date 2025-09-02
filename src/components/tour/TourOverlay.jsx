// src/components/tour/TourOverlay.jsx
import { ArrowLeft, ArrowRight, Calendar, MapPin, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTour } from '../../contexts/TourContext';

const TourOverlay = () => {
  const { t } = useTranslation();
  const { 
    shouldShowTour, 
    tourState, 
    nextStep, 
    previousStep, 
    closeTour,
    getTourProgress,
    isStepCompleted
  } = useTour();
  
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Tour steps configuration
  const tourSteps = [
    {
      id: 'locations',
      title: t('tour.steps.locations.title'),
      description: t('tour.steps.locations.description'),
      action: t('tour.steps.locations.action'),
      selector: '[href="/partners"]', // Points to Partners nav item where locations are managed
      icon: MapPin,
      completed: isStepCompleted('location_created'),
      position: 'right'
    },
    {
      id: 'resources',
      title: t('tour.steps.resources.title'),
      description: t('tour.steps.resources.description'),
      action: t('tour.steps.resources.action'),
      selector: '.location-form-modal', // Will highlight when location form is open
      icon: Calendar,
      completed: isStepCompleted('resources_added'),
      position: 'left'
    },
    {
      id: 'services',
      title: t('tour.steps.services.title'),
      description: t('tour.steps.services.description'),
      action: t('tour.steps.services.action'),
      selector: '[href="/services"]', // Points to Services nav item
      icon: Settings,
      completed: isStepCompleted('service_created'),
      position: 'right'
    }
  ];

  const currentStepData = tourSteps[tourState.currentStep];
  const progress = getTourProgress();

  // Update highlighted element and tooltip position
  useEffect(() => {
    if (!shouldShowTour || !currentStepData) return;

    const updateHighlight = () => {
      const element = document.querySelector(currentStepData.selector);
      if (element) {
        setHighlightedElement(element);
        
        const rect = element.getBoundingClientRect();
        const tooltipWidth = 320;
        const tooltipHeight = 200;
        
        let top, left;
        
        switch (currentStepData.position) {
          case 'right':
            top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
            left = rect.right + 20;
            break;
          case 'left':
            top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
            left = rect.left - tooltipWidth - 20;
            break;
          case 'bottom':
            top = rect.bottom + 20;
            left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            break;
          case 'top':
          default:
            top = rect.top - tooltipHeight - 20;
            left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        }

        // Keep tooltip on screen
        top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20));
        left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));

        setTooltipPosition({ top, left });
      } else {
        setHighlightedElement(null);
      }
    };

    updateHighlight();
    
    // Re-calculate on resize or scroll
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight);
    
    // Also check periodically in case DOM changes
    const interval = setInterval(updateHighlight, 1000);

    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight);
      clearInterval(interval);
    };
  }, [shouldShowTour, tourState.currentStep, currentStepData]);

  // Handle clicks on highlighted elements
  const handleHighlightClick = (e) => {
    if (highlightedElement && highlightedElement.contains(e.target)) {
      // Allow the click to proceed to the element
      return;
    }
    
    // Prevent clicks outside the highlighted element
    e.preventDefault();
    e.stopPropagation();
  };

  const handleNext = () => {
    if (tourState.currentStep < tourSteps.length - 1) {
      nextStep();
    } else {
      closeTour();
    }
  };

  const handlePrevious = () => {
    if (tourState.currentStep > 0) {
      previousStep();
    }
  };

  const handleSkip = () => {
    closeTour();
  };

  if (!shouldShowTour || !currentStepData) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div 
        className="tour-overlay" 
        onClick={handleHighlightClick}
      >
        {/* Highlight spotlight */}
        {highlightedElement && (
          <div 
            className="tour-spotlight"
            style={{
              top: highlightedElement.offsetTop - 8,
              left: highlightedElement.offsetLeft - 8,
              width: highlightedElement.offsetWidth + 16,
              height: highlightedElement.offsetHeight + 16,
            }}
          />
        )}
      </div>

      {/* Tour tooltip */}
      <div 
        className="tour-tooltip"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`
        }}
      >
        <div className="tour-tooltip-header">
          <div className="tour-step-info">
            <div className={`tour-step-icon ${currentStepData.id}`}>
              <currentStepData.icon size={20} />
            </div>
            <div className="tour-step-meta">
              <span className="tour-step-number">
                {t('tour.stepNumber', { current: tourState.currentStep + 1, total: tourSteps.length })}
              </span>
              {currentStepData.completed && (
                <span className="tour-step-completed">✓ {t('tour.completed')}</span>
              )}
            </div>
          </div>
          <button onClick={handleSkip} className="tour-close-button">
            <X size={16} />
          </button>
        </div>

        <div className="tour-tooltip-content">
          <h3 className="tour-tooltip-title">
            {currentStepData.title}
          </h3>
          
          <p className="tour-tooltip-description">
            {currentStepData.description}
          </p>
          
          <div className="tour-action-hint">
            <span className="tour-action-icon">👉</span>
            <span className="tour-action-text">
              {currentStepData.action}
            </span>
          </div>
        </div>

        <div className="tour-tooltip-progress">
          <div className="tour-progress-bar">
            <div 
              className="tour-progress-fill"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <span className="tour-progress-text">
            {progress.completed} / {progress.total} {t('tour.stepsCompleted')}
          </span>
        </div>

        <div className="tour-tooltip-actions">
          <div className="tour-navigation">
            <button
              onClick={handlePrevious}
              disabled={tourState.currentStep === 0}
              className="tour-nav-button previous"
            >
              <ArrowLeft size={16} />
              {t('tour.previous')}
            </button>
            
            <button
              onClick={handleNext}
              className="tour-nav-button next"
            >
              {tourState.currentStep === tourSteps.length - 1 
                ? t('tour.finish') 
                : t('tour.next')
              }
              {tourState.currentStep < tourSteps.length - 1 && <ArrowRight size={16} />}
            </button>
          </div>
          
          <button
            onClick={handleSkip}
            className="tour-skip-button"
          >
            {t('tour.skipTour')}
          </button>
        </div>
      </div>

      {/* Pulse animation for highlighted element */}
      {highlightedElement && (
        <div 
          className="tour-pulse"
          style={{
            top: highlightedElement.offsetTop - 12,
            left: highlightedElement.offsetLeft - 12,
            width: highlightedElement.offsetWidth + 24,
            height: highlightedElement.offsetHeight + 24,
          }}
        />
      )}
    </>
  );
};

export default TourOverlay;