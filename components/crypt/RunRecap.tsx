import { bonusLabel, lootById, passiveLabel, RARITY_LABEL } from '../../lib/crypt/delve/loot';
import { lootRetainedLine, plural, type RunRecap as Recap, type SaveMode } from '../../lib/crypt/delve/recap';

/**
 * Victory ("Floor 1 Conquered") and defeat ("The Road Continues") screens.
 * Only tracked run facts are shown. Nothing here equips gear: wearing is
 * always an explicit Wear tap at camp. No timers; the entrance animation is
 * CSS-only and switched off for reduced motion.
 */
export type RunRecapProps = {
  recap: Recap;
  mode: SaveMode;
  /** Drops the server confirmed into the vault (signed-in runs only). */
  confirmed: number;
  checkpoint: string | null;
  onContinue: () => void;
  exitHref: string;
};

export function RunRecapView({ recap, mode, confirmed, checkpoint, onContinue, exitHref }: RunRecapProps) {
  const won = recap.result === 'conquered';
  const reward = recap.bossReward ? lootById(recap.bossReward) : undefined;
  const found = recap.found.length;
  const kept = mode === 'vault' ? Math.min(confirmed, found) : found;
  const gearNames = recap.found.map((id) => lootById(id)?.name ?? id);
  const gearLine = mode === 'vault'
    ? kept < found ? `${kept} of ${found} saved so far` : plural(kept, 'item') + ' saved'
    : `${plural(found, 'item')} kept for this ${mode === 'preview' ? 'preview' : 'visit'}`;
  const rewardStatus = mode === 'vault'
    ? (kept >= found ? 'Saved to your vault' : 'Saving to your vault…')
    : 'Kept in camp · not saved to your account';
  return (
    <section aria-labelledby="recap-title" className={`recap ${won ? 'recap-won' : 'recap-lost'}`}>
      <p className="recap-kicker">Forgotten Crypt · Floor {recap.floor}</p>
      <h2 id="recap-title" className="recap-title">{won ? `Floor ${recap.floor} Conquered` : 'The Road Continues'}</h2>
      <p className="recap-lede">
        {won ? 'The Hollow Warden crumbles. Floors 2–5 open in a later update.'
          : recap.fellTo ? `${recap.fellTo} got the better of you this time. Rest, rebuild, and go again.` : 'This run is over. Rest, rebuild, and go again.'}
      </p>
      {mode !== 'vault' ? (
        <p className="recap-mode" role="note">{mode === 'preview' ? 'Preview' : 'Not signed in'}: this run isn&rsquo;t saved to your account.</p>
      ) : null}

      {won ? (
        reward ? (
          <div className={`recap-reward rarity-${reward.rarity}`} aria-label={`Boss reward: ${reward.name}`}>
            <p className="recap-reward-label">Boss reward</p>
            <p className="recap-reward-name">{reward.name}</p>
            <p className="delve-small">{RARITY_LABEL[reward.rarity]} · {bonusLabel(reward)}</p>
            {passiveLabel(reward) ? <p className="delve-small delve-passive">✦ {passiveLabel(reward)}</p> : null}
            <p className="delve-small recap-reward-status">{rewardStatus}</p>
          </div>
        ) : <p className="recap-reward recap-reward-none">The Warden left no gear this time.</p>
      ) : (
        <p className="recap-retained" role="status">{lootRetainedLine(mode, false)}</p>
      )}

      <dl className="recap-summary" aria-label="Run summary">
        <div><dt>Result</dt><dd>{won ? 'Conquered' : 'Fallen'}</dd></div>
        <div><dt>Rooms</dt><dd>{recap.roomsCleared} of {recap.roomsTotal} cleared</dd></div>
        <div><dt>Gear</dt><dd>{found === 0 ? 'None found' : gearLine}</dd></div>
      </dl>
      {found > 0 ? <p className="delve-small muted recap-gear-names">{gearNames.join(' · ')}</p> : null}
      {won && checkpoint ? <p className="delve-note" role="status">{checkpoint}</p> : null}
      {found > 0 ? <p className="delve-small muted">Nothing is worn automatically. Tap Wear at camp to bring gear on your next run.</p> : null}

      <div className="recap-actions">
        <button type="button" className="btn recap-continue" onClick={onContinue}>Continue to camp</button>
        <a className="btn ghost" href={exitHref}>Leave the Crypt</a>
      </div>
    </section>
  );
}
