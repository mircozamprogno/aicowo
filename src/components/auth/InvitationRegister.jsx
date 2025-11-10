import { Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
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
        .select(`
          *,
          partners (
            first_name,
            second_name,
            company_name
          )
        `)
        .eq('invitation_uuid', invitationToken)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        toast.error(t('messages.invitationExpiredOrInvalid'));
        window.location.hash = '/login';
        return;
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error(t('messages.passwordsDoNotMatch'));
      return;
    }

    setSubmitting(true);

    try {
      // Create auth user with phone in metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        phone: formData.phone, // Set phone at auth level
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone, // Also in metadata for trigger function
            role: invitation.invited_role,
            partner_uuid: invitation.partner_uuid,
            username: `${formData.firstName} ${formData.lastName}`.toLowerCase().replace(' ', '_')
          }
        }
      });

      if (authError) {
        logger.error('Registration error:', authError);
        throw authError;
      }

      logger.log('User created successfully:', authData);

      // Mark invitation as used
      await supabase
        .from('invitations')
        .update({ 
          status: 'used', 
          used_at: new Date().toISOString() 
        })
        .eq('invitation_uuid', invitationToken);
      
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
              {invitation.invited_role === 'admin' 
                ? t('auth.invitedAsPartnerAdmin', { 
                    partnerName: invitation.partners?.first_name && invitation.partners?.second_name 
                      ? `${invitation.partners.first_name} ${invitation.partners.second_name}`
                      : invitation.partners?.first_name || invitation.partners?.company_name
                  })
                : t('auth.invitedAsUser', { 
                    partnerName: invitation.partners?.first_name && invitation.partners?.second_name 
                      ? `${invitation.partners.first_name} ${invitation.partners.second_name}`
                      : invitation.partners?.first_name || invitation.partners?.company_name
                  })
              }
            </p>
            <div className="invitation-badge">
              <User size={16} />
              <span>{t(`roles.${invitation.invited_role}`)}</span>
            </div>
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
                placeholder={t('auth.confirmPassword')}
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
        </form>
      </div>
      <div className="auth-language-switcher">
        <LanguageSwitcher />
      </div>
    </div>
  );
};

export default InvitationRegister;