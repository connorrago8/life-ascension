'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { CompanionNav } from '../../../components/CompanionNav';
import { CompanionHero } from '../../../components/companion/CompanionHero';
import { CompanionPassView, type Wardrobe } from '../../../components/companion/CompanionWardrobe';
import { QuestBoard } from '../../../components/companion/QuestBoard';
import { PASS_TIERS } from '../../../lib/companionPass';
import { PixelAvatar } from '../../../components/PixelAvatar';

const QUEST_ROWS = [
  { id: '1', title: 'Trash out', status: 'completed' },
  { id: '2', title: 'Bowling', status: 'accepted' },
  { id: '3', title: "We're throwing a party this Friday and I need him to pick up paper plates and napkins from work sometime before then", status: 'accepted' },
  { id: '4', title: 'The recycling pile is looking like that could be taken care of today too', status: 'completed' },
  { id: '5', title: 'It would be super helpful for Connor to drop off his dry cleaning sometime soon', status: 'completed' },
  { id: '6', title: 'Do the dishes', status: 'completed' },
  { id: '7', title: 'Went to yoga', status: 'accepted' },
];

function mockWardrobe(): Wardrobe {
  return {
    level: 7,
    xp: 120,
    xpForNext: 40,
    items: PASS_TIERS.map((tier) => ({
      ...tier,
      owned: tier.unlockLevel <= 7 && tier.grantKind === 'level',
      worn: tier.id === 'bow' || tier.id === 'sparkle-boots',
      fresh: tier.id === 'sparkle-boots',
      activityKey: tier.activityKey ?? null,
      activityNeed: tier.activityNeed ?? null,
    })),
  };
}

export function GalleryScreen({ screen, completedOpen }: { screen: 'home' | 'quests' | 'rewards' | 'character'; completedOpen: boolean }) {
  const wardrobe = mockWardrobe();
  const worn = wardrobe.items.filter((item) => item.worn).map((item) => item.id);
  useEffect(() => {
    if (screen === 'quests' && completedOpen) {
      document.getElementById('cq-completed')?.scrollIntoView({ block: 'start' });
    }
  }, [screen, completedOpen]);
  const path = `/companion/${screen === 'home' ? 'home' : screen}`;
  return (
    <div className="shell companion-shell gallery-phone">
      <CompanionNav pathname={path} />
      <div className="shell-main">
        {screen === 'home' && (
          <main className="wrap companion-page">
            <section className="cq-hero-card">
              <CompanionHero worn={worn} label="Izzy" />
              <div>
                <p className="cq-kicker">Her home</p>
                <h1>Hello, Izzy</h1>
                <p className="muted">Dawn Herald</p>
                <p className="cq-level-line">Level 7</p>
                <div className="cq-heartbar"><span style={{ width: '40%' }} /></div>
                <p className="cq-next">Next: Lantern pin</p>
              </div>
            </section>
            <p className="companion-fanfare cq-sparkles" role="status">
              <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
              Unlocked: Sparkly boots ♥
            </p>
            <section className="cq-bubble" aria-label="Hero greeting">
              <PixelAvatar who="connor" size={48} alt="Connor's hero, a pixel knight in silver armor" />
              <p>Connor&apos;s hero says hi, Izzy. ♥</p>
            </section>
            <div className="companion-metrics">
              <p className="companion-metric"><strong>2</strong><span>Open quests</span></p>
              <p className="companion-metric"><strong>4</strong><span>Done this week</span></p>
            </div>
            <section className="companion-card">
              <h2>Recent</h2>
              <ul className="cq-timeline">
                <li><span aria-hidden="true">✿</span>Went to yoga</li>
                <li><span aria-hidden="true">✿</span>Cooked dinner</li>
              </ul>
            </section>
            <Link className="btn companion-create" href="/companion/quests">Create quest</Link>
          </main>
        )}
        {screen === 'quests' && (
          <main className="wrap companion-page">
            <h1>Quests</h1>
            <form className="cq-notebook">
              <label htmlFor="brain-dump">Just type</label>
              <textarea id="brain-dump" className="field" readOnly placeholder="Example: yoga tonight, dishes after dinner, and a weekly cardboard run" />
              <button className="btn cq-spark" type="button">✦ Turn into quests</button>
            </form>
            <QuestBoard quests={QUEST_ROWS} userId="gallery" busy={false} onNudge={() => undefined} completedOpen={completedOpen} />
          </main>
        )}
        {screen === 'rewards' && (
          <main className="wrap companion-page">
            <h1>Rewards</h1>
            <p className="muted">A real-life treat. It never grants XP.</p>
            <form className="companion-card">
              <label htmlFor="reward-text">Reward</label>
              <input id="reward-text" className="field" readOnly value="Ice cream after the week" />
              <label htmlFor="reward-goal">Quests this week</label>
              <input id="reward-goal" className="field" readOnly value="5" />
              <button className="btn" type="button">Save reward</button>
            </form>
            <ul className="cq-list">
              <li className="cq-card is-open">
                <div className="cq-card-main">
                  <p className="cq-title">Ice cream after the week</p>
                  <p className="cq-hearts">♥♥♡♡♡</p>
                  <span className="cq-pill">2 of 5</span>
                </div>
              </li>
              <li className="cq-card is-done">
                <div className="cq-card-main">
                  <p className="cq-title">Movie night</p>
                  <p className="cq-hearts">♥♥♥</p>
                  <span className="cq-pill is-done">Unlocked</span>
                </div>
              </li>
            </ul>
          </main>
        )}
        {screen === 'character' && (
          <main className="wrap companion-page">
            <header className="cq-char-head"><h1>Character</h1><button className="btn ghost" type="button">Menu</button></header>
            <CompanionPassView wardrobe={wardrobe} banner={['Sparkly boots']} busy={false} onWear={() => undefined} />
          </main>
        )}
      </div>
    </div>
  );
}
