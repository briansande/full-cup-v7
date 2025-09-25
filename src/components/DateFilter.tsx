'use client';
import React from 'react';

interface DateFilterProps {
  dateDays: number | null;
  setDateDays: (v: number | null) => void;
  DATE_FILTER_OPTIONS: { label: string; days: number }[];
}

export default function DateFilter({ dateDays, setDateDays, DATE_FILTER_OPTIONS }: DateFilterProps) {
  // Render the date filter
  return (
    <div className="flex gap-2 items-center flex-wrap ml-1">
      <div className="text-[--cottage-neutral-dark]/70 text-sm">Show New Shops</div>
      {DATE_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          onClick={() => setDateDays(opt.days)}
          className={`cottage-button px-3 py-2 ${
            dateDays === opt.days 
              ? 'bg-[--cottage-accent] text-white border-[--cottage-accent] shadow-md' 
              : 'hover:bg-[--cottage-secondary]/50'
          }`}
          aria-pressed={dateDays === opt.days}
        >
          {opt.label}
        </button>
      ))}
      <button
        onClick={() => setDateDays(null)}
        className={`cottage-button px-2 py-1.5 ${
          dateDays === null 
            ? 'bg-[--cottage-primary] text-white border-[--cottage-primary] shadow-md' 
            : 'text-[--cottage-neutral-dark]/70 hover:bg-[--cottage-secondary]/50'
        }`}
        title="Clear date filter"
      >
        Clear
      </button>
    </div>
  );
}