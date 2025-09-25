'use client';

import React from 'react';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  description?: string;
  error?: string;
  className?: string;
  type?: string;
  disabled?: boolean;
}

export default function TextInput({
  value,
  onChange,
  placeholder = '',
  label,
  required = false,
  description,
  error,
  className = '',
  type = 'text',
  disabled = false
}: TextInputProps) {
  return (
    <div className={`form-input-container ${className}`}>
      {label && (
        <label className="block font-semibold mb-1.5">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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