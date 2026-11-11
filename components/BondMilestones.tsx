'use client';

const MILESTONES = [10, 50, 100];

export function BondMilestones({ count }: { count: number }) {
  return (
    <div className="bond-milestones" aria-label="Bond milestones">
      {MILESTONES.map((n) => (
        <span key={n} className={count >= n ? 'cq-pill is-done' : 'cq-pill'}>
          {n} together
        </span>
      ))}
    </div>
  );
}
