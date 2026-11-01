import { InAppBackLink } from '../../../../components/InAppBackLink';

export function TownBackLink({ href, label = 'Back to Town' }: { href: string; label?: string }) {
  return <nav aria-label="Back navigation" style={{ position: 'sticky', top: 'env(safe-area-inset-top, 0px)', zIndex: 10, background: 'var(--bg)', padding: '8px 0', marginBottom: 8 }}>
    <InAppBackLink className="btn ghost" href={href} style={{ minHeight: 44, minWidth: 44 }}>← {label}</InAppBackLink>
  </nav>;
}
