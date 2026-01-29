import { Eye, EyeOff, Lock, Mail, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Link from '../common/Link';
import { toast } from '../common/ToastContainer';

// Logger 
import logger from '../../utils/logger';

const InvitationRegister = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation();

  const getInvitationTokenFromURL = () => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const urlParams = new URLSearchParams(window.location.search);

    const token = hashParams.get('token') || urlParams.get('token');
    logger.log('Invitation token from URL:', {
      hash: window.location.hash,
      search: window.location.search,
      token: token
    });

    return token;
  };

  const invitationToken = getInvitationTokenFromURL();

  useEffect(() => {
    if (invitationToken) {
      validateInvitation();
    } else {
      setLoading(false);
      toast.error(t('messages.invalidInvitationLink'));
    }
  }, [invitationToken]);

  const validateInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('invitation_uuid', invitationToken)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        console.error('Invitation query error:', error);
        toast.error(t('messages.invitationExpiredOrInvalid'));
        window.location.hash = '/login';
        return;
      }

      console.log('Invitation data fetched:', data);

      // Use partner_structure_name from the invitation itself (no need to query partners table)
      if (data.partner_structure_name) {
        console.log('✅ Partner name from invitation:', data.partner_structure_name);
        data.partners = {
          structure_name: data.partner_structure_name
        };
      } else {
        console.warn('⚠️ No partner_structure_name in invitation - run the SQL migration first');
      }

      setInvitation(data);
      if (data.invited_email) {
        setFormData(prev => ({ ...prev, email: data.invited_email }));
      }
    } catch (error) {
      logger.error('Error validating invitation:', error);
      toast.error(t('messages.errorValidatingInvitation'));
      window.location.hash = '/login';
    } finally {
      setLoading(false);
    }
  };


  const handleChange = (e) => {
    const { name, value } = e.target;

    // Phone number validation: only allow + and digits
    if (name === 'phone') {
      const sanitizedValue = value.replace(/[^+0-9]/g, '');
      setFormData({
        ...formData,
        [name]: sanitizedValue
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: value
    });
  };

  // src/components/auth/InvitationRegister.jsx
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('messages.passwordsDoNotMatch'));
      return;
    }

    setSubmitting(true);

    try {
      // Call backend function instead of supabase.auth.signUp
      const { data, error } = await supabase.functions.invoke('register-invited-user', {
        body: {
          invitationToken,
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone
        }
      });

      if (error) throw error;

      setUserEmail(formData.email);
      setRegistrationComplete(true);
      toast.success(t('messages.registrationCompletePleaseVerify'));
    } catch (error) {
      logger.error('Registration error:', error);
      toast.error(error.message || t('messages.errorCreatingAccount'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-loading">
            <div className="loading-spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (registrationComplete) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">
              <img src="/logo.svg" alt="Logo" style={{ height: '48px' }} />
            </div>
            <h1 className="auth-app-name">
              {t('app.appShortName')}
            </h1>
            <h2 className="auth-title" style={{ color: '#10b981' }}>
              {t('auth.registrationComplete')}
            </h2>
            <div className="registration-success-content">
              <p className="auth-instructions">
                {t('auth.verificationEmailSent')} <strong>{userEmail}</strong>
              </p>
              <div className="verification-steps">
                <div className="verification-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>{t('auth.checkYourEmail')}</h4>
                    <p>{t('auth.checkEmailInbox')}</p>
                  </div>
                </div>
                <div className="verification-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>{t('auth.clickVerificationLink')}</h4>
                    <p>{t('auth.clickLinkInEmail')}</p>
                  </div>
                </div>
                <div className="verification-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>{t('auth.loginToAccount')}</h4>
                    <p>{t('auth.afterVerificationLogin')}</p>
                  </div>
                </div>
              </div>
              <div className="verification-note">
                <p className="note-text">
                  <strong>{t('auth.importantNote')}:</strong> {t('auth.verificationEmailNote')}
                </p>
              </div>
            </div>
            <div className="auth-back-link">
              <Link
                to="/login"
                className="auth-switch-link"
              >
                {t('auth.goToLogin')}
              </Link>
            </div>
          </div>
        </div>
        <div className="auth-language-switcher">
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">
              <img src="/logo.svg" alt="Logo" style={{ height: '48px' }} />
            </div>
            <h1 className="auth-app-name">
              {t('app.appShortName')}
            </h1>
            <h2 className="auth-title auth-title-error">
              {t('auth.invalidInvitation')}
            </h2>
            <p className="auth-instructions">
              {t('auth.invalidInvitationMessage')}
            </p>
          </div>
          <div className="auth-actions">
            <Link to="/login" className="auth-submit-btn">
              {t('auth.backToSignIn')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/logo.svg" alt="Logo" style={{ height: '48px' }} />
          </div>
          <h1 className="auth-app-name">
            {t('app.appShortName')}
          </h1>
          <h2 className="auth-title">
            {t('auth.completeRegistration')}
          </h2>
          <div className="invitation-info">
            <p className="invitation-text">
              {(() => {
                const partnerName = invitation.partners?.structure_name
                  || invitation.partners?.company_name
                  || invitation.partners?.first_name
                  || 'Partner';

                console.log('Partner data:', invitation.partners);
                console.log('Partner name being used:', partnerName);

                return invitation.invited_role === 'admin'
                  ? t('auth.invitedAsPartnerAdmin', { partnerName })
                  : t('auth.invitedAsUser', { partnerName });
              })()}
            </p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName" className="form-label">
                {t('auth.firstName')} *
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="form-input"
                placeholder={t('placeholders.firstNamePlaceholder')}
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName" className="form-label">
                {t('auth.lastName')} *
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="form-input"
                placeholder={t('placeholders.lastNamePlaceholder')}
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              {t('auth.email')} *
            </label>
            <div className="input-group">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-input"
                placeholder={t('placeholders.emailPlaceholder')}
                value={formData.email}
                onChange={handleChange}
                disabled={!!invitation.invited_email}
              />
              <Mail size={16} className="input-icon input-icon-left" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              {t('auth.phone')} *
            </label>
            <div className="input-group">
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                className="form-input"
                placeholder={t('placeholders.phonePlaceholder')}
                value={formData.phone}
                onChange={handleChange}
              />
              <Phone size={16} className="input-icon input-icon-left" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.password')} *
            </label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="form-input has-right-icon"
                placeholder={t('placeholders.passwordPlaceholder')}
                value={formData.password}
                onChange={handleChange}
              />
              <Lock size={16} className="input-icon input-icon-left" />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              marginTop: '0.25rem'
            }}>
              {t('auth.passwordRequirements')}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              {t('auth.confirmPassword')} *
            </label>
            <div className="input-group">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="form-input has-right-icon"
                placeholder={t('placeholders.confirmPasswordPlaceholder')}
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <Lock size={16} className="input-icon input-icon-left" />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <button
              type="submit"
              disabled={submitting}
              className="auth-submit-btn"
            >
              {submitting ? `${t('auth.creatingAccount')}...` : t('auth.createAccount')}
            </button>
          </div>

          <div className="auth-switch">
            <span className="auth-switch-text">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="auth-switch-link">
                {t('auth.signIn')}
              </Link>
            </span>
          </div>

          <div className="auth-legal-links" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
            <a href="#/terms-of-service" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', margin: '0 0.5rem', textDecoration: 'none' }}>
              {t('legal.termsOfServiceTitle')}
            </a>
            <span style={{ color: '#d1d5db' }}>•</span>
            <a href="#/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', margin: '0 0.5rem', textDecoration: 'none' }}>
              {t('legal.privacyPolicyTitle')}
            </a>
          </div>
        </form>
      </div>
      <div className="auth-language-switcher">
        <LanguageSwitcher />
      </div>
    </div>
  );
};

export default InvitationRegister;