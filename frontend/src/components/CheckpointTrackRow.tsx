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

  const [dragId, setDragId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cascade, setCascade] = useState<{
    downstreamIds: string[];
    deltaMs: number;
    pendingCheckpoints: Checkpoint[];
    position: { x: number; y: number };
  } | null>(null);

  const sequence = fullSequence(checkpoints, startTime);

  function neighborsOf(id: string): { prev: FullPoint; next: FullPoint | null } {
    const idx = sequence.findIndex(p => p.id === id);
    return { prev: sequence[idx - 1], next: idx + 1 < sequence.length ? sequence[idx + 1] : null };
  }

  function onMarkerMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    setDragId(id);
    const trackEl = e.currentTarget.parentElement as HTMLElement;

    function onMove(ev: MouseEvent) {
      const rect = trackEl.getBoundingClientRect();
      let km = kmOf(ev.clientX - rect.left);
      const { prev, next } = neighborsOf(id);
      const minKm = prev.distanceM / 1000 + (dMax - dMin) * 0.005;
      const maxKm = next ? next.distanceM / 1000 - (dMax - dMin) * 0.005 : dMax;
      km = Math.min(maxKm, Math.max(minKm, km));
      onChange(checkpoints.map(cp => cp.id === id ? { ...cp, distanceM: km * 1000 } : cp));
    }
    function onUp() {
      setDragId(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onMarkerContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault();
    setMenu({ id, x: e.clientX, y: e.clientY });
  }

  function menuChangeTime() {
    if (!menu) return;
    const { id, x, y } = menu;
    const cp = checkpoints.find(c => c.id === id)!;
    const { prev, next } = neighborsOf(id);
    setMenu(null);
    setEditor({
      title: 'Change arrival time',
      initialTime: cp.arrivalTime,
      minTime: prev.arrivalTime,
      maxTime: next ? next.arrivalTime : new Date(cp.arrivalTime.getTime() + 365 * 24 * 3_600_000),
      position: { x, y },
      onSave: (time) => {
        const idx = sequence.findIndex(p => p.id === id);
        // idx is this checkpoint's position within [start, ...checkpoints] — everything
        // after it is a real downstream checkpoint ('start' can never appear here,
        // since it's always index 0).
        const downstream = sequence.slice(idx + 1);
        const deltaMs = time.getTime() - cp.arrivalTime.getTime();
        const updated = checkpoints.map(c => c.id === id ? { ...c, arrivalTime: time, pinned: true } : c);
        setEditor(null);
        if (deltaMs !== 0 && downstream.length > 0) {
          setCascade({
            downstreamIds: downstream.map(p => p.id),
            deltaMs,
            pendingCheckpoints: updated,
            position: { x, y },
          });
        } else {
          onChange(updated);
        }
      },
    });
  }

  function menuDelete() {
    if (!menu) return;
    onChange(checkpoints.filter(c => c.id !== menu.id));
    setMenu(null);
  }

  function cascadeShift() {
    if (!cascade) return;
    // Shifting is itself an explicit, user-directed time assignment, so the shifted
    // checkpoints must be pinned — same as a direct edit in menuChangeTime. Without
    // this, App's effectiveCheckpoints memo would immediately recompute the new time
    // away for any still-unpinned downstream checkpoint (typically the 'end' one).
    onChange(cascade.pendingCheckpoints.map(c =>
      cascade.downstreamIds.includes(c.id)
        ? { ...c, arrivalTime: new Date(c.arrivalTime.getTime() + cascade.deltaMs), pinned: true }
        : c
    ));
    setCascade(null);
  }

  function cascadeKeep() {
    if (!cascade) return;
    onChange(cascade.pendingCheckpoints);
    setCascade(null);
  }

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
      {sequence.map((p) => {
        const isLocked = p.id === 'start' || p.id === 'end';
        return (
          <div
            key={p.id}
            data-checkpoint-marker
            data-checkpoint-id={p.id}
            data-draggable={!isLocked}
            onMouseDown={isLocked ? undefined : (e) => onMarkerMouseDown(e, p.id)}
            onContextMenu={p.id === 'start' ? undefined : (e) => onMarkerContextMenu(e, p.id)}
            style={{
              position: 'absolute',
              left: xOf(p.distanceM / 1000) - 6,
              top: 'calc(50% - 6px)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isLocked ? chartPalette.checkpointLocked : chartPalette.checkpointWaypoint,
              border: '2px solid white',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
              cursor: isLocked ? 'default' : dragId === p.id ? 'grabbing' : 'grab',
            }}
          />
        );
      })}

      {menu && (
        <div className="fixed bg-base-100 shadow-lg rounded-lg p-1 z-50 text-sm" style={{ left: menu.x, top: menu.y }}>
          <button className="block w-full text-left px-3 py-1.5 rounded hover:bg-base-200" onClick={menuChangeTime}>
            Change time
          </button>
          {menu.id !== 'end' && (
            <button className="block w-full text-left px-3 py-1.5 rounded hover:bg-base-200 text-error" onClick={menuDelete}>
              Delete checkpoint
            </button>
          )}
        </div>
      )}

      {cascade && (
        <div className="fixed bg-neutral text-neutral-content rounded-lg p-3 z-50 text-sm max-w-xs" style={{ left: cascade.position.x, top: cascade.position.y }}>
          <div className="mb-2">
            Move {cascade.downstreamIds.length} later checkpoint{cascade.downstreamIds.length > 1 ? 's' : ''} by{' '}
            {cascade.deltaMs > 0 ? '+' : ''}{Math.round(cascade.deltaMs / 60_000)} min, or keep their times and recalculate speed?
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-xs" onClick={cascadeKeep}>Keep times</button>
            <button className="btn btn-xs btn-primary" onClick={cascadeShift}>Shift times</button>
          </div>
        </div>
      )}

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
