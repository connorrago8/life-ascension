'use client';

import { itemIds, visibleItem } from '../../lib/preview/appearance';
import { adventureCharacterModel, homeCharacterModel } from '../../lib/preview/characterRender';
import { effectsForItems, formatGearEffects } from '../../lib/preview/equipmentEffects';
import { levelTitle, SAMPLE_PROGRESSION, xpLabel } from '../../lib/preview/progression';
import { AdventureCharacter } from './AdventureCharacter';
import { DungeonArt } from './DungeonArt';
import { HomeCharacter } from './HomeCharacter';
import { usePreviewAppearance } from './usePreviewAppearance';

export function CompareScreen() {
  const { appearance, toggleMainHand } = usePreviewAppearance();
  const home = homeCharacterModel(appearance);
  const adventure = adventureCharacterModel(appearance);
  const held = visibleItem(appearance, 'main-hand');
  const effects = formatGearEffects(effectsForItems(itemIds(appearance)));

  return (
    <main className="preview-screen compare-screen">
      <h1 className="compare-title">{appearance.name}</h1>
      <p className="level-line">{levelTitle(SAMPLE_PROGRESSION)} · {xpLabel(SAMPLE_PROGRESSION)}</p>
      <div className="compare-grid">
        <figure className="compare-card">
          <figcaption>Home</figcaption>
          <HomeCharacter model={home} idPrefix="compare" />
        </figure>
        <figure className="compare-card compare-card-pixel">
          <figcaption>Adventure</figcaption>
          <div className="compare-dungeon">
            <DungeonArt />
            <AdventureCharacter model={adventure} className="compare-hero" />
          </div>
        </figure>
      </div>
      <button type="button" className="sheet-action" onClick={toggleMainHand}>
        Swap main hand
      </button>
      <p className="held-caption">Main hand · {held ? held.name : 'Empty'}</p>
      <p className="gear-line">Gear effects · {effects || 'None'}</p>
    </main>
  );
}
