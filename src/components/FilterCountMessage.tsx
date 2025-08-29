'use client';
import React from 'react';

interface FilterCountMessageProps {
  filterCountMessage: string;
}

export default function FilterCountMessage({ filterCountMessage }: FilterCountMessageProps) {
  // Render the filter count message
  return (
    <div
      className="absolute top-4 left-4 z-[1100] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm text-[--cottage-neutral-dark] shadow-md"
    >
      {filterCountMessage}
    </div>
  );
}