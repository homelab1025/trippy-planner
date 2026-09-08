// frontend/src/components/CheckpointTrackRow.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CheckpointTrackRow } from './CheckpointTrackRow';
import type { Checkpoint } from '../utils/speedProfile';

afterEach(cleanup);

const START = new Date('2026-06-03T08:00:00');
const endCp = (distanceM: number, minutesFromStart: number): Checkpoint => ({
  id: 'end', distanceM, arrivalTime: new Date(START.getTime() + minutesFromStart * 60_000), pinned: false,
});

function stubRect(el: Element, { left, width }: { left: number; width: number }) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left, right: left + width, width, top: 0, bottom: 20, height: 20, x: left, y: 0, toJSON: () => ({}),
  });
}

describe('CheckpointTrackRow', () => {
  it('renders a marker for the end checkpoint', () => {
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    expect(container.querySelectorAll('[data-checkpoint-marker]')).toHaveLength(2); // synthesized start + end
  });

  it('opens an "Add checkpoint here?" confirmation when the empty track is clicked', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    fireEvent.click(track, { clientX: 400 }); // ~5km of 10km
    expect(screen.getByText(/add checkpoint here/i)).toBeInTheDocument();
  });

  it('does not open the confirmation when clicking too close to an existing checkpoint', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    // 745 = PLOT_LEFT(55) + plotWidth(800-55-55=690) — the exact pixel for the 10km
    // end checkpoint within an 800px-wide stubbed rect; NOT 795 (the div's raw right
    // edge), since PLOT_RIGHT_OFFSET leaves a 55px margin past the last plotted point.
    fireEvent.click(track, { clientX: 745 }); // exactly at the end checkpoint
    expect(screen.queryByText(/add checkpoint here/i)).not.toBeInTheDocument();
  });

  it('opens the time editor pre-filled with an interpolated estimate after confirming add, and inserts a pinned waypoint on save', () => {
    const onChange = vi.fn();
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]} // 10km in 60min = 10km/h
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    fireEvent.click(track, { clientX: 400 }); // 5km
    fireEvent.click(screen.getByRole('button', { name: /yes, add/i }));

    // Interpolated estimate at 5km of a 10km/60min segment = 30min → 08:30
    expect(screen.getByLabelText(/arrival time/i)).toHaveValue('08:30');

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next: Checkpoint[] = onChange.mock.calls[0][0];
    expect(next).toHaveLength(2);
    const waypoint = next.find(cp => cp.id !== 'end')!;
    expect(waypoint.pinned).toBe(true);
    expect(waypoint.distanceM).toBeCloseTo(5_000, -2);
  });

  it('cancelling the add-confirmation does not call onChange', () => {
    const onChange = vi.fn();
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const track = screen.getByTestId('checkpoint-track-line');
    stubRect(track.parentElement!, { left: 0, width: 800 });
    fireEvent.click(track, { clientX: 400 });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/add checkpoint here/i)).not.toBeInTheDocument();
  });
});

describe('CheckpointTrackRow — drag', () => {
  it('dragging a waypoint changes its distance but not its time, and calls onChange', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = screen.getAllByTestId('checkpoint-track-line')[0].parentElement!.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    stubRect(marker.parentElement!, { left: 0, width: 800 });
    fireEvent.mouseDown(marker, { clientX: 240 });
    fireEvent.mouseMove(document, { clientX: 400 }); // drag to ~5km
    fireEvent.mouseUp(document);

    expect(onChange).toHaveBeenCalled();
    const next: Checkpoint[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const moved = next.find(cp => cp.id === 'wp-1')!;
    expect(moved.distanceM).toBeCloseTo(5_000, -2);
    expect(moved.arrivalTime.getTime()).toBe(waypoint.arrivalTime.getTime()); // unchanged
  });
});

describe('CheckpointTrackRow — right-click menu', () => {
  it('shows Change time and Delete for a waypoint', () => {
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    expect(screen.getByText(/change time/i)).toBeInTheDocument();
    expect(screen.getByText(/delete checkpoint/i)).toBeInTheDocument();
  });

  it('hides Delete for the end checkpoint', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const endMarker = document.querySelector('[data-checkpoint-marker][data-checkpoint-id="end"]')!;
    fireEvent.contextMenu(endMarker);
    expect(screen.getByText(/change time/i)).toBeInTheDocument();
    expect(screen.queryByText(/delete checkpoint/i)).not.toBeInTheDocument();
  });

  it('does not attach a context menu to the start checkpoint', () => {
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const startMarker = document.querySelector('[data-checkpoint-marker][data-checkpoint-id="start"]')!;
    fireEvent.contextMenu(startMarker);
    expect(screen.queryByText(/change time/i)).not.toBeInTheDocument();
  });

  it('deleting a waypoint removes it and calls onChange', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    fireEvent.click(screen.getByText(/delete checkpoint/i));
    const next: Checkpoint[] = onChange.mock.calls[0][0];
    expect(next.find(cp => cp.id === 'wp-1')).toBeUndefined();
  });
});

