'use client';

import { useState } from 'react';
import { chicagoToday } from '../../lib/chicagoDate';
import { domainLabel, FOCUS_AREAS, focusLabel, type QuestDomain } from '../../lib/domains';
import type { AcceptResult } from '../../lib/onboarding';
import type { PreviewStep } from '../../lib/onboarding';
import { PREVIEW_FOCUS, selectSuggestedQuests, type QuestTemplate } from '../../lib/questTemplates';

type ExitDest = 'board' | 'create';

type Props = {
  preview?: boolean;
  initialStep?: PreviewStep;
  userId?: string;
  onAccept?: (template: QuestTemplate) => Promise<AcceptResult>;
  onMarkOnboarded?: () => Promise<{ error: string | null }>;
  onExit?: (dest: ExitDest) => Promise<void> | void;
};

export function Onboarding({
  preview = false,
  initialStep = 'welcome',
  onAccept,
  onMarkOnboarded,
  onExit,
}: Props) {
  const seededFocus: QuestDomain[] = initialStep === 'quests' || initialStep === 'board' ? [...PREVIEW_FOCUS] : [];
  const seededQuests = seededFocus.length > 0 ? selectSuggestedQuests(seededFocus) : [];
  const [step, setStep] = useState<PreviewStep>(initialStep);
  const [focus, setFocus] = useState<QuestDomain[]>(seededFocus);
  const [suggestions, setSuggestions] = useState<QuestTemplate[]>(seededQuests);
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(initialStep === 'board' ? seededQuests.map((template) => template.id) : []),
  );
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cardMessage, setCardMessage] = useState('');
  const [formError, setFormError] = useState('');

  function toggleFocus(id: QuestDomain) {
    setFocus((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  function showQuests() {
    if (focus.length === 0) return;
    setSuggestions(selectSuggestedQuests(focus));
    setCardMessage('');
    setFormError('');
    setStep('quests');
  }

  function skipCard(templateId: string) {
    setSkipped((current) => {
      const next = new Set(current);
      next.add(templateId);
      return next;
    });
  }

  async function acceptCard(template: QuestTemplate) {
    if (accepted.has(template.id) || busyId) return;
    setBusyId(template.id);
    setCardMessage('');
    setFormError('');
    if (preview || !onAccept) {
      setAccepted((current) => {
        const next = new Set(current);
        next.add(template.id);
        return next;
      });
      setBusyId(null);
      return;
    }
    const result = await onAccept(template);
    if (result.status === 'created' || result.status === 'duplicate') {
      setAccepted((current) => {
        const next = new Set(current);
        next.add(template.id);
        return next;
      });
      if (result.status === 'duplicate') setCardMessage('Already on your board.');
    } else {
      setFormError(result.message);
    }
    setBusyId(null);
  }

  async function leave(dest: ExitDest) {
    setFormError('');
    if (!preview && onMarkOnboarded) {
      const result = await onMarkOnboarded();
      if (result.error && accepted.size === 0) {
        setFormError(result.error);
        return;
      }
    }
    if (preview) {
      setStep('board');
      if (dest === 'create') {
        window.setTimeout(() => document.getElementById('create-quest')?.scrollIntoView({ block: 'start' }), 50);
      }
      return;
    }
    await onExit?.(dest);
  }

  if (step === 'board') {
    const chosen = suggestions.filter((template) => accepted.has(template.id));
    return <PreviewBoard quests={chosen} />;
  }

  return (
    <main className="wrap onboard">
      {preview && <p className="muted">Dev preview. Nothing is saved.</p>}
      {step === 'welcome' && (
        <section>
          <div className="eyebrow">LIFE ASCENSION</div>
          <h1>Welcome, Wayfarer</h1>
          <p>You are a Wayfarer. Real-life quests earn XP.</p>
          <p className="muted">Pick a few focus areas and start with three quests you can actually do.</p>
          <div className="step-actions">
            <button className="btn mint" type="button" onClick={() => setStep('focus')}>Continue</button>
            <button className="btn ghost" type="button" onClick={() => void leave('board')}>Skip setup</button>
          </div>
        </section>
      )}
      {step === 'focus' && (
        <section>
          <div className="eyebrow">FOCUS</div>
          <h1>What do you want to work on?</h1>
          <p className="muted">Choose up to 3.</p>
          <div className="chips" role="group" aria-label="Focus areas">
            {FOCUS_AREAS.map((area) => {
              const selected = focus.includes(area.id);
              const locked = focus.length >= 3 && !selected;
              return (
                <button
                  key={area.id}
                  className="chip"
                  type="button"
                  aria-pressed={selected}
                  disabled={locked}
                  onClick={() => toggleFocus(area.id)}
                >
                  {area.label}
                </button>
              );
            })}
          </div>
          <div className="step-actions">
            <button className="btn mint" type="button" disabled={focus.length === 0} onClick={showQuests}>Continue</button>
            <button className="btn ghost" type="button" onClick={() => setStep('welcome')}>Back</button>
            <button className="btn ghost" type="button" onClick={() => void leave('board')}>Skip setup</button>
          </div>
        </section>
      )}
      {step === 'quests' && (
        <section>
          <div className="eyebrow">SUGGESTED QUESTS</div>
          <h1>Three quests to start</h1>
          <p className="muted">Accept adds a quest to your board. Skip leaves it off. You earn XP only when you complete a quest.</p>
          {suggestions.map((template) => {
            const isAccepted = accepted.has(template.id);
            const isSkipped = skipped.has(template.id);
            return (
              <article className="panel suggest-card" key={template.id}>
                <h2>{template.title}</h2>
                <p>{template.description}</p>
                <p className="muted">{focusLabel(template.focus)} · {template.cadence === 'daily' ? 'Daily' : 'One-time'}</p>
                <div className="onboard-actions">
                  <button
                    className="btn mint"
                    type="button"
                    disabled={isAccepted || busyId === template.id}
                    onClick={() => void acceptCard(template)}
                  >
                    {isAccepted ? 'On your board' : 'Accept'}
                  </button>
                  <button className="btn ghost" type="button" disabled={isAccepted || isSkipped} onClick={() => skipCard(template.id)}>
                    {isSkipped ? 'Skipped' : 'Skip'}
                  </button>
                  <a className="btn ghost" href="/#create-quest" onClick={(event) => { event.preventDefault(); void leave('create'); }}>
                    Create my own quest
                  </a>
                </div>
              </article>
            );
          })}
          <div className="step-actions">
            <button className="btn mint" type="button" onClick={() => void leave('board')}>Go to board</button>
            <button className="btn ghost" type="button" onClick={() => setStep('focus')}>Back</button>
            <button className="btn ghost" type="button" onClick={() => void leave('board')}>Skip setup</button>
          </div>
        </section>
      )}
      <p className="message" role="status" aria-live="polite">{cardMessage || formError}</p>
    </main>
  );
}

function PreviewBoard({ quests }: { quests: QuestTemplate[] }) {
  const today = chicagoToday();
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">LIFE ASCENSION</div>
          <h1>Today’s Quests</h1>
          <p className="muted">{dateLabel}</p>
        </div>
      </header>
      <p className="muted">Dev preview. Accepted quests are shown here only. No XP was awarded.</p>
      <section className="panel">
        <div className="eyebrow">LEVEL 1 · UNCLASSED ADVENTURER</div>
        <div className="xp">0 <small>lifetime XP</small></div>
        <p className="muted">0 of {quests.length} quests completed · No XP penalty for missed days</p>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(quests.length, 1)} aria-valuenow={0}>
          <span style={{ width: '0%' }} />
        </div>
      </section>
      <section className="panel">
        <h2>Quest Board</h2>
        {quests.length === 0 && <p className="muted">Create your first quest below.</p>}
        {quests.map((quest) => (
          <div className="quest" key={quest.id}>
            <div className="quest-main">
              <div className="quest-title">{quest.title}</div>
              <div className="muted">Due {today}</div>
              <div className="muted">{domainLabel(quest.focus)} · {quest.cadence === 'daily' ? 'Daily' : 'One-time'} · +1 XP</div>
            </div>
            <div className="actions">
              <button className="btn ghost" type="button">Defer</button>
              <button className="btn" type="button">Complete</button>
            </div>
          </div>
        ))}
      </section>
      <form id="create-quest" className="panel" onSubmit={(event) => event.preventDefault()}>
        <h2>Create or approve a quest</h2>
        <p className="muted">Quests proposed in ChatGPT can open here prefilled. Review before saving.</p>
        <label htmlFor="quest-title">What real-world action will you take?</label>
        <input id="quest-title" className="field" maxLength={120} placeholder="e.g. Fold and put away laundry" readOnly />
        <button className="btn" type="button">Schedule quest</button>
      </form>
    </main>
  );
}
