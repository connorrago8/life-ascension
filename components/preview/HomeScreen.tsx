'use client';

import { useState } from 'react';
import { visibleItem } from '../../lib/preview/appearance';
import { homeCharacterModel } from '../../lib/preview/characterRender';
import { SAMPLE_PROGRESSION } from '../../lib/preview/progression';
import { SAMPLE_QUESTS } from '../../lib/preview/sampleQuests';
import { HomeCharacter } from './HomeCharacter';
import { Loadout } from './Loadout';
import { QuestSheet } from './QuestSheet';
import { StatusBlock } from './StatusBlock';
import { usePreviewAppearance } from './usePreviewAppearance';

export function HomeScreen() {
  const { appearance, toggleMainHand } = usePreviewAppearance();
  const model = homeCharacterModel(appearance);
  const [done, setDone] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = SAMPLE_QUESTS.find((quest) => quest.id === openId) ?? null;
  const held = visibleItem(appearance, 'main-hand');

  return (
    <main className="preview-screen home-screen">
      <StatusBlock name={appearance.name} progression={SAMPLE_PROGRESSION} />
      <section className="home-stage" aria-label="Adventurer">
        <div
          className="stage-disc"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at 50% 42%, ${model.skin}33, ${model.tunic}22 46%, transparent 72%)`,
          }}
        />
        <Loadout appearance={appearance} onSwapMain={toggleMainHand}>
          <HomeCharacter model={model} />
        </Loadout>
        <p className="held-caption">{held ? held.name : 'Empty hands'}</p>
      </section>
      <section className="quest-block" aria-labelledby="today-quests">
        <h2 id="today-quests" data-quest-count={`${done.length}/${SAMPLE_QUESTS.length}`}>
          TODAY'S QUESTS — {done.length}/{SAMPLE_QUESTS.length}
        </h2>
        <ul className="quest-list">
          {SAMPLE_QUESTS.map((quest) => {
            const complete = done.includes(quest.id);
            return (
              <li key={quest.id}>
                <button
                  type="button"
                  className={complete ? 'quest-row is-done' : 'quest-row'}
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
          onComplete={() => setDone((current) => (current.includes(open.id) ? current : [...current, open.id]))}
        />
      ) : null}
    </main>
  );
}
