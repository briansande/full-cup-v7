'use client';
import React from 'react';
import FilterButtonGroup, { FilterOption } from '../ui/FilterButtonGroup';
import FilterBase from './FilterBase';

interface DateFilterProps {
  dateDays: number | null;
  setDateDays: (v: number | null) => void;
  DATE_FILTER_OPTIONS: { label: string; days: number }[];
}

export default function DateFilter({ dateDays, setDateDays, DATE_FILTER_OPTIONS }: DateFilterProps) {
  const dateOptions: FilterOption[] = DATE_FILTER_OPTIONS.map(opt => ({
    value: opt.days,
    label: opt.label
  }));

  return (
    <FilterBase label="Show New Shops">
      <FilterButtonGroup
        options={dateOptions}
        value={dateDays}
        onChange={setDateDays}
        variant="date"
        showClearButton={true}
        clearButtonLabel="Clear"
        aria-label="Date filter"
      />
    </FilterBase>
  );
}