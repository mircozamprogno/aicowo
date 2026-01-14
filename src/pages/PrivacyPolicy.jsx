import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { useTranslation } from '../contexts/LanguageContext';
import '../styles/pages/legal-pages.css';

const PrivacyPolicy = () => {
    const { t } = useTranslation();

    return (
        <div className="auth-page">
            <div className="legal-page-container">
                <div className="legal-header">
                    <h1 className="legal-title">{t('legal.privacyPolicyTitle')}</h1>
                    <span className="legal-last-updated">{t('legal.lastUpdated')}: 01 Jan 2024</span>
                </div>
                <div className="legal-content">
                    {t('legal.privacyPolicyContent').split('\n').map((line, index) => {
                        if (line.startsWith('# ')) {
                            return <h1 key={index}>{line.replace('# ', '')}</h1>;
                        } else if (line.startsWith('## ')) {
                            return <h2 key={index}>{line.replace('## ', '')}</h2>;
                        } else if (line.trim() === '') {
                            return <br key={index} />;
                        } else {
                            return <p key={index}>{line}</p>;
                        }
                    })}
                </div>
                <div className="legal-footer">
                    <button
                        className="legal-back-link"
                        onClick={() => window.close()}
                    >
                        {t('common.closeWindow') || 'Close Window'}
                    </button>
                </div>
            </div>
            <div className="auth-language-switcher">
                <LanguageSwitcher />
            </div>
        </div>
    );
};

export default PrivacyPolicy;