describe('CheckpointTrackRow — change time + cascade', () => {
  it('changing a time with no downstream checkpoints does not show a cascade prompt', () => {
    const onChange = vi.fn();
    render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const endMarker = document.querySelector('[data-checkpoint-marker][data-checkpoint-id="end"]')!;
    fireEvent.contextMenu(endMarker);
    fireEvent.click(screen.getByText(/change time/i));
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '09:30' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.queryByText(/shift/i)).not.toBeInTheDocument();
    const next: Checkpoint[] = onChange.mock.calls[0][0];
    expect(next.find(cp => cp.id === 'end')!.pinned).toBe(true);
  });

  it('changing a waypoint\'s time with a downstream checkpoint shows Shift/Keep, and Shift moves downstream times by the same delta', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true }; // 08:20
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]} // end at 09:00
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    fireEvent.click(screen.getByText(/change time/i));
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '08:40' } }); // +20min
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText(/shift/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /shift times/i }));

    const next: Checkpoint[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const shiftedEnd = next.find(cp => cp.id === 'end')!;
    expect(shiftedEnd.arrivalTime.getTime()).toBe(START.getTime() + 80 * 60_000); // 09:00 + 20min
    // The shifted time is an explicit user choice — it must be pinned, otherwise App's
    // effectiveCheckpoints memo recomputes it straight back from Average Speed.
    expect(shiftedEnd.pinned).toBe(true);
  });

  it('choosing Keep times leaves downstream checkpoints untouched', () => {
    const onChange = vi.fn();
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 60)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={onChange}
      />
    );
    const marker = document.querySelector('[data-checkpoint-marker][data-draggable="true"]')!;
    fireEvent.contextMenu(marker);
    fireEvent.click(screen.getByText(/change time/i));
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '08:40' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep times/i }));

    const next: Checkpoint[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const untouchedEnd = next.find(cp => cp.id === 'end')!;
    expect(untouchedEnd.arrivalTime.getTime()).toBe(START.getTime() + 60 * 60_000); // still 09:00
  });
});

describe('CheckpointTrackRow — terrain segments', () => {
  it('renders one segment per adjacent checkpoint pair, labeled with the rounded implied speed', () => {
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]} // 10km in 30min = 20km/h
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const segments = container.querySelectorAll('[data-checkpoint-segment]');
    expect(segments).toHaveLength(1); // start -> end
    expect(segments[0].textContent).toBe('20 km/h');
  });

  it('classifies a segment as climb when elevation rises more than the noise threshold', () => {
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
        elevationData={[{ distance: 0, elevation: 100 }, { distance: 10, elevation: 400 }]}
      />
    );
    expect(container.querySelector('[data-checkpoint-segment]')?.getAttribute('data-terrain')).toBe('climb');
  });

  it('classifies a segment as descent when elevation drops more than the noise threshold', () => {
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
        elevationData={[{ distance: 0, elevation: 400 }, { distance: 10, elevation: 100 }]}
      />
    );
    expect(container.querySelector('[data-checkpoint-segment]')?.getAttribute('data-terrain')).toBe('descent');
  });

  it('classifies a segment as flat when the elevation change is within the noise threshold, or when no elevation data is given', () => {
    const { container: withTinyDelta } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
        elevationData={[{ distance: 0, elevation: 100 }, { distance: 10, elevation: 102 }]}
      />
    );
    expect(withTinyDelta.querySelector('[data-checkpoint-segment]')?.getAttribute('data-terrain')).toBe('flat');
    cleanup();

    const { container: withNoData } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    expect(withNoData.querySelector('[data-checkpoint-segment]')?.getAttribute('data-terrain')).toBe('flat');
  });

  it('shows a placeholder dash instead of a speed label for a non-positive-duration segment', () => {
    const zeroTimeEnd: Checkpoint = { id: 'end', distanceM: 10_000, arrivalTime: START, pinned: false };
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[zeroTimeEnd]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    expect(container.querySelector('[data-checkpoint-segment]')?.textContent).toBe('—');
  });
});

describe('CheckpointTrackRow — time labels', () => {
  it('renders a time label under each checkpoint, with (start)/(finish) suffixes on the locked ones', () => {
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[endCp(10_000, 30)]}
        startTime={START} // 08:00
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const labels = container.querySelectorAll('[data-checkpoint-time-label]');
    expect(labels).toHaveLength(2); // start + end
    expect(labels[0].textContent).toMatch(/\(start\)$/);
    expect(labels[1].textContent).toMatch(/\(finish\)$/);
  });

  it('does not add a (start)/(finish) suffix to a waypoint\'s time label', () => {
    const waypoint: Checkpoint = { id: 'wp-1', distanceM: 3_000, arrivalTime: new Date(START.getTime() + 20 * 60_000), pinned: true };
    const { container } = render(
      <CheckpointTrackRow
        checkpoints={[waypoint, endCp(10_000, 30)]}
        startTime={START}
        totalDistanceM={10_000}
        distanceRange={[0, 10]}
        chartWidth={800}
        onChange={vi.fn()}
      />
    );
    const labels = container.querySelectorAll('[data-checkpoint-time-label]');
    expect(labels).toHaveLength(3);
    expect(labels[1].textContent).not.toMatch(/\(start\)|\(finish\)/);
  });
});
