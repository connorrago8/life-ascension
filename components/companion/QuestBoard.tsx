'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { completedOpenStorageKey, questGlyph, splitCompanionBoard } from '../../lib/companionPass';
import { companionStatusLabel } from '../../lib/companion';

export type BoardQuest = {
  id: string;
  title: string;
  status: string;
  nudgedToday?: boolean;
};

export function QuestBoard({
  quests,
  userId,
  busy,
  onNudge,
  completedOpen,
}: {
  quests: readonly BoardQuest[];
  userId?: string | null;
  busy: boolean;
  onNudge: (id: string) => void;
  /** When set, skip saved state. The live board leaves this unset and starts collapsed. */
  completedOpen?: boolean;
}) {
  const { open, done } = splitCompanionBoard(quests);
  const storageKey = completedOpenStorageKey(userId);
  const [openDone, setOpenDone] = useState(completedOpen ?? false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (completedOpen !== undefined) {
      setOpenDone(completedOpen);
      return;
    }
    try {
      setOpenDone(window.localStorage.getItem(storageKey) === '1');
    } catch { /* Private mode can block storage. The section stays collapsed. */ }
  }, [storageKey, completedOpen]);

  function toggleDone() {
    setOpenDone((value) => {
      const next = !value;
      try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* Keep the toggle on screen. */ }
      return next;
    });
  }

  return (
    <div className="cq-board">
      <section aria-label="On his board">
        <h2 className="cq-section">On his board</h2>
        {open.length === 0 && <p className="muted">Nothing waiting on his board.</p>}
        <ul className="cq-list">
          {open.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              expanded={expanded === quest.id}
              onToggle={() => setExpanded((id) => id === quest.id ? null : quest.id)}
              action={quest.status !== 'completed' ? (
                <button className="cq-nudge" type="button" disabled={busy || quest.nudgedToday} onClick={() => onNudge(quest.id)}>
                  <span aria-hidden="true">♪</span>
                  {quest.nudgedToday ? 'Nudged' : 'Nudge'}
                </button>
              ) : null}
            />
          ))}
        </ul>
      </section>
      <section aria-label="Completed">
        <button id="cq-completed" className="cq-completed-toggle" type="button" aria-expanded={openDone} onClick={toggleDone}>
          <span>Completed ({done.length})</span>
          <span aria-hidden="true">{openDone ? '▾' : '▸'}</span>
        </button>
        <div className={openDone ? 'cq-done-panel is-open' : 'cq-done-panel'}>
          <div className="cq-done-inner">
            {done.length === 0 && <p className="muted">None yet.</p>}
            <ul className="cq-list">
              {done.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  expanded={expanded === quest.id}
                  onToggle={() => setExpanded((id) => id === quest.id ? null : quest.id)}
                  action={<span className="cq-stamp">Done ♥</span>}
                />
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuestCard({
  quest,
  expanded,
  onToggle,
  action,
}: {
  quest: BoardQuest;
  expanded: boolean;
  onToggle: () => void;
  action: ReactNode;
}) {
  const done = quest.status === 'completed';
  const long = quest.title.length > 42;
  if (done) {
    return (
      <li className="cq-card is-done is-compact">
        <span className="cq-glyph" aria-hidden="true">{questGlyph(quest.title)}</span>
        <p className={expanded ? 'cq-title' : 'cq-title is-one'}>{quest.title}</p>
        {long && (
          <button className="cq-more" type="button" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? 'Less' : 'More'}
          </button>
        )}
        {action}
      </li>
    );
  }
  return (
    <li className="cq-card is-open">
      <span className="cq-glyph" aria-hidden="true">{questGlyph(quest.title)}</span>
      <div className="cq-card-main">
        <p className={expanded || !long ? 'cq-title' : 'cq-title is-clamped'}>{quest.title}</p>
        {long && (
          <button className="cq-more" type="button" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? 'Less' : 'More'}
          </button>
        )}
        <div className="cq-actions">
          <span className="cq-pill">{companionStatusLabel(quest.status)}</span>
          {action}
        </div>
      </div>
    </li>
  );
}
