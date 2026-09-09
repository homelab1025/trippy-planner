// frontend/src/components/CheckpointTrackRow.tsx
import { useState, memo } from 'react';
import type { Checkpoint } from '../utils/speedProfile';
import { computeArrivalTime, impliedSpeedKmh } from '../utils/speedProfile';
import { CheckpointTimeEditor } from './CheckpointTimeEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { CHART_MARGIN_LEFT, CHART_YAXIS_LEFT_WIDTH } from './chartConstants';
import { chartPalette } from '../theme/chartColors';

interface ElevationSample {
  distance: number; // km
  elevation: number;
}

interface Props {
  checkpoints: Checkpoint[];
  startTime: Date;
  totalDistanceM: number;
  distanceRange: [number, number]; // km
  chartWidth: number;
  onChange: (next: Checkpoint[]) => void;
  elevationData?: ElevationSample[];
  hoveredDistance?: number | null;
  onHoverIndex?: (index: number | null) => void;
}

const CLIMB_THRESHOLD_M = 5;

// Linear interpolation between the two elevation samples bracketing `km`,
// matching CheckpointOverlay.tsx's identical helper (kept separate since each
// component's data flow is distinct — see that file's Task 5 note on this).
function elevationAtKm(km: number, data: ElevationSample[]): number | null {
  if (data.length === 0) return null;
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i], b = data[i + 1];
    if (km >= a.distance && km <= b.distance) {
      const span = b.distance - a.distance;
      const frac = span > 0 ? (km - a.distance) / span : 0;
      return a.elevation + frac * (b.elevation - a.elevation);
    }
  }
  return data[data.length - 1]?.elevation ?? null;
}

type Terrain = 'climb' | 'descent' | 'flat';

function terrainAt(aKm: number, bKm: number, elevationData: ElevationSample[]): Terrain {
  const eleA = elevationAtKm(aKm, elevationData);
  const eleB = elevationAtKm(bKm, elevationData);
  const delta = eleA !== null && eleB !== null ? eleB - eleA : 0;
  if (delta > CLIMB_THRESHOLD_M) return 'climb';
  if (delta < -CLIMB_THRESHOLD_M) return 'descent';
  return 'flat';
}

// Finds the elevationData index whose distance is closest to `km` — elevationData
// is a plain map() of App's chartData (see App.tsx), so the index returned here
// lines up with the same index ElevationChart's onHoverIndex reports, letting the
// checkpoint bar drive the shared hover crosshair across every row, elevation
// chart included.
function nearestIndex(km: number, data: ElevationSample[]): number | null {
  if (data.length === 0) return null;
  let lo = 0, hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].distance < km) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(data[lo - 1].distance - km) <= Math.abs(data[lo].distance - km)) {
    return lo - 1;
  }
  return lo;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TERRAIN_COLORS: Record<Terrain, { bg: string; text: string }> = {
  climb: { bg: chartPalette.segmentClimbBg, text: chartPalette.segmentClimbText },
  descent: { bg: chartPalette.segmentDescentBg, text: chartPalette.segmentDescentText },
  flat: { bg: chartPalette.segmentFlatBg, text: chartPalette.segmentFlatText },
};

const PLOT_LEFT = CHART_MARGIN_LEFT + CHART_YAXIS_LEFT_WIDTH;
const PLOT_RIGHT_OFFSET = 55;

interface FullPoint { distanceM: number; arrivalTime: Date; id: string | 'start' }

function fullSequence(checkpoints: Checkpoint[], startTime: Date): FullPoint[] {
  return [
    { distanceM: 0, arrivalTime: startTime, id: 'start' },
    ...checkpoints.slice().sort((a, b) => a.distanceM - b.distanceM).map(cp => ({ ...cp })),
  ];
}

