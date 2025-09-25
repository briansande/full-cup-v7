'use client';
import React from 'react';

interface MapLoadingIndicatorProps {
  loading: boolean;
}

export default function MapLoadingIndicator({ loading }: MapLoadingIndicatorProps) {
  // If not loading, don't render anything
  if (!loading) return null;
  
  return (
    <div
      className="absolute top-4 left-4 z-[1000] bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm shadow-md flex items-center gap-2"
    >
      <div className="w-4 h-4 border-2 border-[--cottage-primary] border-t-transparent rounded-full animate-spin"></div>
      Loading shops...
    </div>
  );
}