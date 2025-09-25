'use client';
import React from 'react';
import ButtonGroup, { ButtonOption } from './ButtonGroup';

export interface FilterOption {
 value: string | number | null;
  label: string;
 color?: string;
 hoverColor?: string;
}

export interface FilterButtonGroupProps {
  options: FilterOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  variant?: 'default' | 'status' | 'date' | 'primary';
  multiSelect?: boolean;
  showClearButton?: boolean;
  clearButtonLabel?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export default function FilterButtonGroup({
  options,
  value,
  onChange,
  variant = 'default',
  multiSelect = false,
  showClearButton = false,
  clearButtonLabel = 'Clear',
  className = '',
  buttonClassName = '',
  disabled = false,
  'aria-label': ariaLabel,
}: FilterButtonGroupProps) {
  // Map the FilterOption type to ButtonOption type
  const buttonOptions = options.map(option => ({
    value: option.value,
    label: option.label
  }));

  const handleClearClick = () => {
    if (disabled) return;
    onChange(null);
  };

  return (
    <div className={`flex gap-2 items-center flex-wrap ${className}`}>
      <ButtonGroup
        options={buttonOptions}
        value={value}
        onChange={onChange}
        variant={variant as 'default' | 'status' | 'date' | 'primary' | 'rating' | 'filter'} // Type assertion to match ButtonGroup's variant
        multiSelect={multiSelect}
        aria-label={ariaLabel}
        className={buttonClassName}
        disabled={disabled}
      />
      
      {showClearButton && (
        <button
          onClick={handleClearClick}
          className={`cottage-button px-2 py-1.5 ${
            value === null
              ? 'bg-[--cottage-primary] text-white border-[--cottage-primary] shadow-md'
              : 'text-[--cottage-neutral-dark]/70 hover:bg-[--cottage-secondary]/50'
          } ${buttonClassName}`}
          disabled={disabled}
          title={`Clear ${ariaLabel || 'filter'}`}
          type="button"
        >
          {clearButtonLabel}
        </button>
      )}
    </div>
  );
}