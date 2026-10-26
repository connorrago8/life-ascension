'use client';

import { useState } from 'react';
import { AdventurerSprite } from '../AdventurerSprite';
import { SPRITES } from '../../lib/crypt/art';
import { COMBAT, SENTINEL, turnLabel } from '../../lib/crypt/content';
import { availableActions, type ActionId, type BattleState } from '../../lib/crypt/engine';
import { PixelArt } from './PixelArt';

function ActionIcon({ id }: { id: ActionId }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {id === 'attack' && (
        <>
          <path d="M5.5 18.5 15.2 6.2" />
          <path d="M13.2 5.6h5.2v5.2" />
        </>
      )}
      {id === 'defend' && <path d="M12 3.8 19 6.4v5.2c0 4.2-2.8 7.2-7 8.6-4.2-1.4-7-4.4-7-8.6V6.4z" />}
      {id === 'heavy' && (
        <>
          <path d="M8.2 17.4 17.4 6.4" />
          <path d="M15.2 5.6h4.2v4.2" />
          <path d="M4.6 14.6 12.8 4.8" />
        </>
      )}
      {id === 'focus' && (
        <path d="M16.8 8.2A6.2 6.2 0 0 0 8 12.2M7.2 15.8A6.2 6.2 0 0 0 16 11.8M12 8.4v4l2.2 1.3" />
      )}
    </svg>
  );
}

function Health({ name, hp, maxHp }: { name: string; hp: number; maxHp: number }) {
  const current = Math.max(0, hp);
  const width = maxHp > 0 ? Math.min(100, (current / maxHp) * 100) : 0;
  return (
    <div className="hp-block">
      <p className="hp-readout">{current}/{maxHp}</p>
      <div
        className="hp-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={current}
        aria-label={`${name} health`}
      >
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function CombatView({
  battle,
  onAction,
  onContinue,
  onRetry,
}: {
  battle: BattleState;
  onAction: (action: ActionId) => void;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const ready = availableActions(battle);
  const guardian = battle.enemy.id === SENTINEL.id;
  const lines = battle.log.length > 0 ? battle.log.slice(-2) : [guardian ? COMBAT.guardianOpening : COMBAT.opening];
  return (
    <div className="combat">
      <section className="fighter" aria-label={battle.enemy.name}>
        <Health name={battle.enemy.name} hp={battle.enemy.hp} maxHp={battle.enemy.maxHp} />
        <div className="crypt-stage">
          <PixelArt rows={guardian ? SPRITES.sentinel : SPRITES.rat} label={battle.enemy.name} className="crypt-actor" />
          <PixelArt rows={SPRITES.platform} className="crypt-platform" />
        </div>
        <h2>{battle.enemy.name}</h2>
      </section>

      <p className="turn-line">
        {battle.status === 'won' ? COMBAT.victory : battle.status === 'lost' ? COMBAT.defeat : turnLabel(battle.turn)}
        {battle.focused && battle.status === 'ongoing' ? <span className="crypt-chip">{COMBAT.focused}</span> : null}
      </p>

      <section className="fighter" aria-label={battle.player.name}>
        <div className="crypt-stage crypt-stage-player">
          <AdventurerSprite label={battle.player.name} />
          <PixelArt rows={SPRITES.platform} className="crypt-platform" />
        </div>
        <h2>{battle.player.name}</h2>
        <Health name={battle.player.name} hp={battle.player.hp} maxHp={battle.player.maxHp} />
      </section>

      <div className="combat-log" role="status" aria-live="polite">
        {lines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
      </div>

      {battle.log.length > 2 && (
        <section className="combat-history" aria-label="Combat history">
          <button type="button" className="btn ghost crypt-block"
            aria-expanded={showHistory} aria-controls="crypt-combat-history"
            onClick={() => setShowHistory((current) => !current)}>
            {showHistory ? 'Hide' : 'Review'} combat history ({battle.log.length} events)
          </button>
          {showHistory && (
            <ol id="crypt-combat-history" className="combat-history-list">
              {battle.log.map((line, index) => <li key={index}>{line}</li>)}
            </ol>
          )}
        </section>
      )}

      {battle.status === 'won' && (
        <>
          <p className="combat-result">{guardian ? COMBAT.guardianWin : COMBAT.win}</p>
          <button type="button" className="btn crypt-block" onClick={onContinue}>{COMBAT.continue}</button>
        </>
      )}
      {battle.status === 'lost' && (
        <>
          <p className="combat-result">{guardian ? COMBAT.guardianLose : COMBAT.lose}</p>
          <button type="button" className="btn crypt-block" onClick={onRetry}>{COMBAT.retry}</button>
        </>
      )}
      {battle.status === 'ongoing' && (
        <div className="action-grid">
          {COMBAT.actions.map((action) => {
            const enabled = ready.includes(action.id);
            const detail = action.id === 'heavy' && !enabled ? COMBAT.heavyWaiting : action.detail;
            return (
              <button
                key={action.id}
                type="button"
                className="btn ghost combat-action"
                disabled={!enabled}
                onClick={() => onAction(action.id)}
              >
                <ActionIcon id={action.id} />
                <strong>{action.label}</strong>
                <small>{detail}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
