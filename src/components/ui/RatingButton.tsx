'use client';
import React from 'react';

interface RatingOption {
  value: number | "na" | null;
  label: string;
  showStar?: boolean;
}

interface RatingButtonProps {
  label: string;
  value: number | "na" | null;
  onChange: (value: number | "na" | null) => void;
  options: RatingOption[];
  required?: boolean;
  description?: string;
  naLabel?: string;
  allowSeparateNa?: boolean;
}

export default function RatingButton({
  label,
  value,
  onChange,
  options,
  required = false,
  description,
  naLabel = "N/A",
  allowSeparateNa = false
}: RatingButtonProps) {
  const baseButtonClasses = "px-1.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-900 cursor-pointer font-bold";
  const selectedButtonStyle = "px-1.5 py-1.5 rounded-md border border-gray-900 bg-gray-900 text-white cursor-pointer font-bold";

  return (
    <div className="font-semibold block mb-1.5">
      <div className="mb-1.5">
        {label}{required && " (required)"}
        {description && (
          <div className="text-sm font-normal text-gray-500 mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div className="flex gap-1.5 items-center mb-2">
        {options.map((option) => {
          const selected = option.value === value;
          const buttonClasses = selected ? selectedButtonStyle : baseButtonClasses;

          return (
            <button
              key={`${label}-${String(option.value)}`}
              type="button"
              onClick={() => onChange(option.value)}
              className={buttonClasses}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}