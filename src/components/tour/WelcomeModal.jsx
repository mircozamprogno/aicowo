// src/components/tour/WelcomeModal.jsx
import { Building2, Calendar, MapPin, Settings, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTour } from '../../contexts/TourContext';

const WelcomeModal = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { shouldShowWelcome, startTour, skipTour, dismissWelcome } = useTour();

  if (!shouldShowWelcome) return null;

  const handleStartTour = () => {
    startTour();
  };

  const handleSkipTour = () => {
    skipTour();
  };

  const handleNotNow = () => {
    dismissWelcome();
  };

  return (
    <div className="modal-overlay welcome-modal-overlay">
      <div className="welcome-modal-container">
        <div className="welcome-modal-header">
          <button onClick={handleSkipTour} className="welcome-modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="welcome-modal-content">
          {/* Welcome Section */}
          <div className="welcome-section">
            <div className="welcome-icon">
              <Building2 size={48} className="welcome-icon-svg" />
            </div>
            
            <h1 className="welcome-title">
              {t('tour.welcome.title', { name: profile?.first_name || 'Partner' })}
            </h1>
            
            <p className="welcome-subtitle">
              {t('tour.welcome.subtitle')}
            </p>
            
            <p className="welcome-description">
              {t('tour.welcome.description')}
            </p>
          </div>

          {/* Setup Steps Preview */}
          <div className="setup-preview">
            <h2 className="setup-preview-title">
              {t('tour.welcome.setupStepsTitle')}
            </h2>
            
            <div className="setup-steps">
              <div className="setup-step">
                <div className="setup-step-icon location">
                  <MapPin size={24} />
                </div>
                <div className="setup-step-content">
                  <h3 className="setup-step-title">
                    {t('tour.welcome.step1Title')}
                  </h3>
                  <p className="setup-step-description">
                    {t('tour.welcome.step1Description')}
                  </p>
                </div>
                <div className="setup-step-number">1</div>
              </div>

              <div className="setup-step">
                <div className="setup-step-icon resources">
                  <Calendar size={24} />
                </div>
                <div className="setup-step-content">
                  <h3 className="setup-step-title">
                    {t('tour.welcome.step2Title')}
                  </h3>
                  <p className="setup-step-description">
                    {t('tour.welcome.step2Description')}
                  </p>
                </div>
                <div className="setup-step-number">2</div>
              </div>

              <div className="setup-step">
                <div className="setup-step-icon services">
                  <Settings size={24} />
                </div>
                <div className="setup-step-content">
                  <h3 className="setup-step-title">
                    {t('tour.welcome.step3Title')}
                  </h3>
                  <p className="setup-step-description">
                    {t('tour.welcome.step3Description')}
                  </p>
                </div>
                <div className="setup-step-number">3</div>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="benefits-section">
            <h3 className="benefits-title">
              {t('tour.welcome.benefitsTitle')}
            </h3>
            
            <div className="benefits-grid">
              <div className="benefit-item">
                <span className="benefit-icon">⚡</span>
                <span className="benefit-text">{t('tour.welcome.benefit1')}</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">🎯</span>
                <span className="benefit-text">{t('tour.welcome.benefit2')}</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">🚀</span>
                <span className="benefit-text">{t('tour.welcome.benefit3')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="welcome-modal-actions">
          <button 
            onClick={handleNotNow}
            className="welcome-action-button secondary"
          >
            {t('tour.welcome.notNow')}
          </button>
          
          <button 
            onClick={handleSkipTour}
            className="welcome-action-button tertiary"
          >
            {t('tour.welcome.skipTour')}
          </button>
          
          <button 
            onClick={handleStartTour}
            className="welcome-action-button primary"
          >
            {t('tour.welcome.startTour')}
          </button>
        </div>

        {/* Quick note */}
        <div className="welcome-modal-note">
          <p>{t('tour.welcome.note')}</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;