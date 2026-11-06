'use client';

import { useEffect, useRef, useState } from 'react';
import { homeCharacterModel } from '../../lib/preview/characterRender';
import { levelUpView, progressionFromTotal, SAMPLE_PROGRESSION, type LevelUpView } from '../../lib/preview/progression';
import { displayedQuestXp, MEAL_KEYS, MEAL_QUEST_ID, SAMPLE_QUESTS, type MealKey, type SampleQuest } from '../../lib/preview/sampleQuests';
import { HomeCharacter } from './HomeCharacter';
import { LevelUpCelebration } from './LevelUpCelebration';
import { QuestSheet } from './QuestSheet';
import { StatusBlock } from './StatusBlock';
import { usePreviewAppearance } from './usePreviewAppearance';

export function HomeScreen() {
  const { appearance } = usePreviewAppearance();
  const model = homeCharacterModel(appearance);
  const [done, setDone] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loggedMeals, setLoggedMeals] = useState<MealKey[]>([]);
  const mealLogLock = useRef(new Set<MealKey>());
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
  const pendingQuests = SAMPLE_QUESTS.filter((quest) => !done.includes(quest.id));
  const completedQuests = SAMPLE_QUESTS.filter((quest) => done.includes(quest.id));

  useEffect(() => () => {
    for (const id of timers.current) window.clearTimeout(id);
  }, []);

  function logMeal(meal: MealKey) {
    if (mealLogLock.current.has(meal) || completedIds.current.has(MEAL_QUEST_ID)) return;
    mealLogLock.current.add(meal);
    const next = MEAL_KEYS.filter((key) => mealLogLock.current.has(key));
    setLoggedMeals([...next]);
    if (next.length === MEAL_KEYS.length) {
      const quest = SAMPLE_QUESTS.find((entry) => entry.id === MEAL_QUEST_ID);
      if (quest) completeQuest(quest);
    }
  }

  function completeQuest(quest: SampleQuest) {
    if (completedIds.current.has(quest.id)) return;
    if (quest.id === MEAL_QUEST_ID && mealLogLock.current.size !== MEAL_KEYS.length) return;
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
          {pendingQuests.map((quest) => {
            const complete = done.includes(quest.id);
            const popping = feedback?.id === quest.id;
            return (
              <li key={quest.id}>
                <button
                  type="button"
                  className={['quest-row', complete ? 'is-done' : '', popping ? 'is-pop' : ''].filter(Boolean).join(' ')}
                  onClick={() => quest.id === MEAL_QUEST_ID ? undefined : setOpenId(quest.id)}
                  aria-label={complete ? `${quest.title}, completed` : quest.title}
                >
                  <span className="quest-mark" aria-hidden="true">{complete ? '✓' : ''}</span>
                  <span className="quest-label">{quest.title}{quest.id === MEAL_QUEST_ID ? ` — ${loggedMeals.length}/3` : ""}</span>
                </button>
                {quest.id === MEAL_QUEST_ID ? (
                  <div className="meal-log-actions" role="group" aria-label="Log meals">
                    {MEAL_KEYS.map((meal) => (
                      <button key={meal} type="button" className="meal-log-button"
                        aria-pressed={loggedMeals.includes(meal)}
                        disabled={loggedMeals.includes(meal)}
                        onClick={() => logMeal(meal)}>
                        {loggedMeals.includes(meal) ? '✓ ' : '+ '}{meal[0].toUpperCase() + meal.slice(1)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {completedQuests.length > 0 ? (
          <div className="completed-quests">
            <button
              type="button"
              className="completed-toggle"
              aria-expanded={showCompleted}
              aria-controls="completed-quest-list"
              onClick={() => setShowCompleted((current) => !current)}
            >
              <span>Completed ({completedQuests.length})</span>
              <span className={`collapsible-chevron${showCompleted ? ' is-open' : ''}`} aria-hidden="true">▸</span>
            </button>
            {showCompleted ? (
              <ul id="completed-quest-list" className="quest-list completed-list">
                {completedQuests.map((quest) => (
                  <li key={quest.id}>
                    <button type="button" className="quest-row is-done"
                      onClick={() => setOpenId(quest.id)} aria-label={`${quest.title}, completed`}>
                      <span className="quest-mark" aria-hidden="true">✓</span>
                      <span className="quest-label">{quest.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
