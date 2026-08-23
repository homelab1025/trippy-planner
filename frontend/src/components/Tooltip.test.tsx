// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Tooltip, TOOLTIP_SHOW_DELAY_MS } from './Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not show the tooltip initially', () => {
    render(<Tooltip text="Explains the thing"><span>?</span></Tooltip>);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip after hovering the trigger for the show delay', () => {
    render(<Tooltip text="Explains the thing"><span>?</span></Tooltip>);
    fireEvent.mouseEnter(screen.getByRole('button'));

    act(() => { vi.advanceTimersByTime(TOOLTIP_SHOW_DELAY_MS - 1); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Explains the thing');
  });

  it('shows the tooltip immediately on click, with no delay', () => {
    render(<Tooltip text="Explains the thing"><span>?</span></Tooltip>);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Explains the thing');
  });

  it('hides the tooltip once the pointer leaves both the trigger and the tooltip', () => {
    render(<Tooltip text="Explains the thing"><span>?</span></Tooltip>);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByRole('button'));
    act(() => { vi.runAllTimers(); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('stays open when the pointer moves from the trigger onto the tooltip itself', () => {
    render(<Tooltip text="Explains the thing"><span>?</span></Tooltip>);
    fireEvent.click(screen.getByRole('button'));
    const tooltip = screen.getByRole('tooltip');

    fireEvent.mouseLeave(screen.getByRole('button'));
    fireEvent.mouseEnter(tooltip);
    act(() => { vi.runAllTimers(); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(tooltip);
    act(() => { vi.runAllTimers(); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('cancels a pending show if the pointer leaves before the delay elapses', () => {
    render(<Tooltip text="Explains the thing"><span>?</span></Tooltip>);
    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => { vi.advanceTimersByTime(TOOLTIP_SHOW_DELAY_MS / 2); });
    fireEvent.mouseLeave(screen.getByRole('button'));

    act(() => { vi.runAllTimers(); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
