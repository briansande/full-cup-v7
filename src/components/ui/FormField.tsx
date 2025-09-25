'use client';

import React from 'react';

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  description?: string;
  error?: string;
  className?: string;
}

export default function FormField({
  label,
  children,
  required = false,
  description,
  error,
  className = ''
}: FormFieldProps) {
  return (
    <div className={`form-field mb-4 ${className}`}>
      <label className="block font-semibold mb-1.5">
        {label}
        {required && <span className="text-red-50"> *</span>}
      </label>
      
      {children}
      
      {description && (
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