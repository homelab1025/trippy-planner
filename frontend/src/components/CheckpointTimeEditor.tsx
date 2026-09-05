import { useState } from 'react';

interface Props {
  title: string;
  initialTime: Date;
  minTime: Date;
  maxTime: Date;
  position: { x: number; y: number };
  onSave: (time: Date) => void;
  onCancel: () => void;
}

const toHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function CheckpointTimeEditor({ title, initialTime, minTime, maxTime, position, onSave, onCancel }: Props) {
  const [value, setValue] = useState(toHHMM(initialTime));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const [hours, minutes] = value.split(':').map(Number);
    const candidate = new Date(initialTime);
    candidate.setHours(hours, minutes, 0, 0);

    if (candidate.getTime() <= minTime.getTime() || candidate.getTime() >= maxTime.getTime()) {
      setError('Time must stay between the neighboring checkpoints.');
      return;
    }
    setError(null);
    onSave(candidate);
  }

  return (
    <div
      className="fixed bg-base-100 shadow-lg rounded-lg p-3 z-50 w-56 text-sm"
      style={{ left: position.x, top: position.y }}
    >
      <div className="font-semibold mb-2">{title}</div>
      <label htmlFor="checkpoint-time-input" className="label pb-1">
        <span className="label-text text-xs">Arrival time</span>
      </label>
      <input
        id="checkpoint-time-input"
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input input-bordered input-sm w-full mb-2"
      />
      {error && <div className="text-error text-xs mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn btn-xs" onClick={onCancel}>Cancel</button>
        <button className="btn btn-xs btn-primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}
