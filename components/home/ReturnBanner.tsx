'use client';

import { useEffect, useState } from 'react';
import { returnDetail, returnHeadline, takeReturnBanner, type ReturnRecord } from '../../lib/cryptReturn';

/**
 * "Back from the Crypt" banner. Shown once per finished run (it is marked seen
 * as soon as it appears) and dismissible. Read-only: it links to the camp
 * vault, where wearing gear is an explicit Wear tap. It never equips anything.
 */
export function ReturnBanner() {
  const [record, setRecord] = useState<ReturnRecord | null>(null);
  useEffect(() => {
    // Only ever set a record: a second effect pass (React Strict Mode) finds it
    // already seen and must not hide the banner that is showing.
    try {
      const shown = takeReturnBanner(window.localStorage, Date.now());
      if (shown) setRecord(shown);
    } catch {
      /* Storage unavailable: no banner. */
    }
  }, []);
  if (!record) return null;
  return (
    <aside className={`return-banner return-${record.result}`} role="status" aria-label="Back from the Crypt">
      <div className="return-text">
        <p className="return-headline">{returnHeadline(record)}</p>
        <p className="return-detail">{returnDetail(record)}</p>
        {record.mode === 'vault' && record.kept > 0 ? <a className="return-link" href="/play/delve">Open vault to Wear</a> : null}
      </div>
      <button type="button" className="return-dismiss" aria-label="Dismiss" onClick={() => setRecord(null)}>×</button>
    </aside>
  );
}
