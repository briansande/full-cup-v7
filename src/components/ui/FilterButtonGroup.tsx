'use client';
import React from 'react';

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
  const getButtonStyles = (option: FilterOption, isActive: boolean) => {
    const baseClasses = 'cottage-button px-3 py-2 transition-all duration-200';

    if (variant === 'status' && option.color) {
      return `${baseClasses} ${
        isActive
          ? `${option.color} text-white border-[${option.color}] shadow-md`
          : `hover:bg-[${option.hoverColor || option.color}]/20`
      }`;
    }

    if (variant === 'date') {
      return `${baseClasses} ${
        isActive
          ? 'bg-[--cottage-accent] text-white border-[--cottage-accent] shadow-md'
          : 'hover:bg-[--cottage-secondary]/50'
      }`;
    }

    if (variant === 'primary') {
      return `${baseClasses} ${
        isActive
          ? 'bg-[--cottage-primary] text-white border-[--cottage-primary] shadow-md'
          : 'text-[--cottage-neutral-dark]/70 hover:bg-[--cottage-secondary]/50'
      }`;
    }

    // Default variant
    return `${baseClasses} ${
      isActive
        ? 'cottage-button-primary shadow-md'
        : 'hover:bg-[--cottage-secondary]/50'
    }`;
  };

  const handleButtonClick = (optionValue: string | number | null) => {
    if (disabled) return;

    if (multiSelect) {
      // For multi-select, toggle the value
      const newValue = value === optionValue ? null : optionValue;
      onChange(newValue);
    } else {
      // For single-select, set the value directly
      onChange(optionValue);
    }
  };

  const handleClearClick = () => {
    if (disabled) return;
    onChange(null);
  };

  return (
    <div className={`flex gap-2 items-center flex-wrap ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={String(option.value)}
            onClick={() => handleButtonClick(option.value)}
            className={`${getButtonStyles(option, isActive)} ${buttonClassName}`}
            disabled={disabled}
            aria-pressed={isActive}
            type="button"
          >
            {option.label}
          </button>
        );
      })}

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