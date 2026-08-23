import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export const TOOLTIP_SHOW_DELAY_MS = 500;

// Small grace window so moving the pointer from the trigger onto the tooltip
// itself (a real gap in the DOM) doesn't flicker-close it before the
// mouseenter on the tooltip fires.
const TOOLTIP_HIDE_GRACE_MS = 150;

interface Props {
  text: string;
  children: ReactNode;
  ariaLabel?: string;
}

export function Tooltip({ text, children, ariaLabel = 'More info' }: Props) {
  const [open, setOpen] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  };

  const scheduleShow = () => {
    clearTimers();
    showTimer.current = setTimeout(() => setOpen(true), TOOLTIP_SHOW_DELAY_MS);
  };

  const scheduleHide = () => {
    clearTimers();
    hideTimer.current = setTimeout(() => setOpen(false), TOOLTIP_HIDE_GRACE_MS);
  };

  const showNow = () => {
    clearTimers();
    setOpen(true);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showNow();
    }
  };

  return (
    <span className="relative inline-flex">
      {/* role="button" on a span, not a real <button>: a native button is a
          "labelable" HTML element, and this trigger is often nested inside a
          <label> for its adjacent input — a real button there would make
          getByLabelText (and browsers) treat it as a second implicitly
          labeled control alongside that input. */}
      <span
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
        onClick={showNow}
        onKeyDown={handleKeyDown}
        className="cursor-pointer inline-flex"
      >
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          onMouseEnter={clearTimers}
          onMouseLeave={scheduleHide}
          className="absolute z-50 top-full right-0 mt-1 w-56 rounded bg-neutral text-neutral-content text-xs px-2 py-1.5 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
