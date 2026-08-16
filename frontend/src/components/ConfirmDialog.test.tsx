// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete route"
        message="Delete 'Alpine Loop' on the 17 Jun 2026?"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Delete route')).not.toBeInTheDocument();
  });

  it('shows title and message when open', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="Delete 'Alpine Loop' on the 17 Jun 2026?"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete route')).toBeInTheDocument();
    expect(screen.getByText("Delete 'Alpine Loop' on the 17 Jun 2026?")).toBeInTheDocument();
  });

  it('calls onConfirm when OK is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when the close button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables both buttons and shows "Deleting…" while confirming', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete route"
        message="msg"
        confirming={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