function CheckpointTrackRow({ checkpoints, startTime, distanceRange, chartWidth, onChange, elevationData = [], hoveredDistance = null, onHoverIndex }: Props) {
  const [dMin, dMax] = distanceRange;
  const plotWidth = chartWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;
  const xOf = (km: number) => PLOT_LEFT + ((km - dMin) / (dMax - dMin)) * plotWidth;
  const kmOf = (x: number) => dMin + ((x - PLOT_LEFT) / plotWidth) * (dMax - dMin);

  const [pendingAddKm, setPendingAddKm] = useState<number | null>(null);
  const [pendingAddPos, setPendingAddPos] = useState<{ x: number; y: number } | null>(null);
  const [editor, setEditor] = useState<{
    title: string;
    initialTime: Date;
    minTime: Date;
    maxTime: Date;
    position: { x: number; y: number };
    onSave: (time: Date) => void;
  } | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  // Live drag position, kept local to this component so moving a marker only
  // repaints this row — it never reaches onChange (and so never touches App,
  // the chart rebuild, or localStorage) until the mouse is released.
  const [dragPreviewKm, setDragPreviewKm] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cascade, setCascade] = useState<{
    downstreamIds: string[];
    deltaMs: number;
    pendingCheckpoints: Checkpoint[];
    position: { x: number; y: number };
    keepDisabled: boolean;
  } | null>(null);

  // While a marker is being dragged, render its live preview position instead of
  // the last-committed one — everything below (markers, segments, terrain, time
  // labels) reads from `sequence`, so this is the only place the preview needs to
  // be spliced in.
  const displayCheckpoints = dragId !== null && dragPreviewKm !== null
    ? checkpoints.map(cp => cp.id === dragId ? { ...cp, distanceM: dragPreviewKm * 1000 } : cp)
    : checkpoints;
  const sequence = fullSequence(displayCheckpoints, startTime);

  function neighborsOf(id: string): { prev: FullPoint; next: FullPoint | null } {
    const idx = sequence.findIndex(p => p.id === id);
    return { prev: sequence[idx - 1], next: idx + 1 < sequence.length ? sequence[idx + 1] : null };
  }

  function onMarkerMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    setDragId(id);
    const trackEl = e.currentTarget.parentElement as HTMLElement;

    // Native mousemove can fire far faster than the screen repaints, and committing
    // to onChange on every event would cascade into a full App re-render, a
    // route-wide chart rebuild, and a localStorage write each time (see the
    // dragPreviewKm comment above). So each frame only updates the local preview;
    // the real commit (onChange) happens once, in onUp, on mouse release.
    let rafId: number | null = null;
    let latestClientX: number | null = null;
    let committedKm: number | null = null;

    function computeClampedKm(clientX: number): number {
      const rect = trackEl.getBoundingClientRect();
      let km = kmOf(clientX - rect.left);
      const { prev, next } = neighborsOf(id);
      const minKm = prev.distanceM / 1000 + (dMax - dMin) * 0.005;
      const maxKm = next ? next.distanceM / 1000 - (dMax - dMin) * 0.005 : dMax;
      km = Math.min(maxKm, Math.max(minKm, km));
      return km;
    }
    function applyPendingMove() {
      rafId = null;
      if (latestClientX === null) return;
      committedKm = computeClampedKm(latestClientX);
      setDragPreviewKm(committedKm);
    }
    function onMove(ev: MouseEvent) {
      latestClientX = ev.clientX;
      if (rafId === null) {
        rafId = requestAnimationFrame(applyPendingMove);
      }
    }
    function onUp() {
      // Flush rather than drop a still-pending frame, so the checkpoint always ends
      // up exactly where the cursor was released, not one frame behind.
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        applyPendingMove();
      }
      if (committedKm !== null) {
        onChange(checkpoints.map(cp => cp.id === id ? { ...cp, distanceM: committedKm! * 1000 } : cp));
      }
      setDragPreviewKm(null);
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
    const { prev } = neighborsOf(id);
    setMenu(null);
    setEditor({
      title: 'Change arrival time',
      initialTime: cp.arrivalTime,
      minTime: prev.arrivalTime,
      // No upper bound at the next checkpoint's time: going past it is allowed, and
      // the cascade prompt below (Shift/Keep) is how the user resolves the resulting
      // order, same as the always-unbounded case this used to reserve for the last
      // checkpoint.
      maxTime: new Date(cp.arrivalTime.getTime() + 365 * 24 * 3_600_000),
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
          // Keeping downstream times as-is only stays valid if the new time is still
          // earlier than the immediate next checkpoint's (pre-edit) arrival time —
          // otherwise "Keep" would leave that checkpoint before the one just edited.
          const keepDisabled = time.getTime() >= downstream[0].arrivalTime.getTime();
          setCascade({
            downstreamIds: downstream.map(p => p.id),
            deltaMs,
            pendingCheckpoints: updated,
            position: { x, y },
            keepDisabled,
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
    if (!cascade || cascade.keepDisabled) return;
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
    setPendingAddPos({ x: e.clientX, y: e.clientY });
  }

  function onTrackMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!onHoverIndex) return;
    // Same measurement point as handleTrackClick — see its comment.
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const km = kmOf(e.clientX - rect.left);
    onHoverIndex(km < dMin || km > dMax ? null : nearestIndex(km, elevationData));
  }

  function onTrackMouseLeave() {
    onHoverIndex?.(null);
  }

  function confirmAdd() {
    if (pendingAddKm === null) return;
    // Anchor the time editor to where the user actually clicked on the track
    // (captured in handleTrackClick), not some unrelated fixed point — falls
    // back to the checkpoint's own screen position if that's somehow missing.
    const position = pendingAddPos ?? { x: xOf(pendingAddKm), y: 0 };
    const distanceM = pendingAddKm * 1000;
    let prev = sequence[0], next = sequence[sequence.length - 1];
    for (let i = 0; i < sequence.length - 1; i++) {
      if (distanceM >= sequence[i].distanceM && distanceM <= sequence[i + 1].distanceM) {
        prev = sequence[i]; next = sequence[i + 1]; break;
      }
    }
    const estimate = computeArrivalTime(distanceM, startTime, checkpoints);
    setPendingAddKm(null);
    setPendingAddPos(null);
    setEditor({
      title: 'Set arrival time',
      initialTime: estimate,
      minTime: prev.arrivalTime,
      maxTime: next.arrivalTime,
      position,
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
        onMouseMove={onTrackMouseMove}
        onMouseLeave={onTrackMouseLeave}
        style={{
          position: 'absolute',
          left: PLOT_LEFT,
          width: plotWidth,
          // Full bar height (matches the terrain segments below) so the "add
          // checkpoint" click/hover target covers the whole visible bar, not
          // just the thin center line — the terrain segments overlaid on top
          // have pointerEvents: 'none' and pass clicks through to this div.
          top: 'calc(50% - 7px)',
          height: 14,
          cursor: 'copy',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 6,
            height: 2,
            background: '#d3dad6',
          }}
        />
      </div>
      {sequence.slice(0, -1).map((p, i) => {
        const next = sequence[i + 1];
        const aKm = p.distanceM / 1000, bKm = next.distanceM / 1000;
        const terrain = terrainAt(aKm, bKm, elevationData);
        const { bg, text } = TERRAIN_COLORS[terrain];
        const speed = impliedSpeedKmh(p, next);
        return (
          <div
            key={`seg-${p.id}`}
            data-checkpoint-segment
            data-terrain={terrain}
            style={{
              position: 'absolute',
              left: xOf(aKm),
              width: Math.max(0, xOf(bKm) - xOf(aKm)),
              top: 'calc(50% - 7px)',
              height: 14,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              background: bg,
              color: text,
              pointerEvents: 'none',
            }}
          >
            {speed !== null ? `${Math.round(speed)} km/h` : '—'}
          </div>
        );
      })}
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
      {sequence.map((p) => {
        const suffix = p.id === 'start' ? ' (start)' : p.id === 'end' ? ' (finish)' : '';
        return (
          <div
            key={`time-${p.id}`}
            data-checkpoint-time-label
            style={{
              position: 'absolute',
              left: xOf(p.distanceM / 1000),
              top: 'calc(50% + 9px)',
              transform: 'translateX(-50%)',
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#33403a',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {formatTime(p.arrivalTime)}{suffix}
          </div>
        );
      })}
      {hoveredDistance !== null && (
        <div
          data-testid="checkpoint-hover-crosshair"
          style={{
            position: 'absolute',
            left: xOf(hoveredDistance),
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: `1px dashed ${chartPalette.crosshair}`,
            pointerEvents: 'none',
          }}
        />
      )}

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
          {cascade.keepDisabled && (
            <div className="text-xs opacity-70 mb-2">Keep times is unavailable: it would reorder checkpoints.</div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn btn-xs" disabled={cascade.keepDisabled} onClick={cascadeKeep}>Keep times</button>
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
          onCancel={() => { setPendingAddKm(null); setPendingAddPos(null); }}
          onConfirm={confirmAdd}
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

const CheckpointTrackRowMemo = memo(CheckpointTrackRow);
export { CheckpointTrackRowMemo as CheckpointTrackRow };
