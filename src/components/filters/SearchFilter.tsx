'use client';
import React from 'react';
import FilterBase from './FilterBase';
import TextInput from '../ui/TextInput';

interface SearchFilterProps {
  searchText: string;
  setSearchText: (v: string) => void;
}

export default function SearchFilter({ searchText, setSearchText }: SearchFilterProps) {
  // Render the search filter
  return (
    <FilterBase label="Search">
      <TextInput
        value={searchText}
        onChange={setSearchText}
        placeholder="Search shops by name"
        aria-label="Search shops"
      />
    </FilterBase>
  );
}