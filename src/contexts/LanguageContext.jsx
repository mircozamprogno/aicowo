import { createContext, useContext, useState } from 'react';
import { availableLanguages, translations } from '../locales';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('preferred-language') || 'en';
  });

  const changeLanguage = (languageCode) => {
    setCurrentLanguage(languageCode);
    localStorage.setItem('preferred-language', languageCode);
  };

  const t = (keyPath) => {
    const keys = keyPath.split('.');
    let value = translations[currentLanguage];
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    // Fallback to English if translation not found
    if (!value) {
      value = translations.en;
      for (const key of keys) {
        value = value?.[key];
      }
    }
    
    return value || keyPath;
  };

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    availableLanguages
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};