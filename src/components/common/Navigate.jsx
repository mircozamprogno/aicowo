import { useEffect } from 'react';

import logger from '../../utils/logger';

const Navigate = ({ to }) => {
  useEffect(() => {
    const currentHash = window.location.hash.slice(1);
    if (currentHash !== to) {
      logger.log('Navigating from', currentHash, 'to', to);
      window.location.hash = to;
    }
  }, [to]);
  
  return null;
};

export default Navigate;