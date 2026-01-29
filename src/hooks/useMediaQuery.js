// src/hooks/useMediaQuery.js
// Custom hook for responsive design detection

import { useEffect, useState } from 'react';

/**
 * Hook to detect if a media query matches
 * @param {string} query - CSS media query string (e.g., '(max-width: 767px)')
 * @returns {boolean} - Whether the media query matches
 */
export const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(query);

        // Set initial value
        setMatches(media.matches);

        // Create listener for changes
        const listener = () => setMatches(media.matches);

        // Add listener (modern way)
        media.addEventListener('change', listener);

        // Cleanup
        return () => media.removeEventListener('change', listener);
    }, [query]);

    return matches;
};

export default useMediaQuery;
