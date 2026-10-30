'use client';

import { useId, useState, type ReactNode } from 'react';

/**
 * A section whose header is one accessible toggle button: "Title (N)" with a chevron.
 * Collapsed by default. Display only; it never changes quest state.
 */
export function CollapsibleSection(props: {
  title: string;
  count: number;
  label?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const listId = useId();
  return (
    <section className={`panel collapsible-section${props.className ? ` ${props.className}` : ''}`} aria-label={props.label ?? props.title}>
      <h2 className="collapsible-heading">
        <button
          type="button"
          className="collapsible-toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="collapsible-title">{props.title} ({props.count})</span>
          <span className={`collapsible-chevron${open ? ' is-open' : ''}`} aria-hidden="true">▸</span>
        </button>
      </h2>
      <div id={listId} hidden={!open}>{open ? props.children : null}</div>
    </section>
  );
}
