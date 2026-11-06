/** Scroll only when a keyboard-focused control would be clipped or covered. */
export function focusScrollDelta(
  rect: { top: number; bottom: number },
  viewport: { top: number; bottom: number },
  obstructionTop = viewport.bottom,
): number {
  const top = viewport.top + 16;
  const bottom = Math.min(viewport.bottom, obstructionTop) - 16;
  if (bottom <= top || (rect.top >= top && rect.bottom <= bottom)) return 0;
  return (rect.top + rect.bottom - top - bottom) / 2;
}

export function revealFocusedControl(target: EventTarget | null): void {
  if (!(target instanceof HTMLElement) || !target.matches('input, textarea, select, button, a[href], summary')) return;
  requestAnimationFrame(() => {
    if (document.activeElement !== target || !target.matches(':focus-visible')) return;
    const visual = window.visualViewport;
    const viewport = { top: visual?.offsetTop ?? 0, bottom: (visual?.offsetTop ?? 0) + (visual?.height ?? window.innerHeight) };
    const nav = document.querySelector<HTMLElement>('.app-nav');
    const obstruction = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : viewport.bottom;
    const delta = focusScrollDelta(target.getBoundingClientRect(), viewport, obstruction);
    if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
  });
}
