'use client';
import React from 'react';
import FilterButtonGroup, { FilterOption } from '../ui/FilterButtonGroup';

interface StatusFilterProps {
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
}

const STATUS_OPTIONS: FilterOption[] = [
  { value: null, label: 'All' },
  { value: 'want_to_try', label: 'Want to Try', color: '#CC7357', hoverColor: '#CC7357' },
  { value: 'visited', label: 'Visited', color: '#8FBC8F', hoverColor: '#8FBC8F' },
  { value: 'favorite', label: 'Favorites', color: '#D2691E', hoverColor: '#D2691E' },
];

export default function StatusFilter({ statusFilter, setStatusFilter }: StatusFilterProps) {
  return (
    <FilterButtonGroup
      options={STATUS_OPTIONS}
      value={statusFilter}
      onChange={setStatusFilter}
      variant="status"
      aria-label="Status filter"
    />
  );
}