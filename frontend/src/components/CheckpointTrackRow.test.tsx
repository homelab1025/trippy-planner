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
