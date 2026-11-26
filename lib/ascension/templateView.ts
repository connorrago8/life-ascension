import { createElement, type ReactNode } from 'react';
import {
  TEMPLATE_LABEL,
  canFinishTemplate,
  canStartTemplate,
  templateStatus,
  templatesFor,
  type TemplateState,
  type TrackId,
} from './templates.ts';

export type TemplateRowModel = {
  id: string;
  title: string;
  detail?: string;
  label: string;
  canStart: boolean;
  canFinish: boolean;
  canSkip: boolean;
};

export function templateRowModels(
  track: TrackId,
  states: readonly TemplateState[],
  unlocked: boolean,
): TemplateRowModel[] {
  return templatesFor(track).map((template) => {
    const status = templateStatus(track, template.id, states, unlocked);
    return {
      id: template.id,
      title: template.title,
      detail: template.detail,
      label: TEMPLATE_LABEL[status],
      canStart: canStartTemplate(track, template.id, states, unlocked),
      canFinish: canFinishTemplate(track, template.id, states, unlocked),
      canSkip: status === 'due' || status === 'in_progress',
    };
  });
}

/** Text-first rows. No free-text fields. */
export function TemplateBoard({ rows }: { rows: readonly TemplateRowModel[] }): ReactNode {
  return createElement('ul', { className: 'ascension-templates' }, rows.map((row) => createElement(
    'li',
    { key: row.id, className: 'ascension-row', 'data-template': row.id },
    createElement('div', null,
      createElement('strong', null, row.title),
      createElement('span', { className: 'muted' }, row.label),
      row.detail ? createElement('p', { className: 'muted' }, row.detail) : null,
    ),
    row.canStart ? createElement('button', { type: 'button' }, 'Start') : null,
    row.canFinish ? createElement('button', { type: 'button' }, 'Mark done') : null,
    row.canSkip && row.id !== 'payday_check' ? createElement('button', { type: 'button' }, 'Skip') : null,
  )));
}
