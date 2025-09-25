'use client';
import React from 'react';
import ButtonGroup, { ButtonOption } from './ButtonGroup';

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
  // Map the RatingOption type to ButtonOption type
  const buttonOptions = options.map(option => ({
    value: option.value,
    label: option.label,
    showStar: option.showStar
  }));

  return (
    <ButtonGroup
      options={buttonOptions}
      value={value}
      onChange={onChange}
      variant="rating"
      required={required}
      description={description}
      aria-label={label}
      naLabel={naLabel}
      allowSeparateNa={allowSeparateNa}
    />
  );
}