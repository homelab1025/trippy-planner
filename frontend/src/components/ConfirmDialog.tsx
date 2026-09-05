interface Props {
  open: boolean;
  title: string;
  message: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}

export function ConfirmDialog({ open, title, message, confirming, onConfirm, onCancel, confirmLabel = 'OK' }: Props) {
  if (!open) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box relative">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="Close"
          onClick={onCancel}
          disabled={confirming}
        >
          ✕
        </button>
        <h3 className="font-bold text-lg mb-3">{title}</h3>
        <p className="text-sm mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button className="btn btn-error btn-sm" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={confirming ? undefined : onCancel} />
    </div>
  );
}
