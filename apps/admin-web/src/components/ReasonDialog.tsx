import { useEffect, useRef, useState } from 'react';

export function ReasonDialog({
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
  onConfirm: (reason: string) => void;
  open: boolean;
  title: string;
}) {
  const [reason, setReason] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setReason('');
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open]);
  const valid = reason.trim().length >= 8;
  return (
    <dialog className="dialog" onCancel={onCancel} ref={dialog}>
      <h2>{title}</h2>
      <p>{description}</p>
      <label>
        Justificativa operacional
        <textarea
          autoFocus
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          value={reason}
        />
      </label>
      <small>{reason.length}/500 · mínimo de 8 caracteres</small>
      <div className="dialog-actions">
        <button className="button button-quiet" disabled={busy} onClick={onCancel} type="button">Cancelar</button>
        <button className="button button-danger" disabled={busy || !valid} onClick={() => onConfirm(reason.trim())} type="button">
          {busy ? 'Processando…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
