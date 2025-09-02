// src/components/tour/TourNotificationBadge.jsx
import { useTour } from '../../contexts/TourContext';

const TourNotificationBadge = ({ children, href }) => {
  const { isOnboardingComplete, getTourProgress } = useTour();

  // Don't show notification if onboarding is complete
  if (isOnboardingComplete) {
    return children;
  }

  const progress = getTourProgress();
  
  // Show notification dot only if there are incomplete steps
  const shouldShowNotification = progress.completed < progress.total;

  // Determine if this navigation item is relevant for current setup
  const isRelevantForSetup = () => {
    if (href === '/partners' || href === '/services') {
      return true;
    }
    return false;
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      {shouldShowNotification && isRelevantForSetup() && (
        <div className="tour-notification-dot" />
      )}
    </div>
  );
};

export default TourNotificationBadge;