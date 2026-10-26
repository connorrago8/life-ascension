import { adventureCharacterModel, homeCharacterModel } from '../../lib/preview/characterRender';
import type { Appearance } from '../../lib/preview/appearance';
import { AdventureCharacter } from './AdventureCharacter';
import { DungeonArt } from './DungeonArt';
import { HomeCharacter } from './HomeCharacter';

export function CharacterPair({ appearance, idPrefix, compact = false }: { appearance: Appearance; idPrefix: string; compact?: boolean }) {
  const home = homeCharacterModel(appearance);
  const adventure = adventureCharacterModel(appearance);
  return (
    <div className={compact ? 'compare-grid pair-compact' : 'compare-grid'}>
      <figure className="compare-card">
        <figcaption>Home</figcaption>
        <HomeCharacter model={home} idPrefix={idPrefix} />
      </figure>
      <figure className="compare-card compare-card-pixel">
        <figcaption>Adventure</figcaption>
        <div className="compare-dungeon">
          <DungeonArt />
          <AdventureCharacter model={adventure} className="compare-hero" />
        </div>
      </figure>
    </div>
  );
}
