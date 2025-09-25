'use client';
import React from 'react';
import RatingButton from '../ui/RatingButton';
import StatusMessage from '../ui/StatusMessage';
import FormField from '../ui/FormField';
import TextArea from '../ui/TextArea';
import { ButtonGroup } from '../ui';

interface ReviewFormProps {
  coffeeQuality: number;
  setCoffeeQuality: (value: number) => void;
  atmosphere: number | null;
  setAtmosphere: (value: number | null) => void;
  noiseLevel: number | null;
  setNoiseLevel: (value: number | null) => void;
  wifiQuality: number | "na" | null;
  setWifiQuality: (value: number | "na" | null) => void;
  workFriendliness: number | null;
  setWorkFriendliness: (value: number | null) => void;
  service: number | null;
  setService: (value: number | null) => void;
  text: string;
  setText: (value: string) => void;
  saving: boolean;
  handleSubmit: (e?: React.FormEvent) => void;
  userId: string | null;
  error: string | null;
}

export default function ReviewForm({
  coffeeQuality,
  setCoffeeQuality,
  atmosphere,
  setAtmosphere,
  noiseLevel,
  setNoiseLevel,
  wifiQuality,
  setWifiQuality,
  workFriendliness,
  setWorkFriendliness,
  service,
  setService,
  text,
  setText,
  saving,
  handleSubmit,
  userId,
  error
}: ReviewFormProps) {
  // Render the review form
  return (
    <form onSubmit={(e) => handleSubmit(e)} className="mb-4">
      <FormField label="Coffee quality" required={true}>
        <ButtonGroup
          options={[
            { value: 1, label: "1 ★", showStar: true },
            { value: 2, label: "2 ★", showStar: true },
            { value: 3, label: "3 ★", showStar: true },
            { value: 4, label: "4 ★", showStar: true },
            { value: 5, label: "5 ★", showStar: true }
          ]}
          value={coffeeQuality}
          onChange={setCoffeeQuality}
          variant="rating"
          aria-label="Coffee quality"
        />
      </FormField>

      <FormField label="Atmosphere" required={false}>
        <ButtonGroup
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1 ★", showStar: true },
            { value: 2, label: "2 ★", showStar: true },
            { value: 3, label: "3 ★", showStar: true },
            { value: 4, label: "4 ★", showStar: true },
            { value: 5, label: "5 ★", showStar: true }
          ]}
          value={atmosphere}
          onChange={setAtmosphere}
          variant="rating"
          aria-label="Atmosphere"
        />
      </FormField>

      <FormField 
        label="Noise level" 
        required={false} 
        description="(1=quiet, 5=loud)"
      >
        <ButtonGroup
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 4, label: "4" },
            { value: 5, label: "5" }
          ]}
          value={noiseLevel}
          onChange={setNoiseLevel}
          variant="rating"
          aria-label="Noise level"
        />
      </FormField>

      <FormField label="WiFi quality" required={false}>
        <ButtonGroup
          options={[
            { value: "na", label: "N/A" },
            { value: 1, label: "1 ★", showStar: true },
            { value: 2, label: "2 ★", showStar: true },
            { value: 3, label: "3 ★", showStar: true },
            { value: 4, label: "4 ★", showStar: true },
            { value: 5, label: "5 ★", showStar: true }
          ]}
          value={wifiQuality}
          onChange={setWifiQuality}
          variant="rating"
          aria-label="WiFi quality"
        />
      </FormField>

      <FormField label="Work environment" required={false}>
        <ButtonGroup
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1 ★", showStar: true },
            { value: 2, label: "2 ★", showStar: true },
            { value: 3, label: "3 ★", showStar: true },
            { value: 4, label: "4 ★", showStar: true },
            { value: 5, label: "5 ★", showStar: true }
          ]}
          value={workFriendliness}
          onChange={setWorkFriendliness}
          variant="rating"
          aria-label="Work environment"
        />
      </FormField>

      <FormField label="Service" required={false}>
        <ButtonGroup
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1 ★", showStar: true },
            { value: 2, label: "2 ★", showStar: true },
            { value: 3, label: "3 ★", showStar: true },
            { value: 4, label: "4 ★", showStar: true },
            { value: 5, label: "5 ★", showStar: true }
          ]}
          value={service}
          onChange={setService}
          variant="rating"
          aria-label="Service"
        />
      </FormField>

      <FormField label="Your review (optional)">
        <TextArea
          value={text}
          onChange={setText}
          placeholder="Share a short thought about this shop..."
          rows={4}
        />
      </FormField>

      <div className="form-actions-end">
        <button
          type="submit"
          disabled={saving}
          className={`btn-form-primary ${saving ? "is-disabled" : ""}`}
        >
          {saving ? "Saving…" : "Save review"}
        </button>

        <button
          type="button"
          onClick={() => {
            // Reset per-criterion state to defaults
            setCoffeeQuality(5);
            setAtmosphere(null);
            setNoiseLevel(null);
            setWifiQuality("na");
            setWorkFriendliness(null);
            setService(null);
            setText("");
          }}
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