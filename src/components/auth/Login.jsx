import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Link from '../common/Link';
import { toast } from '../common/ToastContainer';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      window.location.hash = '/dashboard';
      toast.success(t('messages.signedInSuccessfully'));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

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
            {t('auth.signIn')}
          </h2>
          <p className="auth-instructions">
            {t('auth.loginInstructions')}
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="sr-only">{t('auth.email')}</label>
            <div className="input-group">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-input input-top"
                placeholder={t('placeholders.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail size={16} className="input-icon input-icon-left" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password" className="sr-only">{t('auth.password')}</label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="form-input input-bottom has-right-icon"
                placeholder={t('placeholders.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <div className="auth-links">
            <Link to="/forgot-password" className="forgot-password-link">
              {t('auth.forgotPassword')}?
            </Link>
          </div>

          <div className="form-group">
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? `${t('auth.signIn')}...` : t('auth.signIn')}
            </button>
          </div>

          {/* Keep email column for admin 
          <div className="auth-switch">
            <span className="auth-switch-text">
              {t('auth.dontHaveAccount')}{' '}
              <Link to="/register" className="auth-switch-link">
                {t('auth.signUp')}
              </Link>
            </span>
          </div>
          */}
        </form>
      </div>
      <div className="auth-language-switcher">
        <LanguageSwitcher />
      </div>
    </div>
  );
};

export default Login;