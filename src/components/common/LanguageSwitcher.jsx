import { ChevronDown, Globe } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';

const LanguageSwitcher = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentLanguage, changeLanguage, availableLanguages } = useTranslation();

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage);

  return (
    <div className="language-switcher">
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            color: '#374151',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Globe size={16} />
          <span>{currentLang?.flag}</span>
          <span>{currentLang?.name}</span>
          <ChevronDown size={16} />
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            right: 0,
            marginTop: '0.5rem',
            width: '12rem',
            backgroundColor: 'white',
            borderRadius: '0.375rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: 50,
            border: '1px solid #e5e7eb'
          }}>
            {availableLanguages.map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  changeLanguage(language.code);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: currentLanguage === language.code ? '#eef2ff' : 'transparent',
                  color: currentLanguage === language.code ? '#312e81' : '#374151',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = currentLanguage === language.code ? '#eef2ff' : 'transparent'}
              >
                <span>{language.flag}</span>
                <span>{language.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSwitcher;