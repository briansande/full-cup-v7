'use client';
import React from 'react';
import RatingButton from '../ui/RatingButton';
import StatusMessage from '../ui/StatusMessage';

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
      <div className="rating-group">
        <RatingButton
          label="Coffee quality"
          value={coffeeQuality}
          onChange={setCoffeeQuality}
          required={true}
          options={[
            { value: 1, label: "1 ★" },
            { value: 2, label: "2 ★" },
            { value: 3, label: "3 ★" },
            { value: 4, label: "4 ★" },
            { value: 5, label: "5 ★" }
          ]}
        />

        <RatingButton
          label="Atmosphere"
          value={atmosphere}
          onChange={setAtmosphere}
          required={false}
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1 ★" },
            { value: 2, label: "2 ★" },
            { value: 3, label: "3 ★" },
            { value: 4, label: "4 ★" },
            { value: 5, label: "5 ★" }
          ]}
        />

        <RatingButton
          label="Noise level"
          value={noiseLevel}
          onChange={setNoiseLevel}
          required={false}
          description="(1=quiet, 5=loud)"
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
            { value: 4, label: "4" },
            { value: 5, label: "5" }
          ]}
        />

        <RatingButton
          label="WiFi quality"
          value={wifiQuality}
          onChange={setWifiQuality}
          required={false}
          options={[
            { value: "na", label: "N/A" },
            { value: 1, label: "1 ★" },
            { value: 2, label: "2 ★" },
            { value: 3, label: "3 ★" },
            { value: 4, label: "4 ★" },
            { value: 5, label: "5 ★" }
          ]}
        />

        <RatingButton
          label="Work environment"
          value={workFriendliness}
          onChange={setWorkFriendliness}
          required={false}
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1 ★" },
            { value: 2, label: "2 ★" },
            { value: 3, label: "3 ★" },
            { value: 4, label: "4 ★" },
            { value: 5, label: "5 ★" }
          ]}
        />

        <RatingButton
          label="Service"
          value={service}
          onChange={setService}
          required={false}
          options={[
            { value: null, label: "N/A" },
            { value: 1, label: "1 ★" },
            { value: 2, label: "2 ★" },
            { value: 3, label: "3 ★" },
            { value: 4, label: "4 ★" },
            { value: 5, label: "5 ★" }
          ]}
        />
      </div>

      <div className="form-field">
        <label>Your review (optional)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="form-textarea"
          placeholder="Share a short thought about this shop..."
        />
      </div>

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