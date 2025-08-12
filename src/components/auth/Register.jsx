import { Building, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Link from '../common/Link';
import { toast } from '../common/ToastContainer';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useTranslation();

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

    setLoading(true);

    try {
      // Create the user metadata object that will be passed to the trigger
      const userMetadata = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
        username: `${formData.firstName} ${formData.lastName}`.toLowerCase().replace(/\s+/g, '_'),
        // Add partner_uuid if this is an invitation-based registration
        // partner_uuid: invitationData?.partner_uuid || null
      };

      console.log('Registering user with metadata:', userMetadata);

      await signUp(formData.email, formData.password, userMetadata);
      
      toast.success(t('messages.accountCreatedSuccessfully'));
      
      // Small delay to ensure the trigger has processed
      setTimeout(() => {
        window.location.hash = '/login';
      }, 1000);
      
    } catch (error) {
      console.error('Registration error:', error);
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
            <Building size={48} color="#4f46e5" />
          </div>
          <h2 className="auth-title">
            {t('auth.signUp')}
          </h2>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName" className="form-label">
                {t('auth.firstName')}
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
                {t('auth.lastName')}
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
                value={formData.email}
                onChange={handleChange}
              />
              <Mail size={16} className="input-icon input-icon-left" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="role" className="form-label">
              {t('auth.role')}
            </label>
            <select
              id="role"
              name="role"
              className="form-select"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="user">{t('roles.user')}</option>
              <option value="admin">{t('roles.admin')}</option>
              <option value="superadmin">{t('roles.superadmin')}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.password')}
            </label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="form-input"
                placeholder={t('placeholders.passwordPlaceholder')}
                value={formData.password}
                onChange={handleChange}
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
              {t('auth.confirmPassword')}
            </label>
            <div className="input-group">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="form-input"
                placeholder={t('auth.confirmPassword')}
                value={formData.confirmPassword}
                onChange={handleChange}
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
              {loading ? `${t('auth.signUp')}...` : t('auth.signUp')}
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

export default Register;