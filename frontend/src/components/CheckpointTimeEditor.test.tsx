// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CheckpointTimeEditor } from './CheckpointTimeEditor';

afterEach(cleanup);

const DAY = new Date('2026-06-03T00:00:00');
const at = (h: number, m: number) => new Date(DAY.getFullYear(), DAY.getMonth(), DAY.getDate(), h, m);

describe('CheckpointTimeEditor', () => {
  it('pre-fills the time input from initialTime', () => {
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/arrival time/i)).toHaveValue('10:30');
  });

  it('calls onSave with a Date on the same day as initialTime when Save is clicked with a valid time', () => {
    const onSave = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '11:15' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved: Date = onSave.mock.calls[0][0];
    expect(saved.getHours()).toBe(11);
    expect(saved.getMinutes()).toBe(15);
    expect(saved.getFullYear()).toBe(DAY.getFullYear());
    expect(saved.getMonth()).toBe(DAY.getMonth());
    expect(saved.getDate()).toBe(DAY.getDate());
  });

  it('shows a validation error and does not call onSave when the time is at or before minTime', () => {
    const onSave = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '08:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/must stay between/i)).toBeInTheDocument();
  });

  it('shows a validation error and does not call onSave when the time is at or after maxTime', () => {
    const onSave = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/arrival time/i), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/must stay between/i)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <CheckpointTimeEditor
        title="Set arrival time"
        initialTime={at(10, 30)}
        minTime={at(9, 0)}
        maxTime={at(12, 0)}
        position={{ x: 0, y: 0 }}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
