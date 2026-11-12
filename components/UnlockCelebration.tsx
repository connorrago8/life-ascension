'use client';

import { useEffect, useState } from 'react';

export function UnlockCelebration({ pieceName }: { pieceName: string | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pieceName) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [pieceName]);

  if (!visible || !pieceName) return null;
  return (
    <div className="unlock-banner" role="status">
      Unlocked: {pieceName}
    </div>
  );
}
