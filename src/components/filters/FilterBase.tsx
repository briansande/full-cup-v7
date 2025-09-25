'use client';

import React from 'react';

interface FilterBaseProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function FilterBase({ label, children, className = '' }: FilterBaseProps) {
  return (
    <div className={`filter-base ${className}`}>
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <div className="filter-content">
        {children}
      </div>
    </div>
  );
}