'use client';
import React from 'react';

interface ClearFiltersButtonProps {
  clearFilters: () => void;
}

export default function ClearFiltersButton({ clearFilters }: ClearFiltersButtonProps) {
  // Render the clear filters button
  return (
    <button
      onClick={clearFilters}
      className="cottage-button px-3 py-2 hover:bg-[--cottage-secondary]/50"
    >
      Clear Filters
    </button>
  );
}