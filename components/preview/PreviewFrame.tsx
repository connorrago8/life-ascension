'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PreviewNav } from './PreviewNav';
import { TransitionContext } from './previewTransition';

const CELL_COLORS = ['#120814', '#2A1840', '#FF9A3C', '#1F6B3A', '#07040C', '#C45B28', '#3A2848', '#FFD27A'];

export function PreviewFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dissolving, setDissolving] = useState(false);
  const showNav = pathname !== '/preview/title';

  const beginTransition = useCallback((href: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      router.push(href);
      return;
    }
    setDissolving(true);
    window.setTimeout(() => {
      router.push(href);
      window.setTimeout(() => setDissolving(false), 140);
    }, 720);
  }, [router]);

  return (
    <TransitionContext.Provider value={beginTransition}>
      <div className={pathname === '/preview/adventure' ? 'preview-app is-adventure' : 'preview-app'}>
        <p className="preview-flag" role="status">Preview — nothing is saved</p>
        {children}
        {showNav ? <PreviewNav /> : null}
        {dissolving ? (
          <div className="pixel-dissolve" data-transition="pixel-dissolve" aria-hidden="true">
            {Array.from({ length: 160 }, (_, index) => (
              <span
                key={index}
                className="dissolve-cell"
                style={{
                  animationDelay: `${(index % 10) * 24}ms`,
                  background: CELL_COLORS[index % CELL_COLORS.length],
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </TransitionContext.Provider>
  );
}
