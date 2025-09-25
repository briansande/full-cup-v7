'use client';

import React from 'react';

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  description?: string;
  error?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
}

export default function TextArea({
  value,
  onChange,
  placeholder = '',
  label,
  required = false,
  description,
  error,
  className = '',
  rows = 4,
  disabled = false
}: TextAreaProps) {
  return (
    <div className={`form-textarea-container ${className}`}>
      {label && (
        <label className="block font-semibold mb-1.5">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`cottage-input w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
          error 
            ? 'border-red-500 focus:ring-red-200' 
            : 'border-gray-300 focus:ring-blue-200'
        } ${disabled ? 'bg-gray-100' : ''}`}
      />
      
      {description && !error && (
        <div className="text-sm text-gray-500 mt-1">
          {description}
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-600 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}