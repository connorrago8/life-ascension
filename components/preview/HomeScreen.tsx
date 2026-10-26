'use client';

import { useEffect, useRef, useState } from 'react';
import { homeCharacterModel } from '../../lib/preview/characterRender';
import { levelUpView, progressionFromTotal, SAMPLE_PROGRESSION, type LevelUpView } from '../../lib/preview/progression';
import { displayedQuestXp, SAMPLE_QUESTS, type SampleQuest } from '../../lib/preview/sampleQuests';
import { HomeCharacter } from './HomeCharacter';
import { LevelUpCelebration } from './LevelUpCelebration';
import { QuestSheet } from './QuestSheet';
import { StatusBlock } from './StatusBlock';
import { usePreviewAppearance } from './usePreviewAppearance';

export function HomeScreen() {
  const { appearance } = usePreviewAppearance();
  const model = homeCharacterModel(appearance);
  const [done, setDone] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [xp, setXp] = useState(SAMPLE_PROGRESSION.xp);
  const [feedback, setFeedback] = useState<{ id: string; amount: number } | null>(null);
  const [celebration, setCelebration] = useState<LevelUpView | null>(null);
  const timers = useRef<number[]>([]);
  // Refs guard against multiple clicks before React commits a render.
  const completedIds = useRef(new Set<string>());
  const currentXp = useRef(SAMPLE_PROGRESSION.xp);
  const open = SAMPLE_QUESTS.find((quest) => quest.id === openId) ?? null;
  const progression = progressionFromTotal(xp);

  useEffect(() => () => {
    for (const id of timers.current) window.clearTimeout(id);
  }, []);

  function completeQuest(quest: SampleQuest) {
    if (completedIds.current.has(quest.id)) return;
    completedIds.current.add(quest.id);
    const gain = displayedQuestXp(quest);
    const previousXp = currentXp.current;
    const nextXp = previousXp + gain;
    currentXp.current = nextXp;
    const view = levelUpView(previousXp, nextXp);
    setDone((current) => current.includes(quest.id) ? current : [...current, quest.id]);
    setOpenId(null);
    setXp(nextXp);
    setFeedback({ id: quest.id, amount: gain });
    const hide = window.setTimeout(() => setFeedback((current) => (current?.id === quest.id ? null : current)), 1400);
    timers.current.push(hide);
    if (!view) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = window.setTimeout(() => setCelebration(view), reduce ? 0 : 1100);
    timers.current.push(reveal);
  }

  return (
    <main className="preview-screen home-screen">
      <StatusBlock
        name={appearance.name}
        progression={progression}
        gaining={feedback != null}
        floatXp={feedback?.amount ?? null}
      />
      <section className="home-stage" aria-label="Adventurer">
        <div
          className="stage-disc"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at 50% 42%, ${model.skin}33, ${model.tunic}22 46%, transparent 72%)`,
          }}
        />
        <div className={feedback ? 'react-wrap is-reacting' : 'react-wrap'} data-reacting={feedback ? 'true' : 'false'}>
          <HomeCharacter model={model} />
        </div>
      </section>
      <section className="quest-block" aria-labelledby="today-quests">
        <h2 id="today-quests" data-quest-count={`${done.length}/${SAMPLE_QUESTS.length}`}>
          TODAY'S QUESTS — {done.length}/{SAMPLE_QUESTS.length}
        </h2>
        <ul className="quest-list">
          {SAMPLE_QUESTS.map((quest) => {
            const complete = done.includes(quest.id);
            const popping = feedback?.id === quest.id;
            return (
              <li key={quest.id}>
                <button
                  type="button"
                  className={['quest-row', complete ? 'is-done' : '', popping ? 'is-pop' : ''].filter(Boolean).join(' ')}
                  onClick={() => setOpenId(quest.id)}
                  aria-label={complete ? `${quest.title}, completed` : quest.title}
                >
                  <span className="quest-mark" aria-hidden="true">{complete ? '✓' : ''}</span>
                  <span className="quest-label">{quest.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {open ? (
        <QuestSheet
          quest={open}
          completed={done.includes(open.id)}
          doneCount={done.length}
          total={SAMPLE_QUESTS.length}
          onClose={() => setOpenId(null)}
          onComplete={() => completeQuest(open)}
        />
      ) : null}
      {celebration ? <LevelUpCelebration view={celebration} onSkip={() => setCelebration(null)} /> : null}
    </main>
  );
}
