import { Building, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Link from '../common/Link';
import { toast } from '../common/ToastContainer';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
      toast.success(t('messages.passwordResetEmailSent'));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <Building size={48} color="#4f46e5" className="auth-logo" />
            <h2 className="auth-title">Check your email</h2>
            <p className="auth-instructions">
              {t('auth.checkEmailInstructions')} {email}
            </p>
            <div className="auth-back-link">
              <Link
                to="/login"
                className="auth-switch-link"
              >
                {t('auth.backToSignIn')}
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

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <Building size={48} color="#4f46e5" />
          </div>
          <h2 className="auth-title">
            {t('auth.resetPassword')}
          </h2>
          <p className="auth-instructions">
            {t('auth.resetPasswordInstructions')}
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              {t('auth.email')}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail size={16} className="input-icon input-icon-left" />
            </div>
          </div>

          <div className="form-group">
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? `${t('auth.resetPassword')}...` : t('auth.resetPassword')}
            </button>
          </div>

          <div className="auth-switch">
            <Link to="/login" className="auth-switch-link">
              {t('auth.backToSignIn')}
            </Link>
          </div>
        </form>
      </div>
      <div className="auth-language-switcher">
        <LanguageSwitcher />
      </div>
    </div>
  );
};

export default ForgotPassword;