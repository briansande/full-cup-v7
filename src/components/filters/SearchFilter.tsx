'use client';
import React from 'react';

interface SearchFilterProps {
  searchText: string;
  setSearchText: (v: string) => void;
}

export default function SearchFilter({ searchText, setSearchText }: SearchFilterProps) {
  // Render the search filter
  return (
    <input
      aria-label="Search shops"
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      placeholder="Search shops by name"
      className="cottage-input min-w-[200px]"
    />
  );
}