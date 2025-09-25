'use client';

import React from 'react';

export interface ButtonOption {
  value: string | number | null;
  label: string;
 icon?: React.ReactNode;
  showStar?: boolean;
}

export interface ButtonGroupProps {
  options: ButtonOption[];
  value: string | number | null;
  onChange: (value: any) => void;
  variant?: 'rating' | 'filter' | 'status' | 'date' | 'primary' | 'default';
  multiSelect?: boolean;
  required?: boolean;
  description?: string;
  className?: string;
 buttonClassName?: string;
  disabled?: boolean;
  'aria-label'?: string;
  naLabel?: string;
  allowSeparateNa?: boolean;
}

export default function ButtonGroup({
  options,
  value,
  onChange,
  variant = 'filter',
  multiSelect = false,
  required = false,
  description,
  className = '',
  buttonClassName = '',
  disabled = false,
  'aria-label': ariaLabel,
  naLabel = "N/A",
  allowSeparateNa = false
}: ButtonGroupProps) {
  const getButtonStyles = (option: ButtonOption, isActive: boolean) => {
    const baseClasses = `cottage-button px-2 py-2 rounded-md border cursor-pointer font-bold transition-all duration-20 ${buttonClassName}`;

    switch (variant) {
      case 'status':
        return `${baseClasses} ${
          isActive
            ? 'bg-gray-900 text-white border-gray-900 shadow-md'
            : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'
        }`;

      case 'date':
        return `${baseClasses} ${
          isActive
            ? 'bg-[--cottage-accent] text-white border-[--cottage-accent] shadow-md'
            : 'bg-white text-gray-900 border-gray-300 hover:bg-[--cottage-secondary]/50'
        }`;

      case 'primary':
        return `${baseClasses} ${
          isActive
            ? 'bg-[--cottage-primary] text-white border-[--cottage-primary] shadow-md'
            : 'text-[--cottage-neutral-dark]/70 border-gray-300 hover:bg-[--cottage-secondary]/50'
        }`;

      case 'rating':
        return `${baseClasses} ${
          isActive
            ? 'bg-gray-900 text-white border-gray-900 shadow-md'
            : 'bg-white text-gray-900 border-gray-30 hover:bg-gray-100'
        }`;

      case 'default':
        return `${baseClasses} ${
          isActive
            ? 'cottage-button-primary shadow-md'
            : 'border-gray-300 hover:bg-[--cottage-secondary]/50'
        }`;

      case 'filter':
      default:
        return `${baseClasses} ${
          isActive
            ? 'cottage-button-primary shadow-md'
            : 'border-gray-30 hover:bg-[--cottage-secondary]/50'
        }`;
    }
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

  return (
    <div className={`font-semibold block mb-1.5 ${className}`}>
      <div className="mb-1.5">
        {ariaLabel}{required && " (required)"}
        {description && (
          <div className="text-sm font-normal text-gray-50 mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div className="flex gap-1.5 items-center mb-2">
        {options.map((option) => {
          const selected = option.value === value;
          const buttonClasses = getButtonStyles(option, selected);

          return (
            <button
              key={`${ariaLabel || 'button'}-${String(option.value)}`}
              type="button"
              onClick={() => handleButtonClick(option.value)}
              className={buttonClasses}
              disabled={disabled}
              aria-pressed={selected}
            >
              {option.icon && <span className="mr-1">{option.icon}</span>}
              {option.showStar ? `${option.label} ★` : option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}