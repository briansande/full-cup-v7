'use client';
import React, { useEffect } from 'react';
import type { Map as LeafletMap, LatLngBounds } from 'leaflet';

interface MapEventsProps {
  useMap: () => LeafletMap;
  updateBounds: (bounds: LatLngBounds) => void;
  mapRef: React.MutableRefObject<LeafletMap | null>;
}

export default function MapEvents({ 
  useMap, 
  updateBounds,
  mapRef
}: MapEventsProps) {
  // Get the map instance
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    // Store the map instance for later use
    mapRef.current = map;
    
    // Attach event listeners
    const handleBoundsUpdate = () => {
      if (mapRef.current) {
        const newBounds = mapRef.current.getBounds();
        updateBounds(newBounds);
      }
    };
    
    // Set initial bounds
    handleBoundsUpdate();
    
    map.on('moveend', handleBoundsUpdate);
    map.on('zoomend', handleBoundsUpdate);
    
    // Cleanup
    return () => {
      map.off('moveend', handleBoundsUpdate);
      map.off('zoomend', handleBoundsUpdate);
    };
  }, [map, updateBounds]); // Include updateBounds in dependencies since it's stable
  
  return null;
}