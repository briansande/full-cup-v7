'use client';
import React from 'react';
import FormField from '../ui/FormField';
import TextInput from '../ui/TextInput';
import TextArea from '../ui/TextArea';
import StatusMessage from '../ui/StatusMessage';
import { ButtonGroup } from '../ui';
import { useFormState } from '@/src/hooks';

interface DrinkReviewFormWithHookProps {
  saving: boolean;
  handleSubmit: (data: DrinkReviewFormData) => void;
  userId: string | null;
  error: string | null;
}

interface DrinkReviewFormData {
  drinkName: string;
  drinkType: string;
  rating: string;
  text: string;
}

export default function DrinkReviewFormWithHook({
  saving,
  handleSubmit,
  userId,
  error
}: DrinkReviewFormWithHookProps) {
  const {
    formData,
    handleChange,
    resetForm,
    startSubmitting,
    stopSubmitting
  } = useFormState<DrinkReviewFormData>({
    drinkName: '',
    drinkType: '',
    rating: 'good',
    text: ''
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startSubmitting();
    try {
      await handleSubmit(formData);
      // Reset form on successful submission
      resetForm();
    } finally {
      stopSubmitting();
    }
  };

  const onReset = () => {
    resetForm();
  };

  return (
    <form onSubmit={onSubmit} className="mb-4">
      <FormField label="Drink name" required={true}>
        <TextInput
          value={formData.drinkName}
          onChange={(value) => handleChange('drinkName', value)}
          placeholder="e.g., Caffe Latte"
        />
      </FormField>

      <FormField label="Rating" required={true}>
        <ButtonGroup
          options={[
            { value: "pass", label: "Pass" },
            { value: "good", label: "Good" },
            { value: "awesome", label: "Awesome" },
          ]}
          value={formData.rating}
          onChange={(value) => handleChange('rating', value)}
          variant="rating"
          aria-label="Drink rating"
        />
      </FormField>

      <FormField label="Review (optional)">
        <TextArea
          value={formData.text}
          onChange={(value) => handleChange('text', value)}
          placeholder="Share a short thought about the drink..."
          rows={3}
        />
      </FormField>

      <FormField label="Drink type (optional)">
        <TextInput
          value={formData.drinkType}
          onChange={(value) => handleChange('drinkType', value)}
          placeholder="e.g., espresso, pour over, cold brew"
        />
      </FormField>

      <div className="form-actions-end">
        <button
          type="submit"
          disabled={saving}
          className={`btn-form-primary ${saving ? "is-disabled" : ""}`}
        >
          {saving ? "Saving…" : "Add drink review"}
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className={`btn-form-secondary ${saving ? "is-disabled" : ""}`}
        >
          Reset
        </button>

        {error && <StatusMessage type="error" message={error} />}
      </div>
    </form>
  );
}