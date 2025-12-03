// src/hooks/useEnvironment.js
import { useEffect, useState } from 'react';
import logger from '../utils/logger';

export const useEnvironment = () => {
  const [environment, setEnvironment] = useState({
    branch: null,
    isStaging: false,
    isProduction: false,
    loading: true
  });

  useEffect(() => {
    const fetchEnvironment = async () => {
      try {
        const response = await fetch('/version.json?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          const branch = data.branch || 'unknown';
          
          setEnvironment({
            branch,
            isStaging: branch === 'staging',
            isProduction: branch === 'main' || branch === 'master',
            loading: false
          });
          
          logger.log('🌍 Environment detected:', branch);
        }
      } catch (error) {
        logger.error('Error fetching environment:', error);
        setEnvironment({
          branch: 'unknown',
          isStaging: false,
          isProduction: true,
          loading: false
        });
      }
    };

    fetchEnvironment();
  }, []);

  return environment;
};