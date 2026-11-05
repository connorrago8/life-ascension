'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './CryptInspectionDialog.module.css';

/** Read-only inspection in the browser top layer; gameplay stays behind the modal. */
export function CryptInspectionDialog({ title, note, children, onClose }: {
  title: string; note: string; children: ReactNode; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId(), noteId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={dialogRef} className={styles.sheet} aria-labelledby={titleId} aria-describedby={noteId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
      onKeyDown={event => {
        if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className={styles.header}>
        <h2 id={titleId}>{title}</h2>
        <button ref={closeRef} type="button" className={`btn ghost ${styles.close}`} onClick={onClose}>Close</button>
      </div>
      <div className={styles.content}>
        <p id={noteId} className={styles.note}>{note}</p>
        {children}
      </div>
    </dialog>
  );
}
