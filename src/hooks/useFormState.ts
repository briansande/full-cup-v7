import { useState, useCallback } from 'react';

interface FormState<T> {
  formData: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
  handleChange: (field: keyof T, value: any) => void;
  setFormData: (data: Partial<T>) => void;
 setError: (field: keyof T, error: string) => void;
  clearErrors: (field?: keyof T) => void;
  resetForm: (initialData?: T) => void;
  startSubmitting: () => void;
  stopSubmitting: () => void;
}

export default function useFormState<T extends Record<string, any>>(
  initialData: T
): FormState<T> {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleChange = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is changed
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const setError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  }, []);

  const clearErrors = useCallback((field?: keyof T) => {
    if (field) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    } else {
      setErrors({});
    }
  }, []);

  const resetForm = useCallback((initialDataOverride?: T) => {
    setFormData(initialDataOverride || initialData);
    setErrors({});
    setIsSubmitting(false);
  }, [initialData]);

  const startSubmitting = useCallback(() => {
    setIsSubmitting(true);
  }, []);

  const stopSubmitting = useCallback(() => {
    setIsSubmitting(false);
  }, []);

  return {
    formData,
    errors,
    isSubmitting,
    handleChange,
    setFormData: (data: Partial<T>) => setFormData(prev => ({ ...prev, ...data })),
    setError,
    clearErrors,
    resetForm,
    startSubmitting,
    stopSubmitting,
  };
}