import { MapPin, Navigation, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';

import logger from '../../utils/logger';

const MapSelector = ({ latitude, longitude, onCoordinatesChange, address }) => {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Default coordinates (Rome, Italy)
  const defaultLat = 41.9028;
  const defaultLng = 12.4964;

  // Current coordinates (use provided or default)
  const currentLat = latitude || defaultLat;
  const currentLng = longitude || defaultLng;

  // Load Leaflet CSS and JS
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        // Check if Leaflet is already loaded
        if (window.L) {
          setMapLoaded(true);
          return;
        }

        // Load Leaflet CSS
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin = '';
        
        script.onload = () => {
          setMapLoaded(true);
        };
        
        script.onerror = () => {
          setMapError('Failed to load map library');
        };

        document.head.appendChild(script);
      } catch (error) {
        logger.error('Error loading Leaflet:', error);
        setMapError('Failed to load map library');
      }
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      // Create map instance
      const map = window.L.map(mapRef.current, {
        center: [currentLat, currentLng],
        zoom: latitude && longitude ? 15 : 10,
        zoomControl: true,
        attributionControl: true
      });

      // Add tile layer (OpenStreetMap)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Create custom icon for location marker
      const locationIcon = window.L.divIcon({
        html: `<div class="custom-map-marker">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 5.02944 7.02944 1 12 1C16.9706 1 21 5.02944 21 10Z" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        className: 'custom-leaflet-marker'
      });

      // Add marker if coordinates exist
      if (latitude && longitude) {
        const marker = window.L.marker([currentLat, currentLng], {
          icon: locationIcon,
          draggable: true
        }).addTo(map);

        // Handle marker drag
        marker.on('dragend', function(e) {
          const position = e.target.getLatLng();
          onCoordinatesChange(position.lat, position.lng);
        });

        markerRef.current = marker;
      }

      // Handle map click
      map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        
        // Remove existing marker
        if (markerRef.current) {
          map.removeLayer(markerRef.current);
        }

        // Add new marker
        const marker = window.L.marker([lat, lng], {
          icon: locationIcon,
          draggable: true
        }).addTo(map);

        // Handle marker drag
        marker.on('dragend', function(e) {
          const position = e.target.getLatLng();
          onCoordinatesChange(position.lat, position.lng);
        });

        markerRef.current = marker;
        onCoordinatesChange(lat, lng);
      });

      mapInstanceRef.current = map;

    } catch (error) {
      logger.error('Error initializing map:', error);
      setMapError('Failed to initialize map');
    }
  }, [mapLoaded, currentLat, currentLng]);

  // Update marker position when coordinates change externally
  useEffect(() => {
    if (!mapInstanceRef.current || !latitude || !longitude) return;

    const map = mapInstanceRef.current;

    // Remove existing marker
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    // Create custom icon
    const locationIcon = window.L.divIcon({
      html: `<div class="custom-map-marker">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 5.02944 7.02944 1 12 1C16.9706 1 21 5.02944 21 10Z" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
          <circle cx="12" cy="10" r="3" fill="white"/>
        </svg>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      className: 'custom-leaflet-marker'
    });

    // Add new marker
    const marker = window.L.marker([latitude, longitude], {
      icon: locationIcon,
      draggable: true
    }).addTo(map);

    // Handle marker drag
    marker.on('dragend', function(e) {
      const position = e.target.getLatLng();
      onCoordinatesChange(position.lat, position.lng);
    });

    markerRef.current = marker;

    // Center map on new location
    map.setView([latitude, longitude], 15);
  }, [latitude, longitude, onCoordinatesChange]);

  // Reset to default location
  const resetToDefault = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([defaultLat, defaultLng], 10);
      
      // Remove marker
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      
      // Clear coordinates
      onCoordinatesChange(null, null);
    }
  };

  // Center on current location (if available)
  const centerOnCurrentLocation = () => {
    if (latitude && longitude && mapInstanceRef.current) {
      mapInstanceRef.current.setView([latitude, longitude], 15);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (mapError) {
    return (
      <div className="map-error">
        <div className="map-error-content">
          <MapPin size={48} />
          <h3>{t('locations.mapLoadError')}</h3>
          <p>{mapError}</p>
        </div>
      </div>
    );
  }

  if (!mapLoaded) {
    return (
      <div className="map-loading">
        <div className="map-loading-content">
          <div className="map-loading-spinner"></div>
          <p>{t('locations.loadingMap')}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-selector">
      <div className="map-controls">
        <div className="map-controls-left">
          {address && (
            <div className="map-address-display">
              <MapPin size={16} />
              <span>{address}</span>
            </div>
          )}
        </div>
        <div className="map-controls-right">
          {latitude && longitude && (
            <button
              type="button"
              onClick={centerOnCurrentLocation}
              className="map-control-button"
              title={t('locations.centerOnLocation')}
            >
              <Navigation size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={resetToDefault}
            className="map-control-button"
            title={t('locations.resetLocation')}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div className="map-container">
        <div ref={mapRef} className="leaflet-map" />
        
        <div className="map-overlay-info">
          <div className="map-instruction">
            <MapPin size={16} />
            <span>{t('locations.clickToSelectLocation')}</span>
          </div>
          
          {latitude && longitude && (
            <div className="map-coordinates">
              <span className="map-coordinate">
                <strong>{t('locations.lat')}:</strong> {latitude.toFixed(6)}
              </span>
              <span className="map-coordinate">
                <strong>{t('locations.lng')}:</strong> {longitude.toFixed(6)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapSelector;