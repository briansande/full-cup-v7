'use client';
import React from 'react';
import FilterButtonGroup, { FilterOption } from '../ui/FilterButtonGroup';

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
    <div className="flex gap-2 items-center flex-wrap ml-1">
      <div className="text-[--cottage-neutral-dark]/70 text-sm">Show New Shops</div>
      <FilterButtonGroup
        options={dateOptions}
        value={dateDays}
        onChange={setDateDays}
        variant="date"
        showClearButton={true}
        clearButtonLabel="Clear"
        aria-label="Date filter"
      />
    </div>
  );
}