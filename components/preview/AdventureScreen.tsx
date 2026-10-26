'use client';

import { visibleItem } from '../../lib/preview/appearance';
import { adventureCharacterModel } from '../../lib/preview/characterRender';
import { AdventureCharacter } from './AdventureCharacter';
import { DungeonArt } from './DungeonArt';
import { usePreviewAppearance } from './usePreviewAppearance';

export function AdventureScreen() {
  const { appearance } = usePreviewAppearance();
  const model = adventureCharacterModel(appearance);
  const held = visibleItem(appearance, 'main-hand');

  return (
    <main className="preview-screen adventure-screen">
      <div className="dungeon scene-enter">
        <DungeonArt />
        <div className="dungeon-glow" aria-hidden="true" />
        <div className="dungeon-vignette" aria-hidden="true" />
        <AdventureCharacter model={model} />
        <p className="dungeon-name">{model.name}</p>
        <p className="dungeon-held">{held ? held.name : 'Empty hands'}</p>
      </div>
      <p className="dungeon-note">The Lower Stair · placeholder scene</p>
    </main>
  );
}
