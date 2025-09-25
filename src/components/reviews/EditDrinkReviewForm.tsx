'use client';
import React from 'react';
import FormField from '../ui/FormField';
import TextInput from '../ui/TextInput';
import TextArea from '../ui/TextArea';
import { ButtonGroup } from '../ui';

interface EditDrinkReviewFormProps {
  editDrinkName: string;
  setEditDrinkName: (value: string) => void;
  editDrinkType: string;
  setEditDrinkType: (value: string) => void;
  editRating: string;
  setEditRating: (value: string) => void;
  editText: string;
  setEditText: (value: string) => void;
 saving: boolean;
  submitEdit: () => void;
  cancelEdit: () => void;
}

export default function EditDrinkReviewForm({
  editDrinkName,
  setEditDrinkName,
  editDrinkType,
  setEditDrinkType,
  editRating,
  setEditRating,
  editText,
  setEditText,
  saving,
  submitEdit,
  cancelEdit
}: EditDrinkReviewFormProps) {
  // Render the edit drink review form
  return (
    <div className="flex flex-col gap-2">
      <FormField label="Drink name">
        <TextInput
          value={editDrinkName}
          onChange={setEditDrinkName}
          placeholder="Drink name"
        />
      </FormField>
      
      <FormField label="Drink type (optional)">
        <TextInput
          value={editDrinkType}
          onChange={setEditDrinkType}
          placeholder="Drink type (optional)"
        />
      </FormField>
      
      <FormField label="Rating">
        <ButtonGroup
          options={[
            { value: "pass", label: "Pass" },
            { value: "good", label: "Good" },
            { value: "awesome", label: "Awesome" },
          ]}
          value={editRating}
          onChange={setEditRating}
          variant="rating"
          aria-label="Drink rating"
        />
      </FormField>
      
      <FormField label="Review (optional)">
        <TextArea
          value={editText}
          onChange={setEditText}
          placeholder="Share a short thought about the drink..."
          rows={3}
        />
      </FormField>
      
      <div className="flex gap-2">
        <button
          onClick={() => submitEdit()}
          disabled={saving}
          className={`btn-form-primary ${saving ? "is-disabled" : ""}`}
        >
          Save
        </button>
        <button
          onClick={() => cancelEdit()}
          disabled={saving}
          className={`btn-form-secondary ${saving ? "is-disabled" : ""}`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}