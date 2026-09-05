// frontend/src/components/CheckpointTrackRow.tsx
import { useState } from 'react';
import type { Checkpoint } from '../utils/speedProfile';
import { computeArrivalTime } from '../utils/speedProfile';
import { CheckpointTimeEditor } from './CheckpointTimeEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './chartConstants';
import { chartPalette } from '../theme/chartColors';

interface Props {
  checkpoints: Checkpoint[];
  startTime: Date;
  totalDistanceM: number;
  distanceRange: [number, number]; // km
  chartWidth: number;
  onChange: (next: Checkpoint[]) => void;
}

const PLOT_LEFT = CHART_MARGIN_LEFT + CHART_YAXIS_LEFT_WIDTH;
const PLOT_RIGHT_OFFSET = 55;

interface FullPoint { distanceM: number; arrivalTime: Date; id: string | 'start' }

function fullSequence(checkpoints: Checkpoint[], startTime: Date): FullPoint[] {
  return [
    { distanceM: 0, arrivalTime: startTime, id: 'start' },
    ...checkpoints.slice().sort((a, b) => a.distanceM - b.distanceM).map(cp => ({ ...cp })),
  ];
}

export function CheckpointTrackRow({ checkpoints, startTime, distanceRange, chartWidth, onChange }: Props) {
  const [dMin, dMax] = distanceRange;
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;
  const xOf = (km: number) => PLOT_LEFT + ((km - dMin) / (dMax - dMin)) * plotWidth;
  const kmOf = (x: number) => dMin + ((x - PLOT_LEFT) / plotWidth) * (dMax - dMin);

  const [pendingAddKm, setPendingAddKm] = useState<number | null>(null);
  const [editor, setEditor] = useState<{
    title: string;
    initialTime: Date;
    minTime: Date;
    maxTime: Date;
    position: { x: number; y: number };
    onSave: (time: Date) => void;
  } | null>(null);

  const sequence = fullSequence(checkpoints, startTime);

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    // Measure the wrapper (this element's parent), not the track-line div itself —
    // xOf/kmOf both bake PLOT_LEFT in as an offset from the wrapper's own left edge,
    // and the track-line div is already inset by PLOT_LEFT within that wrapper, so
    // using its own rect here would double-count that inset in a real browser layout
    // (invisible in jsdom-stubbed tests, since jsdom doesn't compute real layout —
    // this must match the same measurement point onMarkerMouseDown uses for drag).
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const km = kmOf(x);
    // PLOT_RIGHT_OFFSET/PLOT_LEFT leave empty margin on each side of the plotted
    // route within this element's own width — a click landing in that margin maps
    // to a distance outside [dMin, dMax] and must be rejected, not clamped, since
    // silently clamping would let a click far into the margin add a checkpoint
    // right at the route's start/end instead of doing nothing as the user'd expect.
    if (km < dMin || km > dMax) return;
    const tooClose = sequence.some(p => Math.abs(p.distanceM / 1000 - km) < (dMax - dMin) * 0.01);
    if (tooClose) return;
    setPendingAddKm(km);
  }

  function confirmAdd(clientX: number, clientY: number) {
    if (pendingAddKm === null) return;
    const distanceM = pendingAddKm * 1000;
    let prev = sequence[0], next = sequence[sequence.length - 1];
    for (let i = 0; i < sequence.length - 1; i++) {
      if (distanceM >= sequence[i].distanceM && distanceM <= sequence[i + 1].distanceM) {
        prev = sequence[i]; next = sequence[i + 1]; break;
      }
    }
    const estimate = computeArrivalTime(distanceM, startTime, checkpoints);
    setPendingAddKm(null);
    setEditor({
      title: 'Set arrival time',
      initialTime: estimate,
      minTime: prev.arrivalTime,
      maxTime: next.arrivalTime,
      position: { x: clientX, y: clientY },
      onSave: (time) => {
        const waypoint: Checkpoint = {
          id: `wp-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          distanceM,
          arrivalTime: time,
          pinned: true,
        };
        onChange([...checkpoints, waypoint]);
        setEditor(null);
      },
    });
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        data-testid="checkpoint-track-line"
        onClick={handleTrackClick}
        style={{
          position: 'absolute',
          left: PLOT_LEFT,
          width: plotWidth,
          top: '50%',
          height: 2,
          background: '#d3dad6',
          cursor: 'copy',
        }}
      />
      {sequence.map((p) => (
        <div
          key={p.id}
          data-checkpoint-marker
          style={{
            position: 'absolute',
            left: xOf(p.distanceM / 1000) - 6,
            top: 'calc(50% - 6px)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: p.id === 'start' || p.id === 'end' ? chartPalette.checkpointLocked : chartPalette.checkpointWaypoint,
            border: '2px solid white',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
          }}
        />
      ))}

      {pendingAddKm !== null && (
        <ConfirmDialog
          open={true}
          title="Add checkpoint here?"
          message={`${pendingAddKm.toFixed(1)} km from start`}
          confirming={false}
          confirmLabel="Yes, add"
          onCancel={() => setPendingAddKm(null)}
          onConfirm={() => confirmAdd(window.innerWidth / 2, window.innerHeight / 2)}
        />
      )}

      {editor && (
        <CheckpointTimeEditor
          title={editor.title}
          initialTime={editor.initialTime}
          minTime={editor.minTime}
          maxTime={editor.maxTime}
          position={editor.position}
          onSave={editor.onSave}
          onCancel={() => setEditor(null)}
        />
      )}
    </div>
  );
}
