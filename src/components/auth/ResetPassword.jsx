import { Building, Eye, EyeOff, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { toast } from '../common/ToastContainer';

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const { updatePassword } = useAuth();
  const { t } = useTranslation();

  // Extract token from URL parameters
  const getResetTokenFromURL = () => {
    // Check both hash parameters (Supabase auth redirects) and regular URL parameters
    const fullUrl = window.location.href;
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const urlParams = new URLSearchParams(window.location.search);
    
    const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');
    const type = hashParams.get('type') || urlParams.get('type');
    
    console.log('Reset password URL analysis:', {
      fullUrl,
      hash: window.location.hash,
      search: window.location.search,
      hashParamsString: window.location.hash.split('?')[1] || 'none',
      searchParamsString: window.location.search,
      type,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      allHashParams: Object.fromEntries(hashParams.entries()),
      allUrlParams: Object.fromEntries(urlParams.entries())
    });
    
    return { accessToken, refreshToken, type };
  };

  useEffect(() => {
    console.log('=== RESET PASSWORD COMPONENT DEBUG ===');
    
    const { accessToken, refreshToken, type } = getResetTokenFromURL();
    
    // Check for error parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    
    const error = urlParams.get('error') || hashParams.get('error');
    const errorCode = urlParams.get('error_code') || hashParams.get('error_code');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    console.log('Reset password validation:', { 
      type, 
      hasAccessToken: !!accessToken,
      error,
      errorCode,
      errorDescription: decodeURIComponent(errorDescription || '')
    });
    
    // Handle specific error cases
    if (error) {
      console.log('❌ Error detected in reset password URL');
      if (errorCode === 'otp_expired') {
        console.log('🕐 Reset link has expired');
        toast.error('Password reset link has expired. Please request a new one.');
      } else if (error === 'access_denied') {
        console.log('🚫 Access denied - link may be invalid');
        toast.error('Invalid password reset link. Please request a new one.');
      } else {
        console.log('❓ Unknown error:', error);
        toast.error(`Reset link error: ${decodeURIComponent(errorDescription || error)}`);
      }
      setTokenValid(false);
      setValidatingToken(false);
      return;
    }
    
    // More lenient validation - check for type=recovery OR presence of access_token
    if (type === 'recovery' || accessToken) {
      setTokenValid(true);
      console.log('✅ ResetPassword: Valid recovery token detected');
    } else {
      console.log('❌ ResetPassword: Invalid or missing recovery token');
      setTokenValid(false);
      toast.error(t('messages.invalidResetLink'));
    }
    
    console.log('=====================================');
    setValidatingToken(false);
  }, []);

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

    if (formData.password.length < 6) {
      toast.error(t('messages.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await updatePassword(formData.password);
      setResetComplete(true);
      toast.success(t('messages.passwordResetSuccessfully'));
      
      // Sign out the user so they need to log in with their new password
      // This will also clear the password recovery state
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
          console.log('User signed out after password reset');
        } catch (signOutError) {
          console.log('Note: Could not sign out user after password reset:', signOutError);
        }
      }, 2000);
      
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error(error.message || t('messages.errorResettingPassword'));
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (validatingToken) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-loading">
            <div className="loading-spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        </div>
        <div className="auth-language-switcher">
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

  // Success state after password reset
  if (resetComplete) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <Building size={48} color="#10b981" className="auth-logo" />
            <h2 className="auth-title" style={{ color: '#10b981' }}>
              {t('auth.passwordResetSuccessful')}
            </h2>
            <p className="auth-instructions">
              {t('auth.passwordResetSuccessMessage')}
            </p>
            <div className="auth-back-link">
              <button
                onClick={() => window.location.hash = '/login'}
                className="auth-submit-btn"
                style={{ 
                  display: 'inline-block', 
                  textAlign: 'center', 
                  textDecoration: 'none',
                  backgroundColor: '#10b981',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {t('auth.goToLogin')}
              </button>
            </div>
          </div>
        </div>
        <div className="auth-language-switcher">
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">
              <Building size={48} color="#dc2626" />
            </div>
            <h2 className="auth-title auth-title-error">
              {t('auth.invalidResetLink')}
            </h2>
            <p className="auth-instructions">
              {t('auth.invalidResetLinkMessage')}
            </p>
          </div>
          <div className="auth-actions">
            <button 
              onClick={() => window.location.hash = '/forgot-password'} 
              className="auth-submit-btn"
            >
              {t('auth.requestNewResetLink')}
            </button>
            <div className="auth-back-link">
              <button 
                onClick={() => window.location.hash = '/login'} 
                className="auth-switch-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('auth.backToSignIn')}
              </button>
            </div>
          </div>
        </div>
        <div className="auth-language-switcher">
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

  // Main password reset form
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <Building size={48} color="#4f46e5" />
          </div>
          <h2 className="auth-title">
            {t('auth.setNewPassword')}
          </h2>
          <p className="auth-instructions">
            {t('auth.setNewPasswordInstructions')}
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.newPassword')} *
            </label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="form-input"
                placeholder={t('placeholders.newPasswordPlaceholder')}
                value={formData.password}
                onChange={handleChange}
                minLength="6"
              />
              <Lock size={16} className="input-icon input-icon-left" />
              <button
                type="button"
                className="input-icon input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              {t('auth.confirmNewPassword')} *
            </label>
            <div className="input-group">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="form-input"
                placeholder={t('auth.confirmNewPassword')}
                value={formData.confirmPassword}
                onChange={handleChange}
                minLength="6"
              />
              <Lock size={16} className="input-icon input-icon-left" />
            </div>
          </div>

          <div className="form-group">
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? `${t('auth.updatingPassword')}...` : t('auth.updatePassword')}
            </button>
          </div>

          <div className="auth-switch">
            <button 
              onClick={() => window.location.hash = '/login'} 
              className="auth-switch-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {t('auth.backToSignIn')}
            </button>
          </div>
        </form>
      </div>
      <div className="auth-language-switcher">
        <LanguageSwitcher />
      </div>
    </div>
  );
};

export default ResetPassword;