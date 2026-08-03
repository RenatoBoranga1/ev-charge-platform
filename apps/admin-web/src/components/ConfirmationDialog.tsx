import { useEffect, useRef } from 'react';

export function ConfirmationDialog({
  busy = false,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  busy?: boolean;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog className="dialog" onCancel={onCancel} ref={dialog}>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="dialog-actions">
        <button className="button button-quiet" disabled={busy} onClick={onCancel} type="button">Cancelar</button>
        <button className="button button-danger" disabled={busy} onClick={onConfirm} type="button">
          {busy ? 'Processando…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
