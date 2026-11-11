'use client';

import { useState } from 'react';

export function IzzyProof({ instanceId, disabled }: { instanceId: string; disabled: boolean }) {
  const [note, setNote] = useState('');
  return (
    <label className="btn ghost" onClick={(event) => event.stopPropagation()}>
      Photo
      <input
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const body = new FormData();
          body.set('instanceId', instanceId);
          body.set('photo', file);
          void fetch('/api/companion/proof', { method: 'POST', body }).then(async (response) => {
            setNote(response.ok ? 'Photo saved' : 'Photo was not saved');
          });
        }}
      />
      {note ? <span className="sr-only">{note}</span> : null}
    </label>
  );
}
